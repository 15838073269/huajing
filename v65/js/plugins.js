/**
 * 插件清单
 * 添加新插件：把 js 文件放到 js/skills/ 目录，然后在这里加一行文件名
 * 取消注释即可启用对应插件
 *
 * 编号与插件 ID 强绑定，按列表顺序分配，不随拖拽排序变化
 */
var PLUGIN_LIST = [
    // === 工具类 ===
    'js/skills/calculator.js',      // 🔢 高精度计算器 - 科学计算+变量+表达式解析
    'js/skills/reader.js',          // 📝 文本阅读器 - 拖放文本文件创建卡片
    'js/skills/mao-quotes.js',      // 📕 信仰语录 - 每60秒随机展示
    'js/skills/prompt-template.js', // 💬 提示词模板 - AI绘画提示词[变量]管理
    'js/skills/nav-bookmarks.js',   // 🧭 导航网址 - 网址收藏+标签分类

    // === 图片处理 ===
    'js/skills/audio-cleaner.js',   // 🎧 音频清理 - 导入音频+自动降噪剪辑+导出
    'js/skills/nine-slice.js',      // ✂️ 九宫格切片 - 拖拽彩线调整边距+实时预览+导出
    'js/skills/image-crop.js',      // ✂️ 图片裁剪 - 宽高比预设+旋转+网格
    'js/skills/mp42sprites.js',     // 🎬 视频抽帧 - 帧提取+预览+下载
    'js/skills/tile-tool.js',       // 🖼️ 素材拆分合并 - 矩形/异形拆分+合并拼图

    // === 媒体播放 ===
    'js/skills/music.js',           // 🎵 音乐播放 - 拖放音频+列表+播放模式
    'js/skills/video.js',           // 📹 视频播放 - 拖放视频+懒加载+多播

    // === 绘图 ===
    'js/skills/drawing.js',         // 🖌️ 画板 - SVG画笔+橡皮擦

    // === 文件浏览 ===
    'js/skills/folder-browser.js',  // 📂 文件夹浏览 - 文件夹拖放+网格预览

    // === 编辑器 ===
    'js/skills/node-editor.js',  // 📋 节点编辑器 - 分镜式节点编辑

    // === 像素画 ===
    'js/skills/pixel-paint.js',  // 像素画 - 数字像素绘画系统

    // === 动画 ===
    'js/skills/spine-animate.js', // 🦴 骨骼动画 - FK/IK/约束/缓动/弹性物理

    // === 叠图 ===
    'js/skills/tile-replace.js',  // 🧩 叠图替换 - Marching Squares 自动瓦片

    // === AI ===
    'js/skills/ai-image-gen.js',  // 🎨 AI生图 - AI图片生成
];

/**
 * 插件编号映射（ID -> 固定编号）
 * 新增插件时在此添加对应编号
 */
var PLUGIN_NUMBERS = {
    'calculator': 1,
    'reader': 2,
    'mao-quotes': 3,
    'prompt-template': 4,
    'nav-bookmarks': 5,
    'image-crop': 6,
    'mp42sprites': 7,
    'tile-tool': 8,
    'music': 9,
    'video': 10,
    'drawing': 11,
    'folder-browser': 12,
    'node-editor': 13,
    'pixel-paint': 14,
    'spine-animate': 15,
    'audio-cleaner': 16,
    'nine-slice': 17,
    'tile-replace': 18,
    'ai-image-gen': 19
};
