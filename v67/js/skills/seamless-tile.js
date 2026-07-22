/**
 * 无缝平铺（无限铺贴）插件 - 画境 v67
 *
 * - 左侧图片集（缩略图，可删除/清空）
 * - 右侧无限平铺画布：选一张可平铺的图，向任意方向无缝重复铺开
 * - 拖拽平移 · 滚轮缩放（以光标为锚点）· 触摸双指缩放
 * - 数据持久化到 IndexedDB（支持大图）
 *
 * 参考：无缝图.html（独立原型），此处改写为 SkillSystem 窗口插件，
 *       拖拽/缩放只作用在自己的窗口内，不污染全局 drop / 拖拽事件。
 */

var SeamlessTileSkill = {

    id: 'seamless-tile',
    name: '无缝平铺',
    icon: '<span style="color:#ef4444">∞</span>',
    description: '单图无限平铺预览，拖拽平移、滚轮缩放',
    key: 't',

    _world: null,
    _active: false,
    _overlay: null,
    _panel: null,
    _canvas: null,
    _ctx: null,
    _thumbGrid: null,
    _zoomBadge: null,
    _countBadge: null,
    _hint: null,
    _wInput: null,
    _hInput: null,

    // 状态
    _images: [],          // [{id, name, dataUrl, w, h}]
    _activeId: null,
    _sourceImg: null,
    _imgW: 0, _imgH: 0,
    _offsetX: 0, _offsetY: 0,
    _scale: 1,

    _isDragging: false,
    _dragStartX: 0, _dragStartY: 0,
    _dragOffX: 0, _dragOffY: 0,
    _hintTimer: null,
    _lastTouchDist: 0,

    _ro: null,            // ResizeObserver

    // ============ 生命周期 ============

    activate: function(world) {
        this._world = world;
        this._active = true;
        if (!this._overlay) {
            this._createWindow();
        } else {
            if (!this._overlay.parentNode) document.body.appendChild(this._overlay);
            this._overlay.style.display = '';
            this._resize();
        }
        if (typeof SkillSystem !== 'undefined') SkillSystem.renderSubTools();
        this._startCanvasFollow();
    },

    deactivate: function() {
        this._active = false;
        this._stopCanvasFollow();
    },

    // ===== 画布选中实时联动（窗口常驻时，点选别的画布图片自动并入图片集） =====
    _startCanvasFollow: function() {
        if (this._cfStop) return;
        var self = this;
        this._cfStop = CanvasFollow.bind(function() { self._onCanvasFollow(); }, {
            isAlive: function() { return !!(self._overlay && self._overlay.parentNode && self._overlay.style.display !== 'none'); },
            paused: function() { return !!self._cfLock; },
            interval: 200
        });
    },

    _stopCanvasFollow: function() {
        if (this._cfStop) { this._cfStop(); this._cfStop = null; }
        this._cfLock = false;
    },

    _onCanvasFollow: function() {
        this._importFromCanvas();
    },

    getSubTools: function() {
        var self = this;
        return [
            { label: '关', title: '关闭窗口', action: function() {
                if (typeof SkillSystem !== 'undefined') SkillSystem.deactivate();
            }}
        ];
    },

    save: function() { return {}; },
    load: function() {},

    // ============ 创建窗口 ============

    _createWindow: function() {
        var self = this;
        var ov = document.createElement('div');
        ov.className = 'cos-pwin st-win';
        ov.setAttribute('data-skill-id', 'seamless-tile');
        ov.style.width = '760px';
        ov.style.height = '540px';

        var topZ = (window.__cos_topZ || 10000) + 1;
        window.__cos_topZ = topZ;
        ov.style.zIndex = topZ;

        ov.innerHTML =
            '<div class="cos-pwin-hdr st-hdr">' +
                '<span class="cos-pwin-hdr-title">♾️ 无缝平铺</span>' +
                '<span class="st-zoom" id="stZoom">—</span>' +
                '<div class="cos-pwin-hdr-right">' +
                    '<span class="cos-pclose" data-action="close" title="关闭">×</span>' +
                '</div>' +
            '</div>' +
            '<div class="st-body">' +
                // 工具栏
                '<div class="st-toolbar">' +
                    '<button class="cos-pbtn cos-pbtn-primary st-btn" id="stImport">📥 从画布导入</button>' +
                    '<button class="cos-pbtn cos-pbtn-sm st-btn" id="stClear">清空全部</button>' +
                    '<span class="st-count" id="stCount">0 张</span>' +
                    '<span class="st-sep"></span>' +
                    '<label class="st-exp-l">导出</label>' +
                    '<input class="st-inp" id="stExpW" type="number" min="16" max="4096" step="1" value="1024" title="导出宽度(像素)">' +
                    '<span class="st-x">×</span>' +
                    '<input class="st-inp" id="stExpH" type="number" min="16" max="4096" step="1" value="1024" title="导出高度(像素)">' +
                    '<button class="cos-pbtn cos-pbtn-sm st-btn st-export-btn" id="stExport">⬆ 导出到画布</button>' +
                    '<span class="st-hint">🖱 拖拽平移 · 滚轮缩放</span>' +
                '</div>' +
                // 左右分栏
                '<div class="st-split">' +
                    '<div class="st-left">' +
                        '<div class="st-left-hd"><span>📷 图片集</span></div>' +
                        '<div class="st-thumbs" id="stThumbs"></div>' +
                    '</div>' +
                    '<div class="st-right" id="stPanel">' +
                        '<canvas id="stCanvas"></canvas>' +
                        '<div class="st-canvas-hint" id="stHint">🖱 拖拽查看各个方向</div>' +
                    '</div>' +
                '</div>' +
            '</div>';

        document.body.appendChild(ov);
        this._overlay = ov;

        this._panel = ov.querySelector('#stPanel');
        this._canvas = ov.querySelector('#stCanvas');
        this._ctx = this._canvas.getContext('2d');
        this._thumbGrid = ov.querySelector('#stThumbs');
        this._zoomBadge = ov.querySelector('#stZoom');
        this._countBadge = ov.querySelector('#stCount');
        this._hint = ov.querySelector('#stHint');
        this._wInput = ov.querySelector('#stExpW');
        this._hInput = ov.querySelector('#stExpH');

        // 置顶
        ov.addEventListener('mousedown', function() {
            var tz = (window.__cos_topZ || 10000) + 1;
            window.__cos_topZ = tz;
            ov.style.zIndex = tz;
        });

        // 关闭
        ov.querySelector('[data-action="close"]').addEventListener('click', function() {
            ov.style.display = 'none';
            if (typeof SkillSystem !== 'undefined') SkillSystem.deactivate();
        });

        // 缩放（仅窗口尺寸，内部 canvas 跟随 panel）
        if (typeof WindowHelper !== 'undefined') {
            WindowHelper.makeResizable(ov, { minWidth: 480, minHeight: 360, storeKey: 'st-win' });
        }

        // 拖拽（使用公共 CosUI.draggable）
        var header = ov.querySelector('.st-hdr');
        if (typeof CosUI !== 'undefined' && CosUI.draggable) {
            CosUI.draggable.bind(ov, header, { storeKey: 'st-win', closeSelector: '[data-action="close"],.cos-pclose' });
        }

        // canvas 跟随 panel 尺寸
        this._ro = new ResizeObserver(function() { self._resize(); });
        this._ro.observe(this._panel);

        this._bindEvents();
        this._loadFromDisk().then(function() {
            self._renderGallery();
            self._resize();
            if (self._images.length > 0) self._selectImage(self._images[0].id);
            else self._importFromCanvas();   // 首次无图：自动从画布导入选中图
            setTimeout(function() { self._showHint(); }, 500);
        });
    },

    // ============ 事件绑定（窗口内，不污染全局） ============

    _bindEvents: function() {
        var self = this;
        var ov = this._overlay;
        var panel = this._panel;

        // 从画布导入选中图（替代原"添加图片"按钮）
        ov.querySelector('#stImport').addEventListener('click', function() { self._importFromCanvas(); });

        // 导出到画布（按设置宽高平铺）
        ov.querySelector('#stExport').addEventListener('click', function() { self._exportToCanvas(); });

        // 清空
        ov.querySelector('#stClear').addEventListener('click', function() {
            if (self._images.length === 0) return;
            if (typeof confirm === 'function' && !confirm('确定清空全部图片？')) return;
            self._clearAll();
        });

        // 缩略图网格（事件委托，绑一次）
        if (!this._thumbGrid._delegated) {
            this._thumbGrid._delegated = true;
            this._thumbGrid.addEventListener('click', function(e) {
                var card = e.target.closest('.st-card');
                if (!card) return;
                if (e.target.closest('.st-del')) { self._removeImage(card.dataset.id); return; }
                self._selectImage(card.dataset.id);
            });
        }

        // 拖拽上传（仅窗口内）
        ov.addEventListener('dragover', function(e) { e.preventDefault(); });
        ov.addEventListener('drop', function(e) {
            e.preventDefault();
            var files = e.dataTransfer && e.dataTransfer.files;
            if (files && files.length) self._addImages(files);
        });

        // 滚轮缩放（以光标为锚点）
        panel.addEventListener('wheel', function(e) {
            if (!self._sourceImg) return;
            e.preventDefault();
            self._zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 1 / 1.1);
            self._draw();
        }, { passive: false });

        // 鼠标拖拽
        panel.addEventListener('mousedown', function(e) {
            if (!self._sourceImg) return;
            self._isDragging = true;
            self._dragStartX = e.clientX;
            self._dragStartY = e.clientY;
            self._dragOffX = self._offsetX;
            self._dragOffY = self._offsetY;
            panel.style.cursor = 'grabbing';
        });

        // 鼠标移动/抬起绑在 window（拖出窗口仍可平移），用 _active 与 _isDragging 守卫
        window.addEventListener('mousemove', function(e) {
            if (!self._active || !self._isDragging) return;
            self._offsetX = self._dragOffX - (e.clientX - self._dragStartX) / self._scale;
            self._offsetY = self._dragOffY - (e.clientY - self._dragStartY) / self._scale;
            self._draw();
        });
        window.addEventListener('mouseup', function() {
            if (self._isDragging) {
                self._isDragging = false;
                panel.style.cursor = 'grab';
            }
        });

        // 触摸
        panel.addEventListener('touchstart', function(e) {
            if (!self._sourceImg) return;
            if (e.touches.length === 1) {
                self._isDragging = true;
                var t = e.touches[0];
                self._dragStartX = t.clientX;
                self._dragStartY = t.clientY;
                self._dragOffX = self._offsetX;
                self._dragOffY = self._offsetY;
            } else if (e.touches.length === 2) {
                var t1 = e.touches[0], t2 = e.touches[1];
                self._lastTouchDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
            }
        }, { passive: true });
        panel.addEventListener('touchmove', function(e) {
            e.preventDefault();
            if (!self._sourceImg) return;
            if (e.touches.length === 1 && self._isDragging) {
                var t = e.touches[0];
                self._offsetX = self._dragOffX - (t.clientX - self._dragStartX) / self._scale;
                self._offsetY = self._dragOffY - (t.clientY - self._dragStartY) / self._scale;
                self._draw();
            } else if (e.touches.length === 2) {
                var t1 = e.touches[0], t2 = e.touches[1];
                var dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
                if (self._lastTouchDist > 0) {
                    var rect = panel.getBoundingClientRect();
                    var mx = (t1.clientX + t2.clientX) / 2 - rect.left;
                    var my = (t1.clientY + t2.clientY) / 2 - rect.top;
                    self._zoomAt(rect.left + mx, rect.top + my, dist / self._lastTouchDist);
                    self._draw();
                }
                self._lastTouchDist = dist;
            }
        }, { passive: false });
        panel.addEventListener('touchend', function() {
            self._isDragging = false;
            self._lastTouchDist = 0;
        }, { passive: true });
    },

    // ============ 缩放（以视口坐标锚定） ============

    _zoomAt: function(clientX, clientY, factor) {
        var panel = this._panel;
        var rect = panel.getBoundingClientRect();
        var mx = clientX - rect.left;
        var my = clientY - rect.top;
        var pw = rect.width, ph = rect.height;

        var srcX = (mx - pw / 2) / this._scale + this._offsetX;
        var srcY = (my - ph / 2) / this._scale + this._offsetY;

        var newScale = Math.min(Math.max(this._scale * factor, 0.05), 50);
        this._offsetX = srcX - (mx - pw / 2) / newScale;
        this._offsetY = srcY - (my - ph / 2) / newScale;
        this._scale = newScale;

        this._updateZoom();
    },

    // ============ 渲染缩略图画廊 ============

    _renderGallery: function() {
        if (this._images.length === 0) {
            this._thumbGrid.innerHTML = '<div class="st-empty">暂无图片<br>在画布选中图片后<br>点「从画布导入」</div>';
            this._countBadge.textContent = '0 张';
            return;
        }
        this._countBadge.textContent = this._images.length + ' 张';

        var parts = [];
        for (var i = 0; i < this._images.length; i++) {
            var img = this._images[i];
            var active = img.id === this._activeId ? ' active' : '';
            var safeName = img.name.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            parts.push(
                '<div class="st-card' + active + '" data-id="' + img.id + '">',
                '<img src="' + img.dataUrl + '" alt="' + safeName + '" draggable="false">',
                '<button class="st-del" data-del="' + img.id + '">✕</button>',
                '<div class="st-name">' + safeName + '</div>',
                '</div>'
            );
        }
        this._thumbGrid.innerHTML = parts.join('');
    },

    // ============ 选择图片展示 ============

    _selectImage: function(id) {
        var self = this;
        var entry = null;
        for (var i = 0; i < this._images.length; i++) {
            if (this._images[i].id === id) { entry = this._images[i]; break; }
        }
        if (!entry) return;

        this._activeId = id;
        var cards = this._thumbGrid.querySelectorAll('.st-card');
        for (var c = 0; c < cards.length; c++) {
            cards[c].classList.toggle('active', cards[c].dataset.id === id);
        }

        var img = new Image();
        img.onload = function() {
            self._sourceImg = img;
            self._imgW = img.naturalWidth;
            self._imgH = img.naturalHeight;

            var rect = self._panel.getBoundingClientRect();
            var fitScale = Math.min(rect.width / self._imgW * 0.6, rect.height / self._imgH * 0.6, 2);
            self._scale = Math.max(fitScale, 0.1);
            self._offsetX = self._imgW / 2;
            self._offsetY = self._imgH / 2;

            self._updateZoom();
            self._resize();
            self._showHint();
        };
        img.onerror = function() { /* 忽略损坏图 */ };
        img.src = entry.dataUrl;
    },

    // ============ 添加图片 ============

    _addImages: function(fileList) {
        var self = this;
        var usedNames = {};
        for (var u = 0; u < this._images.length; u++) usedNames[this._images[u].name] = true;

        var readResults = [];
        var arr = Array.prototype.slice.call(fileList);
        var pending = arr.length;
        if (pending === 0) return;

        arr.forEach(function(file) {
            if (!file.type || file.type.indexOf('image/') !== 0) { pending--; return; }
            var r = new FileReader();
            r.onload = function() { readResults.push({ file: file, dataUrl: r.result }); pending--; check(); };
            r.onerror = function() { pending--; check(); };
            r.readAsDataURL(file);
        });

        function check() {
            if (pending > 0) return;
            // 逐个取尺寸
            var queue = readResults.slice();
            step();
            function step() {
                if (queue.length === 0) {
                    if (self._newEntries && self._newEntries.length) {
                        var firstId = self._newEntries[0].id;
                        self._images = self._images.concat(self._newEntries);
                        self._newEntries = null;
                        self._saveToDisk().then(function() {
                            self._renderGallery();
                            self._selectImage(firstId);
                        });
                    }
                    return;
                }
                var item = queue.shift();
                var tmp = new Image();
                tmp.onload = function() {
                    var name = item.file.name;
                    if (usedNames[name]) {
                        var dot = name.lastIndexOf('.');
                        var base = dot > 0 ? name.slice(0, dot) : name;
                        var ext = dot > 0 ? name.slice(dot) : '';
                        var counter = 1;
                        while (usedNames[name]) { name = base + '_' + counter + ext; counter++; }
                    }
                    usedNames[name] = true;
                    if (!self._newEntries) self._newEntries = [];
                    self._newEntries.push({
                        id: Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
                        name: name,
                        dataUrl: item.dataUrl,
                        w: tmp.naturalWidth,
                        h: tmp.naturalHeight
                    });
                    step();
                };
                tmp.onerror = function() { step(); };
                tmp.src = item.dataUrl;
            }
        }
    },

    // ============ 从画布导入 ============

    _importFromCanvas: function() {
        var self = this;
        if (typeof CanvasImages === 'undefined') { self._toast('⚠️ 画布未就绪'); return; }
        var list = CanvasImages.getSelectedList ? CanvasImages.getSelectedList('display') : null;
        if (!list || !list.length) {
            self._toast('⚠️ 请先在画布选中一张或多张图片');
            return;
        }
        // 按画布图 id 去重，避免重复导入同一批
        var existing = {};
        for (var i = 0; i < this._images.length; i++) {
            if (this._images[i]._cid) existing[this._images[i]._cid] = true;
        }
        var added = 0;
        list.forEach(function(it) {
            if (existing[it.id]) return;
            existing[it.id] = true;
            added++;
            self._addImageFromDataURL(it.dataURL, it.id, '画布图' + (self._images.length + 1));
        });
        self._toast(added > 0 ? ('✅ 已从画布导入 ' + added + ' 张') : '已导入的图都在列表里了');
    },

    // 从 dataURL 并入一张图（取尺寸后入画廊）
    _addImageFromDataURL: function(dataUrl, cid, name) {
        var self = this;
        var tmp = new Image();
        tmp.onload = function() {
            var entry = {
                id: 'ci_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
                _cid: cid || null,
                name: name,
                dataUrl: dataUrl,
                w: tmp.naturalWidth,
                h: tmp.naturalHeight
            };
            self._images.push(entry);
            self._saveToDisk().then(function() {
                self._renderGallery();
                if (!self._sourceImg) self._selectImage(entry.id);
            });
        };
        tmp.onerror = function() {};
        tmp.src = dataUrl;
    },

    // ============ 导出到画布（按宽高平铺大图） ============

    _exportToCanvas: function() {
        var self = this;
        if (!this._sourceImg) { this._toast('⚠️ 请先在左侧选一张图'); return; }
        var w = parseInt(this._wInput.value, 10) || 1024;
        var h = parseInt(this._hInput.value, 10) || 1024;
        var MAX = 4096;
        if (w > MAX || h > MAX) { this._toast('⚠️ 宽高上限 ' + MAX + '，已自动裁剪'); }
        w = Math.max(16, Math.min(MAX, w | 0));
        h = Math.max(16, Math.min(MAX, h | 0));

        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        var cx = c.getContext('2d');
        var iw = this._imgW, ih = this._imgH;
        // 用源图无缝平铺填满 W×H（边缘多画的超出部分被画布尺寸裁掉，不影响无缝）
        for (var y = 0; y < h; y += ih) {
            for (var x = 0; x < w; x += iw) {
                cx.drawImage(this._sourceImg, x, y, iw, ih);
            }
        }

        var dataUrl = c.toDataURL('image/png');
        if (typeof CanvasImages === 'undefined') { this._toast('⚠️ 画布未就绪'); return; }
        this._toast('正在导出 ' + w + '×' + h + ' 到画布...');
        CanvasImages.place(dataUrl, null, null, '无缝平铺').then(function() {
            self._toast('✅ 已导出 ' + w + '×' + h + ' 到画布');
        }).catch(function() {
            self._toast('⚠️ 导出失败');
        });
    },

    // ============ 轻提示 ============

    _toast: function(msg) {
        if (!this._hint) return;
        var self = this;
        var prev = this._hint.textContent;
        this._hint.textContent = msg;
        this._hint.classList.add('visible');
        clearTimeout(this._hintTimer);
        this._hintTimer = setTimeout(function() {
            self._hint.classList.remove('visible');
            self._hint.textContent = prev;
        }, 2500);
    },

    // ============ 删除 / 清空 ============

    _removeImage: function(id) {
        var idx = -1;
        for (var i = 0; i < this._images.length; i++) {
            if (this._images[i].id === id) { idx = i; break; }
        }
        if (idx === -1) return;
        this._images.splice(idx, 1);
        this._dbDeleteOne(id);

        if (this._activeId === id) {
            if (this._images.length > 0) {
                this._selectImage(this._images[0].id);
            } else {
                this._activeId = null;
                this._sourceImg = null;
                this._zoomBadge.textContent = '—';
                this._resize();
            }
        }
        this._renderGallery();
    },

    _clearAll: function() {
        this._images = [];
        this._activeId = null;
        this._sourceImg = null;
        this._zoomBadge.textContent = '—';
        this._dbClear();
        this._renderGallery();
        this._resize();
    },

    // ============ Canvas 绘制（无限平铺） ============

    _resize: function() {
        if (!this._panel || !this._canvas) return;
        var rect = this._panel.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        var dpr = window.devicePixelRatio || 1;
        this._canvas.width = Math.round(rect.width * dpr);
        this._canvas.height = Math.round(rect.height * dpr);
        this._canvas.style.width = rect.width + 'px';
        this._canvas.style.height = rect.height + 'px';
        this._draw();
    },

    _draw: function() {
        var ctx = this._ctx;
        if (!ctx) return;
        ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
        if (!this._sourceImg) return;

        var dpr = window.devicePixelRatio || 1;
        var dw = this._canvas.width / dpr;
        var dh = this._canvas.height / dpr;

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.translate(dw / 2, dh / 2);
        ctx.scale(this._scale, this._scale);
        ctx.translate(-this._offsetX, -this._offsetY);

        var corners = [
            [-dw / 2, -dh / 2], [dw / 2, -dh / 2],
            [-dw / 2, dh / 2], [dw / 2, dh / 2]
        ].map(function(p) {
            return [p[0] / this._scale + this._offsetX, p[1] / this._scale + this._offsetY];
        }, this);

        var minSx = Math.min(corners[0][0], corners[1][0], corners[2][0], corners[3][0]);
        var maxSx = Math.max(corners[0][0], corners[1][0], corners[2][0], corners[3][0]);
        var minSy = Math.min(corners[0][1], corners[1][1], corners[2][1], corners[3][1]);
        var maxSy = Math.max(corners[0][1], corners[1][1], corners[2][1], corners[3][1]);

        var colStart = Math.floor(minSx / this._imgW) - 1;
        var colEnd = Math.ceil(maxSx / this._imgW) + 1;
        var rowStart = Math.floor(minSy / this._imgH) - 1;
        var rowEnd = Math.ceil(maxSy / this._imgH) + 1;

        for (var row = rowStart; row < rowEnd; row++) {
            for (var col = colStart; col < colEnd; col++) {
                ctx.drawImage(this._sourceImg, col * this._imgW, row * this._imgH, this._imgW, this._imgH);
            }
        }
        ctx.restore();
    },

    _showHint: function() {
        if (!this._hint) return;
        this._hint.classList.add('visible');
        var self = this;
        clearTimeout(this._hintTimer);
        this._hintTimer = setTimeout(function() { self._hint.classList.remove('visible'); }, 2500);
    },

    _updateZoom: function() {
        if (this._zoomBadge) {
            this._zoomBadge.textContent = this._sourceImg ? Math.round(this._scale * 100) + '%' : '—';
        }
    },

    // ============ 持久化（IndexedDB） ============

    _DB_NAME: 'SeamlessTileDB',
    _DB_VER: 1,
    _STORE: 'images',
    _META_KEY: 'seamless_tile_meta',

    _openDB: function() {
        var self = this;
        return new Promise(function(resolve, reject) {
            var req = indexedDB.open(self._DB_NAME, self._DB_VER);
            req.onupgradeneeded = function() {
                var db = req.result;
                if (!db.objectStoreNames.contains(self._STORE)) {
                    db.createObjectStore(self._STORE, { keyPath: 'id' });
                }
            };
            req.onsuccess = function() { resolve(req.result); };
            req.onerror = function() { reject(req.error); };
        });
    },

    _dbSaveAll: function(list) {
        var self = this;
        return this._openDB().then(function(db) {
            return new Promise(function(resolve, reject) {
                var tx = db.transaction(self._STORE, 'readwrite');
                var store = tx.objectStore(self._STORE);
                store.clear();
                for (var i = 0; i < list.length; i++) store.put(list[i]);
                tx.oncomplete = function() { db.close(); resolve(); };
                tx.onerror = function() { db.close(); reject(tx.error); };
            });
        });
    },

    _dbLoadAll: function() {
        var self = this;
        return this._openDB().then(function(db) {
            return new Promise(function(resolve, reject) {
                var tx = db.transaction(self._STORE, 'readonly');
                var req = tx.objectStore(self._STORE).getAll();
                req.onsuccess = function() { db.close(); resolve(req.result || []); };
                req.onerror = function() { db.close(); reject(req.error); };
            });
        });
    },

    _dbDeleteOne: function(id) {
        var self = this;
        return this._openDB().then(function(db) {
            return new Promise(function(resolve, reject) {
                var tx = db.transaction(self._STORE, 'readwrite');
                tx.objectStore(self._STORE).delete(id);
                tx.oncomplete = function() { db.close(); resolve(); };
                tx.onerror = function() { db.close(); reject(tx.error); };
            });
        });
    },

    _dbClear: function() {
        var self = this;
        return this._openDB().then(function(db) {
            return new Promise(function(resolve, reject) {
                var tx = db.transaction(self._STORE, 'readwrite');
                tx.objectStore(self._STORE).clear();
                tx.oncomplete = function() { db.close(); resolve(); };
                tx.onerror = function() { db.close(); reject(tx.error); };
            });
        });
    },

    _saveToDisk: function() {
        var self = this;
        try {
            var meta = this._images.map(function(i) { return { id: i.id, name: i.name, w: i.w, h: i.h }; });
            localStorage.setItem(this._META_KEY, JSON.stringify(meta));
        } catch (e) {}
        return this._dbSaveAll(this._images).catch(function() {});
    },

    _loadFromDisk: function() {
        var self = this;
        return this._dbLoadAll().then(function(all) {
            if (all && all.length) self._images = all;
        }).catch(function() {});
    }
};

/* ===== 样式（作用域隔离，前缀 st-） ===== */
(function() {
    var s = document.createElement('style');
    s.textContent =

        '.st-win { display:flex; flex-direction:column; background:var(--cos-world,#0d1117); color:var(--cos-text,#e8edf5); }' +
        '.st-hdr { display:flex; align-items:center; gap:10px; }' +
        '.st-zoom { font-size:12px; color:var(--cos-text-soft,#94a3b8); background:var(--cos-surface,#16213e); padding:2px 8px; border-radius:6px; }' +
        '.st-body { flex:1; display:flex; flex-direction:column; min-height:0; overflow:hidden; }' +

        /* 工具栏 */
        '.st-toolbar { display:flex; align-items:center; gap:10px; padding:8px 12px; background:var(--cos-surface,#16213e); border-bottom:1px solid var(--cos-border,#0f3460); flex-shrink:0; flex-wrap:wrap; }' +
        '.st-toolbar .st-btn { font-size:12px; }' +
        '.st-sep { width:1px; height:20px; background:var(--cos-border,#0f3460); margin:0 2px; }' +
        '.st-exp-l { font-size:12px; color:var(--cos-text-soft,#94a3b8); }' +
        '.st-inp { width:64px; font-size:12px; padding:3px 6px; border-radius:6px; border:1px solid var(--cos-border,#0f3460); background:#0d1b30; color:var(--cos-text,#e8edf5); }' +
        '.st-inp:focus { outline:none; border-color:#e94560; }' +
        '.st-x { font-size:12px; color:var(--cos-text-soft,#94a3b8); }' +
        '.st-export-btn { background:#1f6f54; border-color:#2a8c6a; }' +
        '.st-export-btn:hover { background:#268063; }' +
        '.st-count { font-size:12px; color:var(--cos-text-soft,#94a3b8); background:#0d1b30; padding:3px 10px; border-radius:12px; }' +
        '.st-hint { font-size:12px; color:var(--cos-text-dim,#666); margin-left:auto; }' +

        /* 分栏 */
        '.st-split { display:flex; flex:1; min-height:0; }' +
        '.st-left { width:140px; min-width:100px; background:#16213e; border-right:1px solid var(--cos-border,#0f3460); display:flex; flex-direction:column; flex-shrink:0; }' +
        '.st-left-hd { padding:8px 12px 4px; font-size:11px; color:#888; letter-spacing:1px; }' +
        '.st-thumbs { flex:1; overflow-y:auto; padding:6px 8px 10px; display:grid; grid-template-columns:1fr; gap:6px; align-content:start; }' +
        '.st-empty { grid-column:1/-1; text-align:center; color:#555; font-size:12px; padding:30px 8px; line-height:1.8; }' +
        '.st-card { position:relative; width:84px; height:84px; justify-self:center; background:#0d1b30; border:2px solid transparent; border-radius:8px; overflow:hidden; cursor:pointer; transition:border-color .2s, transform .15s; display:flex; align-items:center; justify-content:center; }' +
        '.st-card:hover { border-color:#e94560; transform:scale(1.03); }' +
        '.st-card.active { border-color:#e94560; box-shadow:0 0 8px rgba(233,69,96,.4); }' +
        '.st-card img { width:100%; height:100%; object-fit:cover; display:block; pointer-events:none; }' +
        '.st-card .st-del { position:absolute; top:2px; right:2px; width:20px; height:20px; border-radius:50%; border:none; background:rgba(0,0,0,.6); color:#fff; font-size:12px; cursor:pointer; display:none; align-items:center; justify-content:center; line-height:1; font-family:inherit; }' +
        '.st-card:hover .st-del { display:flex; }' +
        '.st-card .st-del:hover { background:#e94560; }' +
        '.st-card .st-name { position:absolute; bottom:0; left:0; right:0; background:rgba(0,0,0,.7); font-size:11px; padding:3px 5px; text-align:center; color:#ddd; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; pointer-events:none; }' +

        /* 右侧画布 */
        '.st-right { flex:1; position:relative; background:#111; overflow:hidden; cursor:grab; }' +
        '.st-right:active { cursor:grabbing; }' +
        '.st-right canvas { display:block; position:absolute; top:0; left:0; width:100%; height:100%; }' +
        '.st-canvas-hint { position:absolute; bottom:16px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,.7); color:#aaa; font-size:13px; padding:6px 16px; border-radius:20px; pointer-events:none; white-space:nowrap; opacity:0; transition:opacity .4s; }' +
        '.st-canvas-hint.visible { opacity:1; }';

    document.head.appendChild(s);
})();
