/**
 * AI 生图 - 窗口创建 + 生命周期
 * 单窗口表单模式
 * 使用公共库 cos-pwin / cos-ptoolbar / CosUI.draggable
 */

AIImageGenSkill.activate = function(world) {
    this._world = world;
    if (this._overlay) {
        if (!this._overlay.parentNode) document.body.appendChild(this._overlay);
        this._autoPickFromCanvas();
        this._startCanvasWatch();
        SkillSystem.renderSubTools();
        return;
    }
    this._createOverlay();
    this._loadSettings().then(function() {});
    var self = this;
    requestAnimationFrame(function() {
        self._autoPickFromCanvas();
    });
    this._startCanvasWatch();
    SkillSystem.renderSubTools();
};

AIImageGenSkill.deactivate = function() {
    if (this._overlay) this._saveWindowSize();
};

AIImageGenSkill.getSubTools = function() {
    var self = this;
    return [
        { label: '📋', title: '历史记录', action: function() { self._showHistory(); } },
        { label: '⚙️', title: '设置', action: function() { self._showSettings(); } },
        { label: '关', title: '关闭窗口', action: function() {
            if (typeof SkillSystem !== 'undefined') SkillSystem.deactivate();
        }}
    ];
};

AIImageGenSkill.save = function() { return {}; };
AIImageGenSkill.load = function() {};

// ========== 创建窗口 ==========

AIImageGenSkill._createOverlay = function() {
    var self = this;
    var ov = document.createElement('div');
    ov.className = 'cos-pwin aig-overlay';
    ov.setAttribute('data-skill-id', 'ai-image-gen');

    var MIN_W = 340;
    ov.style.minWidth = MIN_W + 'px';
    ov.style.minHeight = '0';   // 高度由内容决定

    // 置顶
    var topZ = (window.__cos_topZ || 10000) + 1;
    window.__cos_topZ = topZ;
    ov.style.zIndex = topZ;

    ov.addEventListener('contextmenu', function(e) { e.preventDefault(); });
    ov.addEventListener('mousedown', function() {
        var tz = (window.__cos_topZ || 10000) + 1;
        window.__cos_topZ = tz;
        ov.style.zIndex = tz;
    });

    // 标题栏
    var header = document.createElement('div');
    header.className = 'cos-pwin-hdr';
    header.innerHTML =
        '<span class="cos-pwin-hdr-title">🎨 AI 生图</span>' +
        '<span class="aig-h-status" id="aigStatus">就绪</span>' +
        '<div class="cos-pwin-hdr-right">' +
            '<span class="cos-pclose" id="aigCloseBtn" title="关闭">\u00d7</span>' +
        '</div>';
    ov.appendChild(header);

    // 工具栏（仅历史 + 设置）
    var tb = document.createElement('div');
    tb.className = 'cos-ptoolbar';
    tb.innerHTML =
        '<button class="cos-pbtn cos-pbtn-secondary cos-pbtn-sm" id="aigHistoryBtn">\ud83d\udccb 历史</button>' +
        '<button class="cos-pbtn cos-pbtn-secondary cos-pbtn-sm" id="aigSettingsBtn">\u2699\ufe0f 设置</button>';
    ov.appendChild(tb);

    // 表单主体（高度由内容决定，不滚动不撑满）
    var formBody = document.createElement('div');
    formBody.className = 'aig-form-body';
    ov.appendChild(formBody);

    document.body.appendChild(ov);
    this._overlay = ov;
    this._formBody = formBody;

    // 缩放（仅水平方向，高度由内容自适应）
    if (typeof WindowHelper !== 'undefined') {
        WindowHelper.makeResizable(ov, { minWidth: MIN_W, minHeight: 0, storeKey: 'aig-win-v3' });
    }
    // 移除上下方向的缩放手柄，只保留左右（e / w）
    ov.querySelectorAll('.win-resize-n, .win-resize-s, .win-resize-nw, .win-resize-ne, .win-resize-sw, .win-resize-se').forEach(function(el) { el.remove(); });

    // 恢复正确宽度和位置（高度始终 auto）
    this._applyWindowSize(MIN_W);

    // 拖拽
    if (typeof CosUI !== 'undefined' && CosUI.draggable) {
        CosUI.draggable.bind(ov, header, {
            storeKey: 'aig-win-v3',
            closeSelector: '#aigCloseBtn,.cos-pclose'
        });
    }

    this._bindUI(ov);
    this._renderForm();
};

// ========== UI 事件 ==========

AIImageGenSkill._bindUI = function(ov) {
    var self = this;

    ov.querySelector('#aigCloseBtn').addEventListener('click', function() {
        self._destroy(); if (typeof SkillSystem !== 'undefined') SkillSystem.deactivate();
    });

    ov.querySelector('#aigHistoryBtn').addEventListener('click', function() { self._showHistory(); });
    ov.querySelector('#aigSettingsBtn').addEventListener('click', function() { self._showSettings(); });
};

// ========== 窗口尺寸恢复（高度始终 auto，仅恢复宽度和位置） ==========

AIImageGenSkill._applyWindowSize = function(minW) {
    var ov = this._overlay;
    if (!ov) return;
    var sw = window.innerWidth, sh = window.innerHeight;
    ov.style.height = 'auto';
    try {
        var saved = JSON.parse(localStorage.getItem('aig-win-v3'));
        if (saved) {
            var w = Math.max(minW, Math.min(saved.w || minW, sw - 20));
            var l = Math.max(0, Math.min(saved.l, sw - w));
            var t = Math.max(0, Math.min(saved.t || 20, sh - 100));
            ov.style.width = w + 'px';
            ov.style.left = l + 'px';
            ov.style.top = t + 'px';
        } else {
            ov.style.width = minW + 'px';
            ov.style.left = Math.max(20, (sw - minW) / 2) + 'px';
            ov.style.top = Math.max(20, (sh - 300) / 2) + 'px';
        }
    } catch(e) {
        ov.style.width = minW + 'px';
        ov.style.left = Math.max(20, (sw - minW) / 2) + 'px';
        ov.style.top = Math.max(20, (sh - 300) / 2) + 'px';
    }
};
