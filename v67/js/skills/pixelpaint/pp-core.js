/**
 * 像素画 - 核心模块
 * 主对象声明 + 属性 + 生命周期 + UI构建 + 事件绑定 + 初始化
 */

var PixelPaintSkill = {

    id: 'pixel-paint',
    name: '像素画v2',
    icon: '<span style="color:#ef4444;">像</span>',
    description: '数字像素绘画系统，支持多标签页、动画表、图层、笔刷',
    key: '6',

    _overlay: null,
    _canvas: null,
    _ctx: null,
    _selCanvas: null,
    _selCtx: null,
    _gridCanvas: null,
    _gridCtx: null,
    _canvasArea: null,
    _canvasViewport: null,
    _bgCanvas: null,
    _bgCtx: null,
    _panelLeft: null,
    _panelBottom: null,
    _panelStatic: null,
    _panelDynamic: null,
    _events: [],
    CELL: 16,
    DB_NAME: 'PixelPaintDB',
    DB_VER: 1,
    STORE: 'state',

    _selectedBlock: 1,
    _showNumbers: true,
    _showGrid: false,
    _currentTool: 'brush',
    _selectedBrushIdx: -1,
    _mergedData: null,
    _mergedW: 0,
    _mergedH: 0,
    _bgDirty: true,
    _panelZoom: 130,
    _isDrawing: false,
    _drawStart: null,
    _lastDrawPos: null,
    _isPanning: false,
    _panStartX: 0,
    _panStartY: 0,
    _brushPreviewPos: null,
    _isPlaying: false,
    _playInterval: null,
    _saveTimer: null,
    _tabCounter: 0,
    _activeTabId: null,
    _frameCount: 1,
    _activeFrame: 0,
    _activeLayer: 0,
    _nextBlockId: 11,
    _nextBrushId: 1,
    _deleteColorMode: false,
    _deleteBrushMode: false,
    _editColorMode: false,
    _mergeColorMode: false,
    _mergeColorIds: [],
    _selection: null,
    _selData: null,
    _selX: 0,
    _selY: 0,
    _selLocked: false,
    _selDragging: false,
    _selDragOffX: 0,
    _selDragOffY: 0,
    _isResizing: false,
    _resizeStartY: 0,
    _resizeStartH: 0,
    _isResizingV: false,
    _resizeStartX: 0,
    _resizeStartW: 0,
    _isResizingR: false,
    _resize3DStartX: 0,
    _resize3DStartW: 0,
    _activeHBar: null,
    _hResizeStartY: 0,
    _hResizeStartH1: 0,
    _hResizeStartH2: 0,
    _hSec1: null,
    _hSec2: null,

    _tabs: [],
    _pixelBlocks: [],
    _defaultBlocks: null,
    _PALETTES: {
        p8: [[0,0,0],[29,43,83],[126,37,83],[0,135,81],[171,82,54],[95,87,79],[194,195,199],[255,241,232],[255,0,77],[255,163,0],[255,236,39],[0,228,54],[41,173,255],[131,118,156],[255,119,168],[255,204,170]],
        gameboy: [[15,56,15],[48,98,48],[139,172,15],[155,188,15]],
        nes: [[124,124,124],[0,0,252],[0,0,188],[68,40,188],[148,0,132],[168,0,32],[168,16,0],[136,20,0],[80,48,0],[0,120,0],[0,104,0],[0,88,0],[0,64,88],[0,0,0],[188,188,188],[0,120,248],[0,88,248],[104,68,252],[216,0,204],[228,0,88],[248,56,0],[228,92,16],[172,124,0],[0,184,0],[0,168,0],[0,168,68],[0,136,136],[0,0,0]]
    },
    _BAYER_4X4: [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]],
    _BAYER_2X2: [[0,2],[3,1]],
    _brushes: [],
    _layers: [],
    _frameData: [],
    _undoStack: [],
    _redoStack: [],
    _thumbCache: null,

    activate: function(world) {
        if (this._overlay) { if (typeof SkillSystem !== 'undefined') SkillSystem.renderSubTools(); this._tryLoadFromCanvas(); this._startCanvasFollow(); return; }
        var self = this;
        this._world = world;
        this._initState();
        this._createOverlay();
        if (typeof SkillSystem !== 'undefined') SkillSystem.renderSubTools();
        this._tryLoadFromCanvas();
        this._startCanvasFollow();
    },

    _tryLoadFromCanvas: function() {
        if (typeof CanvasImages === 'undefined') return;
        var dataURL = CanvasImages.getSelected('display');
        if (dataURL) {
            this._handleImportImgDataURL(dataURL);
        }
    },

    _startCanvasFollow: function() {
        if (this._cfStop) return;
        var self = this;
        this._cfStop = CanvasFollow.bind(function() { self._onCanvasFollow(); }, {
            isAlive: function() { return !!(self._overlay && self._overlay.parentNode); },
            paused: function() { return !!self._cfLock; },
            interval: 200
        });
    },

    _stopCanvasFollow: function() {
        if (this._cfStop) { this._cfStop(); this._cfStop = null; }
        this._cfLock = false;
    },

    _onCanvasFollow: function() {
        this._tryLoadFromCanvas();
    },

    getSubTools: function() {
        var self = this;
        return [{ label: TEXTS.CLOSE, action: function() { self._destroy(); if (typeof SkillSystem !== 'undefined') SkillSystem.deactivate(); } }];
    },

    save: function() { return null; },

    _initState: function() {
        this._tabs=[];this._tabCounter=0;this._activeTabId=null;
        this._pixelBlocks=[{id:1,color:'#e94560',name:TEXTS.COLOR_RED},{id:2,color:'#f5a623',name:TEXTS.COLOR_ORANGE},{id:3,color:'#f7dc6f',name:TEXTS.COLOR_YELLOW},{id:4,color:'#2ecc71',name:TEXTS.COLOR_GREEN},{id:5,color:'#3498db',name:TEXTS.COLOR_BLUE},{id:6,color:'#9b59b6',name:TEXTS.COLOR_PURPLE},{id:7,color:'#1abc9c',name:TEXTS.COLOR_CYAN},{id:8,color:'#ecf0f1',name:TEXTS.COLOR_WHITE},{id:9,color:'#95a5a6',name:TEXTS.COLOR_GRAY},{id:10,color:'#2c3e50',name:TEXTS.COLOR_DARK_BLUE}];
        this._defaultBlocks=JSON.parse(JSON.stringify(this._pixelBlocks));
        this._nextBlockId=11;this._brushes=[];this._nextBrushId=1;this._selectedBrushIdx=-1;
        this._layers=[{name:TEXTS.LAYER_PREFIX + '1',visible:true}];this._frameData=[];this._frameCount=1;this._activeFrame=0;this._activeLayer=0;
        this._undoStack=[];this._redoStack=[];this._selectedBlock=1;this._showNumbers=true;this._showGrid=false;this._currentTool='brush';
        this._mergedData=null;this._thumbCache=new Map();this._bgDirty=true;this._panelZoom=130;
        this._deleteColorMode=false;this._deleteBrushMode=false;this._editColorMode=false;
        this._mergeColorMode=false;this._mergeColorIds=[];this._selection=null;this._selData=null;
        this._selLocked=false;this._selDragging=false;this._brushPreviewPos=null;this._isPlaying=false;
        this._playInterval=null;this._isDrawing=false;this._isPanning=false;this._isResizing=false;
        this._isResizingV=false;this._isResizingR=false;this._activeHBar=null;this._saveTimer=null;
        this._editingFace=null;
    },

    _destroy: function() {
        this._stopCanvasFollow();
        this._events.forEach(function(item){if(item.target)item.target.removeEventListener(item.type,item.fn,item.options);});
        this._events=[];
        if(this._playInterval){clearInterval(this._playInterval);this._playInterval=null;}
        if(this._saveTimer){clearTimeout(this._saveTimer);this._saveTimer=null;}
        if(this._resizeObserver){this._resizeObserver.disconnect();this._resizeObserver=null;}
        if(this._overlay&&this._overlay.parentNode){
            this._overlay.parentNode.removeChild(this._overlay);
        }
        this._overlay=null;this._canvas=null;this._ctx=null;this._selCanvas=null;this._selCtx=null;this._gridCanvas=null;this._gridCtx=null;
        this._canvasArea=null;this._canvasViewport=null;this._bgCanvas=null;this._bgCtx=null;
        this._panelLeft=null;this._panelBottom=null;this._panelStatic=null;this._panelDynamic=null;
        if (typeof PixelPaint3D !== 'undefined') { try { PixelPaint3D.destroy(); } catch(e) {} }
        this._initState();
    },

    _q: function(sel){return this._overlay?this._overlay.querySelector(sel):null;},
    _qa: function(sel){return this._overlay?this._overlay.querySelectorAll(sel):null;},
    _on: function(target,type,fn,options){target.addEventListener(type,fn,options);this._events.push({target:target,type:type,fn:fn,options:options});},

    _getCSS: function(){return'.pp-body{flex:1;display:flex;overflow:hidden;min-height:0;}.pp-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;}.pp-resize-handle{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;z-index:10;}.pp-resize-handle::after{content:"";position:absolute;right:3px;bottom:3px;width:8px;height:8px;border-right:2px solid var(--cos-border);border-bottom:2px solid var(--cos-border);}.pp-tab-bar{height:30px;background:var(--cos-surface);border-bottom:1px solid var(--cos-border);display:flex;align-items:stretch;flex-shrink:0;overflow-x:auto;}.pp-tab{display:flex;align-items:center;gap:4px;padding:0 10px;font-size:13px;color:var(--cos-text-soft);cursor:pointer;border-right:1px solid var(--cos-border);white-space:nowrap;position:relative;}.pp-tab:hover{color:var(--cos-text-soft);background:var(--cos-accent-soft);}.pp-tab.active{color:var(--cos-text);background:var(--cos-surface);}.pp-tab.active::after{content:"";position:absolute;bottom:0;left:0;right:0;height:2px;background:var(--cos-accent);}.pp-tab-name{font-weight:bold;}.pp-tab-size{font-size:11px;color:var(--cos-text-dim);}.pp-tab-close{transition:all 0.15s;font-size:13px;color:var(--cos-text-soft);cursor:pointer;margin-left:4px;padding:0 3px;border-radius:4px;line-height:1;}.pp-tab-close:hover{color:var(--cos-accent);background:var(--cos-accent-soft);}.pp-tab-add{transition:all 0.15s;display:flex;align-items:center;justify-content:center;width:28px;min-width:28px;color:var(--cos-text-dim);font-size:16px;cursor:pointer;}.pp-tab-add:hover{color:var(--cos-accent);background:var(--cos-accent-soft);}.pp-panel-left{width:320px;background:var(--cos-surface);display:flex;flex-direction:row;flex-shrink:0;overflow:hidden;min-height:0;height:100%;}.pp-panel-static{width:160px;display:flex;flex-direction:column;flex-shrink:0;overflow-x:hidden;overflow-y:auto;min-height:0;}.pp-panel-dynamic{flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden;min-height:0;}.pp-panel-section{display:flex;flex-direction:column;min-height:0;overflow-x:hidden;border-bottom:1px solid var(--cos-border);}.pp-panel-section:last-child{border-bottom:none;}.pp-panel-section-body{flex:1;overflow-y:auto;overflow-x:hidden;min-height:0;}.pp-panel-section.collapsed .pp-panel-section-body{display:none;}.pp-resize-bar-h{height:4px;background:var(--cos-border);cursor:ns-resize;flex-shrink:0;position:relative;z-index:5;transition:background 0.15s;}.pp-resize-bar-h:hover,.pp-resize-bar-h.active{background:var(--cos-accent);}.pp-resize-bar-h::after{content:"";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:20px;height:2px;background:rgba(255,255,255,0.15);border-radius:3px;}.pp-resize-bar-h:hover::after,.pp-resize-bar-h.active::after{background:rgba(255,255,255,0.4);}.pp-section-header{padding:4px 8px;font-size:10px;font-weight:bold;color:var(--cos-text-dim);display:flex;justify-content:space-between;align-items:center;gap:3px;text-transform:uppercase;letter-spacing:0.5px;}.pp-section-btns{display:flex;gap:2px;align-items:center;}.pp-color-input-wrap{width:16px;height:16px;border-radius:6px;overflow:hidden;border:1px solid var(--cos-border);cursor:pointer;flex-shrink:0;}.pp-color-input-wrap input[type=color]{width:24px;height:24px;border:none;padding:0;cursor:pointer;margin:-4px;}.pp-add-btn{transition:all 0.15s;background:var(--cos-accent);color:#fff;border:none;width:16px;height:16px;border-radius:4px;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;}.pp-add-btn.del{transition:all 0.15s;background:#2c3e50;color:var(--cos-text-soft);border:1px solid var(--cos-border);}.pp-add-btn.del.active{background:var(--cos-accent);color:#fff;border-color:var(--cos-accent);}.pp-size-section{padding:5px 8px;display:flex;flex-direction:column;gap:3px;}.pp-size-presets{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;}.pp-size-preset{transition:all 0.15s;background:var(--cos-border);border:1px solid var(--cos-border);border-radius:6px;color:var(--cos-text-soft);font-size:11px;cursor:pointer;padding:3px 0;font-family:inherit;}.pp-size-preset:hover{border-color:var(--cos-accent);color:var(--cos-accent);}.pp-size-custom{display:flex;align-items:center;gap:3px;justify-content:center;}.pp-size-input{width:48px;height:22px;background:rgba(0,10,30,0.4);border:1px solid var(--cos-border);color:var(--cos-text);text-align:center;font-size:11px;font-family:inherit;border-radius:6px;}.pp-size-input:focus{border-color:var(--cos-accent);outline:none;}.pp-size-x{font-size:12px;color:var(--cos-text-dim);}.pp-size-apply{transition:all 0.15s;background:var(--cos-accent);color:#fff;border:none;padding:3px 7px;border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit;}.pp-size-apply:hover{background:#c73850;}.pp-tool-grid{padding:4px;display:flex;flex-direction:column;gap:3px;}.pp-tool-row{display:flex;flex-wrap:wrap;gap:2px;}.pp-tool-row-label{font-size:9px;color:var(--cos-text-dim);padding:3px 2px 0;margin-top:2px;line-height:1;opacity:0.7;}.pp-tool-btn{transition:all 0.15s;width:34px;height:30px;flex-shrink:0;background:var(--cos-border);border:1px solid var(--cos-border);border-radius:6px;color:var(--cos-text-soft);font-size:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;transition:0.15s;}.pp-tool-btn:hover{border-color:var(--cos-accent);color:var(--cos-accent);}.pp-tool-btn.active{background:var(--cos-accent);border-color:var(--cos-accent);color:#fff;}.pp-tool-btn-label{font-size:9px;color:inherit;opacity:1;}.pp-pixel-grid{padding:4px;display:grid;grid-template-columns:repeat(auto-fill,26px);gap:2px;justify-content:start;overflow-y:auto;}.pp-pixel-grid.delete-mode .pp-pixel-cell{cursor:not-allowed;}.pp-pixel-grid.delete-mode .pp-pixel-cell:hover{outline:2px solid var(--cos-accent);outline-offset:-2px;}.pp-pixel-cell{width:26px;height:26px;border-radius:6px;cursor:pointer;position:relative;border:2px solid transparent;transition:0.15s;}.pp-pixel-cell:hover{transform:scale(1.1);z-index:1;}.pp-pixel-cell.selected{border-color:#fff;box-shadow:0 0 6px rgba(233,69,96,0.6);}.pp-pixel-cell.merge-selected{border-color:#e67e22;box-shadow:0 0 6px rgba(230,126,34,0.8);}.pp-pixel-cell-color{width:100%;height:100%;border-radius:4px;}.pp-pixel-cell-num{position:absolute;top:0;left:50%;transform:translateX(-50%);font-size:9px;font-weight:bold;color:#fff;text-shadow:0 0 3px rgba(0,0,0,0.9);pointer-events:none;}.pp-brush-grid{padding:4px;display:grid;grid-template-columns:repeat(auto-fill,38px);gap:3px;justify-content:start;}.pp-brush-grid.delete-mode .pp-brush-item{cursor:not-allowed;}.pp-brush-grid.delete-mode .pp-brush-item:hover{outline:2px solid var(--cos-accent);outline-offset:-2px;}.pp-brush-item{width:38px;height:38px;background:rgba(0,10,30,0.4);border:2px solid var(--cos-border);border-radius:6px;cursor:pointer;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;transition:0.15s;}.pp-brush-item:hover{border-color:var(--cos-accent);}.pp-brush-item.selected{border-color:var(--cos-accent);box-shadow:0 0 6px rgba(233,69,96,0.4);}.pp-brush-item canvas{image-rendering:pixelated;}.pp-brush-item-label{position:absolute;bottom:0;right:2px;font-size:9px;color:var(--cos-text-dim);}.pp-toggle-row{padding:6px 8px;display:flex;align-items:center;justify-content:space-between;}.pp-toggle-label{font-size:11px;color:var(--cos-text-soft);}.pp-toggle{width:28px;height:15px;background:#333;transition:background 0.25s ease;border-radius:10px;position:relative;cursor:pointer;}.pp-toggle.on{background:var(--cos-accent);}.pp-toggle::after{content:"";width:11px;height:11px;background:#fff;border-radius:50%;position:absolute;top:2px;left:2px;transition:all 0.25s cubic-bezier(0.4,0,0.2,1);pointer-events:none;}.pp-toggle.on::after{left:15px;}.pp-panel-zoom{padding:3px 8px;border-top:1px solid var(--cos-border);display:flex;align-items:center;gap:4px;flex-shrink:0;margin-top:auto;}.pp-panel-zoom-label{font-size:10px;color:var(--cos-text-dim);white-space:nowrap;}.pp-panel-zoom input[type=range]{flex:1;height:4px;-webkit-appearance:none;background:var(--cos-border);border-radius:4px;outline:none;}.pp-panel-zoom input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;background:var(--cos-accent);border-radius:50%;cursor:pointer;}.pp-panel-zoom-val{font-size:10px;color:var(--cos-text-soft);min-width:28px;text-align:right;}.pp-canvas-area{flex:1;background:rgba(0,5,15,0.95);position:relative;overflow:hidden;cursor:crosshair;}.pp-canvas-viewport{position:absolute;top:0;left:0;transform-origin:0 0;}.pp-canvas-container{position:relative;box-shadow:0 0 60px rgba(56,189,248,0.06),0 0 1px rgba(56,189,248,0.2);}.pp-canvas-container canvas{display:block;image-rendering:pixelated;}.pp-canvas-info{position:absolute;bottom:4px;left:50%;transform:translateX(-50%);font-size:11px;color:#fff;background:rgba(0,5,15,0.8);padding:2px 8px;border-radius:8px;white-space:nowrap;z-index:10;}.pp-resize-bar-v{width:6px;background:var(--cos-border);cursor:ew-resize;flex-shrink:0;position:relative;z-index:5;transition:background 0.15s;}.pp-resize-bar-v:hover,.pp-resize-bar-v.active{background:var(--cos-accent);}.pp-resize-bar-v::after{content:"";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:3px;height:30px;background:rgba(255,255,255,0.25);border-radius:3px;}.pp-resize-bar-v:hover::after,.pp-resize-bar-v.active::after{background:rgba(255,255,255,0.6);}.pp-panel-bottom{height:150px;min-height:50px;background:var(--cos-surface);border-top:none;display:flex;flex-direction:column;flex-shrink:0;}.pp-resize-bar{height:5px;background:var(--cos-border);cursor:ns-resize;flex-shrink:0;position:relative;z-index:5;transition:background 0.15s;}.pp-resize-bar:hover,.pp-resize-bar.active{background:var(--cos-accent);}.pp-resize-bar::after{content:"";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:24px;height:2px;background:rgba(255,255,255,0.2);border-radius:3px;}.pp-resize-bar:hover::after,.pp-resize-bar.active::after{background:rgba(255,255,255,0.5);}.pp-bottom-header{padding:4px 8px;font-size:10px;font-weight:bold;color:var(--cos-text-dim);border-bottom:1px solid var(--cos-border);display:flex;justify-content:space-between;align-items:center;text-transform:uppercase;letter-spacing:0.5px;}.pp-bottom-btn{transition:all 0.15s;background:var(--cos-border);color:var(--cos-text-soft);border:1px solid var(--cos-border);padding:2px 8px;border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit;}.pp-bottom-btn:hover{border-color:var(--cos-accent);color:var(--cos-accent);}.pp-timeline{flex:1;overflow:auto;padding:2px;}.pp-timeline-col-header{display:flex;align-items:center;position:sticky;top:0;z-index:2;background:var(--cos-surface);}.pp-col-header-corner{width:36px;min-width:36px;height:22px;border-right:1px solid var(--cos-border);border-bottom:1px solid var(--cos-border);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--cos-text-dim);flex-shrink:0;}.pp-col-header-cell{width:44px;min-width:44px;height:22px;border-right:1px solid var(--cos-border);border-bottom:1px solid var(--cos-border);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;color:var(--cos-text-soft);flex-shrink:0;}.pp-col-header-cell:hover{background:var(--cos-accent-soft);}.pp-col-add-btn{transition:all 0.15s;width:22px;min-width:22px;height:18px;display:flex;align-items:center;justify-content:center;color:var(--cos-accent);font-size:16px;cursor:pointer;flex-shrink:0;border-right:1px solid var(--cos-border);border-bottom:1px solid var(--cos-border);}.pp-col-add-btn:hover{background:var(--cos-accent-soft);}.pp-timeline-row{display:flex;align-items:center;}.pp-row-header{width:36px;min-width:36px;height:44px;border-right:1px solid var(--cos-border);border-bottom:1px solid var(--cos-border);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;color:var(--cos-text-soft);flex-shrink:0;gap:2px;}.pp-row-header .pp-eye{font-size:11px;color:var(--cos-accent);cursor:pointer;}.pp-row-header:hover{background:var(--cos-accent-soft);}.pp-frame-cell{width:44px;min-width:44px;height:44px;background:rgba(0,5,15,0.9);border-right:1px solid var(--cos-border);border-bottom:1px solid var(--cos-border);cursor:pointer;position:relative;overflow:hidden;flex-shrink:0;}.pp-frame-cell:hover{background:rgba(20,30,60,0.5);}.pp-frame-cell.active{border:2px solid var(--cos-accent);box-shadow:0 0 6px rgba(233,69,96,0.3);z-index:1;}.pp-frame-cell canvas{image-rendering:pixelated;width:100%;height:100%;}.pp-corner-add-btn{transition:all 0.15s;width:22px;min-width:22px;height:44px;display:flex;align-items:center;justify-content:center;color:var(--cos-accent);font-size:16px;cursor:pointer;flex-shrink:0;border-bottom:1px solid var(--cos-border);}.pp-corner-add-btn:hover{background:var(--cos-accent-soft);}.pp-modal-overlay{display:none;position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,5,15,0.7);z-index:999;align-items:center;justify-content:center;}.pp-modal-overlay.show{display:flex;}.pp-modal-box{background:var(--cos-surface);border:1px solid var(--cos-border);border-radius:10px;padding:18px 22px;min-width:300px;max-width:400px;box-shadow:0 8px 32px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.05);}.pp-modal-msg{font-size:13px;color:var(--cos-text-soft);line-height:1.6;margin-bottom:14px;white-space:pre-line;}.pp-modal-btns{display:flex;gap:8px;justify-content:flex-end;}.pp-modal-btn{transition:all 0.15s;padding:6px 16px;border-radius:6px;font-size:12px;cursor:pointer;border:1px solid var(--cos-border);background:var(--cos-border);color:var(--cos-text-soft);font-family:inherit;}.pp-modal-btn:hover{border-color:var(--cos-accent);color:var(--cos-accent);}.pp-modal-btn.primary{transition:all 0.15s;background:var(--cos-accent);border-color:var(--cos-accent);color:#fff;}.pp-modal-btn.primary:hover{background:#c73850;}::-webkit-scrollbar{width:4px;height:4px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:var(--cos-border);border-radius:4px;}.pp-hidden-input{display:none;}.pp-cal-row{display:flex;align-items:center;gap:4px;padding:2px 8px;}.pp-cal-row label{font-size:9px;color:var(--cos-text-dim);flex-shrink:0;width:28px;text-align:right;}.pp-cal-row select{flex:1;min-width:0;background:var(--cos-surface);border:1px solid var(--cos-border);color:var(--cos-text);padding:2px 4px;border-radius:6px;font-size:10px;}.pp-cal-row select:focus{border-color:var(--cos-accent);outline:none;}.pp-cal-execute{width:100%;padding:5px 0;background:var(--cos-accent);border:none;border-radius:6px;color:#fff;font-size:11px;cursor:pointer;font-weight:bold;margin-top:4px;}.pp-cal-execute:hover{background:#c73850;}.pp-tab-close:active,.pp-tab-add:active,.pp-add-btn:active,.pp-add-btn.del:active,.pp-size-preset:active,.pp-size-apply:active,.pp-tool-btn:active,.pp-bottom-btn:active,.pp-modal-btn:active,.pp-modal-btn.primary:active,.pp-col-add-btn:active,.pp-corner-add-btn:active{transform:scale(0.92);}';},

    _createOverlay: function() {
        var self = this;
        var overlay = document.createElement('div');
        overlay.className = 'cos-pwin';
        overlay.setAttribute('data-skill-id', 'pixel-paint');
        overlay._pixelPaintInstance = this;

        var savedW = 900, savedH = 650, savedL = null, savedT = null;
        try {
            var saved = JSON.parse(localStorage.getItem('pp-window-size'));
            if (saved) {
                var sw = window.innerWidth, sh = window.innerHeight;
                savedW = Math.min(saved.w || 900, sw - 20);
                savedH = Math.min(saved.h || 650, sh - 20);
                savedL = Math.max(0, Math.min(saved.l, sw - savedW));
                savedT = Math.max(0, Math.min(saved.t, sh - savedH));
            }
        } catch(e) {}
        overlay.style.width = savedW + 'px';
        overlay.style.height = savedH + 'px';
        overlay.style.left = (savedL !== null ? savedL : Math.max(20, (window.innerWidth - savedW) / 2)) + 'px';
        overlay.style.top = (savedT !== null ? savedT : Math.max(20, (window.innerHeight - savedH) / 2)) + 'px';
        overlay.style.minWidth = '600px';
        overlay.style.minHeight = '400px';

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
        header.innerHTML = '<span class="cos-pwin-hdr-title">' + TEXTS.NAME + '</span><div class="cos-pwin-hdr-right"><span class="cos-pclose" data-action="close" title="' + TEXTS.CLOSE + '">\u00d7</span></div>';
        overlay.appendChild(header);

        var body = document.createElement('div');
        body.className = 'pp-body';
        body.innerHTML = this._buildBodyHTML();
        overlay.appendChild(body);
        var modalOverlay = document.createElement('div');
        modalOverlay.className = 'pp-modal-overlay'; modalOverlay.id = 'ppModalOverlay';
        modalOverlay.innerHTML = '<div class="pp-modal-box"><div class="pp-modal-msg" id="ppModalMsg"></div><div class="pp-modal-btns" id="ppModalBtns"></div></div>';
        overlay.appendChild(modalOverlay);
        if (typeof WindowHelper !== 'undefined') {
            WindowHelper.makeResizable(overlay, { minWidth: 600, minHeight: 400, storeKey: 'pp-window-size' });
        }
        if (typeof CosUI !== 'undefined' && CosUI.draggable) {
            CosUI.draggable.bind(overlay, header, {
                storeKey: 'pp-window-size',
                closeSelector: '[data-action="close"],.cos-pclose'
            });
        }
        ['ppImportInput:application/json','ppImportBrushInput:application/json'].forEach(function(spec) {
            var parts = spec.split(':');
            var inp = document.createElement('input');
            inp.type = 'file'; inp.accept = parts[1]; inp.className = 'pp-hidden-input'; inp.id = parts[0];
            overlay.appendChild(inp);
        });
        document.body.appendChild(overlay);
        this._overlay = overlay;
        this._canvas = overlay.querySelector('#ppMainCanvas');
        this._ctx = this._canvas.getContext('2d');
        this._selCanvas = overlay.querySelector('#ppSelCanvas');
        this._selCtx = this._selCanvas.getContext('2d');
        this._gridCanvas = overlay.querySelector('#ppGridCanvas');
        this._gridCtx = this._gridCanvas.getContext('2d');
        this._canvasArea = overlay.querySelector('#ppCanvasArea');
        this._canvasViewport = overlay.querySelector('#ppCanvasViewport');
        this._panelLeft = overlay.querySelector('.pp-panel-left');
        this._panelBottom = overlay.querySelector('#ppPanelBottom');
        this._panelStatic = overlay.querySelector('#ppPanelStatic');
        this._panelDynamic = overlay.querySelector('#ppPanelDynamic');
        this._bgCanvas = document.createElement('canvas');
        this._bgCtx = this._bgCanvas.getContext('2d');
        this._bindEvents(overlay);
        this._initAsync();
    },

    _buildBodyHTML: function() {
        return `<div class="pp-panel-left"><div class="pp-panel-static" id="ppPanelStatic"><div class="pp-panel-section" id="ppSecSize" style="height:auto;flex:none;"><div class="pp-section-header">${TEXTS.CANVAS_SIZE}</div><div class="pp-size-section"><div class="pp-size-presets"><button class="pp-size-preset" data-size="8">${TEXTS.SIZE_8}</button><button class="pp-size-preset" data-size="16">${TEXTS.SIZE_16}</button><button class="pp-size-preset" data-size="32">${TEXTS.SIZE_32}</button><button class="pp-size-preset" data-size="64">${TEXTS.SIZE_64}</button></div><div class="pp-size-custom"><input class="pp-size-input" id="ppSizeW" type="number" value="128" min="4" max="512"><span class="pp-size-x">x</span><input class="pp-size-input" id="ppSizeH" type="number" value="128" min="4" max="512"><button class="pp-size-apply" id="ppSizeApply">${TEXTS.APPLY}</button></div></div></div><div class="pp-panel-section" id="ppSecToggle" style="height:auto;flex:none;"><div class="pp-toggle-row"><span class="pp-toggle-label">${TEXTS.NUM_DISPLAY}</span><div class="pp-toggle on" id="ppNumToggle"></div></div><div class="pp-toggle-row"><span class="pp-toggle-label">${TEXTS.GRID_DISPLAY}</span><div class="pp-toggle" id="ppGridToggle"></div></div></div><div class="pp-panel-section" id="ppSecCalibrate" style="flex:none;"><div class="pp-section-header">${TEXTS.CALIBRATE}</div><div class="pp-cal-row"><label>${TEXTS.TARGET_GRID}</label><select id="ppCalibrateSize"><option value="16">${TEXTS.SIZE_16}</option><option value="32">${TEXTS.SIZE_32}</option><option value="48">48x48</option><option value="64" selected>${TEXTS.SIZE_64}</option><option value="96">96x96</option><option value="128">128x128</option></select></div><div class="pp-cal-row"><label>${TEXTS.DOT_DITHER}</label><select id="ppCalibrateDither"><option value="bayer4x4">${TEXTS.BAYER_4X4}</option><option value="bayer2x2">${TEXTS.BAYER_2X2}</option><option value="none">${TEXTS.NO_DITHER}</option></select></div><div class="pp-cal-row"><label>${TEXTS.PALETTE_LABEL}</label><select id="ppCalibratePalette"><option value="p8">${TEXTS.PAL_PICO8}</option><option value="gameboy">${TEXTS.PAL_GAMEBOY}</option><option value="nes">${TEXTS.PAL_NES}</option><option value="custom16">${TEXTS.PAL_CUSTOM16}</option></select></div><div style="margin-top:4px;"><button id="ppBtnCalibrate" class="pp-cal-execute">${TEXTS.EXEC_CALIBRATE}</button></div></div><div class="pp-panel-section" id="ppSecTools" style="flex:none;"><div class="pp-section-header">${TEXTS.TOOLS}</div><div class="pp-tool-grid"><div class="pp-tool-row-label">${TEXTS.COLORS}</div><div class="pp-tool-row"><button class="pp-tool-btn active" data-tool="brush" title="${TEXTS.TIP_BRUSH}"><span class="pp-tool-btn-label">${TEXTS.TOOL_BRUSH}</span></button><button class="pp-tool-btn" data-tool="eraser" title="${TEXTS.TIP_ERASER}"><span class="pp-tool-btn-label">${TEXTS.TOOL_ERASER}</span></button><button class="pp-tool-btn" data-tool="fill" title="${TEXTS.TIP_FILL}"><span class="pp-tool-btn-label">${TEXTS.TOOL_FILL}</span></button><button class="pp-tool-btn" data-tool="picker" title="${TEXTS.TIP_PICKER}"><span class="pp-tool-btn-label">${TEXTS.TOOL_PICKER}</span></button></div><div class="pp-tool-row-label">${TEXTS.BRUSHES}</div><div class="pp-tool-row"><button class="pp-tool-btn" data-tool="select" title=${TEXTS.TIP_SELECT_LONG}><span class="pp-tool-btn-label">${TEXTS.TOOL_SELECT}</span></button><button class="pp-tool-btn" id="ppBtnSaveBrush" title=${TEXTS.TIP_SAVE_BRUSH_LONG}><span class="pp-tool-btn-label">${TEXTS.SAVE_BRUSH}</span></button><button class="pp-tool-btn" data-tool="stamp" title=${TEXTS.TIP_STAMP_LONG}><span class="pp-tool-btn-label">${TEXTS.TOOL_STAMP}</span></button><button class="pp-tool-btn" id="ppBtnSelLeftRight" title=${TEXTS.TIP_FLIP_H_LONG}><span class="pp-tool-btn-label">${TEXTS.FLIP_H}</span></button><button class="pp-tool-btn" id="ppBtnSelUpDown" title=${TEXTS.TIP_FLIP_V_LONG}><span class="pp-tool-btn-label">${TEXTS.FLIP_V}</span></button><button class="pp-tool-btn" id="ppBtnSelRotate" title=${TEXTS.TIP_ROTATE_LONG}><span class="pp-tool-btn-label">${TEXTS.ROTATE}</span></button></div><div class="pp-tool-row-label">${TEXTS.COMMON}</div><div class="pp-tool-row"><button class="pp-tool-btn" id="ppBtnUndo" title=${TEXTS.TIP_UNDO_LONG}><span class="pp-tool-btn-label">${TEXTS.UNDO}</span></button><button class="pp-tool-btn" id="ppBtnRedo" title=${TEXTS.TIP_REDO_LONG}><span class="pp-tool-btn-label">${TEXTS.REDO}</span></button><button class="pp-tool-btn" id="ppBtnExportData" title=${TEXTS.TIP_EXPORT_DATA_LONG}><span class="pp-tool-btn-label">${TEXTS.EXPORT_DATA}</span></button><button class="pp-tool-btn" id="ppBtnExportFull" title=${TEXTS.TIP_EXPORT_FULL_LONG}><span class="pp-tool-btn-label">${TEXTS.EXPORT_FULL}</span></button><button class="pp-tool-btn" id="ppBtnExportTrim" title=${TEXTS.TIP_EXPORT_TRIM_LONG}><span class="pp-tool-btn-label">${TEXTS.EXPORT_TRIM}</span></button><button class="pp-tool-btn" id="ppBtnImport" title=${TEXTS.TIP_IMPORT_DATA_LONG}><span class="pp-tool-btn-label">${TEXTS.IMPORT_DATA}</span></button><button class="pp-tool-btn" id="ppBtnImportImg" title=${TEXTS.TIP_IMPORT_IMG_LONG}><span class="pp-tool-btn-label">${TEXTS.IMPORT_IMG}</span></button><button class="pp-tool-btn" id="ppBtnClear" title=${TEXTS.TIP_CLEAR_LONG}><span class="pp-tool-btn-label">${TEXTS.CLEAR}</span></button><button class="pp-tool-btn" id="ppBtnReset" title=${TEXTS.TIP_RESET_LONG}><span class="pp-tool-btn-label">${TEXTS.RESET}</span></button></div></div></div><div class="pp-panel-zoom"><span class="pp-panel-zoom-label">${TEXTS.ZOOM}</span><input type="range" id="ppPanelZoomSlider" min="100" max="200" step="10" value="130"><span class="pp-panel-zoom-val" id="ppPanelZoomVal">130%</span></div></div><div class="pp-resize-bar-v" id="ppResizeBarStatic"></div><div class="pp-panel-dynamic" id="ppPanelDynamic"><div class="pp-panel-section" id="ppSecColors" style="flex:1;min-height:0;overflow-y:auto;"><div class="pp-section-header">${TEXTS.COLORS} <span class="pp-section-btns"><button class="pp-add-btn" id="ppMergeColorBtn" title=${TEXTS.TIP_MERGE_COLOR}>合</button><button class="pp-add-btn del" id="ppClearColorBtn" title=${TEXTS.TIP_CLEAR_COLOR} style="font-size:10px;">--</button><button class="pp-add-btn del" id="ppDelColorBtn" title=${TEXTS.TIP_DEL_COLOR}>-</button><button class="pp-add-btn" id="ppAddColorBtn" title=${TEXTS.TIP_ADD_COLOR}>+</button><button class="pp-add-btn" id="ppEditColorBtn" title=${TEXTS.TIP_EDIT_COLOR}>E</button><span class="pp-color-input-wrap"><input type="color" id="ppAddColorInput" value="#e94560" title=${TEXTS.TIP_PICKER_SHORT}></span></span></div><div class="pp-pixel-grid" id="ppPixelGrid"></div></div><div class="pp-resize-bar-h" data-resize="ppSecColors,ppSecBrushes"></div><div class="pp-panel-section" id="ppSecBrushes" style="flex:1;min-height:0;overflow-y:auto;"><div class="pp-section-header">${TEXTS.BRUSHES} <span class="pp-section-btns"><button class="pp-add-btn del" id="ppClearBrushBtn" title=${TEXTS.TIP_CLEAR_BRUSH} style="font-size:10px;">--</button><button class="pp-add-btn del" id="ppDelBrushBtn" title=${TEXTS.TIP_DEL_BRUSH}>-</button><button class="pp-add-btn" id="ppAddBrushBtn" title=${TEXTS.TIP_ADD_BRUSH}>+</button><button class="pp-add-btn" id="ppExportBrushBtn" title=${TEXTS.TIP_EXPORT_BRUSH}>^</button><button class="pp-add-btn" id="ppImportBrushBtn" title=${TEXTS.TIP_IMPORT_BRUSH}>v</button></span></div><div class="pp-brush-grid" id="ppBrushGrid" style="align-content:start;"></div></div></div></div><div class="pp-resize-bar-v" id="ppResizeBarV"></div><div class="pp-main"><div style="display:flex;flex:1;overflow:hidden;"><div style="flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden;"><div class="pp-tab-bar" id="ppTabBar"></div><div style="display:flex;flex:1;overflow:hidden;min-height:0;"><div class="pp-canvas-area" id="ppCanvasArea" style="flex:1;"><div class="pp-canvas-viewport" id="ppCanvasViewport"><div class="pp-canvas-container"><canvas id="ppMainCanvas"></canvas><canvas id="ppGridCanvas" style="position:absolute;top:0;left:0;pointer-events:none;z-index:1;"></canvas><canvas id="ppSelCanvas" style="position:absolute;top:0;left:0;pointer-events:none;z-index:2;"></canvas></div></div><div class="pp-canvas-info" id="ppCanvasInfo"></div></div><div id="ppPanelRight" style="flex:1;display:none;flex-direction:column;overflow:hidden;background:#0d0d1a;min-width:0;"></div></div><div class="pp-resize-bar" id="ppResizeBar"></div><div class="pp-panel-bottom" id="ppPanelBottom"><div class="pp-bottom-header"><div style="display:flex;align-items:center;gap:4px;">${TEXTS.COMMON}<button class="pp-bottom-btn" id="ppBtnDelFrame" style="color:#e74c3c;">${TEXTS.DEL_FRAME}</button><button class="pp-bottom-btn" id="ppBtnDelLayer" style="color:#e74c3c;">${TEXTS.DEL_LAYER}</button><button class="pp-bottom-btn" id="ppBtnExportSprite">${TEXTS.EXPORT_SPRITE}</button><button class="pp-bottom-btn" id="ppBtnExportLayerSprite">${TEXTS.EXPORT_LAYER_SPRITE}</button></div><div style="display:flex;align-items:center;gap:4px;"><span style="color:#888;font-size:10px;">${TEXTS.FPS}</span><input type="number" id="ppFpsInput" value="5" min="1" max="60" style="width:42px;height:22px;background:#0a0a1a;border:1px solid #333;color:#e0e0e0;text-align:center;font-size:10px;font-family:inherit;border-radius:3px;"><span style="color:#888;font-size:10px;">FPS</span><button class="pp-bottom-btn" id="ppBtnPlay">${TEXTS.PLAY}</button></div></div><div class="pp-timeline" id="ppTimeline"></div></div></div></div>`;
    },

    _bindEvents: function(overlay) {
        var self = this;
        this._on(overlay.querySelector('[data-action="close"]'), 'click', function() { self._destroy(); if (typeof SkillSystem !== 'undefined') SkillSystem.deactivate(); });
        this._qa('.pp-size-preset').forEach(function(btn) { self._on(btn, 'click', function() { self._applySize(parseInt(btn.dataset.size), parseInt(btn.dataset.size)); }); });
        this._on(this._q('#ppSizeApply'), 'click', function() { self._applySize(parseInt(self._q('#ppSizeW').value) || 128, parseInt(self._q('#ppSizeH').value) || 128); });
        this._on(this._q('#ppNumToggle'), 'click', function() { this.classList.toggle('on'); self._showNumbers = this.classList.contains('on'); self._drawCanvas(); self._autoSave(); });
        this._on(this._q('#ppGridToggle'), 'click', function() { this.classList.toggle('on'); self._showGrid = this.classList.contains('on'); self._drawGrid(); self._autoSave(); });
        this._qa('.pp-tool-btn[data-tool]').forEach(function(btn) { self._on(btn, 'click', function() { self._setTool(btn.dataset.tool); }); });
        this._on(this._q('#ppBtnUndo'), 'click', function() { self._undo(); });
        this._on(this._q('#ppBtnRedo'), 'click', function() { self._redo(); });
        this._on(this._q('#ppBtnSaveBrush'), 'click', function() { self._saveBrush(); });
        this._on(this._q('#ppBtnSelLeftRight'), 'click', function() { self._selApplyTransform(self._selFlipH); });
        this._on(this._q('#ppBtnSelUpDown'), 'click', function() { self._selApplyTransform(self._selFlipV); });
        this._on(this._q('#ppBtnSelRotate'), 'click', function() { self._selApplyTransform(self._selRotate); });
        this._on(this._q('#ppBtnExportData'), 'click', function() { self._doExportData(); });
        this._on(this._q('#ppBtnExportFull'), 'click', function() { self._doExportFull(); });
        this._on(this._q('#ppBtnExportTrim'), 'click', function() { self._doExportTrim(); });
        this._on(this._q('#ppBtnImport'), 'click', function() { self._q('#ppImportInput').click(); });
        // 在存全图旁加"保存到画布"
        (function() {
            var exportBtn = self._q('#ppBtnExportFull');
            if (exportBtn) {
                var ce = document.createElement('button');
                ce.className = 'pp-tool-btn';
                ce.style.cssText = 'border:1px solid var(--cos-accent);background:var(--cos-accent-soft);color:var(--cos-accent);';
                ce.innerHTML = '<span class="pp-tool-btn-label">保存到画布</span>';
                ce.title = '导出当前画布并保存到画布';
                ce.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var tab = self._getActiveTab();
                    if (!tab) return;
                    var ec = document.createElement('canvas');
                    ec.width = tab.w; ec.height = tab.h;
                    var ectx = ec.getContext('2d');
                    for (var y = 0; y < tab.h; y++) for (var x = 0; x < tab.w; x++) {
                        var id = tab.data[y][x];
                        if (id !== 0) { var c = self._getColor(id); if (c) { ectx.fillStyle = c; ectx.fillRect(x, y, 1, 1); } }
                    }
                    var dataURL = ec.toDataURL('image/png');
                    var parentId = (typeof CanvasImages !== 'undefined') ? CanvasImages.getSelectedId() : null;
                    if (typeof CanvasImages !== 'undefined') {
                        CanvasImages.place(dataURL, null, null, tab.name + ' ' + new Date().toLocaleTimeString(), parentId);
                    }
                    if (typeof showToast === 'function') showToast('已保存到画布');
                });
                exportBtn.parentNode.insertBefore(ce, exportBtn.nextSibling);
            }
        })();
        this._on(this._q('#ppBtnClear'), 'click', function() { self._doClear(); });
        this._on(this._q('#ppBtnReset'), 'click', function() { self._doReset(); });
        this._on(this._q('#ppBtnCalibrate'), 'click', function() { self._calibrateImage(); });
        this._on(this._q('#ppImportInput'), 'change', function(e) { self._handleImportData(e); });
        this._on(this._q('#ppAddColorBtn'), 'click', function() { self._editColorMode = false; self._q('#ppAddColorInput').click(); });
        this._on(this._q('#ppAddColorInput'), 'change', function() { self._handleAddColor(this.value); });
        this._on(this._q('#ppEditColorBtn'), 'click', function() { self._handleEditColor(); });
        this._on(this._q('#ppDelColorBtn'), 'click', function() { self._deleteColorMode = !self._deleteColorMode; this.classList.toggle('active', self._deleteColorMode); self._q('#ppPixelGrid').classList.toggle('delete-mode', self._deleteColorMode); });
        this._on(this._q('#ppClearColorBtn'), 'click', function() { self._doClearColor(); });
        this._on(this._q('#ppMergeColorBtn'), 'click', function() { self._handleMergeColor(); });
        this._on(this._q('#ppDelBrushBtn'), 'click', function() { self._deleteBrushMode = !self._deleteBrushMode; this.classList.toggle('active', self._deleteBrushMode); self._q('#ppBrushGrid').classList.toggle('delete-mode', self._deleteBrushMode); });
        this._on(this._q('#ppAddBrushBtn'), 'click', function() { self._showModal(TEXTS.MSG_SELECT_AREA_FOR_BRUSH, [{text:TEXTS.BTN_OK,value:true,primary:true}]); });
        this._on(this._q('#ppClearBrushBtn'), 'click', function() { self._doClearBrush(); });
        this._on(this._q('#ppExportBrushBtn'), 'click', function() { self._doExportBrush(); });
        this._on(this._q('#ppImportBrushBtn'), 'click', function() { self._q('#ppImportBrushInput').click(); });
        this._on(this._q('#ppImportBrushInput'), 'change', function(e) { self._handleImportBrush(e); });
        this._on(this._q('#ppPanelZoomSlider'), 'input', function() { self._applyPanelZoom(parseInt(this.value)); });
        this._on(this._canvasArea, 'mousedown', function(e) { self._onCanvasMouseDown(e); });
        this._on(this._canvasArea, 'mousemove', function(e) { self._onCanvasMouseMove(e); });
        this._on(document, 'mouseup', function(e) { self._onCanvasMouseUp(e); });
        this._on(this._canvasArea, 'wheel', function(e) { self._onCanvasWheel(e); }, {passive:false});
        this._on(document, 'keydown', function(e) { self._onKeyDown(e); });
        var resizeBar = this._q('#ppResizeBar');
        this._on(resizeBar, 'mousedown', function(e) { self._isResizing = true; self._resizeStartY = e.clientY; self._resizeStartH = self._panelBottom.offsetHeight; resizeBar.classList.add('active'); e.preventDefault(); });
        var resizeBarV = this._q('#ppResizeBarV');
        this._on(resizeBarV, 'mousedown', function(e) { self._isResizingV = true; self._resizeStartX = e.clientX; self._resizeStartW = self._panelLeft.offsetWidth; resizeBarV.classList.add('active'); e.preventDefault(); });
        var resizeBarStatic = this._q('#ppResizeBarStatic');
        if (resizeBarStatic) this._on(resizeBarStatic, 'mousedown', function(e) { self._isResizingStatic = true; self._resizeStaticStartX = e.clientX; self._resizeStaticStartW = self._q('#ppPanelStatic').offsetWidth; resizeBarStatic.classList.add('active'); e.preventDefault(); });
        this._qa('.pp-resize-bar-h').forEach(function(bar) { self._on(bar, 'mousedown', function(e) { var ids = bar.dataset.resize.split(','); self._hSec1 = self._q('#' + ids[0]); self._hSec2 = self._q('#' + ids[1]); if (!self._hSec1 || !self._hSec2) return; self._activeHBar = bar; self._hResizeStartY = e.clientY; self._hResizeStartH1 = self._hSec1.offsetHeight; self._hResizeStartH2 = self._hSec2.offsetHeight; bar.classList.add('active'); e.preventDefault(); }); });
        this._on(document, 'mousemove', function(e) { if (self._isResizing) self._panelBottom.style.height = Math.max(50, Math.min(window.innerHeight - 200, self._resizeStartH + (self._resizeStartY - e.clientY))) + 'px'; if (self._isResizingV) self._panelLeft.style.width = Math.max(120, Math.min(window.innerWidth - 200, self._resizeStartW + (e.clientX - self._resizeStartX))) + 'px'; if (self._isResizingStatic) { var newStaticW = Math.max(80, Math.min(self._panelLeft.offsetWidth - 100, self._resizeStaticStartW + (e.clientX - self._resizeStaticStartX))); self._q('#ppPanelStatic').style.width = newStaticW + 'px'; } if (self._activeHBar) { var dy = e.clientY - self._hResizeStartY; self._hSec1.style.height = Math.max(20, self._hResizeStartH1 + dy) + 'px'; self._hSec1.style.flex = 'none'; self._hSec2.style.height = Math.max(20, self._hResizeStartH2 - dy) + 'px'; self._hSec2.style.flex = 'none'; } });
        this._on(document, 'mouseup', function() { if (self._isResizing) { self._isResizing = false; self._q('#ppResizeBar').classList.remove('active'); self._autoSave(); } if (self._isResizingV) { self._isResizingV = false; self._q('#ppResizeBarV').classList.remove('active'); self._autoSave(); } if (self._isResizingStatic) { self._isResizingStatic = false; self._q('#ppResizeBarStatic').classList.remove('active'); self._autoSave(); } if (self._activeHBar) { self._activeHBar.classList.remove('active'); self._activeHBar = null; self._autoSave(); } });
        this._on(this._q('#ppBtnPlay'), 'click', function() { self._togglePlay(); });
        this._on(this._q('#ppBtnDelFrame'), 'click', function() { self._doDelFrame(); });
        this._on(this._q('#ppBtnDelLayer'), 'click', function() { self._doDelLayer(); });
        this._on(this._q('#ppBtnExportSprite'), 'click', function() { self._doExportSprite(); });
        this._on(this._q('#ppBtnExportLayerSprite'), 'click', function() { self._doExportLayerSprite(); });

        if (typeof PixelPaint3D !== 'undefined') {
            try { PixelPaint3D.init(overlay); } catch(e) { console.error('PixelPaint3D init error:', e); }
        }
    },

    _initAsync: function() {
        var self = this;
        (async function() {
            try {
            var saved = await self._loadState();
            if (saved) {
                if (saved.pixelBlocks) { self._pixelBlocks.length = 0; self._pixelBlocks.push.apply(self._pixelBlocks, saved.pixelBlocks); self._nextBlockId = self._pixelBlocks.length ? Math.max.apply(null, self._pixelBlocks.map(function(b){return b.id;})) + 1 : 1; }
                if (saved.brushes) { self._brushes.length = 0; saved.brushes.forEach(function(b, i) { self._nextBrushId = Math.max(self._nextBrushId, (b.id || 0) + 1); b.name = String(i + 1); self._brushes.push(b); }); self._nextBrushId = saved.nextBrushId || self._nextBrushId; }
                if (saved.layers) { self._layers.length = 0; self._layers.push.apply(self._layers, saved.layers); }
                if (saved.frameCount != null) self._frameCount = saved.frameCount;
                if (saved.activeFrame != null) self._activeFrame = saved.activeFrame;
                if (saved.activeLayer != null) self._activeLayer = saved.activeLayer;
                if (saved.frameData) self._frameData = saved.frameData;
                if (saved.selectedBlock != null) self._selectedBlock = saved.selectedBlock;
                if (saved.showNumbers != null) { self._showNumbers = saved.showNumbers; var tog = self._q('#ppNumToggle'); if (self._showNumbers) tog.classList.add('on'); else tog.classList.remove('on'); }
                if (saved.showGrid != null) { self._showGrid = saved.showGrid; var gtog = self._q('#ppGridToggle'); if (self._showGrid) gtog.classList.add('on'); else gtog.classList.remove('on'); }
                if (saved.currentTool) self._setTool(saved.currentTool);
                if (saved.selectedBrushIdx != null) self._selectedBrushIdx = saved.selectedBrushIdx;
                if (saved.panelZoom != null) self._applyPanelZoom(saved.panelZoom);
                if (saved.panelWidth != null) self._panelLeft.style.width = saved.panelWidth + 'px';
                if (saved.staticWidth != null) { var ps = self._q('#ppPanelStatic'); if (ps) ps.style.width = saved.staticWidth + 'px'; }
                if (saved.bottomHeight != null) self._panelBottom.style.height = saved.bottomHeight + 'px';
                if (saved.sectionHeights) { Object.keys(saved.sectionHeights).forEach(function(id) { var el = self._q('#' + id); if (el) { el.style.height = saved.sectionHeights[id] + 'px'; el.style.flex = 'none'; } }); }
                if (saved.tabCounter != null) self._tabCounter = saved.tabCounter;
                if (saved.tabs && saved.tabs.length) { saved.tabs.forEach(function(t) { self._tabs.push({id:t.id,name:t.name,w:t.w,h:t.h,data:t.data,zoom:t.zoom||1,panX:t.panX||0,panY:t.panY||0}); }); self._activeTabId = saved.activeTabId || self._tabs[0].id; var tab = self._getActiveTab(); if (tab) { self._q('#ppSizeW').value = tab.w; self._q('#ppSizeH').value = tab.h; if (!self._frameData.length) self._initFrameData(tab.w, tab.h); self._loadCurrentFrame(); self._resizeAndDraw(); } self._renderTabs(); self._renderTimeline(); }
            }
            if (!self._tabs.length) self._addTab(32, 32);
            self._renderPixelGrid(); self._renderBrushes();
            var tab = self._getActiveTab();
            if (tab && tab.panX === 0 && tab.panY === 0) {
                setTimeout(function() { self._centerCanvas(); }, 50);
            } else if (tab) {
                setTimeout(function() { self._updateViewport(); self._updateInfo(); }, 50);
            }
            self._on(window, 'resize', function() { self._centerCanvas(); });
             window.addEventListener('beforeunload', function() {
                 self._doImmediateSave();
             });

            if (typeof ResizeObserver !== 'undefined') {
                self._resizeObserver = new ResizeObserver(function() {
                    if (!self._overlay) return;
                    try {
                        var r = self._overlay.getBoundingClientRect();
                        localStorage.setItem('pp-window-size', JSON.stringify({w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top)}));
                    } catch(e) {}
                });
                self._resizeObserver.observe(self._overlay);
            }

            var tip = document.createElement('div');
            tip.className = 'pp-tip';
            tip.style.cssText = 'position:fixed;padding:8px 12px;background:rgba(10,15,35,0.95);border:1px solid var(--cos-border);border-radius:6px;color:var(--cos-text);font-size:11px;pointer-events:none;z-index:99999;max-width:280px;opacity:0;transition:opacity 0.15s;line-height:1.6;white-space:normal;box-shadow:0 4px 12px rgba(0,0,0,0.5);';
            document.body.appendChild(tip);
            self._qa('[title]').forEach(function(el) {
                var raw = el.getAttribute('title');
                el.setAttribute('data-tip', raw);
                el.removeAttribute('title');
                self._on(el, 'mouseenter', function() {
                    var parts = raw.split('：');
                    if (parts.length >= 2) {
                        var desc = parts.slice(1).join('：');
                        desc = desc.replace(/\n/g, '<br>');
                        tip.innerHTML = '<div style="color:#f0c878;font-weight:bold;font-size:12px;margin-bottom:4px;">' + parts[0] + '</div><div style="color:#ccc;">' + desc + '</div>';
                    } else {
                        tip.innerHTML = '<div style="color:#f0c878;font-weight:bold;font-size:12px;">' + raw + '</div>';
                    }
                    tip.style.opacity = '1';
                });
                self._on(el, 'mousemove', function(e) { tip.style.left = (e.clientX + 12) + 'px'; tip.style.top = (e.clientY - tip.offsetHeight - 8) + 'px'; });
                self._on(el, 'mouseleave', function() { tip.style.opacity = '0'; });
            });
            } catch(err) { console.error('PixelPaint init error:', err); }
        })();
    },

    _showModal: function(msg, buttons) {
        var self = this;
        return new Promise(function(resolve) {
            var overlay = self._q('#ppModalOverlay'); var msgEl = self._q('#ppModalMsg'); var btnsEl = self._q('#ppModalBtns');
            msgEl.textContent = msg; btnsEl.innerHTML = '';
            buttons.forEach(function(b) { var btn = document.createElement('button'); btn.className = 'pp-modal-btn' + (b.primary ? ' primary' : ''); btn.textContent = b.text; btn.onclick = function() { overlay.classList.remove('show'); resolve(b.value); }; btnsEl.appendChild(btn); });
            overlay.classList.add('show');
        });
    }
};
