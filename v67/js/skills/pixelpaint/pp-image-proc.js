/**
 * 像素画 - 图片处理（Median Cut减色 + 图片导入）
 */

PixelPaintSkill._medianCutBest = function(pixels, maxColors) { if (!pixels.length) return []; var buckets = [pixels]; while (buckets.length < maxColors) { var bestIdx = -1, bestRange = -1; for (var i = 0; i < buckets.length; i++) { if (buckets[i].length < 2) continue; var mnR=255,mxR=0,mnG=255,mxG=0,mnB=255,mxB=0; for (var j = 0; j < buckets[i].length; j++) { var p = buckets[i][j]; mnR=Math.min(mnR,p[0]);mxR=Math.max(mxR,p[0]);mnG=Math.min(mnG,p[1]);mxG=Math.max(mxG,p[1]);mnB=Math.min(mnB,p[2]);mxB=Math.max(mxB,p[2]); } var range = Math.max(mxR-mnR,mxG-mnG,mxB-mnB); if (range > bestRange) { bestRange = range; bestIdx = i; } } if (bestIdx === -1) break; var bucket = buckets[bestIdx]; var mnR2=255,mxR2=0,mnG2=255,mxG2=0,mnB2=255,mxB2=0; for (var k = 0; k < bucket.length; k++) { var p2 = bucket[k]; mnR2=Math.min(mnR2,p2[0]);mxR2=Math.max(mxR2,p2[0]);mnG2=Math.min(mnG2,p2[1]);mxG2=Math.max(mxG2,p2[1]);mnB2=Math.min(mnB2,p2[2]);mxB2=Math.max(mxB2,p2[2]); } var ranges = [mxR2-mnR2,mxG2-mnG2,mxB2-mnB2], ch = ranges.indexOf(Math.max.apply(null, ranges)); bucket.sort(function(a, b) { return a[ch] - b[ch]; }); var mid = bucket.length >> 1; buckets.splice(bestIdx, 1, bucket.slice(0, mid), bucket.slice(mid)); } return buckets.filter(function(b) { return b.length > 0; }).map(function(bucket) { var freq = new Map(); for (var i = 0; i < bucket.length; i++) { var p = bucket[i]; var key = (p[0]<<16)|(p[1]<<8)|p[2]; freq.set(key, (freq.get(key)||0)+1); } var bestKey = 0, bestCount = 0; freq.forEach(function(count, key) { if (count > bestCount) { bestCount = count; bestKey = key; } }); return {r:(bestKey>>16)&0xff,g:(bestKey>>8)&0xff,b:bestKey&0xff}; }); };

PixelPaintSkill._medianCutWorker = null;

PixelPaintSkill._runMedianCutAsync = function(pixels, callback) {
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
        var palette = self._medianCutBest(pixels, 256);
        callback(palette);
    }
};

PixelPaintSkill._dedupPalette = function(palette) { var threshold = 100; var result = []; for (var i = 0; i < palette.length; i++) { var c = palette[i]; var merged = false; for (var j = 0; j < result.length; j++) { var r = result[j]; var d = (c.r-r.r)*(c.r-r.r)+(c.g-r.g)*(c.g-r.g)+(c.b-r.b)*(c.b-r.b); if (d < threshold) { merged = true; break; } } if (!merged) result.push(c); } return result; };

PixelPaintSkill._processImportedImage = function(img) {
    var self = this;
    var w = img.naturalWidth, h = img.naturalHeight;
    self._layers.length = 0; self._frameData.length = 0; self._frameCount = 1;
    self._activeFrame = 0; self._activeLayer = 0;
    self._layers.push({name:TEXTS.LAYER_PREFIX + '1',visible:true});
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
                self._pixelBlocks.push({id:id,color:hex,name:TEXTS.COLOR_PREFIX + id});
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
};

PixelPaintSkill._handleImportImgDataURL = function(dataURL) {
    var self = this;
    var img = new Image();
    img.onload = function() {
        if (typeof showToast === 'function') showToast(TEXTS.PROCESSING_IMAGE);
        self._processImportedImage(img);
    };
    img.onerror = function() {
        if (typeof showToast === 'function') showToast(TEXTS.CLOUD_IMG_FAILED);
    };
    img.src = dataURL;
};

PixelPaintSkill._handleImportImg = function(e) {
    var self = this, file = e.target.files[0]; if (!file) return; this._cfLock = true;
    var reader = new FileReader();
    reader.onload = function() { var img = new Image(); img.onload = function() { self._processImportedImage(img); }; img.src = reader.result; };
    reader.readAsDataURL(file); e.target.value = '';
};
