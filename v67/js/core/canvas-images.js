/**
 * CanvasImages - 画布图片管理引擎
 *
 * 核心能力：
 *   - LOD 多级缩略图（thumb 64px / medium 256px / display 2048px / original 不限）
 *   - IndexedDB 持久化（metadata 与 original 分离存储，加载快）
 *   - 视口裁剪（只渲染可见区域内的图片，类似 Google Maps）
 *   - 选中机制（单击选中，供插件取用 getSelected）
 *   - 拖拽移动（世界坐标，按缩放比换算）
 *   - 右键菜单（下载原图 / 复制 / 删除）
 *   - 文件拖放上传（从桌面拖图片到画布）
 *   - 剪贴板粘贴（Ctrl+V 粘贴图片）
 *   - 派生关系（记录 parentId，结果图放在原图旁边）
 *
 * 公开 API：
 *   CanvasImages.init(world)                                        初始化
 *   CanvasImages.place(dataURL, x?, y?, source?, parentId?)         放图片到画布 → Promise<id>
 *   CanvasImages.remove(id)                                         删除图片
 *   CanvasImages.getSelected(level?)                                获取选中图 dataURL ('thumb'|'medium'|'display')
 *   CanvasImages.getSelectedId()                                    获取选中图 ID
 *   CanvasImages.getSelectedOriginal()                              获取选中图原图 → Promise<dataURL>
 *   CanvasImages.download(id)                                       下载原图
 *   CanvasImages.getAll()                                           获取所有图片元数据
 *   CanvasImages.clear()                                            清空所有图片
 */
var CanvasImages = (function() {

    // ========== 私有状态 ==========
    var _items = [];               // [{id, name, source, parentId, x, y, w, h, origW, origH, levels:{thumb,medium,display}, originalKey, time}]
    var _elements = {};            // id → { el, imgEl, currentLevel }
    var _db = null;
    var _dbReady = false;
    var _dbPending = [];
    var _selected = {};            // id → true（多选集合，框选/点选统一写入）
    var _primaryId = null;         // 最近点选的单图 id（供单图 API 使用）
    var _world = null;
    var _layer = null;
    var _lodTimer = null;
    var _dragState = null;
    var _ctxMenu = null;
    var _placeCounter = 0;

    // ========== 常量 ==========
    var DB_NAME = 'CanvasImageDB';
    var DB_VER = 2;
    var META_STORE = 'metadata';
    var ORIG_STORE = 'originals';

    var THUMB_MAX = 64;
    var MEDIUM_MAX = 256;
    var DISPLAY_MAX = 2048;

    var LOD_THUMB_MAX = 80;        // 屏幕像素 < 80 → thumb
    var LOD_MEDIUM_MAX = 300;      // 屏幕像素 < 300 → medium
                                     // else → display

    var DEFAULT_WORLD_SIZE = 350;   // 画布上图片默认最大边长（世界坐标）
    var PLACE_OFFSET = 30;
    var DRAG_THRESHOLD = 4;

    // ========== 样式注入 ==========
    function _injectStyles() {
        if (document.getElementById('ci-styles')) return;
        var s = document.createElement('style');
        s.id = 'ci-styles';
        s.textContent =
            '.ci-item{position:absolute;pointer-events:auto;cursor:grab;border-radius:6px;' +
            'transition:box-shadow .15s;}' +
            '.ci-item.ci-dragging{cursor:grabbing;opacity:0.85;z-index:100;}' +
            '.ci-item.ci-selected{box-shadow:0 0 0 2px #38bdf8,0 0 16px rgba(56,189,248,0.4);}' +
            '.ci-img-wrap{width:100%;height:100%;border-radius:6px;overflow:hidden;' +
            'background:rgba(15,25,50,0.6);border:1px solid rgba(100,160,255,0.15);}' +
            '.ci-item.ci-selected .ci-img-wrap{border-color:#38bdf8;}' +
            '.ci-img{width:100%;height:100%;display:block;pointer-events:none;}' +
            '.ci-del{position:absolute;top:-10px;right:-10px;width:24px;height:24px;' +
            'background:rgba(220,80,60,0.9);color:#fff;border:none;border-radius:50%;' +
            'font-size:13px;line-height:1;cursor:pointer;display:none;z-index:5;' +
            'box-shadow:0 1px 4px rgba(0,0,0,0.4);}' +
            '.ci-item:hover .ci-del{display:block;}' +
            '.ci-badge{position:absolute;bottom:3px;left:3px;font-size:9px;padding:1px 5px;' +
            'background:rgba(15,25,50,0.85);color:#94a3b8;border-radius:3px;pointer-events:none;' +
            'backdrop-filter:blur(4px);}' +
            '.ci-loading{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' +
            'width:24px;height:24px;border:2px solid rgba(56,189,248,0.2);' +
            'border-top-color:#38bdf8;border-radius:50%;animation:ci-spin 0.8s linear infinite;}' +
            '@keyframes ci-spin{to{transform:translate(-50%,-50%) rotate(360deg)}}' +
            '.ci-ctx-menu{position:fixed;z-index:99999;background:rgba(15,25,50,0.95);' +
            'border:1px solid rgba(100,160,255,0.2);border-radius:8px;padding:4px 0;' +
            'box-shadow:0 8px 24px rgba(0,0,0,0.5);min-width:120px;backdrop-filter:blur(12px);}' +
            '.ci-ctx-item{padding:7px 16px;font-size:12px;color:#e8edf5;cursor:pointer;' +
            'transition:background 0.1s;}' +
            '.ci-ctx-item:hover{background:rgba(56,189,248,0.15);}' +
            '.ci-ctx-item.ci-ctx-danger{color:#f87171;}' +
            '.ci-ctx-item.ci-ctx-danger:hover{background:rgba(248,113,113,0.15);}' +
            '.ci-ctx-sep{height:1px;background:rgba(100,160,255,0.1);margin:4px 0;}' +
            /* HUD 下载下拉菜单 */
            '.ci-hud-menu{position:fixed;top:calc(var(--cos-hud-h) - 2px);right:16px;' +
            'background:rgba(15,25,50,0.95);border:1px solid rgba(100,160,255,0.2);' +
            'border-radius:0 0 10px 10px;padding:4px 0;min-width:160px;z-index:9002;' +
            'box-shadow:0 8px 24px rgba(0,0,0,0.5);backdrop-filter:blur(12px);' +
            'display:none;font-size:12px;}' +
            '.ci-hud-menu.show{display:block;}' +
            '.ci-hud-menu-item{padding:8px 16px;color:#e8edf5;cursor:pointer;transition:background 0.1s;}' +
            '.ci-hud-menu-item:hover{background:rgba(56,189,248,0.15);}' +
            '.ci-hud-menu-item.ci-disabled{color:#475569;cursor:not-allowed;}' +
            '.ci-hud-menu-item.ci-disabled:hover{background:none;}' +
            '.ci-hud-menu-sep{height:1px;background:rgba(100,160,255,0.1);margin:4px 0;}' +
            /* 批量选择模式 */
            '.ci-batch-bar{position:fixed;top:var(--cos-hud-h);left:50%;transform:translateX(-50%);' +
            'display:flex;align-items:center;gap:10px;padding:6px 16px;' +
            'background:rgba(15,25,50,0.95);border:1px solid rgba(56,189,248,0.3);' +
            'border-radius:0 0 10px 10px;z-index:9001;font-size:12px;color:#e8edf5;' +
            'backdrop-filter:blur(12px);box-shadow:0 4px 20px rgba(0,0,0,0.4);}' +
            '.ci-batch-bar button{padding:4px 12px;border:none;border-radius:6px;cursor:pointer;' +
            'font-size:12px;font-family:inherit;transition:all 0.15s;}' +
            '.ci-batch-all{background:rgba(56,189,248,0.15);color:#38bdf8;border:1px solid rgba(56,189,248,0.3)!important;}' +
            '.ci-batch-all:hover{background:rgba(56,189,248,0.25);}' +
            '.ci-batch-dl{background:rgba(52,211,153,0.15);color:#34d399;border:1px solid rgba(52,211,153,0.3)!important;}' +
            '.ci-batch-dl:hover{background:rgba(52,211,153,0.25);}' +
            '.ci-batch-cancel{background:rgba(220,80,60,0.15);color:#e87060;border:1px solid rgba(220,80,60,0.3)!important;}' +
            '.ci-batch-cancel:hover{background:rgba(220,80,60,0.25);}' +
            '.ci-batch-count{color:#38bdf8;font-weight:600;}' +
            '.ci-item.ci-batch-selected{box-shadow:0 0 0 3px #34d399,0 0 16px rgba(52,211,153,0.4)!important;}' +
            '.ci-batch-check{position:absolute;top:4px;left:4px;width:20px;height:20px;' +
            'border:2px solid rgba(56,189,248,0.6);border-radius:4px;background:rgba(15,25,50,0.8);' +
            'z-index:5;cursor:pointer;display:none;}' +
            '.ci-batch-mode .ci-batch-check{display:block;}' +
            '.ci-batch-mode .ci-del{display:none!important;}' +
            '.ci-item.ci-batch-selected .ci-batch-check{background:#34d399;border-color:#34d399;}' +
            '.ci-item.ci-batch-selected .ci-batch-check::after{content:"\u2713";color:#1a1a2e;' +
            'font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;width:100%;height:100%;}' +
            /* 框选矩形 */
            '.ci-select-box{position:fixed;border:1.5px dashed #38bdf8;background:rgba(56,189,248,0.12);' +
            'pointer-events:none;z-index:9998;box-sizing:border-box;' +
            'box-shadow:0 0 0 1px rgba(56,189,248,0.3);}' +
            /* 视频元素 */
            '.ci-video-wrap{width:100%;height:100%;overflow:hidden;' +
            'background:rgba(15,25,50,0.6);position:relative;}' +
            '.ci-video{width:100%;height:100%;display:block;cursor:pointer;object-fit:cover;}' +
            /* 音频元素 - 圆形按钮 */
            '.ci-audio-wrap{width:100%;height:100%;border-radius:50%;' +
            'background:rgba(56,189,248,0.15);display:flex;align-items:center;justify-content:center;cursor:pointer;}' +
            '.ci-item.ci-selected .ci-audio-wrap{background:rgba(56,189,248,0.3);}' +
            '.ci-audio-icon{font-size:28px;line-height:1;user-select:none;}' +
            /* 画布操作提示（右上角按钮下方） */
            '.ci-hints{position:fixed;top:calc(var(--cos-hud-h) + 8px);right:16px;z-index:9000;display:flex;flex-direction:column;' +
            'align-items:flex-end;gap:4px;font-size:11px;color:#94a3b8;pointer-events:none;user-select:none;font-family:inherit;text-align:right;}' +
            '.ci-hints div{background:rgba(15,25,50,0.7);padding:3px 9px;border-radius:6px;white-space:nowrap;' +
            'border:1px solid rgba(100,160,255,0.12);backdrop-filter:blur(6px);}' +
            '.ci-hints kbd{background:rgba(56,189,248,0.15);color:#7dd3fc;border-radius:3px;padding:0 4px;' +
            'font-size:10px;border:1px solid rgba(56,189,248,0.25);font-family:inherit;}';
        document.head.appendChild(s);
    }

    // ========== 画布操作提示（右上角按钮下方三条） ==========
    function _injectHints() {
        if (document.getElementById('ci-hints')) return;
        var h = document.createElement('div');
        h.id = 'ci-hints';
        h.className = 'ci-hints';
        h.innerHTML =
            '<div><kbd>左键</kbd>：拖动画布 / 单击选中</div>' +
            '<div><kbd>空格</kbd> + <kbd>左键</kbd>：框选多图（Shift 追加）</div>' +
            '<div><kbd>右键</kbd> 按住滑动：删除</div>';
        document.body.appendChild(h);
    }

    // ========== IndexedDB ==========
    function _openDB() {
        return new Promise(function(resolve, reject) {
            var req = indexedDB.open(DB_NAME, DB_VER);
            req.onupgradeneeded = function(e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains(META_STORE))
                    db.createObjectStore(META_STORE);
                if (!db.objectStoreNames.contains(ORIG_STORE))
                    db.createObjectStore(ORIG_STORE);

                // v1→v2 迁移：将旧的单条 all_items 拆分为逐条存储
                if (e.oldVersion < 2) {
                    try {
                        var tx = e.target.transaction;
                        var store = tx.objectStore(META_STORE);
                        var getReq = store.get('all_items');
                        getReq.onsuccess = function() {
                            var oldItems = getReq.result;
                            if (oldItems && Array.isArray(oldItems)) {
                                oldItems.forEach(function(item) {
                                    if (item && item.id) store.put(item, item.id);
                                });
                                store.delete('all_items');
                            }
                        };
                    } catch(migErr) {
                        console.warn('[CanvasImages] 迁移失败，旧数据将在首次保存后被替换', migErr);
                    }
                }
            };
            req.onsuccess = function(e) {
                _db = e.target.result;
                _dbReady = true;
                _dbPending.forEach(function(fn) { try { fn(); } catch(err) {} });
                _dbPending = [];
                resolve(_db);
            };
            req.onerror = function(e) { reject(e); };
        });
    }

    /**
     * 保存单条图片元数据（增量写入，避免大 blob）
     */
    function _saveItem(item) {
        if (!_db) { _dbPending.push(function() { _saveItem(item); }); return; }
        try {
            var tx = _db.transaction(META_STORE, 'readwrite');
            tx.objectStore(META_STORE).put(item, item.id);
        } catch(e) {}
    }

    /**
     * 删除单条图片元数据
     */
    function _deleteItemMeta(id) {
        if (!_db) return;
        try {
            var tx = _db.transaction(META_STORE, 'readwrite');
            tx.objectStore(META_STORE).delete(id);
        } catch(e) {}
    }

    /**
     * 旧版兼容：全量保存（仅在迁移等极少场景使用）
     */
    function _saveMeta() {
        if (!_db) { _dbPending.push(function() { _saveMeta(); }); return; }
        // 逐条保存，不再打包成单条
        _items.forEach(function(item) { _saveItem(item); });
    }

    function _saveOriginal(key, dataURL) {
        if (!_db) { _dbPending.push(function() { _saveOriginal(key, dataURL); }); return; }
        try {
            var tx = _db.transaction(ORIG_STORE, 'readwrite');
            tx.objectStore(ORIG_STORE).put(dataURL, key);
        } catch(e) {}
    }

    function _getOriginal(key) {
        return new Promise(function(resolve) {
            if (!_db) { resolve(null); return; }
            try {
                var tx = _db.transaction(ORIG_STORE, 'readonly');
                var req = tx.objectStore(ORIG_STORE).get(key);
                req.onsuccess = function() { resolve(req.result || null); };
                req.onerror = function() { resolve(null); };
            } catch(e) { resolve(null); }
        });
    }

    function _deleteOriginal(key) {
        if (!_db) return;
        try {
            var tx = _db.transaction(ORIG_STORE, 'readwrite');
            tx.objectStore(ORIG_STORE).delete(key);
        } catch(e) {}
    }

    /**
     * 使用 cursor 逐条加载，避免一次性反序列化巨大 blob
     */
    function _loadAll() {
        return new Promise(function(resolve) {
            if (!_db) { resolve(); return; }
            try {
                var tx = _db.transaction(META_STORE, 'readonly');
                var store = tx.objectStore(META_STORE);
                var cursorReq = store.openCursor();
                cursorReq.onsuccess = function(e) {
                    var cursor = e.target.result;
                    if (cursor) {
                        // 跳过旧的 all_items 聚合记录
                        if (cursor.key !== 'all_items' && cursor.value && cursor.value.id) {
                            _items.push(cursor.value);
                        }
                        cursor.continue();
                    } else {
                        resolve();
                    }
                };
                cursorReq.onerror = function() { resolve(); };
            } catch(e) { resolve(); }
        });
    }

    // ========== 缩略图生成 ==========
    function _resizeTo(img, maxSide, format, quality) {
        var scale = Math.min(maxSide / img.naturalWidth, maxSide / img.naturalHeight, 1);
        var w = Math.max(1, Math.round(img.naturalWidth * scale));
        var h = Math.max(1, Math.round(img.naturalHeight * scale));
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        return c.toDataURL(format || 'image/jpeg', quality || 0.85);
    }

    function _generateLevels(dataURL) {
        return new Promise(function(resolve, reject) {
            var img = new Image();
            img.onload = function() {
                var origW = img.naturalWidth;
                var origH = img.naturalHeight;

                var levels = {
                    thumb: _resizeTo(img, THUMB_MAX, 'image/jpeg', 0.85),
                    medium: _resizeTo(img, MEDIUM_MAX, 'image/jpeg', 0.85),
                    display: _resizeTo(img, DISPLAY_MAX, 'image/jpeg', 0.92)
                };

                // 原图不超过 DISPLAY_MAX 时，display 直接用原 dataURL（省一次编码）
                if (origW <= DISPLAY_MAX && origH <= DISPLAY_MAX && dataURL.indexOf('data:') === 0) {
                    levels.display = dataURL;
                }

                resolve({
                    levels: levels,
                    original: dataURL,
                    origW: origW,
                    origH: origH
                });
            };
            img.onerror = function() { reject(new Error('图片加载失败')); };
            img.src = dataURL;
        });
    }

    // ========== 渲染 ==========
    function _createItemElement(item) {
        // 视频/音频类型有专用创建函数，不走图片渲染路径
        if (item.type === 'video' || item.type === 'audio') return null;
        var el = document.createElement('div');
        el.className = 'ci-item';
        el.dataset.id = item.id;
        el.setAttribute('data-cos-deletable', '');
        el.style.left = item.x + 'px';
        el.style.top = item.y + 'px';
        el.style.width = item.w + 'px';
        el.style.height = item.h + 'px';

        var wrap = document.createElement('div');
        wrap.className = 'ci-img-wrap';
        var imgEl = document.createElement('img');
        imgEl.className = 'ci-img';
        imgEl.src = item.levels.thumb;
        imgEl.draggable = false;
        wrap.appendChild(imgEl);
        el.appendChild(wrap);

        // 批量选择复选框
        var checkBtn = document.createElement('div');
        checkBtn.className = 'ci-batch-check';
        checkBtn.addEventListener('mousedown', function(e) {
            e.stopPropagation();
            e.preventDefault();
            _toggleSel(item.id);
        });
        el.appendChild(checkBtn);

        // 删除按钮
        var delBtn = document.createElement('button');
        delBtn.className = 'ci-del';
        delBtn.textContent = '\u2715';
        delBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            CanvasImages.remove(item.id);
        });
        el.appendChild(delBtn);

        // 来源标签
        if (item.source) {
            var badge = document.createElement('div');
            badge.className = 'ci-badge';
            badge.textContent = item.source;
            el.appendChild(badge);
        }

        // 选中状态
        if (_selected[item.id]) {
            el.classList.add('ci-selected');
        }

        // 拖拽 + 选中
        _makeDraggable(el, item);

        _layer.appendChild(el);
        _elements[item.id] = { el: el, imgEl: imgEl, currentLevel: 'thumb' };

        return el;
    }

    function _pickLevel(item, zoom) {
        var screenW = item.w * zoom;
        if (screenW < LOD_THUMB_MAX) return 'thumb';
        if (screenW < LOD_MEDIUM_MAX) return 'medium';
        return 'display';
    }

    function _updateLOD() {
        if (!_world || !_layer) return;
        var state = _world.getState();
        var zoom = state.scale;
        var bounds = _world.getVisibleBounds();

        // 先算出每个 item 的可见性
        var visFlags = {};
        var visibleCount = 0;
        for (var i = 0; i < _items.length; i++) {
            var item = _items[i];
            var elData = _elements[item.id];
            if (!elData) continue;
            var isVisible = (item.x + item.w >= bounds.left && item.x <= bounds.right &&
                             item.y + item.h >= bounds.top && item.y <= bounds.bottom);
            visFlags[item.id] = isVisible;
            if (isVisible) visibleCount++;
        }

        // 安全网：若所有图都被判为不可见（多半是 bounds 瞬时异常），不裁剪，全部显示，
        // 避免缩放/平移后整批图片被 display:none 而“全部消失”
        var cull = !(visibleCount === 0 && _items.length > 0);

        for (var j = 0; j < _items.length; j++) {
            var it = _items[j];
            var ed = _elements[it.id];
            if (!ed) continue;

            if (cull && !visFlags[it.id]) {
                if (ed.el.style.display !== 'none') ed.el.style.display = 'none';
                continue;
            }

            if (ed.el.style.display === 'none') {
                ed.el.style.display = '';
            }

            // 视频/音频元素不做 LOD 切换
            if (it.type === 'video' || it.type === 'audio') continue;

            // LOD 级别切换
            var targetLevel = _pickLevel(it, zoom);
            if (ed.currentLevel !== targetLevel) {
                ed.imgEl.src = it.levels[targetLevel];
                ed.currentLevel = targetLevel;
            }
        }
    }

    var _bounceCheckTimer = null;

    function _scheduleLODUpdate() {
        if (_lodTimer) clearTimeout(_lodTimer);
        _lodTimer = setTimeout(function() {
            _updateLOD();
        }, 150);
    }

    // ========== 选中（统一多选模型） ==========
    function _firstSelectedId() {
        for (var id in _selected) return id;
        return null;
    }

    function _applySelClass(id) {
        var elData = _elements[id];
        if (elData) elData.el.classList.toggle('ci-selected', !!_selected[id]);
    }

    function _refreshSelUI() {
        for (var id in _elements) {
            _elements[id].el.classList.toggle('ci-selected', !!_selected[id]);
        }
    }

    // 单选：清空其它，只选一个
    function _select(id) {
        _selected = {};
        if (id) { _selected[id] = true; _primaryId = id; }
        else { _primaryId = null; }
        _refreshSelUI();
    }

    // Shift 追加/取消单个
    function _toggleSel(id) {
        if (_selected[id]) {
            delete _selected[id];
            if (_primaryId === id) _primaryId = _firstSelectedId();
        } else {
            _selected[id] = true;
            _primaryId = id;
        }
        _applySelClass(id);
    }

    function _deselect() {
        _selected = {};
        _primaryId = null;
        _refreshSelUI();
    }

    // ========== 交互：拖拽 ==========
    function _makeDraggable(el, item) {
        el.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return;
            if (e.target.closest('.ci-del')) return;
            e.stopPropagation();

            _dragState = {
                id: item.id,
                startX: e.clientX,
                startY: e.clientY,
                startItemX: item.x,
                startItemY: item.y,
                moved: false,
                shiftKey: e.shiftKey
            };
            el.classList.add('ci-dragging');
        });
    }

    function _onDocMouseMove(e) {
        // 框选拖拽
        if (_selectBox && _selectBox.active) {
            _updateSelectBox(e.clientX, e.clientY);
            return;
        }

        if (!_dragState) return;
        var dx = e.clientX - _dragState.startX;
        var dy = e.clientY - _dragState.startY;

        if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
            _dragState.moved = true;
        }

        if (_dragState.moved) {
            var scale = _world ? _world.getState().scale : 1;
            var item = _getItem(_dragState.id);
            if (item) {
                item.x = _dragState.startItemX + dx / scale;
                item.y = _dragState.startItemY + dy / scale;
                var elData = _elements[_dragState.id];
                if (elData) {
                    elData.el.style.left = item.x + 'px';
                    elData.el.style.top = item.y + 'px';
                }
            }
        }
    }

    function _onDocMouseUp() {
        // 框选结束
        if (_selectBox && _selectBox.active) {
            _endSelectBox();
            return;
        }

        if (!_dragState) return;
        var ds = _dragState;
        var elData = _elements[ds.id];
        if (elData) elData.el.classList.remove('ci-dragging');

        if (!ds.moved) {
            // 没移动 → 点击：Shift 追加/取消，否则单选
            if (ds.shiftKey) {
                _toggleSel(ds.id);
            } else {
                _select(ds.id);
            }
        } else {
            // 拖拽结束 → 保存位置 + 更新 bounds
            _saveMeta();
            var item = _getItem(ds.id);
            if (item && _world) {
                _world.markContent(item.x, item.y, item.w, item.h);
            }
        }

        _dragState = null;
    }

    function _getItem(id) {
        for (var i = 0; i < _items.length; i++) {
            if (_items[i].id === id) return _items[i];
        }
        return null;
    }

    // ========== 交互：文件拖放 ==========
    function _registerFileDrop() {
        var target = document.getElementById('cos-world');
        if (!target) return;

        target.addEventListener('dragover', function(e) {
            var types = e.dataTransfer.types;
            var hasFiles = false;
            if (types && types.indexOf) {
                hasFiles = types.indexOf('Files') >= 0;
            }
            if (hasFiles) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            }
        });

        target.addEventListener('drop', function(e) {
            if (!e.dataTransfer || !e.dataTransfer.files || !e.dataTransfer.files.length) return;
            // 排除云盘的拖放（云盘用 text/x-cos-image-id）
            var types = e.dataTransfer.types;
            if (types && types.indexOf && types.indexOf('text/x-cos-image-id') >= 0) return;

            e.preventDefault();
            e.stopPropagation();

        var files = Array.prototype.slice.call(e.dataTransfer.files).filter(function(f) {
            return f.type.indexOf('image/') === 0 || f.type.indexOf('video/') === 0 || f.type.indexOf('audio/') === 0;
        });

        if (!files.length) return;
        var pos = _world.screenToWorld(e.clientX, e.clientY);
        files.forEach(function(f, i) {
            if (f.type.indexOf('video/') === 0) {
                CanvasImages.placeVideo(f, pos.x + i * PLACE_OFFSET, pos.y + i * PLACE_OFFSET, '上传');
            } else if (f.type.indexOf('audio/') === 0) {
                CanvasImages.placeAudio(f, pos.x + i * PLACE_OFFSET, pos.y + i * PLACE_OFFSET, '上传');
            } else {
                var reader = new FileReader();
                reader.onload = function(ev) {
                    CanvasImages.place(
                        ev.target.result,
                        pos.x + i * PLACE_OFFSET,
                        pos.y + i * PLACE_OFFSET,
                        '上传', null
                    );
                };
                reader.readAsDataURL(f);
            }
        });
        });
    }

    // ========== 交互：粘贴 ==========
    function _registerPaste() {
        document.addEventListener('paste', function(e) {
            if (e.target.closest('input,textarea,[contenteditable]')) return;
            var items = e.clipboardData && e.clipboardData.items;
            if (!items) return;

            for (var i = 0; i < items.length; i++) {
                if (items[i].type.indexOf('image') === 0) {
                    e.preventDefault();
                    var blob = items[i].getAsFile();
                    var reader = new FileReader();
                    reader.onload = function(ev) {
                        var center = _world ? _world.screenToWorld(
                            window.innerWidth / 2, window.innerHeight / 2
                        ) : { x: 0, y: 0 };
                        CanvasImages.place(ev.target.result, center.x, center.y, '粘贴', null);
                    };
                    reader.readAsDataURL(blob);
                    break;
                }
                if (items[i].type.indexOf('video') === 0) {
                    e.preventDefault();
                    var vblob = items[i].getAsFile();
                    var center = _world ? _world.screenToWorld(
                        window.innerWidth / 2, window.innerHeight / 2
                    ) : { x: 0, y: 0 };
                    CanvasImages.placeVideo(vblob, center.x, center.y, '粘贴');
                    break;
                }
                if (items[i].type.indexOf('audio') === 0) {
                    e.preventDefault();
                    var ablob = items[i].getAsFile();
                    var acenter = _world ? _world.screenToWorld(
                        window.innerWidth / 2, window.innerHeight / 2
                    ) : { x: 0, y: 0 };
                    CanvasImages.placeAudio(ablob, acenter.x, acenter.y, '粘贴');
                    break;
                }
            }
        });
    }

    // ========== 右键菜单 ==========
    function _showContextMenu(clientX, clientY, id) {
        _hideContextMenu();

        var menu = document.createElement('div');
        menu.className = 'ci-ctx-menu';
        menu.style.left = clientX + 'px';
        menu.style.top = clientY + 'px';
        menu.innerHTML =
            '<div class="ci-ctx-item" data-action="download">\u2B07\uFE0F 下载原图</div>' +
            '<div class="ci-ctx-item" data-action="copy">\u2398 复制到剪贴板</div>' +
            '<div class="ci-ctx-sep"></div>' +
            '<div class="ci-ctx-item ci-ctx-danger" data-action="delete">\u2715 删除</div>';

        document.body.appendChild(menu);
        _ctxMenu = menu;

        menu.addEventListener('click', function(e) {
            var el = e.target.closest('.ci-ctx-item');
            if (!el) return;
            var action = el.dataset.action;
            _hideContextMenu();

            if (action === 'download') {
                CanvasImages.download(id);
            } else if (action === 'delete') {
                CanvasImages.remove(id);
            } else if (action === 'copy') {
                _copyToClipboard(id);
            }
        });

        // 点击外部关闭
        setTimeout(function() {
            document.addEventListener('mousedown', _hideContextMenuOnce, { once: true });
        }, 0);
    }

    function _hideContextMenuOnce() {
        _hideContextMenu();
    }

    function _hideContextMenu() {
        if (_ctxMenu) {
            if (_ctxMenu.parentNode) _ctxMenu.parentNode.removeChild(_ctxMenu);
            _ctxMenu = null;
        }
    }

    function _copyToClipboard(id) {
        var item = _getItem(id);
        if (!item) return;
        try {
            var img = new Image();
            img.onload = function() {
                var canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                canvas.getContext('2d').drawImage(img, 0, 0);
                canvas.toBlob(function(blob) {
                    if (navigator.clipboard && navigator.clipboard.write) {
                        navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                        if (typeof showToast === 'function') showToast('已复制到剪贴板');
                    }
                }, 'image/png');
            };
            img.src = item.levels.display;
        } catch(e) {
            if (typeof showToast === 'function') showToast('复制失败');
        }
    }

    // ========== 世界事件 ==========
    /**
     * 按距视口中心远近排序（近的排前面，渲染优先级高）
     */
    function _sortItemsByDistanceToViewport() {
        if (!_world || _items.length <= 1) return;
        var state = _world.getState();
        var cx = (-state.offsetX / state.scale) + (window.innerWidth / 2 / state.scale);
        var cy = (-state.offsetY / state.scale) + (window.innerHeight / 2 / state.scale);
        _items.sort(function(a, b) {
            var dax = a.x + a.w / 2 - cx, day = a.y + a.h / 2 - cy;
            var dbx = b.x + b.w / 2 - cx, dby = b.y + b.h / 2 - cy;
            return (dax * dax + day * day) - (dbx * dbx + dby * dby);
        });
    }

    /**
     * 分批渲染：每批最多 BATCH_SIZE 条，用 requestAnimationFrame 让出主线程
     */
    var BATCH_SIZE = 5;
    function _renderBatch(startIdx) {
        var end = Math.min(startIdx + BATCH_SIZE, _items.length);
        for (var i = startIdx; i < end; i++) {
            _createItemElement(_items[i]);
        }
        _updateLOD();
        if (end < _items.length) {
            requestAnimationFrame(function() { _renderBatch(end); });
        }
    }

    function _onWorldTransform() {
        _scheduleLODUpdate();
        // 主动救图：若视口里一张图都没有（如缩放到图片间隙、把画布拖飞），请求 world 回弹到有图处。
        // 用防抖：缩放/平移进行中每帧都重置定时器，停止 220ms 后才检查——避免回弹动画与正在进行的
        // 缩放/平移抢 offset 导致抖动；且回弹中(isBouncing)不再重复请求，避免递归。
        if (_bounceCheckTimer) clearTimeout(_bounceCheckTimer);
        _bounceCheckTimer = setTimeout(function() {
            try {
                if (_world && typeof _world.bounceToContent === 'function' && typeof _world.isBouncing === 'function' && !_world.isBouncing()) {
                    var vb = _world.getVisibleBounds();
                    if (!anyItemInRect(vb)) _world.bounceToContent();
                }
            } catch (e) {}
        }, 220);
    }

    function _onWorldMousedown(data) {
        // 空格 + 左键 → 启动框选（已在任意位置触发，含图片上方）
        if (data.button === 0 && data.boxSelect) {
            var worldEl = document.getElementById('cos-world');
            var rect = worldEl ? worldEl.getBoundingClientRect() : { left: 0, top: 0 };
            _startSelectBox(data.screenX + rect.left, data.screenY + rect.top, !!data.shiftKey);
        }
    }

    // 左键单击空白（未拖动画布）→ 取消选中
    function _onWorldClickBlank() {
        _deselect();
    }

    // ========== 激光删除 ==========
    function _onLaserDelete(data) {
        var el = data.element;
        if (!el || !el.dataset || !el.dataset.id) return;
        var id = el.dataset.id;
        // world.js 已移除 DOM，这里只需清理内部状态
        var item = _getItem(id);
        if (!item) return;
        _items = _items.filter(function(it) { return it.id !== id; });
        delete _elements[id];
        if (item.type === 'video' && item.videoUrl) {
            URL.revokeObjectURL(item.videoUrl);
        } else if (item.type === 'audio' && item.audioUrl) {
            // 停止音频播放
            var ad = _elements[id];
            if (ad && ad.audioEl) { ad.audioEl.pause(); ad.audioEl.src = ''; }
            URL.revokeObjectURL(item.audioUrl);
        } else if (item.originalKey) {
            _deleteOriginal(item.originalKey);
        }
        _deleteItemMeta(id);
        if (_selected[id]) { delete _selected[id]; if (_primaryId === id) _primaryId = _firstSelectedId(); }
    }

    // ========== 公开 API ==========

    function init(world) {
        _world = world;
        _layer = world.getLayer();

        _injectStyles();
        _injectHints();

        // 打开 IndexedDB 并加载已有数据
        _openDB().then(function() {
            return _loadAll();
        }).then(function() {
            // 按距视口中心远近排序，近的先渲染
            _sortItemsByDistanceToViewport();
            // 分批渲染，避免主线程长时间阻塞
            _renderBatch(0);
        }).catch(function(e) {
            console.error('[CanvasImages] 初始化失败:', e);
        });

        // 注册世界事件
        world.on('transform', _onWorldTransform);
        world.on('mousedown', _onWorldMousedown);
        world.on('click-blank', _onWorldClickBlank);
        world.on('laser-delete', _onLaserDelete);

        // 全局拖拽事件（共享）
        document.addEventListener('mousemove', _onDocMouseMove);
        document.addEventListener('mouseup', _onDocMouseUp);

        // 文件拖放 + 粘贴
        _registerFileDrop();
        _registerPaste();

        // HUD 下载菜单
        _initHudMenu();

        // 窗口大小变化 → 重新裁剪
        window.addEventListener('resize', function() { _scheduleLODUpdate(); });
    }

    // ========== 视频支持 ==========

    function placeVideo(file, optX, optY, optSource) {
        var url = URL.createObjectURL(file);
        var id = 'cv_' + Date.now() + '_' + (++_placeCounter);

        // 用 video 元素获取尺寸
        var probe = document.createElement('video');
        probe.muted = true;
        probe.preload = 'metadata';
        probe.src = url;

        probe.onloadedmetadata = function() {
            var vw = probe.videoWidth || 640;
            var vh = probe.videoHeight || 480;

            // 归一化到画布尺寸
            var maxSide = Math.max(vw, vh);
            var sc = Math.min(DEFAULT_WORLD_SIZE / maxSide, 1);
            var worldW = Math.max(1, Math.round(vw * sc));
            var worldH = Math.max(1, Math.round(vh * sc));

            // 位置
            var x, y;
            if (optX != null && optY != null) {
                x = optX; y = optY;
            } else {
                var c = _world.screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
                x = c.x - worldW / 2;
                y = c.y - worldH / 2;
            }

            var item = {
                id: id,
                type: 'video',
                name: file.name || ('视频 ' + new Date().toLocaleTimeString()),
                source: optSource || '',
                parentId: null,
                x: x, y: y, w: worldW, h: worldH,
                origW: vw, origH: vh,
                videoUrl: url,
                videoFile: file,
                time: Date.now()
            };

            _items.push(item);
            _createVideoElement(item);

            if (_world) _world.markContent(x, y, worldW, worldH);
            _updateLOD();
        };
        probe.onerror = function() {
            if (typeof showToast === 'function') showToast('视频加载失败');
            URL.revokeObjectURL(url);
        };

        return id;
    }

    function _createVideoElement(item) {
        var el = document.createElement('div');
        el.className = 'ci-item';
        el.dataset.id = item.id;
        el.setAttribute('data-cos-deletable', '');
        el.style.left = item.x + 'px';
        el.style.top = item.y + 'px';
        el.style.width = item.w + 'px';
        el.style.height = item.h + 'px';

        var wrap = document.createElement('div');
        wrap.className = 'ci-video-wrap';

        var videoEl = document.createElement('video');
        videoEl.className = 'ci-video';
        videoEl.src = item.videoUrl;
        videoEl.loop = true;
        videoEl.preload = 'metadata';
        videoEl.draggable = false;
        // 不自动播放，点击才播放
        wrap.appendChild(videoEl);

        el.appendChild(wrap);

        // 批量选择复选框
        var checkBtn = document.createElement('div');
        checkBtn.className = 'ci-batch-check';
        checkBtn.addEventListener('mousedown', function(e) {
            e.stopPropagation();
            e.preventDefault();
            _toggleSel(item.id);
        });
        el.appendChild(checkBtn);

        // 删除按钮
        var delBtn = document.createElement('button');
        delBtn.className = 'ci-del';
        delBtn.textContent = '\u2715';
        delBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            CanvasImages.remove(item.id);
        });
        el.appendChild(delBtn);

        // 来源标签
        if (item.source) {
            var srcBadge = document.createElement('div');
            srcBadge.className = 'ci-badge';
            srcBadge.textContent = item.source;
            el.appendChild(srcBadge);
        }

        // 选中状态
        if (_selected[item.id]) {
            el.classList.add('ci-selected');
        }

        // 视频点击播放/暂停
        videoEl.addEventListener('click', function(e) {
            e.stopPropagation();
            if (videoEl.paused) {
                videoEl.play();
            } else {
                videoEl.pause();
            }
        });

        // 拖拽 + 选中
        _makeDraggable(el, item);

        _layer.appendChild(el);
        _elements[item.id] = { el: el, imgEl: videoEl, currentLevel: 'video' };

        return el;
    }

    // ========== 音频支持 ==========

    // 当前正在播放的音频 id（同一时间只允许一个播放）
    var _currentAudioId = null;

    function _stopCurrentAudio() {
        if (!_currentAudioId) return;
        var prev = _elements[_currentAudioId];
        if (prev && prev.audioEl) {
            prev.audioEl.pause();
            prev.audioEl.currentTime = 0;
        }
        if (prev && prev.el) {
            var oldIcon = prev.el.querySelector('.ci-audio-icon');
            if (oldIcon) oldIcon.textContent = '🎵';
        }
        _currentAudioId = null;
    }

    function placeAudio(file, optX, optY, optSource) {
        var url = URL.createObjectURL(file);
        var id = 'ca_' + Date.now() + '_' + (++_placeCounter);

        // 固定卡片尺寸（正方形，渲染为圆形）
        var worldW = 80;
        var worldH = 80;

        // 位置
        var x, y;
        if (optX != null && optY != null) {
            x = optX; y = optY;
        } else {
            var c = _world.screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
            x = c.x - worldW / 2;
            y = c.y - worldH / 2;
        }

        var item = {
            id: id,
            type: 'audio',
            name: file.name || ('音频 ' + new Date().toLocaleTimeString()),
            source: optSource || '',
            parentId: null,
            x: x, y: y, w: worldW, h: worldH,
            origW: worldW, origH: worldH,
            audioUrl: url,
            audioFile: file,
            time: Date.now()
        };

        _items.push(item);
        _createAudioElement(item);

        if (_world) _world.markContent(x, y, worldW, worldH);

        return id;
    }

    /**
     * 返回画布上所有音频项的来源信息（供音频剪辑插件"从画布导入"使用）
     * @returns {Array<{id:string,name:string,url:string,file:File|null}>}
     */
    function getAudioSources() {
        var out = [];
        for (var i = 0; i < _items.length; i++) {
            var it = _items[i];
            if (it.type === 'audio' && it.audioUrl) {
                out.push({ id: it.id, name: it.name || '音频', url: it.audioUrl, file: it.audioFile || null });
            }
        }
        return out;
    }

    function _createAudioElement(item) {
        var el = document.createElement('div');
        el.className = 'ci-item';
        el.dataset.id = item.id;
        el.setAttribute('data-cos-deletable', '');
        el.style.left = item.x + 'px';
        el.style.top = item.y + 'px';
        el.style.width = item.w + 'px';
        el.style.height = item.h + 'px';

        var wrap = document.createElement('div');
        wrap.className = 'ci-audio-wrap';

        // 播放图标
        var icon = document.createElement('div');
        icon.className = 'ci-audio-icon';
        icon.textContent = '🎵';
        wrap.appendChild(icon);

        el.appendChild(wrap);

        // 批量选择复选框
        var checkBtn = document.createElement('div');
        checkBtn.className = 'ci-batch-check';
        checkBtn.addEventListener('mousedown', function(e) {
            e.stopPropagation();
            e.preventDefault();
            _toggleSel(item.id);
        });
        el.appendChild(checkBtn);

        // 删除按钮
        var delBtn = document.createElement('button');
        delBtn.className = 'ci-del';
        delBtn.textContent = '\u2715';
        delBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            CanvasImages.remove(item.id);
        });
        el.appendChild(delBtn);

        // 来源标签
        if (item.source) {
            var srcBadge = document.createElement('div');
            srcBadge.className = 'ci-badge';
            srcBadge.textContent = item.source;
            el.appendChild(srcBadge);
        }

        // 选中状态
        if (_selected[item.id]) {
            el.classList.add('ci-selected');
        }

        // 音频元素（不挂载到 DOM，仅用于播放控制）
        var audioEl = new Audio(item.audioUrl);
        audioEl.loop = true;   // 默认循环播放

        // 点击播放/暂停（同一时间只允许一个播放）
        wrap.addEventListener('click', function(e) {
            e.stopPropagation();
            if (_currentAudioId === item.id) {
                // 当前正在播放 → 暂停
                audioEl.pause();
                icon.textContent = '🎵';
                _currentAudioId = null;
            } else {
                // 停止之前的播放
                _stopCurrentAudio();
                // 播放当前
                audioEl.play();
                icon.textContent = '⏸';
                _currentAudioId = item.id;
            }
        });

        // 拖拽 + 选中
        _makeDraggable(el, item);

        _layer.appendChild(el);
        _elements[item.id] = { el: el, imgEl: null, currentLevel: 'audio', audioEl: audioEl };

        return el;
    }

    function getSelectedVideo() {
        var id = _primaryId || _firstSelectedId();
        if (!id) return null;
        var item = _getItem(id);
        if (!item || item.type !== 'video') return null;
        return {
            id: item.id,
            url: item.videoUrl,
            file: item.videoFile,
            name: item.name,
            width: item.origW,
            height: item.origH
        };
    }

    function place(dataURL, optX, optY, optSource, optParentId) {
        return new Promise(function(resolve, reject) {
            _generateLevels(dataURL).then(function(result) {
                var id = 'ci_' + Date.now() + '_' + (++_placeCounter);
                var origKey = 'orig_' + id;

                // 计算世界坐标尺寸（归一化到 DEFAULT_WORLD_SIZE）
                var maxSide = Math.max(result.origW, result.origH);
                var sc = Math.min(DEFAULT_WORLD_SIZE / maxSide, 1);
                var worldW = Math.max(1, Math.round(result.origW * sc));
                var worldH = Math.max(1, Math.round(result.origH * sc));

                // 位置计算
                var x, y;
                if (optX != null && optY != null) {
                    x = optX;
                    y = optY;
                } else if (optParentId) {
                    var parent = _getItem(optParentId);
                    if (parent) {
                        x = parent.x + parent.w + PLACE_OFFSET * 2;
                        y = parent.y;
                    } else {
                        var c = _world.screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
                        x = c.x - worldW / 2;
                        y = c.y - worldH / 2;
                    }
                } else {
                    var c = _world.screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
                    x = c.x - worldW / 2 + (_placeCounter * PLACE_OFFSET) % 100;
                    y = c.y - worldH / 2 + (_placeCounter * PLACE_OFFSET) % 100;
                }

                var item = {
                    id: id,
                    name: (optSource || '图片') + ' ' + new Date().toLocaleTimeString(),
                    source: optSource || '',
                    parentId: optParentId || null,
                    x: x, y: y, w: worldW, h: worldH,
                    origW: result.origW, origH: result.origH,
                    levels: result.levels,
                    originalKey: origKey,
                    time: Date.now()
                };

                _items.push(item);
                _createItemElement(item);
                _saveItem(item);
                _saveOriginal(origKey, result.original);

                if (_world) _world.markContent(x, y, worldW, worldH);
                _updateLOD();
                resolve(id);
            }).catch(function(e) {
                console.error('[CanvasImages] place 失败:', e);
                reject(e);
            });
        });
    }

    function remove(id) {
        var item = _getItem(id);
        if (!item) return;

        _items = _items.filter(function(it) { return it.id !== id; });

        var elData = _elements[id];
        if (elData) {
            // 音频类型：停止播放
            if (elData.audioEl) {
                elData.audioEl.pause();
                elData.audioEl.src = '';
            }
            if (elData.el.parentNode) {
                elData.el.parentNode.removeChild(elData.el);
            }
        }
        delete _elements[id];

        // 如果删除的是当前播放的音频，清除标记
        if (_currentAudioId === id) _currentAudioId = null;

        // 视频类型：释放 object URL
        if (item.type === 'video' && item.videoUrl) {
            URL.revokeObjectURL(item.videoUrl);
        } else if (item.type === 'audio' && item.audioUrl) {
            URL.revokeObjectURL(item.audioUrl);
        } else if (item.originalKey) {
            _deleteOriginal(item.originalKey);
        }
        _deleteItemMeta(id);

        if (_selected[id]) { delete _selected[id]; if (_primaryId === id) _primaryId = _firstSelectedId(); }
    }

    function getSelected(level) {
        var id = _primaryId || _firstSelectedId();
        if (!id) return null;
        var item = _getItem(id);
        if (!item || !item.levels) return null;
        level = level || 'display';
        if (level === 'original') {
            console.warn('[CanvasImages] getSelected("original") 是异步的，请用 getSelectedOriginal()');
            return null;
        }
        return item.levels[level] || item.levels.display;
    }

    function getSelectedId() {
        return _primaryId || _firstSelectedId();
    }

    // 按 id 取内部 item（含 x/y/w/h 等坐标），供外部在生成后把结果图落回原位
    function getById(id) {
        return _getItem(id) || null;
    }

    // 计算所有图片的世界坐标包围盒（供画布限制边界、避免平移丢图）
    function getBounds() {
        if (!_items.length) return null;
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (var i = 0; i < _items.length; i++) {
            var it = _items[i];
            if (it.x < minX) minX = it.x;
            if (it.y < minY) minY = it.y;
            if (it.x + it.w > maxX) maxX = it.x + it.w;
            if (it.y + it.h > maxY) maxY = it.y + it.h;
        }
        return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
    }

    // 判断是否有任意图片与给定世界矩形相交（用于缩放后判断是否"视口里一张图都没有"）
    function anyItemInRect(b) {
        if (!_items.length) return false;
        for (var i = 0; i < _items.length; i++) {
            var it = _items[i];
            if (it.x + it.w >= b.left && it.x <= b.right &&
                it.y + it.h >= b.top && it.y <= b.bottom) return true;
        }
        return false;
    }

    // 返回离世界坐标 (x,y) 最近的图片中心（供 world 回弹时选目标，避免回弹到无图空隙）
    function nearestItemCenter(x, y) {
        if (!_items.length) return null;
        var best = null, bestD = Infinity;
        for (var i = 0; i < _items.length; i++) {
            var it = _items[i];
            var ccx = it.x + it.w / 2, ccy = it.y + it.h / 2;
            var d = (ccx - x) * (ccx - x) + (ccy - y) * (ccy - y);
            if (d < bestD) { bestD = d; best = { x: ccx, y: ccy }; }
        }
        return best;
    }

    // 返回所有选中图片 id（含视频/音频）
    function getSelectedIds() {
        return Object.keys(_selected);
    }

    // 返回所有选中「图片」的 dataURL 列表（跳过视频/音频）
    function getSelectedList(level) {
        level = level || 'display';
        var out = [];
        for (var id in _selected) {
            var item = _getItem(id);
            if (item && item.levels) {
                out.push({ id: id, dataURL: item.levels[level] || item.levels.display });
            }
        }
        return out;
    }

    function getSelectedOriginal() {
        var id = _primaryId || _firstSelectedId();
        if (!id) return Promise.resolve(null);
        var item = _getItem(id);
        if (!item) return Promise.resolve(null);
        return _getOriginal(item.originalKey);
    }

    function download(id) {
        var item = _getItem(id);
        if (!item) return;
        // 音频项：直接下载音频文件（不经过图片原图缓存）
        if (item.type === 'audio' && item.audioUrl) {
            _downloadAudioBlob(item);
            return;
        }
        _getOriginal(item.originalKey).then(function(dataURL) {
            if (!dataURL) {
                if (typeof showToast === 'function') showToast('原图加载失败');
                return;
            }
            var a = document.createElement('a');
            a.href = dataURL;
            a.download = (item.name || 'image') + '.png';
            a.click();
        });
    }

    /** 从画布音频项下载音频文件（blob URL → 下载） */
    function _downloadAudioBlob(item) {
        if (!item.audioUrl) {
            if (typeof showToast === 'function') showToast('音频已失效，请重新导入');
            return;
        }
        fetch(item.audioUrl).then(function(r) { return r.blob(); }).then(function(blob) {
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = (item.name || 'audio') + _guessAudioExt(item.name, blob.type);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
        }).catch(function() {
            if (typeof showToast === 'function') showToast('音频导出失败');
        });
    }

    /** 从文件名 / MIME 猜测音频扩展名 */
    function _guessAudioExt(name, mime) {
        if (name) {
            var m = /\.([a-z0-9]+)$/i.exec(name);
            if (m) {
                var e = m[1].toLowerCase();
                if (e === 'jpeg' || e === 'jpg') e = 'jpg';
                return '.' + e;
            }
        }
        if (mime) {
            var mm = /audio\/([\w-]+)/.exec(mime);
            if (mm) {
                var t = mm[1].toLowerCase();
                if (t === 'mpeg') return '.mp3';
                if (t === 'x-wav' || t === 'wav') return '.wav';
                if (t === 'ogg') return '.ogg';
                if (t === 'mp4' || t === 'aac' || t === 'x-m4a') return '.m4a';
                if (t === 'webm') return '.weba';
                return '.' + t;
            }
        }
        return '.wav';
    }

    function getAll() {
        return _items.map(function(item) {
            return {
                id: item.id, name: item.name, source: item.source,
                parentId: item.parentId,
                x: item.x, y: item.y, w: item.w, h: item.h,
                origW: item.origW, origH: item.origH, time: item.time
            };
        });
    }

    function clear() {
        for (var id in _elements) {
            var ed = _elements[id];
            if (ed.audioEl) { ed.audioEl.pause(); ed.audioEl.src = ''; }
            if (ed.el && ed.el.parentNode) {
                ed.el.parentNode.removeChild(ed.el);
            }
        }
        _elements = {};
        _items.forEach(function(item) {
            if (item.type === 'video' && item.videoUrl) {
                URL.revokeObjectURL(item.videoUrl);
            } else if (item.type === 'audio' && item.audioUrl) {
                URL.revokeObjectURL(item.audioUrl);
            } else if (item.originalKey) {
                _deleteOriginal(item.originalKey);
            }
        });
        _items = [];
        _selected = {};
        _primaryId = null;
        _currentAudioId = null;
        // 逐条删除（IndexedDB 无 clearAll 时用 cursor）
        try {
            var tx = _db.transaction(META_STORE, 'readwrite');
            tx.objectStore(META_STORE).clear();
        } catch(e) {}
    }

    // ========== HUD 下载（作用于当前选中） ==========

    var _selectBox = null;          // 框选状态 { startClientX, startClientY, el, additive, active }

    function _initHudMenu() {
        var btn = document.getElementById('cos-btn-download');
        if (!btn) return;

        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            _downloadSelection();
        });
    }

    /**
     * 下载当前选中的图片：
     *   - 已选 1 张 → 直接下载原图
     *   - 已选多张 → ZIP 打包
     *   - 未选中   → 打包下载画布全部图片
     */
    function _downloadSelection() {
        var ids = Object.keys(_selected);
        if (ids.length === 0) {
            if (_items.length === 0) {
                if (typeof showToast === 'function') showToast('画布上没有图片');
                return;
            }
            _downloadAsZip(_items.slice(), '画布全部图片');
            return;
        }
        var list = ids.map(function(id) { return _getItem(id); }).filter(function(it) { return !!it; });
        if (list.length === 0) return;
        if (list.length === 1) {
            CanvasImages.download(list[0].id);
            return;
        }
        _downloadAsZip(list, '批量下载');
    }

    // ========== 框选矩形（默认交互，写入统一选择集合 _selected） ==========

    function _startSelectBox(clientX, clientY, additive) {
        _endSelectBox(); // 清理残留
        var box = document.createElement('div');
        box.className = 'ci-select-box';
        box.style.left = clientX + 'px';
        box.style.top = clientY + 'px';
        box.style.width = '0px';
        box.style.height = '0px';
        document.body.appendChild(box);

        _selectBox = {
            startClientX: clientX,
            startClientY: clientY,
            el: box,
            active: true,
            additive: !!additive
        };

        // 非追加模式：立即清空已选（实现"点空白取消选中"）
        if (!additive) {
            _deselect();
        }
    }

    function _updateSelectBox(clientX, clientY) {
        if (!_selectBox || !_selectBox.active) return;

        var x = Math.min(_selectBox.startClientX, clientX);
        var y = Math.min(_selectBox.startClientY, clientY);
        var w = Math.abs(clientX - _selectBox.startClientX);
        var h = Math.abs(clientY - _selectBox.startClientY);

        _selectBox.el.style.left = x + 'px';
        _selectBox.el.style.top = y + 'px';
        _selectBox.el.style.width = w + 'px';
        _selectBox.el.style.height = h + 'px';

        // 实时检测哪些图片在框内
        if (w > 3 || h > 3) {
            _selectInBox(x, y, w, h);
        }
    }

    function _selectInBox(screenX, screenY, screenW, screenH) {
        if (!_world) return;

        // 屏幕坐标 → 世界坐标
        var tl = _world.screenToWorld(screenX, screenY);
        var br = _world.screenToWorld(screenX + screenW, screenY + screenH);

        // 非追加模式：先清空（每次移动重新计算框内内容）
        if (!_selectBox.additive) {
            _selected = {};
        }

        for (var i = 0; i < _items.length; i++) {
            var item = _items[i];
            // 矩形相交检测
            if (item.x + item.w >= tl.x && item.x <= br.x &&
                item.y + item.h >= tl.y && item.y <= br.y) {
                _selected[item.id] = true;
                _primaryId = item.id;
            }
        }
        _refreshSelUI();
    }

    function _endSelectBox() {
        if (!_selectBox) return;
        _selectBox.active = false;
        if (_selectBox.el && _selectBox.el.parentNode) {
            _selectBox.el.parentNode.removeChild(_selectBox.el);
        }
        _selectBox = null;
    }

    /**
     * 将图片列表打包成 ZIP 下载
     * @param {Array} items  - 图片元数据数组
     * @param {string} label - ZIP 文件名标签
     * @param {Function} [onDone] - 完成回调
     */
    function _downloadAsZip(items, label, onDone) {
        if (items.length === 0) return;
        if (typeof showToast === 'function') showToast('正在打包 ' + items.length + ' 个素材...');

        // 无 JSZip → 逐张下载兜底
        if (typeof JSZip === 'undefined') {
            _downloadIndividually(items, onDone);
            return;
        }

        var zip = new JSZip();
        var usedNames = {}; // 去重文件名
        var pending = items.length;
        var failed = 0;

        // 把单个画布项加入 ZIP（图片走原图缓存，音频走 blob URL）
        function _addItemToZip(item, i) {
            return new Promise(function(resolve) {
                if (item.type === 'audio' && item.audioUrl) {
                    fetch(item.audioUrl).then(function(r) { return r.blob(); }).then(function(blob) {
                        var name = (item.name || ('audio_' + (i + 1)));
                        var ext = _guessAudioExt(item.name, blob.type);
                        var fname = name + ext, n = 1;
                        while (usedNames[fname]) { fname = name + '_' + (n++) + ext; }
                        usedNames[fname] = true;
                        zip.file(fname, blob);
                        resolve(true);
                    }).catch(function() { resolve(false); });
                    return;
                }
                _getOriginal(item.originalKey).then(function(dataURL) {
                    if (dataURL) {
                        // dataURL → Uint8Array
                        var base64 = dataURL.split(',')[1];
                        var bin = atob(base64);
                        var buf = new Uint8Array(bin.length);
                        for (var j = 0; j < bin.length; j++) buf[j] = bin.charCodeAt(j);

                        // 生成唯一文件名
                        var name = (item.name || ('image_' + (i + 1)));
                        var ext = _guessExt(dataURL);
                        var fname = name + ext;
                        var n = 1;
                        while (usedNames[fname]) { fname = name + '_' + (n++) + ext; }
                        usedNames[fname] = true;

                        zip.file(fname, buf);
                        resolve(true);
                    } else {
                        resolve(false);
                    }
                }).catch(function() { resolve(false); });
            });
        }

        items.forEach(function(item, i) {
            _addItemToZip(item, i).then(function(ok) {
                if (!ok) failed++;
                if (--pending === 0) _finalizeZip();
            });
        });

        function _finalizeZip() {
            var ok = items.length - failed;
            if (ok === 0) {
                if (typeof showToast === 'function') showToast('打包失败：无有效图片');
                if (onDone) onDone();
                return;
            }
            zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }).then(function(blob) {
                var link = document.createElement('a');
                var ts = new Date();
                var stamp = ts.getFullYear() +
                    String(ts.getMonth() + 1).padStart(2, '0') +
                    String(ts.getDate()).padStart(2, '0') + '_' +
                    String(ts.getHours()).padStart(2, '0') +
                    String(ts.getMinutes()).padStart(2, '0');
                link.download = label + '_' + stamp + '.zip';
                link.href = URL.createObjectURL(blob);
                link.click();
                URL.revokeObjectURL(link.href);
                if (typeof showToast === 'function') showToast('已打包下载 ' + ok + ' 张图片' + (failed ? '（' + failed + ' 张失败）' : ''));
                if (onDone) onDone();
            });
        }
    }

    /** 逐张下载兜底（无 JSZip 时使用） */
    function _downloadIndividually(items, onDone) {
        if (typeof showToast === 'function') showToast('逐张下载 ' + items.length + ' 个素材...');
        var idx = 0;
        function next() {
            if (idx >= items.length) {
                if (typeof showToast === 'function') showToast('下载完成');
                if (onDone) onDone();
                return;
            }
            var item = items[idx++];
            if (item.type === 'audio' && item.audioUrl) {
                _downloadAudioBlob(item);
                setTimeout(next, 300);
                return;
            }
            _getOriginal(item.originalKey).then(function(dataURL) {
                if (dataURL) {
                    var a = document.createElement('a');
                    a.href = dataURL;
                    a.download = (item.name || 'image_' + idx) + _guessExt(dataURL);
                    a.click();
                }
                setTimeout(next, 300);
            });
        }
        next();
    }

    /** 从 dataURL 猜测扩展名 */
    function _guessExt(dataURL) {
        if (!dataURL) return '.png';
        var m = dataURL.match(/^data:image\/(\w+)/);
        return m ? '.' + m[1].replace('jpeg', 'jpg') : '.png';
    }

    // ========== 返回 ==========
    return {
        init: init,
        place: place,
        placeVideo: placeVideo,
        placeAudio: placeAudio,
        getAudioSources: getAudioSources,
        remove: remove,
        getSelected: getSelected,
        getSelectedId: getSelectedId,
        getById: getById,
        getBounds: getBounds,
        anyItemInRect: anyItemInRect,
        nearestItemCenter: nearestItemCenter,
        getSelectedIds: getSelectedIds,
        getSelectedList: getSelectedList,
        getSelectedOriginal: getSelectedOriginal,
        getSelectedVideo: getSelectedVideo,
        download: download,
        getAll: getAll,
        clear: clear
    };
})();
