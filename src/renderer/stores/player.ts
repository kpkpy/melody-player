import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export type PlayMode = 'sequence' | 'random' | 'single'

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
  const playMode = ref<PlayMode>('sequence')
  const shuffledIndices = ref<number[]>([])
  const showQueue = ref(false)
  
  let audio: HTMLAudioElement | null = null

  const queue = computed(() => {
    if (playlist.value.length === 0) return []
    if (playMode.value === 'random' && shuffledIndices.value.length > 0) {
      const remaining = []
      for (let i = currentIndex.value; i < shuffledIndices.value.length; i++) {
        const songIndex = shuffledIndices.value[i]
        remaining.push({ ...playlist.value[songIndex], _queueIndex: i })
      }
      return remaining
    }
    return playlist.value.slice(currentIndex.value).map((s, i) => ({ ...s, _queueIndex: currentIndex.value + i }))
  })

  const queueCount = computed(() => queue.value.length)
  
  const playModeIcon = computed(() => {
    switch (playMode.value) {
      case 'random': return 'shuffle'
      case 'single': return 'repeat-one'
      default: return 'repeat'
    }
  })

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
        if (playMode.value === 'single') {
          audio!.currentTime = 0
          audio!.play()
          isPlaying.value = true
        } else {
          playNext()
        }
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

  const generateShuffledIndices = () => {
    const indices = Array.from({ length: playlist.value.length }, (_, i) => i)
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[indices[i], indices[j]] = [indices[j], indices[i]]
    }
    if (indices[currentIndex.value] === currentIndex.value && indices.length > 1) {
      ;[indices[0], indices[indices.length - 1]] = [indices[indices.length - 1], indices[0]]
    }
    return indices
  }

  const togglePlayMode = () => {
    const modes: PlayMode[] = ['sequence', 'random', 'single']
    const currentModeIndex = modes.indexOf(playMode.value)
    const nextMode = modes[(currentModeIndex + 1) % modes.length]
    playMode.value = nextMode
    
    if (nextMode === 'random' && playlist.value.length > 0) {
      shuffledIndices.value = generateShuffledIndices()
    }
  }

  const getActualIndex = (index: number): number => {
    if (playMode.value === 'random' && shuffledIndices.value.length > 0) {
      return shuffledIndices.value[index]
    }
    return index
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
    if (playMode.value === 'random') {
      shuffledIndices.value = generateShuffledIndices()
    }
    if (songs.length > 0) {
      const actualIndex = getActualIndex(startIndex)
      play(songs[actualIndex], startIndex)
    }
  }

  const playFromQueue = (queueIndex: number) => {
    if (playMode.value === 'random' && shuffledIndices.value.length > 0) {
      const targetShuffleIndex = currentIndex.value + queueIndex
      if (targetShuffleIndex < shuffledIndices.value.length) {
        const songIndex = shuffledIndices.value[targetShuffleIndex]
        currentIndex.value = targetShuffleIndex
        play(playlist.value[songIndex], targetShuffleIndex)
      }
    } else {
      const targetIndex = currentIndex.value + queueIndex
      if (targetIndex >= 0 && targetIndex < playlist.value.length) {
        currentIndex.value = targetIndex
        play(playlist.value[targetIndex], targetIndex)
      }
    }
  }

  const removeFromQueue = (queueIndex: number) => {
    if (queueIndex === 0) return
    const targetIndex = currentIndex.value + queueIndex
    if (targetIndex > currentIndex.value && targetIndex < playlist.value.length) {
      playlist.value.splice(targetIndex, 1)
      if (playMode.value === 'random') {
        shuffledIndices.value = shuffledIndices.value.filter(i => i !== targetIndex)
      }
    }
  }

  const addNext = (songs: any | any[]) => {
    const songsToAdd = Array.isArray(songs) ? songs : [songs]
    const insertIndex = currentIndex.value + 1
    playlist.value.splice(insertIndex, 0, ...songsToAdd)
    if (playMode.value === 'random') {
      shuffledIndices.value.splice(insertIndex, 0, ...songsToAdd.map((_, i) => insertIndex + i))
    }
  }

  const addToQueue = (songs: any | any[]) => {
    const songsToAdd = Array.isArray(songs) ? songs : [songs]
    playlist.value.push(...songsToAdd)
  }

  const clearQueue = () => {
    if (currentIndex.value >= 0 && playlist.value.length > 0) {
      playlist.value = [playlist.value[currentIndex.value]]
      currentIndex.value = 0
      shuffledIndices.value = []
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
    if (playlist.value.length === 0) return
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0
      return
    }
    let newIndex: number
    if (currentIndex.value <= 0) {
      newIndex = playlist.value.length - 1
    } else {
      newIndex = currentIndex.value - 1
    }
    const actualIndex = getActualIndex(newIndex)
    const song = playlist.value[actualIndex]
    if (song) {
      currentIndex.value = newIndex
      play(song, newIndex)
    }
  }

  const playNext = () => {
    if (playlist.value.length === 0) return
    if (playMode.value === 'single') {
      if (audio) {
        audio.currentTime = 0
        audio.play()
      }
      return
    }
    let newIndex: number
    if (currentIndex.value >= playlist.value.length - 1) {
      newIndex = 0
      if (playMode.value === 'random') {
        shuffledIndices.value = generateShuffledIndices()
      }
    } else {
      newIndex = currentIndex.value + 1
    }
    const actualIndex = getActualIndex(newIndex)
    const song = playlist.value[actualIndex]
    if (song) {
      currentIndex.value = newIndex
      play(song, newIndex)
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
    playMode,
    playModeIcon,
    shuffledIndices,
    queue,
    queueCount,
    showQueue,
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
    togglePlayMode,
    addToQueue,
    addNext,
    removeFromQueue,
    clearQueue,
    playFromQueue,
    getAudio: () => audio,
  }
})