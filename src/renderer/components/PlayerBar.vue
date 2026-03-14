<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { formatTime } from '@/utils/format'

const playerStore = usePlayerStore()

const isPanelOpen = ref(false)
const activeTab = ref<'cover' | 'lyrics' | 'visualizer'>('cover')
const visualizerStyle = ref<'bars' | 'wave' | 'circular'>('bars')

const lyrics = ref<string[]>([])

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
  if (isPanelOpen.value && audioContext) {
    connectAnalyser()
  }
}

let audioContext: AudioContext | null = null
let analyser: AnalyserNode | null = null
let animationId: number | null = null
let sourceNode: MediaElementAudioSourceNode | null = null

const frequencyData = ref<Uint8Array>(new Uint8Array(64))
const canvasRef = ref<HTMLCanvasElement | null>(null)

const initAudioContext = () => {
  if (!audioContext) {
    audioContext = new AudioContext()
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 128
    analyser.smoothingTimeConstant = 0.8
  }
}

const connectAnalyser = () => {
  if (!audioContext || !analyser) return
  
  const audio = playerStore.getAudio()
  if (audio && audio instanceof HTMLAudioElement && !sourceNode) {
    try {
      sourceNode = audioContext.createMediaElementSource(audio)
      sourceNode.connect(analyser)
      analyser.connect(audioContext.destination)
    } catch (e) {
      console.log('Audio already connected')
    }
  }
  
  if (audioContext?.state === 'suspended') {
    audioContext.resume()
  }
}

const drawVisualizer = () => {
  if (!analyser || !canvasRef.value) return
  
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  const bufferLength = analyser.frequencyBinCount
  const dataArray = new Uint8Array(bufferLength)
  analyser.getByteFrequencyData(dataArray)
  frequencyData.value = dataArray
  
  const dpr = window.devicePixelRatio || 1
  canvas.width = canvas.offsetWidth * dpr
  canvas.height = canvas.offsetHeight * dpr
  ctx.scale(dpr, dpr)
  
  const width = canvas.offsetWidth
  const height = canvas.offsetHeight
  
  ctx.clearRect(0, 0, width, height)
  
  if (visualizerStyle.value === 'bars') {
    drawBars(ctx, dataArray, width, height)
  } else if (visualizerStyle.value === 'wave') {
    drawWave(ctx, dataArray, width, height)
  } else if (visualizerStyle.value === 'circular') {
    drawCircular(ctx, dataArray, width, height)
  }
  
  animationId = requestAnimationFrame(drawVisualizer)
}

const drawBars = (ctx: CanvasRenderingContext2D, data: Uint8Array, width: number, height: number) => {
  const barCount = 64
  const barWidth = (width / barCount) - 2
  const gap = 2
  
  for (let i = 0; i < barCount; i++) {
    const index = Math.floor(i * data.length / barCount)
    const value = data[index]
    const barHeight = (value / 255) * height * 0.9
    
    const hue = (i / barCount) * 60 + 280
    const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight)
    gradient.addColorStop(0, `hsla(${hue}, 80%, 50%, 0.8)`)
    gradient.addColorStop(1, `hsla(${hue + 30}, 80%, 60%, 0.9)`)
    
    ctx.fillStyle = gradient
    ctx.fillRect(
      i * (barWidth + gap) + gap/2,
      height - barHeight,
      barWidth,
      barHeight
    )
    
    ctx.shadowColor = `hsla(${hue}, 80%, 50%, 0.5)`
    ctx.shadowBlur = 10
  }
  ctx.shadowBlur = 0
}

const drawWave = (ctx: CanvasRenderingContext2D, data: Uint8Array, width: number, height: number) => {
  const centerY = height / 2
  
  ctx.beginPath()
  ctx.moveTo(0, centerY)
  
  for (let i = 0; i < data.length; i++) {
    const x = (i / data.length) * width
    const value = data[i] / 255
    const y = centerY + (value - 0.5) * height * 0.8
    
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }
  
  ctx.strokeStyle = 'rgba(233, 69, 96, 0.8)'
  ctx.lineWidth = 3
  ctx.stroke()
  
  ctx.lineTo(width, centerY)
  ctx.lineTo(0, centerY)
  ctx.closePath()
  
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, 'rgba(233, 69, 96, 0.3)')
  gradient.addColorStop(0.5, 'rgba(233, 69, 96, 0.1)')
  gradient.addColorStop(1, 'rgba(233, 69, 96, 0.3)')
  ctx.fillStyle = gradient
  ctx.fill()
}

const drawCircular = (ctx: CanvasRenderingContext2D, data: Uint8Array, width: number, height: number) => {
  const centerX = width / 2
  const centerY = height / 2
  const radius = Math.min(width, height) * 0.25
  
  for (let i = 0; i < data.length; i++) {
    const angle = (i / data.length) * Math.PI * 2 - Math.PI / 2
    const value = data[i] / 255
    const barLength = value * radius * 0.8
    
    const x1 = centerX + Math.cos(angle) * radius
    const y1 = centerY + Math.sin(angle) * radius
    const x2 = centerX + Math.cos(angle) * (radius + barLength)
    const y2 = centerY + Math.sin(angle) * (radius + barLength)
    
    const hue = (i / data.length) * 360
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.strokeStyle = `hsla(${hue}, 80%, 60%, 0.8)`
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.stroke()
  }
  
  ctx.beginPath()
  ctx.arc(centerX, centerY, radius - 5, 0, Math.PI * 2)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
  ctx.lineWidth = 2
  ctx.stroke()
}

watch(isPanelOpen, (open) => {
  if (open) {
    initAudioContext()
    connectAnalyser()
    setTimeout(() => {
      drawVisualizer()
    }, 100)
  } else {
    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = null
    }
  }
})

watch(activeTab, (tab) => {
  if (tab === 'visualizer' && isPanelOpen.value) {
    setTimeout(() => drawVisualizer(), 50)
  } else if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
})

watch(() => playerStore.currentSong, (song) => {
  if (song && song.lyrics) {
    lyrics.value = song.lyrics.split('\n')
  } else {
    lyrics.value = []
  }
})

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
})
</script>

<template>
  <div class="player-container">
    <Transition name="fullscreen">
      <div v-if="isPanelOpen" class="fullscreen-panel">
        <div class="panel-header">
          <button class="close-btn" @click="togglePanel">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z" />
            </svg>
          </button>
          <div class="panel-tabs">
            <button :class="['panel-tab', { active: activeTab === 'cover' }]" @click="activeTab = 'cover'">封面</button>
            <button :class="['panel-tab', { active: activeTab === 'lyrics' }]" @click="activeTab = 'lyrics'">歌词</button>
            <button :class="['panel-tab', { active: activeTab === 'visualizer' }]" @click="activeTab = 'visualizer'">可视化</button>
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
            <div class="lyrics-scroll">
              <div v-if="lyrics.length > 0" class="lyrics-content">
                <p v-for="(line, index) in lyrics" :key="index" class="lyrics-line">{{ line }}</p>
              </div>
              <div v-else class="no-lyrics">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" opacity="0.3">
                  <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                </svg>
                <p>暂无歌词</p>
              </div>
            </div>
          </div>

          <div v-else-if="activeTab === 'visualizer'" class="visualizer-tab">
            <div class="visualizer-header">
              <div class="song-info-mini">
                <span class="title">{{ playerStore.title || '未播放' }}</span>
                <span class="artist">{{ playerStore.artist || '--' }}</span>
              </div>
              <div class="style-selector">
                <button :class="['style-btn', { active: visualizerStyle === 'bars' }]" @click="visualizerStyle = 'bars'">频谱</button>
                <button :class="['style-btn', { active: visualizerStyle === 'wave' }]" @click="visualizerStyle = 'wave'">波形</button>
                <button :class="['style-btn', { active: visualizerStyle === 'circular' }]" @click="visualizerStyle = 'circular'">环形</button>
              </div>
            </div>
            <div class="visualizer-canvas-container">
              <canvas ref="canvasRef" class="visualizer-canvas"></canvas>
            </div>
          </div>
        </div>

        <div class="panel-footer">
          <div class="progress-section-full">
            <span class="time">{{ formatTime(playerStore.currentTime) }}</span>
            <div class="progress-bar-full" @click="seek">
              <div class="progress-fill-full" :style="{ width: `${progress}%` }"></div>
            </div>
            <span class="time">{{ formatTime(playerStore.duration) }}</span>
          </div>
          <div class="controls-full">
            <button class="ctrl-btn-full" @click="playerStore.previous">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
              </svg>
            </button>
            <button class="play-btn-full" @click="playerStore.togglePlay">
              <svg v-if="!playerStore.isPlaying" width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              <svg v-else width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            </button>
            <button class="ctrl-btn-full" @click="playerStore.next">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Transition>

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

.fullscreen-panel {
  position: fixed;
  top: 32px;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(180deg, var(--bg-primary) 0%, #0d0d1a 100%);
  z-index: 200;
  display: flex;
  flex-direction: column;
}

.fullscreen-enter-active,
.fullscreen-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.fullscreen-enter-from,
.fullscreen-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}

.close-btn {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background: rgba(255, 255, 255, 0.05);
  border-radius: 50%;
  transition: all 0.15s;
}

.close-btn:hover {
  color: var(--text-primary);
  background: rgba(255, 255, 255, 0.1);
}

.panel-tabs {
  display: flex;
  gap: 4px;
  background: rgba(255, 255, 255, 0.05);
  padding: 4px;
  border-radius: 12px;
}

.panel-tab {
  padding: 10px 28px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all 0.2s;
}

.panel-tab:hover {
  color: var(--text-primary);
}

.panel-tab.active {
  background: var(--accent);
  color: white;
}

.panel-spacer {
  width: 40px;
}

.panel-content {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.cover-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 40px;
  padding: 40px;
}

.large-cover {
  width: 320px;
  height: 320px;
  border-radius: 16px;
  background-size: cover;
  background-position: center;
  background-color: var(--bg-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  animation: coverFloat 6s ease-in-out infinite;
}

@keyframes coverFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.large-cover .cover-placeholder {
  font-size: 96px;
  color: var(--text-secondary);
}

.song-info-large {
  text-align: center;
}

.song-title-large {
  font-size: 36px;
  font-weight: 700;
  margin-bottom: 8px;
}

.song-artist-large {
  font-size: 20px;
  color: var(--text-secondary);
}

.lyrics-tab {
  flex: 1;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.lyrics-scroll {
  max-height: 100%;
  overflow-y: auto;
  text-align: center;
}

.lyrics-content {
  padding: 40px;
}

.lyrics-line {
  font-size: 20px;
  line-height: 2.2;
  color: var(--text-secondary);
  transition: all 0.3s;
}

.lyrics-line:hover {
  color: var(--text-primary);
  transform: scale(1.02);
}

.no-lyrics {
  text-align: center;
  color: var(--text-secondary);
  padding: 60px;
}

.no-lyrics p {
  margin-top: 16px;
  font-size: 18px;
}

.visualizer-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.visualizer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 20px;
  margin-bottom: 20px;
}

.song-info-mini {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.song-info-mini .title {
  font-size: 18px;
  font-weight: 600;
}

.song-info-mini .artist {
  font-size: 14px;
  color: var(--text-secondary);
}

.style-selector {
  display: flex;
  gap: 8px;
}

.style-btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  background: rgba(255, 255, 255, 0.05);
  color: var(--text-secondary);
  transition: all 0.15s;
}

.style-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.style-btn.active {
  background: var(--accent);
  color: white;
}

.visualizer-canvas-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.visualizer-canvas {
  width: 100%;
  height: 100%;
  max-height: 400px;
}

.panel-footer {
  padding: 24px 40px 40px;
  flex-shrink: 0;
}

.progress-section-full {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 24px;
}

.progress-bar-full {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  cursor: pointer;
  overflow: hidden;
}

.progress-fill-full {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  transition: width 0.1s linear;
}

.controls-full {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
}

.ctrl-btn-full {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  opacity: 0.8;
  transition: all 0.15s;
}

.ctrl-btn-full:hover {
  opacity: 1;
  transform: scale(1.1);
}

.play-btn-full {
  width: 72px;
  height: 72px;
  background: var(--accent);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.play-btn-full:hover {
  background: var(--accent-hover);
  transform: scale(1.05);
}

.time {
  font-size: 13px;
  color: var(--text-secondary);
  min-width: 50px;
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
  z-index: 100;
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
  flex-shrink: 0;
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
  flex-shrink: 0;
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