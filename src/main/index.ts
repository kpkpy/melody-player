import { app, BrowserWindow, ipcMain, protocol } from 'electron'
import { join } from 'path'
import { MusicLibrary } from './musicLibrary'
import { Player } from './player'
import { PlaylistManager } from './playlistManager'
import { SyncManager } from './syncManager'
import { ConfigManager } from './configManager'
import { DeviceManager } from './deviceManager'
import { HotkeyManager } from './hotkeyManager'
import { TrayManager } from './trayManager'
import { DesktopLyricsWindow } from './desktopLyrics'
import { StatsManager } from './statsManager'
import { MiniWindowManager } from './miniWindowManager'
import { musicEmotionAnalyzer } from './musicEmotionAnalyzer'
import { YouTubeDownloader } from './youtubeDownloader'

let win: BrowserWindow | null = null
const configManager = new ConfigManager()
const musicLibrary = new MusicLibrary()
const player = new Player()
const playlistManager = new PlaylistManager()
const syncManager = new SyncManager(musicLibrary, playlistManager)
const deviceManager = new DeviceManager()
const hotkeyManager = new HotkeyManager()
const trayManager = new TrayManager()
const statsManager = new StatsManager(musicLibrary)
const miniWindowManager = new MiniWindowManager(win!)
const youtubeDownloader = new YouTubeDownloader()
let desktopLyrics: DesktopLyricsWindow | null = null

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
  youtubeDownloader.setWindow(win)
  
  // 重新初始化 miniWindowManager（传入窗口）
  miniWindowManager.mainWindow = win
  
  // 设置托盘
  trayManager.setWindow(win)
  trayManager.createTray()
  
  // 设置全局热键
  setupHotkeys()
  
  // 初始化桌面歌词（可选功能，需要时创建）
  ipcMain.handle('lyrics:isSupported', () => true)

  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(join(__dirname, '../dist/index.html'))
  }
}

let autoScanned = false

function setupHotkeys() {
  hotkeyManager.registerAllShortcuts({
    playPause: () => {
      win?.webContents.send('global:playPause')
    },
    next: () => {
      win?.webContents.send('global:next')
    },
    previous: () => {
      win?.webContents.send('global:previous')
    },
    volumeUp: () => {
      win?.webContents.send('global:volumeUp')
    },
    volumeDown: () => {
      win?.webContents.send('global:volumeDown')
    },
  })
  
  // 设置托盘回调
  trayManager.setCallbacks({
    playPause: () => {
      win?.webContents.send('global:playPause')
    },
    next: () => {
      win?.webContents.send('global:next')
    },
    previous: () => {
      win?.webContents.send('global:previous')
    },
  })
}

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
  // 清理资源
  hotkeyManager.unregisterAll()
  trayManager.destroy()
  desktopLyrics?.destroy()
  
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

// 将 Windows 最小化到托盘（而不是退出）
app.on('before-quit', () => {
  // 允许退出
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

// ===== Phase 1 新增功能：桌面歌词 =====
ipcMain.handle('desktopLyrics:show', () => {
  if (!desktopLyrics && win) {
    desktopLyrics = new DesktopLyricsWindow(win)
    desktopLyrics.create()
  }
  desktopLyrics?.show()
  return true
})

ipcMain.handle('desktopLyrics:hide', () => {
  desktopLyrics?.hide()
  return true
})

ipcMain.handle('desktopLyrics:toggle', () => {
  if (!desktopLyrics && win) {
    desktopLyrics = new DesktopLyricsWindow(win)
    desktopLyrics.create()
    desktopLyrics.show()
  } else if (desktopLyrics) {
    desktopLyrics.destroy()
    desktopLyrics = null
  }
  return desktopLyrics !== null
})

ipcMain.handle('desktopLyrics:update', (_, lines: string[], currentIndex: number) => {
  desktopLyrics?.updateLyrics(lines, currentIndex)
  return true
})

// ===== Phase 1 新增功能：听歌统计 =====
ipcMain.handle('stats:startPlaying', (_, song: any) => {
  statsManager.startPlaying(song)
  return true
})

ipcMain.handle('stats:stopPlaying', (_, completed: boolean = false) => {
  statsManager.stopCurrentPlay(completed)
  return true
})

ipcMain.handle('stats:getStats', () => {
  return statsManager.getStats()
})

ipcMain.handle('stats:getTopSongs', (_, limit: number = 10) => {
  return statsManager.getTopSongs(limit)
})

ipcMain.handle('stats:getTopArtists', (_, limit: number = 10) => {
  return statsManager.getTopArtists(limit)
})

ipcMain.handle('stats:getRecentlyPlayed', (_, limit: number = 20) => {
  return statsManager.getRecentlyPlayed(limit)
})

ipcMain.handle('stats:getDailyStats', () => {
  return statsManager.getDailyStats()
})

ipcMain.handle('stats:toggleFavorite', (_, songId: string) => {
  return statsManager.toggleFavorite(songId)
})

ipcMain.handle('stats:addEmotionTag', (_, songId: string, tag: string) => {
  statsManager.addEmotionTag(songId, tag)
  return true
})

ipcMain.handle('stats:removeEmotionTag', (_, songId: string, tag: string) => {
  statsManager.removeEmotionTag(songId, tag)
  return true
})

ipcMain.handle('stats:clearStats', () => {
  statsManager.clearStats()
  return true
})

ipcMain.handle('stats:getRecommendations', (_, songId: string, limit: number = 10) => {
  return statsManager.getRecommendations(songId, limit)
})

ipcMain.handle('stats:getSmartPlaylist', (_, scene: 'focus' | 'workout' | 'relax' | 'party') => {
  return statsManager.getSmartPlaylist(scene)
})

ipcMain.handle('stats:getFavorites', () => {
  return statsManager.getFavorites()
})

// 情绪分类相关
ipcMain.handle('stats:getEmotionCategories', () => {
  const categories = statsManager.getEmotionCategories()
  console.log('getEmotionCategories returned:', categories.length, 'categories')
  return categories
})

ipcMain.handle('stats:getSongsByEmotion', (_, emotion: string) => {
  const songs = statsManager.getSongsByEmotion(emotion)
  console.log('getSongsByEmotion for', emotion, ':', songs.length, 'songs')
  return songs
})

ipcMain.handle('stats:getSongsByScene', (_, scene: string) => {
  const songs = statsManager.getSongsByScene(scene)
  console.log('getSongsByScene for', scene, ':', songs.length, 'songs')
  return songs
})

ipcMain.handle('stats:reanalyzeEmotions', async () => {
  console.log('stats:reanalyzeEmotions called!')
  try {
    statsManager.reanalyzeAllEmotions()
    console.log('stats:reanalyzeEmotions completed!')
    return true
  } catch (e) {
    console.error('stats:reanalyzeEmotions error:', e)
    throw e
  }
})

ipcMain.handle('stats:analyzeSong', (_, song: any) => {
  console.log('Analyzing single song:', song.title)
  const analysis = musicEmotionAnalyzer.analyzeEmotion(song)
  const scenes = musicEmotionAnalyzer.classifyScene(song, analysis)
  return { ...song, emotionAnalysis: analysis, sceneClassification: scenes }
})

// ===== YouTube 下载功能 =====
ipcMain.handle('youtube:getVideoInfo', async (_, url: string) => {
  try {
    const info = await youtubeDownloader.getVideoInfo(url)
    return { success: true, info }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('youtube:download', async (_, url: string, customAuthor?: string) => {
  try {
    const result = await youtubeDownloader.downloadAsAudio(url, customAuthor)
    // Add to music library (with deduplication check)
    const song = result.songInfo
    const added = musicLibrary.addSong(song)
    playlistManager.setSongs(musicLibrary.getSongs())
    // Notify frontend to update
    win?.webContents.send('library:updated', musicLibrary.getSongs())
    return { 
      success: true, 
      filePath: result.filePath, 
      songInfo: song,
      isDuplicate: !added // True if song was duplicate and not added
    }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
})

ipcMain.handle('youtube:cancelDownload', async () => {
  return youtubeDownloader.cancelDownload()
})

ipcMain.handle('youtube:getDownloadDir', async () => {
  return youtubeDownloader.getDownloadDir()
})

ipcMain.handle('youtube:setDownloadDir', async (_, dir: string) => {
  youtubeDownloader.setDownloadDir(dir)
  return true
})

ipcMain.handle('youtube:isValidUrl', async (_, url: string) => {
  return youtubeDownloader.isValidYouTubeUrl(url)
})

ipcMain.handle('youtube:isAvailable', async () => {
  return await youtubeDownloader.isYtDlpAvailable()
})