# Melody Player - 开发文档

## 项目概述

Melody Player 是一个 Apple Music 风格的本地音乐播放器，基于 Electron + Vue 3 + TypeScript 构建。

## 技术栈

- **前端框架**: Vue 3 + TypeScript
- **状态管理**: Pinia
- **路由**: Vue Router
- **桌面框架**: Electron 28
- **构建工具**: Vite 5 + vite-plugin-electron
- **音频元数据**: music-metadata

## 项目结构

```
melody/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 主进程入口，IPC 处理
│   │   ├── musicLibrary.ts      # 音乐库扫描、歌曲管理
│   │   ├── player.ts            # 播放器状态管理（预留）
│   │   ├── playlistManager.ts   # 歌单管理（持久化到本地）
│   │   ├── syncManager.ts       # 外部播放器同步
│   │   └── preload.ts           # 渲染进程与主进程通信桥接
│   │
│   └── renderer/                # Vue 渲染进程
│       ├── App.vue              # 根组件
│       ├── main.ts              # 入口文件
│       ├── router.ts            # 路由配置
│       ├── components/          # 组件
│       │   ├── PlayerBar.vue    # 底部播放控制栏
│       │   ├── Sidebar.vue      # 左侧导航栏
│       │   ├── SongCard.vue     # 歌曲卡片
│       │   └── TitleBar.vue     # 自定义标题栏
│       ├── views/               # 页面
│       │   ├── HomeView.vue     # 首页
│       │   ├── LibraryView.vue  # 音乐库
│       │   ├── PlaylistView.vue # 歌单详情
│       │   ├── SettingsView.vue # 设置页
│       │   └── SyncView.vue     # 同步管理
│       ├── stores/              # Pinia 状态管理
│       │   ├── music.ts         # 音乐库状态
│       │   ├── player.ts        # 播放器状态（HTML5 Audio）
│       │   └── playlist.ts      # 歌单状态
│       ├── styles/              # 样式
│       │   └── global.css       # 全局样式
│       └── utils/               # 工具函数
│           └── format.ts        # 格式化函数
│
├── index.html                   # HTML 入口
├── vite.config.ts               # Vite 配置
├── package.json                 # 项目配置
├── tsconfig.json                # TypeScript 配置
└── electron-builder.json        # 打包配置
```

## 核心功能

### 1. 音乐库扫描
- 支持扫描多个本地音乐文件夹
- 支持格式: mp3, flac, m4a, wav, ogg, wma, ape, aac
- 自动解析歌曲元数据（标题、艺术家、专辑、时长、封面）
- 进度反馈（扫描阶段、解析阶段）

### 2. 播放控制
- 使用 HTML5 Audio 在渲染进程播放
- 自定义协议 `audio://` 加载本地文件
- 播放/暂停、进度拖动、音量控制

### 3. 歌单管理
- 创建、删除、重命名歌单
- 歌单数据持久化到 `userData/playlists.json`

### 4. 同步功能
- 导入 M3U/M3U8 歌单文件
- 导出歌单为 M3U 格式
- 批量导入/导出 JSON 格式

## 运行命令

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# 构建应用
npm run build
```

## 关键实现细节

### 音频播放

音频播放在渲染进程使用 HTML5 Audio 实现，通过自定义协议 `audio://` 加载本地文件：

```typescript
// 主进程注册协议
protocol.registerFileProtocol('audio', (request, callback) => {
  const url = request.url.substr(7) // 去掉 'audio://'
  callback(decodeURIComponent(url))
})

// 歌曲对象包含 audioUrl
{
  audioUrl: `audio://${filePath}`
}

// 渲染进程播放
audio.src = song.audioUrl
audio.play()
```

### IPC 通信

主进程与渲染进程通过 preload.ts 暴露的 API 通信：

```typescript
// 渲染进程调用
window.electron.library.scan(paths)
window.electron.library.getSongs()
window.electron.playlist.create(name)
// ...

// 主进程处理
ipcMain.handle('library:scan', async (_, paths) => {
  return await musicLibrary.scan(paths)
})
```

### 数据序列化

IPC 通信只能传递可序列化的数据。Vue reactive 对象需要转换：

```typescript
// 错误：直接传递 reactive 对象
await window.electron.library.scan(musicDirs.value) // ❌

// 正确：转换为普通数组
const paths = [...musicDirs.value] // ✅
await window.electron.library.scan(paths)
```

## 已知问题 & 待优化

### 需要修复的问题

1. **播放队列**: 上一首/下一首功能未实现
2. **歌词显示**: 尚未实现歌词解析和显示
3. **封面优化**: 大量歌曲扫描时封面加载较慢
4. **搜索功能**: 音乐库搜索可以优化

### 待添加功能

1. 均衡器设置
2. 播放模式（随机、单曲循环、列表循环）
3. 音乐可视化
4. 迷你模式
5. 媒体键支持

## 注意事项

1. **国内网络**: 需要配置 npm 镜像源（已配置 .npmrc）
2. **Electron 缓存**: 首次安装可能需要手动清理 node_modules
3. **封面处理**: 封面使用 base64 编码，大量歌曲可能占用较多内存
4. **跨平台路径**: 使用 `path.join` 处理路径，注意 Windows 反斜杠

## 样式约定

- 深色主题，Apple Music 风格
- 主色调: `#e94560` (accent)
- 背景色: `#1a1a2e` (primary), `#16213e` (secondary)
- CSS 变量定义在 `global.css`

## 数据存储

- 歌单数据: `%APPDATA%/melody-player/playlists.json` (Windows)
- 音乐库: 运行时扫描，不持久化

## 调试技巧

1. 开发模式自动打开 DevTools
2. 主进程日志: `console.log` 在终端显示
3. 渲染进程日志: DevTools Console
4. IPC 通信: 在 preload.ts 添加日志调试