/**
 * 图片裁剪技能 - v67 插件
 *
 * 功能：
 *   - 图片上传（拖放或点击选择）
 *   - 裁剪框可拖拽调整大小（8个手柄）
 *   - 宽高比预设（公共比例面板，含原比例/自由 + 8×8 网格选择）
 *   - 旋转（0-360度滑动杆自由旋转）
 *   - 三分线网格辅助
 *   - 执行裁剪并下载结果
 *   - 使用公共 UI（cos-pwin / cos-ptoolbar / CosUI.draggable / WindowHelper）
 *     左右布局（左侧工具面板 + 右侧画布区域）
 */

var ImageCropSkill = {

    // ===== 基本信息 =====
    id: 'image-crop',
    name: '图片裁剪',
    icon: '<span style="color:#ef4444;">剪</span>',
    category: '图片处理',
    description: '宽高比预设、旋转、网格辅助裁剪',
    key: '4',

    // ===== 内部状态 =====
    _world: null,
    _overlay: null,
    _canvasSourceId: null,    // 从画布导入的图片ID（用于派生关系）
    _ratioMode: 'original',   // 'original' | 'free' | {w,h}
    _ratioLabel: '原比例',    // 显示文字

    // 事件引用（用于清理）
    _onDocMouseMove: null,
    _onDocMouseUp: null,

    // 裁剪状态
    _state: {
        isCropping: false,
        currentImage: null,
        originalImage: null,
        canvas: null,
        ctx: null,
        cropBox: { x: 0, y: 0, width: 200, height: 200 },
        aspectRatio: null,
        rotation: 0,
        gridType: 'thirds',
        isResizing: false,
        resizeHandle: null,
        startX: 0,
        startY: 0,
        startCropBox: { x: 0, y: 0, width: 0, height: 0 },
        isDragging: false,
        gridLines: null,
        scale: 1,
        displayW: 0,
        displayH: 0
    },

    // ===== 生命周期 =====

    activate: function(world) {
        this._world = world;

        if (this._overlay) {
            if (!this._overlay.parentNode) {
                document.body.appendChild(this._overlay);
            }
            SkillSystem.renderSubTools();
            this._tryLoadFromCanvas();
            this._startCanvasFollow();
            return;
        }

        this._createOverlay();
        SkillSystem.renderSubTools();
        this._tryLoadFromCanvas();
        this._startCanvasFollow();
    },

    /**
     * 从画布选中图片自动导入
     * 流程：先在画布点选图片 → 再点插件按钮 → 图片自动载入
     */
    _tryLoadFromCanvas: function() {
        if (typeof CanvasImages === 'undefined') {
            if (typeof showToast === 'function') showToast('画布图片引擎未就绪');
            return;
        }
        var dataURL = CanvasImages.getSelected('display');
        if (dataURL) {
            this._loadImageDataURL(dataURL);
            this._canvasSourceId = CanvasImages.getSelectedId();
            if (typeof showToast === 'function') showToast('已从画布导入选中图片');
        } else {
            if (typeof showToast === 'function') showToast('请先在画布中点选一张图片，再激活裁剪插件');
        }
    },

    // ===== 画布选中实时联动（窗口常驻时，点选别的画布图片自动切换裁剪源） =====
    _startCanvasFollow: function() {
        if (this._cfStop) return;
        var self = this;
        this._cfStop = CanvasFollow.bind(function() { self._onCanvasFollow(); }, {
            isAlive: function() { return !!(self._overlay && self._overlay.parentNode); },
            paused: function() { return !!self._cfLock; },
            interval: 200
        });
    },

    _stopCanvasFollow: function() {
        if (this._cfStop) { this._cfStop(); this._cfStop = null; }
        this._cfLock = false;
    },

    _onCanvasFollow: function() {
        this._tryLoadFromCanvas();
    },

    deactivate: function() {
        // 不隐藏窗口，只保存尺寸
        if (this._overlay) {
            this._saveWindowSize();
        }
    },

    getSubTools: function() {
        var self = this;
        return [
            {
                label: '关',
                action: function() {
                    if (typeof SkillSystem !== 'undefined') {
                        SkillSystem.deactivate();
                    }
                }
            }
        ];
    },

    save: function() {
        return {};
    },

    load: function(data) {},

    // ========================================
    //   CSS 样式（仅裁剪专属组件，公共样式由 css/plugin-theme.css 提供）
    // ========================================

    _getCSS: function() {
        return [
            /* 裁剪画布区域 */
            '.ic-canvas-wrap { position:relative; display:inline-block; overflow:hidden; background:rgba(0,0,0,.3); border-radius:6px; }',
            '.ic-canvas-wrap canvas { display:block; }',
            '.ic-crop-mask { position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:1; }',
            '.ic-crop-box { position:absolute; border:2px solid var(--cos-accent); background:transparent; cursor:move; z-index:2; box-shadow:0 0 0 9999px rgba(0,0,0,.55); }',
            '.ic-grid { position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:1; }',
            '.ic-resize-handle { position:absolute; width:14px; height:14px; background:rgba(15,52,96,.9); border:2px solid var(--cos-accent); border-radius:50%; box-sizing:border-box; box-shadow:0 2px 6px rgba(0,0,0,.4); transition:transform .15s; z-index:3; }',
            /* 旋转滑动杆 */
            '.ic-slider-row { display:flex; align-items:center; gap:8px; }',
            '.ic-slider { flex:1; -webkit-appearance:none; appearance:none; height:4px; background:rgba(56,189,248,0.2); border-radius:2px; outline:none; cursor:pointer; }',
            '.ic-slider::-webkit-slider-thumb { -webkit-appearance:none; appearance:none; width:16px; height:16px; background:var(--cos-accent); border-radius:50%; cursor:pointer; box-shadow:0 2px 6px rgba(0,0,0,.4); transition:transform .1s; }',
            '.ic-slider::-webkit-slider-thumb:hover { transform:scale(1.2); }',
            '.ic-slider::-moz-range-thumb { width:16px; height:16px; background:var(--cos-accent); border:none; border-radius:50%; cursor:pointer; }',
            '.ic-slider-val { min-width:42px; text-align:center; color:var(--cos-accent); font-weight:600; font-size:13px; flex-shrink:0; }',
            /* 比例选择按钮 */
            '.ic-ratio-btn { display:flex; align-items:center; justify-content:space-between; width:100%; padding:8px 14px; background:rgba(255,255,255,.06); color:var(--cos-text); border:1px solid var(--cos-border); border-radius:8px; cursor:pointer; font-size:12px; transition:all 0.15s; font-family:inherit; }',
            '.ic-ratio-btn:hover { background:var(--cos-accent-soft); border-color:var(--cos-accent); }',
            '.ic-ratio-btn .ic-ratio-val { color:var(--cos-accent); font-weight:600; font-size:13px; }'
        ].join('\n');
    },

    // ========================================
    //   创建弹出窗口
    // ========================================

    _createOverlay: function() {
        var self = this;

        var overlay = document.createElement('div');
        overlay.className = 'cos-pwin';
        overlay.id = 'icCard';
        overlay.setAttribute('data-skill-id', 'image-crop');

        // 恢复保存的尺寸/位置（使用公共库逻辑）
        var savedW = 860, savedH = 560, savedL = null, savedT = null;
        try {
            var saved = JSON.parse(localStorage.getItem('ic-window-size'));
            if (saved) {
                var sw = window.innerWidth, sh = window.innerHeight;
                savedW = Math.min(saved.w || 860, sw - 20);
                savedH = Math.min(saved.h || 560, sh - 20);
                savedL = Math.max(0, Math.min(saved.l, sw - savedW));
                savedT = Math.max(0, Math.min(saved.t, sh - savedH));
            }
        } catch(e) {}
        overlay.style.width = savedW + 'px';
        overlay.style.height = savedH + 'px';
        overlay.style.left = (savedL !== null ? savedL : Math.max(20, (window.innerWidth - savedW) / 2)) + 'px';
        overlay.style.top = (savedT !== null ? savedT : Math.max(20, (window.innerHeight - savedH) / 2)) + 'px';
        overlay.style.minWidth = '600px';
        overlay.style.minHeight = '400px';

        // 置顶
        var topZ = (window.__cos_topZ || 10000) + 1;
        window.__cos_topZ = topZ;
        overlay.style.zIndex = topZ;

        overlay.addEventListener('contextmenu', function(e) { e.preventDefault(); });
        overlay.addEventListener('mousedown', function() {
            var tz = (window.__cos_topZ || 10000) + 1;
            window.__cos_topZ = tz;
            overlay.style.zIndex = tz;
        });

        // 注入样式（仅裁剪专属样式，公共样式由 plugin-theme.css 提供）
        var styleEl = document.createElement('style');
        styleEl.textContent = this._getCSS();
        overlay.appendChild(styleEl);

        // 标题栏（使用公共 cos-pwin-hdr）
        var header = document.createElement('div');
        header.className = 'cos-pwin-hdr';
        header.innerHTML =
            '<span class="cos-pwin-hdr-title">图片裁剪</span>' +
            '<div class="cos-pwin-hdr-right">' +
                '<span class="cos-pclose" id="icCloseBtn" title="关闭">\u00d7</span>' +
            '</div>';
        overlay.appendChild(header);

        // App 容器（使用公共 cos-papp）
        var app = document.createElement('div');
        app.className = 'cos-papp';

        // 左侧面板（使用公共 cos-psidebar）
        var sidebar = document.createElement('div');
        sidebar.className = 'cos-psidebar';
        sidebar.innerHTML = this._buildSidebarHTML();
        app.appendChild(sidebar);

        // 右侧画布区域（使用公共 cos-pmain-checker 棋盘格背景）
        var main = document.createElement('div');
        main.className = 'cos-pmain-checker';
        main.id = 'icMain';
        main.innerHTML = this._buildMainHTML();
        app.appendChild(main);

        overlay.appendChild(app);

        // 底部信息栏（使用公共 cos-pinfobar）
        var infobar = document.createElement('div');
        infobar.className = 'cos-pinfobar';
        infobar.innerHTML = '<span id="icInfoSize">-</span><span id="icInfoCrop">-</span>';
        overlay.appendChild(infobar);

        document.body.appendChild(overlay);
        this._overlay = overlay;

        // 保存 canvas 引用
        this._state.canvas = overlay.querySelector('#icCanvas');
        this._state.ctx = this._state.canvas.getContext('2d');

        // 缩放（使用公共 WindowHelper）
        if (typeof WindowHelper !== 'undefined') {
            WindowHelper.makeResizable(overlay, { minWidth: 600, minHeight: 400, storeKey: 'ic-window-size' });
        }

        // 拖拽（使用公共 CosUI.draggable）
        if (typeof CosUI !== 'undefined' && CosUI.draggable) {
            CosUI.draggable.bind(overlay, header, {
                storeKey: 'ic-window-size',
                closeSelector: '#icCloseBtn,.cos-pclose'
            });
        }

        // 绑定事件
        this._bindEvents(overlay);
    },

    _buildSidebarHTML: function() {
        return '' +
            '<div class="cos-psection">' +
                '<div class="cos-psection-title">宽高比</div>' +
                '<button class="ic-ratio-btn" id="icRatioBtn">选择比例 <span class="ic-ratio-val" id="icRatioVal">原比例</span></button>' +
            '</div>' +
            '<div class="cos-psection">' +
                '<div class="cos-psection-title">旋转</div>' +
                '<div class="ic-slider-row">' +
                    '<input type="range" class="ic-slider" id="icRotSlider" min="0" max="360" value="0" step="1" />' +
                    '<span class="ic-slider-val" id="icRotVal">0\u00b0</span>' +
                '</div>' +
                '<div class="cos-pbtn-group" style="margin-top:6px">' +
                    '<button class="cos-pbtn cos-pbtn-secondary cos-pbtn-sm" id="icRotReset">恢复</button>' +
                    '<button class="cos-pbtn cos-pbtn-secondary cos-pbtn-sm" id="icRotLeft">\u219090\u00b0</button>' +
                    '<button class="cos-pbtn cos-pbtn-secondary cos-pbtn-sm" id="icRotRight">\u219290\u00b0</button>' +
                '</div>' +
            '</div>' +
            '<div class="cos-psection">' +
                '<button class="cos-pbtn cos-pbtn-primary" id="icCropBtn" style="width:100%">保存到画布</button>' +
            '</div>';
    },

    _buildMainHTML: function() {
        return '' +
            '<div class="cos-pempty" id="icEmpty">请先在画布中选中图片</div>' +
            '<div class="ic-canvas-wrap" id="icCanvasWrap" style="display:none">' +
                '<canvas id="icCanvas"></canvas>' +
                '<div class="ic-crop-mask" id="icMask"></div>' +
                '<div class="ic-crop-box" id="icCropBox">' +
                    '<div class="ic-grid" id="icGrid"></div>' +
                '</div>' +
            '</div>';
    },

    // ===== 销毁（关闭按钮调用） =====

    _destroy: function() {
        this._stopCanvasFollow();
        // 清理事件
        if (this._onDocMouseMove) {
            document.removeEventListener('mousemove', this._onDocMouseMove);
            this._onDocMouseMove = null;
        }
        if (this._onDocMouseUp) {
            document.removeEventListener('mouseup', this._onDocMouseUp);
            this._onDocMouseUp = null;
        }
        // 拖拽已由 CosUI.draggable.bind 管理，无需手动清理

        // 保存窗口大小
        this._saveWindowSize();

        if (this._overlay && this._overlay.parentNode) {
            this._overlay.parentNode.removeChild(this._overlay);
        }
        this._overlay = null;
        this._state.canvas = null;
        this._state.ctx = null;
        this._state.originalImage = null;
        this._state.isCropping = false;
        this._state.gridLines = null;
    },

    _saveWindowSize: function() {
        if (!this._overlay || !this._overlay.parentNode) return;
        // display:none 时 getBoundingClientRect 返回 0，跳过保存
        if (this._overlay.style.display === 'none') return;
        try {
            var r = this._overlay.getBoundingClientRect();
            if (r.width < 10 || r.height < 10) return;
            localStorage.setItem('ic-window-size', JSON.stringify({
                w: Math.round(r.width), h: Math.round(r.height),
                l: Math.round(r.left), t: Math.round(r.top)
            }));
        } catch(e) {}
    },

    // ========================================
    //   事件绑定
    // ========================================

    _bindEvents: function(ov) {
        var self = this;

        // 关闭按钮
        ov.querySelector('#icCloseBtn').addEventListener('click', function() {
            self._destroy();
            if (typeof SkillSystem !== 'undefined') {
                SkillSystem.deactivate();
            }
        });

        // 拖拽已由 CosUI.draggable.bind 在 _createOverlay 中处理

        // 比例选择按钮 → 弹出公共比例面板
        ov.querySelector('#icRatioBtn').addEventListener('click', function() {
            self._openRatioPanel(this);
        });

        // 旋转滑动杆
        var rotSlider = ov.querySelector('#icRotSlider');
        rotSlider.addEventListener('input', function() {
            self._setRotation(parseInt(this.value));
        });
        // 90度步进
        ov.querySelector('#icRotLeft').addEventListener('click', function() {
            self._rotate90(-1);
        });
        ov.querySelector('#icRotRight').addEventListener('click', function() {
            self._rotate90(1);
        });
        ov.querySelector('#icRotReset').addEventListener('click', function() {
            self._setRotation(0);
        });

        // 执行裁剪
        ov.querySelector('#icCropBtn').addEventListener('click', function() {
            self._executeCrop();
        });

        // 裁剪框拖动
        var cropBox = ov.querySelector('#icCropBox');
        cropBox.addEventListener('mousedown', function(e) {
            if (e.target === cropBox || e.target.id === 'icGrid') {
                self._startDrag(e);
            }
        });

        // 调整手柄
        ov.querySelectorAll('.ic-resize-handle').forEach(function(handle) {
            handle.addEventListener('mousedown', function(e) {
                e.stopPropagation();
                self._startResize(e);
            });
        });

        // 全局鼠标事件
        this._onDocMouseMove = function(e) {
            var st = self._state;
            if (st.isDragging) {
                self._dragCropBox(e);
            } else if (st.isResizing) {
                self._resizeCropBox(e);
            }
        };
        this._onDocMouseUp = function() {
            self._stopDrag();
            self._stopResize();
        };
        document.addEventListener('mousemove', this._onDocMouseMove);
        document.addEventListener('mouseup', this._onDocMouseUp);

        // 窗口大小变化时保存
        var resizeTimer = null;
        var ro = new ResizeObserver(function() {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function() {
                self._saveWindowSize();
            }, 200);
        });
        ro.observe(ov);
    },

    // ========================================
    //   图片加载
    // ========================================

    _loadImageDataURL: function(dataURL) {
        var self = this;
        var img = new Image();
        img.onload = function() { self._loadImage(img); };
        img.src = dataURL;
    },

    _loadImage: function(img) {
        var st = this._state;
        st.originalImage = img;

        // 计算适配画布区域的显示尺寸
        var mainEl = this._overlay.querySelector('#icMain');
        var maxW = mainEl.clientWidth - 40;
        var maxH = mainEl.clientHeight - 40;
        if (maxW < 100) maxW = 600;
        if (maxH < 100) maxH = 400;

        var width = img.width;
        var height = img.height;
        var scale = 1;
        if (width > maxW || height > maxH) {
            scale = Math.min(maxW / width, maxH / height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
        }

        st.scale = scale;
        st.displayW = width;
        st.displayH = height;

        st.canvas.width = width;
        st.canvas.height = height;

        // 更新容器尺寸
        var wrap = this._overlay.querySelector('#icCanvasWrap');
        wrap.style.width = width + 'px';
        wrap.style.height = height + 'px';

        // 默认使用原比例
        var originalAR = img.width / img.height;
        st.aspectRatio = originalAR;
        st.rotation = 0;

        // 裁剪框覆盖全图
        st.cropBox = { x: 0, y: 0, width: width, height: height };
        this._adjustCropBoxToRatio();

        // 绘制图片
        this._drawImage();
        this._updateCropBox();
        st.isCropping = true;

        // 更新旋转 UI
        this._updateRotationUI();

        // 默认选中"原比例"
        this._applyRatio({ special: 'original' });

        // 显示画布区域，隐藏空状态
        this._overlay.querySelector('#icEmpty').style.display = 'none';
        this._overlay.querySelector('#icCanvasWrap').style.display = 'inline-block';

        // 创建调整手柄
        this._createResizeHandles();

        // 创建网格线
        this._createGridLines();

        // 更新信息栏
        this._updateInfoBar();
    },

    // ========================================
    //   绘制
    // ========================================

    _drawImage: function() {
        var st = this._state;
        if (!st.originalImage) return;

        var ctx = st.ctx;
        var canvas = st.canvas;
        var img = st.originalImage;
        var rotation = st.rotation;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate((rotation * Math.PI) / 180);
        ctx.translate(-canvas.width / 2, -canvas.height / 2);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        ctx.restore();
    },

    // ========================================
    //   调整手柄
    // ========================================

    _createResizeHandles: function() {
        var self = this;
        var cropBox = this._overlay.querySelector('#icCropBox');

        // 移除旧手柄
        cropBox.querySelectorAll('.ic-resize-handle').forEach(function(h) { h.remove(); });

        var handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
        handles.forEach(function(handle) {
            var h = document.createElement('div');
            h.className = 'ic-resize-handle';
            h.dataset.handle = handle;
            h.style.cursor = self._getCursorStyle(handle);
            h.addEventListener('mousedown', function(e) {
                e.stopPropagation();
                self._startResize(e);
            });
            cropBox.appendChild(h);
        });

        this._updateResizeHandles();
    },

    _updateResizeHandles: function() {
        if (!this._overlay) return;
        var self = this;
        this._overlay.querySelectorAll('.ic-resize-handle').forEach(function(handle) {
            var type = handle.dataset.handle;
            var offset = -7;
            var left, top;
            handle.style.transform = '';

            switch (type) {
                case 'nw': left = offset + 'px'; top = offset + 'px'; break;
                case 'n': left = '50%'; top = offset + 'px'; handle.style.transform = 'translateX(-50%)'; break;
                case 'ne': left = '100%'; top = offset + 'px'; handle.style.transform = 'translateX(-100%)'; break;
                case 'e': left = '100%'; top = '50%'; handle.style.transform = 'translateX(-100%) translateY(-50%)'; break;
                case 'se': left = '100%'; top = '100%'; handle.style.transform = 'translateX(-100%) translateY(-100%)'; break;
                case 's': left = '50%'; top = '100%'; handle.style.transform = 'translateX(-50%) translateY(-100%)'; break;
                case 'sw': left = offset + 'px'; top = '100%'; handle.style.transform = 'translateY(-100%)'; break;
                case 'w': left = offset + 'px'; top = '50%'; handle.style.transform = 'translateY(-50%)'; break;
            }
            handle.style.left = left;
            handle.style.top = top;
        });
    },

    // ========================================
    //   裁剪框操作
    // ========================================

    _startDrag: function(e) {
        var st = this._state;
        st.isDragging = true;
        st.startX = e.clientX;
        st.startY = e.clientY;
        st.startCropBox = { x: st.cropBox.x, y: st.cropBox.y, width: st.cropBox.width, height: st.cropBox.height };
    },

    _stopDrag: function() {
        this._state.isDragging = false;
    },

    _startResize: function(e) {
        var st = this._state;
        st.isResizing = true;
        st.resizeHandle = e.target.dataset.handle;
        st.startX = e.clientX;
        st.startY = e.clientY;
        st.startCropBox = { x: st.cropBox.x, y: st.cropBox.y, width: st.cropBox.width, height: st.cropBox.height };
    },

    _stopResize: function() {
        var st = this._state;
        if (st.isResizing) {
            st.isResizing = false;
            this._updateInfoBar();
        }
    },

    _dragCropBox: function(e) {
        var st = this._state;
        var deltaX = e.clientX - st.startX;
        var deltaY = e.clientY - st.startY;
        var newX = st.startCropBox.x + deltaX;
        var newY = st.startCropBox.y + deltaY;

        st.cropBox.x = Math.max(0, Math.min(newX, st.canvas.width - st.cropBox.width));
        st.cropBox.y = Math.max(0, Math.min(newY, st.canvas.height - st.cropBox.height));
        this._updateCropBox();
    },

    _resizeCropBox: function(e) {
        var st = this._state;
        var deltaX = e.clientX - st.startX;
        var deltaY = e.clientY - st.startY;
        var x = st.startCropBox.x;
        var y = st.startCropBox.y;
        var width = st.startCropBox.width;
        var height = st.startCropBox.height;

        switch (st.resizeHandle) {
            case 'nw':
                width = Math.max(20, st.startCropBox.width - deltaX);
                height = Math.max(20, st.startCropBox.height - deltaY);
                x = st.startCropBox.x + (st.startCropBox.width - width);
                y = st.startCropBox.y + (st.startCropBox.height - height);
                break;
            case 'n':
                height = Math.max(20, st.startCropBox.height - deltaY);
                y = st.startCropBox.y + (st.startCropBox.height - height);
                break;
            case 'ne':
                width = Math.max(20, st.startCropBox.width + deltaX);
                height = Math.max(20, st.startCropBox.height - deltaY);
                y = st.startCropBox.y + (st.startCropBox.height - height);
                break;
            case 'e':
                width = Math.max(20, st.startCropBox.width + deltaX);
                break;
            case 'se':
                width = Math.max(20, st.startCropBox.width + deltaX);
                height = Math.max(20, st.startCropBox.height + deltaY);
                break;
            case 's':
                height = Math.max(20, st.startCropBox.height + deltaY);
                break;
            case 'sw':
                width = Math.max(20, st.startCropBox.width - deltaX);
                height = Math.max(20, st.startCropBox.height + deltaY);
                x = st.startCropBox.x + (st.startCropBox.width - width);
                break;
            case 'w':
                width = Math.max(20, st.startCropBox.width - deltaX);
                x = st.startCropBox.x + (st.startCropBox.width - width);
                break;
        }

        // 比例约束
        if (st.aspectRatio) {
            if (['nw', 'n', 'ne', 'sw', 's', 'se'].indexOf(st.resizeHandle) >= 0) {
                height = width / st.aspectRatio;
            } else {
                width = height * st.aspectRatio;
            }
        }

        // Canvas 边界约束
        if (x < 0) { x = 0; width = st.startCropBox.width + st.startCropBox.x; if (st.aspectRatio) height = width / st.aspectRatio; }
        if (y < 0) { y = 0; height = st.startCropBox.height + st.startCropBox.y; if (st.aspectRatio) width = height * st.aspectRatio; }
        if (x + width > st.canvas.width) { width = st.canvas.width - x; if (st.aspectRatio) height = width / st.aspectRatio; }
        if (y + height > st.canvas.height) { height = st.canvas.height - y; if (st.aspectRatio) width = height * st.aspectRatio; }

        st.cropBox = { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
        this._updateCropBox();
    },

    _adjustCropBoxToRatio: function() {
        var st = this._state;
        if (!st.aspectRatio) return;

        var centerX = st.cropBox.x + st.cropBox.width / 2;
        var centerY = st.cropBox.y + st.cropBox.height / 2;
        var currentArea = st.cropBox.width * st.cropBox.height;

        var newWidth, newHeight;
        if (st.aspectRatio > 1) {
            newWidth = Math.sqrt(currentArea * st.aspectRatio);
            newHeight = newWidth / st.aspectRatio;
        } else {
            newHeight = Math.sqrt(currentArea / st.aspectRatio);
            newWidth = newHeight * st.aspectRatio;
        }

        var maxW = st.canvas.width;
        var maxH = st.canvas.height;
        var scale = Math.min(maxW / newWidth, maxH / newHeight);
        newWidth = Math.round(newWidth * scale);
        newHeight = Math.round(newHeight * scale);

        st.cropBox.x = Math.round(centerX - newWidth / 2);
        st.cropBox.y = Math.round(centerY - newHeight / 2);
        st.cropBox.width = newWidth;
        st.cropBox.height = newHeight;

        if (st.cropBox.x < 0) st.cropBox.x = 0;
        if (st.cropBox.y < 0) st.cropBox.y = 0;
        if (st.cropBox.x + st.cropBox.width > maxW) st.cropBox.x = maxW - st.cropBox.width;
        if (st.cropBox.y + st.cropBox.height > maxH) st.cropBox.y = maxH - st.cropBox.height;

        this._updateCropBox();
    },

    // ========================================
    //   UI 更新
    // ========================================

    _updateCropBox: function() {
        if (!this._overlay) return;
        var st = this._state;
        var cropBox = this._overlay.querySelector('#icCropBox');
        var x = st.cropBox.x, y = st.cropBox.y, w = st.cropBox.width, h = st.cropBox.height;

        cropBox.style.left = x + 'px';
        cropBox.style.top = y + 'px';
        cropBox.style.width = w + 'px';
        cropBox.style.height = h + 'px';

        this._updateResizeHandles();
        this._updateGridLines();
        this._updateInfoBar();
    },

    _updateInfoBar: function() {
        if (!this._overlay) return;
        var st = this._state;
        var sizeEl = this._overlay.querySelector('#icInfoSize');
        var cropEl = this._overlay.querySelector('#icInfoCrop');

        if (st.originalImage) {
            sizeEl.innerHTML = '原图: <span class="cos-pinfobar-val">' + st.originalImage.width + ' x ' + st.originalImage.height + '</span>';
            var realW = Math.round(st.cropBox.width / st.scale);
            var realH = Math.round(st.cropBox.height / st.scale);
            cropEl.innerHTML = '裁剪: <span class="cos-pinfobar-val">' + realW + ' x ' + realH + '</span>';
        } else {
            sizeEl.textContent = '-';
            cropEl.textContent = '-';
        }
    },

    // ========================================
    //   网格线
    // ========================================

    _createGridLines: function() {
        if (!this._overlay) return;
        var gc = this._overlay.querySelector('#icGrid');
        if (!gc) return;
        gc.innerHTML = '';

        var st = this._state;

        function makeLine(isH) {
            var line = document.createElement('div');
            line.style.cssText = 'position:absolute;' +
                (isH ? 'left:0;right:0;height:1px;' : 'top:0;bottom:0;width:1px;') +
                'background:var(--cos-accent);opacity:0.7;pointer-events:none;z-index:3;';
            gc.appendChild(line);
            return line;
        }

        st.gridLines = { h1: makeLine(true), h2: makeLine(true), v1: makeLine(false), v2: makeLine(false) };
        this._updateGridLines();
    },

    _updateGridLines: function() {
        var st = this._state;
        if (!st.gridLines) return;

        if (st.gridLines.h1) { st.gridLines.h1.style.top = '33.33%'; st.gridLines.h2.style.top = '66.66%'; }
        if (st.gridLines.v1) { st.gridLines.v1.style.left = '33.33%'; st.gridLines.v2.style.left = '66.66%'; }
    },

    // ========================================
    //   比例选择
    // ========================================

    /**
     * 打开公共比例选择面板
     */
    _openRatioPanel: function(anchorEl) {
        var self = this;
        var current = null;
        if (this._ratioMode === 'original') {
            current = { special: 'original' };
        } else if (this._ratioMode === 'free') {
            current = { special: 'free' };
        } else if (this._ratioMode && this._ratioMode.w) {
            current = { w: this._ratioMode.w, h: this._ratioMode.h };
        }

        CosUI.ratioPanel.open({
            title: '裁剪比例',
            current: current,
            extraOptions: [
                { label: '原比例', value: 'original' },
                { label: '自由', value: 'free' }
            ],
            isValid: function() { return true; },
            anchorEl: anchorEl,
            onSelect: function(ratio) {
                self._applyRatio(ratio);
            }
        });
    },

    /**
     * 应用比例选择
     * @param {Object} ratio - { w, h } 或 { special: 'original'|'free' }
     */
    _applyRatio: function(ratio) {
        if (!this._overlay) return;
        var st = this._state;

        if (ratio.special === 'free') {
            st.aspectRatio = null;
            this._ratioMode = 'free';
            this._ratioLabel = '自由';
        } else if (ratio.special === 'original') {
            st.aspectRatio = st.originalImage ? st.originalImage.width / st.originalImage.height : null;
            this._ratioMode = 'original';
            this._ratioLabel = '原比例';
        } else if (ratio.w && ratio.h) {
            st.aspectRatio = ratio.w / ratio.h;
            this._ratioMode = { w: ratio.w, h: ratio.h };
            this._ratioLabel = ratio.w + ':' + ratio.h;
        }

        // 更新显示
        var valEl = this._overlay.querySelector('#icRatioVal');
        if (valEl) valEl.textContent = this._ratioLabel;

        if (st.originalImage) {
            this._adjustCropBoxToRatio();
        }
    },

    // ========================================
    //   旋转
    // ========================================

    _rotate90: function(dir) {
        var st = this._state;
        var newRotation = st.rotation + (dir || 1) * 90;
        if (newRotation >= 360) newRotation -= 360;
        if (newRotation < 0) newRotation += 360;
        this._setRotation(newRotation);
    },

    _setRotation: function(rotation) {
        var st = this._state;
        st.rotation = rotation;
        this._drawImage();
        this._updateRotationUI();
    },

    _updateRotationUI: function() {
        if (!this._overlay) return;
        var el = this._overlay.querySelector('#icRotVal');
        if (el) el.textContent = this._state.rotation + '°';
        var slider = this._overlay.querySelector('#icRotSlider');
        if (slider) slider.value = this._state.rotation;
    },

    // ========================================
    //   执行裁剪
    // ========================================

    /**
     * 生成裁剪结果 dataURL（共用方法）
     * @returns {string|null} dataURL 或 null
     */
    _generateCropResult: function() {
        var st = this._state;
        if (!st.originalImage || !st.isCropping) return null;

        // 临时 Canvas 绘制旋转后的完整图片
        var tempCanvas = document.createElement('canvas');
        var tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = st.originalImage.width;
        tempCanvas.height = st.originalImage.height;

        tempCtx.save();
        tempCtx.translate(tempCanvas.width / 2, tempCanvas.height / 2);
        if (st.rotation !== 0) {
            tempCtx.rotate((st.rotation * Math.PI) / 180);
        }
        tempCtx.translate(-tempCanvas.width / 2, -tempCanvas.height / 2);
        tempCtx.drawImage(st.originalImage, 0, 0);
        tempCtx.restore();

        // 计算实际裁剪区域（显示坐标 → 原始图片坐标）
        var scaleX = st.originalImage.width / st.canvas.width;
        var scaleY = st.originalImage.height / st.canvas.height;
        var actualX = st.cropBox.x * scaleX;
        var actualY = st.cropBox.y * scaleY;
        var actualW = st.cropBox.width * scaleX;
        var actualH = st.cropBox.height * scaleY;

        // 裁剪结果
        var resultCanvas = document.createElement('canvas');
        var resultCtx = resultCanvas.getContext('2d');
        resultCanvas.width = Math.round(actualW);
        resultCanvas.height = Math.round(actualH);
        resultCtx.drawImage(tempCanvas, actualX, actualY, actualW, actualH, 0, 0, resultCanvas.width, resultCanvas.height);

        return resultCanvas.toDataURL('image/png');
    },

    /**
     * 执行裁剪 → 保存到画布
     */
    _executeCrop: function() {
        var st = this._state;
        if (!st.originalImage || !st.isCropping) {
            if (typeof showToast === 'function') showToast('请先上传图片');
            return;
        }

        try {
            var resultDataURL = this._generateCropResult();
            if (!resultDataURL) return;

            // 保存到画布
            if (typeof CanvasImages !== 'undefined') {
                var parentId = this._canvasSourceId || null;
                CanvasImages.place(resultDataURL, null, null, '裁剪', parentId);
                if (typeof showToast === 'function') showToast('裁剪完成，已保存到画布');
            } else {
                // fallback: 直接下载
                var link = document.createElement('a');
                link.download = 'cropped_' + Date.now() + '.png';
                link.href = resultDataURL;
                link.click();
                if (typeof showToast === 'function') showToast('裁剪完成，已下载');
            }
        } catch (err) {
            console.error('裁剪失败:', err);
            if (typeof showToast === 'function') showToast('裁剪失败，请重试');
        }
    },

    // ========================================
    //   工具方法
    // ========================================

    _getCursorStyle: function(handle) {
        var map = {
            'nw': 'nwse-resize', 'n': 'ns-resize', 'ne': 'nesw-resize',
            'e': 'ew-resize', 'se': 'nwse-resize', 's': 'ns-resize',
            'sw': 'nesw-resize', 'w': 'ew-resize'
        };
        return map[handle] || 'move';
    }
};
