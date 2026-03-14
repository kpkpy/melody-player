/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ElectronAPI {
  library: {
    scan: (paths: string[]) => Promise<{ count: number; errors: string[] }>
    getSongs: () => Promise<any[]>
    getAlbums: () => Promise<any[]>
    getArtists: () => Promise<any[]>
    onScanProgress: (callback: (progress: { phase: string; current: number; total: number; currentFile: string }) => void) => (() => void)
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
  }
  window: {
    minimize: () => Promise<void>
    maximize: () => Promise<void>
    close: () => Promise<void>
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}