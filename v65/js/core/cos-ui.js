/**
 * CosUI — 统一 UI 组件库
 * 所有组件返回 DOM 元素，遵循深色主题风格
 * 兼容 ES5，无模板字符串
 */
var CosUI = (function() {

  // ========================================
  //  内部工具
  // ========================================

  var _styleInjected = false;
  function injectBaseStyle() {
    if (_styleInjected) return;
    _styleInjected = true;
    var s = document.createElement('style');
    s.textContent =
      '.cos-ui-window{position:fixed;z-index:9999;display:flex;flex-direction:column;' +
      'background:rgba(15,25,50,0.95);color:#e8edf5;border-radius:12px;' +
      'border:1px solid rgba(100,160,255,0.15);box-shadow:0 8px 40px rgba(0,0,0,.6);' +
      'overflow:hidden;user-select:none;min-width:320px;min-height:200px;}' +
      '.cos-ui-hdr{display:flex;align-items:center;justify-content:space-between;' +
      'padding:8px 14px;background:rgba(20,35,70,0.8);border-bottom:1px solid rgba(100,160,255,0.1);' +
      'cursor:move;user-select:none;flex-shrink:0;}' +
      '.cos-ui-hdr-title{font-weight:600;color:#38bdf8;font-size:14px;}' +
      '.cos-ui-body{flex:1;overflow:auto;padding:12px 14px;min-height:0;}' +
      '.cos-ui-btn{display:inline-flex;align-items:center;justify-content:center;gap:4px;' +
      'padding:6px 12px;border:none;border-radius:6px;cursor:pointer;font-size:12px;' +
      'transition:all 0.12s;}' +
      '.cos-ui-btn:active{transform:scale(0.94);}' +
      '.cos-ui-btn-close{background:rgba(220,80,60,.2);border:1px solid rgba(220,80,60,.3);' +
      'color:#e87060;padding:4px 12px;}' +
      '.cos-ui-btn-close:hover{background:rgba(220,80,60,.4);}' +
      '.cos-ui-btn-primary{background:#38bdf8;color:#fff;}' +
      '.cos-ui-btn-primary:hover{background:#0ea5e9;}' +
      '.cos-ui-btn-secondary{background:rgba(255,255,255,.08);color:#e8edf5;' +
      'border:1px solid rgba(100,160,255,0.15);}' +
      '.cos-ui-btn-secondary:hover{background:rgba(255,255,255,.12);}' +
      '.cos-ui-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}' +
      '.cos-ui-col{display:flex;flex-direction:column;gap:8px;}' +
      '.cos-ui-label{font-size:11px;color:#94a3b8;}' +
      '.cos-ui-input{background:rgba(20,30,60,0.5);border:1px solid rgba(100,160,255,0.12);' +
      'color:#e8edf5;border-radius:6px;padding:5px 8px;font-size:12px;outline:none;}' +
      '.cos-ui-input:focus{border-color:rgba(56,189,248,0.4);}' +
      '.cos-ui-section{margin-bottom:10px;padding:10px;border:1px dashed rgba(100,160,255,0.15);' +
      'border-radius:8px;}' +
      '.cos-ui-section-title{font-size:10px;text-transform:uppercase;letter-spacing:1px;' +
      'color:#94a3b8;margin-bottom:6px;}' +
      '.cos-ui-cloud-export{font-size:10px;padding:3px 8px;border-radius:4px;' +
      'border:1px solid rgba(56,189,248,0.25);background:rgba(56,189,248,0.08);' +
      'color:#38bdf8;cursor:pointer;}' +
      '.cos-ui-cloud-import{font-size:10px;padding:3px 8px;border-radius:4px;' +
      'border:1px solid rgba(251,191,36,0.25);background:rgba(251,191,36,0.08);' +
      'color:#fbbf24;cursor:pointer;}' +
      '::-webkit-scrollbar{width:5px;}' +
      '::-webkit-scrollbar-track{background:transparent;}' +
      '::-webkit-scrollbar-thumb{background:rgba(56,189,248,0.2);border-radius:3px;}';
    document.head.appendChild(s);
  }

  // ========================================
  //  Window — 标准浮动窗口
  // ========================================
  var windowModule = {

    /**
     * 创建可拖拽可缩放的浮动窗口
     * @param {Object} opts
     *   @param {string} opts.title - 标题
     *   @param {string|HTMLElement} opts.body - HTML 字符串或 DOM 元素
     *   @param {number} [opts.width] - 初始宽度（默认 500）
     *   @param {number} [opts.height] - 初始高度（默认 400）
     *   @param {boolean} [opts.resizable] - 是否可缩放（默认 true）
     *   @param {string} [opts.storeKey] - localStorage 存储键名
     *   @param {string} [opts.skillId] - data-skill-id 值
     *   @param {Function} [opts.onClose] - 关闭回调
     * @returns {{ overlay: HTMLElement, bodyEl: HTMLElement, close: Function }}
     */
    create: function(opts) {
      injectBaseStyle();

      var title = opts.title || '窗口';
      var bodyContent = opts.body || '';
      var width = opts.width || 500;
      var height = opts.height || 400;
      var resizable = opts.resizable !== false;
      var storeKey = opts.storeKey || 'cos-ui-window-' + Date.now();
      var skillId = opts.skillId || '';
      var onClose = opts.onClose || null;

      var ov = document.createElement('div');
      ov.className = 'cos-ui-window';
      if (skillId) ov.setAttribute('data-skill-id', skillId);

      var topZ = (window.__cos_topZ || 10000) + 1;
      window.__cos_topZ = topZ;
      ov.style.zIndex = topZ;

      // 恢复保存的尺寸/位置
      var savedW = width, savedH = height, savedL = null, savedT = null;
      try {
        var saved = JSON.parse(localStorage.getItem(storeKey));
        if (saved) {
          var sw = window.innerWidth, sh = window.innerHeight;
          savedW = Math.min(saved.w || width, sw - 20);
          savedH = Math.min(saved.h || height, sh - 20);
          savedL = Math.max(0, Math.min(saved.l, sw - savedW));
          savedT = Math.max(0, Math.min(saved.t, sh - savedH));
        }
      } catch(e) {}

      var left = savedL !== null ? savedL : Math.max(20, (window.innerWidth - savedW) / 2);
      var top = savedT !== null ? savedT : Math.max(20, (window.innerHeight - savedH) / 2);
      ov.style.width = savedW + 'px';
      ov.style.height = savedH + 'px';
      ov.style.left = left + 'px';
      ov.style.top = top + 'px';

      // 标题栏
      var hdr = document.createElement('div');
      hdr.className = 'cos-ui-hdr';
      hdr.innerHTML = '<span class="cos-ui-hdr-title">' + title + '</span>' +
        '<button class="cos-ui-btn cos-ui-btn-close">关</button>';
      ov.appendChild(hdr);

      // 内容体
      var bodyEl = document.createElement('div');
      bodyEl.className = 'cos-ui-body';
      if (typeof bodyContent === 'string') {
        bodyEl.innerHTML = bodyContent;
      } else {
        bodyEl.appendChild(bodyContent);
      }
      ov.appendChild(bodyEl);

      document.body.appendChild(ov);

      // 禁用右键菜单
      ov.addEventListener('contextmenu', function(e) { e.preventDefault(); });

      // 点击窗口置顶
      ov.addEventListener('mousedown', function() {
        var tz = (window.__cos_topZ || 10000) + 1;
        window.__cos_topZ = tz;
        ov.style.zIndex = tz;
      });

      // 关闭按钮
      var closeBtn = hdr.querySelector('.cos-ui-btn-close');
      closeBtn.addEventListener('click', function() {
        if (onClose) onClose();
        if (ov.parentNode) ov.parentNode.removeChild(ov);
      });

      // 标题栏拖拽
      var dragState = { active: false, sx: 0, sy: 0, ox: 0, oy: 0 };
      hdr.addEventListener('mousedown', function(e) {
        if (e.target.closest('.cos-ui-btn-close')) return;
        dragState.active = true;
        dragState.sx = e.clientX;
        dragState.sy = e.clientY;
        var r = ov.getBoundingClientRect();
        dragState.ox = r.left;
        dragState.oy = r.top;
        e.preventDefault();
      });

      function onMove(e) {
        if (!dragState.active) return;
        ov.style.left = (dragState.ox + e.clientX - dragState.sx) + 'px';
        ov.style.top = (dragState.oy + e.clientY - dragState.sy) + 'px';
      }
      function onUp() {
        dragState.active = false;
        try {
          var r = ov.getBoundingClientRect();
          localStorage.setItem(storeKey, JSON.stringify({
            w: Math.round(r.width), h: Math.round(r.height),
            l: Math.round(r.left), t: Math.round(r.top)
          }));
        } catch(e) {}
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);

      // 四角四边缩放（使用 WindowHelper）
      if (resizable && typeof WindowHelper !== 'undefined') {
        WindowHelper.makeResizable(ov, { minWidth: 320, minHeight: 200, storeKey: storeKey });
      }

      return {
        overlay: ov,
        bodyEl: bodyEl,
        close: function() {
          if (onClose) onClose();
          if (ov.parentNode) ov.parentNode.removeChild(ov);
        }
      };
    }

  };

  // ========================================
  //  Button — 按钮
  // ========================================
  var button = {

    /**
     * 文字按钮
     */
    text: function(label, onClick, opts) {
      opts = opts || {};
      var btn = document.createElement('button');
      btn.textContent = label;
      var cls = 'cos-ui-btn';
      if (opts.primary) cls += ' cos-ui-btn-primary';
      else if (opts.secondary) cls += ' cos-ui-btn-secondary';
      else if (opts.danger) cls += ' cos-ui-btn-close';
      btn.className = cls;
      if (opts.style) {
        var extra = opts.style;
        for (var k in extra) { if (extra.hasOwnProperty(k)) btn.style[k] = extra[k]; }
      }
      if (opts.title) btn.title = opts.title;
      if (opts.disabled) btn.disabled = true;
      btn.addEventListener('click', function(e) { if (onClick) onClick(e); });
      return btn;
    },

    /**
     * 盘导出按钮
     * @param {Function} fnGetDataURL - 返回 dataURL 的函数
     * @param {string} sourceName - 来源名称
     */
    cloudExport: function(fnGetDataURL, sourceName) {
      var btn = document.createElement('button');
      btn.className = 'cos-ui-cloud-export';
      btn.textContent = '盘导出';
      btn.title = '导出到本地云盘';
      btn.addEventListener('click', function() {
        try {
          var dataURL = fnGetDataURL();
          if (!dataURL) return;
          CosAPI.cloud.push(dataURL, sourceName + ' ' + new Date().toLocaleTimeString(), sourceName);
          CosAPI.ui.toast('已存入云盘');
        } catch(e) { console.error(e); }
      });
      return btn;
    },

    /**
     * 盘导入按钮
     * @param {Function} fnOnPick - function(dataURL, item) 回调
     */
    cloudImport: function(fnOnPick) {
      var btn = document.createElement('button');
      btn.className = 'cos-ui-cloud-import';
      btn.textContent = '盘导入';
      btn.title = '从本地云盘选择';
      btn.addEventListener('click', function() {
        CosAPI.cloud.pull().then(function(item) {
          if (item) fnOnPick(item.dataURL, item);
        });
      });
      return btn;
    }

  };

  // ========================================
  //  Layout — 布局容器
  // ========================================
  var layout = {

    /**
     * 水平行
     * @param {Array<HTMLElement|string>} children
     * @param {Object} [opts]
     * @param {number} [opts.gap]
     * @param {string} [opts.align] - 'center' | 'start' | 'end'
     * @param {string} [opts.wrap]
     */
    row: function(children, opts) {
      opts = opts || {};
      var el = document.createElement('div');
      el.className = 'cos-ui-row';
      if (opts.gap) el.style.gap = opts.gap + 'px';
      if (opts.align === 'center') el.style.alignItems = 'center';
      if (opts.wrap === 'nowrap') el.style.flexWrap = 'nowrap';
      for (var i = 0; i < children.length; i++) {
        var c = children[i];
        if (typeof c === 'string') { el.insertAdjacentHTML('beforeend', c); }
        else { el.appendChild(c); }
      }
      return el;
    },

    /**
     * 垂直列
     */
    col: function(children, opts) {
      opts = opts || {};
      var el = document.createElement('div');
      el.className = 'cos-ui-col';
      if (opts.gap) el.style.gap = opts.gap + 'px';
      for (var i = 0; i < children.length; i++) {
        var c = children[i];
        if (typeof c === 'string') { el.insertAdjacentHTML('beforeend', c); }
        else { el.appendChild(c); }
      }
      return el;
    },

    /**
     * 分组区域（带标题）
     */
    section: function(title, content) {
      var el = document.createElement('div');
      el.className = 'cos-ui-section';
      var titleEl = document.createElement('div');
      titleEl.className = 'cos-ui-section-title';
      titleEl.textContent = title;
      el.appendChild(titleEl);
      if (typeof content === 'string') { el.insertAdjacentHTML('beforeend', content); }
      else if (content) { el.appendChild(content); }
      return el;
    }

  };

  // ========================================
  //  Input — 输入控件
  // ========================================
  var input = {

    /**
     * 文件选择（隐藏 input，返回 trigger 函数）
     * @param {string} accept
     * @param {boolean} multiple
     * @param {Function} onPick - function(Array<{name, dataURL, type}>)
     * @returns {Function} trigger 函数，调用即打开文件选择器
     */
    file: function(accept, multiple, onPick) {
      var inputEl = document.createElement('input');
      inputEl.type = 'file';
      inputEl.accept = accept || '';
      if (multiple) inputEl.multiple = true;
      inputEl.style.display = 'none';
      document.body.appendChild(inputEl);
      inputEl.addEventListener('change', function(e) {
        var files = Array.from(e.target.files);
        if (!files.length) return;
        var results = [];
        var pending = files.length;
        files.forEach(function(f, idx) {
          var reader = new FileReader();
          reader.onload = function(ev) {
            results[idx] = { name: f.name, dataURL: ev.target.result, type: f.type };
            pending--;
            if (pending === 0) {
              onPick(results);
              inputEl.value = '';
            }
          };
          reader.readAsDataURL(f);
        });
      });
      return function() { inputEl.click(); };
    }

  };

  // ========================================
  //  初始化
  // ========================================
  injectBaseStyle();

  return {
    window: windowModule,
    button: button,
    layout: layout,
    input: input
  };

})();
