#!/usr/bin/env pwsh
# Melody Player Release Script
# 发布 Melody Player 到 GitHub Release

$ErrorActionPreference = "Stop"

Write-Host "=== Melody Player Release Script ===" -ForegroundColor Cyan
Write-Host ""

# 检查是否安装 gh CLI
try {
    gh --version | Out-Null
    Write-Host "[✓] GitHub CLI installed" -ForegroundColor Green
} catch {
    Write-Host "[✗] GitHub CLI not found. Please install from: https://cli.github.com/" -ForegroundColor Red
    exit 1
}

# 检查是否已登录 GitHub
Write-Host "Checking GitHub authentication..."
$login = gh auth status 2>&1 | Select-String -Pattern "Logged in to"
if (-not $login) {
    Write-Host "[!] Not logged in. Authenticating..." -ForegroundColor Yellow
    gh auth login
} else {
    Write-Host "[✓] Already logged in" -ForegroundColor Green
}

# 检查目录
$releaseDir = "release"
$setupExe = "Melody Player Setup 1.0.0.exe"
$setupPath = Join-Path $releaseDir $setupExe

if (-not (Test-Path $setupPath)) {
    Write-Host "[✗] Build not found! Please run 'npm run build' first." -ForegroundColor Red
    exit 1
}

Write-Host "[✓] Found build artifact: $setupPath" -ForegroundColor Green

# 获取版本号
$packageJson = Get-Content "package.json" | ConvertFrom-Json
$version = $packageJson.version
$tagName = "v$version"

Write-Host ""
Write-Host "=== Release Information ===" -ForegroundColor Cyan
Write-Host "Version: $version"
Write-Host "Tag: $tagName"
Write-Host "Release File: $setupPath"
Write-Host ""

# 检查是否已存在该 release
Write-Host "Checking if release $tagName exists..."
$existing = gh release view $tagName 2>$null
if ($existing) {
    Write-Host "[!] Release $tagName already exists. Deleting..." -ForegroundColor Yellow
    gh release delete $tagName -y 2>$null
}

# 创建 release
Write-Host ""
Write-Host "Creating release $tagName..." -ForegroundColor Cyan

$releaseNotes = @"
## 🎉 Melody Player v$version

### ✨ 新功能
- 本地音乐播放（支持 MP3、FLAC、M4A、WAV 等格式）
- 智能专辑封面提取和显示
- 随机推荐和音乐库管理
- 播放队列管理
- 桌面歌词显示

### 🐛 Bug 修复
- 修复 FLAC 格式专辑封面无法加载的问题
- 修复播放器界面封面显示问题
- 修复点击歌曲播放错误的问题

### 📦 安装说明
- Windows: 下载 `Melody Player Setup $version.exe` 运行安装
- 或使用绿色版：解压 `win-unpacked` 目录后运行 `Melody Player.exe`

### 📝 更新日志
- 完整的变更请查看 [CHANGELOG.md](https://github.com/kpkpy/melody-player/blob/master/CHANGELOG.md)
"@

# 创建 release 并上传文件
gh release create $tagName `
  --title "Melody Player v$version" `
  --notes $releaseNotes `
  $setupPath

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "[✓] Release created successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "View release at:" -ForegroundColor Cyan
    Write-Host "https://github.com/kpkpy/melody-player/releases/tag/$tagName"
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "[✗] Failed to create release" -ForegroundColor Red
    exit 1
}

# 推送 git 标签
Write-Host "Pushing tags to GitHub..."
git push origin --tags 2>$null

if ($LASTEXITCODE -eq 0) {
    Write-Host "[✓] Tags pushed" -ForegroundColor Green
} else {
    Write-Host "[!] Tags push failed (may need git push)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Release Complete ===" -ForegroundColor Cyan
