<script setup lang="ts">
import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { formatTime } from '@/utils/format'

const playerStore = usePlayerStore()

const progress = computed(() => {
  if (playerStore.duration === 0) return 0
  return (playerStore.currentTime / playerStore.duration) * 100
})

const seek = (e: MouseEvent) => {
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const percent = (e.clientX - rect.left) / rect.width
  playerStore.seek(percent * playerStore.duration)
}

const setVolume = (e: MouseEvent) => {
  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const percent = (e.clientX - rect.left) / rect.width
  playerStore.setVolume(percent)
}
</script>

<template>
  <div class="player-bar">
    <div class="song-info">
      <div class="cover" :style="{ backgroundImage: playerStore.cover ? `url(${playerStore.cover})` : 'none' }">
        <div v-if="!playerStore.cover" class="cover-placeholder">♪</div>
      </div>
      <div class="details">
        <div class="song-title">{{ playerStore.title || '未播放' }}</div>
        <div class="song-artist">{{ playerStore.artist || '--' }}</div>
      </div>
    </div>

    <div class="player-controls">
      <div class="control-buttons">
        <button class="ctrl-btn" @click="playerStore.previous">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
          </svg>
        </button>
        <button class="ctrl-btn play-btn" @click="playerStore.togglePlay">
          <svg v-if="!playerStore.isPlaying" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          <svg v-else width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        </button>
        <button class="ctrl-btn" @click="playerStore.next">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
          </svg>
        </button>
      </div>
      <div class="progress-section">
        <span class="time">{{ formatTime(playerStore.currentTime) }}</span>
        <div class="progress-bar" @click="seek">
          <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
        </div>
        <span class="time">{{ formatTime(playerStore.duration) }}</span>
      </div>
    </div>

    <div class="extra-controls">
      <div class="volume-control">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
        </svg>
        <div class="volume-bar" @click="setVolume">
          <div class="volume-fill" :style="{ width: `${playerStore.volume * 100}%` }"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.player-bar {
  height: 80px;
  background: var(--bg-tertiary);
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 20px;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
}

.song-info {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 250px;
}

.cover {
  width: 50px;
  height: 50px;
  border-radius: 6px;
  background-size: cover;
  background-position: center;
  background-color: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.cover-placeholder {
  font-size: 24px;
  color: var(--text-secondary);
}

.details {
  overflow: hidden;
}

.song-title {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-artist {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.player-controls {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.control-buttons {
  display: flex;
  align-items: center;
  gap: 16px;
}

.ctrl-btn {
  color: var(--text-primary);
  opacity: 0.8;
  transition: opacity 0.15s;
}

.ctrl-btn:hover {
  opacity: 1;
}

.play-btn {
  width: 40px;
  height: 40px;
  background: var(--accent);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.play-btn:hover {
  background: var(--accent-hover);
}

.progress-section {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  max-width: 500px;
}

.time {
  font-size: 11px;
  color: var(--text-secondary);
  min-width: 40px;
}

.progress-bar {
  flex: 1;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  cursor: pointer;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.1s linear;
}

.extra-controls {
  width: 250px;
  display: flex;
  justify-content: flex-end;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
}

.volume-bar {
  width: 80px;
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  cursor: pointer;
}

.volume-fill {
  height: 100%;
  background: var(--text-secondary);
  border-radius: 2px;
}
</style>