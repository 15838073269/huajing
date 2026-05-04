/**
 * 画境 v65 - 游戏世界引擎
 * 画布即世界，技能即能力
 */
var GameWorld = (function() {

    var CHUNK_SIZE = 2000;
    var GRID_SMALL = 50;
    var GRID_BIG = 250;
    var BOUNCE_THRESHOLD = 0.6;
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
        mouseScreenX: 0, mouseScreenY: 0
    };

    var chunks = {};
    var listeners = {}; // 事件监听

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

    function shouldBounce() {
        if (!state.contentBounds) return false;
        var b = getVisibleBounds();
        var cb = state.contentBounds;
        var il = Math.max(b.left, cb.minX), it = Math.max(b.top, cb.minY);
        var ir = Math.min(b.right, cb.maxX), ib = Math.min(b.bottom, cb.maxY);
        if (ir <= il || ib <= it) return true;
        return ((ir - il) * (ib - it)) / ((b.right - b.left) * (b.bottom - b.top)) < BOUNCE_THRESHOLD;
    }

    function bounceToContent() {
        if (!state.contentBounds) return;
        var cb = state.contentBounds;
        var cx = (cb.minX + cb.maxX) / 2, cy = (cb.minY + cb.maxY) / 2;
        animateTo(
            worldEl.clientWidth / 2 - cx * state.scale,
            worldEl.clientHeight / 2 - cy * state.scale,
            state.scale, 400
        );
    }

    function animateTo(tx, ty, ts, dur) {
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
            else emit('transform', getState());
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
            // 左键空白区域 / 中键 / 空格+左键 / Alt+左键 = 平移
            // 判断"空白"：target 是世界层本身，或者在世界层内但没有最近的交互元素
            var isBlank = (e.target === worldEl || e.target === layerEl ||
                (e.target.closest && e.target.closest('#cos-world') && !e.target.closest('[data-cos-deletable], .ne-node, .ne-port, .ne-conn-svg, .ne-minimap, textarea, button, [contenteditable]')));
            if (e.button === 1 || (e.button === 0 && (spaceDown || e.altKey || isBlank))) {
                e.preventDefault();
                startPan(e.clientX, e.clientY);
            }
            // 通知插件 mousedown 事件（包含世界坐标）
            emit('mousedown', { screenX: state.mouseScreenX, screenY: state.mouseScreenY, worldX: state.mouseWorldX, worldY: state.mouseWorldY, button: e.button, target: e.target });
        };
        worldEl.addEventListener('mousedown', _handlers.mousedown);

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
        // 实时循环：超出内容边界时无缝衔接到对面
        liveWrap();
        applyTransform();
        drawGrid();
    }

    function liveWrap() {
        if (!state.contentBounds) return;
        var cb = state.contentBounds;
        var vw = worldEl.clientWidth, vh = worldEl.clientHeight;
        var b = getVisibleBounds();
        var contentW = cb.maxX - cb.minX;
        var contentH = cb.maxY - cb.minY;
        if (contentW <= 0 || contentH <= 0) return;

        // 视口完全超出左边界 → 偏移到右边
        if (b.right < cb.minX) {
            var shift = (cb.maxX - cb.minX + vw / state.scale) * state.scale;
            state.offsetX += shift;
            state.panStartOffsetX += shift;
        }
        // 视口完全超出右边界 → 偏移到左边
        else if (b.left > cb.maxX) {
            var shift = (cb.maxX - cb.minX + vw / state.scale) * state.scale;
            state.offsetX -= shift;
            state.panStartOffsetX -= shift;
        }

        // 重新计算 Y
        b = getVisibleBounds();

        // 视口完全超出上边界 → 偏移到下边
        if (b.bottom < cb.minY) {
            var shift = (cb.maxY - cb.minY + vh / state.scale) * state.scale;
            state.offsetY += shift;
            state.panStartOffsetY += shift;
        }
        // 视口完全超出下边界 → 偏移到上边
        else if (b.top > cb.maxY) {
            var shift = (cb.maxY - cb.minY + vh / state.scale) * state.scale;
            state.offsetY -= shift;
            state.panStartOffsetY -= shift;
        }
    }

    function endPan() {
        state.isPanning = false;
        worldEl.style.cursor = '';
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
        if (!state.contentBounds) return;
        var cb = state.contentBounds;
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
        showGrid: showGrid, hideGrid: hideGrid, isGridVisible: isGridVisible,
        destroy: destroy,
        CHUNK_SIZE: CHUNK_SIZE
    };
})();
