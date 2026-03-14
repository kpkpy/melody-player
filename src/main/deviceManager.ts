import { BrowserWindow, dialog } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import { readdir, stat } from 'fs/promises'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

const execAsync = promisify(exec)

export interface DeviceInfo {
  id: string
  drive: string
  label: string
  type: 'usb' | 'fixed' | 'network' | 'unknown'
  totalSize: number
  freeSize: number
  usedSize: number
  fileSystem?: string
  serialNumber?: string
  vendor?: string
  model?: string
  musicFolder?: string
  playlistFolder?: string
  songCount: number
  playlistCount: number
  lastSyncTime?: number
  customName?: string
  isKnown: boolean
}

export interface DeviceMusicStructure {
  musicFolders: string[]
  playlistFolder: string | null
  totalSongs: number
  totalPlaylists: number
  songs: Map<string, string>
}

export interface SyncState {
  deviceId: string
  lastSyncTime: number
  syncedSongs: string[]
  syncedPlaylists: string[]
  localSongHash: string
  deviceSongCount: number
}

interface StoredDevice {
  id: string
  customName?: string
  lastSyncTime?: number
  musicFolder?: string
  playlistFolder?: string
  syncedSongs?: string[]
  syncedPlaylists?: string[]
}

export class DeviceManager {
  private win: BrowserWindow | null = null
  private devices: Map<string, DeviceInfo> = new Map()
  private knownDevices: Map<string, StoredDevice> = new Map()
  private storagePath: string

  constructor() {
    this.storagePath = join(app.getPath('userData'), 'devices.json')
    this.loadKnownDevices()
  }

  setWindow(win: BrowserWindow) {
    this.win = win
  }

  private loadKnownDevices() {
    try {
      if (existsSync(this.storagePath)) {
        const data = readFileSync(this.storagePath, 'utf-8')
        const devices: StoredDevice[] = JSON.parse(data)
        for (const device of devices) {
          this.knownDevices.set(device.id, device)
        }
      }
    } catch (e) {
      console.error('Failed to load known devices:', e)
    }
  }

  private saveKnownDevices() {
    try {
      const devices = Array.from(this.knownDevices.values())
      writeFileSync(this.storagePath, JSON.stringify(devices, null, 2))
    } catch (e) {
      console.error('Failed to save known devices:', e)
    }
  }

  updateDeviceName(deviceId: string, name: string) {
    const device = this.knownDevices.get(deviceId)
    if (device) {
      device.customName = name
    } else {
      this.knownDevices.set(deviceId, { id: deviceId, customName: name })
    }
    this.saveKnownDevices()
  }

  updateDeviceSyncState(deviceId: string, state: Partial<SyncState>) {
    const device = this.knownDevices.get(deviceId)
    if (device) {
      if (state.lastSyncTime) device.lastSyncTime = state.lastSyncTime
      if (state.syncedSongs) device.syncedSongs = state.syncedSongs
      if (state.syncedPlaylists) device.syncedPlaylists = state.syncedPlaylists
    } else {
      this.knownDevices.set(deviceId, {
        id: deviceId,
        lastSyncTime: state.lastSyncTime,
        syncedSongs: state.syncedSongs,
        syncedPlaylists: state.syncedPlaylists
      })
    }
    this.saveKnownDevices()
  }

  getDeviceSyncState(deviceId: string): SyncState | null {
    const device = this.knownDevices.get(deviceId)
    if (!device) return null
    return {
      deviceId: device.id,
      lastSyncTime: device.lastSyncTime || 0,
      syncedSongs: device.syncedSongs || [],
      syncedPlaylists: device.syncedPlaylists || [],
      localSongHash: '',
      deviceSongCount: 0
    }
  }

  async detectDevices(): Promise<DeviceInfo[]> {
    const devices: DeviceInfo[] = []
    
    if (process.platform === 'win32') {
      const result = await this.getWindowsDrives()
      devices.push(...result)
    } else if (process.platform === 'darwin') {
      const result = await this.getMacDrives()
      devices.push(...result)
    } else {
      const result = await this.getLinuxDrives()
      devices.push(...result)
    }

    for (const device of devices) {
      this.devices.set(device.id, device)
    }

    return devices
  }

  private async getWindowsDrives(): Promise<DeviceInfo[]> {
    const devices: DeviceInfo[] = []
    
    try {
      const { stdout } = await execAsync(
        'wmic logicaldisk get caption,volumename,drivetype,size,freespace,filesystem,volumeserialnumber /format:csv',
        { encoding: 'utf8', maxBuffer: 1024 * 1024 * 10 }
      )
      
      const lines = stdout.trim().split('\n').slice(1)
      
      for (const line of lines) {
        const parts = line.trim().split(',')
        if (parts.length >= 7 && parts[1]) {
          const drive = parts[1]
          const typeNum = parseInt(parts[2]) || 0
          const label = parts[3] || 'Local Disk'
          const fileSystem = parts[4] || ''
          const freeSize = parseInt(parts[5]) || 0
          const totalSize = parseInt(parts[6]) || 0
          const serialNumber = parts[7] || ''
          
          const type = this.mapWindowsDriveType(typeNum)
          
          if (type === 'usb' || type === 'fixed') {
            const id = this.generateDeviceId(drive, serialNumber, totalSize)
            const known = this.knownDevices.get(id)
            
            const musicInfo = await this.scanDeviceMusicQuick(drive)
            
            devices.push({
              id,
              drive,
              label: known?.customName || label || 'Removable Disk',
              type,
              totalSize,
              freeSize,
              usedSize: totalSize - freeSize,
              fileSystem,
              serialNumber,
              musicFolder: known?.musicFolder || musicInfo.musicFolder,
              playlistFolder: known?.playlistFolder || musicInfo.playlistFolder,
              songCount: musicInfo.songCount,
              playlistCount: musicInfo.playlistCount,
              lastSyncTime: known?.lastSyncTime,
              customName: known?.customName,
              isKnown: !!known
            })
          }
        }
      }
    } catch (e) {
      for (const letter of 'DEFGHIJKLMNOPQRSTUVWXYZ') {
        const drive = `${letter}:`
        try {
          const stats = await stat(`${drive}\\`)
          if (stats) {
            const musicInfo = await this.scanDeviceMusicQuick(drive)
            const id = this.generateDeviceId(drive, '', 0)
            const known = this.knownDevices.get(id)
            
            devices.push({
              id,
              drive,
              label: known?.customName || 'Removable Disk',
              type: 'usb',
              totalSize: 0,
              freeSize: 0,
              usedSize: 0,
              musicFolder: known?.musicFolder || musicInfo.musicFolder,
              playlistFolder: known?.playlistFolder || musicInfo.playlistFolder,
              songCount: musicInfo.songCount,
              playlistCount: musicInfo.playlistCount,
              lastSyncTime: known?.lastSyncTime,
              customName: known?.customName,
              isKnown: !!known
            })
          }
        } catch {}
      }
    }

    return devices
  }

  private async getMacDrives(): Promise<DeviceInfo[]> {
    const devices: DeviceInfo[] = []
    const volumesPath = '/Volumes'
    
    try {
      const entries = await readdir(volumesPath)
      
      for (const name of entries) {
        if (name.startsWith('.')) continue
        const mountPoint = join(volumesPath, name)
        try {
          const stats = await stat(mountPoint)
          if (stats.isDirectory()) {
            const id = this.generateDeviceId(mountPoint, name, 0)
            const known = this.knownDevices.get(id)
            const musicInfo = await this.scanDeviceMusicQuick(mountPoint)
            
            let sizeInfo = { total: 0, free: 0 }
            try {
              const { stdout } = await execAsync(`df -k "${mountPoint}" | tail -1`)
              const parts = stdout.trim().split(/\s+/)
              if (parts.length >= 4) {
                sizeInfo.total = parseInt(parts[1]) * 1024
                sizeInfo.free = parseInt(parts[3]) * 1024
              }
            } catch {}

            devices.push({
              id,
              drive: mountPoint,
              label: known?.customName || name,
              type: 'usb',
              totalSize: sizeInfo.total,
              freeSize: sizeInfo.free,
              usedSize: sizeInfo.total - sizeInfo.free,
              musicFolder: known?.musicFolder || musicInfo.musicFolder,
              playlistFolder: known?.playlistFolder || musicInfo.playlistFolder,
              songCount: musicInfo.songCount,
              playlistCount: musicInfo.playlistCount,
              lastSyncTime: known?.lastSyncTime,
              customName: known?.customName,
              isKnown: !!known
            })
          }
        } catch {}
      }
    } catch {}

    return devices
  }

  private async getLinuxDrives(): Promise<DeviceInfo[]> {
    const devices: DeviceInfo[] = []
    const mountPaths = ['/media', '/mnt', '/run/media']
    
    for (const basePath of mountPaths) {
      try {
        const userDirs = await readdir(basePath)
        for (const userDir of userDirs) {
          const userPath = join(basePath, userDir)
          try {
            const deviceDirs = await readdir(userPath)
            for (const deviceDir of deviceDirs) {
              const mountPoint = join(userPath, deviceDir)
              try {
                const stats = await stat(mountPoint)
                if (stats.isDirectory()) {
                  const id = this.generateDeviceId(mountPoint, deviceDir, 0)
                  const known = this.knownDevices.get(id)
                  const musicInfo = await this.scanDeviceMusicQuick(mountPoint)
                  
                  let sizeInfo = { total: 0, free: 0 }
                  try {
                    const { stdout } = await execAsync(`df -k "${mountPoint}" | tail -1`)
                    const parts = stdout.trim().split(/\s+/)
                    if (parts.length >= 4) {
                      sizeInfo.total = parseInt(parts[1]) * 1024
                      sizeInfo.free = parseInt(parts[3]) * 1024
                    }
                  } catch {}

                  devices.push({
                    id,
                    drive: mountPoint,
                    label: known?.customName || deviceDir,
                    type: 'usb',
                    totalSize: sizeInfo.total,
                    freeSize: sizeInfo.free,
                    usedSize: sizeInfo.total - sizeInfo.free,
                    musicFolder: known?.musicFolder || musicInfo.musicFolder,
                    playlistFolder: known?.playlistFolder || musicInfo.playlistFolder,
                    songCount: musicInfo.songCount,
                    playlistCount: musicInfo.playlistCount,
                    lastSyncTime: known?.lastSyncTime,
                    customName: known?.customName,
                    isKnown: !!known
                  })
                }
              } catch {}
            }
          } catch {}
        }
      } catch {}
    }

    return devices
  }

  private generateDeviceId(drive: string, serial: string, size: number): string {
    const base = `${drive}-${serial}-${size}`
    return Buffer.from(base).toString('base64').slice(0, 16)
  }

  private mapWindowsDriveType(typeNum: number): 'usb' | 'fixed' | 'network' | 'unknown' {
    switch (typeNum) {
      case 2: return 'usb'
      case 3: return 'fixed'
      case 4: return 'network'
      default: return 'unknown'
    }
  }

  private async scanDeviceMusicQuick(drive: string): Promise<{
    musicFolder: string | null
    playlistFolder: string | null
    songCount: number
    playlistCount: number
  }> {
    const audioExts = ['.mp3', '.flac', '.m4a', '.wav', '.ogg', '.wma', '.ape', '.aac']
    const possibleMusicPaths = [
      'Music', 'MUSIC', 'music',
      'Media', 'MEDIA', 'media',
      'MP3', 'mp3',
      'Audio', 'AUDIO', 'audio',
      'Songs', 'SONGS', 'songs',
      '音乐', '我的音乐'
    ]
    
    let musicFolder: string | null = null
    let playlistFolder: string | null = null
    let songCount = 0
    let playlistCount = 0

    for (const subPath of possibleMusicPaths) {
      const fullPath = join(drive, subPath)
      try {
        const stats = await stat(fullPath)
        if (stats.isDirectory()) {
          musicFolder = fullPath
          break
        }
      } catch {}
    }

    if (!musicFolder) {
      try {
        const rootEntries = await readdir(drive, { withFileTypes: true })
        let hasAudioInRoot = false
        for (const entry of rootEntries) {
          if (entry.isFile()) {
            const ext = entry.name.split('.').pop()?.toLowerCase()
            if (ext && audioExts.includes(`.${ext}`)) {
              hasAudioInRoot = true
              break
            }
          }
        }
        if (hasAudioInRoot) {
          musicFolder = drive
        }
      } catch {}
    }

    if (!musicFolder) {
      musicFolder = drive
    }

    const quickScan = async (dir: string, depth: number = 0): Promise<void> => {
      if (depth > 3) return
      
      try {
        const entries = await readdir(dir, { withFileTypes: true })
        
        for (const entry of entries) {
          const fullPath = join(dir, entry.name)
          
          if (entry.isDirectory()) {
            const lowerName = entry.name.toLowerCase()
            if (lowerName === 'playlist' || lowerName === 'playlists') {
              playlistFolder = fullPath
            }
            await quickScan(fullPath, depth + 1)
          } else if (entry.isFile()) {
            const ext = entry.name.split('.').pop()?.toLowerCase()
            if (ext && audioExts.includes(`.${ext}`)) {
              songCount++
            } else if (ext === 'm3u' || ext === 'm3u8') {
              playlistCount++
              if (!playlistFolder) playlistFolder = dir
            }
          }
        }
      } catch {}
    }

    await quickScan(musicFolder)

    return { musicFolder, playlistFolder, songCount, playlistCount }
  }

  async scanDeviceMusic(deviceId: string): Promise<DeviceMusicStructure> {
    const device = this.devices.get(deviceId)
    if (!device) {
      return { musicFolders: [], playlistFolder: null, totalSongs: 0, totalPlaylists: 0, songs: new Map() }
    }

    const searchPath = device.musicFolder || device.drive
    const audioExts = ['.mp3', '.flac', '.m4a', '.wav', '.ogg', '.wma', '.ape', '.aac']
    const musicFolders: Set<string> = new Set()
    const songs: Map<string, string> = new Map()
    let playlistFolder: string | null = device.playlistFolder
    let totalPlaylists = 0

    const scan = async (dir: string, depth: number = 0) => {
      if (depth > 6) return
      this.notifyProgress('scanning', songs.size, 0, dir)
      
      try {
        const entries = await readdir(dir, { withFileTypes: true })
        let hasAudio = false
        
        for (const entry of entries) {
          const fullPath = join(dir, entry.name)
          
          if (entry.isDirectory()) {
            const lowerName = entry.name.toLowerCase()
            if (lowerName === 'playlist' || lowerName === 'playlists') {
              playlistFolder = fullPath
            }
            await scan(fullPath, depth + 1)
          } else if (entry.isFile()) {
            const ext = entry.name.split('.').pop()?.toLowerCase()
            if (ext && audioExts.includes(`.${ext}`)) {
              hasAudio = true
              const nameWithoutExt = entry.name.replace(/\.[^.]+$/, '')
              songs.set(nameWithoutExt.toLowerCase(), fullPath)
              songs.set(entry.name.toLowerCase(), fullPath)
            } else if (ext === 'm3u' || ext === 'm3u8') {
              totalPlaylists++
              if (!playlistFolder) playlistFolder = dir
            }
          }
        }
        
        if (hasAudio) {
          musicFolders.add(dir)
        }
      } catch {}
    }

    await scan(searchPath)

    return {
      musicFolders: Array.from(musicFolders),
      playlistFolder,
      totalSongs: songs.size / 2,
      totalPlaylists,
      songs
    }
  }

  async getDevicePlaylists(deviceId: string): Promise<{ name: string; path: string; songCount: number }[]> {
    const device = this.devices.get(deviceId)
    if (!device) return []

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
                const content = readFileSync(fullPath, 'utf-8')
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

  async selectDeviceFolder(deviceId: string): Promise<string | null> {
    const device = this.devices.get(deviceId)
    if (!device) return null

    const { filePaths } = await dialog.showOpenDialog({
      title: '选择同步目标文件夹',
      defaultPath: device.drive,
      properties: ['openDirectory']
    })

    return filePaths.length > 0 ? filePaths[0] : null
  }

  setDeviceFolders(deviceId: string, musicFolder: string, playlistFolder: string) {
    const known = this.knownDevices.get(deviceId)
    if (known) {
      known.musicFolder = musicFolder
      known.playlistFolder = playlistFolder
    } else {
      this.knownDevices.set(deviceId, {
        id: deviceId,
        musicFolder,
        playlistFolder
      })
    }
    this.saveKnownDevices()
  }

  getDevice(deviceId: string): DeviceInfo | undefined {
    return this.devices.get(deviceId)
  }

  forgetDevice(deviceId: string) {
    this.knownDevices.delete(deviceId)
    this.saveKnownDevices()
  }

  private notifyProgress(phase: string, current: number, total: number, message: string) {
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send('device:scanProgress', { phase, current, total, message })
    }
  }

  notifyDeviceChange(event: 'connected' | 'disconnected', device: DeviceInfo) {
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send('device:change', { event, device })
    }
  }
}