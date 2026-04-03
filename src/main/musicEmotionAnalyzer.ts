/**
 * 音乐情绪识别与场景分类系统 v2 - 优化版
 */

export interface EmotionAnalysis {
  primaryEmotion: string
  secondaryEmotions: string[]
  confidence: number
  bpm: number
  energy: number
  danceability: number
  valence: number
  acousticness: number
}

export interface SceneClassification {
  scenes: string[]
  confidence: number
}

// 情绪关键词库 - 加权版本
const EMOTION_KEYWORDS: Record<string, { words: string[]; weight: number }> = {
  happy: { words: ['快乐', '开心', '笑', '阳光', '彩虹', '梦想', '希望', 'beautiful', 'wonderful'], weight: 1.0 },
  sad: { words: ['悲伤', '眼泪', '哭泣', '心痛', '离开', '再见', '孤独', '寂寞', 'sad', 'cry', 'tears', 'goodbye', 'lonely'], weight: 1.2 },
  romantic: { words: ['爱', '喜欢', '恋', '吻', '拥抱', '情人', 'love', 'kiss', 'hug', 'romantic', 'heart'], weight: 1.1 },
  energetic: { words: ['燃烧', '战斗', '力量', '胜利', 'rock', 'fight', 'power', 'strong', 'warrior'], weight: 1.0 },
  relax: { words: ['安静', '平静', '温柔', '微风', '夜晚', 'soft', 'gentle', 'quiet', 'calm', 'peace', 'breeze'], weight: 1.0 },
  nostalgic: { words: ['回忆', '过去', '曾经', '岁月', '时光', 'old', 'memory', 'remember', 'yesterday', 'vintage'], weight: 1.1 },
  angry: { words: ['愤怒', '恨', '讨厌', '生气', 'angry', 'hate', 'mad', 'crazy'], weight: 1.3 },
  inspirational: { words: ['加油', '坚持', '勇敢', '相信', 'believe', 'fight', 'never', 'give up', 'brave'], weight: 1.0 },
}

// BPM 范围对应的情绪
const BPM_EMOTIONS: Record<string, { min: number; max: number; emotions: string[]; intensity: number }> = {
  slow: { min: 0, max: 70, emotions: ['sad', 'relax', 'romantic', 'nostalgic'], intensity: 0.8 },
  moderate_slow: { min: 70, max: 90, emotions: ['relax', 'nostalgic', 'romantic'], intensity: 0.6 },
  moderate: { min: 90, max: 110, emotions: ['happy', 'relax'], intensity: 0.5 },
  moderate_fast: { min: 110, max: 130, emotions: ['happy', 'energetic', 'inspirational'], intensity: 0.6 },
  fast: { min: 130, max: 150, emotions: ['energetic', 'happy', 'angry'], intensity: 0.7 },
  very_fast: { min: 150, max: 999, emotions: ['energetic', 'angry'], intensity: 0.9 },
}

// 流派到情绪的映射
const GENRE_EMOTIONS: Record<string, string[]> = {
  '流行': ['happy', 'romantic'], 'pop': ['happy', 'romantic'],
  '民谣': ['relax', 'nostalgic'], 'folk': ['relax', 'nostalgic'],
  '摇滚': ['energetic', 'angry'], 'rock': ['energetic', 'angry'],
  '说唱': ['energetic', 'angry'], 'rap': ['energetic', 'angry'], 'hip hop': ['energetic', 'angry'],
  '电子': ['energetic', 'happy'], 'electronic': ['energetic', 'happy'], 'edm': ['energetic', 'happy'],
  '古典': ['relax', 'sad'], 'classical': ['relax', 'sad'],
  '爵士': ['relax', 'romantic'], 'jazz': ['relax', 'romantic'],
  '蓝调': ['sad', 'relax'], 'blues': ['sad', 'relax'],
  '情歌': ['romantic', 'sad'], 'ballad': ['romantic', 'sad'],
  '金属': ['angry', 'energetic'], 'metal': ['angry', 'energetic'],
  '朋克': ['angry', 'energetic'], 'punk': ['angry', 'energetic'],
  'r&b': ['romantic', 'relax'], 'rnb': ['romantic', 'relax'],
}

export class MusicEmotionAnalyzer {
  analyzeEmotion(song: any): EmotionAnalysis {
    const features = this.extractFeatures(song)
    const emotionScores = this.calculateAllEmotions(song, features)
    
    const sortedEmotions = Object.entries(emotionScores).sort((a, b) => b[1] - a[1])
    const primaryEmotion = sortedEmotions[0]?.[0] || 'happy'
    const primaryScore = sortedEmotions[0]?.[1] || 0
    
    const secondaryEmotions = sortedEmotions
      .slice(1)
      .filter(([_, score]) => score > 0.3 && score < primaryScore * 0.8)
      .slice(0, 2)
      .map(([emotion]) => emotion)
    
    return {
      primaryEmotion,
      secondaryEmotions,
      confidence: Math.min(1, primaryScore),
      bpm: features.bpm,
      energy: features.energy,
      danceability: features.danceability,
      valence: features.valence,
      acousticness: features.acousticness,
    }
  }

  classifyScene(song: any, analysis: EmotionAnalysis): SceneClassification {
    const features = this.extractFeatures(song)
    const matchedScenes: { scene: string; score: number }[] = []

    for (const [scene, rule] of Object.entries(SCENE_RULES)) {
      const match = rule(features, analysis)
      if (match) {
        const score = this.calculateSceneScore(scene, features, analysis)
        if (score > 0.4) matchedScenes.push({ scene, score })
      }
    }

    matchedScenes.sort((a, b) => b.score - a.score)
    return { scenes: matchedScenes.slice(0, 3).map(s => s.scene), confidence: matchedScenes[0]?.score || 0 }
  }

  private extractFeatures(song: any) {
    const bpm = this.extractBPM(song)
    const genre = (song.genre || '').toLowerCase()
    const genreFeatures = this.getGenreFeatures(genre)
    
    return {
      bpm,
      energy: genreFeatures.energy,
      danceability: genreFeatures.danceability,
      valence: this.estimateValence(song),
      acousticness: genreFeatures.acousticness,
      instrumentalness: 0.3,
      liveness: 0.5,
      speechiness: this.estimateSpeechiness(genre),
    }
  }

  private extractBPM(song: any): number {
    if (song.bpm) return song.bpm
    if (song.tempo) return song.tempo
    
    const genre = (song.genre || '').toLowerCase()
    const bpmRanges: Record<string, number> = {
      'ambient': 65, 'classical': 75, '民谣': 85, 'folk': 85, '抒情': 70, 'ballad': 70,
      '流行': 100, 'pop': 100, '摇滚': 120, '金属': 140, 'metal': 140,
      '电子': 128, 'electronic': 128, 'edm': 128, '说唱': 95, 'rap': 95, 'hip hop': 95,
      '爵士': 85, 'jazz': 85, '蓝调': 75, 'blues': 75, '朋克': 160, 'punk': 160,
      'r&b': 85, 'rnb': 85,
    }
    
    for (const [g, bpm] of Object.entries(bpmRanges)) {
      if (genre.includes(g)) return bpm
    }
    return 95
  }

  private getGenreFeatures(genre: string) {
    const defaultFeatures = { energy: 0.5, danceability: 0.5, acousticness: 0.5 }
    const genreFeatures: Record<string, typeof defaultFeatures> = {
      '金属': { energy: 0.9, danceability: 0.5, acousticness: 0.1 }, 'metal': { energy: 0.9, danceability: 0.5, acousticness: 0.1 },
      '摇滚': { energy: 0.8, danceability: 0.5, acousticness: 0.2 }, 'rock': { energy: 0.8, danceability: 0.5, acousticness: 0.2 },
      '朋克': { energy: 0.9, danceability: 0.6, acousticness: 0.1 }, 'punk': { energy: 0.9, danceability: 0.6, acousticness: 0.1 },
      '电子': { energy: 0.8, danceability: 0.9, acousticness: 0.1 }, 'electronic': { energy: 0.8, danceability: 0.9, acousticness: 0.1 }, 'edm': { energy: 0.8, danceability: 0.9, acousticness: 0.1 },
      '说唱': { energy: 0.7, danceability: 0.8, acousticness: 0.2 }, 'rap': { energy: 0.7, danceability: 0.8, acousticness: 0.2 }, 'hip hop': { energy: 0.7, danceability: 0.8, acousticness: 0.2 },
      '流行': { energy: 0.6, danceability: 0.7, acousticness: 0.3 }, 'pop': { energy: 0.6, danceability: 0.7, acousticness: 0.3 },
      '民谣': { energy: 0.4, danceability: 0.4, acousticness: 0.8 }, 'folk': { energy: 0.4, danceability: 0.4, acousticness: 0.8 },
      '古典': { energy: 0.3, danceability: 0.3, acousticness: 0.9 }, 'classical': { energy: 0.3, danceability: 0.3, acousticness: 0.9 },
      '爵士': { energy: 0.5, danceability: 0.5, acousticness: 0.6 }, 'jazz': { energy: 0.5, danceability: 0.5, acousticness: 0.6 },
      '蓝调': { energy: 0.4, danceability: 0.4, acousticness: 0.7 }, 'blues': { energy: 0.4, danceability: 0.4, acousticness: 0.7 },
      '抒情': { energy: 0.3, danceability: 0.3, acousticness: 0.7 }, 'ballad': { energy: 0.3, danceability: 0.3, acousticness: 0.7 },
      '情歌': { energy: 0.4, danceability: 0.4, acousticness: 0.6 }, 'r&b': { energy: 0.5, danceability: 0.6, acousticness: 0.4 }, 'rnb': { energy: 0.5, danceability: 0.6, acousticness: 0.4 },
    }
    
    for (const [g, features] of Object.entries(genreFeatures)) {
      if (genre.includes(g)) return features
    }
    return defaultFeatures
  }

  private estimateValence(song: any): number {
    const text = `${song.title || ''} ${song.artist || ''}`.toLowerCase()
    const positiveWords = ['快乐', '开心', '笑', '爱', 'love', 'happy', 'smile', 'beautiful']
    const negativeWords = ['悲伤', '眼泪', '哭', '痛', 'sad', 'cry', 'tears', 'pain', 'goodbye', 'lonely']
    
    let score = 0.5
    positiveWords.forEach(word => { if (text.includes(word)) score += 0.08 })
    negativeWords.forEach(word => { if (text.includes(word)) score -= 0.1 })
    return Math.max(0.1, Math.min(0.9, score))
  }

  private estimateSpeechiness(genre: string): number {
    if (genre.includes('说唱') || genre.includes('rap') || genre.includes('hip hop')) return 0.8
    return 0.3
  }

  private calculateAllEmotions(song: any, features: any): Record<string, number> {
    const scores: Record<string, number> = {}
    const text = `${song.title || ''} ${song.artist || ''}`.toLowerCase()
    const genre = (song.genre || '').toLowerCase()
    
    Object.keys(EMOTION_KEYWORDS).forEach(emotion => { scores[emotion] = 0.1 })
    
    // 1. 关键词分析（40%）
    for (const [emotion, data] of Object.entries(EMOTION_KEYWORDS)) {
      let matchCount = 0
      data.words.forEach(word => { if (text.includes(word.toLowerCase())) matchCount++ })
      if (matchCount > 0) scores[emotion] += Math.min(1, matchCount * data.weight * 0.3)
    }
    
    // 2. BPM 分析（30%）
    for (const [range, data] of Object.entries(BPM_EMOTIONS)) {
      if (features.bpm >= data.min && features.bpm <= data.max) {
        data.emotions.forEach(emotion => { scores[emotion] += data.intensity * 0.3 })
        break
      }
    }
    
    // 3. 流派分析（30%）
    for (const [g, emotions] of Object.entries(GENRE_EMOTIONS)) {
      if (genre.includes(g)) {
        emotions.forEach(emotion => { scores[emotion] += 0.3 })
        break
      }
    }
    
    // 4. 音频特征调整
    if (features.energy > 0.7) scores['energetic'] += 0.2
    if (features.danceability > 0.7) scores['happy'] += 0.15
    if (features.acousticness > 0.7) { scores['relax'] += 0.15; scores['nostalgic'] += 0.1 }
    if (features.valence < 0.4) scores['sad'] += 0.2
    if (features.valence > 0.6) scores['happy'] += 0.15
    if (features.speechiness > 0.6) scores['energetic'] += 0.15
    
    // 归一化
    const maxScore = Math.max(...Object.values(scores))
    if (maxScore > 0) {
      Object.keys(scores).forEach(key => { scores[key] = Math.min(1, scores[key] / maxScore) })
    }
    
    return scores
  }

  private calculateSceneScore(scene: string, features: any, analysis: EmotionAnalysis): number {
    let score = 0.5
    switch (scene) {
      case 'morning': score += analysis.valence * 0.3 + (analysis.energy - 0.5) * 0.2; break
      case 'workout': score += (analysis.bpm - 100) / 100 * 0.3 + analysis.energy * 0.3; break
      case 'party': score += analysis.danceability * 0.3 + analysis.energy * 0.2; break
      case 'sleep': score += (1 - analysis.energy) * 0.3 + analysis.acousticness * 0.2; break
      case 'study': score += (1 - analysis.energy) * 0.2; break
      case 'drive': score += (analysis.bpm - 80) / 100 * 0.2 + analysis.energy * 0.2; break
      case 'rainy': score += (1 - analysis.valence) * 0.3 + analysis.acousticness * 0.2; break
      case 'social': score += analysis.danceability * 0.2 + (analysis.valence - 0.5) * 0.2; break
      case 'meditation': score += (1 - analysis.energy) * 0.3 + analysis.acousticness * 0.3; break
    }
    return Math.max(0, Math.min(1, score))
  }
}

const SCENE_RULES: Record<string, (features: any, analysis: EmotionAnalysis) => boolean> = {
  morning: (_, a) => a.valence > 0.5 && a.energy > 0.4,
  workout: (_, a) => a.bpm > 120 && a.energy > 0.6,
  party: (_, a) => a.bpm > 110 && a.danceability > 0.6 && a.energy > 0.7,
  sleep: (_, a) => a.bpm < 80 && a.energy < 0.4,
  study: (_, a) => a.energy > 0.2 && a.energy < 0.6,
  drive: (_, a) => a.bpm > 90 && a.energy > 0.4,
  rainy: (_, a) => a.valence < 0.5 && a.acousticness > 0.5,
  social: (_, a) => a.danceability > 0.5 && a.energy > 0.5,
  meditation: (_, a) => a.bpm < 70 && a.energy < 0.3,
}

export const musicEmotionAnalyzer = new MusicEmotionAnalyzer()
