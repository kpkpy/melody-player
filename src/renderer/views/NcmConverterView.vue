<script setup lang="ts">
import { ref } from 'vue'
import { usePlayerStore } from '@/stores/player'

const playerStore = usePlayerStore()

// 状态
const isConverting = ref(false)
const conversionProgress = ref(0)
const convertedFiles = ref<Array<{ original: string; output: string; success: boolean }>>([])
const outputDir = ref('')
const selectedDir = ref('')

// 选择文件夹
const selectDirectory = async () => {
  try {
    const { filePaths } = await window.electron.dialog.openDialog({
      properties: ['openDirectory']
    })
    
    if (filePaths && filePaths.length > 0) {
      selectedDir.value = filePaths[0]
      scanDirectory()
    }
  } catch (error) {
    console.error('Failed to select directory:', error)
  }
}

// 设置输出目录
const selectOutputDir = async () => {
  try {
    const { filePaths } = await window.electron.dialog.openDialog({
      properties: ['openDirectory']
    })
    
    if (filePaths && filePaths.length > 0) {
      outputDir.value = filePaths[0]
    }
  } catch (error) {
    console.error('Failed to select output directory:', error)
  }
}

// 扫描目录
const scanDirectory = async () => {
  if (!selectedDir.value) return
  
  try {
    const result = await window.electron.ncm.scanDirectory(selectedDir.value)
    
    if (result.success && result.files.length > 0) {
      // 设置输出目录为同级目录
      if (!outputDir.value) {
        outputDir.value = selectedDir.value.replace(/\.ncm$/i, '_converted')
      }
    } else if (result.files.length === 0) {
      alert('未找到 NCM 文件')
    }
  } catch (error) {
    console.error('Failed to scan directory:', error)
  }
}

// 开始转换
const startConversion = async () => {
  if (!selectedDir.value) return
  
  isConverting.value = true
  convertedFiles.value = []
  conversionProgress.value = 0
  
  try {
    const scanResult = await window.electron.ncm.scanDirectory(selectedDir.value)
    
    if (!scanResult.success || scanResult.files.length === 0) {
      alert('未找到 NCM 文件')
      isConverting.value = false
      return
    }
    
    const results = await window.electron.ncm.batchConvert(
      scanResult.files,
      outputDir.value || selectedDir.value
    )
    
    convertedFiles.value = results.map((r: any, i: number) => ({
      original: scanResult.files[i],
      output: r.outputPath || '',
      success: r.success
    }))
    
    conversionProgress.value = 100
  } catch (error) {
    console.error('Conversion failed:', error)
  } finally {
    isConverting.value = false
  }
}

// 打开转换后的目录
const openOutputDir = async () => {
  if (outputDir.value) {
    await window.electron.shell.openPath(outputDir.value)
  }
}
</script>

<template>
  <div class="ncm-converter-view">
    <header class="converter-header">
      <h1>NCM 格式转换器</h1>
      <p class="subtitle">将网易云音乐 NCM 加密格式转换为标准 MP3/FLAC 格式</p>
    </header>

    <div class="converter-content">
      <!-- 选择步骤 -->
      <section class="section step-1">
        <div class="section-title">
          <span class="step-number">1</span>
          <h2>选择 NCM 文件夹</h2>
        </div>
        
        <div class="directory-selector">
          <input 
            type="text" 
            :value="selectedDir"
            placeholder="请选择包含 NCM 文件的文件夹"
            readonly
          />
          <button 
            class="btn btn-primary" 
            @click="selectDirectory"
            :disabled="isConverting"
          >
            浏览文件夹
          </button>
        </div>
      </section>

      <!-- 输出目录 -->
      <section class="section step-2">
        <div class="section-title">
          <span class="step-number">2</span>
          <h2>选择输出目录</h2>
        </div>
        
        <div class="directory-selector">
          <input 
            type="text" 
            :value="outputDir"
            placeholder="默认输出到同目录，可选择其他位置"
            readonly
          />
          <button 
            class="btn btn-secondary" 
            @click="selectOutputDir"
            :disabled="isConverting"
          >
            浏览文件夹
          </button>
        </div>
      </section>

      <!-- 转换按钮 -->
      <section class="section step-3">
        <button 
          class="btn btn-lg btn-convert"
          @click="startConversion"
          :disabled="!selectedDir || isConverting"
        >
          {{ isConverting ? '转换中...' : '开始批量转换' }}
        </button>
      </section>

      <!-- 进度条 -->
      <section class="section" v-if="isConverting">
        <div class="progress-container">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: conversionProgress + '%' }"></div>
          </div>
          <span class="progress-text">{{ conversionProgress }}%</span>
        </div>
        <p class="converting-tip">正在转换中，请稍候...</p>
      </section>

      <!-- 转换结果 -->
      <section class="section" v-if="convertedFiles.length > 0">
        <div class="result-header">
          <h3>转换结果</h3>
          <button class="btn btn-sm btn-outline" @click="openOutputDir">
            打开输出目录
          </button>
        </div>
        
        <div class="file-list">
          <div 
            v-for="(file, index) in convertedFiles" 
            :key="index"
            class="file-item"
            :class="{ success: file.success, error: !file.success }"
          >
            <div class="file-info">
              <div class="file-name">{{ file.original.split('/').pop() || file.original.split('\\').pop() }}</div>
              <div class="file-status">
                {{ file.success ? '✓ 转换成功' : '✗ 转换失败' }}
                <span v-if="file.success" class="output-path">{{ file.output }}</span>
              </div>
            </div>
          </div>
        </div>
        
        <div class="result-summary">
          <p>
            总计：{{ convertedFiles.length }} 个文件 |
            成功：{{ convertedFiles.filter(f => f.success).length }} |
            失败：{{ convertedFiles.filter(f => !f.success).length }}
          </p>
        </div>
      </section>
    </div>

    <!-- 说明信息 -->
    <section class="info-section">
      <h3>使用说明</h3>
      <ul>
        <li>选择包含 NCM 文件的文件夹，程序会自动扫描所有 .ncm 文件</li>
        <li>转换后的文件将保存为 MP3 或 FLAC 格式（根据原文件格式）</li>
        <li>支持批量转换，大文件会自动优化处理</li>
        <li>转换后的文件包含完整的歌曲信息（标题、艺术家、专辑、封面）</li>
      </ul>
      
      <div class="disclaimer">
        <strong>⚠️ 免责声明：</strong>
        本工具仅供学习和研究使用，请确保您拥有合法的音乐文件使用权。
        转换后的音频文件仅供个人学习欣赏，不得用于商业用途。
      </div>
    </section>
  </div>
</template>

<style scoped>
.ncm-converter-view {
  max-width: 900px;
  margin: 0 auto;
  padding: 40px 20px;
}

.converter-header {
  text-align: center;
  margin-bottom: 40px;
}

.converter-header h1 {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  color: var(--text-secondary);
  font-size: 15px;
}

.section {
  margin-bottom: 30px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.step-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 50%;
  font-size: 14px;
  font-weight: 600;
}

.section-title h2 {
  font-size: 18px;
  font-weight: 600;
  margin: 0;
}

.directory-selector {
  display: flex;
  gap: 12px;
  align-items: center;
}

.directory-selector input {
  flex: 1;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.btn-secondary:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.15);
}

.btn-lg {
  padding: 16px 32px;
  font-size: 16px;
  width: 100%;
}

.btn-convert {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  color: #fff;
  font-weight: 600;
}

.btn-convert:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(17, 153, 142, 0.4);
}

.btn-sm {
  padding: 8px 16px;
  font-size: 13px;
}

.btn-outline {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: var(--text-primary);
}

.btn-outline:hover {
  background: rgba(255, 255, 255, 0.1);
}

.progress-container {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 12px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  transition: width 0.3s;
}

.progress-text {
  min-width: 50px;
  text-align: right;
  font-weight: 600;
  color: var(--text-secondary);
}

.converting-tip {
  text-align: center;
  color: var(--text-secondary);
  font-size: 14px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.result-header h3 {
  font-size: 18px;
  margin: 0;
}

.file-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 400px;
  overflow-y: auto;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border-left: 4px solid transparent;
}

.file-item.success {
  border-left-color: #4caf50;
}

.file-item.error {
  border-left-color: #f44336;
}

.file-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.file-name {
  font-weight: 500;
  color: var(--text-primary);
}

.file-status {
  font-size: 13px;
  color: var(--text-secondary);
}

.file-status.success {
  color: #4caf50;
}

.file-status.error {
  color: #f44336;
}

.output-path {
  margin-left: 8px;
  opacity: 0.7;
}

.result-summary {
  margin-top: 16px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  text-align: center;
}

.result-summary p {
  margin: 0;
  color: var(--text-secondary);
}

.info-section {
  margin-top: 40px;
  padding: 24px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.info-section h3 {
  font-size: 18px;
  margin-bottom: 16px;
  color: var(--text-primary);
}

.info-section ul {
  list-style: none;
  padding: 0;
}

.info-section li {
  padding: 8px 0;
  padding-left: 24px;
  position: relative;
  color: var(--text-secondary);
}

.info-section li:before {
  content: '•';
  position: absolute;
  left: 8px;
  color: #667eea;
}

.disclaimer {
  margin-top: 24px;
  padding: 16px;
  background: rgba(255, 152, 0, 0.1);
  border-left: 4px solid #ff9800;
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.disclaimer strong {
  color: #ff9800;
}
</style>
