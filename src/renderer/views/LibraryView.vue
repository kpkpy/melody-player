<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMusicStore } from '@/stores/music'
import { usePlayerStore } from '@/stores/player'

const musicStore = useMusicStore()
const playerStore = usePlayerStore()

const searchQuery = ref('')
const viewMode = ref<'songs' | 'albums' | 'artists'>('songs')

const filteredSongs = computed(() => {
  if (!searchQuery.value) return musicStore.songs
  const query = searchQuery.value.toLowerCase()
  return musicStore.songs.filter(
    song =>
      song.title.toLowerCase().includes(query) ||
      song.artist.toLowerCase().includes(query) ||
      song.album.toLowerCase().includes(query)
  )
})

const playSong = (song: any) => {
    const index = filteredSongs.value.findIndex(s => s.id === song.id)
    playerStore.setPlaylist(filteredSongs.value, index >= 0 ? index : 0)
  }
</script>

<template>
  <div class="library-view">
    <header class="library-header">
      <h1>音乐库</h1>
      <div class="controls">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索歌曲、艺术家、专辑..."
          class="search-input"
        />
        <div class="view-tabs">
          <button
            :class="['tab', { active: viewMode === 'songs' }]"
            @click="viewMode = 'songs'"
          >
            歌曲
          </button>
          <button
            :class="['tab', { active: viewMode === 'albums' }]"
            @click="viewMode = 'albums'"
          >
            专辑
          </button>
          <button
            :class="['tab', { active: viewMode === 'artists' }]"
            @click="viewMode = 'artists'"
          >
            艺术家
          </button>
        </div>
      </div>
    </header>

    <div class="song-list" v-if="viewMode === 'songs'">
      <div class="list-header">
        <span class="col-title">标题</span>
        <span class="col-artist">艺术家</span>
        <span class="col-album">专辑</span>
        <span class="col-duration">时长</span>
      </div>
      <div
        v-for="song in filteredSongs"
        :key="song.id"
        class="song-row"
        @dblclick="playSong(song)"
      >
        <span class="col-title">{{ song.title }}</span>
        <span class="col-artist">{{ song.artist }}</span>
        <span class="col-album">{{ song.album }}</span>
        <span class="col-duration">{{ Math.floor(song.duration / 60) }}:{{ String(song.duration % 60).padStart(2, '0') }}</span>
      </div>
    </div>

    <div class="album-grid" v-else-if="viewMode === 'albums'">
      <div v-for="album in musicStore.albums" :key="album.id" class="album-card">
        <div class="album-cover" :style="{ backgroundImage: album.cover ? `url(${album.cover})` : 'none' }">
          <div v-if="!album.cover" class="cover-placeholder">♪</div>
        </div>
        <div class="album-name">{{ album.name }}</div>
        <div class="album-artist">{{ album.artist }}</div>
      </div>
    </div>

    <div class="artist-grid" v-else-if="viewMode === 'artists'">
      <div v-for="artist in musicStore.artists" :key="artist.id" class="artist-card">
        <div class="artist-avatar">{{ artist.name.charAt(0) }}</div>
        <div class="artist-name">{{ artist.name }}</div>
        <div class="artist-count">{{ artist.songs.length }} 首歌曲</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.library-view {
  max-width: 1200px;
  margin: 0 auto;
}

.library-header {
  margin-bottom: 30px;
}

.library-header h1 {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 20px;
}

.controls {
  display: flex;
  gap: 20px;
  align-items: center;
}

.search-input {
  flex: 1;
  max-width: 400px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 14px;
}

.search-input:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.15);
}

.view-tabs {
  display: flex;
  gap: 4px;
  background: rgba(255, 255, 255, 0.05);
  padding: 4px;
  border-radius: 8px;
}

.tab {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.tab:hover {
  color: var(--text-primary);
}

.tab.active {
  background: var(--accent);
  color: white;
}

.song-list {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  overflow: hidden;
}

.list-header {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 80px;
  padding: 12px 16px;
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  border-bottom: 1px solid var(--border);
}

.song-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 80px;
  padding: 12px 16px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.song-row:hover {
  background: rgba(255, 255, 255, 0.05);
}

.col-artist,
.col-album {
  color: var(--text-secondary);
}

.col-duration {
  color: var(--text-secondary);
  text-align: right;
}

.album-grid,
.artist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 24px;
}

.album-card,
.artist-card {
  cursor: pointer;
}

.album-cover,
.artist-avatar {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  background: var(--bg-secondary);
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.artist-avatar {
  border-radius: 50%;
  font-size: 32px;
  font-weight: 600;
}

.album-name,
.artist-name {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.album-artist,
.artist-count {
  font-size: 12px;
  color: var(--text-secondary);
}
</style>