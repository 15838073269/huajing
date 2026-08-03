/**
 * 像素画 - 选区操作（框选/移动/翻转/旋转/应用）
 */

PixelPaintSkill._captureSelection = function() { if (!this._selection) return; var tab = this._getActiveTab(); if (!tab) return; var x1 = Math.min(this._selection.x1, this._selection.x2), y1 = Math.min(this._selection.y1, this._selection.y2), x2 = Math.max(this._selection.x1, this._selection.x2), y2 = Math.max(this._selection.y1, this._selection.y2); if (!this._mergedData || this._mergedW !== tab.w || this._mergedH !== tab.h) this._rebuildMerged(); this._selData = []; for (var y = y1; y <= y2; y++) { var row = []; for (var x = x1; x <= x2; x++) { var id = this._mergedData[y][x]; row.push(id !== 0 ? this._getColor(id) : null); } this._selData.push(row); } this._selX = x1; this._selY = y1; this._selLocked = true; };

PixelPaintSkill._selFlipH = function() { if (!this._selData) return; this._selData = this._selData.map(function(row) { return row.slice().reverse(); }); };
PixelPaintSkill._selFlipV = function() { if (!this._selData) return; this._selData = this._selData.slice().reverse(); };
PixelPaintSkill._selRotate = function() { if (!this._selData) return; var h = this._selData.length, w = this._selData[0].length, nd = []; for (var x = 0; x < w; x++) { var row = []; for (var y = h - 1; y >= 0; y--) row.push(this._selData[y][x]); nd.push(row); } this._selData = nd; };

PixelPaintSkill._applySelection = function() { if (!this._selData) return; var self = this, tab = this._getActiveTab(); if (!tab) return; var h = this._selData.length, w = this._selData[0].length; var colorMap = new Map(); this._pixelBlocks.forEach(function(bl) { colorMap.set(bl.color.toLowerCase(), bl.id); }); for (var r = 0; r < h; r++) for (var c = 0; c < w; c++) { var color = this._selData[r][c]; if (!color) continue; var px = this._selX + c, py = this._selY + r; if (px < 0 || px >= tab.w || py < 0 || py >= tab.h) continue; var hex = (color.startsWith('#') ? color : '#' + color).toLowerCase(); var id = colorMap.get(hex); if (id == null) { id = self._nextBlockId++; self._pixelBlocks.push({id:id,color:hex,name:TEXTS.COLOR_PREFIX + id}); colorMap.set(hex,id); self._renderPixelGrid(); } tab.data[py][px] = id; } this._cancelSelection(); this._mergedData = null; this._saveCurrentFrame(); this._drawCanvas(); this._renderTimeline(); this._autoSave(); };

PixelPaintSkill._cancelSelection = function() { this._selection = null; this._selData = null; this._selLocked = false; this._selDragging = false; this._drawSelection(); };

PixelPaintSkill._selApplyTransform = function(fn) { if (!this._selData) return; var tab = this._getActiveTab(); if (!tab) return; this._pushUndo(tab); var sh = this._selData.length, sw = this._selData[0].length; for (var y = this._selY; y < this._selY + sh; y++) for (var x = this._selX; x < this._selX + sw; x++) { if (y >= 0 && y < tab.h && x >= 0 && x < tab.w) { tab.data[y][x] = 0; if (this._mergedData) this._mergedData[y][x] = 0; } } fn.call(this); this._applySelection(); };
