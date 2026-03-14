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
        next()
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

  const play = async (song: any) => {
    const a = initAudio()
    
    currentSong.value = song
    title.value = song.title
    artist.value = song.artist
    cover.value = song.cover || ''
    
    if (song.audioUrl) {
      a.src = song.audioUrl
      try {
        await a.play()
      } catch (e) {
        console.error('Play error:', e)
      }
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
    // TODO: 实现上一首
  }

  const next = () => {
    // TODO: 实现下一首
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
    play,
    pause,
    resume,
    stop,
    togglePlay,
    setVolume,
    seek,
    previous,
    next,
  }
})