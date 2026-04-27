/**
 * ============================================
 *   游戏素材拆分与合并工具 - v65 技能
 *   position:fixed 弹窗版本（不与画布联动）
 * ============================================
 *
 * 功能：
 * - 拆分模式：异形智能检测（迭代BFS）、内轮廓抠图
 * - 合并模式：多图上传、网格排列预览、合并下载
 * - 放大镜取色、ZIP 输出（依赖 JSZip）
 */

var TileToolSkill = {

    // ===== 基本信息 =====
    id: 'tile-tool',
    name: '抠图',
    icon: '抠',
    description: '异形拆分+合并拼图，支持套索辅助内扣',
    key: '8',

    // ===== 内部状态 =====
    _overlay: null,
    _toastEl: null,
    _magnifierEl: null,
    _magCanvas: null,
    _magCtx: null,
    _mainCanvas: null,
    _mainCtx: null,
    _overlayCanvas: null,
    _overlayCtx: null,
    _pendingLoad: null,
    _resizeObserver: null,

    // ===== 事件引用（用于清理） =====
    _onKeyDown: null,
    _onPaste: null,
    _onHeaderDown: null,
    _onDocMouseMove: null,
    _onDocMouseUp: null,

    // ===== 常量 =====
    REGION_COLORS: [
        '#e94560','#00c853','#2979ff','#ffab00','#aa00ff',
        '#00bcd4','#ff6d00','#64dd17','#d500f9','#304ffe',
        '#ff1744','#00e676','#2979ff','#ffc400','#d500f9',
        '#18ffff','#ff9100','#76ff03','#ea80fc','#448aff'
    ],
    MAG_SIZE: 140,
    MAG_ZOOM: 8,
    DB_NAME: 'TileToolDB',
    DB_VER: 1,
    STORE: 'settings',

    // ===== 状态对象 =====
    state: null,

    _initState: function() {
        this.state = {
            mode: 'split',
            splitMode: 'irregular',
            originalImage: null,
            processedImageData: null,
            irColorPickMode: null,
            irBgColor: { r: 255, g: 255, b: 255 },
            irOutlineColor: { r: 0, g: 0, b: 0 },
            innerBgColor: { r: 255, g: 255, b: 255 },
            innerOutlineColor: { r: 0, g: 0, b: 0 },
            regions: [],
            selectedRegion: -1,
            innerSelectedRegions: {},
            scale: 1,
            mergeImages: [],
            dragging: false,
            dragType: null,
            dragStart: null,
            lassoMode: null,
            lassoPoints: [],
            lassoRegions: [],
            lassoDrawing: false,
            canvasPanning: false,
            panStartX: 0,
            panStartY: 0,
            gridLineDragging: false,
            gridLineType: null,  // 'col' or 'row'
            gridLineIndex: -1
        };
    },

    // ===== 生命周期 =====

    activate: function(world) {
        this._world = world;

        // 如果已有 overlay，只更新子工具栏
        if (this._overlay) {
            SkillSystem.renderSubTools();
            return;
        }

        this._initState();
        this._createOverlay();
        SkillSystem.renderSubTools();

        if (this._pendingLoad) {
            var data = this._pendingLoad;
            this._pendingLoad = null;
            if (data.mode) this.state.mode = data.mode;
            if (data.detectSensitivity !== undefined) {
                var el2 = this._overlay.querySelector('#detectSensitivity');
                if (el2) el2.value = data.detectSensitivity;
                var valEl2 = this._overlay.querySelector('#detectSensVal');
                if (valEl2) valEl2.textContent = data.detectSensitivity;
            }
            if (data.outlineTolerance !== undefined) {
                var el3 = this._overlay.querySelector('#outlineTolerance');
                if (el3) el3.value = data.outlineTolerance;
                var valEl3 = this._overlay.querySelector('#outlineTolVal');
                if (valEl3) valEl3.textContent = data.outlineTolerance;
            }
            if (data.minArea !== undefined) {
                var el4 = this._overlay.querySelector('#minArea');
                if (el4) el4.value = data.minArea;
                var valEl4 = this._overlay.querySelector('#minAreaVal');
                if (valEl4) valEl4.textContent = data.minArea;
            }
            if (data.dilatePx !== undefined) {
                var el5 = this._overlay.querySelector('#dilatePx');
                if (el5) el5.value = data.dilatePx;
                var valEl5 = this._overlay.querySelector('#dilatePxVal');
                if (valEl5) valEl5.textContent = data.dilatePx;
            }
            if (data.innerTolerance !== undefined) {
                var el6 = this._overlay.querySelector('#innerTolerance');
                if (el6) el6.value = data.innerTolerance;
                var valEl6 = this._overlay.querySelector('#innerTolVal');
                if (valEl6) valEl6.textContent = data.innerTolerance;
            }
            if (data.innerDilatePx !== undefined) {
                var el7 = this._overlay.querySelector('#innerDilatePx');
                if (el7) el7.value = data.innerDilatePx;
                var valEl7 = this._overlay.querySelector('#innerDilatePxVal');
                if (valEl7) valEl7.textContent = data.innerDilatePx;
            }
            if (data.trimTransparent !== undefined) {
                var el10 = this._overlay.querySelector('#trimTransparent');
                if (el10) el10.checked = data.trimTransparent;
            }
            if (data.splitFormat) {
                var el11 = this._overlay.querySelector('#splitFormat');
                if (el11) el11.value = data.splitFormat;
            }
            this._switchMode(data.mode || 'split');
        }
    },

    deactivate: function() {
        // 不做任何操作，窗口保持打开，只有关闭按钮才销毁
    },

    // ===== 子工具栏 =====

    getSubTools: function() {
        var self = this;
        return [
            {
                label: '关',
                action: function() {
                    self._destroy();
                    if (typeof SkillSystem !== 'undefined') {
                        SkillSystem.deactivate();
                    }
                }
            }
        ];
    },

    // ===== 真正销毁（关闭按钮调用） =====
    _destroy: function() {
        // 清理键盘事件
        if (this._onKeyDown) {
            document.removeEventListener('keydown', this._onKeyDown);
            this._onKeyDown = null;
        }
        if (this._onBeforeUnload) {
            window.removeEventListener('beforeunload', this._onBeforeUnload);
            this._onBeforeUnload = null;
        }
        if (this._onPaste) {
            document.removeEventListener('paste', this._onPaste);
            this._onPaste = null;
        }
        if (this._onHeaderDown) {
            document.removeEventListener('mousedown', this._onHeaderDown, true);
            this._onHeaderDown = null;
        }
        if (this._onDocMouseMove) {
            document.removeEventListener('mousemove', this._onDocMouseMove);
            this._onDocMouseMove = null;
        }
        if (this._onDocMouseUp) {
            document.removeEventListener('mouseup', this._onDocMouseUp);
            this._onDocMouseUp = null;
        }
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
        if (this._overlay && this._overlay.parentNode) {
            // 保存窗口大小（用getBoundingClientRect更可靠）
            this._saveWindowSize();
            this._overlay.parentNode.removeChild(this._overlay);
        }
        this._overlay = null;
        this._mainCanvas = null;
        this._mainCtx = null;
        this._overlayCanvas = null;
        this._overlayCtx = null;
        this._brushCanvas = null;
        this._brushCtx = null;
        this._toastEl = null;
        this._magnifierEl = null;
        this._magCanvas = null;
        this._magCtx = null;
        this._initState();
    },

    // ===== IndexedDB 辅助方法 =====

    _openDB: function() {
        var self = this;
        return new Promise(function(res, rej) {
            var r = indexedDB.open(self.DB_NAME, self.DB_VER);
            r.onupgradeneeded = function(e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains(self.STORE)) db.createObjectStore(self.STORE);
            };
            r.onsuccess = function(e) { res(e.target.result); };
            r.onerror = function(e) { rej(e); };
        });
    },

    _saveWindowSize: function() {
        if (!this._overlay || !this._overlay.parentNode) return;
        try {
            var r = this._overlay.getBoundingClientRect();
            localStorage.setItem('tt-window-size', JSON.stringify({w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top)}));
        } catch(e) {}
    },

    _loadWindowSize: function() {
        try { return JSON.parse(localStorage.getItem('tt-window-size')); } catch(e) { return null; }
    },

    // ===== 保存/恢复 =====

    save: function() {
        var s = this.state;
        return {
            mode: s.mode,
            detectSensitivity: this._getVal('#detectSensitivity'),
            outlineTolerance: this._getVal('#outlineTolerance'),
            minArea: this._getVal('#minArea'),
            dilatePx: this._getVal('#dilatePx'),
            innerTolerance: this._getVal('#innerTolerance'),
            innerDilatePx: this._getVal('#innerDilatePx'),
            trimTransparent: this._getChecked('#trimTransparent'),
            splitFormat: this._getVal('#splitFormat')
        };
    },

    load: function(data) {
        if (!data) return;
        this._pendingLoad = data;
    },

    _getVal: function(sel) {
        if (!this._overlay) return undefined;
        var el = this._overlay.querySelector(sel);
        return el ? el.value : undefined;
    },

    _getChecked: function(sel) {
        if (!this._overlay) return undefined;
        var el = this._overlay.querySelector(sel);
        return el ? el.checked : undefined;
    },

    // ========================================
    //   CSS 样式
    // ========================================

    _getCSS: function() {
        return [
            ':root {',
            '  --bg: #1a1a2e; --bg2: #16213e; --bg3: #0f3460;',
            '  --accent: #e94560; --accent2: #533483; --text: #eee; --text2: #aaa;',
            '  --border: #333; --success: #00c853; --warn: #ffab00;',
            '}',
            '.tt-overlay { position:fixed; width:900px; height:600px; z-index:9999; display:flex; flex-direction:column; background:#1a1a2e; color:#eee; font-family:"Segoe UI",system-ui,sans-serif; border-radius:10px; box-shadow:0 8px 40px rgba(0,0,0,.6); overflow:auto; user-select:none; resize:both; min-width:600px; min-height:400px; }',
            '.tt-header { display:flex; align-items:center; justify-content:space-between; padding:8px 16px; background:#16213e; border-bottom:1px solid #333; flex-shrink:0; cursor:move; user-select:none; }',
            '.tt-header h1 { font-size:18px; background:linear-gradient(135deg,#e94560,#ff6b9d); -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin:0; }',
            '.tt-mode-tabs { display:flex; gap:4px; background:#1a1a2e; border-radius:8px; padding:3px; }',
            '.tt-mode-tab { padding:7px 18px; border:none; border-radius:6px; cursor:pointer; background:transparent; color:#aaa; font-size:13px; font-weight:500; transition:.2s; }',
            '.tt-mode-tab.active { background:#e94560; color:#fff; }',
            '.tt-mode-tab:hover:not(.active) { background:rgba(255,255,255,.08); }',
            '.tt-close-btn { background:rgba(220,80,60,.2); border:1px solid rgba(220,80,60,.3); color:#e87060; border-radius:6px; padding:5px 14px; cursor:pointer; font-size:13px; margin-left:12px; }',
            '.tt-close-btn:hover { background:rgba(220,80,60,.4); }',
            '.tt-app { display:flex; flex:1; overflow:hidden; min-height:0; }',
            '.tt-sidebar { width:300px; min-width:300px; background:#16213e; border-right:1px solid #333; overflow-y:auto; padding:14px; }',
            '.tt-main { flex:1; display:flex; align-items:center; justify-content:center; overflow:auto; position:relative; background:repeating-conic-gradient(rgba(255,255,255,.03) 0% 25%,transparent 0% 50%) 0 0/20px 20px; min-width:0; }',
            '.tt-panel { display:none; }',
            '.tt-panel.active { display:block; }',
            '.tt-section { margin-bottom:16px; padding:10px; border:1px dashed #444; border-radius:8px; background:rgba(255,255,255,.02); }',
            '.tt-section-title { font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#aaa; margin-bottom:7px; display:flex; align-items:center; gap:6px; }',
            '.tt-section-title::before { content:""; width:3px; height:12px; background:#e94560; border-radius:2px; }',
            '.tt-step-title { font-size:13px; font-weight:bold; color:#e94560; margin:0 0 8px; padding:6px 10px; background:rgba(233,69,96,0.1); border-radius:6px; border-left:3px solid #e94560; }',
            '.tt-step-num { display:inline-block; width:22px; height:22px; line-height:22px; text-align:center; background:#e94560; color:#fff; border-radius:50%; font-size:12px; margin-right:6px; }',
            '.tt-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:7px 14px; border:none; border-radius:6px; cursor:pointer; font-size:12px; font-weight:500; transition:.2s; width:100%; }',
            '.tt-btn-primary { background:#e94560; color:#fff; }',
            '.tt-btn-primary:hover { background:#d63851; transform:translateY(-1px); }',
            '.tt-btn-secondary { background:rgba(255,255,255,.08); color:#eee; border:1px solid #333; }',
            '.tt-btn-secondary:hover { background:rgba(255,255,255,.12); }',
            '.tt-btn-success { background:#00c853; color:#fff; }',
            '.tt-btn-success:hover { background:#00a844; }',
            '.tt-btn-sm { padding:5px 10px; font-size:11px; width:auto; }',
            '.tt-btn-group { display:flex; gap:6px; }',
            '.tt-btn-group .tt-btn { flex:1; }',
            '.tt-input-group { margin-bottom:9px; }',
            '.tt-input-group label { display:block; font-size:11px; color:#aaa; margin-bottom:3px; }',
            '.tt-input-group input[type="range"] { width:100%; accent-color:#e94560; }',
            '.tt-input-group input[type="number"], .tt-input-group input[type="text"], .tt-input-group select { width:100%; padding:5px 9px; background:#1a1a2e; border:1px solid #333; border-radius:4px; color:#eee; font-size:12px; }',
            '.tt-toggle { position:relative; display:inline-block; width:36px; height:20px; cursor:pointer; }',
            '.tt-toggle input { opacity:0; width:0; height:0; }',
            '.tt-toggle-slider { position:absolute; top:0; left:0; right:0; bottom:0; background:#333; border-radius:10px; transition:.2s; }',
            '.tt-toggle-slider::before { content:""; position:absolute; width:16px; height:16px; left:2px; bottom:2px; background:#fff; border-radius:50%; transition:.2s; }',
            '.tt-toggle input:checked + .tt-toggle-slider { background:#e94560; }',
            '.tt-toggle input:checked + .tt-toggle-slider::before { transform:translateX(16px); }',
            '.tt-grid-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }',
            '.tt-grid-row label:first-child { font-size:11px; color:#aaa; flex-shrink:0; }',
            '.tt-grid-row input[type="number"] { width:70px; padding:4px 8px; background:#1a1a2e; border:1px solid #333; border-radius:4px; color:#eee; font-size:12px; text-align:right; }',
            '.tt-grid-input-wrap { display:flex; align-items:center; gap:4px; }',
            '.tt-grid-input-wrap span { color:#888; font-size:11px; }',
            '.tt-range-row { display:flex; align-items:center; gap:8px; }',
            '.tt-range-row input[type="range"] { flex:1; }',
            '.tt-range-val { min-width:36px; text-align:center; font-size:11px; color:#e94560; font-weight:600; }',
            '.tt-upload-zone { border:2px dashed #333; border-radius:10px; padding:24px 16px; text-align:center; cursor:pointer; transition:.2s; margin-bottom:10px; }',
            '.tt-upload-zone:hover, .tt-upload-zone.dragover { border-color:#e94560; background:rgba(233,69,96,.05); }',
            '.tt-upload-zone .tt-icon { font-size:32px; margin-bottom:6px; }',
            '.tt-upload-zone p { font-size:12px; color:#aaa; }',
            '.tt-upload-zone input { display:none; }',
            '.tt-canvas-wrapper { position:relative; display:inline-block; overflow:auto; max-width:100%; max-height:100%; }',
            '.tt-canvas-wrapper canvas { display:block; }',
            '.tt-canvas-hint { position:absolute; top:0; left:0; right:0; padding:4px 10px; background:rgba(0,0,0,0.7); color:#aaa; font-size:10px; text-align:center; pointer-events:none; z-index:15; backdrop-filter:blur(4px); }',
            '.tt-overlay-canvas { position:absolute; top:0; left:0; cursor:crosshair; }',
            '.tt-info-bar { position:absolute; bottom:12px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,.7); backdrop-filter:blur(8px); padding:5px 14px; border-radius:20px; font-size:11px; color:#aaa; display:flex; gap:14px; z-index:10; }',
            '.tt-info-bar span { display:flex; align-items:center; gap:4px; }',
            '.tt-info-bar .tt-val { color:#e94560; font-weight:600; }',
            '.tt-checkbox-row { display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer; margin-bottom:7px; }',
            '.tt-checkbox-row input { accent-color:#e94560; }',
            '.tt-color-pick-row { display:flex; align-items:center; gap:8px; }',
            '.tt-color-pick-row input[type="color"] { width:30px; height:26px; border:none; border-radius:4px; cursor:pointer; background:transparent; }',
            '.tt-region-list { max-height:180px; overflow-y:auto; }',
            '.tt-region-item { display:flex; align-items:center; gap:6px; padding:4px 5px; border-radius:4px; font-size:11px; cursor:pointer; transition:.15s; border-left:3px solid transparent; }',
            '.tt-region-item:hover { background:rgba(255,255,255,.06); }',
            '.tt-region-item.selected { background:rgba(233,69,96,.15); border-left-color:#e94560; }',
            '.tt-region-item.inner-checked { background:rgba(0,200,83,.12); border-left-color:#00c853; }',
            '.tt-region-item.inner-checked .tt-info { color:#00c853; font-weight:600; }',
            '.tt-region-item .tt-color-dot { width:12px; height:12px; border-radius:3px; flex-shrink:0; }',
            '.tt-region-item .tt-info { flex:1; color:#aaa; }',
            '.tt-region-item .tt-del { width:18px; height:18px; background:transparent; border:none; color:#aaa; cursor:pointer; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:14px; }',
            '.tt-region-item .tt-del:hover { background:#e94560; color:#fff; }',
            '.tt-region-item .tt-inner-cb { width:16px; height:16px; accent-color:#00c853; cursor:pointer; flex-shrink:0; }',
            '.tt-toast { position:fixed; top:20px; right:20px; background:#0f3460; color:#fff; padding:9px 18px; border-radius:8px; font-size:12px; z-index:99999; transform:translateX(120%); transition:.3s; border-left:3px solid #00c853; pointer-events:none; }',
            '.tt-toast.show { transform:translateX(0); }',
            '.tt-toast.error { border-left-color:#e94560; }',
            '.tt-empty-state { text-align:center; color:#aaa; }',
            '.tt-empty-state .tt-icon { font-size:44px; margin-bottom:10px; opacity:.5; }',
            '.tt-empty-state p { font-size:13px; }',
            '.tt-merge-grid { display:grid; gap:4px; padding:8px; }',
            '.tt-merge-item { position:relative; border-radius:6px; overflow:hidden; background:#1a1a2e; }',
            '.tt-merge-item img { display:block; width:100%; height:100%; object-fit:contain; }',
            '.tt-merge-item .tt-idx { position:absolute; top:2px; left:2px; background:rgba(0,0,0,.6); color:#fff; font-size:10px; padding:1px 5px; border-radius:3px; }',
            '.tt-merge-item .tt-del-btn { position:absolute; top:2px; right:2px; width:18px; height:18px; background:#e94560; color:#fff; border:none; border-radius:50%; font-size:11px; cursor:pointer; display:none; align-items:center; justify-content:center; }',
            '.tt-merge-item:hover .tt-del-btn { display:flex; }',
            '.tt-magnifier { display:none; position:fixed; width:140px; height:140px; border-radius:50%; border:3px solid #e94560; box-shadow:0 4px 20px rgba(0,0,0,.6); pointer-events:none; z-index:99998; overflow:hidden; background:#000; }',
            '.tt-magnifier canvas { display:block; }',
            '.tt-magnifier-cross-h, .tt-magnifier-cross-v { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); background:rgba(255,255,255,.5); pointer-events:none; }',
            '.tt-magnifier-cross-h { width:12px; height:2px; }',
            '.tt-magnifier-cross-v { width:2px; height:12px; }',
            '::-webkit-scrollbar { width:6px; }',
            '::-webkit-scrollbar-track { background:transparent; }',
            '::-webkit-scrollbar-thumb { background:#333; border-radius:3px; }',
            '.tt-sub-tabs{display:flex;gap:4px;margin-bottom:8px;}',
            '.tt-sub-tab{flex:1;padding:5px 8px;border-radius:4px;border:1px solid #1a3a6a;background:#0f3460;color:#aaa;font-size:12px;cursor:pointer;text-align:center;}',
            '.tt-sub-tab:hover{border-color:#e94560;color:#e94560;}',
            '.tt-sub-tab.active{background:#e94560;border-color:#e94560;color:#fff;}'
        ].join('\n');
    },

    // ========================================
    //   创建弹出窗口
    // ========================================

    _createOverlay: function() {
        var self = this;

        // Create overlay container - position:fixed, centered in viewport
        var overlay = document.createElement('div');
        overlay.className = 'tt-overlay';
        overlay.id = 'tt-card';
        overlay.setAttribute('data-skill-id', 'tile-tool');
        overlay.style.left = Math.max(20, (window.innerWidth - 900) / 2) + 'px';
        overlay.style.top = Math.max(20, (window.innerHeight - 600) / 2) + 'px';

        // 恢复上次窗口大小和位置
        var savedSize = null;
        try { savedSize = JSON.parse(localStorage.getItem('tt-window-size')); } catch(e) {}
        if (savedSize && savedSize.w && savedSize.h) {
            overlay.style.width = savedSize.w + 'px';
            overlay.style.height = savedSize.h + 'px';
            if (savedSize.l !== undefined) overlay.style.left = savedSize.l + 'px';
            if (savedSize.t !== undefined) overlay.style.top = savedSize.t + 'px';
        }

        // Inject styles
        var styleEl = document.createElement('style');
        styleEl.textContent = this._getCSS();
        overlay.appendChild(styleEl);

        // Header
        var header = document.createElement('div');
        header.className = 'tt-header';
        header.innerHTML =
            '<h1>扣图</h1>' +
            '<div style="display:flex;align-items:center;">' +
                '<div class="tt-mode-tabs">' +
                    '<button class="tt-mode-tab active" data-mode="split">合久必分</button>' +
                    '<button class="tt-mode-tab" data-mode="merge">分久必合</button>' +
                '</div>' +
                '<button class="tt-close-btn" data-action="close">关</button>' +
            '</div>';
        overlay.appendChild(header);

        // App container
        var app = document.createElement('div');
        app.className = 'tt-app';

        // Sidebar
        var sidebar = document.createElement('div');
        sidebar.className = 'tt-sidebar';
        sidebar.innerHTML = this._buildSidebarHTML();
        app.appendChild(sidebar);

        // Main area
        var main = document.createElement('div');
        main.className = 'tt-main';
        main.id = 'ttMainArea';
        main.innerHTML = this._buildMainHTML();
        app.appendChild(main);

        overlay.appendChild(app);

        // Toast
        var toast = document.createElement('div');
        toast.className = 'tt-toast';
        toast.id = 'ttToast';
        overlay.appendChild(toast);

        // Magnifier
        var mag = document.createElement('div');
        mag.className = 'tt-magnifier';
        mag.id = 'ttMagnifier';
        mag.innerHTML =
            '<canvas id="ttMagCanvas" width="140" height="140"></canvas>' +
            '<div class="tt-magnifier-cross-h"></div>' +
            '<div class="tt-magnifier-cross-v"></div>';
        overlay.appendChild(mag);

        // Append to document body (position:fixed, not canvas layer)
        document.body.appendChild(overlay);
        this._overlay = overlay;
        this._toastEl = toast;
        this._magnifierEl = mag;
        this._magCanvas = overlay.querySelector('#ttMagCanvas');
        this._magCtx = this._magCanvas.getContext('2d');

        // Get canvas refs
        this._mainCanvas = overlay.querySelector('#ttMainCanvas');
        this._mainCtx = this._mainCanvas.getContext('2d');
        this._overlayCanvas = overlay.querySelector('#ttOverlayCanvas');
        this._overlayCtx = this._overlayCanvas.getContext('2d');

        // Create brush canvas (on top of overlay, for brush drawing)
        var brushCanvas = document.createElement('canvas');
        brushCanvas.id = 'ttBrushCanvas';
        brushCanvas.className = 'tt-overlay-canvas';
        brushCanvas.style.pointerEvents = 'none';
        overlay.querySelector('.tt-canvas-wrapper').appendChild(brushCanvas);
        this._brushCanvas = brushCanvas;
        this._brushCtx = brushCanvas.getContext('2d');

        // Bind events
        this._bindEvents(overlay);
    },

    _buildSidebarHTML: function() {
        return '' +
        '<!-- SPLIT PANEL -->' +
        '<div class="tt-panel active" id="ttSplitPanel">' +
            '<div class="tt-sub-tabs">' +
                '<button class="tt-sub-tab active" data-split-mode="irregular">异形</button>' +
                '<button class="tt-sub-tab" data-split-mode="grid">方形</button>' +
            '</div>' +
            '<div class="tt-section">' +
                '<div class="tt-step-title"><span class="tt-step-num">1</span> 上传图片</div>' +
                '<div class="tt-upload-zone" id="ttSplitUpload">' +
                    '<div class="tt-icon">📁</div>' +
                    '<p>点击或拖拽上传素材图</p>' +
                    '<p style="font-size:10px;margin-top:3px">支持 PNG / JPG / WebP</p>' +
                    '<input type="file" id="ttSplitFile" accept="image/*">' +
                '</div>' +
            '</div>' +
            '<!-- GRID MODE PANEL -->' +
            '<div id="ttGridPanel" style="display:none">' +
                '<div class="tt-step-title"><span class="tt-step-num">2</span> 方形分割设置</div>' +
                '<div class="tt-grid-row"><label>行数</label><input type="number" id="ttGridRows" value="3" min="1" max="100"></div>' +
                '<div class="tt-grid-row"><label>列数</label><input type="number" id="ttGridCols" value="3" min="1" max="100"></div>' +
                '<div class="tt-grid-row"><label>分割线宽度</label><div class="tt-grid-input-wrap"><input type="number" id="ttGridLineWidth" min="0" max="100" value="1"><span>px</span></div></div>' +
                '<div class="tt-grid-row"><label>边缘轮廓</label><label class="tt-toggle" id="ttGridEdgeToggle"><input type="checkbox" id="ttGridEdge"><span class="tt-toggle-slider"></span></label></div>' +
                '<div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="tt-btn tt-btn-primary" data-action="gridSplit">方形分割</button></div>' +
            '</div>' +
            '<!-- IRREGULAR MODE -->' +
            '<div id="ttIrregularPanel">' +
                '<div class="tt-section">' +
                    '<div class="tt-step-title"><span class="tt-step-num">2</span> 标记背景色/轮廓色 & 异形检测</div>' +
                    '<p style="font-size:11px;color:#aaa;margin-bottom:7px">先标注背景色和轮廓色，再检测</p>' +
                    '<div class="tt-input-group">' +
                        '<label>背景色</label>' +
                        '<div class="tt-color-pick-row">' +
                            '<input type="color" id="irBgColor" value="#ffffff">' +
                            '<span id="irBgColorHex" style="font-size:11px;color:#aaa">#FFFFFF</span>' +
                            '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="irColorPick" data-pick-type="bg" style="margin-left:auto">取色</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="tt-input-group">' +
                        '<label>轮廓色</label>' +
                        '<div class="tt-color-pick-row">' +
                            '<input type="color" id="irOutlineColor" value="#000000">' +
                            '<span id="irOutlineColorHex" style="font-size:11px;color:#aaa">#000000</span>' +
                            '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="irColorPick" data-pick-type="outline" style="margin-left:auto">取色</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="tt-input-group">' +
                        '<label>轮廓色容差</label>' +
                        '<div class="tt-range-row">' +
                            '<input type="range" id="outlineTolerance" min="1" max="100" value="80">' +
                            '<span class="tt-range-val" id="outlineTolVal">80</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="tt-input-group">' +
                        '<label>检测灵敏度</label>' +
                        '<div class="tt-range-row">' +
                            '<input type="range" id="detectSensitivity" min="1" max="100" value="30">' +
                            '<span class="tt-range-val" id="detectSensVal">30</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="tt-input-group">' +
                        '<label>最小区域面积 (px²)</label>' +
                        '<div class="tt-range-row">' +
                            '<input type="range" id="minArea" min="10" max="5000" value="100" step="10">' +
                            '<span class="tt-range-val" id="minAreaVal">100</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="tt-input-group">' +
                        '<label>轮廓外扩 (px)</label>' +
                        '<div class="tt-range-row">' +
                            '<input type="range" id="dilatePx" min="-5" max="10" value="-1">' +
                            '<span class="tt-range-val" id="dilatePxVal">-1</span>' +
                        '</div>' +
                    '</div>' +
                    '<button class="tt-btn tt-btn-primary" data-action="smartDetect" style="width:100%;margin-top:8px">粗略扣图</button>' +
                '</div>' +
                '<div id="ttIrregularSteps">' +
                '<div class="tt-section">' +
                    '<div class="tt-step-title"><span class="tt-step-num">3</span> 选择内扣图素材</div>' +
                    '<div class="tt-btn-group" style="margin-bottom:5px">' +
                        '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="selectAllRegions" data-select="true">全选</button>' +
                        '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="selectAllRegions" data-select="false">全不选</button>' +
                        '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="invertRegionSelection">反选</button>' +
                    '</div>' +
                    '<div class="tt-region-list" id="ttRegionList">' +
                        '<p style="font-size:11px;color:#aaa;text-align:center;padding:10px 0">点击上方按钮开始检测</p>' +
                    '</div>' +
                    '<div class="tt-btn-group" style="margin-top:7px">' +
                        '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="clearAllRegions">清空</button>' +
                        '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="undoLastRegion">撤销</button>' +
                    '</div>' +
                '</div>' +
                '<div class="tt-section" id="ttInnerBgSection">' +
                    '<div class="tt-step-title"><span class="tt-step-num">4</span> 内扣设置 & 去除内部背景</div>' +
                    '<div class="tt-input-group">' +
                        '<label>内部背景色</label>' +
                        '<div class="tt-color-pick-row">' +
                            '<input type="color" id="innerBgColor" value="#ffffff">' +
                            '<span id="innerBgColorHex" style="font-size:11px;color:#aaa">#FFFFFF</span>' +
                            '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="irColorPick" data-pick-type="innerBg" style="margin-left:auto">取色</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="tt-input-group">' +
                        '<label>内部轮廓色（可选）</label>' +
                        '<div class="tt-color-pick-row">' +
                            '<input type="color" id="innerOutlineColor" value="#000000">' +
                            '<span id="innerOutlineColorHex" style="font-size:11px;color:#aaa">#000000</span>' +
                            '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="irColorPick" data-pick-type="innerOutline" style="margin-left:auto">取色</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="tt-input-group">' +
                        '<label>内部容差</label>' +
                        '<div class="tt-range-row">' +
                            '<input type="range" id="innerTolerance" min="1" max="100" value="50">' +
                            '<span class="tt-range-val" id="innerTolVal">50</span>' +
                        '</div>' +
                    '</div>' +
                    '<div class="tt-input-group">' +
                        '<label>内扣轮廓外扩 (px)</label>' +
                        '<div class="tt-range-row">' +
                            '<input type="range" id="innerDilatePx" min="-5" max="10" value="-1">' +
                            '<span class="tt-range-val" id="innerDilatePxVal">-1</span>' +
                        '</div>' +
                    '</div>' +
                    '<button class="tt-btn tt-btn-primary" data-action="applyInnerBgRemove" style="width:100%;margin-top:8px">精致扣图</button>' +
                '</div>' +
                '<div class="tt-section" id="ttRestoreSection">' +
                    '<div class="tt-step-title"><span class="tt-step-num">5</span> 套索框选 / 恢复误扣</div>' +
                    '<div style="font-size:11px;color:#aaa;margin-bottom:5px">用套索圈出不要内扣的区域，点击确认恢复像素</div>' +
                    '<div class="tt-btn-group" style="margin-bottom:5px;flex-wrap:wrap;gap:4px">' +
                        '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="lassoMode" data-lasso="lasso">套索</button>' +
                        '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="lassoMode" data-lasso="eraser">擦除</button>' +
                        '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="clearLasso">清除</button>' +
                    '</div>' +
                    '<button class="tt-btn tt-btn-primary tt-btn-sm" data-action="applyRestore" style="width:100%">确认恢复</button>' +
                '</div>' +
                '</div>' +
            '</div>' +
            '<!-- COMMON OUTPUT -->' +
            '<div class="tt-section">' +
                '<div class="tt-step-title"><span class="tt-step-num">6</span> 输出 & 下载</div>' +
                '<div class="tt-input-group">' +
                    '<label>输出格式</label>' +
                    '<select id="splitFormat" style="width:100%;padding:5px;background:#1a1a2e;border:1px solid #333;border-radius:4px;color:#eee">' +
                        '<option value="png">PNG (无损，推荐异形)</option>' +
                        '<option value="webp">WebP</option>' +
                    '</select>' +
                '</div>' +
                '<label class="tt-checkbox-row">' +
                    '<input type="checkbox" id="trimTransparent" checked>' +
                    '裁剪透明边缘' +
                '</label>' +
                '<div class="tt-btn-group" style="flex-wrap:wrap;gap:4px;margin-top:8px">' +
                    '<button class="tt-btn tt-btn-success" data-action="splitAndDownload" id="ttSplitBtn" disabled>拆分下载</button>' +
                    '<button class="tt-btn tt-btn-primary" data-action="pushToMerge" id="ttPushMergeBtn" disabled>推送合并</button>' +
                '</div>' +
            '</div>' +
        '</div>' +
        '<!-- MERGE PANEL -->' +
        '<div class="tt-panel" id="ttMergePanel">' +
            '<div class="tt-section">' +
                '<div class="tt-section-title">上传素材</div>' +
                '<div class="tt-upload-zone" id="ttMergeUpload">' +
                    '<div class="tt-icon">📁</div>' +
                    '<p>点击或拖拽上传多张素材</p>' +
                    '<p style="font-size:10px;margin-top:3px">支持多选 PNG / JPG / WebP</p>' +
                    '<input type="file" id="ttMergeFiles" accept="image/*" multiple>' +
                '</div>' +
                '<p id="ttMergeCount" style="font-size:11px;color:#aaa;text-align:center"></p>' +
            '</div>' +
            '<div class="tt-section">' +
                '<div class="tt-section-title">排列设置</div>' +
                '<div class="tt-input-group">' +
                    '<label>每行列数</label>' +
                    '<div class="tt-range-row">' +
                        '<input type="range" id="mergeCols" min="1" max="20" value="4">' +
                        '<span class="tt-range-val" id="mergeColsVal">4</span>' +
                    '</div>' +
                '</div>' +
                '<div class="tt-input-group">' +
                    '<label>水平间距 (px)</label>' +
                    '<div class="tt-range-row">' +
                        '<input type="range" id="mergePadX" min="0" max="32" value="0">' +
                        '<span class="tt-range-val" id="mergePadXVal">0</span>' +
                    '</div>' +
                '</div>' +
                '<div class="tt-input-group">' +
                    '<label>垂直间距 (px)</label>' +
                    '<div class="tt-range-row">' +
                        '<input type="range" id="mergePadY" min="0" max="32" value="0">' +
                        '<span class="tt-range-val" id="mergePadYVal">0</span>' +
                    '</div>' +
                '</div>' +
                '<div class="tt-input-group">' +
                    '<label>内边距 (px)</label>' +
                    '<div class="tt-range-row">' +
                        '<input type="range" id="mergePadding" min="0" max="64" value="0">' +
                        '<span class="tt-range-val" id="mergePaddingVal">0</span>' +
                    '</div>' +
                '</div>' +
                '<label class="tt-checkbox-row">' +
                    '<input type="checkbox" id="mergeUniform" checked>' +
                    '统一单元格大小 (以最大为准)' +
                '</label>' +
                '<label class="tt-checkbox-row">' +
                    '<input type="checkbox" id="mergeBgTransparent" checked>' +
                    '背景透明' +
                '</label>' +
                '<div class="tt-input-group" id="ttMergeBgColorGroup" style="display:none">' +
                    '<label>背景颜色</label>' +
                    '<input type="color" id="mergeBgColor" value="#000000">' +
                '</div>' +
            '</div>' +
            '<div class="tt-section">' +
                '<div class="tt-section-title">输出设置</div>' +
                '<div class="tt-input-group">' +
                    '<label>输出格式</label>' +
                    '<select id="mergeFormat" style="width:100%;padding:5px;background:#1a1a2e;border:1px solid #333;border-radius:4px;color:#eee">' +
                        '<option value="png">PNG (无损)</option>' +
                        '<option value="webp">WebP (推荐)</option>' +
                    '</select>' +
                '</div>' +
                '<div class="tt-btn-group" style="margin-top:7px">' +
                    '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="sortMerge" data-sort-by="name">🔤 按名称</button>' +
                    '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="sortMerge" data-sort-by="size">📐 按尺寸</button>' +
                '</div>' +
                '<div class="tt-btn-group" style="margin-top:5px">' +
                    '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="clearMergeItems">🗑️ 清空</button>' +
                    '<button class="tt-btn tt-btn-secondary tt-btn-sm" data-action="appendMerge">➕ 追加</button>' +
                '</div>' +
            '</div>' +
            '<div class="tt-section">' +
                '<button class="tt-btn tt-btn-success" data-action="mergeAndDownload" id="ttMergeBtn" disabled>🔗 合并并下载</button>' +
            '</div>' +
        '</div>';
    },

    _buildMainHTML: function() {
        return '' +
        '<div id="ttSplitView" style="display:flex;flex-direction:column;align-items:center;justify-content:center;width:100%;height:100%;position:relative">' +
            '<div class="tt-canvas-hint" id="ttCanvasHint" style="display:none">右键拖拽：平移画布 &nbsp;|&nbsp; 滚轮：缩放</div>' +
            '<div class="tt-empty-state" id="ttSplitEmpty">' +
                '<div class="tt-icon">🖼️</div>' +
                '<p>上传一张游戏素材图开始拆分</p>' +
            '</div>' +
            '<div class="tt-canvas-wrapper" id="ttCanvasWrapper" style="display:none">' +
                '<canvas id="ttMainCanvas"></canvas>' +
                '<canvas id="ttOverlayCanvas" class="tt-overlay-canvas"></canvas>' +
            '</div>' +
        '</div>' +
        '<div id="ttMergeView" style="display:none;width:100%;height:100%;overflow:auto;padding:20px">' +
            '<div class="tt-empty-state" id="ttMergeEmpty">' +
                '<div class="tt-icon">🔗</div>' +
                '<p>上传多张素材图进行合并</p>' +
            '</div>' +
            '<div id="ttMergePreviewContainer" style="display:none;max-width:900px;margin:0 auto">' +
                '<div class="tt-merge-grid" id="ttMergeGrid"></div>' +
            '</div>' +
            '<div id="ttMergeResultContainer" style="display:none;text-align:center;margin-top:16px">' +
                '<canvas id="ttMergeResultCanvas" style="max-width:100%;border:1px solid #333;border-radius:8px"></canvas>' +
            '</div>' +
        '</div>' +
        '<div class="tt-info-bar" id="ttInfoBar" style="display:none">' +
            '<span>尺寸: <span class="tt-val" id="ttInfoSize">-</span></span>' +
            '<span id="ttInfoBoxLabel">选框: <span class="tt-val" id="ttInfoBoxes">0</span></span>' +
            '<span>缩放: <span class="tt-val" id="ttInfoZoom">100%</span></span>' +
        '</div>';
    },

    // ========================================
    //   事件绑定
    // ========================================

    _bindEvents: function(overlay) {
        var self = this;

        // Stop propagation for all mousedown/wheel inside overlay
        overlay.addEventListener('mousedown', function(e) {
            e.stopPropagation();
        });
        overlay.addEventListener('wheel', function(e) {
            e.stopPropagation();
        }, { passive: false });

        // ESC 关闭
        this._onKeyDown = function(e) {
            if (e.key === 'Escape') {
                self._destroy();
                if (typeof SkillSystem !== 'undefined') SkillSystem.deactivate();
            }
        };
        document.addEventListener('keydown', this._onKeyDown);

        // 页面刷新/关闭前保存窗口大小
        this._onBeforeUnload = function() {
            if (self._overlay && self._overlay.parentNode) {
                try { self._saveWindowSize(); } catch(e) {}
            }
        };
        window.addEventListener('beforeunload', this._onBeforeUnload);

        // 标题栏拖拽（position:fixed，直接用 clientX/clientY）
        var header = overlay.querySelector('.tt-header');
        var isDragging = false, dragStartX, dragStartY, origLeft, origTop;

        this._onHeaderDown = function(e) {
            if (e.target.closest('button, input, select, textarea')) return;
            if (e.button !== 0) return;
            // 只响应 header 区域的拖拽
            if (!e.target.closest('.tt-header')) return;
            e.stopPropagation();
            e.preventDefault();
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            origLeft = parseInt(overlay.style.left) || 0;
            origTop = parseInt(overlay.style.top) || 0;
            header.style.cursor = 'grabbing';
        };
        document.addEventListener('mousedown', this._onHeaderDown, true);

        this._onDocMouseMove = function(e) {
            if (!isDragging) return;
            var dx = e.clientX - dragStartX;
            var dy = e.clientY - dragStartY;
            var newLeft = origLeft + dx;
            var newTop = origTop + dy;
            // Keep within viewport bounds
            newLeft = Math.max(0, Math.min(window.innerWidth - 100, newLeft));
            newTop = Math.max(0, Math.min(window.innerHeight - 40, newTop));
            overlay.style.left = newLeft + 'px';
            overlay.style.top = newTop + 'px';
        };
        document.addEventListener('mousemove', this._onDocMouseMove);

        this._onDocMouseUp = function() {
            if (isDragging) {
                isDragging = false;
                header.style.cursor = 'move';
            }
        };
        document.addEventListener('mouseup', this._onDocMouseUp);

        // ResizeObserver: 监听 resize:both 大小变化，重绘 canvas
        this._resizeObserver = new ResizeObserver(function(entries) {
            for (var i = 0; i < entries.length; i++) {
                if (entries[i].target === overlay) {
                    self._onOverlayResize();
                    break;
                }
            }
        });
        this._resizeObserver.observe(overlay);

        // Close button
        overlay.querySelector('[data-action="close"]').addEventListener('click', function() {
            self._destroy();
            if (typeof SkillSystem !== 'undefined') {
                SkillSystem.deactivate();
            }
        });

        // Mode tabs
        overlay.querySelectorAll('.tt-mode-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                self._switchMode(this.getAttribute('data-mode'));
            });
        });

        // Split sub-mode tabs (irregular / grid)
        overlay.querySelectorAll('.tt-sub-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                var mode = this.getAttribute('data-split-mode');
                self.state.splitMode = mode;
                overlay.querySelectorAll('.tt-sub-tab').forEach(function(t) {
                    t.classList.toggle('active', t.getAttribute('data-split-mode') === mode);
                });
                var gridPanel = overlay.querySelector('#ttGridPanel');
                var irregularPanel = overlay.querySelector('#ttIrregularPanel');
                var irregularSteps = overlay.querySelector('#ttIrregularSteps');
                if (mode === 'grid') {
                    if (gridPanel) gridPanel.style.display = 'block';
                    if (irregularPanel) irregularPanel.style.display = 'none';
                    if (irregularSteps) irregularSteps.style.display = 'none';
                } else {
                    if (gridPanel) gridPanel.style.display = 'none';
                    if (irregularPanel) irregularPanel.style.display = 'block';
                    if (irregularSteps) irregularSteps.style.display = 'block';
                }
            });
        });

        // Split file upload
        var splitFileInput = overlay.querySelector('#ttSplitFile');
        var splitUploadZone = overlay.querySelector('#ttSplitUpload');
        splitUploadZone.addEventListener('click', function() { splitFileInput.click(); });
        splitFileInput.addEventListener('change', function(e) {
            if (e.target.files[0]) self._loadSplitImage(e.target.files[0]);
        });
        splitUploadZone.addEventListener('dragover', function(e) {
            e.preventDefault(); e.stopPropagation();
            splitUploadZone.classList.add('dragover');
        });
        splitUploadZone.addEventListener('dragleave', function(e) {
            e.stopPropagation();
            splitUploadZone.classList.remove('dragover');
        });
        splitUploadZone.addEventListener('drop', function(e) {
            e.preventDefault(); e.stopPropagation();
            splitUploadZone.classList.remove('dragover');
            if (e.dataTransfer.files[0]) self._loadSplitImage(e.dataTransfer.files[0]);
        });

        // Range inputs - update display values
        var rangePairs = [
            ['outlineTolerance', 'outlineTolVal'],
            ['detectSensitivity', 'detectSensVal'],
            ['minArea', 'minAreaVal'],
            ['dilatePx', 'dilatePxVal'],
            ['innerTolerance', 'innerTolVal'],
            ['innerDilatePx', 'innerDilatePxVal'],
            ['mergeCols', 'mergeColsVal'],
            ['mergePadX', 'mergePadXVal'],
            ['mergePadY', 'mergePadYVal'],
            ['mergePadding', 'mergePaddingVal']
        ];
        rangePairs.forEach(function(pair) {
            var range = overlay.querySelector('#' + pair[0]);
            var val = overlay.querySelector('#' + pair[1]);
            if (range && val) {
                range.addEventListener('input', function() {
                    val.textContent = this.value;
                    if (pair[0] === 'mergeCols' || pair[0] === 'mergePadX' || pair[0] === 'mergePadY' || pair[0] === 'mergePadding') {
                        self._updateMergePreview();
                    }
                });
            }
        });

        // Merge bg transparent toggle
        overlay.querySelector('#mergeBgTransparent').addEventListener('change', function() {
            overlay.querySelector('#ttMergeBgColorGroup').style.display = this.checked ? 'none' : 'block';
            self._updateMergePreview();
        });

        // Merge uniform toggle
        overlay.querySelector('#mergeUniform').addEventListener('change', function() {
            self._updateMergePreview();
        });

        // Merge bg color change
        overlay.querySelector('#mergeBgColor').addEventListener('input', function() {
            self._updateMergePreview();
        });

        // Action buttons (delegated)
        overlay.addEventListener('click', function(e) {
            var btn = e.target.closest('[data-action]');
            if (!btn) return;
            var action = btn.getAttribute('data-action');
            switch (action) {
                case 'irColorPick':
                    self._enableIrColorPick(btn.getAttribute('data-pick-type'));
                    break;
                case 'smartDetect': self._smartDetectIrregular(); break;
                case 'gridSplit': self._doGridSplit(); break;
                case 'applyInnerBgRemove': self._applyInnerBgRemove(); break;
                case 'selectAllRegions':
                    var selectAll = btn.getAttribute('data-select') === 'true';
                    self._selectAllRegions(selectAll);
                    self._showToast(selectAll ? '已全选' : '已取消全选');
                    break;
                case 'invertRegionSelection':
                    self._invertRegionSelection();
                    self._showToast('已反选');
                    break;
                case 'clearAllRegions':
                    self._clearAllRegions();
                    self._showToast('已清空区域');
                    break;
                case 'undoLastRegion':
                    self._undoLastRegion();
                    self._showToast('已撤销');
                    break;
                case 'splitAndDownload':
                    if (self.state.splitMode === 'grid') self._gridSplitAndDownload();
                    else self._splitAndDownload();
                    break;
                case 'pushToMerge':
                    if (self.state.splitMode === 'grid') self._gridPushToMerge();
                    else self._pushToMerge();
                    break;
                case 'sortMerge': self._sortMergeItems(btn.getAttribute('data-sort-by')); break;
                case 'clearMergeItems': self._clearMergeItems(); break;
                case 'appendMerge':
                    overlay.querySelector('#ttMergeFiles').click();
                    break;
                case 'mergeAndDownload': self._mergeAndDownload(); break;
                case 'lassoMode':
                    var mode = btn.getAttribute('data-lasso');
                    if (self.state.lassoMode === mode) {
                        self.state.lassoMode = null;
                        self._overlayCanvas.style.cursor = 'pointer';
                        self._showToast('已退出' + (mode === 'lasso' ? '套索' : '擦除') + '模式');
                    } else {
                        self.state.lassoMode = mode;
                        self._overlayCanvas.style.cursor = 'crosshair';
                        self._showToast('已进入' + (mode === 'lasso' ? '套索' : '擦除') + '模式');
                    }
                    overlay.querySelectorAll('[data-action="lassoMode"]').forEach(function(b) {
                        b.classList.toggle('tt-btn-primary', b.getAttribute('data-lasso') === self.state.lassoMode);
                    });
                    break;
                case 'clearLasso':
                    self.state.lassoRegions = [];
                    self.state.lassoPoints = [];
                    if (self._brushCanvas) self._brushCtx.clearRect(0, 0, self._brushCanvas.width, self._brushCanvas.height);
                    self._showToast('套索已清除');
                    break;
                case 'applyRestore':
                    self._applyRestore();
                    break;
            }
        });

        // Merge file upload
        var mergeFileInput = overlay.querySelector('#ttMergeFiles');
        var mergeUploadZone = overlay.querySelector('#ttMergeUpload');
        mergeUploadZone.addEventListener('click', function() { mergeFileInput.click(); });
        mergeFileInput.addEventListener('change', function(e) {
            if (e.target.files.length > 0) self._handleMergeFiles(e.target.files);
        });
        mergeUploadZone.addEventListener('dragover', function(e) {
            e.preventDefault(); e.stopPropagation();
            mergeUploadZone.classList.add('dragover');
        });
        mergeUploadZone.addEventListener('dragleave', function(e) {
            e.stopPropagation();
            mergeUploadZone.classList.remove('dragover');
        });
        mergeUploadZone.addEventListener('drop', function(e) {
            e.preventDefault(); e.stopPropagation();
            mergeUploadZone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) self._handleMergeFiles(e.dataTransfer.files);
        });

        // 右侧区域拖拽上传
        var splitView = overlay.querySelector('#ttSplitView');
        var mergeView = overlay.querySelector('#ttMergeView');

        // Overlay canvas events
        this._overlayCanvas.addEventListener('mousedown', function(e) { self._onOverlayMouseDown(e); });
        this._overlayCanvas.addEventListener('mousemove', function(e) { self._onOverlayMouseMove(e); });
        this._overlayCanvas.addEventListener('mouseup', function(e) { self._onOverlayMouseUp(e); });
        this._overlayCanvas.addEventListener('contextmenu', function(e) { e.preventDefault(); });
        this._overlayCanvas.addEventListener('mouseleave', function(e) {
            self._hideMagnifier();
            if (self.state.dragging) { self.state.dragging = false; self.state.dragType = null; }
            if (self.state.canvasPanning) { self.state.canvasPanning = false; }
        });

        // 滚轮缩放图片（以鼠标为中心）
        this._overlayCanvas.addEventListener('wheel', function(e) {
            if (!self.state.originalImage) return;
            e.preventDefault();
            e.stopPropagation();

            var delta = e.deltaY > 0 ? -1 : 1;
            var factor = delta > 0 ? 1.15 : 1 / 1.15;
            var oldScale = self.state.scale;
            var newScale = Math.max(0.1, Math.min(4, oldScale * factor));
            if (newScale === oldScale) return;

            var wrapper = self._q('#ttCanvasWrapper');
            var wrapperRect = wrapper.getBoundingClientRect();

            // 鼠标在 wrapper 内容区中的位置（含滚动偏移）
            var mouseInWrapperX = e.clientX - wrapperRect.left + wrapper.scrollLeft;
            var mouseInWrapperY = e.clientY - wrapperRect.top + wrapper.scrollTop;

            // 鼠标指向的原图坐标
            var imgX = mouseInWrapperX / oldScale;
            var imgY = mouseInWrapperY / oldScale;

            // 更新 scale 和 canvas 尺寸
            self.state.scale = newScale;
            var img = self.state.originalImage;
            self._mainCanvas.width = Math.round(img.width * newScale);
            self._mainCanvas.height = Math.round(img.height * newScale);
            self._overlayCanvas.width = self._mainCanvas.width;
            self._overlayCanvas.height = self._mainCanvas.height;

            // Sync brush canvas (redraw lasso regions at new scale)
            if (self._brushCanvas) {
                self._brushCanvas.width = self._mainCanvas.width;
                self._brushCanvas.height = self._mainCanvas.height;
                self._redrawLassoRegions();
            }

            self._drawMain();
            self._drawOverlay();

            // 缩放后，原图坐标在 canvas 上的新位置
            var newCanvasX = imgX * newScale;
            var newCanvasY = imgY * newScale;

            // 调整滚动，使该位置仍在鼠标下方
            wrapper.scrollLeft = newCanvasX - (e.clientX - wrapperRect.left);
            wrapper.scrollTop = newCanvasY - (e.clientY - wrapperRect.top);

            self._q('#ttInfoZoom').textContent = Math.round(newScale * 100) + '%';
        }, { passive: false });

        // Keyboard events
        this._onKeyDown = function(e) {
            self._handleKeyDown(e);
        };
        document.addEventListener('keydown', this._onKeyDown);

        // Paste support (Ctrl+V paste image)
        this._onPaste = function(e) {
            var items = e.clipboardData && e.clipboardData.items;
            if (!items) return;
            for (var i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image/') === 0) {
                    var file = items[i].getAsFile();
                    if (self.state.mode === 'split') {
                        self._loadSplitImage(file);
                    } else {
                        self._handleMergeFiles([file]);
                    }
                    break;
                }
            }
        };
        document.addEventListener('paste', this._onPaste);
    },

    // ========================================
    //   ResizeObserver 回调
    // ========================================

    _onOverlayResize: function() {
        if (this.state.originalImage && this.state.mode === 'split') {
            this._fitImageToView(this.state.originalImage);
            this._drawMain();
            this._drawOverlay();
        }
    },

    // ========================================
    //   工具函数
    // ========================================

    _showToast: function(msg, isError) {
        var t = this._toastEl;
        if (!t) return;
        t.textContent = msg;
        t.className = 'tt-toast' + (isError ? ' error' : '');
        setTimeout(function() { t.classList.add('show'); }, 10);
        setTimeout(function() { t.classList.remove('show'); }, 2500);
    },

    _hexToRgb: function(hex) {
        return {
            r: parseInt(hex.slice(1, 3), 16),
            g: parseInt(hex.slice(3, 5), 16),
            b: parseInt(hex.slice(5, 7), 16)
        };
    },

    _rgbToHex: function(r, g, b) {
        return '#' + [r, g, b].map(function(v) { return v.toString(16).padStart(2, '0'); }).join('');
    },

    _q: function(sel) {
        return this._overlay ? this._overlay.querySelector(sel) : null;
    },

    // ========================================
    //   模式切换
    // ========================================

    _switchMode: function(mode) {
        this.state.mode = mode;
        var self = this;
        this._overlay.querySelectorAll('.tt-mode-tab').forEach(function(t) {
            t.classList.toggle('active', t.getAttribute('data-mode') === mode);
        });
        this._overlay.querySelectorAll('.tt-panel').forEach(function(p) { p.classList.remove('active'); });
        this._overlay.querySelector('#tt' + mode.charAt(0).toUpperCase() + mode.slice(1) + 'Panel').classList.add('active');
        this._overlay.querySelector('#ttSplitView').style.display = mode === 'split' ? 'flex' : 'none';
        this._overlay.querySelector('#ttMergeView').style.display = mode === 'merge' ? 'block' : 'none';
        this._overlay.querySelector('#ttInfoBar').style.display = (mode === 'split' && this.state.originalImage) ? 'flex' : 'none';
    },

    // ========================================
    //   图片加载
    // ========================================

    _loadSplitImage: function(file) {
        var self = this;
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                self.state.originalImage = img;
                self.state.processedImageData = null;
                self.state.regions = [];
                self.state.selectedRegion = -1;
                self.state.innerSelectedRegions = {};
                self._gridColLines = null;
                self._gridRowLines = null;
                self._gridRegions = null;
                self._fitImageToView(img);
                self._drawMain();
                self._drawOverlay();
                self._updateRegionListUI();
                self._q('#ttSplitEmpty').style.display = 'none';
                self._q('#ttCanvasWrapper').style.display = 'inline-block';
                self._q('#ttCanvasHint').style.display = 'block';
                // 3秒后自动隐藏提示
                setTimeout(function() {
                    var hint = self._q('#ttCanvasHint');
                    if (hint) hint.style.display = 'none';
                }, 3000);
                self._q('#ttInfoBar').style.display = 'flex';
                self._q('#ttInfoSize').textContent = img.width + ' \u00d7 ' + img.height;
                self._q('#ttSplitBtn').disabled = false;
                self._q('#ttPushMergeBtn').disabled = false;
                self._q('#ttSplitFile').value = '';
                self._showToast('图片加载成功 (' + img.width + '\u00d7' + img.height + ')');
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    _fitImageToView: function(img) {
        var area = this._q('#ttMainArea');
        var maxW = area.clientWidth - 60;
        var maxH = area.clientHeight - 80;
        var scale = Math.min(1, maxW / img.width, maxH / img.height);
        this.state.scale = scale;
        this._mainCanvas.width = Math.round(img.width * scale);
        this._mainCanvas.height = Math.round(img.height * scale);
        this._overlayCanvas.width = this._mainCanvas.width;
        this._overlayCanvas.height = this._mainCanvas.height;
        // Sync brush canvas
        if (this._brushCanvas) {
            this._brushCanvas.width = this._mainCanvas.width;
            this._brushCanvas.height = this._mainCanvas.height;
            this._redrawLassoRegions();
        }
        this._q('#ttInfoZoom').textContent = Math.round(scale * 100) + '%';
    },

    _drawMain: function() {
        var img = this.state.originalImage;
        if (!img) return;
        this._mainCtx.clearRect(0, 0, this._mainCanvas.width, this._mainCanvas.height);
        if (this.state.processedImageData) {
            var tmpC = document.createElement('canvas');
            tmpC.width = img.width;
            tmpC.height = img.height;
            tmpC.getContext('2d').putImageData(this.state.processedImageData, 0, 0);
            this._mainCtx.drawImage(tmpC, 0, 0, this._mainCanvas.width, this._mainCanvas.height);
        } else {
            this._mainCtx.drawImage(img, 0, 0, this._mainCanvas.width, this._mainCanvas.height);
        }
    },

    // ========================================
    //   覆盖层绘制
    // ========================================

    _drawOverlay: function() {
        this._overlayCtx.clearRect(0, 0, this._overlayCanvas.width, this._overlayCanvas.height);
        if (this.state.splitMode === 'grid') {
            this._drawGridOverlay();
        } else {
            this._drawIrregularOverlay();
        }
        var el = this._q('#ttInfoBoxes');
        if (el) el.textContent = this.state.splitMode === 'grid' ? (this._gridRegions ? this._gridRegions.length : 0) : this.state.regions.length;
    },

    _drawGridOverlay: function() {
        if (!this._gridColLines && !this._gridRowLines) return;
        var ctx = this._overlayCtx;
        var scale = this.state.scale;
        var lw = Math.max(1, (this._gridLineWidth || 0) * scale);
        var cw = this._mainCanvas.width, ch = this._mainCanvas.height;
        ctx.clearRect(0, 0, cw, ch);

        // 列分割线
        var self = this;
        if (this._gridColLines) this._gridColLines.forEach(function(ox, i) {
            var x = Math.round(ox * scale);
            var isHover = self.state.gridLineDragging && self.state.gridLineType === 'col' && self.state.gridLineIndex === i;
            ctx.strokeStyle = isHover ? '#ffab00' : 'rgba(233, 69, 96, 0.8)';
            ctx.lineWidth = isHover ? lw + 2 : lw;
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ch); ctx.stroke();
        });

        // 行分割线
        if (this._gridRowLines) this._gridRowLines.forEach(function(oy, i) {
            var y = Math.round(oy * scale);
            var isHover = self.state.gridLineDragging && self.state.gridLineType === 'row' && self.state.gridLineIndex === i;
            ctx.strokeStyle = isHover ? '#ffab00' : 'rgba(233, 69, 96, 0.8)';
            ctx.lineWidth = isHover ? lw + 2 : lw;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(cw, y); ctx.stroke();
        });

        // 边框
        if (this._gridHasEdge) {
            ctx.strokeStyle = 'rgba(233, 69, 96, 0.8)';
            ctx.lineWidth = lw;
            ctx.strokeRect(0, 0, cw, ch);
        }

        // 绘制区域编号标签
        if (this._gridRegions) {
            this._gridRegions.forEach(function(region, i) {
                var color = self.REGION_COLORS[i % self.REGION_COLORS.length];
                ctx.fillStyle = color;
                var label = 'R' + region.row + 'C' + region.col;
                ctx.font = '10px sans-serif';
                var tw = ctx.measureText(label).width;
                ctx.fillRect(region.x + 2, region.y + 2, tw + 6, 14);
                ctx.fillStyle = '#fff';
                ctx.fillText(label, region.x + 4, region.y + 13);
            });
        }
    },

    _drawIrregularOverlay: function() {
        var regions = this.state.regions;
        if (regions.length === 0) return;
        var img = this.state.originalImage;
        var w = img.width, h = img.height;
        var s = this.state.scale;
        var ctx = this._overlayCtx;
        var self = this;

        var offC = document.createElement('canvas');
        offC.width = w; offC.height = h;
        var offCtx = offC.getContext('2d');
        var imgData = offCtx.createImageData(w, h);
        var d = imgData.data;

        regions.forEach(function(region, ri) {
            var isSelected = ri === self.state.selectedRegion;
            var isInnerChecked = !!self.state.innerSelectedRegions[ri];
            var color = self._hexToRgb(region.color);
            var alpha = isSelected ? 100 : isInnerChecked ? 80 : 40;

            var pixelSet = new Uint8Array(w * h);
            region.pixels.forEach(function(p) {
                pixelSet[p[1] * w + p[0]] = 1;
            });

            region.pixels.forEach(function(p) {
                var idx = (p[1] * w + p[0]) * 4;
                d[idx] = color.r;
                d[idx + 1] = color.g;
                d[idx + 2] = color.b;
                d[idx + 3] = alpha;
            });

            region.pixels.forEach(function(p) {
                var isEdge = false;
                for (var dy = -1; dy <= 1 && !isEdge; dy++) {
                    for (var dx = -1; dx <= 1 && !isEdge; dx++) {
                        if (dx === 0 && dy === 0) continue;
                        var nx = p[0] + dx, ny = p[1] + dy;
                        if (nx < 0 || nx >= w || ny < 0 || ny >= h || !pixelSet[ny * w + nx]) {
                            isEdge = true;
                        }
                    }
                }
                if (isEdge) {
                    var idx = (p[1] * w + p[0]) * 4;
                    if (isInnerChecked) {
                        d[idx] = 0; d[idx + 1] = 200; d[idx + 2] = 83; d[idx + 3] = 230;
                    } else {
                        d[idx] = isSelected ? 255 : color.r;
                        d[idx + 1] = isSelected ? 255 : color.g;
                        d[idx + 2] = isSelected ? 255 : color.b;
                        d[idx + 3] = isSelected ? 220 : 160;
                    }
                }
            });
        });

        offCtx.putImageData(imgData, 0, 0);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(offC, 0, 0, self._overlayCanvas.width, self._overlayCanvas.height);

        // Bounding box for inner-checked regions
        regions.forEach(function(region, ri) {
            if (!self.state.innerSelectedRegions[ri]) return;
            var b = region.bounds;
            var bx = b.x * s, by = b.y * s, bw = b.w * s, bh = b.h * s;
            ctx.strokeStyle = '#00c853';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([6, 3]);
            ctx.strokeRect(bx - 2, by - 2, bw + 4, bh + 4);
            ctx.setLineDash([]);
            var cm = 8;
            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(bx - 2, by - 2 + cm); ctx.lineTo(bx - 2, by - 2); ctx.lineTo(bx - 2 + cm, by - 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx + bw + 2 - cm, by - 2); ctx.lineTo(bx + bw + 2, by - 2); ctx.lineTo(bx + bw + 2, by - 2 + cm); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx - 2, by + bh + 2 - cm); ctx.lineTo(bx - 2, by + bh + 2); ctx.lineTo(bx - 2 + cm, by + bh + 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(bx + bw + 2 - cm, by + bh + 2); ctx.lineTo(bx + bw + 2, by + bh + 2); ctx.lineTo(bx + bw + 2, by + bh + 2 - cm); ctx.stroke();
            ctx.fillStyle = '#00c853';
            ctx.font = 'bold 12px sans-serif';
            ctx.fillText('\u2713', bx + bw + 5, by + 12);
        });

        // Labels
        regions.forEach(function(region, ri) {
            var isSelected = ri === self.state.selectedRegion;
            var lx = (region.bounds.x + 2) * s;
            var ly = (region.bounds.y - 2) * s;
            ctx.fillStyle = region.color;
            var label = '#' + (ri + 1) + ' (' + region.area + 'px)';
            ctx.font = (isSelected ? 'bold ' : '') + '10px sans-serif';
            var tw = ctx.measureText(label).width;
            ctx.fillRect(lx - 1, ly - 12, tw + 6, 14);
            ctx.fillStyle = '#fff';
            ctx.fillText(label, lx + 2, ly - 1);
        });
    },

    // ========================================
    //   放大镜
    // ========================================

    _showMagnifier: function(e) {
        if (!this.state.originalImage) return;
        this._magnifierEl.style.display = 'block';
        var rect = this._overlayCanvas.getBoundingClientRect();
        // 用 CSS 尺寸和像素尺寸的比值修正坐标
        var cssW = rect.width, cssH = rect.height;
        var pxW = this._overlayCanvas.width, pxH = this._overlayCanvas.height;
        var ratioX = pxW / cssW, ratioY = pxH / cssH;
        var mx = (e.clientX - rect.left) * ratioX, my = (e.clientY - rect.top) * ratioY;
        var s = this.state.scale;
        var ox = Math.floor(mx / s), oy = Math.floor(my / s);
        var img = this.state.originalImage;
        var magCtx = this._magCtx;
        var MAG_SIZE = this.MAG_SIZE;
        var MAG_ZOOM = this.MAG_ZOOM;
        var MAG_RADIUS = Math.floor(MAG_SIZE / MAG_ZOOM / 2);

        magCtx.imageSmoothingEnabled = false;
        magCtx.clearRect(0, 0, MAG_SIZE, MAG_SIZE);
        magCtx.fillStyle = '#000';
        magCtx.fillRect(0, 0, MAG_SIZE, MAG_SIZE);

        var srcX = ox - MAG_RADIUS;
        var srcY = oy - MAG_RADIUS;
        var srcW = MAG_RADIUS * 2;
        var srcH = MAG_RADIUS * 2;

        var tmpC = document.createElement('canvas');
        tmpC.width = img.width; tmpC.height = img.height;
        tmpC.getContext('2d').drawImage(img, 0, 0);
        magCtx.drawImage(tmpC, srcX, srcY, srcW, srcH, 0, 0, MAG_SIZE, MAG_SIZE);

        magCtx.strokeStyle = 'rgba(255,255,255,0.15)';
        magCtx.lineWidth = 0.5;
        var cellSize = MAG_ZOOM;
        for (var i = 0; i <= srcW; i++) {
            magCtx.beginPath(); magCtx.moveTo(i * cellSize, 0); magCtx.lineTo(i * cellSize, MAG_SIZE); magCtx.stroke();
        }
        for (var j = 0; j <= srcH; j++) {
            magCtx.beginPath(); magCtx.moveTo(0, j * cellSize); magCtx.lineTo(MAG_SIZE, j * cellSize); magCtx.stroke();
        }

        magCtx.strokeStyle = 'rgba(233,69,96,0.8)';
        magCtx.lineWidth = 2;
        magCtx.strokeRect(MAG_RADIUS * cellSize, MAG_RADIUS * cellSize, cellSize, cellSize);

        var left = e.clientX + 20;
        var top = e.clientY - MAG_SIZE - 10;
        if (left + MAG_SIZE > window.innerWidth) left = e.clientX - MAG_SIZE - 20;
        if (top < 0) top = e.clientY + 20;
        this._magnifierEl.style.left = left + 'px';
        this._magnifierEl.style.top = top + 'px';
    },

    _hideMagnifier: function() {
        if (this._magnifierEl) this._magnifierEl.style.display = 'none';
    },

    // ========================================
    //   背景移除
    // ========================================

    _enableIrColorPick: function(type) {
        this.state.irColorPickMode = type;
        this._overlayCanvas.style.cursor = 'crosshair';
        var labels = { bg: '背景区域', outline: '轮廓线', innerBg: '内部背景', innerOutline: '内部轮廓线' };
        this._showToast('点击图片上的' + (labels[type] || type) + '取色');
    },

    // ========================================
    //   Overlay Canvas 交互
    // ========================================

    _onOverlayMouseDown: function(e) {
        // 右键拖拽画布
        if (e.button === 2) {
            this.state.canvasPanning = true;
            this.state.panStartX = e.clientX;
            this.state.panStartY = e.clientY;
            this._overlayCanvas.style.cursor = 'grabbing';
            e.preventDefault();
            return;
        }

        var rect = this._overlayCanvas.getBoundingClientRect();
        // 用 CSS 尺寸和像素尺寸的比值修正坐标
        var cssW = rect.width, cssH = rect.height;
        var pxW = this._overlayCanvas.width, pxH = this._overlayCanvas.height;
        var ratioX = pxW / cssW, ratioY = pxH / cssH;
        var mx = (e.clientX - rect.left) * ratioX;
        var my = (e.clientY - rect.top) * ratioY;
        var s = this.state.scale;
        var self = this;

        // 网格线拖拽检测
        if ((this._gridColLines && this._gridColLines.length > 0) || (this._gridRowLines && this._gridRowLines.length > 0)) {
            var hit = this._hitTestGridLine(mx, my);
            if (hit) {
                this.state.gridLineDragging = true;
                this.state.gridLineType = hit.type;
                this.state.gridLineIndex = hit.index;
                this._overlayCanvas.style.cursor = hit.type === 'col' ? 'col-resize' : 'row-resize';
                this._drawGridOverlay();
                e.preventDefault();
                e.stopPropagation();
                return;
            }
        }

        // Irregular color pick mode
        if (this.state.irColorPickMode) {
            var type = this.state.irColorPickMode;
            this.state.irColorPickMode = null;
            this._hideMagnifier();
            this._overlayCanvas.style.cursor = 'pointer';
            var ox2 = Math.floor(mx / s), oy2 = Math.floor(my / s);
            var tmpC2 = document.createElement('canvas');
            tmpC2.width = this.state.originalImage.width; tmpC2.height = this.state.originalImage.height;
            tmpC2.getContext('2d').drawImage(this.state.originalImage, 0, 0);
            var pd2 = tmpC2.getContext('2d').getImageData(ox2, oy2, 1, 1).data;
            var hex2 = self._rgbToHex(pd2[0], pd2[1], pd2[2]);
            var rgb = { r: pd2[0], g: pd2[1], b: pd2[2] };
            if (type === 'bg') {
                self.state.irBgColor = rgb;
                self._q('#irBgColor').value = hex2;
                self._q('#irBgColorHex').textContent = hex2.toUpperCase();
                self._showToast('已取背景色: ' + hex2.toUpperCase());
            } else if (type === 'outline') {
                self.state.irOutlineColor = rgb;
                self._q('#irOutlineColor').value = hex2;
                self._q('#irOutlineColorHex').textContent = hex2.toUpperCase();
                self._showToast('已取轮廓色: ' + hex2.toUpperCase());
            } else if (type === 'innerBg') {
                self.state.innerBgColor = rgb;
                self._q('#innerBgColor').value = hex2;
                self._q('#innerBgColorHex').textContent = hex2.toUpperCase();
                self._showToast('已取内部背景色: ' + hex2.toUpperCase());
            } else if (type === 'innerOutline') {
                self.state.innerOutlineColor = rgb;
                self._q('#innerOutlineColor').value = hex2;
                self._q('#innerOutlineColorHex').textContent = hex2.toUpperCase();
                self._showToast('已取内部轮廓色: ' + hex2.toUpperCase());
            }
            return;
        }

        // Lasso mode
        if (this.state.lassoMode === 'lasso') {
            this.state.lassoDrawing = true;
            this.state.lassoPoints = [{x: mx, y: my}];
            return;
        }
        if (this.state.lassoMode === 'eraser') {
            this._eraseLassoAt(mx, my);
            return;
        }

        // Irregular mode: click to select region
        var ox3 = Math.floor(mx / s), oy3 = Math.floor(my / s);
            var found = -1;
            for (var i = this.state.regions.length - 1; i >= 0; i--) {
                var r = this.state.regions[i];
                if (ox3 >= r.bounds.x && ox3 < r.bounds.x + r.bounds.w &&
                    oy3 >= r.bounds.y && oy3 < r.bounds.y + r.bounds.h) {
                    if (r.pixelSet && r.pixelSet[oy3 * this.state.originalImage.width + ox3]) {
                        found = i;
                        break;
                    }
                }
            }
            this.state.selectedRegion = found;
            if (found >= 0) {
                if (this.state.innerSelectedRegions[found]) {
                    delete this.state.innerSelectedRegions[found];
                } else {
                    this.state.innerSelectedRegions[found] = true;
                }
            }
            this._drawOverlay();
            this._updateRegionListUI();
    },

    _onOverlayMouseMove: function(e) {
        // 网格线拖拽移动
        if (this.state.gridLineDragging) {
            var rect = this._overlayCanvas.getBoundingClientRect();
            var cssW = rect.width, cssH = rect.height;
            var pxW = this._overlayCanvas.width, pxH = this._overlayCanvas.height;
            var ratioX = pxW / cssW, ratioY = pxH / cssH;
            var mx = (e.clientX - rect.left) * ratioX;
            var my = (e.clientY - rect.top) * ratioY;
            var scale = this.state.scale;
            var img = this.state.originalImage;

            if (this.state.gridLineType === 'col') {
                var newX = Math.max(10, Math.min(img.width - 10, mx / scale));
                this._gridColLines[this.state.gridLineIndex] = Math.round(newX);
            } else {
                var newY = Math.max(10, Math.min(img.height - 10, my / scale));
                this._gridRowLines[this.state.gridLineIndex] = Math.round(newY);
            }
            this._recalcGridRegions();
            this._drawGridOverlay();
            return;
        }

        // 网格线悬浮光标
        if ((this._gridColLines && this._gridColLines.length > 0) || (this._gridRowLines && this._gridRowLines.length > 0)) {
            var rect2 = this._overlayCanvas.getBoundingClientRect();
            var cssW2 = rect2.width, cssH2 = rect2.height;
            var pxW2 = this._overlayCanvas.width, pxH2 = this._overlayCanvas.height;
            var ratioX2 = pxW2 / cssW2, ratioY2 = pxH2 / cssH2;
            var mx2 = (e.clientX - rect2.left) * ratioX2;
            var my2 = (e.clientY - rect2.top) * ratioY2;
            var hit2 = this._hitTestGridLine(mx2, my2);
            if (hit2) {
                this._overlayCanvas.style.cursor = hit2.type === 'col' ? 'col-resize' : 'row-resize';
                return;
            }
        }

        // 右键拖拽画布
        if (this.state.canvasPanning) {
            var wrapper = this._q('#ttCanvasWrapper');
            wrapper.scrollLeft -= (e.clientX - this.state.panStartX);
            wrapper.scrollTop -= (e.clientY - this.state.panStartY);
            this.state.panStartX = e.clientX;
            this.state.panStartY = e.clientY;
            return;
        }

        if (this.state.irColorPickMode) {
            this._showMagnifier(e);
            return;
        }
        this._hideMagnifier();

        if (this.state.lassoDrawing) {
            var rect = this._overlayCanvas.getBoundingClientRect();
            var cssW = rect.width, cssH = rect.height;
            var pxW = this._overlayCanvas.width, pxH = this._overlayCanvas.height;
            var ratioX = pxW / cssW, ratioY = pxH / cssH;
            var mx = (e.clientX - rect.left) * ratioX, my = (e.clientY - rect.top) * ratioY;
            this.state.lassoPoints.push({x: mx, y: my});
            this._drawLassoPreview();
            return;
        }

        this._overlayCanvas.style.cursor = 'pointer';
    },

    _onOverlayMouseUp: function(e) {
        if (this.state.gridLineDragging) {
            this.state.gridLineDragging = false;
            this.state.gridLineType = null;
            this.state.gridLineIndex = -1;
            this._overlayCanvas.style.cursor = 'pointer';
            this._recalcGridRegions();
            this._drawGridOverlay();
            return;
        }
        if (this.state.canvasPanning) {
            this.state.canvasPanning = false;
            this._overlayCanvas.style.cursor = 'pointer';
            return;
        }
        this.state.dragging = false;
        this.state.dragType = null;
        if (this.state.lassoDrawing) {
            this.state.lassoDrawing = false;
            this._finishLasso();
            return;
        }
    },

    _drawLassoPreview: function() {
        if (!this._brushCanvas) return;
        var self = this;
        var fillColor = 'rgba(255, 50, 50, 0.35)';
        var strokeColor = 'rgba(255, 50, 50, 0.8)';
        this._brushCtx.clearRect(0, 0, this._brushCanvas.width, this._brushCanvas.height);
        // Draw all completed lasso regions
        this.state.lassoRegions.forEach(function(lr) {
            if (lr.imgPoints.length < 3) return;
            var s = self.state.scale;
            self._brushCtx.beginPath();
            self._brushCtx.moveTo(lr.imgPoints[0].x * s, lr.imgPoints[0].y * s);
            for (var i = 1; i < lr.imgPoints.length; i++) {
                self._brushCtx.lineTo(lr.imgPoints[i].x * s, lr.imgPoints[i].y * s);
            }
            self._brushCtx.closePath();
            self._brushCtx.fillStyle = fillColor;
            self._brushCtx.fill();
            self._brushCtx.strokeStyle = strokeColor;
            self._brushCtx.lineWidth = 1.5;
            self._brushCtx.stroke();
        });
        // Draw current in-progress lasso line
        if (this.state.lassoPoints.length > 1) {
            this._brushCtx.beginPath();
            this._brushCtx.moveTo(this.state.lassoPoints[0].x, this.state.lassoPoints[0].y);
            for (var j = 1; j < this.state.lassoPoints.length; j++) {
                this._brushCtx.lineTo(this.state.lassoPoints[j].x, this.state.lassoPoints[j].y);
            }
            this._brushCtx.strokeStyle = 'rgba(255, 200, 50, 0.9)';
            this._brushCtx.lineWidth = 2;
            this._brushCtx.stroke();
        }
    },

    _finishLasso: function() {
        if (this.state.lassoPoints.length < 3) {
            this.state.lassoPoints = [];
            this._drawLassoPreview();
            return;
        }
        var s = this.state.scale;
        var img = this.state.originalImage;
        // Convert canvas coords to image coords
        var imgPoints = this.state.lassoPoints.map(function(p) {
            return { x: p.x / s, y: p.y / s };
        });
        // Use canvas path to determine which pixels are inside the selection
        var pathC = document.createElement('canvas');
        pathC.width = img.width; pathC.height = img.height;
        var pathCtx = pathC.getContext('2d');
        pathCtx.beginPath();
        pathCtx.moveTo(imgPoints[0].x, imgPoints[0].y);
        for (var i = 1; i < imgPoints.length; i++) {
            pathCtx.lineTo(imgPoints[i].x, imgPoints[i].y);
        }
        pathCtx.closePath();
        pathCtx.fillStyle = '#fff';
        pathCtx.fill();
        var pathData = pathCtx.getImageData(0, 0, img.width, img.height).data;
        var mask = new Uint8Array(img.width * img.height);
        for (var j = 0; j < img.width * img.height; j++) {
            if (pathData[j * 4 + 3] > 128) mask[j] = 1;
        }
        this.state.lassoRegions.push({
            canvasPoints: this.state.lassoPoints.slice(),
            imgPoints: imgPoints,
            mask: mask
        });
        this.state.lassoPoints = [];
        this._drawLassoPreview();
        this._showToast('套索选区已创建');
    },

    _applyRestore: function() {
        if (!this.state.lassoRegions || this.state.lassoRegions.length === 0) {
            this._showToast('请先用套索圈出要恢复的区域', true);
            return;
        }
        var img = this.state.originalImage;
        var w = img.width, h = img.height;
        var self = this;

        // 合并所有套索区域的 mask
        var combinedMask = new Uint8Array(w * h);
        this.state.lassoRegions.forEach(function(lr) {
            for (var i = 0; i < w * h; i++) {
                if (lr.mask[i]) combinedMask[i] = 1;
            }
        });

        // 获取原图像素数据
        var tmpC = document.createElement('canvas');
        tmpC.width = w; tmpC.height = h;
        var tmpCtx = tmpC.getContext('2d');
        tmpCtx.drawImage(img, 0, 0);
        var origData = tmpCtx.getImageData(0, 0, w, h).data;

        var totalRestored = 0;
        this.state.regions.forEach(function(region) {
            var b = region.bounds;
            var newPixels = [];
            region.pixels.forEach(function(p) {
                newPixels.push(p);
            });
            // 在套索范围内，检查哪些像素不在当前 region 中，如果在原图上有颜色就补回
            for (var y = b.y; y < b.y + b.h && y < h; y++) {
                for (var x = b.x; x < b.x + b.w && x < w; x++) {
                    var idx = y * w + x;
                    if (!combinedMask[idx]) continue;
                    // 如果这个像素不在 region 中，补回
                    if (!region.pixelSet[idx]) {
                        var pi = idx * 4;
                        var a = origData[pi + 3];
                        if (a > 10) { // 原图有内容才补
                            newPixels.push([x, y]);
                            totalRestored++;
                        }
                    }
                }
            }
            // 重建 pixelSet 和 bounds
            region.pixels = newPixels;
            region.pixelSet = new Uint8Array(w * h);
            newPixels.forEach(function(p) { region.pixelSet[p[1] * w + p[0]] = 1; });
            if (newPixels.length > 0) {
                var eMinX = w, eMaxX = 0, eMinY = h, eMaxY = 0;
                newPixels.forEach(function(p) {
                    if (p[0] < eMinX) eMinX = p[0]; if (p[0] > eMaxX) eMaxX = p[0];
                    if (p[1] < eMinY) eMinY = p[1]; if (p[1] > eMaxY) eMaxY = p[1];
                });
                region.bounds = { x: eMinX, y: eMinY, w: eMaxX - eMinX + 1, h: eMaxY - eMinY + 1 };
            }
            region.area = newPixels.length;
        });

        // 清除套索
        this.state.lassoRegions = [];
        if (this._brushCanvas) this._brushCtx.clearRect(0, 0, this._brushCanvas.width, this._brushCanvas.height);
        this._drawOverlay();
        this._updateRegionListUI();
        this._showToast('已恢复 ' + totalRestored + ' 个像素');
    },

    _eraseLassoAt: function(x, y) {
        var s = this.state.scale;
        var imgX = x / s, imgY = y / s;
        var img = this.state.originalImage;
        var px = Math.floor(imgX), py = Math.floor(imgY);
        if (px < 0 || px >= img.width || py < 0 || py >= img.height) return;
        for (var i = this.state.lassoRegions.length - 1; i >= 0; i--) {
            if (this.state.lassoRegions[i].mask[py * img.width + px]) {
                this.state.lassoRegions.splice(i, 1);
                this._drawLassoPreview();
                this._showToast('已删除套索选区');
                return;
            }
        }
    },

    _redrawLassoRegions: function() {
        if (!this._brushCanvas) return;
        var fillColor = 'rgba(255, 50, 50, 0.35)';
        var strokeColor = 'rgba(255, 50, 50, 0.8)';
        this._brushCtx.clearRect(0, 0, this._brushCanvas.width, this._brushCanvas.height);
        var s = this.state.scale;
        var self = this;
        this.state.lassoRegions.forEach(function(lr) {
            if (lr.imgPoints.length < 3) return;
            self._brushCtx.beginPath();
            self._brushCtx.moveTo(lr.imgPoints[0].x * s, lr.imgPoints[0].y * s);
            for (var i = 1; i < lr.imgPoints.length; i++) {
                self._brushCtx.lineTo(lr.imgPoints[i].x * s, lr.imgPoints[i].y * s);
            }
            self._brushCtx.closePath();
            self._brushCtx.fillStyle = fillColor;
            self._brushCtx.fill();
            self._brushCtx.strokeStyle = strokeColor;
            self._brushCtx.lineWidth = 1.5;
            self._brushCtx.stroke();
        });
    },

    _updateCursor: function(e) {
        if (this.state.irColorPickMode) {
            this._overlayCanvas.style.cursor = 'crosshair'; return;
        }
        this._overlayCanvas.style.cursor = 'pointer';
    },

    // ========================================
    //   键盘事件
    // ========================================

    _handleKeyDown: function(e) {
        if (!this._overlay) return;
        if (!this._overlay.parentNode) return;
        var tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        // ESC 关闭
        if (e.key === 'Escape') {
            self._destroy();
            if (typeof SkillSystem !== 'undefined') SkillSystem.deactivate();
            return;
        }

        if (this.state.mode !== 'split') return;

        if ((e.key === 'Delete' || e.key === 'Backspace') && this.state.selectedRegion >= 0) {
            this.state.regions.splice(this.state.selectedRegion, 1);
            this.state.selectedRegion = -1;
            this._drawOverlay();
            this._updateRegionListUI();
            e.preventDefault();
        }
    },

    // ========================================
    //   异形模式：迭代 BFS
    // ========================================

    _smartDetectIrregular: function() {
        if (!this.state.originalImage) { this._showToast('请先上传图片', true); return; }
        this._showToast('正在分析图片（迭代BFS）...');
        var self = this;
        setTimeout(function() {
            try {
                var t0 = performance.now();
                var result = self._runIterativeBFS();
                var elapsed = (performance.now() - t0).toFixed(0);
                if (result.regions.length === 0) {
                    self._showToast('未检测到素材区域，请调高灵敏度', true);
                    return;
                }
                self.state.regions = result.regions;
                self.state.selectedRegion = -1;
                self._drawOverlay();
                self._updateRegionListUI();
                self._showToast('检测到 ' + result.regions.length + ' 个异形区域 (' + elapsed + 'ms)');
            } catch (e) {
                console.error(e);
                self._showToast('检测出错: ' + e.message, true);
            }
        }, 50);
    },

    _runIterativeBFS: function() {
        var img = this.state.originalImage;
        var w = img.width, h = img.height;
        var sensitivity = parseInt(this._q('#detectSensitivity').value);
        var minArea = parseInt(this._q('#minArea').value);

        var tmpC = document.createElement('canvas');
        tmpC.width = w; tmpC.height = h;
        var tmpCtx = tmpC.getContext('2d');
        tmpCtx.drawImage(img, 0, 0);
        var imageData = tmpCtx.getImageData(0, 0, w, h);
        var data = imageData.data;

        // 检测是否有透明像素
        var hasTransparentPixels = false;
        for (var ti = 3; ti < data.length; ti += 4) {
            if (data[ti] < 128) { hasTransparentPixels = true; break; }
        }

        var hasBg = this.state.irBgColor !== null;
        var hasOutline = this.state.irOutlineColor !== null;

        // 透明背景图：忽略背景色设置，透明像素直接作为背景
        var useAlphaAsBg = hasTransparentPixels;

        if (!hasBg && !useAlphaAsBg) {
            this._showToast('请先取背景色', true);
            return { regions: [] };
        }

        var bgColor = this.state.irBgColor;
        var outlineColor = this.state.irOutlineColor;
        var tol = sensitivity * 2.5;
        var outlineTol = tol * (parseInt(this._q('#outlineTolerance').value) / 100);

        var mask = new Uint8Array(w * h);
        var brightnessThreshold = 80;
        for (var i = 0; i < w * h; i++) {
            var pi = i * 4;
            var r = data[pi], g = data[pi + 1], b = data[pi + 2], a = data[pi + 3];

            // 透明像素直接作为背景
            if (useAlphaAsBg && a < 128) {
                mask[i] = 0;
                continue;
            }

            if (hasOutline) {
                var odr = r - outlineColor.r, odg = g - outlineColor.g, odb = b - outlineColor.b;
                var oDist = Math.sqrt(odr * odr + odg * odg + odb * odb);
                if (oDist <= outlineTol) {
                    mask[i] = 2;
                    continue;
                }
            }

            if (useAlphaAsBg) {
                // 透明背景图：非透明像素都是前景
                mask[i] = 1;
            } else {
                // 非透明背景图：用亮度判断
                var brightness = r * 0.299 + g * 0.587 + b * 0.114;
                mask[i] = brightness >= brightnessThreshold ? 0 : 1;
            }
        }

        for (var j = 0; j < w * h; j++) {
            if (mask[j] === 0) mask[j] = 3;
        }

        var bgQueue = [];
        var bgHead = 0;
        for (var x = 0; x < w; x++) {
            if (mask[x] === 3) { mask[x] = 0; bgQueue.push(x, 0); }
            var bIdx = (h - 1) * w + x;
            if (mask[bIdx] === 3) { mask[bIdx] = 0; bgQueue.push(x, h - 1); }
        }
        for (var y = 1; y < h - 1; y++) {
            var lIdx = y * w;
            if (mask[lIdx] === 3) { mask[lIdx] = 0; bgQueue.push(0, y); }
            var rIdx = y * w + w - 1;
            if (mask[rIdx] === 3) { mask[rIdx] = 0; bgQueue.push(w - 1, y); }
        }

        var BG_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        while (bgHead < bgQueue.length) {
            var cx = bgQueue[bgHead++];
            var cy = bgQueue[bgHead++];
            for (var d = 0; d < 4; d++) {
                var nx = cx + BG_DIRS[d][0], ny = cy + BG_DIRS[d][1];
                if (nx >= 0 && nx < w && ny >= 0 && ny < h && mask[ny * w + nx] === 3) {
                    mask[ny * w + nx] = 0;
                    bgQueue.push(nx, ny);
                }
            }
        }

        for (var k = 0; k < w * h; k++) {
            if (mask[k] >= 1) mask[k] = 1;
        }

        // Dilate/Erode
        var dilateN = parseInt(this._q('#dilatePx').value);
        if (dilateN > 0) {
            for (var pass = 0; pass < dilateN; pass++) {
                var dilated = new Uint8Array(w * h);
                dilated.set(mask);
                for (var dy2 = 0; dy2 < h; dy2++) {
                    for (var dx2 = 0; dx2 < w; dx2++) {
                        if (mask[dy2 * w + dx2] === 1) continue;
                        if ((dx2 > 0 && mask[dy2 * w + dx2 - 1] === 1) ||
                            (dx2 < w - 1 && mask[dy2 * w + dx2 + 1] === 1) ||
                            (dy2 > 0 && mask[(dy2 - 1) * w + dx2] === 1) ||
                            (dy2 < h - 1 && mask[(dy2 + 1) * w + dx2] === 1)) {
                            dilated[dy2 * w + dx2] = 1;
                        }
                    }
                }
                mask.set(dilated);
            }
        } else if (dilateN < 0) {
            var erodeN = -dilateN;
            for (var pass2 = 0; pass2 < erodeN; pass2++) {
                var eroded = new Uint8Array(w * h);
                eroded.set(mask);
                for (var dy3 = 0; dy3 < h; dy3++) {
                    for (var dx3 = 0; dx3 < w; dx3++) {
                        if (mask[dy3 * w + dx3] === 0) continue;
                        if ((dx3 === 0 || mask[dy3 * w + dx3 - 1] === 0) ||
                            (dx3 === w - 1 || mask[dy3 * w + dx3 + 1] === 0) ||
                            (dy3 === 0 || mask[(dy3 - 1) * w + dx3] === 0) ||
                            (dy3 === h - 1 || mask[(dy3 + 1) * w + dx3] === 0)) {
                            eroded[dy3 * w + dx3] = 0;
                        }
                    }
                }
                mask.set(eroded);
            }
        }

        // Morphological closing
        var closedMask = new Uint8Array(w * h);
        closedMask.set(mask);

        var dilated2 = new Uint8Array(w * h);
        for (var cy2 = 0; cy2 < h; cy2++) {
            for (var cx2 = 0; cx2 < w; cx2++) {
                if (closedMask[cy2 * w + cx2] === 1) { dilated2[cy2 * w + cx2] = 1; continue; }
                var found = false;
                for (var ddy = -1; ddy <= 1 && !found; ddy++) {
                    for (var ddx = -1; ddx <= 1 && !found; ddx++) {
                        if (ddx === 0 && ddy === 0) continue;
                        var nnx = cx2 + ddx, nny = cy2 + ddy;
                        if (nnx >= 0 && nnx < w && nny >= 0 && nny < h && closedMask[nny * w + nnx] === 1) {
                            found = true;
                        }
                    }
                }
                dilated2[cy2 * w + cx2] = found ? 1 : 0;
            }
        }

        for (var cy3 = 0; cy3 < h; cy3++) {
            for (var cx3 = 0; cx3 < w; cx3++) {
                if (dilated2[cy3 * w + cx3] === 0) continue;
                var allFg = true;
                for (var ddy2 = -1; ddy2 <= 1 && allFg; ddy2++) {
                    for (var ddx2 = -1; ddx2 <= 1 && allFg; ddx2++) {
                        var nnx2 = cx3 + ddx2, nny2 = cy3 + ddy2;
                        if (nnx2 >= 0 && nnx2 < w && nny2 >= 0 && nny2 < h && dilated2[nny2 * w + nnx2] === 0) {
                            allFg = false;
                        }
                    }
                }
                closedMask[cy3 * w + cx3] = allFg ? 1 : 0;
            }
        }

        // BFS on closed mask
        var regions = [];
        var regionId = 0;
        var DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
        var self = this;

        while (true) {
            var startX = -1, startY = -1;
            var outerBreak = false;
            for (var sy = 0; sy < h && !outerBreak; sy++) {
                for (var sx = 0; sx < w; sx++) {
                    if (closedMask[sy * w + sx] === 1) {
                        startX = sx; startY = sy;
                        outerBreak = true;
                        break;
                    }
                }
            }
            if (startX === -1) break;

            var regionPixels = [];
            var queue = [startX, startY];
            var head = 0;
            closedMask[startY * w + startX] = 2;
            var minX = startX, maxX = startX, minY = startY, maxY = startY;

            while (head < queue.length) {
                var qx = queue[head++];
                var qy = queue[head++];
                regionPixels.push([qx, qy]);
                if (qx < minX) minX = qx;
                if (qx > maxX) maxX = qx;
                if (qy < minY) minY = qy;
                if (qy > maxY) maxY = qy;

                for (var di = 0; di < 8; di++) {
                    var dnx = qx + DIRS[di][0], dny = qy + DIRS[di][1];
                    if (dnx >= 0 && dnx < w && dny >= 0 && dny < h && closedMask[dny * w + dnx] === 1) {
                        closedMask[dny * w + dnx] = 2;
                        queue.push(dnx, dny);
                    }
                }
            }

            var exactPixels = [];
            var pixelSet = new Uint8Array(w * h);
            regionPixels.forEach(function(p) { pixelSet[p[1] * w + p[0]] = 1; });

            var expandQueue = [];
            var expandHead = 0;
            regionPixels.forEach(function(p) {
                if (mask[p[1] * w + p[0]] === 1) {
                    exactPixels.push(p);
                } else {
                    expandQueue.push(p[0], p[1]);
                }
            });

            var visited = new Uint8Array(w * h);
            regionPixels.forEach(function(p) { visited[p[1] * w + p[0]] = 1; });

            while (expandHead < expandQueue.length) {
                var ecx = expandQueue[expandHead++];
                var ecy = expandQueue[expandHead++];
                for (var edi = 0; edi < 8; edi++) {
                    var enx = ecx + DIRS[edi][0], eny = ecy + DIRS[edi][1];
                    if (enx >= 0 && enx < w && eny >= 0 && eny < h && !visited[eny * w + enx]) {
                        visited[eny * w + enx] = 1;
                        if (mask[eny * w + enx] === 1) {
                            exactPixels.push([enx, eny]);
                            expandQueue.push(enx, eny);
                        }
                    }
                }
            }

            var area = exactPixels.length;

            if (area >= minArea) {
                var exactPixelSet = new Uint8Array(w * h);
                exactPixels.forEach(function(p) { exactPixelSet[p[1] * w + p[0]] = 1; });

                var eMinX = w, eMaxX = 0, eMinY = h, eMaxY = 0;
                exactPixels.forEach(function(p) {
                    if (p[0] < eMinX) eMinX = p[0];
                    if (p[0] > eMaxX) eMaxX = p[0];
                    if (p[1] < eMinY) eMinY = p[1];
                    if (p[1] > eMaxY) eMaxY = p[1];
                });

                regions.push({
                    id: regionId++,
                    pixels: exactPixels,
                    pixelSet: exactPixelSet,
                    bounds: { x: eMinX, y: eMinY, w: eMaxX - eMinX + 1, h: eMaxY - eMinY + 1 },
                    area: area,
                    color: self.REGION_COLORS[regions.length % self.REGION_COLORS.length]
                });
            }

            regionPixels.forEach(function(p) { closedMask[p[1] * w + p[0]] = 0; });
            exactPixels.forEach(function(p) { mask[p[1] * w + p[0]] = 0; });
        }

        return { regions: regions };
    },

    // ========================================
    //   区域列表 UI
    // ========================================

    _updateRegionListUI: function() {
        var container = this._q('#ttRegionList');
        var self = this;

        if (this.state.regions.length === 0) {
            container.innerHTML = '<p style="font-size:11px;color:#aaa;text-align:center;padding:10px 0">点击上方按钮开始检测</p>';
            return;
        }
        container.innerHTML = '';

        this.state.regions.forEach(function(r, i) {
            var div = document.createElement('div');
            var isChecked = !!self.state.innerSelectedRegions[i];
            var isSelected = i === self.state.selectedRegion;
            var cls = 'tt-region-item';
            if (isSelected) cls += ' selected';
            if (isChecked) cls += ' inner-checked';
            div.className = cls;
            div.innerHTML =
                '<input type="checkbox" class="tt-inner-cb" ' + (isChecked ? 'checked' : '') + ' title="勾选后进行内轮廓抠图">' +
                '<span class="tt-color-dot" style="background:' + r.color + '"></span>' +
                '<span class="tt-info">#' + (i + 1) + ' ' + r.bounds.w + '\u00d7' + r.bounds.h + ' (' + r.area + 'px)</span>' +
                '<button class="tt-del" data-region-del="' + i + '">\u00d7</button>';

            var cb = div.querySelector('.tt-inner-cb');
            cb.addEventListener('click', function(e) {
                e.stopPropagation();
                if (cb.checked) self.state.innerSelectedRegions[i] = true;
                else delete self.state.innerSelectedRegions[i];
                div.classList.toggle('inner-checked', cb.checked);
                self._drawOverlay();
            });

            div.addEventListener('click', function() {
                if (self.state.innerSelectedRegions[i]) {
                    delete self.state.innerSelectedRegions[i];
                } else {
                    self.state.innerSelectedRegions[i] = true;
                }
                self.state.selectedRegion = i;
                self._updateRegionListUI();
                self._drawOverlay();
            });

            div.querySelector('.tt-del').addEventListener('click', function(e) {
                e.stopPropagation();
                self._removeRegion(i);
            });

            container.appendChild(div);
        });
    },

    _selectAllRegions: function(selectAll) {
        this.state.innerSelectedRegions = {};
        if (selectAll) {
            var self = this;
            this.state.regions.forEach(function(_, i) { self.state.innerSelectedRegions[i] = true; });
        }
        this._updateRegionListUI();
        this._drawOverlay();
    },

    _invertRegionSelection: function() {
        var newSet = {};
        var self = this;
        this.state.regions.forEach(function(_, i) {
            if (!self.state.innerSelectedRegions[i]) newSet[i] = true;
        });
        this.state.innerSelectedRegions = newSet;
        this._updateRegionListUI();
        this._drawOverlay();
    },

    _removeRegion: function(i) {
        this.state.regions.splice(i, 1);
        if (this.state.selectedRegion >= this.state.regions.length) this.state.selectedRegion = -1;
        if (this.state.selectedRegion === i) this.state.selectedRegion = -1;
        this._drawOverlay();
        this._updateRegionListUI();
    },

    _clearAllRegions: function() {
        this.state.regions = [];
        this.state.selectedRegion = -1;
        this.state.innerSelectedRegions = {};
        this._drawOverlay();
        this._updateRegionListUI();
    },

    _undoLastRegion: function() {
        if (this.state.regions.length > 0) {
            this.state.regions.pop();
            this.state.selectedRegion = -1;
            this._drawOverlay();
            this._updateRegionListUI();
        }
    },

    // ========================================
    //   内轮廓抠图
    // ========================================

    _applyInnerBgRemove: function() {
        if (!this.state.innerBgColor) { this._showToast('请先取内部背景色', true); return; }
        if (this.state.regions.length === 0) { this._showToast('请先检测外轮廓区域', true); return; }
        var hasSelection = false;
        for (var k in this.state.innerSelectedRegions) { hasSelection = true; break; }
        if (!hasSelection) { this._showToast('请先勾选要抠图的区域', true); return; }

        var img = this.state.originalImage;
        var w = img.width, h = img.height;
        var innerTol = parseInt(this._q('#innerTolerance').value) * 2.5;
        var innerBg = this.state.innerBgColor;
        var innerOutline = this.state.innerOutlineColor;
        var hasInnerOutline = innerOutline !== null;

        var tmpC = document.createElement('canvas');
        tmpC.width = w; tmpC.height = h;
        var tmpCtx = tmpC.getContext('2d');
        tmpCtx.drawImage(img, 0, 0);
        var data = tmpCtx.getImageData(0, 0, w, h).data;

        var totalRemoved = 0;
        var self = this;

        for (var ri in this.state.innerSelectedRegions) {
            if (!this.state.innerSelectedRegions[ri]) continue;
            var region = this.state.regions[ri];
            if (!region) continue;
            var b = region.bounds;
            var localW = b.w, localH = b.h;

            var localMask = new Uint8Array(localW * localH);
            region.pixels.forEach(function(p) {
                localMask[(p[1] - b.y) * localW + (p[0] - b.x)] = 1;
            });

            // 如果该区域有套索，只在套索范围内检测内部背景
            var lassoRestrict = null;
            if (self.state.lassoRegions.length > 0) {
                lassoRestrict = new Uint8Array(localW * localH);
                self.state.lassoRegions.forEach(function(lr) {
                    for (var ly = 0; ly < localH; ly++) {
                        for (var lx = 0; lx < localW; lx++) {
                            var gx = lx + b.x, gy = ly + b.y;
                            if (lr.mask[gy * w + gx]) lassoRestrict[ly * localW + lx] = 1;
                        }
                    }
                });
                // 检查该区域是否真的被套索覆盖
                var hasLassoCoverage = false;
                for (var ci = 0; ci < localW * localH; ci++) {
                    if (localMask[ci] === 1 && lassoRestrict[ci] === 1) { hasLassoCoverage = true; break; }
                }
                if (!hasLassoCoverage) lassoRestrict = null;
            }

            for (var ly = 0; ly < localH; ly++) {
                for (var lx = 0; lx < localW; lx++) {
                    if (localMask[ly * localW + lx] !== 1) continue;
                    // 如果有套索限制，只处理套索范围内的像素
                    if (lassoRestrict && !lassoRestrict[ly * localW + lx]) continue;
                    var px = lx + b.x, py = ly + b.y;
                    var pi = (py * w + px) * 4;
                    var r = data[pi], g = data[pi + 1], bl = data[pi + 2];

                    if (hasInnerOutline) {
                        var odr = r - innerOutline.r, odg = g - innerOutline.g, odb = bl - innerOutline.b;
                        var oDist = Math.sqrt(odr * odr + odg * odg + odb * odb);
                        if (oDist <= innerTol * 0.8) {
                            localMask[ly * localW + lx] = 3;
                            continue;
                        }
                    }

                    var bdr = r - innerBg.r, bdg = g - innerBg.g, bdb = bl - innerBg.b;
                    var bDist = Math.sqrt(bdr * bdr + bdg * bdg + bdb * bdb);
                    if (bDist <= innerTol) {
                        localMask[ly * localW + lx] = 2;
                    }
                }
            }

            // 从区域实际边缘开始 BFS，标记所有从边缘可达的像素
            // 剩余未访问的背景色像素 = 被前景包围的内部空洞
            var DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            var visited = new Uint8Array(localW * localH);
            var queue = [];
            var head = 0;

            // 找区域实际边缘：localMask=1 且相邻 localMask=0 的像素
            for (var ey = 0; ey < localH; ey++) {
                for (var ex = 0; ex < localW; ex++) {
                    if (localMask[ey * localW + ex] !== 1) continue;
                    var isEdge = false;
                    for (var dd = 0; dd < 4; dd++) {
                        var enx = ex + DIRS[dd][0], eny = ey + DIRS[dd][1];
                        if (enx < 0 || enx >= localW || eny < 0 || eny >= localH || localMask[eny * localW + enx] === 0) {
                            isEdge = true; break;
                        }
                    }
                    if (isEdge && !visited[ey * localW + ex]) {
                        visited[ey * localW + ex] = 1;
                        queue.push(ex, ey);
                    }
                }
            }

            // BFS 填充所有从边缘可达的前景像素（非背景色）
            while (head < queue.length) {
                var cx = queue[head++];
                var cy = queue[head++];
                for (var d = 0; d < 4; d++) {
                    var nx = cx + DIRS[d][0], ny = cy + DIRS[d][1];
                    if (nx >= 0 && nx < localW && ny >= 0 && ny < localH && !visited[ny * localW + nx] && localMask[ny * localW + nx] === 1) {
                        visited[ny * localW + nx] = 1;
                        queue.push(nx, ny);
                    }
                }
            }

            // 未访问且是背景色（mask=2）的像素 = 内部空洞，需要删除
            var newPixels = [];
            region.pixels.forEach(function(p) {
                var lx3 = p[0] - b.x, ly3 = p[1] - b.y;
                var val = localMask[ly3 * localW + lx3];
                if (val === 2 && !visited[ly3 * localW + lx3]) {
                    // 被前景包围的内部背景 → 删除
                    totalRemoved++;
                } else {
                    newPixels.push(p);
                }
            });

            region.pixels = newPixels;
            region.pixelSet = new Uint8Array(w * h);
            newPixels.forEach(function(p) { region.pixelSet[p[1] * w + p[0]] = 1; });
            if (newPixels.length > 0) {
                var eMinX = w, eMaxX = 0, eMinY = h, eMaxY = 0;
                newPixels.forEach(function(p) {
                    if (p[0] < eMinX) eMinX = p[0]; if (p[0] > eMaxX) eMaxX = p[0];
                    if (p[1] < eMinY) eMinY = p[1]; if (p[1] > eMaxY) eMaxY = p[1];
                });
                region.bounds = { x: eMinX, y: eMinY, w: eMaxX - eMinX + 1, h: eMaxY - eMinY + 1 };
            }
            region.area = newPixels.length;

            // Inner dilate/erode
            var innerDilateN = parseInt(self._q('#innerDilatePx').value);
            if (innerDilateN !== 0 && newPixels.length > 0) {
                var ib = region.bounds;
                var ilW = ib.w, ilH = ib.h;
                var ilMask = new Uint8Array(ilW * ilH);
                newPixels.forEach(function(p) { ilMask[(p[1] - ib.y) * ilW + (p[0] - ib.x)] = 1; });

                if (innerDilateN > 0) {
                    for (var ip = 0; ip < innerDilateN; ip++) {
                        var dm = new Uint8Array(ilW * ilH);
                        dm.set(ilMask);
                        for (var ily = 0; ily < ilH; ily++) {
                            for (var ilx = 0; ilx < ilW; ilx++) {
                                if (ilMask[ily * ilW + ilx] === 1) continue;
                                if ((ilx > 0 && ilMask[ily * ilW + ilx - 1] === 1) ||
                                    (ilx < ilW - 1 && ilMask[ily * ilW + ilx + 1] === 1) ||
                                    (ily > 0 && ilMask[(ily - 1) * ilW + ilx] === 1) ||
                                    (ily < ilH - 1 && ilMask[(ily + 1) * ilW + ilx] === 1)) {
                                    dm[ily * ilW + ilx] = 1;
                                }
                            }
                        }
                        ilMask.set(dm);
                    }
                } else {
                    var ieN = -innerDilateN;
                    for (var ip2 = 0; ip2 < ieN; ip2++) {
                        var em = new Uint8Array(ilW * ilH);
                        em.set(ilMask);
                        for (var ily2 = 0; ily2 < ilH; ily2++) {
                            for (var ilx2 = 0; ilx2 < ilW; ilx2++) {
                                if (ilMask[ily2 * ilW + ilx2] === 0) continue;
                                if ((ilx2 === 0 || ilMask[ily2 * ilW + ilx2 - 1] === 0) ||
                                    (ilx2 === ilW - 1 || ilMask[ily2 * ilW + ilx2 + 1] === 0) ||
                                    (ily2 === 0 || ilMask[(ily2 - 1) * ilW + ilx2] === 0) ||
                                    (ily2 === ilH - 1 || ilMask[(ily2 + 1) * ilW + ilx2] === 0)) {
                                    em[ily2 * ilW + ilx2] = 0;
                                }
                            }
                        }
                        ilMask.set(em);
                    }
                }

                var finalPixels = [];
                for (var fly = 0; fly < ilH; fly++) {
                    for (var flx = 0; flx < ilW; flx++) {
                        if (ilMask[fly * ilW + flx] === 1) {
                            finalPixels.push([flx + ib.x, fly + ib.y]);
                        }
                    }
                }
                region.pixels = finalPixels;
                region.pixelSet = new Uint8Array(w * h);
                finalPixels.forEach(function(p) { region.pixelSet[p[1] * w + p[0]] = 1; });
                if (finalPixels.length > 0) {
                    var feMinX = w, feMaxX = 0, feMinY = h, feMaxY = 0;
                    finalPixels.forEach(function(p) {
                        if (p[0] < feMinX) feMinX = p[0]; if (p[0] > feMaxX) feMaxX = p[0];
                        if (p[1] < feMinY) feMinY = p[1]; if (p[1] > feMaxY) feMaxY = p[1];
                    });
                    region.bounds = { x: feMinX, y: feMinY, w: feMaxX - feMinX + 1, h: feMaxY - feMinY + 1 };
                }
                region.area = finalPixels.length;
            }
        }

        this.state.innerSelectedRegions = {};
        this._drawOverlay();
        this._updateRegionListUI();
        this._showToast('已移除 ' + totalRemoved + ' 个内部背景像素');
    },

    // ========================================
    //   方形模式：均匀网格分割
    // ========================================

    _doGridSplit: function() {
        if (!this.state.originalImage) { this._showToast('请先上传图片', true); return; }
        var rows = parseInt(this._getVal('#ttGridRows')) || 3;
        var cols = parseInt(this._getVal('#ttGridCols')) || 3;
        var lineWidth = parseInt(this._getVal('#ttGridLineWidth')) || 0;
        var hasEdge = this._getChecked('#ttGridEdge');

        var img = this.state.originalImage;

        // 适配视图（和异形模式一致）
        this._fitImageToView(img);
        var scale = this.state.scale;

        // 绘制主图
        this._mainCtx.drawImage(img, 0, 0, this._mainCanvas.width, this._mainCanvas.height);

        // 存储分割线位置（原图像素坐标）
        var cw = this._mainCanvas.width, ch = this._mainCanvas.height;
        this._gridRows = rows;
        this._gridCols = cols;
        this._gridLineWidth = lineWidth;
        this._gridHasEdge = hasEdge;
        this._gridColLines = [];  // 列分割线的原图 x 坐标
        this._gridRowLines = [];  // 行分割线的原图 y 坐标
        for (var c = 1; c < cols; c++) {
            this._gridColLines.push(Math.round(c * img.width / cols));
        }
        for (var r = 1; r < rows; r++) {
            this._gridRowLines.push(Math.round(r * img.height / rows));
        }

        this._recalcGridRegions();
        this._drawGridOverlay();

        // 更新信息栏
        var sizeEl = this._q('#ttInfoSize');
        if (sizeEl) sizeEl.textContent = img.width + ' \u00d7 ' + img.height;
        var boxLabel = this._q('#ttInfoBoxLabel');
        if (boxLabel) boxLabel.innerHTML = '网格: <span class="tt-val">' + rows + '\u00d7' + cols + '</span>';
        var infoBar = this._q('#ttInfoBar');
        if (infoBar) infoBar.style.display = 'flex';

        this._showToast('方形分割: ' + rows + '\u00d7' + cols + ' = ' + this._gridRegions.length + ' 块（可拖拽分割线调整）');
    },

    // 根据分割线位置重新计算区域
    _recalcGridRegions: function() {
        var img = this.state.originalImage;
        if (!img) return;
        var scale = this.state.scale;
        var lw = this._gridLineWidth * scale;
        var hasEdge = this._gridHasEdge;
        var cols = this._gridCols;
        var rows = this._gridRows;

        // 构建所有边界（原图坐标）
        var colBounds = [0];
        this._gridColLines.forEach(function(x) { colBounds.push(x); });
        colBounds.push(img.width);
        var rowBounds = [0];
        this._gridRowLines.forEach(function(y) { rowBounds.push(y); });
        rowBounds.push(img.height);

        this._gridRegions = [];
        for (var r = 0; r < rows; r++) {
            for (var c = 0; c < cols; c++) {
                var ox = colBounds[c], oy = rowBounds[r];
                var ow = colBounds[c + 1] - ox, oh = rowBounds[r + 1] - oy;
                if (ow <= 0 || oh <= 0) continue;

                // 缩放到画布坐标
                var sx = ox * scale, sy = oy * scale;
                var sw = ow * scale, sh = oh * scale;

                // 排除分割线区域（画布坐标）
                var fx = sx, fy = sy, fw = sw, fh = sh;
                if (lw > 0) {
                    if (c > 0 || !hasEdge) fx = sx + (c > 0 ? lw : 0);
                    if (r > 0 || !hasEdge) fy = sy + (r > 0 ? lw : 0);
                    if (c < cols - 1 || !hasEdge) fw = sw - (c > 0 ? lw : 0) - (c < cols - 1 ? lw : 0);
                    if (r < rows - 1 || !hasEdge) fh = sh - (r > 0 ? lw : 0) - (r < rows - 1 ? lw : 0);
                }

                if (fw > 0 && fh > 0) {
                    this._gridRegions.push({
                        x: fx, y: fy, w: fw, h: fh, row: r, col: c,
                        ox: ox, oy: oy, ow: ow, oh: oh
                    });
                }
            }
        }
    },

    // 网格线拖拽：检测鼠标是否靠近分割线
    _hitTestGridLine: function(canvasX, canvasY) {
        var scale = this.state.scale;
        var threshold = 8; // 像素

        // 检测列线
        for (var i = 0; i < this._gridColLines.length; i++) {
            var x = Math.round(this._gridColLines[i] * scale);
            if (Math.abs(canvasX - x) < threshold && canvasY >= 0 && canvasY <= this._mainCanvas.height) {
                return { type: 'col', index: i };
            }
        }
        // 检测行线
        for (var j = 0; j < this._gridRowLines.length; j++) {
            var y = Math.round(this._gridRowLines[j] * scale);
            if (Math.abs(canvasY - y) < threshold && canvasX >= 0 && canvasX <= this._mainCanvas.width) {
                return { type: 'row', index: j };
            }
        }
        return null;
    },

    _gridSplitAndDownload: function() {
        if (!this._gridRegions || !this._gridRegions.length) { this._showToast('请先执行方形分割', true); return; }
        var img = this.state.originalImage;
        var format = this._getVal('#splitFormat') || 'png';

        if (typeof JSZip === 'undefined') {
            this._showToast('JSZip 库未加载，无法创建 ZIP', true);
            return;
        }

        var srcCanvas = document.createElement('canvas');
        srcCanvas.width = img.width; srcCanvas.height = img.height;
        var srcCtx = srcCanvas.getContext('2d');
        srcCtx.drawImage(img, 0, 0);

        var zip = new JSZip();
        var self = this;
        this._gridRegions.forEach(function(region) {
            var tileCanvas = document.createElement('canvas');
            tileCanvas.width = region.ow; tileCanvas.height = region.oh;
            var tileCtx = tileCanvas.getContext('2d');
            tileCtx.drawImage(srcCanvas, region.ox, region.oy, region.ow, region.oh, 0, 0, region.ow, region.oh);
            var ext = format === 'webp' ? 'webp' : 'png';
            var mime = format === 'webp' ? 'image/webp' : 'image/png';
            var dataUrl = tileCanvas.toDataURL(mime);
            var base64 = dataUrl.split(',')[1];
            zip.file('tile_r' + region.row + '_c' + region.col + '.' + ext, base64, {base64: true});
        });

        zip.generateAsync({type: 'blob'}).then(function(blob) {
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = 'tiles_grid_split.zip';
            a.click();
            URL.revokeObjectURL(a.href);
            self._showToast('已下载 ' + self._gridRegions.length + ' 张方形素材');
        });
    },

    _gridPushToMerge: function() {
        if (!this._gridRegions || !this._gridRegions.length) { this._showToast('请先执行方形分割', true); return; }
        var img = this.state.originalImage;
        var srcCanvas = document.createElement('canvas');
        srcCanvas.width = img.width; srcCanvas.height = img.height;
        var srcCtx = srcCanvas.getContext('2d');
        srcCtx.drawImage(img, 0, 0);

        var self = this;
        var loaded = 0;
        var total = this._gridRegions.length;

        this._gridRegions.forEach(function(region) {
            var tileCanvas = document.createElement('canvas');
            tileCanvas.width = region.ow; tileCanvas.height = region.oh;
            var tileCtx = tileCanvas.getContext('2d');
            tileCtx.drawImage(srcCanvas, region.ox, region.oy, region.ow, region.oh, 0, 0, region.ow, region.oh);
            var tileImg = new Image();
            tileImg.src = tileCanvas.toDataURL('image/png');
            tileImg.onload = function() {
                if (!self.state.mergeImages) self.state.mergeImages = [];
                self.state.mergeImages.push({
                    name: 'r' + region.row + '_c' + region.col,
                    img: tileImg,
                    dataUrl: tileImg.src
                });
                loaded++;
                if (loaded === total) {
                    self._updateMergePreview();
                    self._switchMode('merge');
                    self._showToast('已推送 ' + total + ' 张方形素材到合并页面');
                }
            };
        });
    },

    // ========================================
    //   拆分并下载
    // ========================================

    _splitAndDownload: function() {
        var self = this;
        var items = this.state.regions;
        if (items.length === 0) { this._showToast('请先检测区域', true); return; }

        var img = this.state.originalImage;
        var format = this._q('#splitFormat').value;
        var trim = this._q('#trimTransparent').checked;
        var mimeType = format === 'webp' ? 'image/webp' : 'image/png';
        var ext = format === 'webp' ? '.webp' : '.png';

        var srcCanvas = document.createElement('canvas');
        srcCanvas.width = img.width; srcCanvas.height = img.height;
        var srcCtx = srcCanvas.getContext('2d');
        if (this.state.processedImageData) {
            srcCtx.putImageData(this.state.processedImageData, 0, 0);
        } else {
            srcCtx.drawImage(img, 0, 0);
        }
        var srcData = srcCtx.getImageData(0, 0, img.width, img.height);

        if (typeof JSZip === 'undefined') {
            this._showToast('JSZip 库未加载，无法创建 ZIP', true);
            return;
        }

        var zip = new JSZip();

        this.state.regions.forEach(function(region, i) {
            var b = region.bounds;
            var tileCanvas = document.createElement('canvas');
            tileCanvas.width = b.w; tileCanvas.height = b.h;
            var tileCtx = tileCanvas.getContext('2d');
            var tileData = tileCtx.createImageData(b.w, b.h);
            var td = tileData.data;
            var sd = srcData.data;

            region.pixels.forEach(function(p) {
                var sx = (p[1] * img.width + p[0]) * 4;
                var dx = ((p[1] - b.y) * b.w + (p[0] - b.x)) * 4;
                td[dx] = sd[sx];
                td[dx + 1] = sd[sx + 1];
                td[dx + 2] = sd[sx + 2];
                td[dx + 3] = sd[sx + 3];
            });

            tileCtx.putImageData(tileData, 0, 0);
            var finalCanvas = trim ? self._trimCanvas(tileCanvas) : tileCanvas;
            var dataUrl = finalCanvas.toDataURL(mimeType, 0.95);
            zip.file('tile_' + String(i + 1).padStart(3, '0') + ext, dataUrl.split(',')[1], { base64: true });
        });

        zip.generateAsync({ type: 'blob' }).then(function(blob) {
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url; a.download = 'tiles_split.zip';
            a.click();
            URL.revokeObjectURL(url);
            self._showToast('已下载 ' + items.length + ' 张素材');
        });
    },

    _pushToMerge: function() {
        var self = this;
        var items = this.state.regions;
        if (items.length === 0) { this._showToast('请先检测区域', true); return; }

        var img = this.state.originalImage;
        var trim = this._q('#trimTransparent').checked;

        var srcCanvas = document.createElement('canvas');
        srcCanvas.width = img.width; srcCanvas.height = img.height;
        var srcCtx = srcCanvas.getContext('2d');
        if (this.state.processedImageData) {
            srcCtx.putImageData(this.state.processedImageData, 0, 0);
        } else {
            srcCtx.drawImage(img, 0, 0);
        }
        var srcData = srcCtx.getImageData(0, 0, img.width, img.height);

        var promises = items.map(function(region, i) {
            return new Promise(function(resolve) {
                var b = region.bounds;
                var tileCanvas = document.createElement('canvas');
                tileCanvas.width = b.w; tileCanvas.height = b.h;
                var tileCtx = tileCanvas.getContext('2d');
                var tileData = tileCtx.createImageData(b.w, b.h);
                var td = tileData.data;
                var sd = srcData.data;

                region.pixels.forEach(function(p) {
                    var sx = (p[1] * img.width + p[0]) * 4;
                    var dx = ((p[1] - b.y) * b.w + (p[0] - b.x)) * 4;
                    td[dx] = sd[sx];
                    td[dx + 1] = sd[sx + 1];
                    td[dx + 2] = sd[sx + 2];
                    td[dx + 3] = sd[sx + 3];
                });

                tileCtx.putImageData(tileData, 0, 0);
                var finalCanvas = trim ? self._trimCanvas(tileCanvas) : tileCanvas;
                var dataUrl = finalCanvas.toDataURL('image/png');
                var mergeImg = new Image();
                mergeImg.onload = function() {
                    resolve({ name: 'tile_' + String(i + 1).padStart(3, '0') + '.png', img: mergeImg, dataUrl: dataUrl });
                };
                mergeImg.src = dataUrl;
            });
        });

        Promise.all(promises).then(function(results) {
            self.state.mergeImages = self.state.mergeImages.concat(results);
            self._updateMergePreview();
            // 切换到合并面板
            self._switchMode('merge');
            self._showToast('已推送 ' + results.length + ' 张素材到合并页面');
        });
    },

    _trimCanvas: function(canvas) {
        var ctx = canvas.getContext('2d');
        var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        var top = canvas.height, left = canvas.width, right = 0, bottom = 0;
        for (var y = 0; y < canvas.height; y++) {
            for (var x = 0; x < canvas.width; x++) {
                if (data[(y * canvas.width + x) * 4 + 3] > 0) {
                    if (y < top) top = y; if (y > bottom) bottom = y;
                    if (x < left) left = x; if (x > right) right = x;
                }
            }
        }
        if (top >= bottom || left >= right) return canvas;
        var w = right - left + 1, h = bottom - top + 1;
        var trimmed = document.createElement('canvas');
        trimmed.width = w; trimmed.height = h;
        trimmed.getContext('2d').drawImage(canvas, left, top, w, h, 0, 0, w, h);
        return trimmed;
    },

    // ========================================
    //   合并模式
    // ========================================

    _handleMergeFiles: function(files) {
        var self = this;
        var promises = Array.from(files).map(function(file) {
            return new Promise(function(resolve) {
                var reader = new FileReader();
                reader.onload = function(e) {
                    var img = new Image();
                    img.onload = function() {
                        resolve({ name: file.name, img: img, dataUrl: e.target.result });
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            });
        });
        Promise.all(promises).then(function(results) {
            self.state.mergeImages = self.state.mergeImages.concat(results);
            self._updateMergePreview();
            self._showToast('已添加 ' + results.length + ' 张图片');
        });
    },

    _updateMergePreview: function() {
        var imgs = this.state.mergeImages;
        if (imgs.length === 0) {
            this._q('#ttMergeEmpty').style.display = 'block';
            this._q('#ttMergePreviewContainer').style.display = 'none';
            this._q('#ttMergeBtn').disabled = true;
            this._q('#ttMergeCount').textContent = '';
            return;
        }
        this._q('#ttMergeEmpty').style.display = 'none';
        this._q('#ttMergePreviewContainer').style.display = 'block';
        this._q('#ttMergeBtn').disabled = false;
        this._q('#ttMergeCount').textContent = '共 ' + imgs.length + ' 张素材';

        var cols = parseInt(this._q('#mergeCols').value);
        var padX = parseInt(this._q('#mergePadX').value);
        var padY = parseInt(this._q('#mergePadY').value);
        var padding = parseInt(this._q('#mergePadding').value);
        var grid = this._q('#ttMergeGrid');
        grid.style.gridTemplateColumns = 'repeat(' + Math.min(cols, imgs.length) + ', 80px)';
        grid.style.columnGap = padX + 'px';
        grid.style.rowGap = padY + 'px';
        grid.style.padding = padding + 'px';
        grid.innerHTML = '';
        var self = this;
        imgs.forEach(function(item, i) {
            var div = document.createElement('div');
            div.className = 'tt-merge-item';
            div.style.height = '80px';
            div.innerHTML =
                '<span class="tt-idx">' + (i + 1) + '</span>' +
                '<img src="' + item.dataUrl + '" title="' + item.name + '">' +
                '<button class="tt-del-btn" data-merge-del="' + i + '">\u00d7</button>';
            div.querySelector('.tt-del-btn').addEventListener('click', function(e) {
                e.stopPropagation();
                self.state.mergeImages.splice(i, 1);
                self._updateMergePreview();
            });
            grid.appendChild(div);
        });
        this._q('#ttMergeBgColorGroup').style.display = this._q('#mergeBgTransparent').checked ? 'none' : 'block';
    },

    _clearMergeItems: function() {
        this.state.mergeImages = [];
        this._updateMergePreview();
    },

    _sortMergeItems: function(by) {
        if (by === 'name') {
            this.state.mergeImages.sort(function(a, b) { return a.name.localeCompare(b.name); });
        } else {
            this.state.mergeImages.sort(function(a, b) { return (b.img.width * b.img.height) - (a.img.width * a.img.height); });
        }
        this._updateMergePreview();
        this._showToast('已按' + (by === 'name' ? '名称' : '尺寸') + '排序');
    },

    _mergeAndDownload: function() {
        if (this.state.mergeImages.length === 0) return;
        var cols = parseInt(this._q('#mergeCols').value);
        var padX = parseInt(this._q('#mergePadX').value);
        var padY = parseInt(this._q('#mergePadY').value);
        var padding = parseInt(this._q('#mergePadding').value);
        var uniform = this._q('#mergeUniform').checked;
        var transparent = this._q('#mergeBgTransparent').checked;
        var bgColor = this._q('#mergeBgColor').value;
        var format = this._q('#mergeFormat').value;
        var mimeType = format === 'webp' ? 'image/webp' : 'image/png';
        var ext = format === 'webp' ? '.webp' : '.png';
        var imgs = this.state.mergeImages;

        var cellW = 0, cellH = 0;
        if (uniform) imgs.forEach(function(item) { cellW = Math.max(cellW, item.img.width); cellH = Math.max(cellH, item.img.height); });

        var maxRowW = 0, totalH = 0, rowH = 0, rowW = 0, rowCount = 0;
        imgs.forEach(function(item, i) {
            var iw = uniform ? cellW : item.img.width, ih = uniform ? cellH : item.img.height;
            rowW += iw; rowH = Math.max(rowH, ih); rowCount++;
            if (rowCount === cols || i === imgs.length - 1) {
                maxRowW = Math.max(maxRowW, rowW + (rowCount - 1) * padX);
                totalH += rowH;
                if (i < imgs.length - 1) totalH += padY;
                rowW = 0; rowH = 0; rowCount = 0;
            }
        });
        var canvasW = maxRowW + padding * 2, canvasH = totalH + padding * 2;
        var canvas = document.createElement('canvas');
        canvas.width = canvasW; canvas.height = canvasH;
        var ctx = canvas.getContext('2d');
        if (!transparent) { ctx.fillStyle = bgColor; ctx.fillRect(0, 0, canvasW, canvasH); }

        var cx = padding, cy = padding, curRowH = 0, colIdx = 0;
        imgs.forEach(function(item, i) {
            var iw = uniform ? cellW : item.img.width, ih = uniform ? cellH : item.img.height;
            var ox = uniform ? cx + (cellW - item.img.width) / 2 : cx;
            var oy = uniform ? cy + (cellH - item.img.height) / 2 : cy;
            ctx.drawImage(item.img, ox, oy);
            curRowH = Math.max(curRowH, ih); cx += iw + padX; colIdx++;
            if (colIdx === cols) { cy += curRowH + padY; cx = padding; curRowH = 0; colIdx = 0; }
        });

        // Show result
        var resultCanvas = this._q('#ttMergeResultCanvas');
        resultCanvas.width = canvasW; resultCanvas.height = canvasH;
        resultCanvas.getContext('2d').drawImage(canvas, 0, 0);
        this._q('#ttMergeResultContainer').style.display = 'block';

        var dataUrl = canvas.toDataURL(mimeType, 0.95);
        var a = document.createElement('a');
        a.href = dataUrl; a.download = 'tilemap_merged' + ext; a.click();
        this._showToast('合并完成! (' + canvasW + '\u00d7' + canvasH + ')');
    }
};
