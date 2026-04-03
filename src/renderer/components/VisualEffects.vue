<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { usePlayerStore } from '@/stores/player'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  life: number
}

const playerStore = usePlayerStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const particles = ref<Particle[]>([])
const animationId = ref<number | null>(null)
const audioData = ref<Uint8Array | null>(null)
let analyser: AnalyserNode | null = null
let audioContext: AudioContext | null = null
let sourceNode: MediaElementAudioSourceNode | null = null
const isPlaying = computed(() => playerStore.isPlaying)

// 唱片模式
const showVinylMode = ref(false)
const vinylRotation = ref(0)
const vinylSpeed = ref(33.5 / 60 * 360) // RPM 转换为每秒度数

// 粒子颜色池
const colorPool = ['#e94560', '#ff8a80', '#ff6b6b', '#ff9ff3', '#feca57', '#54a0ff']

onMounted(() => {
  setupAudioAnalyzer()
  animate()
  
  // 监听黑胶模式切换事件
  window.addEventListener('vinyl:toggle', () => {
    showVinylMode.value = !showVinylMode.value
    if (showVinylMode.value) {
      createParticles(window.innerWidth / 2, window.innerHeight / 2, 30)
    }
  })
})

onUnmounted(() => {
  if (animationId.value) {
    cancelAnimationFrame(animationId.value)
  }
  if (audioContext) {
    audioContext.close()
  }
})

const setupAudioAnalyzer = () => {
  const audio = playerStore.getAudio()
  if (!audio) return
  
  audioContext = new AudioContext()
  analyser = audioContext.createAnalyser()
  analyser.fftSize = 256
  analyser.smoothingTimeConstant = 0.8
  
  try {
    sourceNode = audioContext.createMediaElementSource(audio)
    sourceNode.connect(analyser)
    analyser.connect(audioContext.destination)
  } catch (e) {
    console.log('Audio setup error:', e)
  }
  
  audioData.value = new Uint8Array(analyser.frequencyBinCount)
}

const createParticles = (x: number, y: number, count: number = 20) => {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 / count) * i
    const speed = 2 + Math.random() * 3
    particles.value.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      size: 3 + Math.random() * 6,
      color: colorPool[Math.floor(Math.random() * colorPool.length)],
      life: 1.0,
    })
  }
}

const updateParticles = () => {
  particles.value = particles.value.filter(p => {
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.1 // 重力
    p.life -= 0.02
    return p.life > 0
  })
}

const drawParticles = (ctx: CanvasRenderingContext2D) => {
  particles.value.forEach(p => {
    ctx.globalAlpha = p.life
    ctx.fillStyle = p.color
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.globalAlpha = 1.0
}

const drawSpectrumBars = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  barCount: number = 32
) => {
  if (!audioData.value || !analyser) return
  
  analyser.getByteFrequencyData(audioData.value)
  
  const barWidth = width / barCount - 2
  const maxBarHeight = height
  
  for (let i = 0; i < barCount; i++) {
    const freqIndex = Math.floor(i * audioData.value.length / barCount)
    const value = audioData.value[freqIndex] / 255
    const barHeight = value * maxBarHeight
    
    const gradient = ctx.createLinearGradient(x, y + maxBarHeight, x, y)
    gradient.addColorStop(0, colorPool[0])
    gradient.addColorStop(0.5, colorPool[1])
    gradient.addColorStop(1, colorPool[3])
    
    ctx.fillStyle = gradient
    ctx.fillRect(x + i * (barWidth + 2), y + maxBarHeight - barHeight, barWidth, barHeight)
    
    // 镜面反射
    ctx.globalAlpha = 0.3
    ctx.fillRect(x + i * (barWidth + 2), y + maxBarHeight, barWidth, barHeight * 0.3)
    ctx.globalAlpha = 1.0
  }
}

const animate = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  
  const dpr = window.devicePixelRatio || 1
  const displayWidth = canvas.offsetWidth
  const displayHeight = canvas.offsetHeight
  
  canvas.width = displayWidth * dpr
  canvas.height = displayHeight * dpr
  ctx.scale(dpr, dpr)
  
  ctx.clearRect(0, 0, displayWidth, displayHeight)
  
  // 更新唱片旋转
  if (isPlaying.value) {
    vinylRotation.value = (vinylRotation.value + vinylSpeed.value / 60) % 360
  }
  
  // 绘制频谱条（底部）
  drawSpectrumBars(ctx, 0, displayHeight - 80, displayWidth, 60, 48)
  
  // 更新和绘制粒子
  updateParticles()
  drawParticles(ctx)
  
  animationId.value = requestAnimationFrame(animate)
}

const toggleVinylMode = () => {
  showVinylMode.value = !showVinylMode.value
  if (showVinylMode.value) {
    createParticles(window.innerWidth / 2, window.innerHeight / 2, 30)
  }
}

const triggerSpectrumPulse = () => {
  if (!audioData.value || !analyser) return
  
  analyser.getByteFrequencyData(audioData.value)
  const avg = audioData.value.reduce((a, b) => a + b, 0) / audioData.value.length
  
  if (avg > 200) {
    createParticles(
      window.innerWidth / 2 + (Math.random() - 0.5) * 200,
      window.innerHeight / 2 + (Math.random() - 0.5) * 200,
      10
    )
  }
}

// 监听播放状态触发粒子
let lastBeatTime = 0
watch(isPlaying, (playing) => {
  if (playing) {
    const now = Date.now()
    if (now - lastBeatTime > 1000) {
      createParticles(window.innerWidth / 2, window.innerHeight / 2, 15)
      lastBeatTime = now
    }
  }
})
</script>

<template>
  <div class="visual-effects-container">
    <canvas ref="canvasRef" class="spectrum-canvas"></canvas>
    
    <!-- 黑胶唱片模式 -->
    <Transition name="vinyl-fade">
      <div v-if="showVinylMode" class="vinyl-overlay">
        <div class="vinyl-record" :style="{ transform: `rotate(${vinylRotation}deg)` }">
          <div class="vinyl-label">
            <div class="label-inner">
              {{ playerStore.title || 'Melody' }}
            </div>
          </div>
        </div>
      </div>
    </Transition>
    
    <!-- 切歌粒子触发器（隐藏） -->
    <div class="particle-trigger" @click="createParticles($event.clientX, $event.clientY, 50)"></div>
  </div>
</template>

<style scoped>
.visual-effects-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 1000;
  overflow: hidden;
}

.spectrum-canvas {
  width: 100%;
  height: 100%;
}

/* 黑胶唱片模式 */
.vinyl-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
  backdrop-filter: blur(10px);
}

.vinyl-record {
  width: 400px;
  height: 400px;
  border-radius: 50%;
  background: #1a1a1a;
  position: relative;
  box-shadow: 
    0 0 0 2px #333,
    0 0 0 10px #1a1a1a,
    0 0 0 12px #333,
    0 20px 60px rgba(0, 0, 0, 0.5),
    0 0 100px rgba(233, 69, 96, 0.3);
  animation: vinylFloat 3s ease-in-out infinite;
}

@keyframes vinylFloat {
  0%, 100% { transform: translateY(0) rotate(calc(var(--rotation, 0deg))); }
  50% { transform: translateY(-10px) rotate(calc(var(--rotation, 0deg) + 2deg)); }
}

/* 唱片纹理 */
.vinyl-record::before {
  content: '';
  position: absolute;
  inset: 20px;
  border-radius: 50%;
  background: repeating-radial-gradient(
    circle at center,
    #1a1a1a 0px,
    #2a2a2a 2px,
    #1a1a1a 4px
  );
  border: 2px solid #333;
}

/* 唱片标签 */
.vinyl-label {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.label-inner {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: linear-gradient(135deg, #e94560, #ff8a80);
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: white;
  box-shadow: 0 4px 20px rgba(233, 69, 96, 0.5);
  position: relative;
}

.label-inner::before {
  content: '';
  position: absolute;
  width: 10px;
  height: 10px;
  background: #1a1a1a;
  border-radius: 50%;
}

/* 唱针（装饰） */
.vinyl-overlay::after {
  content: '';
  position: absolute;
  top: -20px;
  right: 15%;
  width: 10px;
  height: 120px;
  background: linear-gradient(180deg, #888, #ccc);
  transform: rotate(0deg);
  transform-origin: top center;
  animation: toneArmMove 0.5s ease forwards 0.3s;
}

@keyframes toneArmMove {
  from { transform: rotate(-20deg); }
  to { transform: rotate(0deg); }
}

.particle-trigger {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1002;
  cursor: pointer;
  opacity: 0;
}

/* 过渡动画 */
.vinyl-fade-enter-active,
.vinyl-fade-leave-active {
  transition: opacity 0.5s ease;
}

.vinyl-fade-enter-from,
.vinyl-fade-leave-to {
  opacity: 0;
}
</style>
