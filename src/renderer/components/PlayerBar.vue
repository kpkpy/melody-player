<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { formatTime } from '@/utils/format'

const playerStore = usePlayerStore()

const isPanelOpen = ref(false)
const activeTab = ref<'cover' | 'lyrics' | 'visualizer'>('cover')
const visualizerStyle = ref<'vu' | 'spectrum' | 'oscilloscope'>('vu')

const lyrics = ref<string[]>([])
const dominantColors = ref<string[]>(['#e94560', '#ff8a80'])
const bgStyle = ref({})

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
let isAudioConnected = false

const vuLeft = ref(0)
const vuRight = ref(0)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const initAudioContext = () => {
  if (!audioContext) {
    audioContext = new AudioContext()
    analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.3
  }
}

const connectAnalyser = () => {
  if (!audioContext || !analyser) {
    initAudioContext()
  }
  
  if (!audioContext || !analyser) return
  
  const audio = playerStore.getAudio()
  if (!audio) {
    console.log('No audio element found')
    return
  }
  
  if (audioContext.state === 'suspended') {
    audioContext.resume()
  }
  
  if (!isAudioConnected) {
    try {
      sourceNode = audioContext.createMediaElementSource(audio)
      sourceNode.connect(analyser)
      analyser.connect(audioContext.destination)
      isAudioConnected = true
      console.log('Audio connected to analyser')
    } catch (e: any) {
      console.log('Audio connection error:', e.message)
    }
  }
}

const drawVisualizer = () => {
  if (!canvasRef.value) {
    animationId = requestAnimationFrame(drawVisualizer)
    return
  }
  
  const canvas = canvasRef.value
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    animationId = requestAnimationFrame(drawVisualizer)
    return
  }
  
  const dpr = window.devicePixelRatio || 1
  let displayWidth = canvas.offsetWidth
  let displayHeight = canvas.offsetHeight
  
  if (displayWidth === 0 || displayHeight === 0) {
    displayWidth = 600
    displayHeight = 240
    canvas.width = displayWidth * dpr
    canvas.height = displayHeight * dpr
  } else {
    canvas.width = displayWidth * dpr
    canvas.height = displayHeight * dpr
  }
  
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.scale(dpr, dpr)
  
  const width = displayWidth
  const height = displayHeight
  
  let dataArray = new Uint8Array(128)
  let timeData = new Uint8Array(128)
  
  if (analyser) {
    const bufferLength = analyser.frequencyBinCount
    dataArray = new Uint8Array(bufferLength)
    timeData = new Uint8Array(bufferLength)
    analyser.getByteFrequencyData(dataArray)
    analyser.getByteTimeDomainData(timeData)
    
    let sum = 0
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i]
    }
    const avg = sum / bufferLength / 255
    vuLeft.value = Math.min(1, avg * 1.5 + Math.random() * 0.05)
    vuRight.value = Math.min(1, avg * 1.3 + Math.random() * 0.08)
  } else {
    vuLeft.value = 0.15 + Math.random() * 0.05
    vuRight.value = 0.12 + Math.random() * 0.04
  }
  
  if (visualizerStyle.value === 'vu') {
    drawVU(ctx, dataArray, width, height)
  } else if (visualizerStyle.value === 'spectrum') {
    drawSpectrum(ctx, dataArray, width, height)
  } else if (visualizerStyle.value === 'oscilloscope') {
    drawOscilloscope(ctx, timeData, width, height)
  }
  
  animationId = requestAnimationFrame(drawVisualizer)
}
  } else if (visualizerStyle.value === 'oscilloscope') {
    drawOscilloscope(ctx, timeData, width, height)
  }
  
  animationId = requestAnimationFrame(drawVisualizer)
}

// 复古VU表
const drawVU = (ctx: CanvasRenderingContext2D, data: Uint8Array, width: number, height: number) => {
  // 背景 - 木纹面板
  const bgGradient = ctx.createLinearGradient(0, 0, width, height)
  bgGradient.addColorStop(0, '#3d2914')
  bgGradient.addColorStop(0.5, '#4a3520')
  bgGradient.addColorStop(1, '#3d2914')
  ctx.fillStyle = bgGradient
  ctx.fillRect(0, 0, width, height)
  
  // 边框装饰
  ctx.strokeStyle = '#8b7355'
  ctx.lineWidth = 4
  ctx.strokeRect(2, 2, width - 4, height - 4)
  
  const barWidth = Math.min(30, width * 0.1)
  const barHeight = height - 60
  const gap = Math.min(80, width * 0.2)
  
  // 左声道
  drawVUMeter(ctx, width/2 - gap - barWidth, 30, barWidth, barHeight, vuLeft.value, 'L')
  // 右声道
  drawVUMeter(ctx, width/2 + gap - barWidth/2, 30, barWidth, barHeight, vuRight.value, 'R')
  
  // 中间品牌
  ctx.fillStyle = '#c4a574'
  ctx.font = 'bold 20px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.fillText('STEREO', width/2, height/2 - 10)
  ctx.font = '11px Georgia, serif'
  ctx.fillStyle = '#8b7355'
  ctx.fillText('VU METER', width/2, height/2 + 10)
  
  // 装饰螺丝
  drawScrew(ctx, width/2 - 50, height/2 + 35)
  drawScrew(ctx, width/2 + 50, height/2 + 35)
}

const drawVUMeter = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, value: number, label: string) => {
  // 外框 - 木纹质感
  ctx.fillStyle = '#2c1810'
  ctx.fillRect(x - 5, y - 5, w + 10, h + 40)
  
  // 内框 - 金属质感
  const gradient = ctx.createLinearGradient(x, y, x + w, y)
  gradient.addColorStop(0, '#4a4a4a')
  gradient.addColorStop(0.5, '#6a6a6a')
  gradient.addColorStop(1, '#4a4a4a')
  ctx.fillStyle = gradient
  ctx.fillRect(x, y, w, h)
  
  // 刻度背景
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(x + 2, y + 2, w - 4, h - 4)
  
  // 刻度线
  ctx.strokeStyle = '#333'
  ctx.lineWidth = 1
  for (let i = 0; i <= 20; i++) {
    const ly = y + 2 + (h - 4) * (1 - i/20)
    ctx.beginPath()
    ctx.moveTo(x + 2, ly)
    ctx.lineTo(x + w - 2, ly)
    ctx.stroke()
  }
  
  // VU条 - 发光效果
  const barHeight = (h - 4) * value
  const vuGradient = ctx.createLinearGradient(x, y + h - 4, x, y + h - 4 - barHeight)
  vuGradient.addColorStop(0, '#00ff00')
  vuGradient.addColorStop(0.6, '#ffff00')
  vuGradient.addColorStop(0.85, '#ff6600')
  vuGradient.addColorStop(1, '#ff0000')
  
  ctx.fillStyle = vuGradient
  ctx.fillRect(x + 4, y + h - 4 - barHeight, w - 8, barHeight)
  
  // 发光效果
  ctx.shadowColor = '#00ff00'
  ctx.shadowBlur = 10
  ctx.fillRect(x + 4, y + h - 4 - barHeight, w - 8, Math.min(barHeight, (h - 4) * 0.6))
  ctx.shadowBlur = 0
  
  // 标签
  ctx.fillStyle = '#c4a574'
  ctx.font = 'bold 14px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.fillText(label, x + w/2, y + h + 25)
}

const drawScrew = (ctx: CanvasRenderingContext2D, x: number, y: number) => {
  ctx.beginPath()
  ctx.arc(x, y, 6, 0, Math.PI * 2)
  ctx.fillStyle = '#8b7355'
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(x - 4, y)
  ctx.lineTo(x + 4, y)
  ctx.strokeStyle = '#5a4a3a'
  ctx.lineWidth = 2
  ctx.stroke()
}

// 复古频谱 - 老式音响风格
const drawSpectrum = (ctx: CanvasRenderingContext2D, data: Uint8Array, width: number, height: number) => {
  const barCount = 32
  const barWidth = (width - 60) / barCount - 2
  const startX = 30
  
  // 背景 - 拉丝金属
  const bgGradient = ctx.createLinearGradient(0, 0, width, height)
  bgGradient.addColorStop(0, '#2a2a2a')
  bgGradient.addColorStop(0.5, '#3a3a3a')
  bgGradient.addColorStop(1, '#2a2a2a')
  ctx.fillStyle = bgGradient
  ctx.fillRect(0, 0, width, height)
  
  // 网格线
  ctx.strokeStyle = '#444'
  ctx.lineWidth = 0.5
  for (let i = 0; i < 10; i++) {
    const y = 20 + (height - 60) * (i / 10)
    ctx.beginPath()
    ctx.moveTo(20, y)
    ctx.lineTo(width - 20, y)
    ctx.stroke()
  }
  
  // 频谱条
  for (let i = 0; i < barCount; i++) {
    const index = Math.floor(i * data.length / barCount)
    const value = data[index] / 255
    const barHeight = (height - 60) * value
    const x = startX + i * (barWidth + 2)
    const y = height - 30 - barHeight
    
    // LED风格分段
    const segments = 20
    const segmentHeight = (height - 60) / segments
    for (let j = 0; j < segments * value; j++) {
      const sy = height - 30 - (j + 1) * segmentHeight
      const hue = 120 - (j / segments) * 80
      ctx.fillStyle = `hsl(${hue}, 100%, ${40 + (j % 2) * 10}%)`
      ctx.fillRect(x, sy + 1, barWidth, segmentHeight - 2)
      
      // 发光
      if (j > segments * 0.7) {
        ctx.shadowColor = `hsl(${hue}, 100%, 50%)`
        ctx.shadowBlur = 5
        ctx.fillRect(x, sy + 1, barWidth, segmentHeight - 2)
        ctx.shadowBlur = 0
      }
    }
  }
  
  // 底部标签
  ctx.fillStyle = '#c4a574'
  ctx.font = '12px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('SPECTRUM ANALYZER', width/2, height - 8)
  
  // 频率标注
  ctx.font = '10px monospace'
  ctx.fillStyle = '#666'
  ctx.fillText('20Hz', startX, height - 18)
  ctx.fillText('20kHz', width - startX - 30, height - 18)
}

// 示波器风格 - 老式CRT显示器
const drawOscilloscope = (ctx: CanvasRenderingContext2D, data: Uint8Array, width: number, height: number) => {
  // CRT背景
  ctx.fillStyle = '#0a1a0a'
  ctx.fillRect(0, 0, width, height)
  
  // 网格
  ctx.strokeStyle = '#0f3f0f'
  ctx.lineWidth = 1
  const gridSize = 20
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }
  
  // 中心线
  ctx.strokeStyle = '#1a5a1a'
  ctx.beginPath()
  ctx.moveTo(0, height/2)
  ctx.lineTo(width, height/2)
  ctx.stroke()
  
  // 波形 - 荧光绿
  ctx.strokeStyle = '#00ff00'
  ctx.lineWidth = 2
  ctx.shadowColor = '#00ff00'
  ctx.shadowBlur = 10
  ctx.beginPath()
  
  const sliceWidth = width / data.length
  let x = 0
  
  for (let i = 0; i < data.length; i++) {
    const v = data[i] / 128.0
    const y = (v * height) / 2
    
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
    x += sliceWidth
  }
  
  ctx.stroke()
  ctx.shadowBlur = 0
  
  // 扫描线效果
  ctx.fillStyle = 'rgba(0, 255, 0, 0.03)'
  for (let y = 0; y < height; y += 3) {
    ctx.fillRect(0, y, width, 1)
  }
  
  // CRT边框发光
  ctx.strokeStyle = '#00ff00'
  ctx.lineWidth = 2
  ctx.strokeRect(5, 5, width - 10, height - 10)
  
  // 角落装饰
  ctx.fillStyle = '#00ff00'
  ctx.font = '10px monospace'
  ctx.fillText('CH1: ON', 15, 20)
  ctx.fillText('TIME: 1ms/div', width - 80, 20)
  ctx.fillText('VOLTS: 0.5V/div', 15, height - 10)
  ctx.fillText('TRIG: AUTO', width - 80, height - 10)
}

watch(isPanelOpen, (open) => {
  if (open) {
    initAudioContext()
    connectAnalyser()
    extractCoverColors()
    if (activeTab.value === 'visualizer') {
      setTimeout(() => {
        drawVisualizer()
      }, 100)
    }
  } else {
    if (animationId) {
      cancelAnimationFrame(animationId)
      animationId = null
    }
  }
})

watch(() => playerStore.cover, (cover) => {
  if (cover && isPanelOpen.value) {
    extractCoverColors()
  }
}, { immediate: true })

watch(activeTab, (tab) => {
  if (tab === 'visualizer' && isPanelOpen.value) {
    initAudioContext()
    connectAnalyser()
    if (animationId) {
      cancelAnimationFrame(animationId)
    }
    setTimeout(() => drawVisualizer(), 50)
  } else if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
})

watch(() => playerStore.isPlaying, (playing) => {
  if (playing && activeTab.value === 'visualizer' && isPanelOpen.value) {
    initAudioContext()
    connectAnalyser()
  }
})

watch(() => playerStore.currentSong, (song) => {
  if (song && song.lyrics) {
    lyrics.value = song.lyrics.split('\n')
  } else {
    lyrics.value = []
  }
})

const extractCoverColors = () => {
  if (!playerStore.cover) {
    dominantColors.value = ['#e94560', '#ff8a80']
    updateBgStyle()
    return
  }
  
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    
    const size = 100
    canvas.width = size
    canvas.height = size
    ctx.drawImage(img, 0, 0, size, size)
    
    const imageData = ctx.getImageData(0, 0, size, size)
    const pixels = imageData.data
    
    const colorMap = new Map<string, number>()
    
    for (let i = 0; i < pixels.length; i += 16) {
      const r = pixels[i]
      const g = pixels[i + 1]
      const b = pixels[i + 2]
      
      const qr = Math.round(r / 32) * 32
      const qg = Math.round(g / 32) * 32
      const qb = Math.round(b / 32) * 32
      
      const key = `${qr},${qg},${qb}`
      colorMap.set(key, (colorMap.get(key) || 0) + 1)
    }
    
    const sortedColors = Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([color]) => {
        const [r, g, b] = color.split(',').map(Number)
        return rgbToHex(r, g, b)
      })
    
    if (sortedColors.length >= 2) {
      dominantColors.value = sortedColors.slice(0, 2)
    } else if (sortedColors.length === 1) {
      dominantColors.value = [sortedColors[0], adjustBrightness(sortedColors[0], 30)]
    }
    
    updateBgStyle()
  }
  img.onerror = () => {
    dominantColors.value = ['#e94560', '#ff8a80']
    updateBgStyle()
  }
  img.src = playerStore.cover
}

const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map(x => {
    const hex = x.toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }).join('')
}

const adjustBrightness = (hex: string, percent: number): string => {
  const num = parseInt(hex.slice(1), 16)
  const r = Math.min(255, Math.max(0, (num >> 16) + percent))
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + percent))
  const b = Math.min(255, Math.max(0, (num & 0x0000FF) + percent))
  return rgbToHex(r, g, b)
}

const updateBgStyle = () => {
  const [color1, color2] = dominantColors.value
  bgStyle.value = {
    '--accent-color-1': color1,
    '--accent-color-2': color2,
    '--accent-color-1-light': hexToRgba(color1, 0.3),
    '--accent-color-2-light': hexToRgba(color2, 0.3),
  }
}

const hexToRgba = (hex: string, alpha: number): string => {
  const num = parseInt(hex.slice(1), 16)
  const r = (num >> 16) & 255
  const g = (num >> 8) & 255
  const b = num & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

onUnmounted(() => {
  if (animationId) {
    cancelAnimationFrame(animationId)
  }
})
</script>

<template>
  <div class="player-container">
    <Transition name="fullscreen">
      <div v-if="isPanelOpen" class="fullscreen-panel" :style="bgStyle">
        <div class="panel-bg">
          <div class="gradient-orb orb-1"></div>
          <div class="gradient-orb orb-2"></div>
          <div class="gradient-orb orb-3"></div>
          <div class="gradient-overlay"></div>
        </div>
        
        <button class="close-btn" @click="togglePanel">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>

        <div class="panel-tabs">
          <button :class="['panel-tab', { active: activeTab === 'cover' }]" @click="activeTab = 'cover'">封面</button>
          <button :class="['panel-tab', { active: activeTab === 'lyrics' }]" @click="activeTab = 'lyrics'">歌词</button>
          <button :class="['panel-tab', { active: activeTab === 'visualizer' }]" @click="activeTab = 'visualizer'">可视化</button>
        </div>

        <div class="panel-content">
          <!-- 封面页 -->
          <Transition name="tab-fade" mode="out-in">
            <div v-if="activeTab === 'cover'" key="cover" class="cover-tab">
              <div class="cover-wrapper">
                <div class="cover-glow"></div>
                <div class="large-cover" :style="{ backgroundImage: playerStore.cover ? `url(${playerStore.cover})` : 'none' }">
                  <div v-if="!playerStore.cover" class="cover-placeholder">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                    </svg>
                  </div>
                </div>
              </div>
              
              <div class="song-info-display">
                <h1 class="song-title-display">{{ playerStore.title || '未播放' }}</h1>
                <p class="song-artist-display">{{ playerStore.artist || '--' }}</p>
              </div>

              <div class="progress-display">
                <div class="progress-bar-display" @click="seek">
                  <div class="progress-fill-display" :style="{ width: `${progress}%` }"></div>
                  <div class="progress-thumb" :style="{ left: `${progress}%` }"></div>
                </div>
                <div class="time-display">
                  <span>{{ formatTime(playerStore.currentTime) }}</span>
                  <span>{{ formatTime(playerStore.duration) }}</span>
                </div>
              </div>
            </div>

            <!-- 歌词页 -->
            <div v-else-if="activeTab === 'lyrics'" key="lyrics" class="lyrics-tab">
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

            <!-- 可视化页 -->
            <div v-else-if="activeTab === 'visualizer'" key="visualizer" class="visualizer-tab">
              <div class="visualizer-header">
                <div class="song-info-mini">
                  <span class="title">{{ playerStore.title || '未播放' }}</span>
                  <span class="artist">{{ playerStore.artist || '--' }}</span>
                </div>
                <div class="style-selector">
                  <button :class="['style-btn', { active: visualizerStyle === 'vu' }]" @click="visualizerStyle = 'vu'">VU表</button>
                  <button :class="['style-btn', { active: visualizerStyle === 'spectrum' }]" @click="visualizerStyle = 'spectrum'">频谱</button>
                  <button :class="['style-btn', { active: visualizerStyle === 'oscilloscope' }]" @click="visualizerStyle = 'oscilloscope'">示波器</button>
                </div>
              </div>
              <div class="visualizer-canvas-container">
                <canvas ref="canvasRef" class="visualizer-canvas"></canvas>
              </div>
            </div>
          </Transition>
        </div>

        <!-- 底部控制 -->
        <div class="panel-controls">
          <button class="ctrl-btn-lg" @click="playerStore.previous">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>
          <button class="play-btn-lg" @click="playerStore.togglePlay">
            <svg v-if="!playerStore.isPlaying" width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            <svg v-else width="36" height="36" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          </button>
          <button class="ctrl-btn-lg" @click="playerStore.next">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
        </div>
      </div>
    </Transition>

    <!-- 底部播放栏 -->
    <div class="player-bar" :style="bgStyle">
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

/* 全屏面板 */
.fullscreen-panel {
  position: fixed;
  top: 32px;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 200;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-bg {
  position: absolute;
  inset: 0;
  background: #f5f5f7;
  z-index: -1;
  overflow: hidden;
}

.gradient-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0;
  animation: fadeInOrb 0.8s ease forwards, var(--orb-animation);
}

@keyframes fadeInOrb {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 0.6; }
}

.orb-1 {
  width: 500px;
  height: 500px;
  background: var(--accent-color-1-light, rgba(233, 69, 96, 0.4));
  top: 20%;
  left: 10%;
  --orb-animation: floatOrb1 18s ease-in-out infinite 0.8s;
}

.orb-2 {
  width: 400px;
  height: 400px;
  background: var(--accent-color-2-light, rgba(255, 138, 128, 0.4));
  top: 60%;
  right: 5%;
  --orb-animation: floatOrb2 22s ease-in-out infinite 0.8s;
}

.orb-3 {
  width: 350px;
  height: 350px;
  background: linear-gradient(135deg, var(--accent-color-1-light, rgba(233, 69, 96, 0.3)), var(--accent-color-2-light, rgba(255, 138, 128, 0.3)));
  bottom: 10%;
  left: 50%;
  transform: translateX(-50%);
  --orb-animation: floatOrb3 25s ease-in-out infinite 0.8s;
}

@keyframes floatOrb1 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(50px, 30px) scale(1.1); }
  66% { transform: translate(-30px, -20px) scale(0.95); }
}

@keyframes floatOrb2 {
  0%, 100% { transform: translate(0, 0) scale(1); }
  33% { transform: translate(-40px, -40px) scale(1.05); }
  66% { transform: translate(30px, 20px) scale(0.9); }
}

@keyframes floatOrb3 {
  0%, 100% { transform: translateX(-50%) translateY(0) scale(1); }
  50% { transform: translateX(-50%) translateY(-30px) scale(1.15); }
}

.gradient-overlay {
  position: absolute;
  inset: 0;
  background: 
    radial-gradient(ellipse at 50% 0%, rgba(255,255,255,0.8) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 100%, rgba(255,255,255,0.6) 0%, transparent 40%);
  backdrop-filter: blur(1px);
}

.close-btn {
  position: absolute;
  top: 20px;
  right: 20px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background: white;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  transition: all 0.2s ease;
  z-index: 10;
}

.close-btn:hover {
  color: var(--accent);
  transform: rotate(90deg);
}

.panel-tabs {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 8px;
  background: white;
  padding: 6px;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
  z-index: 10;
}

.panel-tab {
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.panel-tab:hover {
  color: var(--text-primary);
}

.panel-tab.active {
  background: var(--accent);
  color: white;
}

.panel-content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 100px 40px 20px;
  overflow: hidden;
}

/* 封面页 */
.cover-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 40px;
  width: 100%;
  max-width: 500px;
}

.cover-wrapper {
  position: relative;
  perspective: 1000px;
}

.cover-glow {
  position: absolute;
  inset: -60px;
  background: radial-gradient(circle, var(--accent-color-1-light, rgba(233, 69, 96, 0.3)) 0%, transparent 60%);
  filter: blur(40px);
  z-index: -1;
  animation: glowPulse 4s ease-in-out infinite;
}

@keyframes glowPulse {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.05); }
}

.large-cover {
  width: 320px;
  height: 320px;
  border-radius: 20px;
  background-size: cover;
  background-position: center;
  background-color: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.15),
    0 0 0 1px rgba(255, 255, 255, 0.5) inset;
  transform-style: preserve-3d;
  animation: coverFloat 6s ease-in-out infinite, coverFadeIn 0.5s ease;
}

@keyframes coverFadeIn {
  from {
    opacity: 0;
    transform: scale(0.9) rotateY(-5deg);
  }
  to {
    opacity: 1;
    transform: scale(1) rotateY(0deg);
  }
}

@keyframes coverFloat {
  0%, 100% { transform: translateY(0) rotateX(0deg); }
  50% { transform: translateY(-10px) rotateX(2deg); }
}

.cover-placeholder {
  color: var(--text-secondary);
  opacity: 0.5;
}

.song-info-display {
  text-align: center;
}

.song-title-display {
  font-size: 32px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.song-artist-display {
  font-size: 18px;
  color: var(--text-secondary);
}

.progress-display {
  width: 100%;
}

.progress-bar-display {
  position: relative;
  height: 6px;
  background: rgba(0,0,0,0.1);
  border-radius: 3px;
  cursor: pointer;
  overflow: visible;
}

.progress-fill-display {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-color-1, var(--accent)), var(--accent-color-2, var(--accent-hover)));
  border-radius: 3px;
  transition: width 0.1s linear;
}

.progress-thumb {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 18px;
  height: 18px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15), 0 0 0 3px var(--accent-color-1, var(--accent));
}

.time-display {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

/* 歌词页 */
.lyrics-tab {
  width: 100%;
  max-width: 600px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.lyrics-scroll {
  max-height: 400px;
  overflow-y: auto;
  text-align: center;
  padding: 40px;
}

.lyrics-line {
  font-size: 18px;
  line-height: 2.2;
  color: var(--text-secondary);
  transition: all 0.3s;
}

.lyrics-line:hover {
  color: var(--accent);
  transform: scale(1.02);
}

.no-lyrics {
  text-align: center;
  color: var(--text-secondary);
  padding: 60px;
}

/* 可视化页 */
.visualizer-tab {
  width: 100%;
  max-width: 800px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.visualizer-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.song-info-mini .title {
  font-size: 18px;
  font-weight: 600;
  display: block;
}

.song-info-mini .artist {
  font-size: 14px;
  color: var(--text-secondary);
}

.style-selector {
  display: flex;
  gap: 8px;
  background: white;
  padding: 4px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.style-btn {
  padding: 8px 16px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.style-btn:hover {
  color: var(--text-primary);
}

.style-btn.active {
  background: var(--accent);
  color: white;
}

.visualizer-canvas-container {
  flex: 1;
  min-height: 280px;
  height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
  border-radius: 16px;
  padding: 20px;
  box-shadow: inset 0 2px 10px rgba(0,0,0,0.3);
}

.visualizer-canvas {
  width: 100%;
  height: 100%;
}

/* 底部控制 */
.panel-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24px;
  padding: 30px;
  background: rgba(255,255,255,0.8);
  backdrop-filter: blur(20px);
  border-top: 1px solid rgba(0,0,0,0.05);
}

.ctrl-btn-lg {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  background: white;
  border-radius: 50%;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  transition: all 0.2s ease;
}

.ctrl-btn-lg:hover {
  color: var(--accent);
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(0,0,0,0.15);
}

.play-btn-lg {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, var(--accent-color-1, var(--accent)), var(--accent-color-2, var(--accent-hover)));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 8px 32px var(--accent-color-1-light, rgba(233, 69, 96, 0.3));
  transition: all 0.2s ease;
}

.play-btn-lg:hover {
  transform: scale(1.05);
  box-shadow: 0 12px 40px var(--accent-color-1-light, rgba(233, 69, 96, 0.4));
}

/* 过渡动画 */
.fullscreen-enter-active,
.fullscreen-leave-active {
  transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}

.fullscreen-enter-from,
.fullscreen-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

.tab-fade-enter-active,
.tab-fade-leave-active {
  transition: all 0.3s ease;
}

.tab-fade-enter-from {
  opacity: 0;
  transform: scale(0.95);
}

.tab-fade-leave-to {
  opacity: 0;
  transform: scale(1.02);
}

/* 底部播放栏 */
.player-bar {
  height: 80px;
  background: var(--glass);
  backdrop-filter: blur(20px);
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 20px;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 100;
  box-shadow: 0 -4px 20px rgba(0,0,0,0.05);
}

.song-info {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 250px;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 12px;
  transition: all 0.2s ease;
}

.song-info:hover {
  background: rgba(0,0,0,0.05);
}

.cover {
  width: 50px;
  height: 50px;
  border-radius: 10px;
  background-size: cover;
  background-position: center;
  background-color: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
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
  font-weight: 600;
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
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  border-radius: 50%;
  transition: all 0.15s ease;
}

.ctrl-btn:hover {
  color: var(--accent-color-1, var(--accent));
  transform: scale(1.1);
  background: var(--accent-color-1-light, rgba(233, 69, 96, 0.1));
}

.play-btn {
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, var(--accent-color-1, var(--accent)), var(--accent-color-2, var(--accent-hover)));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 4px 12px var(--accent-color-1-light, rgba(233, 69, 96, 0.3));
  transition: all 0.2s ease;
}

.play-btn:hover {
  transform: scale(1.05);
  box-shadow: 0 6px 20px var(--accent-color-1-light, rgba(233, 69, 96, 0.4));
}

.progress-section {
  display: flex;
  align-items: center;
  gap: 12px;
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
  background: rgba(0,0,0,0.1);
  border-radius: 2px;
  cursor: pointer;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-color-1, var(--accent)), var(--accent-color-2, var(--accent-hover)));
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
  background: rgba(0,0,0,0.1);
  border-radius: 2px;
  cursor: pointer;
}

.volume-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-color-1, var(--accent)), var(--accent-color-2, var(--accent-hover)));
  border-radius: 2px;
}
</style>