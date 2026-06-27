/**
 * ============================================
 *   画境插件开发模板（多窗口模式）
 *   复制此文件，改名字和内容，即可创建新插件
 * ============================================
 *
 * 使用方法：
 * 1. 复制此文件为 js/skills/你的插件名.js
 * 2. 修改下面的配置
 * 3. 在 index.html 中加一行: <script src="js/skills/你的插件名.js"></script>
 * 4. 在 main.js 中加一行: SkillSystem.registerPlugin(你的插件对象);
 * 5. 打开页面 → 点击底部 🧩 商店按钮 → 安装你的插件
 *
 * 【多窗口模式核心规则】
 * - deactivate() 必须为空函数，不做任何清理
 * - activate() 必须检查是否已有 DOM，有则直接 return
 * - 所有窗口 DOM 必须标记 data-skill-id="你的插件id"
 * - 首次激活时必须默认创建一个内容（节点/卡片/窗口等）
 * - 事件绑定只在首次 activate 时执行，不会重复
 * - 关闭/清空按钮才真正销毁 DOM 和解绑事件
 */

var MyPlugin = {
    // ===== 基本信息 =====
    id: 'my-plugin',          // 唯一ID（英文，不能重复）
    name: '我的插件',          // 显示名称
    icon: '模',
    key: '2',                 // 快捷键（可选，1-9）

    // ===== 内部状态（私有）=====
    _world: null,
    _layer: null,
    _elements: [],            // 你在世界里创建的DOM元素
    _eventsBound: false,      // 事件是否已绑定（防止重复）

    // ===== 生命周期 =====

    /**
     * 激活时调用（可能被多次调用：首次打开、切换回来）
     * 【重要】必须判断是否已有 DOM，避免重复创建
     */
    activate: function(world) {
        this._world = world;
        this._layer = world.getLayer();

        // ✅ 关键：如果已有内容（切换回来），直接 return，不重复创建
        if (this._elements.length > 0) {
            SkillSystem.renderSubTools();
            return;
        }

        // 首次激活：创建 DOM
        this._createDefaultContent();

        // 绑定事件（只绑定一次）
        if (!this._eventsBound) {
            this._bindEvents();
            this._eventsBound = true;
        }

        // 更新子工具栏
        SkillSystem.renderSubTools();
    },

    /**
     * 切换到其他插件时调用
     * 【重要】必须为空函数！不做任何清理，窗口保持显示
     */
    deactivate: function() {
        // 不做任何操作，窗口保持打开，只有关闭按钮才销毁
    },

    // ===== 子工具栏 =====

    getSubTools: function() {
        var self = this;
        return [
            {
                label: '创建示例',
                action: function() {
                    self._createExample();
                }
            },
            {
                label: '🗑️ 关闭全部',
                action: function() {
                    self._destroyAll();
                }
            }
        ];
    },

    // ===== 保存/恢复 =====

    save: function() {
        return {
            count: this._elements.length
        };
    },

    load: function(data) {
        if (!data) return;
        console.log('恢复插件状态:', data);
    },

    // ===== 私有方法 =====

    /**
     * 首次激活时创建默认内容
     * 【重要】每个插件首次打开时必须创建一个默认内容
     */
    _createDefaultContent: function() {
        var pos = this._world.screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
        this._createElement(pos.x - 100, pos.y - 50, '🛠️ 我的插件已激活！');
    },

    /**
     * 创建一个带 data-skill-id 标记的元素
     * 【重要】所有窗口 DOM 必须标记 data-skill-id
     * 这样点击窗口时 SkillSystem 会自动切换到对应插件
     */
    _createElement: function(x, y, text) {
        var el = document.createElement('div');
        el.style.cssText = 'position:absolute;left:' + x + 'px;top:' + y + 'px;' +
            'padding:12px 20px;background:rgba(15,25,50,0.85);' +
            'border:1px solid rgba(100,160,255,0.15);border-radius:12px;' +
            'color:#e8edf5;font-size:13px;pointer-events:auto;user-select:none;' +
            'backdrop-filter:blur(24px) saturate(180%);';
        el.textContent = text || '示例元素 #' + (this._elements.length + 1);

        // ✅ 关键：标记插件ID，点击时自动切换工具栏
        el.setAttribute('data-skill-id', this.id);

        this._makeDraggable(el);
        this._layer.appendChild(el);
        this._elements.push(el);
        this._world.markContent(x, y, 200, 50);
        return el;
    },

    _createExample: function() {
        var pos = this._world.screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
        this._createElement(pos.x - 100, pos.y - 25);
    },

    /**
     * 真正销毁所有内容（关闭按钮调用）
     * 【重要】只有关闭/清空按钮才调用此方法
     */
    _destroyAll: function() {
        // 解绑事件
        this._unbindEvents();
        this._eventsBound = false;

        // 移除所有 DOM
        this._elements.forEach(function(el) {
            if (el._cleanup) el._cleanup();
            if (el.parentNode) el.parentNode.removeChild(el);
        });
        this._elements = [];
    },

    _makeDraggable: function(el) {
        var self = this;
        var isDragging = false;
        var startX, startY, origX, origY;

        el.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return;
            e.stopPropagation();
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            origX = parseInt(el.style.left);
            origY = parseInt(el.style.top);
            el.style.cursor = 'grabbing';
        });

        var onMove = function(data) {
            if (!isDragging) return;
            var worldStart = self._world.screenToWorld(startX, startY);
            var worldNow = self._world.screenToWorld(data.screenX, data.screenY);
            el.style.left = (origX + (worldNow.x - worldStart.x)) + 'px';
            el.style.top = (origY + (worldNow.y - worldStart.y)) + 'px';
        };

        var onUp = function() {
            if (!isDragging) return;
            isDragging = false;
            el.style.cursor = 'grab';
        };

        this._world.on('mousemove', onMove);
        this._world.on('mouseup', onUp);

        el._cleanup = function() {
            self._world.off('mousemove', onMove);
            self._world.off('mouseup', onUp);
        };
    },

    _bindEvents: function() {
        // 只在首次 activate 时调用一次
        var self = this;
        this._onContextMenu = function(data) {
            console.log('右键点击世界:', data.worldX, data.worldY);
        };
        this._world.on('contextmenu', this._onContextMenu);
    },

    _unbindEvents: function() {
        if (!this._world) return;
        this._world.off('contextmenu', this._onContextMenu);
        this._elements.forEach(function(el) {
            if (el._cleanup) el._cleanup();
        });
    }
};
