import { globalShortcut, app } from 'electron'

export class HotkeyManager {
  private shortcuts: Map<string, () => void> = new Map()
  private callback: (() => void) | null = null

  setCallback(callback: () => void) {
    this.callback = callback
  }

  registerAllShortcuts(callbacks: {
    playPause: () => void
    next: () => void
    previous: () => void
    volumeUp: () => void
    volumeDown: () => void
  }): void {
    this.unregisterAll()

    // 注册媒体键（部分系统支持）
    try {
      // Media Play/Pause
      globalShortcut.register('MediaPlayPause', () => {
        callbacks.playPause()
      })

      // Media Next Track
      globalShortcut.register('MediaNextTrack', () => {
        callbacks.next()
      })

      // Media Previous Track
      globalShortcut.register('MediaPreviousTrack', () => {
        callbacks.previous()
      })
    } catch (e) {
      console.warn('Failed to register media keys:', e)
    }

    // 注册自定义快捷键
    const customShortcuts = [
      { accel: 'CmdOrCtrl+Alt+P', action: callbacks.playPause },
      { accel: 'CmdOrCtrl+Alt+Right', action: callbacks.next },
      { accel: 'CmdOrCtrl+Alt+Left', action: callbacks.previous },
      { accel: 'CmdOrCtrl+Alt+Up', action: callbacks.volumeUp },
      { accel: 'CmdOrCtrl+Alt+Down', action: callbacks.volumeDown },
    ]

    for (const { accel, action } of customShortcuts) {
      try {
        globalShortcut.register(accel, action)
      } catch (e) {
        console.warn(`Failed to register ${accel}:`, e)
      }
    }
  }

  unregisterAll(): void {
    globalShortcut.unregisterAll()
  }

  isRegistered(accel: string): boolean {
    return globalShortcut.isRegistered(accel)
  }
}
