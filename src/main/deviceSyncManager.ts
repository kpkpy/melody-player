import { app, BrowserWindow } from 'electron'
import { join, basename, dirname, extname, relative } from 'path'
import { readdir, stat, copyFile, unlink, mkdir, existsSync, readFileSync, writeFileSync } from 'fs/promises'
import { createHash } from 'crypto'
import type { Song } from './musicLibrary'
import { PlaylistManager } from './playlistManager'

export interface DeviceConfig {
  id: string
  name: string
  vendor?: string
  musicPath: string
  playlistPath: string
  description?: string
}

export const DEVICE_PRESETS: DeviceConfig[] = [
  {
    id: 'sony-walkman',
    name: 'Sony Walkman (ZX300A/A50等)',
    vendor: 'SONY',
    musicPath: 'MUSIC',
    playlistPath: 'MUSIC/Playlists',
    description: '索尼播放器需要将音乐放在MUSIC文件夹内'
  },
  {
    id: 'fiio',
    name: 'FIIO (M21/M15等)',
    vendor: 'FII',
    musicPath: 'Music',
    playlistPath: 'Playlists',
    description: 'FIIO播放器默认音乐目录'
  },
  {
    id: 'generic',
    name: '通用设备',
    musicPath: 'Music',
    playlistPath: 'Playlists',
    description: '适用于大多数便携式播放器'
  }
]

export interface DetectedDevice {
  drive: string
  label: string
  totalSize: number
  freeSize: number
  suggestedConfig?: DeviceConfig
}

export interface SyncProgress {
  phase: 'scanning' | 'copying' | 'deleting' | 'playlist' | 'completed' | 'error'
  current: number
  total: number
  currentFile?: string
  message?: string
}

export interface SyncState {
  deviceId: string
  lastSyncTime: number
  syncedSongs: { [songId: string]: { sourcePath: string; targetPath: string; mtime: number } }
  syncedPlaylists: string[]
}

export interface SyncResult {
  success: boolean
  message: string
  addedCount: number
  updatedCount: number
  deletedCount: number
  playlistCount: number
  errors: string[]
  details?: {
    added: string[]
    updated: string[]
    deleted: string[]
  }
}

export class DeviceSyncManager {
  private win: BrowserWindow | null = null
  private statePath: string
  private syncStates: Map<string, SyncState> = new Map()
  private playlistManager: PlaylistManager
  private getSongs: () => Song[]

  constructor(playlistManager: PlaylistManager, getSongs: () => Song[]) {
    this.playlistManager = playlistManager
    this.getSongs = getSongs
    this.statePath = join(app.getPath('userData'), 'device-sync-states.json')
    this.loadStates()
  }

  setWindow(win: BrowserWindow) {
    this.win = win
  }

  private loadStates(): void {
    try {
      if (existsSync(this.statePath)) {
        const data = readFileSync(this.statePath, 'utf-8')
        const states: SyncState[] = JSON.parse(data)
        for (const state of states) {
          this.syncStates.set(state.deviceId, state)
        }
      }
    } catch (e) {
      console.error('Failed to load sync states:', e)
    }
  }

  private saveStates(): void {
    try {
      const states = Array.from(this.syncStates.values())
      writeFileSync(this.statePath, JSON.stringify(states, null, 2))
    } catch (e) {
      console.error('Failed to save sync states:', e)
    }
  }

  private notifyProgress(progress: SyncProgress): void {
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send('deviceSync:progress', progress)
    }
  }

  async detectDevices(): Promise<DetectedDevice[]> {
    const devices: DetectedDevice[] = []
    
    if (process.platform === 'win32') {
      const drives = await this.getWindowsDrives()
      for (const drive of drives) {
        try {
          const stats = await stat(drive)
          const device: DetectedDevice = {
            drive,
            label: await this.getDriveLabel(drive),
            totalSize: 0,
            freeSize: 0,
          }
          
          try {
            const { execSync } = require('child_process')
            const output = execSync(`wmic logicaldisk where "DeviceID='${drive.replace('\\', '')}'" get Size,FreeSpace /format:csv`, { encoding: 'utf-8' })
            const lines = output.trim().split('\n').filter(l => l.trim())
            if (lines.length >= 2) {
              const values = lines[1].split(',')
              if (values.length >= 3) {
                device.freeSize = parseInt(values[1]) || 0
                device.totalSize = parseInt(values[2]) || 0
              }
            }
          } catch {
            // 忽略错误
          }

          device.suggestedConfig = await this.detectDeviceType(drive)
          devices.push(device)
        } catch {
          // 忽略无法访问的驱动器
        }
      }
    } else if (process.platform === 'darwin') {
      const volumes = await this.getMacVolumes()
      for (const volume of volumes) {
        try {
          const device: DetectedDevice = {
            drive: volume,
            label: basename(volume),
            totalSize: 0,
            freeSize: 0,
          }
          device.suggestedConfig = await this.detectDeviceType(volume)
          devices.push(device)
        } catch {
          // 忽略
        }
      }
    }

    return devices
  }

  private async getWindowsDrives(): Promise<string[]> {
    const drives: string[] = []
    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i)
      const drive = `${letter}:\\`
      try {
        await stat(drive)
        drives.push(drive)
      } catch {
        // 驱动器不存在
      }
    }
    return drives
  }

  private async getMacVolumes(): Promise<string[]> {
    const volumes: string[] = []
    try {
      const entries = await readdir('/Volumes')
      for (const name of entries) {
        if (name !== 'Macintosh HD') {
          volumes.push(join('/Volumes', name))
        }
      }
    } catch {
      // 忽略
    }
    return volumes
  }

  private async getDriveLabel(drive: string): Promise<string> {
    if (process.platform === 'win32') {
      try {
        const { execSync } = require('child_process')
        const output = execSync(`wmic logicaldisk where "DeviceID='${drive.replace('\\', '')}'" get VolumeName /format:csv`, { encoding: 'utf-8' })
        const lines = output.trim().split('\n').filter(l => l.trim())
        if (lines.length >= 2) {
          const values = lines[1].split(',')
          if (values.length >= 2 && values[1]) {
            return values[1]
          }
        }
      } catch {
        // 忽略
      }
    }
    return basename(drive) || drive
  }

  private async detectDeviceType(drive: string): Promise<DeviceConfig> {
    const entries = await readdir(drive).catch(() => [] as string[])
    
    const hasFolder = (name: string) => entries.some(e => e.toLowerCase() === name.toLowerCase())
    
    if (hasFolder('MUSIC') || entries.some(e => e.toUpperCase().includes('WALKMAN'))) {
      return DEVICE_PRESETS.find(p => p.id === 'sony-walkman')!
    }
    
    if (hasFolder('Music') && !hasFolder('MUSIC')) {
      return DEVICE_PRESETS.find(p => p.id === 'fiio')!
    }
    
    return DEVICE_PRESETS.find(p => p.id === 'generic')!
  }

  getDevicePresets(): DeviceConfig[] {
    return DEVICE_PRESETS
  }

  async syncToDevice(
    devicePath: string,
    config: DeviceConfig,
    options: {
      syncSongs?: boolean
      syncPlaylists?: boolean
      deleteRemoved?: boolean
      playlistIds?: string[]
    } = {}
  ): Promise<SyncResult> {
    const {
      syncSongs = true,
      syncPlaylists = true,
      deleteRemoved = true,
      playlistIds
    } = options

    const result: SyncResult = {
      success: false,
      message: '',
      addedCount: 0,
      updatedCount: 0,
      deletedCount: 0,
      playlistCount: 0,
      errors: [],
      details: { added: [], updated: [], deleted: [] }
    }

    const deviceId = this.generateDeviceId(devicePath, config)
    const musicDir = join(devicePath, config.musicPath)
    const playlistDir = join(devicePath, config.playlistPath)

    try {
      await this.ensureDir(musicDir)
      if (syncPlaylists) {
        await this.ensureDir(playlistDir)
      }
    } catch (e: any) {
      result.errors.push(`无法创建目录: ${e.message}`)
      result.message = '同步失败: 无法创建目标目录'
      return result
    }

    const state = this.syncStates.get(deviceId) || {
      deviceId,
      lastSyncTime: 0,
      syncedSongs: {},
      syncedPlaylists: []
    }

    const songs = this.getSongs()

    if (syncSongs) {
      this.notifyProgress({ phase: 'scanning', current: 0, total: songs.length, message: '扫描歌曲文件...' })

      const songsToSync: Song[] = []
      for (let i = 0; i < songs.length; i++) {
        const song = songs[i]
        const syncInfo = state.syncedSongs[song.id]
        
        if (!syncInfo || syncInfo.mtime < (song.mtime || 0)) {
          songsToSync.push(song)
        }
        
        if (i % 50 === 0) {
          this.notifyProgress({ phase: 'scanning', current: i, total: songs.length })
        }
      }

      this.notifyProgress({ phase: 'copying', current: 0, total: songsToSync.length, message: '复制歌曲文件...' })

      for (let i = 0; i < songsToSync.length; i++) {
        const song = songsToSync[i]
        try {
          const targetPath = await this.copySongToDevice(song, musicDir, config)
          const isNew = !state.syncedSongs[song.id]
          
          state.syncedSongs[song.id] = {
            sourcePath: song.filePath,
            targetPath,
            mtime: song.mtime || Date.now()
          }

          if (isNew) {
            result.addedCount++
            result.details!.added.push(song.title)
          } else {
            result.updatedCount++
            result.details!.updated.push(song.title)
          }
        } catch (e: any) {
          result.errors.push(`复制失败 ${song.title}: ${e.message}`)
        }

        this.notifyProgress({
          phase: 'copying',
          current: i + 1,
          total: songsToSync.length,
          currentFile: song.title
        })
      }

      if (deleteRemoved) {
        const songIds = new Set(songs.map(s => s.id))
        const toDelete: string[] = []

        for (const [songId, info] of Object.entries(state.syncedSongs)) {
          if (!songIds.has(songId)) {
            toDelete.push(songId)
          }
        }

        this.notifyProgress({ phase: 'deleting', current: 0, total: toDelete.length, message: '清理已删除的歌曲...' })

        for (let i = 0; i < toDelete.length; i++) {
          const songId = toDelete[i]
          const info = state.syncedSongs[songId]
          
          try {
            await unlink(info.targetPath)
            delete state.syncedSongs[songId]
            result.deletedCount++
            result.details!.deleted.push(basename(info.targetPath))
          } catch (e: any) {
            result.errors.push(`删除失败: ${e.message}`)
          }

          this.notifyProgress({ phase: 'deleting', current: i + 1, total: toDelete.length })
        }
      }
    }

    if (syncPlaylists) {
      const playlists = playlistIds
        ? this.playlistManager.getAll().filter(p => playlistIds.includes(p.id))
        : this.playlistManager.getAll()

      this.notifyProgress({ phase: 'playlist', current: 0, total: playlists.length, message: '同步歌单...' })

      for (let i = 0; i < playlists.length; i++) {
        const playlist = playlists[i]
        try {
          await this.exportPlaylistToDevice(playlist.id, playlistDir, musicDir, config)
          result.playlistCount++
        } catch (e: any) {
          result.errors.push(`歌单导出失败 ${playlist.name}: ${e.message}`)
        }

        this.notifyProgress({ phase: 'playlist', current: i + 1, total: playlists.length })
      }
    }

    state.lastSyncTime = Date.now()
    this.syncStates.set(deviceId, state)
    this.saveStates()

    result.success = result.errors.length === 0 || (result.addedCount > 0 || result.updatedCount > 0)
    result.message = `同步完成: 新增 ${result.addedCount} 首, 更新 ${result.updatedCount} 首, 删除 ${result.deletedCount} 首, 歌单 ${result.playlistCount} 个`

    this.notifyProgress({ phase: 'completed', current: 1, total: 1, message: result.message })

    return result
  }

  private async copySongToDevice(song: Song, targetDir: string, config: DeviceConfig): Promise<string> {
    const relativePath = this.getRelativePath(song)
    const targetPath = join(targetDir, relativePath)
    const targetDirPath = dirname(targetPath)

    await this.ensureDir(targetDirPath)
    await copyFile(song.filePath, targetPath)

    return targetPath
  }

  private getRelativePath(song: Song): string {
    const artist = this.sanitizeFileName(song.artist || 'Unknown Artist')
    const album = this.sanitizeFileName(song.album || 'Unknown Album')
    const fileName = this.sanitizeFileName(basename(song.filePath))
    
    return join(artist, album, fileName)
  }

  private sanitizeFileName(name: string): string {
    return name.replace(/[<>:"/\\|?*]/g, '_').trim()
  }

  private async ensureDir(dir: string): Promise<void> {
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }
  }

  private async exportPlaylistToDevice(
    playlistId: string,
    playlistDir: string,
    musicDir: string,
    config: DeviceConfig
  ): Promise<void> {
    const playlist = this.playlistManager.getById(playlistId)
    if (!playlist) return

    const songs = this.playlistManager.getPlaylistSongs(playlistId)
    const lines = ['#EXTM3U', `#PLAYLIST:${playlist.name}`]

    for (const song of songs) {
      const duration = Math.floor(song.duration)
      const artist = song.artist || 'Unknown Artist'
      const title = song.title
      const relativePath = this.getRelativePath(song)
      
      lines.push(`#EXTINF:${duration},${artist} - ${title}`)
      lines.push(relativePath.replace(/\\/g, '/'))
    }

    const playlistPath = join(playlistDir, `${this.sanitizeFileName(playlist.name)}.m3u8`)
    await this.ensureDir(playlistDir)
    await this.writeFile(playlistPath, lines.join('\n'), 'utf-8')
  }

  private async writeFile(path: string, content: string, encoding: BufferEncoding): Promise<void> {
    const { writeFile: writeFileSyncAsync } = require('fs/promises')
    await writeFileSyncAsync(path, content, encoding)
  }

  private generateDeviceId(devicePath: string, config: DeviceConfig): string {
    return createHash('md5').update(`${devicePath}-${config.id}`).digest('hex')
  }

  getSyncState(devicePath: string, config: DeviceConfig): SyncState | undefined {
    const deviceId = this.generateDeviceId(devicePath, config)
    return this.syncStates.get(deviceId)
  }

  clearSyncState(devicePath: string, config: DeviceConfig): void {
    const deviceId = this.generateDeviceId(devicePath, config)
    this.syncStates.delete(deviceId)
    this.saveStates()
  }

  async previewSync(
    devicePath: string,
    config: DeviceConfig
  ): Promise<{
    toAdd: Song[]
    toUpdate: Song[]
    toDelete: { songId: string; targetPath: string }[]
    playlists: { id: string; name: string; songCount: number }[]
  }> {
    const songs = this.getSongs()
    const deviceId = this.generateDeviceId(devicePath, config)
    const state = this.syncStates.get(deviceId)
    
    const toAdd: Song[] = []
    const toUpdate: Song[] = []
    const toDelete: { songId: string; targetPath: string }[] = []
    
    const songIds = new Set(songs.map(s => s.id))

    for (const song of songs) {
      const syncInfo = state?.syncedSongs[song.id]
      if (!syncInfo) {
        toAdd.push(song)
      } else if (syncInfo.mtime < (song.mtime || 0)) {
        toUpdate.push(song)
      }
    }

    if (state) {
      for (const [songId, info] of Object.entries(state.syncedSongs)) {
        if (!songIds.has(songId)) {
          toDelete.push({ songId, targetPath: info.targetPath })
        }
      }
    }

    const playlists = this.playlistManager.getAll().map(p => ({
      id: p.id,
      name: p.name,
      songCount: p.songIds.length
    }))

    return { toAdd, toUpdate, toDelete, playlists }
  }
}