/**
 * 九宫切片技能 - v65 插件
 *
 * 功能：
 *   - 图片上传
 *   - 4条彩色切片线拖拽调整
 *   - 实时9宫格预览 + 自定义宽高
 *   - 导出PNG
 */

// ===== CSS =====
(function(){
var s = document.createElement('style');
s.textContent =
'.ns-overlay{position:fixed;width:950px;height:620px;z-index:9999;display:flex;flex-direction:column;' +
  'background:#1a1a2e;color:#e8edf5;font-family:"Segoe UI",system-ui,sans-serif;' +
  'border-radius:12px;box-shadow:0 8px 40px rgba(0,0,0,.6);user-select:none;' +
  'min-width:600px;min-height:400px;overflow:hidden;}' +

'.ns-header{flex-shrink:0;display:flex;cursor:move;}' +
'.ns-hside{flex:1;min-width:0;display:flex;align-items:center;gap:4px;padding:8px 10px;}' +
'.ns-hside:last-child{justify-content:flex-end;}' +
'.ns-hside:first-child{background:linear-gradient(180deg,#1e0f12,#16213e);border-bottom:1px solid #4a1a28;}' +
'.ns-hside:last-child{background:linear-gradient(180deg,#0f1a2e,#16213e);border-bottom:1px solid #1a3a6a;' +
  'justify-content:flex-end;}' +
'.ns-hside+.ns-hside{border-left:1px solid rgba(255,255,255,.06)}' +

'.ns-body{display:flex;flex:1;overflow:hidden;min-height:0;}' +

'.ns-panel{flex:1;min-width:0;display:flex;flex-direction:column;}' +
'.ns-panel:first-child{border-right:1px solid #3a1520;}' +

'.ns-editor-wrap{flex:1;position:relative;overflow:hidden;background:#0d0d1a;}' +
'.ns-editor-wrap canvas{display:block;box-shadow:0 2px 20px rgba(0,0,0,.6);}' +

'.ns-preview-wrap{flex:1;position:relative;overflow:hidden;' +
  'background:repeating-conic-gradient(#2a2a3a 0% 25%,transparent 0% 50%) 0 0/20px 20px;}' +
'.ns-preview-wrap canvas{display:block;box-shadow:0 2px 20px rgba(0,0,0,.5);border-radius:4px;}' +

'.ns-footer{flex-shrink:0;padding:12px 18px;font-size:14px;display:flex;}' +
'.ns-footer-left{background:#1a0a0a;border-top:1px solid #3a1520;color:#ddd;justify-content:space-between;}' +
'.ns-footer-right{background:#0a1a2a;border-top:1px solid #1a3a6a;color:#ddd;justify-content:center;}' +

'.ns-h1{font-size:16px;font-weight:600;color:#e94560;white-space:nowrap;margin:0;}' +

'.ns-file-label{padding:5px 12px;background:#c0392b;color:#fff;border-radius:6px;cursor:pointer;font-size:13px;transition:.2s;}' +
'.ns-file-label:hover{background:#c73650}' +

'.ns-btn{padding:5px 12px;background:#0f3460;border:1px solid #1a4a8a;border-radius:5px;color:#ccc;' +
  'cursor:pointer;font-size:13px;transition:.2s;}' +
'.ns-btn:hover{background:#1a4a8a;color:#fff}' +
'.ns-btn-danger{background:#c0392b;border-color:#c0392b;color:#fff}' +
'.ns-btn-danger:hover{background:#c73650}' +
'.ns-btn-blue{background:#0a1f3a;border-color:#1a5a9a;color:#b0d0f0}' +
'.ns-btn-blue:hover{background:#1a4a8a;color:#fff}' +

'.ns-ctrl{display:inline-flex;align-items:center;gap:4px}' +
'.ns-input{width:52px;padding:4px 6px;border-radius:4px;color:#eee;font-size:13px;text-align:center;outline:none;}' +
'.ns-input-red{background:#1a0a0a;border:1px solid #5a1a1a;}' +
'.ns-input-red:focus{border-color:#e74c3c}' +
'.ns-input-blue{background:transparent;border:1px solid #444;}' +
'.ns-input-blue:focus{border-color:#666}' +
'.ns-dim-input{width:68px;padding:4px 6px;background:transparent;border:1px solid #444;' +
  'border-radius:4px;color:#eee;font-size:14px;text-align:center;outline:none}' +
'.ns-dim-input:focus{border-color:#666}' +
'.ns-color-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0;}' +

'.ns-resize-handle{position:absolute;z-index:9200;}' +
'.ns-rh-nw{top:-3px;left:-3px;width:12px;height:12px;cursor:nwse-resize;}' +
'.ns-rh-ne{top:-3px;right:-3px;width:12px;height:12px;cursor:nesw-resize;}' +
'.ns-rh-sw{bottom:-3px;left:-3px;width:12px;height:12px;cursor:nesw-resize;}' +
'.ns-rh-se{bottom:-3px;right:-3px;width:12px;height:12px;cursor:nwse-resize;}' +
'.ns-rh-n{top:-3px;left:3px;right:3px;height:8px;cursor:ns-resize;}' +
'.ns-rh-s{bottom:-3px;left:3px;right:3px;height:8px;cursor:ns-resize;}' +
'.ns-rh-w{left:-3px;top:3px;bottom:3px;width:8px;cursor:ew-resize;}' +
'.ns-rh-e{right:-3px;top:3px;bottom:3px;width:8px;cursor:ew-resize;}' +
'::-webkit-scrollbar{width:6px}' +
'::-webkit-scrollbar-track{background:transparent}' +
'::-webkit-scrollbar-thumb{background:rgba(56,189,248,0.2);border-radius:3px}';
document.head.appendChild(s);
})();

var NineSliceSkill = {

    id: 'nine-slice',
    name: '九宫切片',
    icon: '切',
    category: '图片处理',
    description: '九宫格切片 - 拖拽彩线调整边距，实时预览缩放电导出',

    _world: null,
    _overlay: null,
    _onHeaderDown: null,

    _img: null,
    _margins: { top: 20, bottom: 20, left: 20, right: 20 },
    _previewW: 300,
    _previewH: 300,
    _dragLine: null,
    _dragStartPos: 0,
    _dragStartVal: 0,
    _zoom: 1,
    _previewZoom: 1,
    _panX: 0,
    _panY: 0,
    _isPanning: false,
    _panStartX: 0,
    _panStartY: 0,
    _panStartOffX: 0,
    _panStartOffY: 0,

    destroy: function() {
        if (this._onDocMove) document.removeEventListener('mousemove', this._onDocMove);
        if (this._onDocUp) document.removeEventListener('mouseup', this._onDocUp);
        if (this._onKeyDown) document.removeEventListener('keydown', this._onKeyDown);
        if (this._onKeyUp) document.removeEventListener('keyup', this._onKeyUp);
        if (this._onHeaderDown) document.removeEventListener('mousedown', this._onHeaderDown, true);
        if (this._resizeObs) { this._resizeObs.disconnect(); this._resizeObs = null; }
        if (this._overlay && this._overlay.parentNode) {
            this._overlay.parentNode.removeChild(this._overlay);
        }
        this._overlay = null;
        this._img = null;
    },

    // ===== 生命周期 =====

    activate: function(world) {
        this._world = world;
        if (this._overlay) {
            if (!this._overlay.parentNode) document.body.appendChild(this._overlay);
            SkillSystem.renderSubTools();
            return;
        }
        this._createUI();
        SkillSystem.renderSubTools();
    },

    deactivate: function() {},

    getSubTools: function() {
        var self = this;
        return [
            { label: '关', action: function() { self.destroy(); } }
        ];
    },

    save: function() {
        return {
            margins: this._margins,
            previewW: this._previewW,
            previewH: this._previewH,
            zoom: this._zoom,
            panX: this._panX,
            panY: this._panY
        };
    },

    load: function(data) {
        if (data) {
            if (data.margins) this._margins = data.margins;
            if (data.previewW) this._previewW = data.previewW;
            if (data.previewH) this._previewH = data.previewH;
            if (data.zoom) this._zoom = data.zoom;
            if (data.panX) this._panX = data.panX;
            if (data.panY) this._panY = data.panY;
        }
    },

    // ========================================
    //   UI
    // ========================================

    _clamp: function(v, min, max) { return Math.max(min, Math.min(max, v)); },

    _createUI: function() {
        var self = this;

        var ov = document.createElement('div');
        ov.className = 'ns-overlay';
        ov.setAttribute('data-skill-id', 'nine-slice');
        ov.style.left = Math.max(20, (window.innerWidth - 920) / 2) + 'px';
        ov.style.top = Math.max(20, (window.innerHeight - 620) / 2) + 'px';

        // ===== Header (two sides) =====
        var header = document.createElement('div');
        header.className = 'ns-header';

        // Left header
        var hsL = document.createElement('div');
        hsL.className = 'ns-hside';
        hsL.innerHTML =
            '<h1 class="ns-h1">九宫切片</h1>' +
            '<label class="ns-file-label" id="nsUploadLabel">选图</label>' +
            '<input type="file" id="nsFileInput" accept="image/*" style="display:none">' +
            '<div class="ns-ctrl"><span class="ns-color-dot" style="background:#ff4757"></span><input type="number" class="ns-input ns-input-red" id="nsMarginT" min="0" value="20"></div>' +
            '<div class="ns-ctrl"><span class="ns-color-dot" style="background:#ffa502"></span><input type="number" class="ns-input ns-input-red" id="nsMarginB" min="0" value="20"></div>' +
            '<div class="ns-ctrl"><span class="ns-color-dot" style="background:#1e90ff"></span><input type="number" class="ns-input ns-input-red" id="nsMarginL" min="0" value="20"></div>' +
            '<div class="ns-ctrl"><span class="ns-color-dot" style="background:#2ed573"></span><input type="number" class="ns-input ns-input-red" id="nsMarginR" min="0" value="20"></div>' +
            '<button class="ns-btn ns-btn-danger" id="nsResetSliceBtn" style="padding:5px 12px;font-size:13px">重置</button>';
        header.appendChild(hsL);

        // Right header
        var hsR = document.createElement('div');
        hsR.className = 'ns-hside';
        hsR.innerHTML =
            '<span id="nsImgInfo" style="font-size:11px;color:#6a9fc0;margin-right:auto"></span>' +
            '<span style="font-size:12px;color:#aaa">宽</span>' +
            '<div class="ns-ctrl"><input type="number" class="ns-dim-input" id="nsPW" min="1" value="300"></div>' +
            '<span style="font-size:12px;color:#aaa">高</span>' +
            '<div class="ns-ctrl"><input type="number" class="ns-dim-input" id="nsPH" min="1" value="300"></div>' +
            '<button class="ns-btn ns-btn-blue" id="nsResetPreviewBtn">重置</button>' +
            '<button class="ns-btn ns-btn-blue" id="nsExportBtn">导出</button>' +
            '<button class="ns-btn" id="nsCloseBtn" style="background:rgba(220,80,60,.2);border-color:rgba(220,80,60,.3);color:#e87060;margin-left:4px">关</button>';
        header.appendChild(hsR);
        ov.appendChild(header);

        // ===== Body (two panels) =====
        var body = document.createElement('div');
        body.className = 'ns-body';

        // Left panel (editor)
        var pL = document.createElement('div');
        pL.className = 'ns-panel';
        var editorWrap = document.createElement('div');
        editorWrap.className = 'ns-editor-wrap';
        editorWrap.id = 'nsEditorWrap';
        var editorCanvas = document.createElement('canvas');
        editorCanvas.id = 'nsEditorCanvas';
        editorWrap.appendChild(editorCanvas);
        pL.appendChild(editorWrap);
        var fL = document.createElement('div');
        fL.className = 'ns-footer ns-footer-left';
        fL.innerHTML = '<span style="color:#e74c3c;font-weight:600">滚轮缩放</span><span>① 选择图片  ·  ② 拖拽彩线调整切片</span>';
        pL.appendChild(fL);
        body.appendChild(pL);

        // Right panel (preview)
        var pR = document.createElement('div');
        pR.className = 'ns-panel';
        var previewWrap = document.createElement('div');
        previewWrap.className = 'ns-preview-wrap';
        previewWrap.id = 'nsPreviewWrap';
        var previewCanvas = document.createElement('canvas');
        previewCanvas.id = 'nsPreviewCanvas';
        previewWrap.appendChild(previewCanvas);
        pR.appendChild(previewWrap);
        var fR = document.createElement('div');
        fR.className = 'ns-footer ns-footer-right';
        fR.innerHTML = '<span>① 输入宽高调整尺寸  ·  ② 导出</span>';
        pR.appendChild(fR);
        body.appendChild(pR);

        ov.appendChild(body);
        document.body.appendChild(ov);
        this._overlay = ov;

        // Resize handles (all 4 corners + 4 edges)
        var handles = ['nw','n','ne','e','se','s','sw','w'];
        for (var hi = 0; hi < handles.length; hi++) {
            var rh = document.createElement('div');
            rh.className = 'ns-resize-handle ns-rh-' + handles[hi];
            rh.dataset.rh = handles[hi];
            ov.appendChild(rh);
        }

        // Store canvas refs
        this._editorCanvas = editorCanvas;
        this._editorCtx = editorCanvas.getContext('2d');
        this._previewCanvas = previewCanvas;
        this._previewCtx = previewCanvas.getContext('2d');

        // Bind events
        this._bindEvents(ov);

        // Sync UI inputs to state
        this._syncInputsToState();

        // Draw hints
        this._drawHints();
    },

    _syncInputsToState: function() {
        var ov = this._overlay;
        ov.querySelector('#nsMarginT').value = this._margins.top;
        ov.querySelector('#nsMarginB').value = this._margins.bottom;
        ov.querySelector('#nsMarginL').value = this._margins.left;
        ov.querySelector('#nsMarginR').value = this._margins.right;
        ov.querySelector('#nsPW').value = this._previewW;
        ov.querySelector('#nsPH').value = this._previewH;
    },

    // ========================================
    //   Events
    // ========================================

    _bindEvents: function(ov) {
        var self = this;

        // Close
        ov.querySelector('#nsCloseBtn').addEventListener('click', function() {
            self.destroy();
        });

        // === Resize handles ===
        var _rh = null, _rhStartX, _rhStartY, _rhRect;
        function onResizeStart(e, handle) {
            _rh = handle;
            _rhStartX = e.clientX;
            _rhStartY = e.clientY;
            _rhRect = ov.getBoundingClientRect();
            e.preventDefault();
        }
        ov.querySelectorAll('.ns-resize-handle').forEach(function(el) {
            el.addEventListener('mousedown', function(e) {
                onResizeStart(e, el.dataset.rh);
            });
        });

        // Header drag
        this._onHeaderDown = function(e) {
            var h = ov.querySelector('.ns-header');
            if (!h.contains(e.target)) return;
            if (e.target.closest('button,label,input')) return;
            e.preventDefault();
            var sx = e.clientX, sy = e.clientY;
            var r = ov.getBoundingClientRect();
            var ol = r.left, ot = r.top;
            function onMove(ev) {
                ov.style.left = (ol + ev.clientX - sx) + 'px';
                ov.style.top = (ot + ev.clientY - sy) + 'px';
            }
            function onUp() {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
            }
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        };
        document.addEventListener('mousedown', this._onHeaderDown, true);

        // Upload
        ov.querySelector('#nsUploadLabel').addEventListener('click', function() {
            ov.querySelector('#nsFileInput').click();
        });
        ov.querySelector('#nsFileInput').addEventListener('change', function(e) {
            if (e.target.files.length > 0) self._loadFile(e.target.files[0]);
        });

        // Margin inputs
        function readMargins() {
            self._margins.top = self._clamp(parseInt(ov.querySelector('#nsMarginT').value)||0,0,999);
            self._margins.bottom = self._clamp(parseInt(ov.querySelector('#nsMarginB').value)||0,0,999);
            self._margins.left = self._clamp(parseInt(ov.querySelector('#nsMarginL').value)||0,0,999);
            self._margins.right = self._clamp(parseInt(ov.querySelector('#nsMarginR').value)||0,0,999);
        }
        function syncMargins() {
            ov.querySelector('#nsMarginT').value = self._margins.top;
            ov.querySelector('#nsMarginB').value = self._margins.bottom;
            ov.querySelector('#nsMarginL').value = self._margins.left;
            ov.querySelector('#nsMarginR').value = self._margins.right;
        }
        function onMarginChange() {
            if (!self._img) return;
            readMargins();
            self._applyMinSize();
            var r = ov.querySelector('#nsPreviewWrap').getBoundingClientRect();
            self._previewZoom = Math.min(1, r.width/self._previewW, r.height/self._previewH);
    self._calcEditorLayout();
    self._drawPreview();
        }
        ov.querySelector('#nsMarginT').addEventListener('input', onMarginChange);
        ov.querySelector('#nsMarginB').addEventListener('input', onMarginChange);
        ov.querySelector('#nsMarginL').addEventListener('input', onMarginChange);
        ov.querySelector('#nsMarginR').addEventListener('input', onMarginChange);

        // Preview size inputs
        function onSizeInput() {
            if (!self._img) return;
            var pw = ov.querySelector('#nsPW'), ph = ov.querySelector('#nsPH');
            var nw = parseInt(pw.value), nh = parseInt(ph.value);
            self._previewW = self._clamp(nw||1,1,10000);
            self._previewH = self._clamp(nh||1,1,10000);
            if (!isNaN(nw)) pw.value = self._previewW;
            if (!isNaN(nh)) ph.value = self._previewH;
            self._drawPreview();
        }
        function onSizeBlur() {
            if (!self._img) return;
            var pw = ov.querySelector('#nsPW'), ph = ov.querySelector('#nsPH');
            var nw = parseInt(pw.value), nh = parseInt(ph.value);
            self._previewW = self._clamp(nw||1,1,10000);
            self._previewH = self._clamp(nh||1,1,10000);
            self._applyMinSize();
            var r = ov.querySelector('#nsPreviewWrap').getBoundingClientRect();
            self._previewZoom = Math.min(1, r.width/self._previewW, r.height/self._previewH);
            self._drawPreview();
        }
        ov.querySelector('#nsPW').addEventListener('input', onSizeInput);
        ov.querySelector('#nsPW').addEventListener('blur', onSizeBlur);
        ov.querySelector('#nsPW').addEventListener('focus', function() { this.select(); });
        ov.querySelector('#nsPH').addEventListener('input', onSizeInput);
        ov.querySelector('#nsPH').addEventListener('blur', onSizeBlur);
        ov.querySelector('#nsPH').addEventListener('focus', function() { this.select(); });

        // Reset slice
        ov.querySelector('#nsResetSliceBtn').addEventListener('click', function() {
            if (!self._img) return;
            var iw = self._img.naturalWidth, ih = self._img.naturalHeight;
            self._margins = {top:Math.round(ih*0.1),bottom:Math.round(ih*0.1),left:Math.round(iw*0.1),right:Math.round(iw*0.1)};
            syncMargins();
            self._applyMinSize();
            self._calcEditorLayout();
            self._drawPreview();
        });

        // Reset preview
        ov.querySelector('#nsResetPreviewBtn').addEventListener('click', function() {
            if (!self._img) return;
            self._previewW = self._img.naturalWidth;
            self._previewH = self._img.naturalHeight;
            ov.querySelector('#nsPW').value = self._previewW;
            ov.querySelector('#nsPH').value = self._previewH;
            var r = ov.querySelector('#nsPreviewWrap').getBoundingClientRect();
            self._previewZoom = Math.min(1, r.width/self._previewW, r.height/self._previewH);
            self._drawPreview();
        });

        // Export
        ov.querySelector('#nsExportBtn').addEventListener('click', function() {
            if (!self._img) return;
            self._export();
        });

        // === Editor: zoom ===
        var editorWrap = ov.querySelector('#nsEditorWrap');
        editorWrap.addEventListener('wheel', function(e) {
            if (!self._img) return;
            e.preventDefault();
            var delta = -Math.sign(e.deltaY)*0.1;
            var oldZ = self._zoom;
            self._zoom = self._clamp(self._zoom + delta, 0.1, 20);
            if (self._zoom === oldZ) return;

            var r = editorWrap.getBoundingClientRect();
            var mx = e.clientX - r.left, my = e.clientY - r.top;
            var iw = self._img.naturalWidth, ih = self._img.naturalHeight;
            var fitScale = Math.min(r.width/iw, r.height/ih);
            var oldTotal = fitScale * oldZ;
            var newTotal = fitScale * self._zoom;
            var oldCw = Math.max(iw*oldTotal, r.width);
            var oldCh = Math.max(ih*oldTotal, r.height);
            var oldOx = (oldCw - iw*oldTotal)/2 + self._panX;
            var oldOy = (oldCh - ih*oldTotal)/2 + self._panY;
            var imgX = (mx - oldOx) / oldTotal;
            var imgY = (my - oldOy) / oldTotal;

            self._calcEditorLayout();

            var newCw = Math.max(iw*newTotal, r.width);
            var newCh = Math.max(ih*newTotal, r.height);
            var newOx = (newCw - iw*newTotal)/2;
            var newOy = (newCh - ih*newTotal)/2;
            self._panX = mx - (imgX * newTotal + newOx);
            self._panY = my - (imgY * newTotal + newOy);
            self._panStartOffX = self._panX;
            self._panStartOffY = self._panY;
        }, {passive:false});

        // === Editor: pan (middle button / space) ===
        editorWrap.addEventListener('mousedown', function(e) {
            if (e.button === 1 || (e.button === 0 && self._isPanning)) {
                if (e.button === 1) self._isPanning = true;
                self._panStartX = e.clientX; self._panStartY = e.clientY;
                self._panStartOffX = self._panX; self._panStartOffY = self._panY;
                editorWrap.style.cursor = 'grabbing'; e.preventDefault();
            }
        });

        // === Editor: slice line drag ===
        self._editorCanvas.addEventListener('mousedown', function(e) {
            if (!self._img || self._isPanning || e.button !== 0) return;
            var r = self._editorCanvas.getBoundingClientRect();
            var mx = e.clientX-r.left, my = e.clientY-r.top;
            var s = self._drawScale, ox = self._drawOffX, oy = self._drawOffY;
            var iw = self._img.naturalWidth, ih = self._img.naturalHeight, m = self._margins, th = 10;

            var lines = {top: oy+m.top*s, bottom: oy+(ih-m.bottom)*s, left: ox+m.left*s, right: ox+(iw-m.right)*s};
            var best = null, bestD = Infinity;
            for (var key in lines) {
                var lpos = lines[key];
                var dist = (key==='top'||key==='bottom') ? Math.abs(my-lpos) : Math.abs(mx-lpos);
                if (dist < th && dist < bestD) {
                    var inRange = (key==='top'||key==='bottom') ? (mx>=ox&&mx<=ox+iw*s) : (my>=oy&&my<=oy+ih*s);
                    if (inRange) { bestD=dist; best=key; }
                }
            }
            if (best) {
                self._dragLine = best;
                self._dragStartPos = (best==='top'||best==='bottom') ? my : mx;
                self._dragStartVal = self._margins[best];
                self._editorCanvas.style.cursor = (best==='top'||best==='bottom') ? 'ns-resize' : 'ew-resize';
                e.preventDefault();
            }
        });

        // === Global mouse ===
        self._onDocMove = function(e) {
            if (_rh) {
                var dx = e.clientX - _rhStartX;
                var dy = e.clientY - _rhStartY;
                var l = _rhRect.left, t = _rhRect.top, r = _rhRect.right, b = _rhRect.bottom;
                var minW = 600, minH = 400;
                if (_rh.indexOf('w') >= 0) { l = Math.min(r - minW, _rhRect.left + dx); }
                if (_rh.indexOf('e') >= 0) { r = Math.max(l + minW, _rhRect.right + dx); }
                if (_rh.indexOf('n') >= 0) { t = Math.min(b - minH, _rhRect.top + dy); }
                if (_rh.indexOf('s') >= 0) { b = Math.max(t + minH, _rhRect.bottom + dy); }
                ov.style.left = l + 'px';
                ov.style.top = t + 'px';
                ov.style.width = (r - l) + 'px';
                ov.style.height = (b - t) + 'px';
                if (self._img) { self._calcEditorLayout(); self._drawPreview(); }
                return;
            }
            if (self._isPanning) {
                self._panX = self._panStartOffX + (e.clientX - self._panStartX);
                self._panY = self._panStartOffY + (e.clientY - self._panStartY);
                self._calcEditorLayout();
                self._drawPreview();
                return;
            }
            if (self._dragLine && self._img) {
                var r = self._editorCanvas.getBoundingClientRect();
                var mx = e.clientX-r.left, my = e.clientY-r.top, s = self._drawScale;
                var iw = self._img.naturalWidth, ih = self._img.naturalHeight;
                var pd = (self._dragLine==='top'||self._dragLine==='bottom') ? (my - self._dragStartPos)/s : (mx - self._dragStartPos)/s;
                var nv = Math.round(self._dragStartVal + (self._dragLine==='bottom'||self._dragLine==='right' ? -pd : pd));
                var m = self._margins;
                if (self._dragLine==='top') nv = self._clamp(nv,0,ih-m.bottom-10);
                else if (self._dragLine==='bottom') nv = self._clamp(nv,0,ih-m.top-10);
                else if (self._dragLine==='left') nv = self._clamp(nv,0,iw-m.right-10);
                else if (self._dragLine==='right') nv = self._clamp(nv,0,iw-m.left-10);
                m[self._dragLine] = nv;
                ov.querySelector('#nsMarginT').value = m.top;
                ov.querySelector('#nsMarginB').value = m.bottom;
                ov.querySelector('#nsMarginL').value = m.left;
                ov.querySelector('#nsMarginR').value = m.right;
                self._calcEditorLayout();
                self._drawPreview();
            }
        };
        self._onDocUp = function() {
            _rh = null;
            self._isPanning = false;
            (ov.querySelector('#nsEditorWrap')||{}).style.cursor = '';
            self._dragLine = null;
            self._editorCanvas.style.cursor = 'default';
        };
        document.addEventListener('mousemove', self._onDocMove);
        document.addEventListener('mouseup', self._onDocUp);

        // Space pan
        self._onKeyDown = function(e) {
            if (e.code === 'Space' && !e.repeat && document.activeElement && document.activeElement.tagName !== 'INPUT') {
                self._isPanning = true;
                (ov.querySelector('#nsEditorWrap')||{}).style.cursor = 'grab';
                e.preventDefault();
            }
        };
        self._onKeyUp = function(e) {
            if (e.code === 'Space') {
                self._isPanning = false;
                (ov.querySelector('#nsEditorWrap')||{}).style.cursor = '';
            }
        };
        document.addEventListener('keydown', self._onKeyDown);
        document.addEventListener('keyup', self._onKeyUp);

        // ResizeObserver
        self._resizeObs = new ResizeObserver(function() {
            if (self._img) { self._calcEditorLayout(); self._drawPreview(); }
            else self._drawHints();
        });
        self._resizeObs.observe(editorWrap);
        self._resizeObs.observe(ov.querySelector('#nsPreviewWrap'));
    },

    // ========================================
    //   Image loading
    // ========================================

    _loadFile: function(file) {
        var self = this;
        var reader = new FileReader();
        reader.onload = function(e) {
            var raw = new Image();
            raw.onload = function() {
                self._trimTransparency(raw, function(img) {
                    self._setupImage(img);
                });
            };
            raw.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    _trimTransparency: function(img, cb) {
        var c = document.createElement('canvas');
        var ctx = c.getContext('2d');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        var d = ctx.getImageData(0, 0, c.width, c.height);
        var p = d.data, w = c.width, h = c.height;
        var t = h, b = 0, l = w, r = 0;
        for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
            if (p[(y*w+x)*4+3] > 0) { t = Math.min(t,y); b = Math.max(b,y); l = Math.min(l,x); r = Math.max(r,x); }
        }
        if (t > b || l > r || (t === 0 && b === h-1 && l === 0 && r === w-1)) { cb(img); return; }
        var c2 = document.createElement('canvas');
        c2.width = r-l+1; c2.height = b-t+1;
        c2.getContext('2d').drawImage(img, l, t, c2.width, c2.height, 0, 0, c2.width, c2.height);
        var out = new Image();
        out.onload = function() { cb(out); };
        out.src = c2.toDataURL('image/png');
    },

    _setupImage: function(img) {
        this._img = img;
        this._zoom = 1;
        this._panX = 0;
        this._panY = 0;
        this._panStartOffX = 0;
        this._panStartOffY = 0;
        var iw = img.naturalWidth, ih = img.naturalHeight;
        this._margins = {top:Math.round(ih*0.1),bottom:Math.round(ih*0.1),left:Math.round(iw*0.1),right:Math.round(iw*0.1)};
        this._previewW = iw;
        this._previewH = ih;
        var r = this._overlay.querySelector('#nsPreviewWrap').getBoundingClientRect();
        this._previewZoom = Math.min(1, r.width/this._previewW, r.height/this._previewH);
        this._overlay.querySelector('#nsImgInfo').textContent = iw+' x '+ih;

        this._syncInputsToState();
        this._applyMinSize();
        this._calcEditorLayout();
        this._drawPreview();
    },

    _applyMinSize: function() {
        var m = this._margins;
        var minW = m.left + m.right + 4;
        var minH = m.top + m.bottom + 4;
        this._previewW = Math.max(this._previewW, minW);
        this._previewH = Math.max(this._previewH, minH);
        var pw = this._overlay.querySelector('#nsPW');
        var ph = this._overlay.querySelector('#nsPH');
        if (!isNaN(parseInt(pw.value))) pw.value = this._previewW;
        if (!isNaN(parseInt(ph.value))) ph.value = this._previewH;
    },

    // ========================================
    //   Editor rendering
    // ========================================

    _calcEditorLayout: function() {
        if (!this._img) return;
        var wrap = this._overlay.querySelector('#nsEditorWrap');
        var rect = wrap.getBoundingClientRect();
        var viewW = rect.width, viewH = rect.height;
        if (viewW <= 0 || viewH <= 0) return;

        var iw = this._img.naturalWidth, ih = this._img.naturalHeight;
        var fitScale = Math.min(viewW/iw, viewH/ih);
        var totalScale = fitScale * this._zoom;
        var cw = Math.max(iw*totalScale, viewW);
        var ch = Math.max(ih*totalScale, viewH);

        this._drawScale = totalScale;
        this._drawOffX = (cw - iw*totalScale)/2 + this._panX;
        this._drawOffY = (ch - ih*totalScale)/2 + this._panY;

        var dpr = window.devicePixelRatio || 1;
        this._editorCanvas.width = cw * dpr;
        this._editorCanvas.height = ch * dpr;
        this._editorCanvas.style.width = cw + 'px';
        this._editorCanvas.style.height = ch + 'px';
        var ctx = this._editorCtx;
        ctx.setTransform(dpr,0,0,dpr,0,0);

        ctx.fillStyle = '#0a0f1a';
        ctx.fillRect(0, 0, cw, ch);

        var ox = this._drawOffX, oy = this._drawOffY;
        var dw = iw*totalScale, dh = ih*totalScale, s = totalScale;
        var m = this._margins;

        ctx.drawImage(this._img, ox, oy, dw, dh);

        var lines = [
            {side:'top',pos:oy+m.top*s,x1:ox,x2:ox+dw,color:'#ff4757',label:'上 '+m.top+'px'},
            {side:'bottom',pos:oy+(ih-m.bottom)*s,x1:ox,x2:ox+dw,color:'#ffa502',label:'下 '+m.bottom+'px'},
            {side:'left',pos:ox+m.left*s,y1:oy,y2:oy+dh,color:'#1e90ff',label:'左 '+m.left+'px'},
            {side:'right',pos:ox+(iw-m.right)*s,y1:oy,y2:oy+dh,color:'#2ed573',label:'右 '+m.right+'px'},
        ];

        for (var i = 0; i < lines.length; i++) {
            var line = lines[i];
            ctx.strokeStyle = line.color;
            ctx.lineWidth = 2;
            ctx.setLineDash([6,4]);
            ctx.beginPath();
            if (line.side === 'top' || line.side === 'bottom') {
                ctx.moveTo(line.x1, line.pos); ctx.lineTo(line.x2, line.pos);
            } else {
                ctx.moveTo(line.pos, line.y1); ctx.lineTo(line.pos, line.y2);
            }
            ctx.stroke();
            ctx.setLineDash([]);

            var hx = line.side === 'left' ? line.pos : (line.side === 'right' ? line.pos : ox+dw/2);
            var hy = line.side === 'top' ? line.pos : (line.side === 'bottom' ? line.pos : oy+dh/2);
            ctx.fillStyle = line.color;
            ctx.beginPath();
            ctx.arc(hx, hy, 5, 0, Math.PI*2);
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = 'rgba(0,0,0,0.7)';
            var tw = ctx.measureText(line.label).width;
            var lx = line.side === 'left' ? Math.max(ox+4, line.pos-tw-10) : (line.side === 'right' ? Math.min(ox+dw-tw-8, line.pos+10) : ox+8);
            var ly = line.side === 'top' ? line.pos+18 : (line.side === 'bottom' ? line.pos-10 : oy+18);
            ctx.fillRect(lx-4, ly-12, tw+8, 18);
            ctx.fillStyle = line.color;
            ctx.font = '12px sans-serif';
            ctx.fillText(line.label, lx, ly);
        }

        ctx.strokeStyle = 'rgba(255,255,255,0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3,5]);
        var cx = ox+m.left*s+(dw-(m.left+m.right)*s)/2;
        var cy = oy+m.top*s+(dh-(m.top+m.bottom)*s)/2;
        ctx.beginPath();
        ctx.moveTo(cx-15,cy); ctx.lineTo(cx+15,cy);
        ctx.moveTo(cx,cy-15); ctx.lineTo(cx,cy+15);
        ctx.stroke();
        ctx.setLineDash([]);
    },

    // ========================================
    //   Preview rendering
    // ========================================

    _drawPreview: function() {
        if (!this._img) return;
        var wrap = this._overlay.querySelector('#nsPreviewWrap');
        var rect = wrap.getBoundingClientRect();
        var viewW = rect.width, viewH = rect.height;
        if (viewW <= 0 || viewH <= 0) return;

        var pw = this._previewW, ph = this._previewH;
        var totalScale = this._previewZoom;
        var cw = Math.max(pw*totalScale, viewW);
        var ch = Math.max(ph*totalScale, viewH);
        var ox = (cw - pw*totalScale)/2;
        var oy = (ch - ph*totalScale)/2;

        var dpr = window.devicePixelRatio || 1;
        this._previewCanvas.width = cw * dpr;
        this._previewCanvas.height = ch * dpr;
        this._previewCanvas.style.width = cw + 'px';
        this._previewCanvas.style.height = ch + 'px';
        var ctx = this._previewCtx;
        ctx.setTransform(dpr,0,0,dpr,0,0);
        ctx.fillStyle = '#0d1a2e';
        ctx.fillRect(0, 0, cw, ch);

        var img = this._img, iw = img.naturalWidth, ih = img.naturalHeight, m = this._margins;
        var s = totalScale;

        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 4;

        var sx = [0, m.left, iw-m.right, iw];
        var sy = [0, m.top, ih-m.bottom, ih];
        var dx = [ox, ox+m.left*s, ox+(pw-m.right)*s, ox+pw*s];
        var dy = [oy, oy+m.top*s, oy+(ph-m.bottom)*s, oy+ph*s];

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) {
            var sw = sx[c+1]-sx[c], sh = sy[r+1]-sy[r];
            var dw2 = dx[c+1]-dx[c], dh2 = dy[r+1]-dy[r];
            if (sw>0 && sh>0 && dw2>0 && dh2>0) ctx.drawImage(img, sx[c], sy[r], sw, sh, dx[c], dy[r], dw2, dh2);
        }

        ctx.shadowColor = 'transparent';
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(ox, oy, pw*s, ph*s);

        var dimLabel = pw+' x '+ph+'px';
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        var tw = ctx.measureText(dimLabel).width;
        ctx.fillRect(ox+4, oy+4, tw+12, 24);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText(dimLabel, ox+10, oy+21);
    },

    // ========================================
    //   Export
    // ========================================

    _export: function() {
        var img = this._img, m = this._margins;
        var pw = this._previewW, ph = this._previewH;
        var off = document.createElement('canvas');
        off.width = pw; off.height = ph;
        var ctx = off.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        var sx = [0, m.left, img.naturalWidth-m.right, img.naturalWidth];
        var sy = [0, m.top, img.naturalHeight-m.bottom, img.naturalHeight];
        var dx = [0, m.left, pw-m.right, pw];
        var dy = [0, m.top, ph-m.bottom, ph];

        for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) {
            var sw = sx[c+1]-sx[c], sh = sy[r+1]-sy[r];
            var dw2 = dx[c+1]-dx[c], dh2 = dy[r+1]-dy[r];
            if (sw>0 && sh>0 && dw2>0 && dh2>0) ctx.drawImage(img, sx[c], sy[r], sw, sh, dx[c], dy[r], dw2, dh2);
        }

        var link = document.createElement('a');
        link.download = '九宫格_'+pw+'x'+ph+'.png';
        link.href = off.toDataURL('image/png');
        link.click();
        if (typeof showToast === 'function') showToast('已导出 '+pw+'x'+ph);
    },

    // ========================================
    //   Hints
    // ========================================

    _drawHints: function() {
        var wrap = this._overlay.querySelector('#nsEditorWrap');
        var rect = wrap.getBoundingClientRect();
        var w = rect.width||400, h = rect.height||300, dpr = window.devicePixelRatio||1;
        this._editorCanvas.width = w*dpr;
        this._editorCanvas.height = h*dpr;
        this._editorCanvas.style.width = w+'px';
        this._editorCanvas.style.height = h+'px';
        var ctx = this._editorCtx;
        ctx.setTransform(dpr,0,0,dpr,0,0);
        ctx.fillStyle = '#0a0f1a';
        ctx.fillRect(0,0,w,h);
        ctx.fillStyle = '#555';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('选择图片开始', w/2, h/2);

        var pw = this._overlay.querySelector('#nsPreviewWrap');
        var pr = pw.getBoundingClientRect();
        var pww = pr.width||400, pwh = pr.height||250;
        this._previewCanvas.width = pww*dpr;
        this._previewCanvas.height = pwh*dpr;
        this._previewCanvas.style.width = pww+'px';
        this._previewCanvas.style.height = pwh+'px';
        var pctx = this._previewCtx;
        pctx.setTransform(dpr,0,0,dpr,0,0);
        pctx.fillStyle = '#0d1a2e';
        pctx.fillRect(0,0,pww,pwh);
        pctx.fillStyle = '#555';
        pctx.font = '14px sans-serif';
        pctx.textAlign = 'center';
        pctx.textBaseline = 'middle';
        pctx.fillText('选择图片开始', pww/2, pwh/2);
    }
};
