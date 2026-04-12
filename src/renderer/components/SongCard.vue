<script setup lang="ts">
import { ref, onMounted } from 'vue'

const props = defineProps<{
  song: any
}>()

defineEmits<{
  click: []
}>()

const coverUrl = ref<string | undefined>(props.song.cover)

// Load cover on demand if not already loaded
onMounted(async () => {
  if (!coverUrl.value && props.song.filePath) {
    try {
      coverUrl.value = await window.electron.library.getSongCover(props.song.filePath)
    } catch (e) {
      // Ignore errors
    }
  }
})
</script>

<template>
  <div class="song-card" @click="$emit('click')">
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

.song-card:active {
  transform: translateY(-2px);
  box-shadow: 0 6px 12px rgba(0, 0, 0, 0.2);
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
  transition: transform 0.3s ease;
}

.song-card:hover .card-cover {
  transform: scale(1.02);
}

.cover-placeholder {
  font-size: 40px;
  color: var(--text-secondary);
  transition: transform 0.3s ease;
}

.song-card:hover .cover-placeholder {
  transform: scale(1.1);
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
  backdrop-filter: blur(2px);
}

.song-card:hover .play-overlay {
  opacity: 1;
}

.play-overlay svg {
  transition: transform 0.2s ease;
}

.song-card:hover .play-overlay svg {
  transform: scale(1.1);
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