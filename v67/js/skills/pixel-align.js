/**
 * ============================================
 *   像素对齐 - 独立插件
 *   从画布选中图片 → 下采样 → 调色盘量化 → 抖动 → 保存回画布
 * ============================================
 */

var PixelAlignSkill = {

    id: 'pixel-align',
    name: '像素对齐',
    icon: '<span style="color:#ef4444;">齐</span>',
    description: '将图片像素对齐到指定网格，支持调色盘和抖动',
    key: '7',

    _overlay: null,
    _srcCanvas: null,
    _dstCanvas: null,
    _srcCtx: null,
    _dstCtx: null,
    _srcImg: null,
    _resultDataURL: null,
    _cfStop: null,
    _cfLock: false,
    _events: [],

    // 当前参数
    _gridSize: 'auto',     // 'auto' = 原图比例, 或数字
    _dither: 'none',
    _palette: 'original',

    // 调色盘（与像素画保持一致）
    _PALETTES: {
        p8: [[0,0,0],[29,43,83],[126,37,83],[0,135,81],[171,82,54],[95,87,79],[194,195,199],[255,241,232],[255,0,77],[255,163,0],[255,236,39],[0,228,54],[41,173,255],[131,118,156],[255,119,168],[255,204,170]],
        gameboy: [[15,56,15],[48,98,48],[139,172,15],[155,188,15]],
        nes: [[124,124,124],[0,0,252],[0,0,188],[68,40,188],[148,0,132],[168,0,32],[168,16,0],[136,20,0],[80,48,0],[0,120,0],[0,104,0],[0,88,0],[0,64,88],[0,0,0],[188,188,188],[0,120,248],[0,88,248],[104,68,252],[216,0,204],[228,0,88],[248,56,0],[228,92,16],[172,124,0],[0,184,0],[0,168,0],[0,168,68],[0,136,136],[0,0,0]]
    },
    _BAYER_4X4: [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]],
    _BAYER_2X2: [[0,2],[3,1]],

    // ===== 生命周期 =====

    activate: function(world) {
        if (this._overlay) {
            if (typeof SkillSystem !== 'undefined') SkillSystem.renderSubTools();
            this._tryLoadFromCanvas();
            this._startCanvasFollow();
            return;
        }
        this._world = world;
        this._createOverlay();
        if (typeof SkillSystem !== 'undefined') SkillSystem.renderSubTools();
        this._tryLoadFromCanvas();
        this._startCanvasFollow();
    },

    getSubTools: function() {
        var self = this;
        return [{ label: '关闭', action: function() { self._destroy(); if (typeof SkillSystem !== 'undefined') SkillSystem.deactivate(); } }];
    },

    save: function() { return null; },

    _destroy: function() {
        this._stopCanvasFollow();
        this._events.forEach(function(item) { if (item.target) item.target.removeEventListener(item.type, item.fn, item.options); });
        this._events = [];
        if (this._overlay && this._overlay.parentNode) {
            this._overlay.parentNode.removeChild(this._overlay);
        }
        this._overlay = null;
        this._srcCanvas = null; this._srcCtx = null;
        this._dstCanvas = null; this._dstCtx = null;
        this._srcImg = null; this._resultDataURL = null;
    },

    // ===== 画布联动 =====

    _tryLoadFromCanvas: function() {
        if (typeof CanvasImages === 'undefined') return;
        var dataURL = CanvasImages.getSelected('display');
        if (dataURL) {
            this._loadImage(dataURL);
        } else {
            this._showPlaceholder('请在画布上选中一张图片');
        }
    },

    _startCanvasFollow: function() {
        if (this._cfStop) return;
        var self = this;
        this._cfStop = CanvasFollow.bind(function() { self._tryLoadFromCanvas(); }, {
            isAlive: function() { return !!(self._overlay && self._overlay.parentNode); },
            paused: function() { return !!self._cfLock; },
            interval: 200
        });
    },

    _stopCanvasFollow: function() {
        if (this._cfStop) { this._cfStop(); this._cfStop = null; }
        this._cfLock = false;
    },

    // ===== 图片加载 =====

    _loadImage: function(dataURL) {
        var self = this;
        var img = new Image();
        img.onload = function() {
            self._srcImg = img;
            self._renderSource();
            self._clearResult();
            self._updateInfo();
            self._updateGridLabel();
            // 自动执行一次
            self._executeCalibrate();
        };
        img.onerror = function() {
            self._showPlaceholder('图片加载失败');
        };
        img.src = dataURL;
    },

    _showPlaceholder: function(msg) {
        if (this._srcCtx) {
            this._srcCtx.clearRect(0, 0, this._srcCanvas.width, this._srcCanvas.height);
        }
        var info = this._overlay ? this._overlay.querySelector('#paInfo') : null;
        if (info) info.textContent = msg;
        this._srcImg = null;
        this._clearResult();
    },

    // ===== UI 构建 =====

    _createOverlay: function() {
        var self = this;

        var overlay = document.createElement('div');
        overlay.className = 'cos-pwin';
        overlay.setAttribute('data-skill-id', 'pixel-align');

        var savedW = 760, savedH = 480, savedL = null, savedT = null;
        try {
            var saved = JSON.parse(localStorage.getItem('pa-window-size'));
            if (saved) {
                var sw = window.innerWidth, sh = window.innerHeight;
                savedW = Math.min(saved.w || 760, sw - 20);
                savedH = Math.min(saved.h || 480, sh - 20);
                savedL = Math.max(0, Math.min(saved.l, sw - savedW));
                savedT = Math.max(0, Math.min(saved.t, sh - savedH));
            }
        } catch(e) {}
        overlay.style.width = savedW + 'px';
        overlay.style.height = savedH + 'px';
        overlay.style.left = (savedL !== null ? savedL : Math.max(20, (window.innerWidth - savedW) / 2)) + 'px';
        overlay.style.top = (savedT !== null ? savedT : Math.max(20, (window.innerHeight - savedH) / 2)) + 'px';
        overlay.style.minWidth = '520px';
        overlay.style.minHeight = '340px';

        var topZ = (window.__cos_topZ || 10000) + 1;
        window.__cos_topZ = topZ;
        overlay.style.zIndex = topZ;

        overlay.addEventListener('contextmenu', function(e) { e.preventDefault(); });
        overlay.addEventListener('mousedown', function() {
            var tz = (window.__cos_topZ || 10000) + 1;
            window.__cos_topZ = tz;
            overlay.style.zIndex = tz;
        });

        var styleEl = document.createElement('style');
        styleEl.textContent = this._getCSS();
        overlay.appendChild(styleEl);

        var header = document.createElement('div');
        header.className = 'cos-pwin-hdr';
        header.innerHTML = '<span class="cos-pwin-hdr-title">像素对齐</span><div class="cos-pwin-hdr-right"><span class="cos-pclose" data-action="close" title="关闭">\u00d7</span></div>';
        overlay.appendChild(header);

        var body = document.createElement('div');
        body.className = 'pa-body';
        body.innerHTML = this._buildBodyHTML();
        overlay.appendChild(body);

        if (typeof WindowHelper !== 'undefined') {
            WindowHelper.makeResizable(overlay, { minWidth: 520, minHeight: 340, storeKey: 'pa-window-size' });
        }
        if (typeof CosUI !== 'undefined' && CosUI.draggable) {
            CosUI.draggable.bind(overlay, header, {
                storeKey: 'pa-window-size',
                closeSelector: '[data-action="close"],.cos-pclose'
            });
        }

        document.body.appendChild(overlay);
        this._overlay = overlay;
        this._srcCanvas = overlay.querySelector('#paSrcCanvas');
        this._srcCtx = this._srcCanvas.getContext('2d');
        this._dstCanvas = overlay.querySelector('#paDstCanvas');
        this._dstCtx = this._dstCanvas.getContext('2d');

        this._bindEvents(overlay);
    },

    _getCSS: function() {
        return '' +
        '.pa-body{flex:1;display:flex;overflow:hidden;min-height:0;}' +
        // 左侧属性栏
        '.pa-sidebar{width:160px;flex-shrink:0;background:var(--cos-surface);border-right:1px solid var(--cos-border);display:flex;flex-direction:column;overflow-y:auto;}' +
        '.pa-prop-section{padding:6px 8px;border-bottom:1px solid rgba(100,160,255,0.06);}' +
        '.pa-prop-title{font-size:11px;font-weight:bold;color:var(--cos-accent);margin-bottom:5px;letter-spacing:1px;}' +
        '.pa-prop-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:3px;}' +
        '.pa-prop-grid-3{display:grid;grid-template-columns:repeat(3,1fr);gap:3px;}' +
        '.pa-opt-btn{transition:all 0.12s;padding:4px 0;border-radius:4px;font-size:11px;cursor:pointer;border:1px solid var(--cos-border);background:rgba(0,10,30,0.3);color:var(--cos-text-soft);font-family:inherit;text-align:center;line-height:1.3;}' +
        '.pa-opt-btn:hover{border-color:var(--cos-accent);color:var(--cos-accent);}' +
        '.pa-opt-btn:active{transform:scale(0.92);}' +
        '.pa-opt-btn.active{background:var(--cos-accent);border-color:var(--cos-accent);color:#fff;font-weight:bold;}' +
        '.pa-opt-btn.wide{grid-column:span 4;}' +
        '.pa-custom-row{display:flex;gap:3px;align-items:center;margin-top:3px;}' +
        '.pa-custom-input{width:100%;height:24px;background:rgba(0,10,30,0.4);border:1px solid var(--cos-border);color:var(--cos-text);text-align:center;font-size:11px;font-family:inherit;border-radius:4px;}' +
        '.pa-custom-input:focus{border-color:var(--cos-accent);outline:none;}' +
        '.pa-custom-x{font-size:10px;color:var(--cos-text-dim);flex-shrink:0;}' +
        '.pa-custom-apply{flex-shrink:0;width:36px;height:24px;background:var(--cos-accent);border:none;border-radius:4px;color:#fff;font-size:10px;cursor:pointer;font-family:inherit;}' +
        '.pa-custom-apply:active{transform:scale(0.92);}' +
        // 右侧预览区
        '.pa-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;}' +
        '.pa-preview-area{flex:1;display:flex;gap:6px;padding:6px;overflow:hidden;min-height:0;}' +
        '.pa-preview-panel{flex:1;display:flex;flex-direction:column;min-width:0;background:rgba(0,5,15,0.95);border-radius:8px;overflow:hidden;border:1px solid var(--cos-border);}' +
        '.pa-preview-label{padding:3px 8px;font-size:11px;font-weight:bold;color:var(--cos-accent);background:var(--cos-surface);border-bottom:1px solid var(--cos-border);flex-shrink:0;}' +
        '.pa-preview-wrap{flex:1;overflow:hidden;display:flex;align-items:center;justify-content:center;position:relative;}' +
        '.pa-preview-wrap canvas{image-rendering:pixelated;max-width:100%;max-height:100%;}' +
        '.pa-placeholder{font-size:12px;color:var(--cos-text-dim);text-align:center;padding:20px;}' +
        // 底部操作栏
        '.pa-actions{flex-shrink:0;background:var(--cos-surface);border-top:1px solid var(--cos-border);padding:6px 10px;display:flex;align-items:center;gap:6px;}' +
        '.pa-btn{transition:all 0.15s;padding:5px 14px;border-radius:5px;font-size:12px;cursor:pointer;border:1px solid var(--cos-border);background:var(--cos-border);color:var(--cos-text-soft);font-family:inherit;}' +
        '.pa-btn:hover{border-color:var(--cos-accent);color:var(--cos-accent);}' +
        '.pa-btn:active{transform:scale(0.95);}' +
        '.pa-btn.primary{background:var(--cos-accent);border-color:var(--cos-accent);color:#fff;}' +
        '.pa-btn.primary:hover{background:#c73850;}' +
        '.pa-btn.success{background:#2ecc71;border-color:#2ecc71;color:#fff;}' +
        '.pa-btn.success:hover{background:#27ae60;}' +
        '.pa-btn:disabled{opacity:0.4;cursor:not-allowed;}' +
        '.pa-info{font-size:11px;color:var(--cos-text-dim);margin-left:auto;white-space:nowrap;}';
    },

    _buildBodyHTML: function() {
        return '' +
        // 左侧属性栏
        '<div class="pa-sidebar">' +
            // 网格
            '<div class="pa-prop-section">' +
                '<div class="pa-prop-title">网格</div>' +
                '<div class="pa-prop-grid">' +
                    '<button class="pa-opt-btn wide active" data-grid="auto" id="paGridAuto">原图比例</button>' +
                    '<button class="pa-opt-btn" data-grid="16">16</button>' +
                    '<button class="pa-opt-btn" data-grid="32">32</button>' +
                    '<button class="pa-opt-btn" data-grid="48">48</button>' +
                    '<button class="pa-opt-btn" data-grid="64">64</button>' +
                '</div>' +
                '<div class="pa-prop-grid" style="margin-top:3px;">' +
                    '<button class="pa-opt-btn" data-grid="96">96</button>' +
                    '<button class="pa-opt-btn" data-grid="128">128</button>' +
                    '<button class="pa-opt-btn" data-grid="192">192</button>' +
                    '<button class="pa-opt-btn" data-grid="256">256</button>' +
                '</div>' +
                '<div class="pa-custom-row">' +
                    '<input class="pa-custom-input" id="paGridCustom" type="number" placeholder="自定义" min="4" max="512">' +
                    '<button class="pa-custom-apply" id="paGridApply">OK</button>' +
                '</div>' +
                '<div id="paGridLabel" style="font-size:10px;color:var(--cos-text-dim);margin-top:3px;text-align:center;"></div>' +
            '</div>' +
            // 抖动
            '<div class="pa-prop-section">' +
                '<div class="pa-prop-title">抖动</div>' +
                '<div class="pa-prop-grid-3">' +
                    '<button class="pa-opt-btn" data-dither="bayer4x4">4x4</button>' +
                    '<button class="pa-opt-btn" data-dither="bayer2x2">2x2</button>' +
                    '<button class="pa-opt-btn active" data-dither="none">无</button>' +
                '</div>' +
            '</div>' +
            // 颜色整理
            '<div class="pa-prop-section">' +
                '<div class="pa-prop-title">颜色整理</div>' +
                '<div class="pa-prop-grid">' +
                    '<button class="pa-opt-btn wide active" data-palette="original">原图色彩</button>' +
                    '<button class="pa-opt-btn" data-palette="q4">4色</button>' +
                    '<button class="pa-opt-btn" data-palette="q8">8色</button>' +
                    '<button class="pa-opt-btn" data-palette="q16">16色</button>' +
                    '<button class="pa-opt-btn" data-palette="q32">32色</button>' +
                    '<button class="pa-opt-btn" data-palette="q64">64色</button>' +
                '</div>' +
            '</div>' +
            // 风格调色盘
            '<div class="pa-prop-section">' +
                '<div class="pa-prop-title">风格调色盘</div>' +
                '<div class="pa-prop-grid">' +
                    '<button class="pa-opt-btn wide" data-palette="p8">Pico-8</button>' +
                    '<button class="pa-opt-btn wide" data-palette="gameboy">GameBoy</button>' +
                    '<button class="pa-opt-btn wide" data-palette="nes">NES</button>' +
                '</div>' +
            '</div>' +
        '</div>' +
        // 右侧主区域
        '<div class="pa-main">' +
            '<div class="pa-preview-area">' +
                '<div class="pa-preview-panel">' +
                    '<div class="pa-preview-label">原图</div>' +
                    '<div class="pa-preview-wrap" id="paSrcWrap">' +
                        '<canvas id="paSrcCanvas"></canvas>' +
                    '</div>' +
                '</div>' +
                '<div class="pa-preview-panel">' +
                    '<div class="pa-preview-label">对齐结果</div>' +
                    '<div class="pa-preview-wrap" id="paDstWrap">' +
                        '<canvas id="paDstCanvas"></canvas>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="pa-actions">' +
                '<button class="pa-btn primary" id="paBtnExecute">执行对齐</button>' +
                '<button class="pa-btn success" id="paBtnSaveCanvas" disabled>保存到画布</button>' +
                '<button class="pa-btn" id="paBtnDownload" disabled>下载</button>' +
                '<span class="pa-info" id="paInfo">准备就绪</span>' +
            '</div>' +
        '</div>';
    },

    _bindEvents: function(overlay) {
        var self = this;
        this._on(overlay.querySelector('[data-action="close"]'), 'click', function() {
            self._destroy();
            if (typeof SkillSystem !== 'undefined') SkillSystem.deactivate();
        });
        this._on(this._q('#paBtnExecute'), 'click', function() { self._executeCalibrate(); });
        this._on(this._q('#paBtnSaveCanvas'), 'click', function() { self._saveToCanvas(); });
        this._on(this._q('#paBtnDownload'), 'click', function() { self._downloadResult(); });

        // 网格快速选择
        this._qa('[data-grid]').forEach(function(btn) {
            self._on(btn, 'click', function() {
                self._qa('[data-grid]').forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                self._gridSize = btn.dataset.grid;
                if (self._gridSize !== 'auto') self._gridSize = parseInt(self._gridSize);
                self._updateGridLabel();
                if (self._srcImg) self._executeCalibrate();
            });
        });

        // 自定义网格
        this._on(this._q('#paGridApply'), 'click', function() {
            var v = parseInt(self._q('#paGridCustom').value);
            if (!v || v < 4 || v > 512) return;
            self._qa('[data-grid]').forEach(function(b) { b.classList.remove('active'); });
            self._gridSize = v;
            self._updateGridLabel();
            if (self._srcImg) self._executeCalibrate();
        });
        this._on(this._q('#paGridCustom'), 'keydown', function(e) {
            if (e.key === 'Enter') { e.preventDefault(); self._q('#paGridApply').click(); }
        });

        // 抖动快速选择
        this._qa('[data-dither]').forEach(function(btn) {
            self._on(btn, 'click', function() {
                self._qa('[data-dither]').forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                self._dither = btn.dataset.dither;
                if (self._srcImg) self._executeCalibrate();
            });
        });

        // 调色盘快速选择
        this._qa('[data-palette]').forEach(function(btn) {
            self._on(btn, 'click', function() {
                self._qa('[data-palette]').forEach(function(b) { b.classList.remove('active'); });
                btn.classList.add('active');
                self._palette = btn.dataset.palette;
                if (self._srcImg) self._executeCalibrate();
            });
        });
    },

    _q: function(sel) { return this._overlay ? this._overlay.querySelector(sel) : null; },
    _qa: function(sel) { return this._overlay ? this._overlay.querySelectorAll(sel) : null; },
    _on: function(target, type, fn, options) {
        target.addEventListener(type, fn, options);
        this._events.push({ target: target, type: type, fn: fn, options: options });
    },

    // ===== 网格标签更新 =====

    _updateGridLabel: function() {
        var label = this._overlay ? this._overlay.querySelector('#paGridLabel') : null;
        if (!label) return;
        if (!this._srcImg) { label.textContent = ''; return; }
        var dims = this._calcDims();
        label.textContent = dims.w + ' x ' + dims.h;
    },

    _calcDims: function() {
        if (!this._srcImg) return { w: 0, h: 0 };
        var srcW = this._srcImg.naturalWidth, srcH = this._srcImg.naturalHeight;
        if (this._gridSize === 'auto') {
            // 原图比例：直接用原图像素尺寸
            return { w: srcW, h: srcH };
        }
        // 固定网格：按最长边缩放，保持比例
        var targetSize = this._gridSize;
        var maxSide = Math.max(srcW, srcH);
        var scale = targetSize / maxSide;
        return {
            w: Math.max(1, Math.round(srcW * scale)),
            h: Math.max(1, Math.round(srcH * scale))
        };
    },

    // ===== 渲染 =====

    _renderSource: function() {
        if (!this._srcImg) return;
        var img = this._srcImg;
        var wrap = this._overlay.querySelector('#paSrcWrap');
        var rect = wrap.getBoundingClientRect();
        var maxW = Math.max(100, rect.width - 8);
        var maxH = Math.max(100, rect.height - 8);
        var scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
        var dw = Math.max(1, Math.round(img.naturalWidth * scale));
        var dh = Math.max(1, Math.round(img.naturalHeight * scale));

        this._srcCanvas.width = dw;
        this._srcCanvas.height = dh;
        this._srcCtx.imageSmoothingEnabled = true;
        this._srcCtx.clearRect(0, 0, dw, dh);
        this._srcCtx.drawImage(img, 0, 0, dw, dh);
    },

    _renderResult: function(dstW, dstH, data) {
        var wrap = this._overlay.querySelector('#paDstWrap');
        var rect = wrap.getBoundingClientRect();
        var maxW = Math.max(100, rect.width - 8);
        var maxH = Math.max(100, rect.height - 8);
        var scale = Math.min(maxW / dstW, maxH / dstH);
        var dw = Math.max(1, Math.round(dstW * scale));
        var dh = Math.max(1, Math.round(dstH * scale));

        this._dstCanvas.width = dw;
        this._dstCanvas.height = dh;
        this._dstCtx.imageSmoothingEnabled = false;
        this._dstCtx.clearRect(0, 0, dw, dh);

        // 先画到 1:1 临时画布，再缩放渲染
        var tmp = document.createElement('canvas');
        tmp.width = dstW; tmp.height = dstH;
        var tctx = tmp.getContext('2d');
        for (var y = 0; y < dstH; y++) {
            for (var x = 0; x < dstW; x++) {
                var hex = data[y][x];
                if (!hex) continue;
                tctx.fillStyle = hex;
                tctx.fillRect(x, y, 1, 1);
            }
        }
        this._dstCtx.drawImage(tmp, 0, 0, dw, dh);
    },

    _clearResult: function() {
        if (this._dstCtx) this._dstCtx.clearRect(0, 0, this._dstCanvas.width, this._dstCanvas.height);
        this._resultDataURL = null;
        var btnSave = this._q('#paBtnSaveCanvas');
        var btnDl = this._q('#paBtnDownload');
        if (btnSave) btnSave.disabled = true;
        if (btnDl) btnDl.disabled = true;
    },

    _updateInfo: function(msg) {
        var info = this._overlay ? this._overlay.querySelector('#paInfo') : null;
        if (!info) return;
        if (msg) { info.textContent = msg; return; }
        if (this._srcImg) {
            info.textContent = '原图: ' + this._srcImg.naturalWidth + ' x ' + this._srcImg.naturalHeight;
        } else {
            info.textContent = '准备就绪';
        }
    },

    // ===== 核心算法 =====
    //
    // 关键改进：先量化后下采样
    //   旧流程：下采样（最近邻，跳像素）→ 量化（黑色轮廓已丢失）
    //   新流程：在原图分辨率上量化（黑色轮廓完整）→ 下采样量化后的图
    //
    // 这样即使黑色轮廓只有1-2px，量化时也能被正确识别为独立颜色，
    // 下采样时从已量化的图中取像素，黑色不会丢。

    _executeCalibrate: function() {
        if (!this._srcImg) { this._updateInfo('请先选中一张图片'); return; }
        var self = this;
        var img = this._srcImg;
        var srcW = img.naturalWidth, srcH = img.naturalHeight;
        var ditherMode = this._dither;
        var paletteName = this._palette;

        this._updateInfo('处理中...');

        // 1. 计算目标尺寸
        var dims = this._calcDims();
        var dstW = dims.w, dstH = dims.h;

        // 2. 绘制原图到 canvas，获取原始像素数据
        var srcCanvas = document.createElement('canvas');
        srcCanvas.width = srcW; srcCanvas.height = srcH;
        var srcCtx = srcCanvas.getContext('2d');
        srcCtx.drawImage(img, 0, 0, srcW, srcH);
        var srcImgData = srcCtx.getImageData(0, 0, srcW, srcH);
        var srcData = srcImgData.data;

        // 3. 在原图分辨率上提取调色盘（关键！不丢细线颜色）
        var activePalette = null;
        if (paletteName === 'original') {
            // 不量化
        } else if (paletteName.charAt(0) === 'q') {
            var qColors = parseInt(paletteName.substring(1));
            activePalette = this._medianCut(srcData, qColors);
        } else {
            activePalette = this._PALETTES[paletteName];
        }

        // 4. 生成最终像素数据
        var data; // 最终用于渲染的像素数据 (Uint8ClampedArray)

        if (activePalette) {
            if (ditherMode === 'none') {
                // === 无抖动：先在原图上量化，再下采样 ===
                // 4a. 把原图每个像素映射到调色盘色（带缓存加速）
                var cache = new Map();
                for (var i = 0; i < srcData.length; i += 4) {
                    if (srcData[i + 3] <= 32) continue;
                    var key = (srcData[i] << 16) | (srcData[i + 1] << 8) | srcData[i + 2];
                    if (cache.has(key)) {
                        var c = cache.get(key);
                        srcData[i] = c[0]; srcData[i + 1] = c[1]; srcData[i + 2] = c[2];
                    } else {
                        var mapped = this._findClosest(srcData[i], srcData[i + 1], srcData[i + 2], activePalette);
                        cache.set(key, mapped);
                        srcData[i] = mapped[0]; srcData[i + 1] = mapped[1]; srcData[i + 2] = mapped[2];
                    }
                }
                // 把量化后的数据写回 canvas
                srcCtx.putImageData(srcImgData, 0, 0);
                // 4b. 下采样量化后的图（最近邻，颜色已是干净的）
                var tmpCanvas = document.createElement('canvas');
                tmpCanvas.width = dstW; tmpCanvas.height = dstH;
                var tmpCtx = tmpCanvas.getContext('2d');
                tmpCtx.imageSmoothingEnabled = false;
                tmpCtx.drawImage(srcCanvas, 0, 0, dstW, dstH);
                data = tmpCtx.getImageData(0, 0, dstW, dstH).data;
            } else {
                // === 有抖动：先双线性下采样，再在低分辨率上做抖动+映射 ===
                // 双线性下采样保留细线特征（变暗但不会完全消失）
                var tmpCanvas2 = document.createElement('canvas');
                tmpCanvas2.width = dstW; tmpCanvas2.height = dstH;
                var tmpCtx2 = tmpCanvas2.getContext('2d');
                tmpCtx2.imageSmoothingEnabled = true; // 双线性平均
                tmpCtx2.drawImage(srcCanvas, 0, 0, dstW, dstH);
                data = tmpCtx2.getImageData(0, 0, dstW, dstH).data;
            }
        } else {
            // 不量化：直接双线性下采样
            var tmpCanvas3 = document.createElement('canvas');
            tmpCanvas3.width = dstW; tmpCanvas3.height = dstH;
            var tmpCtx3 = tmpCanvas3.getContext('2d');
            tmpCtx3.imageSmoothingEnabled = true;
            tmpCtx3.drawImage(srcCanvas, 0, 0, dstW, dstH);
            data = tmpCtx3.getImageData(0, 0, dstW, dstH).data;
        }

        // 5. 如果有抖动+调色盘，在下采样数据上做抖动+映射
        var bayerMatrix = null, bayerSize = 0;
        if (activePalette && ditherMode === 'bayer4x4') { bayerMatrix = this._BAYER_4X4; bayerSize = 4; }
        else if (activePalette && ditherMode === 'bayer2x2') { bayerMatrix = this._BAYER_2X2; bayerSize = 2; }

        // 6. 逐像素生成结果
        var resultData = [];
        for (var y = 0; y < dstH; y++) resultData[y] = [];
        for (var py = 0; py < dstH; py++) {
            for (var px = 0; px < dstW; px++) {
                var idx = (py * dstW + px) * 4;
                if (data[idx + 3] <= 32) { resultData[py][px] = null; continue; }
                var r = data[idx], g = data[idx + 1], b = data[idx + 2];
                if (bayerMatrix) {
                    var threshold = (bayerMatrix[py % bayerSize][px % bayerSize] / (bayerSize * bayerSize)) - 0.5;
                    var ditherSpread = 45;
                    r = Math.min(255, Math.max(0, r + threshold * ditherSpread));
                    g = Math.min(255, Math.max(0, g + threshold * ditherSpread));
                    b = Math.min(255, Math.max(0, b + threshold * ditherSpread));
                }
                if (activePalette) {
                    var closest = this._findClosest(r, g, b, activePalette);
                    resultData[py][px] = '#' + [closest[0], closest[1], closest[2]].map(function(v) { return v.toString(16).padStart(2, '0'); }).join('');
                } else {
                    resultData[py][px] = '#' + [r, g, b].map(function(v) { return v.toString(16).padStart(2, '0'); }).join('');
                }
            }
        }

        // 7. 渲染结果预览
        this._renderResult(dstW, dstH, resultData);

        // 8. 生成 dataURL
        var ec = document.createElement('canvas');
        ec.width = dstW; ec.height = dstH;
        var ectx = ec.getContext('2d');
        for (var y2 = 0; y2 < dstH; y2++) {
            for (var x2 = 0; x2 < dstW; x2++) {
                var hex = resultData[y2][x2];
                if (!hex) continue;
                ectx.fillStyle = hex;
                ectx.fillRect(x2, y2, 1, 1);
            }
        }
        this._resultDataURL = ec.toDataURL('image/png');
        this._resultW = dstW;
        this._resultH = dstH;

        // 9. 启用保存/下载按钮
        var btnSave = this._q('#paBtnSaveCanvas');
        var btnDl = this._q('#paBtnDownload');
        if (btnSave) btnSave.disabled = false;
        if (btnDl) btnDl.disabled = false;

        // 10. 显示信息
        var paletteLabel = { original: '原图色彩', q4: '量化4色', q8: '量化8色', q16: '量化16色', q32: '量化32色', q64: '量化64色', p8: 'Pico-8', gameboy: 'GameBoy', nes: 'NES' }[paletteName];
        var ditherLabel = { bayer4x4: 'Bayer4x4', bayer2x2: 'Bayer2x2', none: '无抖动' }[ditherMode];
        var colorInfo = activePalette ? (paletteLabel + '(' + activePalette.length + '色)') : paletteLabel;
        this._updateInfo(dstW + 'x' + dstH + ' | ' + colorInfo + ' | ' + ditherLabel);
    },

    _findClosest: function(r, g, b, palette) {
        var minDist = Infinity, closest = palette[0];
        for (var i = 0; i < palette.length; i++) {
            var c = palette[i];
            var rmean = (r + c[0]) / 2;
            var dr = r - c[0], dg = g - c[1], db = b - c[2];
            var dist = (2 + rmean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rmean) / 256) * db * db;
            if (dist < minDist) { minDist = dist; closest = c; }
        }
        return closest;
    },

    /**
     * 颜色量化：Median Cut 初始化 + K-means 迭代优化
     *
     * 关键改进：
     *   1. 大图采样：超过 5 万像素时按步长采样，不影响精度但大幅提速
     *   2. 分桶策略：按 范围×像素数 选择切分桶，不再只看范围
     *      → 像素多的大桶优先被切，少数色（如黑色轮廓）的小桶不会被忽略
     *   3. K-means 8 轮迭代 + redmean 距离，与最终映射一致
     *   4. 空聚类复活：某色没人认领时，找最大桶重新分裂
     */
    _medianCut: function(data, maxColors) {
        // 1. 收集不透明像素（大图采样）
        var totalPx = data.length / 4;
        var step = 4;
        if (totalPx > 50000) {
            step = Math.ceil(totalPx / 50000) * 4;
        }
        var pixels = [];
        for (var i = 0; i < data.length; i += step) {
            if (data[i + 3] > 32) pixels.push([data[i], data[i + 1], data[i + 2]]);
        }
        if (!pixels.length) return [[0, 0, 0], [255, 255, 255]];
        if (pixels.length <= maxColors) {
            var uniq = [];
            for (var ui = 0; ui < pixels.length; ui++) {
                var found = false;
                for (var uj = 0; uj < uniq.length; uj++) {
                    if (uniq[uj][0] === pixels[ui][0] && uniq[uj][1] === pixels[ui][1] && uniq[uj][2] === pixels[ui][2]) { found = true; break; }
                }
                if (!found) uniq.push(pixels[ui]);
            }
            return uniq;
        }

        // 2. Median Cut 初始化分桶（按 范围×像素数 选择切分桶）
        var buckets = [pixels];
        while (buckets.length < maxColors) {
            var bestIdx = -1, bestScore = -1;
            for (var bi = 0; bi < buckets.length; bi++) {
                var bucket = buckets[bi];
                if (bucket.length < 2) continue;
                var mnR = 255, mxR = 0, mnG = 255, mxG = 0, mnB = 255, mxB = 0;
                for (var pj = 0; pj < bucket.length; pj++) {
                    var p = bucket[pj];
                    if (p[0] < mnR) mnR = p[0]; if (p[0] > mxR) mxR = p[0];
                    if (p[1] < mnG) mnG = p[1]; if (p[1] > mxG) mxG = p[1];
                    if (p[2] < mnB) mnB = p[2]; if (p[2] > mxB) mxB = p[2];
                }
                var range = Math.max(mxR - mnR, mxG - mnG, mxB - mnB);
                // 关键：score = range * count，像素多的大桶优先切
                var score = range * bucket.length;
                if (score > bestScore) { bestScore = score; bestIdx = bi; }
            }
            if (bestIdx === -1) break;
            var target = buckets[bestIdx];
            var tR = 255, TR = 0, tG = 255, TG = 0, tB = 255, TB = 0;
            for (var tk = 0; tk < target.length; tk++) {
                var tp = target[tk];
                if (tp[0] < tR) tR = tp[0]; if (tp[0] > TR) TR = tp[0];
                if (tp[1] < tG) tG = tp[1]; if (tp[1] > TG) TG = tp[1];
                if (tp[2] < tB) tB = tp[2]; if (tp[2] > TB) TB = tp[2];
            }
            var ranges = [TR - tR, TG - tG, TB - tB];
            var ch = 0;
            if (ranges[1] > ranges[0]) ch = 1;
            if (ranges[2] > ranges[ch]) ch = 2;
            target.sort(function(a, b) { return a[ch] - b[ch]; });
            var mid = target.length >> 1;
            buckets.splice(bestIdx, 1, target.slice(0, mid), target.slice(mid));
        }

        // 3. 每个桶取平均值作为初始调色盘
        var palette = [];
        for (var fi = 0; fi < buckets.length; fi++) {
            var bk = buckets[fi];
            if (!bk.length) continue;
            var sR = 0, sG = 0, sB = 0;
            for (var fk = 0; fk < bk.length; fk++) {
                sR += bk[fk][0]; sG += bk[fk][1]; sB += bk[fk][2];
            }
            palette.push([
                Math.round(sR / bk.length),
                Math.round(sG / bk.length),
                Math.round(sB / bk.length)
            ]);
        }
        if (!palette.length) return [[0, 0, 0], [255, 255, 255]];

        // 4. K-means 迭代优化（8轮，使用 redmean 距离与最终映射一致）
        var numColors = palette.length;
        for (var iter = 0; iter < 8; iter++) {
            var sums = [];
            for (var ci = 0; ci < numColors; ci++) sums.push([0, 0, 0, 0]);

            for (var si = 0; si < pixels.length; si++) {
                var pr = pixels[si][0], pg = pixels[si][1], pb = pixels[si][2];
                var bestP = 0, bestD = Infinity;
                for (var pi = 0; pi < numColors; pi++) {
                    var c = palette[pi];
                    var rmean = (pr + c[0]) / 2;
                    var dr = pr - c[0], dg = pg - c[1], db = pb - c[2];
                    var d = (2 + rmean / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rmean) / 256) * db * db;
                    if (d < bestD) { bestD = d; bestP = pi; }
                }
                sums[bestP][0] += pr;
                sums[bestP][1] += pg;
                sums[bestP][2] += pb;
                sums[bestP][3]++;
            }

            var changed = false;
            for (var pi = 0; pi < numColors; pi++) {
                if (sums[pi][3] > 0) {
                    var nr = Math.round(sums[pi][0] / sums[pi][3]);
                    var ng = Math.round(sums[pi][1] / sums[pi][3]);
                    var nb = Math.round(sums[pi][2] / sums[pi][3]);
                    if (nr !== palette[pi][0] || ng !== palette[pi][1] || nb !== palette[pi][2]) {
                        palette[pi] = [nr, ng, nb];
                        changed = true;
                    }
                } else {
                    // 空聚类复活：找像素最多的桶，从中分裂
                    var maxIdx = 0, maxCount = 0;
                    for (var mi = 0; mi < numColors; mi++) {
                        if (sums[mi][3] > maxCount) { maxCount = sums[mi][3]; maxIdx = mi; }
                    }
                    if (maxCount > 1) {
                        palette[pi] = [
                            Math.round(sums[maxIdx][0] / sums[maxIdx][3]) + 20,
                            Math.round(sums[maxIdx][1] / sums[maxIdx][3]) - 10,
                            Math.round(sums[maxIdx][2] / sums[maxIdx][3]) - 10
                        ];
                        palette[pi][0] = Math.max(0, Math.min(255, palette[pi][0]));
                        palette[pi][1] = Math.max(0, Math.min(255, palette[pi][1]));
                        palette[pi][2] = Math.max(0, Math.min(255, palette[pi][2]));
                        changed = true;
                    }
                }
            }
            if (!changed) break; // 收敛了，提前退出
        }

        return palette;
    },

    // ===== 保存 / 下载 =====

    _saveToCanvas: function() {
        if (!this._resultDataURL) return;
        var parentId = (typeof CanvasImages !== 'undefined') ? CanvasImages.getSelectedId() : null;
        var name = '像素对齐 ' + this._resultW + 'x' + this._resultH + ' ' + new Date().toLocaleTimeString();
        if (typeof CanvasImages !== 'undefined') {
            CanvasImages.place(this._resultDataURL, null, null, name, parentId);
        }
        if (typeof showToast === 'function') showToast('已保存到画布');
    },

    _downloadResult: function() {
        if (!this._resultDataURL) return;
        var link = document.createElement('a');
        link.download = 'pixel-align_' + this._resultW + 'x' + this._resultH + '.png';
        link.href = this._resultDataURL;
        link.click();
    }
};
