# Melody Player Release Build Instructions

## 构建产物

构建完成后的文件位于 `melody/release/` 目录：

```
release/
├── Melody Player Setup 1.0.0.exe    # Windows 安装程序 (~76MB)
├── win-unpacked/                     # 绿色版（可直接运行）
│   └── Melody Player.exe
├── latest.yml                        # 自动更新配置
└── builder-effective-config.yaml     # 构建配置
```

## 手动发布到 GitHub

### 1. 推送到 GitHub

```bash
cd melody
git push origin master
```

### 2. 创建 GitHub Release

使用 GitHub CLI：

```bash
# 登录 GitHub (首次需要)
gh auth login

# 创建 release
gh release create v1.0.0 \
  --title "Melody Player v1.0.0" \
  --notes "## 🎉 首次发布
  
### ✨ 新功能
- 本地音乐播放（支持 MP3、FLAC、M4A、WAV 等格式）
- 智能专辑封面提取和显示
- 随机推荐和音乐库管理
- 播放队列管理
- 桌面歌词显示

### 🐛 Bug 修复
- 修复 FLAC 格式专辑封面无法加载的问题
- 修复播放器界面封面显示问题

### 📦 安装说明
- Windows: 下载 \`Melody Player Setup 1.0.0.exe\` 运行安装
- 或使用绿色版：解压 \`win-unpacked\` 目录后运行 \`Melody Player.exe\`" \
  "release/Melody Player Setup 1.0.0.exe" \
  "release/win-unpacked"
```

### 3. 手动上传（不使用 CLI）

1. 访问 https://github.com/kpkpy/melody-player/releases/new
2. 创建新标签 `v1.0.0`
3. 填写发布说明
4. 上传 `release/Melody Player Setup 1.0.0.exe`
5. 点击 "Publish release"

## 自动更新配置

`latest.yml` 文件已包含自动更新信息：

```yaml
version: 1.0.0
files:
  - url: Melody Player Setup 1.0.0.exe
    size: 79866233
    blockMapSize: 84413
    sha512: <hash>
releaseDate: '2026-04-14T12:45:19.000Z'
```

当新 release 发布后，应用会自动检测并提示更新。

## 构建命令

```bash
# 开发模式
npm run dev

# 生产构建 + 打包
npm run build
```

## 系统要求

- Windows 10 或更高版本
- 2GB RAM 以上
- 500MB 可用磁盘空间
