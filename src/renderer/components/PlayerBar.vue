<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { formatTime } from '@/utils/format'

const playerStore = usePlayerStore()

const isPanelOpen = ref(false)
const activeTab = ref<'cover' | 'lyrics' | 'equalizer'>('cover')

const lyrics = ref<string[]>([])
const lyricsOffset = ref(0)

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

const togglePanel = () => {
  isPanelOpen.value = !isPanelOpen.value
}

const equalizerBands = ref([
  { freq: 60, gain: 0 },
  { freq: 230, gain: 0 },
  { freq: 910, gain: 0 },
  { freq: 3600, gain: 0 },
  { freq: 14000, gain: 0 },
])

const resetEqualizer = () => {
  equalizerBands.value.forEach(band => band.gain = 0)
}

watch(() => playerStore.currentSong, async (song) => {
  if (song && song.lyrics) {
    lyrics.value = song.lyrics.split('\n')
  } else {
    lyrics.value = []
  }
  lyricsOffset.value = 0
})
</script>

<template>
  <div class="player-container">
    <div class="player-panel" :class="{ open: isPanelOpen }">
      <div class="panel-header">
        <button class="close-btn" @click="togglePanel">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
          </svg>
        </button>
        <div class="panel-tabs">
          <button :class="['panel-tab', { active: activeTab === 'cover' }]" @click="activeTab = 'cover'">封面</button>
          <button :class="['panel-tab', { active: activeTab === 'lyrics' }]" @click="activeTab = 'lyrics'">歌词</button>
          <button :class="['panel-tab', { active: activeTab === 'equalizer' }]" @click="activeTab = 'equalizer'">效果器</button>
        </div>
        <div class="panel-spacer"></div>
      </div>

      <div class="panel-content">
        <div v-if="activeTab === 'cover'" class="cover-tab">
          <div class="large-cover" :style="{ backgroundImage: playerStore.cover ? `url(${playerStore.cover})` : 'none' }">
            <div v-if="!playerStore.cover" class="cover-placeholder">♪</div>
          </div>
          <div class="song-info-large">
            <div class="song-title-large">{{ playerStore.title || '未播放' }}</div>
            <div class="song-artist-large">{{ playerStore.artist || '--' }}</div>
          </div>
        </div>

        <div v-else-if="activeTab === 'lyrics'" class="lyrics-tab">
          <div v-if="lyrics.length > 0" class="lyrics-content">
            <p v-for="(line, index) in lyrics" :key="index" class="lyrics-line">{{ line }}</p>
          </div>
          <div v-else class="no-lyrics">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
              <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
            </svg>
            <p>暂无歌词</p>
          </div>
        </div>

        <div v-else-if="activeTab === 'equalizer'" class="equalizer-tab">
          <div class="eq-bands">
            <div v-for="(band, index) in equalizerBands" :key="index" class="eq-band">
              <input
                type="range"
                min="-12"
                max="12"
                step="1"
                v-model.number="band.gain"
                class="eq-slider"
                orient="vertical"
              />
              <span class="eq-freq">{{ band.freq >= 1000 ? `${band.freq/1000}k` : band.freq }}</span>
              <span class="eq-gain">{{ band.gain > 0 ? '+' : '' }}{{ band.gain }}dB</span>
            </div>
          </div>
          <button class="reset-eq-btn" @click="resetEqualizer">重置</button>
        </div>
      </div>
    </div>

    <div class="player-bar">
      <div class="song-info" @click="togglePanel">
        <div class="cover" :style="{ backgroundImage: playerStore.cover ? `url(${playerStore.cover})` : 'none' }">
          <div v-if="!playerStore.cover" class="cover-placeholder">♪</div>
        </div>
        <div class="details">
          <div class="song-title">{{ playerStore.title || '未播放' }}</div>
          <div class="song-artist">{{ playerStore.artist || '--' }}</div>
        </div>
        <svg class="expand-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
        </svg>
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
  </div>
</template>

<style scoped>
.player-container {
  position: relative;
}

.player-panel {
  position: fixed;
  bottom: 80px;
  left: 0;
  right: 0;
  height: 0;
  background: var(--bg-primary);
  border-top: 1px solid var(--border);
  transition: height 0.3s ease;
  overflow: hidden;
  z-index: 100;
}

.player-panel.open {
  height: 320px;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border);
}

.close-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  transition: color 0.15s;
}

.close-btn:hover {
  color: var(--text-primary);
}

.panel-tabs {
  display: flex;
  gap: 4px;
  background: rgba(255, 255, 255, 0.05);
  padding: 4px;
  border-radius: 8px;
}

.panel-tab {
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  transition: all 0.15s;
}

.panel-tab:hover {
  color: var(--text-primary);
}

.panel-tab.active {
  background: var(--accent);
  color: white;
}

.panel-spacer {
  width: 32px;
}

.panel-content {
  padding: 20px;
  height: calc(100% - 56px);
  overflow-y: auto;
}

.cover-tab {
  display: flex;
  align-items: center;
  gap: 40px;
  height: 100%;
}

.large-cover {
  width: 200px;
  height: 200px;
  border-radius: 12px;
  background-size: cover;
  background-position: center;
  background-color: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.large-cover .cover-placeholder {
  font-size: 72px;
  color: var(--text-secondary);
}

.song-info-large {
  flex: 1;
}

.song-title-large {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
}

.song-artist-large {
  font-size: 18px;
  color: var(--text-secondary);
}

.lyrics-tab {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lyrics-content {
  text-align: center;
  max-height: 100%;
  overflow-y: auto;
}

.lyrics-line {
  font-size: 16px;
  line-height: 2;
  color: var(--text-secondary);
}

.no-lyrics {
  text-align: center;
  color: var(--text-secondary);
}

.no-lyrics p {
  margin-top: 12px;
}

.equalizer-tab {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.eq-bands {
  display: flex;
  gap: 30px;
  flex: 1;
  align-items: center;
}

.eq-band {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.eq-slider {
  writing-mode: vertical-lr;
  direction: rtl;
  width: 6px;
  height: 120px;
  appearance: none;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  cursor: pointer;
}

.eq-slider::-webkit-slider-thumb {
  appearance: none;
  width: 14px;
  height: 14px;
  background: var(--accent);
  border-radius: 50%;
  cursor: pointer;
}

.eq-freq {
  font-size: 11px;
  color: var(--text-secondary);
}

.eq-gain {
  font-size: 11px;
  color: var(--text-secondary);
  min-width: 40px;
  text-align: center;
}

.reset-eq-btn {
  padding: 8px 24px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  font-size: 13px;
}

.reset-eq-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

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
  z-index: 101;
}

.song-info {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 250px;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  transition: background 0.15s;
}

.song-info:hover {
  background: rgba(255, 255, 255, 0.05);
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
  flex: 1;
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

.expand-icon {
  color: var(--text-secondary);
  opacity: 0;
  transition: opacity 0.15s;
}

.song-info:hover .expand-icon {
  opacity: 1;
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