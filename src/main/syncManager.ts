import { dialog } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { basename, extname } from 'path'
import { MusicLibrary, Song } from './musicLibrary'
import { PlaylistManager } from './playlistManager'

export interface SyncResult {
  success: boolean
  message: string
  matched?: number
  missing?: number
  missingSongs?: string[]
}

export interface M3USong {
  title: string
  artist: string
  duration: number
  filePath: string | null
}

export class SyncManager {
  constructor(
    private musicLibrary: MusicLibrary,
    private playlistManager: PlaylistManager
  ) {}

  async exportPlaylist(playlistId: string): Promise<string | null> {
    const playlist = this.playlistManager.getById(playlistId)
    if (!playlist) return null

    const { filePath } = await dialog.showSaveDialog({
      title: '导出歌单',
      defaultPath: `${playlist.name}.m3u`,
      filters: [{ name: 'M3U 歌单', extensions: ['m3u', 'm3u8'] }],
    })

    if (!filePath) return null

    const songs = this.playlistManager.getPlaylistSongs(playlistId)
    const m3uContent = this.generateM3U(playlist.name, songs)

    await writeFile(filePath, m3uContent, 'utf-8')
    return filePath
  }

  async importM3U(): Promise<{ name: string; songs: M3USong[] } | null> {
    const { filePaths } = await dialog.showOpenDialog({
      title: '导入歌单',
      filters: [{ name: 'M3U 歌单', extensions: ['m3u', 'm3u8'] }],
      properties: ['openFile'],
    })

    if (filePaths.length === 0) return null

    const content = await readFile(filePaths[0], 'utf-8')
    const name = basename(filePaths[0], extname(filePaths[0]))
    const songs = this.parseM3U(content)

    return { name, songs }
  }

  async syncFromExternalLibrary(
    musicDirs: string[],
    externalPlaylistPath?: string
  ): Promise<SyncResult> {
    const songs = this.musicLibrary.getSongs()
    if (songs.length === 0) {
      return { success: false, message: '请先扫描本地音乐库' }
    }

    let matched = 0
    let missing = 0
    const missingSongs: string[] = []

    if (externalPlaylistPath) {
      const content = await readFile(externalPlaylistPath, 'utf-8')
      const playlistSongs = this.parseM3U(content)

      for (const ps of playlistSongs) {
        const found = this.matchSong(ps.title, ps.artist, songs)
        if (found) {
          matched++
        } else {
          missing++
          missingSongs.push(`${ps.artist} - ${ps.title}`)
        }
      }
    }

    return {
      success: true,
      message: `同步完成`,
      matched,
      missing,
      missingSongs,
    }
  }

  async exportAllPlaylists(): Promise<string | null> {
    const { filePath } = await dialog.showSaveDialog({
      title: '导出所有歌单',
      defaultPath: 'playlists.json',
      filters: [{ name: 'JSON 文件', extensions: ['json'] }],
    })

    if (!filePath) return null

    const playlists = this.playlistManager.getAll()
    const exportData = playlists.map(p => ({
      ...p,
      songs: this.playlistManager.getPlaylistSongs(p.id),
    }))

    await writeFile(filePath, JSON.stringify(exportData, null, 2), 'utf-8')
    return filePath
  }

  async importPlaylists(): Promise<number> {
    const { filePaths } = await dialog.showOpenDialog({
      title: '导入歌单',
      filters: [{ name: 'JSON 文件', extensions: ['json'] }],
      properties: ['openFile'],
    })

    if (filePaths.length === 0) return 0

    const content = await readFile(filePaths[0], 'utf-8')
    const playlists = JSON.parse(content)

    let imported = 0
    for (const p of playlists) {
      const playlist = this.playlistManager.create(p.name)
      for (const song of p.songs || []) {
        const found = this.matchSong(song.title, song.artist, this.musicLibrary.getSongs())
        if (found) {
          this.playlistManager.addSong(playlist.id, found.id)
        }
      }
      imported++
    }

    return imported
  }

  private generateM3U(name: string, songs: Song[]): string {
    const lines = ['#EXTM3U', `#PLAYLIST:${name}`]

    for (const song of songs) {
      const duration = Math.floor(song.duration)
      const artist = song.artist || 'Unknown Artist'
      const title = song.title

      lines.push(`#EXTINF:${duration},${artist} - ${title}`)
      lines.push(song.filePath)
    }

    return lines.join('\n')
  }

  private parseM3U(content: string): M3USong[] {
    const songs: M3USong[] = []
    const lines = content.split('\n')

    let currentSong: Partial<M3USong> = {}

    for (const line of lines) {
      const trimmed = line.trim()

      if (trimmed.startsWith('#EXTINF:')) {
        const match = trimmed.match(/#EXTINF:(-?\d+),(.+)/)
        if (match) {
          currentSong.duration = parseInt(match[1]) || 0
          const info = match[2]
          const parts = info.split(' - ')
          if (parts.length >= 2) {
            currentSong.artist = parts[0].trim()
            currentSong.title = parts.slice(1).join(' - ').trim()
          } else {
            currentSong.title = info.trim()
            currentSong.artist = ''
          }
        }
      } else if (trimmed && !trimmed.startsWith('#')) {
        currentSong.filePath = trimmed
        if (currentSong.title) {
          songs.push({
            title: currentSong.title || '',
            artist: currentSong.artist || '',
            duration: currentSong.duration || 0,
            filePath: currentSong.filePath || null,
          })
        }
        currentSong = {}
      }
    }

    return songs
  }

  private matchSong(title: string, artist: string, songs: Song[]): Song | null {
    const titleLower = title.toLowerCase()
    const artistLower = artist.toLowerCase()

    for (const song of songs) {
      if (song.title.toLowerCase() === titleLower) {
        if (!artist || song.artist.toLowerCase().includes(artistLower)) {
          return song
        }
      }
    }

    for (const song of songs) {
      if (song.title.toLowerCase().includes(titleLower)) {
        return song
      }
    }

    return null
  }
}