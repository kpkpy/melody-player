import { defineStore } from 'pinia'
import { ref, onUnmounted } from 'vue'

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
}

export interface ScanProgress {
  phase: 'scanning' | 'parsing' | 'loading'
  current: number
  total: number
  currentFile?: string
}

export const useMusicStore = defineStore('music', () => {
  const songs = ref<Song[]>([])
  const albums = ref<any[]>([])
  const artists = ref<any[]>([])
  const isLoading = ref(false)
  const scanProgress = ref<ScanProgress | null>(null)

  // Setup library update listener
  const setupListeners = () => {
    const removeListener = window.electron.library.onUpdated((updatedSongs: any[]) => {
      songs.value = updatedSongs
      // Also refresh albums and artists
      window.electron.library.getAlbums().then(data => albums.value = data)
      window.electron.library.getArtists().then(data => artists.value = data)
    })
    
    return removeListener
  }

  const loadLibrary = async () => {
    isLoading.value = true
    try {
      const [songsData, albumsData, artistsData] = await Promise.all([
        window.electron.library.getSongs(),
        window.electron.library.getAlbums(),
        window.electron.library.getArtists(),
      ])
      songs.value = songsData
      albums.value = albumsData
      artists.value = artistsData
    } finally {
      isLoading.value = false
    }
  }

  const scanLibrary = async (paths: string[], forceRescan: boolean = false) => {
    isLoading.value = true
    scanProgress.value = { phase: 'scanning', current: 0, total: 0 }
    
    try {
      const plainPaths = JSON.parse(JSON.stringify(paths))
      await window.electron.library.scan(plainPaths, forceRescan)
      await loadLibrary()
    } finally {
      isLoading.value = false
      scanProgress.value = null
    }
  }

  const setProgress = (progress: ScanProgress) => {
    scanProgress.value = progress
  }

  return {
    songs,
    albums,
    artists,
    isLoading,
    scanProgress,
    loadLibrary,
    scanLibrary,
    setProgress,
    setupListeners,
  }
})