<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMusicStore } from '@/stores/music'
import { usePlayerStore } from '@/stores/player'
import SongCard from '@/components/SongCard.vue'

const musicStore = useMusicStore()
const playerStore = usePlayerStore()

// Random shuffle seed - changes each time the view mounts
const shuffleSeed = ref(Date.now())

// Fisher-Yates shuffle with seed
const shuffleArray = (array: any[], seed: number) => {
  const shuffled = [...array]
  let m = shuffled.length
  
  // Simple seeded random
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed / 0x7fffffff
  }
  
  while (m > 0) {
    m--
    const i = Math.floor(random() * m)
    // Swap
    const temp = shuffled[m]
    shuffled[m] = shuffled[i]
    shuffled[i] = temp
  }
  
  return shuffled
}

// Randomly shuffled songs for display
const randomSongs = computed(() => {
  if (musicStore.songs.length === 0) return []
  return shuffleArray(musicStore.songs, shuffleSeed.value).slice(0, 12)
})

// Refresh random songs
const refreshRandom = () => {
  shuffleSeed.value = Date.now()
}

onMounted(() => {
  musicStore.loadLibrary()
})

const playSong = (song: any) => {
  const allSongs = musicStore.songs
  
  // Debug logging
  console.log('[HomeView] Attempting to play song:', {
    clickedSongId: song.id,
    clickedSongTitle: song.title,
    clickedSongFilePath: song.filePath,
    totalSongsInLibrary: allSongs.length
  })
  
  const index = allSongs.findIndex(s => s.id === song.id)
  
  console.log('[HomeView] Found song at index:', index, {
    songAtIndex: index >= 0 ? allSongs[index] : null,
    songsAtIndexMinus1: index > 0 ? allSongs[index - 1] : null,
    songsAtIndexPlus1: index < allSongs.length - 1 ? allSongs[index + 1] : null
  })
  
  if (index === -1) {
    console.error('[HomeView] Song not found in allSongs!', song)
    return
  }
  
  playerStore.setPlaylist(allSongs, index)
  
  console.log('[HomeView] setPlaylist called with index:', index)
}
</script>

<template>
  <div class="home-view">
    <section class="hero-section">
      <h1 class="animate-fade-in-up">Melody Player</h1>
      <p class="animate-fade-in-up delay-100">你的本地音乐，全新体验</p>
    </section>

    <section class="recent-section" v-if="musicStore.songs.length > 0">
      <div class="section-header">
        <h2 class="animate-fade-in-up delay-200">随机推荐</h2>
        <button class="refresh-btn animate-fade-in-up delay-200" @click="refreshRandom" title="换一批">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
          </svg>
        </button>
      </div>
      <div class="song-grid">
        <TransitionGroup name="card-list">
          <SongCard
            v-for="(song, index) in randomSongs"
            :key="song.id"
            :song="song"
            :style="{ animationDelay: `${0.25 + index * 0.05}s` }"
            class="stagger-item"
            @click="playSong(song)"
          />
        </TransitionGroup>
      </div>
    </section>

    <section class="empty-section" v-else>
      <p class="animate-fade-in-up">还没有音乐？</p>
      <router-link to="/settings" class="add-link animate-fade-in-up delay-200">添加音乐文件夹</router-link>
    </section>
  </div>
</template>

<style scoped>
.home-view {
  max-width: 1200px;
  margin: 0 auto;
}

.hero-section {
  text-align: center;
  padding: 60px 0;
}

.hero-section h1 {
  font-size: 48px;
  font-weight: 700;
  margin-bottom: 16px;
  background: linear-gradient(135deg, var(--accent), #ff8a80);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  opacity: 0;
}

.hero-section p {
  font-size: 18px;
  color: var(--text-secondary);
  opacity: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.section-header h2 {
  font-size: 24px;
  font-weight: 600;
  opacity: 0;
}

.refresh-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: var(--text-secondary);
  opacity: 0;
  transition: all 0.2s ease;
}

.refresh-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  color: var(--accent);
  transform: rotate(180deg);
}

.song-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 20px;
}

.card-list-enter-active,
.card-list-leave-active {
  transition: all 0.4s ease;
}

.card-list-enter-from,
.card-list-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

.card-list-move {
  transition: transform 0.4s ease;
}

.empty-section {
  text-align: center;
  padding: 60px 0;
}

.empty-section p {
  color: var(--text-secondary);
  margin-bottom: 16px;
  opacity: 0;
}

.add-link {
  display: inline-block;
  padding: 12px 24px;
  background: var(--accent);
  border-radius: 8px;
  font-weight: 500;
  opacity: 0;
  transition: all 0.2s ease;
}

.add-link:hover {
  background: var(--accent-hover);
  transform: translateY(-2px);
  box-shadow: 0 8px 16px rgba(233, 69, 96, 0.3);
}
</style>