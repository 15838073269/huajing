/**
 * UI 工具函数（全局）
 * showOverlay - 浮动面板（可拖动）
 * showToast - 提示消息
 */
function showOverlay(title, bodyHtml, width) {
    // 先关闭已有的 overlay
    var old = document.querySelector('.cos-overlay');
    if (old) old.remove();

    var ov = document.createElement('div');
    ov.className = 'cos-overlay';
    ov.style.left = '50%';
    ov.style.top = '50%';
    ov.style.transform = 'translate(-50%, -50%) scale(0.95)';
    ov.style.width = width || '420px';
    ov.style.maxHeight = '80vh';
    ov.innerHTML =
        '<div class="cos-overlay-header"><span>' + title + '</span><button class="cos-overlay-close">✕</button></div>' +
        '<div class="cos-overlay-body">' + bodyHtml + '</div>';

    document.body.appendChild(ov);

    // 覆盖层窗口置顶（初始高于插件窗口的 9999）
    var _topOZ = window.__cos_topZ || 10000;
    ov.style.zIndex = ++_topOZ;
    window.__cos_topZ = _topOZ;
    ov.addEventListener('mousedown', function(e) {
        ov.style.zIndex = ++_topOZ;
        window.__cos_topZ = _topOZ;
    });

    // 恢复保存的位置和大小
    try {
        var saved = JSON.parse(localStorage.getItem('cos-overlay-rect'));
        if (saved) {
            var sw = window.innerWidth, sh = window.innerHeight;
            var w = Math.min(saved.w, sw - 20), h = Math.min(saved.h, sh - 20);
            var l = Math.max(0, Math.min(saved.l, sw - w)), t = Math.max(0, Math.min(saved.t, sh - h));
            ov.style.width = w + 'px'; ov.style.maxHeight = h + 'px';
            ov.style.left = l + 'px'; ov.style.top = t + 'px';
            ov.style.transform = 'none';
            var body = ov.querySelector('.cos-overlay-body');
            if (body) body.style.maxHeight = (h - 42) + 'px';
        }
    } catch(e) {}

    // 四角+四边缩放手柄
    var resizeDirs = [
        { dir: 'nw', cursor: 'nwse-resize', style: 'top:0;left:0;width:18px;height:18px;' },
        { dir: 'ne', cursor: 'nesw-resize', style: 'top:0;right:0;width:18px;height:18px;' },
        { dir: 'sw', cursor: 'nesw-resize', style: 'bottom:0;left:0;width:18px;height:18px;' },
        { dir: 'se', cursor: 'nwse-resize', style: 'bottom:0;right:0;width:18px;height:18px;' },
        { dir: 'n',  cursor: 'ns-resize',   style: 'top:0;left:18px;right:18px;height:10px;' },
        { dir: 's',  cursor: 'ns-resize',   style: 'bottom:0;left:18px;right:18px;height:10px;' },
        { dir: 'w',  cursor: 'ew-resize',   style: 'left:0;top:18px;bottom:18px;width:10px;' },
        { dir: 'e',  cursor: 'ew-resize',   style: 'right:0;top:18px;bottom:18px;width:10px;' }
    ];
    var rsState = { active: false, dir: '', sx: 0, sy: 0, sL: 0, sT: 0, sW: 0, sH: 0 };
    resizeDirs.forEach(function(r) {
        var h = document.createElement('div');
        h.style.cssText = 'position:absolute;z-index:99999;cursor:' + r.cursor + ';' + r.style;
        h.addEventListener('mousedown', function(e) {
            e.preventDefault(); e.stopPropagation();
            rsState.active = true; rsState.dir = r.dir;
            rsState.sx = e.clientX; rsState.sy = e.clientY;
            var rect = ov.getBoundingClientRect();
            rsState.sL = rect.left; rsState.sT = rect.top; rsState.sW = rect.width; rsState.sH = rect.height;
        });
        ov.appendChild(h);
    });
    function onResizeMove(e) {
        if (!rsState.active) return;
        var dx = e.clientX - rsState.sx, dy = e.clientY - rsState.sy;
        var nL = rsState.sL, nT = rsState.sT, nW = rsState.sW, nH = rsState.sH;
        var d = rsState.dir;
        if (d.indexOf('e') >= 0) nW = Math.max(280, rsState.sW + dx);
        if (d.indexOf('w') >= 0) { nW = Math.max(280, rsState.sW - dx); nL = rsState.sL + rsState.sW - nW; }
        if (d.indexOf('s') >= 0) nH = Math.max(200, rsState.sH + dy);
        if (d.indexOf('n') >= 0) { nH = Math.max(200, rsState.sH - dy); nT = rsState.sT + rsState.sH - nH; }
        ov.style.left = nL + 'px'; ov.style.top = nT + 'px';
        ov.style.width = nW + 'px'; ov.style.maxHeight = nH + 'px';
        var body = ov.querySelector('.cos-overlay-body');
        if (body) body.style.maxHeight = (nH - 42) + 'px';
    }
    function onResizeUp() {
        if (rsState.active) {
            rsState.active = false;
            try {
                var r = ov.getBoundingClientRect();
                localStorage.setItem('cos-overlay-rect', JSON.stringify({ w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top) }));
            } catch(e) {}
        }
    }

    // 清理旧的 document 级监听器（防止重复注册导致卡顿）
    if (window.__cosOverlayCleanup) window.__cosOverlayCleanup();
    var _dragState = { active: false, startX: 0, startY: 0, origX: 0, origY: 0 };

    function _onOverlayMove(e) {
        if (_dragState.active) {
            ov.style.left = (_dragState.origX + e.clientX - _dragState.startX) + 'px';
            ov.style.top = (_dragState.origY + e.clientY - _dragState.startY) + 'px';
        }
        if (rsState.active) {
            var dx = e.clientX - rsState.sx, dy = e.clientY - rsState.sy;
            var nL = rsState.sL, nT = rsState.sT, nW = rsState.sW, nH = rsState.sH;
            var d = rsState.dir;
            if (d.indexOf('e') >= 0) nW = Math.max(280, rsState.sW + dx);
            if (d.indexOf('w') >= 0) { nW = Math.max(280, rsState.sW - dx); nL = rsState.sL + rsState.sW - nW; }
            if (d.indexOf('s') >= 0) nH = Math.max(200, rsState.sH + dy);
            if (d.indexOf('n') >= 0) { nH = Math.max(200, rsState.sH - dy); nT = rsState.sT + rsState.sH - nH; }
            ov.style.left = nL + 'px'; ov.style.top = nT + 'px';
            ov.style.width = nW + 'px'; ov.style.height = nH + 'px';
            var body = ov.querySelector('.cos-overlay-body');
            if (body) body.style.maxHeight = (nH - 42) + 'px';
        }
    }
    function _onOverlayUp() {
        if (_dragState.active || rsState.active) {
            _dragState.active = false;
            rsState.active = false;
            try {
                var r = ov.getBoundingClientRect();
                localStorage.setItem('cos-overlay-rect', JSON.stringify({ w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top) }));
            } catch(e) {}
        }
    }
    window.__cosOverlayCleanup = function() {
        document.removeEventListener('mousemove', _onOverlayMove);
        document.removeEventListener('mouseup', _onOverlayUp);
    };

    // 拖动功能
    var header = ov.querySelector('.cos-overlay-header');
    header.style.cursor = 'move';
    header.addEventListener('mousedown', function(e) {
        if (e.target.closest('.cos-overlay-close')) return;
        _dragState.active = true;
        rsState.active = false;
        // 第一次拖动时切换到绝对坐标
        if (ov.style.transform && ov.style.transform.indexOf('translate') >= 0) {
            var rect = ov.getBoundingClientRect();
            ov.style.left = rect.left + 'px';
            ov.style.top = rect.top + 'px';
            ov.style.transform = 'scale(1)';
        }
        _dragState.startX = e.clientX;
        _dragState.startY = e.clientY;
        _dragState.origX = parseInt(ov.style.left) || 0;
        _dragState.origY = parseInt(ov.style.top) || 0;
        e.preventDefault();
    });

    document.addEventListener('mousemove', _onOverlayMove);
    document.addEventListener('mouseup', _onOverlayUp);

    // 显示动画
    requestAnimationFrame(function() {
        ov.classList.add('cos-overlay-visible');
        // 有保存的位置时使用绝对坐标，不需要居中 transform
        if (!ov.style.transform || ov.style.transform === 'none') {
            ov.style.transform = 'scale(1)';
        } else {
            ov.style.transform = 'translate(-50%, -50%) scale(1)';
        }
    });

    function close() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('mousemove', onResizeMove);
        document.removeEventListener('mouseup', onResizeUp);
        ov.classList.remove('cos-overlay-visible');
        ov.style.transform = 'scale(0.95)';
        ov.style.opacity = '0';
        setTimeout(function() { if (ov.parentNode) ov.remove(); }, 200);
    }

    ov.querySelector('.cos-overlay-close').addEventListener('click', close);
    document.addEventListener('keydown', function esc(e) {
        if (e.code === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
}

var _toastEl = null;
var _toastTimer = null;
function showToast(msg) {
    if (_toastEl) {
        clearTimeout(_toastTimer);
        _toastEl.remove();
    }
    var t = document.createElement('div');
    t.className = 'cos-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    _toastEl = t;
    setTimeout(function() { t.classList.add('cos-toast-show'); }, 10);
    _toastTimer = setTimeout(function() {
        t.classList.remove('cos-toast-show');
        _toastTimer = setTimeout(function() { t.remove(); _toastEl = null; }, 300);
    }, 2000);
}

// WindowHelper: 通用窗口缩放（四角+四边缩放手柄，localStorage 记忆位置）
var WindowHelper = {
    makeResizable: function(overlay, opts) {
        opts = opts || {};
        var minW = opts.minWidth || 400;
        var minH = opts.minHeight || 300;
        var storeKey = opts.storeKey || 'skill-window-rect';

        var handles = [
            { dir: 'nw', cursor: 'nwse-resize', style: 'top:0;left:0;width:20px;height:20px;' },
            { dir: 'ne', cursor: 'nesw-resize', style: 'top:0;right:0;width:20px;height:20px;' },
            { dir: 'sw', cursor: 'nesw-resize', style: 'bottom:0;left:0;width:20px;height:20px;' },
            { dir: 'se', cursor: 'nwse-resize', style: 'bottom:0;right:0;width:20px;height:20px;' },
            { dir: 'n',  cursor: 'ns-resize',   style: 'top:0;left:20px;right:20px;height:12px;' },
            { dir: 's',  cursor: 'ns-resize',   style: 'bottom:0;left:20px;right:20px;height:12px;' },
            { dir: 'w',  cursor: 'ew-resize',   style: 'left:0;top:20px;bottom:20px;width:12px;' },
            { dir: 'e',  cursor: 'ew-resize',   style: 'right:0;top:20px;bottom:20px;width:12px;' }
        ];

        var state = { active: false, dir: '', startX: 0, startY: 0, startLeft: 0, startTop: 0, startW: 0, startH: 0 };

        handles.forEach(function(h) {
            var el = document.createElement('div');
            el.className = 'win-resize-handle win-resize-' + h.dir;
            el.style.cssText = 'position:absolute;z-index:10000;cursor:' + h.cursor + ';' + h.style;
            el.addEventListener('mousedown', function(e) {
                state.active = true;
                state.dir = h.dir;
                state.startX = e.clientX;
                state.startY = e.clientY;
                var rect = overlay.getBoundingClientRect();
                state.startLeft = rect.left;
                state.startTop = rect.top;
                state.startW = rect.width;
                state.startH = rect.height;
                e.preventDefault();
                e.stopPropagation();
            });
            overlay.appendChild(el);
        });

        function _onMouseMove(e) {
            if (!state.active) return;
            var dx = e.clientX - state.startX;
            var dy = e.clientY - state.startY;
            var newL = state.startLeft, newT = state.startTop, newW = state.startW, newH = state.startH;
            var dir = state.dir;

            if (dir.indexOf('e') >= 0) newW = Math.max(minW, state.startW + dx);
            if (dir.indexOf('w') >= 0) { newW = Math.max(minW, state.startW - dx); newL = state.startLeft + state.startW - newW; }
            if (dir.indexOf('s') >= 0) newH = Math.max(minH, state.startH + dy);
            if (dir.indexOf('n') >= 0) { newH = Math.max(minH, state.startH - dy); newT = state.startTop + state.startH - newH; }

            overlay.style.left = newL + 'px';
            overlay.style.top = newT + 'px';
            overlay.style.width = newW + 'px';
            overlay.style.height = newH + 'px';
        }

        function _onMouseUp() {
            if (!state.active) return;
            state.active = false;
            try {
                var r = overlay.getBoundingClientRect();
                localStorage.setItem(storeKey, JSON.stringify({
                    w: Math.round(r.width), h: Math.round(r.height),
                    l: Math.round(r.left), t: Math.round(r.top)
                }));
            } catch(e) {}
        }

        document.addEventListener('mousemove', _onMouseMove);
        document.addEventListener('mouseup', _onMouseUp);

        try {
            var saved = JSON.parse(localStorage.getItem(storeKey));
            if (saved) {
                var sw = window.innerWidth, sh = window.innerHeight;
                var w = Math.min(saved.w, sw - 20);
                var h = Math.min(saved.h, sh - 20);
                var l = Math.max(0, Math.min(saved.l, sw - w));
                var t = Math.max(0, Math.min(saved.t, sh - h));
                overlay.style.width = w + 'px';
                overlay.style.height = h + 'px';
                overlay.style.left = l + 'px';
                overlay.style.top = t + 'px';
            } else {
                var sw2 = window.innerWidth, sh2 = window.innerHeight;
                var ow = Math.min(900, sw2 - 40);
                var oh = Math.min(650, sh2 - 40);
                overlay.style.width = ow + 'px';
                overlay.style.height = oh + 'px';
                overlay.style.left = Math.max(10, (sw2 - ow) / 2) + 'px';
                overlay.style.top = Math.max(10, (sh2 - oh) / 2) + 'px';
            }
        } catch(e) {}
    }
};

// ============================================
//  CosCloudDrive — 本地迷你云盘
//  所有图片类插件共享的"素材箱"
// ============================================
var CosCloudDrive = {
    _items: [],         // [{ id, name, source, dataURL, w, h, time }]
    _overlay: null,
    _onSelect: null,    // 回调：选择某张图片时触发
    _batchData: {},     // 批量操作中间数据
    _isBatchSel: false, // 是否处于批量选择模式
    _dbReady: false,    // IndexedDB 是否就绪
    _dbPending: [],     // 等待 DB 就绪后的操作

    _DB_NAME: 'CosCloudDB',
    _DB_VER: 1,
    _STORE: 'files',

    // 打开 IndexedDB
    _openDB: function() {
        var self = this;
        return new Promise(function(res, rej) {
            var r = indexedDB.open(self._DB_NAME, self._DB_VER);
            r.onupgradeneeded = function(e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains(self._STORE))
                    db.createObjectStore(self._STORE);
            };
            r.onsuccess = function(e) {
                self._db = e.target.result;
                self._dbReady = true;
                // 执行积压的操作
                self._dbPending.forEach(function(fn) { try { fn(); } catch(e) {} });
                self._dbPending = [];
                res(self._db);
            };
            r.onerror = function(e) { rej(e); };
        });
    },

    // 在画布顶部子工具栏添加清空画布按钮
    _addSubToolBtn: function() {
        var subtools = document.getElementById('cos-subtools');
        if (!subtools || document.getElementById('cd-clear-canvas-btn')) return;
        var btn = document.createElement('button');
        btn.id = 'cd-clear-canvas-btn';
        btn.className = 'cos-hud-btn';
        btn.textContent = '清空画布';
        btn.title = '删除画布上所有从云盘放置的图片';
        btn.style.cssText = 'font-size:10px;padding:2px 8px;';
        var self = this;
        btn.addEventListener('click', function() { self._clearCanvasImages(); });
        subtools.appendChild(btn);
    },

    // 初始化（从 IndexedDB 加载，localStorage 作为快速缓存兜底）
    init: function() {
        var self = this;
        // 注册拖图片到画布
        this._registerCanvasDrop();
        // 添加清空画布按钮到顶部子工具栏
        this._addSubToolBtn();
        // 先尝试 localStorage 快速展示（同步）
        try {
            var raw = localStorage.getItem('cos_cloud_drive_cache');
            if (raw) this._items = JSON.parse(raw);
        } catch(e) {}
        // 从 IndexedDB 加载完整数据（异步）
        this._openDB().then(function(db) {
            var tx = db.transaction(self._STORE, 'readonly');
            var req = tx.objectStore(self._STORE).get('items');
            req.onsuccess = function() {
                if (req.result) {
                    self._items = req.result;
                    // 同步到 localStorage 缓存
                    try { localStorage.setItem('cos_cloud_drive_cache', JSON.stringify(self._items)); } catch(e) {}
                }
                if (self._overlay) self._refreshGrid();
            };
        }).catch(function() {
            // IndexedDB 失败时保留 localStorage 数据
        });
    },

    // 添加图片到云盘
    add: function(name, source, dataURL, optW, optH) {
        var self = this;
        var item = {
            id: Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            name: name,
            source: source,
            dataURL: dataURL,
            w: optW || 0,
            h: optH || 0,
            time: Date.now()
        };
        if (!optW || !optH) {
            // 没有提供尺寸时用 Image 异步获取
            var img = new Image();
            img.onload = function() { item.w = img.width; item.h = img.height; self._save(); };
            img.src = dataURL;
        }
        this._items.unshift(item);
        this._save();
    },

    // 删除图片
    remove: function(id) {
        this._items = this._items.filter(function(it) { return it.id !== id; });
        this._save();
    },

    // 设为选中回调（供插件调用：图片被双击/点击选中时触发）
    setOnSelect: function(fn) {
        this._onSelect = fn;
    },

    // 获取所有
    getAll: function() {
        return this._items;
    },

    // 通用"导出到云盘"按钮（传一个生成 dataURL 的函数）
    // 用法: CosCloudDrive.makeExportBtn(function() { return canvas.toDataURL(); }, '来源名称')
    makeExportBtn: function(fnGetDataURL, sourceName) {
        var self = this;
        var btn = document.createElement('button');
        btn.textContent = '盘导出';
        btn.title = '导出到本地云盘';
        btn.style.cssText = 'font-size:10px;padding:2px 6px;border-radius:4px;border:1px solid rgba(56,189,248,0.2);background:rgba(56,189,248,0.08);color:#38bdf8;cursor:pointer;margin-left:4px;';
        btn.addEventListener('click', function() {
            try {
                var dataURL = fnGetDataURL();
                if (!dataURL) return;
                self.add(sourceName + ' ' + new Date().toLocaleTimeString(), sourceName, dataURL);
                if (typeof showToast === 'function') showToast('已存入云盘');
            } catch(e) { console.error(e); }
        });
        return btn;
    },

    // 通用"从云盘导入"按钮（传一个接收 dataURL 的回调）
    // 用法: CosCloudDrive.makeImportBtn(function(dataURL, item) { /* 处理图片 */ })
    makeImportBtn: function(fnOnPick) {
        var self = this;
        var btn = document.createElement('button');
        btn.textContent = '盘导入';
        btn.title = '从本地云盘选择';
        btn.style.cssText = 'font-size:10px;padding:2px 6px;border-radius:4px;border:1px solid rgba(251,191,36,0.2);background:rgba(251,191,36,0.08);color:#fbbf24;cursor:pointer;margin-left:4px;';
        btn.addEventListener('click', function() {
            self.setOnSelect(function(item) {
                fnOnPick(item.dataURL, item);
                self._overlay.style.display = 'none';
                self.setOnSelect(null);
            });
            self.open();
        });
        return btn;
    },

    _save: function() {
        var self = this;
        // 同步写 localStorage 缓存（始终可用）
        try { localStorage.setItem('cos_cloud_drive_cache', JSON.stringify(this._items)); } catch(e) {}
        // 异步写 IndexedDB（持久化大容量）
        if (this._db) {
            try {
                var tx = this._db.transaction(this._STORE, 'readwrite');
                tx.objectStore(this._STORE).put(this._items, 'items');
            } catch(e) {}
        } else if (!this._dbReady) {
            // DB 还没打开，积压操作
            this._dbPending.push(function() { self._save(); });
        }
    },

    // ===== 画布集成 =====

    // 从云盘拖图片到画布
    _placeOnCanvas: function(dataURL, name, clientX, clientY) {
        if (typeof GameWorld === 'undefined') return;
        var layer = GameWorld.getLayer && GameWorld.getLayer();
        if (!layer) return;
        var worldPos = GameWorld.screenToWorld(clientX, clientY);

        var img = new Image();
        img.src = dataURL;
        img.onload = function() {
            var w = img.naturalWidth;
            var h = img.naturalHeight;

            var el = document.createElement('div');
            el.style.cssText = 'position:absolute;left:' + (worldPos.x - w / 2) + 'px;top:' + (worldPos.y - h / 2) + 'px;' +
                'width:' + w + 'px;height:' + h + 'px;pointer-events:auto;cursor:grab;' +
                'border-radius:4px;overflow:visible;';
            el.className = 'fb-canvas-image';
            var img2 = document.createElement('img');
            img2.src = dataURL;
            img2.style.cssText = 'width:100%;height:100%;display:block;pointer-events:none;border-radius:4px;';
            el.appendChild(img2);
            el.title = name || '图片';

            // 删除按钮（按图片尺寸等比缩放）
            var btnSize = Math.max(18, Math.min(36, Math.round(Math.min(w, h) * 0.06)));
            var btnOffset = Math.round(btnSize * 0.4);
            var fontSize = Math.max(10, Math.min(18, Math.round(btnSize * 0.6)));
            var delBtn = document.createElement('button');
            delBtn.textContent = '✕';
            delBtn.style.cssText = 'position:absolute;top:-' + btnOffset + 'px;right:-' + btnOffset + 'px;' +
                'width:' + btnSize + 'px;height:' + btnSize + 'px;' +
                'background:rgba(220,80,60,0.9);color:#fff;border:none;border-radius:50%;' +
                'font-size:' + fontSize + 'px;line-height:1;cursor:pointer;display:none;z-index:5;' +
                'box-shadow:0 1px 4px rgba(0,0,0,0.4);';
            delBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                if (el.parentNode) el.parentNode.removeChild(el);
            });
            el.appendChild(delBtn);
            el.addEventListener('mouseenter', function() { delBtn.style.display = 'block'; });
            el.addEventListener('mouseleave', function() { delBtn.style.display = 'none'; });

            // 拖拽移动（同 folder-browser 逻辑）
            var dragging = false, sx, sy, ox, oy;
            el.addEventListener('mousedown', function(e) {
                if (e.button !== 0) return; e.stopPropagation();
                dragging = true; sx = e.clientX; sy = e.clientY;
                ox = parseInt(el.style.left) || 0; oy = parseInt(el.style.top) || 0;
                el.style.cursor = 'grabbing';
            });
            document.addEventListener('mousemove', function(ev) {
                if (!dragging) return;
                el.style.left = (ox + ev.clientX - sx) + 'px';
                el.style.top = (oy + ev.clientY - sy) + 'px';
            });
            document.addEventListener('mouseup', function() {
                if (!dragging) return; dragging = false; el.style.cursor = 'grab';
            });

            layer.appendChild(el);
        };
    },

    // 注册画布 drop 接收（每次 open 调用，确保 canvas 已就绪）
    _registerCanvasDrop: function() {
        if (typeof GameWorld === 'undefined') return;
        var target = document.getElementById('cos-world') || document.body;
        var self = this;
        // 移除旧监听避免重复
        if (self._canvasDragHandler) {
            target.removeEventListener('dragover', self._canvasDragHandler);
        }
        if (self._canvasDropHandler) {
            target.removeEventListener('drop', self._canvasDropHandler);
        }
        self._canvasDragHandler = function(e) {
            // 检查是否包含我们的自定义数据类型
            var types = e.dataTransfer.types;
            var hasImage = false;
            if (types && types.indexOf) {
                hasImage = types.indexOf('text/x-cos-image-id') >= 0;
            } else if (types && types.contains) {
                hasImage = types.contains('text/x-cos-image-id');
            }
            if (hasImage) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }
        };
        self._canvasDropHandler = function(e) {
            e.preventDefault();
            var id = e.dataTransfer.getData('text/x-cos-image-id');
            if (!id) return;
            var item = null;
            for (var i = 0; i < self._items.length; i++) {
                if (self._items[i].id === id) { item = self._items[i]; break; }
            }
            if (!item || !item.dataURL) return;
            self._placeOnCanvas(item.dataURL, item.name || null, e.clientX, e.clientY);
        };
        target.addEventListener('dragover', self._canvasDragHandler);
        target.addEventListener('drop', self._canvasDropHandler);
    },

    // 清空画布上的所有图片
    _clearCanvasImages: function() {
        if (typeof GameWorld === 'undefined') return;
        var layer = GameWorld.getLayer && GameWorld.getLayer();
        if (!layer) return;
        var imgs = layer.querySelectorAll('.fb-canvas-image');
        if (!imgs.length) return;
        if (!confirm('确定清空画布上的所有图片？')) return;
        for (var i = 0; i < imgs.length; i++) {
            if (imgs[i].parentNode) imgs[i].parentNode.removeChild(imgs[i]);
        }
    },

    // 打开云盘面板
    open: function() {
        var self = this;
        if (this._overlay) {
            this._overlay.style.display = '';
            var z = (window.__cos_topZ || 20000) + 1;
            window.__cos_topZ = z;
            this._overlay.style.zIndex = z;
            this._refreshGrid();
            return;
        }
        var ov = document.createElement('div');
        ov.setAttribute('data-cos-cloud', '1');
        ov.style.cssText =
            'position:fixed;width:560px;height:480px;z-index:20000;' +
            'background:#0f1525;color:#e8edf5;border-radius:12px;' +
            'border:1px solid rgba(100,160,255,0.15);' +
            'box-shadow:0 8px 40px rgba(0,0,0,0.6);overflow:hidden;' +
            'display:flex;flex-direction:column;font-size:13px;' +
            'left:' + Math.max(20, (window.innerWidth - 500) / 2) + 'px;' +
            'top:' + Math.max(20, (window.innerHeight - 400) / 2) + 'px;';
        ov.innerHTML =
            '<div style="display:flex;align-items:center;justify-content:space-between;' +
            'padding:8px 14px;background:rgba(20,30,60,0.8);' +
            'border-bottom:1px solid rgba(100,160,255,0.1);cursor:move;user-select:none;flex-shrink:0;">' +
            '<span style="font-weight:600;color:#38bdf8;font-size:14px;">📁 本地云盘</span>' +
            '<span class="cd-close" style="' +
            'width:24px;height:24px;display:flex;align-items:center;justify-content:center;' +
            'border-radius:6px;cursor:pointer;color:#94a3b8;font-size:16px;">×</span></div>' +
            '<div style="padding:6px 10px;border-bottom:1px solid rgba(100,160,255,0.05);flex-shrink:0;' +
            'display:flex;flex-wrap:wrap;gap:4px;align-items:center;">' +
            '<button class="cd-upload" style="font-size:11px;padding:3px 8px;border-radius:6px;' +
            'border:1px solid rgba(56,189,248,0.3);background:rgba(56,189,248,0.1);color:#38bdf8;cursor:pointer;">上传图片</button>' +
            '<button class="cd-batchsel" style="font-size:10px;padding:2px 6px;border-radius:4px;' +
            'border:1px solid rgba(56,189,248,0.2);background:transparent;color:#38bdf8;cursor:pointer;display:none;">批量选择</button>' +
            '<span style="width:1px;height:16px;background:rgba(100,160,255,0.1);"></span>' +
            '<span class="cd-pick-name" style="font-size:10px;color:#475569;">未选择</span>' +
            '<span style="flex:1;min-width:4px;"></span>' +
            '<button class="cd-pick-confirm" style="font-size:10px;padding:2px 6px;border-radius:4px;' +
            'border:1px solid rgba(56,189,248,0.3);background:rgba(56,189,248,0.08);color:#475569;cursor:pointer;display:none;" disabled>应用</button>' +
            '<button class="cd-del-confirm" style="font-size:10px;padding:2px 6px;border-radius:4px;' +
            'border:1px solid rgba(248,113,113,0.2);background:rgba(248,113,113,0.08);color:#475569;cursor:pointer;display:none;" disabled>删除</button>' +
            '<button class="cd-dl-confirm" style="font-size:10px;padding:2px 6px;border-radius:4px;' +
            'border:1px solid rgba(56,189,248,0.2);background:rgba(56,189,248,0.08);color:#475569;cursor:pointer;display:none;" disabled>下载</button>' +
            '<button class="cd-pick-cancel" style="font-size:10px;padding:2px 6px;border-radius:4px;' +
            'border:none;background:transparent;color:#475569;cursor:pointer;display:none;">取消</button>' +
            '<span style="font-size:10px;color:#475569;">共 <span class="cd-count">0</span> 张</span>' +
            '<button class="cd-clearall" style="font-size:10px;padding:2px 6px;border-radius:4px;' +
            'border:1px solid rgba(248,113,113,0.2);background:transparent;color:#64748b;cursor:pointer;">清空</button>' +
            '<button class="cd-clearcanvas" style="font-size:10px;padding:2px 6px;border-radius:4px;' +
            'border:1px solid rgba(248,113,113,0.3);background:transparent;color:#f87171;cursor:pointer;">清空画布</button>' +
            '</div>' +
            '<div class="cd-grid" style="flex:1;overflow-y:auto;padding:8px;display:flex;flex-wrap:wrap;align-content:start;gap:8px;"></div>';

        document.body.appendChild(ov);
        this._overlay = ov;

        // 四角缩放（使用 WindowHelper）
        if (typeof WindowHelper !== 'undefined') {
            WindowHelper.makeResizable(ov, {
                minWidth: 400,
                minHeight: 300,
                storeKey: 'cd-window-rect'
            });
        }

        // 点击云盘窗口时置顶
        ov.addEventListener('mousedown', function() {
            var topZ = (window.__cos_topZ || 20000) + 1;
            window.__cos_topZ = topZ;
            ov.style.zIndex = topZ;
        });

        // 拖拽标题栏
        var header = ov.querySelector('div:first-child');
        var dragging = false, dx, dy, dl, dt;
        header.addEventListener('mousedown', function(e) {
            if (e.target.closest('.cd-close')) return;
            dragging = true;
            dx = e.clientX - ov.offsetLeft;
            dy = e.clientY - ov.offsetTop;
            e.preventDefault();
        });
        document.addEventListener('mousemove', function(e) {
            if (!dragging) return;
            ov.style.left = (e.clientX - dx) + 'px';
            ov.style.top = (e.clientY - dy) + 'px';
        });
        document.addEventListener('mouseup', function() { dragging = false; });

        // 关闭
        ov.querySelector('.cd-close').addEventListener('click', function() {
            ov.style.display = 'none';
        });

        // 上传
        ov.querySelector('.cd-upload').addEventListener('click', function() {
            var input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/png,image/jpeg,image/gif,image/webp';
            input.multiple = true;
            input.style.display = 'none';
            document.body.appendChild(input);
            input.addEventListener('change', function() {
                var files = input.files;
                for (var i = 0; i < files.length; i++) {
                    (function(f) {
                        var reader = new FileReader();
                        reader.onload = function(e2) {
                            self.add(f.name.replace(/\.[^.]+$/, ''), '手动上传', e2.target.result);
                            self._refreshGrid();
                        };
                        reader.readAsDataURL(f);
                    })(files[i]);
                }
                document.body.removeChild(input);
            });
            input.click();
        });

        // 清空全部
        ov.querySelector('.cd-clearall').addEventListener('click', function() {
            if (self._items.length === 0) return;
            if (!confirm('清空云盘所有图片？')) return;
            self._items = [];
            self._save();
            self._refreshGrid();
        });

        // 清空画布图片
        ov.querySelector('.cd-clearcanvas').addEventListener('click', function() {
            self._clearCanvasImages();
        });

        // 注册画布 drop 接收（从云盘拖图片到画布）
        // 每次 open 都重新注册，确保 target 有效
        self._registerCanvasDrop();

        // 批量选择：切换多选模式
        var batchSelBtn = ov.querySelector('.cd-batchsel');
        batchSelBtn.addEventListener('click', function() {
            var wasSel = batchSelBtn.textContent === '取消选择';
            batchSelBtn.textContent = wasSel ? '批量选择' : '取消选择';
            batchSelBtn.style.background = wasSel ? 'transparent' : 'rgba(56,189,248,0.15)';
            self._isBatchSel = !wasSel;
            if (wasSel) {
                // 退出选择 → 隐藏操作按钮
                var g2 = ov.querySelector('.cd-grid');
                if (g2) g2.querySelectorAll('.cd-card-selected').forEach(function(el) {
                    el.classList.remove('cd-card-selected');
                    el.style.borderColor = 'rgba(100,160,255,0.08)';
                });
                self._selectedPickId = null;
                ['cd-pick-confirm','cd-del-confirm','cd-dl-confirm','cd-pick-cancel'].forEach(function(cls) {
                    var b = ov.querySelector('.' + cls);
                    if (b) b.style.display = 'none';
                });
                var nameEl = ov.querySelector('.cd-pick-name');
                if (nameEl) { nameEl.textContent = '未选择'; nameEl.style.color = '#475569'; }
            }
            self._refreshGrid();
        });

        // 应用（选用此图）
        ov.querySelector('.cd-pick-confirm').addEventListener('click', function() {
            if (!self._selectedPickId || !self._onSelect) return;
            var found = self._items.find(function(it) { return it.id === self._selectedPickId; });
            if (found) {
                self._onSelect(found);
                self._overlay.style.display = 'none';
                self._onSelect = null;
            }
        });
        // 删除选中
        ov.querySelector('.cd-del-confirm').addEventListener('click', function() {
            var grid3 = ov.querySelector('.cd-grid');
            if (!grid3) return;
            var ids3 = [];
            grid3.querySelectorAll('.cd-card-selected').forEach(function(el) {
                var idx = Array.prototype.indexOf.call(grid3.children, el);
                if (idx >= 0 && idx < self._items.length) ids3.push(self._items[idx].id);
            });
            if (ids3.length === 0) return;
            self._items = self._items.filter(function(it) { return ids3.indexOf(it.id) < 0; });
            self._save();
            self._refreshGrid();
        });
        // 下载选中
        ov.querySelector('.cd-dl-confirm').addEventListener('click', function() {
            var grid4 = ov.querySelector('.cd-grid');
            if (!grid4) return;
            var ids4 = [];
            grid4.querySelectorAll('.cd-card-selected').forEach(function(el) {
                var idx = Array.prototype.indexOf.call(grid4.children, el);
                if (idx >= 0 && idx < self._items.length) ids4.push(self._items[idx].id);
            });
            if (ids4.length === 0) return;
            self._batchDownload(ids4);
        });
        // 取消选择
        ov.querySelector('.cd-pick-cancel').addEventListener('click', function() {
            self._selectedPickId = null;
            var grid5 = ov.querySelector('.cd-grid');
            if (grid5) grid5.querySelectorAll('.cd-card-selected').forEach(function(el) {
                el.classList.remove('cd-card-selected');
                el.style.borderColor = 'rgba(100,160,255,0.08)';
            });
            ['cd-pick-confirm','cd-del-confirm','cd-dl-confirm','cd-pick-cancel'].forEach(function(cls) {
                var b = ov.querySelector('.' + cls);
                if (b) b.style.display = 'none';
            });
            var nameEl2 = ov.querySelector('.cd-pick-name');
            if (nameEl2) { nameEl2.textContent = '未选择'; nameEl2.style.color = '#475569'; }
        });

        // 拖拽上传
        ov.addEventListener('dragover', function(e) { e.preventDefault(); ov.style.borderColor = 'rgba(56,189,248,0.5)'; });
        ov.addEventListener('dragleave', function() { ov.style.borderColor = 'rgba(100,160,255,0.15)'; });
        ov.addEventListener('drop', function(e) {
            e.preventDefault();
            ov.style.borderColor = 'rgba(100,160,255,0.15)';
            var files = e.dataTransfer.files;
            for (var i = 0; i < files.length; i++) {
                if (!files[i].type.match(/^image\//)) continue;
                (function(f) {
                    var reader = new FileReader();
                    reader.onload = function(e2) {
                        self.add(f.name.replace(/\.[^.]+$/, ''), '手动拖入', e2.target.result);
                        self._refreshGrid();
                    };
                    reader.readAsDataURL(f);
                })(files[i]);
            }
        });

        this._refreshGrid();
    },

    _refreshGrid: function() {
        var ov = this._overlay;
        if (!ov) return;
        var grid = ov.querySelector('.cd-grid');
        var count = ov.querySelector('.cd-count');
        if (count) count.textContent = this._items.length;
        if (!grid) return;
        var self = this;

        var batchSelBtn2 = ov.querySelector('.cd-batchsel');
        if (batchSelBtn2) batchSelBtn2.style.display = this._items.length > 0 ? '' : 'none';
        grid.innerHTML = '';
        this._selectedPickId = null;
        // 隐藏操作按钮
        ['cd-pick-confirm','cd-del-confirm','cd-dl-confirm','cd-pick-cancel'].forEach(function(cls) {
            var b = ov.querySelector('.' + cls);
            if (b) b.style.display = 'none';
        });
        var ne = ov.querySelector('.cd-pick-name');
        if (ne) { ne.textContent = '未选择'; ne.style.color = '#475569'; }

        if (this._items.length === 0) {
            grid.innerHTML = '<div style="color:#475569;font-size:12px;padding:20px;text-align:center;width:100%;">云盘为空，从插件导出或手动上传图片</div>';
            return;
        }

        this._items.forEach(function(item) {
            var card = document.createElement('div');
            card.style.cssText =
                'width:100px;border-radius:6px;border:2px solid rgba(100,160,255,0.08);' +
                'overflow:hidden;cursor:pointer;transition:border-color 0.12s;' +
                'background:rgba(20,30,60,0.3);position:relative;';
            card.onmouseenter = function() { if (self._selectedPickId !== item.id) card.style.borderColor = 'rgba(56,189,248,0.3)'; };
            card.onmouseleave = function() { if (self._selectedPickId !== item.id) card.style.borderColor = 'rgba(100,160,255,0.08)'; };

            // 缩略图
            var thumb = document.createElement('div');
            thumb.style.cssText = 'width:100px;height:100px;display:flex;align-items:center;justify-content:center;overflow:hidden;';
            var img = document.createElement('img');
            img.src = item.dataURL;
            img.style.cssText = 'max-width:100px;max-height:100px;image-rendering:pixelated;';
            img.draggable = false;
            thumb.appendChild(img);
            card.appendChild(thumb);
            // 可拖拽到画布（只传 id，dataURL 太大可能被截断）
            card.draggable = true;
            card.addEventListener('dragstart', function(e) {
                e.dataTransfer.setData('text/x-cos-image-id', item.id);
                e.dataTransfer.effectAllowed = 'copy';
            });

            // 批量选择勾选框
            if (self._isBatchSel) {
                var cb = document.createElement('div');
                cb.className = 'cd-batch-cb';
                cb.style.cssText = 'position:absolute;top:3px;right:3px;width:16px;height:16px;border-radius:3px;' +
                    'border:2px solid rgba(100,160,255,0.3);background:rgba(15,21,37,0.8);' +
                    'display:flex;align-items:center;justify-content:center;font-size:10px;color:#38bdf8;z-index:2;';
                card.appendChild(cb);
            }

            // 信息
            var info = document.createElement('div');
            info.style.cssText = 'padding:3px 5px;font-size:10px;';
            var nameEl = document.createElement('div');
            nameEl.textContent = item.name;
            nameEl.style.cssText = 'color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
            info.appendChild(nameEl);
            var srcEl = document.createElement('div');
            srcEl.textContent = item.source + ' · ' + item.w + '×' + item.h;
            srcEl.style.cssText = 'color:#475569;';
            info.appendChild(srcEl);
            card.appendChild(info);

            // 单击：切换选中（多选）
            card.addEventListener('click', function() {
                var isSel = card.classList.contains('cd-card-selected');
                if (isSel) {
                    card.classList.remove('cd-card-selected');
                    card.style.borderColor = 'rgba(100,160,255,0.08)';
                    var cb = card.querySelector('.cd-batch-cb');
                    if (cb) { cb.textContent = ''; cb.style.borderColor = 'rgba(100,160,255,0.3)'; }
                } else {
                    card.classList.add('cd-card-selected');
                    card.style.borderColor = '#38bdf8';
                    var cb = card.querySelector('.cd-batch-cb');
                    if (cb) { cb.textContent = '✓'; cb.style.borderColor = '#38bdf8'; }
                }
                // 更新底部状态栏
                var selCards = grid.querySelectorAll('.cd-card-selected');
                var cnt = selCards.length;
                var toolbar = ov.querySelector('.cd-pick-name');
                if (!toolbar) return;
                if (cnt === 0) {
                    toolbar.textContent = '未选择';
                    toolbar.style.color = '#475569';
                    ['cd-pick-confirm','cd-del-confirm','cd-dl-confirm','cd-pick-cancel'].forEach(function(cls) {
                        var b = ov.querySelector('.' + cls);
                        if (b) { b.style.display = 'none'; }
                    });
                } else {
                    var lastName = self._items[Array.prototype.indexOf.call(grid.children, selCards[selCards.length - 1])].name;
                    toolbar.textContent = cnt === 1 ? lastName : (cnt + ' 张');
                    toolbar.style.color = '#38bdf8';
                    ['cd-pick-confirm','cd-del-confirm','cd-dl-confirm','cd-pick-cancel'].forEach(function(cls) {
                        var b = ov.querySelector('.' + cls);
                        if (b) {
                            b.style.display = '';
                            var isDel = cls === 'cd-del-confirm';
                            var enabled = cls === 'cd-pick-confirm' ? cnt === 1 : true;
                            b.disabled = !enabled;
                            b.style.cssText = 'font-size:10px;padding:2px 6px;border-radius:4px;' + (isDel
                                ? (enabled ? 'border:1px solid rgba(248,113,113,0.3);background:rgba(248,113,113,0.12);color:#f87171;cursor:pointer;'
                                          : 'border:1px solid rgba(248,113,113,0.2);background:rgba(248,113,113,0.08);color:#475569;cursor:pointer;')
                                : (enabled ? 'border:1px solid rgba(56,189,248,0.3);background:rgba(56,189,248,0.12);color:#38bdf8;cursor:pointer;'
                                          : 'border:1px solid rgba(56,189,248,0.2);background:rgba(56,189,248,0.08);color:#475569;cursor:pointer;'));
                        }
                    });
                }
                // 记录最后一个点击的 id（供选用此图用）
                if (!isSel) self._selectedPickId = item.id;
            });

            // 右键删除
            card.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                self.remove(item.id);
                self._refreshGrid();
            });

            grid.appendChild(card);
        });

    },

    // 选择模式下的网格渲染（mode: 'delete' | 'download'）
    _refreshGridSelect: function(active, onConfirm, mode) {
        mode = mode || 'delete';
        var ov = this._overlay;
        if (!ov) return;
        var grid = ov.querySelector('.cd-grid');
        if (!grid) return;
        var selDelBtn = ov.querySelector('.cd-selectdel');
        if (selDelBtn) selDelBtn.style.display = this._items.length > 0 ? (active ? '' : '') : 'none';
        // 退出选择模式时清理定时器
        if (!active && this._selTimer) { clearInterval(this._selTimer); this._selTimer = null; }
        var self = this;
        var checked = {};

        grid.innerHTML = '';
        if (this._items.length === 0) {
            grid.innerHTML = '<div style="color:#475569;font-size:12px;padding:20px;text-align:center;width:100%;">云盘为空</div>';
            return;
        }

        this._items.forEach(function(item) {
            var card = document.createElement('div');
            card.style.cssText =
                'width:100px;border-radius:6px;border:2px solid rgba(100,160,255,0.08);' +
                'overflow:hidden;cursor:pointer;background:rgba(20,30,60,0.3);position:relative;';

            // 勾选框
            var cb = document.createElement('div');
            cb.style.cssText =
                'position:absolute;top:3px;right:3px;width:18px;height:18px;border-radius:4px;' +
                'border:2px solid rgba(100,160,255,0.3);background:rgba(15,21,37,0.8);' +
                'display:flex;align-items:center;justify-content:center;font-size:11px;color:#38bdf8;' +
                'z-index:2;';
            card.appendChild(cb);

            card.addEventListener('click', function() {
                var isChecked = cb.textContent === '✓';
                cb.textContent = isChecked ? '' : '✓';
                cb.style.borderColor = isChecked ? 'rgba(100,160,255,0.3)' : '#38bdf8';
                card.style.borderColor = isChecked ? 'rgba(100,160,255,0.08)' : 'rgba(56,189,248,0.5)';
                checked[item.id] = !isChecked;
            });

            // 缩略图
            var thumb = document.createElement('div');
            thumb.style.cssText = 'width:100px;height:100px;display:flex;align-items:center;justify-content:center;overflow:hidden;';
            var img = document.createElement('img');
            img.src = item.dataURL;
            img.style.cssText = 'max-width:100px;max-height:100px;image-rendering:pixelated;';
            img.draggable = false;
            thumb.appendChild(img);
            card.appendChild(thumb);
            // 可拖拽到画布（只传 id，dataURL 太大可能被截断）
            card.draggable = true;
            card.addEventListener('dragstart', function(e) {
                e.dataTransfer.setData('text/x-cos-image-id', item.id);
                e.dataTransfer.effectAllowed = 'copy';
            });

            // 批量选择勾选框
            if (self._isBatchSel) {
                var cb = document.createElement('div');
                cb.className = 'cd-batch-cb';
                cb.style.cssText = 'position:absolute;top:3px;right:3px;width:16px;height:16px;border-radius:3px;' +
                    'border:2px solid rgba(100,160,255,0.3);background:rgba(15,21,37,0.8);' +
                    'display:flex;align-items:center;justify-content:center;font-size:10px;color:#38bdf8;z-index:2;';
                card.appendChild(cb);
            }

            // 信息
            var info = document.createElement('div');
            info.style.cssText = 'padding:3px 5px;font-size:10px;';
            var nameEl = document.createElement('div');
            nameEl.textContent = item.name;
            nameEl.style.cssText = 'color:#94a3b8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
            info.appendChild(nameEl);
            card.appendChild(info);

            grid.appendChild(card);
        });

        // 确认删除按钮
        if (active) {
            var confirmBar = document.createElement('div');
            confirmBar.style.cssText = 'width:100%;padding:8px 0;text-align:center;';
            var btn = document.createElement('button');
            var isDl = mode === 'download';
            btn.textContent = isDl ? '下载选中 (0)' : '删除选中 (0)';
            btn.style.cssText = 'font-size:11px;padding:4px 16px;border-radius:6px;border:1px solid ' +
                (isDl ? 'rgba(56,189,248,0.3)' : 'rgba(248,113,113,0.3)') + ';background:' +
                (isDl ? 'rgba(56,189,248,0.1)' : 'rgba(248,113,113,0.1)') + ';color:' +
                (isDl ? '#38bdf8' : '#f87171') + ';cursor:pointer;';
            confirmBar.appendChild(btn);
            grid.appendChild(confirmBar);

            // 实时更新选中计数
            var label = isDl ? '下载选中' : '删除选中';
            var updateCount = function() {
                var ids = Object.keys(checked).filter(function(id) { return checked[id]; });
                btn.textContent = label + ' (' + ids.length + ')';
            };

            // 定时器监测选中变化
            self._selTimer = setInterval(updateCount, 200);
            btn.addEventListener('click', function() {
                if (self._selTimer) { clearInterval(self._selTimer); self._selTimer = null; }
                var ids = Object.keys(checked).filter(function(id) { return checked[id]; });
                onConfirm(ids);
            });
        }
    },

    // 批量下载选中图片
    _batchDownload: function(ids) {
        var items = this._items.filter(function(it) { return ids.indexOf(it.id) >= 0; });
        if (items.length === 0) return;
        if (typeof JSZip !== 'undefined') {
            var zip = new JSZip();
            items.forEach(function(item) {
                var bin = atob(item.dataURL.split(',')[1]);
                var buf = new Uint8Array(bin.length);
                for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
                zip.file((item.name || 'image') + '.png', buf);
            });
            zip.generateAsync({ type: 'blob' }).then(function(blob) {
                var link = document.createElement('a');
                link.download = 'cloud_drive_' + Date.now() + '.zip';
                link.href = URL.createObjectURL(blob);
                link.click();
                URL.revokeObjectURL(link.href);
            });
            return;
        }
        items.forEach(function(item) {
            var link = document.createElement('a');
            link.download = (item.name || 'image') + '.png';
            link.href = item.dataURL;
            link.click();
        });
    }
};

// 启动时初始化
try { CosCloudDrive.init(); } catch(e) {}
