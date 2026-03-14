# Melody Player 开发笔记

> 本文档为 AI 智能体提供项目全景理解，包含架构、数据流、关键实现细节。

---

## 项目概述

Melody Player 是一个 Apple Music 风格的本地音乐播放器，桌面应用架构。

**核心定位**: 本地音乐管理 + 播放 + 歌单同步

---

## 技术栈

```
前端:     Vue 3 (Composition API) + TypeScript
状态管理: Pinia
路由:     Vue Router 4 (Hash模式)
桌面框架: Electron 28
构建工具: Vite 5 + vite-plugin-electron
元数据:   music-metadata (解析MP3/FLAC等)
打包:     electron-builder
```

---

## 架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      Electron 应用                           │
├─────────────────────────────────────────────────────────────┤
│  主进程 (Node.js)                渲染进程 (Chromium)          │
│  ┌─────────────────────┐        ┌─────────────────────┐     │
│  │ index.ts (入口)      │        │ Vue 3 应用           │     │
│  │ ├─ MusicLibrary     │        │ ├─ stores (Pinia)   │     │
│  │ ├─ PlaylistManager  │◄──IPC──►│ ├─ views           │     │
│  │ ├─ SyncManager      │        │ ├─ components      │     │
│  │ ├─ DeviceManager    │        │ └─ router          │     │
│  │ ├─ Player           │        └─────────────────────┘     │
│  │ └─ ConfigManager    │                                    │
│  └─────────────────────┘                                    │
│           │                                                  │
│           ▼                                                  │
│  ┌─────────────────────┐      ┌─────────────────────┐       │
│  │ 本地文件系统          │      │ USB设备 (随身播放器) │       │
│  │ ├─ 音乐文件           │      │ ├─ 音乐文件         │       │
│  │ ├─ library-cache.json│      │ └─ M3U歌单          │       │
│  │ ├─ playlists.json    │      └─────────────────────┘       │
│  │ └─ config.json       │                                    │
│  └─────────────────────┘                                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 目录结构

```
melody/
├── src/
│   ├── main/                        # 主进程 (Node.js)
│   │   ├── index.ts                # 入口: 创建窗口, 注册IPC, 启动应用
│   │   ├── preload.ts              # IPC桥接: contextBridge暴露API
│   │   ├── musicLibrary.ts         # 音乐库: 扫描/缓存/查询
│   │   ├── playlistManager.ts      # 歌单: CRUD操作
│   │   ├── syncManager.ts          # 同步: M3U导入导出 + 设备同步
│   │   ├── deviceManager.ts        # 设备: USB检测/扫描
│   │   ├── player.ts               # 播放状态(预留,实际在渲染进程)
│   │   └── configManager.ts        # 配置: 音乐目录持久化
│   │
│   └── renderer/                    # 渲染进程 (Vue 3)
│       ├── main.ts                 # Vue入口
│       ├── App.vue                 # 根组件: 加载屏+布局
│       ├── router.ts               # 路由: 5个页面
│       │
│       ├── components/
│       │   ├── PlayerBar.vue       # 底部播放栏 + 全屏面板
│       │   ├── Sidebar.vue         # 左侧导航
│       │   ├── SongCard.vue        # 歌曲卡片
│       │   └── TitleBar.vue        # 自定义标题栏
│       │
│       ├── views/
│       │   ├── HomeView.vue        # 首页: 最近播放/收藏
│       │   ├── LibraryView.vue     # 音乐库: 全部歌曲,分页,排序
│       │   ├── PlaylistView.vue    # 歌单详情
│       │   ├── SettingsView.vue    # 设置: 扫描目录,缓存管理
│       │   └── SyncView.vue        # 同步: 设备同步 + M3U导入导出
│       │
│       ├── stores/                  # Pinia状态
│       │   ├── music.ts            # songs, albums, artists
│       │   ├── player.ts           # 播放状态, HTML5 Audio
│       │   └── playlist.ts         # 歌单列表
│       │
│       ├── styles/
│       │   ├── global.css          # CSS变量,全局样式
│       │   └── animations.css      # 动画定义
│       │
│       └── utils/
│           └── format.ts           # 时间格式化等
│
├── index.html                       # HTML入口
├── package.json                     # 依赖配置
├── vite.config.ts                   # Vite + Electron构建配置
├── tsconfig.json                    # TS配置
├── tsconfig.node.json               # Node端TS配置
├── electron-builder.json            # 打包配置
└── AGENT.md                         # AI智能体开发笔记
```

---

## 数据模型

### Song (歌曲)
```typescript
// 文件: src/main/musicLibrary.ts (第9-20行)
interface Song {
  id: string           // Base64编码的文件路径, 作为唯一标识
  title: string        // 歌曲标题, 从元数据获取或用文件名
  artist: string       // 艺术家, 默认 "Unknown Artist"
  album: string        // 专辑名, 默认 "Unknown Album"
  duration: number     // 时长(秒)
  filePath: string     // 本地文件绝对路径
  audioUrl: string     // 播放URL: "audio://" + filePath
  cover?: string       // 封面 Base64 DataURL (data:image/xxx;base64,...)
  lyrics?: string      // 歌词文本
  mtime?: number       // 文件修改时间戳, 用于增量扫描判断
}
```

### Album (专辑)
```typescript
// 文件: src/main/musicLibrary.ts (第22-28行)
interface Album {
  id: string           // 格式: `${artist}-${album}`
  name: string
  artist: string
  cover?: string
  songs: Song[]        // 包含的歌曲列表
}
```

### Artist (艺术家)
```typescript
// 文件: src/main/musicLibrary.ts (第30-35行)
interface Artist {
  id: string           // 艺术家名
  name: string
  albums: Album[]
  songs: Song[]
}
```

### Playlist (歌单)
```typescript
// 文件: src/main/playlistManager.ts (第6-12行)
interface Playlist {
  id: string           // 格式: `playlist-${Date.now()}`
  name: string
  songIds: string[]    // 歌曲ID列表 (Song.id)
  createdAt: number    // 创建时间戳
  updatedAt: number    // 更新时间戳
}
```

### Config (配置)
```typescript
// 文件: src/main/configManager.ts (第5-8行)
interface Config {
  musicDirs: string[]      // 音乐文件夹路径列表
  lastScanTime?: number
}
```

### ScanProgress (扫描进度)
```typescript
// 文件: src/main/musicLibrary.ts (第37-42行)
interface ScanProgress {
  phase: 'scanning' | 'parsing' | 'loading'
  current: number
  total: number
  currentFile?: string
}
```

---

## IPC 通信接口

### 接口定义位置
- **主进程处理**: `src/main/index.ts` (第85-191行)
- **渲染进程调用**: `src/main/preload.ts` (第1-62行)

### library (音乐库)
```typescript
// 扫描音乐库
await window.electron.library.scan(paths: string[], forceRescan?: boolean)
// 返回: { count: number, errors: string[] }

// 获取数据
await window.electron.library.getSongs()     // Song[]
await window.electron.library.getAlbums()    // Album[]
await window.electron.library.getArtists()   // Artist[]

// 清除缓存
await window.electron.library.clearCache()

// 监听扫描进度
window.electron.library.onScanProgress((progress: ScanProgress) => {})
```

### playlist (歌单)
```typescript
await window.electron.playlist.create(name: string)              // Playlist
await window.electron.playlist.getAll()                          // Playlist[]
await window.electron.playlist.addSong(playlistId, songId)       // boolean
await window.electron.playlist.removeSong(playlistId, songId)    // boolean
await window.electron.playlist.delete(playlistId)                // boolean
```

### sync (同步)
```typescript
await window.electron.sync.exportPlaylist(playlistId)  // 文件路径 | null
await window.electron.sync.importM3U()                 // { name, songs } | null
await window.electron.sync.exportAll()                 // 文件路径 | null
await window.electron.sync.importAll()                 // 导入数量
await window.electron.sync.onProgress(callback)        // 监听同步进度
```

### device (设备同步)
```typescript
// 检测连接的USB设备
await window.electron.device.detect()  // DeviceInfo[]

// 扫描设备音乐结构
await window.electron.device.scanMusic(deviceId)  // { musicFolders, playlistFolder, totalSongs, totalPlaylists }

// 获取设备上的歌单列表
await window.electron.device.getPlaylists(deviceId)  // { name, path, songCount }[]

// 获取设备同步状态
await window.electron.device.getSyncState(deviceId)  // SyncState | null

// 更新设备名称
await window.electron.device.updateName(deviceId, name)  // boolean

// 设置设备文件夹
await window.electron.device.setFolders(deviceId, musicFolder, playlistFolder)  // boolean

// 移除设备记忆
await window.electron.device.forget(deviceId)  // boolean

// 预览同步内容
await window.electron.device.previewSync(device, options)  // SyncPreview
// options: { syncSongs: boolean, syncPlaylists: boolean, deleteRemoved: boolean }

// 同步到设备 (音乐库 + 歌单)
await window.electron.device.syncTo(device, options)  // LibrarySyncResult

// 从设备导入
await window.electron.device.importFrom(device, options)  // LibrarySyncResult
// options: { importSongs: boolean, importPlaylists: boolean }

// 监听设备插拔
window.electron.device.onChange((data) => {})  // data: { event: 'connected'|'disconnected', device }

// 监听扫描进度
window.electron.device.onScanProgress((progress) => {})  // { phase, current, total, message }
```

### DeviceInfo (设备信息)
```typescript
interface DeviceInfo {
  id: string               // 设备唯一标识
  drive: string            // 设备路径 (Windows: "D:", macOS: "/Volumes/DeviceName")
  label: string            // 设备名称
  type: 'usb' | 'fixed' | 'network' | 'unknown'
  totalSize: number        // 总容量(字节)
  freeSize: number         // 可用空间(字节)
  usedSize: number         // 已用空间(字节)
  fileSystem?: string      // 文件系统 (NTFS, FAT32, exFAT等)
  serialNumber?: string    // 序列号
  musicFolder?: string     // 检测到的音乐文件夹
  playlistFolder?: string  // 检测到的歌单文件夹
  songCount: number        // 设备上的歌曲数量
  playlistCount: number    // 设备上的歌单数量
  lastSyncTime?: number    // 上次同步时间戳
  customName?: string      // 用户自定义名称
  isKnown: boolean         // 是否是已记忆的设备
}
```

### SyncPreview (同步预览)
```typescript
interface SyncPreview {
  toCopy: Song[]           // 需要复制的歌曲
  toDelete: string[]       // 需要删除的歌曲路径
  toUpdate: Song[]         // 需要更新的歌曲
  playlistsToSync: { id: string; name: string; songCount: number }[]
  totalSize: number        // 总大小(字节)
  freeSpaceAfter: number   // 同步后可用空间
}
```

### LibrarySyncResult (同步结果)
```typescript
interface LibrarySyncResult {
  success: boolean
  message: string
  songsCopied: number      // 复制的歌曲数
  songsSkipped: number     // 跳过的歌曲数
  songsDeleted: number     // 删除的歌曲数
  playlistsSynced: number  // 同步的歌单数
  errors: string[]         // 错误列表
  totalSize: number        // 总大小(字节)
  duration: number         // 耗时(毫秒)
}
```

### config (配置)
```typescript
await window.electron.config.getMusicDirs()           // string[]
await window.electron.config.setMusicDirs(dirs)       // boolean
await window.electron.config.addMusicDir(dir)         // boolean
await window.electron.config.removeMusicDir(dir)      // boolean
```

### app (应用)
```typescript
await window.electron.app.ready()  // 触发自动加载
```

### window (窗口)
```typescript
await window.electron.window.minimize()
await window.electron.window.maximize()
await window.electron.window.close()
```

---

## 关键实现细节

### 1. 音频播放流程
```
渲染进程                    主进程
    │                          │
    │  play(song)              │
    │  audio.src = song.audioUrl   (audio://C:/Music/song.mp3)
    │  audio.play()            │
    │                          │  protocol.registerFileProtocol('audio')
    │                          │  解析URL, 返回本地文件
    │  HTML5 Audio 播放         │
```

**关键代码**:
- 主进程注册协议: `src/main/index.ts` (第60-68行)
- 渲染进程播放: `src/renderer/stores/player.ts` (第52-74行)

### 2. 音乐扫描流程
```
用户点击扫描
    │
    ▼
主进程 scan()
    ├─ 扫描目录, 收集音频文件
    ├─ 检查缓存, 增量更新
    ├─ 解析元数据 (music-metadata)
    ├─ 提取封面/歌词
    └─ 保存缓存到 library-cache.json
```

**增量扫描**: 通过 `mtime` 判断文件是否变更，未变更则使用缓存数据。

### 3. IPC 数据序列化
```typescript
// ❌ 错误: 直接传递 Vue reactive 对象
await window.electron.library.scan(musicDirs.value)

// ✅ 正确: 转换为普通对象
const paths = toRaw(musicDirs.value)  // 或 [...musicDirs.value]
await window.electron.library.scan(paths)
```

### 4. 数据存储位置
```
Windows: %APPDATA%/melody-player/
  ├── library-cache.json   # 音乐库缓存
  ├── playlists.json       # 歌单数据
  └── config.json          # 应用配置

macOS: ~/Library/Application Support/melody-player/
Linux: ~/.config/melody-player/
```

---

## 支持的音频格式

```typescript
// 定义: src/main/musicLibrary.ts (第7行)
const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.m4a', '.wav', '.ogg', '.wma', '.ape', '.aac']
```

---

## 路由配置

```typescript
// 文件: src/renderer/router.ts
routes: [
  { path: '/',          name: 'home',     component: HomeView },
  { path: '/library',   name: 'library',  component: LibraryView },
  { path: '/playlist/:id', name: 'playlist', component: PlaylistView },
  { path: '/settings',  name: 'settings', component: SettingsView },
  { path: '/sync',      name: 'sync',     component: SyncView },
]
```

---

## 样式变量

```css
/* 文件: src/renderer/styles/global.css */
:root {
  --bg-primary: #f8f9fa;
  --bg-secondary: #ffffff;
  --bg-tertiary: #f0f2f5;
  --text-primary: #1a1a2e;
  --text-secondary: #6b7280;
  --accent: #e94560;
  --accent-hover: #d63d56;
  --accent-light: rgba(233, 69, 96, 0.1);
  --border: rgba(0, 0, 0, 0.08);
  --shadow: rgba(0, 0, 0, 0.08);
  --glass: rgba(255, 255, 255, 0.85);
}
```

**主题**: 明亮主题, Apple Music 风格

---

## 运行命令

```bash
# 安装依赖
npm install

# 开发模式 (热重载)
npm run dev

# 构建应用
npm run build
```

---

## 已实现功能清单

### 播放
- [x] 播放/暂停/停止
- [x] 上一首/下一首
- [x] 进度条拖动
- [x] 音量控制
- [x] 播放列表

### 音乐库
- [x] 扫描本地文件夹
- [x] 元数据缓存
- [x] 增量扫描
- [x] 分页 (50首/页)
- [x] 多字段排序
- [x] 搜索

### 歌单
- [x] 创建/删除
- [x] 添加/移除歌曲
- [x] 持久化

### 同步
- [x] M3U导入导出
- [x] JSON批量导入导出
- [x] 设备检测 (自动检测USB存储设备)
- [x] 设备容量显示 (总容量/已用/可用/文件系统)
- [x] 设备记忆 (记住设备名称和同步历史)
- [x] 音乐库同步 (复制整个音乐库到设备)
- [x] 歌单同步 (导出所有歌单M3U到设备)
- [x] 增量同步 (只同步新增/修改的歌曲)
- [x] 同步预览 (预览将要同步的内容)
- [x] 清理已移除歌曲 (可选删除设备上已移除的歌曲)

### 界面
- [x] 全屏播放面板
- [x] 歌词显示
- [x] 音频可视化 (VU表/频谱/示波器)
- [x] 动态背景 (封面取色)

---

## 待实现功能

- [ ] 随机播放/单曲循环
- [ ] 播放队列管理
- [ ] 歌词同步滚动
- [ ] 专辑/艺术家详情页
- [ ] 最近播放记录
- [ ] 虚拟列表 (大数据量优化)
- [ ] 媒体键支持
- [ ] 迷你模式

---

## 常见问题

### 1. 修改代码后需要重启
开发模式下主进程修改需要手动重启, 渲染进程支持热重载。

### 2. 路径问题
Windows 使用反斜杠, 使用 `path.join()` 处理路径兼容性。

### 3. 封面内存占用
封面使用 Base64 编码存储, 大量歌曲可能占用较多内存。

### 4. 缓存位置
通过 `app.getPath('userData')` 获取, 不同系统路径不同。

---

## 文件索引

| 功能 | 文件路径 |
|------|----------|
| 主进程入口 | `src/main/index.ts` |
| IPC桥接 | `src/main/preload.ts` |
| 音乐库逻辑 | `src/main/musicLibrary.ts` |
| 歌单管理 | `src/main/playlistManager.ts` |
| 同步功能 | `src/main/syncManager.ts` |
| 设备管理 | `src/main/deviceManager.ts` |
| 配置管理 | `src/main/configManager.ts` |
| Vue入口 | `src/renderer/main.ts` |
| 根组件 | `src/renderer/App.vue` |
| 路由 | `src/renderer/router.ts` |
| 播放状态 | `src/renderer/stores/player.ts` |
| 音乐库状态 | `src/renderer/stores/music.ts` |
| 歌单状态 | `src/renderer/stores/playlist.ts` |
| 播放栏组件 | `src/renderer/components/PlayerBar.vue` |
| 设置页 | `src/renderer/views/SettingsView.vue` |
| 同步页 | `src/renderer/views/SyncView.vue` |
| 类型定义 | `src/vite-env.d.ts` |

---

*最后更新: 2026-03-14*