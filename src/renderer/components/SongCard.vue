<script setup lang="ts">
const props = defineProps<{ song: any }>()
defineEmits<{ click: [] }>()
</script>

<template>
  <div class="song-card" @click="$emit('click')">
    <div class="card-cover">
      <div class="cover-placeholder">♪</div>
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
