import { Tray, Menu, BrowserWindow, app, nativeImage } from 'electron'
import { join } from 'path'

export class TrayManager {
  private tray: Tray | null = null
  private win: BrowserWindow | null = null
  private callbacks: {
    playPause?: () => void
    next?: () => void
    previous?: () => void
  } = {}

  setWindow(win: BrowserWindow) {
    this.win = win
  }

  setCallbacks(callbacks: {
    playPause: () => void
    next: () => void
    previous: () => void
  }) {
    this.callbacks = callbacks
  }

  createTray(): void {
    // 创建托盘图标
    const iconPath = join(__dirname, '../../resources/icon.ico')
    const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })

    this.tray = new Tray(icon)
    
    this.updateContextMenu()

    this.tray.setToolTip('Melody Player - 点击打开主窗口')
    
    this.tray.on('click', () => {
      this.showWindow()
    })

    this.tray.on('right-click', () => {
      this.tray?.popUpContextMenu()
    })
  }

  private updateContextMenu(): void {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Melody Player',
        icon: nativeImage.createFromPath(join(__dirname, '../../resources/icon.ico')).resize({ width: 16, height: 16 }),
        click: () => {
          this.showWindow()
        },
      },
      { type: 'separator' },
      {
        label: '上一首',
        click: () => {
          this.callbacks.previous?.()
        },
      },
      {
        label: '播放/暂停',
        click: () => {
          this.callbacks.playPause?.()
        },
      },
      {
        label: '下一首',
        click: () => {
          this.callbacks.next?.()
        },
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          app.quit()
        },
      },
    ])

    this.tray?.setContextMenu(contextMenu)
  }

  showWindow(): void {
    if (this.win) {
      if (this.win.isMinimized()) {
        this.win.restore()
      }
      this.win.show()
      this.win.focus()
      if (this.win.isMinimized()) {
        this.win.maximize()
      }
    }
  }

  destroy(): void {
    this.tray?.destroy()
    this.tray = null
  }
}
