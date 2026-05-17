/**
 * 毛选语录插件 - 画境 v65
 *
 * - 顶部透明公告栏，只显示语录文字
 * - 每 60 秒自动随机切换
 * - 管理面板：添加/删除/导入/导出
 * - 数据保存到 localStorage
 */

var MaoQuotesSkill = {

    id: 'mao-quotes',
    name: '信仰语录',
    icon: '语',
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
            if (self._cardEl) {
                SkillSystem.renderSubTools();
                return;
            }
            if (!self._quotes.length) {
                self._quotes = (typeof MAO_QUOTES !== 'undefined') ? MAO_QUOTES.slice() : [];
                self._saveQuotes();
            }
            self._createCard();
            self._showRandom();
            self._startTimer();
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
        var self = this;
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
        if (!this._world) return;
        this._createManager();
    },

    _createManager: function() {
        var self = this;
        var panel = document.createElement('div');
        panel.className = 'mq-manager';
        panel.innerHTML =
            '<div class="mq-mgr-header">' +
                '<span>语录管理 (' + this._quotes.length + ' 条)</span>' +
                '<button class="mq-mgr-close" id="mqMgrClose">&times;</button>' +
            '</div>' +
            '<div class="mq-mgr-add">' +
                '<textarea class="mq-mgr-input" id="mqMgrText" placeholder="输入语录，一行一条，支持批量添加..." rows="5"></textarea>' +
                '<button class="mq-btn mq-btn-primary" id="mqMgrAddBtn" style="width:100%;margin-top:6px">添加语录</button>' +
            '</div>' +
            '<div class="mq-mgr-list" id="mqMgrList"></div>' +
            '<div class="mq-mgr-actions">' +
                '<button class="mq-btn" id="mqMgrImport">导入</button>' +
                '<button class="mq-btn" id="mqMgrExport">导出</button>' +
                '<button class="mq-btn" id="mqMgrClear" style="color:#f87171">清空</button>' +
            '</div>' +
            '<input type="file" id="mqMgrFileInput" accept=".json,.txt" style="display:none">';

        document.body.appendChild(panel);
        this._managerEl = panel;
        panel.style.left = Math.max(20, (window.innerWidth - 340) / 2) + 'px';
        panel.style.top = Math.max(20, (window.innerHeight - 500) / 2) + 'px';

        // 拖拽
        var dragging = false, startX, startY, origLeft, origTop;
        var header = panel.querySelector('.mq-mgr-header');
        header.addEventListener('mousedown', function(e) {
            if (e.target.closest('button')) return;
            dragging = true;
            startX = e.clientX; startY = e.clientY;
            origLeft = panel.offsetLeft; origTop = panel.offsetTop;
            e.preventDefault();
        });
        document.addEventListener('mousemove', function(e) {
            if (!dragging) return;
            panel.style.left = (origLeft + e.clientX - startX) + 'px';
            panel.style.top = (origTop + e.clientY - startY) + 'px';
        });
        document.addEventListener('mouseup', function() { dragging = false; });

        panel.querySelector('#mqMgrClose').addEventListener('click', function() {
            panel.remove(); self._managerEl = null;
        });

        // 添加（支持一行一条批量添加）
        panel.querySelector('#mqMgrAddBtn').addEventListener('click', function() {
            var raw = panel.querySelector('#mqMgrText').value.trim();
            if (!raw) return;
            var lines = raw.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l; });
            if (!lines.length) return;
            lines.forEach(function(line) { self._quotes.unshift(line); });
            self._saveQuotes();
            panel.querySelector('#mqMgrText').value = '';
            self._renderManagerList();
            self._updateMgrCount();
            self._showToast('已添加 ' + lines.length + ' 条');
        });

        // 导入
        var fileInput = panel.querySelector('#mqMgrFileInput');
        panel.querySelector('#mqMgrImport').addEventListener('click', function() { fileInput.click(); });
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
                        self._showToast('已导入 ' + count + ' 条');
                    }
                } catch(err) {
                    var lines = ev.target.result.split('\n').filter(function(l) { return l.trim(); });
                    lines.forEach(function(line) { self._quotes.unshift(line.trim()); });
                    self._saveQuotes();
                    self._renderManagerList();
                    self._updateMgrCount();
                    self._showToast('已导入 ' + lines.length + ' 条');
                }
                fileInput.value = '';
            };
            reader.readAsText(e.target.files[0]);
        });

        // 导出
        panel.querySelector('#mqMgrExport').addEventListener('click', function() {
            var blob = new Blob([JSON.stringify(self._quotes, null, 2)], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url; a.download = 'mao-quotes.json'; a.click();
            URL.revokeObjectURL(url);
        });

        // 清空
        panel.querySelector('#mqMgrClear').addEventListener('click', function() {
            if (!self._quotes.length) return;
            self._quotes = [];
            self._saveQuotes();
            self._renderManagerList();
            self._updateMgrCount();
            self._showToast('已清空');
        });

        this._renderManagerList();
    },

    _renderManagerList: function() {
        var list = this._managerEl.querySelector('#mqMgrList');
        if (!list) return;
        var self = this;
        if (!this._quotes.length) {
            list.innerHTML = '<div class="mq-mgr-empty">暂无语录</div>';
            return;
        }
        var html = '';
        this._quotes.forEach(function(q, i) {
            var text = typeof q === 'string' ? q : q.text;
            var short = text.length > 50 ? text.slice(0, 50) + '...' : text;
            html += '<div class="mq-mgr-item" data-idx="' + i + '">' +
                '<div class="mq-mgr-item-text">' + self._escapeHtml(short) + '</div>' +
                '<button class="mq-mgr-del" data-idx="' + i + '">&times;</button>' +
            '</div>';
        });
        list.innerHTML = html;
        list.querySelectorAll('.mq-mgr-del').forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                self._quotes.splice(parseInt(this.dataset.idx), 1);
                self._saveQuotes();
                self._renderManagerList();
                self._updateMgrCount();
            });
        });
        list.querySelectorAll('.mq-mgr-item').forEach(function(item) {
            item.addEventListener('click', function() {
                var idx = parseInt(this.dataset.idx);
                self._currentIndex = idx;
                self._displayQuote(self._quotes[idx]);
            });
        });
    },

    _updateMgrCount: function() {
        if (!this._managerEl) return;
        var span = this._managerEl.querySelector('.mq-mgr-header span');
        if (span) span.textContent = '语录管理 (' + this._quotes.length + ' 条)';
    },

    _escapeHtml: function(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },

    _showToast: function(msg) {
        if (typeof showToast === 'function') showToast(msg);
    }
};

/* ===== 样式 ===== */
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
        '.mq-card.mq-fade-out { opacity:0; }' +

        /* 管理面板 */
        '.mq-manager { position:fixed;width:320px;max-height:500px;z-index:99999;' +
            'background:rgba(15,20,35,.95);color:#e8edf5;border-radius:14px;' +
            'box-shadow:0 8px 32px rgba(0,0,0,.6);overflow:hidden;' +
            'border:1px solid rgba(100,160,255,.08);' +
            'display:flex;flex-direction:column;user-select:none; }' +
        '.mq-mgr-header { display:flex;justify-content:space-between;align-items:center;' +
            'padding:10px 14px;background:rgba(56,189,248,.1);border-bottom:1px solid rgba(100,160,255,.15);' +
            'cursor:move;font-size:13px;font-weight:600;color:#e2e8f0; }' +
        '.mq-mgr-close { background:none;border:none;color:#64748b;font-size:16px;cursor:pointer;padding:0 2px;' +
            'line-height:1;transition:color .15s; }' +
        '.mq-mgr-close:hover { color:#38bdf8; }' +
        '.mq-mgr-add { padding:10px 14px;border-bottom:1px solid rgba(100,160,255,.06); }' +
        '.mq-mgr-input { width:100%;box-sizing:border-box;background:rgba(0,0,0,.3);' +
            'border:1px solid rgba(100,160,255,.08);border-radius:8px;color:#e2e8f0;' +
            'padding:8px 10px;font-size:12px;resize:vertical;font-family:inherit;line-height:1.5;' +
            'transition:border-color .15s; }' +
        '.mq-mgr-input:focus { outline:none;border-color:rgba(56,189,248,.4); }' +
        '.mq-mgr-input::placeholder { color:#475569; }' +
        '.mq-mgr-list { flex:1;overflow-y:auto;min-height:60px;max-height:250px; }' +
        '.mq-mgr-empty { text-align:center;color:#475569;padding:20px;font-size:12px; }' +
        '.mq-mgr-item { display:flex;align-items:center;padding:8px 14px;border-bottom:1px solid rgba(100,160,255,.04);' +
            'cursor:pointer;transition:background .15s;gap:8px; }' +
        '.mq-mgr-item:hover { background:rgba(56,189,248,.04); }' +
        '.mq-mgr-item-text { flex:1;font-size:11px;color:#cbd5e1;line-height:1.4;overflow:hidden; }' +
        '.mq-mgr-del { background:none;border:none;color:#475569;font-size:14px;cursor:pointer;padding:2px 4px;' +
            'border-radius:6px;transition:all .15s;flex-shrink:0; }' +
        '.mq-mgr-del:hover { color:#f87171;background:rgba(239,68,68,.1); }' +
        '.mq-mgr-actions { display:flex;gap:6px;padding:10px 14px;border-top:1px solid rgba(100,160,255,.06); }' +
        '.mq-mgr-actions .mq-btn { flex:1;text-align:center; }' +
        '.mq-btn { padding:4px 12px;background:rgba(56,189,248,.06);border:1px solid rgba(100,160,255,.08);' +
            'color:#94a3b8;border-radius:8px;cursor:pointer;font-size:11px;transition:all .15s; }' +
        '.mq-btn:hover { background:rgba(56,189,248,.1);color:#e2e8f0; }' +
        '.mq-btn:active { transform:scale(0.92); }' +
        '.mq-btn-primary { background:rgba(56,189,248,.2);border-color:rgba(56,189,248,.3);color:#38bdf8; }' +
        '.mq-btn-primary:hover { background:rgba(56,189,248,.35); }' +
        '.mq-mgr-list::-webkit-scrollbar { width:4px; }' +
        '.mq-mgr-list::-webkit-scrollbar-thumb { background:rgba(56,189,248,.15);border-radius:2px; }';

    document.head.appendChild(s);
})();
