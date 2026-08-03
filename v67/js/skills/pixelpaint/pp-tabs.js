/**
 * 像素画 - 标签页管理
 */

PixelPaintSkill._addTab = function(w, h) {
    var usedIds = new Set(this._tabs.map(function(t) { return t.id; })); var newId = 1; while (usedIds.has(newId)) newId++;
    this._tabCounter = Math.max(this._tabCounter, newId);
    var tab = {id: newId, name: String(newId), w: w || 32, h: h || 32, data: this._createCanvasData(w || 32, h || 32), zoom: 1, panX: 0, panY: 0};
    this._tabs.push(tab); this._switchTab(tab.id); this._renderTabs(); var self = this; setTimeout(function() { self._centerCanvas(); }, 10); this._autoSave();
};

PixelPaintSkill._switchTab = function(id) {
    this._saveCurrentFrame(); this._activeTabId = id; var tab = this._getActiveTab(); if (!tab) return;
    this._q('#ppSizeW').value = tab.w; this._q('#ppSizeH').value = tab.h;
    this._initFrameData(tab.w, tab.h); this._frameData[0][0] = this._cloneData(tab.data);
    this._mergedData = null; this._loadCurrentFrame(); this._resizeAndDraw(); this._renderTabs(); this._renderTimeline(); this._autoSave();
    var self = this; setTimeout(function() { self._centerCanvas(); }, 10);
};

PixelPaintSkill._closeTab = function(id) {
    var idx = this._tabs.findIndex(function(t) { return t.id === id; }); if (idx === -1) return;
    this._tabs.splice(idx, 1); if (!this._tabs.length) { this._addTab(); return; }
    if (this._activeTabId === id) this._switchTab(this._tabs[Math.min(idx, this._tabs.length - 1)].id);
    this._renderTabs(); this._autoSave();
};

PixelPaintSkill._renderTabs = function() {
    var self = this; var bar = this._q('#ppTabBar'); bar.innerHTML = '';
    this._tabs.forEach(function(tab) { var div = document.createElement('div'); div.className = 'pp-tab' + (tab.id === self._activeTabId ? ' active' : ''); div.innerHTML = '<span class="pp-tab-name">' + tab.name + '</span><span class="pp-tab-size">' + tab.w + 'x' + tab.h + '</span><span class="pp-tab-close">x</span>'; div.addEventListener('click', function(e) { if (e.target.classList.contains('pp-tab-close')) { e.stopPropagation(); self._closeTab(tab.id); } else self._switchTab(tab.id); }); bar.appendChild(div); });
    var addDiv = document.createElement('div'); addDiv.className = 'pp-tab-add'; addDiv.textContent = '+'; addDiv.addEventListener('click', function() { self._addTab(); }); bar.appendChild(addDiv);
};
