/**
 * 图片裁剪技能 - v65 插件
 *
 * 功能：
 *   - 图片上传（拖放或点击选择）
 *   - 裁剪框可拖拽调整大小（8个手柄）
 *   - 宽高比预设（原比例/1:1/4:3/16:9/3:2/2:3/自由）
 *   - 旋转（90度步进）
 *   - 网格叠加（三分线/对角线/无）
 *   - 执行裁剪并下载结果
 *   - 深色主题，左右布局（左侧工具面板 + 右侧画布区域）
 */

var ImageCropSkill = {

    // ===== 基本信息 =====
    id: 'image-crop',
    name: '图片裁剪',
    icon: '剪',
    category: '图片处理',
    description: '宽高比预设、旋转、网格辅助裁剪',
    key: '4',

    // ===== 内部状态 =====
    _world: null,
    _overlay: null,

    // 事件引用（用于清理）
    _onDocMouseMove: null,
    _onDocMouseUp: null,
    _onHeaderDown: null,

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
            return;
        }

        this._createOverlay();
        SkillSystem.renderSubTools();
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
    //   CSS 样式（深色主题，和抠图插件一致）
    // ========================================

    _getCSS: function() {
        return [
            '.ic-overlay { position:fixed; width:860px; height:560px; z-index:9999; display:flex; flex-direction:column; background:#0f3460; color:#eee; font-family:"Segoe UI",system-ui,sans-serif; border-radius:10px; box-shadow:0 8px 40px rgba(0,0,0,.6); overflow:hidden; user-select:none; resize:both; min-width:600px; min-height:400px; transition:opacity 0.15s; }',
            '.ic-header { display:flex; align-items:center; justify-content:space-between; padding:8px 16px; background:#16213e; border-bottom:1px solid #333; flex-shrink:0; cursor:move; user-select:none; }',
            '.ic-header h1 { font-size:16px; background:linear-gradient(135deg,#e94560,#ff6b9d); -webkit-background-clip:text; -webkit-text-fill-color:transparent; margin:0; }',
            '.ic-close-btn { background:rgba(220,80,60,.2); border:1px solid rgba(220,80,60,.3); color:#e87060; border-radius:6px; padding:5px 14px; cursor:pointer; font-size:13px; }',
            '.ic-close-btn:hover { background:rgba(220,80,60,.4); }',
            '.ic-app { display:flex; flex:1; overflow:hidden; min-height:0; }',
            '.ic-sidebar { width:240px; min-width:240px; background:#16213e; border-right:1px solid #333; overflow-y:auto; padding:12px; }',
            '.ic-main { flex:1; display:flex; align-items:center; justify-content:center; overflow:auto; position:relative; background:repeating-conic-gradient(rgba(255,255,255,.03) 0% 25%,transparent 0% 50%) 0 0/20px 20px; min-width:0; }',
            '.ic-section { margin-bottom:14px; padding:10px; border:1px dashed #444; border-radius:8px; background:rgba(255,255,255,.02); }',
            '.ic-section-title { font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#aaa; margin-bottom:7px; display:flex; align-items:center; gap:6px; }',
            '.ic-section-title::before { content:""; width:3px; height:12px; background:#e94560; border-radius:2px; }',
            '.ic-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:7px 14px; border:none; border-radius:6px; cursor:pointer; font-size:12px; font-weight:500; transition:.2s; }',
            '.ic-btn-primary { background:#e94560; color:#fff; }',
            '.ic-btn-primary:hover { background:#d63851; transform:translateY(-1px); }',
            '.ic-btn-secondary { background:rgba(255,255,255,.08); color:#eee; border:1px solid #333; }',
            '.ic-btn-secondary:hover { background:rgba(255,255,255,.12); }',
            '.ic-btn-sm { padding:5px 10px; font-size:11px; }',
            '.ic-btn-group { display:flex; gap:4px; flex-wrap:wrap; }',
            '.ic-btn-group .ic-btn { flex:1; min-width:0; }',
            '.ic-btn-group .ic-btn.active { background:#e94560; color:#fff; border-color:#e94560; }',
            '.ic-infobar { display:flex; align-items:center; justify-content:space-between; padding:6px 16px; background:#16213e; border-top:1px solid #333; font-size:11px; color:#aaa; flex-shrink:0; }',
            '.ic-infobar .ic-val { color:#e94560; font-weight:600; }',
            '.ic-canvas-wrap { position:relative; display:inline-block; overflow:hidden; background:rgba(0,0,0,.3); border-radius:4px; }',
            '.ic-canvas-wrap canvas { display:block; }',
            '.ic-crop-mask { position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:1; }',
            '.ic-crop-box { position:absolute; border:2px solid #e94560; background:transparent; cursor:move; z-index:2; box-shadow:0 0 0 9999px rgba(0,0,0,.55); }',
            '.ic-grid { position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:1; }',
            '.ic-resize-handle { position:absolute; width:14px; height:14px; background:rgba(15,52,96,.9); border:2px solid #e94560; border-radius:50%; box-sizing:border-box; box-shadow:0 2px 6px rgba(0,0,0,.4); transition:transform .15s; z-index:3; }',
            '.ic-empty { display:flex; align-items:center; justify-content:center; height:100%; color:#666; font-size:14px; }',
            '::-webkit-scrollbar { width:6px; }',
            '::-webkit-scrollbar-track { background:transparent; }',
            '::-webkit-scrollbar-thumb { background:#333; border-radius:3px; }'
        ].join('\n');
    },

    // ========================================
    //   创建弹出窗口
    // ========================================

    _createOverlay: function() {
        var self = this;

        var overlay = document.createElement('div');
        overlay.className = 'ic-overlay';
        overlay.id = 'icCard';
        overlay.setAttribute('data-skill-id', 'image-crop');
        overlay.style.left = Math.max(20, (window.innerWidth - 860) / 2) + 'px';
        overlay.style.top = Math.max(20, (window.innerHeight - 560) / 2) + 'px';

        // 恢复上次窗口大小和位置
        var savedSize = null;
        try { savedSize = JSON.parse(localStorage.getItem('ic-window-size')); } catch(e) {}
        if (savedSize && savedSize.w && savedSize.h) {
            overlay.style.width = savedSize.w + 'px';
            overlay.style.height = savedSize.h + 'px';
            if (savedSize.l !== undefined) overlay.style.left = savedSize.l + 'px';
            if (savedSize.t !== undefined) overlay.style.top = savedSize.t + 'px';
        }

        // 注入样式
        var styleEl = document.createElement('style');
        styleEl.textContent = this._getCSS();
        overlay.appendChild(styleEl);

        // 标题栏
        var header = document.createElement('div');
        header.className = 'ic-header';
        header.innerHTML = '<h1>图片裁剪</h1><button class="ic-close-btn" id="icCloseBtn">关</button>';
        overlay.appendChild(header);

        // App 容器
        var app = document.createElement('div');
        app.className = 'ic-app';

        // 左侧面板
        var sidebar = document.createElement('div');
        sidebar.className = 'ic-sidebar';
        sidebar.innerHTML = this._buildSidebarHTML();
        app.appendChild(sidebar);

        // 右侧画布区域
        var main = document.createElement('div');
        main.className = 'ic-main';
        main.id = 'icMain';
        main.innerHTML = this._buildMainHTML();
        app.appendChild(main);

        overlay.appendChild(app);

        // 底部信息栏
        var infobar = document.createElement('div');
        infobar.className = 'ic-infobar';
        infobar.innerHTML = '<span id="icInfoSize">-</span><span id="icInfoCrop">-</span>';
        overlay.appendChild(infobar);

        document.body.appendChild(overlay);
        this._overlay = overlay;

        // 保存 canvas 引用
        this._state.canvas = overlay.querySelector('#icCanvas');
        this._state.ctx = this._state.canvas.getContext('2d');

        // 绑定事件
        this._bindEvents(overlay);
    },

    _buildSidebarHTML: function() {
        return '' +
            '<div class="ic-section">' +
                '<div class="ic-section-title">上传图片</div>' +
                '<button class="ic-btn ic-btn-primary" id="icUploadBtn" style="width:100%">选择图片</button>' +
                '<input type="file" id="icFileInput" accept="image/*" style="display:none">' +
            '</div>' +
            '<div class="ic-section">' +
                '<div class="ic-section-title">宽高比</div>' +
                '<div class="ic-btn-group" id="icRatioGroup">' +
                    '<button class="ic-btn ic-btn-sm active" data-ratio="original">原比例</button>' +
                    '<button class="ic-btn ic-btn-sm" data-ratio="1:1">1:1</button>' +
                    '<button class="ic-btn ic-btn-sm" data-ratio="4:3">4:3</button>' +
                    '<button class="ic-btn ic-btn-sm" data-ratio="16:9">16:9</button>' +
                    '<button class="ic-btn ic-btn-sm" data-ratio="3:2">3:2</button>' +
                    '<button class="ic-btn ic-btn-sm" data-ratio="2:3">2:3</button>' +
                    '<button class="ic-btn ic-btn-sm" data-ratio="free">自由</button>' +
                '</div>' +
            '</div>' +
            '<div class="ic-section">' +
                '<div class="ic-section-title">网格</div>' +
                '<div class="ic-btn-group" id="icGridGroup">' +
                    '<button class="ic-btn ic-btn-sm active" data-grid="thirds">三分线</button>' +
                    '<button class="ic-btn ic-btn-sm" data-grid="diagonal">对角线</button>' +
                    '<button class="ic-btn ic-btn-sm" data-grid="none">无</button>' +
                '</div>' +
            '</div>' +
            '<div class="ic-section">' +
                '<div class="ic-section-title">旋转</div>' +
                '<div style="display:flex;gap:4px">' +
                    '<button class="ic-btn ic-btn-sm" id="icRotLeft" style="flex:1">&larr;90&deg;</button>' +
                    '<span id="icRotVal" style="flex:1;text-align:center;line-height:28px;color:#e94560;font-size:13px">0&deg;</span>' +
                    '<button class="ic-btn ic-btn-sm" id="icRotRight" style="flex:1">&rarr;90&deg;</button>' +
                '</div>' +
                '<button class="ic-btn ic-btn-sm" id="icRotReset" style="width:100%;margin-top:4px">恢复角度</button>' +
            '</div>' +
            '<div class="ic-section">' +
                '<button class="ic-btn ic-btn-primary" id="icCropBtn" style="width:100%">执行裁剪</button>' +
            '</div>';
    },

    _buildMainHTML: function() {
        return '' +
            '<div class="ic-empty" id="icEmpty">请上传图片</div>' +
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
        // 清理事件
        if (this._onDocMouseMove) {
            document.removeEventListener('mousemove', this._onDocMouseMove);
            this._onDocMouseMove = null;
        }
        if (this._onDocMouseUp) {
            document.removeEventListener('mouseup', this._onDocMouseUp);
            this._onDocMouseUp = null;
        }
        if (this._onHeaderDown) {
            document.removeEventListener('mousedown', this._onHeaderDown, true);
            this._onHeaderDown = null;
        }

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

        // 标题栏拖拽
        this._onHeaderDown = function(e) {
            var header = ov.querySelector('.ic-header');
            if (!header.contains(e.target)) return;
            if (e.target.closest('button')) return;
            e.preventDefault();
            var startX = e.clientX;
            var startY = e.clientY;
            var rect = ov.getBoundingClientRect();
            var origLeft = rect.left;
            var origTop = rect.top;

            function onMove(ev) {
                ov.style.left = (origLeft + ev.clientX - startX) + 'px';
                ov.style.top = (origTop + ev.clientY - startY) + 'px';
            }
            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                self._saveWindowSize();
            }
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        };
        document.addEventListener('mousedown', this._onHeaderDown, true);

        // 上传按钮
        ov.querySelector('#icUploadBtn').addEventListener('click', function() {
            ov.querySelector('#icFileInput').click();
        });

        // 文件选择
        ov.querySelector('#icFileInput').addEventListener('change', function(e) {
            if (e.target.files.length > 0) {
                self._loadImageFile(e.target.files[0]);
            }
        });

        // 拖放到画布区域
        var mainArea = ov.querySelector('#icMain');
        mainArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            e.stopPropagation();
        });
        mainArea.addEventListener('drop', function(e) {
            e.preventDefault();
            e.stopPropagation();
            var files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                self._loadImageFile(files[0]);
            }
        });

        // 比例按钮
        ov.querySelectorAll('#icRatioGroup .ic-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                self._selectRatio(btn.dataset.ratio);
            });
        });

        // 网格按钮
        ov.querySelectorAll('#icGridGroup .ic-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                self._setGridType(btn.dataset.grid);
            });
        });

        // 旋转按钮
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

    _loadImageFile: function(file) {
        var self = this;
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                self._loadImage(img);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
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
        this._selectRatio('original');

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
            sizeEl.innerHTML = '原图: <span class="ic-val">' + st.originalImage.width + ' x ' + st.originalImage.height + '</span>';
            var realW = Math.round(st.cropBox.width / st.scale);
            var realH = Math.round(st.cropBox.height / st.scale);
            cropEl.innerHTML = '裁剪: <span class="ic-val">' + realW + ' x ' + realH + '</span>';
        } else {
            sizeEl.textContent = '-';
            cropEl.textContent = '-';
        }
    },

    // ========================================
    //   网格线
    // ========================================

    _createGridLines: function() {
        var st = this._state;
        if (!this._overlay) return;
        var gc = this._overlay.querySelector('#icGrid');
        if (!gc) return;
        gc.innerHTML = '';

        if (st.gridType === 'none') {
            st.gridLines = null;
            return;
        }

        function makeLine(isH) {
            var line = document.createElement('div');
            line.style.cssText = 'position:absolute;' +
                (isH ? 'left:0;right:0;height:1px;' : 'top:0;bottom:0;width:1px;') +
                'background:#e94560;opacity:0.7;pointer-events:none;z-index:3;';
            gc.appendChild(line);
            return line;
        }

        if (st.gridType === 'thirds') {
            st.gridLines = { h1: makeLine(true), h2: makeLine(true), v1: makeLine(false), v2: makeLine(false) };
        } else if (st.gridType === 'diagonal') {
            var d1 = document.createElement('div');
            d1.style.cssText = 'position:absolute;top:0;left:0;width:141%;height:1px;background:#e94560;opacity:0.7;pointer-events:none;z-index:3;transform-origin:0 0;transform:rotate(45deg);';
            gc.appendChild(d1);
            var d2 = document.createElement('div');
            d2.style.cssText = 'position:absolute;top:0;right:0;width:141%;height:1px;background:#e94560;opacity:0.7;pointer-events:none;z-index:3;transform-origin:100% 0;transform:rotate(-45deg);';
            gc.appendChild(d2);
            st.gridLines = { d1: d1, d2: d2 };
        }

        this._updateGridLines();
    },

    _updateGridLines: function() {
        var st = this._state;
        if (!st.gridLines) return;

        if (st.gridType === 'thirds') {
            if (st.gridLines.h1) { st.gridLines.h1.style.top = '33.33%'; st.gridLines.h2.style.top = '66.66%'; }
            if (st.gridLines.v1) { st.gridLines.v1.style.left = '33.33%'; st.gridLines.v2.style.left = '66.66%'; }
        }
    },

    // ========================================
    //   比例选择
    // ========================================

    _selectRatio: function(ratio) {
        if (!this._overlay) return;
        var st = this._state;

        // 更新按钮样式
        this._overlay.querySelectorAll('#icRatioGroup .ic-btn').forEach(function(btn) {
            if (btn.dataset.ratio === ratio) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        if (ratio === 'free') {
            st.aspectRatio = null;
        } else if (ratio === 'original') {
            st.aspectRatio = st.originalImage ? st.originalImage.width / st.originalImage.height : null;
        } else {
            var parts = ratio.split(':');
            st.aspectRatio = parseInt(parts[0]) / parseInt(parts[1]);
        }

        if (st.originalImage) {
            this._adjustCropBoxToRatio();
        }
    },

    // ========================================
    //   网格类型
    // ========================================

    _setGridType: function(type) {
        if (!this._overlay) return;
        var st = this._state;
        st.gridType = type;

        this._overlay.querySelectorAll('#icGridGroup .ic-btn').forEach(function(btn) {
            if (btn.dataset.grid === type) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        this._createGridLines();
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
        if (el) el.innerHTML = this._state.rotation + '&deg;';
    },

    // ========================================
    //   执行裁剪
    // ========================================

    _executeCrop: function() {
        var st = this._state;
        if (!st.originalImage || !st.isCropping) {
            if (typeof showToast === 'function') showToast('请先上传图片');
            return;
        }

        try {
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

            // 计算实际裁剪区域（显示坐标 -> 原始图片坐标）
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

            // 下载
            var link = document.createElement('a');
            link.download = 'cropped_' + Date.now() + '.png';
            link.href = resultCanvas.toDataURL('image/png');
            link.click();

            if (typeof showToast === 'function') showToast('裁剪完成，已下载');
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
