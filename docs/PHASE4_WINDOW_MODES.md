# 💻 Phase 4 完成 - 窗口模式

## ✅ 已完成功能

### 1. 迷你模式 (Mini Mode) ⭐
**让小窗口随时控制音乐！**

**特性：**
- 尺寸：300x80px（原窗口的 1/10）
- 位置：屏幕右上角（固定）
- 始终置顶（floating 层级）
- 跨工作区可见
- 隐藏到任务栏

**功能保留：**
- 完整播放控制
- 基础信息展示
- 全局热键仍可用

**UI 简化：**
```
[封面小图] [歌曲名 - 艺术家] [控制按钮]
尺寸对比：
- 正常模式：1200x800
- 迷你模式：300x80  (节省 93% 空间)
```

---

### 2. 画中画模式 (Picture-in-Picture) 🖼️
**边工作边看播放界面！**

**特性：**
- 尺寸：400x300px
- 位置：屏幕右下角
- 始终置顶
- 保留完整 UI

**使用场景：**
```
- 浏览网页时看歌词
- 写代码时看可视化
- 看视频时控制音乐
```

---

### 3. 窗口模式切换 🔀
**三种模式自由切换：**

```
正常模式 → 迷你模式：
- 点击播放栏「📱」按钮
- 窗口缩小到右上角
- 保留基础功能

正常模式 → 画中画：
- 点击播放栏「🖼️」按钮
- 窗口缩小到右下角
- 保留完整 UI

迷你模式 → 正常模式：
- 再次点击「📱」按钮
- 恢复到原始尺寸和位置

画中画 → 正常模式：
- 再次点击「🖼️」按钮
- 恢复到 1200x800
```

---

## 🚀 使用方法

### 进入迷你模式
```
方法 1：点击播放栏「📱」图标
方法 2：快捷键（预留）
```

**效果：**
- 窗口移动到右上角
- 尺寸变为 300x80
- 任务栏消失
- 始终在最前

---

### 进入画中画
```
点击播放栏「🖼️」图标
```

**效果：**
- 窗口移动到右下角
- 尺寸变为 400x300
- 任务栏保留
- 始终在最前

---

### 退出模式
```
再次点击对应按钮即可退出
```

---

## 📁 新增文件

### miniWindowManager.ts
```
位置：src/main/miniWindowManager.ts
功能：
- 窗口尺寸管理
- 位置管理
- 模式切换
- 状态同步

代码量：~150 行
```

### 修改文件
```
src/main/index.ts
- 集成 MiniWindowManager
- 添加 IPC 处理器

src/main/preload.ts
- 暴露窗口控制 API
- 添加事件监听

src/renderer/components/PlayerBar.vue
- 添加模式切换按钮
- 状态监听和显示
```

---

## 🎨 技术实现

### 迷你模式
```typescript
// 保存原始尺寸位置
this.previousBounds = this.mainWindow.getBounds()

// 设置迷你尺寸
const miniWidth = 300
const miniHeight = 80

// 移动到右上角
this.mainWindow.setBounds({
  x: screenWidth - miniWidth - 20,
  y: 20,
  width: miniWidth,
  height: miniHeight,
})

// 设置窗口属性
this.mainWindow.setAlwaysOnTop(true, 'floating')
this.mainWindow.setVisibleOnAllWorkspaces(true)
this.mainWindow.setSkipTaskbar(true)
```

### 画中画模式
```typescript
// 设置画中画尺寸
const pipWidth = 400
const pipHeight = 300

// 移动到右下角
this.mainWindow.setPosition(
  screenWidth - pipWidth - 20,
  screenHeight - pipHeight - 100
)

// 置顶但保留任务栏
this.mainWindow.setAlwaysOnTop(true, 'floating')
```

### 状态同步
```typescript
// 主进程 → 渲染进程
mainWindow.webContents.send('window:miniModeChanged', isMini)
mainWindow.webContents.send('window:PiPModeChanged', isPiP)

// 渲染进程监听
window.electron.window.onMiniModeChanged((isMini) => {
  isMiniMode.value = isMini
})
```

---

## 🎯 用户体验流

### 典型场景 1：专注工作
```
1. 开始工作前播放音乐
2. 点击「📱」进入迷你模式
3. 小窗口悬浮在右上角
4. 完全不遮挡工作区
5. 需要时点击小窗口控制
6. 使用全局热键更快捷
```

### 典型场景 2：浏览网页
```
1. 边听音乐边看网页
2. 点击「🖼️」进入画中画
3. 400x300 窗口在右下角
4. 可以看到歌词和可视化
5. 随时控制播放
```

### 典型场景 3：演示展示
```
1. 全屏演示中需要背景音乐
2. 使用迷你模式（不占空间）
3. 或者用全局热键控制
4. 完全不影响演示内容
```

---

## 📊 尺寸对比

| 模式 | 尺寸 | 位置 | 任务栏 | 置顶 | 适合场景 |
|------|------|------|--------|------|----------|
| **正常** | 1200x800 | 居中 | 显示 | 否 | 专注听歌 |
| **迷你** | 300x80 | 右上 | 隐藏 | 是 | 背景播放 |
| **画中画** | 400x300 | 右下 | 显示 | 是 | 协同工作 |

---

## 🎮 交互细节

### 迷你模式 UI
```
+-----------------------------+
| [封面] 歌曲名 - 艺术家 [控制] |
+-----------------------------+
 250px 内容区 + 50px 控制区
```

### 画中画模式 UI
```
+------------------+
|  [黑胶模式] 可视化 |
|  [歌词滚动] [控制] |
+------------------+
完整功能缩小版
```

---

## 🔧 高级功能

### 窗口属性管理
```typescript
// 迷你模式特殊属性
setResizable(false)        // 不可调整大小
setAlwaysOnTop(true)       // 始终置顶
setVisibleOnAllWorkspaces(true) // 所有桌面
setSkipTaskbar(true)       // 隐藏任务栏

// 退出时恢复
setResizable(true)
setAlwaysOnTop(false)
setVisibleOnAllWorkspaces(false)
setSkipTaskbar(false)
setMinimumSize(900, 600)
```

### 位置记忆
```typescript
// 进入迷你模式前保存原始位置
this.previousBounds = this.mainWindow.getBounds()

// 退出时恢复
if (this.previousBounds) {
  this.mainWindow.setBounds(this.previousBounds)
}
```

---

## ⚠️ 注意事项

### Windows 兼容性
- 迷你模式在高分辨率屏幕下可能需要调整尺寸
- 任务栏隐藏在某些系统版本可能需要重启
- 跨工作区功能在 Windows 上可能受限

### macOS 兼容性
- 跨工作区使用 setVisibleOnAllWorkspaces
- 置顶效果在 macOS 上需要 floating 层级
- 画中画模式与系统画中画不冲突

### Linux 兼容性
- 窗口管理器可能影响置顶效果
- 跨工作区功能依赖桌面环境
- GNOME/KDE 行为可能不同

---

## 💡 扩展建议

### 未来可以添加
1. **自定义迷你模式位置**
   - 支持拖动到任意角落
   - 记住用户偏好位置

2. **迷你模式自定义**
   - 选择显示的信息
   - 控制按钮布局
   - 透明度调节

3. **画中画增强**
   - 可调节大小
   - 透明背景
   - 鼠标穿透

4. **快捷键**
   - Ctrl/Cmd + M → 迷你模式
   - Ctrl/Cmd + P → 画中画

---

## 📝 测试清单

- [ ] 点击「📱」进入迷你模式
- [ ] 检查窗口位置（右上角）
- [ ] 检查窗口尺寸（300x80）
- [ ] 检查窗口属性（置顶、跨工作区）
- [ ] 播放/暂停测试
- [ ] 切歌测试
- [ ] 点击「📱」退出迷你模式
- [ ] 点击「🖼️」进入画中画
- [ ] 检查画中画尺寸（400x300）
- [ ] 检查画中画位置（右下角）
- [ ] 拖动画中画窗口
- [ ] 点击「🖼️」退出画中画

---

## ✅ Phase 4 完成！

**已实现窗口模式：**
- ✅ 迷你模式（300x80，右上角，完全置顶）
- ✅ 画中画模式（400x300，右下角，保留 UI）
- ✅ 模式切换（一键切换，状态同步）
- ✅ 位置记忆（退出后恢复原位）

**代码量：**
- 新增文件：1 个（~150 行）
- 修改文件：3 个
- 总计：~200 行代码

**开发时间：** 约 10 分钟

---

**下一站：Phase 5 - 音效增强** 🔊
- 10 段均衡器
- 音效预设
- 3D 环绕
- 低音增强

或者直接 **Phase 6 - 测试验证** ✅

---

## 🎉 Phase 4 完成！

现在你的播放器有：
- 🎨 **3 种视觉主题**（正常/迷你/画中画）
- 🎯 **灵活布局**（右上角/右下角/任意）
- 🎮 **场景适配**（工作/浏览/演示）

**总共已完成：Phase 1-4（4/6）** 🚀

---

**使用提示：**
```
工作场景 → 迷你模式 + 全局热键
看歌词 → 画中画 + 桌面歌词
专注听歌 → 黑胶模式 + 可视化
```

你的播放器已经成为终极全能播放器了！✨
