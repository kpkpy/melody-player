import { BrowserWindow, screen, ipcMain } from 'electron'

export class DesktopLyricsWindow {
  private win: BrowserWindow | null = null
  private isLocked = false
  private opacity = 0.9
  private currentPosition = { x: 100, y: 100 }

  constructor(private mainWindow: BrowserWindow) {}

  create(): void {
    if (this.win) return

    const { width } = screen.getPrimaryDisplay().workAreaSize

    this.win = new BrowserWindow({
      width: 600,
      height: 100,
      x: this.currentPosition.x,
      y: this.currentPosition.y,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      visibleOnAllWorkspaces: true,
      skipTaskbar: true,
      focusable: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    })

    // 加载歌词页面
    this.win.loadFile('dist/lyrics-overlay.html').catch(() => {
      // 开发模式
      this.win?.loadURL('http://localhost:5173/lyrics-overlay.html')
    })

    // 设置窗口层级
    this.win.setAlwaysOnTop(true, 'screen-saver')
    this.win.setOpacity(this.opacity)

    // 鼠标穿透（锁定模式）
    this.setIgnoreMouse(true)

    // 监听 IPC 消息
    this.setupIpcHandlers()

    this.win.on('closed', () => {
      this.win = null
    })
  }

  private setupIpcHandlers(): void {
    // 更新歌词
    ipcMain.handle('lyrics:update', (_event, lines: string[], currentIndex: number) => {
      this.win?.webContents.send('lyrics:data', { lines, currentIndex })
      return true
    })

    // 切换锁定状态
    ipcMain.handle('lyrics:toggleLock', () => {
      this.isLocked = !this.isLocked
      this.setIgnoreMouse(this.isLocked)
      return this.isLocked
    })

    // 获取锁定状态
    ipcMain.handle('lyrics:getLock', () => {
      return this.isLocked
    })

    // 设置透明度
    ipcMain.handle('lyrics:setOpacity', (_event, opacity: number) => {
      this.opacity = Math.max(0.3, Math.min(1, opacity))
      this.win?.setOpacity(this.opacity)
      return true
    })

    // 获取透明度
    ipcMain.handle('lyrics:getOpacity', () => {
      return this.opacity
    })

    // 关闭窗口
    ipcMain.handle('lyrics:close', () => {
      this.close()
      return true
    })

    // 显示窗口
    ipcMain.handle('lyrics:show', () => {
      this.show()
      return true
    })

    // 隐藏窗口
    ipcMain.handle('lyrics:hide', () => {
      this.hide()
      return true
    })

    // 开始拖动
    ipcMain.handle('lyrics:startDrag', () => {
      this.win?.webContents.send('lyrics:dragStart')
    })

    // 保存位置
    ipcMain.handle('lyrics:savePosition', (_event, x: number, y: number) => {
      this.currentPosition = { x, y }
      return true
    })
  }

  private setIgnoreMouse(ignore: boolean): void {
    if (!this.win) return
    
    if (ignore) {
      // 鼠标穿透
      this.win.setIgnoreMouseEvents(true, { forward: true })
    } else {
      // 允许鼠标交互
      this.win.setIgnoreMouseEvents(false)
    }
  }

  show(): void {
    this.win?.show()
  }

  hide(): void {
    this.win?.hide()
  }

  close(): void {
    this.win?.close()
    this.win = null
  }

  destroy(): void {
    this.close()
  }

  updateLyrics(lines: string[], currentIndex: number): void {
    if (this.win) {
      this.win.webContents.send('lyrics:data', { lines, currentIndex })
    }
  }
}
