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
        '.aig-size-grid{margin-top:6px;display:flex;flex-direction:column;gap:3px;}' +
        '.aig-size-row{display:flex;gap:3px;}' +
        '.aig-size-btn{flex:1;padding:5px 2px;border:1px solid rgba(100,160,255,0.12);border-radius:5px;cursor:pointer;font-size:11px;font-weight:500;background:rgba(0,0,0,0.2);color:#94a3b8;transition:all 0.12s;text-align:center;}' +
        '.aig-size-btn:hover{background:rgba(56,189,248,0.1);color:#e8edf5;border-color:rgba(56,189,248,0.25);}' +
        '.aig-size-active{background:rgba(78,204,163,0.15);color:#4ecca3;border-color:#4ecca3;font-weight:700;}' +
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
        '.aig-node-loading{text-align:center;padding:15px;color:#4ecca3;font-size:12px;}' +
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
    },

    deactivate: function() {
        if (this._overlay) this._saveWindowSize();
    },

    getSubTools: function() {
        var self = this;
        return [
            { label: '文', title: '添加文生图节点', action: function() { self._addNode('text'); } },
            { label: '图', title: '添加图生图节点', action: function() { self._addNode('image'); } },
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
            '<button id="aigAddImg2Img">🖼️ 图生图</button>' +
            '<div class="sep"></div>' +
            '<label>Key:</label>' +
            '<input type="text" id="aigApiKey" placeholder="sk-..." value="">' +
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
            // 清除持久化的 key
            self._getDB().then(function(db) {
                var tx = db.transaction('meta', 'readwrite');
                var store = tx.objectStore('meta');
                store.get('workspace').onsuccess = function(e) {
                    var m = e.target.result;
                    if (m) { delete m.apiKey; store.put(m, 'workspace'); }
                };
            }).catch(function() {});
            self._setStatus('Key 已删除');
        });
        // key 输入后自动保存
        ov.querySelector('#aigApiKey').addEventListener('input', function() {
            self._autoSave();
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
            size: type === 'image' ? 'auto' : '2048x1152',
            model: 'gpt-image-2',   // 模型选择
            quality: 'high',        // 画质
            background: 'auto',     // 背景
            moderation: 'low',      // 审核级别
            numImages: 1,           // 生成数量
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

        // 尺寸按钮（文生图只有2K/4K，图生图多一个auto）
        html += '<div class="aig-size-row" style="margin-top:6px;">';
        var sizeOptions;
        if (nd.type === 'image') {
            sizeOptions = [
                { v:'auto', label:'auto' },
                { v:'2048x2048', label:'2K 1:1' },
                { v:'2048x1152', label:'2K 16:9' },
                { v:'1152x2048', label:'2K 9:16' },
                { v:'3840x2160', label:'4K 16:9' },
                { v:'2160x3840', label:'4K 9:16' }
            ];
        } else {
            sizeOptions = [
                { v:'2048x2048', label:'2K 1:1' },
                { v:'2048x1152', label:'2K 16:9' },
                { v:'1152x2048', label:'2K 9:16' },
                { v:'3840x2160', label:'4K 16:9' },
                { v:'2160x3840', label:'4K 9:16' }
            ];
        }
        for (var si = 0; si < sizeOptions.length; si++) {
            var p = sizeOptions[si];
            html += '<button class="aig-size-btn' + (nd.size === p.v ? ' aig-size-active' : '') + '" data-action="sizebtn" data-id="' + nd.id + '" data-size="' + p.v + '">' + p.label + '</button>';
        }
        html += '</div>';

        // 操作按钮
        html += '<div class="aig-node-actions">' +
            '<button class="btn-generate" data-action="generate" data-id="' + nd.id + '">▶ 生成</button>' +
            (nd.image ? '<button class="btn-view" data-action="view" data-id="' + nd.id + '">🔍 查看</button>' : '') +
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
                case 'sizebtn':
                    var sz = btn.getAttribute('data-size');
                    var nd2 = self._getNode(id);
                    if (nd2) { nd2.size = sz; self._refreshNode(id); }
                    break;
                case 'numimg':
                    var numVal = parseInt(btn.value) || 1;
                    numVal = Math.max(1, Math.min(10, numVal));
                    btn.value = numVal;
                    var ndNum = self._getNode(id);
                    if (ndNum) { ndNum.numImages = numVal; self._autoSave(); }
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

        // 尺寸按钮不用单独监听，点击事件走上面的事件委托处理 sizebtn

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

            var apiKey = ((this._overlay && this._overlay.querySelector('#aigApiKey')) || {}).value || '';
            apiKey = apiKey.trim();
            if (!apiKey) { this._setStatus('⚠️ 请输入 API Key'); return; }

            nd.loading = true;
            nd.prompt = prompt;
            genBtn = el.querySelector('.btn-generate');
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
                formData.append('quality', nd.quality || 'high');
                formData.append('background', nd.background || 'auto');
                formData.append('moderation', nd.moderation || 'low');

                resp = await fetch('https://yunwu.ai/v1/images/edits', {
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
                    size: nd.size || '1024x1024',
                    quality: nd.quality || 'high'
                };

                resp = await fetch('https://yunwu.ai/v1/images/generations', {
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
            meta.nodes.push({ 
                id: n.id, type: n.type, x: n.x, y: n.y, prompt: n.prompt, size: n.size,
                model: n.model, quality: n.quality, background: n.background, moderation: n.moderation, numImages: n.numImages,
                refName: n.refName, hasRef: !!n.refImage, hasImg: !!n.dataUrl, imgCount: n.images ? n.images.length : 0 
            });
        }
        if (this._overlay) { meta.apiKey = this._overlay.querySelector('#aigApiKey').value; }
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
                    self._nodeIdCounter = meta.nodeIdCounter || 0;
                    for (var i = 0; i < meta.nodes.length; i++) {
                        var n = meta.nodes[i];
                        self._nodes.push({ 
                            id: n.id, type: n.type, x: n.x, y: n.y, prompt: n.prompt || '', size: n.size || '1024x1024',
                            model: n.model || 'gpt-image-2', quality: n.quality || 'high', background: n.background || 'auto',
                            moderation: n.moderation || 'low', numImages: n.numImages || 1,
                            refImage: null, refName: n.refName || '', image: null, dataUrl: null, images: [], loading: false
                        });
                    }
                    self._panX = meta.panX || 0; self._panY = meta.panY || 0; self._scale = meta.scale || 1;
                    if (self._updateView) self._updateView();
                    if (meta.apiKey && self._overlay) { var ki = self._overlay.querySelector('#aigApiKey'); if (ki) ki.value = meta.apiKey; }
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
        /* apiKey 不写入导出文件 */
        for (var i = 0; i < this._nodes.length; i++) {
            var n = this._nodes[i];
            backup.nodes.push({ 
                id: n.id, type: n.type, x: n.x, y: n.y, prompt: n.prompt, size: n.size,
                model: n.model, quality: n.quality, background: n.background, moderation: n.moderation, numImages: n.numImages,
                refName: n.refName || '' 
            });
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
                            prompt: n.prompt || '', size: n.size || '1024x1024',
                            model: n.model || 'gpt-image-2', quality: n.quality || 'high',
                            background: n.background || 'auto', moderation: n.moderation || 'low', numImages: n.numImages || 1,
                            refImage: refUrl, refName: n.refName || '',
                            image: imgUrl, dataUrl: imgUrl, images: imgUrl ? [imgUrl] : [], loading: false
                        });
                    }
                    self._panX = data.panX || 0; self._panY = data.panY || 0; self._scale = data.scale || 1;
                    if (self._updateView) self._updateView();
                    /* apiKey 不从文件加载 */
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
        this._modalCreated = false; this._modalEl = null; this._overlay = null;
    }
};
