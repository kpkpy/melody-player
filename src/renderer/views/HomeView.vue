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
  playerStore.play(song)
}
</script>

<template>
  <div class="home-view">
    <section class="hero-section">
      <h1>Melody Player</h1>
      <p>你的本地音乐，全新体验</p>
    </section>

    <section class="recent-section" v-if="musicStore.songs.length > 0">
      <h2>最近添加</h2>
      <div class="song-grid">
        <SongCard
          v-for="song in musicStore.songs.slice(0, 12)"
          :key="song.id"
          :song="song"
          @click="playSong(song)"
        />
      </div>
    </section>

    <section class="empty-section" v-else>
      <p>还没有音乐？</p>
      <router-link to="/settings" class="add-link">添加音乐文件夹</router-link>
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
}

.hero-section p {
  font-size: 18px;
  color: var(--text-secondary);
}

.recent-section h2 {
  font-size: 24px;
  font-weight: 600;
  margin-bottom: 20px;
}

.song-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 20px;
}

.empty-section {
  text-align: center;
  padding: 60px 0;
}

.empty-section p {
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.add-link {
  display: inline-block;
  padding: 12px 24px;
  background: var(--accent);
  border-radius: 8px;
  font-weight: 500;
  transition: background 0.15s;
}

.add-link:hover {
  background: var(--accent-hover);
}
</style>