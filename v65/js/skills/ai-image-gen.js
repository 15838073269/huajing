/**
 * AI 无限画布 - v65 插件
 *
 * 节点式 AI 图片生成器
 *  - 文生图节点：输入提示词生成图片
 *  - 图生图节点：上传/云盘导入参考图 + 提示词生成
 *  - 每个节点独立尺寸选择
 *  - 云盘导入/导出
 *  - 工作区保存为 .json 文件 / 从 .json 加载
 *  - IndexedDB 自动持久化
 */

(function() {
    var s = document.createElement('style');
    s.textContent =
        '.aig-overlay{position:fixed;width:860px;height:620px;z-index:9999;display:flex;flex-direction:column;background:#1a1a2e;color:#e0e0e0;font-family:"Segoe UI",system-ui,sans-serif;border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,.6);overflow:hidden;min-width:500px;min-height:400px;}' +
        '.aig-header{display:flex;align-items:center;justify-content:space-between;padding:8px 16px;background:#16213e;border-bottom:1px solid #0f3460;flex-shrink:0;cursor:move;user-select:none;}' +
        '.aig-header h2{font-size:15px;margin:0;color:#4ecca3;}' +
        '.aig-h-status{font-size:11px;color:#64748b;margin:0 8px;flex:1;text-align:center;}' +
        '.aig-header-right{display:flex;align-items:center;gap:6px;flex-shrink:0;}' +
        '.aig-key-get-btn{display:inline-flex;align-items:center;gap:3px;padding:4px 10px;border-radius:6px;background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.2);color:#38bdf8;text-decoration:none;font-size:12px;font-weight:500;cursor:pointer;transition:all 0.15s;}' +
        '.aig-key-get-btn:hover{background:rgba(56,189,248,0.2);}' +
        '.aig-close-btn{background:rgba(220,80,60,.2);border:1px solid rgba(220,80,60,.3);color:#e87060;border-radius:8px;padding:5px 14px;cursor:pointer;font-size:13px;transition:all 0.15s;}' +
        '.aig-close-btn:hover{background:rgba(220,80,60,.4);}' +
        // ---- 工具栏 ----
        '.aig-toolbar{display:flex;align-items:center;padding:6px 12px;background:#16213e;border-bottom:1px solid #0f3460;flex-shrink:0;gap:6px;flex-wrap:wrap;}' +
        '.aig-toolbar button{background:#0f3460;color:#e0e0e0;border:1px solid #1a5276;padding:5px 12px;border-radius:6px;cursor:pointer;font-size:12px;transition:all 0.2s;white-space:nowrap;}' +
        '.aig-toolbar button:hover{background:#1a5276;}' +
        '.aig-toolbar .sep{width:1px;height:22px;background:#0f3460;flex-shrink:0;}' +
        '.aig-toolbar label{font-size:12px;color:#888;white-space:nowrap;}' +
        '.aig-toolbar input[type="text"]{background:#0a1628;border:1px solid #0f3460;color:#e0e0e0;padding:4px 8px;border-radius:6px;font-size:12px;width:150px;outline:none;}' +
        '.aig-toolbar input[type="text"]:focus{border-color:#4ecca3;}' +
        '.aig-key-btn{background:none;border:none;color:#94a3b8;cursor:pointer;font-size:13px;padding:2px 4px;border-radius:4px;transition:all 0.15s;line-height:1;flex-shrink:0;}' +
        '.aig-key-btn:hover{background:rgba(255,255,255,0.08);color:#e8edf5;}' +
        '.aig-key-del:hover{background:rgba(220,80,60,0.2);color:#e87060;}' +
        // ---- 画布 ----
        '.aig-canvas-wrap{flex:1;overflow:hidden;position:relative;cursor:grab;min-height:0;}' +
        '.aig-canvas-wrap.grabbing{cursor:grabbing;}' +
        '.aig-viewport{position:absolute;top:0;left:0;transform-origin:0 0;}' +
        // ---- 节点 ----
        '.aig-node{position:absolute;min-width:300px;max-width:420px;background:#16213e;border:2px solid #0f3460;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.5);cursor:move;user-select:none;}' +
        '.aig-node.selected{border-color:#4ecca3;box-shadow:0 0 20px rgba(78,204,163,0.3);}' +
        '.aig-node-header{background:#0f3460;padding:6px 10px;border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:space-between;font-size:12px;color:#e0e0e0;font-weight:600;gap:4px;}' +
        '.aig-node-header .close{cursor:pointer;color:#e74c3c;font-size:15px;padding:0 4px;flex-shrink:0;}' +
        '.aig-node-body{padding:8px 10px;}' +
        '.aig-node-prompt{width:100%;min-height:70px;background:#0a1628;border:1px solid #0f3460;color:#e0e0e0;padding:8px;border-radius:6px;font-size:12px;resize:vertical;font-family:inherit;outline:none;box-sizing:border-box;}' +
        '.aig-node-prompt:focus{border-color:#4ecca3;}' +
        '.aig-node-row{display:flex;align-items:center;gap:6px;margin-top:6px;}' +
        '.aig-ref-grid{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;}' +
        '.aig-ref-item{position:relative;display:inline-block;}' +
        '.aig-node-ref{width:60px;height:60px;object-fit:cover;border-radius:4px;cursor:pointer;display:block;}' +
        '.aig-ref-btns{display:flex;gap:4px;margin-top:6px;}' +
        '.aig-ref-btn{flex:1;padding:5px 4px;border:none;border-radius:6px;cursor:pointer;font-size:10px;font-weight:500;transition:all 0.15s;text-align:center;}' +
        '.aig-ref-local{background:rgba(56,189,248,0.1);color:#38bdf8;}' +
        '.aig-ref-local:hover{background:rgba(56,189,248,0.2);}' +
        '.aig-ref-cloud{background:rgba(251,191,36,0.1);color:#fbbf24;}' +
        '.aig-ref-cloud:hover{background:rgba(251,191,36,0.2);}' +
        '.aig-node-img{width:100%;border-radius:6px;margin-top:6px;cursor:pointer;display:block;}' +
        '.aig-node-result-actions{display:flex;gap:4px;margin-top:5px;}' +
        '.aig-result-btn{flex:1;padding:7px 4px;border:none;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;transition:all 0.15s;text-align:center;}' +
        '.aig-btn-export{background:rgba(78,204,163,0.15);color:#4ecca3;}' +
        '.aig-btn-export:hover{background:rgba(78,204,163,0.25);}' +
        '.aig-btn-cloudexport{background:rgba(56,189,248,0.12);color:#38bdf8;}' +
        '.aig-btn-cloudexport:hover{background:rgba(56,189,248,0.22);}' +
        '.aig-prompt-tools{display:flex;gap:4px;margin-top:5px;}' +
        '.aig-prompt-btn{flex:1;padding:5px 4px;border:none;border-radius:6px;cursor:pointer;font-size:10px;font-weight:500;transition:all 0.15s;text-align:center;}' +
        '.aig-header-tools{display:flex;align-items:center;gap:2px;flex-shrink:0;}' +
        '.aig-header-btn{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:4px;cursor:pointer;font-size:13px;color:#94a3b8;transition:all 0.15s;}' +
        '.aig-header-btn:hover{background:rgba(255,255,255,0.08);color:#e8edf5;}' +
        '.aig-btn-word{background:rgba(78,204,163,0.12);color:#4ecca3;}' +
        '.aig-btn-word:hover{background:rgba(78,204,163,0.25);}' +
        '.aig-btn-copy{background:rgba(56,189,248,0.1);color:#38bdf8;}' +
        '.aig-btn-copy:hover{background:rgba(56,189,248,0.2);}' +
        '.aig-node-bottom{display:flex;align-items:center;gap:3px;padding:4px 6px;border-top:1px solid #0f3460;margin-top:5px;}' +
        '.aig-node-bottom select{-webkit-appearance:none;appearance:none;height:22px;background:#0a1628;border:1px solid #0f3460;border-radius:4px;padding:0 14px 0 4px;color:#94a3b8;font-size:9px;outline:none;cursor:pointer;flex:1;min-width:0;text-align:center;text-align-last:center;font-family:inherit;}' +
        '.aig-node-bottom select:hover{border-color:#4ecca3;color:#e8edf5;}' +
        '.aig-node-bottom input[type=number]{height:22px;width:36px;background:#0a1628;border:1px solid #0f3460;border-radius:4px;padding:0;color:#94a3b8;font-size:9px;outline:none;text-align:center;flex:0 0 36px;font-family:inherit;}' +
        '.aig-node-bottom input[type=number]:focus{border-color:#4ecca3;color:#e8edf5;}' +
        '.aig-node-bottom button{height:22px;padding:0 4px;background:#4ecca3;border:none;border-radius:4px;color:#1a1a2e;font-size:9px;font-weight:700;cursor:pointer;flex:1;white-space:nowrap;font-family:inherit;}' +
        '.aig-node-bottom button:hover{background:#3db88a;}' +
        '.aig-node-bottom button:disabled{opacity:0.4;cursor:not-allowed;}' +
        '.aig-node-view-btn{display:block;margin-top:4px;padding:4px;background:#0f3460;color:#94a3b8;border:1px solid #1a5276;border-radius:5px;cursor:pointer;font-size:10px;text-align:center;}' +
        '.aig-node-view-btn:hover{background:#1a5276;color:#e8edf5;}' +
        '.aig-node-loading{text-align:center;padding:15px;color:#4ecca3;font-size:12px;}' +
        // ---- 缩放 / 模态 ----
        '.aig-zoom-display{position:absolute;bottom:8px;left:8px;background:#16213e;border:1px solid #0f3460;padding:4px 10px;border-radius:6px;color:#e0e0e0;font-size:11px;z-index:10;pointer-events:none;}' +
        '.aig-modal{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);z-index:99999;justify-content:center;align-items:center;cursor:zoom-out;}' +
        '.aig-modal.active{display:flex;}' +
        '.aig-modal img{max-width:92vw;max-height:92vh;border-radius:8px;}' +
        '::-webkit-scrollbar{width:5px;}' +
        '::-webkit-scrollbar-track{background:transparent;}' +
        '::-webkit-scrollbar-thumb{background:rgba(78,204,163,0.15);border-radius:3px;}' +
        // ---- 历史面板 ----
        '.aig-history{position:fixed;width:740px;height:560px;z-index:10000;display:flex;flex-direction:column;background:#1a1a2e;color:#e0e0e0;font-family:"Segoe UI",system-ui,sans-serif;border-radius:12px;box-shadow:0 8px 50px rgba(0,0,0,.7);overflow:hidden;min-width:400px;min-height:300px;}' +
        '.aig-history-header{display:flex;align-items:center;justify-content:space-between;padding:8px 16px;background:#16213e;border-bottom:1px solid #0f3460;flex-shrink:0;cursor:move;user-select:none;}' +
        '.aig-history-header h3{font-size:15px;margin:0;color:#4ecca3;}' +
        '.aig-history-body{flex:1;overflow-y:auto;padding:10px 14px;}' +
        '.aig-history-empty{text-align:center;padding:60px 20px;color:#64748b;font-size:14px;}' +
        '.aig-history-entry{display:flex;gap:12px;padding:10px;border:1px solid #0f3460;border-radius:8px;margin-bottom:8px;background:#16213e;transition:border-color 0.15s;}' +
        '.aig-history-entry:hover{border-color:#4ecca3;}' +
        '.aig-history-thumb{width:100px;height:100px;object-fit:cover;border-radius:6px;cursor:pointer;flex-shrink:0;}' +
        '.aig-history-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;}' +
        '.aig-history-prompt{font-size:12px;color:#c8d6e5;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;word-break:break-all;}' +
        '.aig-history-meta{font-size:10px;color:#64748b;display:flex;flex-wrap:wrap;gap:6px;}' +
        '.aig-history-meta span{background:#0f3460;padding:1px 6px;border-radius:3px;}' +
        '.aig-history-actions{display:flex;align-items:flex-start;gap:4px;flex-shrink:0;}' +
        '.aig-history-actions button{background:#0f3460;border:1px solid #1a5276;color:#94a3b8;padding:4px 8px;border-radius:5px;cursor:pointer;font-size:10px;transition:all 0.15s;white-space:nowrap;}' +
        '.aig-history-actions button:hover{background:#1a5276;color:#e8edf5;}' +
        '.aig-history-actions .aig-history-btn-gen{color:#4ecca3;border-color:rgba(78,204,163,0.3);}' +
        '.aig-history-actions .aig-history-btn-gen:hover{background:rgba(78,204,163,0.15);}' +
        '.aig-history-actions .aig-history-btn-del{color:#e87060;border-color:rgba(220,80,60,0.3);}' +
        '.aig-history-actions .aig-history-btn-del:hover{background:rgba(220,80,60,0.15);}' +
        // ---- 设置面板 ----
        '.aig-settings{position:fixed;width:420px;z-index:2147483647;display:flex;flex-direction:column;background:#1a1a2e;color:#e0e0e0;font-family:"Segoe UI",system-ui,sans-serif;border-radius:12px;box-shadow:0 8px 50px rgba(0,0,0,.7);overflow:hidden;}' +
        '.aig-settings-header{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#16213e;border-bottom:1px solid #0f3460;cursor:move;user-select:none;}' +
        '.aig-settings-header h3{font-size:15px;margin:0;color:#4ecca3;}' +
        '.aig-settings-body{padding:16px;display:flex;flex-direction:column;gap:12px;}' +
        '.aig-settings-row{display:flex;flex-direction:column;gap:4px;}' +
        '.aig-settings-row label{font-size:12px;color:#94a3b8;font-weight:500;}' +
        '.aig-settings-row input,.aig-settings-row select{background:#0a1628;border:1px solid #0f3460;color:#e0e0e0;padding:7px 10px;border-radius:6px;font-size:13px;outline:none;font-family:inherit;}' +
        '.aig-settings-row input:focus,.aig-settings-row select:focus{border-color:#4ecca3;}' +
        '.aig-settings-row input::placeholder{color:#475569;}' +
        '.aig-settings-actions{display:flex;gap:8px;padding:12px 16px;border-top:1px solid #0f3460;justify-content:flex-end;}' +
        '.aig-settings-actions button{padding:7px 16px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500;transition:all 0.15s;border:1px solid transparent;}' +
        '.aig-settings-btn-primary{background:#4ecca3;color:#1a1a2e;border-color:#4ecca3;}' +
        '.aig-settings-btn-primary:hover{background:#3db88a;}' +
        '.aig-settings-btn-default{background:transparent;color:#94a3b8;border-color:#1a5276;}' +
        '.aig-settings-btn-default:hover{color:#e8edf5;border-color:#4ecca3;}' +
        '.aig-settings-btn-danger{background:rgba(220,80,60,0.15);color:#e87060;border-color:rgba(220,80,60,0.3);}' +
        '.aig-settings-btn-danger:hover{background:rgba(220,80,60,0.25);}';
    document.head.appendChild(s);
})();

var AIImageGenSkill = {
    id: 'ai-image-gen',
    name: 'AI生图',
    icon: '<span style="color:#4ecca3;">生</span>',
    description: '无限画布 - 文生图/图生图',
    key: '7',

    _world: null,
    _overlay: null,
    _panX: 0, _panY: 0, _scale: 1,
    _nodes: [],
    _selectedNode: null,
    _nodeIdCounter: 0,
    _modalEl: null,
    _modalCreated: false,
    _apiKey: '',

    _settingsEl: null,

    // ===== 生命周期 =====

    activate: function(world) {
        this._world = world;
        if (this._overlay) {
            if (!this._overlay.parentNode) document.body.appendChild(this._overlay);
            SkillSystem.renderSubTools();
            return;
        }
        this._createOverlay();
        var self = this;
        this._loadWorkspace().then(function() {
            if (self._pendingPrompt) {
                setTimeout(function() { self.insertPrompt(self._pendingPrompt); self._pendingPrompt = null; }, 200);
            } else if (self._nodes.length === 0) {
                setTimeout(function() { self._addNode('text'); }, 100);
            }
        });
        SkillSystem.renderSubTools();
    },

    deactivate: function() {
        if (this._overlay) this._saveWindowSize();
    },

    getSubTools: function() {
        var self = this;
        return [
            { label: '文', title: '添加文生图节点', action: function() { self._addNode('text'); } },
            { label: '图', title: '添加图生图节点', action: function() { self._addNode('image'); } },

            { label: '片', title: '导出所有图片', action: function() { self._exportAllImages(); } },
            { label: '关', title: '关闭窗口', action: function() {
                if (typeof SkillSystem !== 'undefined') SkillSystem.deactivate();
            }}
        ];
    },

    save: function() { return { nodes: this._nodes.length }; },
    load: function() {},

    // ========== 创建窗口 ==========

    _createOverlay: function() {
        var self = this;
        var ov = document.createElement('div');
        ov.className = 'aig-overlay';
        ov.setAttribute('data-skill-id', 'ai-image-gen');
        ov.style.left = Math.max(20, (window.innerWidth - 860) / 2) + 'px';
        ov.style.top = Math.max(20, (window.innerHeight - 620) / 2) + 'px';
        var savedSize = null;
        try { savedSize = JSON.parse(localStorage.getItem('aig-window-size')); } catch(e) {}
        if (savedSize && savedSize.w && savedSize.h) {
            ov.style.width = savedSize.w + 'px'; ov.style.height = savedSize.h + 'px';
            if (savedSize.l !== undefined) ov.style.left = savedSize.l + 'px';
            if (savedSize.t !== undefined) ov.style.top = savedSize.t + 'px';
        }
        ov.addEventListener('contextmenu', function(e) { e.preventDefault(); });

        // 标题栏
        var header = document.createElement('div');
        header.className = 'aig-header';
        header.innerHTML = '<h2>AI 无限画布</h2><span class="aig-h-status" id="aigStatus">就绪</span><div class="aig-header-right"><button class="aig-close-btn" id="aigCloseBtn">关</button></div>';
        ov.appendChild(header);

        // 工具栏
        var tb = document.createElement('div');
        tb.className = 'aig-toolbar';
        tb.innerHTML =
            '<button id="aigAddText">✏️ 文生图</button>' +
            '<button id="aigAddImg2Img">🖼️ 图生图</button>' +
            '<div class="sep"></div>' +
            '<button id="aigExportBtn">📦 批量导出图片</button>' +
            '<button id="aigHistoryBtn">📋 历史</button>' +
            '<button id="aigSettingsBtn">⚙️ 设置</button>' +
            '<button id="aigClearAll">🗑️ 清空全部</button>';
        ov.appendChild(tb);

        // 画布
        var wrap = document.createElement('div');
        wrap.className = 'aig-canvas-wrap';
        wrap.id = 'aigCanvasWrap';
        var vp = document.createElement('div');
        vp.className = 'aig-viewport';
        vp.id = 'aigViewport';
        wrap.appendChild(vp);
        var zd = document.createElement('div');
        zd.className = 'aig-zoom-display';
        zd.id = 'aigZoomDisplay';
        zd.textContent = '缩放: 100%';
        wrap.appendChild(zd);
        ov.appendChild(wrap);
        document.body.appendChild(ov);
        this._overlay = ov;

        if (typeof WindowHelper !== 'undefined') {
            WindowHelper.makeResizable(ov, { minWidth: 500, minHeight: 400, storeKey: 'aig-window-size' });
        }

        this._panX = 0; this._panY = 0; this._scale = 1;
        this._nodes = []; this._selectedNode = null; this._nodeIdCounter = 0;
        this._bindCanvas(wrap, vp, zd);
        this._bindUI(ov);
    },

    // ========== 画布 ==========

    _bindCanvas: function(wrap, vp, zd) {
        var self = this;
        var isPanning = false, psX, psY;
        function upd() {
            vp.style.transform = 'translate(' + self._panX + 'px,' + self._panY + 'px) scale(' + self._scale + ')';
            zd.textContent = '缩放: ' + Math.round(self._scale * 100) + '%';
        }
        wrap.addEventListener('mousedown', function(e) {
            if (e.target !== wrap && e.target !== vp) return;
            if (e.button !== 0) return;
            isPanning = true; psX = e.clientX - self._panX; psY = e.clientY - self._panY;
            wrap.classList.add('grabbing'); e.preventDefault();
        });
        document.addEventListener('mousemove', function(e) {
            if (!isPanning || !self._overlay || !self._overlay.parentNode) return;
            self._panX = e.clientX - psX; self._panY = e.clientY - psY; upd();
        });
        document.addEventListener('mouseup', function() {
            if (!isPanning) return; isPanning = false; wrap.classList.remove('grabbing');
        });
        wrap.addEventListener('wheel', function(e) {
            // 鼠标在文本输入框/下拉框内时让原生滚动生效，不触发画布操作
            var t = e.target;
            if (t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.tagName === 'SELECT')) return;
            e.preventDefault();
            var r = wrap.getBoundingClientRect();
            var mx = e.clientX - r.left, my = e.clientY - r.top;
            var z = e.deltaY < 0 ? 1.1 : 0.9;
            var ns = Math.min(3, Math.max(0.1, self._scale * z));
            self._panX = mx - (mx - self._panX) * (ns / self._scale);
            self._panY = my - (my - self._panY) * (ns / self._scale);
            self._scale = ns; upd();
        }, { passive: false });
        this._canvasWrap = wrap; this._viewport = vp; this._updateView = upd;
    },

    // ========== UI 事件 ==========

    _bindUI: function(ov) {
        var self = this;

        ov.querySelector('#aigCloseBtn').addEventListener('click', function() {
            self._destroy(); if (typeof SkillSystem !== 'undefined') SkillSystem.deactivate();
        });

        var header = ov.querySelector('.aig-header');
        header.addEventListener('mousedown', function(e) {
            if (e.target.closest('button')) return; e.preventDefault();
            var sx = e.clientX, sy = e.clientY, r = ov.getBoundingClientRect(), ol = r.left, ot = r.top;
            function onM(ev) { ov.style.left = (ol + ev.clientX - sx) + 'px'; ov.style.top = (ot + ev.clientY - sy) + 'px'; }
            function onU() { document.removeEventListener('mousemove', onM); document.removeEventListener('mouseup', onU); self._saveWindowSize(); }
            document.addEventListener('mousemove', onM); document.addEventListener('mouseup', onU);
        });

        ov.querySelector('#aigAddText').addEventListener('click', function() { self._addNode('text'); });
        ov.querySelector('#aigAddImg2Img').addEventListener('click', function() { self._addNode('image'); });

        ov.querySelector('#aigExportBtn').addEventListener('click', function() { self._exportAllImages(); });
        ov.querySelector('#aigHistoryBtn').addEventListener('click', function() { self._showHistory(); });
        ov.querySelector('#aigSettingsBtn').addEventListener('click', function() { self._showSettings(); });
        ov.querySelector('#aigClearAll').addEventListener('click', function() { self._clearAllNodes(); });

        // 键盘
        document.addEventListener('keydown', function(e) {
            if (!self._overlay || !self._overlay.parentNode) return;
            var act = document.activeElement;
            var inp = act && (act.tagName === 'TEXTAREA' || act.tagName === 'INPUT');
            if ((e.key === 'Delete' || e.key === 'Backspace') && !inp && self._selectedNode !== null) {
                self._removeNode(self._selectedNode); self._selectedNode = null;
            }
            if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !inp) { e.preventDefault(); self._addNode('text'); }
        });
    },

    // ========== 节点管理 ==========

    _addNode: function(type, x, y, prefill) {
        var wrap = this._canvasWrap;
        if (!wrap) return null;
        var cw = wrap.clientWidth || 800, ch = wrap.clientHeight || 400;
        var vx = (cw / 2 - this._panX) / this._scale;
        var vy = (ch / 2 - this._panY) / this._scale;
        var node = {
            id: ++this._nodeIdCounter,
            type: type, // 'text' = 文生图, 'image' = 图生图
            x: x !== undefined ? x : vx - 160,
            y: y !== undefined ? y : vy - 120,
            prompt: prefill || '',
            size: '2048x1152',
            model: 'gpt-image-2',
            quality: 'medium',
            format: 'png',
            numImages: 1,
            refImage: null,    // 图生图：参考图 dataURL
            refName: '',       // 图生图：参考图文件名
            refImages: [],     // 图生图：多参考图 [{dataURL, name}]
            image: null,       // 生成结果 blob URL
            dataUrl: null,     // 生成结果 dataUrl（持久化）
            images: [],        // 多图生成结果
            loading: false
        };
        this._nodes.push(node);
        this._createNodeEl(node);
        this._selectNode(node.id);
        return node;
    },

    _removeNode: function(id) {
        this._nodes = this._nodes.filter(function(n) { return n.id !== id; });
        var el = this._viewport.querySelector('[data-id="' + id + '"]');
        if (el) el.remove();
        // 如果画布空了，重置编号计数器
        if (this._nodes.length === 0) {
            this._nodeIdCounter = 0;
        }
    },

    _clearAllNodes: function() {
        if (!confirm('确定要清空所有节点吗？此操作不可撤销！')) return;
        this._nodes = [];
        this._selectedNode = null;
        this._nodeIdCounter = 0;  // ← 重置编号计数器
        if (this._viewport) this._viewport.innerHTML = '';
        this._autoSave();
        this._setStatus('已清空所有节点');
    },

    _selectNode: function(id) {
        this._viewport.querySelectorAll('.aig-node').forEach(function(n) { n.classList.remove('selected'); });
        var el = this._viewport.querySelector('[data-id="' + id + '"]');
        if (el) el.classList.add('selected');
        this._selectedNode = id;
    },

    _getNode: function(id) {
        for (var i = 0; i < this._nodes.length; i++) { if (this._nodes[i].id === id) return this._nodes[i]; }
        return null;
    },

    _createNodeEl: function(nd) {
        var self = this;
        var el = document.createElement('div');
        el.className = 'aig-node';
        el.setAttribute('data-skill-id', 'ai-image-gen');
        el.dataset.id = nd.id;
        el.style.left = nd.x + 'px';
        el.style.top = nd.y + 'px';

        var typeLabel = nd.type === 'text' ? '✏️ 文生图' : '🖼️ 图生图';
        var html = '<div class="aig-node-header">' +
            '<span>' + typeLabel + ' #' + nd.id + '</span>' +
            '<span class="aig-header-tools">' +
                '<span class="aig-header-btn" data-action="duplicate" data-id="' + nd.id + '" title="复制此节点">⧉</span>' +
                '<span class="close" data-action="remove" data-id="' + nd.id + '">&times;</span>' +
            '</span>' +
        '</div>' +
        '<div class="aig-node-body">';

        // 图生图：参考图区域（左右并排：本地上传 / 盘导入）
        if (nd.type === 'image') {
            if (nd.refImage) {
                html += '<img class="aig-node-ref" src="' + nd.refImage + '" data-action="viewref" data-id="' + nd.id + '" title="点击查看大图">';
            }
            html += '<div class="aig-ref-grid" data-id="' + nd.id + '"></div>' +
            '<div class="aig-ref-count" style="font-size:10px;color:#64748b;margin-top:4px;">0 / 16 张 · 每张 &lt;50MB</div>' +
            '<div class="aig-ref-btns">' +
                '<button class="aig-ref-btn aig-ref-local" data-action="reflocal" data-id="' + nd.id + '">📁 本地上传</button>' +
                '<button class="aig-ref-btn aig-ref-cloud" data-action="refcloud" data-id="' + nd.id + '">☁️ 盘导入</button>' +
            '</div>';
        }

        // 提示词
        html += '<textarea class="aig-node-prompt" placeholder="输入提示词...">' + (nd.prompt || '') + '</textarea>';

        // 提示词工具行：提示词模板 + 保存到模板 + 复制提示词
        html += '<div class="aig-prompt-tools">' +
            '<button class="aig-prompt-btn aig-btn-word" data-action="openword" data-id="' + nd.id + '">📋 提示词模板</button>' +
            '<button class="aig-prompt-btn aig-btn-copy" data-action="savetemplate" data-id="' + nd.id + '">💾 存模板</button>' +
            '<button class="aig-prompt-btn aig-btn-copy" data-action="copyprompt" data-id="' + nd.id + '">📄 复制</button>' +
        '</div>';

        // 结果图片
        if (nd.images && nd.images.length > 0) {
            // 显示所有生成的图片
            html += '<div class="aig-result-grid" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;">';
            for (var imgIdx = 0; imgIdx < nd.images.length; imgIdx++) {
                html += '<img class="aig-node-img" src="' + nd.images[imgIdx] + '" data-action="viewimg" data-id="' + nd.id + '" data-idx="' + imgIdx + '" style="width:' + (nd.images.length > 1 ? '48%' : '100%') + ';border-radius:6px;cursor:pointer;" onerror="this.style.display=\'none\'">';
            }
            html += '</div>';
            html += '<div class="aig-node-result-actions">' +
                '<button class="aig-result-btn aig-btn-export" data-action="exportone" data-id="' + nd.id + '">💾 导出全部</button>' +
                '<button class="aig-result-btn aig-btn-cloudexport" data-action="cloudexport" data-id="' + nd.id + '">☁️ 盘导出</button>' +
            '</div>';
        } else if (nd.image) {
            html += '<img class="aig-node-img" src="' + nd.image + '" data-action="viewimg" data-id="' + nd.id + '" onerror="this.style.display=\'none\'">';
            html += '<div class="aig-node-result-actions">' +
                '<button class="aig-result-btn aig-btn-export" data-action="exportone" data-id="' + nd.id + '">💾 导出图片</button>' +
                '<button class="aig-result-btn aig-btn-cloudexport" data-action="cloudexport" data-id="' + nd.id + '">☁️ 盘导出</button>' +
            '</div>';
        } else if (nd.loading) {
            html += '<div class="aig-node-loading">⏳ 生成中...</div>';
        }

        // 查看按钮（有图且未在结果网格中展示时显示）
        if (nd.image && !(nd.images && nd.images.length > 0)) {
            html += '<div class="aig-node-view-btn" data-action="view" data-id="' + nd.id + '">🔍 查看大图</div>';
        }

        // 底部参数工具栏（参考 gui.js 中间面板底部按钮样式）
        var sizeOpts = [
            {v:'1024x1024',l:'正方形'},
            {v:'1536x1024',l:'横版'},
            {v:'1024x1536',l:'竖版'},
            {v:'2048x2048',l:'2K正方形'},
            {v:'2048x1152',l:'2K横版'},
            {v:'2688x1152',l:'2K 21:9'},
            {v:'1152x2688',l:'2K 9:21'},
            {v:'3360x1440',l:'4K 21:9'},
            {v:'1440x3360',l:'4K 9:21'},
            {v:'3840x2160',l:'4K横版'},
            {v:'2160x3840',l:'4K竖版'}
        ];
        if (nd.type === 'image') {
            sizeOpts.unshift({v:'auto',l:'默认'});
        }
        var qltyOpts = [
            {v:'medium',l:'中'},
            {v:'low',l:'低'},
            {v:'high',l:'高'},
            {v:'auto',l:'自动'}
        ];
        var fmtOpts = [
            {v:'png',l:'PNG'},
            {v:'jpeg',l:'JPEG'},
            {v:'webp',l:'WebP'}
        ];
        html += '<div class="aig-node-bottom">' +
            '<select data-action="sizesel" data-id="' + nd.id + '">';
        for (var si = 0; si < sizeOpts.length; si++) {
            html += '<option value="' + sizeOpts[si].v + '"' + (nd.size === sizeOpts[si].v ? ' selected' : '') + '>' + sizeOpts[si].l + '</option>';
        }
        html += '</select>' +
            '<select data-action="formatsel" data-id="' + nd.id + '">';
        for (var fi = 0; fi < fmtOpts.length; fi++) {
            html += '<option value="' + fmtOpts[fi].v + '"' + ((nd.format || 'png') === fmtOpts[fi].v ? ' selected' : '') + '>' + fmtOpts[fi].l + '</option>';
        }
        html += '</select>' +
            '<select data-action="qualitysel" data-id="' + nd.id + '">';
        for (var qi = 0; qi < qltyOpts.length; qi++) {
            html += '<option value="' + qltyOpts[qi].v + '"' + (nd.quality === qltyOpts[qi].v ? ' selected' : '') + '>' + qltyOpts[qi].l + '</option>';
        }
        html += '</select>' +
            '<input type="number" data-action="numimg" data-id="' + nd.id + '" min="1" max="10" value="' + (nd.numImages || 1) + '" title="数量">' +
            '<button data-action="generate" data-id="' + nd.id + '">🎨 生成</button>' +
            '</div>';

        html += '</div>';
        el.innerHTML = html;

        // 节点拖拽
        var hdr = el.querySelector('.aig-node-header');
        hdr.addEventListener('mousedown', function(e) {
            if (e.target.closest('[data-action="remove"]')) return;
            e.stopPropagation();
            self._selectNode(nd.id);
            var smx = e.clientX, smy = e.clientY;
            var slx = parseFloat(el.style.left) || nd.x;
            var sly = parseFloat(el.style.top) || nd.y;
            function onM(ev) {
                var dx = (ev.clientX - smx) / self._scale;
                var dy = (ev.clientY - smy) / self._scale;
                el.style.left = (slx + dx) + 'px'; el.style.top = (sly + dy) + 'px';
                nd.x = slx + dx; nd.y = sly + dy;
            }
            function onU() { document.removeEventListener('mousemove', onM); document.removeEventListener('mouseup', onU); }
            document.addEventListener('mousemove', onM); document.addEventListener('mouseup', onU);
        });

        // 事件委托
        el.addEventListener('click', function(e) {
            var btn = e.target.closest('[data-action]');
            if (!btn) return;
            var act = btn.getAttribute('data-action');
            var id = parseInt(btn.getAttribute('data-id'));
            switch (act) {
                case 'remove':
                    self._removeNode(id); if (self._selectedNode === id) self._selectedNode = null;
                    break;
                case 'generate': self._generate(id); break;
                case 'view': case 'viewimg': case 'viewref': self._viewNodeImage(id); break;
                case 'reflocal': self._pickRefLocal(id); break;
                case 'refcloud': self._pickRefCloud(id); break;
                case 'refdel':
                    var d_nd = self._getNode(id);
                    var d_idx = parseInt(btn.getAttribute('data-idx'));
                    if (d_nd && d_nd.refImages && !isNaN(d_idx)) {
                        d_nd.refImages.splice(d_idx, 1);
                        d_nd.refImage = d_nd.refImages.length ? d_nd.refImages[0].dataURL : null;
                        d_nd.refName = d_nd.refImages.length ? d_nd.refImages[0].name : '';
                        self._renderRefGrid(id);
                        self._autoSave();
                    }
                    break;
                case 'exportone':
                    self._exportOneImage(id);
                    break;
                case 'duplicate':
                    self._duplicateNode(id);
                    break;
                case 'cloudexport':
                    self._cloudExport(id);
                    break;
                case 'copyprompt':
                    var ta = el.querySelector('.aig-node-prompt');
                    if (!ta || !ta.value.trim()) { self._setStatus('提示词为空'); break; }
                    if (ta && ta.value) {
                        if (navigator.clipboard) {
                            navigator.clipboard.writeText(ta.value).then(function() { self._setStatus('提示词已复制'); });
                        } else {
                            var _t = document.createElement('textarea');
                            _t.value = ta.value; document.body.appendChild(_t); _t.select(); document.execCommand('copy'); document.body.removeChild(_t);
                            self._setStatus('提示词已复制');
                        }
                    }
                    break;
                case 'savetemplate':
                    var ta2 = el.querySelector('.aig-node-prompt');
                    if (!ta2 || !ta2.value.trim()) { self._setStatus('提示词为空，无法保存'); break; }
                    if (typeof PromptTemplateSkill !== 'undefined' && PromptTemplateSkill.addTemplate) {
                        PromptTemplateSkill.addTemplate(ta2.value.trim());
                        self._setStatus('✅ 已保存到提示词模板');
                    } else {
                        self._setStatus('提示词模板插件未加载');
                    }
                    break;
                case 'openword':
                    if (typeof SkillSystem !== 'undefined') {
                        SkillSystem.activate('prompt-template');
                        // 如果被卸载（在商店中），重新注册后激活
                        if (typeof PromptTemplateSkill !== 'undefined' && SkillSystem.register) {
                            var allP = SkillSystem.getPlugins ? SkillSystem.getPlugins() : {};
                            if (allP['prompt-template']) {
                                SkillSystem.register(PromptTemplateSkill);
                                SkillSystem.activate('prompt-template');
                            }
                        }
                    }
                    break;
            }
        });

        // 底部工具栏参数变更：同步到 nd 并自动保存
        var bottom = el.querySelector('.aig-node-bottom');
        if (bottom) {
            ['sizesel','qualitysel','formatsel'].forEach(function(cls) {
                var sel = bottom.querySelector('[data-action="' + cls + '"]');
                if (!sel) return;
                sel.addEventListener('change', function() {
                    var _nd = self._getNode(nd.id);
                    if (!_nd) return;
                    switch (sel.getAttribute('data-action')) {
                        case 'sizesel': _nd.size = sel.value; break;
                        case 'qualitysel': _nd.quality = sel.value; break;
                        case 'formatsel': _nd.format = sel.value; break;
                    }
                    self._autoSave();
                });
            });
            var numInput = bottom.querySelector('[data-action="numimg"]');
            if (numInput) {
                numInput.addEventListener('change', function() {
                    var v = parseInt(this.value) || 1;
                    v = Math.max(1, Math.min(10, v));
                    this.value = v;
                    var _nd = self._getNode(nd.id);
                    if (_nd) { _nd.numImages = v; self._autoSave(); }
                });
            }
        }

        this._viewport.appendChild(el);
        if (nd.type === 'image') this._renderRefGrid(nd.id, el);
    },

    _refreshNode: function(id) {
        var nd = this._getNode(id);
        if (!nd) return;
        var old = this._viewport.querySelector('[data-id="' + id + '"]');
        if (old) old.remove();
        this._createNodeEl(nd);
    },

    _duplicateNode: function(id) {
        var nd = this._getNode(id);
        if (!nd) return;
        var newNode = this._addNode(nd.type, nd.x + 350, nd.y, nd.prompt);
        if (newNode) {
            newNode.size = nd.size;
            if (nd.refImages && nd.refImages.length) {
                newNode.refImages = nd.refImages.slice();
                newNode.refImage = nd.refImages[0].dataURL;
                newNode.refName = nd.refImages[0].name;
            } else if (nd.refImage) {
                newNode.refImage = nd.refImage;
                newNode.refName = nd.refName;
            }
            if (nd.images && nd.images.length) {
                newNode.images = nd.images.slice();
            }
            if (nd.dataUrl) {
                newNode.dataUrl = nd.dataUrl;
                newNode.image = nd.dataUrl; // 用 dataUrl 持久化，不用 blob URL
            }
            this._refreshNode(newNode.id);
            this._autoSave();
            this._setStatus('已复制节点 #' + id + ' → #' + newNode.id);
        }
    },

    // ========== 图生图：参考图上传（直接左右分开） ==========

    _pickRefLocal: function(id) {
        var self = this;
        var nd = this._getNode(id);
        if (!nd) return;
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.multiple = true;
        input.addEventListener('change', function(e) {
            if (!e.target.files.length) return;
            if (!nd.refImages) nd.refImages = [];
            for (var fi = 0; fi < e.target.files.length; fi++) {
                var f = e.target.files[fi];
                if (nd.refImages.length >= 16) { self._setStatus('最多 16 张'); break; }
                if (f.size > 50 * 1024 * 1024) { self._setStatus('"' + f.name + '" 超过 50MB'); continue; }
                if (!f.type.startsWith('image/')) continue;
                (function(file) {
                    var reader = new FileReader();
                    reader.onload = function(ev) {
                        nd.refImages.push({ dataURL: ev.target.result, name: file.name });
                        nd.refImage = nd.refImages[0].dataURL;
                        nd.refName = nd.refImages[0].name;
                        self._renderRefGrid(id);
                        self._autoSave();
                    };
                    reader.readAsDataURL(file);
                })(f);
            }
        });
        input.click();
    },

    _pickRefCloud: function(id) {
        var self = this;
        var nd = this._getNode(id);
        if (!nd) return;
        if (typeof CosCloudDrive === 'undefined') { self._setStatus('云盘不可用'); return; }
        CosCloudDrive.setOnSelect(function(item) {
            nd.refImage = item.dataURL;
            nd.refName = item.name;
            if (!nd.refImages) nd.refImages = [];
            nd.refImages.push({ dataURL: item.dataURL, name: item.name });
            self._refreshNode(id);
            CosCloudDrive._overlay.style.display = 'none';
            CosCloudDrive.setOnSelect(null);
        });
        CosCloudDrive.open();
    },

    _cloudExport: function(id) {
        var nd = this._getNode(id);
        if (!nd || !nd.dataUrl) { this._setStatus('没有可导出的图片'); return; }
        if (typeof CosCloudDrive === 'undefined') { this._setStatus('云盘不可用'); return; }
        var promptPreview = nd.prompt ? nd.prompt.substring(0, 20) : 'AI生图';
        CosCloudDrive.add(promptPreview, 'AI生图', nd.dataUrl);
        this._setStatus('已存入云盘');
    },

    // ========== 缩略图网格 ==========

    _renderRefGrid: function(id, nodeEl) {
        var nd = this._getNode(id);
        if (!nd || nd.type !== 'image') return;
        if (!this._viewport) return;
        if (!nodeEl) nodeEl = this._viewport.querySelector('[data-id="' + id + '"].aig-node');
        if (!nodeEl) { var s = this; setTimeout(function() { s._renderRefGrid(id); }, 50); return; }
        var grid = nodeEl.querySelector('.aig-ref-grid');
        if (!grid) return;
        var refs = nd.refImages && nd.refImages.length ? nd.refImages : (nd.refImage ? [{ dataURL: nd.refImage, name: nd.refName || 'ref' }] : []);
        var html = '';
        for (var ri = 0; ri < refs.length; ri++) {
            html += '<div class="aig-ref-item">' +
                '<img class="aig-node-ref" width="60" height="60" src="' + refs[ri].dataURL + '" data-action="viewref" data-id="' + nd.id + '" title="点击查看">' +
                '<button data-action="refdel" data-id="' + nd.id + '" data-idx="' + ri + '" style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:rgba(220,80,60,0.85);color:#fff;border:none;font-size:12px;line-height:20px;text-align:center;cursor:pointer;opacity:0.6;">✕</button>' +
                '</div>';
        }
        grid.innerHTML = html;
        var cnt = nodeEl.querySelector('.aig-ref-count');
        if (cnt) cnt.textContent = refs.length + ' / 16 张 · 每张 <50MB';
    },

    // ========== AI 生成 ==========

    _generate: async function(id) {
        var self = this;
        var nd, el, genBtn, timerInterval;
        try {
            nd = this._getNode(id);
            if (!nd) return;
            el = this._viewport.querySelector('[data-id="' + id + '"].aig-node');
            if (!el) return;

            var prompt = ((el.querySelector('.aig-node-prompt') || {}).value || '').trim();
            if (!prompt) { this._setStatus('⚠️ 请输入提示词'); return; }

            var apiKey = (this._apiKey || '').trim();
            if (!apiKey) { this._setStatus('⚠️ 请输入 API Key'); return; }

            nd.loading = true;
            nd.prompt = prompt;
            // 从底部工具栏读取参数
            var bottom = el.querySelector('.aig-node-bottom');
            if (bottom) {
                var sSel = bottom.querySelector('[data-action="sizesel"]');
                if (sSel) nd.size = sSel.value;
                var qSel = bottom.querySelector('[data-action="qualitysel"]');
                if (qSel) nd.quality = qSel.value;
                var fSel = bottom.querySelector('[data-action="formatsel"]');
                if (fSel) nd.format = fSel.value;
                var nInp = bottom.querySelector('[data-action="numimg"]');
                if (nInp) nd.numImages = parseInt(nInp.value) || 1;
            }
            genBtn = bottom ? bottom.querySelector('[data-action="generate"]') : null;
            if (genBtn) { genBtn.disabled = true; genBtn.textContent = '⏳ 生成中...'; }
            this._setStatus('⏳ 正在生成图片...');

            var startTime = Date.now();
            timerInterval = setInterval(function() {
                var elapsed = Math.floor((Date.now() - startTime) / 1000);
                if (genBtn) genBtn.textContent = '⏳ ' + elapsed + 's';
            }, 500);

            // 文生图和图生图用不同的请求方式
            var isImg2Img = nd.type === 'image' && nd.refImages && nd.refImages.length > 0;
            var resp;

            if (isImg2Img) {
                // 图生图：FormData + /images/edits
                var formData = new FormData();
                for (var ri = 0; ri < nd.refImages.length; ri++) {
                    var refData = nd.refImages[ri].dataURL;
                    var raw = refData.indexOf('base64,') > -1 ? refData : 'data:image/png;base64,' + refData;
                    var binary = atob(raw.split('base64,')[1]);
                    var arr = new Uint8Array(binary.length);
                    for (var bi = 0; bi < binary.length; bi++) arr[bi] = binary.charCodeAt(bi);
                    var fileName = nd.refImages[ri].name || ('ref_' + ri + '.png');
                    formData.append('image', new File([new Blob([arr], { type: 'image/png' })], fileName, { type: 'image/png' }));
                }
                formData.append('prompt', prompt);
                formData.append('model', nd.model || 'gpt-image-2');
                formData.append('n', String(nd.numImages || 1));
                formData.append('size', nd.size || '1024x1024');
                // quality 直接传递原始值（API支持: low, medium, high, auto）
                var qv2 = nd.quality || 'auto';
                if (qv2) formData.append('quality', qv2);

                resp = await fetch('https://api3.wlai.vip/v1/images/edits', {
                    method: 'POST',
                    headers: { 'Accept': 'application/json', 'Authorization': 'Bearer ' + apiKey },
                    body: formData
                });
            } else {
                // 文生图：JSON + /images/generations
                var bodyObj = {
                    model: nd.model || 'gpt-image-2',
                    prompt: prompt,
                    n: nd.numImages || 1,
                    size: nd.size || '1024x1024'
                };
                // quality 直接传递原始值（API支持: low, medium, high, auto）
                var qv = nd.quality || 'auto';
                if (qv) bodyObj.quality = qv;

                resp = await fetch('https://api3.wlai.vip/v1/images/generations', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Authorization': 'Bearer ' + apiKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(bodyObj)
                });
            }
            var data = await resp.json();
            if (!resp.ok) throw new Error((data && data.error && data.error.message) ? data.error.message : JSON.stringify(data));
            if (!data.data || data.data.length === 0) throw new Error('返回数据为空');

            // 支持多图结果
            nd.images = [];
            for (var di = 0; di < data.data.length; di++) {
                var item = data.data[di];
                var url;
                if (item.b64_json) {
                    var mime = item.b64_json.indexOf('/9j/') === 0 ? 'image/jpeg' : 'image/png';
                    var bytes = atob(item.b64_json);
                    var uarr = new Uint8Array(bytes.length);
                    for (var ci = 0; ci < bytes.length; ci++) uarr[ci] = bytes.charCodeAt(ci);
                    url = URL.createObjectURL(new Blob([uarr], { type: mime }));
                } else if (item.url) {
                    url = item.url;
                } else {
                    continue;
                }
                nd.images.push(url);
            }
            
            if (nd.images.length === 0) throw new Error('无图片数据');
            
            // 第一张图作为主图显示
            nd.image = nd.images[0];
            nd.loading = false;
            
            // 保存第一张图的 dataUrl
            self._saveDataUrl(nd, nd.image);
            self._refreshNode(id);
            self._setStatus('✅ 生成完成 (' + nd.images.length + ' 张)');
        } catch(e) {
            if (nd) { nd.loading = false; nd.error = e.message || String(e); if (self._viewport) self._refreshNode(id); }
            self._setStatus('❌ ' + (e.message || e));
        } finally {
            if (timerInterval) clearInterval(timerInterval);
            if (genBtn) { genBtn.disabled = false; genBtn.textContent = '▶ 生成'; }
        }
    },

    _saveDataUrl: function(nd, url) {
        var self = this;
        var img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = function() {
            var c = document.createElement('canvas');
            c.width = img.width; c.height = img.height;
            var ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0);
            nd.dataUrl = c.toDataURL('image/png');
            self._autoSave();
            self._saveToHistory(nd);
            c = null;
        };
        img.src = url;
    },

    // ========== 生成历史 ==========

    _saveToHistory: function(nd) {
        if (!nd || !nd.dataUrl) return;
        var self = this;
        this._getDB().then(function(db) {
            var tx = db.transaction('history', 'readwrite');
            var store = tx.objectStore('history');
            store.add({
                nodeId: nd.id,
                prompt: nd.prompt || '',
                imageDataUrl: nd.dataUrl,
                model: nd.model || 'gpt-image-2',
                size: nd.size || '1024x1024',
                quality: nd.quality || 'medium',
                format: nd.format || 'png',
                timestamp: Date.now()
            });
        }).catch(function() {});
    },

    _showHistory: function() {
        var self = this;
        this._closeHistory();
        var ov = document.createElement('div');
        ov.className = 'aig-history';
        ov.style.left = Math.max(20, (window.innerWidth - 740) / 2 + 40) + 'px';
        ov.style.top = Math.max(20, (window.innerHeight - 560) / 2 + 40) + 'px';
        ov.style.zIndex = 2147483647;
        ov.setAttribute('data-skill-id', 'ai-image-gen');
        ov.addEventListener('contextmenu', function(e) { e.preventDefault(); });

        // 标题栏
        var header = document.createElement('div');
        header.className = 'aig-history-header';
        header.innerHTML = '<h3>📋 生成历史</h3><div style="display:flex;gap:6px;">' +
            '<button id="aigHistExport" style="background:rgba(78,204,163,0.12);border:1px solid rgba(78,204,163,0.3);color:#4ecca3;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;">📤 导出</button>' +
            '<button id="aigHistImport" style="background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.2);color:#38bdf8;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;">📥 导入</button>' +
            '<button id="aigHistClose" style="background:rgba(220,80,60,.2);border:1px solid rgba(220,80,60,.3);color:#e87060;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;">关</button></div>';
        // 标题栏拖拽
        (function(hd, win) {
            var d = { active: false, sx: 0, sy: 0, ox: 0, oy: 0 };
            hd.addEventListener('mousedown', function(e) {
                if (e.target.closest('button')) return;
                d.active = true; d.sx = e.clientX; d.sy = e.clientY;
                var r = win.getBoundingClientRect(); d.ox = r.left; d.oy = r.top;
                e.preventDefault();
            });
            document.addEventListener('mousemove', function(e) {
                if (!d.active) return;
                win.style.left = (d.ox + e.clientX - d.sx) + 'px';
                win.style.top = (d.oy + e.clientY - d.sy) + 'px';
            });
            document.addEventListener('mouseup', function() { d.active = false; });
        })(header, ov);

        ov.appendChild(header);

        // 内容区
        var body = document.createElement('div');
        body.className = 'aig-history-body';
        ov.appendChild(body);
        document.body.appendChild(ov);
        this._historyEl = ov;
        this._historyBody = body;

        // 关闭按钮
        ov.querySelector('#aigHistClose').addEventListener('click', function() {
            self._closeHistory();
        });
        // 导出
        ov.querySelector('#aigHistExport').addEventListener('click', function() {
            self._exportHistory();
        });
        // 导入
        ov.querySelector('#aigHistImport').addEventListener('click', function() {
            self._importHistory();
        });

        // 加载数据
        this._refreshHistory();
    },

    _closeHistory: function() {
        if (this._historyEl && this._historyEl.parentNode) {
            this._historyEl.parentNode.removeChild(this._historyEl);
        }
        this._historyEl = null;
        this._historyBody = null;
    },

    _refreshHistory: function() {
        var self = this;
        if (!this._historyBody) return;
        this._historyBody.innerHTML = '<div class="aig-history-empty">⏳ 加载中...</div>';
        this._getDB().then(function(db) {
            var tx = db.transaction('history', 'readonly');
            var req = tx.objectStore('history').getAll();
            req.onsuccess = function() {
                var records = req.result || [];
                if (records.length === 0) {
                    self._historyBody.innerHTML = '<div class="aig-history-empty">暂无历史记录。<br>生成图片后自动保存到这里，删除节点不影响历史。</div>';
                    return;
                }
                // 按时间倒序
                records.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
                var html = '';
                for (var i = 0; i < records.length; i++) {
                    var r = records[i];
                    var timeStr = r.timestamp ? new Date(r.timestamp).toLocaleString() : '';
                    var promptPreview = (r.prompt || '').substring(0, 200);
                    if ((r.prompt || '').length > 200) promptPreview += '...';
                    html += '<div class="aig-history-entry">' +
                        '<img class="aig-history-thumb" src="' + (r.imageDataUrl || '') + '" data-hist-idx="' + i + '" onerror="this.style.display=\'none\'">' +
                        '<div class="aig-history-info">' +
                            '<div class="aig-history-prompt">' + self._escapeHtml(promptPreview) + '</div>' +
                            '<div class="aig-history-meta">' +
                                '<span>' + (r.model || '-') + '</span>' +
                                '<span>' + (r.size || '-') + '</span>' +
                                '<span>生成于 ' + timeStr + '</span>' +
                            '</div>' +
                        '</div>' +
                        '<div class="aig-history-actions">' +
                            '<button class="aig-history-btn-gen" data-hist-idx="' + i + '" data-action="createNode">🔄 还原</button>' +
                            '<button class="aig-history-btn-del" data-hist-idx="' + i + '" data-action="delete">🗑️ 删除</button>' +
                        '</div>' +
                    '</div>';
                }
                self._historyBody.innerHTML = html;

                // 事件绑定
                self._historyBody.querySelectorAll('[data-action="createNode"]').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var idx = parseInt(this.getAttribute('data-hist-idx'));
                        self._createNodeFromHistory(records[idx]);
                    });
                });
                self._historyBody.querySelectorAll('[data-action="delete"]').forEach(function(btn) {
                    btn.addEventListener('click', function() {
                        var idx = parseInt(this.getAttribute('data-hist-idx'));
                        self._deleteHistoryEntry(records[idx]);
                    });
                });
                self._historyBody.querySelectorAll('.aig-history-thumb').forEach(function(img) {
                    img.addEventListener('click', function() {
                        self._viewImage(this.src);
                    });
                });
            };
        }).catch(function() {
            self._historyBody.innerHTML = '<div class="aig-history-empty">加载失败</div>';
        });
    },

    _createNodeFromHistory: function(record) {
        if (!record) return;
        var node = this._addNode('text');
        if (node) {
            node.prompt = record.prompt || '';
            node.size = record.size || '2048x1152';
            node.model = record.model || 'gpt-image-2';
            node.quality = record.quality || 'medium';
            node.format = record.format || 'png';
            node.image = record.imageDataUrl;
            node.dataUrl = record.imageDataUrl;
            node.images = record.imageDataUrl ? [record.imageDataUrl] : [];
            this._refreshNode(node.id);
            this._autoSave();
            this._setStatus('✅ 已从历史还原节点 #' + node.id);
        }
        // 前置历史面板
        if (this._historyEl) this._historyEl.style.zIndex = 10001;
    },

    _deleteHistoryEntry: function(record) {
        var self = this;
        if (!record) return;
        this._getDB().then(function(db) {
            var tx = db.transaction('history', 'readwrite');
            var store = tx.objectStore('history');
            // 有 id 就用 id 删除，否则遍历按内容匹配
            if (record.id !== undefined) {
                store.delete(record.id);
            } else {
                // 没有 id（老记录），尝试按 timestamp + prompt 匹配
                var req = store.openCursor();
                req.onsuccess = function(e) {
                    var cursor = e.target.result;
                    if (cursor) {
                        var val = cursor.value;
                        if (val.timestamp === record.timestamp && val.prompt === record.prompt && val.imageDataUrl === record.imageDataUrl) {
                            cursor.delete();
                        }
                        cursor.continue();
                    }
                };
            }
            tx.oncomplete = function() {
                self._refreshHistory();
                self._setStatus('已删除历史记录');
            };
        }).catch(function() {});
    },

    _exportHistory: function() {
        var self = this;
        this._getDB().then(function(db) {
            var tx = db.transaction('history', 'readonly');
            var curReq = tx.objectStore('history').openCursor();
            var fullRecords = [];
            curReq.onsuccess = function(e) {
                var cursor = e.target.result;
                if (cursor) {
                    var r = cursor.value;
                    r.id = cursor.key;
                    fullRecords.push(r);
                    cursor.continue();
                } else {
                    if (fullRecords.length === 0) { self._setStatus('没有历史可导出'); return; }
                    if (typeof JSZip === 'undefined') {
                        self._setStatus('缺少 JSZip 库，无法导出');
                        return;
                    }
                    var zip = new JSZip();
                    for (var i = 0; i < fullRecords.length; i++) {
                        var r = fullRecords[i];
                        var idx = String(i + 1).padStart(3, '0');
                        var ext = r.format === 'jpeg' ? 'jpg' : (r.format === 'webp' ? 'webp' : 'png');
                        var base = 'history_' + idx;
                        var fname = base + '.' + ext;
                        // 图片文件
                        var dataUrl = r.imageDataUrl || '';
                        var commaIdx = dataUrl.indexOf(',');
                        var raw = commaIdx > -1 ? dataUrl.slice(commaIdx + 1) : dataUrl;
                        zip.file(fname, raw, { base64: true });
                        // 同名 .txt 提示词文件
                        var ts = r.timestamp ? new Date(r.timestamp).toLocaleString() : '-';
                        var prompt = (r.prompt || '').replace(/\n/g, ' ');
                        var txtContent = 'Prompt: ' + prompt + '\n' +
                            'Model: ' + (r.model || '-') + '\n' +
                            'Size: ' + (r.size || '-') + '\n' +
                            'Quality: ' + (r.quality || '-') + '\n' +
                            '时间: ' + ts + '\n';
                        zip.file(base + '.txt', txtContent);
                    }
                    // 同时保存 JSON 用于跨浏览器导入
                    var jsonMeta = fullRecords.map(function(r) {
                        var c = {}; for (var k in r) c[k] = r[k]; return c;
                    });
                    zip.file('history.json', JSON.stringify({ version: 1, records: jsonMeta }, null, 2));
                    zip.generateAsync({ type: 'blob' }).then(function(blob) {
                        var url = URL.createObjectURL(blob);
                        var a = document.createElement('a');
                        a.href = url;
                        a.download = 'ai-history-' + new Date().toISOString().slice(0, 10) + '.zip';
                        a.click();
                        URL.revokeObjectURL(url);
                        self._setStatus('已导出 ' + fullRecords.length + ' 条记录（ZIP）');
                    });
                }
            };
        }).catch(function() {});
    },

    _importHistory: function() {
        var self = this;
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,.zip,application/json,application/zip';
        input.addEventListener('change', function(e) {
            if (!e.target.files.length) return;
            var file = e.target.files[0];
            var isZip = file.name.toLowerCase().endsWith('.zip');
            if (isZip) {
                if (typeof JSZip === 'undefined') { self._setStatus('缺少 JSZip 库'); return; }
                var reader = new FileReader();
                reader.onload = function(ev) {
                    JSZip.loadAsync(ev.target.result).then(function(zip) {
                        var entry = zip.file('history.json');
                        if (!entry) { self._setStatus('ZIP 中未找到 history.json'); return; }
                        return entry.async('string');
                    }).then(function(jsonStr) {
                        var data = JSON.parse(jsonStr);
                        if (!data.records || !Array.isArray(data.records)) { self._setStatus('无效的历史文件'); return; }
                        self._importRecords(data.records);
                    }).catch(function(err) { self._setStatus('导入失败: ' + (err.message || err)); });
                };
                reader.readAsArrayBuffer(file);
            } else {
                var reader = new FileReader();
                reader.onload = function(ev) {
                    try {
                        var data = JSON.parse(ev.target.result);
                        if (!data.records || !Array.isArray(data.records)) { self._setStatus('无效的历史文件'); return; }
                        self._importRecords(data.records);
                    } catch(e) { self._setStatus('导入失败: ' + e.message); }
                };
                reader.readAsText(file);
            }
        });
        input.click();
    },

    _importRecords: function(records) {
        var self = this;
        if (!records || records.length === 0) { self._setStatus('没有可导入的记录'); return; }
        this._getDB().then(function(db) {
            var tx = db.transaction('history', 'readwrite');
            var store = tx.objectStore('history');
            var count = 0;
            var done = 0;
            var total = records.length;
            for (var i = 0; i < total; i++) {
                var r = records[i];
                delete r.id;  // 让 IndexedDB 自动分配
                var req = store.add(r);
                req.onsuccess = function() { count++; done++; if (done >= total) { self._refreshHistory(); self._setStatus('已导入 ' + count + ' 条记录'); } };
                req.onerror = function() { done++; if (done >= total) { self._refreshHistory(); self._setStatus('已导入 ' + count + ' 条记录（部分失败）'); } };
            }
        });
    },

    _escapeHtml: function(str) {
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    },

    // ========== 设置面板 ==========

    _showSettings: function() {
        var self = this;
        if (this._settingsEl) { this._settingsEl.style.zIndex = 2147483647; return; }
        var ov = document.createElement('div');
        ov.className = 'aig-settings';
        ov.style.left = Math.max(20, (window.innerWidth - 420) / 2) + 'px';
        ov.style.top = Math.max(20, (window.innerHeight - 280) / 2) + 'px';
        ov.addEventListener('contextmenu', function(e) { e.preventDefault(); });

        var header = document.createElement('div');
        header.className = 'aig-settings-header';
        header.innerHTML = '<h3>⚙️ AI 设置</h3><span style="color:#64748b;font-size:11px;cursor:pointer;" id="aigSettingsClose">✕</span>';
        (function(hd, win) {
            var d = { active: false, sx: 0, sy: 0, ox: 0, oy: 0 };
            hd.addEventListener('mousedown', function(e) {
                if (e.target.id === 'aigSettingsClose') return;
                d.active = true; d.sx = e.clientX; d.sy = e.clientY;
                var r = win.getBoundingClientRect(); d.ox = r.left; d.oy = r.top;
                e.preventDefault();
            });
            document.addEventListener('mousemove', function(e) {
                if (!d.active) return;
                win.style.left = (d.ox + e.clientX - d.sx) + 'px';
                win.style.top = (d.oy + e.clientY - d.sy) + 'px';
            });
            document.addEventListener('mouseup', function() { d.active = false; });
        })(header, ov);
        ov.appendChild(header);

        var body = document.createElement('div');
        body.className = 'aig-settings-body';
        body.innerHTML =
            '<div class="aig-settings-row">' +
                '<label>API Key</label>' +
                '<input type="password" id="aigSetKey" placeholder="sk-..." value="' + this._escapeHtml(this._apiKey) + '">' +
            '</div>' +
            '<div class="aig-settings-row">' +
                '<label>API 地址</label>' +
                '<input type="text" id="aigSetEndpoint" value="https://api3.wlai.vip/v1/images/generations" readonly style="color:#64748b;">' +
            '</div>' +
            '<div class="aig-settings-row" style="font-size:11px;color:#64748b;padding:4px 0;">' +
                'Key 保存在本地浏览器，不会上传。可在 <a href="https://api3.wlai.vip/register?aff=b1VJ" target="_blank" style="color:#38bdf8;">api3.wlai.vip</a> 注册获取。' +
            '</div>';
        ov.appendChild(body);

        var actions = document.createElement('div');
        actions.className = 'aig-settings-actions';
        actions.innerHTML =
            '<button class="aig-settings-btn-danger" id="aigSetClear">清空 Key</button>' +
            '<button class="aig-settings-btn-default" id="aigSetCancel">取消</button>' +
            '<button class="aig-settings-btn-primary" id="aigSetSave">保存</button>';
        ov.appendChild(actions);

        document.body.appendChild(ov);
        this._settingsEl = ov;

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
    },

    _saveSettings: function() {
        if (!this._settingsEl) return;
        var key = this._settingsEl.querySelector('#aigSetKey').value.trim();
        this._apiKey = key;
        this._autoSave();
        this._setStatus('设置已保存');
        this._closeSettings();
    },

    _closeSettings: function() {
        if (this._settingsEl && this._settingsEl.parentNode) {
            this._settingsEl.parentNode.removeChild(this._settingsEl);
        }
        this._settingsEl = null;
    },

    // ========== 图片查看 ==========

    _viewNodeImage: function(id) {
        var nd = this._getNode(id);
        if (nd && nd.image) this._viewImage(nd.image);
    },

    _viewImage: function(url) {
        if (!this._modalCreated) {
            var m = document.createElement('div');
            m.className = 'aig-modal';
            m.innerHTML = '<img id="aigModalImg">';
            m.addEventListener('click', function() { m.classList.remove('active'); });
            document.body.appendChild(m);
            this._modalCreated = true; this._modalEl = m;
        }
        this._modalEl.querySelector('#aigModalImg').src = url;
        this._modalEl.classList.add('active');
    },

    // ========== 工作区保存/加载（IndexedDB） ==========

    _getDB: function() {
        return new Promise(function(res, rej) {
            var r = indexedDB.open('AIGWorkspace', 3);
            r.onupgradeneeded = function(e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
                if (!db.objectStoreNames.contains('images')) db.createObjectStore('images');
                if (!db.objectStoreNames.contains('history')) db.createObjectStore('history', { autoIncrement: true });
            };
            r.onsuccess = function(e) { res(e.target.result); };
            r.onerror = function(e) { rej(e); };
        });
    },

    _autoSave: function() {
        var self = this;
        var meta = { nodes: [], nodeIdCounter: this._nodeIdCounter, panX: this._panX, panY: this._panY, scale: this._scale };
        for (var i = 0; i < this._nodes.length; i++) {
            var n = this._nodes[i];
            meta.nodes.push({ 
                id: n.id, type: n.type, x: n.x, y: n.y, prompt: n.prompt, size: n.size,
                model: n.model, quality: n.quality, format: n.format || 'png', numImages: n.numImages,
                refName: n.refName, hasRef: !!n.refImage, hasImg: !!n.dataUrl, imgCount: n.images ? n.images.length : 0 
            });
        }
        meta.apiKey = this._apiKey || '';
        this._getDB().then(function(db) {
            var tx1 = db.transaction('meta', 'readwrite');
            tx1.objectStore('meta').put(meta, 'workspace');
            var tx2 = db.transaction('images', 'readwrite');
            for (var j = 0; j < self._nodes.length; j++) {
                var nd = self._nodes[j];
                if (nd.dataUrl) tx2.objectStore('images').put(nd.dataUrl, 'img-' + nd.id);
                if (nd.refImage && nd.refImage.indexOf('data:') === 0) tx2.objectStore('images').put(nd.refImage, 'ref-' + nd.id);
            }
        }).catch(function() {});
    },

    _loadWorkspace: function() {
        var self = this;
        return new Promise(function(resolve) {
            self._getDB().then(function(db) {
                var tx = db.transaction('meta', 'readonly');
                var req = tx.objectStore('meta').get('workspace');
                req.onsuccess = function() {
                    var meta = req.result;
                    if (!meta) { resolve(); return; }
                    self._nodes = [];
                    if (self._viewport) self._viewport.querySelectorAll('.aig-node').forEach(function(n) { n.remove(); });
                    // 加载节点
                    for (var i = 0; i < meta.nodes.length; i++) {
                        var n = meta.nodes[i];
                        var qLoad = n.quality;
                        if (qLoad === 'standard' || qLoad === 'hd') qLoad = 'medium';
                        self._nodes.push({ 
                            id: n.id, type: n.type, x: n.x, y: n.y, prompt: n.prompt || '', size: n.size || '2048x1152',
                            model: n.model || 'gpt-image-2', quality: qLoad || 'medium', format: n.format || 'png', numImages: n.numImages || 1,
                            refImage: null, refName: n.refName || '', image: null, dataUrl: null, images: [], loading: false
                        });
                    }
                    // 重新计算编号计数器（防止删除节点后编号跳变）
                    if (self._nodes.length > 0) {
                        var maxId = 0;
                        for (var j = 0; j < self._nodes.length; j++) {
                            if (self._nodes[j].id > maxId) maxId = self._nodes[j].id;
                        }
                        self._nodeIdCounter = maxId;
                    } else {
                        self._nodeIdCounter = 0;
                    }
                    self._panX = meta.panX || 0; self._panY = meta.panY || 0; self._scale = meta.scale || 1;
                    if (self._updateView) self._updateView();
                    if (meta.apiKey) self._apiKey = meta.apiKey;
                    self._loadImagesForNodes().then(function() {
                        self._getDB().then(function(db2) {
                            var tx2 = db2.transaction('images', 'readonly');
                            var pending = self._nodes.length;
                            if (pending === 0) {
                                for (var k = 0; k < self._nodes.length; k++) { if (self._viewport) self._createNodeEl(self._nodes[k]); }
                                self._setStatus('布局已加载'); resolve(); return;
                            }
                            var loaded = 0;
                            for (var k = 0; k < self._nodes.length; k++) {
                                (function(idx) {
                                    // 加载 refImage
                                    if (self._nodes[idx].refName) {
                                        var rq = tx2.objectStore('images').get('ref-' + self._nodes[idx].id);
                                        rq.onsuccess = function() { if (rq.result) self._nodes[idx].refImage = rq.result; };
                                    }
                                })(k);
                            }
                            // 创建节点 DOM
                            for (var k = 0; k < self._nodes.length; k++) { if (self._viewport) self._createNodeEl(self._nodes[k]); }
                            self._setStatus('工作区已加载'); resolve();
                        });
                    });
                };
                req.onerror = function() { resolve(); };
            }).catch(function() { resolve(); });
        });
    },

    _loadImagesForNodes: function() {
        var self = this;
        return this._getDB().then(function(db) {
            return new Promise(function(resolve) {
                var tx = db.transaction('images', 'readonly');
                var loaded = 0, total = self._nodes.length;
                if (total === 0) { resolve(); return; }
                for (var i = 0; i < total; i++) {
                    (function(idx) {
                        var req = tx.objectStore('images').get('img-' + self._nodes[idx].id);
                        req.onsuccess = function() {
                            var d = req.result;
                            if (d) { self._nodes[idx].dataUrl = d; self._nodes[idx].image = d; }
                            loaded++; if (loaded >= total) resolve();
                        };
                        req.onerror = function() { loaded++; if (loaded >= total) resolve(); };
                    })(i);
                }
            });
        });
    },

    // ========== 导出图片 ==========

    _exportAllImages: function() {
        var self = this;
        // 收集所有有图片的节点
        var items = [];
        for (var i = 0; i < this._nodes.length; i++) {
            var nd = this._nodes[i];
            if (nd.images && nd.images.length > 0) {
                for (var j = 0; j < nd.images.length; j++) {
                    items.push({ node: nd, url: nd.images[j], isMulti: true });
                }
            } else if (nd.image) {
                items.push({ node: nd, url: nd.image, isMulti: false });
            }
        }
        if (items.length === 0) { this._setStatus('没有图片可导出'); return; }
        if (typeof JSZip === 'undefined') { this._setStatus('缺少 JSZip 库'); return; }

        var zip = new JSZip();
        var total = items.length;
        var done = 0;

        function onItem(idx, dataUrl) {
            var base = 'ai_image_' + String(idx + 1).padStart(3, '0');
            var ext = 'png';
            var mimeMatch = dataUrl.match(/^data:image\/(\w+)/);
            if (mimeMatch) ext = mimeMatch[1] === 'jpeg' ? 'jpg' : mimeMatch[1];
            var comma = dataUrl.indexOf(',');
            zip.file(base + '.' + ext, comma > -1 ? dataUrl.slice(comma + 1) : dataUrl, { base64: true });
            var nd = items[idx].node;
            var prompt = (nd.prompt || '').replace(/\n/g, ' ');
            zip.file(base + '.txt',
                'Prompt: ' + prompt + '\n' +
                'Model: ' + (nd.model || '-') + '\n' +
                'Size: ' + (nd.size || '-') + '\n' +
                'Quality: ' + (nd.quality || '-') + '\n'
            );
            done++;
            if (done >= total) {
                zip.generateAsync({ type: 'blob' }).then(function(blob) {
                    var url = URL.createObjectURL(blob);
                    var a = document.createElement('a');
                    a.href = url;
                    a.download = 'ai-images-' + new Date().toISOString().slice(0, 10) + '.zip';
                    a.click();
                    URL.revokeObjectURL(url);
                    self._setStatus('已导出 ' + total + ' 张图片');
                });
            }
        }

        for (var i = 0; i < items.length; i++) {
            (function(item, idx) {
                if (item.node.dataUrl && !item.isMulti) {
                    onItem(idx, item.node.dataUrl);
                } else if (typeof item.url === 'string' && item.url.indexOf('data:') === 0) {
                    onItem(idx, item.url);
                } else if (item.url) {
                    fetch(item.url).then(function(r) { return r.blob(); }).then(function(b) {
                        var r = new FileReader();
                        r.onload = function(e) { onItem(idx, e.target.result); };
                        r.readAsDataURL(b);
                    }).catch(function() { done++; if (done >= total) { self._setStatus('导出完成（部分图片失败）'); zip.generateAsync({ type: 'blob' }).then(function(blob) { var url = URL.createObjectURL(blob); var a = document.createElement('a'); a.href = url; a.download = 'ai-images-' + new Date().toISOString().slice(0, 10) + '.zip'; a.click(); URL.revokeObjectURL(url); }); } });
                } else {
                    done++; if (done >= total) { self._setStatus('导出完成（部分跳过）'); zip.generateAsync({ type: 'blob' }).then(function(blob) { var url = URL.createObjectURL(blob); var a = document.createElement('a'); a.href = url; a.download = 'ai-images-' + new Date().toISOString().slice(0, 10) + '.zip'; a.click(); URL.revokeObjectURL(url); }); }
                }
            })(items[i], i);
        }
    },

    _exportOneImage: function(id) {
        var nd = this._getNode(id);
        if (!nd) { this._setStatus('节点不存在'); return; }
        
        // 支持多图导出
        var imgs = nd.images && nd.images.length > 0 ? nd.images : (nd.image ? [nd.image] : []);
        if (imgs.length === 0) { this._setStatus('没有图片可导出'); return; }
        
        for (var j = 0; j < imgs.length; j++) {
            var a = document.createElement('a');
            a.href = imgs[j];
            a.download = 'ai_image_' + nd.id + '_' + (j + 1) + '.png';
            a.click();
        }
        this._setStatus('已导出 ' + imgs.length + ' 张图片');
    },

    // ========== 公开方法（供提示词模板调用） ==========

    insertPrompt: function(text) {
        if (!text) return;
        if (!this._overlay || !this._overlay.parentNode) { this._pendingPrompt = text; return; }
        if (this._selectedNode !== null) {
            var el = this._viewport.querySelector('[data-id="' + this._selectedNode + '"]');
            if (el) {
                var ta = el.querySelector('.aig-node-prompt');
                if (ta) { ta.value = text; ta.focus(); this._setStatus('已插入提示词到节点 #' + this._selectedNode); return; }
            }
        }
        var node = this._addNode('text');
        if (node) {
            node.prompt = text;
            var nel = this._viewport.querySelector('[data-id="' + node.id + '"]');
            if (nel) { var ta = nel.querySelector('.aig-node-prompt'); if (ta) ta.value = text; }
            this._setStatus('已创建文生图节点 #' + node.id);
        }
    },

    // ========== 工具 ==========

    _setStatus: function(msg) {
        var el = this._overlay ? this._overlay.querySelector('#aigStatus') : null;
        if (el) el.textContent = msg;
    },

    _saveWindowSize: function() {
        if (!this._overlay || !this._overlay.parentNode || this._overlay.style.display === 'none') return;
        var r = this._overlay.getBoundingClientRect();
        try { localStorage.setItem('aig-window-size', JSON.stringify({ w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top) })); } catch(e) {}
    },

    _destroy: function() {
        this._saveWindowSize();
        if (this._overlay && this._overlay.parentNode) this._overlay.parentNode.removeChild(this._overlay);
        if (this._modalEl && this._modalEl.parentNode) this._modalEl.parentNode.removeChild(this._modalEl);
        if (this._historyEl && this._historyEl.parentNode) this._historyEl.parentNode.removeChild(this._historyEl);
        if (this._settingsEl && this._settingsEl.parentNode) this._settingsEl.parentNode.removeChild(this._settingsEl);
        this._modalCreated = false; this._modalEl = null; this._overlay = null;
        this._historyEl = null; this._historyBody = null;
        this._settingsEl = null;
    }
};
