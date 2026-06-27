# tile-tool 导出 Godot .tscn 设计方案

## 概述

在画境 v66 的 `tile-tool`（抠图插件）现有导出能力基础上，增加「导出 Godot 场景」功能。把抠出来的每块素材，按原始位置导出为一个 **TextureRect 节点**，生成 `.tscn` 文件。

## 输出结构

```
output_name/
├── output_name.tscn          # Godot 场景文件
└── textures/
    ├── region_001.png
    ├── region_002.png
    └── region_003.png
```

整体打包为一个 ZIP 供浏览器下载。

## .tscn 格式

### 根节点

```gdscript
[gd_scene load_steps=N format=3 uid="uid://b8h6c5a4d3e2f"]

[sub_resource type="Theme" id="Theme_xxx"]
# 可选：禁用所有子节点的鼠标事件
```

### 纹理引用

每块素材对应一个 `ext_resource`：

```gdscript
[ext_resource type="Texture2D" path="res://textures/region_001.png" id="1_tex"]
```

### 节点结构

所有 TextureRect 平铺挂在根节点下，按 z-index 排序（对应抠图顺序）：

```gdscript
[node name="Root" type="Control"]
layout_mode = 0
anchors_preset = 0
size = Vector2(SCREENSHOT_W, SCREENSHOT_H)
mouse_filter = 2  # Ignore，把鼠标穿透交给子节点

[node name="region_001" type="TextureRect" parent="."]
layout_mode = 0
position = Vector2(X, Y)
size = Vector2(W, H)
texture = ExtResource("1_tex")
expand_mode = 0  # 保持纹理原始尺寸
stretch_mode = 0  # 不缩放
mouse_filter = 1  # Pass，点击穿透
```

其中 `SCREENSHOT_W/H` = 原始截图的宽高，`X/Y/W/H` = 抠图区域的像素坐标。

### TextureRect 配置

```
expand_mode (保持尺寸):  Keep
stretch_mode (不拉伸):   Keep
mouse_filter (点击穿透): Pass (1)
```

目的是：这些素材在引擎里只做视觉展示，不拦截鼠标事件（除非特定某块需要交互）。

## tile-tool 中的改动位置

### 入口 UI

在 tile-tool 的导出区域末尾增加一个按钮：

```
┌─────────────────────────────────┐
│  导出单张  │  批量 ZIP  │  ...  │  ← 现有导出
├─────────────────────────────────┤
│  ┌─────────────────────────┐    │
│  │ 🌐 导出 Godot 场景       │    │  ← 新增
│  └─────────────────────────┘    │
└─────────────────────────────────┘
```

点击后弹出对话框：

```
┌─────────────────────────────────┐
│  导出 Godot 场景                 │
│                                 │
│  场景名称: [my_game_ui      ]   │
│  图片前缀: [ui_             ]   │
│                                 │
│  [取消]  [导出 .tscn + PNG]     │
└─────────────────────────────────┘
```

### 数据来源

tile-tool 的 `regionInfos`（或类似变量）已经记录了每块区域：
- `x, y, w, h`：像素坐标
- `dataURL` 或 `canvas`：图像数据
- `name`：素材名称

直接遍历这个数组生成：
1. 每个区域保存为独立 PNG
2. 对应一条 `ext_resource` + 一个 `[node]` 定义

### 生成函数

```javascript
function exportGodotScene(regions, screenshotW, screenshotH, sceneName, imagePrefix) {
  // regions: [{x, y, w, h, name, imageData}]
  // 返回: { tscn: string, textures: [{filename, dataURL}] }
}
```

## 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 节点类型 | TextureRect (Control) | UI 素材，不在 3D/2D 世界空间 |
| 坐标模式 | 硬坐标 position | 固定分辨率，场景尺寸=截图尺寸 |
| 缩放 | 1:1 直出 | 不缩放，保留原始像素 |
| 鼠标事件 | Pass 穿透 | 默认不拦截，需要交互的手动改 |
| 输出方式 | ZIP 下载 | 浏览器不能写文件系统 |
| 图片格式 | PNG | 支持透明通道 |

## 后续可能的扩展

- 支持导出为 Sprite2D（用于游戏内场景物件而非 UI）
- 支持按素材标签分组为不同目录
- 支持导出时自动生成预览缩略图
