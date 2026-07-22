/**
 * 信仰语录插件 - 画境 v67
 *
 * - 顶部透明公告栏，只显示语录文字
 * - 每 60 秒自动随机切换
 * - 管理面板：添加/删除/导入/导出
 * - 数据保存到 IndexedDB
 * - UI 使用公共 CosUI.pwin 组件
 */

var MaoQuotesSkill = {

    id: 'mao-quotes',
    name: '信仰语录',
    icon: '<span style="color:#38bdf8;">语</span>',
    description: '顶部公告栏，每60秒随机展示一条语录',
    key: 'm',

    _world: null,
    _timer: null,
    _currentIndex: -1,
    _isPlaying: false,
    _cardEl: null,
    _managerEl: null,
    _interval: 60000,
    _quotes: [],
    _STORAGE_KEY: 'mao-quotes-data',
    _DB_NAME: 'MaoQuotesDB',
    _DB_STORE: 'quotes',
    _DB_VERSION: 1,

    activate: function(world) {
        this._world = world;
        var self = this;
        this._loadQuotes(function() {
            if (!self._quotes.length) {
                self._quotes = (typeof MAO_QUOTES !== 'undefined') ? MAO_QUOTES.slice() : [];
                self._saveQuotes();
            }
            if (!self._cardEl) {
                self._createCard();
                self._showRandom();
                self._startTimer();
            }
            // 直接弹出管理面板
            if (self._managerEl) {
                self._managerEl.remove();
                self._managerEl = null;
            }
            self._createManager();
            SkillSystem.renderSubTools();
        });
    },

    deactivate: function() {},

    getSubTools: function() {
        var self = this;
        return [
            { label: '管理', action: function() { self._toggleManager(); } }
        ];
    },

    save: function() {
        return { currentIndex: this._currentIndex, isPlaying: this._isPlaying };
    },

    load: function(data) {
        if (data) {
            this._isPlaying = data.isPlaying || false;
            this._currentIndex = data.currentIndex || -1;
        }
    },

    // ===== 数据持久化 =====

    _loadQuotes: function(cb) {
        var self = this;
        // 先尝试从 localStorage 迁移旧数据
        try {
            var old = localStorage.getItem(this._STORAGE_KEY);
            if (old) {
                var raw = JSON.parse(old);
                this._quotes = raw.map(function(q) {
                    return typeof q === 'string' ? q : (q.text || '');
                }).filter(function(q) { return q; });
                localStorage.removeItem(this._STORAGE_KEY);
                this._saveQuotes();
                if (cb) cb();
                return;
            }
        } catch(e) {}

        // 从 IndexedDB 读取
        var req = indexedDB.open(this._DB_NAME, this._DB_VERSION);
        req.onupgradeneeded = function(e) {
            e.target.result.createObjectStore(self._DB_STORE);
        };
        req.onsuccess = function(e) {
            var db = e.target.result;
            try {
                var tx = db.transaction(self._DB_STORE, 'readonly');
                var store = tx.objectStore(self._DB_STORE);
                var get = store.get('all');
                get.onsuccess = function() {
                    if (get.result) {
                        self._quotes = get.result;
                    } else if (typeof MAO_QUOTES !== 'undefined') {
                        self._quotes = MAO_QUOTES.slice();
                        self._saveQuotes();
                    }
                    if (cb) cb();
                };
                get.onerror = function() {
                    self._quotes = (typeof MAO_QUOTES !== 'undefined') ? MAO_QUOTES.slice() : [];
                    if (cb) cb();
                };
            } catch(err) {
                self._quotes = (typeof MAO_QUOTES !== 'undefined') ? MAO_QUOTES.slice() : [];
                if (cb) cb();
            }
        };
        req.onerror = function() {
            self._quotes = (typeof MAO_QUOTES !== 'undefined') ? MAO_QUOTES.slice() : [];
            if (cb) cb();
        };
    },

    _saveQuotes: function() {
        var self = this;
        var req = indexedDB.open(this._DB_NAME, this._DB_VERSION);
        req.onupgradeneeded = function(e) {
            e.target.result.createObjectStore(self._DB_STORE);
        };
        req.onsuccess = function(e) {
            var db = e.target.result;
            try {
                var tx = db.transaction(self._DB_STORE, 'readwrite');
                tx.objectStore(self._DB_STORE).put(self._quotes, 'all');
            } catch(err) {}
        };
    },

    // ===== 公告栏 =====

    _createCard: function() {
        var card = document.createElement('div');
        card.className = 'mq-card';
        card.innerHTML = '<div class="mq-text" id="mqText"></div>';
        document.body.appendChild(card);
        this._cardEl = card;
    },

    _showRandom: function() {
        if (!this._quotes.length) return;
        var idx;
        if (this._quotes.length === 1) {
            idx = 0;
        } else {
            do { idx = Math.floor(Math.random() * this._quotes.length); }
            while (idx === this._currentIndex);
        }
        this._currentIndex = idx;
        this._displayQuote(this._quotes[idx]);
    },

    _displayQuote: function(quote) {
        if (!this._cardEl) return;
        var self = this;
        var textEl = this._cardEl.querySelector('#mqText');
        this._cardEl.classList.add('mq-fade-out');
        setTimeout(function() {
            textEl.textContent = typeof quote === 'string' ? quote : quote.text;
            self._cardEl.classList.remove('mq-fade-out');
        }, 300);
    },

    _startTimer: function() {
        this._stopTimer();
        this._isPlaying = true;
        var self = this;
        this._timer = setInterval(function() { self._showRandom(); }, this._interval);
    },

    _stopTimer: function() {
        if (this._timer) { clearInterval(this._timer); this._timer = null; }
        this._isPlaying = false;
    },

    // ===== 管理面板 =====

    _toggleManager: function() {
        if (this._managerEl) {
            this._managerEl.remove();
            this._managerEl = null;
            return;
        }
        this._createManager();
    },

    _createManager: function() {
        var self = this;

        // 使用公共窗口组件
        var win = CosUI.pwin.create({
            title: '语录管理 (' + this._quotes.length + ' 条)',
            skillId: this.id,
            storeKey: 'mq-win-rect',
            width: 340,
            height: 420,
            minWidth: 260,
            minHeight: 280,
            onClose: function() {
                self._managerEl = null;
            }
        });

        var ov = win.overlay;
        this._managerEl = ov;

        // 去掉阴影、边框、轮廓（提升性能）
        ov.style.boxShadow = 'none';
        ov.style.border = 'none';
        ov.style.outline = 'none';
        ov.style.borderRadius = '4px';

        // 构建内容
        var body = win.bodyEl;
        body.style.padding = '0';
        body.style.overflow = 'hidden';
        body.innerHTML = '';

        // 添加区域
        var addSection = document.createElement('div');
        addSection.style.cssText =
            'padding:8px 10px;border-bottom:1px solid var(--cos-border);flex-shrink:0;';

        var textarea = document.createElement('textarea');
        textarea.className = 'cos-ptextarea';
        textarea.id = 'mqMgrText';
        textarea.placeholder = '输入语录，一行一条，支持批量添加...';
        textarea.style.cssText =
            'width:100%;box-sizing:border-box;font-size:12px;resize:vertical;min-height:48px;';
        addSection.appendChild(textarea);

        var addBtn = CosUI.button.primary('添加语录', function() {
            var raw = body.querySelector('#mqMgrText').value.trim();
            if (!raw) return;
            var lines = raw.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l; });
            if (!lines.length) return;
            lines.forEach(function(line) { self._quotes.unshift(line); });
            self._saveQuotes();
            textarea.value = '';
            self._renderManagerList();
            self._updateMgrCount();
            showToast('已添加 ' + lines.length + ' 条');
        });
        addBtn.style.cssText = 'width:100%;margin-top:6px;';
        addSection.appendChild(addBtn);
        body.appendChild(addSection);

        // 列表区域
        var listWrap = document.createElement('div');
        listWrap.id = 'mqMgrList';
        listWrap.className = 'cos-pscroll';
        listWrap.style.cssText =
            'flex:1;overflow-y:auto;min-height:0;';
        body.appendChild(listWrap);

        // 底部操作栏
        var actionsBar = document.createElement('div');
        actionsBar.style.cssText =
            'display:flex;gap:4px;padding:6px 10px;border-top:1px solid var(--cos-border);flex-shrink:0;';

        var importBtn = CosUI.button.secondary('导入', null, { size: 'sm' });
        importBtn.style.flex = '1';
        importBtn.addEventListener('click', function() { fileInput.click(); });
        actionsBar.appendChild(importBtn);

        var exportBtn = CosUI.button.secondary('导出', null, { size: 'sm' });
        exportBtn.style.flex = '1';
        exportBtn.addEventListener('click', function() {
            var blob = new Blob([JSON.stringify(self._quotes, null, 2)], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url; a.download = 'mao-quotes.json'; a.click();
            URL.revokeObjectURL(url);
        });
        actionsBar.appendChild(exportBtn);

        var clearBtn = CosUI.button.danger('清空', null, { size: 'sm' });
        clearBtn.style.flex = '1';
        clearBtn.addEventListener('click', function() {
            if (!self._quotes.length) return;
            self._quotes = [];
            self._saveQuotes();
            self._renderManagerList();
            self._updateMgrCount();
            showToast('已清空');
        });
        actionsBar.appendChild(clearBtn);
        body.appendChild(actionsBar);

        // 隐藏文件输入
        var fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = '.json,.txt';
        fileInput.style.display = 'none';
        fileInput.addEventListener('change', function(e) {
            if (!e.target.files[0]) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    var data = JSON.parse(ev.target.result);
                    if (Array.isArray(data)) {
                        var count = 0;
                        data.forEach(function(item) {
                            var t = typeof item === 'string' ? item : (item.text || '');
                            if (t) { self._quotes.unshift(t); count++; }
                        });
                        self._saveQuotes();
                        self._renderManagerList();
                        self._updateMgrCount();
                        showToast('已导入 ' + count + ' 条');
                    }
                } catch(err) {
                    var lines = ev.target.result.split('\n').filter(function(l) { return l.trim(); });
                    lines.forEach(function(line) { self._quotes.unshift(line.trim()); });
                    self._saveQuotes();
                    self._renderManagerList();
                    self._updateMgrCount();
                    showToast('已导入 ' + lines.length + ' 条');
                }
                fileInput.value = '';
            };
            reader.readAsText(e.target.files[0]);
        });
        body.appendChild(fileInput);

        this._renderManagerList();
    },

    _renderManagerList: function() {
        if (!this._managerEl) return;
        var list = this._managerEl.querySelector('#mqMgrList');
        if (!list) return;
        var self = this;

        if (!this._quotes.length) {
            list.innerHTML = '<div style="text-align:center;color:var(--cos-text-dim);padding:24px;font-size:12px;">暂无语录</div>';
            return;
        }

        list.innerHTML = '';
        this._quotes.forEach(function(q, i) {
            var text = typeof q === 'string' ? q : q.text;
            var short = text.length > 60 ? text.slice(0, 60) + '...' : text;

            var item = document.createElement('div');
            item.className = 'mq-item';
            item.dataset.idx = i;
            item.style.cssText =
                'display:flex;align-items:center;padding:6px 10px;' +
                'border-bottom:1px solid rgba(100,160,255,0.04);gap:2px;' +
                'transition:background 0.12s;';
            item.addEventListener('mouseenter', function() { item.style.background = 'rgba(56,189,248,0.04)'; });
            item.addEventListener('mouseleave', function() { item.style.background = ''; });

            // 文字（点击展示）
            var textEl = document.createElement('div');
            textEl.style.cssText =
                'flex:1;font-size:11px;color:var(--cos-text);line-height:1.4;' +
                'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;';
            textEl.textContent = short;
            textEl.title = text;
            textEl.addEventListener('click', function() {
                self._currentIndex = i;
                self._displayQuote(self._quotes[i]);
            });
            item.appendChild(textEl);

            // 删除按钮
            var delBtn = document.createElement('span');
            delBtn.innerHTML = '\u00D7'; // ×
            delBtn.title = '删除';
            delBtn.style.cssText =
                'width:22px;height:22px;display:flex;align-items:center;justify-content:center;' +
                'border-radius:4px;cursor:pointer;color:var(--cos-text-dim);font-size:14px;' +
                'flex-shrink:0;transition:all 0.12s;';
            delBtn.addEventListener('mouseenter', function() {
                delBtn.style.background = 'rgba(248,113,113,0.15)';
                delBtn.style.color = 'var(--cos-red)';
            });
            delBtn.addEventListener('mouseleave', function() {
                delBtn.style.background = '';
                delBtn.style.color = 'var(--cos-text-dim)';
            });
            delBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                self._quotes.splice(i, 1);
                self._saveQuotes();
                self._renderManagerList();
                self._updateMgrCount();
            });
            item.appendChild(delBtn);

            list.appendChild(item);
        });
    },

    _updateMgrCount: function() {
        if (!this._managerEl) return;
        var titleEl = this._managerEl.querySelector('.cos-pwin-hdr-title');
        if (titleEl) titleEl.textContent = '语录管理 (' + this._quotes.length + ' 条)';
    }
};

/* ===== 样式（仅保留公告栏，管理面板使用公共 cos-pwin 样式） ===== */
(function() {
    var s = document.createElement('style');
    s.textContent =
        /* 公告栏 - 顶部透明 */
        '.mq-card { position:fixed;top:0;left:50%;transform:translateX(-50%);' +
            'width:700px;max-width:90vw;z-index:99998;' +
            'padding:12px 24px;text-align:center;' +
            'color:rgba(255,255,255,.85);font-size:15px;line-height:1.8;' +
            'background:linear-gradient(180deg,rgba(0,0,0,.35) 0%,rgba(0,0,0,0) 100%);' +
            'pointer-events:none;user-select:none;' +
            'transition:opacity .3s; }' +
        '.mq-card.mq-fade-out { opacity:0; }';
    document.head.appendChild(s);
})();
