# 画境 v65 插件开发指南

## 一、插件基本结构

每个插件是一个 JS 文件，放在 `js/skills/` 目录下，导出一个全局对象。

### 最小模板

```javascript
var MyPlugin = {
    // ===== 必填字段 =====
    id: 'my-plugin',          // 唯一标识（英文，kebab-case）
    name: '我的插件',          // 显示名称
    icon: '插',               // 底部栏图标（1-2个汉字）
    // key: '5',              // 可选：快捷键

    // ===== 生命周期（至少实现 activate） =====
    activate: function(world) { /* 激活时调用 */ },
    deactivate: function() { /* 切换走时调用 */ },

    // ===== 可选 =====
    getSubTools: function() { return []; },  // 子工具栏按钮
    save: function() { return {}; },          // 保存状态
    load: function(data) {}                   // 恢复状态
};
```

### 注册流程

```
1. 插件文件放在 js/skills/ 目录
2. 在 js/plugins.js 的 PLUGIN_LIST 中添加路径
3. PluginLoader.autoRegister() 自动检测全局变量并注册
4. 检测条件: obj.id && obj.name && obj.icon && typeof obj.activate === 'function'
```

---

## 二、生命周期详解

### activate(world)

用户点击底部栏图标时调用，`world` 是 `GameWorld` 对象。

```javascript
activate: function(world) {
    this._world = world;

    // ✅ 正确：检查是否已创建，避免重复初始化
    if (this._overlay) {
        SkillSystem.renderSubTools();
        return;
    }

    this._createOverlay();
    SkillSystem.renderSubTools();
}
```

### deactivate()

切换到其他插件时调用。

```javascript
deactivate: function() {
    // ✅ 多窗口模式：什么都不做，窗口保持打开
},

deactivate: function() {
    // ✅ 需要清理时：只解绑事件，不删除 DOM
    this._unbindEvents();
    this._isDrawing = false;
}
```

### _destroy()（自定义方法）

用户点击窗口"关"按钮时调用，彻底销毁。

```javascript
_destroy: function() {
    // 1. 清理事件
    document.removeEventListener('mousemove', this._onMove);
    // 2. 清理定时器
    if (this._timer) clearInterval(this._timer);
    // 3. 移除 DOM
    if (this._overlay && this._overlay.parentNode) {
        this._overlay.parentNode.removeChild(this._overlay);
    }
    this._overlay = null;
    // 4. 重置状态
    this._data = [];
}
```

---

## 三、窗口类型与规范

### 类型 A：fixed 独立窗口（推荐）

适用于有复杂 UI 的插件（裁剪、像素画、视频抽帧等）。

```javascript
_createOverlay: function() {
    var ov = document.createElement('div');
    ov.className = 'my-overlay';
    ov.setAttribute('data-skill-id', this.id);  // ← 必须！点击自动切回插件
    ov.style.cssText = 'position:fixed;width:800px;height:500px;z-index:9999;' +
        'background:#0f3460;color:#eee;border-radius:10px;' +
        'box-shadow:0 8px 40px rgba(0,0,0,.6);overflow:hidden;' +
        'left:' + Math.max(20, (window.innerWidth - 800) / 2) + 'px;' +
        'top:' + Math.max(20, (window.innerHeight - 500) / 2) + 'px;';
    document.body.appendChild(ov);
    this._overlay = ov;
}
```

**必须遵守**：
- `position:fixed`，不遮挡画布
- `data-skill-id` 属性（点击窗口自动切回对应插件）
- `z-index:9999`
- 深色主题配色（见下方配色表）
- deactivate 不隐藏窗口
- 关闭按钮调 `_destroy()` + `SkillSystem.deactivate()`

### 类型 B：世界层元素

适用于在世界画布上操作的插件（节点编辑、音乐播放器等）。

```javascript
activate: function(world) {
    this._world = world;
    var layer = world.getLayer();
    var el = document.createElement('div');
    el.setAttribute('data-skill-id', this.id);  // ← 必须
    el.style.cssText = 'position:absolute;left:100px;top:100px;';
    layer.appendChild(el);
}
```

### 类型 C：全屏覆盖层（特殊）

适用于绘画等需要拦截所有输入的插件。

```javascript
// SVG 放在 document.body，position:fixed，z-index:10001
// pointer-events:none，不阻挡其他 UI
```

---

## 四、窗口拖拽（类型 A 必备）

```javascript
// 在 _bindEvents 中
var header = ov.querySelector('.my-header');
var dragging = false, startX, startY, startLeft, startTop;

header.addEventListener('mousedown', function(e) {
    if (e.target.closest('.my-close-btn')) return; // 关闭按钮不触发
    dragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startLeft = ov.offsetLeft;
    startTop = ov.offsetTop;
    e.preventDefault();
});

document.addEventListener('mousemove', function(e) {
    if (!dragging) return;
    ov.style.left = (startLeft + e.clientX - startX) + 'px';
    ov.style.top = (startTop + e.clientY - startY) + 'px';
});

document.addEventListener('mouseup', function() {
    dragging = false;
});
```

**CSS**：标题栏加 `cursor:move;user-select:none;`

---

## 五、子工具栏

```javascript
getSubTools: function() {
    var self = this;
    return [
        { label: '操作A', action: function() { self._doA(); } },
        { label: '操作B', title: '提示文字', action: function() { self._doB(); } },
        // 自定义 HTML（如颜色选择器、滑块）
        { html: '<input type="color" id="my-color" value="#ff0000">' },
        { html: '<input type="range" min="1" max="99" value="5" id="my-slider">' }
    ];
}
```

**注意**：
- `renderSubTools()` 会重建 DOM，旧的 input 事件监听器会丢失
- **解决方案**：用 document 级别事件委托监听 input 变化
- `action` 在按钮点击后执行，然后自动调 `renderSubTools()`

---

## 六、事件绑定规范

### 事件委托（推荐）

```javascript
// 颜色/滑块等动态元素，用事件委托
this._onDelegate = function(e) {
    if (e.target.id === 'my-color') self._color = e.target.value;
    if (e.target.id === 'my-slider') self._size = parseInt(e.target.value);
};
document.addEventListener('input', this._onDelegate, true);
```

### document 级别事件

```javascript
// 必须在 _unbindEvents 中清理
document.addEventListener('mousemove', this._onMove);
document.addEventListener('mouseup', this._onUp);
```

### 世界层事件

```javascript
// 通过 GameWorld 事件系统
this._world.on('mousedown', function(e) { ... });
// 注意：world.on 的事件无法解绑，慎用
```

### 清理模板

```javascript
_unbindEvents: function() {
    if (this._onMove) document.removeEventListener('mousemove', this._onMove);
    if (this._onUp) document.removeEventListener('mouseup', this._onUp);
    if (this._onDelegate) document.removeEventListener('input', this._onDelegate, true);
    if (this._observer) { this._observer.disconnect(); this._observer = null; }
}
```

---

## 七、状态保存与恢复

```javascript
save: function() {
    return {
        data: this._data,
        settings: this._settings
    };
},

load: function(data) {
    if (data.data) this._data = data.data;
    if (data.settings) this._settings = data.settings;
}
```

保存时机：每 30 秒自动保存 + 页面关闭前保存（main.js `autoSave`）。
存储位置：IndexedDB（通过 GameStorage）。

---

## 八、UI 配色规范（深色主题）

| 用途 | 颜色 |
|---|---|
| 面板背景 | `#0f3460` |
| 侧边栏/标题栏 | `#16213e` |
| 强调色/选中 | `#e94560` |
| 主文字 | `#eee` |
| 次要文字 | `#aaa` / `#bbb` |
| 暗淡文字 | `#666` |
| 边框 | `#333` / `#444` |
| 按钮悬浮 | `rgba(255,255,255,0.06)` |
| 按钮禁用 | `opacity: 0.35` |
| 进度条/渐变 | `linear-gradient(90deg, #e94560, #ff6b9d)` |
| 按钮关闭 | `rgba(220,80,60,0.2)` 边框 `rgba(220,80,60,0.3)` 文字 `#e87060` |

**禁止**：使用 `var(--cos-xxx)` CSS 变量（不是所有插件都加载了这些变量），直接用颜色值。

---

## 九、CSS 样式规范

### 推荐方式：IIFE 注入 style 标签

```javascript
(function() {
    var s = document.createElement('style');
    s.textContent =
        '.my-overlay { ... }' +
        '.my-header { ... }' +
        '.my-btn { ... }';
    document.head.appendChild(s);
})();
```

**优点**：样式集中管理，不污染内联样式，只注入一次。

### 禁止

- ❌ 使用 `var(--cos-xxx)` CSS 变量
- ❌ 使用 emoji 作为图标或按钮文字
- ❌ 使用白色/浅色背景

---

## 十、绘画模式特殊处理

绘画（drawing）是特殊插件，激活期间：
1. **不允许自动切换**：点击其他插件窗口不会切换走（skills.js 中 `activeSkill === 'drawing'` 时 return）
2. **世界层 mousedown 被 stopPropagation**：阻止画布平移
3. **SVG 画布 z-index:10001**：在所有插件窗口之上
4. **只能通过底部栏点击"绘"退出**

如果你的插件需要与绘画共存，注意：
- deactivate 不要删除绘画相关的 DOM
- 窗口 z-index 不要超过 10001

---

## 十一、data-skill-id 规范

**有独立窗口的插件必须设置 `data-skill-id`**：

```javascript
ov.setAttribute('data-skill-id', this.id);
```

作用：点击窗口时自动切换回对应插件（skills.js 捕获阶段监听）。

**不适用**：无窗口的插件（如绘画）、世界层元素插件（如音乐）。

---

## 十二、闭包陷阱

### ❌ 错误：for 循环中的 var

```javascript
for (var i = 0; i < n; i++) {
    el.addEventListener('click', function() {
        self._doSomething(i);  // i 永远等于 n
    });
}
```

### ✅ 正确：IIFE 捕获

```javascript
for (var i = 0; i < n; i++) {
    el.addEventListener('click', (function(idx) {
        return function() { self._doSomething(idx); };
    })(i));
}
```

---

## 十三、SkillSystem API 速查

```javascript
SkillSystem.register(skill)          // 注册插件
SkillSystem.activate(skillId)        // 激活插件
SkillSystem.deactivate()             // 停用当前插件
SkillSystem.getActiveId()            // 获取当前激活插件 ID
SkillSystem.getAll()                 // 获取所有已安装插件
SkillSystem.renderSubTools()         // 刷新子工具栏
SkillSystem.getSkillOrder()          // 获取排列顺序
SkillSystem.setSkillOrder(order)     // 设置排列顺序
SkillSystem.getPlugins()             // 获取商店插件
SkillSystem.showStore()              // 显示包裹面板
```

### GameWorld API 速查

```javascript
world.getLayer()                     // 获取世界层 DOM
world.screenToWorld(sx, sy)          // 屏幕坐标 → 世界坐标
world.on(event, callback)            // 监听世界事件
world.emit(event, data)              // 触发世界事件
world.getState()                     // 获取世界状态
world.setState(state)                // 恢复世界状态
world.fitContent()                   // 适配内容
world.resetView()                    // 重置视图
```

---

## 十四、文件命名与目录

```
v65/
├── js/
│   ├── skills/           ← 插件目录
│   │   ├── plugin-template.js   模板插件（参考）
│   │   ├── drawing.js           画板
│   │   ├── image-crop.js        图片裁剪
│   │   ├── mp42sprites.js       视频序列帧
│   │   └── ...                  其他插件
│   ├── core/
│   │   ├── skills.js            技能系统核心
│   │   ├── plugin-loader.js     插件加载器
│   │   ├── world.js             世界层
│   │   └── storage.js           存储系统
│   ├── plugins.js               插件清单（PLUGIN_LIST）
│   └── main.js                  启动入口
├── css/
│   └── style.css                全局样式
└── index.html
```

### 新建插件步骤

1. 复制 `plugin-template.js` 为 `js/skills/my-plugin.js`
2. 修改 id、name、icon、实现功能
3. 在 `js/plugins.js` 的 `PLUGIN_LIST` 中添加 `'js/skills/my-plugin.js'`
4. 刷新页面，在"包裹"中安装
