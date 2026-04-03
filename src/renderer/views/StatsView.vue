<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

const goBack = () => {
  router.push('/')
}
</script>

<template>
  <div class="stats-view">
    <div style="padding: 60px 20px; text-align: center; max-width: 800px; margin: 0 auto;">
      <h1 style="font-size: 48px; margin-bottom: 20px; background: linear-gradient(135deg, #e94560, #ff8a80); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">📊 听歌统计</h1>
      <p style="font-size: 18px; color: #6b7280; margin-bottom: 30px;">统计功能需要数据积累，请先听一些歌！</p>
      <div style="display: flex; gap: 16px; justify-content: center;">
        <button 
          @click="goBack" 
          style="padding: 12px 24px; background: linear-gradient(135deg, #e94560, #ff8a80); color: white; border: none; border-radius: 12px; cursor: pointer; font-size: 14px; font-weight: 600; box-shadow: 0 4px 12px rgba(233, 69, 96, 0.3); transition: all 0.2s ease;"
          @mouseenter="this.style.transform = 'translateY(-2px)'; this.style.boxShadow = '0 6px 20px rgba(233, 69, 96, 0.4)'"
          @mouseleave="this.style.transform = 'translateY(0)'; this.style.boxShadow = '0 4px 12px rgba(233, 69, 96, 0.3)'"
        >
          ← 返回主页
        </button>
        <button 
          @click="goBack" 
          style="padding: 12px 24px; background: #f0f2f5; color: #1a1a2e; border: none; border-radius: 12px; cursor: pointer; font-size: 14px; font-weight: 500; transition: all 0.2s ease;"
          @mouseenter="this.style.background = '#e8ecf0'"
          @mouseleave="this.style.background = '#f0f2f5'"
        >
          去听歌
        </button>
      </div>
      <div style="margin-top: 60px; padding: 20px; background: #f8f9fa; border-radius: 12px;">
        <h2 style="font-size: 18px; margin-bottom: 16px; color: #1a1a2e;">统计功能说明</h2>
        <p style="color: #6b7280; line-height: 1.8;">
          当您开始播放音乐后，系统会自动记录：<br>
          • 播放次数和时长<br>
          • 最常播放的歌曲和艺术家<br>
          • 听歌习惯（时间分布）<br>
          • 情感标签标注
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-view {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}
</style>
