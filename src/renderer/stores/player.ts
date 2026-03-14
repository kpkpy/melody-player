import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const usePlayerStore = defineStore('player', () => {
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const volume = ref(0.8)
  const currentSong = ref<any>(null)
  const title = ref('')
  const artist = ref('')
  const cover = ref('')
  const playlist = ref<any[]>([])
  const currentIndex = ref(-1)
  
  let audio: HTMLAudioElement | null = null

  const initAudio = () => {
    if (!audio) {
      audio = new Audio()
      audio.volume = volume.value
      
      audio.addEventListener('timeupdate', () => {
        currentTime.value = audio?.currentTime || 0
      })
      
      audio.addEventListener('loadedmetadata', () => {
        duration.value = audio?.duration || 0
      })
      
      audio.addEventListener('ended', () => {
        isPlaying.value = false
        playNext()
      })
      
      audio.addEventListener('play', () => {
        isPlaying.value = true
      })
      
      audio.addEventListener('pause', () => {
        isPlaying.value = false
      })
      
      audio.addEventListener('error', (e) => {
        console.error('Audio error:', e)
        isPlaying.value = false
      })
    }
    return audio
  }

  const play = async (song: any, index?: number) => {
    const a = initAudio()
    
    currentSong.value = song
    title.value = song.title
    artist.value = song.artist
    cover.value = song.cover || ''
    
    if (index !== undefined) {
      currentIndex.value = index
    } else if (playlist.value.length > 0) {
      const foundIndex = playlist.value.findIndex(s => s.id === song.id)
      currentIndex.value = foundIndex >= 0 ? foundIndex : -1
    }
    
    if (song.audioUrl) {
      a.src = song.audioUrl
      try {
        await a.play()
      } catch (e) {
        console.error('Play error:', e)
      }
    }
  }

  const setPlaylist = (songs: any[], startIndex: number = 0) => {
    playlist.value = songs
    currentIndex.value = startIndex
    if (songs.length > 0 && songs[startIndex]) {
      play(songs[startIndex], startIndex)
    }
  }

  const pause = () => {
    audio?.pause()
  }

  const resume = () => {
    audio?.play()
  }

  const stop = () => {
    if (audio) {
      audio.pause()
      audio.currentTime = 0
      isPlaying.value = false
    }
  }

  const togglePlay = () => {
    if (isPlaying.value) {
      pause()
    } else {
      resume()
    }
  }

  const setVolume = (v: number) => {
    volume.value = v
    if (audio) {
      audio.volume = v
    }
  }

  const seek = (time: number) => {
    if (audio) {
      audio.currentTime = time
      currentTime.value = time
    }
  }

  const previous = () => {
    if (playlist.value.length === 0 || currentIndex.value <= 0) {
      seek(0)
      return
    }
    const newIndex = currentIndex.value - 1
    const song = playlist.value[newIndex]
    if (song) {
      play(song, newIndex)
    }
  }

  const playNext = () => {
    if (playlist.value.length === 0) return
    if (currentIndex.value >= playlist.value.length - 1) {
      const song = playlist.value[0]
      play(song, 0)
    } else {
      const newIndex = currentIndex.value + 1
      const song = playlist.value[newIndex]
      if (song) {
        play(song, newIndex)
      }
    }
  }

  const next = () => {
    playNext()
  }

  return {
    isPlaying,
    currentTime,
    duration,
    volume,
    currentSong,
    title,
    artist,
    cover,
    playlist,
    currentIndex,
    play,
    pause,
    resume,
    stop,
    togglePlay,
    setVolume,
    seek,
    previous,
    next,
    setPlaylist,
  }
})