/**
 * ============================================
 *   叠图替换插件 - v65 技能 (独立窗口版)
 *   Marching Squares 自动叠图绘制工具
 *   支持自定义贴图上图
 * ============================================
 *
 * 用法：
 * - 左键点击网格交叉点放置标记
 * - 右键点击删除标记
 * - 拖拽连续画线
 * - 中键 / Alt+左键 平移画布
 * - 滚轮缩放
 * - 通过独立窗口操作，可上传自定义贴图
 *
 * Marching Squares 规则：
 *   0个标记 → 无瓦片
 *   1个标记 → 角瓦片
 *   2个标记（对角）→ 对角瓦片
 *   2个标记（相邻）→ 直线瓦片
 *   3个标记 → 三角瓦片
 *   4个标记 → 满格瓦片
 */
var TileReplaceSkill = {

    // ===== 基本信息 =====
    id: 'tile-replace',
    name: '地',
    icon: '<span style="color:#ef4444;">地</span>',
    description: '地图编辑',
    key: '5',

    // ===== 内部状态 =====
    _world: null,
    _overlay: null,       // 窗口 DOM
    _canvas: null,        // 主画布
    _ctx: null,
    _gridSize: 16,
    _isPlacing: false,
    _isDeleting: false,
    _isEmptying: false,
    _lastIntersection: null,

    // 画布视图状态（独立于世界层）
    _view: { offsetX: 0, offsetY: 0, scale: 1 },
    _isPanning: false,
    _panStart: null,

    _showGrid: true,
    _autoRotate: true,
    _activeTool: 'brush', // 'brush' | 'eraser' | 'empty' | 'select'
    _selection: null,     // 框选 { sx, sy, ex, ey } 网格坐标
    _selDrag: null,       // 框选拖拽起点

    // 多层系统
    _layers: [],
    _activeLayerIdx: 0,
    _hasDefaultTextures: false,

    // 获取当前层数据
    _curr: function() { return this._layers[this._activeLayerIdx] || this._makeLayer(); },

    // 创建默认层
    _makeLayer: function(name) {
        return {
            name: name || '层' + (this._layers.length + 1),
            visible: true,
            points: {}, emptyPoints: {},
            atlasImage: null,
            atlasRegions: { dot:{x:0,y:0,w:32,h:32}, triangle:{x:32,y:0,w:32,h:32},
                diagonal:{x:64,y:0,w:32,h:32}, line:{x:96,y:0,w:32,h:32},
                full:{x:0,y:32,w:32,h:32}, empty:{x:32,y:32,w:32,h:32} },
            textureMode: 'none',
            textureImages: { dot:null, triangle:null, diagonal:null, line:null, full:null, empty:null },
            gridCols: 4, gridRows: 4,
            baseDirections: { dot:'br', line:'top', diagonal:'tlbr', triangle:'br', full:null },
            textureRotation: { dot:0, triangle:0, diagonal:0, line:0, full:0 }
        };
    },

    _regionEditing: null,   // 正在编辑的瓦片类型 key，null=不在编辑
    _regionDrag: null,      // 区域选择拖拽状态

    // 事件引用
    _resizeObserver: null,
    _onKeyDown: null,
    _onDocMouseDown: null,
    _onDocMouseMove: null,
    _onDocMouseUp: null,
    _onOverlayWheel: null,
    _onFileInput: null,

    // ===== 瓦片颜色（备用） =====
    _colors: {
        corner:   'rgba(45,212,191,0.65)',
        edge:     'rgba(96,165,250,0.65)',
        diagonal: 'rgba(167,139,250,0.65)',
        triangle: 'rgba(251,146,60,0.65)',
        full:     'rgba(56,189,248,0.70)',
        stroke:   'rgba(56,189,248,0.30)',
        point:    '#38bdf8',
        grid:     'rgba(255,220,180,0.08)',
        crosshair:'rgba(56,189,248,0.15)'
    },

    // ===== 生命周期 =====

    activate: function(world) {
        this._world = world;
        if (this._layers.length === 0) this._layers.push(this._makeLayer('层1'));
        if (this._overlay) {
            this._overlay.style.display = '';
            SkillSystem.renderSubTools();
            return;
        }
        this._createOverlay();
        SkillSystem.renderSubTools();
    },

    deactivate: function() {
        this._isPlacing = false;
        this._isDeleting = false;
        this._isEmptying = false;
    },

    _destroy: function() {
        this._unbindEvents();
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
        if (this._overlay && this._overlay.parentNode) {
            this._overlay.parentNode.removeChild(this._overlay);
        }
        this._overlay = null;
        this._canvas = null;
        this._ctx = null;
        this._curr().points = {};
        this._curr().emptyPoints = {};
        this._curr().atlasImage = null;
        this._curr().textureMode = 'none';
        for (var k in this._curr().textureImages) this._curr().textureImages[k] = null;
        this._lastIntersection = null;
    },

    // ===== 子工具栏 =====

    getSubTools: function() {
        var self = this;
        return [
            { label: '关', action: function() {
                if (self._overlay) self._overlay.style.display = 'none';
                if (typeof SkillSystem !== 'undefined') SkillSystem.deactivate();
            }}
        ];
    },

    save: function() {
        var layerData = [];
        for (var li = 0; li < this._layers.length; li++) {
            var l = this._layers[li];
            var texData = {};
            for (var kt in l.textureImages) {
                if (l.textureImages[kt] && l.textureImages[kt].dataURL) {
                    texData[kt] = l.textureImages[kt].dataURL;
                }
            }
            var regions = {};
            for (var kr in l.atlasRegions) {
                regions[kr] = { x: l.atlasRegions[kr].x, y: l.atlasRegions[kr].y, w: l.atlasRegions[kr].w, h: l.atlasRegions[kr].h };
            }
            layerData.push({
                name: l.name, visible: l.visible,
                points: l.points, emptyPoints: l.emptyPoints,
                atlasImage: false, // flag only; actual image not serializable
                textureMode: l.textureMode,
                gridCols: l.gridCols, gridRows: l.gridRows,
                atlasRegions: regions,
                textureData: texData,
                baseDirections: { dot: l.baseDirections.dot, triangle: l.baseDirections.triangle,
                    diagonal: l.baseDirections.diagonal, line: l.baseDirections.line },
                textureRotation: { dot: l.textureRotation.dot, triangle: l.textureRotation.triangle,
                    diagonal: l.textureRotation.diagonal, line: l.textureRotation.line }
            });
        }
        return {
            layers: layerData,
            activeLayerIdx: this._activeLayerIdx,
            gridSize: this._gridSize,
            showGrid: this._showGrid,
            autoRotate: this._autoRotate,
            view: { offsetX: this._view.offsetX, offsetY: this._view.offsetY, scale: this._view.scale }
        };
    },

    load: function(data) {
        if (!data) return;
        if (data.gridSize) this._gridSize = data.gridSize;
        if (data.showGrid !== undefined) this._showGrid = data.showGrid;
        if (data.autoRotate !== undefined) this._autoRotate = data.autoRotate;
        if (data.view) this._view = data.view;

        // 恢复多层数据（新格式）
        if (data.layers && data.layers.length > 0) {
            this._layers = [];
            var self = this;
            var totalImgs = 0;
            data.layers.forEach(function(ld, idx) {
                var l = self._makeLayer(ld.name || ('层' + (idx + 1)));
                l.visible = ld.visible !== false;
                if (ld.points) { l.points = {}; for (var k in ld.points) if (ld.points.hasOwnProperty(k)) l.points[k] = true; }
                if (ld.emptyPoints) { l.emptyPoints = {}; for (var ke in ld.emptyPoints) if (ld.emptyPoints.hasOwnProperty(ke)) l.emptyPoints[ke] = true; }
                if (ld.textureMode) l.textureMode = ld.textureMode;
                if (ld.gridCols) l.gridCols = ld.gridCols;
                if (ld.gridRows) l.gridRows = ld.gridRows;
                if (ld.atlasRegions) { for (var kr in ld.atlasRegions) { if (l.atlasRegions[kr] && ld.atlasRegions[kr]) l.atlasRegions[kr] = ld.atlasRegions[kr]; } }
                if (ld.baseDirections) { for (var kd in ld.baseDirections) { if (l.baseDirections[kd] !== undefined) l.baseDirections[kd] = ld.baseDirections[kd]; } }
                if (ld.textureRotation) { for (var kr2 in ld.textureRotation) { if (l.textureRotation[kr2] !== undefined) l.textureRotation[kr2] = ld.textureRotation[kr2]; } }
                // 恢复贴图图片
                if (ld.textureData) {
                    var keys3 = Object.keys(ld.textureData);
                    keys3.forEach(function(k3) {
                        totalImgs++;
                        var img = new Image();
                        img.onload = function() {
                            l.textureImages[k3] = { image: img, dataURL: ld.textureData[k3] };
                            totalImgs--;
                            if (totalImgs <= 0) { self._renderAll(); self._updateTexturePreviews(); }
                        };
                        img.onerror = function() {
                            totalImgs--;
                            if (totalImgs <= 0) { self._renderAll(); self._updateTexturePreviews(); }
                        };
                        img.src = ld.textureData[k3];
                    });
                }
                self._layers.push(l);
            });
            if (data.activeLayerIdx !== undefined && data.activeLayerIdx < this._layers.length)
                this._activeLayerIdx = data.activeLayerIdx;
            if (totalImgs <= 0) { this._renderAll(); this._updateTexturePreviews(); }
            return;
        }

        // 旧格式兼容：single层
        if (this._layers.length === 0) this._layers.push(this._makeLayer('层1'));
        var l = this._curr();
        if (data.points) { l.points = {}; for (var k in data.points) if (data.points.hasOwnProperty(k)) l.points[k] = true; }
        if (data.emptyPoints) { l.emptyPoints = {}; for (var ke in data.emptyPoints) if (data.emptyPoints.hasOwnProperty(ke)) l.emptyPoints[ke] = true; }
        if (data.textureMode) l.textureMode = data.textureMode;
        if (data.gridCols) l.gridCols = data.gridCols;
        if (data.gridRows) l.gridRows = data.gridRows;
        if (this._el && this._el.gridCols) this._el.gridCols.value = l.gridCols;
        if (this._el && this._el.gridRows) this._el.gridRows.value = l.gridRows;
        if (data.baseDirections) { for (var kd in data.baseDirections) { if (l.baseDirections[kd] !== undefined) l.baseDirections[kd] = data.baseDirections[kd]; } }
        if (data.textureRotation) { for (var kr in data.textureRotation) { if (l.textureRotation[kr] !== undefined) l.textureRotation[kr] = data.textureRotation[kr]; } }
        if (data.atlasRegions) { for (var k2 in data.atlasRegions) { if (l.atlasRegions[k2] && data.atlasRegions[k2]) l.atlasRegions[k2] = data.atlasRegions[k2]; } }
        if (data.textureData) {
            var self = this;
            var keys = Object.keys(data.textureData);
            var loaded = 0;
            keys.forEach(function(k3) {
                var img = new Image();
                img.onload = function() { l.textureImages[k3] = { image: img, dataURL: data.textureData[k3] }; loaded++; if (loaded >= keys.length) { self._renderAll(); self._updateTexturePreviews(); } };
                img.onerror = function() { loaded++; if (loaded >= keys.length) { self._renderAll(); self._updateTexturePreviews(); } };
                img.src = data.textureData[k3];
            });
        } else {
            this._renderAll();
            this._updateTexturePreviews();
        }
    },

    // ===== 创建窗口 =====

    _createOverlay: function() {
        var self = this;
        var ov = document.createElement('div');
        ov.setAttribute('data-skill-id', this.id);
        this._overlay = ov;

        // 窗口样式（WindowHelper 会设置具体尺寸）
        ov.style.cssText =
            'position:fixed;z-index:9999;' +
            'background:#0f1525;color:#e8edf5;border-radius:12px;' +
            'border:1px solid rgba(100,160,255,0.15);' +
            'box-shadow:0 8px 40px rgba(0,0,0,0.6);overflow:hidden;' +
            'display:flex;flex-direction:column;font-size:13px;' +
            'min-width:600px;min-height:400px;' +
            'left:40px;top:40px;';

        ov.innerHTML =
            // 标题栏
            '<div class="tr-header" style="' +
            'display:flex;align-items:center;justify-content:space-between;' +
            'padding:8px 14px;background:rgba(20,30,60,0.8);' +
            'border-bottom:1px solid rgba(100,160,255,0.1);cursor:move;user-select:none;' +
            'flex-shrink:0;">' +
            '<span style="font-weight:600;color:#38bdf8;font-size:14px;">地图编辑器</span>' +
            '<span class="tr-close" style="' +
            'width:24px;height:24px;display:flex;align-items:center;justify-content:center;' +
            'border-radius:6px;cursor:pointer;color:#94a3b8;font-size:16px;' +
            'transition:background 0.15s;">×</span></div>' +

            // 工具栏
            '<div class="tr-toolbar" style="' +
            'display:flex;align-items:center;gap:6px;padding:6px 14px;' +
            'border-bottom:1px solid rgba(100,160,255,0.08);flex-shrink:0;' +
            'flex-wrap:wrap;">' +
            '<button class="tr-tb tn-grid ac-grid">网格</button>' +
            '<span style="color:#475569;">|</span>' +
            '<label class="tr-toggle" style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#94a3b8;cursor:pointer;user-select:none;">' +
            '<span class="tr-toggle-label" style="color:#38bdf8;">画笔</span>' +
            '<input type="checkbox" class="tr-toggle-input" style="display:none;">' +
            '<span class="tr-toggle-switch" style="' +
            'width:28px;height:14px;border-radius:7px;background:rgba(56,189,248,0.25);' +
            'position:relative;transition:background 0.2s;flex-shrink:0;">' +
            '<span class="tr-toggle-knob" style="' +
            'width:12px;height:12px;border-radius:50%;background:#38bdf8;' +
            'position:absolute;top:1px;left:1px;transition:left 0.2s;"></span></span>' +
            '<span class="tr-toggle-label" style="color:#475569;">空笔</span></label>' +
            '<button class="tr-tb tn-eraser ac-eraser" style="btn">橡皮擦</button>' +
            '<span style="color:#475569;">|</span>' +
            '<button class="tr-tb tn-select ac-select" style="btn">框选</button>' +
            '<button class="tr-tb tn-save disabled ac-select" style="opacity:0.4;" disabled>保存选区</button>' +
            '<button class="tr-tb tn-godot" style="font-size:10px;padding:4px 8px;border-radius:6px;border:1px solid rgba(52,211,153,0.2);background:rgba(52,211,153,0.08);color:#34d399;cursor:pointer;">Godot导出</button>' +
            '<button class="tr-tb tn-cloud-export" style="font-size:10px;padding:4px 8px;border-radius:6px;border:1px solid rgba(56,189,248,0.2);background:rgba(56,189,248,0.08);color:#38bdf8;cursor:pointer;">盘导出</button>' +
            '<span style="color:#475569;">|</span>' +
            '<button class="tr-tb tn-clear ac-danger">清空</button>' +
            '<span style="color:#475569;">|</span>' +
            '<span style="color:#94a3b8;font-size:11px;">格:</span>' +
            '<input type="range" class="tr-size-slider" min="16" max="64" step="8" value="16" ' +
            'style="width:56px;accent-color:#38bdf8;">' +
            '<span class="tr-size-label" style="font-size:11px;min-width:20px;">16</span>' +
            '<span style="color:#475569;">|</span>' +
            '<span style="color:#94a3b8;font-size:11px;">标记:</span>' +
            '<span class="tr-point-count" style="color:#38bdf8;font-size:11px;min-width:30px;">0</span>' +
            '</div>' +

            // 主体（画布 + 右侧贴图面板）
            '<div class="tr-body" style="display:flex;flex:1;overflow:hidden;">' +
            // 画布
            '<div class="tr-canvas-wrap" style="flex:1;position:relative;overflow:hidden;">' +
            '<canvas class="tr-main-canvas" style="position:absolute;top:0;left:0;"></canvas>' +
            '<div class="tr-status-overlay" style="' +
            'position:absolute;bottom:6px;left:10px;font-size:11px;color:#475569;' +
            'pointer-events:none;">' +
            '<span class="tr-status-text"></span></div></div>' +

            // 左侧图层栏（窄条）
            '<div class="tr-layer-panel" style="' +
            'width:90px;flex-shrink:0;border-left:1px solid rgba(100,160,255,0.08);' +
            'display:flex;flex-direction:column;overflow:hidden;">' +
            '<div style="font-size:10px;color:#475569;padding:4px 6px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;">' +
            '图层 <span class="tr-add-layer" style="color:#38bdf8;cursor:pointer;font-size:12px;">+</span></div>' +
            '<div class="tr-layer-list" style="flex:1;overflow-y:auto;padding:2px 0;"></div></div>' +

            // 右侧贴图面板
            '<div class="tr-texture-panel" style="' +
            'width:220px;flex-shrink:0;border-left:1px solid rgba(100,160,255,0.08);' +
            'display:flex;flex-direction:column;overflow:hidden;">' +

            // 贴图标题 + 导入按钮
            '<div style="padding:8px 10px;border-bottom:1px solid rgba(100,160,255,0.05);' +
            'display:flex;align-items:center;justify-content:space-between;flex-shrink:0;flex-wrap:wrap;gap:4px;">' +
            '<span style="font-size:12px;color:#94a3b8;">贴图</span>' +
            '<div style="display:flex;flex-wrap:wrap;gap:4px;">' +
            '<button class="tr-export-btn" style="' +
            'font-size:11px;padding:3px 6px;border-radius:6px;border:1px solid rgba(251,191,36,0.35);' +
            'background:rgba(251,191,36,0.12);color:#fbbf24;cursor:pointer;">导出模板</button>' +
            '<button class="tr-import-btn" style="' +
            'font-size:11px;padding:3px 8px;border-radius:6px;border:1px solid rgba(56,189,248,0.3);' +
            'background:rgba(56,189,248,0.1);color:#38bdf8;cursor:pointer;">导入</button>' +
            '<button class="tr-cloud-import" style="font-size:10px;padding:3px 6px;border-radius:4px;border:1px solid rgba(251,191,36,0.25);' +
            'background:rgba(251,191,36,0.08);color:#fbbf24;cursor:pointer;">盘导入</button></div>' +
            // 重置/清空按钮行
            '<div style="display:flex;flex-wrap:wrap;gap:4px;padding:4px 10px;flex-shrink:0;">' +
            '<button class="tr-reset-btn" style="flex:1;font-size:10px;padding:2px 6px;border-radius:4px;border:1px solid rgba(100,160,255,0.1);' +
            'background:transparent;color:#475569;cursor:pointer;">重置为默认颜色</button>' +
            '<button class="tr-clear-tex-btn" style="font-size:10px;padding:2px 6px;border-radius:4px;border:1px solid rgba(248,113,113,0.2);' +
            'background:transparent;color:#f87171;cursor:pointer;">清空贴图</button></div></div>' +
            // 图集预览
            '<div class="tr-atlas-wrap" style="' +
            'padding:8px 10px;border-bottom:1px solid rgba(100,160,255,0.05);flex-shrink:0;">' +
            '<div class="tr-hint" style="font-size:10px;color:#475569;margin-bottom:4px;' +
            'min-height:16px;">图集预览</div>' +
            '<canvas class="tr-atlas-canvas" style="width:100%;image-rendering:pixelated;' +
            'border:1px solid rgba(100,160,255,0.1);border-radius:4px;cursor:crosshair;"></canvas>' +
            // 网格行列数
            '<div style="display:flex;gap:8px;margin-top:4px;align-items:center;">' +
            '<span style="font-size:10px;color:#475569;">列:</span>' +
            '<input class="tr-grid-cols" type="number" min="1" max="20" value="4" ' +
            'style="width:36px;font-size:10px;padding:1px 2px;border:1px solid rgba(100,160,255,0.15);' +
            'border-radius:3px;background:rgba(20,30,60,0.5);color:#e8edf5;text-align:center;">' +
            '<span style="font-size:10px;color:#475569;">行:</span>' +
            '<input class="tr-grid-rows" type="number" min="1" max="20" value="4" ' +
            'style="width:36px;font-size:10px;padding:1px 2px;border:1px solid rgba(100,160,255,0.15);' +
            'border-radius:3px;background:rgba(20,30,60,0.5);color:#e8edf5;text-align:center;"></div>' +
            '</div>' +
            // 瓦片列表
            '<div class="tr-tile-list" style="flex:1;overflow-y:auto;padding:6px 10px;"></div>' +
            '</div></div>' +

            // 状态栏
            '<div class="tr-footer" style="' +
            'padding:4px 14px;border-top:1px solid rgba(100,160,255,0.08);' +
            'font-size:11px;color:#475569;display:flex;align-items:center;' +
            'justify-content:space-between;flex-shrink:0;flex-basis:24px;min-height:24px;">' +
            '<span class="tr-footer-left">滚轮缩放 · 中键平移</span>' +
            '<span class="tr-footer-right"></span></div>';

        document.body.appendChild(ov);
        this._applyStyles();
        this._cacheElements();

        // 窗口缩放（四角+四边拖拽手柄，localStorage 记忆尺寸位置）
        if (typeof WindowHelper !== 'undefined') {
            WindowHelper.makeResizable(ov, {
                minWidth: 600,
                minHeight: 400,
                storeKey: 'tr-window-rect-v2'
            });
        }

        // ResizeObserver: 监听窗口尺寸变化，重绘画布
        this._resizeObserver = new ResizeObserver(function(entries) {
            for (var i = 0; i < entries.length; i++) {
                if (entries[i].target === ov) {
                    self._resizeCanvas();
                    break;
                }
            }
        });
        this._resizeObserver.observe(ov);

        this._bindWindowEvents();
        this._ensureDefaultTextures();
        this._renderLayerList();
        this._renderAll();
    },

    // ===== 样式（一次注入） =====

    _injectedCSS: false,
    _applyStyles: function() {
        if (TileReplaceSkill._injectedCSS) return;
        TileReplaceSkill._injectedCSS = true;
        var css = document.createElement('style');
        css.textContent =
            '.tr-tb{' +
            'font-size:11px;padding:4px 10px;border-radius:6px;border:1px solid rgba(100,160,255,0.12);' +
            'background:rgba(20,30,60,0.5);color:#94a3b8;cursor:pointer;transition:all 0.12s;' +
            'font-family:inherit;}' +
            '.tr-tb:hover{background:rgba(30,45,80,0.7);color:#e8edf5;border-color:rgba(100,180,255,0.3);}' +
            // 各按钮组不同颜色
            '.tr-tb.ac-grid{border-color:rgba(52,211,153,0.2);}' +
            '.tr-tb.ac-grid.active,.tr-tb.ac-grid:hover{color:#34d399;border-color:rgba(52,211,153,0.35);background:rgba(52,211,153,0.1);}' +
            '.tr-tb.ac-eraser{border-color:rgba(248,113,113,0.2);}' +
            '.tr-tb.ac-eraser.active,.tr-tb.ac-eraser:hover{color:#f87171;border-color:rgba(248,113,113,0.35);background:rgba(248,113,113,0.1);}' +
            '.tr-tb.ac-select{border-color:rgba(251,191,36,0.2);}' +
            '.tr-tb.ac-select.active,.tr-tb.ac-select:hover{color:#fbbf24;border-color:rgba(251,191,36,0.35);background:rgba(251,191,36,0.1);}' +
            '.tr-tb.ac-danger{border-color:rgba(248,113,113,0.25);}' +
            '.tr-tb.ac-danger.active,.tr-tb.ac-danger:hover{color:#f87171;border-color:rgba(248,113,113,0.4);background:rgba(248,113,113,0.15);}' +
            '.tr-tile-item{' +
            'display:flex;align-items:center;gap:8px;padding:4px 0;' +
            'border-bottom:1px solid rgba(100,160,255,0.04);cursor:pointer;' +
            'transition:background 0.1s;border-radius:4px;padding:4px 6px;}' +
            '.tr-tile-item:hover{background:rgba(56,189,248,0.06);}' +
            '.tr-tile-item.active{background:rgba(56,189,248,0.12);}' +
            '.tr-tile-preview{width:36px;height:36px;border-radius:4px;' +
            'border:1px solid rgba(100,160,255,0.1);flex-shrink:0;image-rendering:pixelated;}' +
            '.tr-tile-label{font-size:11px;color:#94a3b8;flex:1;}' +
            '.tr-tile-coord{font-size:9px;color:#475569;font-family:monospace;white-space:nowrap;}';
        document.head.appendChild(css);
    },

    // ===== 元素缓存 =====

    _cacheElements: function() {
        var ov = this._overlay;
        this._el = {
            header: ov.querySelector('.tr-header'),
            close: ov.querySelector('.tr-close'),
            canvasWrap: ov.querySelector('.tr-canvas-wrap'),
            canvas: ov.querySelector('.tr-main-canvas'),
            statusText: ov.querySelector('.tr-status-text'),
            footerLeft: ov.querySelector('.tr-footer-left'),
            footerRight: ov.querySelector('.tr-footer-right'),
            // 工具栏
            toggleInput: ov.querySelector('.tr-toggle-input'),
            toggleSwitch: ov.querySelector('.tr-toggle-switch'),
            toggleKnob: ov.querySelector('.tr-toggle-knob'),
            toggleLabels: ov.querySelectorAll('.tr-toggle-label'),
            btnEraser: ov.querySelector('.tn-eraser'),
            btnSelect: ov.querySelector('.tn-select'),
            btnGrid: ov.querySelector('.tn-grid'),
            btnClear: ov.querySelector('.tn-clear'),
            btnSave: ov.querySelector('.tn-save'),
            sizeSlider: ov.querySelector('.tr-size-slider'),
            sizeLabel: ov.querySelector('.tr-size-label'),
            pointCount: ov.querySelector('.tr-point-count'),
            // 贴图面板
            atlasWrap: ov.querySelector('.tr-atlas-wrap'),
            atlasCanvas: ov.querySelector('.tr-atlas-canvas'),
            hint: ov.querySelector('.tr-hint'),
            gridCols: ov.querySelector('.tr-grid-cols'),
            gridRows: ov.querySelector('.tr-grid-rows'),
            layerList: ov.querySelector('.tr-layer-list'),
            addLayer: ov.querySelector('.tr-add-layer'),
            tileList: ov.querySelector('.tr-tile-list'),
            importBtn: ov.querySelector('.tr-import-btn'),
            exportBtn: ov.querySelector('.tr-export-btn'),
            cloudImport: ov.querySelector('.tr-cloud-import'),
            cloudExport: ov.querySelector('.tn-cloud-export'),
            btnGodot: ov.querySelector('.tn-godot'),
            resetBtn: ov.querySelector('.tr-reset-btn'),
            clearTexBtn: ov.querySelector('.tr-clear-tex-btn')
        };
        this._canvas = this._el.canvas;
        this._ctx = this._canvas.getContext('2d');
        this._atlasCtx = this._el.atlasCanvas.getContext('2d');
    },

    // ===== 窗口事件绑定 =====

    _bindWindowEvents: function() {
        var self = this;
        var ov = this._overlay;
        var el = this._el;

        // 拖拽标题栏
        var dragging = false, dStartX, dStartY, dStartLeft, dStartTop;
        el.header.addEventListener('mousedown', function(e) {
            if (e.target.closest('.tr-close')) return;
            dragging = true;
            dStartX = e.clientX;
            dStartY = e.clientY;
            dStartLeft = ov.offsetLeft;
            dStartTop = ov.offsetTop;
            e.preventDefault();
        });
        this._onDocMouseMove = function(e) {
            if (dragging) {
                ov.style.left = (dStartLeft + e.clientX - dStartX) + 'px';
                ov.style.top = (dStartTop + e.clientY - dStartY) + 'px';
                return;
            }
            self._onCanvasMouseMove(e);
        };
        this._onDocMouseUp = function(e) {
            if (dragging) { dragging = false; return; }
            self._onCanvasMouseUp(e);
        };
        document.addEventListener('mousemove', this._onDocMouseMove);
        document.addEventListener('mouseup', this._onDocMouseUp);

        // 关闭按钮（只隐藏，不销毁数据）
        el.close.addEventListener('click', function() {
            self._overlay.style.display = 'none';
            if (typeof SkillSystem !== 'undefined') SkillSystem.deactivate();
        });

        // 工具栏
        el.toggleInput.addEventListener('change', function() {
            self._activeTool = this.checked ? 'empty' : 'brush';
            self._selection = null;
            self._selDrag = null;
            self._updateToolbar();
            self._renderAll();
        });
        el.btnEraser.addEventListener('click', function() {
            self._activeTool = 'eraser';
            self._selection = null;
            self._selDrag = null;
            self._updateToolbar();
            self._renderAll();
        });
        el.btnSelect.addEventListener('click', function() {
            self._activeTool = 'select';
            self._selection = null;
            self._selDrag = null;
            self._updateToolbar();
            self._renderAll();
        });
        el.btnSave.addEventListener('click', function() {
            self._exportSelection();
        });
        el.btnGrid.addEventListener('click', function() {
            self._showGrid = !self._showGrid;
            self._updateToolbar();
            self._renderAll();
        });
        el.btnClear.addEventListener('click', function() {
            if (Object.keys(self._curr().points).length === 0 && Object.keys(self._curr().emptyPoints).length === 0) return;
            self._curr().points = {};
            self._curr().emptyPoints = {};
            self._lastIntersection = null;
            self._renderAll();
            self._updatePointCount();
        });

        // 格子大小
        el.sizeSlider.addEventListener('input', function() {
            self._gridSize = parseInt(this.value);
            el.sizeLabel.textContent = self._gridSize;
            self._renderAll();
        });

        // 画布鼠标事件
        el.canvas.addEventListener('mousedown', function(e) { self._onCanvasMouseDown(e); });
        el.canvas.addEventListener('wheel', function(e) { self._onCanvasWheel(e); }, { passive: false });
        // 阻止整个窗口内的右键菜单
        ov.addEventListener('contextmenu', function(e) { e.preventDefault(); });

        // 贴图导入（支持多选：1张=图集模式，多张=一一对应）
        el.importBtn.addEventListener('click', function() {
            var input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/png,image/jpeg,image/gif,image/webp';
            input.multiple = true;
            self._onFileInput = function() {
                if (!input.files || input.files.length === 0) return;
                self._handleTextureImport(input.files);
                input.removeEventListener('change', self._onFileInput);
            };
            input.addEventListener('change', self._onFileInput);
            input.click();
        });

        // 图集网格行列数变化
        el.gridCols.addEventListener('change', function() {
            var v = parseInt(this.value);
            if (v > 0) { self._curr().gridCols = v; self._renderAtlasPreview(); self._buildTileList(); self._renderAll(); }
        });
        el.gridRows.addEventListener('change', function() {
            var v = parseInt(this.value);
            if (v > 0) { self._curr().gridRows = v; self._renderAtlasPreview(); self._buildTileList(); self._renderAll(); }
        });

        // 添加图层
        el.addLayer.addEventListener('click', function() {
            var name = '层' + (self._layers.length + 1);
            self._layers.push(self._makeLayer(name));
            self._activeLayerIdx = self._layers.length - 1;
            self._renderLayerList();
            self._renderAll();
            self._renderAtlasPreview();
            self._buildTileList();
        });

        // 盘导入：从云盘选图 — 有选中瓦片类型则替换单图，否则当整张图集导入
        el.cloudImport.addEventListener('click', function() {
            if (typeof CosCloudDrive === 'undefined') return;
            CosCloudDrive.setOnSelect(function(item) {
                var img = new Image();
                img.onload = function() {
                    if (self._regionEditing) {
                        // 独立6张模式：替换当前选中的瓦片类型
                        var ck = self._regionEditing;
                        self._curr().textureMode = 'multi';
                        self._curr().textureImages[ck] = { image: img, dataURL: item.dataURL };
                    } else {
                        // 整张图模式：当作图集导入
                        self._curr().textureMode = 'atlas';
                        self._curr().atlasImage = img;
                        var cols = self._curr().gridCols || 4;
                        var rows = self._curr().gridRows || 4;
                        var tileW = Math.round(img.width / cols);
                        var tileH = Math.round(img.height / rows);
                        self._curr().atlasRegions = {
                            dot:{x:0*tileW,y:0,w:tileW,h:tileH}, triangle:{x:1*tileW,y:0,w:tileW,h:tileH},
                            diagonal:{x:2*tileW,y:0,w:tileW,h:tileH}, line:{x:0,y:1*tileH,w:tileW,h:tileH},
                            full:{x:1*tileW,y:1*tileH,w:tileW,h:tileH}, empty:{x:2*tileW,y:1*tileH,w:tileW,h:tileH}
                        };
                        if (cols < 3) {
                            self._curr().atlasRegions.dot={x:0,y:0,w:tileW,h:tileH};
                            self._curr().atlasRegions.triangle={x:tileW,y:0,w:tileW,h:tileH};
                            self._curr().atlasRegions.diagonal={x:0,y:tileH,w:tileW,h:tileH};
                            self._curr().atlasRegions.line={x:tileW,y:tileH,w:tileW,h:tileH};
                            self._curr().atlasRegions.full={x:0,y:2*tileH,w:tileW,h:tileH};
                            self._curr().atlasRegions.empty={x:tileW,y:2*tileH,w:tileW,h:tileH};
                        }
                    }
                    self._renderAll();
                    self._renderAtlasPreview();
                    self._buildTileList();
                    if (typeof showToast === 'function') showToast('已从云盘导入');
                };
                img.src = item.dataURL;
                CosCloudDrive._overlay.style.display = 'none';
                CosCloudDrive.setOnSelect(null);
            });
            CosCloudDrive.open();
        });

        // Godot导出
        el.btnGodot.addEventListener('click', function() {
            self._exportGodot();
        });

        // 盘导出：导出当前框选区域到云盘（不下载）
        el.cloudExport.addEventListener('click', function() {
            self._exportSelectionToCloud();
        });

        // 导出参考图
        el.exportBtn.addEventListener('click', function() {
            self._exportReferenceSheet();
        });

        // 清空贴图（清除上传的图集和6张独立图，回到程序化颜色）
        el.clearTexBtn.addEventListener('click', function() {
            self._curr().atlasImage = null;
            self._curr().textureMode = 'none';
            for (var k in self._curr().textureImages) self._curr().textureImages[k] = null;
            self._hasDefaultTextures = false;
            self._renderAll();
            self._buildTileList();
            self._renderAtlasPreview();
        });

        // 重置贴图（清除所有贴图，恢复程序化颜色）
        el.resetBtn.addEventListener('click', function() {
            self._curr().atlasImage = null;
            self._curr().textureMode = 'none';
            for (var k in self._curr().textureImages) self._curr().textureImages[k] = null;
            self._resetRegions();
            self._renderAll();
            self._renderAtlasPreview();
            self._buildTileList();
        });

        // 键盘事件（空格平移）
        this._onKeyDown = function(e) {
            if (e.code === 'Space' && e.target.closest('.tr-canvas-wrap')) {
                e.preventDefault();
            }
            if (e.code === 'Escape' && self._selection) {
                self._selection = null;
                self._updateToolbar();
                self._renderAll();
            }
        };
        document.addEventListener('keydown', this._onKeyDown);

        // 窗口尺寸变化时更新画布
        this._resizeCanvas();
        this._onResize = function() { self._resizeCanvas(); };
        window.addEventListener('resize', this._onResize);
    },

    _unbindEvents: function() {
        if (this._onDocMouseMove) document.removeEventListener('mousemove', this._onDocMouseMove);
        if (this._onDocMouseUp) document.removeEventListener('mouseup', this._onDocMouseUp);
        if (this._onKeyDown) document.removeEventListener('keydown', this._onKeyDown);
        if (this._onResize) window.removeEventListener('resize', this._onResize);
    },

    // ===== 画布管理 =====

    _resizeCanvas: function() {
        var wrap = this._el.canvasWrap;
        if (!wrap || !this._canvas) return;
        var w = wrap.clientWidth;
        var h = wrap.clientHeight;
        var dpr = window.devicePixelRatio || 1;
        this._canvas.style.width = w + 'px';
        this._canvas.style.height = h + 'px';
        this._canvas.width = Math.round(w * dpr);
        this._canvas.height = Math.round(h * dpr);
        this._renderAll();
    },

    // ===== 画布鼠标交互 =====

    _onCanvasMouseDown: function(e) {
        if (e.button === 1 || e.button === 0 && e.altKey) {
            this._isPanning = true;
            this._panStart = { x: e.clientX, y: e.clientY, ox: this._view.offsetX, oy: this._view.offsetY, btn: e.button };
            e.preventDefault();
            return;
        }
        if (this._activeTool === 'select') {
            if (e.button === 0) {
                var rect = this._canvas.getBoundingClientRect();
                var px = e.clientX - rect.left;
                var py = e.clientY - rect.top;
                var wx = (px - this._view.offsetX) / this._view.scale;
                var wy = (py - this._view.offsetY) / this._view.scale;
                var cx = Math.round(wx / this._gridSize);
                var cy = Math.round(wy / this._gridSize);
                this._selDrag = { sx: cx, sy: cy, ex: cx, ey: cy };
                this._selection = null;
                e.preventDefault();
            }
            return;
        }
        if (e.button === 0) {
            if (this._activeTool === 'empty') {
                this._isEmptying = true;
                this._isPlacing = false;
                this._isDeleting = false;
            } else {
                this._isPlacing = true;
                this._isDeleting = false;
                this._isEmptying = false;
                this._activeTool = 'brush';
            }
        } else if (e.button === 2) {
            this._isDeleting = true;
            this._isPlacing = false;
            this._activeTool = 'eraser';
            e.preventDefault();
        } else return;
        this._lastIntersection = null;
        this._handleCanvasClick(e);
        this._updateToolbar();
    },

    _onCanvasMouseMove: function(e) {
        if (this._isPanning && this._panStart) {
            this._view.offsetX = this._panStart.ox + (e.clientX - this._panStart.x);
            this._view.offsetY = this._panStart.oy + (e.clientY - this._panStart.y);
            this._renderAll();
            return;
        }
        if (this._selDrag) {
            var rect = this._canvas.getBoundingClientRect();
            var px = e.clientX - rect.left;
            var py = e.clientY - rect.top;
            var wx = (px - this._view.offsetX) / this._view.scale;
            var wy = (py - this._view.offsetY) / this._view.scale;
            this._selDrag.ex = Math.round(wx / this._gridSize);
            this._selDrag.ey = Math.round(wy / this._gridSize);
            this._renderAll();
            return;
        }
        if (!this._isPlacing && !this._isDeleting && !this._isEmptying) return;
        this._handleCanvasClick(e);
    },

    _onCanvasMouseUp: function(e) {
        if (this._isPanning) {
            var wasPan = this._panStart;
            this._isPanning = false;
            this._panStart = null;
            // 中键点击（未拖拽）→ 切换空笔
            if (wasPan && wasPan.btn === 1 && Math.abs(e.clientX - wasPan.x) < 5 && Math.abs(e.clientY - wasPan.y) < 5) {
                this._activeTool = 'empty';
                this._updateToolbar();
                // 在该位置放空标记
                var rect = this._canvas.getBoundingClientRect();
                var px = e.clientX - rect.left;
                var py = e.clientY - rect.top;
                var wx = (px - this._view.offsetX) / this._view.scale;
                var wy = (py - this._view.offsetY) / this._view.scale;
                var cx = Math.round(wx / this._gridSize);
                var cy = Math.round(wy / this._gridSize);
                var key = cx + ',' + cy;
                delete this._curr().points[key];
                this._curr().emptyPoints[key] = true;
                this._renderAll();
                this._updatePointCount();
                return;
            }
        }
        if (this._selDrag) {
            var sx2 = Math.min(this._selDrag.sx, this._selDrag.ex);
            var sy2 = Math.min(this._selDrag.sy, this._selDrag.ey);
            var ex2 = Math.max(this._selDrag.sx, this._selDrag.ex);
            var ey2 = Math.max(this._selDrag.sy, this._selDrag.ey);
            if (ex2 - sx2 < 1 || ey2 - sy2 < 1) {
                this._selection = null;
            } else {
                this._selection = { sx: sx2, sy: sy2, ex: ex2, ey: ey2 };
            }
            this._selDrag = null;
            this._updateToolbar();
            this._renderAll();
            return;
        }
        if (e.button === 0) { this._isPlacing = false; this._isEmptying = false; }
        if (e.button === 2) this._isDeleting = false;
    },

    _onCanvasWheel: function(e) {
        e.preventDefault();
        var rect = this._canvas.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var my = e.clientY - rect.top;
        var dpr = window.devicePixelRatio || 1;

        // 鼠标在画布中的像素位置
        var px = mx;
        var py = my;

        // 鼠标位置对应的世界坐标
        var wx = (px - this._view.offsetX) / this._view.scale;
        var wy = (py - this._view.offsetY) / this._view.scale;

        // 缩放
        var factor = e.deltaY < 0 ? 1.12 : 0.88;
        var newScale = Math.max(0.1, Math.min(10, this._view.scale * factor));

        // 保持鼠标位置不变
        this._view.offsetX = px - wx * newScale;
        this._view.offsetY = py - wy * newScale;
        this._view.scale = newScale;

        this._updateFooter();
        this._renderAll();
    },

    _handleCanvasClick: function(e) {
        var rect = this._canvas.getBoundingClientRect();
        var px = (e.clientX - rect.left);
        var py = (e.clientY - rect.top);

        // 屏幕像素 → 画布世界坐标
        var wx = (px - this._view.offsetX) / this._view.scale;
        var wy = (py - this._view.offsetY) / this._view.scale;

        // 世界坐标 → 最近的网格交叉点
        var inter = {
            cx: Math.round(wx / this._gridSize),
            cy: Math.round(wy / this._gridSize)
        };

        if (this._lastIntersection &&
            this._lastIntersection.cx === inter.cx &&
            this._lastIntersection.cy === inter.cy) {
            return; // 跳过重复
        }
        this._lastIntersection = inter;

        var key = inter.cx + ',' + inter.cy;
        if (this._activeTool === 'brush') {
            delete this._curr().emptyPoints[key];
            this._curr().points[key] = true;
        } else if (this._activeTool === 'empty') {
            delete this._curr().points[key];
            this._curr().emptyPoints[key] = true;
        } else {
            delete this._curr().points[key];
            delete this._curr().emptyPoints[key];
        }
        this._renderAll();
        this._updatePointCount();
    },

    // ===== 贴图管理 =====

    // ===== 贴图导入分发 =====

    _handleTextureImport: function(files) {
        if (files.length === 1) {
            this._loadAtlas(files[0]);
        } else {
            this._loadMultipleTextures(files);
        }
    },

    _loadMultipleTextures: function(files) {
        var self = this;
        this._curr().textureMode = 'multi';
        this._curr().atlasImage = null;

        var tileKeys = ['dot', 'triangle', 'diagonal', 'line', 'full', 'empty'];
        // 清空旧的独立贴图
        for (var i = 0; i < tileKeys.length; i++) {
            self._curr().textureImages[tileKeys[i]] = null;
        }

        var total = Math.min(files.length, tileKeys.length);
        var loaded = 0;

        for (var i = 0; i < total; i++) {
            (function(file, key) {
                var reader = new FileReader();
                reader.onload = function(e) {
                    var img = new Image();
                    img.onload = function() {
                        self._curr().textureImages[key] = {
                            image: img,
                            dataURL: e.target.result
                        };
                        // 第一张图加载完后，自动匹配格子大小
                        if (loaded === 0) {
                            var as = Math.min(img.width, img.height);
                            if (as >= 8 && as <= 128 && [8,12,16,24,32,48,64,128].indexOf(as) >= 0) {
                                self._gridSize = as;
                                if (self._el.sizeSlider) self._el.sizeSlider.value = as;
                                if (self._el.sizeLabel) self._el.sizeLabel.textContent = as;
                            }
                        }
                        loaded++;
                        if (loaded >= total) {
                            self._renderAll();
                            self._renderAtlasPreview();
                            self._buildTileList();
                        }
                    };
                    img.src = e.target.result;
                };
                reader.readAsDataURL(file);
            })(files[i], tileKeys[i]);
        }
    },

    _loadAtlas: function(file) {
        var self = this;
        this._curr().textureMode = 'atlas';
        // 清空独立贴图
        for (var k in this._curr().textureImages) this._curr().textureImages[k] = null;

        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                self._curr().atlasImage = img;
                // 自动匹配格子大小到贴图尺寸
                var autoSize = Math.min(img.width, img.height);
                if (autoSize >= 8 && autoSize <= 128 && [8,12,16,24,32,48,64,128].indexOf(autoSize) >= 0) {
                    self._gridSize = autoSize;
                    if (self._el.sizeSlider) self._el.sizeSlider.value = autoSize;
                    if (self._el.sizeLabel) self._el.sizeLabel.textContent = autoSize;
                }
                // 用 UI 当前设置的行列数分割图集（用户手动设好后再导入）
                var cols = self._curr().gridCols || 4;
                var rows = self._curr().gridRows || 4;
                // 如果行列数乘积明显偏小（比如默认4x4但图片格子更多），尝试自动推算
                if (cols * rows < 6 && img.width > 32 && img.height > 32) {
                    var guessTile = 16;
                    while (guessTile <= 64) {
                        if (img.width % guessTile === 0 && img.height % guessTile === 0) break;
                        guessTile += 8;
                    }
                    if (img.width % guessTile === 0 && img.height % guessTile === 0) {
                        cols = Math.round(img.width / guessTile);
                        rows = Math.round(img.height / guessTile);
                    }
                }
                self._curr().gridCols = cols;
                self._curr().gridRows = rows;
                if (self._el.gridCols) self._el.gridCols.value = cols;
                if (self._el.gridRows) self._el.gridRows.value = rows;

                // 初始化每个瓦片类型在图集中的区域（各占一格）
                var tileW = Math.round(img.width / cols);
                var tileH = Math.round(img.height / rows);
                self._curr().atlasRegions = {
                    dot:      { x: 0 * tileW, y: 0,       w: tileW, h: tileH },
                    triangle: { x: 1 * tileW, y: 0,       w: tileW, h: tileH },
                    diagonal: { x: 2 * tileW, y: 0,       w: tileW, h: tileH },
                    line:     { x: 0,        y: 1 * tileH, w: tileW, h: tileH },
                    full:     { x: 1 * tileW, y: 1 * tileH, w: tileW, h: tileH },
                    empty:    { x: 2 * tileW, y: 1 * tileH, w: tileW, h: tileH }
                };
                // 如果列数不够3列，自动调整布局
                if (cols < 3) {
                    self._curr().atlasRegions.dot      = { x: 0,       y: 0,           w: tileW, h: tileH };
                    self._curr().atlasRegions.triangle  = { x: tileW,   y: 0,           w: tileW, h: tileH };
                    self._curr().atlasRegions.diagonal  = { x: 0,       y: tileH,       w: tileW, h: tileH };
                    self._curr().atlasRegions.line      = { x: tileW,   y: tileH,       w: tileW, h: tileH };
                    self._curr().atlasRegions.full      = { x: 0,       y: 2 * tileH,   w: tileW, h: tileH };
                    self._curr().atlasRegions.empty     = { x: tileW,   y: 2 * tileH,   w: tileW, h: tileH };
                }
                self._regionEditing = null;
                self._renderAll();
                self._renderAtlasPreview();
                self._buildTileList();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    _resetRegions: function() {
        this._curr().atlasRegions = {
            dot:      { x: 0, y: 0, w: 32, h: 32 },
            triangle: { x: 32, y: 0, w: 32, h: 32 },
            diagonal: { x: 64, y: 0, w: 32, h: 32 },
            line:     { x: 96, y: 0, w: 32, h: 32 },
            full:     { x: 0, y: 32, w: 32, h: 32 },
            empty:    { x: 32, y: 32, w: 32, h: 32 }
        };
        this._curr().gridCols = 4;
        this._curr().gridRows = 4;
        if (this._el && this._el.gridCols) this._el.gridCols.value = 4;
        if (this._el && this._el.gridRows) this._el.gridRows.value = 4;
        this._curr().baseDirections = { dot: 'br', line: 'top', diagonal: 'tlbr', triangle: 'br', full: null };
        this._curr().textureRotation = { dot: 0, triangle: 0, diagonal: 0, line: 0, full: 0 };
        this._regionEditing = null;
        this._curr().textureMode = 'none';
        for (var k in this._curr().textureImages) this._curr().textureImages[k] = null;
    },

    _renderAtlasPreview: function() {
        var ac = this._el.atlasCanvas;
        var ctx = this._atlasCtx;
        if (!ac || !ctx) return;

        var img = this._curr().atlasImage;
        var wrap = this._el.atlasWrap;
        var maxW = wrap ? wrap.clientWidth - 20 : 200;
        ac.style.width = maxW + 'px';

        if (!img && this._curr().textureMode !== 'multi') {
            // 没有贴图时显示空白提示
            ac.width = maxW;
            ac.height = 40;
            ctx.fillStyle = 'rgba(20,30,60,0.4)';
            ctx.fillRect(0, 0, maxW, 40);
            ctx.fillStyle = '#475569';
            ctx.font = '11px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('加载默认贴图中...', maxW / 2, 26);
            return;
        }

        // 多图模式：把所有独立图片排列显示（原图比例，可点击切换）
        if (this._curr().textureMode === 'multi') {
            this._renderMultiPreview(ac, ctx, maxW);
            return;
        }

        // 计算缩放比例
        var scale = Math.min(maxW / img.width, 120 / img.height);
        var dispW = Math.round(img.width * scale);
        var dispH = Math.round(img.height * scale);
        ac.width = dispW;
        ac.height = dispH;
        ac.style.width = dispW + 'px';
        ac.style.height = dispH + 'px';

        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, dispW, dispH);
        ctx.drawImage(img, 0, 0, dispW, dispH);

        // 绘制图集网格线
        var cellW = img.width / this._curr().gridCols;
        var cellH = img.height / this._curr().gridRows;
        ctx.strokeStyle = 'rgba(56,189,248,0.12)';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        for (var c = 1; c < this._curr().gridCols; c++) {
            var lx = Math.round(c * cellW * scale) + 0.5;
            ctx.moveTo(lx, 0); ctx.lineTo(lx, dispH);
        }
        for (var r = 1; r < this._curr().gridRows; r++) {
            var ly = Math.round(r * cellH * scale) + 0.5;
            ctx.moveTo(0, ly); ctx.lineTo(dispW, ly);
        }
        ctx.stroke();

        // 如果正在编辑某个区域，高亮并用半透明遮盖
        var editingKey = this._regionEditing;
        if (editingKey) {
            // 画半透明遮盖
            ctx.fillStyle = 'rgba(0,0,0,0.4)';
            ctx.fillRect(0, 0, dispW, dispH);

            // 高亮当前编辑的区域
            var reg = this._curr().atlasRegions[editingKey];
            if (reg) {
                ctx.clearRect(reg.x * scale, reg.y * scale, reg.w * scale, reg.h * scale);
                ctx.strokeStyle = '#38bdf8';
                ctx.lineWidth = 2;
                ctx.strokeRect(reg.x * scale, reg.y * scale, reg.w * scale, reg.h * scale);
            }
            ctx.fillStyle = '#38bdf8';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText(this._getTileLabel(editingKey), 4, 12);
        } else {
            // 画所有区域边框
            for (var k in this._curr().atlasRegions) {
                var r = this._curr().atlasRegions[k];
                var isActive = k === this._regionEditing;
                ctx.strokeStyle = isActive ? '#38bdf8' : 'rgba(56,189,248,0.25)';
                ctx.lineWidth = isActive ? 2 : 1;
                ctx.strokeRect(r.x * scale, r.y * scale, r.w * scale, r.h * scale);
            }
        }

        // 区域选框拖拽交互
        this._setupAtlasDrag(ac, scale);
        this._updateHint();
    },

    _setupAtlasDrag: function(ac, scale) {
        var self = this;
        var isDown = false, startX, startY;
        var moved = false;

        var onDown = function(e) {
            if (!self._regionEditing || !self._curr().atlasImage) return;
            var rect = ac.getBoundingClientRect();
            startX = (e.clientX - rect.left) / scale;
            startY = (e.clientY - rect.top) / scale;
            isDown = true;
            moved = false;
            self._regionDrag = { x1: startX, y1: startY, x2: startX, y2: startY };
        };
        var onMove = function(e) {
            if (!isDown || !self._regionDrag) return;
            var rect = ac.getBoundingClientRect();
            var cx = (e.clientX - rect.left) / scale;
            var cy = (e.clientY - rect.top) / scale;
            var dx = cx - startX, dy = cy - startY;
            if (dx * dx + dy * dy > 9) moved = true; // 超过3px视为拖拽
            self._regionDrag.x2 = cx;
            self._regionDrag.y2 = cy;
            self._renderAtlasPreview();
            self._drawDragRect(ac, scale);
        };
        var onUp = function() {
            if (!isDown || !self._regionDrag || !self._regionEditing) {
                isDown = false;
                return;
            }
            isDown = false;
            var d = self._regionDrag;
            var key = self._regionEditing;
            var reg = self._curr().atlasRegions[key];
            if (!reg) { self._regionDrag = null; return; }

            if (!moved) {
                // 点击选择：吸附到最近的网格
                var cellW = self._curr().atlasImage.width / self._curr().gridCols;
                var cellH = self._curr().atlasImage.height / self._curr().gridRows;
                var col = Math.floor((d.x1 + d.x2) / 2 / cellW);
                var row = Math.floor((d.y1 + d.y2) / 2 / cellH);
                col = Math.max(0, Math.min(self._curr().gridCols - 1, col));
                row = Math.max(0, Math.min(self._curr().gridRows - 1, row));
                reg.x = Math.round(col * cellW);
                reg.y = Math.round(row * cellH);
                reg.w = Math.round(cellW);
                reg.h = Math.round(cellH);
            } else {
                // 拖拽选框
                reg.x = Math.round(Math.min(d.x1, d.x2));
                reg.y = Math.round(Math.min(d.y1, d.y2));
                reg.w = Math.round(Math.abs(d.x2 - d.x1));
                reg.h = Math.round(Math.abs(d.y2 - d.y1));
                if (reg.w < 4) reg.w = 4;
                if (reg.h < 4) reg.h = 4;
            }
            self._regionDrag = null;
            self._renderAtlasPreview();
            self._buildTileList();
            self._renderAll();
        };

        // 清理旧监听器 (用 data 标记避免重复绑定)
        if (ac._dragCleanup) ac._dragCleanup();
        ac.addEventListener('mousedown', onDown);
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        ac._dragCleanup = function() {
            ac.removeEventListener('mousedown', onDown);
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        };
    },

    _drawDragRect: function(ac, scale) {
        var ctx = this._atlasCtx;
        var d = this._regionDrag;
        if (!d) return;

        var x = Math.min(d.x1, d.x2) * scale;
        var y = Math.min(d.y1, d.y2) * scale;
        var w = Math.abs(d.x2 - d.x1) * scale;
        var h = Math.abs(d.y2 - d.y1) * scale;

        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);

        // 显示尺寸
        ctx.fillStyle = '#fbbf24';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(Math.round(w / scale) + '×' + Math.round(h / scale), x + 4, y + 12);
    },

    _getTileLabel: function(key) {
        var labels = {
            dot: '点图', triangle: '三角', diagonal: '对角',
            line: '直线', full: '满格', empty: '空图'
        };
        return labels[key] || key;
    },

    // 渲染层列表
    _renderLayerList: function() {
        var list = this._el.layerList;
        if (!list) return;
        var self = this;
        list.innerHTML = '';
        this._layers.forEach(function(l, i) {
            var item = document.createElement('div');
            item.draggable = true;
            item.style.cssText =
                'display:flex;align-items:center;gap:4px;padding:2px 10px;font-size:11px;' +
                'cursor:pointer;border-bottom:1px solid rgba(100,160,255,0.03);' +
                (i === self._activeLayerIdx ? 'background:rgba(56,189,248,0.1);' : '');
            // 可见性
            var vis = document.createElement('span');
            vis.textContent = l.visible ? '👁' : '○';
            vis.style.cssText = 'font-size:9px;cursor:pointer;color:#94a3b8;width:14px;text-align:center;';
            vis.addEventListener('click', function(e) {
                e.stopPropagation();
                l.visible = !l.visible;
                self._renderLayerList();
                self._renderAll();
            });
            item.appendChild(vis);
            // 名称
            var name = document.createElement('span');
            name.textContent = l.name;
            name.style.cssText = 'flex:1;color:' + (i === self._activeLayerIdx ? '#38bdf8' : '#94a3b8') + ';';
            item.appendChild(name);
            // 点击选中
            item.addEventListener('click', function() {
                if (self._activeLayerIdx === i) return;
                self._activeLayerIdx = i;
                self._renderLayerList();
                self._renderAll();
                self._renderAtlasPreview();
                self._buildTileList();
            });
            // 删除
            if (self._layers.length > 1) {
                var del = document.createElement('span');
                del.textContent = '×';
                del.style.cssText = 'font-size:11px;color:#475569;cursor:pointer;padding:0 2px;';
                del.addEventListener('click', function(e) {
                    e.stopPropagation();
                    self._layers.splice(i, 1);
                    if (self._activeLayerIdx >= self._layers.length)
                        self._activeLayerIdx = self._layers.length - 1;
                    self._renderLayerList();
                    self._renderAll();
                    self._renderAtlasPreview();
                    self._buildTileList();
                });
                item.appendChild(del);
            }
            list.appendChild(item);
        });
        // 拖拽排序
        var dragSrc = null;
        list.querySelectorAll('[draggable=true]').forEach(function(el) {
            el.addEventListener('dragstart', function(e) {
                dragSrc = Array.prototype.indexOf.call(list.children, el);
                e.dataTransfer.effectAllowed = 'move';
            });
            el.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });
            el.addEventListener('drop', function(e) {
                e.preventDefault();
                var toIdx = Array.prototype.indexOf.call(list.children, el);
                if (dragSrc === null || dragSrc === toIdx) return;
                var moved = self._layers.splice(dragSrc, 1)[0];
                self._layers.splice(toIdx, 0, moved);
                if (self._activeLayerIdx === dragSrc) self._activeLayerIdx = toIdx;
                else if (dragSrc < self._activeLayerIdx && toIdx >= self._activeLayerIdx)
                    self._activeLayerIdx--;
                else if (dragSrc > self._activeLayerIdx && toIdx <= self._activeLayerIdx)
                    self._activeLayerIdx++;
                self._renderLayerList();
                self._renderAll();
            });
        });
    },

    // 各瓦片类型的方向选项（用于基准方向选择）
    _dirOptions: {
        dot:      { order: ['tl','tr','br','bl'], labels: ['↖','↗','↘','↙'] },
        triangle: { order: ['tl','tr','br','bl'], labels: ['↖','↗','↘','↙'] },
        line:     { order: ['top','right','bottom','left'], labels: ['↑','→','↓','←'] },
        diagonal: { order: ['tlbr','trbl'], labels: ['╲','╱'] }
    },

    _buildTileList: function() {
        var list = this._el.tileList;
        if (!list) return;
        var self = this;
        var keys = ['dot', 'triangle', 'diagonal', 'line', 'full', 'empty'];
        list.innerHTML = '';
        keys.forEach(function(k) {
            var reg = self._curr().atlasRegions[k];
            var isActive = self._regionEditing === k;
            var item = document.createElement('div');
            item.className = 'tr-tile-item' + (isActive ? ' active' : '');

            // 预览图
            var preview = document.createElement('canvas');
            preview.className = 'tr-tile-preview';
            preview.width = 36;
            preview.height = 36;
            var pctx = preview.getContext('2d');

            // 绘制预览图（根据基准方向旋转）
            var dirCfg = self._dirOptions[k];
            var baseDir = self._curr().baseDirections[k];
            var prevAngle = 0;
            if (dirCfg && self._autoRotate) {
                prevAngle = ((self._curr().textureRotation[k] || 0) % 4) * Math.PI / 2;
            }
            if (prevAngle !== 0) {
                pctx.save();
                pctx.translate(18, 18);
                pctx.rotate(prevAngle);
            }
            var multiTex = self._curr().textureImages[k];
            if (multiTex && multiTex.image) {
                pctx.imageSmoothingEnabled = false;
                pctx.drawImage(multiTex.image, 0, 0, multiTex.image.width, multiTex.image.height,
                    prevAngle ? -18 : 0, prevAngle ? -18 : 0, 36, 36);
            } else if (self._curr().atlasImage && reg) {
                pctx.imageSmoothingEnabled = false;
                pctx.drawImage(self._curr().atlasImage, reg.x, reg.y, reg.w, reg.h,
                    prevAngle ? -18 : 0, prevAngle ? -18 : 0, 36, 36);
            } else {
                pctx.fillStyle = self._getDefaultColor(k);
                pctx.fillRect(prevAngle ? -18 : 0, prevAngle ? -18 : 0, 36, 36);
            }
            if (prevAngle !== 0) pctx.restore();

            // 根据瓦片类型的标记点位置，在对应角画蓝点
            if (dirCfg && baseDir && self._autoRotate) {
                var markerCorners = self._getMarkerCorners(k, baseDir);
                var dotPos = { tl: [6,6], tr: [30,6], br: [30,30], bl: [6,30] };
                markerCorners.forEach(function(c) {
                    var p = dotPos[c];
                    if (!p) return;
                    pctx.fillStyle = 'rgba(56,189,248,0.8)';
                    pctx.beginPath();
                    pctx.arc(p[0], p[1], 4, 0, Math.PI * 2);
                    pctx.fill();
                    pctx.strokeStyle = '#38bdf8';
                    pctx.lineWidth = 1;
                    pctx.stroke();
                });
            }

            // 标签+坐标行（点击切换区域选择）
            var topRow = document.createElement('div');
            topRow.style.cssText = 'display:flex;align-items:center;gap:4px;width:100%;';
            var label = document.createElement('span');
            label.className = 'tr-tile-label';
            label.textContent = self._getTileLabel(k);
            topRow.appendChild(preview);
            topRow.appendChild(label);
            item.appendChild(topRow);

            // 旋转按钮：点击旋转图片，对准右下角的蓝点（满格/空图不需要）
            var dirOpts = self._dirOptions[k];
            if (dirOpts && self._autoRotate) {
                var rotRow = document.createElement('div');
                rotRow.style.cssText =
                    'display:flex;gap:6px;margin-top:2px;padding-left:40px;align-items:center;';

                var rotBtn = document.createElement('span');
                rotBtn.textContent = '↺旋转';
                rotBtn.style.cssText =
                    'font-size:10px;padding:1px 8px;border-radius:4px;cursor:pointer;' +
                    'border:1px solid rgba(56,189,248,0.2);' +
                    'background:rgba(56,189,248,0.08);color:#38bdf8;';
                rotBtn.title = '点击旋转图片，蓝点不动';
                rotBtn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    self._curr().textureRotation[k] = ((self._curr().textureRotation[k] || 0) + 1) % 4;
                    self._buildTileList();
                    self._renderAll();
                });
                rotRow.appendChild(rotBtn);
                item.appendChild(rotRow);
            }

            // 点击卡片 = 选择贴图区域（不干扰方向按钮）
            topRow.addEventListener('click', function() {
                self._regionEditing = isActive ? null : k;
                self._buildTileList();
                self._renderAtlasPreview();
            });

            list.appendChild(item);
        });
    },

    // 根据瓦片类型和基准方向，计算标记点所在的角
    _getMarkerCorners: function(tileType, baseDir) {
        if (tileType === 'dot') return [baseDir];
        if (tileType === 'triangle') {
            var all = ['tl', 'tr', 'br', 'bl'];
            return all.filter(function(d) { return d !== baseDir; });
        }
        if (tileType === 'diagonal') {
            if (baseDir === 'tlbr') return ['tl', 'br'];
            return ['tr', 'bl'];
        }
        if (tileType === 'line') {
            var map = { top: ['tl','tr'], right: ['tr','br'], bottom: ['bl','br'], left: ['tl','bl'] };
            return map[baseDir] || [];
        }
        return [];
    },
    // 导出选区到云盘（不下载）
    _exportSelectionToCloud: function() {
        var sel = this._selection;
        if (!sel) { if (typeof showToast === 'function') showToast('请先用框选工具选择区域'); return; }
        var gs = this._gridSize;
        var cols = sel.ex - sel.sx, rows = sel.ey - sel.sy;
        if (cols < 1 || rows < 1) return;
        var pw = cols * gs, ph = rows * gs;
        var c = document.createElement('canvas');
        c.width = pw; c.height = ph;
        var cx = c.getContext('2d');
        cx.imageSmoothingEnabled = false;
        var prevLayerIdx = this._activeLayerIdx;
        for (var li = 0; li < this._layers.length; li++) {
            if (!this._layers[li].visible) continue;
            this._activeLayerIdx = li;
            for (var tx = sel.sx; tx < sel.ex; tx++) {
                for (var ty = sel.sy; ty < sel.ey; ty++) {
                    var info = this._getTileType(tx, ty);
                    if (!info) continue;
                    var texKey;
                    if (info.empty) texKey = 'empty';
                    else if (info.count === 1) texKey = 'dot';
                    else if (info.count === 2) {
                        if (info.bits === 3 || info.bits === 5 || info.bits === 10 || info.bits === 12) texKey = 'line';
                        else texKey = 'diagonal';
                    } else if (info.count === 3) texKey = 'triangle';
                    else if (info.count === 4) texKey = 'full';
                    var ox = (tx - sel.sx) * gs, oy = (ty - sel.sy) * gs;
                    var texImg = this._getTileTexture(texKey);
                    if (texImg) {
                        this._drawTileTexture(cx, texKey, info, ox, oy, gs, gs, 1);
                    } else {
                        cx.fillStyle = 'rgba(100,160,255,0.06)';
                        cx.fillRect(ox, oy, gs, gs);
                    }
                }
            }
        }
        this._activeLayerIdx = prevLayerIdx;
        var dataURL = c.toDataURL('image/png');
        if (typeof CosCloudDrive !== 'undefined') {
            CosCloudDrive.add('选区图 ' + new Date().toLocaleTimeString(), '地图编辑', dataURL);
        }
        if (typeof showToast === 'function') showToast('已存入云盘');
    },

    // 导出参考图（6张独立 PNG，可 ZIP 打包或逐一保存）
    _exportReferenceSheet: function() {
        var self = this;
        var keys = ['dot', 'triangle', 'diagonal', 'line', 'full', 'empty'];
        var fileNames = { dot:'点图', triangle:'三角图', diagonal:'对角图', line:'直线图', full:'满格图', empty:'空图' };

        // 尝试用 JSZip 打包成 zip（JSZip 已在项目中引入）
        if (typeof JSZip !== 'undefined') {
            var zip = new JSZip();
            var pending = 0;

            keys.forEach(function(k) {
                var tex = self._curr().textureImages[k];
                if (!tex || !tex.image) return;
                var img = tex.image;
                var c = document.createElement('canvas');
                c.width = img.width || 16;
                c.height = img.height || 16;
                var cx = c.getContext('2d');
                cx.imageSmoothingEnabled = false;
                cx.drawImage(img, 0, 0);
                var dataURL = c.toDataURL('image/png');
                // dataURL → Blob
                var bin = atob(dataURL.split(',')[1]);
                var buf = new Uint8Array(bin.length);
                for (var i2 = 0; i2 < bin.length; i2++) buf[i2] = bin.charCodeAt(i2);
                zip.file(k + '.png', buf);
                pending++;
            });

            if (pending > 0) {
                zip.generateAsync({ type: 'blob' }).then(function(blob) {
                    var link = document.createElement('a');
                    link.download = 'tiles_reference.zip';
                    link.href = URL.createObjectURL(blob);
                    link.click();
                    URL.revokeObjectURL(link.href);
                });
            }
            return;
        }

        // 无 JSZip 时逐张下载
        keys.forEach(function(k) {
            var tex = self._curr().textureImages[k];
            if (!tex || !tex.image) return;
            var img = tex.image;
            var c = document.createElement('canvas');
            c.width = img.width || 16;
            c.height = img.height || 16;
            var cx = c.getContext('2d');
            cx.imageSmoothingEnabled = false;
            cx.drawImage(img, 0, 0);
            var link = document.createElement('a');
            link.download = fileNames[k] + '.png';
            link.href = c.toDataURL('image/png');
            link.click();
        });
    },

    // 导出选区为 PNG
    _exportSelection: function() {
        var sel = this._selection;
        if (!sel) return;
        var gs = this._gridSize;
        var cols = sel.ex - sel.sx;
        var rows = sel.ey - sel.sy;
        if (cols < 1 || rows < 1) return;

        // 用贴图原始尺寸导出，不拉伸
        var tileW = gs, tileH = gs;
        if (this._curr().textureMode === 'multi') {
            for (var _k in this._curr().textureImages) {
                if (this._curr().textureImages[_k] && this._curr().textureImages[_k].image) {
                    tileW = this._curr().textureImages[_k].image.width;
                    tileH = this._curr().textureImages[_k].image.height;
                    break;
                }
            }
        } else if (this._curr().atlasImage && this._curr().atlasRegions.dot) {
            tileW = this._curr().atlasRegions.dot.w;
            tileH = this._curr().atlasRegions.dot.h;
        }
        var pw = cols * tileW, ph = rows * tileH;
        var c = document.createElement('canvas');
        c.width = pw;
        c.height = ph;
        var cx = c.getContext('2d');
        cx.imageSmoothingEnabled = false;

        // 逐层渲染选区（可见层合成）
        var prevLayerIdx = this._activeLayerIdx;
        for (var li = 0; li < this._layers.length; li++) {
            if (!this._layers[li].visible) continue;
            this._activeLayerIdx = li;
            for (var tx = sel.sx; tx < sel.ex; tx++) {
                for (var ty = sel.sy; ty < sel.ey; ty++) {
                    var info = this._getTileType(tx, ty);
                    if (!info) continue;
                    var texKey;
                    if (info.empty) texKey = 'empty';
                    else if (info.count === 1) texKey = 'dot';
                    else if (info.count === 2) {
                        if (info.bits === 3 || info.bits === 5 || info.bits === 10 || info.bits === 12)
                            texKey = 'line';
                        else texKey = 'diagonal';
                    } else if (info.count === 3) texKey = 'triangle';
                    else if (info.count === 4) texKey = 'full';

                    var ox = (tx - sel.sx) * tileW, oy = (ty - sel.sy) * tileH;
                    var texImg = this._getTileTexture(texKey);
                    if (texImg) {
                        this._drawTileTexture(cx, texKey, info, ox, oy, tileW, tileH, 1);
                    } else {
                        var fillColors = {
                            0: 'rgba(100,160,255,0.06)',
                            1: this._colors.corner, 2: this._colors.edge,
                            3: this._colors.diagonal, 4: this._colors.triangle, 5: this._colors.full
                        };
                        var ck = info.count;
                        if (info.count === 2 && (info.bits === 6 || info.bits === 9)) ck = 3;
                        else if (info.count === 2) ck = 2;
                        cx.fillStyle = fillColors[ck] || this._colors.full;
                        cx.fillRect(ox, oy, tileW, tileH);
                    }
                }
            }
        }
        this._activeLayerIdx = prevLayerIdx;

        var link = document.createElement('a');
        link.download = 'tilemap_' + cols + 'x' + rows + '.png';
        link.href = c.toDataURL('image/png');
        link.click();
    },

    // 导出用：只画贴图不画边框标记，tileW/tileH 是导出尺寸
    // 在指定格子位置渲染特定瓦片类型（用于空图）
    _drawTileAs: function(ctx, texKey, tx, ty, gs, sc) {
        var x0 = tx * gs, y0 = ty * gs;
        var texImg = this._getTileTexture(texKey);
        var r = this._getTileRegion(texKey);
        var gap = 0.5 / sc;

        ctx.save();
        if (texImg) {
            if (this._curr().textureMode === 'multi' && this._curr().textureImages[texKey]) {
                var mi = this._curr().textureImages[texKey].image;
                ctx.drawImage(mi, 0, 0, mi.width, mi.height, x0 - gap, y0 - gap, gs + gap * 2, gs + gap * 2);
            } else if (r) {
                ctx.drawImage(texImg, r.x, r.y, r.w, r.h, x0 - gap, y0 - gap, gs + gap * 2, gs + gap * 2);
            }
        } else {
            ctx.fillStyle = 'rgba(100,160,255,0.08)';
            ctx.fillRect(x0 - gap, y0 - gap, gs + gap * 2, gs + gap * 2);
        }
        ctx.restore();
    },

    _drawTileTexture: function(ctx, texKey, info, x, y, tileW, tileH, sc) {
        var texImg;
        var region;
        if (this._curr().textureMode === 'multi' && this._curr().textureImages[texKey]) {
            texImg = this._curr().textureImages[texKey].image;
        } else if (this._curr().atlasImage && this._curr().atlasRegions[texKey]) {
            texImg = this._curr().atlasImage;
            region = this._curr().atlasRegions[texKey];
        }
        if (!texImg) return;

        // 用和主画布相同的旋转计算
        var rotAngle = 0;
        if (this._autoRotate) {
            var baseDir = this._curr().baseDirections[texKey];
            var markDir = '';
            if (info.count === 1) {
                if (info.tl) markDir = 'tl'; else if (info.tr) markDir = 'tr';
                else if (info.br) markDir = 'br'; else if (info.bl) markDir = 'bl';
            } else if (info.count === 2) {
                if (info.bits === 3) markDir = 'top'; else if (info.bits === 12) markDir = 'bottom';
                else if (info.bits === 5) markDir = 'left'; else if (info.bits === 10) markDir = 'right';
                else if (info.bits === 9) markDir = 'tlbr'; else if (info.bits === 6) markDir = 'trbl';
            } else if (info.count === 3) {
                if (!info.tl) markDir = 'tl'; else if (!info.tr) markDir = 'tr';
                else if (!info.bl) markDir = 'bl'; else if (!info.br) markDir = 'br';
            }
            if (baseDir && markDir) {
                var dirCfg = this._dirOptions[texKey];
                if (dirCfg) {
                    var idxBase = dirCfg.order.indexOf(baseDir);
                    var idxMark = dirCfg.order.indexOf(markDir);
                    if (idxBase >= 0 && idxMark >= 0) {
                        var extra = this._curr().textureRotation[texKey] || 0;
                        var diff = (idxMark - idxBase + dirCfg.order.length + extra) % dirCfg.order.length;
                        rotAngle = diff * Math.PI / 2;
                    }
                }
            }
        }

        var gap = 0.5 / sc;
        if (rotAngle !== 0) {
            ctx.save();
            ctx.translate(x + tileW / 2, y + tileH / 2);
            ctx.rotate(rotAngle);
            ctx.drawImage(texImg, region ? region.x : 0, region ? region.y : 0,
                region ? region.w : texImg.width, region ? region.h : texImg.height,
                -tileW / 2 - gap, -tileH / 2 - gap, tileW + gap * 2, tileH + gap * 2);
            ctx.restore();
        } else {
            ctx.drawImage(texImg, region ? region.x : 0, region ? region.y : 0,
                region ? region.w : texImg.width, region ? region.h : texImg.height,
                x - gap, y - gap, tileW + gap * 2, tileH + gap * 2);
        }
    },

    // 多图模式预览（原图比例，可点击切换图片对应关系）
    // 默认贴图（硬编码 base64，打开即用，无需生成或加载文件）
    _defaultBase64: {
        dot: "data:image/png;base64,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",
        triangle: "data:image/png;base64,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",
        diagonal: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQBAMAAADt3eJSAAAAAXNSR0IB2cksfwAAAAlwSFlzAAALEwAACxMBAJqcGAAAABJQTFRFoqZew75qci8hhTgpS2M6kZteFOiQVQAAAE9JREFUeJxjZGBgYFQUBBKEGIwCYAaDkIAghMGoCJECCTEwujD8OcAAUqPEwCRzACStxMDAdAfEMGZ4D2P8//DuA5jB8B6JwfobwvjK8BsA82YWmFB4JoEAAAAASUVORK5CYII=",
        line: "data:image/png;base64,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",
        full: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQAQMAAAAlPW0iAAAAAXNSR0IB2cksfwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAANQTFRFoqZeCQjTSAAAAA5JREFUeJxjZGBgJAUBAAHIABFDZFrTAAAAAElFTkSuQmCC",
        empty: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQAQMAAAAlPW0iAAAAAXNSR0IB2cksfwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAANQTFRFhTgpFanAJgAAAA5JREFUeJxjZGBgJAUBAAHIABFDZFrTAAAAAElFTkSuQmCC"
    },

    _ensureDefaultTextures: function() {
        if (this._hasDefaultTextures) return;
        if (this._curr().textureMode !== 'none') return;
        this._hasDefaultTextures = true;
        this._curr().textureMode = 'multi';

        var self = this;

        // 先用 canvas 生成占位图（同步，立即可见）
        var keys2 = ['dot', 'triangle', 'diagonal', 'line', 'full', 'empty'];
        var colors2 = [[45,212,191],[251,146,60],[167,139,250],[96,165,250],[56,189,248],[100,160,255]];
        keys2.forEach(function(k, i) {
            var c = document.createElement('canvas');
            c.width = 16; c.height = 16;
            var cx = c.getContext('2d');
            var r = colors2[i][0], g = colors2[i][1], b = colors2[i][2];
            cx.fillStyle = 'rgba('+r+','+g+','+b+',0.25)'; cx.fillRect(0,0,16,16);
            cx.strokeStyle = 'rgba('+r+','+g+','+b+',0.5)'; cx.lineWidth=1; cx.strokeRect(0.5,0.5,15,15);
            self._curr().textureImages[k] = { image: c, dataURL: '' };
        });
        self._renderAll();
        self._renderAtlasPreview();
        self._buildTileList();

        // 异步加载硬编码的 base64 贴图，替换 canvas 占位图
        keys2.forEach(function(k) {
            var img = new Image();
            img.onload = function() {
                var c = document.createElement('canvas');
                c.width = img.width; c.height = img.height;
                var cx = c.getContext('2d');
                cx.drawImage(img, 0, 0);
                self._curr().textureImages[k] = { image: c, dataURL: img.src };
                self._renderAll();
                self._renderAtlasPreview();
                self._buildTileList();
            };
            img.src = self._defaultBase64[k];
        });

        // 异步尝试加载用户的文件贴图，成功则替换
        keys.forEach(function(k) {
            var img = new Image();
            img.onload = function() {
                self._curr().textureImages[k] = { image: img, dataURL: img.src };
                self._renderAll();
                self._renderAtlasPreview();
                self._buildTileList();
            };
            var fileNames = { dot:'点', triangle:'三角', diagonal:'对角', line:'直线', full:'满', empty:'空' };
            img.src = 'default-tiles/' + (fileNames[k] || k) + '.png';
        });
    },

    _renderMultiPreview: function(ac, ctx, maxW) {
        var self = this;
        var keys = ['dot', 'triangle', 'diagonal', 'line', 'full', 'empty'];
        var labels = ['点', '三', '对', '线', '满', '空'];
        var n = keys.length;
        var pad = 4;
        var previewSize = 36;
        var titleH = 14;
        var totalW = maxW;
        var cols = 3;
        var rows = Math.ceil(n / cols);
        var cellW = Math.floor((totalW - pad) / cols);
        var cellH = previewSize + titleH + pad;
        var totalH = rows * cellH + pad;

        ac.width = totalW;
        ac.height = totalH;

        ctx.fillStyle = 'rgba(20,30,60,0.3)';
        ctx.fillRect(0, 0, totalW, totalH);

        for (var i = 0; i < n; i++) {
            var col = i % cols, row = Math.floor(i / cols);
            var cx = pad + col * cellW, cy = pad + row * cellH;
            var tex = this._curr().textureImages[keys[i]];
            var isEditing = this._regionEditing === keys[i];

            // 背景（编辑中高亮）
            ctx.fillStyle = isEditing ? 'rgba(56,189,248,0.15)' : (tex ? 'rgba(20,30,60,0.5)' : 'rgba(20,30,60,0.2)');
            ctx.fillRect(cx, cy, cellW - 1, cellH - 2);

            if (tex && tex.image) {
                var iw = tex.image.width, ih = tex.image.height;
                var sc2 = Math.min((previewSize - 4) / iw, (previewSize - 4) / ih);
                var dw = Math.round(iw * sc2), dh = Math.round(ih * sc2);
                var dx = cx + 2 + (previewSize - dw) / 2;
                var dy = cy + 2 + (previewSize - dh) / 2;
                ctx.imageSmoothingEnabled = false;
                ctx.drawImage(tex.image, 0, 0, iw, ih, dx, dy, dw, dh);
            }

            // 标签
            ctx.fillStyle = isEditing ? '#38bdf8' : (tex ? '#94a3b8' : '#475569');
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(labels[i], cx + cellW / 2, cy + previewSize + 11);
        }

        // 清除旧的点击监听
        if (ac._multiClick) ac._multiClick();

        // 点击切换图片对应关系
        function onClick(e) {
            if (!self._regionEditing) return;
            var rect = ac.getBoundingClientRect();
            var px = e.clientX - rect.left;
            var py = e.clientY - rect.top;
            var col2 = Math.floor(px / cellW);
            var row2 = Math.floor(py / cellH);
            var idx = row2 * cols + col2;
            if (idx < 0 || idx >= n) return;
            var clickedKey = keys[idx];
            if (clickedKey === self._regionEditing) return;

            // 交换两张图片的对应关系
            var tmp = self._curr().textureImages[self._regionEditing];
            self._curr().textureImages[self._regionEditing] = self._curr().textureImages[clickedKey];
            self._curr().textureImages[clickedKey] = tmp;
            self._renderAll();
            self._buildTileList();
            self._renderAtlasPreview();
        }
        ac.addEventListener('click', onClick);
        ac._multiClick = function() { ac.removeEventListener('click', onClick); };
    },

    _updateHint: function() {
        var hint = this._el.hint;
        if (!hint) return;
        if (this._curr().textureMode === 'none') {
            hint.innerHTML = '点击 <b style="color:#38bdf8;">导入</b> 上传贴图';
            return;
        }
        if (this._regionEditing) {
            var label = this._getTileLabel(this._regionEditing);
            if (this._curr().textureMode === 'multi') {
                hint.innerHTML = '<span style="color:#fbbf24;">▼ 正在交换 ' + label + '</span> 请点击预览图上的其他图片';
            } else {
                hint.innerHTML = '<span style="color:#fbbf24;">▼ 正在选择 ' + label + '</span> 请点击图集上的格子';
            }
            return;
        }
        hint.innerHTML = '先点右侧瓦片类型，再点预览图选择贴图';
    },
    _getDefaultColor: function(key) {
        var colors = {
            dot:      'rgba(45,212,191,0.65)',
            triangle: 'rgba(251,146,60,0.65)',
            diagonal: 'rgba(167,139,250,0.65)',
            line:     'rgba(96,165,250,0.65)',
            full:     'rgba(56,189,248,0.70)',
            empty:    'rgba(100,160,255,0.08)'
        };
        return colors[key] || 'rgba(100,160,255,0.1)';
    },

    _updateTexturePreviews: function() {
        this._renderAtlasPreview();
        this._buildTileList();
    },

    // ===== 工具栏更新 =====

    _updateToolbar: function() {
        var el = this._el;
        if (this._activeTool === 'brush' || this._activeTool === 'empty') {
            var isEmpty = this._activeTool === 'empty';
            el.toggleInput.checked = isEmpty;
            el.toggleSwitch.style.background = isEmpty ? 'rgba(56,189,248,0.45)' : 'rgba(56,189,248,0.25)';
            el.toggleKnob.style.left = isEmpty ? '15px' : '1px';
            if (el.toggleLabels && el.toggleLabels.length >= 2) {
                el.toggleLabels[0].style.color = isEmpty ? '#475569' : '#38bdf8';
                el.toggleLabels[1].style.color = isEmpty ? '#38bdf8' : '#475569';
            }
        }
        el.btnEraser.className = 'tr-tb tn-eraser ac-eraser' + (this._activeTool === 'eraser' ? ' active' : '');
        el.btnSelect.className = 'tr-tb tn-select ac-select' + (this._activeTool === 'select' ? ' active' : '');
        el.btnGrid.textContent = '网格' + (this._showGrid ? '' : '');
        el.btnGrid.className = 'tr-tb tn-grid ac-grid' + (this._showGrid ? ' active' : '');
        var hasSel = !!(this._selection && this._selection.ex - this._selection.sx > 0 && this._selection.ey - this._selection.sy > 0);
        el.btnSave.disabled = !hasSel;
        el.btnSave.className = 'tr-tb tn-save ac-select' + (hasSel ? '' : ' disabled');
        el.btnSave.style.opacity = hasSel ? '1' : '0.4';
    },

    _updatePointCount: function() {
        var count = Object.keys(this._curr().points).length + Object.keys(this._curr().emptyPoints).length;
        this._el.pointCount.textContent = count;
    },

    _updateFooter: function() {
        var sc = this._view.scale;
        this._el.footerRight.textContent = Math.round(sc * 100) + '%';
    },

    // ===== 坐标转换 =====

    _screenToIntersection: function(worldX, worldY) {
        return {
            cx: Math.round(worldX / this._gridSize),
            cy: Math.round(worldY / this._gridSize)
        };
    },

    // ===== 核心逻辑 =====

    _hasPoint: function(cx, cy) {
        return !!this._curr().points[cx + ',' + cy];
    },
    _isEmptyPoint: function(cx, cy) {
        return !!this._curr().emptyPoints[cx + ',' + cy];
    },
    _isTileEmpty: function(tx, ty) {
        return this._isEmptyPoint(tx, ty) || this._isEmptyPoint(tx + 1, ty) ||
               this._isEmptyPoint(tx, ty + 1) || this._isEmptyPoint(tx + 1, ty + 1);
    },

    _getTileType: function(tx, ty) {
        var tl = this._hasPoint(tx, ty);
        var tr = this._hasPoint(tx + 1, ty);
        var bl = this._hasPoint(tx, ty + 1);
        var br = this._hasPoint(tx + 1, ty + 1);
        var count = (tl ? 1 : 0) + (tr ? 1 : 0) + (bl ? 1 : 0) + (br ? 1 : 0);
        // 有普通标记 → 正常 Marching Squares
        if (count > 0) {
            var bits = (tl ? 1 : 0) | (tr ? 2 : 0) | (bl ? 4 : 0) | (br ? 8 : 0);
            return { count: count, bits: bits, tl: tl, tr: tr, bl: bl, br: br };
        }
        // 没有普通标记 → 检查空笔标记
        if (this._isTileEmpty(tx, ty)) {
            return { count: 0, bits: 0, tl: false, tr: false, bl: false, br: false, empty: true };
        }
        return null;
    },

    // 获取瓦片类型的贴图来源（多图模式优先 → 图集模式 → 默认）
    _getTileTexture: function(tileTypeKey) {
        if (this._curr().textureMode === 'multi') {
            var tex = this._curr().textureImages[tileTypeKey];
            if (tex && tex.image) return tex.image;
        }
        return this._curr().atlasImage; // 可能为 null
    },
    _getTileRegion: function(tileTypeKey) {
        return this._curr().atlasRegions[tileTypeKey] || null;
    },
    _hasTileTexture: function(tileTypeKey) {
        if (this._curr().textureMode === 'multi') {
            return !!(this._curr().textureImages[tileTypeKey] && this._curr().textureImages[tileTypeKey].image);
        }
        return !!(this._curr().atlasImage && this._curr().atlasRegions[tileTypeKey]);
    },

    // ===== 渲染 =====

    _renderAll: function() {
        var ctx = this._ctx;
        var canvas = this._canvas;
        if (!ctx || !canvas) return;

        var dpr = window.devicePixelRatio || 1;
        var w = canvas.width;
        var h = canvas.height;

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, w, h);

        // 应用画布视图变换
        var oX = this._view.offsetX;
        var oY = this._view.offsetY;
        var sc = this._view.scale;

        // 先重置，再应用变换
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.translate(oX, oY);
        ctx.scale(sc, sc);

        // 计算可见范围（世界坐标）
        var cw = canvas.width / dpr;
        var ch = canvas.height / dpr;
        var visLeft   = -oX / sc;
        var visTop    = -oY / sc;
        var visRight  = (cw - oX) / sc;
        var visBottom = (ch - oY) / sc;

        var padding = this._gridSize * 2;
        visLeft   -= padding;
        visTop    -= padding;
        visRight  += padding;
        visBottom += padding;

        var gs = this._gridSize;
        var startTx = Math.floor(visLeft / gs);
        var endTx   = Math.ceil(visRight / gs);
        var startTy = Math.floor(visTop / gs);
        var endTy   = Math.ceil(visBottom / gs);

        // 1. 网格
        if (this._showGrid) {
            ctx.strokeStyle = this._colors.grid;
            ctx.lineWidth = 1 / sc;
            ctx.beginPath();
            for (var x = startTx; x <= endTx; x++) {
                var wx = x * gs;
                ctx.moveTo(wx, startTy * gs);
                ctx.lineTo(wx, endTy * gs);
            }
            for (var y = startTy; y <= endTy; y++) {
                var wy = y * gs;
                ctx.moveTo(startTx * gs, wy);
                ctx.lineTo(endTx * gs, wy);
            }
            ctx.stroke();

            // 交叉点辅助点
            ctx.fillStyle = this._colors.crosshair;
            var dotR = 1.5 / sc;
            for (var x = startTx; x <= endTx; x++) {
                for (var y = startTy; y <= endTy; y++) {
                    ctx.beginPath();
                    ctx.arc(x * gs, y * gs, dotR, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        }

        // 2. 逐层渲染瓦片（从底层到顶层）
        var prevLayer = this._activeLayerIdx;
        for (var li = 0; li < this._layers.length; li++) {
            if (!this._layers[li].visible) continue;
            this._activeLayerIdx = li;
            for (var tx = startTx; tx < endTx; tx++) {
                for (var ty = startTy; ty < endTy; ty++) {
                    this._drawTile(ctx, tx, ty, gs, sc);
                }
            }
        }
        this._activeLayerIdx = prevLayer;

        // ---- 选中区域虚线框 + 尺寸信息 ----
        var sel = this._selection || this._selDrag;
        if (sel) {
            var gs2 = this._gridSize;
            var sl = Math.min(sel.sx, sel.ex) * gs2;
            var st = Math.min(sel.sy, sel.ey) * gs2;
            var sr = Math.max(sel.sx, sel.ex) * gs2;
            var sb = Math.max(sel.sy, sel.ey) * gs2;
            var sw = sr - sl;
            var sh = sb - st;
            var cols = Math.round(sw / gs2);
            var rows = Math.round(sh / gs2);
            if (cols < 1 || rows < 1) {
                if (this._selection) { this._selection = null; this._updateToolbar(); }
                return;
            }

            ctx.save();
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 2 / sc;
            ctx.setLineDash([6 / sc, 4 / sc]);
            ctx.strokeRect(sl, st, sw, sh);
            ctx.setLineDash([]);

            // 尺寸标签
            var label = cols + '×' + rows + '格';
            ctx.fillStyle = 'rgba(251,191,36,0.9)';
            ctx.font = Math.max(10, 12 / sc) + 'px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            var tw = ctx.measureText(label).width;
            var tx = sl, ty = st - 20 / sc;
            if (ty < 0) { ty = sb + 2 / sc; }
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(tx - 2 / sc, ty - 2 / sc, tw + 4 / sc, 16 / sc + 4 / sc);
            ctx.fillStyle = '#fbbf24';
            ctx.fillText(label, tx, ty);
            ctx.restore();
        }

        // 3. 标记点 + 空标记点（随网格一起显示/隐藏）
        if (this._showGrid) {
            // 普通标记（蓝色）
            ctx.fillStyle = this._colors.point;
            var pr = 4 / sc;
            for (var key in this._curr().points) {
                if (!this._curr().points.hasOwnProperty(key)) continue;
                var parts = key.split(',');
                var px = parseInt(parts[0]) * gs;
                var py = parseInt(parts[1]) * gs;
                ctx.beginPath();
                ctx.arc(px, py, pr, 0, Math.PI * 2);
                ctx.fill();
            }
            // 空标记（灰色）
            ctx.fillStyle = 'rgba(148,163,184,0.6)';
            for (var key2 in this._curr().emptyPoints) {
                if (!this._curr().emptyPoints.hasOwnProperty(key2)) continue;
                var parts2 = key2.split(',');
                var px2 = parseInt(parts2[0]) * gs;
                var py2 = parseInt(parts2[1]) * gs;
                ctx.beginPath();
                ctx.arc(px2, py2, pr, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = 'rgba(148,163,184,0.3)';
                ctx.lineWidth = 1 / sc;
                ctx.stroke();
            }
        }

        this._updateToolbar();
        this._updatePointCount();
        this._updateFooter();
    },

    _drawTile: function(ctx, tx, ty, gs, sc) {
        var info = this._getTileType(tx, ty);
        if (!info) return;

        var x0 = tx * gs, y0 = ty * gs;
        var x1 = x0 + gs, y1 = y0 + gs;
        var cx = x0 + gs / 2, cy = y0 + gs / 2;
        var lw = 1 / sc;

        // 确定当前瓦片类型对应的贴图 key
        var texKey;
        if (info.empty) texKey = 'empty';
        else if (info.count === 1) texKey = 'dot';
        else if (info.count === 2) {
            if (info.bits === 3 || info.bits === 5 || info.bits === 10 || info.bits === 12)
                texKey = 'line';
            else texKey = 'diagonal';
        } else if (info.count === 3) texKey = 'triangle';
        else if (info.count === 4) texKey = 'full';

        // 获取贴图来源
        var texImg = this._getTileTexture(texKey);
        var texReg = this._getTileRegion(texKey);
        var hasTex = this._hasTileTexture(texKey);

        // 填充色（无贴图时用）
        var fillColors = {
            0: 'rgba(100,160,255,0.06)',
            1: this._colors.corner, 2: this._colors.edge,
            3: this._colors.diagonal, 4: this._colors.triangle, 5: this._colors.full
        };
        var colorKey = info.count;
        if (info.count === 2 && (info.bits === 6 || info.bits === 9)) colorKey = 3;
        else if (info.count === 2) colorKey = 2;
        var fillColor = fillColors[colorKey] || this._colors.full;

        // ---- 计算贴图旋转角度（基于基准方向）----
        var rotAngle = 0;
        if (this._autoRotate && texKey) {
            var baseDir = this._curr().baseDirections[texKey];
            // 确定当前标记点的方向字符串
            var markDir = '';
            if (info.count === 1) {
                if (info.tl) markDir = 'tl';
                else if (info.tr) markDir = 'tr';
                else if (info.br) markDir = 'br';
                else if (info.bl) markDir = 'bl';
            } else if (info.count === 2) {
                if (info.bits === 3) markDir = 'top';
                else if (info.bits === 12) markDir = 'bottom';
                else if (info.bits === 5) markDir = 'left';
                else if (info.bits === 10) markDir = 'right';
                else if (info.bits === 9) markDir = 'tlbr';
                else if (info.bits === 6) markDir = 'trbl';
            } else if (info.count === 3) {
                if (!info.tl) markDir = 'tl';   // 缺左上角
                else if (!info.tr) markDir = 'tr'; // 缺右上角
                else if (!info.bl) markDir = 'bl'; // 缺左下角
                else if (!info.br) markDir = 'br'; // 缺右下角
            }

            if (baseDir && markDir) {
                // 找方向顺序列表
                var dirCfg = this._dirOptions[texKey];
                if (dirCfg) {
                    var idxBase = dirCfg.order.indexOf(baseDir);
                    var idxMark = dirCfg.order.indexOf(markDir);
                    if (idxBase >= 0 && idxMark >= 0) {
                        var extra = this._curr().textureRotation[texKey] || 0;
                        var diff = (idxMark - idxBase + dirCfg.order.length + extra) % dirCfg.order.length;
                        rotAngle = diff * Math.PI / 2;
                    }
                }
            }
        }

        // 扩大 0.5px 消除瓦片间的渲染缝隙
        var gapFix = 0.5 / sc;

        ctx.save();

        // ---- 贴图完整铺满，根据标记位置旋转（可关闭）----
        if (hasTex && texImg) {
            ctx.save();
            if (this._autoRotate) {
                ctx.translate(x0 + gs / 2, y0 + gs / 2);
                ctx.rotate(rotAngle);
            }
            var dx = this._autoRotate ? -gs / 2 - gapFix : x0 - gapFix;
            var dy = this._autoRotate ? -gs / 2 - gapFix : y0 - gapFix;
            var dw = gs + gapFix * 2;
            var dh = gs + gapFix * 2;
            if (this._curr().textureMode === 'multi' && this._curr().textureImages[texKey]) {
                var mi = this._curr().textureImages[texKey].image;
                ctx.drawImage(mi, 0, 0, mi.width, mi.height, dx, dy, dw, dh);
            } else if (texReg) {
                ctx.drawImage(texImg, texReg.x, texReg.y, texReg.w, texReg.h, dx, dy, dw, dh);
            }
            ctx.restore();
        } else {
            // 无贴图：纯色填充整个格子
            ctx.fillStyle = fillColor;
            ctx.fillRect(x0 - gapFix, y0 - gapFix, gs + gapFix * 2, gs + gapFix * 2);
        }

        // ---- 彩色边框区分瓦片类型（随网格一起显示/隐藏）----
        if (this._showGrid) {
            var borderColor = this._colors.stroke;
            if (info.empty) borderColor = 'rgba(100,160,255,0.08)';
            else if (info.count === 1) borderColor = 'rgba(45,212,191,0.45)';
            else if (info.count === 2 && (info.bits === 3 || info.bits === 5 || info.bits === 10 || info.bits === 12))
                borderColor = 'rgba(96,165,250,0.45)';
            else if (info.count === 2) borderColor = 'rgba(167,139,250,0.45)';
            else if (info.count === 3) borderColor = 'rgba(251,146,60,0.45)';
            else if (info.count === 4) borderColor = 'rgba(56,189,248,0.50)';

            ctx.strokeStyle = borderColor;
            ctx.lineWidth = lw * 1.5;
            ctx.strokeRect(x0 - gapFix, y0 - gapFix, gs + gapFix * 2, gs + gapFix * 2);
        }

        ctx.restore();
    },

    // ===== Godot 导出 =====

    _exportGodot: function() {
        var self = this;
        var sceneName = prompt('场景名称:', this._curr().name || 'tilemap');
        if (!sceneName) return;
        sceneName = sceneName.replace(/[^a-zA-Z0-9_\u4e00-\u9fff]/g, '_') || 'tilemap';

        // 收集当前层数据
        var layer = this._curr();

        // 导出 6 张贴图为 PNG（从 textureImages 或图集截取）
        var keys = ['dot', 'triangle', 'diagonal', 'line', 'full', 'empty'];
        var texFilenames = {
            dot:'dot.png', triangle:'triangle.png', diagonal:'diagonal.png',
            line:'line.png', full:'full.png', empty:'empty.png'
        };
        var textures = {};
        keys.forEach(function(k) {
            var img = null;
            if (layer.textureMode === 'multi' && layer.textureImages[k] && layer.textureImages[k].image) {
                img = layer.textureImages[k].image;
            } else if (layer.textureMode === 'atlas' && layer.atlasImage && layer.atlasRegions[k]) {
                var c = document.createElement('canvas');
                var reg = layer.atlasRegions[k];
                c.width = reg.w;
                c.height = reg.h;
                var cx = c.getContext('2d');
                cx.imageSmoothingEnabled = false;
                cx.drawImage(layer.atlasImage, reg.x, reg.y, reg.w, reg.h, 0, 0, reg.w, reg.h);
                img = c;
            }
            if (!img) return;
            var c = document.createElement('canvas');
            c.width = img.width || 16;
            c.height = img.height || 16;
            var cx = c.getContext('2d');
            cx.imageSmoothingEnabled = false;
            cx.drawImage(img, 0, 0);
            textures[k] = c.toDataURL('image/png');
        });

        // 检查有没有贴图
        if (Object.keys(textures).length === 0) {
            if (typeof showToast === 'function') showToast('没有贴图可导出，请先上传贴图');
            return;
        }

        // 准备数据 JSON
        var dataObj = {
            grid_size: this._gridSize,
            points: Object.keys(layer.points).filter(function(k) { return layer.points[k]; }),
            empty_points: Object.keys(layer.emptyPoints).filter(function(k) { return layer.emptyPoints[k]; }),
            base_directions: {
                dot: layer.baseDirections.dot,
                triangle: layer.baseDirections.triangle,
                diagonal: layer.baseDirections.diagonal,
                line: layer.baseDirections.line
            },
            texture_rotation: {
                dot: layer.textureRotation.dot || 0,
                triangle: layer.textureRotation.triangle || 0,
                diagonal: layer.textureRotation.diagonal || 0,
                line: layer.textureRotation.line || 0
            }
        };
        var dataJSON = JSON.stringify(dataObj, null, 2);

        // 生成 GD 脚本内容
        var gdContent = _generateGD(sceneName);

        // 生成 TSCN 内容
        var tscnContent = _generateTSCN(sceneName, keys, texFilenames, textures);

        // 打包 ZIP 下载
        if (typeof JSZip === 'undefined') {
            if (typeof showToast === 'function') showToast('需要 JSZip 库');
            return;
        }
        var zip = new JSZip();
        var folder = zip.folder(sceneName);

        // 添加贴图
        keys.forEach(function(k) {
            if (textures[k]) {
                var bin = atob(textures[k].split(',')[1]);
                var buf = new Uint8Array(bin.length);
                for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
                folder.file(texFilenames[k], buf);
            }
        });

        // 添加数据 JSON
        folder.file(sceneName + '_data.json', dataJSON);

        // 添加 GD 脚本
        folder.file(sceneName + '.gd', gdContent);

        // 添加 TSCN 场景
        folder.file(sceneName + '.tscn', tscnContent);

        zip.generateAsync({ type: 'blob' }).then(function(blob) {
            var link = document.createElement('a');
            link.download = sceneName + '_godot.zip';
            link.href = URL.createObjectURL(blob);
            link.click();
            URL.revokeObjectURL(link.href);
            if (typeof showToast === 'function') showToast('已导出 Godot 场景');
        });
    }
};

// ===== 辅助函数（生成 GD / TSCN 字符串） =====

function _generateGD(name) {
    return [
        'extends Node2D',
        '',
        'var 格大小: int = 16',
        '',
        '@export var 显示网格: bool = false',
        '@export var 空图: Texture2D',
        '@export var 满图: Texture2D',
        '@export var 点图: Texture2D',
        '@export var 三角图: Texture2D',
        '@export var 对角图: Texture2D',
        '@export var 直线图: Texture2D',
        '',
        'var 所有点: Dictionary = {}',
        'var 所有空点: Dictionary = {}',
        'var 基准方向: Dictionary = {}',
        'var 额外旋转: Dictionary = {}',
        'var 鼠标按下: bool = false',
        'var 删除模式: bool = false',
        'var 上次交点: Vector2i = Vector2i(-99999, -99999)',
        '',
        'var _方向配置: Dictionary = {',
        '\t"dot": { "order": ["tl","tr","br","bl"] },',
        '\t"triangle": { "order": ["tl","tr","br","bl"] },',
        '\t"line": { "order": ["top","right","bottom","left"] },',
        '\t"diagonal": { "order": ["tlbr","trbl"] }',
        '}',
        '',
        '',
        'func _ready() -> void:',
        '\t_加载数据()',
        '\tqueue_redraw()',
        '',
        '',
        'func _加载数据() -> void:',
        '\tvar 路径: String = get_script().resource_path.replace(".gd", "_data.json")',
        '\tif not FileAccess.file_exists(路径):',
        '\t\treturn',
        '\tvar 文件: FileAccess = FileAccess.open(路径, FileAccess.READ)',
        '\tif 文件 == null:',
        '\t\treturn',
        '\tvar 文本: String = 文件.get_as_text()',
        '\t文件.close()',
        '\tvar 数据 = JSON.parse_string(文本)',
        '\tif 数据 == null:',
        '\t\treturn',
        '\tif 数据.has("grid_size"):',
        '\t\t格大小 = 数据.grid_size',
        '\tif 数据.has("points"):',
        '\t\tfor key in 数据.points:',
        '\t\t\t所有点[key] = true',
        '\tif 数据.has("empty_points"):',
        '\t\tfor key in 数据.empty_points:',
        '\t\t\t所有空点[key] = true',
        '\tif 数据.has("base_directions"):',
        '\t\t基准方向 = 数据.base_directions.duplicate()',
        '\tif 数据.has("texture_rotation"):',
        '\t\t额外旋转 = 数据.texture_rotation.duplicate()',
        '',
        '',
        'func _unhandled_input(事件: InputEvent) -> void:',
        '\tif 事件 is InputEventMouseButton and 事件.pressed:',
        '\t\tif 事件.button_index == MOUSE_BUTTON_LEFT:',
        '\t\t\t鼠标按下 = true',
        '\t\t\t删除模式 = false',
        '\t\t\t上次交点 = Vector2i(-99999, -99999)',
        '\t\t\t点击交叉点(get_global_mouse_position())',
        '\t\t\tget_viewport().set_input_as_handled()',
        '\t\telif 事件.button_index == MOUSE_BUTTON_RIGHT:',
        '\t\t\t鼠标按下 = true',
        '\t\t\t删除模式 = true',
        '\t\t\t上次交点 = Vector2i(-99999, -99999)',
        '\t\t\t点击交叉点(get_global_mouse_position())',
        '\t\t\tget_viewport().set_input_as_handled()',
        '\telif 事件 is InputEventMouseButton and not 事件.pressed:',
        '\t\t鼠标按下 = false',
        '\telif 事件 is InputEventMouseMotion and 鼠标按下:',
        '\t\t点击交叉点(get_global_mouse_position())',
        '',
        '',
        'func 屏幕坐标转交叉点(坐标: Vector2) -> Vector2i:',
        '\treturn Vector2i(int(round(坐标.x / 格大小)), int(round(坐标.y / 格大小)))',
        '',
        '',
        'func 格子索引转屏幕坐标(索引: Vector2i) -> Vector2:',
        '\treturn Vector2(索引.x * 格大小 + 格大小 / 2.0, 索引.y * 格大小 + 格大小 / 2.0)',
        '',
        '',
        'func 点击交叉点(鼠标位置: Vector2) -> void:',
        '\tvar 交点: Vector2i = 屏幕坐标转交叉点(鼠标位置)',
        '\tif 交点 == 上次交点:',
        '\t\treturn',
        '\t上次交点 = 交点',
        '\tvar key: String = str(交点.x) + "," + str(交点.y)',
        '\tif 删除模式:',
        '\t\t所有点.erase(key)',
        '\t\t所有空点.erase(key)',
        '\telse:',
        '\t\t所有点[key] = true',
        '\tqueue_redraw()',
        '',
        '',
        'func 获取瓦片类型(tx: int, ty: int) -> Dictionary:',
        '\tvar tl: bool = 所有点.has(str(tx) + "," + str(ty))',
        '\tvar tr: bool = 所有点.has(str(tx + 1) + "," + str(ty))',
        '\tvar bl: bool = 所有点.has(str(tx) + "," + str(ty + 1))',
        '\tvar br: bool = 所有点.has(str(tx + 1) + "," + str(ty + 1))',
        '\tvar count: int = (1 if tl else 0) + (1 if tr else 0) + (1 if bl else 0) + (1 if br else 0)',
        '\tif count > 0:',
        '\t\tvar bits: int = (1 if tl else 0) + (2 if tr else 0) + (4 if bl else 0) + (8 if br else 0)',
        '\t\treturn { "count": count, "bits": bits, "tl": tl, "tr": tr, "bl": bl, "br": br }',
        '\tif 所有空点.has(str(tx) + "," + str(ty)) or 所有空点.has(str(tx + 1) + "," + str(ty)) or 所有空点.has(str(tx) + "," + str(ty + 1)) or 所有空点.has(str(tx + 1) + "," + str(ty + 1)):',
        '\t\treturn { "count": 0, "bits": 0, "tl": false, "tr": false, "bl": false, "br": false, "empty": true }',
        '\treturn {}',
        '',
        '',
        'func _draw() -> void:',
        '\t# 收集所有需要绘制的格子',
        '\tvar 瓦片集合: Dictionary = {}',
        '\tfor key in 所有点:',
        '\t\tvar parts: PackedStringArray = key.split(",")',
        '\t\tif parts.size() != 2:',
        '\t\t\tcontinue',
        '\t\tvar cx: int = int(parts[0])',
        '\t\tvar cy: int = int(parts[1])',
        '\t\tvar 周围: Array[Vector2i] = [',
        '\t\t\tVector2i(cx - 1, cy - 1),',
        '\t\t\tVector2i(cx, cy - 1),',
        '\t\t\tVector2i(cx - 1, cy),',
        '\t\t\tVector2i(cx, cy)',
        '\t\t]',
        '\t\tfor tile in 周围:',
        '\t\t\t瓦片集合[str(tile)] = tile',
        '\tfor key in 所有空点:',
        '\t\tvar parts: PackedStringArray = key.split(",")',
        '\t\tif parts.size() != 2:',
        '\t\t\tcontinue',
        '\t\tvar cx: int = int(parts[0])',
        '\t\tvar cy: int = int(parts[1])',
        '\t\tvar 周围: Array[Vector2i] = [',
        '\t\t\tVector2i(cx - 1, cy - 1),',
        '\t\t\tVector2i(cx, cy - 1),',
        '\t\t\tVector2i(cx - 1, cy),',
        '\t\t\tVector2i(cx, cy)',
        '\t\t]',
        '\t\tfor tile in 周围:',
        '\t\t\t瓦片集合[str(tile)] = tile',
        '\tfor tile in 瓦片集合.values():',
        '\t\t绘制一个瓦片(tile.x, tile.y)',
        '\t# 网格线',
        '\tif 显示网格:',
        '\t\tvar 网格色: Color = Color(1, 0.86, 0.7, 0.08)',
        '\t\tfor x in range(-2000, 2001, 格大小):',
        '\t\t\tdraw_line(Vector2(x, -2000), Vector2(x, 2000), 网格色, 1.0)',
        '\t\tfor y in range(-2000, 2001, 格大小):',
        '\t\t\tdraw_line(Vector2(-2000, y), Vector2(2000, y), 网格色, 1.0)',
        '\t# 标记点',
        '\tif 显示网格:',
        '\t\tvar pr: float = 4.0',
        '\t\tfor key in 所有点:',
        '\t\t\tvar parts: PackedStringArray = key.split(",")',
        '\t\t\tif parts.size() != 2:',
        '\t\t\t\tcontinue',
        '\t\t\tdraw_circle(Vector2(int(parts[0]) * 格大小, int(parts[1]) * 格大小), pr, Color(0.22, 0.74, 0.97))',
        '\t\tfor key in 所有空点:',
        '\t\t\tvar parts: PackedStringArray = key.split(",")',
        '\t\t\tif parts.size() != 2:',
        '\t\t\t\tcontinue',
        '\t\t\tdraw_circle(Vector2(int(parts[0]) * 格大小, int(parts[1]) * 格大小), pr, Color(0.58, 0.64, 0.72, 0.6))',
        '\t\t\tdraw_arc(Vector2(int(parts[0]) * 格大小, int(parts[1]) * 格大小), pr, 0, TAU, 12, Color(0.58, 0.64, 0.72, 0.3), 1.0)',
        '',
        '',
        'func 绘制一个瓦片(tx: int, ty: int) -> void:',
        '\tvar info: Dictionary = 获取瓦片类型(tx, ty)',
        '\tif info.is_empty():',
        '\t\treturn',
        '\tvar x0: float = tx * 格大小',
        '\tvar y0: float = ty * 格大小',
        '\tvar gs: float = 格大小',
        '\t# 确定瓦片类型',
        '\tvar texKey: String',
        '\tif info.has("empty") and info.empty:',
        '\t\ttexKey = "empty"',
        '\telif info.count == 1:',
        '\t\ttexKey = "dot"',
        '\telif info.count == 2:',
        '\t\tif info.bits in [3, 5, 10, 12]:',
        '\t\t\ttexKey = "line"',
        '\t\telse:',
        '\t\t\ttexKey = "diagonal"',
        '\telif info.count == 3:',
        '\t\ttexKey = "triangle"',
        '\telif info.count == 4:',
        '\t\ttexKey = "full"',
        '\telse:',
        '\t\treturn',
        '\tvar tex: Texture2D = _获取贴图(texKey)',
        '\tif tex == null:',
        '\t\treturn',
        '\t# 计算旋转',
        '\tvar rot: float = _计算旋转角度(texKey, info)',
        '\t# 绘制',
        '\tif rot != 0.0:',
        '\t\tdraw_set_transform(Vector2(x0 + gs / 2, y0 + gs / 2), rot)',
        '\t\tdraw_texture_rect(tex, Rect2(-gs / 2, -gs / 2, gs, gs), false)',
        '\t\tdraw_set_transform(Vector2.ZERO, 0.0)',
        '\telse:',
        '\t\tdraw_texture_rect(tex, Rect2(x0, y0, gs, gs), false)',
        '',
        '',
        'func _获取贴图(texKey: String) -> Texture2D:',
        '\tmatch texKey:',
        '\t\t"dot": return 点图',
        '\t\t"triangle": return 三角图',
        '\t\t"diagonal": return 对角图',
        '\t\t"line": return 直线图',
        '\t\t"full": return 满图',
        '\t\t"empty": return 空图',
        '\treturn null',
        '',
        '',
        'func _计算旋转角度(texKey: String, info: Dictionary) -> float:',
        '\tif not 基准方向.has(texKey):',
        '\t\treturn 0.0',
        '\tvar baseDir: String = 基准方向[texKey]',
        '\tvar markDir: String = ""',
        '\tif info.count == 1:',
        '\t\tif info.tl: markDir = "tl"',
        '\t\telif info.tr: markDir = "tr"',
        '\t\telif info.br: markDir = "br"',
        '\t\telif info.bl: markDir = "bl"',
        '\telif info.count == 2:',
        '\t\tif info.bits == 3: markDir = "top"',
        '\t\telif info.bits == 12: markDir = "bottom"',
        '\t\telif info.bits == 5: markDir = "left"',
        '\t\telif info.bits == 10: markDir = "right"',
        '\t\telif info.bits == 9: markDir = "tlbr"',
        '\t\telif info.bits == 6: markDir = "trbl"',
        '\telif info.count == 3:',
        '\t\tif not info.tl: markDir = "tl"',
        '\t\telif not info.tr: markDir = "tr"',
        '\t\telif not info.bl: markDir = "bl"',
        '\t\telif not info.br: markDir = "br"',
        '\tif markDir.is_empty():',
        '\t\treturn 0.0',
        '\tvar 配置: Dictionary = _方向配置.get(texKey, {})',
        '\tif 配置.is_empty():',
        '\t\treturn 0.0',
        '\tvar order: Array = 配置["order"]',
        '\tvar idxBase: int = order.find(baseDir)',
        '\tvar idxMark: int = order.find(markDir)',
        '\tif idxBase < 0 or idxMark < 0:',
        '\t\treturn 0.0',
        '\tvar extra: int = 额外旋转.get(texKey, 0)',
        '\tvar diff: int = (idxMark - idxBase + order.size() + extra) % order.size()',
        '\treturn diff * PI / 2.0'
    ].join('\n');
}

function _generateTSCN(name, keys, texFilenames, textures) {
    // 计算 ext_resource ID：贴图 1-6，脚本 7
    var texKeys = ['dot', 'triangle', 'diagonal', 'line', 'full', 'empty'];
    var texIdMap = {};
    texKeys.forEach(function(k, i) {
        if (textures[k]) texIdMap[k] = i + 1;
    });
    var scriptId = 7;

    var lines = [];
    lines.push('[gd_scene format=3]');
    lines.push('');

    // ext_resource 贴图
    texKeys.forEach(function(k) {
        if (texIdMap[k]) {
            lines.push('[ext_resource type="Texture2D" path="res://' + name + '/' + texFilenames[k] + '" id="' + texIdMap[k] + '"]');
        }
    });
    lines.push('[ext_resource type="Script" path="res://' + name + '/' + name + '.gd" id="' + scriptId + '"]');
    lines.push('');

    // 节点
    lines.push('[node name="' + name + '" type="Node2D"]');
    lines.push('script = ExtResource("' + scriptId + '")');
    // 贴图属性赋值（跟 GD 脚本的 @export var 对应）
    var gdTexNames = {dot:'点图', triangle:'三角图', diagonal:'对角图', line:'直线图', full:'满图', empty:'空图'};
    texKeys.forEach(function(k) {
        if (texIdMap[k]) {
            lines.push('"' + gdTexNames[k] + '" = ExtResource("' + texIdMap[k] + '")');
        }
    });
    lines.push('');

    return lines.join('\n');
}
