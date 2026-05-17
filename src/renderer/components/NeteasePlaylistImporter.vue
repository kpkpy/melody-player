<template>
  <div class="netease-importer">
    <h3>导入网易云歌单</h3>
    
    <div class="input-group">
      <input
        v-model="playlistUrl"
        type="text"
        placeholder="粘贴网易云歌单链接，例如：https://music.163.com/#/playlist?id=123456"
        class="url-input"
      />
    </div>

    <div class="input-group">
      <details :open="lastError?.includes('fetch') || lastError?.includes('Cookie') ? true : false">
        <summary>如何获取 Cookies？（导入失败时必选）</summary>
        <div class="cookie-help">
          <p>1. 在浏览器中打开 <a href="https://music.163.com" target="_blank">music.163.com</a> 并登录</p>
          <p>2. 打开开发者工具（F12）→ Network（网络）标签</p>
          <p>3. 刷新页面，找到任意请求，复制请求头中的 Cookie 值</p>
          <p>4. 粘贴到下方输入框</p>
        </div>
        <textarea
          v-model="cookies"
          placeholder="粘贴 Cookie 字符串，例如：MUSIC_U=xxx; __csrf=xxx..."
          class="cookies-input"
          rows="3"
        ></textarea>
      </details>
    </div>

    <button
      @click="handleImport"
      :disabled="isImporting || !playlistUrl"
      class="import-btn"
    >
      {{ isImporting ? '导入中...' : '导入歌单' }}
    </button>

    <div v-if="result" class="result">
      <div v-if="result.success" class="success">
        <h4>导入成功！</h4>
        <p>歌单名称：{{ result.playlistName }}</p>
        <p>匹配结果：{{ result.matchedTracks }} / {{ result.totalTracks }}</p>
        
        <div v-if="result.unmatchedTracks.length > 0" class="unmatched">
          <h5>未匹配的歌曲（{{ result.unmatchedTracks.length }}）：</h5>
          <ul>
            <li v-for="(track, index) in result.unmatchedTracks.slice(0, 10)" :key="index">
              {{ track.title }} - {{ track.artist }}
            </li>
            <li v-if="result.unmatchedTracks.length > 10">
              ... 还有 {{ result.unmatchedTracks.length - 10 }} 首
            </li>
          </ul>
        </div>
      </div>
      
      <div v-else class="error">
        <h4>导入失败</h4>
        <p>{{ result.error }}</p>
        <p v-if="result.error?.includes('fetch') || result.error?.includes('Failed')" class="error-tip">
          💡 提示：网易云API需要登录Cookie才能访问，请在上方填入Cookies后重试
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const emit = defineEmits<{
  success: []
}>()

const playlistUrl = ref('')
const cookies = ref('')
const isImporting = ref(false)
const result = ref<any>(null)
const lastError = computed(() => result.value?.error)

const handleImport = async () => {
  if (!playlistUrl.value || isImporting.value) return
  
  isImporting.value = true
  result.value = null
  
  try {
    const res = await (window as any).electron.playlist.importNetease(
      playlistUrl.value,
      cookies.value || undefined
    )
    result.value = res
    if (res.success) {
      emit('success')
    }
  } catch (e: any) {
    result.value = {
      success: false,
      error: e.message || '导入失败',
      totalTracks: 0,
      matchedTracks: 0,
      unmatchedTracks: [],
    }
  } finally {
    isImporting.value = false
  }
}
</script>

<style scoped>
.netease-importer {
  padding: 20px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin: 20px 0;
}

h3 {
  margin: 0 0 16px 0;
  color: #fff;
}

.input-group {
  margin-bottom: 12px;
}

.url-input {
  width: 100%;
  padding: 10px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
}

.url-input:focus {
  outline: none;
  border-color: #4a9eff;
}

.cookie-help {
  padding: 8px 0;
  font-size: 12px;
  color: #999;
  line-height: 1.6;
}

.cookie-help a {
  color: #4a9eff;
  text-decoration: none;
}

.cookie-help a:hover {
  text-decoration: underline;
}

.cookies-input {
  width: 100%;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  color: #fff;
  font-size: 12px;
  resize: vertical;
}

.import-btn {
  padding: 10px 24px;
  background: #4a9eff;
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.import-btn:hover:not(:disabled) {
  background: #3a8eef;
}

.import-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.result {
  margin-top: 16px;
  padding: 16px;
  border-radius: 6px;
}

.success {
  background: rgba(76, 175, 80, 0.2);
  border: 1px solid rgba(76, 175, 80, 0.4);
}

.error {
  background: rgba(244, 67, 54, 0.2);
  border: 1px solid rgba(244, 67, 54, 0.4);
}

.success h4, .error h4 {
  margin: 0 0 8px 0;
}

.success p, .error p {
  margin: 4px 0;
  color: #ccc;
}

.error-tip {
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  font-size: 13px;
  color: #ffcc00;
}

.unmatched {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.unmatched h5 {
  margin: 0 0 8px 0;
  color: #ff9800;
}

.unmatched ul {
  margin: 0;
  padding-left: 20px;
  color: #999;
  font-size: 13px;
  max-height: 150px;
  overflow-y: auto;
}

.unmatched li {
  margin: 4px 0;
}

details {
  color: #999;
  cursor: pointer;
}

summary {
  padding: 8px 0;
  color: #4a9eff;
}
</style>

