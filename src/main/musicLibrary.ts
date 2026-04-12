import { readdir, stat } from 'fs/promises'
import { parseFile } from 'music-metadata'
import { join, extname } from 'path'
import { BrowserWindow, app } from 'electron'
import { readFileSync, writeFileSync, existsSync } from 'fs'

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
  lyrics?: string
  mtime?: number
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
  phase: 'scanning' | 'parsing' | 'loading'
  current: number
  total: number
  currentFile?: string
}

interface LibraryCache {
  version: number
  songs: Song[]
  lastScan: number
}

const CACHE_VERSION = 1

export class MusicLibrary {
  private songs: Map<string, Song> = new Map()
  private albums: Map<string, Album> = new Map()
  private artists: Map<string, Artist> = new Map()
  private songKeys: Map<string, string> = new Map() // title+artist -> songId for deduplication
  private win: BrowserWindow | null = null
  private cachePath: string

  constructor() {
    this.cachePath = join(app.getPath('userData'), 'library-cache.json')
  }

  setWindow(win: BrowserWindow) {
    this.win = win
  }

  // Use filePath as unique identifier - no two files can be the same
  // Title/artist deduplication is informational only
  private getSongKey(filePath: string): string {
    return filePath.toLowerCase()
  }

  // Check if song with same filePath already exists
  isDuplicate(filePath: string): boolean {
    const key = this.getSongKey(filePath)
    return this.songKeys.has(key)
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

  private loadCache(): Song[] | null {
    try {
      if (existsSync(this.cachePath)) {
        const data = readFileSync(this.cachePath, 'utf-8')
        const cache: LibraryCache = JSON.parse(data)
        if (cache.version === CACHE_VERSION && cache.songs) {
          return cache.songs
        }
      }
    } catch (e) {
      console.error('Failed to load cache:', e)
    }
    return null
  }

  private saveCache(): void {
    try {
      const cache: LibraryCache = {
        version: CACHE_VERSION,
        songs: this.getSongs(),
        lastScan: Date.now()
      }
      writeFileSync(this.cachePath, JSON.stringify(cache))
    } catch (e) {
      console.error('Failed to save cache:', e)
    }
  }

  async loadFromCache(): Promise<boolean> {
    const cachedSongs = this.loadCache()
    if (!cachedSongs || cachedSongs.length === 0) {
      return false
    }

    this.notifyProgress('loading', 0, cachedSongs.length, '加载缓存...')
    
    for (let i = 0; i < cachedSongs.length; i++) {
      const song = cachedSongs[i]
      
      // Check for duplicates while loading - use filePath as unique key
      const key = this.getSongKey(song.filePath)
      if (!this.songKeys.has(key)) {
        this.songs.set(song.id, song)
        this.songKeys.set(key, song.id)
        this.addToAlbum(song)
        this.addToArtist(song)
      }
      
      if (i % 100 === 0) {
        this.notifyProgress('loading', i, cachedSongs.length, '加载缓存...')
      }
    }

    this.notifyProgress('loading', cachedSongs.length, cachedSongs.length, '加载完成')
    return true
  }

async scan(paths: string[], forceRescan: boolean = false): Promise<{ count: number; added: number; duplicates: number; parseErrors: number; errors: string[] }> {
    this.songs.clear()
    this.albums.clear()
    this.artists.clear()
    this.songKeys.clear()
    
    const cachedSongs = forceRescan ? null : this.loadCache()
    const cachedMap = new Map<string, Song>()
    if (cachedSongs) {
      for (const song of cachedSongs) {
        cachedMap.set(song.filePath, song)
      }
    }
    
    const errors: string[] = []
    const allFiles: string[] = []
    const fileStats = new Map<string, number>()
    let parseErrors = 0
    let addedCount = 0
    
    for (const basePath of paths) {
      try {
        await this.scanDirectory(basePath, allFiles, fileStats)
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
        const mtime = fileStats.get(filePath) || 0
        const cached = cachedMap.get(filePath)
        
        if (cached && cached.mtime && cached.mtime >= mtime) {
          const key = this.getSongKey(cached.filePath)
          this.songs.set(cached.id, cached)
          this.songKeys.set(key, cached.id)
          this.addToAlbum(cached)
          this.addToArtist(cached)
          addedCount++
        } else {
          try {
            // Parse metadata without covers to save memory during scan
            const metadata = await parseFile(filePath, { skipCovers: true })
            const song = this.createSong(filePath, metadata, mtime)
            const key = this.getSongKey(song.filePath)
            this.songs.set(song.id, song)
            this.songKeys.set(key, song.id)
            this.addToAlbum(song)
            this.addToArtist(song)
            addedCount++
          } catch (e: any) {
            // Parse failed - still add song using filename
            parseErrors++
            const song = this.createSongFromFilename(filePath, mtime)
            const key = this.getSongKey(song.filePath)
            this.songs.set(song.id, song)
            this.songKeys.set(key, song.id)
            this.addToAlbum(song)
            this.addToArtist(song)
            addedCount++
          }
        }
      }
      
      processed += batch.length
      this.notifyProgress('parsing', processed, total, batch[batch.length - 1])
    }
    
    this.saveCache()
    return { 
      count: allFiles.length, 
      added: addedCount,
      parseErrors,
      errors 
    }
  }

  private async scanDirectory(basePath: string, files: string[], fileStats: Map<string, number>): Promise<void> {
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
              try {
                const stats = await stat(fullPath)
                fileStats.set(fullPath, stats.mtimeMs)
              } catch (e) {
                // 忽略
              }
            }
          }
        }
      } catch (e) {
        // 忽略无法访问的目录
      }
    }
    
    await scan(basePath)
  }

private createSong(filePath: string, metadata: any, mtime: number): Song {
    const id = Buffer.from(filePath).toString('base64')
    const common = metadata.common
    
    // Don't extract cover during scan - load on demand later
    // This saves memory during bulk scanning

    let lyrics: string | undefined = undefined
    if (metadata.native) {
      for (const format of Object.values(metadata.native)) {
        const tags = format as any[]
        for (const tag of tags) {
          if (tag.id === 'USLT' || tag.id === 'lyrics' || tag.id === 'LYRICS' || tag.id === 'unsynchronisedLyrics') {
            lyrics = typeof tag.value === 'string' ? tag.value : tag.value?.text || tag.value?.lyrics
            break
          }
        }
        if (lyrics) break
      }
    }

    return {
      id,
      title: common.title || this.getFileName(filePath),
      artist: common.artist || 'Unknown Artist',
      album: common.album || 'Unknown Album',
      duration: Math.round(metadata.format.duration || 0),
      filePath,
      audioUrl: `audio://${filePath}`,
      cover: undefined,
      lyrics,
      mtime,
    }
}

  // Load cover on demand when displaying song - not cached in memory
  async getSongCover(filePath: string): Promise<string | undefined> {
    try {
      const metadata = await parseFile(filePath)
      const common = metadata.common
      if (common.picture && common.picture.length > 0) {
        const pic = common.picture[0]
        return `data:${pic.format};base64,${pic.data.toString('base64')}`
      }
    } catch (e) {
      // Ignore parse errors
    }
    return undefined
}

  private getFileName(filePath: string): string {
    const parts = filePath.split(/[/\\]/)
    return parts[parts.length - 1].replace(/\.[^.]+$/, '')
  }

  // Create song from filename when metadata parsing fails
  // Assumes format: "Artist - Title.ext" or "Artist- Title.ext"
  private createSongFromFilename(filePath: string, mtime: number): Song {
    const id = Buffer.from(filePath).toString('base64')
    const fileName = this.getFileName(filePath)
    
    // Try to parse "Artist - Title" format
    let title = fileName
    let artist = 'Unknown Artist'
    let album = 'Unknown Album'
    
    // Common patterns: "Artist - Title" or "Artist- Title" or "Artist,Other - Title"
    const dashMatch = fileName.match(/^(.+?)\s*-\s*(.+)$/)
    if (dashMatch) {
      artist = dashMatch[1].trim()
      title = dashMatch[2].trim()
    }
    
    // Get album from parent directory name
    const parts = filePath.split(/[/\\]/)
    if (parts.length >= 3) {
      // Parent folder is often the album name
      album = parts[parts.length - 2] || 'Unknown Album'
    }
    
    return {
      id,
      title,
      artist,
      album,
      duration: 0,
      filePath,
      audioUrl: `audio://${filePath}`,
      cover: undefined,
      lyrics: undefined,
      mtime,
    }
  }

  private addToAlbum(song: Song): void {
    const albumId = `${song.artist}-${song.album}`
    if (!this.albums.has(albumId)) {
      this.albums.set(albumId, {
        id: albumId,
        name: song.album,
        artist: song.artist,
        cover: song.cover,
        songs: [],
      })
    }
    const album = this.albums.get(albumId)!
    if (!album.cover && song.cover) {
      album.cover = song.cover
    }
    album.songs.push(song)
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
      // Don't cache cover/lyrics - they're too large and will be loaded on demand
      // cover: song.cover,
      // lyrics: song.lyrics,
      mtime: song.mtime,
    }))
  }

  getAlbums(): any[] {
    return Array.from(this.albums.values()).map(album => {
      const sortedSongs = [...album.songs].sort((a, b) => 
        a.filePath.localeCompare(b.filePath)
      )
      const cover = sortedSongs.find(s => s.cover)?.cover
      return {
        id: album.id,
        name: album.name,
        artist: album.artist,
        cover,
        songCount: album.songs.length,
        songIds: album.songs.map(s => s.id),
      }
    })
  }

  getArtists(): any[] {
    return Array.from(this.artists.values()).map(artist => ({
      id: artist.id,
      name: artist.name,
      songCount: artist.songs.length,
      songIds: artist.songs.map(s => s.id),
    }))
  }

  getSongsByIds(ids: string[]): Song[] {
    return ids
      .map(id => this.songs.get(id))
      .filter((s): s is Song => s !== undefined)
      .map(song => ({
        id: song.id,
        title: song.title,
        artist: song.artist,
        album: song.album,
        duration: song.duration,
        filePath: song.filePath,
        audioUrl: song.audioUrl,
        cover: song.cover,
        lyrics: song.lyrics,
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

  addSong(song: Song): boolean {
    // Check if filePath already exists
    const key = this.getSongKey(song.filePath)
    if (this.songKeys.has(key)) {
      return false // File already in library
    }
    
    this.songs.set(song.id, song)
    this.songKeys.set(key, song.id)
    this.addToAlbum(song)
    this.addToArtist(song)
    this.saveCache()
    return true
  }

  clearCache(): void {
    try {
      if (existsSync(this.cachePath)) {
        const { unlinkSync } = require('fs')
        unlinkSync(this.cachePath)
      }
    } catch (e) {
      console.error('Failed to clear cache:', e)
    }
  }
}