# 随身播放器同步功能的设计与实现

> 本文详细介绍了 Melody Player 中随身播放器同步功能的技术实现，包括设备检测、歌曲匹配、同步策略等核心机制。

## 一、背景与需求

随着数字音乐的发展，许多音乐爱好者仍然保持着使用随身播放器（如 Sony Walkman、iPod、Fiio 等）听歌的习惯。这些设备通常通过 USB 连接电脑，需要手动管理音乐文件。

对于一个本地音乐播放器来说，实现与随身播放器的同步功能可以大大提升用户体验：
- 自动检测设备连接
- 一键同步整个音乐库
- 智能识别已存在的歌曲，避免重复复制
- 同步播放列表，在其他设备上延续收听体验

## 二、整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                      Electron 应用                           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐        ┌─────────────────┐            │
│  │  DeviceManager  │        │  SyncManager    │            │
│  │                 │        │                 │            │
│  │  - detect()     │        │  - preview()    │            │
│  │  - scanMusic()  │◄──────►│  - syncTo()     │            │
│  │  - remember()   │        │  - import()     │            │
│  └─────────────────┘        └─────────────────┘            │
│           │                          │                      │
│           ▼                          ▼                      │
│  ┌─────────────────┐        ┌─────────────────┐            │
│  │   设备信息       │        │   文件操作       │            │
│  │  - 容量          │        │  - copyFile     │            │
│  │  - 文件系统      │        │  - unlink       │            │
│  │  - 歌曲统计      │        │  - writeFile    │            │
│  └─────────────────┘        └─────────────────┘            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

系统分为两个核心模块：

1. **DeviceManager**：负责设备检测、信息收集、设备记忆
2. **SyncManager**：负责同步逻辑、文件操作、歌单生成

## 三、设备检测机制

### 3.1 跨平台检测

不同操作系统挂载 USB 设备的方式不同，需要分别处理：

**Windows 系统**

```typescript
// 使用 WMIC 命令获取驱动器信息
const { stdout } = await execAsync(
  'wmic logicaldisk get caption,volumename,drivetype,size,freespace,filesystem,volumeserialnumber /format:csv'
);

// 解析输出，提取每个驱动器的信息
// caption: 驱动器号 (如 "D:")
// drivetype: 类型 (2=可移动, 3=本地磁盘, 4=网络)
// size: 总容量
// freespace: 可用空间
// filesystem: 文件系统 (NTFS, FAT32, exFAT)
```

**macOS 系统**

```typescript
// 扫描 /Volumes 目录
const volumesPath = '/Volumes';
const entries = await readdir(volumesPath);

// 使用 df 命令获取容量信息
const { stdout } = await execAsync(`df -k "${mountPoint}" | tail -1`);
// 解析输出获取总容量和可用空间
```

**Linux 系统**

```typescript
// 扫描 /media、/mnt、/run/media 目录
const mountPaths = ['/media', '/mnt', '/run/media'];
// 同样使用 df 命令获取容量
```

### 3.2 设备信息结构

检测到的设备信息保存在以下结构中：

```typescript
interface DeviceInfo {
  id: string               // 设备唯一标识（基于序列号+容量生成）
  drive: string            // 设备路径（如 "G:" 或 "/Volumes/DEVICE"）
  label: string            // 设备名称
  type: 'usb' | 'fixed'    // 设备类型
  
  // 容量信息
  totalSize: number        // 总容量（字节）
  freeSize: number         // 可用空间
  usedSize: number         // 已用空间
  
  // 设备特征
  fileSystem?: string      // 文件系统类型
  serialNumber?: string    // 序列号
  
  // 音乐相关
  musicFolder?: string     // 检测到的音乐目录
  playlistFolder?: string  // 歌单目录
  songCount: number        // 歌曲数量
  playlistCount: number    // 歌单数量
  
  // 记忆功能
  lastSyncTime?: number    // 上次同步时间
  customName?: string      // 用户自定义名称
  isKnown: boolean         // 是否是已记忆的设备
}
```

### 3.3 音乐目录自动识别

设备上可能有不同的音乐目录命名习惯：

```typescript
const possibleMusicPaths = [
  'Music', 'MUSIC', 'music',
  'Media', 'MEDIA', 'media',
  'MP3', 'mp3',
  'Audio', 'AUDIO', 'audio',
  'Songs', 'SONGS', 'songs',
  '音乐', '我的音乐'
];

// 遍历查找存在的目录
for (const subPath of possibleMusicPaths) {
  const fullPath = join(drive, subPath);
  if (existsSync(fullPath)) {
    musicFolder = fullPath;
    break;
  }
}
```

如果找不到标准目录，会检查根目录是否包含音频文件，有的话就使用根目录作为音乐目录。

### 3.4 设备记忆功能

为了提升用户体验，我们实现了设备记忆功能：

```typescript
// 存储位置：{userData}/devices.json
interface StoredDevice {
  id: string
  customName?: string      // 用户自定义名称
  lastSyncTime?: number    // 上次同步时间
  musicFolder?: string     // 记住的音乐目录
  playlistFolder?: string  // 记住的歌单目录
  syncedSongs?: string[]   // 已同步的歌曲列表
}
```

当用户再次连接同一设备时，可以：
- 显示用户设置的设备名称
- 记住上次同步时间
- 使用上次配置的目录
- 实现增量同步

## 四、歌曲匹配算法

这是同步功能最核心的部分，决定了哪些歌曲需要复制，哪些已经存在。

### 4.1 设备歌曲扫描

首先扫描设备上已有的所有音频文件：

```typescript
async scanDeviceSongs(device: DeviceInfo): Promise<Map<string, string>> {
  const audioExts = ['.mp3', '.flac', '.m4a', '.wav', '.ogg', '.wma', '.ape', '.aac'];
  const songMap = new Map<string, string>();  // 文件名 -> 完整路径
  const searchPath = device.musicFolder || device.drive;

  // 递归扫描目录
  const scan = async (dir: string) => {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        await scan(fullPath);  // 递归扫描子目录
      } else if (entry.isFile()) {
        const ext = entry.name.split('.').pop()?.toLowerCase();
        if (ext && audioExts.includes(`.${ext}`)) {
          // 去掉扩展名，作为匹配键
          const nameWithoutExt = entry.name.replace(/\.[^.]+$/, '');
          songMap.set(nameWithoutExt.toLowerCase(), fullPath);
        }
      }
    }
  };

  await scan(searchPath);
  return songMap;
}
```

扫描结果是一个 `Map`，键是去掉扩展名的文件名（小写），值是完整路径。

### 4.2 匹配策略

对于每首本地歌曲，我们尝试在设备上找到对应的文件：

```typescript
findDeviceSong(song: Song, deviceSongs: Map<string, string>): string | null {
  const titleLower = song.title.toLowerCase();
  const artistLower = song.artist?.toLowerCase() || '';

  // 策略1: "艺术家 - 歌曲名" 精确匹配
  // 这是我们同步时使用的命名格式，优先级最高
  const patterns = [
    `${artistLower} - ${titleLower}`,
    `${titleLower} - ${artistLower}`,  // 有些设备可能反过来
    titleLower,                         // 仅歌曲名
  ];

  for (const pattern of patterns) {
    if (deviceSongs.has(pattern)) {
      return deviceSongs.get(pattern)!;
    }
  }

  // 策略2: 模糊匹配 - 文件名包含歌曲名
  // 适用于非本软件同步的文件
  for (const [key, path] of deviceSongs) {
    if (key.includes(titleLower)) {
      return path;
    }
  }

  // 未找到匹配
  return null;
}
```

**匹配优先级**：
1. 精确匹配 `艺术家 - 歌曲名`
2. 反向匹配 `歌曲名 - 艺术家`
3. 仅歌曲名匹配
4. 模糊匹配（文件名包含歌曲名）

### 4.3 匹配算法的局限性

当前实现存在一些局限性：

| 问题 | 说明 | 影响 |
|------|------|------|
| 文件名依赖 | 只比较文件名，不检查文件内容 | 同名不同版本的歌可能被误判 |
| 编码敏感 | 文件名编码可能不一致 | 中文歌曲可能匹配失败 |
| 无内容校验 | 不比较文件大小或哈希 | 无法检测损坏或不完整的文件 |
| 元数据忽略 | 不读取音频文件的元数据 | 同一首歌不同编码格式会被重复复制 |

**改进建议**：

```typescript
// 更精确的匹配：结合文件大小
interface DeviceSongInfo {
  path: string;
  size: number;
  duration?: number;
}

// 匹配时同时检查文件大小（允许小范围误差）
if (key.includes(titleLower)) {
  const sizeDiff = Math.abs(deviceSong.size - localSong.size);
  if (sizeDiff < 1024 * 10) {  // 10KB 容差
    return path;
  }
}
```

## 五、同步执行流程

### 5.1 预览阶段

在真正执行同步前，先进行预览，让用户确认：

```typescript
async previewSyncToDevice(device: DeviceInfo, options: SyncOptions): Promise<SyncPreview> {
  const localSongs = this.musicLibrary.getSongs();
  const deviceSongs = await this.scanDeviceSongs(device);

  let toCopyCount = 0;
  let toDeleteCount = 0;
  let totalSize = 0;

  // 统计需要复制的歌曲
  for (const song of localSongs) {
    if (!this.findDeviceSong(song, deviceSongs)) {
      toCopyCount++;
      totalSize += await getFileSize(song.filePath);
    }
  }

  // 统计需要删除的歌曲（如果开启清理）
  if (options.deleteRemoved) {
    for (const [key, devicePath] of deviceSongs) {
      let foundInLocal = false;
      for (const song of localSongs) {
        if (this.matchesSong(key, song)) {
          foundInLocal = true;
          break;
        }
      }
      if (!foundInLocal) {
        toDeleteCount++;
      }
    }
  }

  return {
    toCopyCount,
    toDeleteCount,
    totalSize,
    freeSpaceAfter: device.freeSize - totalSize
  };
}
```

预览结果向用户展示：
- 需要复制多少首歌曲
- 需要删除多少首歌曲
- 总共占用多少空间
- 同步后剩余多少可用空间

### 5.2 执行同步

用户确认后，执行实际的同步操作：

```typescript
async syncLibraryToDevice(device: DeviceInfo, options: SyncOptions): Promise<SyncResult> {
  const result = { songsCopied: 0, songsSkipped: 0, errors: [] };
  
  const musicFolder = device.musicFolder || device.drive;
  const playlistFolder = device.playlistFolder || join(device.drive, 'Playlists');

  // 确保目录存在
  await mkdir(musicFolder, { recursive: true });
  await mkdir(playlistFolder, { recursive: true });

  const deviceSongs = await this.scanDeviceSongs(device);

  // 复制歌曲
  for (const song of this.musicLibrary.getSongs()) {
    if (!this.findDeviceSong(song, deviceSongs)) {
      const fileName = `${song.artist} - ${song.title}${extname(song.filePath)}`;
      const targetPath = join(musicFolder, fileName);

      try {
        await copyFile(song.filePath, targetPath);
        result.songsCopied++;
        this.notifyProgress('copying', result.songsCopied, total, song.title);
      } catch (e) {
        result.errors.push(`复制失败: ${song.title}`);
      }
    } else {
      result.songsSkipped++;
    }
  }

  // 导出歌单
  for (const playlist of this.playlistManager.getAll()) {
    const m3uContent = this.generateM3U(playlist, deviceSongs);
    await writeFile(join(playlistFolder, `${playlist.name}.m3u`), m3uContent);
  }

  return result;
}
```

### 5.3 文件命名规则

同步后的文件采用扁平结构，所有歌曲直接放在音乐目录下：

```
命名格式: {艺术家} - {歌曲名}.{扩展名}

示例:
├── MUSIC/
│   ├── 周杰伦 - 晴天.mp3
│   ├── 周杰伦 - 七里香.mp3
│   ├── 林俊杰 - 江南.mp3
│   └── ...
└── Playlists/
    ├── 我的最爱.m3u
    └── 运动歌单.m3u
```

**为什么选择扁平结构？**

1. **兼容性好**：大多数随身播放器支持扁平结构
2. **文件名唯一**：`艺术家 - 歌曲名` 格式避免同名冲突
3. **M3U 引用简单**：歌单中的路径可以直接使用文件名

**为什么不使用嵌套目录？**

虽然 `艺术家/专辑/歌曲` 的结构更清晰，但：
- 不同设备对目录深度支持不同
- M3U 文件路径需要是相对路径或绝对路径，处理复杂
- 用户可能在不同设备间同步，目录结构可能不一致

### 5.4 特殊字符处理

文件名中可能包含不允许的字符，需要清理：

```typescript
sanitizeFileName(name: string): string {
  // 替换 Windows 不允许的字符
  // < > : " / \ | ? *
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .slice(0, 100);  // 限制长度，避免路径过长
}
```

## 六、歌单同步

### 6.1 M3U 格式

M3U 是最通用的播放列表格式：

```
#EXTM3U                          ← 文件头，标识 M3U 格式
#PLAYLIST:我的最爱               ← 歌单名称
#EXTINF:280,周杰伦 - 晴天        ← 歌曲信息（时长秒, 显示名）
G:\MUSIC\周杰伦 - 晴天.mp3       ← 文件路径
#EXTINF:195,林俊杰 - 江南
G:\MUSIC\林俊杰 - 江南.mp3
```

### 6.2 歌单生成

```typescript
generateDeviceM3U(playlist: Playlist, deviceSongs: Map<string, string>): string {
  const lines = ['#EXTM3U', `#PLAYLIST:${playlist.name}`];

  for (const songId of playlist.songIds) {
    const song = this.getSong(songId);
    const devicePath = this.findDeviceSong(song, deviceSongs);

    if (devicePath) {
      // 歌曲在设备上存在，添加到歌单
      const duration = Math.floor(song.duration);
      const artist = song.artist || 'Unknown Artist';
      lines.push(`#EXTINF:${duration},${artist} - ${song.title}`);
      lines.push(devicePath);  // 使用设备上的路径
    }
    // 如果歌曲不在设备上，跳过（或可以记录警告）
  }

  return lines.join('\n');
}
```

**注意事项**：

1. **路径匹配**：歌单中的路径必须是设备上的实际路径
2. **歌曲过滤**：如果歌曲未同步到设备，不应出现在歌单中
3. **编码问题**：M3U 文件使用 UTF-8 编码，确保中文正确显示

## 七、增量同步与清理

### 7.1 增量同步

增量同步只复制设备上不存在的歌曲：

```typescript
// 检查歌曲是否已存在
if (this.findDeviceSong(song, deviceSongs)) {
  result.songsSkipped++;
  continue;  // 跳过已存在的
}

// 只复制新歌曲
await copyFile(song.filePath, targetPath);
result.songsCopied++;
```

这样可以大大减少同步时间，特别是在音乐库只更新了一小部分歌曲时。

### 7.2 清理已移除的歌曲

这是一个可选的、需要谨慎使用的功能：

```typescript
if (options.deleteRemoved) {
  // 获取本地歌曲的文件名集合
  const localSongNames = new Set(
    localSongs.map(s => this.getSongFileName(s).toLowerCase())
  );

  // 检查设备上的每首歌曲
  for (const [key, devicePath] of deviceSongs) {
    if (!localSongNames.has(key)) {
      // 本地没有这首歌，删除设备上的
      await unlink(devicePath);
      result.songsDeleted++;
    }
  }
}
```

**风险提示**：

- 如果用户在设备上手动添加了歌曲，同步时会被删除
- 建议默认关闭此功能，或提供"移到回收站"选项

## 八、进度反馈

同步可能需要较长时间，需要提供实时进度反馈：

```typescript
// 主进程发送进度事件
private notifyProgress(phase: string, current: number, total: number, message: string) {
  if (this.win && !this.win.isDestroyed()) {
    this.win.webContents.send('sync:progress', { phase, current, total, message });
  }
}

// 在同步过程中调用
for (let i = 0; i < localSongs.length; i++) {
  const song = localSongs[i];
  // ... 复制操作
  this.notifyProgress('copying', i + 1, total, `复制: ${song.title}`);
}
```

渲染进程监听并显示进度：

```typescript
// 前端监听进度
window.electron.sync.onProgress((progress) => {
  syncProgress.value = progress;
  // 显示: 复制: 晴天 (150/230)
});
```

## 九、错误处理

同步过程中可能遇到各种错误：

```typescript
const result: SyncResult = {
  success: true,
  errors: [],
  // ...
};

for (const song of localSongs) {
  try {
    await copyFile(song.filePath, targetPath);
    result.songsCopied++;
  } catch (e) {
    // 记录错误，继续处理其他歌曲
    result.errors.push(`复制失败: ${song.title} - ${e.message}`);
  }
}

// 最终结果包含所有错误
result.success = result.errors.length === 0;
```

常见错误类型：
- **磁盘空间不足**：`ENOSPC`
- **权限问题**：`EACCES`
- **文件不存在**：`ENOENT`
- **路径过长**：`ENAMETOOLONG`

## 十、总结与展望

### 10.1 当前实现的优缺点

**优点**：
- ✅ 跨平台支持（Windows/macOS/Linux）
- ✅ 自动设备检测与识别
- ✅ 增量同步，避免重复复制
- ✅ 设备记忆，保存用户配置
- ✅ 实时进度反馈

**缺点**：
- ❌ 只比较文件名，不检查内容
- ❌ 扁平结构可能不适合所有设备
- ❌ 清理功能风险较高
- ❌ 不支持双向同步（设备 → 本地）

### 10.2 改进方向

1. **更精确的匹配**：使用文件大小、时长、哈希等多维度匹配
2. **支持嵌套目录**：允许用户选择目录结构
3. **双向同步**：识别设备上新增的歌曲
4. **智能清理**：移到回收站而非直接删除
5. **断点续传**：记录同步进度，支持中断后继续
6. **并发传输**：使用多线程加速大文件复制

### 10.3 参考实现

完整代码可在 [GitHub](https://github.com/example/melody-player) 查看，主要文件：
- `src/main/deviceManager.ts` - 设备管理
- `src/main/syncManager.ts` - 同步逻辑
- `src/renderer/views/SyncView.vue` - 用户界面

---

*本文首发于 [个人博客](https://example.com)，转载请注明出处。*