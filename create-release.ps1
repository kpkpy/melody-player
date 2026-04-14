$env:HTTP_PROXY="http://127.0.0.1:7897"
$env:HTTPS_PROXY="http://127.0.0.1:7897"

cd "C:\Users\kpy\Documents\Opencode\melody"

$releaseTag = "v1.0.0"
$releaseTitle = "Melody Player v1.0.0"
$releaseFile = "release/Melody Player Setup 1.0.0.exe"
$releaseNotes = @"
## 🎉 Melody Player v1.0.0 正式发布

### ✨ 主要功能
- 🎵 本地音乐播放（支持 MP3、FLAC、M4A、WAV 等格式）
- 🖼️ 智能专辑封面提取和显示
- 🎲 随机推荐和音乐库管理
- 📋 播放队列管理
- 🎤 桌面歌词显示

### 🐛 Bug 修复
- 修复 FLAC 格式专辑封面无法加载的问题
- 修复播放器界面封面显示问题
- 修复点击歌曲播放错误的问题

### 📦 安装说明
- Windows: 下载 \`Melody Player Setup 1.0.0.exe\` 运行安装
- 或使用绿色版：解压 \`win-unpacked\` 目录后运行 \`Melody Player.exe\`

### 🔗 GitHub
https://github.com/kpkpy/melody-player
"@

Write-Host "Creating release $releaseTag..."
& gh release create $releaseTag `
  --title $releaseTitle `
  --notes $releaseNotes `
  --generate-notes `
  $releaseFile

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "[✓] Release created successfully!" -ForegroundColor Green
  Write-Host "View at: https://github.com/kpkpy/melody-player/releases/tag/$releaseTag"
} else {
  Write-Host "[✗] Failed to create release" -ForegroundColor Red
}
