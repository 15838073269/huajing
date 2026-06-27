/**
 * AI 无限画布 - v66 插件
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
        '.aig-header h2{font-size:15px;margin:0;color:#fbbf24;}' +
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
        '.aig-toolbar input[type="text"]:focus{border-color:#fbbf24;}' +
        '.aig-key-btn{background:none;border:none;color:#94a3b8;cursor:pointer;font-size:13px;padding:2px 4px;border-radius:4px;transition:all 0.15s;line-height:1;flex-shrink:0;}' +
        '.aig-key-btn:hover{background:rgba(255,255,255,0.08);color:#e8edf5;}' +
        '.aig-key-del:hover{background:rgba(220,80,60,0.2);color:#e87060;}' +
        // ---- 画布 ----
        '.aig-canvas-wrap{flex:1;overflow:hidden;position:relative;cursor:grab;min-height:0;}' +
        '.aig-canvas-wrap.grabbing{cursor:grabbing;}' +
        '.aig-viewport{position:absolute;top:0;left:0;transform-origin:0 0;}' +
        // ---- 节点 ----
        '.aig-node{position:absolute;min-width:300px;max-width:420px;background:#16213e;border:2px solid #0f3460;border-radius:10px;cursor:move;user-select:none;}' +
        '.aig-node.selected{border-color:#fbbf24;}' +
        '.aig-node-header{background:#0f3460;padding:6px 10px;border-radius:8px 8px 0 0;display:flex;align-items:center;justify-content:space-between;font-size:12px;color:#e0e0e0;font-weight:600;gap:4px;}' +
        '.aig-node-header .close{cursor:pointer;color:#e74c3c;font-size:15px;padding:0 4px;flex-shrink:0;}' +
        '.aig-node-body{padding:5px 10px;width:100%;box-sizing:border-box;}' +
        '.aig-node-prompt{min-height:70px;background:#0a1628;border:1px solid #0f3460;color:#e0e0e0;padding:8px;border-radius:6px;font-size:12px;resize:vertical;font-family:inherit;outline:none;box-sizing:border-box;}' +
        '.aig-node-prompt:focus{border-color:#fbbf24;}' +
        '.aig-node-row{display:flex;align-items:center;gap:6px;margin-top:6px;}' +
        '.aig-ref-grid{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;}' +
        '.aig-ref-item{position:relative;display:inline-block;}' +
        '.aig-node-ref{width:60px;height:60px;object-fit:cover;border-radius:4px;cursor:pointer;display:block;}' +
        '.aig-ref-btns{display:flex;gap:6px;margin-top:6px;}' +
        '.aig-ref-btn{flex:1;padding:5px 4px;border:1px solid #0f3460;border-radius:6px;cursor:pointer;font-size:10px;font-weight:500;transition:all 0.15s;text-align:center;background:#0a1628;color:#94a3b8;height:28px;line-height:16px;}' +
        '.aig-ref-btn:hover{border-color:#fbbf24;color:#e8edf5;background:#1a2744;}' +
        '.aig-ref-default{background:#fbbf24;border-color:#fbbf24;color:#1a1a2e;font-weight:700;}' +
        '.aig-ref-default:hover{background:#e6a800;border-color:#e6a800;color:#1a1a2e;}' +
        '.aig-node-img{width:100%;border-radius:6px;margin-top:6px;cursor:pointer;display:block;}' +
        '.aig-node-result-actions{display:flex;gap:6px;margin-top:6px;}' +
        '.aig-result-btn{flex:1;padding:7px 4px;border:1px solid #0f3460;border-radius:6px;cursor:pointer;font-size:10px;font-weight:600;transition:all 0.15s;text-align:center;background:#0a1628;color:#94a3b8;height:28px;line-height:14px;}' +
        '.aig-result-btn:hover{border-color:#fbbf24;color:#e8edf5;background:#1a2744;}' +
        '.aig-header-tools{display:flex;align-items:center;gap:2px;flex-shrink:0;}' +
        '.aig-header-btn{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:4px;cursor:pointer;font-size:13px;color:#94a3b8;transition:all 0.15s;}' +
        '.aig-header-btn:hover{background:rgba(255,255,255,0.08);color:#e8edf5;}' +
        '.aig-btn-word{background:#fbbf24;border:none;border-radius:4px;color:#1a1a2e;font-weight:700;cursor:pointer;}' +
        '.aig-prompt-btn:hover{border-color:#fbbf24;color:#e8edf5;background:#1a2744;}' +
        '.aig-btn-word:hover{background:#e6a800;}' +
        '.aig-size-btn{padding:3px 2px;background:#0a1628;border:1px solid #0f3460;border-radius:4px;color:#94a3b8;font-size:10px;cursor:pointer;transition:all 0.1s;font-family:inherit;text-align:center;height:22px;line-height:14px;}' +
        '.aig-size-btn:hover{border-color:#fbbf24;color:#e8edf5;background:#1a2744;}' +
        '.aig-size-btn.active{background:#fbbf24;color:#1a1a2e;border-color:#fbbf24;font-weight:600;}' +
        '.aig-mode-btn{padding:3px 2px;border:1px solid #0f3460;border-radius:4px;font-size:10px;cursor:pointer;transition:all 0.1s;font-family:inherit;text-align:center;background:#0a1628;color:#94a3b8;height:22px;line-height:14px;}' +
        '.aig-mode-btn:hover{border-color:#fbbf24;color:#e8edf5;background:#1a2744;}' +
        '.aig-mode-btn.active{background:#fbbf24;color:#1a1a2e;border-color:#fbbf24;font-weight:600;}' +
        '.aig-node-bottom select:hover,.aig-node-bottom input:hover{border-color:#fbbf24;background:#1a2744;}' +
        '.aig-node-bottom button[data-action="generate"]:hover{background:#a52a2a;}' +
        '.aig-res-display{font-size:9px;color:#64748b;text-align:right;white-space:nowrap;flex-shrink:0;margin-left:auto;}' +
        '.aig-ratio-panel{position:fixed;width:340px;z-index:2147483647;display:flex;flex-direction:column;background:#1a1a2e;color:#e0e0e0;font-family:"Segoe UI",system-ui,sans-serif;border-radius:12px;box-shadow:0 8px 50px rgba(0,0,0,.7);overflow:hidden;}' +
        '.aig-ratio-panel .aig-rp-header{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:#16213e;border-bottom:1px solid #0f3460;cursor:move;user-select:none;}' +
        '.aig-ratio-panel .aig-rp-header h4{font-size:13px;margin:0;color:#fbbf24;}' +
        '.aig-ratio-panel .aig-rp-close{color:#64748b;cursor:pointer;font-size:16px;padding:0 4px;}' +
        '.aig-ratio-panel .aig-rp-close:hover{color:#e87060;}' +
        '.aig-ratio-panel .aig-rp-body{padding:8px;overflow:auto;max-height:340px;}' +
        '.aig-ratio-panel .aig-rp-grid{display:grid;grid-template-columns:20px repeat(8,1fr);gap:2px;font-size:10px;}' +
        '.aig-ratio-panel .aig-rp-grid .rp-h{text-align:center;padding:4px 2px;color:#64748b;font-weight:500;font-size:9px;}' +
        '.aig-ratio-panel .aig-rp-grid .rp-v{text-align:right;padding:4px 4px 4px 0;color:#64748b;font-weight:500;font-size:9px;}' +
        '.aig-ratio-panel .aig-rp-grid .rp-cell{text-align:center;padding:5px 2px;background:#0a1628;border:1px solid #0f3460;border-radius:4px;cursor:pointer;color:#94a3b8;transition:all 0.1s;font-size:10px;}' +
        '.aig-ratio-panel .aig-rp-grid .rp-cell:hover{border-color:#fbbf24;color:#e8edf5;background:#16213e;}' +
        '.aig-ratio-panel .aig-rp-grid .rp-cell.active{background:#fbbf24;color:#1a1a2e;border-color:#fbbf24;font-weight:600;}' +
        '.aig-ratio-panel .aig-rp-grid .rp-cell.disabled{opacity:0.25;cursor:not-allowed;}' +
        '.aig-ratio-panel .aig-rp-grid .rp-cell.disabled:hover{border-color:#0f3460;color:#94a3b8;background:#0a1628;}' +
        '.aig-ratio-panel .aig-rp-foot{display:flex;align-items:center;gap:8px;padding:6px 10px;font-size:10px;color:#94a3b8;}' +
        '.aig-ratio-panel .aig-rp-foot .rp-cur{color:#e0e0e0;font-weight:600;}' +
        '.aig-node-view-btn{display:block;margin-top:6px;padding:4px;background:#0f3460;color:#94a3b8;border:1px solid #1a5276;border-radius:5px;cursor:pointer;font-size:10px;text-align:center;}' +
        '.aig-node-view-btn:hover{background:#1a5276;color:#e8edf5;}' +
        '.aig-node-loading{text-align:center;padding:15px;color:#fbbf24;font-size:12px;}' +
        // ---- 缩放 / 模态 ----
        '.aig-zoom-display{position:absolute;bottom:8px;left:8px;background:#16213e;border:1px solid #0f3460;padding:4px 10px;border-radius:6px;color:#e0e0e0;font-size:11px;z-index:10;pointer-events:none;}' +
        '.aig-modal{display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);z-index:99999;justify-content:center;align-items:center;overflow:hidden;cursor:zoom-out;}' +
        '.aig-modal.active{display:flex;}' +
        '.aig-modal img{max-width:92vw;max-height:92vh;border-radius:8px;transition:transform 0.1s ease;transform-origin:center center;cursor:zoom-in;user-select:none;-webkit-user-drag:none;}' +
        '.aig-modal .aig-modal-zoom{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.55);color:#e0e0e0;padding:4px 14px;border-radius:6px;font-size:13px;z-index:100000;pointer-events:none;font-family:"Segoe UI",system-ui,sans-serif;}' +
        '::-webkit-scrollbar{width:5px;}' +
        '::-webkit-scrollbar-track{background:transparent;}' +
        '::-webkit-scrollbar-thumb{background:rgba(78,204,163,0.15);border-radius:3px;}' +
        // ---- 历史面板 ----
        '.aig-history{position:fixed;width:740px;height:560px;z-index:10000;display:flex;flex-direction:column;background:#1a1a2e;color:#e0e0e0;font-family:"Segoe UI",system-ui,sans-serif;border-radius:12px;box-shadow:0 8px 50px rgba(0,0,0,.7);overflow:hidden;min-width:400px;min-height:300px;}' +
        '.aig-history-header{display:flex;align-items:center;justify-content:space-between;padding:8px 16px;background:#16213e;border-bottom:1px solid #0f3460;flex-shrink:0;cursor:move;user-select:none;}' +
        '.aig-history-header h3{font-size:15px;margin:0;color:#fbbf24;}' +
        '.aig-history-body{flex:1;overflow-y:auto;padding:10px 14px;}' +
        '.aig-history-empty{text-align:center;padding:60px 20px;color:#64748b;font-size:14px;}' +
        '.aig-history-entry{display:flex;gap:12px;padding:10px;border:1px solid #0f3460;border-radius:8px;margin-bottom:8px;background:#16213e;transition:border-color 0.15s;}' +
        '.aig-history-entry:hover{border-color:#fbbf24;}' +
        '.aig-history-thumb{width:100px;height:100px;object-fit:cover;border-radius:6px;cursor:pointer;flex-shrink:0;}' +
        '.aig-history-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;}' +
        '.aig-history-prompt{font-size:12px;color:#c8d6e5;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;word-break:break-all;}' +
        '.aig-history-meta{font-size:10px;color:#64748b;display:flex;flex-wrap:wrap;gap:6px;}' +
        '.aig-history-meta span{background:#0f3460;padding:1px 6px;border-radius:3px;}' +
        '.aig-history-actions{display:flex;align-items:flex-start;gap:4px;flex-shrink:0;}' +
        '.aig-history-actions button{background:#0f3460;border:1px solid #1a5276;color:#94a3b8;padding:4px 8px;border-radius:5px;cursor:pointer;font-size:10px;transition:all 0.15s;white-space:nowrap;}' +
        '.aig-history-actions button:hover{background:#1a5276;color:#e8edf5;}' +
        '.aig-history-actions .aig-history-btn-gen{color:#fbbf24;border-color:rgba(78,204,163,0.3);}' +
        '.aig-history-actions .aig-history-btn-gen:hover{background:rgba(78,204,163,0.15);}' +
        '.aig-history-actions .aig-history-btn-del{color:#e87060;border-color:rgba(220,80,60,0.3);}' +
        '.aig-history-actions .aig-history-btn-del:hover{background:rgba(220,80,60,0.15);}' +
        // ---- 设置面板 ----
        '.aig-settings{position:fixed;width:420px;z-index:2147483647;display:flex;flex-direction:column;background:#1a1a2e;color:#e0e0e0;font-family:"Segoe UI",system-ui,sans-serif;border-radius:12px;box-shadow:0 8px 50px rgba(0,0,0,.7);overflow:hidden;}' +
        '.aig-settings-header{display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#16213e;border-bottom:1px solid #0f3460;cursor:move;user-select:none;}' +
        '.aig-settings-header h3{font-size:15px;margin:0;color:#fbbf24;}' +
        '.aig-settings-body{padding:16px;display:flex;flex-direction:column;gap:12px;}' +
        '.aig-settings-row{display:flex;flex-direction:row;align-items:center;gap:8px;}' +
        '.aig-settings-row .aig-sl{width:100px;font-size:12px;color:#94a3b8;font-weight:500;flex-shrink:0;}' +
        '.aig-settings-row .aig-sc{flex:1;}' +
        '.aig-settings-row .aig-sc input[type="text"],.aig-settings-row .aig-sc input[type="password"],.aig-settings-row .aig-sc select{width:100%;background:#0a1628;border:1px solid #0f3460;color:#e0e0e0;padding:7px 10px;border-radius:6px;font-size:13px;outline:none;font-family:inherit;box-sizing:border-box;}' +
        '.aig-settings-row .aig-sc input:focus,.aig-settings-row .aig-sc select:focus{border-color:#fbbf24;}' +
        '.aig-settings-row .aig-sc input::placeholder{color:#475569;}' +
        '.aig-settings-row .aig-sr{width:80px;text-align:right;flex-shrink:0;}' +
        '.aig-settings-row .aig-sr a{color:#38bdf8;font-size:12px;text-decoration:none;}' +
        '.aig-settings-row .aig-sr a:hover{text-decoration:underline;}' +
        '.aig-settings-actions{display:flex;gap:8px;padding:12px 16px;justify-content:flex-end;}' +
        '.aig-settings-actions button{padding:7px 16px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:500;transition:all 0.15s;border:1px solid transparent;}' +
        '.aig-settings-btn-primary{background:#fbbf24;color:#1a1a2e;border-color:#fbbf24;}' +
        '.aig-settings-btn-primary:hover{background:#3db88a;}' +
        '.aig-settings-btn-default{background:transparent;color:#94a3b8;border-color:#1a5276;}' +
        '.aig-settings-btn-default:hover{color:#e8edf5;border-color:#fbbf24;}' +
        '.aig-settings-btn-danger{background:rgba(220,80,60,0.15);color:#e87060;border-color:rgba(220,80,60,0.3);}' +
        '.aig-settings-btn-danger:hover{background:rgba(220,80,60,0.25);}';
    document.head.appendChild(s);
})();

var AIImageGenSkill = {
    id: 'ai-image-gen',
    name: 'AI生图',
    icon: '<span style="color:#fbbf24;">生</span>',
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
    _apiBase: 'https://api3.wlai.vip',
    _defaultModel: 'gpt-image-2',
    _historyRecords: null,
    _historyPage: 0,
    _HISTORY_PAGE_SIZE: 20,

    _modelConfigs: {
        'gpt-image-2': {
            sizes: [
                {v:'1024x1024',l:'1K方'},
                {v:'1536x1024',l:'1K横'},
                {v:'1024x1536',l:'1K竖'},
                {v:'2048x2048',l:'2K方'},
                {v:'2048x1152',l:'2K横'},
                {v:'1152x2048',l:'2K竖'},
                {v:'3840x3840',l:'4K方'},
                {v:'3840x2160',l:'4K横'},
                {v:'2160x3840',l:'4K竖'}
            ],
            qualities: [
                {v:'medium',l:'中'},
                {v:'low',l:'低'},
                {v:'high',l:'高'},
                {v:'auto',l:'自动'}
            ],
            formats: [
                {v:'png',l:'PNG'},
                {v:'jpeg',l:'JPEG'},
                {v:'webp',l:'WebP'}
            ]
        }
    },

    _settingsEl: null,
    _ratioPanelEl: null,
    _lastParams: { mode: 'auto', baseK: '1k', ratioW: 1, ratioH: 1 },

    // ===== 分辨率计算 =====

    _RATIO_VALS: [1,2,3,4,5,9,16,21],
    _BASE_MAP: { 'auto': 0, '1k': 1024, '2k': 2048, '4k': 3840 },

    _computeResolution: function(mode, baseK, ratioW, ratioH) {
        var maxSide = this._BASE_MAP[baseK];
        if (!maxSide) return null;
        if (mode === 'auto') {
            return { width: maxSide, height: maxSide };
        }
        if (!ratioW || !ratioH) return null;

        var w, h;
        if (ratioW >= ratioH) {
            // 横向/方形
            w = maxSide;
            h = Math.round(maxSide * ratioH / ratioW / 16) * 16;
        } else {
            // 竖向
            h = maxSide;
            w = Math.round(maxSide * ratioW / ratioH / 16) * 16;
        }

        // 规则3: 长边/短边 ≤ 3:1
        if (Math.max(w, h) / Math.min(w, h) > 3) return null;

        // 规则4: 总像素 655360 ~ 8294400
        var pixels = w * h;
        if (pixels < 655360) {
            // 像素不足 → 补足短边至满足最小值
            var minShort = Math.ceil(655360 / maxSide / 16) * 16;
            if (ratioW >= ratioH) h = minShort;
            else w = minShort;
            pixels = w * h;
            // 补足后再次检查比例
            if (Math.max(w, h) / Math.min(w, h) > 3) return null;
        }
        if (pixels > 8294400) return null;

        return { width: w, height: h };
    },

    _ratioLabel: function(ratioW, ratioH) {
        if (!ratioW || !ratioH) return '--:--';
        return ratioW + ':' + ratioH;
    },

    _getSizeString: function(nd) {
        var r = this._computeResolution(nd.mode, nd.baseK, nd.ratioW, nd.ratioH);
        if (r) return r.width + 'x' + r.height;
        // 旧格式回退
        if (nd.size && nd.size.indexOf('x') > -1) return nd.size;
        return '1024x1024';
    },

    // 从旧 size 字符串推断 baseK/ratio（用于兼容旧存档）
    _inferFromOldSize: function(oldSize) {
        if (!oldSize || oldSize.indexOf('x') === -1) return null;
        var parts = oldSize.split('x');
        var ow = parseInt(parts[0]), oh = parseInt(parts[1]);
        if (isNaN(ow) || isNaN(oh)) return null;
        // 确定 baseK
        var maxSide = Math.max(ow, oh);
        var baseK = '1k';
        if (maxSide > 1024) baseK = '2k';
        if (maxSide > 2048) baseK = '4k';
        // 计算最简比例
        var g = function(a,b){ while(b){ var t=b; b=a%b; a=t; } return a; }(ow, oh);
        return { baseK: baseK, ratioW: ow/g, ratioH: oh/g };
    },

    // ========== 比例面板 ==========

    _openRatioPanel: function(nodeId) {
        var self = this;
        var nd = this._getNode(nodeId);
        if (!nd) return;

        // 关闭已有面板
        if (this._ratioPanelEl && this._ratioPanelEl.parentNode) {
            this._ratioPanelEl.parentNode.removeChild(this._ratioPanelEl);
            this._ratioPanelEl = null;
        }

        var panel = document.createElement('div');
        panel.className = 'aig-ratio-panel';
        // 放在当前生图节点右侧外部，底部对齐
        var nodeEl = this._viewport ? this._viewport.querySelector('[data-id="' + nodeId + '"].aig-node') : null;
        if (nodeEl) {
            var nr = nodeEl.getBoundingClientRect();
            var left = nr.right + 6;
            if (left + 340 > window.innerWidth) left = nr.left - 346;
            panel.style.left = Math.max(2, left) + 'px';
            panel.style.top = nr.top + 'px';
            panel._alignNode = nodeEl;
        } else {
            panel.style.left = Math.max(20, (window.innerWidth - 340) / 2) + 'px';
            panel.style.top = Math.max(20, (window.innerHeight - 420) / 2) + 'px';
        }

        // 标题栏
        var header = document.createElement('div');
        header.className = 'aig-rp-header';
        header.innerHTML = '<h4>📐 选择比例</h4><span class="aig-rp-close">✕</span>';
        panel.appendChild(header);

        // 拖拽
        (function(hd, win) {
            var d = { active: false, sx: 0, sy: 0, ox: 0, oy: 0 };
            hd.addEventListener('mousedown', function(e) {
                if (e.target.classList.contains('aig-rp-close')) return;
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
        })(header, panel);

        // 关闭
        panel.querySelector('.aig-rp-close').addEventListener('click', function() {
            if (panel.parentNode) panel.parentNode.removeChild(panel);
            if (self._ratioPanelEl === panel) self._ratioPanelEl = null;
        });

        // 表格内容
        var body = document.createElement('div');
        body.className = 'aig-rp-body';
        var vals = this._RATIO_VALS; // [1,2,3,4,5,9,16,21]

        var html = '<div class="aig-rp-grid">';
        // 空白角
        html += '<div></div>';
        // 列标题（竖=高）
        for (var ci = 0; ci < vals.length; ci++) {
            html += '<div class="rp-h">' + vals[ci] + '</div>';
        }
        // 行
        for (var ri = 0; ri < vals.length; ri++) {
            // 行标题（横=宽）
            html += '<div class="rp-v">' + vals[ri] + '</div>';
            for (var cj = 0; cj < vals.length; cj++) {
                var w = vals[ri], h = vals[cj];  // 行=宽, 列=高
                var active = (nd.ratioW === w && nd.ratioH === h) ? ' active' : '';
                var longS = Math.max(w, h), shortS = Math.min(w, h);
                var exceed = (longS / shortS > 3);
                var isDupSquare = (w === h && w > 1);
                // 严格检查：不缩放，看原始比例在当前 baseK 下是否合法
                var rawMax = self._BASE_MAP[nd.baseK] || 1024;
                var rawW, rawH;
                if (w >= h) { rawW = rawMax; rawH = Math.round(rawMax * h / w / 16) * 16; }
                else { rawH = rawMax; rawW = Math.round(rawMax * w / h / 16) * 16; }
                var rawPx = rawW * rawH;
                var rawValid = rawPx >= 655360 && rawPx <= 8294400 && rawW % 16 === 0 && rawH % 16 === 0;
                var label = self._ratioLabel(w, h);
                var disabled = (exceed || isDupSquare || !rawValid) ? ' disabled' : '';
                html += '<div class="rp-cell' + active + disabled + '" data-w="' + w + '" data-h="' + h + '">' + label + '</div>';
            }
        }
        html += '</div>';
        body.innerHTML = html;
        panel.appendChild(body);

        // 底部：当前选择
        var foot = document.createElement('div');
        foot.className = 'aig-rp-foot';
        foot.innerHTML = '当前: <span class="rp-cur">' + this._ratioLabel(nd.ratioW, nd.ratioH) + '</span>';
        panel.appendChild(foot);

        panel._nodeId = nodeId;
        document.body.appendChild(panel);
        // 顶部与生图节点顶部对齐
        if (panel._alignNode) {
            var nr2 = panel._alignNode.getBoundingClientRect();
            panel.style.top = Math.max(2, nr2.top) + 'px';
            delete panel._alignNode;
        }
        this._ratioPanelEl = panel;

        // 单元格点击（跳过禁用格）
        body.querySelectorAll('.rp-cell:not(.disabled)').forEach(function(cell) {
            cell.addEventListener('click', function() {
                var w = parseInt(this.getAttribute('data-w'));
                var h = parseInt(this.getAttribute('data-h'));
                // 更新 node 数据
                nd.ratioW = w;
                nd.ratioH = h;
                // 更新高亮
                body.querySelectorAll('.rp-cell').forEach(function(c) { c.classList.remove('active'); });
                this.classList.add('active');
                // 更新底部
                foot.innerHTML = '当前: <span class="rp-cur">' + self._ratioLabel(w, h) + '</span>';
                // 更新节点 UI — 比例按钮只显示简化比例
                var nodeEl = self._viewport ? self._viewport.querySelector('[data-id="' + nodeId + '"].aig-node') : null;
                if (nodeEl) {
                    var ratioBtn = nodeEl.querySelector('[data-action="openratio"]');
                    if (ratioBtn) ratioBtn.textContent = '比例 ' + self._ratioLabel(w, h);
                }
                self._lastParams = { mode: nd.mode, baseK: nd.baseK, ratioW: w, ratioH: h };
                self._autoSave();
            });
        });
    },

    _refreshRatioPanel: function() {
        var panel = this._ratioPanelEl;
        if (!panel) return;
        var nodeId = panel._nodeId;
        var nd = this._getNode(nodeId);
        if (!nd) return;
        var vals = this._RATIO_VALS;
        var body = panel.querySelector('.aig-rp-body');
        var foot = panel.querySelector('.aig-rp-foot');
        if (!body) return;

        var html = '<div class="aig-rp-grid">';
        html += '<div></div>';
        for (var ci = 0; ci < vals.length; ci++) {
            html += '<div class="rp-h">' + vals[ci] + '</div>';
        }
        for (var ri = 0; ri < vals.length; ri++) {
            html += '<div class="rp-v">' + vals[ri] + '</div>';
            for (var cj = 0; cj < vals.length; cj++) {
                var w = vals[ri], h = vals[cj];
                var active = (nd.ratioW === w && nd.ratioH === h) ? ' active' : '';
                var longS = Math.max(w, h), shortS = Math.min(w, h);
                var exceed = (longS / shortS > 3);
                var isDupSquare = (w === h && w > 1);
                var rawMax = this._BASE_MAP[nd.baseK] || 1024;
                var rawW, rawH;
                if (w >= h) { rawW = rawMax; rawH = Math.round(rawMax * h / w / 16) * 16; }
                else { rawH = rawMax; rawW = Math.round(rawMax * w / h / 16) * 16; }
                var rawPx = rawW * rawH;
                var rawValid = rawPx >= 655360 && rawPx <= 8294400;
                var label = this._ratioLabel(w, h);
                var disabled = (exceed || isDupSquare || !rawValid) ? ' disabled' : '';
                html += '<div class="rp-cell' + active + disabled + '" data-w="' + w + '" data-h="' + h + '">' + label + '</div>';
            }
        }
        html += '</div>';
        body.innerHTML = html;

        // 重新绑定点击
        var self = this;
        body.querySelectorAll('.rp-cell:not(.disabled)').forEach(function(cell) {
            cell.addEventListener('click', function() {
                var w = parseInt(this.getAttribute('data-w'));
                var h = parseInt(this.getAttribute('data-h'));
                nd.ratioW = w;
                nd.ratioH = h;
                body.querySelectorAll('.rp-cell').forEach(function(c) { c.classList.remove('active'); });
                this.classList.add('active');
                foot.innerHTML = '当前: <span class="rp-cur">' + self._ratioLabel(w, h) + '</span>';
                var nodeEl = self._viewport ? self._viewport.querySelector('[data-id="' + nodeId + '"].aig-node') : null;
                if (nodeEl) {
                    var ratioBtn = nodeEl.querySelector('[data-action="openratio"]');
                    if (ratioBtn) ratioBtn.textContent = '比例 ' + self._ratioLabel(w, h);
                }
                self._lastParams = { mode: nd.mode, baseK: nd.baseK, ratioW: w, ratioH: h };
                self._autoSave();
            });
        });
    },

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
                setTimeout(function() { self._addNode(); }, 100);
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
            { label: '生', title: '添加生图节点', action: function() { self._addNode(); } },
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
            '<button id="aigAddNode">✏️ 生图</button>' +
            '<div class="sep"></div>' +
            '<button id="aigHistoryBtn">📋 历史&导出</button>' +
            '<button id="aigSettingsBtn">⚙️ 设置</button>' +
            '<button id="aigClearAll">🗑️ 清空画布</button>';
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

        ov.querySelector('#aigAddNode').addEventListener('click', function() { self._addNode(); });
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
            if (e.key === 'n' && !e.ctrlKey && !e.metaKey && !inp) { e.preventDefault(); self._addNode(); }
        });
    },

    // ========== 节点管理 ==========

    _addNode: function(x, y, prefill) {
        var wrap = this._canvasWrap;
        if (!wrap) return null;
        var cw = wrap.clientWidth || 800, ch = wrap.clientHeight || 400;
        var vx = (cw / 2 - this._panX) / this._scale;
        var vy = (ch / 2 - this._panY) / this._scale;
        var node = {
            id: ++this._nodeIdCounter,
            type: 'unified',    // 统一生图节点
            x: x !== undefined ? x : vx - 160,
            y: y !== undefined ? y : vy - 120,
            prompt: prefill || '',
            size: '2048x1152',   // 旧格式（兼容）
            mode: this._lastParams.mode || 'auto',
            baseK: this._lastParams.baseK || '1k',
            ratioW: this._lastParams.ratioW || 1,
            ratioH: this._lastParams.ratioH || 1,
            model: this._defaultModel || 'gpt-image-2',
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
        // 关闭关联的比例面板
        if (this._ratioPanelEl && this._ratioPanelEl._nodeId === id) {
            this._ratioPanelEl.remove();
            this._ratioPanelEl = null;
        }
        if (this._nodes.length === 0) {
            this._nodeIdCounter = 0;
        }
    },

    _clearAllNodes: function() {
        if (!confirm('确定要清空画布吗？此操作不可撤销！')) return;
        var self = this;
        this._nodes = [];
        this._selectedNode = null;
        if (this._ratioPanelEl) { this._ratioPanelEl.remove(); this._ratioPanelEl = null; }
        this._nodeIdCounter = 0;
        if (this._viewport) this._viewport.innerHTML = '';
        // 同时清空 IndexedDB 中的图片缓存
        this._getDB().then(function(db) {
            try {
                var tx = db.transaction('images', 'readwrite');
                tx.objectStore('images').clear();
                tx.oncomplete = function() { self._autoSave(); };
            } catch(e) { self._autoSave(); }
        });
        this._setStatus('画布已清空');
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

        var html = '<div class="aig-node-header">' +
            '<span>✏️ 生图 #' + nd.id + '</span>' +
            '<span class="aig-node-status" style="flex:1;font-size:9px;color:#ef4444;text-align:center;margin:0 4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (nd._status || '') + '</span>' +
            '<span class="aig-header-tools">' +
                '<span class="aig-header-btn" data-action="duplicate" data-id="' + nd.id + '" title="复制此节点">⧉</span>' +
                '<span class="close" data-action="remove" data-id="' + nd.id + '">&times;</span>' +
            '</span>' +
        '</div>' +
        '<div class="aig-node-body">';

        // 虚线框：包裹第1~5行（参数设置区）
        html += '<div style="border:1px dashed #1a5276;border-radius:6px;padding:6px;margin-top:0;">';

        // 第1行：参考图按钮（2个各1/2）
        html += '<div class="aig-ref-grid" data-id="' + nd.id + '"></div>' +
            '<div class="aig-ref-count" style="font-size:10px;color:#64748b;margin-top:6px;">0 / 16 张 · 每张 &lt;50MB · 输入框粘贴图片导入</div>' +
            '<div style="display:flex;gap:4px;margin-top:6px;">' +
                '<button class="aig-ref-btn aig-ref-default" data-action="reflocal" data-id="' + nd.id + '" style="flex:1;">📁 本地导入</button>' +
                '<button class="aig-ref-btn" data-action="refcloud" data-id="' + nd.id + '" style="flex:1;">☁️ 盘导入</button>' +
            '</div>';

        // 第2行：模板按钮(1/4) + 输入框(3/4)
        html += '<div style="display:flex;gap:4px;margin-top:6px;">' +
            '<button class="aig-prompt-btn aig-btn-word" data-action="openword" data-id="' + nd.id + '" style="flex:1;max-width:25%;height:44px;font-size:9px;">模板</button>' +
            '<textarea class="aig-node-prompt" placeholder="输入提示词..." style="flex:3;height:44px;min-height:44px;resize:vertical;">' + (nd.prompt || '') + '</textarea>' +
        '</div>';

        // 结果图片（暂存，放到底部行之后）
        var resultHtml = '';
        if (nd.images && nd.images.length > 0) {
            resultHtml += '<div style="display:flex;gap:4px;margin-top:6px;">' +
                '<button class="aig-result-btn" data-action="exportone" data-id="' + nd.id + '" style="flex:1;">💾 本地导出</button>' +
                '<button class="aig-result-btn" data-action="cloudexport" data-id="' + nd.id + '" style="flex:1;">☁️ 盘导出</button>' +
            '</div>';
            resultHtml += '<div class="aig-result-grid" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px;">';
            for (var imgIdx = 0; imgIdx < nd.images.length; imgIdx++) {
                resultHtml += '<img class="aig-node-img" src="' + nd.images[imgIdx] + '" data-action="viewimg" data-id="' + nd.id + '" data-idx="' + imgIdx + '" style="width:' + (nd.images.length > 1 ? '48%' : '100%') + ';border-radius:6px;cursor:pointer;" onerror="this.style.display=\'none\'">';
            }
            resultHtml += '</div>';
        } else if (nd.image) {
            resultHtml += '<div style="display:flex;gap:4px;margin-top:6px;">' +
                '<button class="aig-result-btn" data-action="exportone" data-id="' + nd.id + '" style="flex:1;">💾 本地导出</button>' +
                '<button class="aig-result-btn" data-action="cloudexport" data-id="' + nd.id + '" style="flex:1;">☁️ 盘导出</button>' +
            '</div>';
            resultHtml += '<img class="aig-node-img" src="' + nd.image + '" data-action="viewimg" data-id="' + nd.id + '" onerror="this.style.display=\'none\'">';
        } else if (nd.loading) {
            resultHtml += '<div class="aig-node-loading">⏳ 生成中...</div>';
        }

        // 查看按钮
        if (nd.image && !(nd.images && nd.images.length > 0)) {
            resultHtml += '<div class="aig-node-view-btn" data-action="view" data-id="' + nd.id + '">🔍 查看大图</div>';
        }

        // 第3行：1K/2K/4K（3个各1/3）
        var baseKeys = ['1k','2k','4k'];
        var baseLabels = {'1k':'1K=1024','2k':'2K=2048','4k':'4K=3840'};
        html += '<div class="aig-size-row" style="display:flex;gap:4px;margin-top:8px;">';
        for (var si = 0; si < baseKeys.length; si++) {
            var bk = baseKeys[si];
            var active = (nd.baseK === bk) ? ' active' : '';
            html += '<div class="aig-size-btn' + active + '" data-action="basesel" data-value="' + bk + '" data-id="' + nd.id + '" style="flex:1;">' + baseLabels[bk] + '</div>';
        }
        html += '</div>';

        // 第4行：Auto / 比例（2个各1/2）
        var ratioLbl = this._ratioLabel(nd.ratioW, nd.ratioH);
        html += '<div class="aig-mode-row" style="display:flex;gap:4px;margin-top:8px;">' +
            '<div class="aig-mode-btn' + (nd.mode === 'auto' ? ' active' : '') + '" data-action="modesel" data-value="auto" data-id="' + nd.id + '" style="flex:1;">Auto</div>' +
            '<div class="aig-mode-btn' + (nd.mode === 'manual' ? ' active' : '') + '" data-action="openratio" data-value="manual" data-id="' + nd.id + '" style="flex:1;">比例 ' + ratioLbl + '</div>' +
        '</div>';

        // 第5行：生成 + 格式 + 质量 + 数量（4个各1/4）
        var cfg = this._modelConfigs[nd.model] || this._modelConfigs['gpt-image-2'];
        var qltyOpts = cfg.qualities;
        var fmtOpts = cfg.formats;
        html += '<div class="aig-node-bottom" style="display:flex;gap:4px;margin-top:8px;">' +
            '<select data-action="formatsel" data-id="' + nd.id + '" style="flex:1;height:22px;background:#0a1628;border:1px solid #0f3460;border-radius:4px;padding:0 2px;color:#94a3b8;font-size:10px;outline:none;cursor:pointer;text-align:center;">';
        for (var fi = 0; fi < fmtOpts.length; fi++) {
            html += '<option value="' + fmtOpts[fi].v + '"' + ((nd.format || 'png') === fmtOpts[fi].v ? ' selected' : '') + '>' + fmtOpts[fi].l + '</option>';
        }
        html += '</select>' +
            '<select data-action="qualitysel" data-id="' + nd.id + '" style="flex:1;height:22px;background:#0a1628;border:1px solid #0f3460;border-radius:4px;padding:0 2px;color:#94a3b8;font-size:10px;outline:none;cursor:pointer;text-align:center;">';
        for (var qi = 0; qi < qltyOpts.length; qi++) {
            html += '<option value="' + qltyOpts[qi].v + '"' + (nd.quality === qltyOpts[qi].v ? ' selected' : '') + '>' + qltyOpts[qi].l + '</option>';
        }
        html += '</select>' +
            '<input type="number" data-action="numimg" data-id="' + nd.id + '" min="1" max="10" value="' + (nd.numImages || 1) + '" title="数量" style="flex:1;height:22px;width:0;background:#0a1628;border:1px solid #0f3460;border-radius:4px;padding:0;color:#94a3b8;font-size:10px;outline:none;text-align:center;">' +
            '<button data-action="generate" data-id="' + nd.id + '" style="flex:1;height:22px;padding:0 4px;background:#8b1a1a;border:none;border-radius:4px;color:#fff;font-size:10px;font-weight:700;cursor:pointer;">🎨 生成</button>' +
        '</div>' +
        '</div>' +
        (resultHtml ? '<div style="height:1px;background:#0f3460;margin:6px 0;"></div>' : '') + resultHtml;

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
                case 'view': case 'viewref': self._viewNodeImage(id); break;
                case 'viewimg':
                    var viNd = self._getNode(id);
                    var viIdx = parseInt(btn.getAttribute('data-idx'));
                    var viUrl = (!isNaN(viIdx) && viNd && viNd.images && viNd.images[viIdx]) ? viNd.images[viIdx] : (viNd ? viNd.image : null);
                    if (viUrl) self._viewImage(viUrl, id, isNaN(viIdx) ? 0 : viIdx);
                    break;
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
                case 'modesel':
                    var mNd = self._getNode(id);
                    if (mNd) {
                        mNd.mode = btn.getAttribute('data-value');
                        var modeRow = el.querySelector('.aig-mode-row');
                        if (modeRow) {
                            modeRow.querySelectorAll('.aig-mode-btn').forEach(function(b) {
                                b.classList.toggle('active', b.getAttribute('data-value') === mNd.mode);
                            });
                        }
                        // 切到 auto 时关闭比例面板
                        if (mNd.mode === 'auto' && self._ratioPanelEl && self._ratioPanelEl._nodeId === id) {
                            self._ratioPanelEl.remove();
                            self._ratioPanelEl = null;
                        }
                        self._lastParams = { mode: mNd.mode, baseK: mNd.baseK, ratioW: mNd.ratioW, ratioH: mNd.ratioH };
                        self._autoSave();
                    }
                    break;
                case 'basesel':
                    var bNd = self._getNode(id);
                    if (bNd) {
                        bNd.baseK = btn.getAttribute('data-value');
                        var szRow = el.querySelector('.aig-size-row');
                        if (szRow) {
                            szRow.querySelectorAll('.aig-size-btn').forEach(function(b) {
                                b.classList.toggle('active', b.getAttribute('data-value') === bNd.baseK);
                            });
                        }
                        // 比例面板打开中则刷新
                        if (self._ratioPanelEl && self._ratioPanelEl._nodeId === id) {
                            self._refreshRatioPanel();
                        }
                        self._lastParams = { mode: bNd.mode, baseK: bNd.baseK, ratioW: bNd.ratioW, ratioH: bNd.ratioH };
                        self._autoSave();
                    }
                    break;
                case 'openratio':
                    // 点击比例按钮自动切到 manual 模式
                    var rNd = self._getNode(id);
                    if (rNd && rNd.mode !== 'manual') {
                        // 先保存当前输入的提示词
                        var ta = el.querySelector('.aig-node-prompt');
                        if (ta) rNd.prompt = ta.value;
                        rNd.mode = 'manual';
                        self._refreshNode(id);
                        self._autoSave();
                    }
                    self._openRatioPanel(id);
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
            ['modelsel','qualitysel','formatsel'].forEach(function(cls) {
                var sel = bottom.querySelector('[data-action="' + cls + '"]');
                if (!sel) return;
                sel.addEventListener('change', function() {
                    var _nd = self._getNode(nd.id);
                    if (!_nd) return;
                    switch (sel.getAttribute('data-action')) {
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

        // Ctrl+V 粘贴图片到参考图
        var ta = el.querySelector('.aig-node-prompt');
        if (ta) {
            ta.addEventListener('paste', function(e) {
                var items = e.clipboardData && e.clipboardData.items;
                if (!items) return;
                for (var pi = 0; pi < items.length; pi++) {
                    if (items[pi].type.indexOf('image') === 0) {
                        e.preventDefault();
                        var blob = items[pi].getAsFile();
                        if (!blob || blob.size > 50*1024*1024) { self._setNodeStatus(nd.id, '⚠️ 图片超50MB'); continue; }
                        var reader = new FileReader();
                        reader.onload = function(ev) {
                            if (!nd.refImages) nd.refImages = [];
                            if (nd.refImages.length >= 16) { self._setNodeStatus(nd.id, '⚠️ 最多16张'); return; }
                            nd.refImages.push({ dataURL: ev.target.result, name: '粘贴图片' });
                            nd.refImage = nd.refImages[0].dataURL;
                            nd.refName = nd.refImages[0].name;
                            self._renderRefGrid(nd.id);
                            self._autoSave();
                            self._setNodeStatus(nd.id, '✅ 已粘贴图片');
                        };
                        reader.readAsDataURL(blob);
                        break;
                    }
                }
            });
        }

        this._viewport.appendChild(el);
        this._renderRefGrid(nd.id, el);
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
        var newNode = this._addNode(nd.x + 350, nd.y, nd.prompt);
        if (newNode) {
            newNode.size = nd.size;
            newNode.mode = nd.mode;
            newNode.baseK = nd.baseK;
            newNode.ratioW = nd.ratioW;
            newNode.ratioH = nd.ratioH;
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



    // ========== 参考图直接设置 ==========

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
            // 保存当前提示词再刷新
            var ta = self._viewport ? self._viewport.querySelector('[data-id="' + id + '"].aig-node .aig-node-prompt') : null;
            if (ta) nd.prompt = ta.value;
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
        if (!nd) return;
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
        if (cnt) cnt.textContent = refs.length + ' / 16 张 · 每张 <50MB · 输入框粘贴图片导入';
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
            if (!prompt) { self._setNodeStatus(id, '⚠️ 输入提示词'); return; }

            // 自动保存提示词到模板（内容变了才存）
            if (typeof PromptTemplateSkill !== 'undefined' && PromptTemplateSkill.addTemplate) {
                // 确保提示词模板插件已激活（加载 IndexedDB 数据）
                if (!PromptTemplateSkill._dbReadSuccess && typeof SkillSystem !== 'undefined') {
                    SkillSystem.activate('prompt-template');
                }
                if (prompt !== nd._lastSavedPrompt) {
                    PromptTemplateSkill.addTemplate(prompt);
                    nd._lastSavedPrompt = prompt;
                }
            }

            var apiKey = (this._apiKey || '').trim();
            if (!apiKey) { self._setNodeStatus(id, '⚠️ 设置 API Key'); return; }

            nd.loading = true;
            nd.prompt = prompt;
            nd.images = [];
            nd.dataUrl = null;
            nd.image = null;
            // 清除 IndexedDB 旧图缓存，防止失败后显示旧图
            self._getDB().then(function(db) {
                try { db.transaction('images', 'readwrite').objectStore('images').delete('img-' + nd.id); } catch(e) {}
            });
            // 保存当前所有参数到 nd，确保 _refreshNode 使用正确值
            var modeBtn = el.querySelector('.aig-mode-row .aig-mode-btn.active');
            if (modeBtn) nd.mode = modeBtn.getAttribute('data-value') || 'auto';
            var sSel = el.querySelector('.aig-size-row .aig-size-btn.active');
            if (sSel) nd.baseK = sSel.getAttribute('data-value');
            var bottom = el.querySelector('.aig-node-bottom');
            if (bottom) {
                var mSel = bottom.querySelector('[data-action="modelsel"]');
                if (mSel) nd.model = mSel.value;
                var qSel = bottom.querySelector('[data-action="qualitysel"]');
                if (qSel) nd.quality = qSel.value;
                var fSel = bottom.querySelector('[data-action="formatsel"]');
                if (fSel) nd.format = fSel.value;
                var nInp = bottom.querySelector('[data-action="numimg"]');
                if (nInp) nd.numImages = parseInt(nInp.value) || 1;
            }
            genBtn = bottom ? bottom.querySelector('[data-action="generate"]') : null;
            if (genBtn) { genBtn.disabled = true; genBtn.style.opacity = '0.4'; genBtn.style.cursor = 'not-allowed'; }
            self._setNodeStatus(id, '⏳ 0s');

            var startTime = Date.now();
            timerInterval = setInterval(function() {
                var elapsed = Math.floor((Date.now() - startTime) / 1000);
                self._setNodeStatus(id, '⏳ ' + elapsed + 's');
            }, 500);

            // 有参考图 → 图生图 / 无参考图 → 文生图
            var isImg2Img = nd.refImages && nd.refImages.length > 0;
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
                formData.append('size', self._getSizeString(nd));
                var qv = nd.quality || 'auto';
                if (qv) formData.append('quality', qv);
                var baseUrl = self._apiBase || 'https://api3.wlai.vip';
                resp = await fetch(baseUrl + '/v1/images/edits', {
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
                    size: self._getSizeString(nd)
                };
                var qv = nd.quality || 'auto';
                if (qv) bodyObj.quality = qv;
                var baseUrl = self._apiBase || 'https://api3.wlai.vip';
                resp = await fetch(baseUrl + '/v1/images/generations', {
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
            nd.dataUrls = [];
            for (var di = 0; di < data.data.length; di++) {
                var item = data.data[di];
                var url;
                if (item.b64_json) {
                    var mime = item.b64_json.indexOf('/9j/') === 0 ? 'image/jpeg' : 'image/png';
                    var binary = atob(item.b64_json);
                    var uarr = new Uint8Array(binary.length);
                    for (var ci = 0; ci < binary.length; ci++) uarr[ci] = binary.charCodeAt(ci);
                    url = URL.createObjectURL(new Blob([uarr], { type: mime }));
                    var dUrl = 'data:' + mime + ';base64,' + item.b64_json;
                    nd.dataUrls.push(dUrl);
                    if (di === 0) nd.dataUrl = dUrl;
                } else {
                    continue;
                }
                nd.images.push(url);
            }
            
            if (nd.images.length === 0) throw new Error('无图片数据');
            
            // 第一张图作为主图显示
            nd.image = nd.images[0];
            nd.loading = false;
            
            var totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
            self._autoSave();
            self._saveToHistory(nd);
            self._refreshNode(id);
            self._setNodeStatus(id, '✅ ' + totalSec + 's (' + nd.images.length + ' 张)');
        } catch(e) {
            var totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
            if (nd) { nd.loading = false; nd.error = e.message || String(e); if (self._viewport) self._refreshNode(id); }
            self._setNodeStatus(id, '❌ ' + totalSec + 's ' + (e.message || e).substring(0, 30));
        } finally {
            if (timerInterval) clearInterval(timerInterval);
            // _refreshNode 可能重建了按钮，重新查询
            var newEl = self._viewport ? self._viewport.querySelector('[data-id="' + id + '"].aig-node') : null;
            var newBtn = newEl ? newEl.querySelector('[data-action="generate"]') : null;
            if (newBtn) { newBtn.disabled = false; newBtn.style.opacity = '1'; newBtn.style.cursor = 'pointer'; }
            else if (genBtn) { genBtn.disabled = false; genBtn.style.opacity = '1'; genBtn.style.cursor = 'pointer'; }
        }
    },

    _saveDataUrl: function(nd, url) {
        var self = this;
        if (url.indexOf('data:') === 0) {
            nd.dataUrl = url;
            self._autoSave();
            self._saveToHistory(nd);
            return;
        }
        fetch(url).then(function(r) { return r.blob(); }).then(function(blob) {
            var reader = new FileReader();
            reader.onload = function() {
                nd.dataUrl = reader.result;
                self._autoSave();
                self._saveToHistory(nd);
            };
            reader.readAsDataURL(blob);
        }).catch(function() {
            // fallback: Image + canvas
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
        });
    },

    // ========== 生成历史 ==========

    _makeThumbnail: function(dataUrl, maxSize) {
        return new Promise(function(resolve) {
            var img = new Image();
            img.onload = function() {
                var scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
                var tw = Math.round(img.width * scale), th = Math.round(img.height * scale);
                var c = document.createElement('canvas');
                c.width = tw; c.height = th;
                c.getContext('2d').drawImage(img, 0, 0, tw, th);
                resolve(c.toDataURL('image/jpeg', 0.7));
            };
            img.onerror = function() { resolve(dataUrl); };
            img.src = dataUrl;
        });
    },

    _saveToHistory: function(nd) {
        var urls = nd.dataUrls && nd.dataUrls.length ? nd.dataUrls : (nd.dataUrl ? [nd.dataUrl] : []);
        if (!urls.length) return;
        var self = this;
        Promise.all(urls.map(function(url) {
            return self._makeThumbnail(url, 200);
        })).then(function(thumbDataUrls) {
            self._getDB().then(function(db) {
                var tx = db.transaction(['history', 'history-images'], 'readwrite');
                var histStore = tx.objectStore('history');
                var imgStore = tx.objectStore('history-images');
                var addReq = histStore.add({
                    prompt: nd.prompt || '',
                    thumbDataUrls: thumbDataUrls,
                    model: nd.model || 'gpt-image-2',
                    size: self._getSizeString(nd),
                    mode: nd.mode || 'auto', baseK: nd.baseK || '1k', ratioW: nd.ratioW || 1, ratioH: nd.ratioH || 1,
                    quality: nd.quality || 'medium',
                    format: nd.format || 'png',
                    numImages: urls.length,
                    timestamp: Date.now()
                });
                addReq.onsuccess = function() {
                    for (var i = 0; i < urls.length; i++) {
                        imgStore.put(urls[i], i === 0 ? addReq.result : addReq.result + '-' + i);
                    }
                };
            }).catch(function() {});
        });
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
            '<button id="aigHistExport" style="background:rgba(78,204,163,0.12);border:1px solid rgba(78,204,163,0.3);color:#fbbf24;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;">📤 导出</button>' +
            '<button id="aigHistImport" style="background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.2);color:#38bdf8;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;">📥 导入</button>' +
            '<button id="aigHistClear" style="background:rgba(220,60,60,.2);border:1px solid rgba(220,60,60,.3);color:#e87060;padding:4px 10px;border-radius:6px;cursor:pointer;font-size:11px;">🗑 清空历史</button>' +
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
        // 清空
        ov.querySelector('#aigHistClear').addEventListener('click', function() {
            if (confirm('确认清空历史？此操作不可撤销。')) {
                self._clearHistory();
            }
        });

        // 加载数据
        this._historyRecords = null;
        this._historyPage = 0;
        this._refreshHistory();
    },

    _closeHistory: function() {
        if (this._historyEl && this._historyEl.parentNode) {
            this._historyEl.parentNode.removeChild(this._historyEl);
        }
        this._historyEl = null;
        this._historyBody = null;
        this._historyRecords = null;
        this._historyPage = 0;
    },

    _clearHistory: function() {
        var self = this;
        this._getDB().then(function(db) {
            var tx = db.transaction(['history', 'history-images'], 'readwrite');
            tx.objectStore('history').clear();
            tx.objectStore('history-images').clear();
            tx.oncomplete = function() {
                self._historyRecords = null;
                self._historyPage = 0;
                if (self._historyBody) {
                    self._historyBody.innerHTML = '<div class="aig-history-empty">暂无历史记录。<br>生成图片后自动保存到这里，删除节点不影响历史。</div>';
                }
                self._setStatus('历史已清空');
            };
        });
    },

    _refreshHistory: function() {
        var self = this;
        if (!this._historyBody) return;

        if (this._historyRecords) {
            self._renderHistoryPage();
            return;
        }

        this._historyBody.innerHTML = '<div class="aig-history-empty">⏳ 加载中...</div>';
        this._getDB().then(function(db) {
            var tx = db.transaction('history', 'readonly');
            var req = tx.objectStore('history').openCursor(null, 'prev');
            var records = [];
            req.onsuccess = function(e) {
                var cursor = e.target.result;
                if (cursor) {
                    var r = cursor.value;
                    r.id = cursor.key;
                    records.push(r);
                    cursor.continue();
                } else {
                    if (records.length === 0) {
                        self._historyBody.innerHTML = '<div class="aig-history-empty">暂无历史记录。<br>生成图片后自动保存到这里，删除节点不影响历史。</div>';
                        return;
                    }
                    records.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
                    self._historyRecords = records;
                    self._historyPage = 0;
                    self._renderHistoryPage();
                }
            };
        }).catch(function() {
            self._historyBody.innerHTML = '<div class="aig-history-empty">加载失败</div>';
        });
    },

    _renderHistoryPage: function() {
        var self = this;
        var records = this._historyRecords;
        if (!records || records.length === 0) return;
        var ps = this._HISTORY_PAGE_SIZE;
        var start = this._historyPage * ps;
        var end = Math.min(start + ps, records.length);

        if (start === 0) this._historyBody.innerHTML = '';

        for (var i = start; i < end; i++) {
            var r = records[i];
            var timeStr = r.timestamp ? new Date(r.timestamp).toLocaleString() : '';
            var promptPreview = (r.prompt || '').substring(0, 200);
            if ((r.prompt || '').length > 200) promptPreview += '...';
            var thumbs = r.thumbDataUrls && r.thumbDataUrls.length ? r.thumbDataUrls : (r.thumbDataUrl ? [r.thumbDataUrl] : (r.imageDataUrl ? [r.imageDataUrl] : ['']));
            var thumbsHtml = '';
            for (var ti = 0; ti < thumbs.length; ti++) {
                thumbsHtml += '<img class="aig-history-thumb" src="' + thumbs[ti] + '" data-hist-idx="' + i + '" data-img-idx="' + ti + '" onerror="this.style.display=\'none\'">';
            }
            var entry = document.createElement('div');
            entry.className = 'aig-history-entry';
            entry.innerHTML =
                '<div style="display:flex;flex-wrap:wrap;gap:5px;flex-shrink:0;width:100px;">' + thumbsHtml + '</div>' +
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
                '</div>';
            self._historyBody.appendChild(entry);
        }

        // 点击查看大图（从 history-images 取原图）
        self._historyBody.querySelectorAll('.aig-history-thumb').forEach(function(img) {
            img.addEventListener('click', function() {
                var idx = parseInt(this.getAttribute('data-hist-idx'));
                var imgIdx = parseInt(this.getAttribute('data-img-idx')) || 0;
                var rec = records[idx];
                if (rec && rec.id !== undefined) {
                    self._getDB().then(function(db) {
                        var tx = db.transaction('history-images', 'readonly');
                        var key = imgIdx === 0 ? rec.id : rec.id + '-' + imgIdx;
                        var rq = tx.objectStore('history-images').get(key);
                        rq.onsuccess = function() { if (rq.result) self._viewImage(rq.result); };
                    });
                }
            });
        });

        // 还原按钮
        self._historyBody.querySelectorAll('[data-action="createNode"]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var idx = parseInt(this.getAttribute('data-hist-idx'));
                self._createNodeFromHistory(records[idx]);
            });
        });

        // 删除按钮
        self._historyBody.querySelectorAll('[data-action="delete"]').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var idx = parseInt(this.getAttribute('data-hist-idx'));
                self._deleteHistoryEntry(records[idx]);
            });
        });

        // 加载更多按钮
        if (end < records.length) {
            var moreWrap = document.createElement('div');
            moreWrap.style.cssText = 'text-align:center;padding:12px;';
            var moreBtn = document.createElement('button');
            moreBtn.textContent = '加载更多 (' + (records.length - end) + ')';
            moreBtn.style.cssText = 'background:#0f3460;border:1px solid #1a5276;color:#fbbf24;padding:6px 20px;border-radius:6px;cursor:pointer;font-size:12px;';
            moreBtn.addEventListener('click', function() {
                self._historyPage++;
                self._renderHistoryPage();
            });
            moreWrap.appendChild(moreBtn);
            self._historyBody.appendChild(moreWrap);
        }
    },

    _createNodeFromHistory: function(record) {
        if (!record) return;
        var self = this;
        var numImages = record.numImages || 1;
        var useFullImages = function(fullDataUrls) {
            var node = self._addNode();
            if (node) {
                node.prompt = record.prompt || '';
                node.size = record.size || '2048x1152';
                node.mode = record.mode || 'auto';
                node.baseK = record.baseK || '1k';
                node.ratioW = record.ratioW || 1;
                node.ratioH = record.ratioH || 1;
                node.model = record.model || 'gpt-image-2';
                node.quality = record.quality || 'medium';
                node.format = record.format || 'png';
                node.dataUrl = fullDataUrls[0] || '';
                node.image = fullDataUrls[0] || '';
                node.dataUrls = fullDataUrls;
                node.images = fullDataUrls.filter(Boolean);
                self._refreshNode(node.id);
                self._autoSave();
                self._setStatus('✅ 已从历史还原节点 #' + node.id + ' (' + node.images.length + ' 张)');
            }
            if (self._historyEl) self._historyEl.style.zIndex = 10001;
        };
        var loadAll = function() {
            self._getDB().then(function(db) {
                var tx = db.transaction('history-images', 'readonly');
                var results = [], done = 0;
                for (var i = 0; i < numImages; i++) {
                    (function(ii) {
                        var key = ii === 0 ? record.id : record.id + '-' + ii;
                        var req = tx.objectStore('history-images').get(key);
                        req.onsuccess = function() { results[ii] = req.result || ''; done++; if (done >= numImages) useFullImages(results); };
                        req.onerror = function() { results[ii] = ''; done++; if (done >= numImages) useFullImages(results); };
                    })(i);
                }
            });
        };
        if (record.id !== undefined) {
            loadAll();
        } else {
            useFullImages([record.imageDataUrl || '']);
        }
    },

    _deleteHistoryEntry: function(record) {
        var self = this;
        if (!record) return;
        this._getDB().then(function(db) {
            var tx = db.transaction(['history', 'history-images'], 'readwrite');
            var histStore = tx.objectStore('history');
            var imgStore = tx.objectStore('history-images');
            if (record.id !== undefined) {
                histStore.delete(record.id);
                imgStore.delete(record.id);
            } else {
                var req = histStore.openCursor();
                req.onsuccess = function(e) {
                    var cursor = e.target.result;
                    if (cursor) {
                        var val = cursor.value;
                        if (val.timestamp === record.timestamp && val.prompt === record.prompt &&
                            (val.imageDataUrl === record.imageDataUrl || val.thumbDataUrl === record.thumbDataUrl)) {
                            cursor.delete();
                            imgStore.delete(cursor.key);
                        }
                        cursor.continue();
                    }
                };
            }
            tx.oncomplete = function() {
                self._historyRecords = null;
                self._refreshHistory();
                self._setStatus('已删除历史记录');
            };
        }).catch(function() {});
    },

    _exportHistory: function() {
        var self = this;
        this._getDB().then(function(db) {
            var histTx = db.transaction('history', 'readonly');
            var curReq = histTx.objectStore('history').openCursor();
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
                    // 收集每条记录的所有图片键
                    var needKeys = [];
                    for (var i = 0; i < fullRecords.length; i++) {
                        var r = fullRecords[i];
                        var n = (r.numImages && r.numImages > 1) ? r.numImages : 1;
                        r._imgCount = n;
                        for (var j = 0; j < n; j++) {
                            // 第1张无后缀（数字 key，与 _saveToHistory 一致），后续为 {id}-{idx}
                            var key = j === 0 ? r.id : r.id + '-' + j;
                            needKeys.push({ recIdx: i, imgIdx: j, key: key });
                        }
                    }
                    var loadImages = function(cb) {
                        if (needKeys.length === 0) { cb({}); return; }
                        var imgTx = db.transaction('history-images', 'readonly');
                        var imgStore = imgTx.objectStore('history-images');
                        var loaded = {}; // "recIdx-imgIdx" -> dataUrl
                        var done2 = 0;
                        var total = needKeys.length;
                        for (var ii = 0; ii < needKeys.length; ii++) {
                            (function(nk) {
                                var imgReq = imgStore.get(nk.key);
                                imgReq.onsuccess = function() {
                                    if (imgReq.result) loaded[nk.recIdx + '-' + nk.imgIdx] = imgReq.result;
                                    done2++;
                                    if (done2 >= total) cb(loaded);
                                };
                                imgReq.onerror = function() { done2++; if (done2 >= total) cb(loaded); };
                            })(needKeys[ii]);
                        }
                    };
                    loadImages(function(imgMap) {
                        var zip = new JSZip();
                        for (var i = 0; i < fullRecords.length; i++) {
                            var r = fullRecords[i];
                            var idx = String(i + 1).padStart(3, '0');
                            var base = 'history_' + idx;
                            var ts = r.timestamp ? new Date(r.timestamp).toLocaleString() : '-';
                            var prompt = (r.prompt || '').replace(/\n/g, ' ');
                            // 每条记录的所有图片
                            for (var j = 0; j < r._imgCount; j++) {
                                var dataUrl = imgMap[i + '-' + j] || (j === 0 ? (r.imageDataUrl || '') : '');
                                if (!dataUrl) continue;
                                // 从 data URL 推断扩展名，比 r.format 更可靠
                                var ext = 'png'; var mm = dataUrl.match(/^data:image\/(\w+)/);
                                if (mm) ext = mm[1] === 'jpeg' ? 'jpg' : mm[1];
                                var commaIdx = dataUrl.indexOf(',');
                                var raw = commaIdx > -1 ? dataUrl.slice(commaIdx + 1) : dataUrl;
                                var fBase = r._imgCount > 1 ? base + '_' + String(j + 1).padStart(2, '0') : base;
                                zip.file(fBase + '.' + ext, raw, { base64: true });
                            }
                            // 同名 .txt 提示词文件
                            var txtContent = 'Prompt: ' + prompt + '\n' +
                                'Model: ' + (r.model || '-') + '\n' +
                                'Size: ' + (r.size || '-') + '\n' +
                                'Quality: ' + (r.quality || '-') + '\n' +
                                '时间: ' + ts + '\n';
                            zip.file(base + '.txt', txtContent);
                        }
                        // JSON 元数据
                        var jsonMeta = fullRecords.map(function(r) {
                            var c = {};
                            for (var k in r) {
                                if (k !== 'imageDataUrl' && k !== '_imgCount') c[k] = r[k];
                            }
                            return c;
                        });
                        zip.file('history.json', JSON.stringify({ version: 2, records: jsonMeta }, null, 2));
                        zip.generateAsync({ type: 'blob' }).then(function(blob) {
                            var url = URL.createObjectURL(blob);
                            var a = document.createElement('a');
                            a.href = url;
                            a.download = 'ai-history-' + new Date().toISOString().slice(0, 10) + '.zip';
                            a.click();
                            URL.revokeObjectURL(url);
                            self._setStatus('已导出 ' + fullRecords.length + ' 条记录（ZIP）');
                        });
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
        self._getDB().then(function(db) {
            var tx = db.transaction(['history', 'history-images'], 'readwrite');
            var histStore = tx.objectStore('history');
            var imgStore = tx.objectStore('history-images');
            var count = 0, done = 0, total = records.length;
            for (var i = 0; i < total; i++) {
                (function(r) {
                    var id = r.id;
                    var fullDataUrl = r.imageDataUrl || '';
                    delete r.id;
                    delete r.imageDataUrl;
                    // 旧记录没有 thumbDataUrl，生成一个
                    if (!r.thumbDataUrl && fullDataUrl) {
                        var img = new Image();
                        img.onload = function() {
                            var scale = Math.min(200 / img.width, 200 / img.height, 1);
                            var c = document.createElement('canvas');
                            c.width = Math.round(img.width * scale);
                            c.height = Math.round(img.height * scale);
                            c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                            r.thumbDataUrl = c.toDataURL('image/jpeg', 0.7);
                            var addReq = histStore.add(r);
                            addReq.onsuccess = function() {
                                if (fullDataUrl) imgStore.put(fullDataUrl, addReq.result);
                                count++; done++; if (done >= total) finish();
                            };
                            addReq.onerror = function() { done++; if (done >= total) finish(); };
                        };
                        img.onerror = function() {
                            var addReq = histStore.add(r);
                            addReq.onsuccess = function() {
                                if (fullDataUrl) imgStore.put(fullDataUrl, addReq.result);
                                count++; done++; if (done >= total) finish();
                            };
                            addReq.onerror = function() { done++; if (done >= total) finish(); };
                        };
                        img.src = fullDataUrl;
                    } else {
                        var addReq = histStore.add(r);
                        addReq.onsuccess = function() {
                            if (fullDataUrl) imgStore.put(fullDataUrl, addReq.result);
                            count++; done++; if (done >= total) finish();
                        };
                        addReq.onerror = function() { done++; if (done >= total) finish(); };
                    }
                })(records[i]);
            }
            function finish() {
                self._historyRecords = null;
                self._refreshHistory();
                self._setStatus('已导入 ' + count + ' 条记录' + (count < total ? '（部分失败）' : ''));
            }
        });
    },

    _escapeHtml: function(str) {
        return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
                '<span class="aig-sl">API 地址</span>' +
                '<span class="aig-sc"><input type="text" id="aigSetBase" placeholder="https://api3.wlai.vip" value="' + this._escapeHtml(this._apiBase) + '"></span>' +
            '</div>' +
            '<div class="aig-settings-row">' +
                '<span class="aig-sl">API Key</span>' +
                '<span class="aig-sc"><input type="password" id="aigSetKey" placeholder="sk-..." value="' + this._escapeHtml(this._apiKey) + '"></span>' +
                '<span class="aig-sr"><a id="aigGetKeyLink" href="' + this._escapeHtml(this._apiBase || 'https://api3.wlai.vip') + '/register?aff=b1VJ" target="_blank">获取 →</a></span>' +
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
        // 地址改变时更新注册链接
        ov.querySelector('#aigSetBase').addEventListener('input', function() {
            var link = ov.querySelector('#aigGetKeyLink');
            var val = this.value.trim() || 'https://api3.wlai.vip';
            link.href = val + '/register?aff=b1VJ';
        });
    },

    _saveSettings: function() {
        if (!this._settingsEl) return;
        this._apiBase = this._settingsEl.querySelector('#aigSetBase').value.trim() || 'https://api3.wlai.vip';
        this._apiKey = this._settingsEl.querySelector('#aigSetKey').value.trim();
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
        if (nd && nd.image) this._viewImage(nd.image, id, (nd.images && nd.images.length) ? 0 : null);
    },

    _updateModalTransform: function() {
        var img = this._modalEl.querySelector('#aigModalImg');
        if (!img) return;
        var t = 'translate(' + (this._modalPanX || 0) + 'px,' + (this._modalPanY || 0) + 'px) scale(' + this._modalZoom + ')';
        img.style.transform = t;
        var zd = this._modalEl.querySelector('#aigModalZoom');
        if (zd) zd.textContent = Math.round(this._modalZoom * 100) + '%';
        img.style.cursor = this._modalZoom > 1 ? 'grab' : '';
    },

    _viewImage: function(url, nodeId, imgIdx) {
        var self = this;
        this._modalNodeId = (nodeId !== undefined ? nodeId : null);
        this._modalImgIdx = (imgIdx !== undefined ? imgIdx : 0);
        if (!this._modalCreated) {
            var m = document.createElement('div');
            m.className = 'aig-modal';
            m.innerHTML = '<img id="aigModalImg"><div class="aig-modal-zoom" id="aigModalZoom">100%</div>';
            m.addEventListener('click', function(e) {
                if (e.target === m || e.target.className === 'aig-modal-zoom') {
                    m.classList.remove('active');
                    self._modalZoom = 1;
                    self._modalPanX = 0;
                    self._modalPanY = 0;
                    self._modalNodeId = null;
                }
            });
            // Wheel zoom: zoom towards cursor position
            m.addEventListener('wheel', function(e) {
                e.preventDefault();
                if (!self._modalZoom) self._modalZoom = 1;
                if (self._modalPanX === undefined) self._modalPanX = 0;
                if (self._modalPanY === undefined) self._modalPanY = 0;
                var img = m.querySelector('#aigModalImg');
                if (!img) return;
                var factor = e.deltaY < 0 ? 1.1 : 0.9;
                var ns = Math.min(10, Math.max(0.1, self._modalZoom * factor));
                factor = ns / self._modalZoom;
                var rect = m.getBoundingClientRect();
                var cx = rect.left + rect.width / 2;
                var cy = rect.top + rect.height / 2;
                var mx = e.clientX - cx, my = e.clientY - cy;
                self._modalPanX = mx - (mx - self._modalPanX) * factor;
                self._modalPanY = my - (my - self._modalPanY) * factor;
                self._modalZoom = ns;
                self._updateModalTransform();
            }, { passive: false });
            // Drag pan
            var isDragging = false, dragStartX, dragStartY, startPanX, startPanY;
            m.addEventListener('mousedown', function(e) {
                if (e.target.id !== 'aigModalImg') return;
                if (self._modalZoom <= 1) return;
                e.preventDefault();
                isDragging = true;
                dragStartX = e.clientX; dragStartY = e.clientY;
                startPanX = self._modalPanX || 0; startPanY = self._modalPanY || 0;
                e.target.style.cursor = 'grabbing';
            });
            document.addEventListener('mousemove', function(e) {
                if (!isDragging || !self._modalCreated) return;
                self._modalPanX = startPanX + (e.clientX - dragStartX);
                self._modalPanY = startPanY + (e.clientY - dragStartY);
                self._updateModalTransform();
            });
            document.addEventListener('mouseup', function(e) {
                if (!isDragging) return;
                isDragging = false;
                var img = m.querySelector('#aigModalImg');
                if (img) img.style.cursor = self._modalZoom > 1 ? 'grab' : '';
            });
            // ESC 关闭 / 左右键切换
            document.addEventListener('keydown', function(e) {
                if (!self._modalCreated || !self._modalEl || !self._modalEl.classList.contains('active')) return;
                if (e.key === 'Escape') {
                    self._modalEl.classList.remove('active');
                    self._modalZoom = 1;
                    self._modalPanX = 0;
                    self._modalPanY = 0;
                    self._modalNodeId = null;
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    if (self._modalNodeId == null) return;
                    var nd = self._getNode(self._modalNodeId);
                    if (!nd || !nd.images || nd.images.length < 2) return;
                    var dir = e.key === 'ArrowRight' ? 1 : -1;
                    var len = nd.images.length;
                    var ni = (self._modalImgIdx + dir + len) % len;
                    var nu = nd.images[ni];
                    if (nu) {
                        self._modalImgIdx = ni;
                        self._modalZoom = 1;
                        self._modalPanX = 0;
                        self._modalPanY = 0;
                        var img = self._modalEl.querySelector('#aigModalImg');
                        if (img) { img.src = nu; img.style.transform = ''; img.style.cursor = ''; }
                        var zd = self._modalEl.querySelector('#aigModalZoom');
                        if (zd) zd.textContent = '100%';
                    }
                }
            });
            document.body.appendChild(m);
            this._modalCreated = true; this._modalEl = m;
        }
        this._modalZoom = 1;
        this._modalPanX = 0;
        this._modalPanY = 0;
        var img = this._modalEl.querySelector('#aigModalImg');
        img.src = url;
        img.style.transform = '';
        img.style.cursor = '';
        var zd = this._modalEl.querySelector('#aigModalZoom');
        if (zd) zd.textContent = '100%';
        this._modalEl.classList.add('active');
    },

    // ========== 工作区保存/加载（IndexedDB） ==========

    _getDB: function() {
        return new Promise(function(res, rej) {
            var r = indexedDB.open('AIGWorkspace', 4);
            r.onupgradeneeded = function(e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
                if (!db.objectStoreNames.contains('images')) db.createObjectStore('images');
                if (!db.objectStoreNames.contains('history')) db.createObjectStore('history', { autoIncrement: true });
                if (!db.objectStoreNames.contains('history-images')) db.createObjectStore('history-images');
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
                id: n.id, type: n.type || 'unified', x: n.x, y: n.y, prompt: n.prompt, size: n.size,
                mode: n.mode || 'auto', baseK: n.baseK || '1k', ratioW: n.ratioW || 1, ratioH: n.ratioH || 1,
                model: n.model, quality: n.quality, format: n.format || 'png', numImages: n.numImages,
                refName: n.refName, hasRef: !!n.refImage, hasImg: !!n.dataUrl, imgCount: n.images ? n.images.length : 0,
                refCount: n.refImages ? n.refImages.length : (n.refImage ? 1 : 0),
                outpaintScale: n.outpaintScale
            });
        }
        meta.lastParams = this._lastParams || { mode: 'auto', baseK: '1k', ratioW: 1, ratioH: 1 };
        meta.apiKey = this._apiKey || '';
        meta.apiBase = this._apiBase || 'https://api3.wlai.vip';
        meta.defaultModel = this._defaultModel || 'gpt-image-2';
        this._getDB().then(function(db) {
            var tx1 = db.transaction('meta', 'readwrite');
            tx1.objectStore('meta').put(meta, 'workspace');
            var tx2 = db.transaction('images', 'readwrite');
            for (var j = 0; j < self._nodes.length; j++) {
                var nd = self._nodes[j];
                if (nd.dataUrls && nd.dataUrls.length > 1) {
                    for (var di = 0; di < nd.dataUrls.length; di++) {
                        tx2.objectStore('images').put(nd.dataUrls[di], 'img-' + nd.id + '-' + di);
                    }
                } else if (nd.dataUrls && nd.dataUrls.length === 1) {
                    tx2.objectStore('images').put(nd.dataUrls[0], 'img-' + nd.id);
                } else if (nd.dataUrl) {
                    tx2.objectStore('images').put(nd.dataUrl, 'img-' + nd.id);
                }
                if (nd.refImages && nd.refImages.length) {
                    for (var ri = 0; ri < nd.refImages.length; ri++) {
                        var r = nd.refImages[ri];
                        if (r && r.dataURL && r.dataURL.indexOf('data:') === 0) {
                            tx2.objectStore('images').put(r.dataURL, 'ref-' + nd.id + '-' + ri);
                        }
                    }
                } else if (nd.refImage && nd.refImage.indexOf('data:') === 0) {
                    tx2.objectStore('images').put(nd.refImage, 'ref-' + nd.id);
                }
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
                        // 兼容旧记录：无 baseK 时从旧 size 推断
                        var oldSize = n.size || '2048x1152';
                        var md = n.mode, bk = n.baseK, rw = n.ratioW, rh = n.ratioH;
                        if (!md) {
                            // 旧记录兼容：有 baseK 说明是 manual，否则 auto
                            md = (bk && bk !== 'auto') ? 'manual' : 'auto';
                            if (!bk || bk === 'auto') {
                                var inf = self._inferFromOldSize(oldSize);
                                if (inf) { bk = inf.baseK; rw = inf.ratioW; rh = inf.ratioH; md = 'manual'; }
                                else { bk = '1k'; rw = 1; rh = 1; }
                            }
                        }
                        self._nodes.push({ 
                            id: n.id, type: n.type, x: n.x, y: n.y, prompt: n.prompt || '',
                            size: oldSize,
                            mode: md, baseK: bk || '1k', ratioW: rw || 1, ratioH: rh || 1,
                            model: n.model || 'gpt-image-2', quality: qLoad || 'medium', format: n.format || 'png', numImages: n.numImages || 1,
                            refImage: null, refName: n.refName || '', image: null, dataUrl: null, dataUrls: null, images: [], loading: false,
                            outpaintScale: n.outpaintScale || 1
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
                    if (meta.apiBase) self._apiBase = meta.apiBase;
                    if (meta.defaultModel) self._defaultModel = meta.defaultModel;
                    if (meta.lastParams) self._lastParams = meta.lastParams;
                    self._loadImagesForNodes(meta.nodes).then(function() {
                        self._getDB().then(function(db2) {
                            var tx2 = db2.transaction('images', 'readonly');
                            var pending = self._nodes.length;
                            if (pending === 0) {
                                for (var k = 0; k < self._nodes.length; k++) { if (self._viewport) self._createNodeEl(self._nodes[k]); }
                                self._setStatus('布局已加载'); resolve(); return;
                            }
                            var refLoadTotal = 0, refLoadDone = 0;
                            function onRefsReady() {
                                for (var k = 0; k < self._nodes.length; k++) {
                                    var nd = self._nodes[k];
                                    if (nd.refImages && nd.refImages.length) {
                                        nd.refImage = nd.refImages[0].dataURL;
                                    }
                                    if (self._viewport) self._createNodeEl(self._nodes[k]);
                                }
                                self._setStatus('工作区已加载'); resolve();
                            }
                            for (var k = 0; k < self._nodes.length; k++) {
                                (function(idx) {
                                    var nd = self._nodes[idx];
                                    var metaNode = meta.nodes[idx];
                                    var rc = metaNode && metaNode.refCount !== undefined ? metaNode.refCount : (nd.refName ? 1 : 0);
                                    if (rc === 0) { nd.refImages = []; nd.refImage = null; return; }
                                    if (metaNode && metaNode.refCount) {
                                        nd.refImages = [];
                                        for (var ri = 0; ri < rc; ri++) {
                                            refLoadTotal++;
                                            (function(rr) {
                                                var rq = tx2.objectStore('images').get('ref-' + nd.id + '-' + rr);
                                                rq.onsuccess = function() {
                                                    if (rq.result) nd.refImages.push({ dataURL: rq.result, name: '' });
                                                    refLoadDone++;
                                                    if (refLoadDone >= refLoadTotal) onRefsReady();
                                                };
                                            })(ri);
                                        }
                                    } else {
                                        refLoadTotal++;
                                        var rq = tx2.objectStore('images').get('ref-' + nd.id);
                                        rq.onsuccess = function() {
                                            if (rq.result) {
                                                nd.refImage = rq.result;
                                                nd.refImages = [{ dataURL: rq.result, name: nd.refName || '' }];
                                            }
                                            refLoadDone++;
                                            if (refLoadDone >= refLoadTotal) onRefsReady();
                                        };
                                    }
                                })(k);
                            }
                            if (refLoadTotal === 0) onRefsReady();
                        });
                    });
                };
                req.onerror = function() { resolve(); };
            }).catch(function() { resolve(); });
        });
    },

    _loadImagesForNodes: function(metaNodes) {
        var self = this;
        return this._getDB().then(function(db) {
            return new Promise(function(resolve) {
                var tx = db.transaction('images', 'readonly');
                var totalReqs = 0;
                for (var i = 0; i < self._nodes.length; i++) {
                    var nn = metaNodes ? metaNodes[i] : null;
                    totalReqs += nn && nn.imgCount > 1 ? nn.imgCount : 1;
                }
                if (totalReqs === 0) { resolve(); return; }
                var loaded = 0;
                for (var i = 0; i < self._nodes.length; i++) {
                    (function(idx) {
                        var nd = self._nodes[idx];
                        var nn = metaNodes ? metaNodes[idx] : null;
                        var cnt = nn && nn.imgCount > 0 ? nn.imgCount : 1;
                        if (cnt > 1) {
                            nd.dataUrls = [];
                            nd.images = [];
                            for (var j = 0; j < cnt; j++) {
                                (function(jj) {
                                    var req = tx.objectStore('images').get('img-' + nd.id + '-' + jj);
                                    req.onsuccess = function() {
                                        var d = req.result;
                                        if (d) {
                                            nd.dataUrls[jj] = d;
                                            nd.images[jj] = d;
                                            if (jj === 0) { nd.dataUrl = d; nd.image = d; }
                                        }
                                        loaded++;
                                        if (loaded >= totalReqs) resolve();
                                    };
                                    req.onerror = function() { loaded++; if (loaded >= totalReqs) resolve(); };
                                })(j);
                            }
                        } else {
                            var req = tx.objectStore('images').get('img-' + nd.id);
                            req.onsuccess = function() {
                                var d = req.result;
                                if (d) { nd.dataUrl = d; nd.image = d; nd.images = [d]; }
                                loaded++;
                                if (loaded >= totalReqs) resolve();
                            };
                            req.onerror = function() { loaded++; if (loaded >= totalReqs) resolve(); };
                        }
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
        var urls = nd.dataUrls && nd.dataUrls.length ? nd.dataUrls : (nd.images && nd.images.length ? nd.images : (nd.dataUrl ? [nd.dataUrl] : (nd.image ? [nd.image] : [])));
        if (!urls.length) { this._setStatus('没有图片可导出'); return; }
        var self = this;
        if (urls.length === 1) {
            var u = urls[0];
            if (u.indexOf('data:') === 0) {
                var a = document.createElement('a');
                a.href = u; a.download = 'ai_image_' + nd.id + '.png'; a.click();
                self._setStatus('已导出图片');
            } else if (u.indexOf('blob:') === 0) {
                var a = document.createElement('a');
                a.href = u; a.download = 'ai_image_' + nd.id + '.png'; a.click();
                self._setStatus('已导出图片');
            } else {
                fetch(u, { mode: 'cors' }).then(function(r) { return r.blob(); }).then(function(b) {
                    var a = document.createElement('a');
                    a.href = URL.createObjectURL(b); a.download = 'ai_image_' + nd.id + '.png'; a.click();
                    URL.revokeObjectURL(a.href); self._setStatus('已导出图片');
                }).catch(function() {
                    var a = document.createElement('a');
                    a.href = u; a.download = 'ai_image_' + nd.id + '.png'; a.target = '_blank'; a.click();
                    self._setStatus('图片已在新标签页打开，可右键保存');
                });
            }
        } else {
            // 多图：打包 ZIP
            if (typeof JSZip === 'undefined') { self._setStatus('缺少 JSZip 库，无法批量导出'); return; }
            var zip = new JSZip();
            var done = 0;
            urls.forEach(function(u, idx) {
                var base = 'node' + nd.id + '_' + String(idx + 1).padStart(2, '0');
                if (u.indexOf('data:') === 0) {
                    var ext = 'png'; var mm = u.match(/^data:image\/(\w+)/);
                    if (mm) ext = mm[1] === 'jpeg' ? 'jpg' : mm[1];
                    var comma = u.indexOf(',');
                    zip.file(base + '.' + ext, comma > -1 ? u.slice(comma + 1) : u, { base64: true });
                    done++; if (done >= urls.length) self._downloadZip(zip, 'ai_node' + nd.id);
                } else {
                    fetch(u).then(function(r) { return r.blob(); }).then(function(b) {
                        var r = new FileReader();
                        r.onload = function(e) {
                            var du = e.target.result;
                            var ext = 'png'; var mm = du.match(/^data:image\/(\w+)/);
                            if (mm) ext = mm[1] === 'jpeg' ? 'jpg' : mm[1];
                            var comma = du.indexOf(',');
                            zip.file(base + '.' + ext, comma > -1 ? du.slice(comma + 1) : du, { base64: true });
                            done++; if (done >= urls.length) self._downloadZip(zip, 'ai_node' + nd.id);
                        }; r.readAsDataURL(b);
                    }).catch(function() { done++; if (done >= urls.length) self._downloadZip(zip, 'ai_node' + nd.id); });
                }
            });
        }
    },

    _downloadZip: function(zip, name) {
        var self = this;
        var blob;
        zip.generateAsync({ type: 'blob' }).then(function(b) {
            blob = b;
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url; a.download = name + '-' + new Date().toISOString().slice(0, 10) + '.zip'; a.click();
            URL.revokeObjectURL(url);
        }).then(function() {
            self._setStatus('已导出 ' + name + '.zip');
        });
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
        var node = this._addNode();
        if (node) {
            node.prompt = text;
            var nel = this._viewport.querySelector('[data-id="' + node.id + '"]');
            if (nel) { var ta = nel.querySelector('.aig-node-prompt'); if (ta) ta.value = text; }
            this._setStatus('已创建生图节点 #' + node.id);
        }
    },

    // ========== 工具 ==========

    _setStatus: function(msg) {
        var el = this._overlay ? this._overlay.querySelector('#aigStatus') : null;
        if (el) el.textContent = msg;
    },

    _setNodeStatus: function(id, msg) {
        var nd = this._getNode(id);
        if (nd) nd._status = msg;
        var nodeEl = this._viewport ? this._viewport.querySelector('[data-id="' + id + '"].aig-node') : null;
        if (nodeEl) {
            var st = nodeEl.querySelector('.aig-node-status');
            if (st) st.textContent = msg;
        }
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
        if (this._ratioPanelEl && this._ratioPanelEl.parentNode) this._ratioPanelEl.parentNode.removeChild(this._ratioPanelEl);
        this._modalCreated = false; this._modalEl = null; this._overlay = null;
        this._historyEl = null; this._historyBody = null;
        this._settingsEl = null; this._ratioPanelEl = null;
    }
};
