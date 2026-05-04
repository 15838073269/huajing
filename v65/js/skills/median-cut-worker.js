// 中位切割 + 相近色合并（在 Worker 线程运行，不阻塞 UI）
self.onmessage = function(e) {
    var d = e.data;
    if (d.type === 'medianCut') {
        var palette = medianCutBest(d.pixels, d.maxColors || 256);
        // 合并相近色（TOL=15）
        var TOL = 15, TOL2 = TOL * TOL, merged = [], used = new Uint8Array(palette.length);
        for (var i = 0; i < palette.length; i++) {
            if (used[i]) continue;
            var ci = palette[i], sr = ci.r, sg = ci.g, sb = ci.b, cnt = 1;
            for (var j = i + 1; j < palette.length; j++) {
                if (used[j]) continue;
                var cj = palette[j];
                if ((ci.r - cj.r) * (ci.r - cj.r) + (ci.g - cj.g) * (ci.g - cj.g) + (ci.b - cj.b) * (ci.b - cj.b) < TOL2) {
                    sr += cj.r; sg += cj.g; sb += cj.b; cnt++; used[j] = 1;
                }
            }
            merged.push({ r: Math.round(sr / cnt), g: Math.round(sg / cnt), b: Math.round(sb / cnt) });
            used[i] = 1;
        }
        self.postMessage({ type: 'medianCutResult', palette: merged });
    }
};

function medianCutBest(pixels, maxColors) {
    if (!pixels.length) return [];
    var buckets = [pixels];
    while (buckets.length < maxColors) {
        var bestIdx = -1, bestRange = -1;
        for (var i = 0; i < buckets.length; i++) {
            if (buckets[i].length < 2) continue;
            var mnR = 255, mxR = 0, mnG = 255, mxG = 0, mnB = 255, mxB = 0;
            for (var j = 0; j < buckets[i].length; j++) {
                var p = buckets[i][j];
                mnR = Math.min(mnR, p[0]); mxR = Math.max(mxR, p[0]);
                mnG = Math.min(mnG, p[1]); mxG = Math.max(mxG, p[1]);
                mnB = Math.min(mnB, p[2]); mxB = Math.max(mxB, p[2]);
            }
            var range = Math.max(mxR - mnR, mxG - mnG, mxB - mnB);
            if (range > bestRange) { bestRange = range; bestIdx = i; }
        }
        if (bestIdx === -1) break;
        var bucket = buckets[bestIdx];
        var mnR2 = 255, mxR2 = 0, mnG2 = 255, mxG2 = 0, mnB2 = 255, mxB2 = 0;
        for (var k = 0; k < bucket.length; k++) {
            var p2 = bucket[k];
            mnR2 = Math.min(mnR2, p2[0]); mxR2 = Math.max(mxR2, p2[0]);
            mnG2 = Math.min(mnG2, p2[1]); mxG2 = Math.max(mxG2, p2[1]);
            mnB2 = Math.min(mnB2, p2[2]); mxB2 = Math.max(mxB2, p2[2]);
        }
        var ranges = [mxR2 - mnR2, mxG2 - mnG2, mxB2 - mnB2], ch = ranges.indexOf(Math.max.apply(null, ranges));
        bucket.sort(function(a, b) { return a[ch] - b[ch]; });
        var mid = bucket.length >> 1;
        buckets.splice(bestIdx, 1, bucket.slice(0, mid), bucket.slice(mid));
    }
    return buckets.filter(function(b) { return b.length > 0; }).map(function(bucket) {
        var freq = new Map();
        for (var i = 0; i < bucket.length; i++) {
            var p = bucket[i];
            var key = (p[0] << 16) | (p[1] << 8) | p[2];
            freq.set(key, (freq.get(key) || 0) + 1);
        }
        var bestKey = 0, bestCount = 0;
        freq.forEach(function(count, key) {
            if (count > bestCount) { bestCount = count; bestKey = key; }
        });
        return { r: (bestKey >> 16) & 0xff, g: (bestKey >> 8) & 0xff, b: bestKey & 0xff };
    });
}
