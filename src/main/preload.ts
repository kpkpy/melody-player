import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

contextBridge.exposeInMainWorld('electron', {
  app: {
    ready: () => ipcRenderer.invoke('app:ready'),
  },

  library: {
    scan: (paths: string[], forceRescan?: boolean) => ipcRenderer.invoke('library:scan', paths, forceRescan),
    getSongs: () => ipcRenderer.invoke('library:getSongs'),
    getAlbums: () => ipcRenderer.invoke('library:getAlbums'),
    getArtists: () => ipcRenderer.invoke('library:getArtists'),
    clearCache: () => ipcRenderer.invoke('library:clearCache'),
    onScanProgress: (callback: (progress: { phase: string; current: number; total: number; currentFile: string }) => void) => {
      const handler = (_event: IpcRendererEvent, progress: { phase: string; current: number; total: number; currentFile: string }) => {
        callback(progress)
      }
      ipcRenderer.on('library:scanProgress', handler)
      return () => ipcRenderer.removeListener('library:scanProgress', handler)
    },
    onUpdated: (callback: (songs: any[]) => void) => {
      const handler = (_event: IpcRendererEvent, songs: any[]) => {
        callback(songs)
      }
      ipcRenderer.on('library:updated', handler)
      return () => ipcRenderer.removeListener('library:updated', handler)
    },
  },

  player: {
    onStateChange: (callback: (state: any) => void) => {
      const handler = (_event: any, state: any) => callback(state)
      ipcRenderer.on('player:stateChange', handler)
      return () => ipcRenderer.removeListener('player:stateChange', handler)
    },
  },

  playlist: {
    create: (name: string) => ipcRenderer.invoke('playlist:create', name),
    getAll: () => ipcRenderer.invoke('playlist:getAll'),
    addSong: (playlistId: string, songId: string) => 
      ipcRenderer.invoke('playlist:addSong', playlistId, songId),
    removeSong: (playlistId: string, songId: string) => 
      ipcRenderer.invoke('playlist:removeSong', playlistId, songId),
    delete: (playlistId: string) => ipcRenderer.invoke('playlist:delete', playlistId),
  },

  sync: {
    exportPlaylist: (playlistId: string) => ipcRenderer.invoke('sync:exportPlaylist', playlistId),
    importM3U: () => ipcRenderer.invoke('sync:importM3U'),
    importM3UToPlaylist: (playlistId: string, songs: any[]) => 
      ipcRenderer.invoke('sync:importM3UToPlaylist', playlistId, songs),
    exportAll: () => ipcRenderer.invoke('sync:exportAll'),
    importAll: () => ipcRenderer.invoke('sync:importAll'),
    onProgress: (callback: (progress: { phase: string; current: number; total: number; message: string }) => void) => {
      const handler = (_event: IpcRendererEvent, progress: { phase: string; current: number; total: number; message: string }) => {
        callback(progress)
      }
      ipcRenderer.on('sync:progress', handler)
      return () => ipcRenderer.removeListener('sync:progress', handler)
    },
  },

  device: {
    detect: () => ipcRenderer.invoke('device:detect'),
    scanMusic: (deviceId: string) => ipcRenderer.invoke('device:scanMusic', deviceId),
    getPlaylists: (deviceId: string) => ipcRenderer.invoke('device:getPlaylists', deviceId),
    getSyncState: (deviceId: string) => ipcRenderer.invoke('device:getSyncState', deviceId),
    updateName: (deviceId: string, name: string) => ipcRenderer.invoke('device:updateName', deviceId, name),
    setFolders: (deviceId: string, musicFolder: string, playlistFolder: string) => 
      ipcRenderer.invoke('device:setFolders', deviceId, musicFolder, playlistFolder),
    forget: (deviceId: string) => ipcRenderer.invoke('device:forget', deviceId),
    previewSync: (deviceId: string, options: any) => ipcRenderer.invoke('device:previewSync', deviceId, options),
    syncTo: (deviceId: string, options: any) => ipcRenderer.invoke('device:syncTo', deviceId, options),
    importFrom: (deviceId: string, options: any) => ipcRenderer.invoke('device:importFrom', deviceId, options),
    onChange: (callback: (data: { event: string; device: any }) => void) => {
      const handler = (_event: IpcRendererEvent, data: { event: string; device: any }) => {
        callback(data)
      }
      ipcRenderer.on('device:change', handler)
      return () => ipcRenderer.removeListener('device:change', handler)
    },
    onScanProgress: (callback: (progress: { phase: string; current: number; total: number; message: string }) => void) => {
      const handler = (_event: IpcRendererEvent, progress: { phase: string; current: number; total: number; message: string }) => {
        callback(progress)
      }
      ipcRenderer.on('device:scanProgress', handler)
      return () => ipcRenderer.removeListener('device:scanProgress', handler)
    },
  },

  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    toggleMini: () => ipcRenderer.invoke('window:toggleMini'),
    isMini: () => ipcRenderer.invoke('window:isMini'),
    togglePiP: () => ipcRenderer.invoke('window:togglePiP'),
    onMiniModeChanged: (callback: (isMini: boolean) => void) => {
      const handler = (_event: any, isMini: boolean) => callback(isMini)
      ipcRenderer.on('window:miniModeChanged', handler)
      return () => ipcRenderer.removeListener('window:miniModeChanged', handler)
    },
    onPiPModeChanged: (callback: (isPiP: boolean) => void) => {
      const handler = (_event: any, isPiP: boolean) => callback(isPiP)
      ipcRenderer.on('window:PiPModeChanged', handler)
      return () => ipcRenderer.removeListener('window:PiPModeChanged', handler)
    },
  },

  config: {
    getMusicDirs: () => ipcRenderer.invoke('config:getMusicDirs'),
    setMusicDirs: (dirs: string[]) => ipcRenderer.invoke('config:setMusicDirs', dirs),
    addMusicDir: (dir: string) => ipcRenderer.invoke('config:addMusicDir', dir),
    removeMusicDir: (dir: string) => ipcRenderer.invoke('config:removeMusicDir', dir),
  },

  // Phase 1: 交互增强
  desktopLyrics: {
    show: () => ipcRenderer.invoke('desktopLyrics:show'),
    hide: () => ipcRenderer.invoke('desktopLyrics:hide'),
    toggle: () => ipcRenderer.invoke('desktopLyrics:toggle'),
    update: (lines: string[], currentIndex: number) => ipcRenderer.invoke('desktopLyrics:update', lines, currentIndex),
  },

  stats: {
    startPlaying: (song: any) => ipcRenderer.invoke('stats:startPlaying', song),
    stopPlaying: (completed: boolean) => ipcRenderer.invoke('stats:stopPlaying', completed),
    getStats: () => ipcRenderer.invoke('stats:getStats'),
    getTopSongs: (limit: number) => ipcRenderer.invoke('stats:getTopSongs', limit),
    getTopArtists: (limit: number) => ipcRenderer.invoke('stats:getTopArtists', limit),
    getRecentlyPlayed: (limit: number) => ipcRenderer.invoke('stats:getRecentlyPlayed', limit),
    getDailyStats: () => ipcRenderer.invoke('stats:getDailyStats'),
    toggleFavorite: (songId: string) => ipcRenderer.invoke('stats:toggleFavorite', songId),
    addEmotionTag: (songId: string, tag: string) => ipcRenderer.invoke('stats:addEmotionTag', songId, tag),
    removeEmotionTag: (songId: string, tag: string) => ipcRenderer.invoke('stats:removeEmotionTag', songId, tag),
    clearStats: () => ipcRenderer.invoke('stats:clearStats'),
    getRecommendations: (songId: string, limit: number) => ipcRenderer.invoke('stats:getRecommendations', songId, limit),
    getSmartPlaylist: (scene: 'focus' | 'workout' | 'relax' | 'party') => ipcRenderer.invoke('stats:getSmartPlaylist', scene),
    getFavorites: () => ipcRenderer.invoke('stats:getFavorites'),
    // 情绪分类
    getEmotionCategories: () => ipcRenderer.invoke('stats:getEmotionCategories'),
    getSongsByEmotion: (emotion: string) => ipcRenderer.invoke('stats:getSongsByEmotion', emotion),
    getSongsByScene: (scene: string) => ipcRenderer.invoke('stats:getSongsByScene', scene),
    reanalyzeEmotions: () => ipcRenderer.invoke('stats:reanalyzeEmotions'),
    analyzeSong: (song: any) => ipcRenderer.invoke('stats:analyzeSong', song),
  },

  // 全局热键事件监听
  onGlobalHotkey: (type: 'playPause' | 'next' | 'previous' | 'volumeUp' | 'volumeDown', callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on(`global:${type}`, handler)
    return () => ipcRenderer.removeListener(`global:${type}`, handler)
  },

  // YouTube 下载功能
  youtube: {
    getVideoInfo: (url: string) => ipcRenderer.invoke('youtube:getVideoInfo', url),
    download: (url: string, customAuthor?: string) => ipcRenderer.invoke('youtube:download', url, customAuthor),
    cancelDownload: () => ipcRenderer.invoke('youtube:cancelDownload'),
    getDownloadDir: () => ipcRenderer.invoke('youtube:getDownloadDir'),
    setDownloadDir: (dir: string) => ipcRenderer.invoke('youtube:setDownloadDir', dir),
    isValidUrl: (url: string) => ipcRenderer.invoke('youtube:isValidUrl', url),
    isAvailable: () => ipcRenderer.invoke('youtube:isAvailable'),
    onDownloadProgress: (callback: (progress: { status: string; progress: number; message: string; videoTitle?: string }) => void) => {
      const handler = (_event: IpcRendererEvent, progress: { status: string; progress: number; message: string; videoTitle?: string }) => {
        callback(progress)
      }
      ipcRenderer.on('youtube:downloadProgress', handler)
      return () => ipcRenderer.removeListener('youtube:downloadProgress', handler)
    },
  },
})