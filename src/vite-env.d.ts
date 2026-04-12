/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface DeviceInfo {
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

interface SyncPreview {
  toCopyCount: number
  toDeleteCount: number
  playlistsToSync: { id: string; name: string; songCount: number }[]
  totalSize: number
  freeSpaceAfter: number
  error?: string
}

interface LibrarySyncResult {
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

interface SyncState {
  deviceId: string
  lastSyncTime: number
  syncedSongs: string[]
  syncedPlaylists: string[]
}

interface YouTubeVideoInfo {
  id: string
  title: string
  author: string
  thumbnail: string
  duration: number
  description?: string
}

interface YouTubeDownloadProgress {
  status: 'downloading' | 'converting' | 'writing_metadata' | 'completed' | 'error'
  progress: number
  message: string
  videoTitle?: string
}

interface ElectronAPI {
  app: {
    ready: () => Promise<void>
  }
  library: {
    scan: (paths: string[], forceRescan?: boolean) => Promise<{ count: number; errors: string[] }>
    getSongs: () => Promise<any[]>
    getAlbums: () => Promise<any[]>
    getArtists: () => Promise<any[]>
    clearCache: () => Promise<boolean>
    onScanProgress: (callback: (progress: { phase: string; current: number; total: number; currentFile: string }) => void) => (() => void)
    onUpdated: (callback: (songs: any[]) => void) => (() => void)
  }
  player: {
    onStateChange: (callback: (state: any) => void) => (() => void)
  }
  playlist: {
    create: (name: string) => Promise<any>
    getAll: () => Promise<any[]>
    addSong: (playlistId: string, songId: string) => Promise<boolean>
    removeSong: (playlistId: string, songId: string) => Promise<boolean>
    delete: (playlistId: string) => Promise<boolean>
  }
  sync: {
    exportPlaylist: (playlistId: string) => Promise<string | null>
    importM3U: () => Promise<{ name: string; songs: any[] } | null>
    importM3UToPlaylist: (playlistId: string, songs: any[]) => Promise<boolean>
    exportAll: () => Promise<string | null>
    importAll: () => Promise<number>
    onProgress: (callback: (progress: { phase: string; current: number; total: number; message: string }) => void) => (() => void)
  }
  device: {
    detect: () => Promise<DeviceInfo[]>
    scanMusic: (deviceId: string) => Promise<{ musicFolders: string[]; playlistFolder: string | null; totalSongs: number; totalPlaylists: number }>
    getPlaylists: (deviceId: string) => Promise<{ name: string; path: string; songCount: number }[]>
    getSyncState: (deviceId: string) => Promise<SyncState | null>
    updateName: (deviceId: string, name: string) => Promise<boolean>
    setFolders: (deviceId: string, musicFolder: string, playlistFolder: string) => Promise<boolean>
    forget: (deviceId: string) => Promise<boolean>
    previewSync: (deviceId: string, options: { syncSongs: boolean; syncPlaylists: boolean; deleteRemoved: boolean }) => Promise<SyncPreview>
    syncTo: (deviceId: string, options: { syncSongs: boolean; syncPlaylists: boolean; deleteRemoved: boolean }) => Promise<LibrarySyncResult>
    importFrom: (deviceId: string, options: { importSongs: boolean; importPlaylists: boolean }) => Promise<LibrarySyncResult>
    onChange: (callback: (data: { event: string; device: DeviceInfo }) => void) => (() => void)
    onScanProgress: (callback: (progress: { phase: string; current: number; total: number; message: string }) => void) => (() => void)
  }
  window: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
  }
  config: {
    getMusicDirs: () => Promise<string[]>
    setMusicDirs: (dirs: string[]) => Promise<boolean>
    addMusicDir: (dir: string) => Promise<boolean>
    removeMusicDir: (dir: string) => Promise<boolean>
  }
  youtube: {
    getVideoInfo: (url: string) => Promise<{ success: boolean; info?: YouTubeVideoInfo; error?: string }>
    download: (url: string, customAuthor?: string) => Promise<{ success: boolean; filePath?: string; songInfo?: any; error?: string }>
    cancelDownload: () => Promise<boolean>
    getDownloadDir: () => Promise<string>
    setDownloadDir: (dir: string) => Promise<boolean>
    isValidUrl: (url: string) => Promise<boolean>
    isAvailable: () => Promise<boolean>
    onDownloadProgress: (callback: (progress: YouTubeDownloadProgress) => void) => (() => void)
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}