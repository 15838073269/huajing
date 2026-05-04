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

    // 拖动功能
    var header = ov.querySelector('.cos-overlay-header');
    var dragging = false, startX, startY, origX, origY;
    header.style.cursor = 'move';
    function onMove(e) {
        if (!dragging) return;
        ov.style.left = (origX + e.clientX - startX) + 'px';
        ov.style.top = (origY + e.clientY - startY) + 'px';
    }
    function onUp() {
        if (dragging) {
            dragging = false;
            try {
                var r = ov.getBoundingClientRect();
                localStorage.setItem('cos-overlay-rect', JSON.stringify({ w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top) }));
            } catch(e) {}
        }
    }
    header.addEventListener('mousedown', function(e) {
        if (e.target.closest('.cos-overlay-close')) return;
        dragging = true;
        // 第一次拖动时切换到绝对坐标
        if (ov.style.transform) {
            var rect = ov.getBoundingClientRect();
            ov.style.left = rect.left + 'px';
            ov.style.top = rect.top + 'px';
            ov.style.transform = 'none';
        }
        startX = e.clientX;
        startY = e.clientY;
        origX = parseInt(ov.style.left);
        origY = parseInt(ov.style.top);
        e.preventDefault();
    });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);

    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeUp);

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
