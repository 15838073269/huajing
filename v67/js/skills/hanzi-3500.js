/**
 * ============================================
 *   3500常用汉字 - v67 插件
 *   查询/分组/排序/笔顺动画/语音播报
 *   来源：教育部《通用规范汉字表》一级字表
 * ============================================
 */

// 注入样式（只注入一次）
(function() {
    if (document.getElementById('hz3500-style')) return;
    var s = document.createElement('style');
    s.id = 'hz3500-style';
    s.textContent =
        '.hz3500-toolbar{padding:8px 14px;border-bottom:1px solid var(--cos-border);' +
        'display:flex;flex-wrap:wrap;gap:8px;align-items:center;flex-shrink:0;}' +
        '.hz3500-toolbar select,.hz3500-toolbar input{' +
        'background:rgba(20,30,60,0.5);border:1px solid var(--cos-border);' +
        'color:var(--cos-text);border-radius:6px;padding:5px 8px;font-size:12px;outline:none;transition:border-color 0.12s;}' +
        '.hz3500-toolbar input:focus{border-color:var(--cos-accent);}' +
        '.hz3500-toolbar select:focus{border-color:var(--cos-accent);}' +
        '.hz3500-info{padding:6px 14px;font-size:11px;color:var(--cos-text-dim);' +
        'border-bottom:1px solid var(--cos-border);flex-shrink:0;' +
        'display:flex;justify-content:space-between;align-items:center;}' +
        '.hz3500-vscroll{position:relative;flex:1;min-height:200px;overflow-y:auto;overflow-x:auto;}' +
        '.hz3500-table{width:100%;border-collapse:collapse;font-size:13px;}' +
        '.hz3500-table thead th{background:rgba(20,30,60,0.9);padding:10px 8px;text-align:center;' +
        'font-weight:600;color:var(--cos-text-soft);border-bottom:2px solid var(--cos-border);' +
        'white-space:nowrap;cursor:pointer;user-select:none;position:sticky;top:0;z-index:10;}' +
        '.hz3500-table thead th:hover{background:rgba(30,45,80,0.9);}' +
        '.hz3500-sort-icon{font-size:10px;opacity:0.5;}' +
        '.hz3500-theme-cell{cursor:pointer;padding:2px 8px;border-radius:4px;' +
        'background:rgba(120,170,255,0.14);color:var(--cos-accent);display:inline-block;' +
        'max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;}' +
        '.hz3500-theme-cell:hover{background:rgba(120,170,255,0.26);}' +
        '.hz3500-theme-empty{color:var(--cos-text-dim);cursor:pointer;}' +
        '.hz3500-body{display:flex;flex:1;min-height:0;}' +
        '.hz3500-main{display:flex;flex-direction:column;flex:1;min-width:0;}' +
        '.hz3500-side{display:none;width:236px;flex-shrink:0;border-left:1px solid var(--cos-border);' +
        'flex-direction:column;gap:6px;padding:12px;overflow-y:auto;background:rgba(10,16,32,0.35);}' +
        '.hz3500-side.show{display:flex;}' +
        '.hz3500-side-title{font-size:12px;color:var(--cos-text-soft);font-weight:600;margin:2px 0 4px;}' +
        '.hz3500-side label{font-size:11px;color:var(--cos-text-dim);display:block;margin:6px 0 2px;}' +
        '.hz3500-side select,.hz3500-side .hz3500-batch-input{width:100%;flex:none;}' +
        '.hz3500-side textarea.hz3500-batch-input{flex:none;height:78px;resize:vertical;font-family:inherit;line-height:1.6;}' +
        '.hz3500-side .cos-pbtn{width:100%;}' +
        '.hz3500-side-sep{border-top:1px solid var(--cos-border);margin:8px 0 2px;}' +
        '.hz3500-tools-btn.active{background:var(--cos-accent);color:#0b1020;border-color:var(--cos-accent);}' +
        '.hz3500-table tbody tr{border-bottom:1px solid rgba(100,160,255,0.05);transition:background 0.1s;}' +
        '.hz3500-table tbody tr:hover{background:rgba(30,45,80,0.3);}' +
        '.hz3500-table tbody td{padding:7px 6px;text-align:center;white-space:nowrap;}' +
        '.hz3500-char-cell{font-size:18px;font-weight:600;color:var(--cos-accent);cursor:pointer;}' +
        '.hz3500-char-cell:hover{text-decoration:underline;}' +
        '.hz3500-group-row{background:linear-gradient(90deg,rgba(56,189,248,0.08),rgba(56,189,248,0.03));cursor:pointer;}' +
        '.hz3500-group-row td{padding:8px 16px;text-align:left;font-weight:700;font-size:14px;' +
        'color:var(--cos-accent);border-bottom:2px solid rgba(56,189,248,0.15);white-space:nowrap;}' +
        '.hz3500-group-arrow{display:inline-block;width:16px;transition:transform 0.2s;font-size:12px;}' +
        '.hz3500-group-row.collapsed .hz3500-group-arrow{transform:rotate(-90deg);}' +
        '.hz3500-group-count{font-size:12px;font-weight:400;color:var(--cos-text-dim);margin-left:8px;}' +
        '.hz3500-stroke-cell{font-size:13px;cursor:pointer;color:var(--cos-accent);user-select:none;}' +
        '.hz3500-stroke-cell:hover{opacity:0.7;}' +
        // 详情弹窗
        '.hz3500-modal-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;' +
        'background:rgba(0,0,0,0.5);z-index:10001;justify-content:center;align-items:center;}' +
        '.hz3500-modal-overlay.show{display:flex;}' +
        '.hz3500-modal-card{background:rgba(15,21,37,0.98);border-radius:20px;padding:40px;' +
        'width:500px;max-width:90%;max-height:85vh;overflow-y:auto;' +
        'box-shadow:0 20px 60px rgba(0,0,0,0.4);position:relative;' +
        'animation:hz3500-pop 0.2s ease;border:1px solid rgba(100,160,255,0.15);}' +
        '@keyframes hz3500-pop{from{transform:scale(0.9);opacity:0;}to{transform:scale(1);opacity:1;}}' +
        '.hz3500-modal-close{position:absolute;top:16px;right:20px;font-size:24px;color:#94a3b8;' +
        'cursor:pointer;border:none;background:none;}' +
        '.hz3500-modal-close:hover{color:#e87060;}' +
        '.hz3500-modal-char{font-size:80px;text-align:center;font-weight:700;color:#38bdf8;margin-bottom:8px;}' +
        '.hz3500-modal-pinyin{text-align:center;font-size:20px;color:#94a3b8;margin-bottom:24px;}' +
        '.hz3500-modal-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 24px;}' +
        '.hz3500-modal-item{display:flex;gap:8px;font-size:14px;padding:6px 0;' +
        'border-bottom:1px solid rgba(100,160,255,0.06);}' +
        '.hz3500-modal-item .label{color:#475569;min-width:60px;flex-shrink:0;}' +
        '.hz3500-modal-item .value{color:#e8edf5;font-weight:500;}' +
        // 笔顺面板
        '.hz3500-stroke-overlay{display:none;position:fixed;top:0;left:0;right:0;bottom:0;' +
        'background:rgba(0,0,0,0.5);z-index:10002;justify-content:center;align-items:center;}' +
        '.hz3500-stroke-overlay.show{display:flex;}' +
        '.hz3500-stroke-panel{background:rgba(15,21,37,0.98);border-radius:20px;padding:30px 40px;' +
        'width:520px;max-width:92%;max-height:90vh;overflow-y:auto;' +
        'box-shadow:0 20px 60px rgba(0,0,0,0.4);position:relative;' +
        'animation:hz3500-pop 0.2s ease;text-align:center;border:1px solid rgba(100,160,255,0.15);}' +
        '.hz3500-stroke-close{position:absolute;top:14px;right:20px;font-size:24px;color:#94a3b8;' +
        'cursor:pointer;border:none;background:none;}' +
        '.hz3500-stroke-close:hover{color:#e87060;}' +
        '.hz3500-stroke-title{font-size:18px;font-weight:700;color:#38bdf8;margin-bottom:4px;}' +
        '.hz3500-stroke-sub{font-size:14px;color:#94a3b8;margin-bottom:20px;}' +
        '.hz3500-stroke-canvas{width:304px;height:304px;background:#fff;border:2px solid #333;' +
        'border-radius:4px;display:flex;justify-content:center;align-items:center;' +
        'margin:0 auto 20px;position:relative;overflow:hidden;}' +
        '.hz3500-stroke-canvas::before{content:"";position:absolute;left:50%;top:0;bottom:0;width:0;' +
        'border-left:1.5px dashed #e74c3c;z-index:0;opacity:0.55;}' +
        '.hz3500-stroke-canvas::after{content:"";position:absolute;top:50%;left:0;right:0;height:0;' +
        'border-top:1.5px dashed #e74c3c;z-index:0;opacity:0.55;}' +
        '.hz3500-stroke-canvas>*{position:relative;z-index:1;}' +
        '.hz3500-stroke-canvas svg{display:block;}' +
        '.hz3500-stroke-btns{display:flex;gap:10px;justify-content:center;flex-wrap:wrap;}' +
        '.hz3500-stroke-btns button{padding:8px 22px;border:none;border-radius:8px;font-size:14px;' +
        'cursor:pointer;transition:opacity 0.2s;font-weight:500;}' +
        '.hz3500-stroke-btn-primary{background:#38bdf8;color:#fff;}' +
        '.hz3500-stroke-btn-primary:hover{opacity:0.85;}' +
        '.hz3500-stroke-btn-secondary{background:rgba(255,255,255,0.1);color:#e8edf5;}' +
        '.hz3500-stroke-btn-secondary:hover{background:rgba(255,255,255,0.15);}' +
        '.hz3500-stroke-btn-speak{background:rgba(52,211,153,0.1);color:#34d399;border:2px solid rgba(52,211,153,0.3);}' +
        '.hz3500-stroke-btn-speak:hover{background:rgba(52,211,153,0.2);}' +
        '.hz3500-stroke-btn-speak.speaking{background:#34d399;color:#fff;border-color:#34d399;}' +
        /* 认识标记 */
        '.hz3500-known-cb{width:18px;height:18px;cursor:pointer;accent-color:#34d399;vertical-align:middle;}' +
        '.hz3500-batch-row{padding:6px 14px;border-bottom:1px solid rgba(100,160,255,0.06);display:flex;gap:8px;align-items:center;flex-shrink:0;flex-wrap:wrap;}' +
        '.hz3500-batch-input{flex:1;min-width:200px;background:rgba(20,30,60,0.5);border:1px solid var(--cos-border);color:var(--cos-text);border-radius:6px;padding:6px 8px;font-size:12px;outline:none;transition:border-color 0.12s;}' +
        '.hz3500-batch-input:focus{border-color:var(--cos-accent);}' +
        '.hz3500-known-count{font-weight:700;color:#34d399;font-size:13px;white-space:nowrap;}';
    document.head.appendChild(s);
})();

var Hanzi3500Skill = {
    id: 'hanzi-3500',
    name: '汉字',
    icon: '<span style="color:#38bdf8;">字</span>',
    description: '3500常用汉字查询 · 笔顺动画 · 语音播报',

    TEXTS: {
        TITLE: '3500常用汉字',
        SOURCE: '教育部《通用规范汉字表》一级字表',
        SEARCH_PH: '搜索汉字/拼音/偏旁…',
        GROUP_LABEL: '分组',
        GROUP_NONE: '不分组',
        GROUP_KNOWN: '认识',
        GROUP_UNKNOWN: '不认识',
        BTN_RESET: '重置',
        BTN_CLOSE: '关',
        COL_ID: '序号',
        COL_CHAR: '汉字',
        COL_PINYIN: '拼音',
        COL_LETTER: '字母',
        COL_STROKES: '笔画',
        COL_RADICAL: '偏旁',
        COL_STROKE: '笔顺',
        STROKE_VIEW: '查看',
        STROKE_TITLE: '笔顺动画',
        STROKE_SUB: '点击「播放笔顺」查看书写顺序',
        STROKE_PLAY: '播放笔顺',
        STROKE_OUTLINE: '切换轮廓',
        STROKE_RESET: '重置',
        STROKE_SPEAK: '语音播报',
        STROKE_SPEAKING: '播报中…',
        STROKE_NO_DATA: '该字暂无笔画数据',
        DETAIL_STROKE_LINK: '▶ 查看笔顺动画',
        INFO_TOTAL: '共',
        INFO_CHARS: '字',
        INFO_GROUPS: '个分组',
        INFO_FILTERED: '(筛选自',
        INFO_NO_RESULT: '没有匹配结果',
        MODAL_LABEL_ID: '序号',
        MODAL_LABEL_PINYIN: '拼音',
        MODAL_LABEL_LETTER: '字母',
        MODAL_LABEL_STROKES: '笔画',
        MODAL_LABEL_RADICAL: '偏旁',
        MSG_NO_SPEECH: '当前浏览器不支持语音合成功能',
        COL_KNOWN: '认识',
        COL_THEME: '题材',
        BTN_BATCH_KNOWN: '批量认识',
        BTN_INVERT: '反选',
        BTN_CLEAR_KNOWN: '清空认识',
        BTN_IMPORT: '导入CSV',
        BTN_EXPORT: '导出CSV',
        BTN_TOOLS: '工具',
        EXPORT_SCOPE_LABEL: '导出',
        EXPORT_SCOPE_ALL: '全部',
        EXPORT_SCOPE_THEME: '按题材',
        EXPORT_SCOPE_LETTER: '按字母',
        EXPORT_SCOPE_STROKES: '按笔画',
        EXPORT_SCOPE_RADICAL: '按偏旁',
        EXPORT_SCOPE_TONE: '按拼音声调',
        BATCH_PH: '粘贴汉字，批量标记认识…',
        BATCH_THEME_PH: '题材名（如：数量）',
        BTN_BATCH_THEME: '批量题材',
        BTN_CLEAR_THEME: '清空题材',
        INFO_KNOWN: '认字',
    },

    // === 内部状态 ===
    _overlay: null,
    _world: null,

    // 数据
    _DATA: null,           // 原始数据 [[id, 汉字, 拼音, 字母, 笔画, 偏旁], ...]
    _filteredData: null,   // 筛选后数据
    _flatRows: null,       // 虚拟滚动扁平行

    // 列定义
    _HEADER: null,         // ['序号', '汉字', '拼音', '字母', '笔画', '偏旁', '笔顺']
    _COL: null,            // { '序号': 0, '汉字': 1, ... }
    _GROUP_COLS: null,     // 可分组列名

    // UI 状态
    _sortCol: -1,
    _sortAsc: true,
    _collapsedGroups: null,
    _knownSet: null,           // Set of known characters
    _themeMap: null,            // Map(char -> 题材标签)
    _TONE_MAP: { 'ā':'1','á':'2','ǎ':'3','à':'4','ē':'1','é':'2','ě':'3','è':'4','ī':'1','í':'2','ǐ':'3','ì':'4','ō':'1','ó':'2','ǒ':'3','ò':'4','ū':'1','ú':'2','ǔ':'3','ù':'4','ǖ':'1','ǘ':'2','ǚ':'3','ǜ':'4' },
    _TONE_LABELS: { '1':'第一声','2':'第二声','3':'第三声','4':'第四声','5':'轻声' },
    _scrollTick: false,

    // 虚拟滚动常量
    _ROW_H: 36,
    _GROUP_H: 34,
    _BUFFER: 5,

    // 笔顺/语音
    _strokeWriter: null,
    _strokeShowOutline: true,
    _strokeDataIdx: -1,
    _hanziWriterLoaded: false,
    _hanziWriterChecking: false,

    // ========== 生命周期 ==========

    activate: function(world) {
        this._world = world;

        // 已有窗口则直接返回
        if (this._overlay && this._overlay.parentNode) {
            if (typeof SkillSystem !== 'undefined') SkillSystem.renderSubTools();
            return;
        }

        // 初始化数据
        this._initData();
        this._createOverlay();
        this._renderTable();
        if (typeof SkillSystem !== 'undefined') SkillSystem.renderSubTools();
    },

    deactivate: function() {
        // 多窗口模式：不做任何清理
    },

    _initData: function() {
        if (this._DATA) return;
        if (typeof HANZI_3500_DATA === 'undefined') {
            this._DATA = [];
        } else {
            this._DATA = HANZI_3500_DATA;
        }
        this._filteredData = this._DATA.slice();
        this._flatRows = [];
        this._collapsedGroups = new Set();
        this._loadKnown();
        this._loadTheme();

        var T = this.TEXTS;
        this._HEADER = [T.COL_ID, T.COL_CHAR, T.COL_PINYIN, T.COL_LETTER, T.COL_STROKES, T.COL_RADICAL, T.COL_THEME, T.COL_KNOWN, T.COL_STROKE];
        this._COL = {};
        this._HEADER.forEach(function(name, i) { this[name] = i; }, this._COL);
        this._GROUP_COLS = [T.COL_PINYIN, T.COL_LETTER, T.COL_STROKES, T.COL_RADICAL, T.COL_KNOWN, T.COL_THEME];
    },

    // ========== 窗口创建 ==========

    _createOverlay: function() {
        var self = this;
        var T = this.TEXTS;

        var ov = document.createElement('div');
        ov.className = 'cos-pwin';
        ov.setAttribute('data-skill-id', this.id);
        ov.style.minWidth = '600px';
        ov.style.minHeight = '400px';

        var topZ = (window.__cos_topZ || 10000) + 1;
        window.__cos_topZ = topZ;
        ov.style.zIndex = topZ;

        // 恢复尺寸
        var sw = window.innerWidth, sh = window.innerHeight;
        var w = 900, h = 650;
        try {
            var saved = JSON.parse(localStorage.getItem('hz3500-rect'));
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

        ov.innerHTML =
            '<div class="cos-pwin-hdr">' +
                '<span class="cos-pwin-hdr-title">' + T.TITLE + '</span>' +
                '<div class="cos-pwin-hdr-right">' +
                    '<span class="cos-pclose" title="' + T.BTN_CLOSE + '">\u00d7</span>' +
                '</div>' +
            '</div>' +
            '<div class="hz3500-toolbar">' +
                '<label style="font-size:12px;color:var(--cos-text-soft);">' + T.GROUP_LABEL + '：</label>' +
                '<select id="hz3500-groupBy"></select>' +
                '<span class="hz3500-known-count" id="hz3500-knownCount"></span>' +
                '<span style="flex:1;min-width:4px;"></span>' +
                '<input type="text" id="hz3500-searchInput" placeholder="' + T.SEARCH_PH + '" style="width:220px;">' +
                '<button class="cos-pbtn cos-pbtn-secondary cos-pbtn-sm" id="hz3500-resetBtn">' + T.BTN_RESET + '</button>' +
                '<button class="cos-pbtn cos-pbtn-secondary cos-pbtn-sm hz3500-tools-btn" id="hz3500-toolsBtn">' + T.BTN_TOOLS + '</button>' +
            '</div>' +
            '<div class="hz3500-body">' +
                '<div class="hz3500-main">' +
                    '<div class="hz3500-info">' +
                        '<span id="hz3500-resultInfo"></span>' +
                        '<span id="hz3500-extraInfo"></span>' +
                    '</div>' +
                    '<div class="hz3500-vscroll cos-pscroll" id="hz3500-vscroll">' +
                        '<table class="hz3500-table">' +
                            '<thead id="hz3500-tableHead"></thead>' +
                            '<tbody id="hz3500-tableBody"></tbody>' +
                        '</table>' +
                    '</div>' +
                '</div>' +
                '<div class="hz3500-side" id="hz3500-side">' +
                    '<div class="hz3500-side-title">导入 / 导出</div>' +
                    '<button class="cos-pbtn cos-pbtn-secondary cos-pbtn-sm" id="hz3500-importBtn">' + T.BTN_IMPORT + '</button>' +
                    '<label>' + T.EXPORT_SCOPE_LABEL + '</label>' +
                    '<select id="hz3500-exportScope">' +
                        '<option value="all">' + T.EXPORT_SCOPE_ALL + '</option>' +
                        '<option value="theme">' + T.EXPORT_SCOPE_THEME + '</option>' +
                        '<option value="letter">' + T.EXPORT_SCOPE_LETTER + '</option>' +
                        '<option value="strokes">' + T.EXPORT_SCOPE_STROKES + '</option>' +
                        '<option value="radical">' + T.EXPORT_SCOPE_RADICAL + '</option>' +
                        '<option value="tone">' + T.EXPORT_SCOPE_TONE + '</option>' +
                    '</select>' +
                    '<select id="hz3500-exportFilter" style="display:none;"></select>' +
                    '<button class="cos-pbtn cos-pbtn-primary cos-pbtn-sm" id="hz3500-exportBtn">' + T.BTN_EXPORT + '</button>' +
                    '<input type="file" id="hz3500-importFile" accept=".csv,text/csv" style="display:none;">' +
                    '<div class="hz3500-side-sep"></div>' +
                    '<div class="hz3500-side-title">批量标记</div>' +
                    '<label>' + T.COL_CHAR + '（认识 / 题材共用）</label>' +
                    '<textarea class="hz3500-batch-input" id="hz3500-batchInput" placeholder="' + T.BATCH_PH + '" rows="3"></textarea>' +
                    '<div class="hz3500-side-sep"></div>' +
                    '<div class="hz3500-side-title">认识</div>' +
                    '<button class="cos-pbtn cos-pbtn-success cos-pbtn-sm" id="hz3500-batchKnownBtn">' + T.BTN_BATCH_KNOWN + '</button>' +
                    '<button class="cos-pbtn cos-pbtn-secondary cos-pbtn-sm" id="hz3500-invertBtn">' + T.BTN_INVERT + '</button>' +
                    '<button class="cos-pbtn cos-pbtn-danger cos-pbtn-sm" id="hz3500-clearKnownBtn">' + T.BTN_CLEAR_KNOWN + '</button>' +
                    '<div class="hz3500-side-sep"></div>' +
                    '<div class="hz3500-side-title">题材</div>' +
                    '<label>' + T.COL_THEME + '</label>' +
                    '<input type="text" class="hz3500-batch-input" id="hz3500-batchThemeInput" placeholder="' + T.BATCH_THEME_PH + '">' +
                    '<button class="cos-pbtn cos-pbtn-success cos-pbtn-sm" id="hz3500-batchThemeBtn">' + T.BTN_BATCH_THEME + '</button>' +
                    '<button class="cos-pbtn cos-pbtn-danger cos-pbtn-sm" id="hz3500-clearThemeBtn">' + T.BTN_CLEAR_THEME + '</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(ov);
        this._overlay = ov;

        // 禁用右键
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
                storeKey: 'hz3500-rect',
                closeSelector: '.cos-pclose'
            });
        }

        // 四角缩放
        if (typeof WindowHelper !== 'undefined') {
            WindowHelper.makeResizable(ov, { minWidth: 600, minHeight: 400, storeKey: 'hz3500-rect' });
        }

        // 构建表头
        this._buildTableHead();
        this._buildGroupControls();

        // 事件绑定
        this._bindEvents();
    },

    _destroy: function() {
        this._stopAllSpeech();
        if (this._strokeWriter) {
            try { this._strokeWriter.destroy(); } catch(e) {}
            this._strokeWriter = null;
        }
        // 移除模态/笔顺面板
        var modal = document.getElementById('hz3500-modal');
        if (modal) modal.remove();
        var stroke = document.getElementById('hz3500-strokeOverlay');
        if (stroke) stroke.remove();

        if (this._overlay && this._overlay.parentNode) {
            this._overlay.parentNode.removeChild(this._overlay);
        }
        this._overlay = null;
        if (typeof SkillSystem !== 'undefined') SkillSystem.deactivate();
    },

    // ========== 表格 ==========

    _buildTableHead: function() {
        var self = this;
        var html = '<tr>';
        this._HEADER.forEach(function(name, i) {
            html += '<th onclick="Hanzi3500Skill._sortBy(' + i + ')">' + name +
                ' <span class="hz3500-sort-icon" id="hz3500-sort_' + i + '"></span></th>';
        });
        html += '</tr>';
        this._overlay.querySelector('#hz3500-tableHead').innerHTML = html;
    },

    _buildGroupControls: function() {
        var T = this.TEXTS;
        var groupSel = this._overlay.querySelector('#hz3500-groupBy');
        var html = '<option value="">' + T.GROUP_NONE + '</option>';
        this._GROUP_COLS.forEach(function(name) {
            html += '<option value="' + name + '">' + name + '</option>';
        });
        groupSel.innerHTML = html;
    },

    _bindEvents: function() {
        var self = this;
        var ov = this._overlay;

        // 搜索
        var searchInput = ov.querySelector('#hz3500-searchInput');
        var searchTimer = null;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(function() { self._doSearch(); }, 200);
        });

        // 分组
        ov.querySelector('#hz3500-groupBy').addEventListener('change', function() {
            self._collapsedGroups.clear();
            self._rebuildFlatRows();
            self._renderVisible();
            self._updateInfo();
        });

        // 重置
        ov.querySelector('#hz3500-resetBtn').addEventListener('click', function() {
            searchInput.value = '';
            ov.querySelector('#hz3500-groupBy').value = '';
            self._sortCol = -1;
            ov.querySelectorAll('.hz3500-sort-icon').forEach(function(el) { el.textContent = ''; });
            self._filteredData = self._DATA.slice();
            self._collapsedGroups.clear();
            var vs = ov.querySelector('#hz3500-vscroll');
            if (vs) vs.scrollTop = 0;
            self._rebuildFlatRows();
            self._renderVisible();
            self._updateInfo();
        });

        // 批量认识
        ov.querySelector('#hz3500-batchKnownBtn').addEventListener('click', function() {
            self._batchMarkKnown();
        });
        // 反选
        ov.querySelector('#hz3500-invertBtn').addEventListener('click', function() {
            self._invertKnown();
        });
        // 清空认识
        ov.querySelector('#hz3500-clearKnownBtn').addEventListener('click', function() {
            self._clearKnown();
        });

        // 批量题材
        ov.querySelector('#hz3500-batchThemeBtn').addEventListener('click', function() {
            self._batchMarkTheme();
        });
        ov.querySelector('#hz3500-batchThemeInput').addEventListener('keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); self._batchMarkTheme(); }
        });
        // 清空题材
        ov.querySelector('#hz3500-clearThemeBtn').addEventListener('click', function() {
            self._clearTheme();
        });

        // 工具面板切换（右侧小面板）
        ov.querySelector('#hz3500-toolsBtn').addEventListener('click', function() {
            var side = ov.querySelector('#hz3500-side');
            var open = side.classList.toggle('show');
            this.classList.toggle('active', open);
        });

        // 导出CSV
        ov.querySelector('#hz3500-exportBtn').addEventListener('click', function() {
            self._exportCSV();
        });
        // 导出范围：选定维度后显示筛选下拉并刷新选项
        ov.querySelector('#hz3500-exportScope').addEventListener('change', function() {
            var filterSel = ov.querySelector('#hz3500-exportFilter');
            if (this.value === 'all') {
                filterSel.style.display = 'none';
            } else {
                self._refreshExportFilterOptions();
                filterSel.style.display = '';
            }
        });

        // 导入CSV
        ov.querySelector('#hz3500-importBtn').addEventListener('click', function() {
            ov.querySelector('#hz3500-importFile').click();
        });
        ov.querySelector('#hz3500-importFile').addEventListener('change', function(e) {
            var f = e.target.files && e.target.files[0];
            if (f) self._importCSV(f);
            e.target.value = ''; // 允许重复导入同一文件
        });

        // 虚拟滚动
        var vscroll = ov.querySelector('#hz3500-vscroll');
        vscroll.addEventListener('scroll', function() {
            if (!self._scrollTick) {
                self._scrollTick = true;
                requestAnimationFrame(function() {
                    self._scrollTick = false;
                    self._renderVisible();
                });
            }
        });

        // 窗口resize
        this._onResize = function() {
            if (!self._scrollTick) {
                self._scrollTick = true;
                requestAnimationFrame(function() {
                    self._scrollTick = false;
                    self._renderVisible();
                });
            }
        };
        window.addEventListener('resize', this._onResize);

        // ESC 关闭弹窗
        this._onKeyDown = function(e) {
            if (e.key === 'Escape') {
                self._closeModal();
                self._closeStrokePanel();
            }
        };
        document.addEventListener('keydown', this._onKeyDown);
    },

    // ========== 排序 ==========

    _sortBy: function(colIdx) {
        if (this._sortCol === colIdx) {
            this._sortAsc = !this._sortAsc;
        } else {
            this._sortCol = colIdx;
            this._sortAsc = true;
        }
        var ov = this._overlay;
        ov.querySelectorAll('.hz3500-sort-icon').forEach(function(el) { el.textContent = ''; });
        var icon = ov.querySelector('#hz3500-sort_' + colIdx);
        if (icon) icon.textContent = this._sortAsc ? '▲' : '▼';

        var self = this;
        var knownColIdx = this._COL[this.TEXTS.COL_KNOWN];
        var charColIdx = this._COL[this.TEXTS.COL_CHAR];
        this._filteredData.sort(function(a, b) {
            if (colIdx === knownColIdx) {
                var aKnown = self._knownSet.has(a[charColIdx] || '') ? 1 : 0;
                var bKnown = self._knownSet.has(b[charColIdx] || '') ? 1 : 0;
                return self._sortAsc ? bKnown - aKnown : aKnown - bKnown;
            }
            var va = a[colIdx] || '';
            var vb = b[colIdx] || '';
            var na = parseFloat(va), nb = parseFloat(vb);
            if (!isNaN(na) && !isNaN(nb)) return self._sortAsc ? na - nb : nb - na;
            return self._sortAsc ? va.localeCompare(vb, 'zh') : vb.localeCompare(va, 'zh');
        });

        var vs = ov.querySelector('#hz3500-vscroll');
        if (vs) vs.scrollTop = 0;
        this._collapsedGroups.clear();
        this._rebuildFlatRows();
        this._renderVisible();
        this._updateInfo();
    },

    // ========== 搜索 ==========

    _doSearch: function() {
        var ov = this._overlay;
        var query = ov.querySelector('#hz3500-searchInput').value.trim().toLowerCase();
        var self = this;

        this._filteredData = this._DATA.filter(function(row) {
            if (!query) return true;
            return row.some(function(cell) {
                return cell && cell.toLowerCase().indexOf(query) >= 0;
            });
        });

        if (this._sortCol >= 0) {
            var sc = this._sortCol, asc = this._sortAsc;
            var knownColIdx = this._COL[this.TEXTS.COL_KNOWN];
            var charColIdx = this._COL[this.TEXTS.COL_CHAR];
            var knownSet = this._knownSet;
            this._filteredData.sort(function(a, b) {
                if (sc === knownColIdx) {
                    var aKnown = knownSet.has(a[charColIdx] || '') ? 1 : 0;
                    var bKnown = knownSet.has(b[charColIdx] || '') ? 1 : 0;
                    return asc ? bKnown - aKnown : aKnown - bKnown;
                }
                var va = a[sc] || '', vb = b[sc] || '';
                var na = parseFloat(va), nb = parseFloat(vb);
                if (!isNaN(na) && !isNaN(nb)) return asc ? na - nb : nb - na;
                return asc ? va.localeCompare(vb, 'zh') : vb.localeCompare(va, 'zh');
            });
        }

        var vs = ov.querySelector('#hz3500-vscroll');
        if (vs) vs.scrollTop = 0;
        this._collapsedGroups.clear();
        this._rebuildFlatRows();
        this._renderVisible();
        this._updateInfo();
    },

    // ========== 分组 ==========

    _normalizePinyin: function(pinyin) {
        if (!pinyin) return '';
        var first = pinyin.split(' / ')[0].trim();
        var tones = {
            'ā':'a','á':'a','ǎ':'a','à':'a',
            'ē':'e','é':'e','ě':'e','è':'e',
            'ī':'i','í':'i','ǐ':'i','ì':'i',
            'ō':'o','ó':'o','ǒ':'o','ò':'o',
            'ū':'u','ú':'u','ǔ':'u','ù':'u',
            'ǖ':'v','ǘ':'v','ǚ':'v','ǜ':'v','ü':'v'
        };
        var result = '';
        for (var i = 0; i < first.length; i++) {
            result += tones[first[i]] || first[i];
        }
        return result;
    },

    _rebuildFlatRows: function() {
        this._flatRows = [];
        var ov = this._overlay;
        var groupCol = ov.querySelector('#hz3500-groupBy').value;

        if (!groupCol) {
            for (var i = 0; i < this._filteredData.length; i++) {
                this._flatRows.push({ type: 'd', dataIdx: i });
            }
            return;
        }

        var gIdx = this._COL[groupCol];
        var isPinyin = (groupCol === this.TEXTS.COL_PINYIN);
        var isKnown = (groupCol === this.TEXTS.COL_KNOWN);
        var isTheme = (groupCol === this.TEXTS.COL_THEME);
        var self = this;

        // 分组
        var groupMap = new Map();
        this._filteredData.forEach(function(row, i) {
            var key;
            if (isKnown) {
                key = self._knownSet.has(row[self._COL[self.TEXTS.COL_CHAR]] || '')
                    ? self.TEXTS.GROUP_KNOWN : self.TEXTS.GROUP_UNKNOWN;
            } else if (isTheme) {
                key = self._themeMap.get(row[self._COL[self.TEXTS.COL_CHAR]] || '') || '（未分类）';
            } else if (isPinyin) {
                key = self._normalizePinyin(row[gIdx]);
            } else {
                key = row[gIdx] || '（空）';
            }
            if (!groupMap.has(key)) groupMap.set(key, []);
            groupMap.get(key).push(i);
        });

        // 分组键排序（认识分组：认识在前）
        var groupKeys = Array.from(groupMap.keys());
        groupKeys.sort(function(a, b) {
            if (isKnown) {
                if (a === self.TEXTS.GROUP_KNOWN) return -1;
                if (b === self.TEXTS.GROUP_KNOWN) return 1;
                return 0;
            }
            var na = parseFloat(a), nb = parseFloat(b);
            if (!isNaN(na) && !isNaN(nb)) return na - nb;
            return a.localeCompare(b, 'zh');
        });

        groupKeys.forEach(function(key) {
            var indices = groupMap.get(key);
            self._flatRows.push({ type: 'g', name: key, count: indices.length });
            if (!self._collapsedGroups.has(key)) {
                indices.forEach(function(i) {
                    self._flatRows.push({ type: 'd', dataIdx: i });
                });
            }
        });
    },

    _toggleGroup: function(groupName) {
        if (this._collapsedGroups.has(groupName)) {
            this._collapsedGroups.delete(groupName);
        } else {
            this._collapsedGroups.add(groupName);
        }
        this._rebuildFlatRows();
        this._renderVisible();
    },

    // ========== 虚拟滚动渲染 ==========

    _renderVisible: function() {
        var ov = this._overlay;
        if (!ov) return;
        var vscroll = ov.querySelector('#hz3500-vscroll');
        if (!vscroll) return;

        var scrollTop = vscroll.scrollTop;
        var viewH = vscroll.clientHeight;
        var total = this._flatRows.length;

        var totalH = 0;
        var rowHeights = [];
        var rowOffsets = [];
        for (var i = 0; i < total; i++) {
            rowOffsets.push(totalH);
            var h = this._flatRows[i].type === 'g' ? this._GROUP_H : this._ROW_H;
            rowHeights.push(h);
            totalH += h;
        }

        var start = 0;
        for (var i = 0; i < total; i++) {
            if (rowOffsets[i] + rowHeights[i] > scrollTop) {
                start = i;
                break;
            }
        }
        start = Math.max(0, start - this._BUFFER);

        var end = start;
        var acc = rowOffsets[start] || 0;
        while (end < total && acc < scrollTop + viewH + this._BUFFER * this._ROW_H) {
            acc += rowHeights[end];
            end++;
        }
        if (end > total) end = total;

        var colCount = this._HEADER.length;
        var topH = rowOffsets[start] || 0;
        var botOffset = end < total ? (totalH - rowOffsets[end]) : 0;
        var self = this;
        var T = this.TEXTS;

        var parts = [];

        if (topH > 0) {
            parts.push('<tr style="height:' + topH + 'px;"><td colspan="' + colCount + '" style="padding:0;border:0;"></td></tr>');
        }

        for (var idx = start; idx < end; idx++) {
            var fr = this._flatRows[idx];
            if (fr.type === 'g') {
                var collapsed = this._collapsedGroups.has(fr.name);
                var cls = collapsed ? 'hz3500-group-row collapsed' : 'hz3500-group-row';
                parts.push('<tr class="' + cls + '" style="height:' + this._GROUP_H + 'px;" onclick="Hanzi3500Skill._toggleGroup(\'' + fr.name.replace(/'/g, "\\'") + '\')">' +
                    '<td colspan="' + colCount + '">' +
                    '<span class="hz3500-group-arrow">▼</span>' +
                    fr.name +
                    '<span class="hz3500-group-count">' + fr.count + ' ' + T.INFO_CHARS + '</span>' +
                    '</td></tr>');
            } else {
                var row = this._filteredData[fr.dataIdx];
                var rowHtml = '<tr style="height:' + this._ROW_H + 'px;">';
                for (var c = 0; c < this._HEADER.length; c++) {
                    var name = this._HEADER[c];
                    var val = row[c] || '';
                    var cellContent = val;

                    if (name === T.COL_CHAR) {
                        cellContent = '<span class="hz3500-char-cell" onclick="Hanzi3500Skill._showDetail(' + fr.dataIdx + ')">' + val + '</span>';
                    } else if (name === T.COL_STROKE) {
                        cellContent = '<span class="hz3500-stroke-cell" onclick="Hanzi3500Skill._showStroke(' + fr.dataIdx + ')">' + T.STROKE_VIEW + '</span>';
                    } else if (name === T.COL_KNOWN) {
                        var charVal = row[self._COL[T.COL_CHAR]] || '';
                        var isKnown = self._knownSet.has(charVal);
                        cellContent = '<input type="checkbox" class="hz3500-known-cb" ' + (isKnown ? 'checked' : '') +
                            ' onclick="Hanzi3500Skill._toggleKnown(\'' + charVal.replace(/'/g, "\\'") + '\')">';
                    } else if (name === T.COL_THEME) {
                        var tChar = row[self._COL[T.COL_CHAR]] || '';
                        var themeVal = self._themeMap.get(tChar) || '';
                        cellContent = '<span class="hz3500-theme-cell" title="点击设置题材" onclick="Hanzi3500Skill._editTheme(' + fr.dataIdx + ')">' +
                            (themeVal ? themeVal : '<span class="hz3500-theme-empty">—</span>') + '</span>';
                    }
                    rowHtml += '<td>' + cellContent + '</td>';
                }
                rowHtml += '</tr>';
                parts.push(rowHtml);
            }
        }

        if (botOffset > 0) {
            parts.push('<tr style="height:' + botOffset + 'px;"><td colspan="' + colCount + '" style="padding:0;border:0;"></td></tr>');
        }

        ov.querySelector('#hz3500-tableBody').innerHTML = parts.join('');
    },

    _updateInfo: function() {
        var ov = this._overlay;
        if (!ov) return;
        var total = this._filteredData.length;
        var info = ov.querySelector('#hz3500-resultInfo');
        var extra = ov.querySelector('#hz3500-extraInfo');
        var groupCol = ov.querySelector('#hz3500-groupBy').value;
        var T = this.TEXTS;

        if (total === 0) {
            info.textContent = T.INFO_NO_RESULT;
            extra.textContent = '';
            return;
        }

        var txt = T.INFO_TOTAL + ' ' + total + ' ' + T.INFO_CHARS;
        if (groupCol) {
            var isP = (groupCol === T.COL_PINYIN);
            var isK = (groupCol === T.COL_KNOWN);
            var isT = (groupCol === T.COL_THEME);
            var self = this;
            var groupCount = new Set(this._filteredData.map(function(r) {
                if (isK) {
                    return self._knownSet.has(r[self._COL[self.TEXTS.COL_CHAR]] || '')
                        ? self.TEXTS.GROUP_KNOWN : self.TEXTS.GROUP_UNKNOWN;
                }
                if (isT) {
                    return self._themeMap.get(r[self._COL[self.TEXTS.COL_CHAR]] || '') || '（未分类）';
                }
                if (isP) return self._normalizePinyin(r[self._COL[groupCol]]);
                return r[self._COL[groupCol]] || '（空）';
            }, this)).size;
            txt += ' · ' + groupCount + ' ' + T.INFO_GROUPS;
        }
        info.textContent = txt;
        extra.textContent = total === this._DATA.length ? '' : (T.INFO_FILTERED + ' ' + this._DATA.length + ' ' + T.INFO_CHARS + ')');
    },

    _renderTable: function() {
        this._rebuildFlatRows();
        this._renderVisible();
        this._updateInfo();
        this._updateKnownCount();
    },

    // ========== 认识标记 ==========

    _toggleKnown: function(char) {
        if (!char) return;
        if (this._knownSet.has(char)) {
            this._knownSet.delete(char);
        } else {
            this._knownSet.add(char);
        }
        this._saveKnown();
        this._renderVisible();
        this._updateKnownCount();
    },

    _batchMarkKnown: function() {
        var input = this._overlay.querySelector('#hz3500-batchInput');
        if (!input) return;
        var text = input.value;
        var chars = text.match(/[\u4e00-\u9fff]/g) || [];
        var count = 0;
        for (var i = 0; i < chars.length; i++) {
            if (!this._knownSet.has(chars[i])) {
                this._knownSet.add(chars[i]);
                count++;
            }
        }
        this._saveKnown();
        this._renderVisible();
        this._updateKnownCount();
        input.value = '';
        if (typeof CosUI !== 'undefined' && CosUI.toast && CosUI.toast.show) {
            CosUI.toast.show('已标记 ' + count + ' 个字为认识', 2000);
        }
    },

    _invertKnown: function() {
        var self = this;
        this._filteredData.forEach(function(row) {
            var char = row[self._COL[self.TEXTS.COL_CHAR]] || '';
            if (char) {
                if (self._knownSet.has(char)) {
                    self._knownSet.delete(char);
                } else {
                    self._knownSet.add(char);
                }
            }
        });
        this._saveKnown();
        this._renderVisible();
        this._updateKnownCount();
    },

    _clearKnown: function() {
        if (!confirm('确定清空所有认识标记吗？')) return;
        this._knownSet.clear();
        this._saveKnown();
        this._renderVisible();
        this._updateKnownCount();
    },

    // ========== 题材标记 ==========

    _saveTheme: function() {
        try {
            localStorage.setItem('hz3500-theme', JSON.stringify(Object.fromEntries(this._themeMap)));
        } catch(e) {}
    },

    _loadTheme: function() {
        if (!this._themeMap) {
            this._themeMap = new Map();
            // 1) 内置默认题材（初始填充）
            try {
                if (typeof HANZI_3500_THEME !== 'undefined') {
                    for (var dk in HANZI_3500_THEME) {
                        if (HANZI_3500_THEME.hasOwnProperty(dk)) this._themeMap.set(dk, HANZI_3500_THEME[dk]);
                    }
                }
            } catch(e) {}
            // 2) 用户已保存的覆盖默认（含空串哨兵=已清空）
            try {
                var obj = JSON.parse(localStorage.getItem('hz3500-theme') || '{}');
                for (var k in obj) { if (obj.hasOwnProperty(k)) this._themeMap.set(k, obj[k]); }
            } catch(e) {}
        }
    },

    _editTheme: function(dataIdx) {
        var row = this._filteredData[dataIdx];
        if (!row) return;
        var char = row[this._COL[this.TEXTS.COL_CHAR]] || '';
        if (!char) return;
        var cur = this._themeMap.get(char) || '';
        var v = prompt('设置「' + char + '」的题材：', cur);
        if (v === null) return;
        v = v.trim();
        // 空串 = 清空该字题材（哨兵，覆盖默认词典）
        this._themeMap.set(char, v);
        this._saveTheme();
        this._renderVisible();
    },

    _batchMarkTheme: function() {
        var charInput = this._overlay.querySelector('#hz3500-batchInput');
        var themeInput = this._overlay.querySelector('#hz3500-batchThemeInput');
        if (!charInput || !themeInput) return;
        var chars = (charInput.value || '').match(/[\u4e00-\u9fff]/g) || [];
        var theme = (themeInput.value || '').trim();
        var count = 0;
        for (var i = 0; i < chars.length; i++) {
            var ch = chars[i];
            var cur = this._themeMap.has(ch) ? this._themeMap.get(ch) : undefined;
            if (cur !== theme) {
                this._themeMap.set(ch, theme); // 空串=清空
                count++;
            }
        }
        this._saveTheme();
        this._renderVisible();
        this._toast(theme === '' ? ('已清空 ' + count + ' 个字的题材') : ('已将 ' + count + ' 个字标记为「' + theme + '」'));
    },

    _clearTheme: function() {
        if (!confirm('确定清空所有题材标记吗？')) return;
        // 清空全部：默认词典里的字也用空串哨兵覆盖，避免重载后复活
        var keys = {};
        try { if (typeof HANZI_3500_THEME !== 'undefined') { for (var d in HANZI_3500_THEME) keys[d] = 1; } } catch(e) {}
        this._themeMap.forEach(function(_, k) { keys[k] = 1; });
        for (var key in keys) { this._themeMap.set(key, ''); }
        this._saveTheme();
        this._renderVisible();
    },

    _saveKnown: function() {
        try {
            localStorage.setItem('hz3500-known', JSON.stringify(Array.from(this._knownSet)));
        } catch(e) {}
    },

    _loadKnown: function() {
        if (!this._knownSet) {
            try {
                var arr = JSON.parse(localStorage.getItem('hz3500-known') || '[]');
                this._knownSet = new Set(arr);
            } catch(e) {
                this._knownSet = new Set();
            }
        }
    },

    _updateKnownCount: function() {
        var el = this._overlay ? this._overlay.querySelector('#hz3500-knownCount') : null;
        if (el) {
            var known = this._knownSet.size;
            var total = this._DATA ? this._DATA.length : 0;
            el.textContent = this.TEXTS.INFO_KNOWN + ' ' + known + '/' + total;
        }
    },

    // ========== 导出 CSV ==========

    _csvCell: function(v) {
        v = (v == null) ? '' : String(v);
        // 含逗号/引号/换行时需要用引号包裹并转义引号
        if (/[",\n\r]/.test(v)) {
            v = '"' + v.replace(/"/g, '""') + '"';
        }
        return v;
    },

    _refreshExportFilterOptions: function() {
        var sel = this._overlay ? this._overlay.querySelector('#hz3500-exportFilter') : null;
        if (!sel) return;
        var self = this;
        var scopeSel = sel.parentNode.querySelector('#hz3500-exportScope');
        var scope = scopeSel ? scopeSel.value : 'all';
        var vals = [];
        if (scope === 'tone') {
            vals = ['1', '2', '3', '4', '5'];
        } else if (scope === 'theme') {
            var set = new Set();
            this._themeMap.forEach(function(v) { if (v) set.add(v); });
            vals = Array.from(set).sort(function(a, b) { return a.localeCompare(b, 'zh'); });
        } else {
            var colName = { letter: this.TEXTS.COL_LETTER, strokes: this.TEXTS.COL_STROKES, radical: this.TEXTS.COL_RADICAL }[scope];
            if (colName) {
                var set2 = new Set();
                var data = this._DATA || [];
                for (var i = 0; i < data.length; i++) {
                    var v = data[i][this._COL[colName]];
                    if (v === undefined || v === null || v === '') continue;
                    set2.add(String(v));
                }
                vals = Array.from(set2);
                if (scope === 'strokes') vals.sort(function(a, b) { return parseInt(a, 10) - parseInt(b, 10); });
                else if (scope === 'letter') vals.sort();
                else vals.sort(function(a, b) { return a.localeCompare(b, 'zh'); });
            }
        }
        var nameMap = { theme: '题材', letter: '字母', strokes: '笔画数', radical: '偏旁', tone: '声调' };
        var cur = sel.value;
        var html = '<option value="">— 选择' + (nameMap[scope] || '') + ' —</option>';
        vals.forEach(function(v) {
            var text = (scope === 'tone') ? self._TONE_LABELS[v] : v;
            html += '<option value="' + v + '">' + text + '</option>';
        });
        sel.innerHTML = html;
        if (cur) {
            for (var j = 0; j < sel.options.length; j++) {
                if (sel.options[j].value === cur) { sel.value = cur; break; }
            }
        }
    },

    _getTone: function(pinyin) {
        var map = this._TONE_MAP;
        for (var i = 0; i < pinyin.length; i++) {
            var t = map[pinyin[i]];
            if (t) return t;
        }
        return '5';
    },

    _exportCSV: function() {
        var T = this.TEXTS;
        var self = this;
        var charIdx = this._COL[T.COL_CHAR];

        // 导出列：序号 汉字 拼音 字母 笔画 偏旁 题材 认识
        var headers = [T.COL_ID, T.COL_CHAR, T.COL_PINYIN, T.COL_LETTER, T.COL_STROKES, T.COL_RADICAL, T.COL_THEME, T.COL_KNOWN];
        var lines = [headers.map(function(h) { return self._csvCell(h); }).join(',')];

        // 导出范围（默认全部，可按题材/字母/笔画/偏旁/拼音声调筛选）
        var scopeSel = this._overlay.querySelector('#hz3500-exportScope');
        var scope = scopeSel ? scopeSel.value : 'all';
        var exportFilter = '';
        var scopeLabel = { theme: '题材', letter: '字母', strokes: '笔画', radical: '偏旁', tone: '拼音声调' }[scope] || '';
        var rows = this._filteredData || [];
        if (scope !== 'all') {
            var filterSel = this._overlay.querySelector('#hz3500-exportFilter');
            exportFilter = filterSel ? (filterSel.value || '') : '';
            if (!exportFilter) {
                self._toast('请先选择要导出的「' + scopeLabel + '」值');
                return;
            }
            rows = rows.filter(function(r) {
                var ch = r[self._COL[self.TEXTS.COL_CHAR]] || '';
                var val;
                if (scope === 'theme') val = self._themeMap.get(ch) || '';
                else if (scope === 'tone') val = self._getTone(r[self._COL[self.TEXTS.COL_PINYIN]] || '');
                else {
                    var colName = { letter: self.TEXTS.COL_LETTER, strokes: self.TEXTS.COL_STROKES, radical: self.TEXTS.COL_RADICAL }[scope];
                    val = String(r[self._COL[colName]] || '');
                }
                return val === exportFilter;
            });
            if (rows.length === 0) {
                self._toast('该「' + scopeLabel + '」下没有可导出的字');
                return;
            }
        }

        // 导出当前筛选后的数据（尊重搜索/排序结果）
        for (var i = 0; i < rows.length; i++) {
            var row = rows[i];
            var charV = row[charIdx] || '';
            var known = this._knownSet.has(charV) ? '\u221a' : ''; // √ 打勾
            var theme = this._themeMap.get(charV) || '';
            var cells = [
                row[this._COL[T.COL_ID]] || '',
                row[this._COL[T.COL_CHAR]] || '',
                row[this._COL[T.COL_PINYIN]] || '',
                row[this._COL[T.COL_LETTER]] || '',
                row[this._COL[T.COL_STROKES]] || '',
                row[this._COL[T.COL_RADICAL]] || '',
                theme,
                known
            ];
            lines.push(cells.map(function(c) { return self._csvCell(c); }).join(','));
        }

        var csv = lines.join('\r\n');
        // BOM 保证 Excel 正确识别 UTF-8 中文
        var blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
        var url = URL.createObjectURL(blob);

        var d = new Date();
        var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
        var stamp = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) +
            '_' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
        var scopeSuffix = '';
        if (scope !== 'all' && exportFilter) {
            scopeSuffix = '_' + ((scope === 'tone') ? this._TONE_LABELS[exportFilter] : exportFilter);
        }
        var fname = '3500常用汉字' + scopeSuffix + '_' + stamp + '.csv';

        var a = document.createElement('a');
        a.href = url;
        a.download = fname;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function() { URL.revokeObjectURL(url); }, 1000);

        if (typeof CosUI !== 'undefined' && CosUI.toast && CosUI.toast.show) {
            var scopeMsg = (scope !== 'all' && exportFilter) ? '（' + scopeLabel + '：' + ((scope === 'tone') ? this._TONE_LABELS[exportFilter] : exportFilter) + '）' : '';
            CosUI.toast.show('已导出 ' + rows.length + ' 字' + scopeMsg + '（认识 ' + this._knownSet.size + '）', 2200);
        }
    },

    // ========== 解析 / 导入 CSV ==========

    _parseCSV: function(text) {
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // 去 BOM
        var rows = [], row = [], field = '';
        var i = 0, n = text.length, inQuotes = false;
        while (i < n) {
            var c = text[i];
            if (inQuotes) {
                if (c === '"') {
                    if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
                    inQuotes = false; i++; continue;
                }
                field += c; i++; continue;
            }
            if (c === '"') { inQuotes = true; i++; continue; }
            if (c === ',') { row.push(field); field = ''; i++; continue; }
            if (c === '\r') { i++; continue; }
            if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
            field += c; i++;
        }
        if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }
        // 丢弃完全空白的行
        return rows.filter(function(r) { return r.length && r.join('').trim() !== ''; });
    },

    _importCSV: function(file) {
        var self = this;
        var reader = new FileReader();
        reader.onload = function(e) {
            var text = e.target.result || '';
            var rows = self._parseCSV(text);
            if (!rows.length) {
                self._toast('文件为空');
                return;
            }
            var header = rows[0].map(function(h) { return (h || '').trim(); });
            var charCol = header.indexOf(self.TEXTS.COL_CHAR);   // 汉字
            var knownCol = header.indexOf(self.TEXTS.COL_KNOWN); // 认识
            var themeCol = header.indexOf(self.TEXTS.COL_THEME); // 题材
            if (charCol < 0) {
                self._toast('CSV 缺少「汉字」列，无法匹配');
                return;
            }
            var added = 0, themeAdded = 0;
            for (var i = 1; i < rows.length; i++) {
                var r = rows[i];
                var ch = (r[charCol] || '').trim();
                if (!ch) continue;
                // 认识列存在且非空（√/1/yes 等）→ 标记为已认识（合并到现有进度）
                var knownVal = (knownCol >= 0 && r[knownCol] != null) ? r[knownCol].trim() : '';
                if (knownVal !== '') {
                    if (!self._knownSet.has(ch)) { self._knownSet.add(ch); added++; }
                }
                // 题材列存在且非空 → 设置题材标签（合并：非空才写入）
                var themeVal = (themeCol >= 0 && r[themeCol] != null) ? r[themeCol].trim() : '';
                if (themeVal !== '') {
                    if (self._themeMap.get(ch) !== themeVal) { self._themeMap.set(ch, themeVal); themeAdded++; }
                }
            }
            self._saveKnown();
            self._saveTheme();
            self._rebuildFlatRows();
            self._renderVisible();
            self._updateKnownCount();
            self._updateInfo();
            self._toast('已导入：认识 ' + added + ' 字，题材 ' + themeAdded + ' 字（累计认识 ' + self._knownSet.size + '）');
        };
        reader.readAsText(file, 'utf-8');
    },

    _toast: function(msg) {
        if (typeof CosUI !== 'undefined' && CosUI.toast && CosUI.toast.show) {
            CosUI.toast.show(msg, 2200);
        } else {
            alert(msg);
        }
    },

    // ========== 详情弹窗 ==========

    _showDetail: function(dataIdx) {
        var row = this._filteredData[dataIdx];
        if (!row) return;
        var T = this.TEXTS;
        var self = this;

        // 移除旧弹窗
        var old = document.getElementById('hz3500-modal');
        if (old) old.remove();

        var overlay = document.createElement('div');
        overlay.id = 'hz3500-modal';
        overlay.className = 'hz3500-modal-overlay';

        var charVal = row[this._COL[T.COL_CHAR]];
        var pinyinVal = row[this._COL[T.COL_PINYIN]] || '';

        var gridHtml = '';
        var labels = [T.MODAL_LABEL_ID, T.MODAL_LABEL_PINYIN, T.MODAL_LABEL_LETTER, T.MODAL_LABEL_STROKES, T.MODAL_LABEL_RADICAL];
        var colIndices = [this._COL[T.COL_ID], this._COL[T.COL_PINYIN], this._COL[T.COL_LETTER], this._COL[T.COL_STROKES], this._COL[T.COL_RADICAL]];
        for (var i = 0; i < labels.length; i++) {
            var val = row[colIndices[i]] || '—';
            gridHtml += '<div class="hz3500-modal-item"><span class="label">' + labels[i] + '</span><span class="value">' + val + '</span></div>';
        }
        gridHtml += '<div class="hz3500-modal-item" style="border:none;padding-top:12px;">' +
            '<span class="label">' + T.COL_STROKE + '</span>' +
            '<span class="value"><span class="hz3500-stroke-cell" onclick="Hanzi3500Skill._closeModal();Hanzi3500Skill._showStroke(' + dataIdx + ');">' + T.DETAIL_STROKE_LINK + '</span></span></div>';

        overlay.innerHTML =
            '<div class="hz3500-modal-card">' +
                '<button class="hz3500-modal-close">×</button>' +
                '<div class="hz3500-modal-char">' + charVal + '</div>' +
                '<div class="hz3500-modal-pinyin">' + pinyinVal + '</div>' +
                '<div class="hz3500-modal-grid">' + gridHtml + '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        // 点击背景关闭
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) self._closeModal();
        });

        // 关闭按钮
        overlay.querySelector('.hz3500-modal-close').addEventListener('click', function() {
            self._closeModal();
        });

        // 置顶
        var tz = (window.__cos_topZ || 10000) + 1;
        window.__cos_topZ = tz;
        overlay.style.zIndex = tz;

        requestAnimationFrame(function() { overlay.classList.add('show'); });
    },

    _closeModal: function() {
        var modal = document.getElementById('hz3500-modal');
        if (modal) {
            modal.classList.remove('show');
            setTimeout(function() { if (modal.parentNode) modal.remove(); }, 200);
        }
    },

    // ========== 笔顺动画面板 ==========

    _loadHanziWriter: function(callback) {
        if (this._hanziWriterLoaded) {
            callback();
            return;
        }
        if (this._hanziWriterChecking) {
            // 等待加载完成
            var self = this;
            var checkTimer = setInterval(function() {
                if (self._hanziWriterLoaded) {
                    clearInterval(checkTimer);
                    callback();
                }
            }, 100);
            return;
        }
        this._hanziWriterChecking = true;
        var self = this;
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js';
        s.onload = function() {
            self._hanziWriterLoaded = true;
            self._hanziWriterChecking = false;
            callback();
        };
        s.onerror = function() {
            self._hanziWriterChecking = false;
            callback();
        };
        document.head.appendChild(s);
    },

    _showStroke: function(dataIdx) {
        var row = this._filteredData[dataIdx];
        if (!row) return;
        var self = this;
        var T = this.TEXTS;
        var char = row[this._COL[T.COL_CHAR]];

        this._strokeDataIdx = dataIdx;

        // 移除旧面板
        var old = document.getElementById('hz3500-strokeOverlay');
        if (old) old.remove();

        var overlay = document.createElement('div');
        overlay.id = 'hz3500-strokeOverlay';
        overlay.className = 'hz3500-stroke-overlay';

        overlay.innerHTML =
            '<div class="hz3500-stroke-panel">' +
                '<button class="hz3500-stroke-close">×</button>' +
                '<div class="hz3500-stroke-title">' + char + ' · ' + T.STROKE_TITLE + '</div>' +
                '<div class="hz3500-stroke-sub">' + T.STROKE_SUB + '</div>' +
                '<div class="hz3500-stroke-canvas"><div id="hz3500-strokeTarget"></div></div>' +
                '<div class="hz3500-stroke-btns">' +
                    '<button class="hz3500-stroke-btn-primary" id="hz3500-playBtn">' + T.STROKE_PLAY + '</button>' +
                    '<button class="hz3500-stroke-btn-secondary" id="hz3500-outlineBtn">' + T.STROKE_OUTLINE + '</button>' +
                    '<button class="hz3500-stroke-btn-secondary" id="hz3500-resetBtn2">' + T.STROKE_RESET + '</button>' +
                    '<button class="hz3500-stroke-btn-speak" id="hz3500-speakBtn">' + T.STROKE_SPEAK + '</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(overlay);

        // 点击背景关闭
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) self._closeStrokePanel();
        });

        // 关闭按钮
        overlay.querySelector('.hz3500-stroke-close').addEventListener('click', function() {
            self._closeStrokePanel();
        });

        // 按钮事件
        overlay.querySelector('#hz3500-playBtn').addEventListener('click', function() { self._playStrokeAnim(); });
        overlay.querySelector('#hz3500-outlineBtn').addEventListener('click', function() { self._toggleOutline(); });
        overlay.querySelector('#hz3500-resetBtn2').addEventListener('click', function() { self._resetStroke(); });
        overlay.querySelector('#hz3500-speakBtn').addEventListener('click', function() { self._speakChar(); });

        // 置顶
        var tz = (window.__cos_topZ || 10000) + 1;
        window.__cos_topZ = tz;
        overlay.style.zIndex = tz;

        requestAnimationFrame(function() {
            overlay.classList.add('show');
            self._strokeShowOutline = true;

            // 清理旧 writer
            if (self._strokeWriter) {
                try { self._strokeWriter.destroy(); } catch(e) {}
                self._strokeWriter = null;
            }

            // 加载 HanziWriter 并创建实例
            self._loadHanziWriter(function() {
                var target = document.getElementById('hz3500-strokeTarget');
                if (!target) return;
                if (typeof HanziWriter === 'undefined') {
                    target.innerHTML = '<p style="color:#999;padding:60px 0;">' + T.STROKE_NO_DATA + '</p>';
                    return;
                }
                try {
                    self._strokeWriter = HanziWriter.create('hz3500-strokeTarget', char, {
                        width: 300,
                        height: 300,
                        padding: 5,
                        showOutline: true,
                        strokeAnimationSpeed: 1,
                        delayBetweenStrokes: 300,
                        radicalColor: '#168F16',
                        drawingWidth: 40,
                        drawingColor: '#38bdf8'
                    });
                } catch(err) {
                    target.innerHTML = '<p style="color:#999;padding:60px 0;">' + T.STROKE_NO_DATA + '</p>';
                }
            });
        });
    },

    _playStrokeAnim: function() {
        if (!this._strokeWriter) return;
        this._strokeWriter.hideCharacter();
        this._strokeWriter.showOutline();
        this._strokeWriter.animateCharacter();
    },

    _toggleOutline: function() {
        if (!this._strokeWriter) return;
        this._strokeShowOutline = !this._strokeShowOutline;
        if (this._strokeShowOutline) {
            this._strokeWriter.showOutline();
        } else {
            this._strokeWriter.hideOutline();
        }
    },

    _resetStroke: function() {
        if (!this._strokeWriter) return;
        this._strokeWriter.hideCharacter();
        this._strokeWriter.showOutline();
        this._strokeShowOutline = true;
    },

    _closeStrokePanel: function() {
        this._stopAllSpeech();
        var overlay = document.getElementById('hz3500-strokeOverlay');
        if (overlay) {
            overlay.classList.remove('show');
            setTimeout(function() { if (overlay.parentNode) overlay.remove(); }, 200);
        }
        if (this._strokeWriter) {
            try { this._strokeWriter.destroy(); } catch(e) {}
            this._strokeWriter = null;
        }
    },

    // ========== 语音播报 ==========

    _speakChar: function() {
        var T = this.TEXTS;
        var btn = document.getElementById('hz3500-speakBtn');
        if (!btn) return;

        // 正在播报 → 停止
        if ('speechSynthesis' in window && speechSynthesis.speaking) {
            this._stopAllSpeech();
            return;
        }

        if (this._strokeDataIdx < 0) return;
        var row = this._filteredData[this._strokeDataIdx];
        if (!row) return;
        var char = row[this._COL[T.COL_CHAR]] || '';

        btn.classList.add('speaking');
        btn.textContent = T.STROKE_SPEAKING;

        var self = this;
        if (!('speechSynthesis' in window)) {
            self._resetSpeakBtn();
            return;
        }
        var utter = new SpeechSynthesisUtterance(char);
        utter.lang = 'zh-CN';
        utter.rate = 0.9;
        utter.onend = function() { self._resetSpeakBtn(); };
        utter.onerror = function() { self._resetSpeakBtn(); };
        speechSynthesis.speak(utter);
    },

    _resetSpeakBtn: function() {
        var btn = document.getElementById('hz3500-speakBtn');
        if (btn) {
            btn.classList.remove('speaking');
            btn.textContent = this.TEXTS.STROKE_SPEAK;
        }
    },

    _stopAllSpeech: function() {
        if ('speechSynthesis' in window) { speechSynthesis.cancel(); }
        this._resetSpeakBtn();
    },

    // ========== 子工具栏 ==========

    getSubTools: function() {
        var self = this;
        return [
            {
                label: '顶部',
                title: '滚动到顶部',
                action: function() {
                    if (!self._overlay) return;
                    var vs = self._overlay.querySelector('#hz3500-vscroll');
                    if (vs) vs.scrollTo({ top: 0, behavior: 'smooth' });
                }
            },
            {
                label: '随机',
                title: '随机查看一个汉字',
                action: function() { self._randomChar(); }
            }
        ];
    },

    _randomChar: function() {
        if (!this._filteredData || this._filteredData.length === 0) return;
        var idx = Math.floor(Math.random() * this._filteredData.length);
        this._showDetail(idx);
    },

    // ========== 保存/恢复 ==========

    save: function() {
        return {
            sortCol: this._sortCol,
            sortAsc: this._sortAsc
        };
    },

    load: function(data) {
        if (!data) return;
        this._sortCol = data.sortCol !== undefined ? data.sortCol : -1;
        this._sortAsc = data.sortAsc !== undefined ? data.sortAsc : true;
    }
};
