# Phase 1 功能说明 - 交互增强

## 🎉 已完成功能

### 1. 全局媒体热键 ✨

你的播放器现在支持全局快捷键控制！即使 Melody Player 不在焦点，也可以使用以下快捷键：

**默认热键：**
- `MediaPlayPause` - 播放/暂停（媒体键）
- `MediaNextTrack` - 下一首（媒体键）
- `MediaPreviousTrack` - 上一首（媒体键）
- `CmdOrCtrl+Alt+P` - 播放/暂停
- `CmdOrCtrl+Alt+Right` - 下一首
- `CmdOrCtrl+Alt+Left` - 上一首
- `CmdOrCtrl+Alt+Up` - 音量增加
- `CmdOrCtrl+Alt+Down` - 音量减少

**技术实现：**
- 使用 Electron `globalShortcut` 模块
- 支持系统媒体键（如果硬件支持）
- 自定义快捷键组合

---

### 2. 系统托盘集成 🖥️

Melody Player 现在最小化到系统托盘，而不是完全退出！

**功能：**
- **托盘菜单**：
  - 上一首
  - 播放/暂停
  - 下一首
  - 退出
- **点击托盘图标**：恢复主窗口
- **右键托盘图标**：弹出控制菜单

**行为变化：**
- 点击窗口关闭按钮时，应用会隐藏到托盘而不是退出
- 从系统托盘快速恢复播放状态

**技术实现：**
- 使用 Electron `Tray` 模块
- 动态上下文菜单
- 自动适应 Windows/macOS 系统托盘风格

---

### 3. 桌面歌词悬浮窗 🎤

桌面歌词功能让你可以边工作边看歌词！

**如何使用：**
1. 点击播放栏右侧的「桌面歌词」按钮（📄图标）
2. 歌词窗口会出现在桌面上方
3. 歌词窗口始终置顶，透明显示

**操作说明：**
- **右键菜单**：
  - 🔒 锁定：锁定窗口位置，点击穿透
  - 💧 透明度：切换透明度（90% ↔ 40%）
  - 隐藏：隐藏歌词窗口
  - 关闭：关闭歌词窗口
- **双击**：锁定/解锁窗口
- **拖动**：移动歌词窗口位置

**特性：**
- 鼠标穿透（锁定模式）
- 半透明效果
- 智能显示当前播放歌曲
- 大字体，高对比度（白色 + 红色高亮）

**技术实现：**
- 独立的 BrowserWindow，透明无边框
- 始终置顶（screen-saver 层级）
- 鼠标穿透（`setIgnoreMouseEvents`）
- IPC 通信实时更新歌词

---

### 4. 听歌统计系统 📊

自动记录你的听歌习惯！（Phase 2 完整实现）

**已记录的数据：**
- **总播放次数**：历史播放总数
- **总播放时长**：所有歌曲累计播放时间
- **单曲统计**：
  - 播放次数
  - 累计播放时长
  - 最后播放时间
  - 跳过次数
  - 完成率
- **艺术家统计**：最常听的歌手
- **专辑统计**：最常听的专辑
- **时间分布**：
  - 每日播放量（热力图数据）
  - 每小时播放量
  - 每周播放量（星期几）

**即将支持（Phase 2）：**
- 情感标签标注
- 智能推荐「猜你喜欢」
- 最常播放 Top 10 排行榜
- 听歌习惯分析报告

**技术实现：**
- 本地 JSON 持久化存储
- 自动统计播放行为
- 跳过判定（< 30 秒不算）

---

## 🚀 快速开始

### 1. 启动应用
```bash
cd melody
npm run dev
```

### 2. 测试全局热键
- 按下 `Ctrl+Alt+P`（Windows）或 `Cmd+Alt+P`（macOS）
- 播放/暂停应该立即响应

### 3. 测试托盘
- 点击窗口关闭按钮
- 查看系统托盘区域（Windows 右下角 / macOS 右上角）
- 应该看到 Melody Player 图标
- 右键点击托盘图标，查看菜单

### 4. 测试桌面歌词
- 点击播放栏右下角的「📄」按钮
- 桌面应该出现一个透明窗口显示歌词
- 右键窗口，选择「锁定」
- 尝试点击歌词窗口（应该可以穿透点击）
- 双击窗口解锁

---

## 📝 技术细节

### 文件结构
```
melody/src/main/
├── hotkeyManager.ts      # 全局热键管理器
├── trayManager.ts        # 系统托盘管理器
├── desktopLyrics.ts      # 桌面歌词窗口管理
├── statsManager.ts       # 听歌统计管理器
└── index.ts              # 主进程入口（集成所有功能）

melody/
└── lyrics-overlay.html   # 桌面歌词页面
```

### 新增 IPC 接口
```typescript
// 桌面歌词
desktopLyrics.show()
desktopLyrics.hide()
desktopLyrics.toggle()
desktopLyrics.update(lines, currentIndex)

// 听歌统计
stats.startPlaying(song)
stats.stopPlaying(completed)
stats.getStats()
stats.getTopSongs(limit)
stats.getTopArtists(limit)
stats.getRecentlyPlayed(limit)
stats.getDailyStats()
stats.toggleFavorite(songId)
stats.addEmotionTag(songId, tag)
stats.removeEmotionTag(songId, tag)
stats.clearStats()

// 全局热键事件
electron.onGlobalHotkey('playPause', callback)
electron.onGlobalHotkey('next', callback)
electron.onGlobalHotkey('previous', callback)
electron.onGlobalHotkey('volumeUp', callback)
electron.onGlobalHotkey('volumeDown', callback)
```

---

## 🐛 已知限制

### Windows
- 部分媒体键可能需要 Windows 10+
- 托盘图标在低分辨率下可能显示较小

### macOS
- 媒体键支持较好
- 托盘集成使用 macOS 原生样式

### Linux
- 媒体键支持依赖桌面环境
- 托盘图标需要系统托盘扩展（GNOME 需安装扩展）

---

## 🎯 下一步

Phase 1 已完成！继续进入 **Phase 2: 智能功能**：
- 📊 完整听歌统计面板
- 🤖 智能推荐引擎
- ❤️ 情感标签系统
- 📈 听歌热力图

---

## 🔧 故障排除

### 全局热键不工作？
- 确保没有其他应用占用相同快捷键
- 部分系统媒体键需要额外驱动
- 尝试重启应用

### 桌面歌词不显示？
- 确保已点击「桌面歌词」按钮
- 检查是否在多显示器环境下（当前支持主显示器）
- 重启应用

### 托盘图标不显示？
- Windows：查看任务栏右下角（可能需要在展开菜单）
- macOS：查看顶部菜单栏右侧
- Linux：安装系统托盘扩展

---

**开发时间**：约 30 分钟
**代码量**：新增 ~700 行代码
**文件新增**：4 个新 TypeScript 文件 + 1 个 HTML 文件

---

**Phase 1 完成！** ✨🎉
