<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { useMusicStore } from '@/stores/music'

const router = useRouter()
const playerStore = usePlayerStore()
const musicStore = useMusicStore()

interface EmotionCategory {
  emotion: string
  count: number
  songs: any[]
}

const emotionCategories = ref<EmotionCategory[]>([])
const selectedEmotion = ref<string | null>(null)
const isLoading = ref(true)
const showDetailedAnalysis = ref(false)

// 情绪图标映射
const emotionIcons: Record<string, string> = {
  happy: '😊',
  sad: '😢',
  relax: '😌',
  energetic: '⚡',
  romantic: '💕',
  nostalgic: '🕰️',
  focus: '🎯',
  workout: '💪',
  party: '🎉',
  sleep: '😴',
  morning: '🌅',
  work: '💼',
  drive: '🚗',
  rainy: '🌧️',
  social: '👥',
  meditation: '🧘',
  study: '📚',
}

// 情绪颜色映射
const emotionColors: Record<string, string> = {
  happy: '#FFD700',
  sad: '#6B7280',
  relax: '#10B981',
  energetic: '#EF4444',
  romantic: '#EC4899',
  nostalgic: '#8B5CF6',
  focus: '#3B82F6',
  workout: '#F97316',
  party: '#EC4899',
  sleep: '#6366F1',
  morning: '#F59E0B',
  work: '#06B6D4',
  drive: '#84CC16',
  rainy: '#3B82F6',
  social: '#EC4899',
  meditation: '#10B981',
  study: '#6366F1',
}

onMounted(async () => {
  await loadEmotionCategories()
})

const loadEmotionCategories = async () => {
  isLoading.value = true
  try {
    emotionCategories.value = await window.electron.stats.getEmotionCategories()
  } catch (e) {
    console.error('Failed to load emotion categories:', e)
  } finally {
    isLoading.value = false
  }
}

const selectEmotion = (emotion: string) => {
  selectedEmotion.value = emotion
}

const currentSongs = computed(() => {
  if (!selectedEmotion.value) return []
  const category = emotionCategories.value.find(c => c.emotion === selectedEmotion.value)
  if (!category) return []
  
  // 从音乐库获取完整歌曲数据（包含 audioUrl）
  return category.songs.map(statSong => {
    const fullSong = musicStore.songs.find(s => s.id === statSong.id)
    return fullSong || statSong
  })
})

const playEmotionPlaylist = async () => {
  if (!selectedEmotion.value) return
  
  try {
    const songs = currentSongs.value
    if (songs.length > 0) {
      playerStore.setPlaylist(songs, 0)
    }
  } catch (e) {
    console.error('Failed to play emotion playlist:', e)
  }
}

const goBack = () => {
  router.push('/')
}

const reanalyzeAll = async () => {
  console.log('🎭 [情绪分析] 开始点击重新分析按钮')
  
  if (!confirm('确定要重新分析所有歌曲的情绪吗？这可能需要一些时间。')) return
  
  isLoading.value = true
  showDetailedAnalysis.value = false
  
  try {
    console.log('🎭 [情绪分析] 开始调用 IPC...')
    
    // 先检查统计
    const stats = await window.electron.stats.getStats()
    console.log('🎭 [情绪分析] 统计数据:', stats)
    console.log('🎭 [情绪分析] 歌曲数量:', stats.songs?.length || 0)
    
    // 调用重新分析
    await window.electron.stats.reanalyzeEmotions()
    console.log('🎭 [情绪分析] IPC 调用完成')
    
    // 刷新列表
    await loadEmotionCategories()
    console.log('🎭 [情绪分析] 分类加载完成:', emotionCategories.value.length, '个分类')
    
    alert('情绪分析完成！共分析了 ' + emotionCategories.value.length + ' 个情绪分类')
  } catch (e: any) {
    console.error('❌ [情绪分析] 失败:', e)
    console.error('❌ [情绪分析] 错误堆栈:', e.stack)
    alert('分析失败：' + e.message)
  } finally {
    isLoading.value = false
  }
}

const getEmotionColor = (emotion: string) => {
  return emotionColors[emotion] || '#6B7280'
}

const getEmotionIcon = (emotion: string) => {
  return emotionIcons[emotion] || '🎵'
}

const totalCategorizedSongs = computed(() => {
  return emotionCategories.value.reduce((sum, cat) => sum + cat.count, 0)
})

const goToHome = () => {
  router.push('/')
}
</script>

<template>
  <div class="emotion-view">
    <div class="view-header">
      <button class="back-btn" @click="goBack">
        ← 返回
      </button>
      <div class="header-actions">
        <button class="analyze-btn" @click="reanalyzeAll" :disabled="isLoading">
          🔄 重新分析
        </button>
      </div>
    </div>

    <div class="emotion-hero">
      <h1 class="animate-fade-in-up">🎭 音乐情绪识别</h1>
      <p class="animate-fade-in-up delay-100">
        智能分析你的音乐库，自动分类情绪和场景
      </p>
    </div>

    <!-- 统计卡片 -->
    <div class="stats-overview animate-fade-in-up delay-200">
      <div class="stat-card">
        <div class="stat-value">{{ emotionCategories.length }}</div>
        <div class="stat-label">情绪分类</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ totalCategorizedSongs }}</div>
        <div class="stat-label">已分类歌曲</div>
      </div>
      <div class="stat-card">
        <div class="stat-value">{{ musicStore.songs.length }}</div>
        <div class="stat-label">总歌曲数</div>
      </div>
    </div>

    <div v-if="isLoading" class="loading">正在加载情绪分类...</div>

    <div v-else-if="emotionCategories.length === 0" class="empty">
      <h2>🎵 还没有情绪分类</h2>
      <p>点击「重新分析」按钮，让系统自动分析你的音乐库</p>
      <button class="action-btn" @click="reanalyzeAll">
        开始分析
      </button>
    </div>

    <div v-else class="emotion-content">
      <!-- 情绪分类网格 -->
      <div class="emotion-grid">
        <div
          v-for="category in emotionCategories"
          :key="category.emotion"
          :class="['emotion-card', { active: selectedEmotion === category.emotion }]"
          :style="{ borderColor: getEmotionColor(category.emotion) }"
          @click="selectEmotion(category.emotion)"
        >
          <div class="emotion-icon">{{ getEmotionIcon(category.emotion) }}</div>
          <div class="emotion-name">{{ category.emotion }}</div>
          <div class="emotion-count">{{ category.count }} 首</div>
          <div 
            class="emotion-bar"
            :style="{ 
              backgroundColor: getEmotionColor(category.emotion),
              width: `${(category.count / Math.max(...emotionCategories.map(c => c.count))) * 100}%`
            }"
          ></div>
        </div>
      </div>

      <!-- 选中的情绪歌曲列表 -->
      <Transition name="slide">
        <div v-if="selectedEmotion" class="selected-emotion-panel">
          <div class="panel-header">
            <h2>
              {{ getEmotionIcon(selectedEmotion) }}
              {{ selectedEmotion }} 场景
            </h2>
            <div class="panel-actions">
              <button class="play-btn" @click="playEmotionPlaylist">
                ▶️ 播放全部
              </button>
              <button class="close-btn" @click="selectedEmotion = null">
                ✕
              </button>
            </div>
          </div>
          
          <div class="song-list">
            <div
              v-if="selectedEmotion"
              class="song-group"
            >
              <div
                v-for="song in currentSongs.slice(0, 20)"
                :key="song.id"
                class="song-item"
                @click="playerStore.setPlaylist(currentSongs, currentSongs.findIndex(s => s.id === song.id))"
              >
                <div class="song-info">
                  <div class="song-title">{{ song.title }}</div>
                  <div class="song-artist">{{ song.artist }}</div>
                </div>
                <div class="song-meta">
                  <span class="play-count">
                    ▶️ {{ song.playCount }} 次
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <!-- 情绪说明 -->
    <div class="emotion-explanation">
      <h3>💡 情绪识别原理</h3>
      <div class="explanation-grid">
        <div class="explanation-item">
          <div class="explanation-icon">🎵</div>
          <div class="explanation-content">
            <strong>元数据分析</strong>
            <p>从歌曲标题、艺术家、专辑等信息提取情绪关键词</p>
          </div>
        </div>
        <div class="explanation-item">
          <div class="explanation-icon">🎶</div>
          <div class="explanation-content">
            <strong>BPM 分析</strong>
            <p>根据节奏速度判断歌曲情绪（慢歌放松，快歌激昂）</p>
          </div>
        </div>
        <div class="explanation-item">
          <div class="explanation-icon">🎚️</div>
          <div class="explanation-content">
            <strong>音频特征</strong>
            <p>分析能量、舞曲度、原声度等特征进行分类</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.emotion-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.view-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.back-btn {
  padding: 8px 16px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  font-size: 14px;
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.back-btn:hover {
  background: var(--accent-light);
  color: var(--accent);
}

.header-actions {
  display: flex;
  gap: 12px;
}

.analyze-btn {
  padding: 8px 16px;
  background: linear-gradient(135deg, var(--accent), #ff8a80);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.analyze-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(233, 69, 96, 0.3);
}

.analyze-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.emotion-hero {
  text-align: center;
  margin-bottom: 30px;
}

.emotion-hero h1 {
  font-size: 40px;
  font-weight: 700;
  margin-bottom: 12px;
  background: linear-gradient(135deg, var(--accent), #ff8a80);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.emotion-hero p {
  font-size: 16px;
  color: var(--text-secondary);
}

.stats-overview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  margin-bottom: 30px;
}

.stat-card {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 4px 12px var(--shadow);
  transition: transform 0.2s ease;
}

.stat-card:hover {
  transform: translateY(-4px);
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--accent);
  margin-bottom: 8px;
}

.stat-label {
  font-size: 14px;
  color: var(--text-secondary);
}

.loading,
.empty {
  text-align: center;
  padding: 60px 20px;
  color: var(--text-secondary);
}

.empty h2 {
  font-size: 24px;
  margin-bottom: 12px;
}

.empty p {
  margin-bottom: 20px;
}

.action-btn {
  padding: 12px 24px;
  background: linear-gradient(135deg, var(--accent), #ff8a80);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(233, 69, 96, 0.3);
}

.emotion-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.emotion-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px;
}

.emotion-card {
  background: var(--bg-secondary);
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  border: 3px solid transparent;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.emotion-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 20px var(--shadow);
}

.emotion-card.active {
  transform: scale(1.05);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
}

.emotion-icon {
  font-size: 36px;
  margin-bottom: 8px;
}

.emotion-name {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
  text-transform: capitalize;
}

.emotion-count {
  font-size: 12px;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.emotion-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 4px;
  border-radius: 0 0 8px 8px;
}

.selected-emotion-panel {
  background: var(--bg-secondary);
  border-radius: 16px;
  padding: 24px;
  box-shadow: 0 8px 32px var(--shadow);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.panel-header h2 {
  font-size: 24px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
}

.panel-actions {
  display: flex;
  gap: 12px;
}

.play-btn {
  padding: 10px 20px;
  background: linear-gradient(135deg, var(--accent), #ff8a80);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.play-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(233, 69, 96, 0.3);
}

.close-btn {
  padding: 10px 16px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: rgba(0, 0, 0, 0.1);
}

.song-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.song-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--bg-tertiary);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
}

.song-item:hover {
  background: var(--accent-light);
  transform: translateX(8px);
}

.song-info {
  flex: 1;
}

.song-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 4px;
}

.song-artist {
  font-size: 12px;
  color: var(--text-secondary);
}

.song-meta {
  font-size: 12px;
  color: var(--text-secondary);
}

.emotion-explanation {
  margin-top: 40px;
  padding: 24px;
  background: var(--bg-secondary);
  border-radius: 16px;
  box-shadow: 0 4px 16px var(--shadow);
}

.emotion-explanation h3 {
  font-size: 20px;
  font-weight: 600;
  margin-bottom: 20px;
}

.explanation-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
}

.explanation-item {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: var(--bg-tertiary);
  border-radius: 12px;
}

.explanation-icon {
  font-size: 32px;
  flex-shrink: 0;
}

.explanation-content strong {
  display: block;
  font-size: 14px;
  margin-bottom: 6px;
  color: var(--text-primary);
}

.explanation-content p {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* 动画 */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from {
  opacity: 0;
  transform: translateY(20px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateY(-20px);
}
</style>
