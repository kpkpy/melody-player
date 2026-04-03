<script setup lang="ts">
import { usePlaylistStore } from '@/stores/playlist'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
const playlistStore = usePlaylistStore()

const navItems = [
  { path: '/', icon: '🏠', label: '首页' },
  { path: '/library', icon: '📚', label: '音乐库' },
  { path: '/emotion', icon: '🎭', label: '情绪' },
  { path: '/stats', icon: '📊', label: '统计' },
  { path: '/sync', icon: '🔄', label: '同步' },
  { path: '/settings', icon: '⚙️', label: '设置' },
]

const navigate = (path: string) => {
  router.push(path)
}

const createPlaylist = () => {
  const name = prompt('输入歌单名称')
  if (name) {
    playlistStore.createPlaylist(name)
  }
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
        <button class="add-btn" @click="createPlaylist">+</button>
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
</style>