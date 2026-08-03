/**
 * 像素画 - 画布渲染 + 数据操作 + 视口 + 撤销重做 + 帧数据
 */

PixelPaintSkill._createCanvasData = function(w, h) { var d = []; for (var y = 0; y < h; y++) { d[y] = []; for (var x = 0; x < w; x++) d[y][x] = 0; } return d; };
PixelPaintSkill._cloneData = function(d) { return d.map(function(r) { return r.slice(); }); };
PixelPaintSkill._getColor = function(id) { var b = this._pixelBlocks.find(function(p) { return p.id === id; }); return b ? b.color : null; };
PixelPaintSkill._isValidBlock = function(id) { return id !== 0 && this._pixelBlocks.some(function(b) { return b.id === id; }); };
PixelPaintSkill._getActiveTab = function() { var self = this; return this._tabs.find(function(t) { return t.id === self._activeTabId; }); };

PixelPaintSkill._rebuildMerged = function() {
    var tab = this._getActiveTab(); if (!tab) return; var w = tab.w, h = tab.h;
    this._mergedData = this._createCanvasData(w, h);
    for (var li = 0; li < this._layers.length; li++) { if (!this._layers[li].visible) continue; var fd = (this._frameData[li] && this._frameData[li][this._activeFrame]) ? this._frameData[li][this._activeFrame] : null; if (!fd) continue; for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { if (fd[y][x] !== 0) this._mergedData[y][x] = fd[y][x]; } }
    this._mergedW = w; this._mergedH = h;
};
PixelPaintSkill._getMergedId = function(x, y) { return this._mergedData ? this._mergedData[y][x] : 0; };

PixelPaintSkill._rebuildBg = function(w, h) {
    var CELL = this.CELL; this._bgCanvas.width = w * CELL; this._bgCanvas.height = h * CELL; var ctx = this._bgCtx;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { ctx.fillStyle = (x + y) % 2 === 0 ? '#111122' : '#0d0d1a'; ctx.fillRect(x * CELL, y * CELL, CELL, CELL); ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 0.5; ctx.strokeRect(x * CELL, y * CELL, CELL, CELL); }
    ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1.5;
    for (var x2 = 8; x2 < w; x2 += 8) { ctx.beginPath(); ctx.moveTo(x2 * CELL, 0); ctx.lineTo(x2 * CELL, h * CELL); ctx.stroke(); }
    for (var y2 = 8; y2 < h; y2 += 8) { ctx.beginPath(); ctx.moveTo(0, y2 * CELL); ctx.lineTo(w * CELL, y2 * CELL); ctx.stroke(); }
    this._bgDirty = false;
};

PixelPaintSkill._drawCanvas = function() {
    var tab = this._getActiveTab(); if (!tab) return; var w = tab.w, h = tab.h, CELL = this.CELL;
    if (this._bgDirty || this._bgCanvas.width !== w * CELL || this._bgCanvas.height !== h * CELL) this._rebuildBg(w, h);
    if (!this._mergedData || this._mergedW !== w || this._mergedH !== h) this._rebuildMerged();
    var ctx = this._ctx; ctx.drawImage(this._bgCanvas, 0, 0);
    var d = this._mergedData;
    for (var y = 0; y < h; y++) for (var x = 0; x < w; x++) { var id = d[y][x]; if (id === 0) continue; var c = this._getColor(id); if (!c) continue; ctx.fillStyle = c; ctx.fillRect(x * CELL, y * CELL, CELL, CELL); }
    if (this._showNumbers) { for (var y2 = 0; y2 < h; y2++) for (var x2 = 0; x2 < w; x2++) { var id2 = d[y2][x2]; if (id2 === 0 || !this._getColor(id2)) continue; var px = x2 * CELL, py = y2 * CELL; ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2); ctx.fillStyle = '#fff'; ctx.font = 'bold 9px Courier New'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(id2.toString(), px + CELL / 2, py + CELL / 2); } }
};

PixelPaintSkill._drawCell = function(cx, cy) {
    var tab = this._getActiveTab(); if (!tab) return; var CELL = this.CELL, px = cx * CELL, py = cy * CELL;
    this._ctx.drawImage(this._bgCanvas, px, py, CELL, CELL, px, py, CELL, CELL);
    var id = this._getMergedId(cx, cy);
    if (id !== 0) { var c = this._getColor(id); if (c) { this._ctx.fillStyle = c; this._ctx.fillRect(px, py, CELL, CELL); } }
    if (this._showNumbers && id !== 0 && this._getColor(id)) { this._ctx.fillStyle = 'rgba(0,0,0,0.45)'; this._ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2); this._ctx.fillStyle = '#fff'; this._ctx.font = 'bold 9px Courier New'; this._ctx.textAlign = 'center'; this._ctx.textBaseline = 'middle'; this._ctx.fillText(id.toString(), px + CELL / 2, py + CELL / 2); }
};

PixelPaintSkill._drawSelection = function() {
    var CELL = this.CELL; this._selCtx.clearRect(0, 0, this._selCanvas.width, this._selCanvas.height);
    if (this._selLocked && this._selData) {
        var h = this._selData.length, w = this._selData[0].length; this._selCtx.globalAlpha = 0.6;
        for (var r = 0; r < h; r++) for (var c = 0; c < w; c++) { var color = this._selData[r][c]; if (!color) continue; this._selCtx.fillStyle = color.startsWith('#') ? color : '#' + color; this._selCtx.fillRect((this._selX + c) * CELL, (this._selY + r) * CELL, CELL, CELL); }
        this._selCtx.globalAlpha = 1; this._selCtx.strokeStyle = '#e94560'; this._selCtx.lineWidth = 2; this._selCtx.setLineDash([4, 4]); this._selCtx.strokeRect(this._selX * CELL, this._selY * CELL, w * CELL, h * CELL); this._selCtx.setLineDash([]);
    } else if (this._selection) {
        var x1 = Math.min(this._selection.x1, this._selection.x2), y1 = Math.min(this._selection.y1, this._selection.y2), x2 = Math.max(this._selection.x1, this._selection.x2), y2 = Math.max(this._selection.y1, this._selection.y2);
        this._selCtx.strokeStyle = '#e94560'; this._selCtx.lineWidth = 2; this._selCtx.setLineDash([4, 4]); this._selCtx.strokeRect(x1 * CELL, y1 * CELL, (x2 - x1 + 1) * CELL, (y2 - y1 + 1) * CELL); this._selCtx.setLineDash([]); this._selCtx.fillStyle = 'rgba(233,69,96,0.1)'; this._selCtx.fillRect(x1 * CELL, y1 * CELL, (x2 - x1 + 1) * CELL, (y2 - y1 + 1) * CELL);
    }
};

PixelPaintSkill._drawBrushPreview = function(gx, gy) {
    var CELL = this.CELL; this._selCtx.clearRect(0, 0, this._selCanvas.width, this._selCanvas.height); if (this._selection) this._drawSelection();
    if (this._selectedBrushIdx < 0 || !this._brushes[this._selectedBrushIdx]) return;
    var brush = this._brushes[this._selectedBrushIdx]; this._selCtx.globalAlpha = 0.5;
    for (var r = 0; r < brush.data.length; r++) for (var c = 0; c < brush.data[r].length; c++) { var color = brush.data[r][c]; if (!color) continue; var px = gx + c, py = gy + r; if (px < 0 || py < 0) continue; this._selCtx.fillStyle = color.startsWith('#') ? color : '#' + color; this._selCtx.fillRect(px * CELL, py * CELL, CELL, CELL); }
    this._selCtx.globalAlpha = 1; this._selCtx.strokeStyle = '#e94560'; this._selCtx.lineWidth = 1; this._selCtx.setLineDash([3, 3]); this._selCtx.strokeRect(gx * CELL, gy * CELL, brush.data[0].length * CELL, brush.data.length * CELL); this._selCtx.setLineDash([]);
    this._brushPreviewPos = {x: gx, y: gy};
};

PixelPaintSkill._clearBrushPreview = function() { this._selCtx.clearRect(0, 0, this._selCanvas.width, this._selCanvas.height); if (this._selection) this._drawSelection(); this._brushPreviewPos = null; };

PixelPaintSkill._drawGrid = function() {
    if (!this._gridCanvas) return;
    var tab = this._getActiveTab(); if (!tab) return;
    var w = tab.w, h = tab.h, CELL = this.CELL;
    var ctx = this._gridCtx;
    ctx.clearRect(0, 0, this._gridCanvas.width, this._gridCanvas.height);
    if (!this._showGrid) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    for (var x = 0; x <= w; x++) { ctx.moveTo(x * CELL + 0.5, 0); ctx.lineTo(x * CELL + 0.5, h * CELL); }
    for (var y = 0; y <= h; y++) { ctx.moveTo(0, y * CELL + 0.5); ctx.lineTo(w * CELL, y * CELL + 0.5); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (var x2 = 8; x2 <= w; x2 += 8) { ctx.moveTo(x2 * CELL + 0.5, 0); ctx.lineTo(x2 * CELL + 0.5, h * CELL); }
    for (var y2 = 8; y2 <= h; y2 += 8) { ctx.moveTo(0, y2 * CELL + 0.5); ctx.lineTo(w * CELL, y2 * CELL + 0.5); }
    ctx.stroke();
};

PixelPaintSkill._resizeAndDraw = function() { var tab = this._getActiveTab(); if (!tab) return; var CELL = this.CELL; this._canvas.width = tab.w * CELL; this._canvas.height = tab.h * CELL; this._selCanvas.width = this._canvas.width; this._selCanvas.height = this._canvas.height; if (this._gridCanvas) { this._gridCanvas.width = this._canvas.width; this._gridCanvas.height = this._canvas.height; } this._bgDirty = true; this._drawCanvas(); this._drawGrid(); this._drawSelection(); this._updateViewport(); this._updateInfo(); };
PixelPaintSkill._updateViewport = function() { var tab = this._getActiveTab(); if (!tab) return; this._canvasViewport.style.transform = 'translate(' + tab.panX + 'px,' + tab.panY + 'px) scale(' + tab.zoom + ')'; };
PixelPaintSkill._updateInfo = function() { var tab = this._getActiveTab(); if (!tab) return; this._q('#ppCanvasInfo').textContent = tab.w + ' x ' + tab.h + ' | 缩放 ' + Math.round(tab.zoom * 100) + '% | 右键拖拽 . 滚轮缩放'; };
PixelPaintSkill._centerCanvas = function() { var tab = this._getActiveTab(); if (!tab) return; var rect = this._canvasArea.getBoundingClientRect(); var CELL = this.CELL; tab.panX = (rect.width - tab.w * CELL * tab.zoom) / 2; tab.panY = (rect.height - tab.h * CELL * tab.zoom) / 2; this._updateViewport(); this._updateInfo(); };
PixelPaintSkill._screenToGrid = function(e) { var tab = this._getActiveTab(); if (!tab) return null; var rect = this._canvas.getBoundingClientRect(); var CELL = this.CELL; var gx = Math.floor((e.clientX - rect.left) / (CELL * tab.zoom)); var gy = Math.floor((e.clientY - rect.top) / (CELL * tab.zoom)); if (gx < 0 || gy < 0 || gx >= tab.w || gy >= tab.h) return null; return {x: gx, y: gy}; };

// ===== 撤销/重做 =====
PixelPaintSkill._pushUndo = function(tab) { this._undoStack.push(JSON.parse(JSON.stringify(tab.data))); if (this._undoStack.length > 200) this._undoStack.shift(); this._redoStack.length = 0; };
PixelPaintSkill._undo = function() { var t = this._getActiveTab(); if (!t || !this._undoStack.length) return; this._redoStack.push(JSON.parse(JSON.stringify(t.data))); t.data = this._undoStack.pop(); this._mergedData = null; this._saveCurrentFrame(); this._drawCanvas(); this._autoSave(); };
PixelPaintSkill._redo = function() { var t = this._getActiveTab(); if (!t || !this._redoStack.length) return; this._undoStack.push(JSON.parse(JSON.stringify(t.data))); t.data = this._redoStack.pop(); this._mergedData = null; this._saveCurrentFrame(); this._drawCanvas(); this._autoSave(); };

// ===== 帧数据管理 =====
PixelPaintSkill._initFrameData = function(w, h) { this._frameData = []; for (var li = 0; li < this._layers.length; li++) { this._frameData[li] = []; for (var f = 0; f < this._frameCount; f++) this._frameData[li][f] = this._createCanvasData(w, h); } };
PixelPaintSkill._saveCurrentFrame = function() { var t = this._getActiveTab(); if (!t || !this._frameData[this._activeLayer]) return; this._frameData[this._activeLayer][this._activeFrame] = this._cloneData(t.data); this._thumbCache.delete(this._activeLayer + '-' + this._activeFrame); };
PixelPaintSkill._loadCurrentFrame = function() { var t = this._getActiveTab(); if (!t || !this._frameData[this._activeLayer]) return; if (this._frameData[this._activeLayer][this._activeFrame]) t.data = this._cloneData(this._frameData[this._activeLayer][this._activeFrame]); };

PixelPaintSkill._createSampleArt = function(data, w, h) {
    var ox = Math.min(8, Math.floor(w / 4)), oy = Math.min(6, Math.floor(h / 4));
    var sp = [[0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,0,1,5,1,5,1,0,0],[0,0,1,1,1,1,1,0,0],[0,0,0,1,1,1,0,0,0],[0,0,1,1,1,1,1,0,0],[0,1,1,1,1,1,1,1,0],[0,1,1,3,1,1,3,1,0],[0,1,1,1,1,1,1,1,0],[0,0,1,1,1,1,1,0,0],[0,0,0,1,0,1,0,0,0],[0,0,1,1,0,1,1,0,0],[0,0,9,9,0,9,9,0,0]];
    sp.forEach(function(row, r) { row.forEach(function(v, c) { if (oy + r < h && ox + c < w) data[oy + r][ox + c] = v; }); });
    var gy = Math.min(22, h - 2);
    for (var x = 0; x < w; x++) { if (gy < h) data[gy][x] = 4; if (gy + 1 < h && x % 3 !== 0) data[gy + 1][x] = 4; }
    [2, Math.min(24, w - 3)].forEach(function(tx) { for (var ty = Math.max(0, gy - 5); ty < gy; ty++) { if (ty < h && tx < w) data[ty][tx] = 4; if (ty < h && tx + 1 < w) data[ty][tx + 1] = 4; } for (var ty2 = Math.max(0, gy - 8); ty2 < gy - 5; ty2++) { for (var dx = 0; dx < 3; dx++) { if (ty2 < h && tx - 1 + dx < w && tx - 1 + dx >= 0) data[ty2][tx - 1 + dx] = 2; } } });
};
