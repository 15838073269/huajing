/**
 * 像素画 - IndexedDB 持久化存储
 */

PixelPaintSkill._openDB = function() { var self = this; return new Promise(function(res, rej) { var r = indexedDB.open(self.DB_NAME, self.DB_VER); r.onupgradeneeded = function(e) { var db = e.target.result; if (!db.objectStoreNames.contains(self.STORE)) db.createObjectStore(self.STORE); }; r.onsuccess = function(e) { res(e.target.result); }; r.onerror = function(e) { rej(e); }; }); };

PixelPaintSkill._getSectionHeights = function() { var h = {}, self = this; ['ppSecColors','ppSecBrushes'].forEach(function(id) { var el = self._q('#' + id); if (el) h[id] = el.offsetHeight; }); return h; };

PixelPaintSkill._getWindowInfo = function() {
    if (!this._overlay || !this._overlay.parentNode) return null;
    var r = this._overlay.getBoundingClientRect();
    return {w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top)};
};

PixelPaintSkill._autoSave = function() {
    var self = this; clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(function() {
        try { self._openDB().then(function(db) { var tx = db.transaction(self.STORE, 'readwrite'); tx.objectStore(self.STORE).put({ tabs: self._tabs.map(function(t) { return {id:t.id,name:t.name,w:t.w,h:t.h,data:t.data,zoom:t.zoom,panX:t.panX,panY:t.panY}; }), activeTabId: self._activeTabId, pixelBlocks: self._pixelBlocks, nextBlockId: self._nextBlockId, brushes: self._brushes, nextBrushId: self._nextBrushId, layers: self._layers, frameCount: self._frameCount, activeFrame: self._activeFrame, activeLayer: self._activeLayer, frameData: self._frameData, selectedBlock: self._selectedBlock, showNumbers: self._showNumbers, showGrid: self._showGrid, currentTool: self._currentTool, selectedBrushIdx: self._selectedBrushIdx, tabCounter: self._tabCounter, panelZoom: self._panelZoom, panelWidth: self._panelLeft.offsetWidth, staticWidth: (self._q('#ppPanelStatic')||{}).offsetWidth, bottomHeight: self._panelBottom.offsetHeight, sectionHeights: self._getSectionHeights() }, 'main'); db.close(); }).catch(function(){}); } catch(e) {}
    }, 500);
};

PixelPaintSkill._loadState = function() { var self = this; return new Promise(function(res) { try { self._openDB().then(function(db) { var tx = db.transaction(self.STORE, 'readonly'); var r = tx.objectStore(self.STORE).get('main'); r.onsuccess = function() { db.close(); res(r.result || null); }; r.onerror = function() { db.close(); res(null); }; }).catch(function() { res(null); }); } catch(e) { res(null); } }); };

PixelPaintSkill._doImmediateSave = function() {
    var self = this; clearTimeout(self._saveTimer);
    try { var db = indexedDB.open(self.DB_NAME, self.DB_VER); db.onsuccess = function() { var tx = db.transaction(self.STORE, 'readwrite'); tx.objectStore(self.STORE).put({ tabs: self._tabs.map(function(t) { return {id:t.id,name:t.name,w:t.w,h:t.h,data:t.data,zoom:t.zoom,panX:t.panX,panY:t.panY}; }), activeTabId: self._activeTabId, pixelBlocks: self._pixelBlocks, nextBlockId: self._nextBlockId, brushes: self._brushes, nextBrushId: self._nextBrushId, layers: self._layers, frameCount: self._frameCount, activeFrame: self._activeFrame, activeLayer: self._activeLayer, frameData: self._frameData, selectedBlock: self._selectedBlock, showNumbers: self._showNumbers, showGrid: self._showGrid, currentTool: self._currentTool, selectedBrushIdx: self._selectedBrushIdx, tabCounter: self._tabCounter, panelZoom: self._panelZoom, panelWidth: self._panelLeft.offsetWidth, staticWidth: (self._q('#ppPanelStatic')||{}).offsetWidth, bottomHeight: self._panelBottom.offsetHeight, sectionHeights: self._getSectionHeights() }, 'main'); db.close(); }; } catch(e) {}
};
