<script setup lang="ts">
import { ref, onMounted, onUnmounted, toRaw } from 'vue'
import { useMusicStore } from '@/stores/music'

const musicStore = useMusicStore()
const newDir = ref('')
const musicDirs = ref<string[]>([])

onMounted(async () => {
  musicDirs.value = await window.electron.config.getMusicDirs()
})

const addDir = async () => {
  if (newDir.value && !musicDirs.value.includes(newDir.value)) {
    musicDirs.value.push(newDir.value)
    await window.electron.config.setMusicDirs(toRaw(musicDirs.value))
    newDir.value = ''
  }
}

const removeDir = async (index: number) => {
  musicDirs.value.splice(index, 1)
  await window.electron.config.setMusicDirs(toRaw(musicDirs.value))
}

const scanAll = async () => {
  if (musicDirs.value.length === 0) return
  const paths = [...musicDirs.value]
  await musicStore.scanLibrary(paths)
}

let removeListener: (() => void) | null = null

onMounted(() => {
  removeListener = window.electron.library.onScanProgress((progress) => {
    musicStore.setProgress(progress)
  })
})

onUnmounted(() => {
  if (removeListener) removeListener()
})
</script>

<template>
  <div class="settings-view">
    <h1>设置</h1>

    <section class="settings-section">
      <h2>音乐文件夹</h2>
      <p class="section-desc">添加包含音乐文件的文件夹，应用会自动扫描其中的所有音频文件。</p>
      
      <div class="dir-list">
        <div v-for="(dir, index) in musicDirs" :key="index" class="dir-item">
          <span class="dir-path">{{ dir }}</span>
          <button class="remove-btn" @click="removeDir(index)" :disabled="musicStore.isLoading">移除</button>
        </div>
      </div>

      <div class="add-dir-form">
        <input
          v-model="newDir"
          type="text"
          placeholder="输入文件夹路径..."
          @keyup.enter="addDir"
          :disabled="musicStore.isLoading"
        />
        <button class="add-btn" @click="addDir" :disabled="musicStore.isLoading">添加</button>
      </div>

      <div v-if="musicStore.scanProgress" class="progress-section">
        <div class="progress-info">
          <span>{{ musicStore.scanProgress.phase === 'scanning' ? '扫描中...' : '解析中...' }}</span>
          <span>{{ musicStore.scanProgress.current }} / {{ musicStore.scanProgress.total }}</span>
        </div>
        <div class="progress-bar">
          <div 
            class="progress-fill" 
            :style="{ width: `${musicStore.scanProgress.total > 0 ? (musicStore.scanProgress.current / musicStore.scanProgress.total * 100) : 0}%` }"
          ></div>
        </div>
        <div v-if="musicStore.scanProgress.currentFile" class="current-file">
          {{ musicStore.scanProgress.currentFile.split(/[/\\]/).pop() }}
        </div>
      </div>

      <button
        class="scan-btn"
        @click="scanAll"
        :disabled="musicStore.isLoading || musicDirs.length === 0"
      >
        {{ musicStore.isLoading ? '扫描中...' : '扫描音乐库' }}
      </button>
    </section>

    <section class="settings-section">
      <h2>关于</h2>
      <p>Melody Player v1.0.0</p>
      <p class="section-desc">一个简洁美观的本地音乐播放器</p>
    </section>
  </div>
</template>

<style scoped>
.settings-view {
  max-width: 700px;
  margin: 0 auto;
}

.settings-view h1 {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 40px;
}

.settings-section {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
}

.settings-section h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.section-desc {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 20px;
}

.dir-list {
  margin-bottom: 16px;
}

.dir-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 8px;
}

.dir-path {
  font-size: 14px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.remove-btn {
  padding: 6px 12px;
  font-size: 12px;
  color: var(--accent);
}

.remove-btn:hover:not(:disabled) {
  background: rgba(233, 69, 96, 0.1);
  border-radius: 4px;
}

.add-dir-form {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
}

.add-dir-form input {
  flex: 1;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 14px;
}

.add-dir-form input:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.15);
}

.add-btn {
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 14px;
}

.add-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.progress-section {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 20px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 10px;
}

.progress-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s ease;
}

.current-file {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.scan-btn {
  width: 100%;
  padding: 14px;
  background: var(--accent);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.scan-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.scan-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>