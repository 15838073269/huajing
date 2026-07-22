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
    'js/skills/book-reader.js',     // 📖 书境 - 文件阅读器+152格式识别
    'js/skills/mao-quotes.js',      // 📕 信仰语录 - 每60秒随机展示
    'js/skills/prompt-template.js', // 💬 提示词模板 - AI绘画提示词[变量]管理
    'js/skills/nav-bookmarks.js',   // 🧭 导航网址 - 网址收藏+标签分类
    // 'js/skills/ui-debugger.js',  // 🐛 UI调试器 - 可视化调整前端样式

    // === 图片处理 ===
    'js/skills/image-crop.js',      // ✂️ 图片裁剪 - 宽高比预设+旋转+网格
    'js/skills/mp42sprites.js',     // 🎬 视频抽帧 - 帧提取+预览+下载
    'js/skills/tile-tool.js',       // 🖼️ 素材拆分合并 - 矩形/异形拆分+合并拼图
    'js/skills/seamless-tile.js',   // ♾️ 无缝平铺 - 单图无限平铺预览

    // === 媒体播放 ===

    // === 绘图 ===
    'js/skills/drawing.js',         // 🖌️ 画板 - SVG画笔+橡皮擦

    // === 编辑器 ===
    'js/skills/node-editor.js',  // 📋 节点编辑器 - 分镜式节点编辑

    // === 像素画 ===
    'js/skills/pixel-paint.js',  // 像素画 - 数字像素绘画系统

    // === 动画 ===
    // 'js/skills/spine-animate.js', // 🦴 骨骼动画 - FK/IK/约束/缓动/弹性物理

    // === 叠图 ===
    'js/skills/tile-replace.js',  // 🧩 叠图替换 - Marching Squares 自动瓦片

    // === 字体（已删除） ===

    // === AI ===
    // AI生图（多文件插件，按顺序加载，请勿调整顺序）
    'js/skills/ai-image-gen/aig-styles.js',     // 🎨 样式定义
    'js/skills/ai-image-gen/aig-config.js',     //    对象声明+模型配置+分辨率计算
    'js/skills/ai-image-gen/aig-ratio.js',      //    比例选择面板
    'js/skills/ai-image-gen/aig-canvas.js',     //    窗口创建+画布绑定+生命周期
    'js/skills/ai-image-gen/aig-nodes.js',      //    节点管理+参考图+渲染
    'js/skills/ai-image-gen/aig-generate.js',   //    AI生成API调用
    'js/skills/ai-image-gen/aig-history.js',    //    历史记录+导入导出
    'js/skills/ai-image-gen/aig-storage.js',    //    IndexedDB持久化
    'js/skills/ai-image-gen/aig-panels.js',     //    设置面板+图片查看+导出
    'js/skills/ai-image-gen/aig-main.js',       //    公开API+工具方法+销毁
    // 'js/skills/ai-image-gen-canvas.js',  // ❌ 旧版（仅静态渲染，无交互）

    // === 引擎 ===
    // 'js/skills/game-loop.js',   // ▶ 游戏循环 - 演示独立 game loop 驱动的迷你游戏

    // === 音频 ===
    'js/skills/synth-sfx.js',   // ≈ 音效合成 - 数学波形合成+20+游戏音效预设+WAV导出
    'js/skills/audio-clip.js',  // 剪 音频剪辑 - 声波裁剪+去片段+导出画布

    // === AI 协作 ===
    // 'js/skills/gui.js',     // 规 - Game Dev Agent Cluster（多AI角色协作+文档+生图）

    // === 学习 ===
    'js/skills/hanzi-3500.js',   // 字 3500常用汉字 - 查询/分组/笔顺动画/语音播报
    'js/skills/pinyin-lookup.js', // 拼 拼音笔画查询 - 输入汉字批量查询拼音/笔画/偏旁+复制表格
];

/**
 * 插件编号映射（ID -> 固定编号）
 * 新增插件时在此添加对应编号
 */
var PLUGIN_NUMBERS = {
    'calculator': 1,
    'book-reader': 2,
    'mao-quotes': 3,
    'prompt-template': 4,
    'nav-bookmarks': 5,
    'image-crop': 6,
    'mp42sprites': 7,
    'tile-tool': 8,
    'seamless-tile': 27,
    // 'music': 9,
    // 'video': 10,
    'drawing': 11,
    'node-editor': 13,
    'pixel-paint': 14,
    // 'spine-animate': 15,
    // 'audio-cleaner': 16,
    // 'nine-slice': 17,
    'tile-replace': 18,
    'ai-image-gen': 19,
    'synth-sfx': 20,
    'audio-clip': 28,
    // 'ui-debugger': 21,
    // 'game-loop': 22,
    // 'gui': 23,
    // 'font-craft': 20
    'hanzi-3500': 25,
    'pinyin-lookup': 26,
};
