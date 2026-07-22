/**
 * ============================================
 *   拼音笔画查询 - v67 插件
 *   输入连续汉字，自动查询拼音、笔画、偏旁部首
 *   支持一键复制 TSV / CSV 到表格
 *   Powered by cnchar.js
 *
 *   UI 使用公共库: css/plugin-theme.css + js/core/cos-ui.js
 * ============================================
 */

// 注入样式（仅保留插件专属样式，窗口/按钮/滚动条等由 plugin-theme.css 提供）
(function() {
    if (document.getElementById('pinyin-lookup-style')) return;
    var s = document.createElement('style');
    s.id = 'pinyin-lookup-style';
    s.textContent =
        /* 输入区 textarea（专属大字输入框） */
        '.pl-textarea{width:100%;min-height:64px;padding:10px 12px;' +
        'background:rgba(20,30,60,0.5);border:1px solid var(--cos-border);' +
        'color:var(--cos-text);border-radius:8px;font-size:16px;font-family:inherit;line-height:1.6;' +
        'resize:vertical;outline:none;letter-spacing:2px;transition:border-color 0.12s;box-sizing:border-box;}' +
        '.pl-textarea:focus{border-color:var(--cos-accent);box-shadow:0 0 0 2px rgba(56,189,248,0.08);}' +
        '.pl-textarea::placeholder{color:var(--cos-text-dim);letter-spacing:1px;}' +

        /* 统计栏 */
        '.pl-stats{padding:6px 14px;font-size:11px;color:var(--cos-text-dim);' +
        'border-bottom:1px solid var(--cos-border);flex-shrink:0;' +
        'display:flex;align-items:center;gap:8px;}' +
        '.pl-stats .badge{background:rgba(56,189,248,0.1);color:var(--cos-accent);' +
        'padding:2px 10px;border-radius:12px;font-weight:600;}' +
        '.pl-stats .badge-warn{background:rgba(248,113,113,0.1);color:#f87171;}' +

        /* 表格（专属单元格样式） */
        '.pl-table{width:100%;border-collapse:collapse;}' +
        '.pl-table thead th{background:rgba(20,30,60,0.9);color:var(--cos-text-soft);padding:10px 14px;' +
        'text-align:left;font-size:12px;font-weight:600;white-space:nowrap;' +
        'position:sticky;top:0;z-index:10;border-bottom:2px solid var(--cos-border);}' +
        '.pl-table tbody tr{border-bottom:1px solid rgba(100,160,255,0.04);transition:background 0.1s;}' +
        '.pl-table tbody tr:hover{background:rgba(30,45,80,0.3);}' +
        '.pl-table td{padding:8px 14px;font-size:15px;white-space:nowrap;}' +
        '.pl-td-char{font-size:20px;font-weight:600;color:var(--cos-accent);text-align:center;width:60px;}' +
        '.pl-td-pinyin{color:#60a5fa;font-style:italic;font-size:16px;}' +
        '.pl-td-stroke{color:#34d399;font-weight:600;}' +
        '.pl-td-radical{color:#a78bfa;font-size:17px;}' +
        '.pl-td-na{color:var(--cos-text-dim);}' +

        /* 加载动画 */
        '.pl-loading{display:inline-block;width:14px;height:14px;' +
        'border:2px solid rgba(56,189,248,0.2);border-top-color:var(--cos-accent);' +
        'border-radius:50%;animation:pl-spin 0.6s linear infinite;}' +
        '@keyframes pl-spin{to{transform:rotate(360deg);}}';
    document.head.appendChild(s);
})();

var PinyinLookupSkill = {
    id: 'pinyin-lookup',
    name: '拼音',
    icon: '<span style="color:#38bdf8;">拼</span>',
    description: '汉字拼音笔画偏旁查询 · 一键复制到表格',

    TEXTS: {
        TITLE: '拼音笔画查询',
        SUBTITLE: 'cnchar.js 离线查询',
        PLACEHOLDER: '请输入汉字，如：义也兀弋孑孓幺亓韦廿丏卅仄厄仃仇分刈交下门让尹夫井毋',
        BTN_SEARCH: '查询',
        BTN_SEARCHING: '查询中…',
        BTN_COPY_ALL: '复制全部（含表头）',
        BTN_COPY_DATA: '复制数据（不含表头）',
        BTN_COPY_CSV: '复制 CSV',
        BTN_CLEAR: '清空',
        BTN_PASTE: '粘贴',
        COL_CHAR: '汉字',
        COL_PINYIN: '拼音',
        COL_STROKE: '笔画',
        COL_RADICAL: '偏旁',
        EMPTY_HINT: '请输入汉字并点击「查询」按钮',
        MSG_INPUT_EMPTY: '请输入汉字',
        MSG_NO_HANZI: '未找到汉字，请检查输入',
        MSG_DONE: '查询完成，共',
        MSG_DONE_WITH_MISS: '查询完成，有',
        MSG_MISS_SUFFIX: ' 个字未识别',
        MSG_COPY_OK: '，可粘贴到表格中',
        MSG_COPY_EMPTY: '没有数据可复制',
        MSG_COPY_FAIL: '复制失败，请手动选择复制',
        MSG_PASTE_FAIL: '粘贴失败',
        MSG_LIB_FAIL: 'cnchar 库未加载，请检查 index.html 引入',
        STATS_TOTAL: '共',
        STATS_CHARS: '字',
        STATS_FOUND: '已识别',
        STATS_NOT_FOUND: '未识别',
        STATS_EMPTY: '粘贴文本或输入汉字后点击查询',
        NA: '-',
    },

    // === 内部状态 ===
    _overlay: null,
    _world: null,
    _cncharReady: false,

    // 补充字典：cnchar 库中缺失的汉字数据
    _supplementary: {
        '丏': { pinyin: 'miǎn', stroke: 4, radical: '一' },
        '弔': { pinyin: 'diào', stroke: 4, radical: '弓' },
        '仇': { radical: '亻' }
    },

    // ========== 生命周期 ==========

    activate: function(world) {
        this._world = world;

        if (this._overlay && this._overlay.parentNode) {
            if (typeof SkillSystem !== 'undefined') SkillSystem.renderSubTools();
            return;
        }

        this._checkCnchar();
        this._createOverlay();
        if (typeof SkillSystem !== 'undefined') SkillSystem.renderSubTools();
    },

    deactivate: function() {
        // 多窗口模式：不做任何清理
    },

    _checkCnchar: function() {
        this._cncharReady = (typeof cnchar !== 'undefined');
        if (this._cncharReady && typeof cnchar.radical !== 'function' && typeof CncharRadical !== 'undefined') {
            try { cnchar.use(CncharRadical); } catch(e) {}
        }
    },

    // ========== 窗口创建 ==========

    _createOverlay: function() {
        var self = this;
        var T = this.TEXTS;

        var ov = document.createElement('div');
        ov.className = 'cos-pwin';
        ov.setAttribute('data-skill-id', this.id);

        var topZ = (window.__cos_topZ || 10000) + 1;
        window.__cos_topZ = topZ;
        ov.style.zIndex = topZ;

        // 恢复尺寸
        var sw = window.innerWidth, sh = window.innerHeight;
        var w = 680, h = 560;
        try {
            var saved = JSON.parse(localStorage.getItem('pinyin-lookup-rect'));
            if (saved) {
                w = Math.min(saved.w, sw - 20);
                h = Math.min(saved.h, sh - 20);
                ov.style.left = Math.max(0, Math.min(saved.l, sw - w)) + 'px';
                ov.style.top = Math.max(0, Math.min(saved.t, sh - h)) + 'px';
            } else {
                ov.style.left = Math.max(20, (sw - w) / 2) + 'px';
                ov.style.top = Math.max(20, (sh - h) / 2) + 'px';
            }
        } catch(e) {
            ov.style.left = Math.max(20, (sw - w) / 2) + 'px';
            ov.style.top = Math.max(20, (sh - h) / 2) + 'px';
        }
        ov.style.width = w + 'px';
        ov.style.height = h + 'px';
        ov.style.minWidth = '500px';
        ov.style.minHeight = '350px';

        ov.innerHTML =
            // 标题栏（公共 cos-pwin-hdr）
            '<div class="cos-pwin-hdr">' +
                '<span><span class="cos-pwin-hdr-title">' + T.TITLE + '</span>' +
                '<span class="cos-pwin-hdr-sub">' + T.SUBTITLE + '</span></span>' +
                '<div class="cos-pwin-hdr-right">' +
                    '<span class="cos-pclose" title="关闭">\u00d7</span>' +
                '</div>' +
            '</div>' +
            // 内容区
            '<div style="flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0;">' +
                // 输入区
                '<div style="padding:10px 14px;border-bottom:1px solid var(--cos-border);flex-shrink:0;">' +
                    '<textarea class="pl-textarea" id="pl-input" placeholder="' + T.PLACEHOLDER + '"></textarea>' +
                    '<div class="cos-ptoolbar" style="margin-top:8px;padding:0;border:none;background:none;">' +
                        '<button class="cos-pbtn cos-pbtn-primary cos-pbtn-sm" id="pl-btn-search">' + T.BTN_SEARCH + '</button>' +
                        '<button class="cos-pbtn cos-pbtn-success cos-pbtn-sm" id="pl-btn-copy-all">' + T.BTN_COPY_ALL + '</button>' +
                        '<button class="cos-pbtn cos-pbtn-success cos-pbtn-sm" id="pl-btn-copy-data">' + T.BTN_COPY_DATA + '</button>' +
                        '<button class="cos-pbtn cos-pbtn-warn cos-pbtn-sm" id="pl-btn-copy-csv">' + T.BTN_COPY_CSV + '</button>' +
                        '<button class="cos-pbtn cos-pbtn-secondary cos-pbtn-sm" id="pl-btn-paste">' + T.BTN_PASTE + '</button>' +
                        '<button class="cos-pbtn cos-pbtn-danger cos-pbtn-sm" id="pl-btn-clear">' + T.BTN_CLEAR + '</button>' +
                    '</div>' +
                '</div>' +
                // 统计栏
                '<div class="pl-stats" id="pl-stats"><span>' + T.STATS_EMPTY + '</span></div>' +
                // 表格滚动区（公共 cos-pscroll）
                '<div class="cos-pscroll" style="flex:1;overflow:auto;border-top:1px solid var(--cos-border);min-height:0;">' +
                    '<table class="pl-table">' +
                        '<thead><tr>' +
                            '<th>' + T.COL_CHAR + '</th>' +
                            '<th>' + T.COL_PINYIN + '</th>' +
                            '<th>' + T.COL_STROKE + '</th>' +
                            '<th>' + T.COL_RADICAL + '</th>' +
                        '</tr></thead>' +
                        '<tbody id="pl-tbody">' +
                            '<tr><td colspan="4" class="cos-pempty">' + T.EMPTY_HINT + '</td></tr>' +
                        '</tbody>' +
                    '</table>' +
                '</div>' +
            '</div>';

        document.body.appendChild(ov);
        this._overlay = ov;

        ov.addEventListener('contextmenu', function(e) { e.preventDefault(); });

        // 置顶
        ov.addEventListener('mousedown', function() {
            var tz = (window.__cos_topZ || 10000) + 1;
            window.__cos_topZ = tz;
            ov.style.zIndex = tz;
        });

        // 关闭按钮
        ov.querySelector('.cos-pclose').addEventListener('click', function() {
            self._destroy();
        });

        // 拖拽（公共 CosUI.draggable）
        var hdr = ov.querySelector('.cos-pwin-hdr');
        if (typeof CosUI !== 'undefined' && CosUI.draggable) {
            CosUI.draggable.bind(ov, hdr, {
                storeKey: 'pinyin-lookup-rect',
                closeSelector: '.cos-pclose'
            });
        }

        // 缩放
        if (typeof WindowHelper !== 'undefined') {
            WindowHelper.makeResizable(ov, { minWidth: 500, minHeight: 350, storeKey: 'pinyin-lookup-rect' });
        }

        this._bindEvents();
    },

    _destroy: function() {
        if (this._overlay && this._overlay.parentNode) {
            this._overlay.parentNode.removeChild(this._overlay);
        }
        this._overlay = null;
        if (typeof SkillSystem !== 'undefined') SkillSystem.deactivate();
    },

    // ========== 事件绑定 ==========

    _bindEvents: function() {
        var self = this;
        var ov = this._overlay;
        var T = this.TEXTS;

        var input = ov.querySelector('#pl-input');
        var btnSearch = ov.querySelector('#pl-btn-search');

        btnSearch.addEventListener('click', function() { self._search(); });

        // Ctrl/Cmd + Enter 查询
        input.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                self._search();
            }
        });

        // 复制按钮
        ov.querySelector('#pl-btn-copy-all').addEventListener('click', function() { self._copyTable('tsv-all'); });
        ov.querySelector('#pl-btn-copy-data').addEventListener('click', function() { self._copyTable('tsv-data'); });
        ov.querySelector('#pl-btn-copy-csv').addEventListener('click', function() { self._copyTable('csv'); });

        // 清空
        ov.querySelector('#pl-btn-clear').addEventListener('click', function() { self._clearAll(); });

        // 粘贴
        ov.querySelector('#pl-btn-paste').addEventListener('click', function() { self._paste(); });
    },

    // ========== 查询逻辑 ==========

    _getSpell: function(char) {
        try {
            var result = null;
            if (typeof cnchar !== 'undefined' && typeof cnchar.spell === 'function') {
                result = cnchar.spell(char, 'low', 'tone');
            } else if (typeof char.spell === 'function') {
                result = char.spell('low', 'tone');
            }
            if (Array.isArray(result)) {
                result = result.length > 0 ? result[0] : '';
            }
            if (!result || result === char) {
                if (this._supplementary[char] && this._supplementary[char].pinyin) {
                    return this._supplementary[char].pinyin;
                }
                return '';
            }
            return result;
        } catch(e) {
            return '';
        }
    },

    _getStroke: function(char) {
        try {
            var result = null;
            if (typeof cnchar !== 'undefined' && typeof cnchar.stroke === 'function') {
                result = cnchar.stroke(char);
            } else if (typeof char.stroke === 'function') {
                result = char.stroke();
            }
            if (Array.isArray(result)) {
                result = result.length > 0 ? result[0] : 0;
            }
            if (!result || result === 0) {
                if (this._supplementary[char] && this._supplementary[char].stroke) {
                    return this._supplementary[char].stroke;
                }
                return 0;
            }
            return result;
        } catch(e) {
            return 0;
        }
    },

    _getRadical: function(char) {
        try {
            var result = null;
            if (typeof cnchar !== 'undefined' && typeof cnchar.radical === 'function') {
                result = cnchar.radical(char);
            }
            if ((!result || result.length === 0) && typeof CncharRadical !== 'undefined') {
                result = CncharRadical(char);
            }
            var radical = '';
            if (Array.isArray(result) && result.length > 0) {
                radical = result[0].radical || '';
            }
            if (!radical && this._supplementary[char] && this._supplementary[char].radical) {
                radical = this._supplementary[char].radical;
            }
            return radical;
        } catch(e) {
            return '';
        }
    },

    _extractChars: function(text) {
        var chars = [];
        for (var i = 0; i < text.length; i++) {
            var ch = text[i];
            if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) {
                chars.push(ch);
            }
        }
        return chars;
    },

    _search: function() {
        var T = this.TEXTS;
        var ov = this._overlay;
        if (!ov) return;

        if (!this._cncharReady) {
            this._checkCnchar();
            if (!this._cncharReady) {
                this._showToast(T.MSG_LIB_FAIL);
                return;
            }
        }

        var input = ov.querySelector('#pl-input');
        var text = input.value.trim();
        if (!text) {
            this._showToast(T.MSG_INPUT_EMPTY);
            return;
        }

        var chars = this._extractChars(text);
        if (chars.length === 0) {
            this._showToast(T.MSG_NO_HANZI);
            return;
        }

        var btnSearch = ov.querySelector('#pl-btn-search');
        btnSearch.innerHTML = '<span class="pl-loading"></span> ' + T.BTN_SEARCHING;
        btnSearch.disabled = true;

        var self = this;
        var tbody = ov.querySelector('#pl-tbody');
        var statsEl = ov.querySelector('#pl-stats');

        setTimeout(function() {
            tbody.innerHTML = '';
            var found = 0;
            var notFound = 0;
            var na = T.NA;
            var parts = [];

            for (var i = 0; i < chars.length; i++) {
                var char = chars[i];
                var pinyin = self._getSpell(char);
                var strokes = self._getStroke(char);
                var radical = self._getRadical(char);

                var hasData = pinyin || strokes;
                if (hasData) { found++; } else { notFound++; }

                parts.push(
                    '<tr>' +
                    '<td class="pl-td-char">' + char + '</td>' +
                    '<td class="pl-td-pinyin">' + (pinyin || '<span class="pl-td-na">' + na + '</span>') + '</td>' +
                    '<td class="pl-td-stroke">' + (strokes || '<span class="pl-td-na">' + na + '</span>') + '</td>' +
                    '<td class="pl-td-radical">' + (radical || '<span class="pl-td-na">' + na + '</span>') + '</td>' +
                    '</tr>'
                );
            }
            tbody.innerHTML = parts.join('');

            var statsHtml = '<span class="badge">' + T.STATS_TOTAL + ' ' + chars.length + ' ' + T.STATS_CHARS + '</span>' +
                '<span>' + T.STATS_FOUND + ' ' + found;
            if (notFound > 0) {
                statsHtml += '<span class="badge badge-warn" style="margin-left:8px;">' + T.STATS_NOT_FOUND + ' ' + notFound + '</span>';
            }
            statsHtml += '</span>';
            statsEl.innerHTML = statsHtml;

            btnSearch.innerHTML = T.BTN_SEARCH;
            btnSearch.disabled = false;

            if (notFound > 0) {
                self._showToast(T.MSG_DONE_WITH_MISS + ' ' + notFound + ' ' + T.MSG_MISS_SUFFIX);
            } else {
                self._showToast(T.MSG_DONE + ' ' + chars.length + ' ' + T.STATS_CHARS);
            }
        }, 50);
    },

    // ========== 复制 ==========

    _generateTSV: function(includeHeader) {
        var T = this.TEXTS;
        var tbody = this._overlay.querySelector('#pl-tbody');
        if (!tbody) return '';
        var rows = tbody.querySelectorAll('tr');
        if (rows.length === 0) return '';

        var lines = [];
        if (includeHeader) {
            lines.push(T.COL_CHAR + '\t' + T.COL_PINYIN + '\t' + T.COL_STROKE + '\t' + T.COL_RADICAL);
        }
        for (var i = 0; i < rows.length; i++) {
            var cells = rows[i].querySelectorAll('td');
            if (cells.length === 4) {
                var line = [];
                for (var j = 0; j < 4; j++) {
                    var text = cells[j].textContent.trim();
                    line.push(text === T.NA ? '' : text);
                }
                lines.push(line.join('\t'));
            }
        }
        return lines.join('\n');
    },

    _generateCSV: function() {
        var T = this.TEXTS;
        var tbody = this._overlay.querySelector('#pl-tbody');
        if (!tbody) return '';
        var rows = tbody.querySelectorAll('tr');
        if (rows.length === 0) return '';

        var lines = [T.COL_CHAR + ',' + T.COL_PINYIN + ',' + T.COL_STROKE + ',' + T.COL_RADICAL];
        for (var i = 0; i < rows.length; i++) {
            var cells = rows[i].querySelectorAll('td');
            if (cells.length === 4) {
                var line = [];
                for (var j = 0; j < 4; j++) {
                    var text = cells[j].textContent.trim();
                    line.push(text === T.NA ? '' : text);
                }
                lines.push(line.join(','));
            }
        }
        return lines.join('\n');
    },

    _copyToClipboard: function(text) {
        var textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        if (navigator.userAgent.match(/ipad|ipod|iphone/i)) {
            var range = document.createRange();
            range.selectNodeContents(textarea);
            var selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            textarea.setSelectionRange(0, textarea.value.length);
        }
        var success = false;
        try { success = document.execCommand('copy'); } catch(e) { success = false; }
        document.body.removeChild(textarea);
        return success;
    },

    _copyTable: function(format) {
        var T = this.TEXTS;
        var text = '', msg = '';
        if (format === 'tsv-all') {
            text = this._generateTSV(true);
            msg = T.BTN_COPY_ALL;
        } else if (format === 'tsv-data') {
            text = this._generateTSV(false);
            msg = T.BTN_COPY_DATA;
        } else if (format === 'csv') {
            text = this._generateCSV();
            msg = T.BTN_COPY_CSV;
        }

        if (!text) {
            this._showToast(T.MSG_COPY_EMPTY);
            return;
        }

        var self = this;
        if (this._copyToClipboard(text)) {
            this._showToast(msg + T.MSG_COPY_OK);
        } else {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function() {
                    self._showToast(msg + T.MSG_COPY_OK);
                }).catch(function() {
                    self._showToast(T.MSG_COPY_FAIL);
                });
            } else {
                this._showToast(T.MSG_COPY_FAIL);
            }
        }
    },

    // ========== 粘贴 / 清空 ==========

    _paste: function() {
        var self = this;
        var input = this._overlay.querySelector('#pl-input');
        if (navigator.clipboard && navigator.clipboard.readText) {
            navigator.clipboard.readText().then(function(text) {
                input.value = text;
                input.focus();
                self._search();
            }).catch(function() {
                input.focus();
                self._showToast(self.TEXTS.MSG_PASTE_FAIL);
            });
        } else {
            input.focus();
            try {
                var ok = document.execCommand('paste');
                if (!ok) self._showToast(self.TEXTS.MSG_PASTE_FAIL);
            } catch(e) {
                self._showToast(self.TEXTS.MSG_PASTE_FAIL);
            }
        }
    },

    _clearAll: function() {
        var T = this.TEXTS;
        var ov = this._overlay;
        ov.querySelector('#pl-input').value = '';
        ov.querySelector('#pl-tbody').innerHTML = '<tr><td colspan="4" class="cos-pempty">' + T.EMPTY_HINT + '</td></tr>';
        ov.querySelector('#pl-stats').innerHTML = '<span>' + T.STATS_EMPTY + '</span>';
        ov.querySelector('#pl-input').focus();
    },

    // ========== Toast 工具 ==========

    _showToast: function(msg) {
        if (typeof CosUI !== 'undefined' && CosUI.toast && CosUI.toast.show) {
            CosUI.toast.show(msg, 2500);
        } else if (typeof showToast === 'function') {
            showToast(msg);
        }
    },

    // ========== 子工具栏 ==========

    getSubTools: function() {
        var self = this;
        return [
            {
                label: '查询',
                title: '执行查询',
                action: function() { self._search(); }
            },
            {
                label: '清空',
                title: '清空输入和结果',
                action: function() { self._clearAll(); }
            },
            {
                label: '复制CSV',
                title: '复制为 CSV 格式',
                action: function() { self._copyTable('csv'); }
            }
        ];
    },

    // ========== 保存/恢复 ==========

    save: function() {
        return { input: this._lastInput || '' };
    },

    load: function(data) {
        if (!data) return;
        this._lastInput = data.input || '';
    }
};
