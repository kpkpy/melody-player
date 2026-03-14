import { app } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'

export interface Config {
  musicDirs: string[]
  lastScanTime?: number
}

export class ConfigManager {
  private configPath: string
  private config: Config

  constructor() {
    this.configPath = join(app.getPath('userData'), 'config.json')
    this.config = this.load()
  }

  private load(): Config {
    try {
      if (existsSync(this.configPath)) {
        const data = readFileSync(this.configPath, 'utf-8')
        return JSON.parse(data)
      }
    } catch (e) {
      console.error('Failed to load config:', e)
    }
    return { musicDirs: [] }
  }

  save(): void {
    try {
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2))
    } catch (e) {
      console.error('Failed to save config:', e)
    }
  }

  getMusicDirs(): string[] {
    return this.config.musicDirs || []
  }

  setMusicDirs(dirs: string[]): void {
    this.config.musicDirs = dirs
    this.save()
  }

  addMusicDir(dir: string): void {
    if (!this.config.musicDirs.includes(dir)) {
      this.config.musicDirs.push(dir)
      this.save()
    }
  }

  removeMusicDir(dir: string): void {
    this.config.musicDirs = this.config.musicDirs.filter(d => d !== dir)
    this.save()
  }

  getConfig(): Config {
    return { ...this.config }
  }
}