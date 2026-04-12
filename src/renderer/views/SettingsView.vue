<script setup lang="ts">
import { ref, onMounted, onUnmounted, toRaw } from 'vue'
import { useMusicStore } from '@/stores/music'

const musicStore = useMusicStore()
const newDir = ref('')
const musicDirs = ref<string[]>([])

// Scan result display
const scanResult = ref<{ count: number; added: number; parseErrors: number } | null>(null)

// YouTube download state
const youtubeUrl = ref('')
const customAuthor = ref('')
const youtubeDownloadDir = ref('')
const isDownloading = ref(false)
const downloadProgress = ref<{ status: string; progress: number; message: string; videoTitle?: string } | null>(null)
const videoPreview = ref<{ title: string; author: string; thumbnail: string; duration: number } | null>(null)
const ytDlpAvailable = ref(false)

onMounted(async () => {
  musicDirs.value = await window.electron.config.getMusicDirs()
  youtubeDownloadDir.value = await window.electron.youtube.getDownloadDir()
  ytDlpAvailable.value = await window.electron.youtube.isAvailable()
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

const scanAll = async (forceRescan: boolean = false) => {
  if (musicDirs.value.length === 0) return
  const paths = toRaw(musicDirs.value)
  scanResult.value = null
  const result = await musicStore.scanLibrary(paths, forceRescan)
  if (result) {
    scanResult.value = { count: result.count, added: result.added, parseErrors: result.parseErrors }
  }
}

const clearCache = async () => {
  await window.electron.library.clearCache()
}

let removeListener: (() => void) | null = null

onMounted(() => {
  removeListener = window.electron.library.onScanProgress((progress) => {
    musicStore.setProgress(progress)
  })
})

onUnmounted(() => {
  if (removeListener) removeListener()
  if (youtubeListener) youtubeListener()
})

// YouTube download functions
let youtubeListener: (() => void) | null = null

onMounted(() => {
  youtubeListener = window.electron.youtube.onDownloadProgress((progress) => {
    downloadProgress.value = progress
    if (progress.status === 'completed' || progress.status === 'error') {
      isDownloading.value = false
    }
  })
})

const getVideoInfo = async () => {
  if (!youtubeUrl.value) return
  
  const isValid = await window.electron.youtube.isValidUrl(youtubeUrl.value)
  if (!isValid) {
    videoPreview.value = null
    return
  }

  try {
    const result = await window.electron.youtube.getVideoInfo(youtubeUrl.value)
    if (result.success) {
      videoPreview.value = {
        title: result.info.title,
        author: result.info.author,
        thumbnail: result.info.thumbnail,
        duration: result.info.duration
      }
      if (!customAuthor.value) {
        customAuthor.value = result.info.author
      }
    } else {
      videoPreview.value = null
    }
  } catch {
    videoPreview.value = null
  }
}

const startDownload = async () => {
  if (!youtubeUrl.value || isDownloading.value) return
  
  const isValid = await window.electron.youtube.isValidUrl(youtubeUrl.value)
  if (!isValid) {
    downloadProgress.value = { status: 'error', progress: 0, message: '无效的 YouTube URL' }
    return
  }

  isDownloading.value = true
  downloadProgress.value = { status: 'downloading', progress: 0, message: '准备下载...' }

  try {
    const result = await window.electron.youtube.download(youtubeUrl.value, customAuthor.value)
    if (result.success) {
      if (result.isDuplicate) {
        // Song already exists in library
        downloadProgress.value = { 
          status: 'completed', 
          progress: 100, 
          message: '歌曲已存在于音乐库中（重复），未新增' 
        }
      } else {
        // Refresh library - include both user dirs and download dir
        const downloadDir = await window.electron.youtube.getDownloadDir()
        const allPaths = [...toRaw(musicDirs.value), downloadDir]
        await musicStore.scanLibrary(allPaths, false)
        downloadProgress.value = { 
          status: 'completed', 
          progress: 100, 
          message: '下载完成并已添加到音乐库！' 
        }
      }
      // Reset form
      youtubeUrl.value = ''
      videoPreview.value = null
      customAuthor.value = ''
    } else {
      downloadProgress.value = { status: 'error', progress: 0, message: result.error || '下载失败' }
      isDownloading.value = false
    }
  } catch (e: any) {
    downloadProgress.value = { status: 'error', progress: 0, message: e.message || '下载失败' }
    isDownloading.value = false
  }
}

const cancelDownload = async () => {
  await window.electron.youtube.cancelDownload()
  isDownloading.value = false
  downloadProgress.value = { status: 'error', progress: 0, message: '下载已取消' }
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="settings-view">
    <h1 class="animate-fade-in-up">设置</h1>

    <section class="settings-section animate-fade-in-up delay-100">
      <h2>音乐文件夹</h2>
      <p class="section-desc">添加包含音乐文件的文件夹，应用会自动扫描其中的所有音频文件。</p>
      
      <TransitionGroup name="list" tag="div" class="dir-list">
        <div v-for="(dir, index) in musicDirs" :key="dir" class="dir-item">
          <span class="dir-path">{{ dir }}</span>
          <button class="remove-btn" @click="removeDir(index)" :disabled="musicStore.isLoading">移除</button>
        </div>
      </TransitionGroup>

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
          <span>{{
            musicStore.scanProgress.phase === 'scanning' ? '扫描中...' :
            musicStore.scanProgress.phase === 'parsing' ? '解析中...' : '加载缓存...'
          }}</span>
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

      <div class="btn-group">
        <button
          class="scan-btn"
          @click="scanAll(false)"
          :disabled="musicStore.isLoading || musicDirs.length === 0"
        >
          {{ musicStore.isLoading ? '处理中...' : '增量扫描' }}
        </button>
        <button
          class="scan-btn secondary"
          @click="scanAll(true)"
          :disabled="musicStore.isLoading || musicDirs.length === 0"
        >
          强制重新扫描
        </button>
      </div>
      <p class="hint">增量扫描只解析新增或修改的文件，强制重新扫描会解析所有文件</p>
      <div v-if="scanResult" class="scan-result">
        <p>扫描完成！共发现 <strong>{{ scanResult.count }}</strong> 个音频文件，成功添加 <strong>{{ scanResult.added }}</strong> 首，解析失败 <strong>{{ scanResult.parseErrors }}</strong> 个</p>
      </div>
    </section>

    <section class="settings-section animate-fade-in-up delay-200">
      <h2>缓存管理</h2>
      <p class="section-desc">清除缓存后下次启动需要重新扫描音乐文件</p>
      <button class="scan-btn secondary" @click="clearCache">清除缓存</button>
    </section>

    <section class="settings-section animate-fade-in-up delay-300">
      <h2>关于</h2>
      <p>Melody Player v1.0.0</p>
      <p class="section-desc">一个简洁美观的本地音乐播放器</p>
    </section>

    <section class="settings-section animate-fade-in-up delay-400">
      <h2>YouTube 音频下载</h2>
      <p class="section-desc">输入 YouTube 视频链接，自动下载并转换为音频文件。视频名称作为音频名称，封面作为元数据。</p>
      
      <div class="youtube-form">
        <div class="input-group">
          <input
            v-model="youtubeUrl"
            type="text"
            placeholder="输入 YouTube 视频链接..."
            @blur="getVideoInfo"
            @keyup.enter="getVideoInfo"
            :disabled="isDownloading || !ytDlpAvailable"
          />
          <input
            v-model="customAuthor"
            type="text"
            placeholder="自定义作者（可选）"
            :disabled="isDownloading || !ytDlpAvailable"
            class="author-input"
          />
        </div>

        <!-- Video preview -->
        <div v-if="videoPreview" class="video-preview">
          <img 
            v-if="videoPreview.thumbnail" 
            :src="videoPreview.thumbnail" 
            alt="Video thumbnail" 
            class="video-thumbnail"
          />
          <div class="video-info">
            <h3 class="video-title">{{ videoPreview.title }}</h3>
            <p class="video-author">{{ videoPreview.author }}</p>
            <p class="video-duration">{{ formatDuration(videoPreview.duration) }}</p>
          </div>
        </div>

        <!-- Download progress -->
        <div v-if="downloadProgress" class="download-progress">
          <div class="progress-header">
            <span class="progress-status">
              {{ downloadProgress.status === 'downloading' ? '下载中...' :
                 downloadProgress.status === 'converting' ? '转换中...' :
                 downloadProgress.status === 'writing_metadata' ? '写入元数据...' :
                 downloadProgress.status === 'completed' ? '完成！' : '错误' }}
            </span>
            <span v-if="downloadProgress.videoTitle" class="progress-title">{{ downloadProgress.videoTitle }}</span>
          </div>
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              :style="{ width: `${downloadProgress.progress}%` }"
            ></div>
          </div>
          <p class="progress-message">{{ downloadProgress.message }}</p>
        </div>

        <div class="btn-group">
          <button
            class="download-btn"
            @click="startDownload"
            :disabled="isDownloading || !youtubeUrl || !ytDlpAvailable"
          >
            {{ isDownloading ? '下载中...' : '开始下载' }}
          </button>
          <button
            v-if="isDownloading"
            class="cancel-btn"
            @click="cancelDownload"
          >
            取消
          </button>
        </div>

        <p v-if="!ytDlpAvailable" class="warning-text">
          ⚠️ yt-dlp 工具未安装。首次下载时会自动安装，请稍候。
        </p>

        <div class="download-dir-info">
          <p class="dir-label">下载目录：</p>
          <p class="dir-value">{{ youtubeDownloadDir }}</p>
        </div>
      </div>
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
  opacity: 0;
}

.settings-section {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
  opacity: 0;
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
  padding: 14px 24px;
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

.scan-btn.secondary {
  background: rgba(255, 255, 255, 0.1);
}

.scan-btn.secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.btn-group {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.btn-group .scan-btn {
  flex: 1;
}

.hint {
  font-size: 12px;
  color: var(--text-secondary);
  opacity: 0.7;
}

.scan-result {
  margin-top: 12px;
  padding: 12px 16px;
  background: rgba(233, 69, 96, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(233, 69, 96, 0.2);
}

.scan-result p {
  font-size: 14px;
  color: var(--accent);
}

.scan-result strong {
  font-weight: 600;
}

/* 列表动画 */
.list-enter-active,
.list-leave-active {
  transition: all 0.3s ease;
}

.list-enter-from {
  opacity: 0;
  transform: translateX(-10px);
}

.list-leave-to {
  opacity: 0;
  transform: translateX(10px);
}

.list-move {
  transition: transform 0.3s ease;
}

/* YouTube download styles */
.youtube-form {
  margin-top: 16px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.input-group input {
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 14px;
}

.input-group input:focus {
  outline: none;
  background: rgba(255, 255, 255, 0.15);
}

.author-input {
  font-size: 13px;
}

.video-preview {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  margin-bottom: 16px;
}

.video-thumbnail {
  width: 120px;
  height: 90px;
  object-fit: cover;
  border-radius: 8px;
}

.video-info {
  flex: 1;
}

.video-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  line-height: 1.3;
}

.video-author {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 4px;
}

.video-duration {
  color: var(--text-secondary);
  font-size: 12px;
}

.download-progress {
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 16px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.progress-status {
  font-size: 14px;
  font-weight: 500;
  color: var(--accent);
}

.progress-title {
  font-size: 13px;
  color: var(--text-secondary);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-message {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 8px;
}

.download-btn {
  padding: 14px 24px;
  background: var(--accent);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.download-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.download-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cancel-btn {
  padding: 14px 24px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 14px;
}

.cancel-btn:hover {
  background: rgba(233, 69, 96, 0.2);
}

.warning-text {
  font-size: 13px;
  color: #f59e0b;
  margin-top: 12px;
}

.download-dir-info {
  margin-top: 16px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
}

.dir-label {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.dir-value {
  font-size: 13px;
  color: var(--text-primary);
}
</style>