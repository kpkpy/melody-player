<script setup lang="ts">
import { ref } from 'vue'
import { usePlaylistStore } from '@/stores/playlist'
import { useRouter, useRoute } from 'vue-router'
import NeteasePlaylistImporter from '@/components/NeteasePlaylistImporter.vue'

const router = useRouter()
const route = useRoute()
const playlistStore = usePlaylistStore()
const showImporter = ref(false)
const showCreatePlaylist = ref(false)
const newPlaylistName = ref('')

const navItems = [
  { path: '/', icon: '🏠', label: '首页' },
  { path: '/library', icon: '📚', label: '音乐库' },
  { path: '/emotion', icon: '🎭', label: '情绪' },
  { path: '/stats', icon: '📊', label: '统计' },
  { path: '/sync', icon: '🔄', label: '同步' },
  { path: '/ncm-converter', icon: '🎵', label: 'NCM 转换' },
  { path: '/settings', icon: '⚙️', label: '设置' },
]

const navigate = (path: string) => {
  router.push(path)
}

const createPlaylist = () => {
  showCreatePlaylist.value = true
  newPlaylistName.value = ''
}

const submitCreatePlaylist = async () => {
  if (!newPlaylistName.value.trim()) return
  try {
    await playlistStore.createPlaylist(newPlaylistName.value.trim())
    showCreatePlaylist.value = false
    newPlaylistName.value = ''
  } catch (e: any) {
    console.error('创建歌单失败:', e)
  }
}

const cancelCreatePlaylist = () => {
  showCreatePlaylist.value = false
  newPlaylistName.value = ''
}

const handleImportSuccess = () => {
  playlistStore.loadPlaylists()
  showImporter.value = false
}
</script>

<template>
  <aside class="sidebar">
    <nav class="nav-section">
      <TransitionGroup name="nav-item" tag="div" class="nav-list">
        <button
          v-for="(item, index) in navItems"
          :key="item.path"
          :class="['nav-item', { active: route.path === item.path }]"
          :style="{ animationDelay: `${index * 0.05}s` }"
          @click="navigate(item.path)"
        >
          <span class="nav-icon">{{ item.icon }}</span>
          <span class="nav-label">{{ item.label }}</span>
        </button>
      </TransitionGroup>
    </nav>

    <div class="playlist-section">
      <div class="section-header animate-fade-in-up delay-200">
        <span>歌单</span>
        <div class="header-actions">
          <button class="add-btn" @click="showImporter = true" title="导入网易云歌单">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
            </svg>
          </button>
          <button class="add-btn" @click="createPlaylist" title="新建歌单">+</button>
        </div>
      </div>
      <TransitionGroup name="playlist" tag="div" class="playlist-list">
        <button
          v-for="(playlist, index) in playlistStore.playlists"
          :key="playlist.id"
          :class="['playlist-item', { active: route.params.id === playlist.id }]"
          :style="{ animationDelay: `${0.25 + index * 0.05}s` }"
          @click="navigate(`/playlist/${playlist.id}`)"
        >
          {{ playlist.name }}
        </button>
      </TransitionGroup>
    </div>

    <Teleport to="body">
      <div v-if="showImporter" class="modal-overlay" @click="showImporter = false">
        <div class="modal-content" @click.stop>
          <button class="modal-close" @click="showImporter = false">×</button>
          <NeteasePlaylistImporter @success="handleImportSuccess" />
        </div>
      </div>

      <div v-if="showCreatePlaylist" class="modal-overlay" @click="cancelCreatePlaylist">
        <div class="modal-content create-playlist-modal" @click.stop>
          <h3>新建歌单</h3>
          <input
            v-model="newPlaylistName"
            type="text"
            placeholder="输入歌单名称"
            class="playlist-name-input"
            @keyup.enter="submitCreatePlaylist"
            autofocus
          />
          <div class="modal-actions">
            <button class="action-btn cancel" @click="cancelCreatePlaylist">取消</button>
            <button class="action-btn primary" @click="submitCreatePlaylist" :disabled="!newPlaylistName.trim()">创建</button>
          </div>
        </div>
      </div>
    </Teleport>
  </aside>
</template>

<style scoped>
.sidebar {
  width: 220px;
  background: var(--bg-secondary);
  padding: 20px 12px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
}

.nav-section {
  margin-bottom: 30px;
}

.nav-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-secondary);
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0;
  animation: fadeInLeft 0.3s ease forwards;
}

@keyframes fadeInLeft {
  from {
    opacity: 0;
    transform: translateX(-10px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

.nav-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
  transform: translateX(4px);
}

.nav-item.active {
  background: rgba(233, 69, 96, 0.15);
  color: var(--accent);
}

.nav-icon {
  font-size: 18px;
}

.playlist-section {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 14px;
  margin-bottom: 10px;
  font-size: 12px;
  text-transform: uppercase;
  color: var(--text-secondary);
  opacity: 0;
}

.header-actions {
  display: flex;
  gap: 4px;
}

.add-btn {
  width: 20px;
  height: 20px;
  border-radius: 4px;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.add-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
  transform: rotate(90deg);
}

.playlist-list {
  flex: 1;
  overflow-y: auto;
}

.playlist-item {
  width: 100%;
  padding: 10px 14px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-secondary);
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0;
  animation: fadeInLeft 0.3s ease forwards;
}

.playlist-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-primary);
  transform: translateX(4px);
}

.playlist-item.active {
  background: rgba(233, 69, 96, 0.15);
  color: var(--accent);
}

/* 动画 */
.playlist-enter-active,
.playlist-leave-active {
  transition: all 0.3s ease;
}

.playlist-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.playlist-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

.playlist-move {
  transition: transform 0.3s ease;
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  position: relative;
  background: var(--glass);
  border-radius: 12px;
  border: 1px solid var(--border);
  padding: 24px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  color: var(--text-primary);
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.modal-close:hover {
  background: rgba(255, 255, 255, 0.2);
}

.create-playlist-modal {
  max-width: 400px;
  padding: 24px;
}

.create-playlist-modal h3 {
  margin: 0 0 16px 0;
  color: #fff;
  font-size: 18px;
}

.playlist-name-input {
  width: 100%;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  margin-bottom: 16px;
}

.playlist-name-input:focus {
  outline: none;
  border-color: #4a9eff;
}

.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.action-btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  border: none;
  transition: background 0.2s;
}

.action-btn.cancel {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-secondary);
}

.action-btn.cancel:hover {
  background: rgba(255, 255, 255, 0.2);
}

.action-btn.primary {
  background: #4a9eff;
  color: #fff;
}

.action-btn.primary:hover:not(:disabled) {
  background: #3a8eef;
}

.action-btn.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>