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
        '<div class="cos-overlay-body">' + bodyHtml + '</div>' +
        '<div class="cos-overlay-resize"></div>';

    document.body.appendChild(ov);
    requestAnimationFrame(function() {
        ov.classList.add('cos-overlay-visible');
        ov.style.transform = 'translate(-50%, -50%) scale(1)';
    });

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
        dragging = false;
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

    // 缩放功能
    var resizeHandle = ov.querySelector('.cos-overlay-resize');
    var resizing = false, rsX, rsY, rsW, rsH;
    function onResizeMove(e) {
        if (!resizing) return;
        var newW = Math.max(320, rsW + e.clientX - rsX);
        var newH = Math.max(200, rsH + e.clientY - rsY);
        ov.style.width = newW + 'px';
        ov.style.maxHeight = newH + 'px';
        ov.querySelector('.cos-overlay-body').style.maxHeight = (newH - 42) + 'px';
    }
    function onResizeUp() {
        resizing = false;
    }
    resizeHandle.addEventListener('mousedown', function(e) {
        resizing = true;
        rsX = e.clientX;
        rsY = e.clientY;
        rsW = ov.offsetWidth;
        rsH = ov.offsetHeight;
        e.preventDefault();
        e.stopPropagation();
    });
    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeUp);

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

function showToast(msg) {
    var t = document.createElement('div');
    t.className = 'cos-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(function() { t.classList.add('cos-toast-show'); }, 10);
    setTimeout(function() { t.classList.remove('cos-toast-show'); setTimeout(function() { t.remove(); }, 300); }, 2000);
}
