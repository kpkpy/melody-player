<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMusicStore } from '@/stores/music'
import Sidebar from '@/components/Sidebar.vue'
import PlayerBar from '@/components/PlayerBar.vue'
import TitleBar from '@/components/TitleBar.vue'

const musicStore = useMusicStore()
const isAppReady = ref(false)
const showContent = ref(false)
const loadingText = ref('正在初始化...')

onMounted(async () => {
  loadingText.value = '加载音乐库...'
  await window.electron.app.ready()
  
  loadingText.value = '读取歌曲数据...'
  await musicStore.loadLibrary()
  
  loadingText.value = '准备就绪'
  setTimeout(() => {
    isAppReady.value = true
    setTimeout(() => {
      showContent.value = true
    }, 50)
  }, 200)
})
</script>

<template>
  <Transition name="loading-fade">
    <div v-if="!isAppReady" class="loading-screen">
      <div class="loading-content">
        <div class="loading-logo">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
        </div>
        <h1 class="loading-title">Melody Player</h1>
        <div class="loading-spinner">
          <div class="spinner"></div>
        </div>
        <p class="loading-text">{{ loadingText }}</p>
        <div v-if="musicStore.scanProgress" class="loading-progress">
          <div class="progress-bar">
            <div 
              class="progress-fill" 
              :style="{ width: `${musicStore.scanProgress.total > 0 ? (musicStore.scanProgress.current / musicStore.scanProgress.total * 100) : 0}%` }"
            ></div>
          </div>
          <span class="progress-text">
            {{ musicStore.scanProgress.current }} / {{ musicStore.scanProgress.total }}
          </span>
        </div>
      </div>
    </div>
  </Transition>

  <Transition name="app-enter">
    <div v-if="showContent" class="app-container">
      <TitleBar />
      <div class="main-content">
        <Sidebar />
        <main class="content-area">
          <router-view v-slot="{ Component, route }">
            <Transition :name="route.meta.transition || 'page-slide'" mode="out-in">
              <component :is="Component" :key="route.path" />
            </Transition>
          </router-view>
        </main>
      </div>
      <PlayerBar />
    </div>
  </Transition>
</template>

<style scoped>
.loading-screen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.loading-content {
  text-align: center;
}

.loading-logo {
  width: 120px;
  height: 120px;
  margin: 0 auto 24px;
  background: linear-gradient(135deg, var(--accent), #ff8a80);
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(233, 69, 96, 0.4); }
  50% { transform: scale(1.05); box-shadow: 0 0 40px 10px rgba(233, 69, 96, 0.2); }
}

.loading-title {
  font-size: 32px;
  font-weight: 700;
  margin-bottom: 32px;
  background: linear-gradient(135deg, #fff, #ccc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.loading-spinner {
  margin-bottom: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  margin: 0 auto;
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading-text {
  font-size: 14px;
  color: var(--text-secondary);
}

.loading-progress {
  margin-top: 16px;
  padding: 0 40px;
}

.loading-progress .progress-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 8px;
}

.loading-progress .progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  color: var(--text-secondary);
}

.app-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.main-content {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.content-area {
  flex: 1;
  overflow-y: auto;
  padding: 20px 30px;
  padding-bottom: 100px;
}

/* Loading fade */
.loading-fade-leave-active {
  transition: opacity 0.4s ease, transform 0.4s ease;
}

.loading-fade-leave-to {
  opacity: 0;
  transform: scale(0.95);
}

/* App enter */
.app-enter-enter-active {
  transition: opacity 0.5s ease;
}

.app-enter-enter-from {
  opacity: 0;
}

/* Page slide transition */
.page-slide-enter-active,
.page-slide-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.page-slide-enter-from {
  opacity: 0;
  transform: translateX(20px);
}

.page-slide-leave-to {
  opacity: 0;
  transform: translateX(-20px);
}

/* Page fade transition */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: all 0.25s ease;
}

.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}

/* Page scale transition */
.page-scale-enter-active,
.page-scale-leave-active {
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.page-scale-enter-from {
  opacity: 0;
  transform: scale(0.95);
}

.page-scale-leave-to {
  opacity: 0;
  transform: scale(1.02);
}
</style>