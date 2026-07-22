/**
 * 画境 v67 - 游戏世界引擎
 * 画布即世界，技能即能力
 */
var GameWorld = (function() {

    var CHUNK_SIZE = 2000;
    var GRID_SMALL = 50;
    var GRID_BIG = 250;
    var MIN_SCALE = 0.05;
    var MAX_SCALE = 8;

    var worldEl = null;
    var layerEl = null;
    var gridCanvas = null;
    var gridCtx = null;
    var gridVisible = true;

    // 激光切割状态
    var laser = { active: false, path: [], svg: null, line: null };

    var state = {
        offsetX: 0, offsetY: 0, scale: 1,
        isPanning: false,
        panStartX: 0, panStartY: 0,
        panStartOffsetX: 0, panStartOffsetY: 0,
        contentBounds: null,
        mouseWorldX: 0, mouseWorldY: 0,
        mouseScreenX: 0, mouseScreenY: 0,
        _pendingBlankClick: false   // 左键空白按下但可能只是单击（未拖动）→ 松手时取消选中
    };

    var chunks = {};
    var listeners = {}; // 事件监听
    var _panEnabled = true; // 左键空白拖拽开关（批量选图时关闭）

    // === 初始化 ===
    function init(worldContainer) {
        worldEl = worldContainer;

        gridCanvas = document.createElement('canvas');
        gridCanvas.className = 'cos-grid-canvas';
        worldEl.insertBefore(gridCanvas, worldEl.firstChild);
        gridCtx = gridCanvas.getContext('2d');

        layerEl = document.createElement('div');
        layerEl.className = 'cos-world-layer';
        worldEl.appendChild(layerEl);

        resize();
        drawGrid();
        setupEvents();
    }

    function resize() {
        if (!gridCanvas) return;
        gridCanvas.width = worldEl.clientWidth;
        gridCanvas.height = worldEl.clientHeight;
        drawGrid();
    }

    function getLayer() { return layerEl; }

    // === 事件系统 ===
    function on(event, fn) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(fn);
    }

    function off(event, fn) {
        if (!listeners[event]) return;
        listeners[event] = listeners[event].filter(function(f) { return f !== fn; });
    }

    function emit(event, data) {
        if (!listeners[event]) return;
        listeners[event].forEach(function(fn) {
            try { fn(data); } catch(e) { console.error('Event error:', event, e); }
        });
    }

    // === 分区域 ===
    function getChunkCoord(wx, wy) {
        return { cx: Math.floor(wx / CHUNK_SIZE), cy: Math.floor(wy / CHUNK_SIZE) };
    }

    function markContent(wx, wy, w, h) {
        var sc = getChunkCoord(wx, wy);
        var ec = getChunkCoord(wx + w, wy + h);
        for (var cx = sc.cx; cx <= ec.cx; cx++)
            for (var cy = sc.cy; cy <= ec.cy; cy++) {
                var k = cx + ',' + cy;
                if (!chunks[k]) chunks[k] = {};
                chunks[k].hasContent = true;
            }
        updateBounds();
    }

    function clearContent(wx, wy, w, h) {
        var sc = getChunkCoord(wx, wy);
        var ec = getChunkCoord(wx + w, wy + h);
        for (var cx = sc.cx; cx <= ec.cx; cx++)
            for (var cy = sc.cy; cy <= ec.cy; cy++) {
                var k = cx + ',' + cy;
                if (chunks[k]) chunks[k].hasContent = false;
            }
        updateBounds();
    }

    function updateBounds() {
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        var has = false;
        for (var k in chunks) {
            if (chunks[k].hasContent) {
                has = true;
                var p = k.split(',');
                var cx = +p[0], cy = +p[1];
                minX = Math.min(minX, cx * CHUNK_SIZE);
                minY = Math.min(minY, cy * CHUNK_SIZE);
                maxX = Math.max(maxX, (cx + 1) * CHUNK_SIZE);
                maxY = Math.max(maxY, (cy + 1) * CHUNK_SIZE);
            }
        }
        state.contentBounds = has ? { minX: minX, minY: minY, maxX: maxX, maxY: maxY } : null;
    }

    // 优先用 CanvasImages 的精确包围盒，兜底用 chunk 边界
    function _getContentBounds() {
        if (typeof CanvasImages !== 'undefined' && CanvasImages.getBounds) {
            var b = CanvasImages.getBounds();
            if (b) return b;
        }
        return state.contentBounds;
    }

    function shouldBounce() {
        var cb = _getContentBounds();
        if (!cb) return false;
        var b = getVisibleBounds();
        var il = Math.max(b.left, cb.minX), it = Math.max(b.top, cb.minY);
        var ir = Math.min(b.right, cb.maxX), ib = Math.min(b.bottom, cb.maxY);
        // 1) 内容完全出画 → 回弹
        if (ir <= il || ib <= it) return true;
        // 2) 内容比视口小：若内容中心已漂出视口（含少量边距）→ 回弹，
        //    避免把小图拖飞/缩丢后找不回；大图(比视口大)只在完全出画才回弹，平移不打架
        var cw = cb.maxX - cb.minX, ch = cb.maxY - cb.minY;
        var vw = b.right - b.left, vh = b.bottom - b.top;
        if (cw < vw && ch < vh) {
            var ccx = (cb.minX + cb.maxX) / 2, ccy = (cb.minY + cb.maxY) / 2;
            var M = 40; // 世界单位边距
            if (ccx < b.left - M || ccx > b.right + M || ccy < b.top - M || ccy > b.bottom + M) return true;
        }
        return false;
    }

    // 回弹防递归标志：回弹动画进行中时，canvas-images 不应再次请求回弹
    var _bouncing = false;
    function isBouncing() { return _bouncing; }

    function bounceToContent() {
        var cb = _getContentBounds();
        if (!cb) return;
        var cx = (cb.minX + cb.maxX) / 2, cy = (cb.minY + cb.maxY) / 2;
        // 若包围盒中心落在无图空隙，改为回弹到离中心最近的图片中心，确保回弹后视口里至少有一张图
        if (typeof CanvasImages !== 'undefined' && CanvasImages.nearestItemCenter) {
            var near = CanvasImages.nearestItemCenter(cx, cy);
            if (near) { cx = near.x; cy = near.y; }
        }
        _bouncing = true;
        animateTo(
            worldEl.clientWidth / 2 - cx * state.scale,
            worldEl.clientHeight / 2 - cy * state.scale,
            state.scale, 400,
            function() { _bouncing = false; }
        );
    }

    function animateTo(tx, ty, ts, dur, onDone) {
        var sx = state.offsetX, sy = state.offsetY, ss = state.scale;
        var st = performance.now();
        function step(t) {
            var p = Math.min((t - st) / dur, 1);
            var e = 1 - Math.pow(1 - p, 3);
            state.offsetX = sx + (tx - sx) * e;
            state.offsetY = sy + (ty - sy) * e;
            state.scale = ss + (ts - ss) * e;
            applyTransform();
            drawGrid();
            if (p < 1) requestAnimationFrame(step);
            else { emit('transform', getState()); if (onDone) onDone(); }
        }
        requestAnimationFrame(step);
    }

    // === 网格 ===
    function drawGrid() {
        if (!gridCtx || !gridVisible) return;
        var w = gridCanvas.width, h = gridCanvas.height, ctx = gridCtx;
        ctx.clearRect(0, 0, w, h);

        var sg = GRID_SMALL * state.scale, bg = GRID_BIG * state.scale;
        if (sg < 4) return;

        // 小网格
        if (sg > 8) {
            ctx.strokeStyle = 'rgba(255,220,180,0.025)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            var sx = state.offsetX % sg, sy = state.offsetY % sg;
            for (var x = sx; x < w; x += sg) { ctx.moveTo(Math.round(x) + .5, 0); ctx.lineTo(Math.round(x) + .5, h); }
            for (var y = sy; y < h; y += sg) { ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(w, Math.round(y) + .5); }
            ctx.stroke();
        }

        // 大网格
        if (bg > 15) {
            ctx.strokeStyle = 'rgba(255,220,180,0.05)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            var bsx = state.offsetX % bg, bsy = state.offsetY % bg;
            for (var x = bsx; x < w; x += bg) { ctx.moveTo(Math.round(x) + .5, 0); ctx.lineTo(Math.round(x) + .5, h); }
            for (var y = bsy; y < h; y += bg) { ctx.moveTo(0, Math.round(y) + .5); ctx.lineTo(w, Math.round(y) + .5); }
            ctx.stroke();
        }

        // 原点
        var ox = state.offsetX, oy = state.offsetY;
        if (ox > -20 && ox < w + 20 && oy > -20 && oy < h + 20) {
            ctx.strokeStyle = 'rgba(240,160,80,0.25)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(ox - 8, oy); ctx.lineTo(ox + 8, oy);
            ctx.moveTo(ox, oy - 8); ctx.lineTo(ox, oy + 8);
            ctx.stroke();
        }
    }

    // === 事件 ===
    function setupEvents() {
        var spaceDown = false;
        var _handlers = {};

        _handlers.keydown = function(e) {
            if (e.code === 'Space' && !e.target.closest('.ne-node-textarea')) {
                e.preventDefault();
                spaceDown = true;
                worldEl.style.cursor = 'grab';
            }
            if (e.code === 'Escape') emit('escape');
        };
        document.addEventListener('keydown', _handlers.keydown);

        _handlers.keyup = function(e) {
            if (e.code === 'Space') {
                spaceDown = false;
                if (!state.isPanning) worldEl.style.cursor = '';
            }
        };
        document.addEventListener('keyup', _handlers.keyup);

        _handlers.contextmenu = function(e) {
            if (e.target.closest('#cos-world')) e.preventDefault();
        };
        document.addEventListener('contextmenu', _handlers.contextmenu);

        _handlers.mousedown = function(e) {
            // 右键 = 激光切割开始
            if (e.button === 2 && e.target.closest('#cos-world')) {
                e.preventDefault();
                laser.active = true;
                laser.path = [];
                if (!laser.svg) {
                    laser.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                    laser.svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
                    laser.svg.setAttribute('viewBox', '0 0 ' + worldEl.clientWidth + ' ' + worldEl.clientHeight);
                    worldEl.appendChild(laser.svg);
                    laser.line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    laser.line.setAttribute('fill', 'none');
                    laser.line.setAttribute('stroke', '#ff4444');
                    laser.line.setAttribute('stroke-width', '2');
                    laser.line.setAttribute('stroke-linecap', 'round');
                    laser.line.setAttribute('opacity', '0.8');
                    laser.svg.appendChild(laser.line);
                }
                if (laser.line) laser.line.setAttribute('d', '');
                return;
            }
            // 判定"空白"：target 是世界层本身，或者在世界层内但没有最近的交互元素
            var isBlank = (e.target === worldEl || e.target === layerEl ||
                (e.target.closest && e.target.closest('#cos-world') && !e.target.closest('[data-cos-deletable], .ne-node, .ne-port, .ne-conn-svg, .ne-minimap, textarea, button, [contenteditable]')));
            // 左键 + 空白（未按空格）→ 拖动画布；若松手时未拖动则视为"单击空白"，由 endPan 取消选中
            if (e.button === 0 && isBlank && !spaceDown) {
                e.preventDefault();
                state._pendingBlankClick = true;
                startPan(e.clientX, e.clientY);
            } else if (e.button === 1) {
                // 中键：阻止浏览器自动滚动，但不平移
                e.preventDefault();
            }
            // 空格 + 左键的框选已在捕获阶段(_handlers.mousedownCapture)拦截，这里不处理
            // 通知插件 mousedown 事件（附带世界坐标、是否正在平移、Shift、是否空白，供框选判断）
            emit('mousedown', { screenX: state.mouseScreenX, screenY: state.mouseScreenY, worldX: state.mouseWorldX, worldY: state.mouseWorldY, button: e.button, target: e.target, panning: state.isPanning, shiftKey: e.shiftKey, isBlank: isBlank });
        };
        worldEl.addEventListener('mousedown', _handlers.mousedown);

        // 捕获阶段：空格 + 左键 → 框选（在任意位置，含图片上方）。
        // 必须在捕获阶段拦截并 stopPropagation，否则会先触发图片自身的拖拽监听。
        _handlers.mousedownCapture = function(e) {
            if (e.button === 0 && spaceDown) {
                e.preventDefault();
                e.stopPropagation();
                var rect = worldEl.getBoundingClientRect();
                var sx = e.clientX - rect.left, sy = e.clientY - rect.top;
                emit('mousedown', {
                    screenX: sx, screenY: sy,
                    worldX: (sx - state.offsetX) / state.scale,
                    worldY: (sy - state.offsetY) / state.scale,
                    button: 0, target: e.target, panning: false,
                    shiftKey: e.shiftKey, isBlank: false, boxSelect: true
                });
            }
        };
        worldEl.addEventListener('mousedown', _handlers.mousedownCapture, true);

        _handlers.mousemove = function(e) {
            var rect = worldEl.getBoundingClientRect();
            state.mouseScreenX = e.clientX - rect.left;
            state.mouseScreenY = e.clientY - rect.top;
            state.mouseWorldX = (state.mouseScreenX - state.offsetX) / state.scale;
            state.mouseWorldY = (state.mouseScreenY - state.offsetY) / state.scale;

            if (state.isPanning) doPan(e.clientX, e.clientY);

            // 激光切割
            if (laser.active) {
                laser.path.push({ x: e.clientX - rect.left, y: e.clientY - rect.top });
                if (laser.path.length > 10) laser.path.shift();
                // 画线
                var d = '';
                for (var i = 0; i < laser.path.length; i++) {
                    d += (i === 0 ? 'M' : 'L') + laser.path[i].x + ' ' + laser.path[i].y + ' ';
                }
                if (laser.line) laser.line.setAttribute('d', d);
                // 检测碰撞 - 用 elementsFromPoint 找到激光经过的可删除元素
                if (laser.path.length > 1) {
                    var el = document.elementFromPoint(e.clientX, e.clientY);
                    if (el) {
                        var del = el.closest('[data-cos-deletable]');
                        if (del) {
                            del.remove();
                            emit('laser-delete', { element: del });
                        }
                    }
                }
            }

            emit('mousemove', { screenX: state.mouseScreenX, screenY: state.mouseScreenY, worldX: state.mouseWorldX, worldY: state.mouseWorldY, button: e.button });
        };
        window.addEventListener('mousemove', _handlers.mousemove);

        _handlers.mouseup = function(e) {
            if (state.isPanning) endPan();
            // 结束激光切割
            if (laser.active) {
                laser.active = false;
                laser.path = [];
                if (laser.line) laser.line.setAttribute('d', '');
            }
            emit('mouseup', { worldX: state.mouseWorldX, worldY: state.mouseWorldY, button: e.button });
        };
        window.addEventListener('mouseup', _handlers.mouseup);

        _handlers.wheel = function(e) {
            e.preventDefault();
            var rect = worldEl.getBoundingClientRect();
            zoom(e.deltaY, e.clientX - rect.left, e.clientY - rect.top);
        };
        worldEl.addEventListener('wheel', _handlers.wheel, { passive: false });

        _handlers.wcontext = function(e) {
            e.preventDefault();
            emit('contextmenu', { screenX: e.clientX, screenY: e.clientY, worldX: state.mouseWorldX, worldY: state.mouseWorldY });
        };
        worldEl.addEventListener('contextmenu', _handlers.wcontext);

        _handlers.resize = resize;
        window.addEventListener('resize', _handlers.resize);

        // 保存引用以便 destroy 清理
        setupEvents._handlers = _handlers;
        setupEvents._worldEl = worldEl;
    }

    function startPan(cx, cy) {
        state.isPanning = true;
        state.panStartX = cx; state.panStartY = cy;
        state.panStartOffsetX = state.offsetX; state.panStartOffsetY = state.offsetY;
        worldEl.style.cursor = 'grabbing';
    }

    function doPan(cx, cy) {
        state.offsetX = state.panStartOffsetX + (cx - state.panStartX);
        state.offsetY = state.panStartOffsetY + (cy - state.panStartY);
        // 一旦真正拖动，就不再是"单击空白"
        if (state._pendingBlankClick && (Math.abs(cx - state.panStartX) > 3 || Math.abs(cy - state.panStartY) > 3)) {
            state._pendingBlankClick = false;
        }
        applyTransform();
        drawGrid();
    }

    // 平移/缩放结束若内容完全出画，回弹到内容中心（拖拽过程中不限制，可自由探索；避免把图拖丢）
    var _bounceTimer = null;
    function _checkBounce() {
        if (shouldBounce()) bounceToContent();
    }

    function endPan() {
        state.isPanning = false;
        worldEl.style.cursor = '';
        // 左键空白按下但没拖动 → 视为单击空白，通知插件取消选中
        if (state._pendingBlankClick) {
            state._pendingBlankClick = false;
            emit('click-blank', {});
        }
        _checkBounce();
        emit('transform', getState());
    }

    function zoom(dy, mx, my) {
        var os = state.scale;
        var ns = Math.max(MIN_SCALE, Math.min(MAX_SCALE, os * (dy > 0 ? 0.92 : 1.08)));
        state.offsetX = mx - (mx - state.offsetX) * (ns / os);
        state.offsetY = my - (my - state.offsetY) * (ns / os);
        state.scale = ns;
        applyTransform();
        drawGrid();
        emit('transform', getState());
        // 缩放停后检查：内容出画 → 回弹；若视口里一张图都没有（如缩放到图片间隙）→ 也回弹，
        // 避免"放大到一定程度、缩回后所有图片消失"
        if (_bounceTimer) clearTimeout(_bounceTimer);
        _bounceTimer = setTimeout(function() {
            if (isBouncing()) return; // 已由 canvas-images 主动检查触发回弹，跳过，避免动画重启
            if (shouldBounce()) { bounceToContent(); return; }
            if (typeof CanvasImages !== 'undefined' && CanvasImages.anyItemInRect &&
                !CanvasImages.anyItemInRect(getVisibleBounds())) {
                bounceToContent();
            }
        }, 250);
    }

    function applyTransform() {
        if (layerEl) {
            layerEl.style.transform = 'translate(' + state.offsetX + 'px,' + state.offsetY + 'px) scale(' + state.scale + ')';
        }
    }

    // === 坐标转换 ===
    function screenToWorld(sx, sy) {
        var r = worldEl.getBoundingClientRect();
        return { x: (sx - r.left - state.offsetX) / state.scale, y: (sy - r.top - state.offsetY) / state.scale };
    }

    function worldToScreen(wx, wy) {
        var r = worldEl.getBoundingClientRect();
        return { x: wx * state.scale + state.offsetX + r.left, y: wy * state.scale + state.offsetY + r.top };
    }

    function getVisibleBounds() {
        var tl = screenToWorld(0, 0);
        var br = screenToWorld(worldEl.clientWidth, worldEl.clientHeight);
        return { left: tl.x, top: tl.y, right: br.x, bottom: br.y };
    }

    // === 视图 ===
    function resetView() {
        animateTo(worldEl.clientWidth / 2, worldEl.clientHeight / 2, 1, 300);
    }

    function panTo(wx, wy, anim) {
        var tx = worldEl.clientWidth / 2 - wx * state.scale;
        var ty = worldEl.clientHeight / 2 - wy * state.scale;
        if (anim) animateTo(tx, ty, state.scale, 300);
        else { state.offsetX = tx; state.offsetY = ty; applyTransform(); drawGrid(); }
    }

    function fitContent() {
        var cb = _getContentBounds();
        if (!cb) return;
        var cw = cb.maxX - cb.minX, ch = cb.maxY - cb.minY;
        var vw = worldEl.clientWidth, vh = worldEl.clientHeight;
        var s = Math.max(MIN_SCALE, Math.min((vw - 100) / cw, (vh - 100) / ch, 2));
        animateTo(vw / 2 - (cb.minX + cw / 2) * s, vh / 2 - (cb.minY + ch / 2) * s, s, 400);
    }

    function getState() { return { offsetX: state.offsetX, offsetY: state.offsetY, scale: state.scale }; }
    function setState(s) { state.offsetX = s.offsetX || 0; state.offsetY = s.offsetY || 0; state.scale = s.scale || 1; applyTransform(); drawGrid(); }

    function showGrid() { gridVisible = true; drawGrid(); }
    function hideGrid() { gridVisible = false; if (gridCtx) gridCtx.clearRect(0, 0, gridCanvas.width, gridCanvas.height); }
    function isGridVisible() { return gridVisible; }

    function destroy() {
        var h = setupEvents._handlers;
        if (!h) return;
        document.removeEventListener('keydown', h.keydown);
        document.removeEventListener('keyup', h.keyup);
        document.removeEventListener('contextmenu', h.contextmenu);
        window.removeEventListener('mousemove', h.mousemove);
        window.removeEventListener('mouseup', h.mouseup);
        if (setupEvents._worldEl) {
            setupEvents._worldEl.removeEventListener('wheel', h.wheel);
            setupEvents._worldEl.removeEventListener('contextmenu', h.wcontext);
            setupEvents._worldEl.removeEventListener('mousedown', h.mousedown);
        }
        window.removeEventListener('resize', h.resize);
    }

    return {
        init: init, resize: resize, getLayer: getLayer,
        on: on, off: off, emit: emit,
        screenToWorld: screenToWorld, worldToScreen: worldToScreen,
        getVisibleBounds: getVisibleBounds,
        resetView: resetView, panTo: panTo, fitContent: fitContent,
        markContent: markContent, clearContent: clearContent,
        getState: getState, setState: setState,
        shouldBounce: shouldBounce, bounceToContent: bounceToContent, isBouncing: isBouncing,
        showGrid: showGrid, hideGrid: hideGrid, isGridVisible: isGridVisible,
        setPanEnabled: function(v) { _panEnabled = v; if (!v) worldEl.style.cursor = ''; },
        destroy: destroy,
        CHUNK_SIZE: CHUNK_SIZE
    };
})();
