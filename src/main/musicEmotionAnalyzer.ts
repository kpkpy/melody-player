/**
 * 音乐情绪分析系统 - 12Tones 重构版
 * 
 * 基于 Sony 12Tones (SensMe) 理念：
 * 两个主轴：情绪（Mood）× 节奏（Tempo）= 12 个情绪分类
 * 
 * 音频特征提取策略：
 * - 有音频文件时：通过 Web Audio API (OfflineAudioContext) 提取真实特征
 * - 无音频文件时：通过 metadata（流派、时长等）+ 启发式算法推断
 * - 支持后期接入 ffmpeg/essentia.js 做深度分析
 */

export interface AudioFeatures {
  // 节奏特征
  bpm: number
  tempoConfidence: number
  
  // 能量特征
  energy: number // 0-1, 综合能量强度
  rmsEnergy: number // 0-1, RMS 能量
  dynamicRange: number // 0-1, 动态范围
  
  // 频谱特征
  spectralCentroid: number // Hz, 频谱质心（亮度）
  spectralFlatness: number // 0-1, 噪声vs乐音比
  spectralRolloff: number // Hz, 高频滚降点
  zeroCrossingRate: number // 0-1, 零交叉率
  
  // 调性特征
  key: string // C, C#, D, ...
  mode: 'major' | 'minor' | 'unknown' // 大调/小调
  keyStrength: number // 0-1, 调性检测置信度
  
  // 感知特征（组合计算）
  danceability: number // 0-1, 可舞性
  valence: number // 0-1, 正向情感度（快乐vs悲伤）
  acousticness: number // 0-1, 原声程度
  instrumentalness: number // 0-1, 器乐程度
  speechiness: number // 0-1, 语音程度
  
  // 响度特征
  loudness: number // dB, 整体响度
  loudnessRange: number // dB, 响度动态范围
  
  // 音频特征质量
  featuresSource: 'audio' | 'metadata' | 'estimated' // 特征来源
}

export interface EmotionAnalysis {
  // 12Tones 情绪分类
  primaryTone: string // 主情绪频道
  confidence: number // 0-1, 分类置信度
  
  // 情绪评分（2D 空间映射）
  moodScore: number // -1 (sad) ~ +1 (happy)
  tempoScore: number // -1 (slow) ~ +1 (fast)
  
  // 辅助情绪标签
  secondaryTones: string[] // 最多 2 个相近情绪
  emotionDescription: string // 情绪描述文本
  
  // 音频特征快照
  features: AudioFeatures
}

export interface SceneClassification {
  scenes: { scene: string; score: number }[]
  primaryScene: string
  description: string
}

// ============================================================
// 12Tones 情绪分类体系（基于 Sony SensMe）
// 两个维度：Mood（正/负）× Tempo（快/慢）
// ============================================================

const TONES_12 = {
  // === 高 Mood + 快节奏 ===
  'Dance': { mood: 0.8, tempo: 0.7, description: '欢快舞曲·活力四射', keywords: ['dance', 'disco', 'electro', 'swing'] },
  'Upbeat': { mood: 0.9, tempo: 0.5, description: '积极向上·明亮轻快', keywords: ['happy', 'sunshine', 'smile', 'positive'] },
  'Energetic': { mood: 0.6, tempo: 0.8, description: '充满能量·强劲有力', keywords: ['energy', 'power', 'fire', 'rock'] },
  
  // === 低 Mood + 快节奏 ===
  'Extreme': { mood: -0.7, tempo: 0.9, description: '极致激烈·震撼冲击', keywords: ['metal', 'extreme', 'heavy', 'aggressive'] },
  'Angry': { mood: -0.8, tempo: 0.7, description: '愤怒激烈·情绪爆发', keywords: ['angry', 'rage', 'fury', 'mad'] },
  'Intense': { mood: -0.4, tempo: 0.8, description: '紧张强烈·扣人心弦', keywords: ['dramatic', 'tension', 'epic', 'intense'] },
  
  // === 高 Mood + 慢节奏 ===
  'Romantic': { mood: 0.8, tempo: -0.3, description: '浪漫深情·温柔缱绻', keywords: ['love', 'romantic', 'tender', 'sweet'] },
  'Mellow': { mood: 0.5, tempo: -0.5, description: '柔和舒适·轻松惬意', keywords: ['mellow', 'soft', 'gentle', 'smooth'] },
  'Peaceful': { mood: 0.7, tempo: -0.7, description: '宁静安详·平和舒展', keywords: ['peace', 'calm', 'serene', 'tranquil'] },
  
  // === 低 Mood + 慢节奏 ===
  'Sad': { mood: -0.8, tempo: -0.5, description: '伤感抒情·心绪纷飞', keywords: ['sad', 'tears', 'heartbreak', 'lonely'] },
  'Melancholy': { mood: -0.4, tempo: -0.7, description: '忧郁沉思·淡淡哀愁', keywords: ['melancholy', 'wistful', ' contemplative'] },
  'Relax': { mood: 0.3, tempo: -0.8, description: '放松舒缓·安逸悠闲', keywords: ['relax', 'chill', 'ambient', 'meditation'] },
} as const

// BPM → tempoScore 映射（-1 ~ +1）
function bpmToTempoScore(bpm: number): number {
  if (bpm <= 60) return -1.0
  if (bpm >= 180) return 1.0
  // 60-180 BPM 线性映射到 -1 ~ +1
  return ((bpm - 60) / 120) * 2 - 1
}

// 情感/频谱特征 → moodScore 映射（-1 ~ +1）
function featuresToMoodScore(valence: number, mode: string, spectralCentroid: number): number {
  // valence 直接贡献
  const valenceContribution = (valence - 0.5) * 2 // -1 ~ +1
  
  // 调式贡献（大调偏正向，小调偏负向）
  const modeContribution = mode === 'major' ? 0.3 : mode === 'minor' ? -0.2 : 0
  
  // 频谱质心（明亮度）→ 正向
  const brightnessContribution = Math.min(1, spectralCentroid / 4000) * 0.3 - 0.15
  
  return Math.max(-1, Math.min(1,
    valenceContribution * 0.5 + modeContribution * 0.3 + brightnessContribution * 0.2
  ))
}

// 2D mood/tempo 坐标 → 最近 12Tones 情绪
function findClosestTones(moodScore: number, tempoScore: number, topN: number = 3): string[] {
  const distances = Object.entries(TONES_12).map(([tone, data]) => {
    const dx = moodScore - data.mood
    const dy = tempoScore - data.tempo
    return { tone, distance: Math.sqrt(dx * dx + dy * dy) }
  })
  
  distances.sort((a, b) => a.distance - b.distance)
  return distances.slice(0, topN).map(d => d.tone)
}

// ============================================================
// 流派特征参考库（用于 metadata fallback）
// ============================================================

const GENRE_AUDIO_PROFILE: Record<string, Partial<AudioFeatures>> = {
  // 电子舞曲类
  'EDM': { energy: 0.85, danceability: 0.9, acousticness: 0.05, instrumentalness: 0.4, bpm: 128, valence: 0.7 },
  'electronic': { energy: 0.75, danceability: 0.8, acousticness: 0.1, instrumentalness: 0.6, bpm: 125, valence: 0.65 },
  'techno': { energy: 0.8, danceability: 0.85, acousticness: 0.02, instrumentalness: 0.8, bpm: 130, valence: 0.5 },
  'house': { energy: 0.7, danceability: 0.85, acousticness: 0.05, instrumentalness: 0.5, bpm: 122, valence: 0.65 },
  'trance': { energy: 0.7, danceability: 0.7, acousticness: 0.05, instrumentalness: 0.7, bpm: 138, valence: 0.6 },
  
  // 流行类
  'pop': { energy: 0.6, danceability: 0.7, acousticness: 0.2, instrumentalness: 0.1, bpm: 110, valence: 0.65 },
  '流行': { energy: 0.6, danceability: 0.7, acousticness: 0.2, instrumentalness: 0.1, bpm: 112, valence: 0.65 },
  'kpop': { energy: 0.7, danceability: 0.8, acousticness: 0.1, instrumentalness: 0.05, bpm: 115, valence: 0.75 },
  
  // 摇滚类
  'rock': { energy: 0.75, danceability: 0.5, acousticness: 0.15, instrumentalness: 0.3, bpm: 125, valence: 0.5 },
  '摇滚': { energy: 0.75, danceability: 0.5, acousticness: 0.15, instrumentalness: 0.3, bpm: 125, valence: 0.5 },
  'classic rock': { energy: 0.65, danceability: 0.55, acousticness: 0.2, instrumentalness: 0.25, bpm: 115, valence: 0.55 },
  'metal': { energy: 0.9, danceability: 0.4, acousticness: 0.05, instrumentalness: 0.5, bpm: 150, valence: 0.3 },
  '金属': { energy: 0.9, danceability: 0.4, acousticness: 0.05, instrumentalness: 0.5, bpm: 150, valence: 0.3 },
  'punk': { energy: 0.85, danceability: 0.6, acousticness: 0.05, instrumentalness: 0.2, bpm: 160, valence: 0.4 },
  
  // 嘻哈/说唱
  'hip hop': { energy: 0.65, danceability: 0.8, acousticness: 0.1, instrumentalness: 0.02, bpm: 90, valence: 0.55, speechiness: 0.7 },
  'rap': { energy: 0.65, danceability: 0.8, acousticness: 0.1, instrumentalness: 0.02, bpm: 90, valence: 0.55, speechiness: 0.75 },
  '说唱': { energy: 0.65, danceability: 0.8, acousticness: 0.1, instrumentalness: 0.02, bpm: 90, valence: 0.55, speechiness: 0.75 },
  'r&b': { energy: 0.5, danceability: 0.7, acousticness: 0.2, instrumentalness: 0.05, bpm: 85, valence: 0.6 },
  'rnb': { energy: 0.5, danceability: 0.7, acousticness: 0.2, instrumentalness: 0.05, bpm: 85, valence: 0.6 },
  
  // 原声/民谣
  'folk': { energy: 0.35, danceability: 0.4, acousticness: 0.8, instrumentalness: 0.2, bpm: 95, valence: 0.55 },
  '民谣': { energy: 0.35, danceability: 0.4, acousticness: 0.8, instrumentalness: 0.2, bpm: 95, valence: 0.55 },
  'acoustic': { energy: 0.3, danceability: 0.35, acousticness: 0.85, instrumentalness: 0.3, bpm: 90, valence: 0.5 },
  
  // 古典
  'classical': { energy: 0.25, danceability: 0.2, acousticness: 0.95, instrumentalness: 0.9, bpm: 80, valence: 0.45 },
  '古典': { energy: 0.25, danceability: 0.2, acousticness: 0.95, instrumentalness: 0.9, bpm: 80, valence: 0.45 },
  'orchestral': { energy: 0.3, danceability: 0.15, acousticness: 0.95, instrumentalness: 0.95, bpm: 75, valence: 0.4 },
  
  // 爵士/蓝调
  'jazz': { energy: 0.45, danceability: 0.5, acousticness: 0.7, instrumentalness: 0.5, bpm: 95, valence: 0.55 },
  '爵士': { energy: 0.45, danceability: 0.5, acousticness: 0.7, instrumentalness: 0.5, bpm: 95, valence: 0.55 },
  'blues': { energy: 0.4, danceability: 0.45, acousticness: 0.65, instrumentalness: 0.4, bpm: 85, valence: 0.4 },
  '蓝调': { energy: 0.4, danceability: 0.45, acousticness: 0.65, instrumentalness: 0.4, bpm: 85, valence: 0.4 },
  
  // 抒情/情歌
  'ballad': { energy: 0.3, danceability: 0.3, acousticness: 0.6, instrumentalness: 0.1, bpm: 70, valence: 0.4 },
  '情歌': { energy: 0.3, danceability: 0.3, acousticness: 0.6, instrumentalness: 0.1, bpm: 68, valence: 0.45 },
  '抒情': { energy: 0.25, danceability: 0.25, acousticness: 0.65, instrumentalness: 0.15, bpm: 65, valence: 0.4 },
  
  // 环境/氛围
  'ambient': { energy: 0.15, danceability: 0.1, acousticness: 0.8, instrumentalness: 0.95, bpm: 60, valence: 0.4 },
  'chill': { energy: 0.2, danceability: 0.3, acousticness: 0.6, instrumentalness: 0.5, bpm: 75, valence: 0.5 },
  'lofi': { energy: 0.3, danceability: 0.5, acousticness: 0.5, instrumentalness: 0.6, bpm: 80, valence: 0.55 },
}

const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// ============================================================
// 核心分析引擎
// ============================================================

export class MusicEmotionAnalyzer {
  
  /**
   * 分析歌曲情绪（12Tones 体系）
   * 
   * @param song 歌曲信息（title, artist, genre, duration, filePath 等）
   * @param audioFeatures 可选的音频特征（通过 Web Audio API 提取的真实特征）
   */
  analyzeEmotion(song: any, audioFeatures?: Partial<AudioFeatures>): EmotionAnalysis {
    // 合并真实音频特征和元数据推断
    const features = this.buildAudioFeatures(song, audioFeatures)
    
    // 计算情绪坐标
    const moodScore = featuresToMoodScore(
      features.valence,
      features.mode,
      features.spectralCentroid
    )
    const tempoScore = bpmToTempoScore(features.bpm)
    
    // 找最近的 12Tones 情绪
    const closest = findClosestTones(moodScore, tempoScore, 3)
    
    // 计算分类置信度（最近距离的反比）
    const toneData = TONES_12[closest[0] as keyof typeof TONES_12]
    const moodDist = Math.abs(moodScore - toneData.mood)
    const tempoDist = Math.abs(tempoScore - toneData.tempo)
    const confidence = Math.max(0, Math.min(1, 1 - (moodDist + tempoDist) / 2))
    
    return {
      primaryTone: closest[0],
      secondaryTones: closest.slice(1),
      moodScore,
      tempoScore,
      confidence,
      emotionDescription: toneData.description,
      features,
    }
  }
  
  /**
   * 场景分类（基于情绪 + 音频特征）
   */
  classifyScene(song: any, analysis: EmotionAnalysis): SceneClassification {
    const { features } = analysis
    const scoredScenes: { scene: string; score: number }[] = []
    
    // 场景规则集（多特征综合评分）
    const sceneRules: Record<string, (f: AudioFeatures, a: EmotionAnalysis) => number> = {
      // === 时间段场景 ===
      'Morning': (f, a) => {
        // 早晨：中-high valence + 中速 BPM
        const moodBonus = (a.moodScore + 1) / 2 * 0.4
        const tempoMatch = 1 - Math.abs(normalizeTempo(f.bpm, 90, 120)) * 0.3
        return clamp(moodBonus + tempoMatch * 0.3 + 0.3)
      },
      'Daytime': (f, a) => {
        // 白天：中高 valence + 中高速 BPM
        const valenceBonus = f.valence * 0.35
        const energyBonus = f.energy * 0.25
        const danceabilityBonus = f.danceability * 0.2
        return clamp(valenceBonus + energyBonus + danceabilityBonus + 0.2)
      },
      'Evening': (f, a) => {
        // 傍晚：中 valence + 中低速 BPM
        const moodBonus = clamp((a.moodScore + 1) / 2) * 0.3
        const slowBonus = (1 - Math.abs(normalizeTempo(f.bpm, 75, 110))) * 0.3
        return clamp(moodBonus + slowBonus + 0.25)
      },
      'Night': (f, a) => {
        // 深夜：低-energy + 慢速 BPM + 低 valence 或高 valence（两极）
        const slowBonus = (f.bpm < 100 ? (100 - f.bpm) / 80 : 0) * 0.3
        const energyBonus = (1 - f.energy) * 0.3
        const acousticBonus = f.acousticness * 0.2
        return clamp(slowBonus + energyBonus + acousticBonus + 0.15)
      },
      
      // === 活动场景 ===
      'Workout': (f, a) => {
        // 运动：high-energy + fast BPM + high danceability
        const energyScore = f.energy * 0.4
        const tempoScore = clamp((f.bpm - 110) / 80) * 0.3
        const danceScore = f.danceability * 0.3
        return clamp(energyScore + tempoScore + danceScore + 0.1)
      },
      'Party': (f, a) => {
        // 派对：high danceability + high energy + high valence
        const danceScore = f.danceability * 0.35
        const energyScore = f.energy * 0.3
        const valenceScore = f.valence * 0.25
        return clamp(danceScore + energyScore + valenceScore + 0.1)
      },
      'Study': (f, a) => {
        // 学习：low-mid energy + low instrumentalness (or high) + steady
        const lowEnergy = (f.energy < 0.5 ? 1 - f.energy * 2 : 0) * 0.3
        const instrumentalBonus = Math.max(f.instrumentalness, 1 - f.speechiness) * 0.3
        const steadyBonus = (1 - f.speechiness) * 0.2
        return clamp(lowEnergy + instrumentalBonus + steadyBonus + 0.2)
      },
      'Sleep': (f, a) => {
        // 睡眠：very low energy + slow tempo + high acousticness
        const energyScore = (1 - f.energy) * 0.35
        const tempoScore = clamp((100 - f.bpm) / 80) * 0.3
        const acousticScore = f.acousticness * 0.25
        return clamp(energyScore + tempoScore + acousticScore + 0.1)
      },
      'Drive': (f, a) => {
        // 驾驶：medium-high energy + medium tempo + good rhythm
        const energyScore = clamp(f.energy) * 0.3
        const tempoScore = clamp(1 - Math.abs(normalizeTempo(f.bpm, 90, 130))) * 0.3
        const rhythmScore = f.tempoConfidence * 0.2
        return clamp(energyScore + tempoScore + rhythmScore + 0.2)
      },
      'Commute': (f, a) => {
        // 通勤：medium一切 + 多样化
        const mediumEnergy = 1 - Math.abs(f.energy - 0.5) * 2 * 0.3
        const mediumDance = f.danceability * 0.25
        const varietyBonus = clamp(1 - Math.abs(a.moodScore)) * 0.2
        return clamp(mediumEnergy + mediumDance + varietyBonus + 0.25)
      },
      
      // === 情绪场景 ===
      'Romantic': (f, a) => {
        // 浪漫：high mood + low-mid tempo + acoustic
        const moodScore = clamp((a.moodScore + 1) / 2) * 0.35
        const slowBonus = clamp(1 - Math.abs(normalizeTempo(f.bpm, 60, 90))) * 0.3
        const acousticBonus = f.acousticness * 0.25
        return clamp(moodScore + slowBonus + acousticBonus + 0.1)
      },
      'Sad': (f, a) => {
        // 悲伤：low mood + slow tempo + high acousticness
        const sadScore = clamp((-a.moodScore + 1) / 2) * 0.35
        const tempoScore = clamp((100 - f.bpm) / 80) * 0.3
        const acousticBonus = f.acousticness * 0.25
        return clamp(sadScore + tempoScore + acousticBonus + 0.1)
      },
      'Focus': (f, a) => {
        // 专注：low-mid energy + low speech + instrumental/ambient
        const energyBonus = (f.energy < 0.5 ? 0.3 : 0)
        const speechBonus = (1 - f.speechiness) * 0.3
        const instBonus = f.instrumentalness * 0.3
        return clamp(energyBonus + speechBonus + instBonus + 0.1)
      },
      'Celebrate': (f, a) => {
        // 庆祝：high valence + high energy + high danceability
        const valenceScore = f.valence * 0.35
        const energyScore = f.energy * 0.3
        const danceScore = f.danceability * 0.25
        return clamp(valenceScore + energyScore + danceScore + 0.1)
      },
    }
    
    for (const [scene, rule] of Object.entries(sceneRules)) {
      const score = rule(features, analysis)
      if (score > 0.3) {
        scoredScenes.push({ scene, score })
      }
    }
    
    scoredScenes.sort((a, b) => b.score - a.score)
    
    const primary = scoredScenes[0]?.score > 0.4 ? scoredScenes[0] : null
    
    return {
      scenes: scoredScenes.slice(0, 3),
      primaryScene: primary?.scene || 'Noon',
      description: primary ? `${primary.scene}（匹配度 ${Math.round(primary.score * 100)}%）` : '通用场景',
    }
  }
  
  // ============================================================
  // 内部方法：构建完整的 AudioFeatures
  // ============================================================
  
  private buildAudioFeatures(song: any, provided?: Partial<AudioFeatures>): AudioFeatures {
    // 1. 使用提供的真实音频特征（如果有）
    if (provided && provided.featuresSource === 'audio') {
      return this.mergeWithDefaults(provided)
    }
    
    // 2. Metadata 推断特征
    const genreProfile = this.getGenreProfile(song)
    return this.mergeWithDefaults({
      ...genreProfile,
      featuresSource: provided?.featuresSource || 'estimated',
    })
  }
  
  private mergeWithDefaults(override: Partial<AudioFeatures>): AudioFeatures {
    return {
      bpm: override.bpm ?? 100,
      tempoConfidence: override.tempoConfidence ?? 0.5,
      energy: override.energy ?? 0.5,
      rmsEnergy: override.rmsEnergy ?? override.energy ?? 0.5,
      dynamicRange: override.dynamicRange ?? 0.5,
      spectralCentroid: override.spectralCentroid ?? 2500,
      spectralFlatness: override.spectralFlatness ?? 0.3,
      spectralRolloff: override.spectralRolloff ?? 8000,
      zeroCrossingRate: override.zeroCrossingRate ?? 0.1,
      key: override.key ?? this.guessKey(song),
      mode: override.mode ?? 'unknown',
      keyStrength: override.keyStrength ?? 0.3,
      danceability: override.danceability ?? 0.5,
      valence: override.valence ?? 0.5,
      acousticness: override.acousticness ?? 0.5,
      instrumentalness: override.instrumentalness ?? 0.3,
      speechiness: override.speechiness ?? 0.3,
      loudness: override.loudness ?? -14,
      loudnessRange: override.loudnessRange ?? 8,
      featuresSource: override.featuresSource ?? 'estimated',
    }
  }
  
  private getGenreProfile(song: any): Partial<AudioFeatures> {
    const genre = (song.genre ?? '').toLowerCase()
    
    // 精确匹配
    for (const [key, profile] of Object.entries(GENRE_AUDIO_PROFILE)) {
      if (genre.includes(key.toLowerCase()) || key.toLowerCase().includes(genre)) {
        return { ...profile, featuresSource: 'metadata' }
      }
    }
    
    // 多关键词模糊匹配
    const genreWords = genre.split(/[\s,\/\-]+/)
    let bestMatch: Partial<AudioFeatures> | null = null
    let bestScore = 0
    
    for (const word of genreWords) {
      for (const [key, profile] of Object.entries(GENRE_AUDIO_PROFILE)) {
        if (key.toLowerCase().includes(word) || word.includes(key.toLowerCase())) {
          const score = key.length + word.length
          if (score > bestScore) {
            bestScore = score
            bestMatch = profile
          }
        }
      }
    }
    
    return bestMatch ? { ...bestMatch, featuresSource: 'metadata' } : { featuresSource: 'metadata' }
  }
  
  private guessKey(song: any): string {
    // 从 album 信息或其他方式猜测 key（如果存在）
    return KEY_NAMES[Math.floor(Math.random() * 12)]
  }
}

// ============================================================
// 工具函数
// ============================================================

function clamp(v: number): number {
  return Math.max(0, Math.min(1, v))
}

function normalizeTempo(bpm: number, slow: number, fast: number): number {
  // 归一化 BPM 到 -1 (slow) ~ +1 (fast)
  if (bpm <= slow) return -1
  if (bpm >= fast) return 1
  return ((bpm - slow) / (fast - slow)) * 2 - 1
}

// ============================================================
// 导出
// ============================================================

export const musicEmotionAnalyzer = new MusicEmotionAnalyzer()

// 工具函数导出（供外部音频分析使用）
export {
  bpmToTempoScore,
  featuresToMoodScore,
  findClosestTones,
  clamp,
  normalizeTempo,
}