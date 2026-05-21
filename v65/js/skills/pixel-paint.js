/**
 * ============================================
 *   像素画 - v65 技能
 *   position:fixed 独立窗口模式
 * ============================================
 */

var PixelPaintSkill = {

    id: 'pixel-paint',
    name: '像素画',
    icon: '<span style="color:#ef4444;">像</span>',
    description: '数字像素绘画系统，支持多标签页、动画表、图层、笔刷',
    key: '6',

    _overlay: null,
    _canvas: null,
    _ctx: null,
    _selCanvas: null,
    _selCtx: null,
    _canvasArea: null,
    _canvasViewport: null,
    _bgCanvas: null,
    _bgCtx: null,
    _panelLeft: null,
    _panelBottom: null,
    _panelLeftContent: null,
    _events: [],
    CELL: 16,
    DB_NAME: 'PixelPaintDB',
    DB_VER: 1,
    STORE: 'state',

    _selectedBlock: 1,
    _showNumbers: true,
    _currentTool: 'brush',
    _selectedBrushIdx: -1,
    _mergedData: null,
    _mergedW: 0,
    _mergedH: 0,
    _bgDirty: true,
    _panelZoom: 100,
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
    _brushes: [],
    _layers: [],
    _frameData: [],
    _undoStack: [],
    _redoStack: [],
    _thumbCache: null,

    activate: function(world) {
        if (this._overlay) { if (typeof SkillSystem !== 'undefined') SkillSystem.renderSubTools(); return; }
        var self = this;
        this._world = world;
        this._initState();
        this._createOverlay();
        if (typeof SkillSystem !== 'undefined') SkillSystem.renderSubTools();
    },

    deactivate: function() {},

    getSubTools: function() {
        var self = this;
        return [{ label: '关', action: function() { self._destroy(); if (typeof SkillSystem !== 'undefined') SkillSystem.deactivate(); } }];
    },

    save: function() { return null; },

    _initState: function() {
        this._tabs=[];this._tabCounter=0;this._activeTabId=null;
        this._pixelBlocks=[{id:1,color:'#e94560',name:'红'},{id:2,color:'#f5a623',name:'橙'},{id:3,color:'#f7dc6f',name:'黄'},{id:4,color:'#2ecc71',name:'绿'},{id:5,color:'#3498db',name:'蓝'},{id:6,color:'#9b59b6',name:'紫'},{id:7,color:'#1abc9c',name:'青'},{id:8,color:'#ecf0f1',name:'白'},{id:9,color:'#95a5a6',name:'灰'},{id:10,color:'#2c3e50',name:'深蓝'}];
        this._defaultBlocks=JSON.parse(JSON.stringify(this._pixelBlocks));
        this._nextBlockId=11;this._brushes=[];this._nextBrushId=1;this._selectedBrushIdx=-1;
        this._layers=[{name:'图层1',visible:true}];this._frameData=[];this._frameCount=1;this._activeFrame=0;this._activeLayer=0;
        this._undoStack=[];this._redoStack=[];this._selectedBlock=1;this._showNumbers=true;this._currentTool='brush';
        this._mergedData=null;this._thumbCache=new Map();this._bgDirty=true;this._panelZoom=100;
        this._deleteColorMode=false;this._deleteBrushMode=false;this._editColorMode=false;
        this._mergeColorMode=false;this._mergeColorIds=[];this._selection=null;this._selData=null;
        this._selLocked=false;this._selDragging=false;this._brushPreviewPos=null;this._isPlaying=false;
        this._playInterval=null;this._isDrawing=false;this._isPanning=false;this._isResizing=false;
        this._isResizingV=false;this._isResizingR=false;this._activeHBar=null;this._saveTimer=null;
        this._editingFace=null;
    },

    _destroy: function() {
        this._events.forEach(function(item){if(item.target)item.target.removeEventListener(item.type,item.fn,item.options);});
        this._events=[];
        if(this._playInterval){clearInterval(this._playInterval);this._playInterval=null;}
        if(this._saveTimer){clearTimeout(this._saveTimer);this._saveTimer=null;}
        if(this._resizeObserver){this._resizeObserver.disconnect();this._resizeObserver=null;}
        if(this._overlay&&this._overlay.parentNode){
            this._overlay.parentNode.removeChild(this._overlay);
        }
        this._overlay=null;this._canvas=null;this._ctx=null;this._selCanvas=null;this._selCtx=null;
        this._canvasArea=null;this._canvasViewport=null;this._bgCanvas=null;this._bgCtx=null;
        this._panelLeft=null;this._panelBottom=null;this._panelLeftContent=null;
        if (typeof PixelPaint3D !== 'undefined') { try { PixelPaint3D.destroy(); } catch(e) {} }
        this._initState();
    },

    _q: function(sel){return this._overlay?this._overlay.querySelector(sel):null;},
    _qa: function(sel){return this._overlay?this._overlay.querySelectorAll(sel):null;},
    _on: function(target,type,fn,options){target.addEventListener(type,fn,options);this._events.push({target:target,type:type,fn:fn,options:options});},

    _getCSS: function(){return'.pp-overlay{position:fixed;width:900px;height:650px;z-index:9999;display:flex;flex-direction:column;background:rgba(10,15,35,0.85);color:#e8edf5;font-family:"Courier New",monospace;border-radius:10px;box-shadow:0 8px 40px rgba(0,0,0,.4),inset 0 1px 0 rgba(255,255,255,0.05);overflow:hidden;user-select:none;min-width:600px;min-height:400px;}.pp-header{display:flex;align-items:center;justify-content:space-between;padding:6px 14px;background:rgba(15,25,50,0.7);border-bottom:1px solid rgba(100,160,255,0.1);flex-shrink:0;cursor:move;user-select:none;}.pp-header h1{font-size:16px;color:#38bdf8;margin:0;font-weight:bold;}.pp-close-btn{transition:all 0.15s;background:rgba(220,80,60,.2);border:1px solid rgba(220,80,60,.3);color:#e87060;border-radius:6px;padding:4px 12px;cursor:pointer;font-size:13px;}.pp-close-btn:hover{background:rgba(220,80,60,.4);}.pp-body{flex:1;display:flex;overflow:hidden;min-height:0;}.pp-main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;}.pp-resize-handle{position:absolute;right:0;bottom:0;width:16px;height:16px;cursor:nwse-resize;z-index:10;}.pp-resize-handle::after{content:"";position:absolute;right:3px;bottom:3px;width:8px;height:8px;border-right:2px solid rgba(100,160,255,0.2);border-bottom:2px solid rgba(100,160,255,0.2);}.pp-tab-bar{height:30px;background:rgba(10,15,35,0.7);border-bottom:1px solid rgba(100,160,255,0.1);display:flex;align-items:stretch;flex-shrink:0;overflow-x:auto;}.pp-tab{display:flex;align-items:center;gap:4px;padding:0 10px;font-size:13px;color:#94a3b8;cursor:pointer;border-right:1px solid rgba(100,160,255,0.1);white-space:nowrap;position:relative;}.pp-tab:hover{color:#94a3b8;background:rgba(233,69,96,0.05);}.pp-tab.active{color:#e8edf5;background:rgba(15,25,50,0.7);}.pp-tab.active::after{content:"";position:absolute;bottom:0;left:0;right:0;height:2px;background:#38bdf8;}.pp-tab-name{font-weight:bold;}.pp-tab-size{font-size:11px;color:#475569;}.pp-tab-close{transition:all 0.15s;font-size:13px;color:#94a3b8;cursor:pointer;margin-left:4px;padding:0 3px;border-radius:4px;line-height:1;}.pp-tab-close:hover{color:#e94560;background:rgba(233,69,96,0.2);}.pp-tab-add{transition:all 0.15s;display:flex;align-items:center;justify-content:center;width:28px;min-width:28px;color:#475569;font-size:16px;cursor:pointer;}.pp-tab-add:hover{color:#e94560;background:rgba(233,69,96,0.1);}.pp-panel-left{width:180px;background:rgba(15,25,50,0.7);display:flex;flex-direction:column;flex-shrink:0;overflow:hidden;min-height:0;height:100%;}.pp-panel-left-content{flex:1;display:flex;flex-direction:column;overflow:hidden;min-height:0;}.pp-panel-section{display:flex;flex-direction:column;min-height:0;overflow-x:hidden;transition:background 0.2s;}.pp-panel-section:hover{background:rgba(100,160,255,0.03);}.pp-panel-section-body{flex:1;overflow-y:auto;overflow-x:hidden;min-height:0;}.pp-panel-section.collapsed .pp-panel-section-body{display:none;}.pp-resize-bar-h{height:4px;background:rgba(100,160,255,0.15);cursor:ns-resize;flex-shrink:0;position:relative;z-index:5;transition:background 0.15s;}.pp-resize-bar-h:hover,.pp-resize-bar-h.active{background:#e94560;}.pp-resize-bar-h::after{content:"";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:20px;height:2px;background:rgba(255,255,255,0.15);border-radius:3px;}.pp-resize-bar-h:hover::after,.pp-resize-bar-h.active::after{background:rgba(255,255,255,0.4);}.pp-section-header{padding:5px 8px;font-size:13px;font-weight:bold;color:#38bdf8;display:flex;justify-content:space-between;align-items:center;letter-spacing:1px;gap:3px;}.pp-section-btns{display:flex;gap:2px;align-items:center;}.pp-color-input-wrap{width:16px;height:16px;border-radius:5px;overflow:hidden;border:1px solid rgba(100,160,255,0.15);cursor:pointer;flex-shrink:0;}.pp-color-input-wrap input[type=color]{width:24px;height:24px;border:none;padding:0;cursor:pointer;margin:-4px;}.pp-add-btn{transition:all 0.15s;background:#e94560;color:#fff;border:none;width:18px;height:18px;border-radius:5px;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;}.pp-add-btn.del{transition:all 0.15s;background:#2c3e50;color:#e74c3c;border:1px solid #e74c3c;}.pp-add-btn.del.active{background:#e74c3c;color:#fff;}.pp-size-section{padding:5px 8px;display:flex;flex-direction:column;gap:3px;}.pp-size-presets{display:grid;grid-template-columns:repeat(4,1fr);gap:2px;}.pp-size-preset{transition:all 0.15s;background:rgba(100,160,255,0.15);border:1px solid rgba(100,160,255,0.15);border-radius:5px;color:#94a3b8;font-size:12px;cursor:pointer;padding:2px 0;font-family:inherit;transition:0.15s;}.pp-size-preset:hover{border-color:#e94560;color:#e94560;}.pp-size-custom{display:flex;align-items:center;gap:3px;justify-content:center;}.pp-size-input{width:48px;height:22px;background:rgba(0,10,30,0.4);border:1px solid rgba(100,160,255,0.15);color:#e8edf5;text-align:center;font-size:12px;font-family:inherit;border-radius:5px;}.pp-size-input:focus{border-color:#e94560;outline:none;}.pp-size-x{font-size:12px;color:#475569;}.pp-size-apply{transition:all 0.15s;background:#e94560;color:#fff;border:none;padding:3px 7px;border-radius:5px;font-size:12px;cursor:pointer;font-family:inherit;}.pp-size-apply:hover{background:#c73850;}.pp-tool-grid{padding:4px;display:flex;flex-direction:column;gap:3px;}.pp-tool-row{display:flex;flex-wrap:wrap;gap:2px;}.pp-tool-row-label{font-size:10px;color:#475569;padding:0 2px;line-height:1;}.pp-tool-btn{transition:all 0.15s;width:34px;height:30px;flex-shrink:0;background:rgba(100,160,255,0.15);border:1px solid rgba(100,160,255,0.15);border-radius:6px;color:#94a3b8;font-size:12px;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;transition:0.15s;}.pp-tool-btn:hover{border-color:#e94560;color:#e94560;}.pp-tool-btn.active{background:#e94560;border-color:#e94560;color:#fff;}.pp-tool-btn-label{font-size:9px;color:inherit;opacity:1;}.pp-pixel-grid{padding:4px;display:grid;grid-template-columns:repeat(auto-fill,26px);gap:2px;justify-content:start;overflow-y:auto;max-height:160px;}.pp-pixel-grid.delete-mode .pp-pixel-cell{cursor:not-allowed;}.pp-pixel-grid.delete-mode .pp-pixel-cell:hover{outline:2px solid #e94560;outline-offset:-2px;}.pp-pixel-cell{width:26px;height:26px;border-radius:5px;cursor:pointer;position:relative;border:2px solid transparent;transition:0.15s;}.pp-pixel-cell:hover{transform:scale(1.1);z-index:1;}.pp-pixel-cell.selected{border-color:#fff;box-shadow:0 0 6px rgba(233,69,96,0.6);}.pp-pixel-cell.merge-selected{border-color:#e67e22;box-shadow:0 0 6px rgba(230,126,34,0.8);}.pp-pixel-cell-color{width:100%;height:100%;border-radius:4px;}.pp-pixel-cell-num{position:absolute;top:0;left:50%;transform:translateX(-50%);font-size:9px;font-weight:bold;color:#fff;text-shadow:0 0 3px rgba(0,0,0,0.9);pointer-events:none;}.pp-brush-grid{padding:4px;display:grid;grid-template-columns:repeat(auto-fill,38px);gap:3px;justify-content:start;}.pp-brush-grid.delete-mode .pp-brush-item{cursor:not-allowed;}.pp-brush-grid.delete-mode .pp-brush-item:hover{outline:2px solid #e94560;outline-offset:-2px;}.pp-brush-item{width:38px;height:38px;background:rgba(0,10,30,0.4);border:2px solid rgba(100,160,255,0.15);border-radius:5px;cursor:pointer;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;transition:0.15s;}.pp-brush-item:hover{border-color:#e94560;}.pp-brush-item.selected{border-color:#e94560;box-shadow:0 0 6px rgba(233,69,96,0.4);}.pp-brush-item canvas{image-rendering:pixelated;}.pp-brush-item-label{position:absolute;bottom:0;right:2px;font-size:9px;color:#475569;}.pp-toggle-row{padding:6px 8px;display:flex;align-items:center;justify-content:space-between;}.pp-toggle-label{font-size:13px;color:#94a3b8;}.pp-toggle{width:28px;height:15px;background:#333;transition:background 0.25s ease;border-radius:10px;position:relative;cursor:pointer;}.pp-toggle.on{background:#e94560;}.pp-toggle::after{content:"";width:11px;height:11px;background:#fff;border-radius:50%;position:absolute;top:2px;left:2px;transition:all 0.25s cubic-bezier(0.4,0,0.2,1);pointer-events:none;}.pp-toggle.on::after{left:15px;}.pp-panel-zoom{padding:3px 8px;border-top:1px solid rgba(100,160,255,0.1);display:flex;align-items:center;gap:4px;flex-shrink:0;}.pp-panel-zoom-label{font-size:12px;color:#475569;white-space:nowrap;}.pp-panel-zoom input[type=range]{flex:1;height:4px;-webkit-appearance:none;background:rgba(100,160,255,0.15);border-radius:4px;outline:none;}.pp-panel-zoom input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;background:#e94560;border-radius:50%;cursor:pointer;}.pp-panel-zoom-val{font-size:12px;color:#94a3b8;min-width:28px;text-align:right;}.pp-canvas-area{flex:1;background:rgba(0,5,15,0.95);position:relative;overflow:hidden;cursor:crosshair;}.pp-canvas-viewport{position:absolute;top:0;left:0;transform-origin:0 0;}.pp-canvas-container{position:relative;box-shadow:0 0 60px rgba(56,189,248,0.06),0 0 1px rgba(56,189,248,0.2);}.pp-canvas-container canvas{display:block;image-rendering:pixelated;}.pp-canvas-info{position:absolute;bottom:4px;left:50%;transform:translateX(-50%);font-size:11px;color:#fff;background:rgba(0,5,15,0.8);padding:2px 8px;border-radius:8px;white-space:nowrap;z-index:10;}.pp-resize-bar-v{width:5px;background:rgba(100,160,255,0.15);cursor:ew-resize;flex-shrink:0;position:relative;z-index:5;transition:background 0.15s;}.pp-resize-bar-v:hover,.pp-resize-bar-v.active{background:#e94560;}.pp-resize-bar-v::after{content:"";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:2px;height:24px;background:rgba(255,255,255,0.2);border-radius:3px;}.pp-resize-bar-v:hover::after,.pp-resize-bar-v.active::after{background:rgba(255,255,255,0.5);}.pp-panel-bottom{height:150px;min-height:50px;background:rgba(15,25,50,0.7);border-top:none;display:flex;flex-direction:column;flex-shrink:0;}.pp-resize-bar{height:5px;background:rgba(100,160,255,0.15);cursor:ns-resize;flex-shrink:0;position:relative;z-index:5;transition:background 0.15s;}.pp-resize-bar:hover,.pp-resize-bar.active{background:#e94560;}.pp-resize-bar::after{content:"";position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:24px;height:2px;background:rgba(255,255,255,0.2);border-radius:3px;}.pp-resize-bar:hover::after,.pp-resize-bar.active::after{background:rgba(255,255,255,0.5);}.pp-bottom-header{padding:3px 8px;font-size:12px;font-weight:bold;color:#38bdf8;border-bottom:1px solid rgba(100,160,255,0.1);display:flex;justify-content:space-between;align-items:center;letter-spacing:1px;}.pp-bottom-btn{transition:all 0.15s;background:rgba(100,160,255,0.15);color:#94a3b8;border:1px solid rgba(100,160,255,0.15);padding:2px 8px;border-radius:5px;font-size:11px;cursor:pointer;font-family:inherit;}.pp-bottom-btn:hover{border-color:#e94560;color:#e94560;}.pp-timeline{flex:1;overflow:auto;padding:2px;}.pp-timeline-col-header{display:flex;align-items:center;position:sticky;top:0;z-index:2;background:rgba(15,25,50,0.7);}.pp-col-header-corner{width:36px;min-width:36px;height:22px;border-right:1px solid rgba(100,160,255,0.1);border-bottom:1px solid rgba(100,160,255,0.1);display:flex;align-items:center;justify-content:center;font-size:11px;color:#475569;flex-shrink:0;}.pp-col-header-cell{width:44px;min-width:44px;height:22px;border-right:1px solid rgba(100,160,255,0.1);border-bottom:1px solid rgba(100,160,255,0.1);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;color:#94a3b8;flex-shrink:0;}.pp-col-header-cell:hover{background:rgba(233,69,96,0.08);}.pp-col-add-btn{transition:all 0.15s;width:22px;min-width:22px;height:18px;display:flex;align-items:center;justify-content:center;color:#e94560;font-size:16px;cursor:pointer;flex-shrink:0;border-right:1px solid rgba(100,160,255,0.1);border-bottom:1px solid rgba(100,160,255,0.1);}.pp-col-add-btn:hover{background:rgba(233,69,96,0.15);}.pp-timeline-row{display:flex;align-items:center;}.pp-row-header{width:36px;min-width:36px;height:44px;border-right:1px solid rgba(100,160,255,0.1);border-bottom:1px solid rgba(100,160,255,0.1);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;color:#94a3b8;flex-shrink:0;gap:2px;}.pp-row-header .pp-eye{font-size:11px;color:#e94560;cursor:pointer;}.pp-row-header:hover{background:rgba(233,69,96,0.08);}.pp-frame-cell{width:44px;min-width:44px;height:44px;background:rgba(0,5,15,0.9);border-right:1px solid rgba(100,160,255,0.08);border-bottom:1px solid rgba(100,160,255,0.08);cursor:pointer;position:relative;overflow:hidden;flex-shrink:0;}.pp-frame-cell:hover{background:rgba(20,30,60,0.5);}.pp-frame-cell.active{border:2px solid #e94560;box-shadow:0 0 6px rgba(233,69,96,0.3);z-index:1;}.pp-frame-cell canvas{image-rendering:pixelated;width:100%;height:100%;}.pp-corner-add-btn{transition:all 0.15s;width:22px;min-width:22px;height:44px;display:flex;align-items:center;justify-content:center;color:#e94560;font-size:16px;cursor:pointer;flex-shrink:0;border-bottom:1px solid rgba(100,160,255,0.1);}.pp-corner-add-btn:hover{background:rgba(233,69,96,0.15);}.pp-modal-overlay{display:none;position:absolute;top:0;left:0;right:0;bottom:0;background:rgba(0,5,15,0.7);z-index:999;align-items:center;justify-content:center;}.pp-modal-overlay.show{display:flex;}.pp-modal-box{background:rgba(15,25,50,0.7);border:1px solid rgba(100,160,255,0.1);border-radius:10px;padding:18px 22px;min-width:300px;max-width:400px;box-shadow:0 8px 32px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.05);}.pp-modal-msg{font-size:13px;color:#94a3b8;line-height:1.6;margin-bottom:14px;white-space:pre-line;}.pp-modal-btns{display:flex;gap:8px;justify-content:flex-end;}.pp-modal-btn{transition:all 0.15s;padding:6px 16px;border-radius:6px;font-size:12px;cursor:pointer;border:1px solid rgba(100,160,255,0.15);background:rgba(100,160,255,0.15);color:#94a3b8;font-family:inherit;}.pp-modal-btn:hover{border-color:#e94560;color:#e94560;}.pp-modal-btn.primary{transition:all 0.15s;background:#e94560;border-color:#e94560;color:#fff;}.pp-modal-btn.primary:hover{background:#c73850;}.pp-overlay ::-webkit-scrollbar{width:4px;height:4px;}.pp-overlay ::-webkit-scrollbar-track{background:transparent;}.pp-overlay ::-webkit-scrollbar-thumb{background:rgba(100,160,255,0.12);border-radius:4px;}.pp-hidden-input{display:none;}.pp-close-btn:active,.pp-tab-close:active,.pp-tab-add:active,.pp-add-btn:active,.pp-add-btn.del:active,.pp-size-preset:active,.pp-size-apply:active,.pp-tool-btn:active,.pp-bottom-btn:active,.pp-modal-btn:active,.pp-modal-btn.primary:active,.pp-col-add-btn:active,.pp-corner-add-btn:active{transform:scale(0.92);}';},

    _createOverlay: function() {
        var self = this;
        var overlay = document.createElement('div');
        overlay.className = 'pp-overlay';
        overlay.setAttribute('data-skill-id', 'pixel-paint');
        overlay._pixelPaintInstance = this;
        overlay.style.left = Math.max(20, (window.innerWidth - 900) / 2) + 'px';
        overlay.style.top = Math.max(20, (window.innerHeight - 650) / 2) + 'px';
        var styleEl = document.createElement('style');
        styleEl.textContent = this._getCSS();
        overlay.appendChild(styleEl);
        var header = document.createElement('div');
        header.className = 'pp-header';
        header.innerHTML = '<h1>像素画</h1><button class="pp-close-btn" data-action="close">关</button>';
        overlay.appendChild(header);
        var body = document.createElement('div');
        body.className = 'pp-body';
        body.innerHTML = this._buildBodyHTML();
        overlay.appendChild(body);
        var modalOverlay = document.createElement('div');
        modalOverlay.className = 'pp-modal-overlay'; modalOverlay.id = 'ppModalOverlay';
        modalOverlay.innerHTML = '<div class="pp-modal-box"><div class="pp-modal-msg" id="ppModalMsg"></div><div class="pp-modal-btns" id="ppModalBtns"></div></div>';
        overlay.appendChild(modalOverlay);
        // 使用通用窗口缩放（四角+四边）
        if (typeof SkillSystem !== 'undefined' && SkillSystem.WindowHelper) {
            WindowHelper.makeResizable(overlay, { minWidth: 600, minHeight: 400, storeKey: 'pp-window-size' });
        }
        ['ppImportInput:application/json','ppImportImgInput:image/*','ppImportBrushInput:application/json'].forEach(function(spec) {
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
        this._canvasArea = overlay.querySelector('#ppCanvasArea');
        this._canvasViewport = overlay.querySelector('#ppCanvasViewport');
        this._panelLeft = overlay.querySelector('.pp-panel-left');
        this._panelBottom = overlay.querySelector('#ppPanelBottom');
        this._panelLeftContent = overlay.querySelector('#ppPanelLeftContent');
        this._bgCanvas = document.createElement('canvas');
        this._bgCtx = this._bgCanvas.getContext('2d');
        this._bindEvents(overlay);
        this._initAsync();
    },

    _buildBodyHTML: function() {
        return '<div class="pp-panel-left"><div class="pp-panel-left-content" id="ppPanelLeftContent"><div class="pp-panel-section" id="ppSecSize" style="height:auto;flex:none;"><div class="pp-section-header">画布尺寸</div><div class="pp-size-section"><div class="pp-size-presets"><button class="pp-size-preset" data-size="8">8x8</button><button class="pp-size-preset" data-size="16">16x16</button><button class="pp-size-preset" data-size="32">32x32</button><button class="pp-size-preset" data-size="64">64x64</button></div><div class="pp-size-custom"><input class="pp-size-input" id="ppSizeW" type="number" value="128" min="4" max="512"><span class="pp-size-x">x</span><input class="pp-size-input" id="ppSizeH" type="number" value="128" min="4" max="512"><button class="pp-size-apply" id="ppSizeApply">应用</button></div></div></div><div class="pp-resize-bar-h" data-resize="ppSecSize,ppSecToggle"></div><div class="pp-panel-section" id="ppSecToggle" style="height:auto;flex:none;"><div class="pp-toggle-row"><span class="pp-toggle-label">数字显示</span><div class="pp-toggle on" id="ppNumToggle"></div></div></div><div class="pp-resize-bar-h" data-resize="ppSecToggle,ppSecTools"></div><div class="pp-panel-section" id="ppSecTools" style="height:auto;flex:none;overflow-y:auto;"><div class="pp-section-header">工具</div><div class="pp-tool-grid"><div class="pp-tool-row-label">色块</div><div class="pp-tool-row"><button class="pp-tool-btn active" data-tool="brush" title="画笔：左键在画布上绘制当前选中的色块像素"><span class="pp-tool-btn-label">画笔</span></button><button class="pp-tool-btn" data-tool="eraser" title="橡皮：左键擦除像素，将像素变为透明(0)"><span class="pp-tool-btn-label">橡皮</span></button><button class="pp-tool-btn" data-tool="fill" title="填充：点击一个像素，将该像素所在的连通区域全部填充为当前色块"><span class="pp-tool-btn-label">填充</span></button><button class="pp-tool-btn" data-tool="picker" title="找色：点击画布上的像素，自动选中该像素对应的色块"><span class="pp-tool-btn-label">找色</span></button></div><div class="pp-tool-row-label">笔刷</div><div class="pp-tool-row"><button class="pp-tool-btn" data-tool="select" title="选区：在画布上拖拽框选矩形区域\n选中后可移动/翻转/旋转"><span class="pp-tool-btn-label">选区</span></button><button class="pp-tool-btn" id="ppBtnSaveBrush" title="存刷：先用选区工具框选一块区域\n再点此按钮保存为笔刷"><span class="pp-tool-btn-label">存刷</span></button><button class="pp-tool-btn" data-tool="stamp" title="盖章：选中一个笔刷后\n左键在画布上点击放置笔刷图案"><span class="pp-tool-btn-label">盖章</span></button><button class="pp-tool-btn" id="ppBtnSelLeftRight" title="左右翻转：将选区内容水平镜像翻转"><span class="pp-tool-btn-label">左右</span></button><button class="pp-tool-btn" id="ppBtnSelUpDown" title="上下翻转：将选区内容垂直镜像翻转"><span class="pp-tool-btn-label">上下</span></button><button class="pp-tool-btn" id="ppBtnSelRotate" title="旋转：将选区内容顺时针旋转90度"><span class="pp-tool-btn-label">旋转</span></button></div><div class="pp-tool-row-label">公共</div><div class="pp-tool-row"><button class="pp-tool-btn" id="ppBtnUndo" title="撤销：回退上一步操作，支持多步撤销"><span class="pp-tool-btn-label">撤销</span></button><button class="pp-tool-btn" id="ppBtnRedo" title="重做：恢复被撤销的操作"><span class="pp-tool-btn-label">重做</span></button><button class="pp-tool-btn" id="ppBtnExportData" title="存数据：将当前画布数据导出为JSON文件，可用于备份和迁移"><span class="pp-tool-btn-label">存数据</span></button><button class="pp-tool-btn" id="ppBtnExportFull" title="存全图：导出完整画布为PNG图片，透明区域保留透明"><span class="pp-tool-btn-label">存全图</span></button><button class="pp-tool-btn" id="ppBtnExportTrim" title="存裁图：导出画布为PNG图片，自动裁剪掉四周空白区域"><span class="pp-tool-btn-label">存裁图</span></button><button class="pp-tool-btn" id="ppBtnImport" title="入数据：导入之前导出的JSON数据文件，恢复画布内容"><span class="pp-tool-btn-label">入数据</span></button><button class="pp-tool-btn" id="ppBtnImportImg" title="入图片：导入外部图片，自动减色为色块数量并映射到画布"><span class="pp-tool-btn-label">入图片</span></button><button class="pp-tool-btn" id="ppBtnClear" title="清空：清除当前画布所有像素，恢复为空白"><span class="pp-tool-btn-label">清空</span></button><button class="pp-tool-btn" id="ppBtnReset" title="重置：清除所有数据，恢复到初始状态（画布/色块/笔刷全部清空）"><span class="pp-tool-btn-label">重置</span></button></div></div></div><div class="pp-resize-bar-h" data-resize="ppSecTools,ppSecColors"></div><div class="pp-panel-section" id="ppSecColors" style="flex:none;overflow-y:auto;"><div class="pp-section-header">色块 <span class="pp-section-btns"><button class="pp-add-btn" id="ppMergeColorBtn" title="合并色块：1.点击此按钮激活合并模式\n2.点第一个色块作为保留色\n3.点其他要合并的色块\n4.再次点击此按钮完成合并，被选中的色块像素全部替换为保留色" style="background:#2c3e50;color:#e67e22;border:1px solid #e67e22;">合</button><button class="pp-add-btn del" id="ppClearColorBtn" title="清空色块：删除所有色块，画布上使用这些色块的像素也会被清除" style="font-size:10px;">--</button><button class="pp-add-btn del" id="ppDelColorBtn" title="删除色块：点击后进入删除模式，再点击色块即可删除，画布上对应像素也会被清除">-</button><button class="pp-add-btn" id="ppAddColorBtn" title="添加色块：点击后弹出取色器，选择颜色后添加为新色块">+</button><button class="pp-add-btn" id="ppEditColorBtn" title="编辑色块：修改当前选中色块的颜色，画布上使用该色块的像素会自动更新" style="background:#2c3e50;color:#f39c12;border:1px solid #f39c12;">E</button><span class="pp-color-input-wrap"><input type="color" id="ppAddColorInput" value="#e94560" title="取色器：选择颜色后点击+按钮添加为新色块"></span></span></div><div class="pp-pixel-grid" id="ppPixelGrid"></div></div><div class="pp-resize-bar-h" data-resize="ppSecColors,ppSecBrushes"></div><div class="pp-panel-section" id="ppSecBrushes" style="flex:1;min-height:0;overflow-y:auto;"><div class="pp-section-header">笔刷 <span class="pp-section-btns"><button class="pp-add-btn del" id="ppClearBrushBtn" title="清空笔刷：删除所有已保存的笔刷" style="font-size:10px;">--</button><button class="pp-add-btn del" id="ppDelBrushBtn" title="删除笔刷：删除当前选中的笔刷">-</button><button class="pp-add-btn" id="ppAddBrushBtn" title="新建笔刷：创建一个空白笔刷，可在笔刷网格上手动绘制">+</button><button class="pp-add-btn" id="ppExportBrushBtn" title="导出笔刷：将所有笔刷导出为JSON文件，可用于备份" style="background:#2c3e50;color:#2ecc71;border:1px solid #2ecc71;">^</button><button class="pp-add-btn" id="ppImportBrushBtn" title="导入笔刷：从JSON文件导入笔刷，会追加到现有笔刷列表" style="background:#2c3e50;color:#3498db;border:1px solid #3498db;">v</button></span></div><div class="pp-brush-grid" id="ppBrushGrid" style="align-content:start;"></div></div></div><div class="pp-panel-zoom"><span class="pp-panel-zoom-label">缩放</span><input type="range" id="ppPanelZoomSlider" min="100" max="200" step="10" value="100"><span class="pp-panel-zoom-val" id="ppPanelZoomVal">100%</span></div></div><div class="pp-resize-bar-v" id="ppResizeBarV"></div><div class="pp-main"><div style="display:flex;flex:1;overflow:hidden;"><div style="flex:1;display:flex;flex-direction:column;min-width:0;overflow:hidden;"><div class="pp-tab-bar" id="ppTabBar"></div><div style="display:flex;flex:1;overflow:hidden;min-height:0;"><div class="pp-canvas-area" id="ppCanvasArea" style="flex:1;"><div class="pp-canvas-viewport" id="ppCanvasViewport"><div class="pp-canvas-container"><canvas id="ppMainCanvas"></canvas><canvas id="ppSelCanvas" style="position:absolute;top:0;left:0;pointer-events:none;z-index:2;"></canvas></div></div><div class="pp-canvas-info" id="ppCanvasInfo"></div></div><div id="ppPanelRight" style="flex:1;display:none;flex-direction:column;overflow:hidden;background:#0d0d1a;min-width:0;"></div></div><div class="pp-resize-bar" id="ppResizeBar"></div><div class="pp-panel-bottom" id="ppPanelBottom"><div class="pp-bottom-header"><div style="display:flex;align-items:center;gap:4px;">动画表<button class="pp-bottom-btn" id="ppBtnDelFrame" style="color:#e74c3c;">删帧</button><button class="pp-bottom-btn" id="ppBtnDelLayer" style="color:#e74c3c;">删层</button><button class="pp-bottom-btn" id="ppBtnExportSprite">导出帧序列</button><button class="pp-bottom-btn" id="ppBtnExportLayerSprite">导出层序列</button></div><div style="display:flex;align-items:center;gap:4px;"><span style="color:#888;font-size:10px;">帧率</span><input type="number" id="ppFpsInput" value="5" min="1" max="60" style="width:42px;height:22px;background:#0a0a1a;border:1px solid #333;color:#e0e0e0;text-align:center;font-size:10px;font-family:inherit;border-radius:3px;"><span style="color:#888;font-size:10px;">FPS</span><button class="pp-bottom-btn" id="ppBtnPlay">播放</button></div></div><div class="pp-timeline" id="ppTimeline"></div></div></div></div>';
    },

    _bindEvents: function(overlay) {
        var self = this;
        var header = overlay.querySelector('.pp-header');
        var headerDown = false, headerStartX = 0, headerStartY = 0, headerLeft = 0, headerTop = 0;
        this._on(header, 'mousedown', function(e) { if (e.target.closest('.pp-close-btn')) return; headerDown = true; headerStartX = e.clientX; headerStartY = e.clientY; headerLeft = overlay.offsetLeft; headerTop = overlay.offsetTop; e.preventDefault(); });
        this._on(document, 'mousemove', function(e) { if (!headerDown) return; overlay.style.left = (headerLeft + e.clientX - headerStartX) + 'px'; overlay.style.top = (headerTop + e.clientY - headerStartY) + 'px'; });
        this._on(document, 'mouseup', function() { if(headerDown){headerDown=false;try{var r=overlay.getBoundingClientRect();localStorage.setItem('pp-window-size',JSON.stringify({w:Math.round(r.width),h:Math.round(r.height),l:Math.round(r.left),t:Math.round(r.top)}));}catch(e){}} });
        this._on(overlay.querySelector('.pp-close-btn'), 'click', function() { self._destroy(); if (typeof SkillSystem !== 'undefined') SkillSystem.deactivate(); });
        this._on(overlay, 'contextmenu', function(e) { e.preventDefault(); });
        this._qa('.pp-size-preset').forEach(function(btn) { self._on(btn, 'click', function() { self._applySize(parseInt(btn.dataset.size), parseInt(btn.dataset.size)); }); });
        this._on(this._q('#ppSizeApply'), 'click', function() { self._applySize(parseInt(self._q('#ppSizeW').value) || 128, parseInt(self._q('#ppSizeH').value) || 128); });
        this._on(this._q('#ppNumToggle'), 'click', function() { this.classList.toggle('on'); self._showNumbers = this.classList.contains('on'); self._drawCanvas(); self._autoSave(); });
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
        this._on(this._q('#ppBtnImportImg'), 'click', function() { self._q('#ppImportImgInput').click(); });
        // 在入图片旁加"从盘导入"，在存全图旁加"盘导出"
        (function() {
            var importBtn = self._q('#ppBtnImportImg');
            if (importBtn) {
                var ci = document.createElement('button');
                ci.className = 'pp-tool-btn';
                ci.style.cssText = 'border:1px solid rgba(251,191,36,0.3);background:rgba(251,191,36,0.08);color:#fbbf24;';
                ci.innerHTML = '<span class="pp-tool-btn-label">盘导入</span>';
                ci.title = '从本地云盘导入图片';
                ci.addEventListener('click', function(e) {
                    e.stopPropagation();
                    if (typeof CosCloudDrive === 'undefined') return;
                    CosCloudDrive.setOnSelect(function(item) {
                        self._handleImportImgDataURL(item.dataURL);
                        CosCloudDrive._overlay.style.display = 'none';
                        CosCloudDrive.setOnSelect(null);
                    });
                    CosCloudDrive.open();
                });
                importBtn.parentNode.insertBefore(ci, importBtn.nextSibling);
            }
            var exportBtn = self._q('#ppBtnExportFull');
            if (exportBtn) {
                var ce = document.createElement('button');
                ce.className = 'pp-tool-btn';
                ce.style.cssText = 'border:1px solid rgba(56,189,248,0.3);background:rgba(56,189,248,0.08);color:#38bdf8;';
                ce.innerHTML = '<span class="pp-tool-btn-label">盘导出</span>';
                ce.title = '导出当前画布并存入本地云盘';
                ce.addEventListener('click', function(e) {
                    e.stopPropagation();
                    // 只存云盘，不下载
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
                    if (typeof CosCloudDrive !== 'undefined') CosCloudDrive.add(tab.name + ' ' + new Date().toLocaleTimeString(), '像素画', dataURL);
                    if (typeof showToast === 'function') showToast('已存入云盘');
                });
                exportBtn.parentNode.insertBefore(ce, exportBtn.nextSibling);
            }
        })();
        this._on(this._q('#ppBtnClear'), 'click', function() { self._doClear(); });
        this._on(this._q('#ppBtnReset'), 'click', function() { self._doReset(); });
        this._on(this._q('#ppImportInput'), 'change', function(e) { self._handleImportData(e); });
        this._on(this._q('#ppImportImgInput'), 'change', function(e) { self._handleImportImg(e); });
        this._on(this._q('#ppAddColorBtn'), 'click', function() { self._editColorMode = false; self._q('#ppAddColorInput').click(); });
        this._on(this._q('#ppAddColorInput'), 'change', function() { self._handleAddColor(this.value); });
        this._on(this._q('#ppEditColorBtn'), 'click', function() { self._handleEditColor(); });
        this._on(this._q('#ppDelColorBtn'), 'click', function() { self._deleteColorMode = !self._deleteColorMode; this.classList.toggle('active', self._deleteColorMode); self._q('#ppPixelGrid').classList.toggle('delete-mode', self._deleteColorMode); });
        this._on(this._q('#ppClearColorBtn'), 'click', function() { self._doClearColor(); });
        this._on(this._q('#ppMergeColorBtn'), 'click', function() { self._handleMergeColor(); });
        this._on(this._q('#ppDelBrushBtn'), 'click', function() { self._deleteBrushMode = !self._deleteBrushMode; this.classList.toggle('active', self._deleteBrushMode); self._q('#ppBrushGrid').classList.toggle('delete-mode', self._deleteBrushMode); });
        this._on(this._q('#ppAddBrushBtn'), 'click', function() { self._showModal('请用选区工具框选区域，然后点击"存刷"', [{text:'知道了',value:true,primary:true}]); });
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
        this._qa('.pp-resize-bar-h').forEach(function(bar) { self._on(bar, 'mousedown', function(e) { var ids = bar.dataset.resize.split(','); self._hSec1 = self._q('#' + ids[0]); self._hSec2 = self._q('#' + ids[1]); if (!self._hSec1 || !self._hSec2) return; self._activeHBar = bar; self._hResizeStartY = e.clientY; self._hResizeStartH1 = self._hSec1.offsetHeight; self._hResizeStartH2 = self._hSec2.offsetHeight; bar.classList.add('active'); e.preventDefault(); }); });
        this._on(document, 'mousemove', function(e) { if (self._isResizing) self._panelBottom.style.height = Math.max(50, Math.min(window.innerHeight - 200, self._resizeStartH + (self._resizeStartY - e.clientY))) + 'px'; if (self._isResizingV) self._panelLeft.style.width = Math.max(120, Math.min(window.innerWidth - 200, self._resizeStartW + (e.clientX - self._resizeStartX))) + 'px'; if (self._activeHBar) { var dy = e.clientY - self._hResizeStartY; self._hSec1.style.height = Math.max(20, self._hResizeStartH1 + dy) + 'px'; self._hSec1.style.flex = 'none'; self._hSec2.style.height = Math.max(20, self._hResizeStartH2 - dy) + 'px'; self._hSec2.style.flex = 'none'; } });
        this._on(document, 'mouseup', function() { if (self._isResizing) { self._isResizing = false; self._q('#ppResizeBar').classList.remove('active'); self._autoSave(); } if (self._isResizingV) { self._isResizingV = false; self._q('#ppResizeBarV').classList.remove('active'); self._autoSave(); } if (self._activeHBar) { self._activeHBar.classList.remove('active'); self._activeHBar = null; self._autoSave(); } });
        this._on(this._q('#ppBtnPlay'), 'click', function() { self._togglePlay(); });
        this._on(this._q('#ppBtnDelFrame'), 'click', function() { self._doDelFrame(); });
        this._on(this._q('#ppBtnDelLayer'), 'click', function() { self._doDelLayer(); });
        this._on(this._q('#ppBtnExportSprite'), 'click', function() { self._doExportSprite(); });
        this._on(this._q('#ppBtnExportLayerSprite'), 'click', function() { self._doExportLayerSprite(); });

        // 3D模块初始化
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
                if (saved.currentTool) self._setTool(saved.currentTool);
                if (saved.selectedBrushIdx != null) self._selectedBrushIdx = saved.selectedBrushIdx;
                if (saved.panelZoom != null) self._applyPanelZoom(saved.panelZoom);
                if (saved.panelWidth != null) self._panelLeft.style.width = saved.panelWidth + 'px';
                if (saved.bottomHeight != null) self._panelBottom.style.height = saved.bottomHeight + 'px';
                if (saved.sectionHeights) { Object.keys(saved.sectionHeights).forEach(function(id) { var el = self._q('#' + id); if (el) { el.style.height = saved.sectionHeights[id] + 'px'; el.style.flex = 'none'; } }); }
                if (saved.tabCounter != null) self._tabCounter = saved.tabCounter;
                if (saved.tabs && saved.tabs.length) { saved.tabs.forEach(function(t) { self._tabs.push({id:t.id,name:t.name,w:t.w,h:t.h,data:t.data,zoom:t.zoom||1,panX:t.panX||0,panY:t.panY||0}); }); self._activeTabId = saved.activeTabId || self._tabs[0].id; var tab = self._getActiveTab(); if (tab) { self._q('#ppSizeW').value = tab.w; self._q('#ppSizeH').value = tab.h; if (!self._frameData.length) self._initFrameData(tab.w, tab.h); self._loadCurrentFrame(); self._resizeAndDraw(); } self._renderTabs(); self._renderTimeline(); }
            }
            if (!self._tabs.length) self._addTab(32, 32);
            self._renderPixelGrid(); self._renderBrushes();
            // 如果没有保存的坐标才居中
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

            // 监听窗口拉伸，实时保存窗口大小位置
            if (typeof ResizeObserver !== 'undefined') {
                self._resizeObserver = new ResizeObserver(function() {
                    if (!self._overlay) return;
                    try {
                        var r = self._overlay.getBoundingClientRect();
                        localStorage.setItem('pp-window-size', JSON.stringify({w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top)}));
                    } catch(e) {}
                });
                self._resizeObserver.observe(overlay);
            }

            // 自定义悬浮提示（游戏技能风格）
            var tip = document.createElement('div');
            tip.className = 'pp-tip';
            tip.style.cssText = 'position:fixed;padding:8px 12px;background:rgba(10,15,35,0.95);border:1px solid rgba(100,160,255,0.2);border-radius:6px;color:#e8edf5;font-size:11px;pointer-events:none;z-index:99999;max-width:280px;opacity:0;transition:opacity 0.15s;line-height:1.6;white-space:normal;box-shadow:0 4px 12px rgba(0,0,0,0.5);';
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
    },

    _createCanvasData: function(w, h) { var d = []; for (var y = 0; y < h; y++) { d[y] = []; for (var x = 0; x < w; x++) d[y][x] = 0; } return d; },
    _cloneData: function(d) { return d.map(function(r) { return r.slice(); }); },
    _getColor: function(id) { var b = this._pixelBlocks.find(function(p) { return p.id === id; }); return b ? b.color : null; },
    _isValidBlock: function(id) { return id !== 0 && this._pixelBlocks.some(function(b) { return b.id === id; }); },
    _getActiveTab: function() { var self = this; return this._tabs.find(function(t) { return t.id === self._activeTabId; }); },

    _rebuildMerged: function() {
        var tab = this._getActiveTab(); if (!tab) return; var w = tab.w, h = tab.h;
        this._mergedData = this._createCanvasData(w, h);
        for (var li = 0; li < this._layers.length; li++) { if (!this._layers[li].visible) continue; var fd = (this._frameData[li] && this._frameData[li][this._activeFrame]) ? this._frameData[li][this._activeFrame] : null; if (!fd) continue; for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { if (fd[y][x] !== 0) this._mergedData[y][x] = fd[y][x]; } }
        this._mergedW = w; this._mergedH = h;
    },
    _getMergedId: function(x, y) { return this._mergedData ? this._mergedData[y][x] : 0; },

    _rebuildBg: function(w, h) {
        var CELL = this.CELL; this._bgCanvas.width = w * CELL; this._bgCanvas.height = h * CELL; var ctx = this._bgCtx;
        for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { ctx.fillStyle = (x + y) % 2 === 0 ? '#111122' : '#0d0d1a'; ctx.fillRect(x * CELL, y * CELL, CELL, CELL); ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 0.5; ctx.strokeRect(x * CELL, y * CELL, CELL, CELL); }
        ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5;
        for (var x2 = 8; x2 < w; x2 += 8) { ctx.beginPath(); ctx.moveTo(x2 * CELL, 0); ctx.lineTo(x2 * CELL, h * CELL); ctx.stroke(); }
        for (var y2 = 8; y2 < h; y2 += 8) { ctx.beginPath(); ctx.moveTo(0, y2 * CELL); ctx.lineTo(w * CELL, y2 * CELL); ctx.stroke(); }
        this._bgDirty = false;
    },

    _drawCanvas: function() {
        var tab = this._getActiveTab(); if (!tab) return; var w = tab.w, h = tab.h, CELL = this.CELL;
        if (this._bgDirty || this._bgCanvas.width !== w * CELL || this._bgCanvas.height !== h * CELL) this._rebuildBg(w, h);
        if (!this._mergedData || this._mergedW !== w || this._mergedH !== h) this._rebuildMerged();
        var ctx = this._ctx; ctx.drawImage(this._bgCanvas, 0, 0);
        var d = this._mergedData;
        for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var id = d[y][x]; if (id === 0) continue; var c = this._getColor(id); if (!c) continue; ctx.fillStyle = c; ctx.fillRect(x * CELL, y * CELL, CELL, CELL); }
        if (this._showNumbers) { for (var y2 = 0; y2 < h; y2++) for (var x2 = 0; x2 < w; x2++) { var id2 = d[y2][x2]; if (id2 === 0 || !this._getColor(id2)) continue; var px = x2 * CELL, py = y2 * CELL; ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2); ctx.fillStyle = '#fff'; ctx.font = 'bold 9px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(id2.toString(), px + CELL / 2, py + CELL / 2); } }
    },

    _drawCell: function(cx, cy) {
        var tab = this._getActiveTab(); if (!tab) return; var CELL = this.CELL, px = cx * CELL, py = cy * CELL;
        this._ctx.drawImage(this._bgCanvas, px, py, CELL, CELL, px, py, CELL, CELL);
        var id = this._getMergedId(cx, cy);
        if (id !== 0) { var c = this._getColor(id); if (c) { this._ctx.fillStyle = c; this._ctx.fillRect(px, py, CELL, CELL); } }
        if (this._showNumbers && id !== 0 && this._getColor(id)) { this._ctx.fillStyle = 'rgba(0,0,0,0.45)'; this._ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2); this._ctx.fillStyle = '#fff'; this._ctx.font = 'bold 9px Courier New'; this._ctx.textAlign = 'center'; this._ctx.textBaseline = 'middle'; this._ctx.fillText(id.toString(), px + CELL / 2, py + CELL / 2); }
    },

    _drawSelection: function() {
        var CELL = this.CELL; this._selCtx.clearRect(0, 0, this._selCanvas.width, this._selCanvas.height);
        if (this._selLocked && this._selData) {
            var h = this._selData.length, w = this._selData[0].length; this._selCtx.globalAlpha = 0.6;
            for (var r = 0; r < h; r++) for (var c = 0; c < w; c++) { var color = this._selData[r][c]; if (!color) continue; this._selCtx.fillStyle = color.startsWith('#') ? color : '#' + color; this._selCtx.fillRect((this._selX + c) * CELL, (this._selY + r) * CELL, CELL, CELL); }
            this._selCtx.globalAlpha = 1; this._selCtx.strokeStyle = '#e94560'; this._selCtx.lineWidth = 2; this._selCtx.setLineDash([4, 4]); this._selCtx.strokeRect(this._selX * CELL, this._selY * CELL, w * CELL, h * CELL); this._selCtx.setLineDash([]);
        } else if (this._selection) {
            var x1 = Math.min(this._selection.x1, this._selection.x2), y1 = Math.min(this._selection.y1, this._selection.y2), x2 = Math.max(this._selection.x1, this._selection.x2), y2 = Math.max(this._selection.y1, this._selection.y2);
            this._selCtx.strokeStyle = '#e94560'; this._selCtx.lineWidth = 2; this._selCtx.setLineDash([4, 4]); this._selCtx.strokeRect(x1 * CELL, y1 * CELL, (x2 - x1 + 1) * CELL, (y2 - y1 + 1) * CELL); this._selCtx.setLineDash([]); this._selCtx.fillStyle = 'rgba(233,69,96,0.1)'; this._selCtx.fillRect(x1 * CELL, y1 * CELL, (x2 - x1 + 1) * CELL, (y2 - y1 + 1) * CELL);
        }
    },

    _drawBrushPreview: function(gx, gy) {
        var CELL = this.CELL; this._selCtx.clearRect(0, 0, this._selCanvas.width, this._selCanvas.height); if (this._selection) this._drawSelection();
        if (this._selectedBrushIdx < 0 || !this._brushes[this._selectedBrushIdx]) return;
        var brush = this._brushes[this._selectedBrushIdx]; this._selCtx.globalAlpha = 0.5;
        for (var r = 0; r < brush.data.length; r++) for (var c = 0; c < brush.data[r].length; c++) { var color = brush.data[r][c]; if (!color) continue; var px = gx + c, py = gy + r; if (px < 0 || py < 0) continue; this._selCtx.fillStyle = color.startsWith('#') ? color : '#' + color; this._selCtx.fillRect(px * CELL, py * CELL, CELL, CELL); }
        this._selCtx.globalAlpha = 1; this._selCtx.strokeStyle = '#e94560'; this._selCtx.lineWidth = 1; this._selCtx.setLineDash([3, 3]); this._selCtx.strokeRect(gx * CELL, gy * CELL, brush.data[0].length * CELL, brush.data.length * CELL); this._selCtx.setLineDash([]);
        this._brushPreviewPos = {x: gx, y: gy};
    },

    _clearBrushPreview: function() { this._selCtx.clearRect(0, 0, this._selCanvas.width, this._selCanvas.height); if (this._selection) this._drawSelection(); this._brushPreviewPos = null; },

    _resizeAndDraw: function() { var tab = this._getActiveTab(); if (!tab) return; var CELL = this.CELL; this._canvas.width = tab.w * CELL; this._canvas.height = tab.h * CELL; this._selCanvas.width = this._canvas.width; this._selCanvas.height = this._canvas.height; this._bgDirty = true; this._drawCanvas(); this._drawSelection(); this._updateViewport(); this._updateInfo(); },
    _updateViewport: function() { var tab = this._getActiveTab(); if (!tab) return; this._canvasViewport.style.transform = 'translate(' + tab.panX + 'px,' + tab.panY + 'px) scale(' + tab.zoom + ')'; },
    _updateInfo: function() { var tab = this._getActiveTab(); if (!tab) return; this._q('#ppCanvasInfo').textContent = tab.w + ' x ' + tab.h + ' | 缩放 ' + Math.round(tab.zoom * 100) + '% | 右键拖拽 . 滚轮缩放'; },
    _centerCanvas: function() { var tab = this._getActiveTab(); if (!tab) return; var rect = this._canvasArea.getBoundingClientRect(); var CELL = this.CELL; tab.panX = (rect.width - tab.w * CELL * tab.zoom) / 2; tab.panY = (rect.height - tab.h * CELL * tab.zoom) / 2; this._updateViewport(); this._updateInfo(); },
    _screenToGrid: function(e) { var tab = this._getActiveTab(); if (!tab) return null; var rect = this._canvas.getBoundingClientRect(); var CELL = this.CELL; var gx = Math.floor((e.clientX - rect.left) / (CELL * tab.zoom)); var gy = Math.floor((e.clientY - rect.top) / (CELL * tab.zoom)); if (gx < 0 || gy < 0 || gx >= tab.w || gy >= tab.h) return null; return {x: gx, y: gy}; },

    _pushUndo: function(tab) { this._undoStack.push(JSON.parse(JSON.stringify(tab.data))); if (this._undoStack.length > 200) this._undoStack.shift(); this._redoStack.length = 0; },
    _undo: function() { var t = this._getActiveTab(); if (!t || !this._undoStack.length) return; this._redoStack.push(JSON.parse(JSON.stringify(t.data))); t.data = this._undoStack.pop(); this._mergedData = null; this._saveCurrentFrame(); this._drawCanvas(); this._autoSave(); },
    _redo: function() { var t = this._getActiveTab(); if (!t || !this._redoStack.length) return; this._undoStack.push(JSON.parse(JSON.stringify(t.data))); t.data = this._redoStack.pop(); this._mergedData = null; this._saveCurrentFrame(); this._drawCanvas(); this._autoSave(); },

    _initFrameData: function(w, h) { this._frameData = []; for (var li = 0; li < this._layers.length; li++) { this._frameData[li] = []; for (var f = 0; f < this._frameCount; f++) this._frameData[li][f] = this._createCanvasData(w, h); } },
    _saveCurrentFrame: function() { var t = this._getActiveTab(); if (!t || !this._frameData[this._activeLayer]) return; this._frameData[this._activeLayer][this._activeFrame] = this._cloneData(t.data); this._thumbCache.delete(this._activeLayer + '-' + this._activeFrame); },
    _loadCurrentFrame: function() { var t = this._getActiveTab(); if (!t || !this._frameData[this._activeLayer]) return; if (this._frameData[this._activeLayer][this._activeFrame]) t.data = this._cloneData(this._frameData[this._activeLayer][this._activeFrame]); },

    _createSampleArt: function(data, w, h) {
        var ox = Math.min(8, Math.floor(w / 4)), oy = Math.min(6, Math.floor(h / 4));
        var sp = [[0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,0,1,5,1,5,1,0,0],[0,0,1,1,1,1,1,0,0],[0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,0],[0,1,1,3,1,1,3,1,0],[0,1,1,1,1,1,1,1,0],[0,0,1,1,1,1,1,0,0],[0,0,0,1,0,1,0,0,0],[0,0,1,1,0,1,1,0,0],[0,0,9,9,0,9,9,0,0]];
        sp.forEach(function(row, r) { row.forEach(function(v, c) { if (oy + r < h && ox + c < w) data[oy + r][ox + c] = v; }); });
        var gy = Math.min(22, h - 2);
        for (var x = 0; x < w; x++) { if (gy < h) data[gy][x] = 4; if (gy + 1 < h && x % 3 !== 0) data[gy + 1][x] = 4; }
        [2, Math.min(24, w - 3)].forEach(function(tx) { for (var ty = Math.max(0, gy - 5); ty < gy; ty++) { if (ty < h && tx < w) data[ty][tx] = 4; if (ty < h && tx + 1 < w) data[ty][tx + 1] = 4; } for (var ty2 = Math.max(0, gy - 8); ty2 < gy - 5; ty2++) { for (var dx = 0; dx < 3; dx++) { if (ty2 < h && tx - 1 + dx < w && tx - 1 + dx >= 0) data[ty2][tx - 1 + dx] = 2; } } });
    },

    _addTab: function(w, h) {
        var usedIds = new Set(this._tabs.map(function(t) { return t.id; })); var newId = 1; while (usedIds.has(newId)) newId++;
        this._tabCounter = Math.max(this._tabCounter, newId);
        var tab = {id: newId, name: String(newId), w: w || 32, h: h || 32, data: this._createCanvasData(w || 32, h || 32), zoom: 1, panX: 0, panY: 0};
        this._tabs.push(tab); this._switchTab(tab.id); this._renderTabs(); var self = this; setTimeout(function() { self._centerCanvas(); }, 10); this._autoSave();
    },

    _switchTab: function(id) {
        this._saveCurrentFrame(); this._activeTabId = id; var tab = this._getActiveTab(); if (!tab) return;
        this._q('#ppSizeW').value = tab.w; this._q('#ppSizeH').value = tab.h;
        this._initFrameData(tab.w, tab.h); this._frameData[0][0] = this._cloneData(tab.data);
        this._mergedData = null; this._loadCurrentFrame(); this._resizeAndDraw(); this._renderTabs(); this._renderTimeline(); this._autoSave();
        var self = this; setTimeout(function() { self._centerCanvas(); }, 10);
    },

    _closeTab: function(id) {
        var idx = this._tabs.findIndex(function(t) { return t.id === id; }); if (idx === -1) return;
        this._tabs.splice(idx, 1); if (!this._tabs.length) { this._addTab(); return; }
        if (this._activeTabId === id) this._switchTab(this._tabs[Math.min(idx, this._tabs.length - 1)].id);
        this._renderTabs(); this._autoSave();
    },

    _renderTabs: function() {
        var self = this; var bar = this._q('#ppTabBar'); bar.innerHTML = '';
        this._tabs.forEach(function(tab) { var div = document.createElement('div'); div.className = 'pp-tab' + (tab.id === self._activeTabId ? ' active' : ''); div.innerHTML = '<span class="pp-tab-name">' + tab.name + '</span><span class="pp-tab-size">' + tab.w + 'x' + tab.h + '</span><span class="pp-tab-close">x</span>'; div.addEventListener('click', function(e) { if (e.target.classList.contains('pp-tab-close')) { e.stopPropagation(); self._closeTab(tab.id); } else self._switchTab(tab.id); }); bar.appendChild(div); });
        var addDiv = document.createElement('div'); addDiv.className = 'pp-tab-add'; addDiv.textContent = '+'; addDiv.addEventListener('click', function() { self._addTab(); }); bar.appendChild(addDiv);
    },

    _renderPixelGrid: function() {
        var self = this; var el = this._q('#ppPixelGrid'); el.innerHTML = '';
        this._pixelBlocks.forEach(function(b) { var div = document.createElement('div'); div.className = 'pp-pixel-cell' + (b.id === self._selectedBlock ? ' selected' : '') + (self._mergeColorMode && self._mergeColorIds.indexOf(b.id) !== -1 ? ' merge-selected' : ''); div.innerHTML = '<div class="pp-pixel-cell-color" style="background:' + b.color + '"></div><span class="pp-pixel-cell-num">' + b.id + '</span>'; div.onclick = function() { self._onPixelCellClick(b); }; el.appendChild(div); });
    },

    _onPixelCellClick: function(b) {
        var self = this;
        if (this._mergeColorMode) { var idx = this._mergeColorIds.indexOf(b.id); if (idx === -1) this._mergeColorIds.push(b.id); else this._mergeColorIds.splice(idx, 1); this._renderPixelGrid(); }
        else if (this._deleteColorMode) { (async function() { var tab = self._getActiveTab(), usedInCanvas = false; if (tab) { for (var y = 0; y < tab.h && !usedInCanvas; y++) for (var x = 0; x < tab.w; x++) { if (tab.data[y][x] === b.id) { usedInCanvas = true; break; } } } if (usedInCanvas) { var ok = await self._showModal('色块 #' + b.id + ' 正在画布中使用，确定删除？\n删除后画布中该色块像素将变为空(0)', [{text:'取消',value:false},{text:'确定删除',value:true,primary:true}]); if (!ok) return; if (tab) { self._pushUndo(tab); for (var y2 = 0; y2 < tab.h; y2++) for (var x2 = 0; x2 < tab.w; x2++) { if (tab.data[y2][x2] === b.id) tab.data[y2][x2] = 0; } self._mergedData = null; self._saveCurrentFrame(); self._drawCanvas(); self._renderTimeline(); } } var idx2 = self._pixelBlocks.indexOf(b); if (idx2 !== -1) { self._pixelBlocks.splice(idx2, 1); if (!self._pixelBlocks.length) self._nextBlockId = 1; self._thumbCache.clear(); self._mergedData = null; self._renderPixelGrid(); self._drawCanvas(); self._autoSave(); } })(); }
        else { this._selectedBlock = b.id; this._renderPixelGrid(); }
    },

    _renderBrushes: function() {
        var self = this; var el = this._q('#ppBrushGrid'); el.innerHTML = '';
        this._brushes.forEach(function(brush, i) { var div = document.createElement('div'); div.className = 'pp-brush-item' + (i === self._selectedBrushIdx ? ' selected' : ''); div.title = brush.name; var rows = brush.data.length, cols = brush.data[0].length, s = Math.min(Math.floor(34 / Math.max(rows, cols)), 8); var c = document.createElement('canvas'); c.width = cols * s; c.height = rows * s; var bctx = c.getContext('2d'); brush.data.forEach(function(row, r) { row.forEach(function(color, col) { if (color) { if (typeof color === 'number') color = self._getColor(color); if (!color) return; bctx.fillStyle = color.startsWith('#') ? color : '#' + color; bctx.fillRect(col * s, r * s, s, s); } }); }); div.appendChild(c); var label = document.createElement('span'); label.className = 'pp-brush-item-label'; label.textContent = brush.name; div.appendChild(label); div.onclick = function() { if (self._deleteBrushMode) { self._brushes.splice(i, 1); if (!self._brushes.length) self._nextBrushId = 1; if (self._selectedBrushIdx === i) self._selectedBrushIdx = -1; else if (self._selectedBrushIdx > i) self._selectedBrushIdx--; self._renderBrushes(); self._autoSave(); } else { self._selectedBrushIdx = (self._selectedBrushIdx === i) ? -1 : i; if (self._selectedBrushIdx >= 0) self._setTool('stamp'); self._renderBrushes(); } }; el.appendChild(div); });
        var sec = this._q('#ppSecBrushes');
        if (sec && el) { var header = sec.querySelector('.pp-section-header'); var hh = header ? header.offsetHeight : 0; el.style.maxHeight = Math.max(0, sec.clientHeight - hh) + 'px'; el.style.overflowY = 'auto'; }
    },

    _setTool: function(tool) { this._currentTool = tool; this._qa('.pp-tool-btn[data-tool]').forEach(function(btn) { btn.classList.toggle('active', btn.dataset.tool === tool); }); if (tool !== 'select') { this._selection = null; this._selData = null; this._selLocked = false; this._selDragging = false; this._drawSelection(); } },

    _onCanvasMouseDown: function(e) {
        var self = this;
        if (e.button === 2) { this._isPanning = true; this._panStartX = e.clientX; this._panStartY = e.clientY; this._canvasArea.style.cursor = 'grabbing'; e.preventDefault(); return; }
        if (e.button !== 0) return;
        var pos = this._screenToGrid(e); if (!pos) return; var tab = this._getActiveTab();
        if (this._currentTool === 'brush') { (async function() { if (!await self._ensureValidBlock()) return; self._pushUndo(tab); self._isDrawing = true; self._lastDrawPos = {x:pos.x,y:pos.y}; tab.data[pos.y][pos.x] = self._selectedBlock; if (self._mergedData) self._mergedData[pos.y][pos.x] = self._selectedBlock; self._drawCanvas(); })(); }
        else if (this._currentTool === 'eraser') { this._pushUndo(tab); this._isDrawing = true; this._lastDrawPos = {x:pos.x,y:pos.y}; tab.data[pos.y][pos.x] = 0; if (this._mergedData) this._mergedData[pos.y][pos.x] = 0; this._drawCanvas(); }
        else if (this._currentTool === 'fill') { (async function() { if (!await self._ensureValidBlock()) return; self._pushUndo(tab); self._floodFill(tab.data, pos.x, pos.y, self._selectedBlock, tab.w, tab.h); self._mergedData = null; self._saveCurrentFrame(); self._drawCanvas(); self._renderTimeline(); self._autoSave(); })(); }
        else if (this._currentTool === 'picker') { var id = tab.data[pos.y][pos.x]; if (id !== 0) { this._selectedBlock = id; this._renderPixelGrid(); this._autoSave(); } }
        else if (this._currentTool === 'select') { if (this._selLocked && this._selData) { var sh = this._selData.length, sw = this._selData[0].length; if (pos.x >= this._selX && pos.x < this._selX + sw && pos.y >= this._selY && pos.y < this._selY + sh) { this._pushUndo(tab); for (var y = this._selY; y < this._selY + sh; y++) for (var x = this._selX; x < this._selX + sw; x++) { tab.data[y][x] = 0; if (this._mergedData) this._mergedData[y][x] = 0; } this._drawCanvas(); this._selDragging = true; this._selDragOffX = pos.x - this._selX; this._selDragOffY = pos.y - this._selY; this._isDrawing = true; } else { this._cancelSelection(); this._isDrawing = true; this._drawStart = pos; this._selection = {x1:pos.x,y1:pos.y,x2:pos.x,y2:pos.y}; this._drawSelection(); } } else { this._isDrawing = true; this._drawStart = pos; this._selection = {x1:pos.x,y1:pos.y,x2:pos.x,y2:pos.y}; this._drawSelection(); } }
        else if (this._currentTool === 'stamp') { if (this._selectedBrushIdx >= 0 && this._brushes[this._selectedBrushIdx]) { this._isDrawing = true; this._drawBrushPreview(pos.x, pos.y); } }
    },

    _onCanvasMouseMove: function(e) {
        var self = this;
        if (this._isPanning) { var tab = this._getActiveTab(); if (!tab) return; tab.panX += e.clientX - this._panStartX; tab.panY += e.clientY - this._panStartY; this._panStartX = e.clientX; this._panStartY = e.clientY; this._updateViewport(); return; }
        if (!this._isDrawing) return; var pos = this._screenToGrid(e); if (!pos) return; var tab = this._getActiveTab();
        if (this._currentTool === 'brush') { if (!this._isValidBlock(this._selectedBlock)) return; var d = tab.data; if (this._lastDrawPos && this._lastDrawPos.x !== pos.x && this._lastDrawPos.y !== pos.y) { var x0=this._lastDrawPos.x,y0=this._lastDrawPos.y,x1=pos.x,y1=pos.y,dx=Math.abs(x1-x0),dy=Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1,err=dx-dy,cx=x0,cy=y0; while(true){if(cy>=0&&cy<d.length&&cx>=0&&cx<d[0].length){d[cy][cx]=self._selectedBlock;if(self._mergedData)self._mergedData[cy][cx]=self._selectedBlock;}if(cx===x1&&cy===y1)break;var e2=2*err;if(e2>-dy){err-=dy;cx+=sx;}if(e2<dx){err+=dx;cy+=sy;}} } else { d[pos.y][pos.x] = self._selectedBlock; if (self._mergedData) self._mergedData[pos.y][pos.x] = self._selectedBlock; } this._lastDrawPos = {x:pos.x,y:pos.y}; this._drawCell(pos.x, pos.y); }
        else if (this._currentTool === 'eraser') { var d2 = tab.data; if (this._lastDrawPos && this._lastDrawPos.x !== pos.x && this._lastDrawPos.y !== pos.y) { var x0e=this._lastDrawPos.x,y0e=this._lastDrawPos.y,x1e=pos.x,y1e=pos.y,dxe=Math.abs(x1e-x0e),dye=Math.abs(y1e-y0e),sxe=x0e<x1e?1:-1,sye=y0e<y1e?1:-1,erre=dxe-dye,cxe=x0e,cye=y0e; while(true){if(cye>=0&&cye<d2.length&&cxe>=0&&cxe<d2[0].length){d2[cye][cxe]=0;if(self._mergedData){var v=0;for(var li=0;li<self._layers.length;li++){if(!self._layers[li].visible||li===self._activeLayer)continue;var fd=(self._frameData[li]&&self._frameData[li][self._activeFrame])?self._frameData[li][self._activeFrame]:null;if(fd&&fd[cye][cxe]!==0){v=fd[cye][cxe];break;}}self._mergedData[cye][cxe]=v;}}if(cxe===x1e&&cye===y1e)break;var e2e=2*erre;if(e2e>-dye){erre-=dye;cxe+=sxe;}if(e2e<dxe){erre+=dxe;cye+=sye;}} } else { d2[pos.y][pos.x] = 0; if (self._mergedData) { var v2 = 0; for (var li2 = 0; li2 < self._layers.length; li2++) { if (!self._layers[li2].visible || li2 === self._activeLayer) continue; var fd2 = (self._frameData[li2] && self._frameData[li2][self._activeFrame]) ? self._frameData[li2][self._activeFrame] : null; if (fd2 && fd2[pos.y][pos.x] !== 0) { v2 = fd2[pos.y][pos.x]; break; } } self._mergedData[pos.y][pos.x] = v2; } } this._lastDrawPos = {x:pos.x,y:pos.y}; this._drawCell(pos.x, pos.y); }
        else if (this._currentTool === 'select') { if (this._selDragging && this._selData) { this._selX = pos.x - this._selDragOffX; this._selY = pos.y - this._selDragOffY; this._drawSelection(); } else if (this._drawStart) { this._selection.x2 = pos.x; this._selection.y2 = pos.y; this._drawSelection(); } }
        else if (this._currentTool === 'stamp' && this._selectedBrushIdx >= 0 && this._brushes[this._selectedBrushIdx]) { this._drawBrushPreview(pos.x, pos.y); }
    },

    _onCanvasMouseUp: function(e) {
        var self = this;
        if (e.button === 2) { this._isPanning = false; this._canvasArea.style.cursor = 'crosshair'; return; }
        if (this._isDrawing) { if (this._currentTool === 'stamp' && this._selectedBrushIdx >= 0 && this._brushes[this._selectedBrushIdx] && this._brushPreviewPos) { var tab = this._getActiveTab(); if (tab) { this._pushUndo(tab); this._stampBrush(tab.data, this._brushes[this._selectedBrushIdx], this._brushPreviewPos.x, this._brushPreviewPos.y, tab.w, tab.h); this._drawCanvas(); this._autoSave(); } } this._clearBrushPreview(); if (this._currentTool === 'select') { if (this._drawStart && !this._selDragging) this._captureSelection(); else if (this._selDragging && this._selData) this._applySelection(); this._selDragging = false; } this._isDrawing = false; this._lastDrawPos = null; this._drawStart = null; this._saveCurrentFrame(); this._renderTimeline(); this._autoSave(); }
    },

    _onCanvasWheel: function(e) { e.preventDefault(); var tab = this._getActiveTab(); if (!tab) return; var rect = this._canvasArea.getBoundingClientRect(); var mx = e.clientX - rect.left, my = e.clientY - rect.top; var oldZoom = tab.zoom; tab.zoom = Math.max(0.05, Math.min(8, tab.zoom * (e.deltaY > 0 ? 0.9 : 1.1))); var ratio = tab.zoom / oldZoom; tab.panX = mx - (mx - tab.panX) * ratio; tab.panY = my - (my - tab.panY) * ratio; this._updateViewport(); this._updateInfo(); },

    _onKeyDown: function(e) { if (e.target.tagName === 'INPUT') return; if (e.ctrlKey && e.key === 'z') { e.preventDefault(); this._undo(); return; } if (e.ctrlKey && e.key === 'y') { e.preventDefault(); this._redo(); return; } if (e.key === 'b') this._setTool('brush'); else if (e.key === 'e') this._setTool('eraser'); else if (e.key === 'g') this._setTool('fill'); else if (e.key === 's' && !e.ctrlKey) this._setTool('select'); else if (e.key === 'i') this._setTool('picker'); else if (e.key === 'Escape' && this._selLocked) this._cancelSelection(); },

    _floodFill: function(data, sx, sy, newId, w, h) { var target = data[sy][sx]; if (target === newId) return; var stack = [[sx, sy]], visited = new Set(); while (stack.length) { var p = stack.pop(), x = p[0], y = p[1], k = y * w + x; if (visited.has(k) || x < 0 || x >= w || y < 0 || y >= h || data[y][x] !== target) continue; visited.add(k); data[y][x] = newId; stack.push([x+1,y],[x-1,y],[x,y+1],[x,y-1]); } },

    _stampBrush: function(data, brush, gx, gy, w, h) { var self = this, colorMap = new Map(); this._pixelBlocks.forEach(function(bl) { colorMap.set(bl.color.toLowerCase(), bl.id); }); var needRenderGrid = false; for (var r = 0; r < brush.data.length; r++) for (var c = 0; c < brush.data[r].length; c++) { var color = brush.data[r][c]; if (!color) continue; var px = gx + c, py = gy + r; if (px < 0 || px >= w || py < 0 || py >= h) continue; var hex = (color.startsWith('#') ? color : '#' + color).toLowerCase(); var id = colorMap.get(hex); if (id == null) { id = self._nextBlockId++; self._pixelBlocks.push({id:id,color:hex,name:'色'+id}); colorMap.set(hex,id); needRenderGrid = true; } data[py][px] = id; if (self._mergedData) self._mergedData[py][px] = id; } if (needRenderGrid) this._renderPixelGrid(); },

    _captureSelection: function() { if (!this._selection) return; var tab = this._getActiveTab(); if (!tab) return; var x1 = Math.min(this._selection.x1, this._selection.x2), y1 = Math.min(this._selection.y1, this._selection.y2), x2 = Math.max(this._selection.x1, this._selection.x2), y2 = Math.max(this._selection.y1, this._selection.y2); if (!this._mergedData || this._mergedW !== tab.w || this._mergedH !== tab.h) this._rebuildMerged(); this._selData = []; for (var y = y1; y <= y2; y++) { var row = []; for (var x = x1; x <= x2; x++) { var id = this._mergedData[y][x]; row.push(id !== 0 ? this._getColor(id) : null); } this._selData.push(row); } this._selX = x1; this._selY = y1; this._selLocked = true; },
    _selFlipH: function() { if (!this._selData) return; this._selData = this._selData.map(function(row) { return row.slice().reverse(); }); },
    _selFlipV: function() { if (!this._selData) return; this._selData = this._selData.slice().reverse(); },
    _selRotate: function() { if (!this._selData) return; var h = this._selData.length, w = this._selData[0].length, nd = []; for (var x = 0; x < w; x++) { var row = []; for (var y = h - 1; y >= 0; y--) row.push(this._selData[y][x]); nd.push(row); } this._selData = nd; },

    _applySelection: function() { if (!this._selData) return; var self = this, tab = this._getActiveTab(); if (!tab) return; var h = this._selData.length, w = this._selData[0].length; var colorMap = new Map(); this._pixelBlocks.forEach(function(bl) { colorMap.set(bl.color.toLowerCase(), bl.id); }); for (var r = 0; r < h; r++) for (var c = 0; c < w; c++) { var color = this._selData[r][c]; if (!color) continue; var px = this._selX + c, py = this._selY + r; if (px < 0 || px >= tab.w || py < 0 || py >= tab.h) continue; var hex = (color.startsWith('#') ? color : '#' + color).toLowerCase(); var id = colorMap.get(hex); if (id == null) { id = self._nextBlockId++; self._pixelBlocks.push({id:id,color:hex,name:'色'+id}); colorMap.set(hex,id); self._renderPixelGrid(); } tab.data[py][px] = id; } this._cancelSelection(); this._mergedData = null; this._saveCurrentFrame(); this._drawCanvas(); this._renderTimeline(); this._autoSave(); },
    _cancelSelection: function() { this._selection = null; this._selData = null; this._selLocked = false; this._selDragging = false; this._drawSelection(); },
    _selApplyTransform: function(fn) { if (!this._selData) return; var tab = this._getActiveTab(); if (!tab) return; this._pushUndo(tab); var sh = this._selData.length, sw = this._selData[0].length; for (var y = this._selY; y < this._selY + sh; y++) for (var x = this._selX; x < this._selX + sw; x++) { if (y >= 0 && y < tab.h && x >= 0 && x < tab.w) { tab.data[y][x] = 0; if (this._mergedData) this._mergedData[y][x] = 0; } } fn.call(this); this._applySelection(); },
    _saveBrush: function() { if (!this._selData || !this._selData.length) { this._showModal('请先用选区工具框选一个区域', [{text:'知道了',value:true,primary:true}]); return; } var hasContent = this._selData.some(function(row) { return row.some(function(c) { return c !== null && c !== 0; }); }); if (!hasContent) { this._showModal('框选区域内没有像素内容', [{text:'知道了',value:true,primary:true}]); return; } var data = this._selData.map(function(row) { return row.slice(); }); this._nextBrushId++; this._brushes.push({id:this._nextBrushId,name:String(this._brushes.length+1),data:data,w:data[0].length,h:data.length}); this._selectedBrushIdx = this._brushes.length - 1; this._renderBrushes(); this._autoSave(); this._updateInfo(); },

    _applySize: function(w, h) { var tab = this._getActiveTab(); if (!tab) return; var newW = Math.max(4, Math.min(512, w)), newH = Math.max(4, Math.min(512, h)); this._q('#ppSizeW').value = newW; this._q('#ppSizeH').value = newH; this._pushUndo(tab); var newData = this._createCanvasData(newW, newH); for (var y = 0; y < Math.min(tab.h, newH); y++) for (var x = 0; x < Math.min(tab.w, newW); x++) newData[y][x] = tab.data[y][x]; tab.data = newData; tab.w = newW; tab.h = newH; this._initFrameData(newW, newH); this._frameData[this._activeLayer][this._activeFrame] = this._cloneData(tab.data); this._resizeAndDraw(); this._renderTabs(); this._renderTimeline(); this._autoSave(); },
    _applyPanelZoom: function(z) { this._panelZoom = z; this._panelLeftContent.style.zoom = z / 100; this._q('#ppPanelZoomSlider').value = z; this._q('#ppPanelZoomVal').textContent = z + '%'; this._autoSave(); },

    _doExportData: function() { var tab = this._getActiveTab(); if (!tab) return; this._saveCurrentFrame(); var json = JSON.stringify({w:tab.w,h:tab.h,blocks:this._pixelBlocks,layers:this._layers,frameCount:this._frameCount,frameData:this._frameData}); var blob = new Blob([json],{type:'application/json'}); var link = document.createElement('a'); link.download = tab.name + '_data.json'; link.href = URL.createObjectURL(blob); link.click(); URL.revokeObjectURL(link.href); },
    _doExportFull: function() { var tab = this._getActiveTab(); if (!tab) return; var ec = document.createElement('canvas'); ec.width = tab.w; ec.height = tab.h; var ectx = ec.getContext('2d'); for (var y = 0; y < tab.h; y++) for (var x = 0; x < tab.w; x++) { var id = tab.data[y][x]; if (id !== 0) { var c = this._getColor(id); if (c) { ectx.fillStyle = c; ectx.fillRect(x, y, 1, 1); } } } var dataURL = ec.toDataURL('image/png'); var link = document.createElement('a'); link.download = tab.name + '.png'; link.href = dataURL; link.click(); if (typeof CosCloudDrive !== 'undefined') CosCloudDrive.add(tab.name + ' ' + new Date().toLocaleTimeString(), '像素画', dataURL); },
    _doExportTrim: function() { var tab = this._getActiveTab(); if (!tab) return; var x1 = tab.w, y1 = tab.h, x2 = 0, y2 = 0; for (var y = 0; y < tab.h; y++) for (var x = 0; x < tab.w; x++) { if (tab.data[y][x] !== 0) { x1 = Math.min(x1,x); y1 = Math.min(y1,y); x2 = Math.max(x2,x); y2 = Math.max(y2,y); } } if (x1 > x2 || y1 > y2) return; var tw = x2 - x1 + 1, th = y2 - y1 + 1; var ec = document.createElement('canvas'); ec.width = tw; ec.height = th; var ectx = ec.getContext('2d'); for (var y2i = 0; y2i < th; y2i++) for (var x2i = 0; x2i < tw; x2i++) { var id = tab.data[y1+y2i][x1+x2i]; if (id !== 0) { var c = this._getColor(id); if (c) { ectx.fillStyle = c; ectx.fillRect(x2i, y2i, 1, 1); } } } var dataURL = ec.toDataURL('image/png'); var link = document.createElement('a'); link.download = tab.name + '_trim.png'; link.href = dataURL; link.click(); if (typeof CosCloudDrive !== 'undefined') CosCloudDrive.add(tab.name + '_trim ' + new Date().toLocaleTimeString(), '像素画', dataURL); },
    _doExportSprite: function() { var tab = this._getActiveTab(); if (!tab) return; this._saveCurrentFrame(); var self = this; var frames = []; for (var f = 0; f < this._frameCount; f++) { var merged = this._createCanvasData(tab.w, tab.h); for (var li = 0; li < this._layers.length; li++) { if (!this._layers[li].visible) continue; var fd = (this._frameData[li] && this._frameData[li][f]) ? this._frameData[li][f] : null; if (!fd) continue; for (var y = 0; y < tab.h; y++) for (var x = 0; x < tab.w; x++) { if (fd[y][x] !== 0) merged[y][x] = fd[y][x]; } } frames.push(merged); } var ec = document.createElement('canvas'); ec.width = tab.w * this._frameCount; ec.height = tab.h; var ectx = ec.getContext('2d'); for (var f2 = 0; f2 < frames.length; f2++) { var ox = f2 * tab.w; for (var y2 = 0; y2 < tab.h; y2++) for (var x2 = 0; x2 < tab.w; x2++) { var id = frames[f2][y2][x2]; if (id === 0) continue; var c = self._getColor(id); if (!c) continue; ectx.fillStyle = c; ectx.fillRect(ox+x2, y2, 1, 1); } } var link = document.createElement('a'); link.download = tab.name + '_sprite.png'; link.href = ec.toDataURL('image/png'); link.click(); },
    _doExportLayerSprite: function() { var tab = this._getActiveTab(); if (!tab) return; this._saveCurrentFrame(); var self = this; var numLayers = this._layers.length, numFrames = this._frameCount; var ec = document.createElement('canvas'); ec.width = tab.w * numLayers; ec.height = tab.h * numFrames; var ectx = ec.getContext('2d'); for (var f = 0; f < numFrames; f++) for (var li = 0; li < numLayers; li++) { var fd = (this._frameData[li] && this._frameData[li][f]) ? this._frameData[li][f] : null; if (!fd) continue; var ox = li * tab.w, oy = f * tab.h; for (var y = 0; y < tab.h; y++) for (var x = 0; x < tab.w; x++) { var id = fd[y][x]; if (id === 0) continue; var c = self._getColor(id); if (!c) continue; ectx.fillStyle = c; ectx.fillRect(ox+x, oy+y, 1, 1); } } var link = document.createElement('a'); link.download = tab.name + '_layer_seq.png'; link.href = ec.toDataURL('image/png'); link.click(); },

    _handleImportData: function(e) {
        var self = this, file = e.target.files[0]; if (!file) return; var reader = new FileReader();
        reader.onload = function() { try { var json = JSON.parse(reader.result); if (!json.w || !json.h) throw 'invalid'; var colorMap = {}, importBlocks = json.blocks || [], usedImportIds = new Set(); var hasFrameData = json.frameData && json.frameData.length > 0; if (hasFrameData) { json.frameData.forEach(function(lf) { if (!lf) return; lf.forEach(function(frame) { if (!frame) return; for (var y = 0; y < frame.length; y++) for (var x = 0; x < frame[y].length; x++) { if (frame[y][x] !== 0) usedImportIds.add(frame[y][x]); } }); }); } else if (json.data) { for (var y = 0; y < json.h; y++) for (var x = 0; x < json.w; x++) { if (json.data[y][x] !== 0) usedImportIds.add(json.data[y][x]); } } usedImportIds.forEach(function(importId) { var importBlock = importBlocks.find(function(b) { return b.id === importId; }); if (!importBlock) return; var importColor = importBlock.color.toLowerCase(); var localBlock = self._pixelBlocks.find(function(b) { return b.color.toLowerCase() === importColor; }); if (localBlock) { colorMap[importId] = localBlock.id; } else { var idExists = self._pixelBlocks.find(function(b) { return b.id === importId; }); if (idExists) { var newId = self._nextBlockId++; self._pixelBlocks.push({id:newId,color:importBlock.color,name:importBlock.name}); colorMap[importId] = newId; } else { self._pixelBlocks.push({id:importId,color:importBlock.color,name:importBlock.name}); if (importId >= self._nextBlockId) self._nextBlockId = importId + 1; colorMap[importId] = importId; } } }); self._renderPixelGrid(); self._addTab(json.w, json.h); var tab = self._getActiveTab(); if (!tab) return; if (hasFrameData) { self._layers.length = 0; (json.layers || [{name:'图层1',visible:true}]).forEach(function(l) { self._layers.push({name:l.name,visible:l.visible!=false}); }); self._frameCount = json.frameCount || json.frameData[0].length || 1; self._frameData.length = 0; json.frameData.forEach(function(layerFrames) { var lf = []; for (var f = 0; f < self._frameCount; f++) { var src = layerFrames && layerFrames[f] ? layerFrames[f] : null; if (src) { var fd = self._createCanvasData(json.w,json.h); for (var fy = 0; fy < json.h; fy++) for (var fx = 0; fx < json.w; fx++) { var v = src[fy] && src[fy][fx] != null ? src[fy][fx] : 0; fd[fy][fx] = (v !== 0 && colorMap[v] != null) ? colorMap[v] : 0; } lf.push(fd); } else lf.push(self._createCanvasData(json.w, json.h)); } self._frameData.push(lf); }); self._activeLayer = 0; self._activeFrame = 0; self._loadCurrentFrame(); } else if (json.data) { for (var dy = 0; dy < json.h; dy++) for (var dx = 0; dx < json.w; dx++) { var v2 = json.data[dy][dx]; tab.data[dy][dx] = (v2 !== 0 && colorMap[v2] != null) ? colorMap[v2] : 0; } self._initFrameData(tab.w, tab.h); self._frameData[self._activeLayer][self._activeFrame] = self._cloneData(tab.data); } self._mergedData = null; self._resizeAndDraw(); self._renderTabs(); self._renderTimeline(); self._autoSave(); } catch(err) { self._showModal('导入失败：文件格式不正确', [{text:'确定',value:true,primary:true}]); } };
        reader.readAsText(file); e.target.value = '';
    },

    _medianCutBest: function(pixels, maxColors) { if (!pixels.length) return []; var buckets = [pixels]; while (buckets.length < maxColors) { var bestIdx = -1, bestRange = -1; for (var i = 0; i < buckets.length; i++) { if (buckets[i].length < 2) continue; var mnR=255,mxR=0,mnG=255,mxG=0,mnB=255,mxB=0; for (var j = 0; j < buckets[i].length; j++) { var p = buckets[i][j]; mnR=Math.min(mnR,p[0]);mxR=Math.max(mxR,p[0]);mnG=Math.min(mnG,p[1]);mxG=Math.max(mxG,p[1]);mnB=Math.min(mnB,p[2]);mxB=Math.max(mxB,p[2]); } var range = Math.max(mxR-mnR,mxG-mnG,mxB-mnB); if (range > bestRange) { bestRange = range; bestIdx = i; } } if (bestIdx === -1) break; var bucket = buckets[bestIdx]; var mnR2=255,mxR2=0,mnG2=255,mxG2=0,mnB2=255,mxB2=0; for (var k = 0; k < bucket.length; k++) { var p2 = bucket[k]; mnR2=Math.min(mnR2,p2[0]);mxR2=Math.max(mxR2,p2[0]);mnG2=Math.min(mnG2,p2[1]);mxG2=Math.max(mxG2,p2[1]);mnB2=Math.min(mnB2,p2[2]);mxB2=Math.max(mxB2,p2[2]); } var ranges = [mxR2-mnR2,mxG2-mnG2,mxB2-mnB2], ch = ranges.indexOf(Math.max.apply(null, ranges)); bucket.sort(function(a, b) { return a[ch] - b[ch]; }); var mid = bucket.length >> 1; buckets.splice(bestIdx, 1, bucket.slice(0, mid), bucket.slice(mid)); } return buckets.filter(function(b) { return b.length > 0; }).map(function(bucket) { var freq = new Map(); for (var i = 0; i < bucket.length; i++) { var p = bucket[i]; var key = (p[0]<<16)|(p[1]<<8)|p[2]; freq.set(key, (freq.get(key)||0)+1); } var bestKey = 0, bestCount = 0; freq.forEach(function(count, key) { if (count > bestCount) { bestCount = count; bestKey = key; } }); return {r:(bestKey>>16)&0xff,g:(bestKey>>8)&0xff,b:bestKey&0xff}; }); },

    _medianCutWorker: null,
    _runMedianCutAsync: function(pixels, callback) {
        var self = this;
        try {
            if (!this._medianCutWorker) {
                this._medianCutWorker = new Worker('js/skills/median-cut-worker.js');
            }
            this._medianCutWorker.onmessage = function(e) {
                if (e.data.type === 'medianCutResult') {
                    callback(e.data.palette);
                }
            };
            this._medianCutWorker.postMessage({ type: 'medianCut', pixels: pixels, maxColors: 256 });
        } catch(e) {
            // Worker 不可用时回退到同步算法
            var palette = self._medianCutBest(pixels, 256);
            callback(palette);
        }
    },

    _dedupPalette: function(palette) { var threshold = 100; var result = []; for (var i = 0; i < palette.length; i++) { var c = palette[i]; var merged = false; for (var j = 0; j < result.length; j++) { var r = result[j]; var d = (c.r-r.r)*(c.r-r.r)+(c.g-r.g)*(c.g-r.g)+(c.b-r.b)*(c.b-r.b); if (d < threshold) { merged = true; break; } } if (!merged) result.push(c); } return result; },
    _processImportedImage: function(img) {
        var self = this;
        var w = img.naturalWidth, h = img.naturalHeight;
        self._layers.length = 0; self._frameData.length = 0; self._frameCount = 1;
        self._activeFrame = 0; self._activeLayer = 0;
        self._layers.push({name:'图层1',visible:true});
        self._addTab(w, h);
        var tab = self._getActiveTab(); if (!tab) return;
        self._pushUndo(tab);
        var tc = document.createElement('canvas'); tc.width = w; tc.height = h;
        var tctx = tc.getContext('2d'); tctx.drawImage(img, 0, 0, w, h);
        var imgData = tctx.getImageData(0, 0, w, h);
        var pixels = [];
        for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) {
            var i = (y*w+x)*4;
            if (imgData.data[i+3] < 128) continue;
            pixels.push([imgData.data[i], imgData.data[i+1], imgData.data[i+2]]);
        }
        self._runMedianCutAsync(pixels, function(palette) {
            palette = self._dedupPalette(palette);
            var existingColorMap = new Map();
            self._pixelBlocks.forEach(function(bl) { existingColorMap.set(bl.color.toLowerCase(), bl.id); });
            var colorToId = new Map();
            palette.forEach(function(c) {
                var hex = '#'+[c.r,c.g,c.b].map(function(v){return v.toString(16).padStart(2,'0');}).join('');
                var existing = existingColorMap.get(hex.toLowerCase());
                if (existing !== undefined) { colorToId.set(hex, existing); return; }
                var nearId = null, nearDist = Infinity;
                self._pixelBlocks.forEach(function(bl) {
                    var bc = bl.color.replace('#','');
                    var br = parseInt(bc.slice(0,2),16), bg = parseInt(bc.slice(2,4),16), bb = parseInt(bc.slice(4,6),16);
                    var d = (c.r-br)*(c.r-br)+(c.g-bg)*(c.g-bg)+(c.b-bb)*(c.b-bb);
                    if (d < nearDist) { nearDist = d; nearId = bl.id; }
                });
                if (nearDist < 100) { colorToId.set(hex, nearId); }
                else if (self._pixelBlocks.length < 256) {
                    var id = self._nextBlockId++;
                    self._pixelBlocks.push({id:id,color:hex,name:'色'+id});
                    colorToId.set(hex, id);
                } else { colorToId.set(hex, nearId); }
            });
            var matchCache = new Map();
            function findClosest(r,g,b) {
                var key = (r<<16)|(g<<8)|b;
                if (matchCache.has(key)) return matchCache.get(key);
                var bestId = 0, bestDist = Infinity;
                for (var k = 0; k < palette.length; k++) {
                    var c = palette[k], d = (r-c.r)**2+(g-c.g)**2+(b-c.b)**2;
                    if (d < bestDist) { bestDist = d; bestId = colorToId.get('#'+[c.r,c.g,c.b].map(function(v){return v.toString(16).padStart(2,'0');}).join('')); }
                }
                matchCache.set(key, bestId);
                return bestId;
            }
            self._renderPixelGrid();
            for (var fy = 0; fy < h; fy++) for (var fx = 0; fx < w; fx++) {
                var fi = (fy*w+fx)*4;
                if (imgData.data[fi+3] < 128) { tab.data[fy][fx] = 0; continue; }
                tab.data[fy][fx] = findClosest(imgData.data[fi], imgData.data[fi+1], imgData.data[fi+2]);
            }
            self._saveCurrentFrame(); self._mergedData = null;
            self._drawCanvas(); self._renderTimeline(); self._autoSave();
        });
    },

    _handleImportImgDataURL: function(dataURL) {
        var self = this;
        var img = new Image();
        img.onload = function() {
            if (typeof showToast === 'function') showToast('正在处理图片...');
            self._processImportedImage(img);
        };
        img.onerror = function() {
            if (typeof showToast === 'function') showToast('云盘图片加载失败');
        };
        img.src = dataURL;
    },

    _handleImportImg: function(e) {
        var self = this, file = e.target.files[0]; if (!file) return; var reader = new FileReader();
        reader.onload = function() { var img = new Image(); img.onload = function() { self._processImportedImage(img); }; img.src = reader.result; };
        reader.readAsDataURL(file); e.target.value = '';
    },

    _handleAddColor: function(hex) { if (this._editColorMode) { var b = this._pixelBlocks.find(function(bl) { return bl.id === this._selectedBlock; }.bind(this)); if (b) { b.color = hex; this._thumbCache.clear(); this._renderPixelGrid(); this._drawCanvas(); this._autoSave(); } } else { var exists = this._pixelBlocks.find(function(b2) { return b2.color.toLowerCase() === hex.toLowerCase(); }); if (!exists) { var newId = this._nextBlockId; this._pixelBlocks.push({id:newId,color:hex,name:'色'+newId}); this._nextBlockId++; this._selectedBlock = newId; this._renderPixelGrid(); this._autoSave(); } } this._editColorMode = false; },
    _handleEditColor: function() { var self = this; (async function() { var b = self._pixelBlocks.find(function(bl) { return bl.id === self._selectedBlock; }); if (!b) { await self._showModal('请先选中一个色块', [{text:'知道了',value:true,primary:true}]); return; } self._editColorMode = true; var input = self._q('#ppAddColorInput'); input.value = b.color; input.click(); })(); },
    _doClearColor: function() { var self = this; (async function() { var ok = await self._showModal('确定清空所有色块？画布中使用该色块的像素将变为空。', [{text:'取消',value:false},{text:'确定清空',value:true,primary:true}]); if (!ok) return; self._pixelBlocks.length = 0; self._nextBlockId = 1; self._selectedBlock = 1; var tab = self._getActiveTab(); if (tab) { self._pushUndo(tab); for (var y = 0; y < tab.h; y++) for (var x = 0; x < tab.w; x++) tab.data[y][x] = 0; self._mergedData = null; self._saveCurrentFrame(); self._drawCanvas(); self._renderTimeline(); } self._renderPixelGrid(); self._autoSave(); })(); },

    _handleMergeColor: function() { var self = this; (async function() { var btn = self._q('#ppMergeColorBtn'); if (!self._mergeColorMode) { self._mergeColorMode = true; self._mergeColorIds = []; btn.style.background = '#e67e22'; btn.style.color = '#fff'; self._renderPixelGrid(); } else { if (self._mergeColorIds.length < 2) { self._mergeColorMode = false; self._mergeColorIds = []; btn.style.background = '#2c3e50'; btn.style.color = '#e67e22'; self._renderPixelGrid(); return; } var targetId = self._mergeColorIds[0], removeIds = self._mergeColorIds.slice(1); var ok = await self._showModal('将 ' + removeIds.length + ' 个色块合并到色块#' + targetId + '？', [{text:'取消',value:false},{text:'确定合并',value:true,primary:true}]); if (!ok) { self._mergeColorMode = false; self._mergeColorIds = []; btn.style.background = '#2c3e50'; btn.style.color = '#e67e22'; self._renderPixelGrid(); return; } var tab = self._getActiveTab(); if (tab) { self._pushUndo(tab); for (var y = 0; y < tab.h; y++) for (var x = 0; x < tab.w; x++) { if (removeIds.indexOf(tab.data[y][x]) !== -1) tab.data[y][x] = targetId; } self._mergedData = null; self._saveCurrentFrame(); self._drawCanvas(); self._renderTimeline(); } for (var li = 0; li < self._layers.length; li++) { if (!self._frameData[li]) continue; for (var f = 0; f < self._frameCount; f++) { if (!self._frameData[li][f]) continue; var fd = self._frameData[li][f]; for (var fy = 0; fy < fd.length; fy++) for (var fx = 0; fx < fd[0].length; fx++) { if (removeIds.indexOf(fd[fy][fx]) !== -1) fd[fy][fx] = targetId; } } } removeIds.forEach(function(rid) { var idx = self._pixelBlocks.findIndex(function(b) { return b.id === rid; }); if (idx !== -1) self._pixelBlocks.splice(idx, 1); }); self._mergeColorMode = false; self._mergeColorIds = []; btn.style.background = '#2c3e50'; btn.style.color = '#e67e22'; self._renderPixelGrid(); self._autoSave(); } })(); },

    _doClearBrush: function() { var self = this; (async function() { var ok = await self._showModal('确定清空所有笔刷？', [{text:'取消',value:false},{text:'确定清空',value:true,primary:true}]); if (!ok) return; self._brushes.length = 0; self._nextBrushId = 1; self._selectedBrushIdx = -1; self._renderBrushes(); self._autoSave(); })(); },
    _doExportBrush: function() { if (!this._brushes.length) { this._showModal('没有笔刷可导出', [{text:'知道了',value:true,primary:true}]); return; } var json = JSON.stringify({brushes:this._brushes,nextBrushId:this._nextBrushId}); var blob = new Blob([json],{type:'application/json'}); var link = document.createElement('a'); link.download = 'brushes.json'; link.href = URL.createObjectURL(blob); link.click(); URL.revokeObjectURL(link.href); },
    _handleImportBrush: function(e) { var self = this, file = e.target.files[0]; if (!file) return; var reader = new FileReader(); reader.onload = function() { try { var json = JSON.parse(reader.result); if (json.brushes && Array.isArray(json.brushes)) { json.brushes.forEach(function(b) { if (!b.data) return; self._nextBrushId++; self._brushes.push({id:self._nextBrushId,name:String(self._brushes.length+1),data:b.data,w:b.w,h:b.h}); }); self._renderBrushes(); self._autoSave(); self._showModal('已导入' + json.brushes.filter(function(b){return b.data;}).length + '个笔刷', [{text:'好的',value:true,primary:true}]); } } catch(err) { self._showModal('导入失败：文件格式错误', [{text:'知道了',value:true,primary:true}]); } }; reader.readAsText(file); e.target.value = ''; },

    _doClear: function() { var self = this; (async function() { var ok = await self._showModal('确定要清空当前画布吗？\n此操作可通过撤销恢复。', [{text:'取消',value:false},{text:'确定清空',value:true,primary:true}]); if (!ok) return; var tab = self._getActiveTab(); if (!tab) return; self._pushUndo(tab); tab.data = self._createCanvasData(tab.w, tab.h); self._mergedData = null; self._saveCurrentFrame(); self._drawCanvas(); self._renderTimeline(); self._autoSave(); })(); },

    _doReset: function() { var self = this; (async function() { var ok = await self._showModal('确定要恢复初始设置吗？\n将清除所有画布、色块、笔刷、图层、帧数据。', [{text:'取消',value:false},{text:'确定重置',value:true,primary:true}]); if (!ok) return; try { var db = await self._openDB(); var tx = db.transaction(self.STORE, 'readwrite'); tx.objectStore(self.STORE).delete('main'); db.close(); } catch(e) {} self._tabs.length = 0; self._tabCounter = 0; self._activeTabId = null; self._pixelBlocks.length = 0; self._nextBlockId = 11; self._brushes.length = 0; self._nextBrushId = 1; self._selectedBrushIdx = -1; self._layers.length = 0; self._frameData.length = 0; self._frameCount = 1; self._activeFrame = 0; self._activeLayer = 0; self._undoStack.length = 0; self._redoStack.length = 0; self._selectedBlock = 1; self._showNumbers = true; self._currentTool = 'brush'; self._mergedData = null; self._thumbCache.clear(); self._bgDirty = true; self._pixelBlocks.push.apply(self._pixelBlocks, JSON.parse(JSON.stringify(self._defaultBlocks))); self._layers.push({name:'图层1',visible:true}); self._q('#ppNumToggle').classList.add('on'); self._q('#ppFpsInput').value = '5'; self._setTool('brush'); self._addTab(32, 32); self._renderPixelGrid(); self._renderBrushes(); self._renderTimeline(); self._renderTabs(); })(); },

    _ensureValidBlock: function() { var self = this; return (async function() { if (self._isValidBlock(self._selectedBlock)) return true; await self._showModal('当前色块已不存在，请重新选择一个色块', [{text:'知道了',value:true,primary:true}]); return false; })(); },

    _colLabel: function(i) { var s = '', n = i; do { s = String.fromCharCode(65+(n%26))+s; n = Math.floor(n/26)-1; } while(n >= 0); return s; },

    _renderTimeline: function() {
        var self = this; var timeline = this._q('#ppTimeline'); timeline.innerHTML = ''; var tab = this._getActiveTab(); if (!tab) return;
        var colHeader = document.createElement('div'); colHeader.className = 'pp-timeline-col-header';
        var corner = document.createElement('div'); corner.className = 'pp-col-header-corner'; corner.textContent = '#'; colHeader.appendChild(corner);
        for (var f = 0; f < this._frameCount; f++) { var ch = document.createElement('div'); ch.className = 'pp-col-header-cell'; ch.textContent = this._colLabel(f); colHeader.appendChild(ch); }
        var colAdd = document.createElement('div'); colAdd.className = 'pp-col-add-btn'; colAdd.textContent = '+'; colAdd.title = '添加帧';
        colAdd.onclick = function() { self._saveCurrentFrame(); self._frameCount++; for (var li = 0; li < self._layers.length; li++) self._frameData[li].push(self._cloneData(self._frameData[li][self._frameData[li].length-1])); self._activeFrame = self._frameCount-1; self._mergedData = null; self._loadCurrentFrame(); self._drawCanvas(); self._renderTimeline(); self._autoSave(); };
        colHeader.appendChild(colAdd); timeline.appendChild(colHeader);
        this._layers.forEach(function(layer, li) {
            var row = document.createElement('div'); row.className = 'pp-timeline-row';
            var rh = document.createElement('div'); rh.className = 'pp-row-header';
            rh.innerHTML = '<span class="pp-eye">' + (layer.visible ? 'V' : '-') + '</span>' + (li + 1);
            rh.querySelector('.pp-eye').onclick = function(e) { e.stopPropagation(); layer.visible = !layer.visible; self._mergedData = null; self._drawCanvas(); self._renderTimeline(); };
            row.appendChild(rh);
            for (var f = 0; f < self._frameCount; f++) {
                var cell = document.createElement('div'); cell.className = 'pp-frame-cell' + (f === self._activeFrame && li === self._activeLayer ? ' active' : '');
                var c = document.createElement('canvas'); c.width = 48; c.height = 48; var cctx = c.getContext('2d');
                var key = li + '-' + f; var imgData = self._thumbCache.get(key);
                if (!imgData) { var fdata = (self._frameData[li] && self._frameData[li][f]) ? self._frameData[li][f] : tab.data; var scale = Math.min(44/tab.w, 44/tab.h); var ox = (48-tab.w*scale)/2, oy = (48-tab.h*scale)/2; for (var y = 0; y < tab.h; y++) for (var x = 0; x < tab.w; x++) { var id = fdata[y][x]; if (id !== 0) { var col = self._getColor(id); if (col) { cctx.fillStyle = col; cctx.fillRect(ox+x*scale, oy+y*scale, Math.ceil(scale), Math.ceil(scale)); } } } imgData = cctx.getImageData(0, 0, 48, 48); self._thumbCache.set(key, imgData); } else { cctx.putImageData(imgData, 0, 0); }
                cell.appendChild(c);
                (function(ff,lli) { cell.onclick = function() { self._saveCurrentFrame(); self._activeFrame = ff; self._activeLayer = lli; self._mergedData = null; self._loadCurrentFrame(); self._drawCanvas(); self._renderTimeline(); self._autoSave(); }; })(f, li);
                row.appendChild(cell);
            }
            timeline.appendChild(row);
        });
        var layerRow = document.createElement('div'); layerRow.className = 'pp-timeline-row';
        var layerCorner = document.createElement('div'); layerCorner.className = 'pp-row-header';
        layerCorner.innerHTML = '<span style="color:#e94560;font-size:11px;">+</span>';
        layerCorner.title = '添加图层'; layerCorner.style.cursor = 'pointer';
        layerCorner.onclick = function() { self._saveCurrentFrame(); self._layers.push({name:'图层'+(self._layers.length+1),visible:true}); self._frameData.push([]); for (var f = 0; f < self._frameCount; f++) self._frameData[self._frameData.length-1][f] = self._createCanvasData(tab.w, tab.h); self._activeLayer = self._layers.length-1; self._activeFrame = 0; self._mergedData = null; self._loadCurrentFrame(); self._drawCanvas(); self._renderTimeline(); self._autoSave(); };
        layerRow.appendChild(layerCorner); timeline.appendChild(layerRow);
    },

    _togglePlay: function() { var self = this; if (this._isPlaying) { clearInterval(this._playInterval); this._isPlaying = false; this._q('#ppBtnPlay').textContent = '播放'; } else { this._isPlaying = true; this._q('#ppBtnPlay').textContent = '暂停'; var fps = Math.max(1, parseInt(this._q('#ppFpsInput').value) || 5); this._playInterval = setInterval(function() { self._saveCurrentFrame(); self._activeFrame = (self._activeFrame + 1) % self._frameCount; self._mergedData = null; self._loadCurrentFrame(); self._drawCanvas(); self._renderTimeline(); }, 1000 / fps); } },

    _doDelFrame: function() { var self = this; (async function() { if (self._frameCount <= 1) { await self._showModal('至少保留一帧', [{text:'知道了',value:true,primary:true}]); return; } var ok = await self._showModal('确定删除第 ' + (self._activeFrame+1) + ' 帧吗？', [{text:'取消',value:false},{text:'确定删除',value:true,primary:true}]); if (!ok) return; self._saveCurrentFrame(); for (var li = 0; li < self._layers.length; li++) self._frameData[li].splice(self._activeFrame, 1); self._frameCount--; if (self._activeFrame >= self._frameCount) self._activeFrame = self._frameCount - 1; self._thumbCache.clear(); self._mergedData = null; self._loadCurrentFrame(); self._drawCanvas(); self._renderTimeline(); self._autoSave(); })(); },

    _doDelLayer: function() { var self = this; (async function() { if (self._layers.length <= 1) { await self._showModal('至少保留一个图层', [{text:'知道了',value:true,primary:true}]); return; } var ok = await self._showModal('确定删除第 ' + (self._activeLayer+1) + ' 层吗？', [{text:'取消',value:false},{text:'确定删除',value:true,primary:true}]); if (!ok) return; self._saveCurrentFrame(); self._layers.splice(self._activeLayer, 1); self._frameData.splice(self._activeLayer, 1); if (self._activeLayer >= self._layers.length) self._activeLayer = self._layers.length - 1; self._thumbCache.clear(); self._mergedData = null; self._loadCurrentFrame(); self._drawCanvas(); self._renderTimeline(); self._autoSave(); })(); },

    _openDB: function() { var self = this; return new Promise(function(res, rej) { var r = indexedDB.open(self.DB_NAME, self.DB_VER); r.onupgradeneeded = function(e) { var db = e.target.result; if (!db.objectStoreNames.contains(self.STORE)) db.createObjectStore(self.STORE); }; r.onsuccess = function(e) { res(e.target.result); }; r.onerror = function(e) { rej(e); }; }); },

    _getSectionHeights: function() { var h = {}, self = this; ['ppSecSize','ppSecToggle','ppSecTools','ppSecColors','ppSecBrushes'].forEach(function(id) { var el = self._q('#' + id); if (el) h[id] = el.offsetHeight; }); return h; },

    _getWindowInfo: function() {
        if (!this._overlay || !this._overlay.parentNode) return null;
        var r = this._overlay.getBoundingClientRect();
        return {w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top)};
    },

    _autoSave: function() {
        var self = this; clearTimeout(this._saveTimer);
        this._saveTimer = setTimeout(function() {
            try { self._openDB().then(function(db) { var tx = db.transaction(self.STORE, 'readwrite'); tx.objectStore(self.STORE).put({ tabs: self._tabs.map(function(t) { return {id:t.id,name:t.name,w:t.w,h:t.h,data:t.data,zoom:t.zoom,panX:t.panX,panY:t.panY}; }), activeTabId: self._activeTabId, pixelBlocks: self._pixelBlocks, nextBlockId: self._nextBlockId, brushes: self._brushes, nextBrushId: self._nextBrushId, layers: self._layers, frameCount: self._frameCount, activeFrame: self._activeFrame, activeLayer: self._activeLayer, frameData: self._frameData, selectedBlock: self._selectedBlock, showNumbers: self._showNumbers, currentTool: self._currentTool, selectedBrushIdx: self._selectedBrushIdx, tabCounter: self._tabCounter, panelZoom: self._panelZoom, panelWidth: self._panelLeft.offsetWidth, bottomHeight: self._panelBottom.offsetHeight, sectionHeights: self._getSectionHeights() }, 'main'); db.close(); }).catch(function(){}); } catch(e) {}
        }, 500);
    },

    _loadState: function() { var self = this; return new Promise(function(res) { try { self._openDB().then(function(db) { var tx = db.transaction(self.STORE, 'readonly'); var r = tx.objectStore(self.STORE).get('main'); r.onsuccess = function() { db.close(); res(r.result || null); }; r.onerror = function() { db.close(); res(null); }; }).catch(function() { res(null); }); } catch(e) { res(null); } }); },

    _doImmediateSave: function() {
        var self = this; clearTimeout(self._saveTimer);
        try { var db = indexedDB.open(self.DB_NAME, self.DB_VER); db.onsuccess = function() { var tx = db.transaction(self.STORE, 'readwrite'); tx.objectStore(self.STORE).put({ tabs: self._tabs.map(function(t) { return {id:t.id,name:t.name,w:t.w,h:t.h,data:t.data,zoom:t.zoom,panX:t.panX,panY:t.panY}; }), activeTabId: self._activeTabId, pixelBlocks: self._pixelBlocks, nextBlockId: self._nextBlockId, brushes: self._brushes, nextBrushId: self._nextBrushId, layers: self._layers, frameCount: self._frameCount, activeFrame: self._activeFrame, activeLayer: self._activeLayer, frameData: self._frameData, selectedBlock: self._selectedBlock, showNumbers: self._showNumbers, currentTool: self._currentTool, selectedBrushIdx: self._selectedBrushIdx, tabCounter: self._tabCounter, panelZoom: self._panelZoom, panelWidth: self._panelLeft.offsetWidth, bottomHeight: self._panelBottom.offsetHeight, sectionHeights: self._getSectionHeights() }, 'main'); db.close(); }; } catch(e) {}
    },

    editFace2D: function(face, sourceCanvas) {
        var tab = this._getActiveTab();
        if (!tab || !sourceCanvas) return;

        var w = sourceCanvas.width;
        var h = sourceCanvas.height;
        tab.w = w; tab.h = h;

        // 提取所有非透明像素
        var ctx = sourceCanvas.getContext('2d');
        var imgData = ctx.getImageData(0, 0, w, h);
        var pixels = [];
        for (var y = 0; y < h; y++) {
            for (var x = 0; x < w; x++) {
                var i = (y * w + x) * 4;
                if (imgData.data[i+3] < 128) continue;
                pixels.push([imgData.data[i], imgData.data[i+1], imgData.data[i+2]]);
            }
        }

        // 用中位切割量化到最多256色，并合并相近色（在Worker线程异步执行）
        var self = this;
        this._runMedianCutAsync(pixels, function(palette) {
            // 创建色块（复用已有颜色，不重复创建，总量不超过256）
            var existingColorMap = new Map();
            self._pixelBlocks.forEach(function(bl) {
                existingColorMap.set(bl.color.toLowerCase(), bl.id);
            });
            var colorToId = new Map();
            palette.forEach(function(c) {
                var hex = '#'+[c.r,c.g,c.b].map(function(v){return v.toString(16).padStart(2,'0');}).join('');
                var existing = existingColorMap.get(hex.toLowerCase());
                if (existing !== undefined) {
                    colorToId.set(hex, existing);
                } else if (self._pixelBlocks.length < 256) {
                    var id = self._nextBlockId++;
                    self._pixelBlocks.push({id:id, color:hex, name:'色'+id});
                    colorToId.set(hex, id);
                } else {
                    // 已满256色，映射到最近色
                    var nearestId = 0, nearestDist = Infinity;
                    for (var bi = 0; bi < self._pixelBlocks.length; bi++) {
                        var bl = self._pixelBlocks[bi];
                        var bc = bl.color.replace('#','');
                        var br = parseInt(bc.slice(0,2),16), bg = parseInt(bc.slice(2,4),16), bb = parseInt(bc.slice(4,6),16);
                        var bd = (c.r-br)*(c.r-br)+(c.g-bg)*(c.g-bg)+(c.b-bb)*(c.b-bb);
                        if (bd < nearestDist) { nearestDist = bd; nearestId = bl.id; }
                    }
                    colorToId.set(hex, nearestId);
                }
            });

            // 最近颜色匹配
            var matchCache = new Map();
            function findClosest(r, g, b) {
                var key = (r << 16) | (g << 8) | b;
                if (matchCache.has(key)) return matchCache.get(key);
                var bestId = 0, bestDist = Infinity;
                for (var k = 0; k < palette.length; k++) {
                    var c = palette[k];
                    var d = (r-c.r)*(r-c.r) + (g-c.g)*(g-c.g) + (b-c.b)*(b-c.b);
                    if (d < bestDist) {
                        bestDist = d;
                        bestId = colorToId.get('#'+[c.r,c.g,c.b].map(function(v){return v.toString(16).padStart(2,'0');}).join(''));
                    }
                }
                matchCache.set(key, bestId);
                return bestId;
            }

            // 填充像素数据
            var newData = self._createCanvasData(w, h);
            for (var fy = 0; fy < h; fy++) {
                for (var fx = 0; fx < w; fx++) {
                    var fi = (fy * w + fx) * 4;
                    if (imgData.data[fi+3] < 128) { newData[fy][fx] = 0; continue; }
                    newData[fy][fx] = findClosest(imgData.data[fi], imgData.data[fi+1], imgData.data[fi+2]);
                }
            }

            tab.data = newData;
            self._initFrameData(w, h);
            self._frameData[self._activeLayer][self._activeFrame] = self._cloneData(tab.data);
            self._mergedData = null;
            self._bgDirty = true;
            self._resizeAndDraw();
            self._renderTabs();
            self._renderTimeline();
            self._renderPixelGrid();

            // 自动计算缩放，让图片适配画布可视区域
            if (self._canvasArea) {
                var areaRect = self._canvasArea.getBoundingClientRect();
                var CELL = self.CELL;
                var canvasW = w * CELL;
                var canvasH = h * CELL;
                var fitZoom = Math.min(areaRect.width / canvasW, areaRect.height / canvasH, 1);
                tab.zoom = Math.max(0.05, fitZoom);
                tab.panX = (areaRect.width - canvasW * tab.zoom) / 2;
                tab.panY = (areaRect.height - canvasH * tab.zoom) / 2;
                self._updateViewport();
                self._updateInfo();
            }

            self._editingFace = face;
        });
    },

    getEditedFaceCanvas: function() {
        // 将当前tab的像素数据转换为canvas返回给3D模块
        var tab = this._getActiveTab();
        if (!tab) return null;
        var canvas = document.createElement('canvas');
        canvas.width = tab.w;
        canvas.height = tab.h;
        var ctx = canvas.getContext('2d');
        for (var y = 0; y < tab.h; y++) {
            for (var x = 0; x < tab.w; x++) {
                var id = tab.data[y][x];
                if (id === 0) continue;
                var c = this._getColor(id);
                if (c) { ctx.fillStyle = c; ctx.fillRect(x, y, 1, 1); }
            }
        }
        return canvas;
    }
};
