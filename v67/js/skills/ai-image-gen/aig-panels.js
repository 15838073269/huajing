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
    body.innerHTML = this._renderApiList();
    ov.appendChild(body);

    // 操作按钮（使用公共 cos-pbtn）
    var actions = document.createElement('div');
    actions.className = 'aig-settings-actions';
    actions.innerHTML =
        '<button class="cos-pbtn cos-pbtn-success cos-pbtn-sm" id="aigAddApi">+ 新增 API</button>' +
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
    ov.querySelector('#aigAddApi').addEventListener('click', function() { self._showAddApiDialog(); });
    this._bindApiListEvents();
};

AIImageGenSkill._saveSettings = function() {
    if (!this._settingsEl) return;
    
    // 保存所有 API 配置
    var apiItems = this._settingsEl.querySelectorAll('.aig-api-item');
    apiItems.forEach(function(item) {
        var apiId = parseInt(item.dataset.apiId);
        var nameInput = item.querySelector('.aig-api-name');
        var baseInput = item.querySelector('.aig-api-base');
        var keyInput = item.querySelector('.aig-api-key');
        var modelInput = item.querySelector('.aig-api-model');
        
        if (nameInput && baseInput && keyInput) {
            this._updateApi(apiId, {
                name: nameInput.value.trim(),
                base: baseInput.value.trim(),
                key: keyInput.value.trim(),
                model: modelInput ? modelInput.value.trim() : ''
            });
        }
    }.bind(this));
    
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

// ========== API 列表渲染与事件 ==========

AIImageGenSkill._renderApiList = function() {
    var html = '<div class="aig-api-list">';
    
    this._apiConfigs.forEach(function(api) {
        var isActive = api.active;
        html += '<div class="aig-api-item" data-api-id="' + api.id + '">' +
            '<div class="aig-api-header">';
        
        // 使用圆点选择器替代勾选框
        html += '<label class="aig-api-selector">' +
            '<input type="radio" name="activeApi" value="' + api.id + '" ' + (isActive ? 'checked' : '') + '>' +
            '<span class="aig-radio-dot"></span>' +
            '</label>';
        
        html += '<span class="aig-api-number">#' + api.id + '</span>' +
            '<input type="text" class="aig-api-name" placeholder="API 名称" value="' + this._escapeHtml(api.name) + '">' +
            '<button class="aig-api-delete" data-api-id="' + api.id + '" title="删除">×</button>' +
            '</div>' +
            '<div class="aig-api-fields">' +
            '<div class="aig-api-field">' +
            '<span class="aig-api-label">地址:</span>' +
            '<input type="text" class="aig-api-base" placeholder="https://" value="' + this._escapeHtml(api.base) + '">' +
            '</div>' +
            '<div class="aig-api-field">' +
            '<span class="aig-api-label">模型:</span>' +
            '<input type="text" class="aig-api-model" placeholder="gpt-image-1" value="' + this._escapeHtml(api.model || '') + '">' +
            '</div>' +
            '<div class="aig-api-field">' +
            '<span class="aig-api-label">Key:</span>' +
            '<input type="password" class="aig-api-key" placeholder="sk-..." value="' + this._escapeHtml(api.key) + '">' +
            '<a class="aig-api-link" href="#" target="_blank">获取</a>' +
            '</div>' +
            '</div>' +
            '</div>';
    }.bind(this));
    
    html += '</div>';
    return html;
};

AIImageGenSkill._bindApiListEvents = function() {
    var self = this;
    
    if (!this._settingsEl) return;
    
    // 绑定 API 选择器事件
    var radios = this._settingsEl.querySelectorAll('input[name="activeApi"]');
    radios.forEach(function(radio) {
        radio.addEventListener('change', function() {
            var apiId = parseInt(this.value);
            self._switchApi(apiId);
            self._setStatus('已切换到 ' + (self._getCurrentApi().name || 'API ' + apiId));
        });
    });
    
            // 绑定删除按钮事件
            var deleteBtns = this._settingsEl.querySelectorAll('.aig-api-delete');
            deleteBtns.forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var apiId = parseInt(this.dataset.apiId);
                    
                    if (confirm('确定删除这个 API 吗？')) {
                        var success = self._removeApi(apiId);
                        if (success) {
                            this.closest('.aig-api-item').remove();
                            self._setStatus('API 已删除');
                            
                            // 如果没有API了，提示用户添加
                            if (self._apiConfigs.length === 0) {
                                self._setStatus('⚠️ 没有可用的 API，请先添加一个 API 配置');
                            }
                        }
                    }
                });
            });
    
    // 绑定 API 地址输入事件（更新获取链接）
    var baseInputs = this._settingsEl.querySelectorAll('.aig-api-base');
    baseInputs.forEach(function(input) {
        input.addEventListener('input', function() {
            var link = this.closest('.aig-api-field').querySelector('.aig-api-link');
            var val = this.value.trim();
            if (val && val.startsWith('http')) {
                link.href = val + '/register';
                link.textContent = '获取';
            } else {
                link.href = '#';
                link.textContent = '需在地址后添加/register';
            }
        });
    });
};

AIImageGenSkill._showAddApiDialog = function() {
    var self = this;
    var name = prompt('请输入新 API 名称:', 'API ' + (this._apiConfigs.length + 1));
    if (!name) return;
    
    var base = prompt('请输入 API 地址:', '');
    if (!base) return; // 用户取消或留空
    
    var key = prompt('请输入 API Key (可选，可在设置中后续添加):', '');
    
    var model = prompt('请输入大模型名称 (如 gpt-image-1):', '');
    
    var newApi = this._addApi(name, base, key, model);
    
    // 重新渲染列表
    var body = this._settingsEl.querySelector('.aig-settings-body');
    body.innerHTML = this._renderApiList();
    this._bindApiListEvents();
    
    this._setStatus('已添加 ' + newApi.name);
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
