import { app } from 'electron'
import { join } from 'path'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { musicEmotionAnalyzer } from './musicEmotionAnalyzer'
import { MusicLibrary } from './musicLibrary'

export interface ListeningStats {
  totalPlayTime: number // 总播放时长（秒）
  totalPlays: number // 总播放次数
  songs: Map<string, SongStats> // 歌曲统计
  artists: Map<string, ArtistStats> // 艺术家统计
  albums: Map<string, AlbumStats> // 专辑统计
  dailyPlays: Map<string, number> // 每日播放次数 (date -> count)
  hourlyPlays: Map<number, number> // 每小时播放次数 (hour 0-23 -> count)
  weeklyPlays: Map<number, number> // 每周播放次数 (day 0-6 -> count)
  lastUpdated: number
}

export interface SongStats {
  id: string
  title: string
  artist: string
  album: string
  playCount: number
  totalPlayTime: number // 秒
  lastPlayed: number
  skipCount: number
  completionRate: number // 完成率 0-1
  favorite: boolean
  emotionTags: string[] // 情感标签
}

export interface ArtistStats {
  name: string
  playCount: number
  totalPlayTime: number
  songsPlayed: Set<string>
  lastPlayed: number
}

export interface AlbumStats {
  title: string
  artist: string
  playCount: number
  totalPlayTime: number
  songsPlayed: Set<string>
  lastPlayed: number
}

export class StatsManager {
  private stats: ListeningStats = {
    totalPlayTime: 0,
    totalPlays: 0,
    songs: new Map(),
    artists: new Map(),
    albums: new Map(),
    dailyPlays: new Map(),
    hourlyPlays: new Map(),
    weeklyPlays: new Map(),
    lastUpdated: Date.now(),
  }
  
  private currentSong: SongStats | null = null
  private playStartTime: number = 0
  private filePath: string
  private musicLibrary: MusicLibrary | null = null

  constructor(musicLibrary?: MusicLibrary) {
    this.filePath = join(app.getPath('userData'), 'listening-stats.json')
    if (musicLibrary) {
      this.musicLibrary = musicLibrary
    }
    this.loadStats()
  }

  setMusicLibrary(library: MusicLibrary) {
    this.musicLibrary = library
  }

  private loadStats(): void {
    if (existsSync(this.filePath)) {
      try {
        const data = readFileSync(this.filePath, 'utf-8')
        const saved = JSON.parse(data)
        
        // 恢复 Maps
        this.stats.totalPlayTime = saved.totalPlayTime || 0
        this.stats.totalPlays = saved.totalPlays || 0
        this.stats.lastUpdated = saved.lastUpdated || Date.now()
        
        // 恢复歌曲统计
        this.stats.songs = new Map(saved.songs || [])
        
        // 恢复艺术家统计
        this.stats.artists = new Map(saved.artists || [])
        
        // 恢复专辑统计
        this.stats.albums = new Map(saved.albums || [])
        
        // 恢复日期统计
        this.stats.dailyPlays = new Map(saved.dailyPlays || [])
        this.stats.hourlyPlays = new Map(saved.hourlyPlays || [])
        this.stats.weeklyPlays = new Map(saved.weeklyPlays || [])
        
        console.log('Stats loaded successfully')
      } catch (e) {
        console.error('Failed to load stats:', e)
        this.initializeEmptyStats()
      }
    } else {
      this.initializeEmptyStats()
    }
  }

  private initializeEmptyStats(): void {
    this.stats = {
      totalPlayTime: 0,
      totalPlays: 0,
      songs: new Map(),
      artists: new Map(),
      albums: new Map(),
      dailyPlays: new Map(),
      hourlyPlays: new Map(),
      weeklyPlays: new Map(),
      lastUpdated: Date.now(),
    }
  }

  private saveStats(): void {
    try {
      const toSave = {
        ...this.stats,
        songs: Array.from(this.stats.songs.entries()),
        artists: Array.from(this.stats.artists.entries()),
        albums: Array.from(this.stats.albums.entries()),
        dailyPlays: Array.from(this.stats.dailyPlays.entries()),
        hourlyPlays: Array.from(this.stats.hourlyPlays.entries()),
        weeklyPlays: Array.from(this.stats.weeklyPlays.entries()),
      }
      writeFileSync(this.filePath, JSON.stringify(toSave, null, 2))
    } catch (e) {
      console.error('Failed to save stats:', e)
    }
  }

  // 开始播放歌曲
  startPlaying(song: any): void {
    this.stopCurrentPlay() // 停止之前的播放

    const now = Date.now()
    this.playStartTime = now
    
    // 自动分析歌曲情绪（如果没有分析过）
    if (!song.emotionAnalysis) {
      try {
        const analysis = musicEmotionAnalyzer.analyzeEmotion(song)
        const scenes = musicEmotionAnalyzer.classifyScene(song, analysis)
        song.emotionAnalysis = analysis
        song.sceneClassification = scenes
        song.emotionTags = [analysis.primaryEmotion, ...analysis.secondaryEmotions, ...scenes.scenes]
      } catch (e) {
        console.error('Emotion analysis error:', e)
      }
    }

    // 获取或创建歌曲统计
    let songStats = this.stats.songs.get(song.id)
    if (!songStats) {
      songStats = {
        id: song.id,
        title: song.title,
        artist: song.artist,
        album: song.album || '',
        playCount: 0,
        totalPlayTime: 0,
        lastPlayed: 0,
        skipCount: 0,
        completionRate: 0,
        favorite: false,
        emotionTags: song.emotionTags || [],
      }
      this.stats.songs.set(song.id, songStats)
    }

    // 更新艺术家统计
    let artistStats = this.stats.artists.get(song.artist)
    if (!artistStats) {
      artistStats = {
        name: song.artist,
        playCount: 0,
        totalPlayTime: 0,
        songsPlayed: new Set(),
        lastPlayed: 0,
      }
      this.stats.artists.set(song.artist, artistStats)
    }
    artistStats.songsPlayed.add(song.id)

    // 更新专辑统计
    if (song.album) {
      const albumKey = `${song.album}||${song.artist}`
      let albumStats = this.stats.albums.get(albumKey)
      if (!albumStats) {
        albumStats = {
          title: song.album,
          artist: song.artist,
          playCount: 0,
          totalPlayTime: 0,
          songsPlayed: new Set(),
          lastPlayed: 0,
        }
        this.stats.albums.set(albumKey, albumStats)
      }
      albumStats.songsPlayed.add(song.id)
    }

    this.currentSong = songStats
  }

  // 停止当前播放（切歌或暂停）
  stopCurrentPlay(completed: boolean = false): void {
    if (!this.currentSong) return

    const now = Date.now()
    const playDuration = (now - this.playStartTime) / 1000 // 秒
    
    if (playDuration < 30) {
      // 播放少于 30 秒算跳过
      this.currentSong.skipCount++
      
      if (completed) {
        // 切歌
        this.currentSong = null
      }
      return
    }

    // 更新统计
    this.currentSong.playCount++
    this.currentSong.totalPlayTime += playDuration
    this.currentSong.lastPlayed = now
    
    // 更新总统计
    this.stats.totalPlays++
    this.stats.totalPlayTime += playDuration

    // 更新日期统计
    const dateKey = new Date().toISOString().split('T')[0]
    this.stats.dailyPlays.set(dateKey, (this.stats.dailyPlays.get(dateKey) || 0) + 1)

    // 更新小时统计
    const hour = new Date().getHours()
    this.stats.hourlyPlays.set(hour, (this.stats.hourlyPlays.get(hour) || 0) + 1)

    // 更新星期统计
    const dayOfWeek = new Date().getDay()
    this.stats.weeklyPlays.set(dayOfWeek, (this.stats.weeklyPlays.get(dayOfWeek) || 0) + 1)

    // 更新艺术家统计
    const artistStats = this.stats.artists.get(this.currentSong.artist)
    if (artistStats) {
      artistStats.playCount++
      artistStats.totalPlayTime += playDuration
      artistStats.lastPlayed = now
    }

    // 更新专辑统计
    if (this.currentSong.album) {
      const albumKey = `${this.currentSong.album}||${this.currentSong.artist}`
      const albumStats = this.stats.albums.get(albumKey)
      if (albumStats) {
        albumStats.playCount++
        albumStats.totalPlayTime += playDuration
        albumStats.lastPlayed = now
      }
    }

    this.saveStats()
    
    if (completed) {
      this.currentSong = null
    }
  }

  // 标记喜欢
  toggleFavorite(songId: string): boolean {
    const songStats = this.stats.songs.get(songId)
    if (!songStats) return false
    
    songStats.favorite = !songStats.favorite
    this.saveStats()
    return songStats.favorite
  }

  // 添加情感标签
  addEmotionTag(songId: string, tag: string): void {
    const songStats = this.stats.songs.get(songId)
    if (!songStats) return
    
    if (!songStats.emotionTags.includes(tag)) {
      songStats.emotionTags.push(tag)
      this.saveStats()
    }
  }

  // 移除情感标签
  removeEmotionTag(songId: string, tag: string): void {
    const songStats = this.stats.songs.get(songId)
    if (!songStats) return
    
    songStats.emotionTags = songStats.emotionTags.filter(t => t !== tag)
    this.saveStats()
  }

  // 获取统计数据
  getStats(): ListeningStats {
    return { ...this.stats }
  }

  // 获取最常播放的歌曲
  getTopSongs(limit: number = 10): SongStats[] {
    return Array.from(this.stats.songs.values())
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, limit)
  }

  // 获取最常播放的艺术家
  getTopArtists(limit: number = 10): ArtistStats[] {
    return Array.from(this.stats.artists.values())
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, limit)
  }

  // 获取最近播放
  getRecentlyPlayed(limit: number = 20): SongStats[] {
    return Array.from(this.stats.songs.values())
      .filter(s => s.lastPlayed > 0)
      .sort((a, b) => b.lastPlayed - a.lastPlayed)
      .slice(0, limit)
  }

  // 获取每日播放统计
  getDailyStats(): { date: string; count: number }[] {
    return Array.from(this.stats.dailyPlays.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }))
  }

  // 清空统计
  clearStats(): void {
    this.initializeEmptyStats()
    this.saveStats()
  }

  // 获取推荐（基于播放历史）
  getRecommendations(songId: string, limit: number = 10): any[] {
    const songStats = this.stats.songs.get(songId)
    if (!songStats) {
      // 如果没有指定歌曲，返回最常播放的艺术家
      return Array.from(this.stats.songs.values())
        .filter(s => !s.favorite)
        .sort((a, b) => b.playCount - a.playCount)
        .slice(0, limit)
    }
    
    // 基于情感和艺术家推荐
    const recommendations = []
    const songArtist = songStats.artist
    
    // 同艺术家
    const sameArtist = Array.from(this.stats.songs.values())
      .filter(s => s.artist === songArtist && s.id !== songId)
      .sort((a, b) => b.playCount - a.playCount)
    
    recommendations.push(...sameArtist.slice(0, 5))
    
    // 同情感标签
    if (songStats.emotionTags.length > 0) {
      const sameEmotion = Array.from(this.stats.songs.values())
        .filter(s => 
          s.id !== songId &&
          s.artist !== songArtist &&
          s.emotionTags.some(tag => songStats.emotionTags.includes(tag))
        )
        .sort((a, b) => b.playCount - a.playCount)
      
      recommendations.push(...sameEmotion.slice(0, 5))
    }
    
    // 去重
    const unique = new Map(recommendations.map(s => [s.id, s]))
    return Array.from(unique.values()).slice(0, limit)
  }

  // 获取智能歌单（基于场景）
  getSmartPlaylist(scene: 'focus' | 'workout' | 'relax' | 'party'): any[] {
    const allSongs = Array.from(this.stats.songs.values())
    
    switch (scene) {
      case 'focus':
        // 专注：播放次数多、完成率高的歌曲
        return allSongs
          .filter(s => s.playCount > 5 && s.completionRate > 0.7)
          .sort((a, b) => b.playCount - a.playCount)
          .slice(0, 30)
      
      case 'workout':
        // 运动：情感标签为"激昂"或"运动"的歌曲
        return allSongs
          .filter(s => s.emotionTags.includes('激昂') || s.emotionTags.includes('运动'))
          .sort((a, b) => b.playCount - a.playCount)
          .slice(0, 30)
      
      case 'relax':
        // 放松：情感标签为"放松"或"悲伤"的歌曲
        return allSongs
          .filter(s => s.emotionTags.includes('放松') || s.emotionTags.includes('悲伤'))
          .sort((a, b) => b.playCount - a.playCount)
          .slice(0, 30)
      
      case 'party':
        // 派对：情感标签为"开心"或"激昂"的歌曲
        return allSongs
          .filter(s => s.emotionTags.includes('开心') || s.emotionTags.includes('激昂'))
          .sort((a, b) => b.playCount - a.playCount)
          .slice(0, 30)
      
      default:
        return []
    }
  }

  // 获取喜欢收藏
  getFavorites(): any[] {
    return Array.from(this.stats.songs.values())
      .filter(s => s.favorite)
      .sort((a, b) => b.lastPlayed - a.lastPlayed)
  }

  // 获取按情绪分类的歌曲
  getSongsByEmotion(emotion: string): any[] {
    return Array.from(this.stats.songs.values())
      .filter(s => s.emotionTags?.includes(emotion))
      .sort((a, b) => b.playCount - a.playCount)
  }

  // 获取按场景分类的歌曲
  getSongsByScene(scene: string): any[] {
    return Array.from(this.stats.songs.values())
      .filter(s => s.emotionTags?.includes(scene))
      .sort((a, b) => b.playCount - a.playCount)
  }

  // 获取所有情绪分类
  getEmotionCategories(): { emotion: string; count: number; songs: any[] }[] {
    const categories: Record<string, { count: number; songs: any[] }> = {}
    
    Array.from(this.stats.songs.values()).forEach(song => {
      const tags = song.emotionTags || []
      tags.forEach(tag => {
        if (!categories[tag]) {
          categories[tag] = { count: 0, songs: [] }
        }
        categories[tag].count++
        categories[tag].songs.push(song)
      })
    })
    
    return Object.entries(categories)
      .map(([emotion, data]) => ({ emotion, ...data }))
      .sort((a, b) => b.count - a.count)
  }

  // 重新分析所有歌曲情绪
  reanalyzeAllEmotions(): void {
    console.log('[StatsManager.reanalyzeAllEmotions] 开始分析...')
    console.log('[StatsManager.reanalyzeAllEmotions] musicLibrary:', this.musicLibrary ? '已设置' : '未设置')
    
    if (!this.musicLibrary) {
      const errorMsg = 'MusicLibrary not set for StatsManager'
      console.error(errorMsg)
      throw new Error(errorMsg)
    }
    
    const songs = this.musicLibrary.getSongs()
    console.log('[StatsManager.reanalyzeAllEmotions] 从 musicLibrary 获取歌曲数量:', songs.length)
    
    if (!songs || songs.length === 0) {
      console.warn('[StatsManager.reanalyzeAllEmotions] 音乐库为空，无法分析')
      return
    }
    
    console.log(`[StatsManager.reanalyzeAllEmotions] 开始分析 ${songs.length} 首歌曲...`)
    
    let analyzedCount = 0
    songs.forEach((song, index) => {
      try {
        console.log(`[StatsManager.reanalyzeAllEmotions] 分析第 ${index + 1}/${songs.length} 首：${song.title || song.filePath}`)
        
        const analysis = musicEmotionAnalyzer.analyzeEmotion(song)
        const scenes = musicEmotionAnalyzer.classifyScene(song, analysis)
        
        // 更新歌曲对象
        song.emotionAnalysis = analysis
        song.sceneClassification = scenes
        song.emotionTags = [analysis.primaryEmotion, ...analysis.secondaryEmotions, ...scenes.scenes]
        
        console.log(`[StatsManager.reanalyzeAllEmotions] 第 ${index + 1} 首分析完成：`, analysis.primaryEmotion)
        
        // 同步到 stats.songs（关键！）
        if (!this.stats.songs.has(song.id)) {
          this.stats.songs.set(song.id, {
            id: song.id,
            title: song.title,
            artist: song.artist,
            album: song.album || '',
            playCount: 0,
            totalPlayTime: 0,
            lastPlayed: 0,
            skipCount: 0,
            completionRate: 0,
            favorite: false,
            emotionTags: song.emotionTags || [],
          })
        } else {
          // 更新现有统计
          const songStats = this.stats.songs.get(song.id)!
          songStats.emotionTags = song.emotionTags || []
        }
        
        analyzedCount++
        if (analyzedCount % 10 === 0) {
          console.log(`[StatsManager.reanalyzeAllEmotions] 进度：${analyzedCount}/${songs.length}`)
        }
      } catch (e) {
        console.error(`[StatsManager.reanalyzeAllEmotions] 分析歌曲失败 ${song.title || `#${index}`}:`, e)
      }
    })
    
    console.log(`[StatsManager.reanalyzeAllEmotions] 分析完成！分析了 ${analyzedCount} 首歌曲`)
    console.log(`[StatsManager.reanalyzeAllEmotions] stats.songs 现在包含：${this.stats.songs.size} 首歌曲`)
    this.saveStats()
  }

  // 获取所有歌曲（用于情绪分析）- 从音乐库获取
  getSongs(): any[] {
    console.log('[StatsManager.getSongs] 调用，musicLibrary:', this.musicLibrary ? '已设置' : '未设置')
    if (this.musicLibrary) {
      return this.musicLibrary.getSongs()
    }
    return Array.from(this.stats.songs.values())
  }
}
