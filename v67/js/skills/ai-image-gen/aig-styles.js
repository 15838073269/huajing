/**
 * AI 生图 - 专属样式
 * 单窗口表单模式（替代原无限画布+节点系统）
 */

(function() {
    var s = document.createElement('style');
    s.textContent =
        /* AIG 主题色覆盖：黄色强调 */
        '.aig-overlay{--cos-accent:#fbbf24;--cos-accent-soft:rgba(251,191,36,0.1);}' +
        '.aig-overlay .cos-pwin-hdr-title{color:var(--cos-accent);}' +

        /* ---- 状态文字 ---- */
        '.aig-h-status{font-size:11px;color:var(--cos-text-dim);margin:0 8px;flex:1;text-align:center;}' +

        /* ---- 获取 Key 链接按钮 ---- */
        '.aig-key-get-btn{display:inline-flex;align-items:center;gap:3px;padding:4px 10px;border-radius:6px;background:rgba(56,189,248,0.1);border:1px solid rgba(56,189,248,0.2);color:#38bdf8;text-decoration:none;font-size:12px;font-weight:500;cursor:pointer;transition:all 0.15s;}' +
        '.aig-key-get-btn:hover{background:rgba(56,189,248,0.2);}' +

        /* ---- Key 管理小按钮 ---- */
        '.aig-key-btn{background:none;border:none;color:var(--cos-text-soft);cursor:pointer;font-size:13px;padding:2px 4px;border-radius:4px;transition:all 0.15s;line-height:1;flex-shrink:0;}' +
        '.aig-key-btn:hover{background:rgba(255,255,255,0.08);color:var(--cos-text);}' +
        '.aig-key-del:hover{background:rgba(220,80,60,0.2);color:#e87060;}' +

        /* ---- 表单主体 ---- */
        '.aig-form-body{padding:10px 14px;display:flex;flex-direction:column;gap:8px;}' +

        /* ---- 参考图区域 ---- */
        '.aig-ref-section{border:1px dashed var(--cos-border-warm);border-radius:6px;padding:6px;}' +
        '.aig-ref-grid{display:flex;flex-wrap:wrap;gap:6px;min-height:30px;}' +
        '.aig-ref-item{position:relative;display:inline-block;}' +
        '.aig-node-ref{width:60px;height:60px;object-fit:cover;border-radius:4px;cursor:pointer;display:block;border:1px solid var(--cos-border);}' +
        '.aig-ref-del-btn{position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:rgba(220,80,60,0.85);color:#fff;border:none;font-size:12px;line-height:20px;text-align:center;cursor:pointer;opacity:0.6;}' +
        '.aig-ref-count{font-size:10px;color:var(--cos-text-dim);margin-top:0;}' +
        '.aig-ref-bar{display:flex;align-items:center;justify-content:space-between;gap:6px;margin-top:6px;}' +
        '.aig-ref-bar .aig-ref-count{flex:1;}' +
        '.aig-lock-btn{flex-shrink:0;background:rgba(10,18,40,0.5);border:1px solid var(--cos-border);border-radius:4px;color:var(--cos-text-soft);font-size:10px;padding:2px 6px;cursor:pointer;transition:all 0.12s;font-family:inherit;white-space:nowrap;}' +
        '.aig-lock-btn:hover{border-color:var(--cos-accent);color:var(--cos-text);}' +
        '.aig-lock-btn.locked{background:rgba(251,191,36,0.15);border-color:var(--cos-accent);color:var(--cos-accent);font-weight:600;}' +

        /* ---- 提示词区域 ---- */
        '.aig-prompt-row{display:flex;gap:4px;}' +
        '.aig-prompt-row .aig-prompt-btn{flex:0 0 25%;max-width:25%;height:44px;font-size:9px;}' +
        '.aig-prompt-row .aig-node-prompt{flex:1;height:60px;min-height:60px;}' +
        '.aig-node-prompt{min-height:60px;background:rgba(10,18,40,0.5);border:1px solid var(--cos-border);color:var(--cos-text);padding:8px;border-radius:6px;font-size:12px;resize:vertical;font-family:inherit;outline:none;box-sizing:border-box;transition:border-color 0.12s;}' +
        '.aig-node-prompt:focus{border-color:var(--cos-accent);}' +

        /* ---- 参数区域 ---- */
        '.aig-param-box{border:1px dashed var(--cos-border-warm);border-radius:6px;padding:6px;display:flex;flex-direction:column;gap:6px;}' +
        '.aig-size-row{display:flex;gap:4px;}' +
        '.aig-size-row .aig-size-btn{flex:1;}' +
        '.aig-mode-row{display:flex;gap:4px;}' +
        '.aig-mode-row .aig-mode-btn{flex:1;}' +
        '.aig-node-bottom{display:flex;gap:4px;}' +
        '.aig-node-bottom select,.aig-node-bottom input[type="number"]{flex:1;height:22px;background:rgba(10,18,40,0.5);border:1px solid var(--cos-border);border-radius:4px;padding:0 2px;color:var(--cos-text-soft);font-size:10px;outline:none;cursor:pointer;text-align:center;font-family:inherit;}' +
        '.aig-node-bottom input[type="number"]{width:0;}' +
        '.aig-node-bottom .aig-gen-btn{flex:1.5;height:22px;padding:0 4px;background:var(--cos-red);border:none;border-radius:4px;color:#fff;font-size:10px;font-weight:700;cursor:pointer;transition:opacity 0.15s;}' +
        '.aig-node-bottom .aig-gen-btn:hover{background:#c0392b;}' +
        '.aig-node-bottom .aig-gen-btn:disabled{opacity:0.4;cursor:not-allowed;}' +

        /* ---- 尺寸/模式选择按钮 ---- */
        '.aig-size-btn{padding:3px 2px;background:rgba(10,18,40,0.5);border:1px solid var(--cos-border);border-radius:4px;color:var(--cos-text-soft);font-size:10px;cursor:pointer;transition:all 0.1s;font-family:inherit;text-align:center;height:22px;line-height:14px;}' +
        '.aig-size-btn:hover{border-color:var(--cos-accent);color:var(--cos-text);background:rgba(26,39,68,0.5);}' +
        '.aig-size-btn.active{background:var(--cos-accent);color:#1a1a2e;border-color:var(--cos-accent);font-weight:600;}' +
        '.aig-mode-btn{padding:3px 2px;border:1px solid var(--cos-border);border-radius:4px;font-size:10px;cursor:pointer;transition:all 0.1s;font-family:inherit;text-align:center;background:rgba(10,18,40,0.5);color:var(--cos-text-soft);height:22px;line-height:14px;}' +
        '.aig-mode-btn:hover{border-color:var(--cos-accent);color:var(--cos-text);background:rgba(26,39,68,0.5);}' +
        '.aig-mode-btn.active{background:var(--cos-accent);color:#1a1a2e;border-color:var(--cos-accent);font-weight:600;}' +
        '.aig-node-bottom select:hover,.aig-node-bottom input:hover{border-color:var(--cos-accent);background:rgba(26,39,68,0.5);}' +

        /* ---- 模板按钮 ---- */
        '.aig-btn-word{background:var(--cos-accent);border:none;border-radius:4px;color:#1a1a2e;font-weight:700;cursor:pointer;}' +
        '.aig-prompt-btn:hover{border-color:var(--cos-accent);color:var(--cos-text);background:rgba(26,39,68,0.5);}' +
        '.aig-btn-word:hover{background:#e6a800;}' +

        /* ---- 画布占位图计时器覆层 ---- */
        '.aig-timer-overlay{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(10,18,40,0.75);border-radius:6px;pointer-events:none;z-index:2;}' +
        '.aig-timer-overlay .aig-timer-text{text-align:center;}' +
        '.aig-timer-overlay .aig-timer-time{font-size:14px;color:#fbbf24;font-weight:bold;}' +
        '.aig-timer-overlay .aig-timer-label{font-size:10px;color:#94a3b8;margin-top:4px;}' +

        /* ---- 比例面板网格 ---- */
        '.aig-rp-body{padding:8px;overflow:auto;max-height:340px;}' +
        '.aig-rp-grid{display:grid;grid-template-columns:20px repeat(8,1fr);gap:2px;font-size:10px;}' +
        '.aig-rp-grid .rp-h{text-align:center;padding:4px 2px;color:var(--cos-text-dim);font-weight:500;font-size:9px;}' +
        '.aig-rp-grid .rp-v{text-align:right;padding:4px 4px 4px 0;color:var(--cos-text-dim);font-weight:500;font-size:9px;}' +
        '.aig-rp-grid .rp-cell{text-align:center;padding:5px 2px;background:rgba(10,18,40,0.5);border:1px solid var(--cos-border);border-radius:4px;cursor:pointer;color:var(--cos-text-soft);transition:all 0.1s;font-size:10px;}' +
        '.aig-rp-grid .rp-cell:hover{border-color:var(--cos-accent);color:var(--cos-text);background:var(--cos-surface-warm);}' +
        '.aig-rp-grid .rp-cell.active{background:var(--cos-accent);color:#1a1a2e;border-color:var(--cos-accent);font-weight:600;}' +
        '.aig-rp-grid .rp-cell.disabled{opacity:0.25;cursor:not-allowed;}' +
        '.aig-rp-grid .rp-cell.disabled:hover{border-color:var(--cos-border);color:var(--cos-text-soft);background:rgba(10,18,40,0.5);}' +
        '.aig-rp-foot{display:flex;align-items:center;gap:8px;padding:6px 10px;font-size:10px;color:var(--cos-text-soft);}' +
        '.aig-rp-foot .rp-cur{color:var(--cos-text);font-weight:600;}' +

        /* ---- 比例面板：分辨率基准行 ---- */
        '.aig-rp-base{display:flex;align-items:center;gap:6px;margin:4px 8px 0;padding:4px 6px;border:1px solid var(--cos-border);border-radius:6px;background:rgba(10,18,40,0.4);}' +
        '.aig-rp-base-l{font-size:11px;color:var(--cos-text-dim);font-weight:500;flex-shrink:0;}' +
        '.aig-rp-base .aig-size-btn{flex:1;}' +

        /* ---- 比例面板：尺寸规则警告 ---- */
        '.aig-rp-warn{color:#e87060;font-weight:600;margin-left:4px;}' +

        /* ---- 图片查看器 ---- */
        '.aig-modal.cos-pmodal-overlay{background:rgba(0,0,0,0.9);z-index:99999;}' +
        '.aig-modal img{max-width:92vw;max-height:92vh;border-radius:8px;transition:transform 0.1s ease;transform-origin:center center;cursor:zoom-in;user-select:none;-webkit-user-drag:none;}' +
        '.aig-modal .aig-modal-zoom{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.55);color:var(--cos-text);padding:4px 14px;border-radius:6px;font-size:13px;z-index:100000;pointer-events:none;font-family:var(--cos-font);}' +

        /* ---- 历史记录条目 ---- */
        '.aig-history-entry{display:flex;gap:12px;padding:10px;border:1px solid var(--cos-border);border-radius:8px;margin-bottom:8px;background:var(--cos-surface-warm);transition:border-color 0.15s;}' +
        '.aig-history-entry:hover{border-color:var(--cos-accent);}' +
        '.aig-history-thumb{width:100px;height:100px;object-fit:cover;border-radius:6px;cursor:pointer;flex-shrink:0;}' +
        '.aig-history-thumbs{display:flex;flex-wrap:wrap;gap:5px;flex-shrink:0;width:100px;}' +
        '.aig-history-info{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px;}' +
        '.aig-history-prompt{font-size:12px;color:#c8d6e5;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;word-break:break-all;}' +
        '.aig-history-meta{font-size:10px;color:var(--cos-text-dim);display:flex;flex-wrap:wrap;gap:6px;}' +
        '.aig-history-meta span{background:rgba(10,18,40,0.9);padding:1px 6px;border-radius:3px;}' +
        '.aig-history-actions{display:flex;align-items:flex-start;gap:4px;flex-shrink:0;}' +
        '.aig-history-actions button{background:rgba(10,18,40,0.9);border:1px solid rgba(26,82,118,0.5);color:var(--cos-text-soft);padding:4px 8px;border-radius:5px;cursor:pointer;font-size:10px;transition:all 0.15s;white-space:nowrap;}' +
        '.aig-history-actions button:hover{background:rgba(26,82,118,0.8);color:var(--cos-text);}' +
        '.aig-history-actions .aig-history-btn-gen{color:var(--cos-accent);border-color:rgba(78,204,163,0.3);}' +
        '.aig-history-actions .aig-history-btn-gen:hover{background:rgba(78,204,163,0.15);}' +
        '.aig-history-actions .aig-history-btn-del{color:#e87060;border-color:rgba(220,80,60,0.3);}' +
        '.aig-history-actions .aig-history-btn-del:hover{background:rgba(220,80,60,0.15);}' +

        /* ---- 设置面板行布局 ---- */
        '.aig-settings-body{padding:16px;display:flex;flex-direction:column;gap:12px;}' +
        '.aig-settings-divider{border-top:1px solid var(--cos-border);margin:10px 0;padding-top:10px;color:var(--cos-text-soft);font-size:12px;font-weight:600;}' +
        '.aig-settings-actions{display:flex;gap:8px;padding:12px 16px;justify-content:flex-end;}' +
        '.aig-settings-row{display:flex;flex-direction:row;align-items:center;gap:8px;}' +
        '.aig-settings-row .aig-sl{width:100px;font-size:12px;color:var(--cos-text-soft);font-weight:500;flex-shrink:0;}' +
        '.aig-settings-row .aig-sc{flex:1;}' +
        '.aig-settings-row .aig-sc input[type="text"],.aig-settings-row .aig-sc input[type="password"],.aig-settings-row .aig-sc select{width:100%;background:rgba(10,18,40,0.5);border:1px solid var(--cos-border);color:var(--cos-text);padding:7px 10px;border-radius:6px;font-size:13px;outline:none;font-family:inherit;box-sizing:border-box;transition:border-color 0.12s;}' +
        '.aig-settings-row .aig-sc input:focus,.aig-settings-row .aig-sc select:focus{border-color:var(--cos-accent);}' +
        '.aig-settings-row .aig-sc input::placeholder{color:var(--cos-text-dim);}' +
        '.aig-settings-row .aig-sr{width:80px;text-align:right;flex-shrink:0;}' +
        '.aig-settings-row .aig-sr a{color:#38bdf8;font-size:12px;text-decoration:none;}' +
        '.aig-settings-row .aig-sr a:hover{text-decoration:underline;}';
    document.head.appendChild(s);
})();
