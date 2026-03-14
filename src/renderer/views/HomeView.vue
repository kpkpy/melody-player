<script setup lang="ts">
import { onMounted } from 'vue'
import { useMusicStore } from '@/stores/music'
import { usePlayerStore } from '@/stores/player'
import SongCard from '@/components/SongCard.vue'

const musicStore = useMusicStore()
const playerStore = usePlayerStore()

onMounted(() => {
  musicStore.loadLibrary()
})

const playSong = (song: any) => {
  const allSongs = musicStore.songs
  const index = allSongs.findIndex(s => s.id === song.id)
  playerStore.setPlaylist(allSongs, index >= 0 ? index : 0)
}
</script>

<template>
  <div class="home-view">
    <section class="hero-section">
      <h1 class="animate-fade-in-up">Melody Player</h1>
      <p class="animate-fade-in-up delay-100">你的本地音乐，全新体验</p>
    </section>

    <section class="recent-section" v-if="musicStore.songs.length > 0">
      <h2 class="animate-fade-in-up delay-200">最近添加</h2>
      <div class="song-grid">
        <TransitionGroup name="card-list">
          <SongCard
            v-for="(song, index) in musicStore.songs.slice(0, 12)"
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

.recent-section h2 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 20px;
  opacity: 0;
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