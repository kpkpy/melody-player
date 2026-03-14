import { readdir } from 'fs/promises'
import { parseFile } from 'music-metadata'
import { join, extname } from 'path'
import { BrowserWindow } from 'electron'

const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.m4a', '.wav', '.ogg', '.wma', '.ape', '.aac']

export interface Song {
  id: string
  title: string
  artist: string
  album: string
  duration: number
  filePath: string
  audioUrl: string
  cover?: string
}

export interface Album {
  id: string
  name: string
  artist: string
  cover?: string
  songs: Song[]
}

export interface Artist {
  id: string
  name: string
  albums: Album[]
  songs: Song[]
}

export interface ScanProgress {
  phase: 'scanning' | 'parsing'
  current: number
  total: number
  currentFile?: string
}

export class MusicLibrary {
  private songs: Map<string, Song> = new Map()
  private albums: Map<string, Album> = new Map()
  private artists: Map<string, Artist> = new Map()
  private win: BrowserWindow | null = null

  setWindow(win: BrowserWindow) {
    this.win = win
  }

  private notifyProgress(phase: string, current: number, total: number, currentFile?: string) {
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send('library:scanProgress', {
        phase,
        current,
        total,
        currentFile: currentFile || ''
      })
    }
  }

  async scan(paths: string[]): Promise<{ count: number; errors: string[] }> {
    this.songs.clear()
    this.albums.clear()
    this.artists.clear()
    
    const errors: string[] = []
    const allFiles: string[] = []

    for (const basePath of paths) {
      try {
        const files = await this.scanDirectory(basePath)
        allFiles.push(...files)
      } catch (e: any) {
        errors.push(`Failed to scan ${basePath}: ${e.message || e}`)
      }
    }

    const total = allFiles.length
    this.notifyProgress('parsing', 0, total, '')

    let processed = 0
    const batchSize = 20
    
    for (let i = 0; i < allFiles.length; i += batchSize) {
      const batch = allFiles.slice(i, i + batchSize)
      
      for (const filePath of batch) {
        try {
          const metadata = await parseFile(filePath)
          const song = this.createSong(filePath, metadata)
          this.songs.set(song.id, song)
          this.addToAlbum(song)
          this.addToArtist(song)
        } catch (e) {
          // 忽略解析错误
        }
      }
      
      processed += batch.length
      this.notifyProgress('parsing', processed, total, batch[batch.length - 1])
    }

    return { count: allFiles.length, errors }
  }

  private async scanDirectory(basePath: string): Promise<string[]> {
    const files: string[] = []
    
    const scan = async (dir: string) => {
      try {
        const entries = await readdir(dir, { withFileTypes: true })
        
        for (const entry of entries) {
          const fullPath = join(dir, entry.name)
          
          if (entry.isDirectory()) {
            await scan(fullPath)
          } else if (entry.isFile()) {
            const ext = extname(entry.name).toLowerCase()
            if (AUDIO_EXTENSIONS.includes(ext)) {
              files.push(fullPath)
            }
          }
        }
      } catch (e) {
        // 忽略无法访问的目录
      }
    }
    
    await scan(basePath)
    return files
  }

  private createSong(filePath: string, metadata: any): Song {
    const id = Buffer.from(filePath).toString('base64')
    const common = metadata.common
    
    let cover: string | undefined = undefined
    if (common.picture && common.picture.length > 0) {
      const pic = common.picture[0]
      cover = `data:${pic.format};base64,${pic.data.toString('base64')}`
    }

    return {
      id,
      title: common.title || this.getFileName(filePath),
      artist: common.artist || 'Unknown Artist',
      album: common.album || 'Unknown Album',
      duration: Math.round(metadata.format.duration || 0),
      filePath,
      audioUrl: `audio://${filePath}`,
      cover,
    }
  }

  private getFileName(filePath: string): string {
    const parts = filePath.split(/[/\\]/)
    return parts[parts.length - 1].replace(/\.[^.]+$/, '')
  }

  private addToAlbum(song: Song): void {
    const albumId = `${song.artist}-${song.album}`
    if (!this.albums.has(albumId)) {
      this.albums.set(albumId, {
        id: albumId,
        name: song.album,
        artist: song.artist,
        songs: [],
      })
    }
    this.albums.get(albumId)!.songs.push(song)
  }

  private addToArtist(song: Song): void {
    if (!this.artists.has(song.artist)) {
      this.artists.set(song.artist, {
        id: song.artist,
        name: song.artist,
        albums: [],
        songs: [],
      })
    }
    const artist = this.artists.get(song.artist)!
    if (!artist.songs.find(s => s.id === song.id)) {
      artist.songs.push(song)
    }
  }

  getSongs(): Song[] {
    return Array.from(this.songs.values()).map(song => ({
      id: song.id,
      title: song.title,
      artist: song.artist,
      album: song.album,
      duration: song.duration,
      filePath: song.filePath,
      audioUrl: song.audioUrl,
      cover: song.cover,
    }))
  }

  getAlbums(): Album[] {
    return Array.from(this.albums.values()).map(album => ({
      id: album.id,
      name: album.name,
      artist: album.artist,
      songs: album.songs.map(s => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        album: s.album,
        duration: s.duration,
        filePath: s.filePath,
        audioUrl: s.audioUrl,
        cover: s.cover,
      })),
    }))
  }

  getArtists(): Artist[] {
    return Array.from(this.artists.values()).map(artist => ({
      id: artist.id,
      name: artist.name,
      albums: artist.albums,
      songs: artist.songs.map(s => ({
        id: s.id,
        title: s.title,
        artist: s.artist,
        album: s.album,
        duration: s.duration,
        filePath: s.filePath,
        audioUrl: s.audioUrl,
        cover: s.cover,
      })),
    }))
  }

  getSongById(id: string): Song | undefined {
    return this.songs.get(id)
  }

  getSongByTitleAndArtist(title: string, artist: string): Song | undefined {
    const titleLower = title.toLowerCase()
    const artistLower = artist.toLowerCase()

    for (const song of this.songs.values()) {
      if (song.title.toLowerCase() === titleLower) {
        if (!artist || song.artist.toLowerCase().includes(artistLower)) {
          return song
        }
      }
    }

    for (const song of this.songs.values()) {
      if (song.title.toLowerCase().includes(titleLower)) {
        return song
      }
    }

    return undefined
  }
}