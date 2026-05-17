<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
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
const currentPage = ref(1)
const pageSize = 50
const hoveredSongId = ref<string | null>(null)

const totalPages = computed(() => Math.ceil(songs.value.length / pageSize))
const paginatedSongs = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return songs.value.slice(start, start + pageSize)
})

onMounted(async () => {
  await playlistStore.loadPlaylists()
  loadPlaylist()
})

watch(() => route.params.id, () => {
  loadPlaylist()
  currentPage.value = 1
})

const loadPlaylist = () => {
  const id = route.params.id as string
  playlist.value = playlistStore.playlists.find(p => p.id === id)
  if (playlist.value) {
    songs.value = playlist.value.songIds
      .map((id: string) => musicStore.songs.find(s => s.id === id))
      .filter(Boolean)
  }
}

const playSong = (song: any) => {
  const index = songs.value.findIndex(s => s.id === song.id)
  playerStore.setPlaylist(songs.value, index >= 0 ? index : 0)
}

const playAll = () => {
  if (songs.value.length > 0) {
    playerStore.setPlaylist(songs.value, 0)
  }
}

const addToQueue = () => {
  playerStore.addToQueue(songs.value)
}

const removeSong = async (songId: string) => {
  await playlistStore.removeSong(playlist.value.id, songId)
  loadPlaylist()
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  song: null as any
})

const showContextMenu = (e: MouseEvent, song: any) => {
  e.preventDefault()
  contextMenu.value = { show: true, x: e.clientX, y: e.clientY, song }
}

const hideContextMenu = () => {
  contextMenu.value.show = false
}

const playSelected = () => {
  if (contextMenu.value.song) playSong(contextMenu.value.song)
  hideContextMenu()
}

const addSelectedToQueue = () => {
  if (contextMenu.value.song) playerStore.addToQueue(contextMenu.value.song)
  hideContextMenu()
}

const playSelectedNext = () => {
  if (contextMenu.value.song) playerStore.addNext(contextMenu.value.song)
  hideContextMenu()
}

const removeSelected = async () => {
  if (contextMenu.value.song) {
    await removeSong(contextMenu.value.song.id)
  }
  hideContextMenu()
}
</script>

<template>
  <div class="playlist-view" v-if="playlist">
    <header class="playlist-header animate-fade-in-up">
      <div class="playlist-cover">
        <div class="cover-placeholder">♪</div>
      </div>
      <div class="playlist-info">
        <h1>{{ playlist.name }}</h1>
        <p>{{ songs.length }} 首歌曲</p>
        <div class="playlist-actions">
          <button class="action-btn primary" @click="playAll" :disabled="songs.length === 0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
            播放全部
          </button>
          <button class="action-btn" @click="addToQueue" :disabled="songs.length === 0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            添加到队列
          </button>
        </div>
      </div>
    </header>

    <div class="song-list animate-fade-in-up delay-100">
      <div
        v-for="(song, index) in paginatedSongs"
        :key="song.id"
        :class="['song-row', { hovered: hoveredSongId === song.id }]"
        @dblclick="playSong(song)"
        @contextmenu="showContextMenu($event, song)"
        @mouseenter="hoveredSongId = song.id"
        @mouseleave="hoveredSongId = null"
      >
        <span class="song-index">{{ (currentPage - 1) * pageSize + index + 1 }}</span>
        <span class="song-title">{{ song.title }}</span>
        <span class="song-artist">{{ song.artist }}</span>
        <span class="song-duration">{{ formatTime(song.duration) }}</span>
        <button class="remove-btn" @click="removeSong(song.id)">×</button>
      </div>

      <div class="pagination" v-if="totalPages > 1">
        <button class="page-btn" :disabled="currentPage === 1" @click="currentPage--">上一页</button>
        <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
        <button class="page-btn" :disabled="currentPage === totalPages" @click="currentPage++">下一页</button>
        <span class="total-info">共 {{ songs.length }} 首</span>
      </div>
    </div>

    <div class="empty animate-fade-in-up" v-if="songs.length === 0">
      <p>歌单是空的，去音乐库添加歌曲吧</p>
      <router-link to="/library">浏览音乐库</router-link>
    </div>

    <Teleport to="body">
      <div v-if="contextMenu.show" class="context-menu-overlay" @click="hideContextMenu" @contextmenu.prevent>
        <div class="context-menu" :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }" @click.stop>
          <button class="context-menu-item" @click="playSelected">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            播放
          </button>
          <button class="context-menu-item" @click="playSelectedNext">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            下一首播放
          </button>
          <button class="context-menu-item" @click="addSelectedToQueue">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            添加到队列
          </button>
          <div class="context-menu-divider"></div>
          <button class="context-menu-item danger" @click="removeSelected">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
            从歌单移除
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.playlist-view {
  max-width: 1000px;
  margin: 0 auto;
  user-select: none;
}

.playlist-header {
  display: flex;
  gap: 30px;
  margin-bottom: 40px;
  opacity: 0;
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
  margin-bottom: 16px;
}

.playlist-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.1);
  transition: all 0.2s ease;
}

.action-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
  color: var(--text-primary);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.action-btn.primary {
  background: var(--accent);
  color: white;
}

.action-btn.primary:hover:not(:disabled) {
  background: var(--accent-hover);
}

.song-list {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  overflow: hidden;
  opacity: 0;
}

.song-row {
  display: grid;
  grid-template-columns: 40px 1fr 1fr 60px 40px;
  gap: 10px;
  padding: 12px 16px;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.song-row::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(100, 100, 100, 0.15) 0%, rgba(80, 80, 80, 0.08) 100%);
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
  border-radius: 4px;
}

.song-row:hover::before,
.song-row.hovered::before {
  opacity: 1;
}

.song-index {
  color: var(--text-secondary);
  font-size: 14px;
  position: relative;
  z-index: 1;
}

.song-title {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  position: relative;
  z-index: 1;
}

.song-artist {
  color: var(--text-secondary);
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  position: relative;
  z-index: 1;
}

.song-duration {
  color: var(--text-secondary);
  font-size: 13px;
  position: relative;
  z-index: 1;
}

.remove-btn {
  opacity: 0;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  font-size: 18px;
  color: var(--text-secondary);
  transition: all 0.15s;
  position: relative;
  z-index: 1;
}

.song-row:hover .remove-btn {
  opacity: 1;
}

.remove-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--accent);
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
  transition: all 0.2s ease;
}

.empty a:hover {
  background: var(--accent-hover);
  transform: translateY(-2px);
}

.context-menu-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
}

.context-menu {
  position: fixed;
  min-width: 160px;
  background: var(--glass);
  backdrop-filter: blur(20px);
  border-radius: 12px;
  border: 1px solid var(--border);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  padding: 6px;
  z-index: 1001;
}

.context-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 12px;
  font-size: 13px;
  color: var(--text-primary);
  border-radius: 8px;
  transition: background 0.15s ease;
  text-align: left;
}

.context-menu-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.context-menu-item svg {
  color: var(--text-secondary);
  flex-shrink: 0;
}

.context-menu-item:hover svg {
  color: var(--accent);
}

.context-menu-item.danger:hover {
  color: #ff4444;
}

.context-menu-item.danger:hover svg {
  color: #ff4444;
}

.context-menu-divider {
  height: 1px;
  background: var(--border);
  margin: 6px 0;
}
</style>