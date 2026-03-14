# Melody Player 项目总结

## 项目概述
一个 Apple Music 风格的本地音乐播放器，基于 Electron + Vue 3 + Pinia + TypeScript 开发。

## 技术栈
- **前端**: Vue 3 (Composition API) + Pinia + Vue Router + TypeScript
- **桌面端**: Electron 28
- **构建工具**: Vite 5 + vite-plugin-electron
- **音频元数据解析**: music-metadata

## 项目结构
```
melody/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts            # 主进程入口
│   │   ├── preload.ts          # 预加载脚本
│   │   ├── musicLibrary.ts     # 音乐库管理（扫描、缓存）
│   │   ├── player.ts           # 播放器状态管理
│   │   ├── playlistManager.ts  # 歌单管理
│   │   ├── syncManager.ts      # 同步管理
│   │   └── configManager.ts    # 配置持久化
│   │
│   └── renderer/               # 渲染进程（前端）
│       ├── components/
│       │   ├── PlayerBar.vue   # 播放栏（含全屏面板、可视化）
│       │   ├── Sidebar.vue     # 侧边栏导航
│       │   ├── SongCard.vue    # 歌曲卡片
│       │   └── TitleBar.vue    # 标题栏
│       │
│       ├── views/
│       │   ├── HomeView.vue       # 首页
│       │   ├── LibraryView.vue    # 音乐库（分页、排序）
│       │   ├── PlaylistView.vue   # 歌单详情
│       │   ├── SettingsView.vue   # 设置页
│       │   └── SyncView.vue       # 同步页
│       │
│       ├── stores/
│       │   ├── player.ts       # 播放状态
│       │   ├── music.ts        # 音乐库状态
│       │   └── playlist.ts     # 歌单状态
│       │
│       └── styles/
│           ├── global.css      # 全局样式（明亮主题）
│           └── animations.css  # 动画效果
│
├── package.json
└── vite.config.ts
```

## 已实现功能

### 核心播放功能
- [x] 音频播放/暂停/停止
- [x] 上一首/下一首（支持循环）
- [x] 进度条拖动
- [x] 音量控制
- [x] 播放列表管理

### 音乐库功能
- [x] 扫描本地音乐文件夹
- [x] 元数据缓存（大幅提升启动速度）
- [x] 增量扫描（只解析变更文件）
- [x] 歌曲列表分页（每页50首）
- [x] 多字段排序（标题/艺术家/专辑/时长）
- [x] 搜索功能

### 歌单功能
- [x] 创建/删除歌单
- [x] 添加/移除歌曲
- [x] 歌单持久化存储

### 全屏播放界面
- [x] 封面展示（带浮动动画）
- [x] 歌词显示
- [x] 三种音频可视化效果：
  - **VU表**: 复古双声道电平表，木纹外框+LED分段
  - **频谱分析器**: 32段LED风格频谱
  - **示波器**: CRT显示器风格波形显示
- [x] 动态背景：根据封面提取主色调，浮动光球效果

### 视觉效果
- [x] 明亮主题
- [x] 页面过渡动画
- [x] 列表交错动画
- [x] 卡片悬停效果
- [x] 毛玻璃背景效果
- [x] 封面发光光晕

### 配置管理
- [x] 音乐文件夹配置持久化
- [x] 启动时自动加载
- [x] 缓存管理（清除缓存）

## IPC 通信接口

### library
- `scan(paths, forceRescan)` - 扫描音乐库
- `getSongs()` - 获取歌曲列表
- `getAlbums()` - 获取专辑列表
- `getArtists()` - 获取艺术家列表
- `clearCache()` - 清除缓存
- `onScanProgress` - 扫描进度事件

### player
- `onStateChange` - 播放状态变化事件

### playlist
- `create(name)` - 创建歌单
- `getAll()` - 获取所有歌单
- `addSong(playlistId, songId)` - 添加歌曲到歌单
- `removeSong(playlistId, songId)` - 从歌单移除歌曲
- `delete(playlistId)` - 删除歌单

### config
- `getMusicDirs()` - 获取音乐文件夹列表
- `setMusicDirs(dirs)` - 设置音乐文件夹
- `addMusicDir(dir)` - 添加音乐文件夹
- `removeMusicDir(dir)` - 移除音乐文件夹

### app
- `ready()` - 前端准备好后触发自动加载

### window
- `minimize()` - 最小化窗口
- `maximize()` - 最大化窗口
- `close()` - 关闭窗口

## CSS 变量
```css
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

## 待优化/可扩展功能

1. **播放功能增强**
   - 随机播放/单曲循环模式
   - 播放队列管理
   - 歌词同步滚动

2. **音乐库增强**
   - 专辑详情页
   - 艺术家详情页
   - 最近播放记录
   - 播放统计

3. **可视化增强**
   - 可视化参数可调
   - 更多可视化样式
   - 响应音频节拍的动画

4. **性能优化**
   - 虚拟列表（大数据量）
   - 图片懒加载
   - 内存管理

5. **其他**
   - 歌词在线获取
   - 封面在线获取
   - 均衡器实际生效
   - 迷你模式

## 运行命令
```bash
# 开发
npm run dev

# 构建
npm run build
```

## Git 提交历史
```
24cdf91 feat: 优化浮动光球位置和切歌过渡动画
0d9853d feat: 播放页面根据封面提取主色调，动态毛玻璃渐变背景
28a4acb fix: 修复可视化黑屏和控制按钮溢出问题
e9b73bc feat: 明亮主题及复古风格音频可视化
9d2d49d feat: 添加丝滑的页面过渡动效和交互动画
e81291e feat: 添加歌曲元数据缓存机制，大幅提升启动速度
41e0bcd feat: 添加应用启动加载页面
f016e3b feat: 全屏播放界面及三种音频可视化效果
81a789b feat: 播放栏上滑面板支持封面、歌词、效果器
9aa14d4 feat: 音乐库添加排序和分页功能
817cfb0 feat: 实现播放器下一首/上一首功能及配置持久化
ef49075 feat: 初始化项目 - Apple Music 风格本地音乐播放器
```