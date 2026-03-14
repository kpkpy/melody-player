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
  },

  config: {
    getMusicDirs: () => ipcRenderer.invoke('config:getMusicDirs'),
    setMusicDirs: (dirs: string[]) => ipcRenderer.invoke('config:setMusicDirs', dirs),
    addMusicDir: (dir: string) => ipcRenderer.invoke('config:addMusicDir', dir),
    removeMusicDir: (dir: string) => ipcRenderer.invoke('config:removeMusicDir', dir),
  },
})