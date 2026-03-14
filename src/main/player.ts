import { BrowserWindow } from 'electron'

export interface PlayerState {
  isPlaying: boolean
  currentSong: string | null
  currentTime: number
  duration: number
  volume: number
}

export class Player {
  private state: PlayerState = {
    isPlaying: false,
    currentSong: null,
    currentTime: 0,
    duration: 0,
    volume: 0.8,
  }
  private win: BrowserWindow | null = null

  setWindow(win: BrowserWindow) {
    this.win = win
  }

  play(filePath: string): boolean {
    this.state.currentSong = filePath
    this.state.isPlaying = true
    this.notifyStateChange()
    return true
  }

  pause(): boolean {
    this.state.isPlaying = false
    this.notifyStateChange()
    return true
  }

  resume(): boolean {
    this.state.isPlaying = true
    this.notifyStateChange()
    return true
  }

  stop(): boolean {
    this.state.isPlaying = false
    this.state.currentSong = null
    this.state.currentTime = 0
    this.notifyStateChange()
    return true
  }

  setVolume(volume: number): boolean {
    this.state.volume = Math.max(0, Math.min(1, volume))
    this.notifyStateChange()
    return true
  }

  seek(position: number): boolean {
    this.state.currentTime = Math.max(0, Math.min(this.state.duration, position))
    this.notifyStateChange()
    return true
  }

  getState(): PlayerState {
    return { ...this.state }
  }

  private notifyStateChange() {
    if (this.win) {
      this.win.webContents.send('player:stateChange', this.state)
    }
  }
}