<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { usePlaylistStore } from '@/stores/playlist'
import { useMusicStore } from '@/stores/music'
import { usePlayerStore } from '@/stores/player'

const route = useRoute()
const playlistStore = usePlaylistStore()
const musicStore = useMusicStore()
const playerStore = usePlayerStore()

const playlist = ref<any>(null)
const songs = ref<any[]>([])

onMounted(async () => {
  await playlistStore.loadPlaylists()
  loadPlaylist()
})

const loadPlaylist = () => {
  const id = route.params.id as string
  playlist.value = playlistStore.playlists.find(p => p.id === id)
  if (playlist.value) {
    songs.value = playlist.value.songIds
      .map(id => musicStore.songs.find(s => s.id === id))
      .filter(Boolean)
  }
}

const playSong = (song: any) => {
  playerStore.play(song)
}

const removeSong = async (songId: string) => {
  await playlistStore.removeSong(playlist.value.id, songId)
  loadPlaylist()
}
</script>

<template>
  <div class="playlist-view" v-if="playlist">
    <header class="playlist-header">
      <div class="playlist-cover">
        <div class="cover-placeholder">♪</div>
      </div>
      <div class="playlist-info">
        <h1>{{ playlist.name }}</h1>
        <p>{{ songs.length }} 首歌曲</p>
      </div>
    </header>

    <div class="song-list">
      <div
        v-for="(song, index) in songs"
        :key="song.id"
        class="song-row"
        @dblclick="playSong(song)"
      >
        <span class="song-index">{{ index + 1 }}</span>
        <span class="song-title">{{ song.title }}</span>
        <span class="song-artist">{{ song.artist }}</span>
        <span class="song-duration">{{ Math.floor(song.duration / 60) }}:{{ String(song.duration % 60).padStart(2, '0') }}</span>
        <button class="remove-btn" @click="removeSong(song.id)">×</button>
      </div>
    </div>

    <div class="empty" v-if="songs.length === 0">
      <p>歌单是空的，去音乐库添加歌曲吧</p>
      <router-link to="/library">浏览音乐库</router-link>
    </div>
  </div>
</template>

<style scoped>
.playlist-view {
  max-width: 1000px;
  margin: 0 auto;
}

.playlist-header {
  display: flex;
  gap: 30px;
  margin-bottom: 40px;
}

.playlist-cover {
  width: 200px;
  height: 200px;
  border-radius: 12px;
  background: linear-gradient(135deg, var(--accent), #667eea);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-placeholder {
  font-size: 64px;
  color: white;
}

.playlist-info {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.playlist-info h1 {
  font-size: 36px;
  font-weight: 700;
  margin-bottom: 8px;
}

.playlist-info p {
  color: var(--text-secondary);
}

.song-list {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  overflow: hidden;
}

.song-row {
  display: grid;
  grid-template-columns: 40px 1fr 1fr 60px 40px;
  gap: 10px;
  padding: 12px 16px;
  align-items: center;
  cursor: pointer;
  transition: background 0.15s;
}

.song-row:hover {
  background: rgba(255, 255, 255, 0.05);
}

.song-index {
  color: var(--text-secondary);
  font-size: 14px;
}

.song-title {
  font-size: 14px;
}

.song-artist {
  color: var(--text-secondary);
  font-size: 14px;
}

.song-duration {
  color: var(--text-secondary);
  font-size: 13px;
}

.remove-btn {
  opacity: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 18px;
  color: var(--text-secondary);
  transition: all 0.15s;
}

.song-row:hover .remove-btn {
  opacity: 1;
}

.remove-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--accent);
}

.empty {
  text-align: center;
  padding: 60px 0;
  color: var(--text-secondary);
}

.empty a {
  display: inline-block;
  margin-top: 16px;
  padding: 10px 20px;
  background: var(--accent);
  border-radius: 8px;
  color: white;
}
</style>