import { app, BrowserWindow, ipcMain, protocol } from 'electron'
import { join } from 'path'
import { MusicLibrary } from './musicLibrary'
import { Player } from './player'
import { PlaylistManager } from './playlistManager'
import { SyncManager } from './syncManager'
import { ConfigManager } from './configManager'
import { DeviceManager } from './deviceManager'

let win: BrowserWindow | null = null
const configManager = new ConfigManager()
const musicLibrary = new MusicLibrary()
const player = new Player()
const playlistManager = new PlaylistManager()
const syncManager = new SyncManager(musicLibrary, playlistManager)
const deviceManager = new DeviceManager()

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: join(__dirname, 'preload.js'),
    },
    backgroundColor: '#1a1a2e',
  })

  musicLibrary.setWindow(win)
  player.setWindow(win)
  syncManager.setWindow(win)
  deviceManager.setWindow(win)

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(join(__dirname, '../dist/index.html'))
  }
}

let autoScanned = false

ipcMain.handle('app:ready', async () => {
  if (autoScanned) return
  autoScanned = true
  
  const savedDirs = configManager.getMusicDirs()
  if (savedDirs.length === 0) return

  const loaded = await musicLibrary.loadFromCache()
  if (!loaded) {
    await musicLibrary.scan(savedDirs)
  }
  playlistManager.setSongs(musicLibrary.getSongs())
})

app.whenReady().then(() => {
  protocol.registerFileProtocol('audio', (request, callback) => {
    const url = request.url.substr(7)
    try {
      return callback(decodeURIComponent(url))
    } catch (e) {
      return callback('')
    }
  })
  
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// 音乐库相关
ipcMain.handle('library:scan', async (_, paths: string[], forceRescan: boolean = false) => {
  const result = await musicLibrary.scan(paths, forceRescan)
  playlistManager.setSongs(musicLibrary.getSongs())
  return result
})

ipcMain.handle('library:clearCache', async () => {
  musicLibrary.clearCache()
  return true
})

ipcMain.handle('library:getSongs', async () => {
  return musicLibrary.getSongs()
})

ipcMain.handle('library:getAlbums', async () => {
  return musicLibrary.getAlbums()
})

ipcMain.handle('library:getArtists', async () => {
  return musicLibrary.getArtists()
})

// 歌单相关
ipcMain.handle('playlist:create', async (_, name: string) => {
  return playlistManager.create(name)
})

ipcMain.handle('playlist:getAll', async () => {
  return playlistManager.getAll()
})

ipcMain.handle('playlist:addSong', async (_, playlistId: string, songId: string) => {
  return playlistManager.addSong(playlistId, songId)
})

ipcMain.handle('playlist:removeSong', async (_, playlistId: string, songId: string) => {
  return playlistManager.removeSong(playlistId, songId)
})

ipcMain.handle('playlist:delete', async (_, playlistId: string) => {
  return playlistManager.delete(playlistId)
})

// 同步相关
ipcMain.handle('sync:exportPlaylist', async (_, playlistId: string) => {
  return await syncManager.exportPlaylist(playlistId)
})

ipcMain.handle('sync:importM3U', async () => {
  return await syncManager.importM3U()
})

ipcMain.handle('sync:importM3UToPlaylist', async (_, playlistId: string, songs: any[]) => {
  for (const song of songs) {
    const found = musicLibrary.getSongByTitleAndArtist(song.title, song.artist)
    if (found) {
      playlistManager.addSong(playlistId, found.id)
    }
  }
  return true
})

ipcMain.handle('sync:exportAll', async () => {
  return await syncManager.exportAllPlaylists()
})

ipcMain.handle('sync:importAll', async () => {
  return await syncManager.importPlaylists()
})

// 窗口控制
ipcMain.handle('window:minimize', async () => {
  win?.minimize()
})

ipcMain.handle('window:maximize', async () => {
  if (win?.isMaximized()) {
    win.unmaximize()
  } else {
    win?.maximize()
  }
})

ipcMain.handle('window:close', async () => {
  win?.close()
})

// 配置相关
ipcMain.handle('config:getMusicDirs', async () => {
  return configManager.getMusicDirs()
})

ipcMain.handle('config:setMusicDirs', async (_, dirs: string[]) => {
  configManager.setMusicDirs(dirs)
  return true
})

ipcMain.handle('config:addMusicDir', async (_, dir: string) => {
  configManager.addMusicDir(dir)
  return true
})

ipcMain.handle('config:removeMusicDir', async (_, dir: string) => {
  configManager.removeMusicDir(dir)
  return true
})

// 设备检测相关
ipcMain.handle('device:detect', async () => {
  return await deviceManager.detectDevices()
})

ipcMain.handle('device:scanMusic', async (_, deviceId: string) => {
  return await deviceManager.scanDeviceMusic(deviceId)
})

ipcMain.handle('device:getPlaylists', async (_, deviceId: string) => {
  return await deviceManager.getDevicePlaylists(deviceId)
})

ipcMain.handle('device:getSyncState', async (_, deviceId: string) => {
  return deviceManager.getDeviceSyncState(deviceId)
})

ipcMain.handle('device:updateName', async (_, deviceId: string, name: string) => {
  deviceManager.updateDeviceName(deviceId, name)
  return true
})

ipcMain.handle('device:setFolders', async (_, deviceId: string, musicFolder: string, playlistFolder: string) => {
  deviceManager.setDeviceFolders(deviceId, musicFolder, playlistFolder)
  return true
})

ipcMain.handle('device:forget', async (_, deviceId: string) => {
  deviceManager.forgetDevice(deviceId)
  return true
})

// 设备同步相关
ipcMain.handle('device:previewSync', async (_, deviceId: string, options: any) => {
  try {
    let device = deviceManager.getDevice(deviceId)
    if (!device) {
      await deviceManager.detectDevices()
      device = deviceManager.getDevice(deviceId)
    }
    if (!device) {
      return { error: '设备未找到，请重新检测设备' }
    }
    return await syncManager.previewSyncToDevice(device, options)
  } catch (e: any) {
    console.error('Preview sync error:', e)
    return { error: e.message || '预览失败' }
  }
})

ipcMain.handle('device:syncTo', async (_, deviceId: string, options: any) => {
  try {
    let device = deviceManager.getDevice(deviceId)
    if (!device) {
      await deviceManager.detectDevices()
      device = deviceManager.getDevice(deviceId)
    }
    if (!device) {
      return { success: false, message: '设备未找到，请重新检测设备', songsCopied: 0, songsSkipped: 0, songsDeleted: 0, playlistsSynced: 0, errors: ['设备未找到'], totalSize: 0, duration: 0 }
    }
    const result = await syncManager.syncLibraryToDevice(device, options)
    if (result.success) {
      deviceManager.updateDeviceSyncState(deviceId, {
        lastSyncTime: Date.now(),
        syncedSongs: [],
        syncedPlaylists: []
      })
    }
    return result
  } catch (e: any) {
    console.error('Sync error:', e)
    return { success: false, message: e.message || '同步失败', songsCopied: 0, songsSkipped: 0, songsDeleted: 0, playlistsSynced: 0, errors: [e.message], totalSize: 0, duration: 0 }
  }
})

ipcMain.handle('device:importFrom', async (_, deviceId: string, options: any) => {
  try {
    let device = deviceManager.getDevice(deviceId)
    if (!device) {
      await deviceManager.detectDevices()
      device = deviceManager.getDevice(deviceId)
    }
    if (!device) {
      return { success: false, message: '设备未找到，请重新检测设备', songsCopied: 0, songsSkipped: 0, songsDeleted: 0, playlistsSynced: 0, errors: ['设备未找到'], totalSize: 0, duration: 0 }
    }
    return await syncManager.importFromDevice(device, options)
  } catch (e: any) {
    console.error('Import error:', e)
    return { success: false, message: e.message || '导入失败', songsCopied: 0, songsSkipped: 0, songsDeleted: 0, playlistsSynced: 0, errors: [e.message], totalSize: 0, duration: 0 }
  }
})