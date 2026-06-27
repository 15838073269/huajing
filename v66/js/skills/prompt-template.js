/**
 * AI 提示词模板插件 - 画境 v66
 *
 * - 左侧标签筛选（可增删）
 * - 右侧模板列表，[变量]转输入框
 * - 每条底部显示标签，可添加/移除
 * - 标签与模板之间可拖拽调整比例
 * - 复制按钮、导入/导出/清空
 * - 全部数据持久化到 IndexedDB
 */

var PromptTemplateSkill = {

    id: 'prompt-template',
    name: '提示词',
    icon: '<span style="color:#4ecca3;">词</span>',
    description: 'AI绘画提示词模板，标签管理',
    key: 'p',

    _world: null,
    _managerEl: null,
    _templates: [],    // [{ text: '...', tags: [] }]
    _tags: [],         // 所有标签
    _activeTag: null,  // null = 全部
    _lastInputs: {},   // { 'templateIdx-slotIdx': 'value' }
    _sidebarWidth: 120,
    _panelX: null,
    _panelY: null,
    _panelW: 560,
    _panelH: 480,
    _fontSize: 11,
    _DB_NAME: 'PromptTemplateDB',
    _DB_STORE: 'data',
    _DB_VERSION: 3,
    _dbReadSuccess: false,   // 标记 IndexedDB 是否成功读取

    activate: function(world) {
        this._world = world;
        var self = this;
        this._loadData(function() {
            // 处理数据加载完成前积攒的待存模板
            if (self._dbReadSuccess && self._pendingTemplates && self._pendingTemplates.length) {
                for (var pti = 0; pti < self._pendingTemplates.length; pti++) {
                    self._templates.unshift(self._pendingTemplates[pti]);
                }
                self._pendingTemplates = [];
                try { localStorage.removeItem('pt_pending_backup'); } catch(e) {}
                self._saveData();
            }
            // 从 localStorage 恢复页面刷新前未来得及持久化的模板
            if (self._dbReadSuccess) {
                var backupJson;
                try { backupJson = localStorage.getItem('pt_pending_backup'); } catch(e) {}
                if (backupJson) {
                    try {
                        var backup = JSON.parse(backupJson);
                        if (Array.isArray(backup) && backup.length) {
                            backup.forEach(function(t) {
                                self._templates.unshift(t);
                            });
                            try { localStorage.removeItem('pt_pending_backup'); } catch(e) {}
                            self._saveData();
                        }
                    } catch(e) {
                        try { localStorage.removeItem('pt_pending_backup'); } catch(e) {}
                    }
                }
            }
            // 仅在 IndexedDB 成功读取且确认为空时，才导入静态默认数据
            if (self._dbReadSuccess && !self._templates.length
                && typeof PROMPT_TEMPLATES !== 'undefined') {
                PROMPT_TEMPLATES.forEach(function(t) {
                    self._templates.unshift({ text: t, tags: [] });
                });
                // 首次使用时保存默认数据
                self._saveData();
            }
            if (!self._managerEl) {
                self._createManager();
            } else {
                self._managerEl.style.display = 'flex';
            }
            SkillSystem.renderSubTools();
        });
    },

    deactivate: function() {},

    getSubTools: function() {
        var self = this;
        return [{ label: '管理', action: function() { self._toggleManager(); } }];
    },

    save: function() { return {}; },
    load: function() {},

    // ===== IndexedDB =====

    _loadData: function(cb) {
        var self = this;
        var req = indexedDB.open(this._DB_NAME, this._DB_VERSION);
        req.onupgradeneeded = function(e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains(self._DB_STORE)) db.createObjectStore(self._DB_STORE);
        };
        req.onsuccess = function(e) {
            var db = e.target.result;
            try {
                var tx = db.transaction(self._DB_STORE, 'readonly');
                var get = tx.objectStore(self._DB_STORE).get('all');
                get.onsuccess = function() {
                    if (get.result) {
                        var d = get.result;
                        // v3 格式
                        if (d.templates && d.tags) {
                            self._templates = d.templates;
                            self._tags = d.tags;
                            self._activeTag = d.activeTag != null ? d.activeTag : null;
                            self._lastInputs = d.lastInputs || {};
                            self._sidebarWidth = d.sidebarWidth || 120;
                            self._panelX = d.panelX;
                            self._panelY = d.panelY;
                            self._panelW = d.panelW || 560;
                            self._panelH = d.panelH || 480;
                            self._fontSize = d.fontSize || 11;
                        }
                        // v2 格式迁移
                        else if (d.categories) {
                            self._tags = [];
                            self._templates = [];
                            d.categories.forEach(function(cat) {
                                if (cat.name) self._tags.push(cat.name);
                                (cat.templates || []).forEach(function(t) {
                                    self._templates.unshift({ text: t, tags: cat.name ? [cat.name] : [] });
                                });
                            });
                            self._saveData();
                        }
                    }
                    self._dbReadSuccess = true;
                    if (cb) cb();
                };
                get.onerror = function() {
                    self._dbReadSuccess = false;
                    if (cb) cb();
                };
            } catch(err) {
                self._dbReadSuccess = false;
                if (cb) cb();
            }
        };
        req.onerror = function() {
            self._dbReadSuccess = false;
            if (cb) cb();
        };
    },

    _saveData: function() {
        var self = this;
        var req = indexedDB.open(this._DB_NAME, this._DB_VERSION);
        req.onupgradeneeded = function(e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains(self._DB_STORE)) db.createObjectStore(self._DB_STORE);
        };
        req.onsuccess = function(e) {
            var db = e.target.result;
            try {
                var tx = db.transaction(self._DB_STORE, 'readwrite');
                tx.objectStore(self._DB_STORE).put({
                    templates: self._templates,
                    tags: self._tags,
                    activeTag: self._activeTag,
                    lastInputs: self._lastInputs,
                    sidebarWidth: self._sidebarWidth,
                    panelX: self._panelX,
                    panelY: self._panelY,
                    panelW: self._panelW,
                    panelH: self._panelH,
                    fontSize: self._fontSize
                }, 'all');
            } catch(err) {}
        };
    },

    // ===== 解析模板 =====

    _parseSlots: function(text) {
        var slots = [], regex = /\[([^\]]+)\]/g, match;
        while ((match = regex.exec(text)) !== null) {
            slots.push({ full: match[0], label: match[1] });
        }
        return slots;
    },

    // ===== 面板 =====

    _toggleManager: function() {
        if (this._managerEl) {
            var wasHidden = this._managerEl.style.display === 'none';
            this._managerEl.style.display = wasHidden ? 'flex' : 'none';
            // 面板从隐藏变为显示时，如果积攒了待刷新标记，立即刷新列表
            if (wasHidden && this._pendingRefresh) {
                this._pendingRefresh = false;
                if (this._renderList) this._renderList();
                if (this._renderSidebar) this._renderSidebar();
            }
            return;
        }
        if (!this._world) return;
        this._createManager();
    },

    _createManager: function() {
        var self = this;
        var panel = document.createElement('div');
        panel.className = 'pt-manager';
        panel.innerHTML =
            '<div class="pt-mgr-header">' +
                '<span>提示词模板</span>' +
                '<div class="pt-mgr-header-btns">' +
                    '<button class="pt-hdr-btn" id="ptImport" title="导入">导入</button>' +
                    '<button class="pt-hdr-btn" id="ptExport" title="导出">导出</button>' +
                    '<button class="pt-mgr-close" id="ptMgrClose">&times;</button>' +
                '</div>' +
            '</div>' +
            '<div class="pt-mgr-body">' +
                '<div class="pt-sidebar" id="ptSidebar"></div>' +
                '<div class="pt-resizer" id="ptResizer"></div>' +
                '<div class="pt-main">' +
                    '<div class="pt-add">' +
                        '<textarea class="pt-add-input" id="ptAddText" placeholder="输入模板，一行一条&#10;用 [中括号] 标记可变部分" rows="3"></textarea>' +
                        '<button class="pt-btn pt-btn-primary" id="ptAddBtn" style="width:100%;margin-top:4px">添加</button>' +
                    '</div>' +
                    '<div class="pt-list" id="ptList"></div>' +
                    '<div class="pt-zoom-bar">' +
                        '<span class="pt-zoom-label">A</span>' +
                        '<input type="range" class="pt-zoom-slider" id="ptZoomSlider" min="10" max="24" step="1">' +
                        '<span class="pt-zoom-label" style="font-size:16px">A</span>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="pt-resize-handle" id="ptResizeHandle"></div>' +
            '<div class="pt-mgr-footer">' +
                '<button class="pt-footer-btn pt-footer-danger" id="ptClear" title="清空全部模板，不可恢复">清空全部</button>' +
            '</div>' +
            '<input type="file" id="ptFileInput" accept=".json,.txt" style="display:none">';

        document.body.appendChild(panel);
        this._managerEl = panel;
        panel.style.width = this._panelW + 'px';
        panel.style.height = this._panelH + 'px';

        if (this._panelX !== null && this._panelY !== null) {
            panel.style.left = this._panelX + 'px';
            panel.style.top = this._panelY + 'px';
        } else {
            panel.style.left = (window.innerWidth - 580) + 'px';
            panel.style.top = (window.innerHeight - 560) + 'px';
        }
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';

        this._initPanelDrag(panel);
        this._initResizer(panel);
        // 使用通用窗口缩放（四角+四边）
        if (typeof SkillSystem !== 'undefined' && SkillSystem.WindowHelper) {
            WindowHelper.makeResizable(panel, { minWidth: 400, minHeight: 300, storeKey: 'pt-window-rect' });
        }
        this._initZoomSlider(panel);

        panel.querySelector('#ptMgrClose').addEventListener('click', function() {
            panel.style.display = 'none';
        });

        panel.querySelector('#ptAddBtn').addEventListener('click', function() { self._addTemplates(); });

        var fileInput = panel.querySelector('#ptFileInput');
        panel.querySelector('#ptImport').addEventListener('click', function() { fileInput.click(); });
        fileInput.addEventListener('change', function(e) {
            if (!e.target.files[0]) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    var data = JSON.parse(ev.target.result);
                    if (Array.isArray(data)) {
                        var count = 0;
                        data.forEach(function(item) {
                            var t = typeof item === 'string' ? item : (item.text || item.template || '');
                            if (t) { self._templates.unshift({ text: t, tags: [] }); count++; }
                        });
                        // 偏移 _lastInputs 索引
                        var shifted = {};
                        Object.keys(self._lastInputs).forEach(function(key) {
                            var parts = key.split('-');
                            shifted[(parseInt(parts[0]) + count) + '-' + parts[1]] = self._lastInputs[key];
                        });
                        self._lastInputs = shifted;
                        self._saveData(); self._renderSidebar(); self._renderList(); self._showToast('已导入 ' + count + ' 条');
                    }
                } catch(err) {
                    var lines = ev.target.result.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l; });
                    lines.forEach(function(line) { self._templates.unshift({ text: line, tags: [] }); });
                    // 偏移 _lastInputs 索引
                    var shifted = {};
                    Object.keys(self._lastInputs).forEach(function(key) {
                        var parts = key.split('-');
                        shifted[(parseInt(parts[0]) + lines.length) + '-' + parts[1]] = self._lastInputs[key];
                    });
                    self._lastInputs = shifted;
                    self._saveData(); self._renderSidebar(); self._renderList(); self._showToast('已导入 ' + lines.length + ' 条');
                }
                fileInput.value = '';
            };
            reader.readAsText(e.target.files[0]);
        });

        panel.querySelector('#ptExport').addEventListener('click', function() {
            var blob = new Blob([JSON.stringify(self._templates, null, 2)], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url; a.download = 'prompt-templates.json'; a.click();
            URL.revokeObjectURL(url);
        });

        panel.querySelector('#ptClear').addEventListener('click', function() {
            if (!self._templates.length) return;
            if (!confirm('确定清空所有模板？')) return;
            self._templates = [];
            self._lastInputs = {};
            self._saveData(); self._renderSidebar(); self._renderList(); self._showToast('已清空');
        });

        this._renderSidebar();
        this._renderList();
    },

    // ===== 面板拖拽 =====

    _initPanelDrag: function(panel) {
        var self = this;
        var dragging = false, offsetX, offsetY;
        var header = panel.querySelector('.pt-mgr-header');
        header.addEventListener('mousedown', function(e) {
            if (e.target.closest('button')) return;
            dragging = true;
            offsetX = e.clientX - panel.offsetLeft;
            offsetY = e.clientY - panel.offsetTop;
            e.preventDefault();
        });
        document.addEventListener('mousemove', function(e) {
            if (!dragging) return;
            panel.style.left = (e.clientX - offsetX) + 'px';
            panel.style.top = (e.clientY - offsetY) + 'px';
        });
        document.addEventListener('mouseup', function() {
            if (dragging) {
                dragging = false;
                self._panelX = panel.offsetLeft;
                self._panelY = panel.offsetTop;
                self._saveData();
            }
        });
    },

    // ===== 分隔条 =====

    _initResizer: function(panel) {
        var self = this;
        var resizer = panel.querySelector('#ptResizer');
        var sidebar = panel.querySelector('#ptSidebar');
        var dragging = false, startX, startW;
        resizer.addEventListener('mousedown', function(e) {
            dragging = true; startX = e.clientX; startW = sidebar.offsetWidth;
            e.preventDefault(); e.stopPropagation();
        });
        document.addEventListener('mousemove', function(e) {
            if (!dragging) return;
            var newW = Math.max(80, Math.min(250, startW + (e.clientX - startX)));
            sidebar.style.width = newW + 'px';
            self._sidebarWidth = newW;
        });
        document.addEventListener('mouseup', function() {
            if (dragging) { dragging = false; self._saveData(); }
        });
    },

    // ===== 右下角拖拽 =====

    _initResizeHandle: function(panel) {
        var self = this;
        var handle = panel.querySelector('#ptResizeHandle');
        var dragging = false, startX, startY, startW, startH;
        handle.addEventListener('mousedown', function(e) {
            dragging = true; startX = e.clientX; startY = e.clientY;
            startW = panel.offsetWidth; startH = panel.offsetHeight;
            e.preventDefault(); e.stopPropagation();
        });
        document.addEventListener('mousemove', function(e) {
            if (!dragging) return;
            panel.style.width = Math.max(400, startW + (e.clientX - startX)) + 'px';
            panel.style.height = Math.max(300, startH + (e.clientY - startY)) + 'px';
        });
        document.addEventListener('mouseup', function() {
            if (dragging) {
                dragging = false;
                self._panelW = panel.offsetWidth;
                self._panelH = panel.offsetHeight;
                self._saveData();
            }
        });
    },

    // ===== 缩放 =====

    _initZoomSlider: function(panel) {
        var self = this;
        var slider = panel.querySelector('#ptZoomSlider');
        slider.value = this._fontSize;
        this._applyFontSize(this._fontSize);
        slider.addEventListener('input', function() {
            var size = parseInt(this.value);
            self._fontSize = size;
            self._applyFontSize(size);
            self._saveData();
        });
    },

    _applyFontSize: function(size) {
        if (!this._managerEl) return;
        var list = this._managerEl.querySelector('#ptList');
        if (list) list.style.fontSize = size + 'px';
    },

    // ===== 左侧标签 =====

    _renderSidebar: function() {
        var sidebar = this._managerEl.querySelector('#ptSidebar');
        if (!sidebar) return;
        var self = this;
        sidebar.style.width = this._sidebarWidth + 'px';

        var html = '<div class="pt-tag-list">';
        // "全部"选项
        var allActive = this._activeTag === null ? ' active' : '';
        var allCount = this._templates.length;
        html += '<div class="pt-tag-item' + allActive + '" data-tag="__all__">' +
            '<span class="pt-tag-name">全部</span>' +
            '<span class="pt-tag-count">' + allCount + '</span>' +
        '</div>';
        // 各标签
        this._tags.forEach(function(tag) {
            var active = self._activeTag === tag ? ' active' : '';
            var count = self._templates.filter(function(t) { return t.tags.indexOf(tag) >= 0; }).length;
            html += '<div class="pt-tag-item' + active + '" data-tag="' + self._escapeAttr(tag) + '">' +
                '<span class="pt-tag-name">' + self._escapeHtml(tag) + '</span>' +
                '<span class="pt-tag-count">' + count + '</span>' +
                '<button class="pt-tag-del" data-tag="' + self._escapeAttr(tag) + '" title="删除标签">&times;</button>' +
            '</div>';
        });
        html += '</div>';
        html += '<button class="pt-btn pt-btn-add-cat" id="ptAddTag">+ 新标签</button>';
        sidebar.innerHTML = html;

        // 点击筛选
        sidebar.querySelectorAll('.pt-tag-item').forEach(function(item) {
            item.addEventListener('click', function(e) {
                if (e.target.closest('.pt-tag-del')) return;
                var tag = this.dataset.tag;
                self._activeTag = tag === '__all__' ? null : tag;
                self._saveData();
                self._renderSidebar();
                self._renderList();
            });
        });

        // 删除标签
        sidebar.querySelectorAll('.pt-tag-del').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var tag = this.dataset.tag;
                if (self._tags.length <= 1) { self._showToast('至少保留一个标签'); return; }
                if (!confirm('删除标签「' + tag + '」？模板上的该标签也会被移除。')) return;
                self._tags = self._tags.filter(function(t) { return t !== tag; });
                self._templates.forEach(function(t) {
                    t.tags = t.tags.filter(function(tg) { return tg !== tag; });
                    if (!t.tags.length) t.tags = [];
                });
                if (self._activeTag === tag) self._activeTag = null;
                self._saveData();
                self._renderSidebar();
                self._renderList();
            });
        });

        // 新增标签
        sidebar.querySelector('#ptAddTag').addEventListener('click', function() {
            var btn = this;
            btn.style.display = 'none';
            var input = document.createElement('input');
            input.type = 'text';
            input.className = 'pt-cat-new-input';
            input.placeholder = '标签名称，回车确认';
            btn.parentNode.insertBefore(input, btn);
            input.focus();
            var done = false;
            var finish = function() {
                if (done) return;
                done = true;
                var name = input.value.trim();
                if (name && self._tags.indexOf(name) < 0) {
                    self._tags.push(name);
                    self._saveData();
                    self._renderSidebar();
                } else {
                    if (name) self._showToast('标签已存在');
                    input.remove();
                    btn.style.display = '';
                }
            };
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') { e.preventDefault(); finish(); }
                if (e.key === 'Escape') { done = true; input.remove(); btn.style.display = ''; }
            });
            input.addEventListener('blur', finish);
        });
    },

    // ===== 模板列表 =====

    _getFilteredTemplates: function() {
        if (this._activeTag === null) return this._templates;
        var tag = this._activeTag;
        return this._templates.filter(function(t) { return t.tags.indexOf(tag) >= 0; });
    },

    _addTemplates: function() {
        var raw = this._managerEl.querySelector('#ptAddText').value.trim();
        if (!raw) return;
        var lines = raw.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l; });
        if (!lines.length) return;
        var n = lines.length;
        // unshift 添加前，先将 _lastInputs 中的索引偏移 n 位
        var shifted = {};
        Object.keys(this._lastInputs).forEach(function(key) {
            var parts = key.split('-');
            var ti = parseInt(parts[0]);
            shifted[(ti + n) + '-' + parts[1]] = this._lastInputs[key];
        }.bind(this));
        this._lastInputs = shifted;
        lines.forEach(function(line) {
            this._templates.unshift({ text: line, tags: [] });
        }.bind(this));
        this._saveData();
        this._managerEl.querySelector('#ptAddText').value = '';
        this._renderSidebar();
        this._renderList();
        this._showToast('已添加 ' + n + ' 条');
    },

    _renderList: function() {
        var list = this._managerEl.querySelector('#ptList');
        if (!list) return;
        var self = this;
        var filtered = this._getFilteredTemplates();

        if (!filtered.length) {
            list.innerHTML = '<div class="pt-empty">暂无模板</div>';
            return;
        }

        var html = '';
        filtered.forEach(function(tpl, fi) {
            // 找到在 _templates 中的真实索引
            var realIdx = self._templates.indexOf(tpl);
            var text = tpl.text;
            var slots = self._parseSlots(text);

            html += '<div class="pt-item" data-idx="' + realIdx + '">';
            // 左侧：内容 + 标签
            html += '<div class="pt-item-left">';
            // 模板内容
            html += '<div class="pt-item-body">';
            if (!slots.length) {
                html += '<span class="pt-text">' + self._escapeHtml(text) + '</span>';
            } else {
                var lastIdx = 0;
                slots.forEach(function(slot, si) {
                    var start = text.indexOf(slot.full, lastIdx);
                    if (start > lastIdx) {
                        html += '<span class="pt-text">' + self._escapeHtml(text.slice(lastIdx, start)) + '</span>';
                    }
                    var saved = self._lastInputs[realIdx + '-' + si] || '';
                    html += '<input class="pt-slot" type="text" data-ti="' + realIdx + '" data-si="' + si + '" value="' + self._escapeAttr(saved) + '" placeholder="' + self._escapeAttr(slot.label) + '">';
                    lastIdx = start + slot.full.length;
                });
                if (lastIdx < text.length) {
                    html += '<span class="pt-text">' + self._escapeHtml(text.slice(lastIdx)) + '</span>';
                }
            }
            html += '</div>';
            // 标签栏
            html += '<div class="pt-item-tags">';
            tpl.tags.forEach(function(tag) {
                html += '<span class="pt-item-tag" data-idx="' + realIdx + '" data-tag="' + self._escapeAttr(tag) + '">' +
                    self._escapeHtml(tag) +
                    '<button class="pt-item-tag-del" data-idx="' + realIdx + '" data-tag="' + self._escapeAttr(tag) + '">&times;</button>' +
                '</span>';
            });
            html += '<button class="pt-item-tag-add" data-idx="' + realIdx + '">+标签</button>';
            html += '</div>';
            html += '</div>';
            // 右侧：操作按钮
            html += '<div class="pt-item-actions">' +
                '<button class="pt-copy-btn" data-idx="' + realIdx + '">复制</button>' +
                '<button class="pt-send-btn" data-idx="' + realIdx + '" title="发送到AI生图">→生</button>' +
                '<button class="pt-del-btn" data-idx="' + realIdx + '">关</button>' +
            '</div>';
            html += '</div>';
        });
        list.innerHTML = html;

        // 输入框
        list.querySelectorAll('.pt-slot').forEach(function(input) {
            input.addEventListener('input', function() {
                self._lastInputs[this.dataset.ti + '-' + this.dataset.si] = this.value;
                self._saveData();
            });
            input.addEventListener('mousedown', function(e) { e.stopPropagation(); });
        });

        // 复制
        list.querySelectorAll('.pt-copy-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                self._copyTemplate(parseInt(this.dataset.idx), this);
            });
        });

        // 发送到 AI 生图
        list.querySelectorAll('.pt-send-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                self._sendToImageGen(parseInt(this.dataset.idx));
            });
        });

        // 删除
        list.querySelectorAll('.pt-del-btn').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var idx = parseInt(this.dataset.idx);
                self._templates.splice(idx, 1);
                // 清理 _lastInputs：移除被删模板的条目，将后续索引前移
                var newInputs = {};
                Object.keys(self._lastInputs).forEach(function(key) {
                    var parts = key.split('-');
                    var ti = parseInt(parts[0]);
                    var si = parts[1];
                    if (ti < idx) {
                        newInputs[key] = self._lastInputs[key];
                    } else if (ti > idx) {
                        newInputs[(ti - 1) + '-' + si] = self._lastInputs[key];
                    }
                    // ti === idx → 丢弃
                });
                self._lastInputs = newInputs;
                self._saveData();
                self._renderSidebar();
                self._renderList();
            });
        });

        // 移除标签
        list.querySelectorAll('.pt-item-tag-del').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var idx = parseInt(this.dataset.idx);
                var tag = this.dataset.tag;
                var tpl = self._templates[idx];
                tpl.tags = tpl.tags.filter(function(t) { return t !== tag; });
                if (!tpl.tags.length) tpl.tags = [];
                self._saveData();
                self._renderSidebar();
                self._renderList();
            });
        });

        // 添加标签
        list.querySelectorAll('.pt-item-tag-add').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var idx = parseInt(this.dataset.idx);
                var tpl = self._templates[idx];
                // 找出还没打的标签
                var available = self._tags.filter(function(t) { return tpl.tags.indexOf(t) < 0; });
                if (!available.length) { self._showToast('所有标签都已添加'); return; }
                // 创建小下拉菜单
                var menu = document.createElement('div');
                menu.className = 'pt-tag-menu';
                available.forEach(function(tag) {
                    var item = document.createElement('div');
                    item.className = 'pt-tag-menu-item';
                    item.textContent = tag;
                    item.addEventListener('click', function(e) {
                        e.stopPropagation();
                        tpl.tags.push(tag);
                        self._saveData();
                        self._renderSidebar();
                        self._renderList();
                        menu.remove();
                    });
                    menu.appendChild(item);
                });
                btn.parentNode.appendChild(menu);
                // 点击其他地方关闭
                setTimeout(function() {
                    document.addEventListener('click', function handler(ev) {
                        if (!menu.contains(ev.target)) {
                            menu.remove();
                            document.removeEventListener('click', handler);
                        }
                    });
                }, 0);
            });
        });
    },

    _copyTemplate: function(idx, btnEl) {
        var text = this._templates[idx].text;
        var slots = this._parseSlots(text);
        var result = text;

        if (slots.length) {
            var list = this._managerEl.querySelector('#ptList');
            var item = list.querySelector('.pt-item[data-idx="' + idx + '"]');
            if (item) {
                item.querySelectorAll('.pt-slot').forEach(function(input) {
                    var si = parseInt(input.dataset.si);
                    var val = input.value.trim() || input.placeholder;
                    result = result.replace(slots[si].full, val);
                });
            }
        }

        var doCopy = function() {
            btnEl.textContent = '已复制';
            setTimeout(function() { btnEl.textContent = '复制'; }, 1500);
        };

        if (navigator.clipboard) {
            navigator.clipboard.writeText(result).then(doCopy);
        } else {
            var ta = document.createElement('textarea');
            ta.value = result;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            doCopy();
        }
    },

    _sendToImageGen: function(idx) {
        var text = this._templates[idx].text;
        var slots = this._parseSlots(text);
        var result = text;

        if (slots.length) {
            var list = this._managerEl.querySelector('#ptList');
            var item = list.querySelector('.pt-item[data-idx="' + idx + '"]');
            if (item) {
                item.querySelectorAll('.pt-slot').forEach(function(input) {
                    var si = parseInt(input.dataset.si);
                    var val = input.value.trim() || input.placeholder;
                    result = result.replace(slots[si].full, val);
                });
            }
        }

        // 调用 AI 生图插件的公开方法
        if (typeof AIImageGenSkill !== 'undefined' && AIImageGenSkill.insertPrompt) {
            AIImageGenSkill.insertPrompt(result);
            this._showToast('已发送到 AI 生图');
        } else {
            this._showToast('未找到 AI 生图插件');
        }
    },

    // 公开方法：供其他插件直接添加模板
    // 缓存 _loadData 调用，避免重复打开 IndexedDB
    _loadingData: false,
    _loadDataCallbacks: [],

    _ensureLoaded: function(cb) {
        var self = this;
        if (this._dbReadSuccess) {
            if (cb) cb();
            return;
        }
        if (cb) this._loadDataCallbacks.push(cb);
        if (this._loadingData) return;
        this._loadingData = true;
        this._loadData(function() {
            self._loadingData = false;
            // 刷新 _loadData 回调队列
            var cbs = self._loadDataCallbacks;
            self._loadDataCallbacks = [];
            cbs.forEach(function(fn) { fn(); });
        });
    },

    addTemplate: function(text, tags) {
        if (!text || !text.trim()) return;
        // 数据未加载完成时不写入，防止覆盖旧数据
        if (!this._dbReadSuccess) {
            if (!this._pendingTemplates) this._pendingTemplates = [];
            this._pendingTemplates.push({ text: text.trim(), tags: tags || [] });
            // 写入 localStorage 兜底，防止刷新页面丢失
            try {
                localStorage.setItem('pt_pending_backup', JSON.stringify(this._pendingTemplates));
            } catch(e) {}
            // 主动触发数据加载，确保 _pendingTemplates 最终被刷入持久化
            this._ensureLoaded();
            return;
        }
        // 处理积攒的待处理模板（首次 _dbReadSuccess 后）
        if (this._pendingTemplates && this._pendingTemplates.length) {
            var pts = this._pendingTemplates;
            this._pendingTemplates = [];
            try { localStorage.removeItem('pt_pending_backup'); } catch(e) {}
            for (var pti = 0; pti < pts.length; pti++) {
                this._templates.unshift(pts[pti]);
            }
        }
        this._templates.unshift({ text: text.trim(), tags: tags || [] });
        this._saveData();
        // 不管面板是否可见，都标记需刷新；不可见时下次打开会重建列表
        if (this._managerEl) {
            if (this._managerEl.style.display !== 'none') {
                if (this._renderList) this._renderList();
                if (this._renderSidebar) this._renderSidebar();
            } else {
                // 面板存在但关闭 → 打标记，下次打开时自动刷新
                this._pendingRefresh = true;
            }
        }
    },

    _escapeHtml: function(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    _escapeAttr: function(str) {
        return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    _showToast: function(msg) {
        if (typeof showToast === 'function') showToast(msg);
    }
};

/* ===== 样式 ===== */
(function() {
    var s = document.createElement('style');
    s.textContent =

        /* 面板 */
        '.pt-manager { position:fixed;z-index:99999;' +
            'background:rgba(15,20,35,.95);color:#e8edf5;border-radius:14px;' +
            'box-shadow:0 8px 32px rgba(0,0,0,.6);overflow:hidden;' +
            'border:1px solid rgba(100,160,255,.08);' +
            'display:flex;flex-direction:column;user-select:none; }' +
        '.pt-mgr-header { display:flex;justify-content:space-between;align-items:center;' +
            'padding:8px 14px;background:rgba(56,189,248,.1);border-bottom:1px solid rgba(100,160,255,.15);' +
            'cursor:move;font-size:13px;font-weight:600;color:#e2e8f0;flex-shrink:0;gap:12px; }' +
        '.pt-mgr-header-btns { display:flex;align-items:center;gap:4px;flex:0 0 auto; }' +
        '.pt-hdr-btn { padding:2px 8px;background:rgba(56,189,248,.06);border:1px solid rgba(100,160,255,.08);' +
            'color:#94a3b8;border-radius:6px;cursor:pointer;font-size:10px;transition:all .15s; }' +
        '.pt-hdr-btn:hover { background:rgba(56,189,248,.12);color:#e2e8f0; }' +
        '.pt-hdr-btn:active { transform:scale(0.92); }' +
        '.pt-hdr-danger { color:#f87171;border-color:rgba(239,68,68,.15); }' +
        '.pt-hdr-danger:hover { background:rgba(239,68,68,.12);color:#fca5a5; }' +
        '.pt-mgr-close { background:rgba(220,80,60,.12);border:1px solid rgba(220,80,60,.25);color:#e87060;' +
            'font-size:14px;cursor:pointer;padding:3px 10px;border-radius:6px;transition:all .15s; }' +
        '.pt-mgr-close:hover { background:rgba(220,80,60,.25);color:#ff6b6b; }' +
        '.pt-mgr-footer { display:flex;justify-content:flex-end;padding:4px 10px;' +
            'background:rgba(0,0,0,.1);border-top:1px solid rgba(100,160,255,.06);flex-shrink:0; }' +
        '.pt-footer-btn { padding:3px 10px;border:1px solid rgba(100,160,255,.08);border-radius:6px;' +
            'cursor:pointer;font-size:10px;background:transparent;color:#64748b;transition:all .15s; }' +
        '.pt-footer-btn:hover { background:rgba(255,255,255,.04);color:#94a3b8; }' +
        '.pt-footer-danger { color:#5c4a4a; }' +
        '.pt-footer-danger:hover { color:#f87171;background:rgba(239,68,68,.08);border-color:rgba(239,68,68,.15); }' +

        /* 主体 */
        '.pt-mgr-body { flex:1;display:flex;overflow:hidden;min-height:0; }' +
        '.pt-sidebar { width:120px;flex-shrink:0;display:flex;flex-direction:column;' +
            'border-right:1px solid rgba(100,160,255,.06);background:rgba(0,0,0,.15); }' +
        '.pt-tag-list { flex:1;overflow-y:auto;padding:4px 0; }' +
        '.pt-tag-item { display:flex;align-items:center;justify-content:space-between;' +
            'padding:7px 12px;cursor:pointer;transition:all .15s;font-size:12px;color:#94a3b8;gap:4px; }' +
        '.pt-tag-item:hover { background:rgba(56,189,248,.05);color:#cbd5e1; }' +
        '.pt-tag-item.active { background:rgba(56,189,248,.1);color:#38bdf8;border-right:2px solid #38bdf8; }' +
        '.pt-tag-name { flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }' +
        '.pt-tag-count { font-size:10px;color:#475569;background:rgba(56,189,248,.05);' +
            'padding:1px 6px;border-radius:10px;flex-shrink:0; }' +
        '.pt-tag-del { display:none;background:none;border:none;color:#475569;font-size:12px;' +
            'cursor:pointer;padding:0 3px;border-radius:5px;transition:all .15s;flex-shrink:0;line-height:1; }' +
        '.pt-tag-del:hover { color:#f87171;background:rgba(239,68,68,.1); }' +
        '.pt-tag-item:hover .pt-tag-del { display:block; }' +
        '.pt-btn-add-cat { margin:4px;padding:6px;font-size:11px; }' +
        '.pt-cat-new-input { width:calc(100% - 8px);margin:4px;box-sizing:border-box;' +
            'background:rgba(0,0,0,.3);border:1px solid rgba(56,189,248,.3);border-radius:6px;' +
            'color:#e2e8f0;padding:6px 8px;font-size:11px;outline:none;font-family:inherit; }' +
        '.pt-cat-new-input:focus { border-color:rgba(56,189,248,.5); }' +
        '.pt-cat-new-input::placeholder { color:#475569; }' +

        /* 分隔条 */
        '.pt-resizer { width:4px;cursor:col-resize;background:transparent;flex-shrink:0;transition:background .15s; }' +
        '.pt-resizer:hover, .pt-resizer:active { background:rgba(56,189,248,.3); }' +

        /* 右侧 */
        '.pt-main { flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden; }' +
        '.pt-add { padding:8px 10px;border-bottom:1px solid rgba(100,160,255,.06);flex-shrink:0; }' +
        '.pt-add-input { width:100%;box-sizing:border-box;background:rgba(0,0,0,.3);' +
            'border:1px solid rgba(100,160,255,.08);border-radius:8px;color:#e2e8f0;' +
            'padding:6px 8px;font-size:11px;resize:none;font-family:inherit;line-height:1.5;' +
            'transition:border-color .15s; }' +
        '.pt-add-input:focus { outline:none;border-color:rgba(56,189,248,.4); }' +
        '.pt-add-input::placeholder { color:#475569; }' +

        /* 列表 */
        '.pt-list { flex:1;overflow-y:auto;min-height:0; }' +
        '.pt-empty { text-align:center;color:#475569;padding:30px 10px;font-size:12px; }' +
        '.pt-item { display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(100,160,255,.03);transition:background .15s; }' +
        '.pt-item:hover { background:rgba(56,189,248,.03); }' +
        '.pt-item-body { display:flex;flex-wrap:wrap;align-items:center;gap:3px;line-height:1.6;min-width:0; }' +
        '.pt-text { color:rgba(255,255,255,.7);word-break:break-all; }' +
        '.pt-slot { background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.2);' +
            'border-radius:5px;padding:1px 6px;color:#38bdf8;width:80px;' +
            'outline:none;transition:border-color .15s;font-family:inherit;flex-shrink:0; }' +
        '.pt-slot:focus { border-color:rgba(56,189,248,.5);background:rgba(56,189,248,.12); }' +
        '.pt-slot::placeholder { color:rgba(56,189,248,.3); }' +
        '.pt-item-left { flex:1;min-width:0; }' +
        '.pt-item-actions { display:flex;flex-direction:row;gap:3px;flex-shrink:0;align-items:center; }' +
        '.pt-copy-btn { padding:2px 8px;background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.2);' +
            'color:#38bdf8;border-radius:5px;cursor:pointer;font-size:9px;transition:all .15s;white-space:nowrap; }' +
        '.pt-copy-btn:hover { background:rgba(56,189,248,.2); }' +
        '.pt-copy-btn:active { transform:scale(0.92); }' +
        '.pt-send-btn { padding:2px 8px;background:rgba(78,204,163,.1);border:1px solid rgba(78,204,163,.2);' +
            'color:#4ecca3;border-radius:5px;cursor:pointer;font-size:9px;transition:all .15s;white-space:nowrap; }' +
        '.pt-send-btn:hover { background:rgba(78,204,163,.2); }' +
        '.pt-send-btn:active { transform:scale(0.92); }' +
        '.pt-del-btn { padding:2px 8px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.15);' +
            'color:#f87171;border-radius:5px;cursor:pointer;font-size:9px;transition:all .15s;white-space:nowrap; }' +
        '.pt-del-btn:hover { background:rgba(239,68,68,.18); }' +
        '.pt-del-btn:active { transform:scale(0.92); }' +

        /* 标签栏 */
        '.pt-item-tags { display:flex;flex-wrap:wrap;gap:3px;margin-top:4px;align-items:center;position:relative; }' +
        '.pt-item-tag { display:inline-flex;align-items:center;gap:2px;padding:2px 8px;' +
            'background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.15);' +
            'border-radius:5px;color:#38bdf8;font-size:11px;cursor:default; }' +
        '.pt-item-tag-del { background:none;border:none;color:#475569;font-size:12px;cursor:pointer;' +
            'padding:0 1px;line-height:1;transition:color .15s; }' +
        '.pt-item-tag-del:hover { color:#f87171; }' +
        '.pt-item-tag-add { background:none;border:1px dashed rgba(100,160,255,.1);border-radius:5px;' +
            'color:#475569;font-size:11px;cursor:pointer;padding:2px 8px;transition:all .15s; }' +
        '.pt-item-tag-add:hover { color:#94a3b8;border-color:rgba(100,160,255,.2); }' +

        /* 标签下拉菜单 */
        '.pt-tag-menu { position:absolute;left:0;bottom:100%;margin-bottom:2px;z-index:10;' +
            'background:rgba(15,20,35,.98);border:1px solid rgba(100,160,255,.1);border-radius:8px;' +
            'box-shadow:0 4px 16px rgba(0,0,0,.5);min-width:80px;overflow:hidden; }' +
        '.pt-tag-menu-item { padding:6px 12px;font-size:11px;color:#cbd5e1;cursor:pointer;transition:background .15s; }' +
        '.pt-tag-menu-item:hover { background:rgba(56,189,248,.12);color:#38bdf8; }' +

        /* 缩放 */
        '.pt-zoom-bar { display:flex;align-items:center;gap:6px;padding:4px 12px;' +
            'border-top:1px solid rgba(100,160,255,.06);flex-shrink:0; }' +
        '.pt-zoom-label { color:#475569;font-size:10px;flex-shrink:0; }' +
        '.pt-zoom-slider { flex:1;-webkit-appearance:none;appearance:none;height:3px;' +
            'background:rgba(56,189,248,.1);border-radius:2px;outline:none;cursor:pointer; }' +
        '.pt-zoom-slider::-webkit-slider-thumb { -webkit-appearance:none;appearance:none;' +
            'width:12px;height:12px;border-radius:50%;background:rgba(56,189,248,.4);' +
            'border:1px solid rgba(56,189,248,.3);cursor:pointer; }' +

        /* 拖拽手柄 */
        '.pt-resize-handle { position:absolute;right:0;bottom:0;width:16px;height:16px;' +
            'cursor:nwse-resize;z-index:10; }' +
        '.pt-resize-handle::before { content:"";position:absolute;right:3px;bottom:3px;' +
            'width:8px;height:8px;border-right:2px solid rgba(100,160,255,.2);border-bottom:2px solid rgba(100,160,255,.2); }' +

        /* 滚动条 */
        '.pt-list::-webkit-scrollbar, .pt-tag-list::-webkit-scrollbar { width:3px; }' +
        '.pt-list::-webkit-scrollbar-thumb, .pt-tag-list::-webkit-scrollbar-thumb { background:rgba(56,189,248,.15);border-radius:2px; }' +

        /* 通用按钮 */
        '.pt-btn { padding:3px 10px;background:rgba(56,189,248,.06);border:1px solid rgba(100,160,255,.08);' +
            'color:#94a3b8;border-radius:7px;cursor:pointer;font-size:10px;transition:all .15s; }' +
        '.pt-btn:hover { background:rgba(56,189,248,.1);color:#e2e8f0; }' +
        '.pt-btn:active { transform:scale(0.92); }' +
        '.pt-btn-primary { background:rgba(56,189,248,.15);border-color:rgba(56,189,248,.25);color:#38bdf8; }' +
        '.pt-btn-primary:hover { background:rgba(56,189,248,.28); }' +
        '.pt-btn-add-cat { background:rgba(56,189,248,.03);border:1px dashed rgba(100,160,255,.1);color:#64748b; }' +
        '.pt-btn-add-cat:hover { background:rgba(56,189,248,.06);color:#94a3b8; }';

    document.head.appendChild(s);
})();
