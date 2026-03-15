<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useMusicStore } from '@/stores/music'
import { usePlayerStore } from '@/stores/player'

const musicStore = useMusicStore()
const playerStore = usePlayerStore()

const searchQuery = ref('')
const viewMode = ref<'songs' | 'albums' | 'artists'>('songs')

const sortField = ref<'title' | 'artist' | 'album' | 'duration'>('title')
const sortOrder = ref<'asc' | 'desc'>('asc')
const pageSize = 50
const songPage = ref(1)
const albumPage = ref(1)
const artistPage = ref(1)

const loadedCovers = ref<Set<string>>(new Set())
let coverObserver: IntersectionObserver | null = null

onMounted(() => {
  coverObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('data-cover-id')
          if (id && !loadedCovers.value.has(id)) {
            loadedCovers.value = new Set(loadedCovers.value).add(id)
            coverObserver?.unobserve(entry.target)
          }
        }
      })
    },
    { rootMargin: '100px' }
  )
})

onUnmounted(() => {
  coverObserver?.disconnect()
})

const observeCover = (el: any, id: string) => {
  if (el && coverObserver && !loadedCovers.value.has(id)) {
    el.setAttribute('data-cover-id', id)
    coverObserver.observe(el)
  }
}

const isCoverLoaded = (id: string) => loadedCovers.value.has(id)

watch([searchQuery, viewMode], () => {
  songPage.value = 1
  albumPage.value = 1
  artistPage.value = 1
  loadedCovers.value.clear()
})

const toggleSort = (field: 'title' | 'artist' | 'album' | 'duration') => {
  if (sortField.value === field) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortOrder.value = 'asc'
  }
  songPage.value = 1
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

const songTotalPages = computed(() => Math.ceil(filteredAndSortedSongs.value.length / pageSize))
const paginatedSongs = computed(() => {
  const start = (songPage.value - 1) * pageSize
  return filteredAndSortedSongs.value.slice(start, start + pageSize)
})

const filteredAlbums = computed(() => {
  if (!searchQuery.value) return musicStore.albums
  const query = searchQuery.value.toLowerCase()
  return musicStore.albums.filter(
    album => album.name.toLowerCase().includes(query) || album.artist.toLowerCase().includes(query)
  )
})

const albumTotalPages = computed(() => Math.ceil(filteredAlbums.value.length / pageSize))
const paginatedAlbums = computed(() => {
  const start = (albumPage.value - 1) * pageSize
  return filteredAlbums.value.slice(start, start + pageSize)
})

const filteredArtists = computed(() => {
  if (!searchQuery.value) return musicStore.artists
  const query = searchQuery.value.toLowerCase()
  return musicStore.artists.filter(artist => artist.name.toLowerCase().includes(query))
})

const artistTotalPages = computed(() => Math.ceil(filteredArtists.value.length / pageSize))
const paginatedArtists = computed(() => {
  const start = (artistPage.value - 1) * pageSize
  return filteredArtists.value.slice(start, start + pageSize)
})

const playSong = (song: any) => {
  const index = filteredAndSortedSongs.value.findIndex(s => s.id === song.id)
  playerStore.setPlaylist(filteredAndSortedSongs.value, index >= 0 ? index : 0)
}

const playAll = () => {
  playerStore.setPlaylist(filteredAndSortedSongs.value, 0)
}

const addAllToQueue = () => {
  playerStore.addToQueue(filteredAndSortedSongs.value)
}

const formatTime = (seconds: number) => {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

const getSongsByIds = (ids: string[]) => {
  return ids
    .map(id => musicStore.songs.find(s => s.id === id))
    .filter(Boolean)
}

const playAlbum = (album: any) => {
  const songs = getSongsByIds(album.songIds)
  if (songs.length > 0) playerStore.setPlaylist(songs, 0)
}

const addAlbumToQueue = (album: any) => {
  const songs = getSongsByIds(album.songIds)
  playerStore.addToQueue(songs)
}

const playArtist = (artist: any) => {
  const songs = getSongsByIds(artist.songIds)
  if (songs.length > 0) playerStore.setPlaylist(songs, 0)
}

const addArtistToQueue = (artist: any) => {
  const songs = getSongsByIds(artist.songIds)
  playerStore.addToQueue(songs)
}

const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  song: null as any
})

const showContextMenu = (e: MouseEvent, song: any) => {
  e.preventDefault()
  contextMenu.value = {
    show: true,
    x: e.clientX,
    y: e.clientY,
    song
  }
}

const hideContextMenu = () => {
  contextMenu.value.show = false
}

const playSongNow = () => {
  if (contextMenu.value.song) {
    playSong(contextMenu.value.song)
  }
  hideContextMenu()
}

const addSongToQueue = () => {
  if (contextMenu.value.song) {
    playerStore.addToQueue(contextMenu.value.song)
  }
  hideContextMenu()
}

const playSongNext = () => {
  if (contextMenu.value.song) {
    playerStore.addNext(contextMenu.value.song)
  }
  hideContextMenu()
}

const goToAlbum = () => {
  if (contextMenu.value.song) {
    const album = musicStore.albums.find(a => a.name === contextMenu.value.song.album && a.artist === contextMenu.value.song.artist)
    if (album) {
      playAlbum(album)
    }
  }
  hideContextMenu()
}

const goToArtist = () => {
  if (contextMenu.value.song) {
    const artist = musicStore.artists.find(a => a.name === contextMenu.value.song.artist)
    if (artist) {
      playArtist(artist)
    }
  }
  hideContextMenu()
}

const hoveredSongId = ref<string | null>(null)
</script>

<template>
  <div class="library-view">
    <header class="library-header">
      <h1 class="animate-fade-in-up">音乐库</h1>
      <div class="controls animate-fade-in-up delay-100">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="搜索歌曲、艺术家、专辑..."
          class="search-input"
        />
        <div class="action-buttons">
          <button class="action-btn primary" @click="playAll" :disabled="filteredAndSortedSongs.length === 0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
            播放全部
          </button>
          <button class="action-btn" @click="addAllToQueue" :disabled="filteredAndSortedSongs.length === 0">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            添加到队列
          </button>
        </div>
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

    <Transition name="fade" mode="out-in">
      <div key="songs" class="song-list animate-fade-in-up delay-200" v-if="viewMode === 'songs'">
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
        <TransitionGroup name="song-list" tag="div">
          <div
            v-for="song in paginatedSongs"
            :key="song.id"
            :class="['song-row', { hovered: hoveredSongId === song.id }]"
            @dblclick="playSong(song)"
            @contextmenu="showContextMenu($event, song)"
            @mouseenter="hoveredSongId = song.id"
            @mouseleave="hoveredSongId = null"
          >
            <span class="col-title">
              <span class="song-title-text">{{ song.title }}</span>
              <div class="song-actions">
                <button class="song-action-btn" @click.stop="playSong(song)" title="播放">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z"/>
                  </svg>
                </button>
                <button class="song-action-btn" @click.stop="playerStore.addToQueue(song)" title="添加到队列">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                  </svg>
                </button>
              </div>
            </span>
            <span class="col-artist">{{ song.artist }}</span>
            <span class="col-album">{{ song.album }}</span>
            <span class="col-duration">{{ formatTime(song.duration) }}</span>
          </div>
        </TransitionGroup>
        <div class="pagination" v-if="songTotalPages > 1">
          <button class="page-btn" :disabled="songPage === 1" @click="songPage--">上一页</button>
          <span class="page-info">{{ songPage }} / {{ songTotalPages }}</span>
          <button class="page-btn" :disabled="songPage === songTotalPages" @click="songPage++">下一页</button>
          <span class="total-info">共 {{ filteredAndSortedSongs.length }} 首</span>
        </div>
      </div>

      <div key="albums" class="album-section animate-fade-in-up delay-200" v-else-if="viewMode === 'albums'">
        <div class="album-grid">
          <div 
            v-for="album in paginatedAlbums" 
            :key="album.id" 
            class="album-card card-hover"
            @click="playAlbum(album)"
          >
          <div 
            class="album-cover" 
            :ref="el => album.cover && observeCover(el, album.id)"
            :style="{ backgroundImage: isCoverLoaded(album.id) && album.cover ? `url(${album.cover})` : 'none' }"
          >
            <div v-if="!album.cover" class="cover-placeholder">♪</div>
            <div class="card-overlay">
              <button class="overlay-btn" @click.stop="playAlbum(album)">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </button>
              <button class="overlay-btn small" @click.stop="addAlbumToQueue(album)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="album-name">{{ album.name }}</div>
          <div class="album-artist">{{ album.artist }}</div>
          <div class="album-count">{{ album.songCount }} 首</div>
        </div>
        </div>
        <div class="empty-state" v-if="filteredAlbums.length === 0">
          <p>没有找到专辑</p>
        </div>
        <div class="pagination" v-if="albumTotalPages > 1">
          <button class="page-btn" :disabled="albumPage === 1" @click="albumPage--">上一页</button>
          <span class="page-info">{{ albumPage }} / {{ albumTotalPages }}</span>
          <button class="page-btn" :disabled="albumPage === albumTotalPages" @click="albumPage++">下一页</button>
          <span class="total-info">共 {{ filteredAlbums.length }} 张专辑</span>
        </div>
      </div>

      <div key="artists" class="artist-section animate-fade-in-up delay-200" v-else-if="viewMode === 'artists'">
        <div class="artist-grid">
          <div 
            v-for="artist in paginatedArtists" 
            :key="artist.id" 
            class="artist-card card-hover"
            @click="playArtist(artist)"
          >
          <div class="artist-avatar">{{ artist.name.charAt(0) }}</div>
          <div class="artist-name">{{ artist.name }}</div>
          <div class="artist-count">{{ artist.songCount }} 首歌曲</div>
          <div class="artist-actions">
            <button class="action-icon" @click.stop="playArtist(artist)" title="播放全部">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z"/>
              </svg>
            </button>
            <button class="action-icon" @click.stop="addArtistToQueue(artist)" title="添加到队列">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
            </button>
          </div>
        </div>
        </div>
        <div class="empty-state" v-if="filteredArtists.length === 0">
          <p>没有找到艺术家</p>
        </div>
        <div class="pagination" v-if="artistTotalPages > 1">
          <button class="page-btn" :disabled="artistPage === 1" @click="artistPage--">上一页</button>
          <span class="page-info">{{ artistPage }} / {{ artistTotalPages }}</span>
          <button class="page-btn" :disabled="artistPage === artistTotalPages" @click="artistPage++">下一页</button>
          <span class="total-info">共 {{ filteredArtists.length }} 位艺术家</span>
        </div>
      </div>
    </Transition>

    <Teleport to="body">
      <div 
        v-if="contextMenu.show" 
        class="context-menu-overlay" 
        @click="hideContextMenu"
        @contextmenu.prevent
      >
        <div 
          class="context-menu" 
          :style="{ left: `${contextMenu.x}px`, top: `${contextMenu.y}px` }"
          @click.stop
        >
          <button class="context-menu-item" @click="playSongNow">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
            播放
          </button>
          <button class="context-menu-item" @click="playSongNext">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
            </svg>
            下一首播放
          </button>
          <button class="context-menu-item" @click="addSongToQueue">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            添加到队列
          </button>
          <div class="context-menu-divider"></div>
          <button class="context-menu-item" @click="goToAlbum">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 14.5c-2.49 0-4.5-2.01-4.5-4.5S9.51 7.5 12 7.5s4.5 2.01 4.5 4.5-2.01 4.5-4.5 4.5zm0-5.5c-.55 0-1 .45-1 1s.45 1 1 1 1-.45 1-1-.45-1-1-1z"/>
            </svg>
            转到专辑
          </button>
          <button class="context-menu-item" @click="goToArtist">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
            转到艺术家
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.library-view {
  max-width: 1200px;
  margin: 0 auto;
  user-select: none;
}

.library-header {
  margin-bottom: 30px;
}

.library-header h1 {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 20px;
  opacity: 0;
}

.controls {
  display: flex;
  gap: 20px;
  align-items: center;
  opacity: 0;
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

.action-buttons {
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
  user-select: none;
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
  transition: all 0.2s ease;
  position: relative;
  user-select: none;
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

.song-row span {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  position: relative;
  z-index: 1;
}

.col-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.song-title-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s ease;
  flex-shrink: 0;
}

.song-row:hover .song-actions,
.song-row.hovered .song-actions {
  opacity: 1;
}

.song-action-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.1);
  transition: all 0.15s ease;
}

.song-action-btn:hover {
  color: var(--accent);
  background: rgba(233, 69, 96, 0.15);
  transform: scale(1.1);
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

.album-section,
.artist-section {
  opacity: 0;
  user-select: none;
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
  position: relative;
  transition: transform 0.2s ease;
}

.album-card:hover,
.artist-card:hover {
  transform: translateY(-4px);
}

.album-cover,
.artist-avatar {
  position: relative;
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
  overflow: hidden;
}

.artist-avatar {
  border-radius: 50%;
  font-size: 32px;
  font-weight: 600;
}

.card-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.album-card:hover .card-overlay,
.artist-card:hover .card-overlay {
  opacity: 1;
}

.overlay-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.15s ease;
}

.overlay-btn:hover {
  transform: scale(1.1);
}

.overlay-btn.small {
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.2);
}

.overlay-btn.small:hover {
  background: rgba(255, 255, 255, 0.3);
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.album-count {
  font-size: 11px;
  color: var(--text-secondary);
  opacity: 0.7;
}

.artist-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.artist-card:hover .artist-actions {
  opacity: 1;
}

.action-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
}

.action-icon:hover {
  background: var(--accent);
  color: white;
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}

/* 歌曲列表动画 */
.song-list-enter-active,
.song-list-leave-active {
  transition: all 0.3s ease;
}

.song-list-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.song-list-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

/* 卡片网格动画 */
.card-grid-enter-active,
.card-grid-leave-active {
  transition: all 0.4s ease;
}

.card-grid-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.card-grid-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.card-grid-move {
  transition: transform 0.4s ease;
}

/* 右键菜单 */
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

.context-menu-divider {
  height: 1px;
  background: var(--border);
  margin: 6px 0;
}
</style>