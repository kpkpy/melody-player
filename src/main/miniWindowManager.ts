import { BrowserWindow, ipcMain, screen } from 'electron'

export class MiniWindowManager {
  private mainWindow: BrowserWindow | null = null
  private miniWindow: BrowserWindow | null = null
  private isMiniMode = false
  private previousBounds: { x: number; y: number; width: number; height: number } | null = null

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow
    this.setupIpcHandlers()
  }

  private setupIpcHandlers(): void {
    // 切换迷你模式
    ipcMain.handle('window:toggleMini', () => {
      return this.toggleMiniMode()
    })

    // 进入迷你模式
    ipcMain.handle('window:enterMini', () => {
      this.enterMiniMode()
      return true
    })

    // 退出迷你模式
    ipcMain.handle('window:exitMini', () => {
      this.exitMiniMode()
      return true
    })

    // 检查是否在迷你模式
    ipcMain.handle('window:isMini', () => {
      return this.isMiniMode
    })

    // 画中画模式
    ipcMain.handle('window:togglePiP', () => {
      return this.togglePiPMode()
    })
  }

  toggleMiniMode(): boolean {
    if (this.isMiniMode) {
      this.exitMiniMode()
      return false
    } else {
      this.enterMiniMode()
      return true
    }
  }

  enterMiniMode(): void {
    if (!this.mainWindow) return

    // 保存当前窗口位置
    this.previousBounds = this.mainWindow.getBounds()

    // 获取屏幕尺寸
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize

    // 设置迷你窗口尺寸
    const miniWidth = 300
    const miniHeight = 80

    // 移动到右上角
    this.mainWindow.setBounds({
      x: screenWidth - miniWidth - 20,
      y: 20,
      width: miniWidth,
      height: miniHeight,
    })

    this.mainWindow.setResizable(false)
    this.mainWindow.setAlwaysOnTop(true, 'floating')
    this.mainWindow.setVisibleOnAllWorkspaces(true)
    this.mainWindow.setSkipTaskbar(true)

    this.isMiniMode = true
    this.mainWindow.webContents.send('window:miniModeChanged', true)
  }

  exitMiniMode(): void {
    if (!this.mainWindow) return

    // 恢复之前的窗口位置
    if (this.previousBounds) {
      this.mainWindow.setBounds(this.previousBounds)
      this.previousBounds = null
    }

    this.mainWindow.setResizable(true)
    this.mainWindow.setAlwaysOnTop(false)
    this.mainWindow.setVisibleOnAllWorkspaces(false)
    this.mainWindow.setSkipTaskbar(false)
    this.mainWindow.setMinimumSize(900, 600)

    this.isMiniMode = false
    this.mainWindow.webContents.send('window:miniModeChanged', false)
  }

  togglePiPMode(): boolean {
    if (!this.mainWindow) return false

    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize

    // 画中画尺寸
    const pipWidth = 400
    const pipHeight = 300

    if (this.mainWindow.isAlwaysOnTop()) {
      // 退出画中画
      this.exitPiPMode()
      return false
    } else {
      // 进入画中画
      this.mainWindow.setSize(pipWidth, pipHeight)
      this.mainWindow.setPosition(screenWidth - pipWidth - 20, screenHeight - pipHeight - 100)
      this.mainWindow.setAlwaysOnTop(true, 'floating')
      this.mainWindow.setResizable(false)
      this.mainWindow.setSkipTaskbar(false)
      this.mainWindow.webContents.send('window:PiPModeChanged', true)
      return true
    }
  }

  exitPiPMode(): void {
    if (!this.mainWindow) return

    this.mainWindow.setSize(1200, 800)
    this.mainWindow.setAlwaysOnTop(false)
    this.mainWindow.setResizable(true)
    this.mainWindow.setMinimumSize(900, 600)
    this.mainWindow.webContents.send('window:PiPModeChanged', false)
  }

  createCompactControlBar(): void {
    if (this.miniWindow) return

    // 创建独立的紧凑控制栏窗口
    this.miniWindow = new BrowserWindow({
      width: 350,
      height: 60,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    })

    this.miniWindow.setVisibleOnAllWorkspaces(true)
    this.miniWindow.setIgnoreMouseEvents(false)

    this.miniWindow.on('closed', () => {
      this.miniWindow = null
    })
  }

  destroy(): void {
    if (this.isMiniMode) {
      this.exitMiniMode()
    }
    this.mainWindow = null
  }
}
