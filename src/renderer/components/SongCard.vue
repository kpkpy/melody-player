<script setup lang="ts">
defineProps<{
  song: any
}>()

defineEmits<{
  click: []
}>()
</script>

<template>
  <div class="song-card" @click="$emit('click')">
    <div class="card-cover" :style="{ backgroundImage: song.cover ? `url(${song.cover})` : 'none' }">
      <div v-if="!song.cover" class="cover-placeholder">♪</div>
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
  transition: transform 0.2s;
}

.song-card:hover {
  transform: translateY(-4px);
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
  transition: opacity 0.2s;
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