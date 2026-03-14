<script setup lang="ts">
import { ref } from 'vue'
import { usePlaylistStore } from '@/stores/playlist'
import { useMusicStore } from '@/stores/music'

const playlistStore = usePlaylistStore()
const musicStore = useMusicStore()

const isExporting = ref(false)
const isImporting = ref(false)
const importResult = ref<any>(null)
const message = ref('')

const exportPlaylist = async (playlistId: string) => {
  isExporting.value = true
  message.value = ''
  try {
    const path = await window.electron.sync.exportPlaylist(playlistId)
    if (path) {
      message.value = `已导出到: ${path}`
    }
  } catch (e) {
    message.value = `导出失败: ${e}`
  } finally {
    isExporting.value = false
  }
}

const importM3U = async () => {
  isImporting.value = true
  message.value = ''
  try {
    const result = await window.electron.sync.importM3U()
    if (result) {
      importResult.value = result
    }
  } catch (e) {
    message.value = `导入失败: ${e}`
  } finally {
    isImporting.value = false
  }
}

const confirmImport = async () => {
  if (!importResult.value) return
  
  const playlist = await playlistStore.createPlaylist(importResult.value.name)
  
  for (const song of importResult.value.songs) {
    const found = musicStore.songs.find(
      s => s.title.toLowerCase() === song.title.toLowerCase() &&
           (!song.artist || s.artist.toLowerCase().includes(song.artist.toLowerCase()))
    )
    if (found) {
      await playlistStore.addSong(playlist.id, found.id)
    }
  }
  
  message.value = `已导入歌单: ${playlist.name}`
  importResult.value = null
}

const exportAll = async () => {
  isExporting.value = true
  message.value = ''
  try {
    const path = await window.electron.sync.exportAll()
    if (path) {
      message.value = `已导出到: ${path}`
    }
  } catch (e) {
    message.value = `导出失败: ${e}`
  } finally {
    isExporting.value = false
  }
}

const importAll = async () => {
  isImporting.value = true
  message.value = ''
  try {
    const count = await window.electron.sync.importAll()
    message.value = `已导入 ${count} 个歌单`
    await playlistStore.loadPlaylists()
  } catch (e) {
    message.value = `导入失败: ${e}`
  } finally {
    isImporting.value = false
  }
}
</script>

<template>
  <div class="sync-view">
    <h1>同步管理</h1>

    <section class="sync-section">
      <h2>导入歌单</h2>
      <p class="section-desc">从其他播放器导入 M3U/M3U8 歌单文件</p>
      
      <div class="action-buttons">
        <button class="action-btn" @click="importM3U" :disabled="isImporting">
          {{ isImporting ? '处理中...' : '导入 M3U 歌单' }}
        </button>
        <button class="action-btn secondary" @click="importAll" :disabled="isImporting">
          批量导入 (JSON)
        </button>
      </div>

      <div v-if="importResult" class="import-preview">
        <h3>{{ importResult.name }} ({{ importResult.songs.length }} 首歌曲)</h3>
        <div class="preview-stats">
          <span>匹配到: {{ importResult.matched || '计算中...' }}</span>
        </div>
        <div class="preview-actions">
          <button class="confirm-btn" @click="confirmImport">确认导入</button>
          <button class="cancel-btn" @click="importResult = null">取消</button>
        </div>
      </div>
    </section>

    <section class="sync-section">
      <h2>导出歌单</h2>
      <p class="section-desc">将歌单导出为 M3U 格式，可在其他播放器中使用</p>

      <div class="action-buttons">
        <button class="action-btn secondary" @click="exportAll" :disabled="isExporting">
          导出所有歌单 (JSON)
        </button>
      </div>

      <div class="playlist-list">
        <div v-for="playlist in playlistStore.playlists" :key="playlist.id" class="playlist-row">
          <div class="playlist-info">
            <span class="playlist-name">{{ playlist.name }}</span>
            <span class="playlist-count">{{ playlist.songIds.length }} 首</span>
          </div>
          <button 
            class="export-btn" 
            @click="exportPlaylist(playlist.id)"
            :disabled="isExporting"
          >
            导出 M3U
          </button>
        </div>
      </div>

      <div v-if="playlistStore.playlists.length === 0" class="empty-tip">
        暂无歌单，请先创建歌单
      </div>
    </section>

    <div v-if="message" class="message">{{ message }}</div>
  </div>
</template>

<style scoped>
.sync-view {
  max-width: 700px;
  margin: 0 auto;
}

.sync-view h1 {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 40px;
}

.sync-section {
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 24px;
}

.sync-section h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
}

.section-desc {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 20px;
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-bottom: 20px;
}

.action-btn {
  padding: 12px 24px;
  background: var(--accent);
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
}

.action-btn:hover:not(:disabled) {
  background: var(--accent-hover);
}

.action-btn.secondary {
  background: rgba(255, 255, 255, 0.1);
}

.action-btn.secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.import-preview {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 16px;
}

.import-preview h3 {
  font-size: 16px;
  margin-bottom: 12px;
}

.preview-stats {
  color: var(--text-secondary);
  font-size: 14px;
  margin-bottom: 16px;
}

.preview-actions {
  display: flex;
  gap: 12px;
}

.confirm-btn {
  padding: 10px 20px;
  background: var(--accent);
  border-radius: 6px;
  font-size: 13px;
}

.cancel-btn {
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  font-size: 13px;
}

.playlist-list {
  margin-top: 16px;
}

.playlist-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 8px;
}

.playlist-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.playlist-name {
  font-size: 14px;
  font-weight: 500;
}

.playlist-count {
  font-size: 12px;
  color: var(--text-secondary);
}

.export-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  font-size: 13px;
}

.export-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.export-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty-tip {
  text-align: center;
  padding: 20px;
  color: var(--text-secondary);
}

.message {
  position: fixed;
  bottom: 100px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 14px;
}
</style>