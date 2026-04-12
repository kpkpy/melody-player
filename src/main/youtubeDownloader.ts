import { spawn, exec, ChildProcess } from 'child_process'
import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, unlinkSync, writeFileSync, readFileSync, chmodSync, createWriteStream, readdirSync } from 'fs'
import https from 'https'
import http from 'http'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface YouTubeVideoInfo {
  id: string
  title: string
  author: string
  thumbnail: string
  duration: number
  description?: string
}

export interface DownloadProgress {
  status: 'downloading' | 'converting' | 'writing_metadata' | 'completed' | 'error'
  progress: number // 0-100
  message: string
  videoTitle?: string
}

export class YouTubeDownloader {
  private win: BrowserWindow | null = null
  private downloadDir: string
  private currentProcess: ChildProcess | null = null
  private ytDlpPath: string | null = null

  constructor() {
    // Default download directory - user's music folder or app data
    this.downloadDir = join(app.getPath('userData'), 'youtube-downloads')
    this.ensureDownloadDir()
  }

  setWindow(win: BrowserWindow) {
    this.win = win
  }

  setDownloadDir(dir: string) {
    this.downloadDir = dir
    this.ensureDownloadDir()
  }

  getDownloadDir(): string {
    return this.downloadDir
  }

  private ensureDownloadDir() {
    if (!existsSync(this.downloadDir)) {
      mkdirSync(this.downloadDir, { recursive: true })
    }
  }

  private notifyProgress(progress: DownloadProgress) {
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send('youtube:downloadProgress', progress)
    }
  }

  /**
   * Check if yt-dlp is available, download if not
   */
  async ensureYtDlp(): Promise<string> {
    if (this.ytDlpPath && existsSync(this.ytDlpPath)) {
      return this.ytDlpPath
    }

    // Try to find yt-dlp in PATH
    const platform = process.platform
    const ytDlpName = platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp'
    
    // Check common locations
    const possiblePaths = [
      // App data folder
      join(app.getPath('userData'), 'bin', ytDlpName),
      // User home bin
      join(app.getPath('home'), '.local', 'bin', ytDlpName),
      // Windows common paths
      platform === 'win32' ? join(process.env.LOCALAPPDATA || '', 'yt-dlp', ytDlpName) : '',
      platform === 'win32' ? join(process.env.PROGRAMFILES || '', 'yt-dlp', ytDlpName) : '',
    ].filter(Boolean)

    for (const path of possiblePaths) {
      if (existsSync(path)) {
        this.ytDlpPath = path
        return path
      }
    }

    // Download yt-dlp
    this.notifyProgress({
      status: 'downloading',
      progress: 0,
      message: '正在下载 yt-dlp 工具...'
    })

    const downloadUrl = platform === 'win32'
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
      : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp'

    const targetPath = join(app.getPath('userData'), 'bin', ytDlpName)
    const binDir = join(app.getPath('userData'), 'bin')
    
    if (!existsSync(binDir)) {
      mkdirSync(binDir, { recursive: true })
    }

    try {
      await this.downloadFile(downloadUrl, targetPath)
      this.ytDlpPath = targetPath
      
      // On Unix, make executable
      if (platform !== 'win32') {
        chmodSync(targetPath, 0o755)
      }

      this.notifyProgress({
        status: 'downloading',
        progress: 100,
        message: 'yt-dlp 工具已准备好'
      })

      return targetPath
    } catch (e: any) {
      throw new Error(`无法下载 yt-dlp: ${e.message}`)
    }
  }

  /**
   * Download file using Node.js https/http
   */
  private async downloadFile(url: string, targetPath: string): Promise<void> {
    const client = url.startsWith('https') ? https : http
    
    return new Promise((resolve, reject) => {
      const file = createWriteStream(targetPath)
      
      client.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Follow redirect
          const redirectUrl = response.headers.location
          if (redirectUrl) {
            this.downloadFile(redirectUrl, targetPath).then(resolve).catch(reject)
          } else {
            reject(new Error('Redirect without location'))
          }
          return
        }

        response.pipe(file)
        file.on('finish', () => {
          file.close()
          resolve()
        })
      }).on('error', (err) => {
        try { unlinkSync(targetPath) } catch {}
        reject(err)
      })
    })
  }

  /**
   * Get video info without downloading
   */
  async getVideoInfo(url: string): Promise<YouTubeVideoInfo> {
    const ytDlp = await this.ensureYtDlp()
    
    const args = [
      '--dump-json',
      '--no-download',
      '--no-warnings',
      `"${url}"`  // Quote URL to handle & and special characters on Windows
    ]

    // Use exec on Windows to avoid EBUSY issues
    if (process.platform === 'win32') {
      const command = `"${ytDlp}" ${args.join(' ')}`
      try {
        const { stdout } = await execAsync(command, { timeout: 60000 })
        const info = JSON.parse(stdout)
        return {
          id: info.id || '',
          title: info.title || 'Unknown Title',
          author: info.uploader || info.channel || 'Unknown Author',
          thumbnail: info.thumbnail || info.thumbnails?.[0]?.url || '',
          duration: info.duration || 0,
          description: info.description
        }
      } catch (e: any) {
        throw new Error(`获取视频信息失败: ${e.message}`)
      }
    }

    // Use spawn on other platforms
    return new Promise((resolve, reject) => {
      let output = ''
      let errorOutput = ''

      const proc = spawn(ytDlp, args)
      
      proc.stdout.on('data', (data) => {
        output += data.toString()
      })

      proc.stderr.on('data', (data) => {
        errorOutput += data.toString()
      })

      proc.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(errorOutput || '获取视频信息失败'))
          return
        }

        try {
          const info = JSON.parse(output)
          resolve({
            id: info.id || '',
            title: info.title || 'Unknown Title',
            author: info.uploader || info.channel || 'Unknown Author',
            thumbnail: info.thumbnail || info.thumbnails?.[0]?.url || '',
            duration: info.duration || 0,
            description: info.description
          })
        } catch (e) {
          reject(new Error('解析视频信息失败'))
        }
      })

      proc.on('error', (err) => {
        reject(new Error(`执行 yt-dlp 失败: ${err.message}`))
      })
    })
  }

  /**
   * Download video and convert to audio
   */
  async downloadAsAudio(url: string, customAuthor?: string): Promise<{ filePath: string; songInfo: any }> {
    const ytDlp = await this.ensureYtDlp()
    
    // Get video info first
    const videoInfo = await this.getVideoInfo(url)
    const author = customAuthor || videoInfo.author
    
    // Sanitize filename
    const safeTitle = this.sanitizeFileName(videoInfo.title)
    let outputPath = join(this.downloadDir, `${safeTitle}.m4a`)

    this.notifyProgress({
      status: 'downloading',
      progress: 0,
      message: '正在下载音频...',
      videoTitle: videoInfo.title
    })

    // Download with yt-dlp - best audio quality, m4a format
    return new Promise((resolve, reject) => {
      const args = [
        '-f', 'bestaudio[ext=m4a]/bestaudio/best',
        '--extract-audio',
        '--audio-format', 'm4a',
        '--audio-quality', '0',
        '-o', `"${outputPath}"`,
        '--embed-metadata',
        '--embed-thumbnail',
        '--no-warnings',
        '--newline', // For progress parsing
        '--progress',
        `"${url}"`  // Quote URL to handle & and special characters on Windows
      ]

      let lastProgress = 0
      let errorOutput = ''

      // Use shell: true on Windows to avoid EBUSY issues
      const spawnOptions = process.platform === 'win32' 
        ? { shell: true, windowsHide: true } 
        : {}

      const proc = spawn(ytDlp, args, spawnOptions)
      this.currentProcess = proc

      proc.stdout.on('data', (data) => {
        const text = data.toString()
        // Parse progress from yt-dlp output
        const progressMatch = text.match(/\[download\]\s+(\d+\.?\d*)%/)
        if (progressMatch) {
          lastProgress = parseFloat(progressMatch[1])
          this.notifyProgress({
            status: 'downloading',
            progress: lastProgress,
            message: `下载进度: ${lastProgress.toFixed(1)}%`,
            videoTitle: videoInfo.title
          })
        }
      })

      proc.stderr.on('data', (data) => {
        errorOutput += data.toString()
      })

      proc.on('close', async (code) => {
        this.currentProcess = null

        if (code !== 0 && code !== null) {
          this.notifyProgress({
            status: 'error',
            progress: 0,
            message: errorOutput || '下载失败'
          })
          reject(new Error(errorOutput || '下载失败'))
          return
        }

        // Check if file exists (yt-dlp already embedded metadata with --embed-metadata --embed-thumbnail)
        const actualPath = outputPath.replace(/^"|"$/g, '') // Remove quotes if present
        if (!existsSync(actualPath)) {
          // Try to find the file with different extension
          const dir = this.downloadDir
          const files = readdirSync(dir)
          const matchingFile = files.find(f => f.includes(safeTitle) && (f.endsWith('.m4a') || f.endsWith('.mp3')))
          if (matchingFile) {
            outputPath = join(dir, matchingFile)
          } else {
            this.notifyProgress({
              status: 'error',
              progress: 0,
              message: '找不到下载的文件'
            })
            reject(new Error('找不到下载的文件'))
            return
          }
        }

        this.notifyProgress({
          status: 'completed',
          progress: 100,
          message: '下载完成！',
          videoTitle: videoInfo.title
        })

        const songInfo = {
          id: Buffer.from(outputPath).toString('base64'),
          title: videoInfo.title,
          artist: author,
          album: 'YouTube Downloads',
          duration: videoInfo.duration,
          filePath: outputPath,
          audioUrl: `audio://${outputPath}`,
          cover: videoInfo.thumbnail
        }

        resolve({ filePath: outputPath, songInfo })
      })

      proc.on('error', (err) => {
        this.currentProcess = null
        this.notifyProgress({
          status: 'error',
          progress: 0,
          message: `执行 yt-dlp 失败: ${err.message}`
        })
        reject(new Error(`执行 yt-dlp 失败: ${err.message}`))
      })
    })
  }

  /**
   * Write metadata to audio file using yt-dlp --embed-thumbnail --embed-metadata
   * or fallback to manual method
   */
  private async writeMetadata(filePath: string, metadata: {
    title: string
    artist: string
    album: string
    thumbnailUrl?: string
    thumbnailPath?: string | null
  }): Promise<void> {
    const ytDlp = await this.ensureYtDlp()

    // Try using yt-dlp's embed options
    const args = [
      '--embed-metadata',
      '--embed-thumbnail',
      '--no-download',
      '--replace-metadata', `title=${metadata.title}`,
      '--replace-metadata', `artist=${metadata.artist}`,
      '--replace-metadata', `album=${metadata.album}`,
      filePath
    ]

    // Check if file exists
    if (!existsSync(filePath)) {
      throw new Error('音频文件不存在')
    }

    return new Promise((resolve, reject) => {
      const proc = spawn(ytDlp, args)
      let errorOutput = ''

      proc.stderr.on('data', (data) => {
        errorOutput += data.toString()
      })

      proc.on('close', (code) => {
        if (code === 0) {
          resolve()
        } else {
          // Fallback: metadata might already be embedded from download
          // Just resolve anyway, yt-dlp already adds basic metadata
          resolve()
        }
      })

      proc.on('error', () => {
        // Fallback resolve
        resolve()
      })
    })
  }

  /**
   * Sanitize filename for filesystem
   */
  private sanitizeFileName(name: string): string {
    return name
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 200) // Limit length
  }

  /**
   * Cancel current download
   */
  cancelDownload(): boolean {
    if (this.currentProcess) {
      this.currentProcess.kill('SIGTERM')
      this.currentProcess = null
      this.notifyProgress({
        status: 'error',
        progress: 0,
        message: '下载已取消'
      })
      return true
    }
    return false
  }

  /**
   * Check if yt-dlp is installed
   */
  async isYtDlpAvailable(): Promise<boolean> {
    try {
      await this.ensureYtDlp()
      return true
    } catch {
      return false
    }
  }

  /**
   * Validate YouTube URL
   */
  isValidYouTubeUrl(url: string): boolean {
    const patterns = [
      /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
      /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/[\w-]+/,
      /^(https?:\/\/)?youtu\.be\/[\w-]+/,
      /^(https?:\/\/)?(www\.)?youtube\.com\/embed\/[\w-]+/,
    ]
    return patterns.some(p => p.test(url))
  }

  /**
   * Extract video ID from URL
   */
  extractVideoId(url: string): string | null {
    const patterns = [
      /youtube\.com\/watch\?v=([\w-]+)/,
      /youtube\.com\/shorts\/([\w-]+)/,
      /youtu\.be\/([\w-]+)/,
      /youtube\.com\/embed\/([\w-]+)/,
    ]
    for (const p of patterns) {
      const match = url.match(p)
      if (match) return match[1]
    }
    return null
  }
}