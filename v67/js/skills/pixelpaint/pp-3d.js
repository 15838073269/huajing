/**
 * 像素画 - 3D面编辑 + 像素对齐校准
 */

// ===== 3D 面编辑：从外部 Canvas 导入像素 =====
PixelPaintSkill.editFace2D = function(face, sourceCanvas) {
    var tab = this._getActiveTab();
    if (!tab || !sourceCanvas) return;

    var w = sourceCanvas.width;
    var h = sourceCanvas.height;
    tab.w = w; tab.h = h;

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

    var self = this;
    this._runMedianCutAsync(pixels, function(palette) {
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
                self._pixelBlocks.push({id:id, color:hex, name:TEXTS.COLOR_PREFIX + id});
                colorToId.set(hex, id);
            } else {
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
};

// ===== 导出当前画布为 Canvas（供3D模块使用） =====
PixelPaintSkill.getEditedFaceCanvas = function() {
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
};

// ===== 像素对齐校准 =====
PixelPaintSkill._calibrateImage = function() {
    var self = this;
    var tab = self._getActiveTab();
    if (!tab) return;
    var targetSize = parseInt(self._q('#ppCalibrateSize').value);
    var ditherMode = self._q('#ppCalibrateDither').value;
    var paletteName = self._q('#ppCalibratePalette').value;
    // 1. 将当前画布渲染为 RGB
    var srcCanvas = document.createElement('canvas');
    srcCanvas.width = tab.w; srcCanvas.height = tab.h;
    var srcCtx = srcCanvas.getContext('2d');
    for (var y = 0; y < tab.h; y++) {
        for (var x = 0; x < tab.w; x++) {
            var id = tab.data[y][x];
            if (id === 0) continue;
            var color = self._getColor(id);
            if (color) { srcCtx.fillStyle = color; srcCtx.fillRect(x, y, 1, 1); }
        }
    }
    // 2. 邻近下采样到目标网格
    var dstW = targetSize;
    var dstH = Math.max(1, Math.round(tab.h * (targetSize / tab.w)));
    var tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = dstW; tmpCanvas.height = dstH;
    var tmpCtx = tmpCanvas.getContext('2d');
    tmpCtx.imageSmoothingEnabled = false;
    tmpCtx.drawImage(srcCanvas, 0, 0, dstW, dstH);
    var imgData = tmpCtx.getImageData(0, 0, dstW, dstH);
    var data = imgData.data;
    // 3. 选择调色盘
    var activePalette;
    if (paletteName === 'custom16') {
        activePalette = self._extractCalibratePalette(data, 16);
    } else {
        activePalette = self._PALETTES[paletteName];
    }
    // 4. 选择抖动矩阵
    var bayerMatrix = null, bayerSize = 0;
    if (ditherMode === 'bayer4x4') { bayerMatrix = self._BAYER_4X4; bayerSize = 4; }
    else if (ditherMode === 'bayer2x2') { bayerMatrix = self._BAYER_2X2; bayerSize = 2; }
    // 5. 建立调色盘色块映射
    var colorMap = new Map();
    var existingColors = new Map();
    self._pixelBlocks.forEach(function(bl) { existingColors.set(bl.color.toLowerCase(), bl.id); });
    activePalette.forEach(function(rgb) {
        var hex = '#' + [rgb[0], rgb[1], rgb[2]].map(function(v) { return v.toString(16).padStart(2, '0'); }).join('');
        var key = hex.toLowerCase();
        if (existingColors.has(key)) { colorMap.set(key, existingColors.get(key)); return; }
        var id = self._nextBlockId++;
        self._pixelBlocks.push({id:id, color:hex, name:TEXTS.COLOR_PREFIX + id});
        colorMap.set(key, id);
        existingColors.set(key, id);
    });
    // 6. 逐像素处理：抖动 + 映射到最近调色盘色
    var newData = self._createCanvasData(dstW, dstH);
    for (var py = 0; py < dstH; py++) {
        for (var px = 0; px < dstW; px++) {
            var idx = (py * dstW + px) * 4;
            if (data[idx+3] <= 32) { newData[py][px] = 0; continue; }
            var r = data[idx], g = data[idx+1], b = data[idx+2];
            if (bayerMatrix) {
                var threshold = (bayerMatrix[py % bayerSize][px % bayerSize] / (bayerSize * bayerSize)) - 0.5;
                var ditherSpread = 45;
                r = Math.min(255, Math.max(0, r + threshold * ditherSpread));
                g = Math.min(255, Math.max(0, g + threshold * ditherSpread));
                b = Math.min(255, Math.max(0, b + threshold * ditherSpread));
            }
            var closest = self._findCalibrateClosest(r, g, b, activePalette);
            var chex = '#' + [closest[0], closest[1], closest[2]].map(function(v) { return v.toString(16).padStart(2, '0'); }).join('');
            newData[py][px] = colorMap.get(chex.toLowerCase());
        }
    }
    // 7. 更新画布
    self._pushUndo(tab);
    tab.w = dstW; tab.h = dstH; tab.data = newData;
    self._initFrameData(dstW, dstH);
    self._frameData[self._activeLayer][self._activeFrame] = self._cloneData(tab.data);
    self._mergedData = null; self._bgDirty = true;
    self._resizeAndDraw(); self._renderTabs(); self._renderTimeline(); self._renderPixelGrid();
    self._q('#ppSizeW').value = dstW; self._q('#ppSizeH').value = dstH;
    self._autoSave();
    setTimeout(function() { self._centerCanvas(); }, 50);
};

PixelPaintSkill._findCalibrateClosest = function(r, g, b, palette) {
    var minDist = Infinity, closest = palette[0];
    for (var i = 0; i < palette.length; i++) {
        var c = palette[i];
        var rmean = (r + c[0]) / 2;
        var dr = r - c[0], dg = g - c[1], db = b - c[2];
        var dist = (2 + rmean/256) * dr*dr + 4 * dg*dg + (2 + (255-rmean)/256) * db*db;
        if (dist < minDist) { minDist = dist; closest = c; }
    }
    return closest;
};

PixelPaintSkill._extractCalibratePalette = function(data, maxColors) {
    var samples = [];
    for (var i = 0; i < data.length; i += 16) {
        if (data[i+3] > 128) samples.push([data[i], data[i+1], data[i+2]]);
    }
    if (!samples.length) return [[0,0,0],[255,255,255]];
    var unique = [];
    for (var si = 0; si < samples.length; si++) {
        var p = samples[si];
        var dup = false;
        for (var ui = 0; ui < unique.length; ui++) {
            var u = unique[ui];
            if (Math.abs(u[0]-p[0])<40 && Math.abs(u[1]-p[1])<40 && Math.abs(u[2]-p[2])<40) { dup = true; break; }
        }
        if (!dup) unique.push(p);
        if (unique.length >= maxColors) break;
    }
    return unique.length ? unique : [[0,0,0],[255,255,255]];
};
