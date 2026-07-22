/**
 * CosUI — 统一 UI 组件库
 * 所有组件返回 DOM 元素，遵循深色主题风格
 * 兼容 ES5，无模板字符串
 *
 * 新插件推荐使用 cos-p* 系列（依赖 css/plugin-theme.css）
 * 旧 cos-ui-* 系列保留向后兼容
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
  //  Window — 标准浮动窗口（旧版，向后兼容）
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
     * 文字按钮（旧版 cos-ui-* 样式，向后兼容）
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
    },

    /**
     * 创建插件按钮（使用 cos-p* 新样式）
     * @param {string} label - 按钮文字
     * @param {Function} onClick - 点击回调
     * @param {Object} [opts] - { variant: 'primary'|'secondary'|'success'|'warn'|'danger', size: 'sm', active: true }
     * @returns {HTMLButtonElement}
     */
    create: function(label, onClick, opts) {
      opts = opts || {};
      var btn = document.createElement('button');
      btn.textContent = label;
      var cls = 'cos-pbtn';
      var variant = opts.variant || 'secondary';
      cls += ' cos-pbtn-' + variant;
      if (opts.size === 'sm') cls += ' cos-pbtn-sm';
      if (opts.active) cls += ' active';
      btn.className = cls;
      if (opts.title) btn.title = opts.title;
      if (opts.disabled) btn.disabled = true;
      btn.addEventListener('click', function(e) { if (onClick) onClick(e); });
      return btn;
    },

    /** 主要按钮 */
    primary: function(label, onClick, opts) {
      opts = opts || {}; opts.variant = 'primary';
      return button.create(label, onClick, opts);
    },

    /** 次要按钮 */
    secondary: function(label, onClick, opts) {
      opts = opts || {}; opts.variant = 'secondary';
      return button.create(label, onClick, opts);
    },

    /** 成功按钮 */
    success: function(label, onClick, opts) {
      opts = opts || {}; opts.variant = 'success';
      return button.create(label, onClick, opts);
    },

    /** 警告按钮 */
    warn: function(label, onClick, opts) {
      opts = opts || {}; opts.variant = 'warn';
      return button.create(label, onClick, opts);
    },

    /** 危险按钮 */
    danger: function(label, onClick, opts) {
      opts = opts || {}; opts.variant = 'danger';
      return button.create(label, onClick, opts);
    },

    /** 关闭按钮（× 图标） */
    close: function(onClick, opts) {
      opts = opts || {};
      var btn = document.createElement('span');
      btn.className = 'cos-pclose';
      btn.innerHTML = '\u00d7';
      if (opts.title) btn.title = opts.title;
      btn.addEventListener('click', function(e) { if (onClick) onClick(e); });
      return btn;
    },

    /** 按钮组 */
    group: function(buttons) {
      var el = document.createElement('div');
      el.className = 'cos-pbtn-group';
      for (var i = 0; i < buttons.length; i++) {
        el.appendChild(buttons[i]);
      }
      return el;
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
      el.className = 'cos-psection';
      var titleEl = document.createElement('div');
      titleEl.className = 'cos-psection-title';
      titleEl.textContent = title;
      el.appendChild(titleEl);
      if (typeof content === 'string') { el.insertAdjacentHTML('beforeend', content); }
      else if (content) { el.appendChild(content); }
      return el;
    },

    /**
     * 侧边栏 + 主区域布局
     * @param {Object} opts
     *   @param {string|HTMLElement} opts.sidebar - 侧边栏内容
     *   @param {string|HTMLElement} opts.main - 主区域内容
     *   @param {number} [opts.sidebarWidth] - 侧边栏宽度（默认 240）
     * @returns {HTMLElement} .cos-papp 容器
     */
    sidebar: function(opts) {
      var app = document.createElement('div');
      app.className = 'cos-papp';

      var sb = document.createElement('div');
      sb.className = 'cos-psidebar';
      if (opts.sidebarWidth) sb.style.width = opts.sidebarWidth + 'px';
      if (typeof opts.sidebar === 'string') sb.innerHTML = opts.sidebar;
      else if (opts.sidebar) sb.appendChild(opts.sidebar);
      app.appendChild(sb);

      var main = document.createElement('div');
      main.className = 'cos-pmain';
      if (typeof opts.main === 'string') main.innerHTML = opts.main;
      else if (opts.main) main.appendChild(opts.main);
      app.appendChild(main);

      // 提供对子元素的引用
      app._sidebar = sb;
      app._main = main;
      return app;
    },

    /**
     * 棋盘格主区域（用于图片处理类插件）
     */
    checkerMain: function(content) {
      var main = document.createElement('div');
      main.className = 'cos-pmain-checker';
      if (typeof content === 'string') main.innerHTML = content;
      else if (content) main.appendChild(content);
      return main;
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
    },

    /**
     * 文本输入框
     * @param {Object} [opts] - { placeholder, value, width }
     * @returns {HTMLInputElement}
     */
    text: function(opts) {
      opts = opts || {};
      var el = document.createElement('input');
      el.type = 'text';
      el.className = 'cos-pinput';
      if (opts.placeholder) el.placeholder = opts.placeholder;
      if (opts.value != null) el.value = opts.value;
      if (opts.width) el.style.width = typeof opts.width === 'number' ? opts.width + 'px' : opts.width;
      return el;
    },

    /**
     * 文本域
     * @param {Object} [opts] - { placeholder, value, rows, minHeight }
     * @returns {HTMLTextAreaElement}
     */
    textarea: function(opts) {
      opts = opts || {};
      var el = document.createElement('textarea');
      el.className = 'cos-ptextarea';
      if (opts.placeholder) el.placeholder = opts.placeholder;
      if (opts.value != null) el.value = opts.value;
      if (opts.rows) el.rows = opts.rows;
      if (opts.minHeight) el.style.minHeight = opts.minHeight + 'px';
      return el;
    },

    /**
     * 下拉选择框
     * @param {Array<{value:string, label:string}>|Array<string>} options
     * @param {Object} [opts] - { value, width }
     * @returns {HTMLSelectElement}
     */
    select: function(options, opts) {
      opts = opts || {};
      var el = document.createElement('select');
      el.className = 'cos-pselect';
      for (var i = 0; i < options.length; i++) {
        var opt = document.createElement('option');
        if (typeof options[i] === 'string') {
          opt.value = options[i];
          opt.textContent = options[i];
        } else {
          opt.value = options[i].value;
          opt.textContent = options[i].label;
        }
        el.appendChild(opt);
      }
      if (opts.value != null) el.value = opts.value;
      if (opts.width) el.style.width = typeof opts.width === 'number' ? opts.width + 'px' : opts.width;
      return el;
    },

    /**
     * 标签文字
     * @param {string} text
     * @returns {HTMLLabelElement}
     */
    label: function(text) {
      var el = document.createElement('label');
      el.className = 'cos-plabel';
      el.textContent = text;
      return el;
    }

  };

  // ========================================
  //  Toolbar — 工具栏
  // ========================================
  var toolbar = {

    /**
     * 创建工具栏
     * @param {Array<HTMLElement|string>} items - 按钮数组，字符串 'sep' 表示分隔线
     * @returns {HTMLElement} .cos-ptoolbar
     */
    create: function(items) {
      var el = document.createElement('div');
      el.className = 'cos-ptoolbar';
      for (var i = 0; i < items.length; i++) {
        if (items[i] === 'sep' || items[i] === '|') {
          var sep = document.createElement('span');
          sep.className = 'cos-psep';
          el.appendChild(sep);
        } else if (typeof items[i] === 'string') {
          var label = document.createElement('span');
          label.className = 'cos-plabel';
          label.textContent = items[i];
          el.appendChild(label);
        } else {
          el.appendChild(items[i]);
        }
      }
      return el;
    }

  };

  // ========================================
  //  Tabs — 标签页
  // ========================================
  var tabs = {

    /**
     * 创建标签页系统
     * @param {Array<{label:string, content:HTMLElement|string, active?:boolean}>} tabList
     * @param {Object} [opts] - { variant: 'pill'|'bar' }
     * @returns {{ el: HTMLElement, switchTo: Function(index) }}
     */
    create: function(tabList, opts) {
      opts = opts || {};
      var variant = opts.variant || 'pill';

      var container = document.createElement('div');
      container.style.display = 'flex';
      container.style.flexDirection = 'column';
      container.style.flex = '1';
      container.style.overflow = 'hidden';
      container.style.minHeight = '0';

      var tabBar = document.createElement('div');
      tabBar.className = variant === 'bar' ? 'cos-ptabbar' : 'cos-ptabs';
      if (variant === 'pill') tabBar.style.padding = '3px';

      var panels = [];
      for (var i = 0; i < tabList.length; i++) {
        (function(idx) {
          var tab = tabList[idx];
          var tabBtn = document.createElement('button');
          tabBtn.className = 'cos-ptab' + (tab.active ? ' active' : '');
          tabBtn.textContent = tab.label;
          tabBtn.addEventListener('click', function() {
            switchTo(idx);
          });
          tabBar.appendChild(tabBtn);

          var panel = document.createElement('div');
          panel.className = 'cos-ppanel' + (tab.active ? ' active' : '');
          if (typeof tab.content === 'string') panel.innerHTML = tab.content;
          else if (tab.content) panel.appendChild(tab.content);
          if (variant === 'bar') {
            panel.style.flex = '1';
            panel.style.overflow = 'auto';
          }
          panels.push(panel);
          container.appendChild(panel);
        })(i);
      }

      container.insertBefore(tabBar, container.firstChild);

      function switchTo(idx) {
        var btns = tabBar.querySelectorAll('.cos-ptab');
        for (var i = 0; i < btns.length; i++) {
          btns[i].className = 'cos-ptab' + (i === idx ? ' active' : '');
        }
        for (var j = 0; j < panels.length; j++) {
          panels[j].className = 'cos-ppanel' + (j === idx ? ' active' : '');
        }
      }

      container._switchTo = switchTo;
      container._tabBar = tabBar;
      container._panels = panels;
      return container;
    }

  };

  // ========================================
  //  Modal — 模态对话框
  // ========================================
  var modal = {

    /**
     * 创建模态对话框
     * @param {Object} opts
     *   @param {string} [opts.title]
     *   @param {string|HTMLElement} opts.body
     *   @param {Function} [opts.onClose]
     * @returns {{ el: HTMLElement, show: Function, hide: Function }}
     */
    create: function(opts) {
      opts = opts || {};
      var overlay = document.createElement('div');
      overlay.className = 'cos-pmodal-overlay';

      var box = document.createElement('div');
      box.className = 'cos-pmodal-box';

      if (opts.title) {
        var titleEl = document.createElement('h3');
        titleEl.style.fontSize = '16px';
        titleEl.style.color = 'var(--cos-accent)';
        titleEl.style.margin = '0 0 16px 0';
        titleEl.textContent = opts.title;
        box.appendChild(titleEl);
      }

      var closeBtn = document.createElement('button');
      closeBtn.className = 'cos-pmodal-close';
      closeBtn.innerHTML = '\u00d7';
      closeBtn.addEventListener('click', function() {
        modal.hide(overlay, opts.onClose);
      });
      box.appendChild(closeBtn);

      var bodyEl = document.createElement('div');
      if (typeof opts.body === 'string') bodyEl.innerHTML = opts.body;
      else if (opts.body) bodyEl.appendChild(opts.body);
      box.appendChild(bodyEl);

      overlay.appendChild(box);
      overlay.addEventListener('click', function(e) {
        if (e.target === overlay) modal.hide(overlay, opts.onClose);
      });

      return {
        el: overlay,
        box: box,
        bodyEl: bodyEl,
        show: function() { overlay.classList.add('show'); document.body.appendChild(overlay); },
        hide: function() { modal.hide(overlay, opts.onClose); }
      };
    },

    /** 隐藏模态框 */
    hide: function(overlay, onClose) {
      overlay.classList.remove('show');
      if (onClose) onClose();
      setTimeout(function() {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 200);
    }

  };

  // ========================================
  //  Table — 表格
  // ========================================
  var table = {

    /**
     * 创建表格
     * @param {Array<string>} headers - 表头
     * @param {Array<Array<string|HTMLElement>>} rows - 数据行
     * @param {Object} [opts] - { scrollable: true }
     * @returns {HTMLElement}
     */
    create: function(headers, rows, opts) {
      opts = opts || {};
      var wrap = opts.scrollable ? document.createElement('div') : null;
      if (wrap) {
        wrap.className = 'cos-pscroll';
        wrap.style.flex = '1';
        wrap.style.overflow = 'auto';
      }

      var tbl = document.createElement('table');
      tbl.className = 'cos-ptable';

      var thead = document.createElement('thead');
      var tr = document.createElement('tr');
      for (var i = 0; i < headers.length; i++) {
        var th = document.createElement('th');
        th.textContent = headers[i];
        tr.appendChild(th);
      }
      thead.appendChild(tr);
      tbl.appendChild(thead);

      var tbody = document.createElement('tbody');
      for (var r = 0; r < rows.length; r++) {
        var row = document.createElement('tr');
        for (var c = 0; c < rows[r].length; c++) {
          var td = document.createElement('td');
          var cell = rows[r][c];
          if (typeof cell === 'string') td.textContent = cell;
          else if (cell) td.appendChild(cell);
          row.appendChild(td);
        }
        tbody.appendChild(row);
      }
      tbl.appendChild(tbody);

      if (wrap) {
        wrap.appendChild(tbl);
        return wrap;
      }
      return tbl;
    }

  };

  // ========================================
  //  Badge — 徽章/标签
  // ========================================
  var badge = {

    /**
     * 创建徽章
     * @param {string} text
     * @param {string} [variant] - 'default'|'success'|'warn'|'danger'
     * @returns {HTMLElement}
     */
    create: function(text, variant) {
      var el = document.createElement('span');
      el.className = 'cos-pbadge';
      if (variant && variant !== 'default') el.className += ' cos-pbadge-' + variant;
      el.textContent = text;
      return el;
    },

    success: function(text) { return badge.create(text, 'success'); },
    warn: function(text) { return badge.create(text, 'warn'); },
    danger: function(text) { return badge.create(text, 'danger'); }

  };

  // ========================================
  //  InfoBar — 信息栏
  // ========================================
  var infobar = {

    /**
     * 创建底部信息栏
     * @param {string|Array<{label:string, value:string}>} content
     * @returns {HTMLElement}
     */
    create: function(content) {
      var el = document.createElement('div');
      el.className = 'cos-pinfobar';
      if (typeof content === 'string') {
        el.innerHTML = content;
      } else if (Array.isArray(content)) {
        for (var i = 0; i < content.length; i++) {
          if (i > 0) el.appendChild(document.createTextNode(' · '));
          var span = document.createElement('span');
          span.innerHTML = content[i].label + ': <span class="cos-pinfobar-val">' + content[i].value + '</span>';
          el.appendChild(span);
        }
      }
      return el;
    }

  };

  // ========================================
  //  Empty — 空状态
  // ========================================
  var empty = {

    /**
     * 创建空状态占位
     * @param {string} text - 提示文字
     * @returns {HTMLElement}
     */
    create: function(text) {
      var el = document.createElement('div');
      el.className = 'cos-pempty';
      el.textContent = text || '暂无数据';
      return el;
    }

  };

  // ========================================
  //  Toast — 提示消息
  // ========================================
  var _toastTimer = null;
  var toast = {

    /**
     * 显示提示消息
     * @param {string} text - 消息内容
     * @param {number} [duration] - 显示时长（ms，默认 2000）
     */
    show: function(text, duration) {
      duration = duration || 2000;
      var el = document.querySelector('.cos-ptoast');
      if (!el) {
        el = document.createElement('div');
        el.className = 'cos-ptoast';
        document.body.appendChild(el);
      }
      el.textContent = text;
      el.classList.add('show');
      if (_toastTimer) clearTimeout(_toastTimer);
      _toastTimer = setTimeout(function() {
        el.classList.remove('show');
      }, duration);
    }

  };

  // ========================================
  //  Draggable — 拖拽工具
  // ========================================
  var draggable = {

    /**
     * 让窗口可拖拽（通过指定 header 元素）
     * @param {HTMLElement} overlay - 要拖拽的窗口
     * @param {HTMLElement} header - 拖拽手柄（标题栏）
     * @param {Object} [opts]
     *   @param {string} [opts.storeKey] - localStorage 保存键
     *   @param {string} [opts.closeSelector] - 关闭按钮选择器（拖拽时排除）
     *   @param {Function} [opts.onMove] - 拖拽中回调
     */
    bind: function(overlay, header, opts) {
      opts = opts || {};
      var closeSel = opts.closeSelector || '.cos-pclose,.cos-pclose-btn,.cos-ui-btn-close';
      var d = { active: false, sx: 0, sy: 0, ox: 0, oy: 0 };

      header.addEventListener('mousedown', function(e) {
        if (e.target.closest(closeSel)) return;
        d.active = true;
        d.sx = e.clientX; d.sy = e.clientY;
        var r = overlay.getBoundingClientRect();
        d.ox = r.left; d.oy = r.top;
        e.preventDefault();
      });

      function onMove(e) {
        if (!d.active) return;
        overlay.style.left = (d.ox + e.clientX - d.sx) + 'px';
        overlay.style.top = (d.oy + e.clientY - d.sy) + 'px';
        if (opts.onMove) opts.onMove();
      }

      function onUp() {
        if (!d.active) return;
        d.active = false;
        if (opts.storeKey) {
          try {
            var r = overlay.getBoundingClientRect();
            localStorage.setItem(opts.storeKey, JSON.stringify({
              w: Math.round(r.width), h: Math.round(r.height),
              l: Math.round(r.left), t: Math.round(r.top)
            }));
          } catch(e) {}
        }
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);

      return {
        unbind: function() {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        }
      };
    }

  };

  // ========================================
  //  RatioPanel — 比例选择面板（公共组件）
  // ========================================
  var ratioPanel = {

    _RATIO_VALS: [1, 2, 3, 4, 5, 9, 16, 21],
    _currentPanel: null,

    /**
     * 打开比例选择面板
     * @param {Object} opts
     *   @param {string} [opts.title] - 面板标题（默认"选择比例"）
     *   @param {Object} [opts.current] - 当前选中 { w, h } 或 { special: 'original'|'free' }
     *   @param {Array} [opts.extraOptions] - 额外选项 [{ label, value }] 如"原比例""自由"
     *   @param {Function} [opts.isValid] - 自定义校验 (w, h) => boolean，false 则禁用
     *   @param {Function} opts.onSelect - 选中回调，参数同 current
     *   @param {HTMLElement} [opts.anchorEl] - 锚定元素，面板出现在其附近
     */
    open: function(opts) {
      opts = opts || {};
      var self = this;
      var title = opts.title || '选择比例';
      var vals = this._RATIO_VALS;

      // 关闭已有面板
      this.close();

      var panel = document.createElement('div');
      panel.className = 'cos-pwin';
      panel.style.width = '340px';
      panel.style.zIndex = 2147483647;
      panel.style.minWidth = '300px';
      panel.style.minHeight = '200px';
      panel.addEventListener('contextmenu', function(e) { e.preventDefault(); });

      // 定位
      if (opts.anchorEl) {
        var r = opts.anchorEl.getBoundingClientRect();
        var left = r.right + 6;
        if (left + 340 > window.innerWidth) left = r.left - 346;
        panel.style.left = Math.max(2, left) + 'px';
        panel.style.top = Math.max(2, r.top) + 'px';
      } else {
        panel.style.left = Math.max(20, (window.innerWidth - 340) / 2) + 'px';
        panel.style.top = Math.max(20, (window.innerHeight - 420) / 2) + 'px';
      }

      // 标题栏
      var header = document.createElement('div');
      header.className = 'cos-pwin-hdr';
      header.innerHTML =
        '<span class="cos-pwin-hdr-title">' + title + '</span>' +
        '<div class="cos-pwin-hdr-right"><span class="cos-pclose" title="关闭">\u00d7</span></div>';
      panel.appendChild(header);

      // 拖拽
      if (CosUI.draggable) {
        CosUI.draggable.bind(panel, header, { closeSelector: '.cos-pclose' });
      }

      // 关闭按钮
      panel.querySelector('.cos-pclose').addEventListener('click', function() {
        self.close();
      });

      // 额外选项（原比例、自由等）
      if (opts.extraOptions && opts.extraOptions.length) {
        var extraWrap = document.createElement('div');
        extraWrap.className = 'cos-rp-extra';
        opts.extraOptions.forEach(function(opt) {
          var btn = document.createElement('button');
          btn.className = 'rp-extra-btn';
          btn.textContent = opt.label;
          btn.dataset.value = opt.value;
          if (opts.current && opts.current.special === opt.value) {
            btn.classList.add('active');
          }
          btn.addEventListener('click', function() {
            if (opts.onSelect) opts.onSelect({ special: opt.value });
            self.close();
          });
          extraWrap.appendChild(btn);
        });
        panel.appendChild(extraWrap);
      }

      // 网格
      var body = document.createElement('div');
      body.className = 'cos-rp-body cos-pscroll';

      var html = '<div class="cos-rp-grid">';
      html += '<div></div>';
      for (var ci = 0; ci < vals.length; ci++) {
        html += '<div class="rp-h">' + vals[ci] + '</div>';
      }
      for (var ri = 0; ri < vals.length; ri++) {
        html += '<div class="rp-v">' + vals[ri] + '</div>';
        for (var cj = 0; cj < vals.length; cj++) {
          var w = vals[ri], h = vals[cj];
          var active = (opts.current && opts.current.w === w && opts.current.h === h) ? ' active' : '';
          var valid = true;
          if (opts.isValid) {
            valid = opts.isValid(w, h);
          } else {
            // 默认校验：长边/短边 ≤ 3:1，重复方形只保留 1:1
            var longS = Math.max(w, h), shortS = Math.min(w, h);
            valid = (longS / shortS <= 3) && !(w === h && w > 1);
          }
          var disabled = valid ? '' : ' disabled';
          var label = w + ':' + h;
          html += '<div class="rp-cell' + active + disabled + '" data-w="' + w + '" data-h="' + h + '">' + label + '</div>';
        }
      }
      html += '</div>';
      body.innerHTML = html;
      panel.appendChild(body);

      // 自定义输入区
      var customWrap = document.createElement('div');
      customWrap.className = 'cos-rp-custom';
      customWrap.innerHTML =
        '<span class="rp-custom-label">自定义</span>' +
        '<input type="number" class="rp-custom-input" id="rpCustomW" min="1" max="999" placeholder="宽" />' +
        '<span class="rp-custom-colon">:</span>' +
        '<input type="number" class="rp-custom-input" id="rpCustomH" min="1" max="999" placeholder="高" />' +
        '<button class="rp-custom-btn" id="rpCustomOk">确定</button>';
      panel.appendChild(customWrap);

      // 回填当前自定义值（当前比例不在预设网格中时）
      if (opts.current && opts.current.w && opts.current.h &&
          (vals.indexOf(opts.current.w) === -1 || vals.indexOf(opts.current.h) === -1)) {
        var cw = customWrap.querySelector('#rpCustomW');
        var ch = customWrap.querySelector('#rpCustomH');
        if (opts.current.w) cw.value = opts.current.w;
        if (opts.current.h) ch.value = opts.current.h;
      }

      // 确定按钮
      var onSelect = opts.onSelect;
      customWrap.querySelector('#rpCustomOk').addEventListener('click', function() {
        var w = parseInt(customWrap.querySelector('#rpCustomW').value);
        var h = parseInt(customWrap.querySelector('#rpCustomH').value);
        if (w > 0 && h > 0) {
          if (onSelect) onSelect({ w: w, h: h });
          self.close();
        }
      });
      // 回车确认
      customWrap.querySelectorAll('.rp-custom-input').forEach(function(inp) {
        inp.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') {
            customWrap.querySelector('#rpCustomOk').click();
          }
        });
      });

      // 底部
      var foot = document.createElement('div');
      foot.className = 'cos-rp-foot';
      foot.innerHTML = '当前: <span class="rp-cur">' + this._label(opts.current) + '</span>';
      panel.appendChild(foot);

      document.body.appendChild(panel);
      this._currentPanel = panel;

      // 单元格点击
      var onSelect = opts.onSelect;
      body.querySelectorAll('.rp-cell:not(.disabled)').forEach(function(cell) {
        cell.addEventListener('click', function() {
          var w = parseInt(this.getAttribute('data-w'));
          var h = parseInt(this.getAttribute('data-h'));
          if (onSelect) onSelect({ w: w, h: h });
          self.close();
        });
      });

      return panel;
    },

    /** 关闭面板 */
    close: function() {
      if (this._currentPanel) {
        if (this._currentPanel.parentNode) {
          this._currentPanel.parentNode.removeChild(this._currentPanel);
        }
        this._currentPanel = null;
      }
    },

    /** 格式化比例标签 */
    _label: function(ratio) {
      if (!ratio) return '--:--';
      if (ratio.special) return ratio.special === 'original' ? '原比例' : (ratio.special === 'free' ? '自由' : ratio.special);
      if (!ratio.w || !ratio.h) return '--:--';
      return ratio.w + ':' + ratio.h;
    }
  };

  // ========================================
  //  PWin — 新版插件窗口（cos-p* 样式）
  // ========================================
  var pwin = {

    /**
     * 创建完整的插件窗口（标题栏 + 拖拽 + 缩放 + 置顶 + localStorage 记忆）
     * 推荐所有新插件使用此方法
     *
     * @param {Object} opts
     *   @param {string} opts.title - 标题
     *   @param {string} [opts.subtitle] - 副标题
     *   @param {string|HTMLElement} opts.body - 窗口内容
     *   @param {number} [opts.width] - 初始宽度（默认 600）
     *   @param {number} [opts.height] - 初始高度（默认 400）
     *   @param {number} [opts.minWidth] - 最小宽度（默认 320）
     *   @param {number} [opts.minHeight] - 最小高度（默认 200）
     *   @param {string} [opts.storeKey] - localStorage 键名
     *   @param {string} [opts.skillId] - data-skill-id
     *   @param {boolean} [opts.resizable] - 是否可缩放（默认 true）
     *   @param {boolean} [opts.gradientTitle] - 标题使用渐变色
     *   @param {Function} [opts.onClose] - 关闭回调
     * @returns {{ overlay: HTMLElement, header: HTMLElement, bodyEl: HTMLElement, close: Function }}
     */
    create: function(opts) {
      opts = opts || {};
      var width = opts.width || 600;
      var height = opts.height || 400;
      var minW = opts.minWidth || 320;
      var minH = opts.minHeight || 200;
      var storeKey = opts.storeKey || 'cos-pwin-' + Date.now();
      var skillId = opts.skillId || '';
      var onClose = opts.onClose || null;

      // 创建窗口容器
      var ov = document.createElement('div');
      ov.className = 'cos-pwin';
      if (skillId) ov.setAttribute('data-skill-id', skillId);

      // z-index 管理
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
      ov.style.minWidth = minW + 'px';
      ov.style.minHeight = minH + 'px';

      // 标题栏
      var hdr = document.createElement('div');
      hdr.className = 'cos-pwin-hdr';

      var titleWrap = document.createElement('div');
      titleWrap.style.display = 'flex';
      titleWrap.style.alignItems = 'center';

      var titleEl = document.createElement('span');
      if (opts.gradientTitle) {
        titleEl.className = 'cos-pwin-hdr-title-gradient';
      } else {
        titleEl.className = 'cos-pwin-hdr-title';
      }
      titleEl.textContent = opts.title || '窗口';
      titleWrap.appendChild(titleEl);

      if (opts.subtitle) {
        var subEl = document.createElement('span');
        subEl.className = 'cos-pwin-hdr-sub';
        subEl.textContent = opts.subtitle;
        titleWrap.appendChild(subEl);
      }
      hdr.appendChild(titleWrap);

      var rightWrap = document.createElement('div');
      rightWrap.className = 'cos-pwin-hdr-right';
      var closeBtn = document.createElement('span');
      closeBtn.className = 'cos-pclose';
      closeBtn.innerHTML = '\u00d7';
      rightWrap.appendChild(closeBtn);
      hdr.appendChild(rightWrap);

      ov.appendChild(hdr);

      // 内容体
      var bodyEl = document.createElement('div');
      bodyEl.style.flex = '1';
      bodyEl.style.overflow = 'hidden';
      bodyEl.style.minHeight = '0';
      bodyEl.style.display = 'flex';
      bodyEl.style.flexDirection = 'column';
      if (typeof opts.body === 'string') {
        bodyEl.innerHTML = opts.body;
      } else if (opts.body) {
        bodyEl.appendChild(opts.body);
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
      closeBtn.addEventListener('click', function() {
        pwin.close(ov, onClose);
      });

      // 标题栏拖拽
      draggable.bind(ov, hdr, {
        storeKey: storeKey,
        closeSelector: '.cos-pclose,.cos-pclose-btn'
      });

      // 四角四边缩放
      if (opts.resizable !== false && typeof WindowHelper !== 'undefined') {
        WindowHelper.makeResizable(ov, { minWidth: minW, minHeight: minH, storeKey: storeKey });
      }

      return {
        overlay: ov,
        header: hdr,
        bodyEl: bodyEl,
        close: function() { pwin.close(ov, onClose); }
      };
    },

    /** 关闭窗口 */
    close: function(overlay, onClose) {
      if (onClose) onClose();
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }

  };

  // ========================================
  //  Theme — 主题色常量（供 JS 中引用）
  // ========================================
  var theme = {
    bg: '#0f1525',
    surface: 'rgba(20, 30, 60, 0.65)',
    surfaceWarm: 'rgba(20, 35, 70, 0.8)',
    border: 'rgba(100, 160, 255, 0.15)',
    text: '#e8edf5',
    textSoft: '#94a3b8',
    textDim: '#475569',
    accent: '#38bdf8',
    accentDark: '#0ea5e9',
    blue: '#60a5fa',
    green: '#34d399',
    yellow: '#fbbf24',
    red: '#f87171',
    purple: '#a78bfa',
    pink: '#f472b6',
    close: '#e87060',
    closeBg: 'rgba(220, 80, 60, 0.2)',

    /** CSS 类名常量，方便 JS 中拼接 */
    cls: {
      win: 'cos-pwin',
      hdr: 'cos-pwin-hdr',
      title: 'cos-pwin-hdr-title',
      close: 'cos-pclose',
      body: 'cos-pwin-body',
      btn: 'cos-pbtn',
      btnPrimary: 'cos-pbtn cos-pbtn-primary',
      btnSecondary: 'cos-pbtn cos-pbtn-secondary',
      btnSuccess: 'cos-pbtn cos-pbtn-success',
      btnWarn: 'cos-pbtn cos-pbtn-warn',
      btnDanger: 'cos-pbtn cos-pbtn-danger',
      btnSm: 'cos-pbtn-sm',
      input: 'cos-pinput',
      textarea: 'cos-ptextarea',
      select: 'cos-pselect',
      label: 'cos-plabel',
      section: 'cos-psection',
      sectionTitle: 'cos-psection-title',
      toolbar: 'cos-ptoolbar',
      sep: 'cos-psep',
      sidebar: 'cos-psidebar',
      main: 'cos-pmain',
      app: 'cos-papp',
      tab: 'cos-ptab',
      tabActive: 'cos-ptab active',
      tabs: 'cos-ptabs',
      tabbar: 'cos-ptabbar',
      panel: 'cos-ppanel',
      panelActive: 'cos-ppanel active',
      table: 'cos-ptable',
      badge: 'cos-pbadge',
      infobar: 'cos-pinfobar',
      empty: 'cos-pempty',
      scroll: 'cos-pscroll',
      modal: 'cos-pmodal-overlay',
      modalBox: 'cos-pmodal-box',
      loading: 'cos-ploading',
      row: 'cos-prow',
      col: 'cos-pcol',
      fileLabel: 'cos-pfile-label'
    }
  };

  // ========================================
  //  初始化
  // ========================================
  injectBaseStyle();

  return {
    // 旧版（向后兼容）
    window: windowModule,
    button: button,
    layout: layout,
    input: input,

    // 新版公共组件
    pwin: pwin,
    toolbar: toolbar,
    tabs: tabs,
    modal: modal,
    table: table,
    badge: badge,
    infobar: infobar,
    empty: empty,
    toast: toast,
    draggable: draggable,
    theme: theme,
    ratioPanel: ratioPanel
  };

})();
