/**
 * 插件清单
 * 添加新插件：把 js 文件放到 js/skills/ 目录，然后在这里加一行文件名
 * 取消注释即可启用对应插件
 */
var PLUGIN_LIST = [
    // === 工具类 ===
    'js/skills/calculator.js',      // 🔢 高精度计算器 - 科学计算+变量+表达式解析
    'js/skills/reader.js',          // 📝 文本阅读器 - 拖放文本文件创建卡片

    // === 图片处理 ===
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
];
