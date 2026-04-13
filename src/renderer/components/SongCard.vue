<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps<{ song: any }>()
const emit = defineEmits<{ click: [] }>()

const coverUrl = ref<string>('')
const coverLoading = ref(false)
const coverLoaded = ref(false)
const coverError = ref(false)
let coverObserver: IntersectionObserver | null = null
const coverRef = ref<HTMLDivElement | null>(null)

// Load cover image on demand
const loadCover = async () => {
  if (coverLoaded.value || coverLoading.value || coverError.value) return
  
  coverLoading.value = true
  
  try {
    // First try from song.cover (if already loaded)
    if (props.song.cover) {
      coverUrl.value = props.song.cover
      coverLoaded.value = true
      return
    }
    
    // Load cover from main process on demand
    if (props.song.filePath && (window as any).electron?.library?.getSongCover) {
      const coverDataUrl = await window.electron.library.getSongCover(props.song.filePath)
      if (coverDataUrl) {
        coverUrl.value = coverDataUrl
        coverLoaded.value = true
      } else {
        coverError.value = true
      }
    } else {
      coverError.value = true
    }
  } catch (e) {
    console.error('Failed to load cover:', e)
    coverError.value = true
  } finally {
    coverLoading.value = false
  }
}

// Setup intersection observer for lazy loading
onMounted(() => {
  coverObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && !coverLoaded.value) {
          loadCover()
          coverObserver?.unobserve(entry.target)
        }
      })
    },
    { rootMargin: '100px' }
  )
  
  if (coverRef.value) {
    coverObserver.observe(coverRef.value)
  }
})

onUnmounted(() => {
  coverObserver?.disconnect()
})
</script>

<template>
  <div class="song-card" @click="emit('click')">
    <div class="card-cover" ref="coverRef">
      <!-- Loading state -->
      <div v-if="coverLoading" class="cover-loading">
        <div class="loading-spinner"></div>
      </div>
      
      <!-- Cover image or placeholder -->
      <div 
        v-else-if="coverLoaded && coverUrl" 
        class="cover-image"
        :style="{ backgroundImage: `url(${coverUrl})` }"
      ></div>
      <div v-else class="cover-placeholder">♪</div>
      
      <!-- Play overlay -->
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
  background: linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary));
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

/* Loading spinner */
.cover-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--bg-tertiary);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Cover image */
.cover-image {
  width: 100%;
  height: 100%;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

/* Placeholder */
.cover-placeholder {
  font-size: 48px;
  color: var(--text-secondary);
  opacity: 0.5;
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
