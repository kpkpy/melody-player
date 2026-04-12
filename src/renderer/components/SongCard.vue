<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  song: any
}>()

defineEmits<{
  click: []
}>()

const coverUrl = ref<string | undefined>(undefined)
const cardRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

// Global cover loading queue - limit concurrent requests
let loadingQueue: string[] = []
let activeLoads = 0
const MAX_CONCURRENT = 5
const globalCoverCache = new Map<string, string>()

const processQueue = async () => {
  while (loadingQueue.length > 0 && activeLoads < MAX_CONCURRENT) {
    const filePath = loadingQueue.shift()
    if (!filePath) continue
    
    // Skip if already cached
    if (globalCoverCache.has(filePath)) continue
    
    activeLoads++
    try {
      const cover = await window.electron.library.getSongCover(filePath)
      if (cover) {
        globalCoverCache.set(filePath, cover)
        // Notify all SongCards waiting for this file
        window.dispatchEvent(new CustomEvent('cover-loaded', { 
          detail: { filePath, cover } 
        }))
      }
    } catch (e) {
      // Ignore errors
    }
    activeLoads--
  }
}

const addToQueue = (filePath: string) => {
  if (!loadingQueue.includes(filePath)) {
    loadingQueue.push(filePath)
    processQueue()
  }
}

onMounted(() => {
  if (!cardRef.value || !props.song.filePath) return
  
  // Check cache first
  if (globalCoverCache.has(props.song.filePath)) {
    coverUrl.value = globalCoverCache.get(props.song.filePath)
    return
  }
  
  // Use IntersectionObserver to only load when visible
  observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (entry.isIntersecting && props.song.filePath) {
        // Add to queue when card becomes visible
        addToQueue(props.song.filePath)
        observer?.disconnect()
        break
      }
    }
  }, { threshold: 0.1, rootMargin: '100px' })
  
  observer.observe(cardRef.value)
  
  // Listen for cover loaded event
  const handleCoverLoaded = (e: CustomEvent) => {
    if (e.detail.filePath === props.song.filePath) {
      coverUrl.value = e.detail.cover
    }
  }
  window.addEventListener('cover-loaded', handleCoverLoaded as EventListener)
})

onUnmounted(() => {
  observer?.disconnect()
})
</script>

<template>
  <div class="song-card" ref="cardRef" @click="$emit('click')">
    <div class="card-cover" :style="{ backgroundImage: coverUrl ? `url(${coverUrl})` : 'none' }">
      <div v-if="!coverUrl" class="cover-placeholder">♪</div>
      <div class="play-overlay">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
          <path d="M8 5v14l11-7z" />
        </svg>
      </div>
    </div>
    <div class="card-info">
      <div class="card-title">{{ song.title }}</div>
      <div class="card-artist">{{ song.artist }}</div>
    </div>
  </div>
</template>

<style scoped>
.song-card {
  cursor: pointer;
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), 
              box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  opacity: 0;
  animation: fadeInUp 0.4s ease forwards;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(15px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.song-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 12px 24px rgba(0, 0, 0, 0.3);
}

.card-cover {
  aspect-ratio: 1;
  border-radius: 8px;
  background: var(--bg-secondary);
  background-size: cover;
  background-position: center;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.cover-placeholder {
  font-size: 40px;
  color: var(--text-secondary);
}

.play-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.25s ease;
}

.song-card:hover .play-overlay {
  opacity: 1;
}

.card-info {
  padding: 10px 0;
}

.card-title {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.card-artist {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>