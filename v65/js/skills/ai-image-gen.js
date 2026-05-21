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

        '.aig-size-row{display:flex;gap:3px;}' +
        '.aig-size-btn{flex:1;padding:5px 2px;border:1px solid rgba(100,160,255,0.12);border-radius:5px;cursor:pointer;font-size:11px;font-weight:500;background:rgba(0,0,0,0.2);color:#94a3b8;transition:all 0.12s;text-align:center;}' +
        '.aig-size-btn:hover{background:rgba(56,189,248,0.1);color:#e8edf5;border-color:rgba(56,189,248,0.25);}' +
        '.aig-size-active{background:rgba(78,204,163,0.15);color:#4ecca3;border-color:#4ecca3;font-weight:700;}' +
        '.aig-res-btn{flex:1;padding:6px 2px;border:1px solid rgba(100,160,255,0.15);border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;background:rgba(0,0,0,0.25);color:#64748b;transition:all 0.12s;text-align:center;}' +
        '.aig-res-btn:hover{background:rgba(56,189,248,0.08);color:#c8d0dc;}' +
        '.aig-res-active{background:rgba(56,189,248,0.15);color:#38bdf8;border-color:#38bdf8;}' +
        '.aig-res-price{font-size:12px;opacity:1;display:block;font-weight:500;color:#c8d0dc;margin-top:2px;}' +
        '.aig-node-ref{width:100%;max-height:120px;border-radius:6px;margin-top:6px;object-fit:cover;cursor:pointer;display:block;}' +
        '.aig-ref-btns{display:flex;gap:4px;margin-top:6px;}' +
        '.aig-ref-btn{flex:1;padding:5px 4px;border:none;border-radius:6px;cursor:pointer;font-size:10px;font-weight:500;transition:all 0.15s;text-align:center;}' +
        '.aig-ref-local{background:rgba(56,189,248,0.1);color:#38bdf8;}' +
        '.aig-ref-local:hover{background:rgba(56,189,248,0.2);}' +
        '.aig-ref-cloud{background:rgba(251,191,36,0.1);color:#fbbf24;}' +
        '.aig-ref-cloud:hover{background:rgba(251,191,36,0.2);}' +
        '.aig-node-img{width:100%;border-radius:6px;margin-top:6px;cursor:pointer;display:block;}' +
        '.aig-node-actions{display:flex;gap:4px;margin-top:6px;}' +
        '.aig-node-actions button{flex:1;padding:5px;border:none;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;}' +
        '.btn-generate{background:#4ecca3;color:#1a1a2e;}' +
        '.btn-generate:hover{background:#3db88a;}' +
        '.btn-generate:disabled{opacity:0.5;cursor:not-allowed;}' +
        '.btn-regen{background:#e94560;color:white;}' +
        '.btn-regen:hover{background:#c73e54;}' +
        '.btn-view{background:#0f3460;color:#e0e0e0;}' +
        '.btn-view:hover{background:#1a5276;}' +
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
        '.aig-btn-savetpl{background:rgba(251,191,36,0.1);color:#fbbf24;}' +
        '.aig-btn-savetpl:hover{background:rgba(251,191,36,0.2);}' +
        '.aig-node-loading{text-align:center;padding:15px;color:#4ecca3;font-size:12px;}' +
        '.aig-node-error{text-align:center;padding:12px;color:#e87060;font-size:11px;word-break:break-all;}' +
        // ---- 缩放 / 模态 ----
        '.aig-zoom-display{position:absolute;bottom:8px;left:8px;background:#16213e;border:1px solid #0f3460;padding:4px 10px;border-radius:6px;color:#e0e0e0;font-size:11px;z-index:10;pointer-events:none;}' +
        '.aig-modal{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);z-index:99999;justify-content:center;align-items:center;cursor:zoom-out;}' +
        '.aig-modal.active{display:flex;}' +
        '.aig-modal img{max-width:92vw;max-height:92vh;border-radius:8px;}' +
        '::-webkit-scrollbar{width:5px;}' +
        '::-webkit-scrollbar-track{background:transparent;}' +
        '::-webkit-scrollbar-thumb{background:rgba(78,204,163,0.15);border-radius:3px;}';
    document.head.appendChild(s);
})();

// 分辨率→尺寸映射表
var AIG_RES_MAP = {
    '2K': { '1:1':'2048x2048', '16:9':'2048x1152', '3:2':'1920x1280', '3:4':'1536x2048', '9:16':'1152x2048', '2:3':'1280x1920' },
    '4K': { '1:1':'2880x2880', '16:9':'3840x2160', '9:16':'2160x3840' }
};

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

        // 页面关闭/刷新时保存数据
        if (!self._beforeUnloadBound) {
            window.addEventListener('beforeunload', function() {
                if (self._overlay && self._overlay.parentNode) self._autoSave();
            });
            self._beforeUnloadBound = true;
        }
    },

    deactivate: function() {
        if (this._overlay) this._saveWindowSize();
    },

    getSubTools: function() {
        var self = this;
        return [
            { label: '文', title: '添加文生图节点', action: function() { self._addNode('text'); } },
            { label: '图', title: '添加图生图节点（暂不可用）', action: function() { self._addNode('image'); } },
            { label: '出', title: '导出节点布局到 .json 文件', action: function() { self._saveWorkspaceFile(); } },
            { label: '入', title: '从 .json 文件导入节点布局', action: function() { self._loadWorkspaceFile(); } },
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
            '<button id="aigAddImg2Img" disabled style="opacity:0.4;cursor:not-allowed;" title="图生图暂不可用（API 限制）">🖼️ 图生图</button>' +
            '<div class="sep"></div>' +
            '<label>Key:</label>' +
            '<input type="text" id="aigApiKey" placeholder="sk-..." value="sk-Oiaf5r4o56xj1ubllU1YFVS4CXX1g9jFZDEBZJYtjRGDfk2o">' +
            '<button class="aig-key-btn" id="aigKeyCopy" title="复制 Key">📋</button>' +
            '<button class="aig-key-btn aig-key-del" id="aigKeyDel" title="删除 Key">×</button>' +
            '<a class="aig-key-get-btn" href="https://api3.wlai.vip/register?aff=b1VJ" target="_blank" title="https://yunwu.ai">获取Key</a>' +
            '<div class="sep"></div>' +
            '<button id="aigSaveFile">💾 导出布局</button>' +
            '<button id="aigLoadFile">📂 导入布局</button>' +
            '<button id="aigExportBtn">📦 批量导出图片</button>';
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

        // Key 操作
        ov.querySelector('#aigKeyCopy').addEventListener('click', function() {
            var k = ov.querySelector('#aigApiKey').value;
            if (!k) { self._setStatus('Key 为空'); return; }
            if (navigator.clipboard) { navigator.clipboard.writeText(k).then(function() { self._setStatus('Key 已复制'); }); }
            else { var ta = document.createElement('textarea'); ta.value = k; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta); self._setStatus('Key 已复制'); }
        });
        ov.querySelector('#aigKeyDel').addEventListener('click', function() {
            ov.querySelector('#aigApiKey').value = '';
            // 同步将备份中的 Key 置空（空字符串 vs undefined，用于区分"从未设置"）
            try { var bk = JSON.parse(localStorage.getItem('aig-full-backup') || 'null'); if (bk && bk.meta) { bk.meta.apiKey = ''; localStorage.setItem('aig-full-backup', JSON.stringify(bk)); } } catch(e) {}
            try { var bk2 = JSON.parse(localStorage.getItem('aig-meta-backup') || 'null'); if (bk2) { bk2.apiKey = ''; localStorage.setItem('aig-meta-backup', JSON.stringify(bk2)); } } catch(e2) {}
            self._setStatus('Key 已删除');
        });

        // 保存/加载/导出
        ov.querySelector('#aigSaveFile').addEventListener('click', function() { self._saveWorkspaceFile(); });
        ov.querySelector('#aigLoadFile').addEventListener('click', function() { self._loadWorkspaceFile(); });
        ov.querySelector('#aigExportBtn').addEventListener('click', function() { self._exportAllImages(); });

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
        if (type === 'image') { this._setStatus('图生图暂不可用'); return null; }
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
            resLevel: '2K',
            ratio: '16:9',
            refImage: null,    // 图生图：参考图 dataURL
            refName: '',       // 图生图：参考图文件名
            image: null,       // 生成结果 blob URL
            dataUrl: null,     // 生成结果 dataUrl（持久化）
            loading: false
        };
        this._nodes.push(node);
        this._createNodeEl(node);
        this._selectNode(node.id);
        this._autoSave();
        return node;
    },

    _removeNode: function(id) {
        this._nodes = this._nodes.filter(function(n) { return n.id !== id; });
        var el = this._viewport.querySelector('[data-id="' + id + '"]');
        if (el) el.remove();
        this._autoSave();
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
            html += '<div class="aig-ref-btns">' +
                '<button class="aig-ref-btn aig-ref-local" data-action="reflocal" data-id="' + nd.id + '">📁 本地上传</button>' +
                '<button class="aig-ref-btn aig-ref-cloud" data-action="refcloud" data-id="' + nd.id + '">☁️ 盘导入</button>' +
            '</div>';
        }

        // 提示词
        html += '<textarea class="aig-node-prompt" placeholder="输入提示词...">' + (nd.prompt || '') + '</textarea>';

        // 提示词工具行：提示词模板 + 复制提示词
        html += '<div class="aig-prompt-tools">' +
            '<button class="aig-prompt-btn aig-btn-word" data-action="openword" data-id="' + nd.id + '">📋 提示词模板</button>' +
            '<button class="aig-prompt-btn aig-btn-copy" data-action="copyprompt" data-id="' + nd.id + '">📄 复制</button>' +
            '<button class="aig-prompt-btn aig-btn-savetpl" data-action="savetemplate" data-id="' + nd.id + '">💾 存模板</button>' +
        '</div>';

        // 分辨率 + 比例（1K/2K/4K × 比例）
        var allRatios = ['1:1','16:9','3:2','3:4','9:16','2:3'];
        var resLevels = ['2K','4K'];

        // 分辨率行（含价格参考）
        var resPrices = { '2K': '≈0.03-0.15元', '4K': '≈3.5元' };
        html += '<div class="aig-size-row" style="margin-top:5px;">';
        for (var ri = 0; ri < resLevels.length; ri++) {
            var rl = resLevels[ri];
            var selR = nd.resLevel === rl;
            html += '<button class="aig-res-btn' + (selR ? ' aig-res-active' : '') + '" data-action="resbtn" data-id="' + nd.id + '" data-res="' + rl + '">' +
                rl + ' <span class="aig-res-price">' + (resPrices[rl] || '') + '</span></button>';
        }
        html += '</div>';

        // 比例行
        var availRatios = AIG_RES_MAP[nd.resLevel] ? Object.keys(AIG_RES_MAP[nd.resLevel]) : allRatios;
        html += '<div class="aig-size-row">';
        for (var ai = 0; ai < allRatios.length; ai++) {
            var ra = allRatios[ai];
            if (availRatios.indexOf(ra) < 0) continue;
            var selA = nd.ratio === ra;
            html += '<button class="aig-size-btn' + (selA ? ' aig-size-active' : '') + '" data-action="ratiobtn" data-id="' + nd.id + '" data-ratio="' + ra + '">' + ra + '</button>';
        }
        html += '</div>';

        // 操作按钮
        html += '<div class="aig-node-actions">' +
            '<button class="btn-generate" data-action="generate" data-id="' + nd.id + '">▶ 生成</button>' +
            (nd.image ? '<button class="btn-view" data-action="view" data-id="' + nd.id + '">🔍 查看</button>' : '') +
            '</div>';

        // 结果图片
        if (nd.image) {
            html += '<img class="aig-node-img" src="' + nd.image + '" data-action="viewimg" data-id="' + nd.id + '">';
            html += '<div class="aig-node-result-actions">' +
                '<button class="aig-result-btn aig-btn-export" data-action="exportone" data-id="' + nd.id + '">💾 导出图片</button>' +
                '<button class="aig-result-btn aig-btn-cloudexport" data-action="cloudexport" data-id="' + nd.id + '">☁️ 盘导出</button>' +
            '</div>';
        } else if (nd.loading) {
            html += '<div class="aig-node-loading">⏳ 生成中...</div>';
        } else if (nd.error) {
            html += '<div class="aig-node-error">❌ ' + nd.error + '</div>';
        }

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
                case 'resbtn':
                    var res = btn.getAttribute('data-res');
                    var nd2 = self._getNode(id);
                    if (nd2 && nd2.resLevel !== res) {
                        nd2.resLevel = res;
                        var map = AIG_RES_MAP ? AIG_RES_MAP[res] : null;
                        if (map && !map[nd2.ratio]) nd2.ratio = '16:9';
                        if (map) nd2.size = map[nd2.ratio] || '2048x1152';
                        self._refreshNode(id);
                    }
                    break;
                case 'ratiobtn':
                    var ra = btn.getAttribute('data-ratio');
                    var nd3 = self._getNode(id);
                    if (nd3) {
                        nd3.ratio = ra;
                        var map2 = AIG_RES_MAP ? AIG_RES_MAP[nd3.resLevel] : null;
                        if (map2 && map2[ra]) nd3.size = map2[ra];
                        self._refreshNode(id);
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
                case 'savetemplate':
                    var ta2 = el.querySelector('.aig-node-prompt');
                    if (ta2 && ta2.value.trim()) {
                        if (typeof PromptTemplateSkill !== 'undefined' && PromptTemplateSkill.addTemplate) {
                            PromptTemplateSkill.addTemplate(ta2.value.trim());
                            self._setStatus('已保存到提示词模板');
                        } else { self._setStatus('提示词模板插件不可用'); }
                    } else { self._setStatus('提示词为空'); }
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

        // 分辨率/比例按钮走事件委托处理 resbtn/ratiobtn

        this._viewport.appendChild(el);
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
        // 先从 textarea 同步最新提示词
        var el = this._viewport ? this._viewport.querySelector('[data-id="' + id + '"]') : null;
        if (el) {
            var ta = el.querySelector('.aig-node-prompt');
            if (ta) nd.prompt = ta.value;
        }
        var newNode = this._addNode(nd.type, nd.x + 350, nd.y, nd.prompt);
        if (newNode) {
            newNode.size = nd.size;
            newNode.resLevel = nd.resLevel || '2K';
            newNode.ratio = nd.ratio || '16:9';
            if (nd.refImage) {
                newNode.refImage = nd.refImage;
                newNode.refName = nd.refName;
            }
            if (nd.dataUrl) {
                newNode.dataUrl = nd.dataUrl;
                newNode.image = nd.dataUrl;
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
        input.addEventListener('change', function(e) {
            if (!e.target.files.length) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
                nd.refImage = ev.target.result;
                nd.refName = e.target.files[0].name;
                self._refreshNode(id);
                self._autoSave();
            };
            reader.readAsDataURL(e.target.files[0]);
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
            self._refreshNode(id);
            self._autoSave();
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

    // ========== AI 生成 ==========

    _generate: function(id) {
        var self = this;
        var nd = this._getNode(id);
        if (!nd) return;
        var el = this._viewport.querySelector('[data-id="' + id + '"]');
        if (!el) return;

        var promptEl = el.querySelector('.aig-node-prompt');
        var prompt = promptEl.value.trim();
        if (!prompt) { this._setStatus('请输入提示词'); return; }

        var apiKey = this._overlay.querySelector('#aigApiKey').value.trim();
        if (!apiKey) { this._setStatus('请输入 API Key'); return; }

        nd.loading = true;
        nd.prompt = prompt;
        nd.error = null;
        var genBtn = el.querySelector('.btn-generate');
        if (genBtn) { genBtn.disabled = true; genBtn.textContent = '⏳ 生成中...'; }
        this._setStatus('正在生成图片...');

        // 计时器（显示在生成按钮内）
        var startTime = Date.now();
        var timerInterval = setInterval(function() {
            var elapsed = Math.floor((Date.now() - startTime) / 1000);
            if (genBtn) genBtn.textContent = '⏳ ' + elapsed + 's';
        }, 500);

        // 文生图 vs 图生图：不同 API 端点和参数
        var isImg2Img = nd.type === 'image' && nd.refImage;
        var apiUrl = isImg2Img ? 'https://yunwu.ai/v1/images/edits' : 'https://yunwu.ai/v1/images/generations';
        var fetchOpts;

        if (isImg2Img) {
            var b64 = nd.refImage.indexOf('base64,') > -1 ? nd.refImage.split('base64,')[1] : nd.refImage;
            fetchOpts = {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'gpt-image-2', image: b64, prompt: prompt, n: 1, size: nd.size })
            };
            apiUrl = 'https://yunwu.ai/v1/images/generations';
        } else {
            fetchOpts = {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: 'gpt-image-2', prompt: prompt, n: 1, size: nd.size })
            };
        }

        fetch(apiUrl, fetchOpts)
        .then(function(r) { return r.json(); })
        .then(function(result) {
            if (result.data && result.data[0]) {
                var imgData = result.data[0].b64_json;
                var bytes = atob(imgData);
                var arr = new Uint8Array(bytes.length);
                for (var i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
                var blob = new Blob([arr], { type: 'image/png' });
                var url = URL.createObjectURL(blob);
                var sizeText = nd.size + ' ' + (blob.size / 1024).toFixed(0) + 'KB';

                nd.image = url;
                nd.size = nd.size;
                nd.loading = false;

                // 保存 dataUrl 到 IndexedDB
                self._saveDataUrl(nd, url);

                self._refreshNode(id);
                self._setStatus('生成完成');
            } else {
                throw new Error(result.error && result.error.message ? result.error.message : '生成失败');
            }
        })
        .catch(function(e) {
            nd.loading = false;
            nd.error = e.message;
            self._refreshNode(id);
            self._setStatus('生成失败: ' + e.message);
        })
        .finally(function() {
            clearInterval(timerInterval);
            var elapsed = Math.floor((Date.now() - startTime) / 1000);
            if (genBtn) { genBtn.disabled = false; genBtn.textContent = '✅ ' + elapsed + 's'; }
            setTimeout(function() { if (genBtn) genBtn.textContent = '▶ 生成'; }, 2000);
        });
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
            c = null;
        };
        img.src = url;
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
            var r = indexedDB.open('AIGWorkspace', 2);
            r.onupgradeneeded = function(e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
                if (!db.objectStoreNames.contains('images')) db.createObjectStore('images');
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
            meta.nodes.push({ id: n.id, type: n.type, x: n.x, y: n.y, prompt: n.prompt, size: n.size, resLevel: n.resLevel || '2K', ratio: n.ratio || '16:9', refName: n.refName, hasRef: !!n.refImage, hasImg: !!n.dataUrl });
        }
        if (this._overlay) { meta.apiKey = this._overlay.querySelector('#aigApiKey').value; }

        // 同步写 localStorage 备份（含图片 dataUrl，关页面/刷新也立即写入）
        var backup = { meta: meta, images: {} };
        for (var bi = 0; bi < this._nodes.length; bi++) {
            var nd = this._nodes[bi];
            if (nd.dataUrl) backup.images['img-' + nd.id] = nd.dataUrl;
            if (nd.refImage && nd.refImage.indexOf('data:') === 0) backup.images['ref-' + nd.id] = nd.refImage;
        }
        try {
            var bkStr = JSON.stringify(backup);
            if (bkStr.length < 4 * 1024 * 1024) { // localStorage 通常 5MB 限制，留余量
                localStorage.setItem('aig-full-backup', bkStr);
            } else {
                // 太大时不存图片，只存元数据
                localStorage.setItem('aig-meta-backup', JSON.stringify(meta));
            }
        } catch(e) {
            // localStorage 存不下时只存元数据
            try { localStorage.setItem('aig-meta-backup', JSON.stringify(meta)); } catch(e2) {}
        }

        // 异步写 IndexedDB（含图片 dataUrl）
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
                    // IndexedDB 无数据 → 尝试 localStorage 备份
                    if (!meta) {
                        try {
                            var full = localStorage.getItem('aig-full-backup');
                            if (full) { var fb = JSON.parse(full); meta = fb.meta; }
                        } catch(e) {}
                    }
                    if (!meta) {
                        try { var bk = localStorage.getItem('aig-meta-backup'); if (bk) meta = JSON.parse(bk); } catch(e) {}
                    }
                    if (!meta) { resolve(); return; }
                    self._nodes = [];
                    if (self._viewport) self._viewport.querySelectorAll('.aig-node').forEach(function(n) { n.remove(); });
                    self._nodeIdCounter = meta.nodeIdCounter || 0;
                    for (var i = 0; i < meta.nodes.length; i++) {
                        var n = meta.nodes[i];
                        self._nodes.push({ id: n.id, type: n.type, x: n.x, y: n.y, prompt: n.prompt || '', size: n.size || '2048x1152', resLevel: n.resLevel || '2K', ratio: n.ratio || '16:9', refImage: null, refName: n.refName || '', image: null, dataUrl: null, loading: false });
                    }
                    self._panX = meta.panX || 0; self._panY = meta.panY || 0; self._scale = meta.scale || 1;
                    if (self._updateView) self._updateView();
                    // 以 localStorage 备份的 Key 为准（同步写入，比 IndexedDB 更新）
                    var keyFrom = meta.apiKey;
                    try { var _fb = JSON.parse(localStorage.getItem('aig-full-backup') || 'null'); if (_fb && _fb.meta && _fb.meta.apiKey !== undefined) keyFrom = _fb.meta.apiKey; } catch(e) {}
                    if (keyFrom === undefined) { try { var _fb2 = JSON.parse(localStorage.getItem('aig-meta-backup') || 'null'); if (_fb2 && _fb2.apiKey !== undefined) keyFrom = _fb2.apiKey; } catch(e) {} }
                    if (self._overlay) {
                        var ki = self._overlay.querySelector('#aigApiKey');
                        if (ki) {
                            if (keyFrom === '') { ki.value = ''; }
                            else if (keyFrom) { ki.value = keyFrom; }
                        }
                    }
                    // 如果是从 localStorage 全量备份恢复，直接填入图片 dataUrl
                    self._restoreFromLocalBackup();
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

    // 从 localStorage 全量备份恢复图片 dataUrl
    _restoreFromLocalBackup: function() {
        try {
            var raw = localStorage.getItem('aig-full-backup');
            if (!raw) return;
            var fb = JSON.parse(raw);
            if (!fb.images) return;
            for (var i = 0; i < this._nodes.length; i++) {
                var nd = this._nodes[i];
                var imgKey = 'img-' + nd.id;
                if (fb.images[imgKey]) {
                    nd.dataUrl = fb.images[imgKey];
                    nd.image = fb.images[imgKey];
                }
                var refKey = 'ref-' + nd.id;
                if (fb.images[refKey]) {
                    nd.refImage = fb.images[refKey];
                }
            }
        } catch(e) {}
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

    // ========== 导出/导入 .json 工作区文件 ==========

    _saveWorkspaceFile: function() {
        var self = this;
        // 从 IndexedDB 收集所有图片
        this._getDB().then(function(db) {
            var tx = db.transaction('images', 'readonly');
            var pending = self._nodes.length;
            var images = {};
            if (pending === 0) { self._downloadWorkspaceFile({}, 0); return; }
            var loaded = 0;
            for (var i = 0; i < self._nodes.length; i++) {
                (function(idx) {
                    var req = tx.objectStore('images').get('img-' + self._nodes[idx].id);
                    req.onsuccess = function() {
                        if (req.result) images['img-' + self._nodes[idx].id] = req.result;
                        // 也收集参考图
                        if (self._nodes[idx].refName) {
                            var rq2 = tx.objectStore('images').get('ref-' + self._nodes[idx].id);
                            rq2.onsuccess = function() { if (rq2.result) images['ref-' + self._nodes[idx].id] = rq2.result; };
                        }
                        loaded++;
                        if (loaded >= pending) self._downloadWorkspaceFile(images, pending);
                    };
                    req.onerror = function() { loaded++; if (loaded >= pending) self._downloadWorkspaceFile(images, pending); };
                })(i);
            }
        });
    },

    _downloadWorkspaceFile: function(images, total) {
        var backup = {
            version: 2, exportedAt: new Date().toISOString(),
            nodes: [], nodeIdCounter: this._nodeIdCounter,
            panX: this._panX, panY: this._panY, scale: this._scale,
            images: images
        };
        if (this._overlay) backup.apiKey = this._overlay.querySelector('#aigApiKey').value;
        for (var i = 0; i < this._nodes.length; i++) {
            var n = this._nodes[i];
            backup.nodes.push({ id: n.id, type: n.type, x: n.x, y: n.y, prompt: n.prompt, size: n.size, resLevel: n.resLevel || '2K', ratio: n.ratio || '16:9', refName: n.refName || '' });
        }
        try {
            var json = JSON.stringify(backup);
            var blob = new Blob([json], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'ai-workspace-' + new Date().toISOString().slice(0, 10) + '.json';
            a.click();
            URL.revokeObjectURL(url);
            this._setStatus('布局已导出 (' + (json.length / 1024).toFixed(0) + 'KB)');
        } catch(e) { this._setStatus('保存失败：数据过大'); }
    },

    _loadWorkspaceFile: function() {
        var self = this;
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json,application/json';
        input.addEventListener('change', function(e) {
            if (!e.target.files.length) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    var data = JSON.parse(ev.target.result);
                    if (!data.nodes) { self._setStatus('无效的工作区文件'); return; }
                    self._nodes = [];
                    if (self._viewport) self._viewport.querySelectorAll('.aig-node').forEach(function(n) { n.remove(); });
                    self._nodeIdCounter = data.nodeIdCounter || 0;
                    var images = data.images || {};
                    for (var i = 0; i < data.nodes.length; i++) {
                        var n = data.nodes[i];
                        var imgUrl = images['img-' + n.id] || null;
                        var refUrl = images['ref-' + n.id] || null;
                        self._nodes.push({
                            id: n.id, type: n.type, x: n.x, y: n.y,
                            prompt: n.prompt || '', size: n.size || '2048x1152', resLevel: n.resLevel || '2K', ratio: n.ratio || '16:9',
                            refImage: refUrl, refName: n.refName || '',
                            image: imgUrl, dataUrl: imgUrl, loading: false
                        });
                    }
                    self._panX = data.panX || 0; self._panY = data.panY || 0; self._scale = data.scale || 1;
                    if (self._updateView) self._updateView();
                    if (data.apiKey && self._overlay) { var ki = self._overlay.querySelector('#aigApiKey'); if (ki) ki.value = data.apiKey; }
                    for (var k = 0; k < self._nodes.length; k++) { if (self._viewport) self._createNodeEl(self._nodes[k]); }
                    self._setStatus('布局已导入 (' + self._nodes.length + ' 个节点)');
                } catch(e) { self._setStatus('加载失败: ' + e.message); }
            };
            reader.readAsText(e.target.files[0]);
        });
        input.click();
    },

    // ========== 导出图片 ==========

    _exportAllImages: function() {
        var imgs = [];
        for (var i = 0; i < this._nodes.length; i++) { if (this._nodes[i].image) imgs.push(this._nodes[i]); }
        if (imgs.length === 0) { this._setStatus('没有图片可导出'); return; }
        for (var j = 0; j < imgs.length; j++) {
            var a = document.createElement('a');
            a.href = imgs[j].image;
            a.download = 'ai_image_' + imgs[j].id + '.png';
            a.click();
        }
        this._setStatus('已导出 ' + imgs.length + ' 张图片');
    },

    _exportOneImage: function(id) {
        var nd = this._getNode(id);
        if (!nd || !nd.image) { this._setStatus('没有图片可导出'); return; }
        var a = document.createElement('a');
        a.href = nd.image;
        a.download = 'ai_image_' + nd.id + '.png';
        a.click();
        this._setStatus('已导出图片 #' + nd.id);
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
        this._autoSave();
        this._saveWindowSize();
        if (this._overlay && this._overlay.parentNode) this._overlay.parentNode.removeChild(this._overlay);
        if (this._modalEl && this._modalEl.parentNode) this._modalEl.parentNode.removeChild(this._modalEl);
        this._modalCreated = false; this._modalEl = null; this._overlay = null;
    }
};
