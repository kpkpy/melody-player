/**
 * 渐进式音频特征分析服务
 * 
 * 核心思路：
 * 1. 先靠元数据秒出结果（已实现）
 * 2. 后台逐个文件做真实音频分析（Web Audio API）
 * 3. 分析完成 → 更新歌曲 → 重新分类 → UI 更新
 */

import { reactive } from 'vue'
import { extractFeatures } from './audioExtractor'

export type AnalysisStage = 'idle' | 'audio-extracting' | 'complete'

export function useAudioAnalysis() {
  const status = reactive({
    value: 'idle' as AnalysisStage,
    isRunning: false,
    currentFile: '',
    current: 0,
    total: 0,
    progressPercent: 0,
    errors: 0,
  })

  /**
   * 核心：批量音频分析
   * 
   * 流程：
   * 1. 先跑 metadata analysis（instant）
   * 2. 后台逐个分析音频文件（Web Audio API）
   * 3. 每分析完一首 → send to main process → update emotion analysis
   * 4. 全部完成后 → status = 'complete'
   */
  async function startBatchAnalysis(songs: any[], forceFull: boolean = false): Promise<{ total: number; success: number; errors: number }> {
    if (status.isRunning) {
      throw new Error('Analysis already running')
    }
    
    status.isRunning = true
    status.value = 'audio-extracting'
    status.currentFile = ''
    status.current = 0
    status.total = 0
    status.progressPercent = 0
    status.errors = 0
    
    const audioSongs = songs
      .filter((s: any) => s.audioUrl)
      .filter((s: any) => !s.audioFeatures || forceFull)
    
    status.total = audioSongs.length
    
    // Phase 1: 元数据分析（instant）
    try {
      await window.electron.stats.reanalyzeEmotions()
    } catch (e) {
      console.warn('[AudioAnalysis] Metadata analysis failed:', e)
    }
    
    if (!forceFull || audioSongs.length === 0) {
      status.value = 'complete'
      status.isRunning = false
      status.currentFile = ''
      return { total: 0, success: 0, errors: 0 }
    }
    
    // Phase 2: 逐个真实音频分析
    let successCount = 0
    
    for (let i = 0; i < audioSongs.length; i++) {
      const song = audioSongs[i]
      status.currentFile = song.title || song.filePath
      status.current = i + 1
      status.progressPercent = Math.round(((i + 1) / audioSongs.length) * 100)
      
      try {
        const features = await extractFeatures(song.audioUrl)
        const result = await window.electron.audioFeatures.storeFeatures(song.id, features)
        
        if (result?.success) {
          successCount++
          // 更新歌曲对象
          const s = songs.find((s: any) => s.id === song.id)
          if (s) {
            s.audioFeatures = features
            s.emotionAnalysis = result.analysis
            s.emotionTags = [
              result.analysis.primaryTone,
              ...result.analysis.secondaryTones,
              ...(result.analysis.sceneClassification?.scenes || []).map((sc: any) => sc.scene),
            ]
          }
        }
      } catch (e) {
        console.error(`[AudioAnalysis] 分析失败 ${song.title}:`, e)
        status.errors++
      }
      
      // 每处理 3 首歌暂停 30ms，避免阻塞 UI
      if (i % 3 === 2) {
        await new Promise(r => setTimeout(r, 30))
      }
    }
    
    status.isRunning = false
    status.currentFile = ''
    status.value = 'complete'
    
    return {
      total: audioSongs.length,
      success: successCount,
      errors: status.errors,
    }
  }

  /**
   * 单首歌曲音频分析（用户手动触发）
   */
  async function analyzeSingleSong(song: any) {
    if (!song.audioUrl) {
      throw new Error('No audio URL available for this song')
    }
    
    status.currentFile = song.title || ''
    status.isRunning = true
    
    try {
      const features = await extractFeatures(song.audioUrl)
      await window.electron.audioFeatures.storeFeatures(song.id, features)
      return { success: true, features }
    } finally {
      status.isRunning = false
      status.currentFile = ''
    }
  }

  return {
    status,
    analysis: status, // same object, for backward compat
    startBatchAnalysis,
    analyzeSingleSong,
  }
}
