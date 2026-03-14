import { dialog, BrowserWindow } from 'electron'
import { readFile, writeFile, readdir, stat, mkdir, copyFile, unlink } from 'fs/promises'
import { basename, extname, join, relative, resolve } from 'path'
import { existsSync } from 'fs'
import { createHash } from 'crypto'
import { MusicLibrary, Song } from './musicLibrary'
import { PlaylistManager } from './playlistManager'
import type { DeviceInfo } from './deviceManager'

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

export interface LibrarySyncResult {
  success: boolean
  message: string
  songsCopied: number
  songsSkipped: number
  songsDeleted: number
  playlistsSynced: number
  errors: string[]
  totalSize: number
  duration: number
}

export interface SyncPreview {
  error?: string
  toCopyCount: number
  toDeleteCount: number
  playlistsToSync: { id: string; name: string; songCount: number }[]
  totalSize: number
  freeSpaceAfter: number
}

export interface DevicePlaylist {
  name: string
  path: string
  songCount: number
  songs: M3USong[]
}

export class SyncManager {
  private win: BrowserWindow | null = null

  constructor(
    private musicLibrary: MusicLibrary,
    private playlistManager: PlaylistManager
  ) {}

  setWindow(win: BrowserWindow) {
    this.win = win
  }

  private notifyProgress(phase: string, current: number, total: number, message: string) {
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send('sync:progress', { phase, current, total, message })
    }
  }

  async previewSyncToDevice(device: DeviceInfo, options: {
    syncSongs: boolean
    syncPlaylists: boolean
    deleteRemoved: boolean
  }): Promise<SyncPreview> {
    if (!device || !device.drive) {
      return { error: '设备信息无效', toCopyCount: 0, toDeleteCount: 0, playlistsToSync: [], totalSize: 0, freeSpaceAfter: 0 }
    }
    
    const localSongs = this.musicLibrary.getSongs()
    const searchPath = device.musicFolder || device.drive
    
    console.log('Preview sync:', { 
      device: device.drive, 
      musicFolder: device.musicFolder,
      searchPath,
      localSongsCount: localSongs.length 
    })
    
    const deviceSongs = await this.scanDeviceSongs(device)
    
    console.log('Device songs found:', deviceSongs.size)
    if (deviceSongs.size > 0) {
      const sampleKeys = Array.from(deviceSongs.keys()).slice(0, 5)
      console.log('Sample device songs:', sampleKeys)
    }
    
    let toCopyCount = 0
    let toDeleteCount = 0
    let totalSize = 0

    if (options.syncSongs) {
      for (const song of localSongs) {
        const existingPath = this.findDeviceSong(song, deviceSongs)
        if (!existingPath) {
          toCopyCount++
          try {
            const stats = await stat(song.filePath)
            totalSize += stats.size
          } catch {}
        }
      }

      if (options.deleteRemoved) {
        for (const [key, devicePath] of deviceSongs) {
          const fileName = basename(devicePath)
          let foundInLocal = false
          
          for (const song of localSongs) {
            const songFileName = this.getSongFileName(song).toLowerCase()
            if (key === songFileName || key.includes(song.title.toLowerCase())) {
              foundInLocal = true
              break
            }
          }
          
          if (!foundInLocal) {
            toDeleteCount++
          }
        }
      }
    }

    const playlistsToSync: { id: string; name: string; songCount: number }[] = []
    if (options.syncPlaylists) {
      const playlists = this.playlistManager.getAll()
      for (const p of playlists) {
        const songs = this.playlistManager.getPlaylistSongs(p.id)
        playlistsToSync.push({ id: p.id, name: p.name, songCount: songs.length })
      }
    }

    const freeSpaceAfter = device.freeSize - totalSize

    console.log('Preview result:', { 
      toCopyCount, 
      toDeleteCount, 
      playlists: playlistsToSync.length,
      totalSize 
    })

    return {
      toCopyCount,
      toDeleteCount,
      playlistsToSync,
      totalSize,
      freeSpaceAfter
    }
  }

  async syncLibraryToDevice(
    device: DeviceInfo,
    options: {
      syncSongs: boolean
      syncPlaylists: boolean
      deleteRemoved: boolean
    },
    onProgress?: (progress: { phase: string; current: number; total: number; message: string }) => void
  ): Promise<LibrarySyncResult> {
    const startTime = Date.now()
    const result: LibrarySyncResult = {
      success: true,
      message: '',
      songsCopied: 0,
      songsSkipped: 0,
      songsDeleted: 0,
      playlistsSynced: 0,
      errors: [],
      totalSize: 0,
      duration: 0
    }

    if (!device || !device.drive) {
      result.success = false
      result.message = '设备信息无效'
      result.errors.push('设备信息无效')
      return result
    }

    const musicFolder = device.musicFolder || device.drive
    const playlistFolder = device.playlistFolder || join(device.drive, 'Playlists')

    console.log('Sync config:', { 
      musicFolder, 
      playlistFolder, 
      deviceMusicFolder: device.musicFolder,
      deviceDrive: device.drive 
    })

    try {
      await mkdir(musicFolder, { recursive: true })
    } catch {}
    try {
      await mkdir(playlistFolder, { recursive: true })
    } catch {}

    const localSongs = this.musicLibrary.getSongs()
    
    if (options.syncSongs) {
      const deviceSongs = await this.scanDeviceSongs(device)
      const total = localSongs.length

      for (let i = 0; i < localSongs.length; i++) {
        const song = localSongs[i]
        const existingPath = this.findDeviceSong(song, deviceSongs)
        
        if (!existingPath) {
          const fileName = this.getSongFileName(song)
          const targetPath = join(musicFolder, fileName)
          
          try {
            await copyFile(song.filePath, targetPath)
            
            const stats = await stat(song.filePath)
            result.totalSize += stats.size
            result.songsCopied++
            
            this.notifyProgress('copying', i + 1, total, `复制: ${song.title}`)
          } catch (e: any) {
            result.errors.push(`复制失败: ${song.title} - ${e.message}`)
          }
        } else {
          result.songsSkipped++
        }
      }

      if (options.deleteRemoved) {
        const localSongNames = new Set(
          localSongs.map(s => this.getSongFileName(s).toLowerCase())
        )
        
        for (const [key, devicePath] of deviceSongs) {
          if (!localSongNames.has(key)) {
            try {
              await unlink(devicePath)
              result.songsDeleted++
              this.notifyProgress('deleting', result.songsDeleted, deviceSongs.size, `删除: ${basename(devicePath)}`)
            } catch (e: any) {
              result.errors.push(`删除失败: ${basename(devicePath)} - ${e.message}`)
            }
          }
        }
      }
    }

    if (options.syncPlaylists) {
      const playlists = this.playlistManager.getAll()
      const updatedDeviceSongs = await this.scanDeviceSongs(device)
      
      for (const playlist of playlists) {
        const songs = this.playlistManager.getPlaylistSongs(playlist.id)
        const m3uPath = join(playlistFolder, `${playlist.name}.m3u`)
        
        const matchedSongs: Song[] = []
        for (const song of songs) {
          const devicePath = this.findDeviceSong(song, updatedDeviceSongs)
          if (devicePath) {
            matchedSongs.push({ ...song, filePath: devicePath })
          }
        }
        
        const m3uContent = this.generateDeviceM3U(playlist.name, matchedSongs, device)
        try {
          await writeFile(m3uPath, m3uContent, 'utf-8')
          result.playlistsSynced++
          this.notifyProgress('playlists', result.playlistsSynced, playlists.length, `歌单: ${playlist.name}`)
        } catch (e: any) {
          result.errors.push(`歌单导出失败: ${playlist.name} - ${e.message}`)
        }
      }
    }

    result.duration = Date.now() - startTime
    result.message = this.generateSyncMessage(result)
    
    return result
  }

  async importFromDevice(
    device: DeviceInfo,
    options: {
      importSongs: boolean
      importPlaylists: boolean
    }
  ): Promise<LibrarySyncResult> {
    const startTime = Date.now()
    const result: LibrarySyncResult = {
      success: true,
      message: '',
      songsCopied: 0,
      songsSkipped: 0,
      songsDeleted: 0,
      playlistsSynced: 0,
      errors: [],
      totalSize: 0,
      duration: 0
    }

    const localSongs = this.musicLibrary.getSongs()
    const localSongMap = new Map<string, Song>()
    for (const song of localSongs) {
      localSongMap.set(song.title.toLowerCase(), song)
      localSongMap.set(`${song.artist.toLowerCase()} - ${song.title.toLowerCase()}`, song)
    }

    const deviceSongs = await this.scanDeviceSongsDetailed(device)

    if (options.importSongs) {
      for (const [key, info] of deviceSongs) {
        const existing = localSongMap.get(key.toLowerCase())
        if (!existing) {
          result.songsSkipped++
          continue
        }
        result.songsSkipped++
      }
      result.message = '设备上的歌曲已与本地音乐库匹配，无需复制文件'
    }

    if (options.importPlaylists) {
      const devicePlaylists = await this.getDevicePlaylists(device)
      
      for (const dp of devicePlaylists) {
        try {
          const content = await readFile(dp.path, 'utf-8')
          const m3uSongs = this.parseM3U(content)
          
          const playlist = this.playlistManager.create(dp.name)
          
          for (const m3uSong of m3uSongs) {
            const localSong = this.matchSong(m3uSong.title, m3uSong.artist, localSongs)
            if (localSong) {
              this.playlistManager.addSong(playlist.id, localSong.id)
            }
          }
          
          result.playlistsSynced++
          this.notifyProgress('playlists', result.playlistsSynced, devicePlaylists.length, `导入: ${dp.name}`)
        } catch (e: any) {
          result.errors.push(`导入歌单失败: ${dp.name} - ${e.message}`)
        }
      }
    }

    result.duration = Date.now() - startTime
    result.message = `已导入 ${result.playlistsSynced} 个歌单`
    
    return result
  }

  private generateSyncMessage(result: LibrarySyncResult): string {
    const parts: string[] = []
    
    if (result.songsCopied > 0) {
      parts.push(`复制 ${result.songsCopied} 首歌曲`)
    }
    if (result.songsSkipped > 0) {
      parts.push(`跳过 ${result.songsSkipped} 首已存在`)
    }
    if (result.songsDeleted > 0) {
      parts.push(`删除 ${result.songsDeleted} 首`)
    }
    if (result.playlistsSynced > 0) {
      parts.push(`同步 ${result.playlistsSynced} 个歌单`)
    }
    
    const sizeMB = (result.totalSize / (1024 * 1024)).toFixed(1)
    const durationSec = (result.duration / 1000).toFixed(1)
    
    let msg = parts.join('，') || '无变更'
    msg += ` | ${sizeMB} MB | ${durationSec}s`
    
    if (result.errors.length > 0) {
      msg += ` | ${result.errors.length} 个错误`
    }
    
    return msg
  }

  private getSongRelativePath(song: Song): string {
    const ext = extname(song.filePath)
    const artist = this.sanitizeFileName(song.artist || 'Unknown Artist')
    const title = this.sanitizeFileName(song.title)
    return `${artist} - ${title}${ext}`
  }

  private getSongFileName(song: Song): string {
    const ext = extname(song.filePath)
    const artist = this.sanitizeFileName(song.artist || 'Unknown Artist')
    const title = this.sanitizeFileName(song.title)
    return `${artist} - ${title}${ext}`
  }

  private sanitizeFileName(name: string): string {
    return name.replace(/[<>:"/\\|?*]/g, '_').slice(0, 100)
  }

  private normalizePath(path: string): string {
    return path.replace(/\\/g, '/').toLowerCase()
  }

  private async scanDeviceSongs(device: DeviceInfo): Promise<Map<string, string>> {
    const audioExts = ['.mp3', '.flac', '.m4a', '.wav', '.ogg', '.wma', '.ape', '.aac']
    const songMap = new Map<string, string>()
    const searchPath = device.musicFolder || device.drive

    const scan = async (dir: string) => {
      try {
        const entries = await readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = join(dir, entry.name)
          if (entry.isDirectory()) {
            await scan(fullPath)
          } else if (entry.isFile()) {
            const ext = entry.name.split('.').pop()?.toLowerCase()
            if (ext && audioExts.includes(`.${ext}`)) {
              const nameWithoutExt = entry.name.replace(/\.[^.]+$/, '')
              songMap.set(nameWithoutExt.toLowerCase(), fullPath)
            }
          }
        }
      } catch {}
    }

    await scan(searchPath)
    return songMap
  }

  private async scanDeviceSongsDetailed(device: DeviceInfo): Promise<Map<string, { path: string; size: number }>> {
    const audioExts = ['.mp3', '.flac', '.m4a', '.wav', '.ogg', '.wma', '.ape', '.aac']
    const songMap = new Map<string, { path: string; size: number }>()
    const searchPath = device.musicFolder || device.drive

    const scan = async (dir: string) => {
      try {
        const entries = await readdir(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = join(dir, entry.name)
          if (entry.isDirectory()) {
            await scan(fullPath)
          } else if (entry.isFile()) {
            const ext = entry.name.split('.').pop()?.toLowerCase()
            if (ext && audioExts.includes(`.${ext}`)) {
              const nameWithoutExt = entry.name.replace(/\.[^.]+$/, '')
              try {
                const stats = await stat(fullPath)
                songMap.set(nameWithoutExt.toLowerCase(), { path: fullPath, size: stats.size })
              } catch {}
            }
          }
        }
      } catch {}
    }

    await scan(searchPath)
    return songMap
  }

  private findDeviceSong(song: Song, deviceSongs: Map<string, string>): string | null {
    const titleLower = song.title.toLowerCase()
    const artistLower = song.artist?.toLowerCase() || ''

    const patterns = [
      `${artistLower} - ${titleLower}`,
      `${titleLower} - ${artistLower}`,
      titleLower,
    ]

    for (const pattern of patterns) {
      if (deviceSongs.has(pattern)) {
        return deviceSongs.get(pattern)!
      }
    }

    for (const [key, path] of deviceSongs) {
      if (key.includes(titleLower)) {
        return path
      }
    }

    return null
  }

  private generateDeviceM3U(name: string, songs: Song[], device: DeviceInfo): string {
    const lines = ['#EXTM3U', `#PLAYLIST:${name}`]

    for (const song of songs) {
      const duration = Math.floor(song.duration)
      const artist = song.artist || 'Unknown Artist'
      const title = song.title
      const filePath = song.filePath

      lines.push(`#EXTINF:${duration},${artist} - ${title}`)
      lines.push(filePath)
    }

    return lines.join('\n')
  }

  async getDevicePlaylists(device: DeviceInfo): Promise<{ name: string; path: string; songCount: number }[]> {
    const searchPath = device.playlistFolder || device.musicFolder || device.drive
    const playlists: { name: string; path: string; songCount: number }[] = []

    const findM3U = async (dir: string) => {
      try {
        const entries = await readdir(dir, { withFileTypes: true })
        
        for (const entry of entries) {
          const fullPath = join(dir, entry.name)
          
          if (entry.isDirectory()) {
            await findM3U(fullPath)
          } else if (entry.isFile()) {
            const ext = entry.name.split('.').pop()?.toLowerCase()
            if (ext === 'm3u' || ext === 'm3u8') {
              try {
                const content = await readFile(fullPath, 'utf-8')
                const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'))
                playlists.push({
                  name: entry.name.replace(/\.(m3u8?|M3U8?)$/i, ''),
                  path: fullPath,
                  songCount: lines.length
                })
              } catch {}
            }
          }
        }
      } catch {}
    }

    await findM3U(searchPath)

    return playlists
  }

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

  async readDevicePlaylist(m3uPath: string): Promise<DevicePlaylist> {
    const content = await readFile(m3uPath, 'utf-8')
    const name = basename(m3uPath, extname(m3uPath))
    const songs = this.parseM3U(content)

    return {
      name,
      path: m3uPath,
      songCount: songs.length,
      songs
    }
  }
}