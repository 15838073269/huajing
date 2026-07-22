/**
 * AI 生图 - 表单渲染 + 参考图管理
 * 替代原节点系统，单窗口表单模式
 */

// ========== 渲染表单 ==========

AIImageGenSkill._renderForm = function() {
    var self = this;
    var body = this._formBody;
    if (!body) return;
    var fs = this._formState;

    var html = '';

    // 参考图区域
    html += '<div class="aig-ref-section">';
    html += '<div class="aig-ref-grid" id="aigRefGrid"></div>';
    html += '<div class="aig-ref-bar">';
    html += '  <span class="aig-ref-count" id="aigRefCount">' + (fs.refImages.length) + ' / 16 张 · 从画布选图或粘贴导入</span>';
    html += '  <button class="aig-lock-btn' + (fs.refLock ? ' locked' : '') + '" id="aigLockBtn" data-action="togglelock" title="锁定后不自动跟随画布选中">' + (fs.refLock ? '已锁定' : '跟随画布') + '</button>';
    html += '</div>';
    html += '</div>';

    // 提示词
    html += '<div class="aig-prompt-row">';
    html += '<button class="aig-prompt-btn aig-btn-word" id="aigOpenWord" data-action="openword">模板</button>';
    html += '<textarea class="aig-node-prompt" id="aigPrompt" placeholder="输入提示词...">' + this._escapeHtml(fs.prompt || '') + '</textarea>';
    html += '</div>';

    // 参数区域
    html += '<div class="aig-param-box">';

    // 第1行：1K/2K/4K
    var baseKeys = ['1k','2k','4k'];
    var baseLabels = {'1k':'1K=1024','2k':'2K=2048','4k':'4K=3840'};
    html += '<div class="aig-size-row">';
    for (var si = 0; si < baseKeys.length; si++) {
        var bk = baseKeys[si];
        var active = (fs.baseK === bk) ? ' active' : '';
        html += '<div class="aig-size-btn' + active + '" data-action="basesel" data-value="' + bk + '">' + baseLabels[bk] + '</div>';
    }
    html += '</div>';

    // 第2行：Auto / 比例
    var ratioLbl = this._ratioLabel(fs.ratioW, fs.ratioH);
    html += '<div class="aig-mode-row">';
    html += '<div class="aig-mode-btn' + (fs.mode === 'auto' ? ' active' : '') + '" data-action="modesel" data-value="auto">Auto</div>';
    html += '<div class="aig-mode-btn' + (fs.mode === 'manual' ? ' active' : '') + '" data-action="openratio" data-value="manual">比例 ' + ratioLbl + '</div>';
    html += '</div>';

    // 第3行：格式 PNG / JPEG / WebP
    var cfg = this._modelConfigs[fs.model] || this._modelConfigs['gpt-image-2'];
    var fmtOpts = cfg.formats;
    html += '<div class="aig-size-row">';
    for (var fi = 0; fi < fmtOpts.length; fi++) {
        var fActive = ((fs.format || 'png') === fmtOpts[fi].v) ? ' active' : '';
        html += '<div class="aig-size-btn' + fActive + '" data-action="fmtsel" data-value="' + fmtOpts[fi].v + '">' + fmtOpts[fi].l + '</div>';
    }
    html += '</div>';

    // 第4行：质量 中 / 低 / 高 / 自动
    var qltyOpts = cfg.qualities;
    html += '<div class="aig-mode-row">';
    for (var qi = 0; qi < qltyOpts.length; qi++) {
        var qActive = (fs.quality === qltyOpts[qi].v) ? ' active' : '';
        html += '<div class="aig-mode-btn' + qActive + '" data-action="qtysel" data-value="' + qltyOpts[qi].v + '">' + qltyOpts[qi].l + '</div>';
    }
    html += '</div>';

    // 第5行：数量 + 生成
    html += '<div class="aig-node-bottom">';
    html += '<input type="number" id="aigNumImg" min="1" max="10" value="' + (fs.numImages || 1) + '" title="数量">';
    html += '<button class="aig-gen-btn" id="aigGenBtn" data-action="generate">🎨 生成</button>';
    html += '</div>';

    html += '</div>'; // param-box

    body.innerHTML = html;

    // 绑定参数事件（仅绑定一次，避免 _renderForm 多次调用导致重复触发）
    if (!this._formEventsBound) {
        this._bindFormEvents(body);
        this._formEventsBound = true;
    }
    // 渲染参考图网格
    this._renderRefGrid();
};

// ========== 绑定表单事件 ==========

AIImageGenSkill._bindFormEvents = function(body) {
    var self = this;

    // 提示词同步（input / 粘贴图片 改为下方 body 委托绑定，避免 innerHTML 重建后监听丢失）

    // 参数按钮事件委托
    body.addEventListener('click', function(e) {
        var btn = e.target.closest('[data-action]');
        if (!btn) return;
        var act = btn.getAttribute('data-action');
        switch (act) {
            case 'openword':
                if (typeof SkillSystem === 'undefined') { self._setStatus('⚠️ 技能系统未就绪'); break; }
                // 1) 若未安装（只在商店里），先从商店安装
                var installed = SkillSystem.getAll ? SkillSystem.getAll() : {};
                if (!installed['prompt-template']) {
                    var store = SkillSystem.getPlugins ? SkillSystem.getPlugins() : {};
                    if (store['prompt-template'] && SkillSystem.installPlugin) {
                        SkillSystem.installPlugin('prompt-template');
                    } else if (typeof PromptTemplateSkill !== 'undefined' && SkillSystem.register) {
                        // 兜底：商店里也没有则直接注册全局对象
                        SkillSystem.register(PromptTemplateSkill);
                    }
                }
                // 2) 激活（若当前已是激活态，activate 会直接 return 导致面板不重开，需先停用强制重开）
                if (SkillSystem.getActiveId && SkillSystem.getActiveId() === 'prompt-template') {
                    SkillSystem.deactivate();
                }
                SkillSystem.activate('prompt-template');
                // 3) 校验是否成功打开
                if (SkillSystem.getActiveId && SkillSystem.getActiveId() !== 'prompt-template') {
                    self._setStatus('⚠️ 未找到提示词模板插件');
                } else {
                    self._setStatus('已打开提示词模板');
                }
                break;
            case 'generate':
                self._collectFormParams();
                self._generate();
                break;
            case 'basesel':
                self._formState.baseK = btn.getAttribute('data-value');
                body.querySelectorAll('.aig-size-btn').forEach(function(b) {
                    b.classList.toggle('active', b.getAttribute('data-value') === self._formState.baseK);
                });
                if (self._ratioPanelEl) self._refreshRatioPanel();
                self._lastParams = self._collectLastParams();
                self._autoSave();
                break;
            case 'modesel':
                self._formState.mode = btn.getAttribute('data-value');
                body.querySelectorAll('.aig-mode-btn').forEach(function(b) {
                    b.classList.toggle('active', b.getAttribute('data-value') === self._formState.mode);
                });
                if (self._formState.mode === 'auto' && self._ratioPanelEl) {
                    self._ratioPanelEl.remove();
                    self._ratioPanelEl = null;
                }
                self._lastParams = self._collectLastParams();
                self._autoSave();
                break;
            case 'openratio':
                if (self._formState.mode !== 'manual') {
                    self._formState.mode = 'manual';
                    self._collectFormParams();
                    self._renderForm();
                    self._autoSave();
                }
                self._openRatioPanel();
                break;
            case 'fmtsel':
                self._formState.format = btn.getAttribute('data-value');
                body.querySelectorAll('[data-action="fmtsel"]').forEach(function(b) {
                    b.classList.toggle('active', b.getAttribute('data-value') === self._formState.format);
                });
                self._autoSave();
                break;
            case 'qtysel':
                self._formState.quality = btn.getAttribute('data-value');
                body.querySelectorAll('[data-action="qtysel"]').forEach(function(b) {
                    b.classList.toggle('active', b.getAttribute('data-value') === self._formState.quality);
                });
                self._autoSave();
                break;
            case 'togglelock':
                self._formState.refLock = !self._formState.refLock;
                var lb = body.querySelector('#aigLockBtn');
                if (lb) {
                    lb.classList.toggle('locked', self._formState.refLock);
                    lb.textContent = self._formState.refLock ? '已锁定' : '跟随画布';
                }
                self._setStatus(self._formState.refLock ? '已锁定参考图，不再跟随画布' : '已恢复跟随画布选中');
                self._autoSave();
                break;
        }
    });

    // 数量同步（委托：避免 innerHTML 重建后监听丢失）
    body.addEventListener('change', function(e) {
        if (!e.target || e.target.id !== 'aigNumImg') return;
        var v = parseInt(e.target.value) || 1;
        v = Math.max(1, Math.min(10, v));
        e.target.value = v;
        self._formState.numImages = v;
        self._autoSave();
    });

    // 提示词 input 同步（委托）
    body.addEventListener('input', function(e) {
        if (e.target && e.target.id === 'aigPrompt') {
            self._formState.prompt = e.target.value;
        }
    });

    // Ctrl+V 粘贴图片到参考图（委托）
    body.addEventListener('paste', function(e) {
        if (!e.target || e.target.id !== 'aigPrompt') return;
        var items = e.clipboardData && e.clipboardData.items;
        if (!items) return;
        for (var pi = 0; pi < items.length; pi++) {
            if (items[pi].type.indexOf('image') === 0) {
                e.preventDefault();
                var blob = items[pi].getAsFile();
                if (!blob || blob.size > 50*1024*1024) { self._setStatus('⚠️ 图片超50MB'); continue; }
                var reader = new FileReader();
                reader.onload = function(ev) {
                    if (!self._formState.refImages) self._formState.refImages = [];
                    if (self._formState.refImages.length >= 16) { self._setStatus('⚠️ 最多16张'); return; }
                    self._formState.refImages.push({ dataURL: ev.target.result, name: '粘贴图片' });
                    self._formState.refLock = true;
                    self._renderRefGrid();
                    self._updateLockBtn();
                    self._autoSave();
                    self._setStatus('✅ 已粘贴图片（已锁定）');
                };
                reader.readAsDataURL(blob);
                break;
            }
        }
    });
};

// ========== 收集表单参数 ==========

AIImageGenSkill._collectFormParams = function() {
    var body = this._formBody;
    if (!body) return;
    var ta = body.querySelector('#aigPrompt');
    if (ta) this._formState.prompt = ta.value;
    var nInp = body.querySelector('#aigNumImg');
    if (nInp) this._formState.numImages = parseInt(nInp.value) || 1;
};

AIImageGenSkill._collectLastParams = function() {
    return {
        mode: this._formState.mode,
        baseK: this._formState.baseK,
        ratioW: this._formState.ratioW,
        ratioH: this._formState.ratioH
    };
};

// ========== 参考图网格 ==========

AIImageGenSkill._renderRefGrid = function() {
    var body = this._formBody;
    if (!body) return;
    var grid = body.querySelector('#aigRefGrid');
    if (!grid) return;
    var refs = this._formState.refImages || [];
    var html = '';
    for (var ri = 0; ri < refs.length; ri++) {
        html += '<div class="aig-ref-item">' +
            '<img class="aig-node-ref" width="60" height="60" src="' + refs[ri].dataURL + '" data-ref-idx="' + ri + '" title="点击查看">' +
            '<button class="aig-ref-del-btn" data-ref-del="' + ri + '">\u2715</button>' +
            '</div>';
    }
    grid.innerHTML = html;

    var cnt = body.querySelector('#aigRefCount');
    if (cnt) cnt.textContent = refs.length + ' / 16 张 · 从画布选图或粘贴导入';

    // 绑定事件
    var self = this;
    grid.querySelectorAll('.aig-node-ref').forEach(function(img) {
        img.addEventListener('click', function() {
            var idx = parseInt(this.getAttribute('data-ref-idx'));
            if (refs[idx]) self._viewImage(refs[idx].dataURL);
        });
    });
    grid.querySelectorAll('[data-ref-del]').forEach(function(btn) {
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var idx = parseInt(this.getAttribute('data-ref-del'));
            if (!isNaN(idx)) {
                self._formState.refImages.splice(idx, 1);
                // 删空后自动解除锁定，方便直接点画布图重新导入；仍有图则保留原锁定状态（如粘贴的参考图）
                if (self._formState.refImages.length === 0) self._formState.refLock = false;
                self._renderRefGrid();
                self._updateLockBtn();
                self._autoSave();
            }
        });
    });
};

AIImageGenSkill._updateLockBtn = function() {
    var body = this._formBody;
    if (!body) return;
    var lb = body.querySelector('#aigLockBtn');
    if (!lb) return;
    lb.classList.toggle('locked', !!this._formState.refLock);
    lb.textContent = this._formState.refLock ? '已锁定' : '跟随画布';
};
