/**
 * 像素画 - 时间轴 + 动画播放 + 帧层管理
 */

PixelPaintSkill._colLabel = function(i) { var s = '', n = i; do { s = String.fromCharCode(65+(n%26))+s; n = Math.floor(n/26)-1; } while(n >= 0); return s; };

PixelPaintSkill._ensureValidBlock = function() { var self = this; return (async function() { if (self._isValidBlock(self._selectedBlock)) return true; await self._showModal(TEXTS.MSG_COLOR_MISSING, [{text:TEXTS.BTN_OK,value:true,primary:true}]); return false; })(); };

PixelPaintSkill._renderTimeline = function() {
    var self = this; var timeline = this._q('#ppTimeline'); timeline.innerHTML = ''; var tab = this._getActiveTab(); if (!tab) return;
    var colHeader = document.createElement('div'); colHeader.className = 'pp-timeline-col-header';
    var corner = document.createElement('div'); corner.className = 'pp-col-header-corner'; corner.textContent = TEXTS.COL_HEADER; colHeader.appendChild(corner);
    for (var f = 0; f < this._frameCount; f++) { var ch = document.createElement('div'); ch.className = 'pp-col-header-cell'; ch.textContent = this._colLabel(f); colHeader.appendChild(ch); }
    var colAdd = document.createElement('div'); colAdd.className = 'pp-col-add-btn'; colAdd.textContent = '+'; colAdd.title = TEXTS.ADD_FRAME;
    colAdd.onclick = function() { self._saveCurrentFrame(); self._frameCount++; for (var li = 0; li < self._layers.length; li++) self._frameData[li].push(self._cloneData(self._frameData[li][self._frameData[li].length-1])); self._activeFrame = self._frameCount-1; self._mergedData = null; self._loadCurrentFrame(); self._drawCanvas(); self._renderTimeline(); self._autoSave(); };
    colHeader.appendChild(colAdd); timeline.appendChild(colHeader);
    this._layers.forEach(function(layer, li) {
        var row = document.createElement('div'); row.className = 'pp-timeline-row';
        var rh = document.createElement('div'); rh.className = 'pp-row-header';
        rh.innerHTML = '<span class="pp-eye">' + (layer.visible ? TEXTS.EYE_VISIBLE : '-') + '</span>' + (li + 1);
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
    layerCorner.innerHTML = '<span style="color:var(--cos-accent);font-size:11px;">+</span>';
    layerCorner.title = TEXTS.ADD_LAYER; layerCorner.style.cursor = 'pointer';
    layerCorner.onclick = function() { self._saveCurrentFrame(); self._layers.push({name:TEXTS.LAYER_PREFIX + (self._layers.length+1),visible:true}); self._frameData.push([]); for (var f = 0; f < self._frameCount; f++) self._frameData[self._frameData.length-1][f] = self._createCanvasData(tab.w, tab.h); self._activeLayer = self._layers.length-1; self._activeFrame = 0; self._mergedData = null; self._loadCurrentFrame(); self._drawCanvas(); self._renderTimeline(); self._autoSave(); };
    layerRow.appendChild(layerCorner); timeline.appendChild(layerRow);
};

PixelPaintSkill._togglePlay = function() { var self = this; if (this._isPlaying) { clearInterval(this._playInterval); this._isPlaying = false; this._q('#ppBtnPlay').textContent = TEXTS.PLAY; } else { this._isPlaying = true; this._q('#ppBtnPlay').textContent = TEXTS.PAUSE; var fps = Math.max(1, parseInt(this._q('#ppFpsInput').value) || 5); this._playInterval = setInterval(function() { self._saveCurrentFrame(); self._activeFrame = (self._activeFrame + 1) % self._frameCount; self._mergedData = null; self._loadCurrentFrame(); self._drawCanvas(); self._renderTimeline(); }, 1000 / fps); } };

PixelPaintSkill._doDelFrame = function() { var self = this; (async function() { if (self._frameCount <= 1) { await self._showModal(TEXTS.MSG_AT_LEAST_ONE_FRAME, [{text:TEXTS.BTN_OK,value:true,primary:true}]); return; } var ok = await self._showModal(TEXTS.MSG_DEL_FRAME_PRE + (self._activeFrame+1) + TEXTS.MSG_DEL_FRAME_POST, [{text:TEXTS.BTN_CANCEL,value:false},{text:TEXTS.BTN_CONFIRM_DELETE,value:true,primary:true}]); if (!ok) return; self._saveCurrentFrame(); for (var li = 0; li < self._layers.length; li++) self._frameData[li].splice(self._activeFrame, 1); self._frameCount--; if (self._activeFrame >= self._frameCount) self._activeFrame = self._frameCount - 1; self._thumbCache.clear(); self._mergedData = null; self._loadCurrentFrame(); self._drawCanvas(); self._renderTimeline(); self._autoSave(); })(); };

PixelPaintSkill._doDelLayer = function() { var self = this; (async function() { if (self._layers.length <= 1) { await self._showModal(TEXTS.MSG_AT_LEAST_ONE_LAYER, [{text:TEXTS.BTN_OK,value:true,primary:true}]); return; } var ok = await self._showModal(TEXTS.MSG_DEL_LAYER_PRE + (self._activeLayer+1) + TEXTS.MSG_DEL_LAYER_POST, [{text:TEXTS.BTN_CANCEL,value:false},{text:TEXTS.BTN_CONFIRM_DELETE,value:true,primary:true}]); if (!ok) return; self._saveCurrentFrame(); self._layers.splice(self._activeLayer, 1); self._frameData.splice(self._activeLayer, 1); if (self._activeLayer >= self._layers.length) self._activeLayer = self._layers.length - 1; self._thumbCache.clear(); self._mergedData = null; self._loadCurrentFrame(); self._drawCanvas(); self._renderTimeline(); self._autoSave(); })(); };
