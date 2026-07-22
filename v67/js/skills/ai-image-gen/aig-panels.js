/**
 * AI 生图 - 设置面板 + 图片查看器
 * 使用公共库 cos-pwin / cos-pbtn / CosUI.draggable / cos-pmodal-overlay
 */

// ========== 设置面板 ==========

AIImageGenSkill._showSettings = function() {
    var self = this;
    if (this._settingsEl) { this._settingsEl.style.zIndex = 2147483647; return; }

    // 使用公共窗口样式
    var ov = document.createElement('div');
    ov.className = 'cos-pwin aig-overlay';
    ov.style.width = '420px';
    ov.style.left = Math.max(20, (window.innerWidth - 420) / 2) + 'px';
    ov.style.top = Math.max(20, (window.innerHeight - 200) / 2) + 'px';
    ov.style.minWidth = '320px';
    ov.style.minHeight = '200px';
    ov.style.zIndex = 2147483647;
    ov.addEventListener('contextmenu', function(e) { e.preventDefault(); });

    // 标题栏（公共 cos-pwin-hdr）
    var header = document.createElement('div');
    header.className = 'cos-pwin-hdr';
    header.innerHTML =
        '<span class="cos-pwin-hdr-title">\u2699\ufe0f AI 设置</span>' +
        '<div class="cos-pwin-hdr-right">' +
            '<span class="cos-pclose" id="aigSettingsClose" title="关闭">\u00d7</span>' +
        '</div>';
    ov.appendChild(header);

    // 内容区
    var body = document.createElement('div');
    body.className = 'aig-settings-body';
    body.innerHTML =
        '<div class="aig-settings-row">' +
            '<span class="aig-sl">API 地址</span>' +
            '<span class="aig-sc"><input type="text" id="aigSetBase" placeholder="https://api3.wlai.vip" value="' + this._escapeHtml(this._apiBase) + '"></span>' +
        '</div>' +
        '<div class="aig-settings-row">' +
            '<span class="aig-sl">API Key</span>' +
            '<span class="aig-sc"><input type="password" id="aigSetKey" placeholder="sk-..." value="' + this._escapeHtml(this._apiKey) + '"></span>' +
            '<span class="aig-sr"><a id="aigGetKeyLink" href="' + this._escapeHtml(this._apiBase || 'https://api3.wlai.vip') + '/register?aff=b1VJ" target="_blank">获取 \u2192</a></span>' +
        '</div>';
    ov.appendChild(body);

    // 操作按钮（使用公共 cos-pbtn）
    var actions = document.createElement('div');
    actions.className = 'aig-settings-actions';
    actions.innerHTML =
        '<button class="cos-pbtn cos-pbtn-danger cos-pbtn-sm" id="aigSetClear">清空 Key</button>' +
        '<button class="cos-pbtn cos-pbtn-secondary cos-pbtn-sm" id="aigSetCancel">取消</button>' +
        '<button class="cos-pbtn cos-pbtn-primary cos-pbtn-sm" id="aigSetSave">保存</button>';
    ov.appendChild(actions);

    document.body.appendChild(ov);
    this._settingsEl = ov;

    // 拖拽（使用公共 CosUI.draggable）
    if (typeof CosUI !== 'undefined' && CosUI.draggable) {
        CosUI.draggable.bind(ov, header, { closeSelector: '#aigSettingsClose,.cos-pclose' });
    }

    ov.querySelector('#aigSettingsClose').addEventListener('click', function() { self._closeSettings(); });
    ov.querySelector('#aigSetCancel').addEventListener('click', function() { self._closeSettings(); });
    ov.querySelector('#aigSetSave').addEventListener('click', function() { self._saveSettings(); });
    ov.querySelector('#aigSetClear').addEventListener('click', function() {
        ov.querySelector('#aigSetKey').value = '';
        self._apiKey = '';
        self._autoSave();
        self._setStatus('Key 已清空');
        self._closeSettings();
    });
    ov.querySelector('#aigSetBase').addEventListener('input', function() {
        var link = ov.querySelector('#aigGetKeyLink');
        var val = this.value.trim() || 'https://api3.wlai.vip';
        link.href = val + '/register?aff=b1VJ';
    });
};

AIImageGenSkill._saveSettings = function() {
    if (!this._settingsEl) return;
    this._apiBase = this._settingsEl.querySelector('#aigSetBase').value.trim() || 'https://api3.wlai.vip';
    this._apiKey = this._settingsEl.querySelector('#aigSetKey').value.trim();
    this._autoSave();
    this._setStatus('设置已保存');
    this._closeSettings();
};

AIImageGenSkill._closeSettings = function() {
    if (this._settingsEl && this._settingsEl.parentNode) {
        this._settingsEl.parentNode.removeChild(this._settingsEl);
    }
    this._settingsEl = null;
};

// ========== 图片查看 ==========

AIImageGenSkill._updateModalTransform = function() {
    var img = this._modalEl.querySelector('#aigModalImg');
    if (!img) return;
    var t = 'translate(' + (this._modalPanX || 0) + 'px,' + (this._modalPanY || 0) + 'px) scale(' + this._modalZoom + ')';
    img.style.transform = t;
    var zd = this._modalEl.querySelector('#aigModalZoom');
    if (zd) zd.textContent = Math.round(this._modalZoom * 100) + '%';
    img.style.cursor = this._modalZoom > 1 ? 'grab' : '';
};

AIImageGenSkill._viewImage = function(url) {
    var self = this;
    if (!this._modalCreated) {
        // 使用公共 cos-pmodal-overlay 样式
        var m = document.createElement('div');
        m.className = 'cos-pmodal-overlay aig-modal';
        m.innerHTML = '<img id="aigModalImg"><div class="aig-modal-zoom" id="aigModalZoom">100%</div>';
        m.addEventListener('click', function(e) {
            if (e.target === m || e.target.className === 'aig-modal-zoom') {
                m.classList.remove('show');
                m.classList.remove('active');
                self._modalZoom = 1;
                self._modalPanX = 0;
                self._modalPanY = 0;
            }
        });
        m.addEventListener('wheel', function(e) {
            e.preventDefault();
            if (!self._modalZoom) self._modalZoom = 1;
            if (self._modalPanX === undefined) self._modalPanX = 0;
            if (self._modalPanY === undefined) self._modalPanY = 0;
            var img = m.querySelector('#aigModalImg');
            if (!img) return;
            var factor = e.deltaY < 0 ? 1.1 : 0.9;
            var ns = Math.min(10, Math.max(0.1, self._modalZoom * factor));
            factor = ns / self._modalZoom;
            var rect = m.getBoundingClientRect();
            var cx = rect.left + rect.width / 2;
            var cy = rect.top + rect.height / 2;
            var mx = e.clientX - cx, my = e.clientY - cy;
            self._modalPanX = mx - (mx - self._modalPanX) * factor;
            self._modalPanY = my - (my - self._modalPanY) * factor;
            self._modalZoom = ns;
            self._updateModalTransform();
        }, { passive: false });
        var isDragging = false, dragStartX, dragStartY, startPanX, startPanY;
        m.addEventListener('mousedown', function(e) {
            if (e.target.id !== 'aigModalImg') return;
            if (self._modalZoom <= 1) return;
            e.preventDefault();
            isDragging = true;
            dragStartX = e.clientX; dragStartY = e.clientY;
            startPanX = self._modalPanX || 0; startPanY = self._modalPanY || 0;
            e.target.style.cursor = 'grabbing';
        });
        document.addEventListener('mousemove', function(e) {
            if (!isDragging || !self._modalCreated) return;
            self._modalPanX = startPanX + (e.clientX - dragStartX);
            self._modalPanY = startPanY + (e.clientY - dragStartY);
            self._updateModalTransform();
        });
        document.addEventListener('mouseup', function(e) {
            if (!isDragging) return;
            isDragging = false;
            var img = m.querySelector('#aigModalImg');
            if (img) img.style.cursor = self._modalZoom > 1 ? 'grab' : '';
        });
        document.addEventListener('keydown', function(e) {
            if (!self._modalCreated || !self._modalEl || !self._modalEl.classList.contains('active')) return;
            if (e.key === 'Escape') {
                self._modalEl.classList.remove('active');
                self._modalEl.classList.remove('show');
                self._modalZoom = 1;
                self._modalPanX = 0;
                self._modalPanY = 0;
            }
        });
        document.body.appendChild(m);
        this._modalCreated = true; this._modalEl = m;
    }
    this._modalZoom = 1;
    this._modalPanX = 0;
    this._modalPanY = 0;
    var img = this._modalEl.querySelector('#aigModalImg');
    img.src = url;
    img.style.transform = '';
    img.style.cursor = '';
    var zd = this._modalEl.querySelector('#aigModalZoom');
    if (zd) zd.textContent = '100%';
    this._modalEl.classList.add('show');
    this._modalEl.classList.add('active');
};

// ========== 导出图片（从历史导出） ==========

AIImageGenSkill._downloadZip = function(zip, name) {
    var self = this;
    var blob;
    zip.generateAsync({ type: 'blob' }).then(function(b) {
        blob = b;
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = name + '-' + new Date().toISOString().slice(0, 10) + '.zip'; a.click();
        URL.revokeObjectURL(url);
    }).then(function() {
        self._setStatus('已导出 ' + name + '.zip');
    });
};
