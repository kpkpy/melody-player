<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMusicStore } from '@/stores/music'
import { usePlayerStore } from '@/stores/player'

const musicStore = useMusicStore()
const playerStore = usePlayerStore()

const searchQuery = ref('')
const viewMode = ref<'songs' | 'albums' | 'artists'>('songs')

const sortField = ref<'title' | 'artist' | 'album' | 'duration'>('title')
const sortOrder = ref<'asc' | 'desc'>('asc')
const pageSize = ref(50)
const currentPage = ref(1)

const resetPage = () => {
  currentPage.value = 1
}

const toggleSort = (field: 'title' | 'artist' | 'album' | 'duration') => {
  if (sortField.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortOrder.value = 'asc'
  }
  currentPage.value = 1
}

const filteredAndSortedSongs = computed(() => {
  let songs = musicStore.songs
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase()
    songs = songs.filter(
      song =>
        song.title.toLowerCase().includes(query) ||
        song.artist.toLowerCase().includes(query) ||
        song.album.toLowerCase().includes(query)
    )
  }
  
  const sorted = [...songs].sort((a, b) => {
    let aVal = a[sortField.value]
    let bVal = b[sortField.value]
    
    if (typeof aVal === 'string') aVal = aVal.toLowerCase()
    if (typeof bVal === 'string') bVal = bVal.toLowerCase()
    
    if (aVal < bVal) return sortOrder.value === 'asc' ? -1 : 1
    if (aVal > bVal) return sortOrder.value === 'asc' ? 1 : -1
    return 0
  })
  
  return sorted
})

const totalPages = computed(() => {
  return Math.ceil(filteredAndSortedSongs.value.length / pageSize.value)
})

const paginatedSongs = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  const end = start + pageSize.value
  return filteredAndSortedSongs.value.slice(start, end)
})

const goToPage = (page: number) => {
  currentPage.value = Math.max(1, Math.min(page, totalPages.value))
}

const playSong = (song: any) => {
  const index = filteredAndSortedSongs.value.findIndex(s => s.id === song.id)
  playerStore.setPlaylist(filteredAndSortedSongs.value, index >= 0 ? index : 0)
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
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
          @input="resetPage"
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
        <span class="col-title sortable" @click="toggleSort('title')">
          标题
          <span v-if="sortField === 'title'" class="sort-icon">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
        </span>
        <span class="col-artist sortable" @click="toggleSort('artist')">
          艺术家
          <span v-if="sortField === 'artist'" class="sort-icon">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
        </span>
        <span class="col-album sortable" @click="toggleSort('album')">
          专辑
          <span v-if="sortField === 'album'" class="sort-icon">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
        </span>
        <span class="col-duration sortable" @click="toggleSort('duration')">
          时长
          <span v-if="sortField === 'duration'" class="sort-icon">{{ sortOrder === 'asc' ? '↑' : '↓' }}</span>
        </span>
      </div>
      <div
        v-for="song in paginatedSongs"
        :key="song.id"
        class="song-row"
        @dblclick="playSong(song)"
      >
        <span class="col-title">{{ song.title }}</span>
        <span class="col-artist">{{ song.artist }}</span>
        <span class="col-album">{{ song.album }}</span>
        <span class="col-duration">{{ formatTime(song.duration) }}</span>
      </div>
      <div class="pagination" v-if="totalPages > 1">
        <button class="page-btn" :disabled="currentPage === 1" @click="goToPage(currentPage - 1)">上一页</button>
        <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
        <button class="page-btn" :disabled="currentPage === totalPages" @click="goToPage(currentPage + 1)">下一页</button>
        <span class="total-info">共 {{ filteredAndSortedSongs.length }} 首</span>
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

.list-header .sortable {
  cursor: pointer;
  user-select: none;
  transition: color 0.15s;
}

.list-header .sortable:hover {
  color: var(--text-primary);
}

.sort-icon {
  margin-left: 4px;
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

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px;
  border-top: 1px solid var(--border);
}

.page-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  font-size: 13px;
  transition: all 0.15s;
}

.page-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 14px;
  color: var(--text-secondary);
}

.total-info {
  font-size: 13px;
  color: var(--text-secondary);
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