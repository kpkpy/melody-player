<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { usePlaylistStore } from '@/stores/playlist'
import { useMusicStore } from '@/stores/music'

interface DeviceInfo {
  id: string
  drive: string
  label: string
  type: 'usb' | 'fixed' | 'network' | 'unknown'
  totalSize: number
  freeSize: number
  usedSize: number
  fileSystem?: string
  serialNumber?: string
  musicFolder?: string
  playlistFolder?: string
  songCount: number
  playlistCount: number
  lastSyncTime?: number
  customName?: string
  isKnown: boolean
}

interface SyncPreview {
  toCopy: any[]
  toDelete: string[]
  toUpdate: any[]
  playlistsToSync: { id: string; name: string; songCount: number }[]
  totalSize: number
  freeSpaceAfter: number
}

interface LibrarySyncResult {
  success: boolean
  message: string
  songsCopied: number
  songsSkipped: number
  songsDeleted: number
  playlistsSynced: number
  errors: string[]
  totalSize: number
  duration: number
}

const playlistStore = usePlaylistStore()
const musicStore = useMusicStore()

const devices = ref<DeviceInfo[]>([])
const selectedDevice = ref<DeviceInfo | null>(null)
const isDetecting = ref(false)
const isSyncing = ref(false)
const isPreviewing = ref(false)
const syncPreview = ref<SyncPreview | null>(null)
const syncResult = ref<LibrarySyncResult | null>(null)
const message = ref('')
const editingName = ref(false)
const customName = ref('')
const showSettings = ref(false)

const syncOptions = ref({
  syncSongs: true,
  syncPlaylists: true,
  deleteRemoved: false
})

const syncProgress = ref<{ phase: string; current: number; total: number; message: string } | null>(null)

let removeProgressListener: (() => void) | null = null
let removeDeviceListener: (() => void) | null = null
let removeScanListener: (() => void) | null = null

onMounted(async () => {
  await playlistStore.loadPlaylists()
  
  removeProgressListener = window.electron.sync.onProgress((progress) => {
    syncProgress.value = progress
  })
  
  removeScanListener = window.electron.device.onScanProgress((progress) => {
    syncProgress.value = progress
  })
  
  removeDeviceListener = window.electron.device.onChange((data) => {
    if (data.event === 'connected') {
      detectDevices()
    } else if (data.event === 'disconnected') {
      if (selectedDevice.value?.id === data.device.id) {
        selectedDevice.value = null
        syncPreview.value = null
      }
      detectDevices()
    }
  })
  
  await detectDevices()
})

onUnmounted(() => {
  if (removeProgressListener) removeProgressListener()
  if (removeDeviceListener) removeDeviceListener()
  if (removeScanListener) removeScanListener()
})

const detectDevices = async () => {
  isDetecting.value = true
  try {
    devices.value = await window.electron.device.detect()
  } finally {
    isDetecting.value = false
  }
}

const selectDevice = (device: DeviceInfo) => {
  selectedDevice.value = device
  syncPreview.value = null
  syncResult.value = null
  customName.value = device.customName || device.label
}

const startEditName = () => {
  customName.value = selectedDevice.value?.customName || selectedDevice.value?.label || ''
  editingName.value = true
}

const saveName = async () => {
  if (selectedDevice.value && customName.value.trim()) {
    await window.electron.device.updateName(selectedDevice.value.id, customName.value.trim())
    selectedDevice.value.customName = customName.value.trim()
    selectedDevice.value.label = customName.value.trim()
  }
  editingName.value = false
}

const forgetDevice = async () => {
  if (selectedDevice.value) {
    await window.electron.device.forget(selectedDevice.value.id)
    selectedDevice.value.isKnown = false
    selectedDevice.value.lastSyncTime = undefined
    selectedDevice.value.customName = undefined
    message.value = '已移除设备记忆'
  }
}

const previewSync = async () => {
  if (!selectedDevice.value) return
  
  isPreviewing.value = true
  syncPreview.value = null
  message.value = ''
  
  try {
    const result = await window.electron.device.previewSync(selectedDevice.value.id, {
      syncSongs: syncOptions.value.syncSongs,
      syncPlaylists: syncOptions.value.syncPlaylists,
      deleteRemoved: syncOptions.value.deleteRemoved
    })
    
    if (result.error) {
      message.value = `预览失败: ${result.error}`
    } else {
      syncPreview.value = result
    }
  } catch (e: any) {
    message.value = `预览失败: ${e.message || e}`
  } finally {
    isPreviewing.value = false
  }
}

const startSync = async () => {
  if (!selectedDevice.value) return
  
  isSyncing.value = true
  syncProgress.value = null
  syncResult.value = null
  message.value = ''
  
  try {
    const result = await window.electron.device.syncTo(selectedDevice.value.id, {
      syncSongs: syncOptions.value.syncSongs,
      syncPlaylists: syncOptions.value.syncPlaylists,
      deleteRemoved: syncOptions.value.deleteRemoved
    })
    syncResult.value = result
    message.value = result.message
    
    if (result.success) {
      selectedDevice.value.lastSyncTime = Date.now()
    }
  } catch (e: any) {
    message.value = `同步失败: ${e.message || e}`
  } finally {
    isSyncing.value = false
    syncProgress.value = null
    syncPreview.value = null
  }
}

const formatSize = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

const formatDate = (timestamp: number): string => {
  if (!timestamp) return '从未'
  const date = new Date(timestamp)
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString()
}

const formatDuration = (ms: number): string => {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}秒`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}分${remainingSeconds}秒`
}

const usagePercent = computed(() => {
  if (!selectedDevice.value || selectedDevice.value.totalSize === 0) return 0
  return Math.round((selectedDevice.value.usedSize / selectedDevice.value.totalSize) * 100)
})

const deviceIcon = computed(() => {
  if (!selectedDevice.value) return '💾'
  return selectedDevice.value.isKnown ? '🎧' : '📱'
})

const oldExportPlaylist = async (playlistId: string) => {
  try {
    const path = await window.electron.sync.exportPlaylist(playlistId)
    if (path) message.value = `已导出到: ${path}`
  } catch (e) {
    message.value = `导出失败: ${e}`
  }
}

const oldImportM3U = async () => {
  try {
    const result = await window.electron.sync.importM3U()
    if (result) {
      const playlist = await playlistStore.createPlaylist(result.name)
      for (const song of result.songs) {
        const found = musicStore.songs.find(
          s => s.title.toLowerCase() === song.title.toLowerCase() &&
               (!song.artist || s.artist.toLowerCase().includes(song.artist.toLowerCase()))
        )
        if (found) await playlistStore.addSong(playlist.id, found.id)
      }
      message.value = `已导入歌单: ${playlist.name}`
    }
  } catch (e) {
    message.value = `导入失败: ${e}`
  }
}

const oldExportAll = async () => {
  try {
    const path = await window.electron.sync.exportAll()
    if (path) message.value = `已导出到: ${path}`
  } catch (e) {
    message.value = `导出失败: ${e}`
  }
}

const oldImportAll = async () => {
  try {
    const count = await window.electron.sync.importAll()
    message.value = `已导入 ${count} 个歌单`
    await playlistStore.loadPlaylists()
  } catch (e) {
    message.value = `导入失败: ${e}`
  }
}
</script>

<template>
  <div class="sync-view">
    <h1>设备同步</h1>

    <!-- 设备检测 -->
    <section class="sync-section">
      <div class="section-header">
        <h2>检测设备</h2>
        <button class="refresh-btn" @click="detectDevices" :disabled="isDetecting">
          {{ isDetecting ? '检测中...' : '刷新' }}
        </button>
      </div>
      
      <div v-if="devices.length > 0" class="device-grid">
        <div 
          v-for="device in devices" 
          :key="device.id"
          class="device-card"
          :class="{ selected: selectedDevice?.id === device.id, known: device.isKnown }"
          @click="selectDevice(device)"
        >
          <div class="device-status">
            <span v-if="device.isKnown" class="known-badge">已记忆</span>
          </div>
          
          <div class="device-icon">{{ device.isKnown ? '🎧' : '📱' }}</div>
          
          <div class="device-name">{{ device.customName || device.label }}</div>
          <div class="device-drive">{{ device.drive }}</div>
          
          <div class="device-capacity">
            <div class="capacity-bar">
              <div class="capacity-used" :style="{ width: `${(device.usedSize / device.totalSize * 100) || 0}%` }"></div>
            </div>
            <div class="capacity-text">
              {{ formatSize(device.freeSize) }} 可用 / {{ formatSize(device.totalSize) }}
            </div>
          </div>
          
          <div class="device-stats">
            <div class="stat">
              <span class="stat-value">{{ device.songCount }}</span>
              <span class="stat-label">首歌曲</span>
            </div>
            <div class="stat">
              <span class="stat-value">{{ device.playlistCount }}</span>
              <span class="stat-label">个歌单</span>
            </div>
          </div>
          
          <div v-if="device.lastSyncTime" class="last-sync">
            上次同步: {{ formatDate(device.lastSyncTime) }}
          </div>
        </div>
      </div>
      
      <div v-else class="empty-state">
        <div class="empty-icon">🔌</div>
        <p>未检测到设备</p>
        <p class="empty-hint">请连接随身播放器后点击刷新</p>
      </div>
    </section>

    <!-- 设备详情和同步 -->
    <section v-if="selectedDevice" class="sync-section device-detail">
      <div class="detail-header">
        <div class="device-title">
          <span class="device-icon-large">{{ deviceIcon }}</span>
          <div class="title-info">
            <div v-if="editingName" class="name-edit">
              <input v-model="customName" @keyup.enter="saveName" @keyup.escape="editingName = false" />
              <button class="save-btn" @click="saveName">保存</button>
            </div>
            <div v-else class="name-display" @click="startEditName">
              {{ selectedDevice.customName || selectedDevice.label }}
              <span class="edit-hint">点击编辑</span>
            </div>
            <div class="device-meta">
              {{ selectedDevice.drive }} · {{ selectedDevice.fileSystem || '未知格式' }}
              <span v-if="selectedDevice.serialNumber">· SN: {{ selectedDevice.serialNumber }}</span>
            </div>
          </div>
        </div>
        <button class="forget-btn" @click="forgetDevice" v-if="selectedDevice.isKnown">
          移除记忆
        </button>
      </div>

      <!-- 容量显示 -->
      <div class="capacity-section">
        <div class="capacity-visual">
          <div class="capacity-ring">
            <svg viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="45" class="ring-bg" />
              <circle 
                cx="50" cy="50" r="45" 
                class="ring-used" 
                :style="{ strokeDashoffset: 283 - (283 * usagePercent / 100) }"
              />
            </svg>
            <div class="ring-text">
              <div class="ring-percent">{{ usagePercent }}%</div>
              <div class="ring-label">已使用</div>
            </div>
          </div>
        </div>
        
        <div class="capacity-details">
          <div class="detail-item">
            <span class="detail-label">总容量</span>
            <span class="detail-value">{{ formatSize(selectedDevice.totalSize) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">已使用</span>
            <span class="detail-value">{{ formatSize(selectedDevice.usedSize) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">可用空间</span>
            <span class="detail-value available">{{ formatSize(selectedDevice.freeSize) }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">歌曲数量</span>
            <span class="detail-value">{{ selectedDevice.songCount }} 首</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">歌单数量</span>
            <span class="detail-value">{{ selectedDevice.playlistCount }} 个</span>
          </div>
        </div>
      </div>

      <!-- 同步选项 -->
      <div class="sync-options">
        <h3>同步选项</h3>
        
        <label class="option-item">
          <input type="checkbox" v-model="syncOptions.syncSongs" />
          <div class="option-info">
            <span class="option-title">同步音乐库</span>
            <span class="option-desc">将本地音乐库的所有歌曲复制到设备</span>
          </div>
        </label>
        
        <label class="option-item">
          <input type="checkbox" v-model="syncOptions.syncPlaylists" />
          <div class="option-info">
            <span class="option-title">同步歌单</span>
            <span class="option-desc">将所有歌单导出为 M3U 格式到设备</span>
          </div>
        </label>
        
        <label class="option-item">
          <input type="checkbox" v-model="syncOptions.deleteRemoved" />
          <div class="option-info">
            <span class="option-title">清理已移除的歌曲</span>
            <span class="option-desc">删除设备上已从本地库移除的歌曲</span>
          </div>
        </label>
      </div>

      <!-- 同步预览 -->
      <div class="sync-actions">
        <button class="preview-btn" @click="previewSync" :disabled="isPreviewing || isSyncing">
          {{ isPreviewing ? '分析中...' : '预览变更' }}
        </button>
      </div>

      <!-- 预览结果 -->
      <div v-if="syncPreview" class="preview-result">
        <h4>同步预览</h4>
        
        <div class="preview-stats">
          <div class="preview-stat add" v-if="syncPreview.toCopyCount > 0">
            <span class="stat-icon">📥</span>
            <span class="stat-text">新增 {{ syncPreview.toCopyCount }} 首歌曲</span>
            <span class="stat-size">{{ formatSize(syncPreview.totalSize) }}</span>
          </div>
          
          <div class="preview-stat skip" v-if="syncPreview.toCopyCount === 0 && syncOptions.syncSongs">
            <span class="stat-icon">✓</span>
            <span class="stat-text">所有歌曲已存在，无需复制</span>
          </div>
          
          <div class="preview-stat delete" v-if="syncPreview.toDeleteCount > 0">
            <span class="stat-icon">🗑️</span>
            <span class="stat-text">删除 {{ syncPreview.toDeleteCount }} 首歌曲</span>
          </div>
          
          <div class="preview-stat playlist" v-if="syncPreview.playlistsToSync.length > 0">
            <span class="stat-icon">📋</span>
            <span class="stat-text">同步 {{ syncPreview.playlistsToSync.length }} 个歌单</span>
          </div>
        </div>
        
        <div class="preview-info" v-if="selectedDevice">
          <p><strong>目标目录:</strong> {{ selectedDevice.musicFolder || selectedDevice.drive }}</p>
          <p><strong>文件命名:</strong> 艺术家 - 歌曲名.扩展名</p>
        </div>
        
        <div class="preview-space" v-if="syncOptions.syncSongs">
          同步后可用空间: {{ formatSize(syncPreview.freeSpaceAfter) }}
        </div>
        
        <button 
          class="sync-btn" 
          @click="startSync" 
          :disabled="isSyncing || (syncPreview.toCopyCount === 0 && syncPreview.toDeleteCount === 0 && syncPreview.playlistsToSync.length === 0)"
        >
          {{ isSyncing ? '同步中...' : '开始同步' }}
        </button>
      </div>

      <!-- 同步进度 -->
      <div v-if="syncProgress && isSyncing" class="sync-progress">
        <div class="progress-info">
          <span class="progress-phase">{{ syncProgress.phase }}</span>
          <span class="progress-count">{{ syncProgress.current }} / {{ syncProgress.total }}</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${syncProgress.total > 0 ? (syncProgress.current / syncProgress.total * 100) : 0}%` }"></div>
        </div>
        <div class="progress-message">{{ syncProgress.message }}</div>
      </div>

      <!-- 同步结果 -->
      <div v-if="syncResult" class="sync-result" :class="{ success: syncResult.success, error: !syncResult.success }">
        <div class="result-summary">
          <span class="result-icon">{{ syncResult.success ? '✅' : '❌' }}</span>
          <span class="result-message">{{ syncResult.message }}</span>
        </div>
        
        <div class="result-stats" v-if="syncResult.success">
          <div v-if="syncResult.songsCopied > 0">复制: {{ syncResult.songsCopied }} 首</div>
          <div v-if="syncResult.songsSkipped > 0">跳过: {{ syncResult.songsSkipped }} 首</div>
          <div v-if="syncResult.songsDeleted > 0">删除: {{ syncResult.songsDeleted }} 首</div>
          <div v-if="syncResult.playlistsSynced > 0">歌单: {{ syncResult.playlistsSynced }} 个</div>
        </div>
        
        <div v-if="syncResult.errors.length > 0" class="result-errors">
          <details>
            <summary>{{ syncResult.errors.length }} 个错误</summary>
            <ul>
              <li v-for="(error, i) in syncResult.errors" :key="i">{{ error }}</li>
            </ul>
          </details>
        </div>
      </div>
    </section>

    <!-- 手动导入导出 -->
    <section class="sync-section">
      <h2>手动导入导出</h2>
      <p class="section-desc">导出歌单文件用于其他播放器</p>
      
      <div class="action-row">
        <button class="secondary-btn" @click="oldImportM3U">导入 M3U</button>
        <button class="secondary-btn" @click="oldExportAll">导出全部歌单</button>
        <button class="secondary-btn" @click="oldImportAll">导入全部歌单</button>
      </div>

      <div class="playlist-export">
        <div v-for="playlist in playlistStore.playlists" :key="playlist.id" class="playlist-item">
          <span class="playlist-name">{{ playlist.name }}</span>
          <span class="playlist-count">{{ playlist.songIds.length }} 首</span>
          <button class="export-btn" @click="oldExportPlaylist(playlist.id)">导出</button>
        </div>
      </div>
    </section>

    <div v-if="message" class="toast" @click="message = ''">{{ message }}</div>
  </div>
</template>

<style scoped>
.sync-view {
  max-width: 900px;
  margin: 0 auto;
}

.sync-view h1 {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 32px;
}

.sync-section {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 16px;
  padding: 24px;
  margin-bottom: 24px;
}

.sync-section h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
}

.sync-section h3 {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--text-secondary);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-desc {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 16px;
}

.refresh-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  font-size: 13px;
}

.refresh-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
}

.device-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
}

.device-card {
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  cursor: pointer;
  border: 2px solid transparent;
  transition: all 0.2s;
}

.device-card:hover {
  background: rgba(255, 255, 255, 0.08);
  transform: translateY(-2px);
}

.device-card.selected {
  border-color: var(--accent);
  background: rgba(233, 69, 96, 0.1);
}

.device-card.known {
  background: rgba(46, 204, 113, 0.08);
}

.device-card.known.selected {
  border-color: #2ecc71;
}

.device-status {
  height: 20px;
  margin-bottom: 8px;
}

.known-badge {
  font-size: 11px;
  padding: 2px 8px;
  background: rgba(46, 204, 113, 0.2);
  color: #2ecc71;
  border-radius: 10px;
}

.device-card .device-icon {
  font-size: 32px;
  text-align: center;
  margin-bottom: 8px;
}

.device-card .device-name {
  font-weight: 600;
  text-align: center;
  margin-bottom: 4px;
}

.device-card .device-drive {
  font-size: 12px;
  color: var(--text-secondary);
  text-align: center;
  margin-bottom: 12px;
}

.capacity-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  margin-bottom: 6px;
}

.capacity-used {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
}

.capacity-text {
  font-size: 11px;
  color: var(--text-secondary);
  text-align: center;
}

.device-stats {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.device-stats .stat {
  text-align: center;
}

.stat-value {
  display: block;
  font-weight: 600;
  font-size: 16px;
}

.stat-label {
  font-size: 11px;
  color: var(--text-secondary);
}

.last-sync {
  font-size: 11px;
  color: var(--text-secondary);
  text-align: center;
  margin-top: 8px;
}

.empty-state {
  text-align: center;
  padding: 48px 24px;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.empty-hint {
  font-size: 13px;
  color: var(--text-secondary);
}

/* Device Detail */
.device-detail {
  background: rgba(255, 255, 255, 0.05);
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 24px;
}

.device-title {
  display: flex;
  gap: 16px;
}

.device-icon-large {
  font-size: 48px;
}

.title-info .name-display {
  font-size: 24px;
  font-weight: 700;
  cursor: pointer;
}

.title-info .edit-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-left: 8px;
}

.name-edit {
  display: flex;
  gap: 8px;
}

.name-edit input {
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  font-size: 16px;
  width: 200px;
}

.save-btn {
  padding: 8px 16px;
  background: var(--accent);
  border-radius: 6px;
}

.device-meta {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
}

.forget-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  font-size: 13px;
  color: #e74c3c;
}

/* Capacity Section */
.capacity-section {
  display: flex;
  gap: 32px;
  margin-bottom: 24px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
}

.capacity-visual {
  flex-shrink: 0;
}

.capacity-ring {
  width: 120px;
  height: 120px;
  position: relative;
}

.capacity-ring svg {
  transform: rotate(-90deg);
  width: 100%;
  height: 100%;
}

.ring-bg {
  fill: none;
  stroke: rgba(255, 255, 255, 0.1);
  stroke-width: 8;
}

.ring-used {
  fill: none;
  stroke: var(--accent);
  stroke-width: 8;
  stroke-dasharray: 283;
  transition: stroke-dashoffset 0.5s;
}

.ring-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.ring-percent {
  font-size: 24px;
  font-weight: 700;
}

.ring-label {
  font-size: 11px;
  color: var(--text-secondary);
}

.capacity-details {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  align-content: center;
}

.detail-item {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.detail-label {
  color: var(--text-secondary);
  font-size: 13px;
}

.detail-value {
  font-weight: 500;
}

.detail-value.available {
  color: #2ecc71;
}

/* Sync Options */
.sync-options {
  margin-bottom: 24px;
}

.option-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
}

.option-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.option-item input[type="checkbox"] {
  width: 18px;
  height: 18px;
  margin-top: 2px;
}

.option-info {
  flex: 1;
}

.option-title {
  display: block;
  font-weight: 500;
}

.option-desc {
  display: block;
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
}

/* Sync Actions */
.sync-actions {
  margin-bottom: 24px;
}

.preview-btn {
  width: 100%;
  padding: 14px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
}

.preview-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
}

/* Preview Result */
.preview-result {
  padding: 20px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  margin-bottom: 24px;
}

.preview-result h4 {
  margin-bottom: 16px;
}

.preview-stats {
  margin-bottom: 16px;
}

.preview-stat {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
}

.preview-stat.add { color: #2ecc71; }
.preview-stat.delete { color: #e74c3c; }
.preview-stat.playlist { color: #3498db; }
.preview-stat.skip { color: var(--text-secondary); }

.stat-icon {
  font-size: 20px;
}

.stat-text {
  flex: 1;
}

.stat-size {
  font-size: 13px;
  color: var(--text-secondary);
}

.preview-info {
  font-size: 13px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  margin-bottom: 12px;
}

.preview-info p {
  margin-bottom: 4px;
}

.preview-info p:last-child {
  margin-bottom: 0;
}

.preview-space {
  font-size: 13px;
  color: var(--text-secondary);
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  margin-bottom: 16px;
}

.sync-btn {
  width: 100%;
  padding: 14px;
  background: var(--accent);
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
}

.sync-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

/* Progress */
.sync-progress {
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 16px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 8px;
}

.progress-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  margin-bottom: 8px;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.3s;
}

.progress-message {
  font-size: 12px;
  color: var(--text-secondary);
}

/* Result */
.sync-result {
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.sync-result.success {
  background: rgba(46, 204, 113, 0.1);
}

.sync-result.error {
  background: rgba(231, 76, 60, 0.1);
}

.result-summary {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.result-icon {
  font-size: 24px;
}

.result-message {
  font-weight: 500;
}

.result-stats {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: var(--text-secondary);
}

.result-errors {
  margin-top: 12px;
  font-size: 12px;
}

.result-errors details summary {
  cursor: pointer;
  color: #e74c3c;
}

.result-errors ul {
  margin-top: 8px;
  padding-left: 20px;
}

/* Manual Export */
.action-row {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.secondary-btn {
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  font-size: 13px;
}

.secondary-btn:hover {
  background: rgba(255, 255, 255, 0.15);
}

.playlist-export {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.playlist-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.playlist-item .playlist-name {
  flex: 1;
  font-weight: 500;
}

.playlist-item .playlist-count {
  color: var(--text-secondary);
  font-size: 13px;
  margin-right: 16px;
}

.export-btn {
  padding: 6px 12px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  font-size: 12px;
}

.export-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.toast {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  padding: 14px 24px;
  background: rgba(0, 0, 0, 0.9);
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  z-index: 100;
  max-width: 80%;
}
</style>