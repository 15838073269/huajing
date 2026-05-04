/**
 * 导航网址插件 - 画境 v65
 *
 * - 左侧标签筛选（可增删）
 * - 右侧网格展示网址卡片，点击直接打开
 * - 添加：输入名字 + 网址
 * - 每条可打标签、删除
 * - 标签与列表之间可拖拽调整比例
 * - 右下角拖拽调整面板大小
 * - 切换插件后面板不关闭
 * - 全部数据持久化到 IndexedDB
 */

var NavBookmarksSkill = {

    id: 'nav-bookmarks',
    name: '导航',
    icon: '航',
    description: '导航网址收藏，标签分类',
    key: 'n',

    _world: null,
    _managerEl: null,
    _bookmarks: [],   // [{ name: '...', url: '...', tags: [] }]
    _tags: [],
    _activeTag: null,
    _sidebarWidth: 120,
    _panelX: null,
    _panelY: null,
    _panelW: 520,
    _panelH: 460,
    _DB_NAME: 'NavBookmarksDB',
    _DB_STORE: 'data',
    _DB_VERSION: 1,

    activate: function(world) {
        this._world = world;
        var self = this;
        this._loadData(function() {
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
                        self._bookmarks = get.result.bookmarks || [];
                        self._tags = get.result.tags || [];
                        self._activeTag = get.result.activeTag != null ? get.result.activeTag : null;
                        self._sidebarWidth = get.result.sidebarWidth || 120;
                        self._panelX = get.result.panelX;
                        self._panelY = get.result.panelY;
                        self._panelW = get.result.panelW || 520;
                        self._panelH = get.result.panelH || 460;
                    }
                    if (cb) cb();
                };
                get.onerror = function() { if (cb) cb(); };
            } catch(err) { if (cb) cb(); }
        };
        req.onerror = function() { if (cb) cb(); };
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
                    bookmarks: self._bookmarks,
                    tags: self._tags,
                    activeTag: self._activeTag,
                    sidebarWidth: self._sidebarWidth,
                    panelX: self._panelX,
                    panelY: self._panelY,
                    panelW: self._panelW,
                    panelH: self._panelH
                }, 'all');
            } catch(err) {}
        };
    },

    // ===== 面板 =====

    _toggleManager: function() {
        if (this._managerEl) {
            this._managerEl.style.display = this._managerEl.style.display === 'none' ? 'flex' : 'none';
            return;
        }
        if (!this._world) return;
        this._createManager();
    },

    _createManager: function() {
        var self = this;
        var panel = document.createElement('div');
        panel.className = 'nb-manager';
        panel.innerHTML =
            '<div class="nb-mgr-header">' +
                '<span>导航网址</span>' +
                '<div class="nb-mgr-header-btns">' +
                    '<button class="nb-hdr-btn" id="nbImport" title="导入">导入</button>' +
                    '<button class="nb-hdr-btn" id="nbExport" title="导出">导出</button>' +
                    '<button class="nb-hdr-btn nb-hdr-danger" id="nbClear" title="清空全部">清空</button>' +
                    '<button class="nb-mgr-close" id="nbClose">&times;</button>' +
                '</div>' +
            '</div>' +
            '<div class="nb-mgr-body">' +
                '<div class="nb-sidebar" id="nbSidebar"></div>' +
                '<div class="nb-resizer" id="nbResizer"></div>' +
                '<div class="nb-main">' +
                    '<div class="nb-add">' +
                        '<div class="nb-add-row">' +
                            '<input type="text" class="nb-add-input" id="nbAddName" placeholder="名称">' +
                            '<input type="text" class="nb-add-input" id="nbAddUrl" placeholder="网址 https://...">' +
                            '<button class="nb-btn nb-btn-primary" id="nbAddBtn">添加</button>' +
                        '</div>' +
                    '</div>' +
                    '<div class="nb-grid" id="nbGrid"></div>' +
                '</div>' +
            '</div>' +
            '<div class="nb-resize-handle" id="nbResizeHandle"></div>' +
            '<input type="file" id="nbFileInput" accept=".json,.txt" style="display:none">';

        document.body.appendChild(panel);
        this._managerEl = panel;
        panel.style.width = this._panelW + 'px';
        panel.style.height = this._panelH + 'px';

        if (this._panelX !== null && this._panelY !== null) {
            panel.style.left = this._panelX + 'px';
            panel.style.top = this._panelY + 'px';
        } else {
            panel.style.left = (window.innerWidth - 540) + 'px';
            panel.style.top = (window.innerHeight - 520) + 'px';
        }
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';

        this._initPanelDrag(panel);
        this._initResizer(panel);
        // 使用通用窗口缩放（四角+四边）
        if (typeof SkillSystem !== 'undefined' && SkillSystem.WindowHelper) {
            WindowHelper.makeResizable(panel, { minWidth: 300, minHeight: 250, storeKey: 'nb-window-rect' });
        }

        panel.querySelector('#nbClose').addEventListener('click', function() {
            panel.style.display = 'none';
        });

        // 添加
        panel.querySelector('#nbAddBtn').addEventListener('click', function() { self._addBookmark(); });
        panel.querySelector('#nbAddUrl').addEventListener('keydown', function(e) {
            if (e.key === 'Enter') self._addBookmark();
        });

        // 导入
        var fileInput = panel.querySelector('#nbFileInput');
        panel.querySelector('#nbImport').addEventListener('click', function() { fileInput.click(); });
        fileInput.addEventListener('change', function(e) {
            if (!e.target.files[0]) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    var data = JSON.parse(ev.target.result);
                    if (Array.isArray(data)) {
                        var count = 0;
                        data.forEach(function(item) {
                            if (item.name && item.url) {
                                self._bookmarks.unshift({ name: item.name, url: item.url, tags: item.tags || [] });
                                count++;
                            }
                        });
                        self._saveData(); self._renderSidebar(); self._renderGrid(); self._showToast('已导入 ' + count + ' 条');
                    }
                } catch(err) {
                    self._showToast('导入失败，请使用 JSON 格式');
                }
                fileInput.value = '';
            };
            reader.readAsText(e.target.files[0]);
        });

        // 导出
        panel.querySelector('#nbExport').addEventListener('click', function() {
            var blob = new Blob([JSON.stringify(self._bookmarks, null, 2)], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url; a.download = 'nav-bookmarks.json'; a.click();
            URL.revokeObjectURL(url);
        });

        // 清空
        panel.querySelector('#nbClear').addEventListener('click', function() {
            if (!self._bookmarks.length) return;
            if (!confirm('确定清空所有网址？')) return;
            self._bookmarks = [];
            self._saveData(); self._renderSidebar(); self._renderGrid(); self._showToast('已清空');
        });

        this._renderSidebar();
        this._renderGrid();
    },

    // ===== 面板拖拽 =====

    _initPanelDrag: function(panel) {
        var self = this;
        var dragging = false, offsetX, offsetY;
        var header = panel.querySelector('.nb-mgr-header');
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
        var resizer = panel.querySelector('#nbResizer');
        var sidebar = panel.querySelector('#nbSidebar');
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
        var handle = panel.querySelector('#nbResizeHandle');
        var dragging = false, startX, startY, startW, startH;
        handle.addEventListener('mousedown', function(e) {
            dragging = true; startX = e.clientX; startY = e.clientY;
            startW = panel.offsetWidth; startH = panel.offsetHeight;
            e.preventDefault(); e.stopPropagation();
        });
        document.addEventListener('mousemove', function(e) {
            if (!dragging) return;
            panel.style.width = Math.max(360, startW + (e.clientX - startX)) + 'px';
            panel.style.height = Math.max(280, startH + (e.clientY - startY)) + 'px';
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

    // ===== 左侧标签 =====

    _renderSidebar: function() {
        var sidebar = this._managerEl.querySelector('#nbSidebar');
        if (!sidebar) return;
        var self = this;
        sidebar.style.width = this._sidebarWidth + 'px';

        var html = '<div class="nb-tag-list">';
        var allActive = this._activeTag === null ? ' active' : '';
        html += '<div class="nb-tag-item' + allActive + '" data-tag="__all__">' +
            '<span class="nb-tag-name">全部</span>' +
            '<span class="nb-tag-count">' + this._bookmarks.length + '</span>' +
        '</div>';
        this._tags.forEach(function(tag) {
            var active = self._activeTag === tag ? ' active' : '';
            var count = self._bookmarks.filter(function(b) { return b.tags.indexOf(tag) >= 0; }).length;
            html += '<div class="nb-tag-item' + active + '" data-tag="' + self._escapeAttr(tag) + '">' +
                '<span class="nb-tag-name">' + self._escapeHtml(tag) + '</span>' +
                '<span class="nb-tag-count">' + count + '</span>' +
                '<button class="nb-tag-del" data-tag="' + self._escapeAttr(tag) + '" title="删除标签">&times;</button>' +
            '</div>';
        });
        html += '</div>';
        html += '<button class="nb-btn nb-btn-add-tag" id="nbAddTag">+ 新标签</button>';
        sidebar.innerHTML = html;

        // 点击筛选
        sidebar.querySelectorAll('.nb-tag-item').forEach(function(item) {
            item.addEventListener('click', function(e) {
                if (e.target.closest('.nb-tag-del')) return;
                var tag = this.dataset.tag;
                self._activeTag = tag === '__all__' ? null : tag;
                self._saveData();
                self._renderSidebar();
                self._renderGrid();
            });
        });

        // 删除标签
        sidebar.querySelectorAll('.nb-tag-del').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var tag = this.dataset.tag;
                if (!confirm('删除标签「' + tag + '」？')) return;
                self._tags = self._tags.filter(function(t) { return t !== tag; });
                self._bookmarks.forEach(function(b) {
                    b.tags = b.tags.filter(function(t) { return t !== tag; });
                });
                if (self._activeTag === tag) self._activeTag = null;
                self._saveData();
                self._renderSidebar();
                self._renderGrid();
            });
        });

        // 新增标签
        sidebar.querySelector('#nbAddTag').addEventListener('click', function() {
            var btn = this;
            btn.style.display = 'none';
            var input = document.createElement('input');
            input.type = 'text';
            input.className = 'nb-tag-input';
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

    // ===== 网格 =====

    _getFiltered: function() {
        if (this._activeTag === null) return this._bookmarks;
        var tag = this._activeTag;
        return this._bookmarks.filter(function(b) { return b.tags.indexOf(tag) >= 0; });
    },

    _addBookmark: function() {
        var nameEl = this._managerEl.querySelector('#nbAddName');
        var urlEl = this._managerEl.querySelector('#nbAddUrl');
        var name = nameEl.value.trim();
        var url = urlEl.value.trim();
        if (!name || !url) { this._showToast('请输入名称和网址'); return; }
        if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
        this._bookmarks.unshift({ name: name, url: url, tags: [] });
        this._saveData();
        nameEl.value = '';
        urlEl.value = '';
        nameEl.focus();
        this._renderSidebar();
        this._renderGrid();
    },

    _renderGrid: function() {
        var grid = this._managerEl.querySelector('#nbGrid');
        if (!grid) return;
        var self = this;
        var filtered = this._getFiltered();

        if (!filtered.length) {
            grid.innerHTML = '<div class="nb-empty">暂无网址</div>';
            return;
        }

        var html = '';
        filtered.forEach(function(bm) {
            var realIdx = self._bookmarks.indexOf(bm);
            var shortUrl = bm.url.replace(/^https?:\/\//, '').replace(/\/$/, '');
            if (shortUrl.length > 30) shortUrl = shortUrl.slice(0, 30) + '...';

            html += '<div class="nb-card" data-idx="' + realIdx + '">';
            html += '<a class="nb-card-link" href="' + self._escapeAttr(bm.url) + '" target="_blank" rel="noopener" title="' + self._escapeAttr(bm.url) + '">';
            html += '<div class="nb-card-name">' + self._escapeHtml(bm.name) + '</div>';
            html += '<div class="nb-card-url">' + self._escapeHtml(shortUrl) + '</div>';
            html += '</a>';
            // 标签
            html += '<div class="nb-card-tags">';
            bm.tags.forEach(function(tag) {
                html += '<span class="nb-card-tag">' + self._escapeHtml(tag) +
                    '<button class="nb-card-tag-del" data-idx="' + realIdx + '" data-tag="' + self._escapeAttr(tag) + '">&times;</button>' +
                '</span>';
            });
            html += '<button class="nb-card-tag-add" data-idx="' + realIdx + '">+</button>';
            html += '</div>';
            // 删除
            html += '<button class="nb-card-del" data-idx="' + realIdx + '" title="删除">&times;</button>';
            html += '</div>';
        });
        grid.innerHTML = html;

        // 删除网址
        grid.querySelectorAll('.nb-card-del').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                var idx = parseInt(this.dataset.idx);
                self._bookmarks.splice(idx, 1);
                self._saveData();
                self._renderSidebar();
                self._renderGrid();
            });
        });

        // 移除标签
        grid.querySelectorAll('.nb-card-tag-del').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                var idx = parseInt(this.dataset.idx);
                var tag = this.dataset.tag;
                self._bookmarks[idx].tags = self._bookmarks[idx].tags.filter(function(t) { return t !== tag; });
                self._saveData();
                self._renderSidebar();
                self._renderGrid();
            });
        });

        // 添加标签
        grid.querySelectorAll('.nb-card-tag-add').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                var idx = parseInt(this.dataset.idx);
                var bm = self._bookmarks[idx];
                var available = self._tags.filter(function(t) { return bm.tags.indexOf(t) < 0; });
                if (!available.length) { self._showToast('所有标签都已添加'); return; }
                var menu = document.createElement('div');
                menu.className = 'nb-tag-menu';
                available.forEach(function(tag) {
                    var item = document.createElement('div');
                    item.className = 'nb-tag-menu-item';
                    item.textContent = tag;
                    item.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        bm.tags.push(tag);
                        self._saveData();
                        self._renderSidebar();
                        self._renderGrid();
                        menu.remove();
                    });
                    menu.appendChild(item);
                });
                btn.parentNode.appendChild(menu);
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
        '.nb-manager { position:fixed;z-index:99998;' +
            'background:rgba(20,20,30,.95);color:#eee;border-radius:12px;' +
            'box-shadow:0 8px 32px rgba(0,0,0,.6);overflow:hidden;' +
            'border:1px solid rgba(255,255,255,.08);' +
            'display:flex;flex-direction:column;user-select:none; }' +
        '.nb-mgr-header { display:flex;justify-content:space-between;align-items:center;' +
            'padding:8px 14px;background:rgba(255,180,50,.1);border-bottom:1px solid rgba(255,180,50,.15);' +
            'cursor:move;font-size:13px;font-weight:600;color:#e2e8f0;flex-shrink:0; }' +
        '.nb-mgr-header-btns { display:flex;align-items:center;gap:4px; }' +
        '.nb-hdr-btn { padding:2px 8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);' +
            'color:#94a3b8;border-radius:4px;cursor:pointer;font-size:10px;transition:all .15s; }' +
        '.nb-hdr-btn:hover { background:rgba(255,255,255,.12);color:#e2e8f0; }' +
        '.nb-hdr-danger { color:#f87171;border-color:rgba(239,68,68,.15); }' +
        '.nb-hdr-danger:hover { background:rgba(239,68,68,.12);color:#fca5a5; }' +
        '.nb-mgr-close { background:none;border:none;color:#888;font-size:16px;cursor:pointer;padding:0 2px;' +
            'line-height:1;transition:color .15s; }' +
        '.nb-mgr-close:hover { color:#f87171; }' +

        /* 主体 */
        '.nb-mgr-body { flex:1;display:flex;overflow:hidden;min-height:0; }' +
        '.nb-sidebar { width:120px;flex-shrink:0;display:flex;flex-direction:column;' +
            'border-right:1px solid rgba(255,255,255,.06);background:rgba(0,0,0,.15); }' +
        '.nb-tag-list { flex:1;overflow-y:auto;padding:4px 0; }' +
        '.nb-tag-item { display:flex;align-items:center;justify-content:space-between;' +
            'padding:7px 12px;cursor:pointer;transition:all .15s;font-size:12px;color:#94a3b8;gap:4px; }' +
        '.nb-tag-item:hover { background:rgba(255,255,255,.05);color:#cbd5e1; }' +
        '.nb-tag-item.active { background:rgba(255,180,50,.1);color:#fbbf24;border-right:2px solid #fbbf24; }' +
        '.nb-tag-name { flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }' +
        '.nb-tag-count { font-size:10px;color:#475569;background:rgba(255,255,255,.05);' +
            'padding:1px 6px;border-radius:8px;flex-shrink:0; }' +
        '.nb-tag-del { display:none;background:none;border:none;color:#475569;font-size:12px;' +
            'cursor:pointer;padding:0 3px;border-radius:3px;transition:all .15s;flex-shrink:0;line-height:1; }' +
        '.nb-tag-del:hover { color:#f87171;background:rgba(239,68,68,.1); }' +
        '.nb-tag-item:hover .nb-tag-del { display:block; }' +
        '.nb-btn-add-tag { margin:4px;padding:6px;font-size:11px; }' +
        '.nb-tag-input { width:calc(100% - 8px);margin:4px;box-sizing:border-box;' +
            'background:rgba(0,0,0,.3);border:1px solid rgba(255,180,50,.3);border-radius:4px;' +
            'color:#e2e8f0;padding:6px 8px;font-size:11px;outline:none;font-family:inherit; }' +
        '.nb-tag-input:focus { border-color:rgba(255,180,50,.5); }' +
        '.nb-tag-input::placeholder { color:#475569; }' +

        /* 分隔条 */
        '.nb-resizer { width:4px;cursor:col-resize;background:transparent;flex-shrink:0;transition:background .15s; }' +
        '.nb-resizer:hover, .nb-resizer:active { background:rgba(255,180,50,.3); }' +

        /* 右侧 */
        '.nb-main { flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden; }' +
        '.nb-add { padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.06);flex-shrink:0; }' +
        '.nb-add-row { display:flex;gap:6px; }' +
        '.nb-add-input { flex:1;min-width:0;background:rgba(0,0,0,.3);' +
            'border:1px solid rgba(255,255,255,.08);border-radius:6px;color:#e2e8f0;' +
            'padding:6px 8px;font-size:11px;font-family:inherit;transition:border-color .15s; }' +
        '.nb-add-input:focus { outline:none;border-color:rgba(255,180,50,.4); }' +
        '.nb-add-input::placeholder { color:#475569; }' +

        /* 网格 */
        '.nb-grid { flex:1;overflow-y:auto;padding:8px;display:grid;' +
            'grid-template-columns:repeat(auto-fill, minmax(140px, 1fr));' +
            'gap:8px;align-content:start; }' +
        '.nb-empty { grid-column:1/-1;text-align:center;color:#475569;padding:30px 10px;font-size:12px; }' +

        /* 卡片 */
        '.nb-card { background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);' +
            'border-radius:8px;padding:10px;position:relative;transition:all .15s;overflow:hidden; }' +
        '.nb-card:hover { background:rgba(255,255,255,.06);border-color:rgba(255,180,50,.15); }' +
        '.nb-card-link { display:block;text-decoration:none;color:inherit;cursor:pointer; }' +
        '.nb-card-name { font-size:12px;font-weight:600;color:#e2e8f0;margin-bottom:4px;' +
            'overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }' +
        '.nb-card-url { font-size:10px;color:#64748b;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }' +
        '.nb-card-del { position:absolute;top:4px;right:4px;background:none;border:none;' +
            'color:#475569;font-size:13px;cursor:pointer;padding:2px 4px;border-radius:3px;' +
            'transition:all .15s;line-height:1;display:none; }' +
        '.nb-card:hover .nb-card-del { display:block; }' +
        '.nb-card-del:hover { color:#f87171;background:rgba(239,68,68,.1); }' +

        /* 卡片标签 */
        '.nb-card-tags { display:flex;flex-wrap:wrap;gap:3px;margin-top:6px;align-items:center;position:relative; }' +
        '.nb-card-tag { display:inline-flex;align-items:center;gap:2px;padding:1px 6px;' +
            'background:rgba(255,180,50,.08);border:1px solid rgba(255,180,50,.15);' +
            'border-radius:3px;color:#fbbf24;font-size:10px;cursor:default; }' +
        '.nb-card-tag-del { background:none;border:none;color:#475569;font-size:11px;cursor:pointer;' +
            'padding:0 1px;line-height:1;transition:color .15s; }' +
        '.nb-card-tag-del:hover { color:#f87171; }' +
        '.nb-card-tag-add { background:none;border:1px dashed rgba(255,255,255,.1);border-radius:3px;' +
            'color:#475569;font-size:10px;cursor:pointer;padding:1px 5px;transition:all .15s; }' +
        '.nb-card-tag-add:hover { color:#94a3b8;border-color:rgba(255,255,255,.2); }' +

        /* 标签下拉菜单 */
        '.nb-tag-menu { position:absolute;left:0;bottom:100%;margin-bottom:2px;z-index:10;' +
            'background:rgba(30,30,40,.98);border:1px solid rgba(255,255,255,.1);border-radius:6px;' +
            'box-shadow:0 4px 16px rgba(0,0,0,.5);min-width:80px;overflow:hidden; }' +
        '.nb-tag-menu-item { padding:6px 12px;font-size:11px;color:#cbd5e1;cursor:pointer;transition:background .15s; }' +
        '.nb-tag-menu-item:hover { background:rgba(255,180,50,.12);color:#fbbf24; }' +

        /* 拖拽手柄 */
        '.nb-resize-handle { position:absolute;right:0;bottom:0;width:16px;height:16px;' +
            'cursor:nwse-resize;z-index:10; }' +
        '.nb-resize-handle::before { content:"";position:absolute;right:3px;bottom:3px;' +
            'width:8px;height:8px;border-right:2px solid rgba(255,255,255,.2);border-bottom:2px solid rgba(255,255,255,.2); }' +

        /* 滚动条 */
        '.nb-grid::-webkit-scrollbar, .nb-tag-list::-webkit-scrollbar { width:3px; }' +
        '.nb-grid::-webkit-scrollbar-thumb, .nb-tag-list::-webkit-scrollbar-thumb { background:rgba(255,255,255,.08);border-radius:2px; }' +

        /* 通用按钮 */
        '.nb-btn { padding:3px 10px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);' +
            'color:#94a3b8;border-radius:5px;cursor:pointer;font-size:10px;transition:all .15s; }' +
        '.nb-btn:hover { background:rgba(255,255,255,.1);color:#e2e8f0; }' +
        '.nb-btn-primary { background:rgba(255,180,50,.15);border-color:rgba(255,180,50,.25);color:#fbbf24; }' +
        '.nb-btn-primary:hover { background:rgba(255,180,50,.28); }' +
        '.nb-btn-add-tag { background:rgba(255,255,255,.03);border:1px dashed rgba(255,255,255,.1);color:#64748b; }' +
        '.nb-btn-add-tag:hover { background:rgba(255,255,255,.06);color:#94a3b8; }';

    document.head.appendChild(s);
})();
