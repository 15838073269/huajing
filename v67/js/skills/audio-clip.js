/**
 * ============================================
 *   音频剪辑插件 (AudioClip)
 *   只从画布导入：点击画布上的音频 → 声波展示 → 裁剪(去片段/留片段)
 *   → 预览播放 → 导出 WAV 回画布（再由画布下载按钮打包导出）
 * ============================================
 */
var AudioClip = {
    // ===== 基本信息 =====
    id: 'audio-clip',
    name: '音频剪辑',
    icon: '✂',
    category: '音频',
    description: '点画布音频→声波裁剪→导出画布',

    // ===== 文本外部化（插件开发指南 十五） =====
    TEXTS: {
        TITLE: '音频剪辑',
        TOOLTIP_HELP: '用法',
        TOOLTIP_CLOSE: '关闭',
        TOOLTIP_PLAY: '播放预览',
        TOOLTIP_STOP: '停止',
        TOOLTIP_DEL: '删除选中',
        TOOLTIP_KEEP: '仅保留选中',
        TOOLTIP_RESET: '恢复全部',
        TOOLTIP_EXPORT: '导出到画布',
        HINT_CLICK: '点击画布上的音频以载入',
        STATUS_EMPTY: '请先点击画布上的音频',
        STATUS_DECODING: '解码中...',
        STATUS_LOADED: '已加载',
        STATUS_NO_CANVAS_AUDIO: '画布上没有音频',
        STATUS_EXPORTING: '渲染中...',
        STATUS_EXPORTED: '已导出到画布',
        STATUS_EXPORT_FAIL: '导出失败',
        STATUS_NO_SELECTION: '先用鼠标在声波上框选一段',
        STATUS_DROP: '把音频文件拖到画布，再点它即可载入',
        MSG_SECONDS: 's',
        LABEL_KEEP: '保留',
        LABEL_TOTAL: '总时长',
        LABEL_SELECTED: '已选',
        LABEL_REMOVED: '已去'
    },

    // ===== 内部状态 =====
    _world: null,
    _overlay: null,
    _buffer: null,
    _duration: 0,
    _peaks: null,
    _fileName: '',
    _excluded: [],
    _sel: null,
    _decodeCtx: null,
    _actx: null,
    _previewSources: null,
    _previewStart: 0,
    _previewTotal: 0,
    _previewKept: null,
    _raf: null,
    _playing: false,
    _playheadTime: null,
    _onDocMove: null,
    _onDocUp: null,
    _onWaveDown: null,
    _onWaveMove: null,
    _onWaveUp: null,
    _onCanvasClick: null,
    _clickBound: false,

    // ===== 生命周期 =====

    activate: function(world) {
        this._world = world;
        if (this._overlay) {
            if (!this._overlay.parentNode) document.body.appendChild(this._overlay);
            this._bindCanvasClick();
            SkillSystem.renderSubTools();
            return;
        }
        this._createOverlay();
        SkillSystem.renderSubTools();
    },

    deactivate: function() {
        this._stopPreview();
    },

    getSubTools: function() {
        var self = this;
        return [
            { label: '▶ 播放', title: this.TEXTS.TOOLTIP_PLAY, action: function() { self._playPreview(); } },
            { label: '⏹ 停止', title: this.TEXTS.TOOLTIP_STOP, action: function() { self._stopPreview(); } },
            { label: '📤 导出', title: this.TEXTS.TOOLTIP_EXPORT, action: function() { self._exportToCanvas(); } },
            { label: '✕ 关闭', title: this.TEXTS.TOOLTIP_CLOSE, action: function() { SkillSystem.deactivate(); } }
        ];
    },

    save: function() { return {}; },
    load: function() {},

    // ===== 样式 =====

    _getCSS: function() {
        return '' +
            '.acp-overlay{position:fixed;width:560px;height:400px;z-index:9999;display:flex;flex-direction:column;' +
            'background:#0f3460;color:#eee;font-family:"Segoe UI",system-ui,sans-serif;border-radius:12px;' +
            'border:1px solid rgba(100,160,255,0.18);box-shadow:0 8px 40px rgba(0,0,0,.6);overflow:hidden;user-select:none;}' +
            '.acp-header{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;' +
            'background:#16213e;border-bottom:1px solid #333;flex-shrink:0;cursor:move;user-select:none;}' +
            '.acp-header h1{font-size:14px;margin:0;color:#38bdf8;font-weight:600;}' +
            '.acp-header-right{display:flex;gap:6px;}' +
            '.acp-help-btn{background:rgba(100,160,255,.15);border:1px solid rgba(100,160,255,.25);color:#7dd3fc;' +
            'border-radius:6px;width:24px;height:24px;cursor:pointer;font-size:13px;}' +
            '.acp-help-btn:hover{background:rgba(100,160,255,.25);}' +
            '.acp-close-btn{background:rgba(220,80,60,.2);border:1px solid rgba(220,80,60,.3);color:#e87060;' +
            'border-radius:6px;width:24px;height:24px;cursor:pointer;font-size:13px;}' +
            '.acp-close-btn:hover{background:rgba(220,80,60,.32);}' +
            '.acp-body{flex:1;display:flex;flex-direction:column;gap:8px;padding:10px 12px;overflow:auto;}' +
            '.acp-toolbar{display:flex;align-items:center;gap:6px;flex-wrap:nowrap;}' +
            '.acp-ico{width:auto;min-width:34px;height:30px;display:flex;align-items:center;justify-content:center;' +
            'padding:0 9px;gap:4px;white-space:nowrap;' +
            'background:rgba(255,255,255,.06);border:1px solid #444;border-radius:6px;color:#bbb;' +
            'font-size:13px;cursor:pointer;transition:background .15s;}' +
            '.acp-ico:hover{background:rgba(255,255,255,.12);color:#eee;}' +
            '.acp-ico-primary{background:linear-gradient(90deg,#38bdf8,#7dd3fc);border:none;color:#06283d;}' +
            '.acp-ico-primary:hover{opacity:.9;}' +
            '.acp-sep{width:1px;height:20px;background:#444;margin:0 2px;}' +
            '.acp-fname{font-size:12px;color:#94a3b8;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
            '.acp-canvas-wrap{position:relative;height:150px;flex-shrink:0;background:rgba(10,18,40,.5);' +
            'border:1px solid #333;border-radius:8px;overflow:hidden;}' +
            '.acp-canvas{display:block;width:100%;height:100%;cursor:crosshair;}' +
            '.acp-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}' +
            '.acp-info{font-size:12px;color:#94a3b8;}' +
            '.acp-status{font-size:12px;color:#7dd3fc;}' +
            '.acp-status.err{color:#e87060;}' +
            '.acp-hint{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
            'font-size:13px;color:#94a3b8;pointer-events:none;}';
    },

    _injectCSS: function() {
        var id = 'acp-style';
        if (document.getElementById(id)) return;
        var s = document.createElement('style');
        s.id = id;
        s.textContent = this._getCSS();
        document.head.appendChild(s);
    },

    // ===== 窗口创建 =====

    _createOverlay: function() {
        this._injectCSS();
        var self = this;
        var ov = document.createElement('div');
        ov.className = 'acp-overlay';
        ov.setAttribute('data-skill-id', this.id);
        ov.style.left = Math.max(20, (window.innerWidth - 560) / 2) + 'px';
        ov.style.top = Math.max(20, (window.innerHeight - 400) / 2) + 'px';
        ov.style.cursor = 'default';
        ov.addEventListener('contextmenu', function(e) { e.preventDefault(); });
        document.body.appendChild(ov);
        this._overlay = ov;

        var hdr = document.createElement('div');
        hdr.className = 'acp-header';
        hdr.innerHTML = '<h1>' + this.TEXTS.TITLE + '</h1>' +
            '<div class="acp-header-right">' +
            '<button class="acp-help-btn" id="acp-help" title="' + this.TEXTS.TOOLTIP_HELP + '">?</button>' +
            '<button class="acp-close-btn" id="acp-close" title="' + this.TEXTS.TOOLTIP_CLOSE + '">✕</button>' +
            '</div>';
        ov.appendChild(hdr);

        var body = document.createElement('div');
        body.className = 'acp-body';
        body.innerHTML =
            '<div class="acp-toolbar">' +
            '  <button class="acp-ico" id="acp-play" title="' + this.TEXTS.TOOLTIP_PLAY + '">▶ 播放</button>' +
            '  <button class="acp-ico" id="acp-stop" title="' + this.TEXTS.TOOLTIP_STOP + '">⏹ 停止</button>' +
            '  <span class="acp-sep"></span>' +
            '  <button class="acp-ico" id="acp-del" title="' + this.TEXTS.TOOLTIP_DEL + '">✂ 删除</button>' +
            '  <button class="acp-ico" id="acp-keep" title="' + this.TEXTS.TOOLTIP_KEEP + '">🎯 保留</button>' +
            '  <button class="acp-ico" id="acp-reset" title="' + this.TEXTS.TOOLTIP_RESET + '">↺ 恢复</button>' +
            '  <span class="acp-sep"></span>' +
            '  <button class="acp-ico acp-ico-primary" id="acp-export" title="' + this.TEXTS.TOOLTIP_EXPORT + '">📤 导出</button>' +
            '  <span class="acp-fname" id="acp-fname"></span>' +
            '</div>' +
            '<div class="acp-canvas-wrap" id="acp-wrap">' +
            '  <canvas class="acp-canvas" id="acp-canvas"></canvas>' +
            '  <div class="acp-hint" id="acp-hint">' + this.TEXTS.HINT_CLICK + '</div>' +
            '</div>' +
            '<div class="acp-row">' +
            '  <span class="acp-info" id="acp-selinfo"></span>' +
            '  <span class="acp-status" id="acp-status"></span>' +
            '</div>';
        ov.appendChild(body);

        this._canvas = ov.querySelector('#acp-canvas');
        this._ctx = this._canvas.getContext('2d');

        ov.querySelector('#acp-help').addEventListener('click', function() { self._toggleHelp(); });
        ov.querySelector('#acp-close').addEventListener('click', function() { self._destroy(); });

        ov.querySelector('#acp-del').addEventListener('click', function() { self._deleteSelection(); });
        ov.querySelector('#acp-keep').addEventListener('click', function() { self._keepSelection(); });
        ov.querySelector('#acp-reset').addEventListener('click', function() { self._resetSelection(); });

        ov.querySelector('#acp-play').addEventListener('click', function() { self._playPreview(); });
        ov.querySelector('#acp-stop').addEventListener('click', function() { self._stopPreview(); });
        ov.querySelector('#acp-export').addEventListener('click', function() { self._exportToCanvas(); });

        if (typeof WindowHelper !== 'undefined') {
            WindowHelper.makeResizable(ov, { minWidth: 440, minHeight: 320, storeKey: 'acp-window-rect' });
        }

        this._bindDrag(hdr, ov);
        this._bindWaveSelection();

        if (typeof ResizeObserver !== 'undefined') {
            this._ro = new ResizeObserver(function() { self._draw(); });
            this._ro.observe(this._canvas);
        }

        this._bindCanvasClick();

        this._draw();
        this._updateSelInfo();
    },

    _toggleHelp: function() {
        var hint = this._overlay.querySelector('#acp-hint');
        if (hint.style.display === 'none') return;
        if (hint.textContent === this.TEXTS.HINT_CLICK) {
            hint.textContent = '点画布音频载入 → 在声波上拖拽框选 → 删除/保留 → 导出画布';
        } else {
            hint.textContent = this.TEXTS.HINT_CLICK;
        }
    },

    /**
     * 点击画布上的音频即载入（捕获阶段，仅插件激活时生效）
     * 命中：CanvasImages 圆形🎵卡片 / 音乐播放插件节点 / 世界层裸 <audio>
     */
    _bindCanvasClick: function() {
        var self = this;
        if (this._clickBound) return;
        this._clickBound = true;
        this._onCanvasClick = function(e) {
            if (typeof SkillSystem === 'undefined' || SkillSystem.getActiveId() !== 'audio-clip') return;
            var t = e.target;
            if (!t || !t.closest) return;
            var url = null, name = null;

            // 1) CanvasImages 音频卡片
            var card = t.closest('.ci-item');
            if (card && card.dataset && card.dataset.id) {
                var srcs = (typeof CanvasImages !== 'undefined' && CanvasImages.getAudioSources) ? CanvasImages.getAudioSources() : [];
                for (var i = 0; i < srcs.length; i++) {
                    if (srcs[i].id === card.dataset.id) { url = srcs[i].url; name = srcs[i].name; break; }
                }
            }
            // 2) 音乐播放插件节点
            if (!url) {
                var player = t.closest('div[id^="music-player-"], div[id^="music-list-"]');
                if (player) {
                    var aud = player.querySelector('audio');
                    if (!aud && player.nextElementSibling && player.nextElementSibling.tagName === 'AUDIO') aud = player.nextElementSibling;
                    if (aud && aud.src) { url = aud.src; name = aud.title || player.title || '画布音频'; }
                }
            }
            // 3) 世界层裸 <audio>
            if (!url && self._world) {
                var layer = self._world.getLayer();
                if (layer && t.tagName === 'AUDIO' && t.src) { url = t.src; name = t.title || '画布音频'; }
            }

            if (url) {
                e.preventDefault();
                e.stopPropagation();
                self._loadFromUrl(url, name);
            }
        };
        document.addEventListener('click', this._onCanvasClick, true);
    },

    // ===== 从画布载入 =====

    _loadFromUrl: function(url, name) {
        var self = this;
        this._setStatus(this.TEXTS.STATUS_DECODING);
        this._fileName = name || '画布音频';
        this._overlay.querySelector('#acp-fname').textContent = this._fileName;
        fetch(url).then(function(r) { return r.arrayBuffer(); })
            .then(function(ab) { return self._decode(ab); })
            .then(function(buf) { self._onDecoded(buf); })
            .catch(function(err) { self._setStatus('导入失败: ' + (err && err.message ? err.message : err), true); });
    },

    _decode: function(arrayBuffer) {
        if (!this._decodeCtx) {
            var Ctx = window.AudioContext || window.webkitAudioContext;
            this._decodeCtx = new Ctx();
        }
        var ctx = this._decodeCtx;
        return new Promise(function(resolve, reject) {
            ctx.decodeAudioData(arrayBuffer, resolve, reject);
        });
    },

    _onDecoded: function(buf) {
        this._buffer = buf;
        this._duration = buf.duration;
        this._excluded = [];
        this._sel = null;
        this._computePeaks(2000);
        this._overlay.querySelector('#acp-hint').style.display = 'none';
        this._draw();
        this._updateSelInfo();
        this._setStatus(this.TEXTS.STATUS_LOADED + ' ' + this._fmtTime(this._duration));
    },

    // ===== 声波 =====

    _computePeaks: function(numBars) {
        if (!this._buffer) { this._peaks = null; return; }
        var ch0 = this._buffer.getChannelData(0);
        var n = ch0.length;
        var block = Math.max(1, Math.floor(n / numBars));
        var peaks = new Float32Array(numBars);
        for (var i = 0; i < numBars; i++) {
            var s = i * block, e = Math.min(n, s + block);
            var max = 0;
            for (var j = s; j < e; j++) {
                var v = Math.abs(ch0[j]);
                if (v > max) max = v;
            }
            peaks[i] = max;
        }
        this._peaks = peaks;
    },

    _draw: function() {
        var c = this._canvas;
        if (!c) return;
        var ctx = this._ctx;
        var dpr = window.devicePixelRatio || 1;
        var W = c.clientWidth, H = c.clientHeight;
        if (W === 0 || H === 0) return;
        if (c.width !== Math.floor(W * dpr) || c.height !== Math.floor(H * dpr)) {
            c.width = Math.floor(W * dpr);
            c.height = Math.floor(H * dpr);
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = 'rgba(10,18,40,0.5)';
        ctx.fillRect(0, 0, W, H);

        if (!this._peaks || !this._duration) return;

        var self = this;
        var n = this._peaks.length, mid = H / 2;
        var ampScale = 0.42; // 压低声波高度
        for (var i = 0; i < n; i++) {
            var x = (i / n) * W;
            var h = Math.max(1, this._peaks[i] * (H * ampScale));
            ctx.fillStyle = '#38bdf8';
            ctx.fillRect(x, mid - h / 2, Math.max(1, W / n + 0.6), h);
        }
        this._excluded.forEach(function(r) {
            var x1 = self._timeToX(r.start, W), x2 = self._timeToX(r.end, W);
            ctx.fillStyle = 'rgba(233,69,96,0.32)';
            ctx.fillRect(x1, 0, x2 - x1, H);
        });
        if (this._sel) {
            var sx1 = this._timeToX(this._sel.start, W), sx2 = this._timeToX(this._sel.end, W);
            ctx.fillStyle = 'rgba(125,211,252,0.22)';
            ctx.fillRect(sx1, 0, sx2 - sx1, H);
            ctx.strokeStyle = '#7dd3fc';
            ctx.lineWidth = 1;
            ctx.strokeRect(sx1 + 0.5, 0.5, sx2 - sx1 - 1, H - 1);
            ctx.lineWidth = 1;
        }
        if (this._playing && this._playheadTime != null) {
            var px = this._timeToX(this._playheadTime, W);
            ctx.strokeStyle = '#ffd166';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(px, 0);
            ctx.lineTo(px, H);
            ctx.stroke();
            ctx.lineWidth = 1;
        }
    },

    _timeToX: function(t, W) { return (t / this._duration) * W; },
    _xToTime: function(x, W) { return Math.max(0, Math.min(this._duration, (x / W) * this._duration)); },

    _bindWaveSelection: function() {
        var self = this;
        var c = this._canvas;
        this._onWaveDown = function(e) {
            if (!self._buffer) return;
            e.preventDefault();
            var rect = c.getBoundingClientRect();
            var t = self._xToTime(e.clientX - rect.left, rect.width);
            self._sel = { start: t, end: t };
            self._draw();
            self._updateSelInfo();
            self._draggingWave = true;
        };
        this._onWaveMove = function(e) {
            if (!self._draggingWave || !self._sel) return;
            var rect = c.getBoundingClientRect();
            var t = self._xToTime(e.clientX - rect.left, rect.width);
            self._sel.end = t;
            if (self._sel.end < self._sel.start) {
                var tmp = self._sel.start; self._sel.start = self._sel.end; self._sel.end = tmp;
            }
            self._draw();
            self._updateSelInfo();
        };
        this._onWaveUp = function() { self._draggingWave = false; };
        c.addEventListener('mousedown', this._onWaveDown);
        document.addEventListener('mousemove', this._onWaveMove);
        document.addEventListener('mouseup', this._onWaveUp);
    },

    _updateSelInfo: function() {
        if (!this._overlay) return;
        var info = this._overlay.querySelector('#acp-selinfo');
        var time = this._overlay.querySelector('#acp-time');
        if (time && this._duration) time.textContent = this._fmtTime(this._duration);
        if (!info) return;
        var kept = this._getKeptSegments();
        var keptTotal = kept.reduce(function(a, s) { return a + (s.end - s.start); }, 0);
        var removedTotal = this._duration - keptTotal;
        var txt = this.TEXTS.LABEL_TOTAL + ' ' + this._fmtTime(this._duration);
        if (this._sel) txt += '  |  ' + this.TEXTS.LABEL_SELECTED + ' ' + this._fmtTime(this._sel.end - this._sel.start);
        txt += '  |  ' + this.TEXTS.LABEL_KEEP + ' ' + this._fmtTime(keptTotal);
        if (removedTotal > 0.01) txt += '  |  ' + this.TEXTS.LABEL_REMOVED + ' ' + this._fmtTime(removedTotal);
        info.textContent = txt;
    },

    // ===== 裁剪逻辑 =====

    _addExcluded: function(range) {
        if (!range || range.end - range.start < 0.001) return;
        this._excluded.push({ start: range.start, end: range.end });
        this._excluded.sort(function(a, b) { return a.start - b.start; });
        var merged = [];
        for (var i = 0; i < this._excluded.length; i++) {
            var cur = this._excluded[i];
            if (merged.length && cur.start <= merged[merged.length - 1].end + 0.001) {
                merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, cur.end);
            } else {
                merged.push({ start: cur.start, end: cur.end });
            }
        }
        this._excluded = merged;
    },

    _getKeptSegments: function() {
        if (!this._duration) return [];
        if (!this._excluded.length) return [{ start: 0, end: this._duration }];
        var ex = this._excluded.slice().sort(function(a, b) { return a.start - b.start; });
        var segs = [], cur = 0;
        for (var i = 0; i < ex.length; i++) {
            if (ex[i].start > cur + 1e-3) segs.push({ start: cur, end: ex[i].start });
            cur = Math.max(cur, ex[i].end);
        }
        if (cur < this._duration - 1e-3) segs.push({ start: cur, end: this._duration });
        return segs;
    },

    _deleteSelection: function() {
        if (!this._buffer) { this._setStatus(this.TEXTS.STATUS_EMPTY, true); return; }
        if (!this._sel || this._sel.end - this._sel.start < 0.001) {
            this._setStatus(this.TEXTS.STATUS_NO_SELECTION, true);
            return;
        }
        this._addExcluded({ start: this._sel.start, end: this._sel.end });
        this._sel = null;
        this._draw();
        this._updateSelInfo();
    },

    _keepSelection: function() {
        if (!this._buffer) { this._setStatus(this.TEXTS.STATUS_EMPTY, true); return; }
        if (!this._sel || this._sel.end - this._sel.start < 0.001) {
            this._setStatus(this.TEXTS.STATUS_NO_SELECTION, true);
            return;
        }
        this._excluded = [];
        if (this._sel.start > 0.001) this._addExcluded({ start: 0, end: this._sel.start });
        if (this._sel.end < this._duration - 0.001) this._addExcluded({ start: this._sel.end, end: this._duration });
        this._sel = null;
        this._draw();
        this._updateSelInfo();
    },

    _resetSelection: function() {
        if (!this._buffer) return;
        this._excluded = [];
        this._sel = null;
        this._draw();
        this._updateSelInfo();
    },

    // ===== 预览播放 =====

    _playPreview: function() {
        if (!this._buffer) { this._setStatus(this.TEXTS.STATUS_EMPTY, true); return; }
        this._stopPreview();
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!this._actx) this._actx = new Ctx();
        var ctx = this._actx;
        if (ctx.state === 'suspended') ctx.resume();

        var kept = this._getKeptSegments();
        var total = kept.reduce(function(a, s) { return a + (s.end - s.start); }, 0);
        if (total < 0.01) { this._setStatus('没有可播放的内容', true); return; }

        var t0 = ctx.currentTime + 0.06;
        var sources = [];
        var self = this;
        var cursor = t0;
        kept.forEach(function(seg) {
            var src = ctx.createBufferSource();
            src.buffer = self._buffer;
            src.connect(ctx.destination);
            src.start(cursor, seg.start, seg.end - seg.start);
            sources.push(src);
            cursor += (seg.end - seg.start);
        });

        this._previewSources = sources;
        this._previewStart = t0;
        this._previewTotal = total;
        this._previewKept = kept;
        this._playing = true;
        this._playheadTime = kept.length ? kept[0].start : 0;
        this._updateSelInfo();
        this._tickPlayhead();
        this._previewTimer = setTimeout(function() { self._stopPreview(); }, total * 1000 + 300);
    },

    _stopPreview: function() {
        this._playing = false;
        if (this._previewTimer) { clearTimeout(this._previewTimer); this._previewTimer = null; }
        if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
        if (this._previewSources) {
            for (var i = 0; i < this._previewSources.length; i++) {
                try { this._previewSources[i].stop(); } catch (e) {}
            }
            this._previewSources = null;
        }
        this._playheadTime = null;
        if (this._canvas) this._draw();
    },

    _keptTimeToOrig: function(kt) {
        var kept = this._previewKept || this._getKeptSegments();
        for (var i = 0; i < kept.length; i++) {
            var len = kept[i].end - kept[i].start;
            if (kt <= len) return kept[i].start + kt;
            kt -= len;
        }
        return this._duration;
    },

    _tickPlayhead: function() {
        var self = this;
        if (!this._playing || !this._actx) return;
        var elapsed = this._actx.currentTime - this._previewStart;
        if (elapsed < 0) elapsed = 0;
        if (elapsed > this._previewTotal) { this._stopPreview(); return; }
        this._playheadTime = this._keptTimeToOrig(elapsed);
        this._draw();
        var tEl = this._overlay && this._overlay.querySelector('#acp-time');
        if (tEl) tEl.textContent = this._fmtTime(this._playheadTime) + ' / ' + this._fmtTime(this._duration);
        this._raf = requestAnimationFrame(function() { self._tickPlayhead(); });
    },

    // ===== 导出到画布 =====

    _exportToCanvas: function() {
        var self = this;
        if (!this._buffer) { this._setStatus(this.TEXTS.STATUS_EMPTY, true); return; }
        this._stopPreview();
        this._setStatus(this.TEXTS.STATUS_EXPORTING);

        try {
            var kept = this._getKeptSegments();
            var sr = this._buffer.sampleRate;
            var ch = this._buffer.numberOfChannels;
            var totalLen = 0;
            kept.forEach(function(s) { totalLen += Math.max(0, Math.round((s.end - s.start) * sr)); });
            if (totalLen < 1) { this._setStatus('没有可导出的内容', true); return; }

            var outBuf = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(ch, totalLen, sr);
            var dst = outBuf.createBuffer(ch, totalLen, sr);
            var offset = 0;
            for (var c = 0; c < ch; c++) {
                var srcCh = this._buffer.getChannelData(c);
                var dstCh = dst.getChannelData(c);
                for (var k = 0; k < kept.length; k++) {
                    var seg = kept[k];
                    var segLen = Math.round((seg.end - seg.start) * sr);
                    var srcOff = Math.round(seg.start * sr);
                    for (var i = 0; i < segLen; i++) {
                        dstCh[offset + i] = srcCh[srcOff + i];
                    }
                    offset += segLen;
                }
                offset = 0;
            }

            var wav = this._encodeWAV(dst);
            var baseName = (this._fileName || '音频').replace(/\.[^.]+$/, '');
            var outName = baseName + '_剪辑.wav';
            var file = new File([wav], outName, { type: 'audio/wav' });

            if (typeof CanvasImages !== 'undefined' && CanvasImages.placeAudio) {
                CanvasImages.placeAudio(file, null, null, '剪辑');
                this._setStatus(this.TEXTS.STATUS_EXPORTED + '（' + outName + '）');
                if (typeof showToast === 'function') showToast(this.TEXTS.STATUS_EXPORTED);
            } else {
                var a = document.createElement('a');
                a.href = URL.createObjectURL(wav);
                a.download = outName;
                a.click();
                this._setStatus(this.TEXTS.STATUS_EXPORTED + '（已下载）');
            }
        } catch (err) {
            this._setStatus(this.TEXTS.STATUS_EXPORT_FAIL + ': ' + (err && err.message ? err.message : err), true);
        }
    },

    _encodeWAV: function(buf) {
        var nc = buf.numberOfChannels, sr = buf.sampleRate, len = buf.length;
        var bs = 16, ba = nc * bs / 8, ds = len * ba, sz = 44 + ds;
        var ab = new ArrayBuffer(sz), v = new DataView(ab);
        var w = function(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
        w(0, 'RIFF'); v.setUint32(4, sz - 8, true); w(8, 'WAVE'); w(12, 'fmt ');
        v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nc, true);
        v.setUint32(24, sr, true); v.setUint32(28, sr * ba, true);
        v.setUint16(32, ba, true); v.setUint16(34, bs, true); w(36, 'data'); v.setUint32(40, ds, true);
        var o = 44;
        for (var i = 0; i < len; i++) {
            for (var c = 0; c < nc; c++) {
                var s = Math.max(-1, Math.min(1, buf.getChannelData(c)[i]));
                v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
                o += 2;
            }
        }
        return new Blob([ab], { type: 'audio/wav' });
    },

    // ===== 拖拽缩放 / 工具 =====

    _bindDrag: function(hdr, ov) {
        var self = this, dragging = false, startX, startY, startLeft, startTop;
        hdr.addEventListener('mousedown', function(e) {
            if (e.target.closest('.acp-help-btn,.acp-close-btn')) return;
            dragging = true;
            startX = e.clientX; startY = e.clientY;
            startLeft = ov.offsetLeft; startTop = ov.offsetTop;
            e.preventDefault();
        });
        this._onDocMove = function(e) {
            if (!dragging) return;
            ov.style.left = (startLeft + e.clientX - startX) + 'px';
            ov.style.top = (startTop + e.clientY - startY) + 'px';
        };
        this._onDocUp = function() { dragging = false; };
        document.addEventListener('mousemove', this._onDocMove);
        document.addEventListener('mouseup', this._onDocUp);
    },

    _setStatus: function(msg, isErr) {
        if (!this._overlay) return;
        var el = this._overlay.querySelector('#acp-status');
        if (!el) return;
        el.textContent = msg;
        el.className = 'acp-status' + (isErr ? ' err' : '');
    },

    _fmtTime: function(sec) {
        if (!sec || isNaN(sec)) return '0.00' + this.TEXTS.MSG_SECONDS;
        var m = Math.floor(sec / 60);
        var s = sec - m * 60;
        return (m > 0 ? m + ':' + (s < 10 ? '0' : '') : '') + s.toFixed(2) + this.TEXTS.MSG_SECONDS;
    },

    _destroy: function() {
        this._stopPreview();
        if (this._onDocMove) document.removeEventListener('mousemove', this._onDocMove);
        if (this._onDocUp) document.removeEventListener('mouseup', this._onDocUp);
        if (this._onWaveMove) document.removeEventListener('mousemove', this._onWaveMove);
        if (this._onWaveUp) document.removeEventListener('mouseup', this._onWaveUp);
        if (this._onCanvasClick) { document.removeEventListener('click', this._onCanvasClick, true); this._onCanvasClick = null; }
        this._clickBound = false;
        if (this._ro) { this._ro.disconnect(); this._ro = null; }
        if (this._overlay && this._overlay.parentNode) this._overlay.parentNode.removeChild(this._overlay);
        this._overlay = null;
        this._buffer = null;
        this._peaks = null;
        this._excluded = [];
        this._sel = null;
        if (typeof SkillSystem !== 'undefined') SkillSystem.deactivate();
    }
};
