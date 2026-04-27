/**
 * 图片直方图技能
 * 从 v64/js/imgine4.js 改写为 v65 插件
 *
 * 功能：
 *   - 图片上传（拖放或点击选择）
 *   - 灰度直方图
 *   - RGB 三通道直方图
 *   - 统计数据：均值、中位数、标准差、偏度
 *   - Canvas 绘制直方图
 */
var HistogramSkill = {

    // ===== 基本信息 =====
    id: 'histogram',
    name: '图片直方图',
    icon: '图',
    description: '灰度/RGB直方图+统计数据',
    key: '2',

    // ===== 内部状态 =====
    _world: null,
    _overlay: null,
    _originalImg: null,       // 原始 Image 对象
    _histCanvas: null,        // 直方图 Canvas
    _histCtx: null,
    _mode: 'grayscale',       // 当前模式: grayscale / rgb

    // ===== 生命周期 =====

    activate: function(world) {
        this._world = world;
        this._showPanel();
        SkillSystem.renderSubTools();
    },

    deactivate: function() {
        this._closePanel();
    },

    getSubTools: function() {
        var self = this;
        return [
            {
                label: '\u7070\u5EA6\u76F4\u65B9\u56FE',
                action: function() {
                    self._switchMode('grayscale');
                }
            },
            {
                label: 'RGB \u76F4\u65B9\u56FE',
                action: function() {
                    self._switchMode('rgb');
                }
            },
            {
                label: '\u5173\u95ED\u9762\u677F',
                action: function() {
                    self._closePanel();
                }
            }
        ];
    },

    save: function() {
        return { mode: this._mode };
    },

    load: function(data) {
        if (!data) return;
        if (data.mode) this._mode = data.mode;
    },

    // ===== 面板管理 =====

    _showPanel: function() {
        this._closePanel();
        var self = this;

        var ov = document.createElement('div');
        ov.className = 'cos-overlay';
        ov.style.cssText = 'width:680px;max-width:95vw;max-height:90vh;left:50%;top:50%;transform:translate(-50%,-50%) scale(0.95);display:flex;flex-direction:column;';

        // 头部
        var header = document.createElement('div');
        header.className = 'cos-overlay-header';
        header.innerHTML = '<span>\u{1F4CA} \u56FE\u7247\u76F4\u65B9\u56FE</span><button class="cos-overlay-close">\u2715</button>';

        // 主体
        var body = document.createElement('div');
        body.className = 'cos-overlay-body';
        body.style.cssText = 'flex:1;overflow:hidden;padding:16px;display:flex;flex-direction:column;gap:14px;';

        // 上传区
        var uploadArea = document.createElement('div');
        uploadArea.id = 'hist-upload-area';
        uploadArea.style.cssText = 'border:2px dashed var(--cos-border);border-radius:12px;padding:32px;text-align:center;cursor:pointer;transition:all 0.3s;background:var(--cos-surface);display:flex;flex-direction:column;align-items:center;justify-content:center;';
        uploadArea.innerHTML =
            '<div style="font-size:40px;margin-bottom:8px;">\u{1F4CA}</div>' +
            '<div style="color:var(--cos-text);font-size:14px;">\u62D6\u653E\u56FE\u7247\u5230\u8FD9\u91CC\uFF0C\u6216\u70B9\u51FB\u9009\u62E9\u6587\u4EF6</div>' +
            '<input type="file" id="hist-fileInput" accept="image/*" style="display:none;">';

        // 直方图区域（初始隐藏）
        var histArea = document.createElement('div');
        histArea.id = 'hist-area';
        histArea.style.cssText = 'display:none;flex-direction:column;gap:14px;';

        // 模式切换按钮
        var modeBar = document.createElement('div');
        modeBar.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-shrink:0;';

        var btnGray = document.createElement('button');
        btnGray.className = 'hist-mode-btn hist-mode-active';
        btnGray.dataset.mode = 'grayscale';
        btnGray.textContent = '\u7070\u5EA6';
        btnGray.style.cssText = 'padding:8px 20px;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;transition:all 0.2s;background:var(--cos-accent);color:#fff;';

        var btnRgb = document.createElement('button');
        btnRgb.className = 'hist-mode-btn';
        btnRgb.dataset.mode = 'rgb';
        btnRgb.textContent = 'RGB';
        btnRgb.style.cssText = 'padding:8px 20px;border:none;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;transition:all 0.2s;background:var(--cos-surface);color:var(--cos-text-dim);border:1px solid var(--cos-border);';

        modeBar.appendChild(btnGray);
        modeBar.appendChild(btnRgb);

        // 直方图 Canvas 容器
        var canvasWrap = document.createElement('div');
        canvasWrap.style.cssText = 'background:rgba(0,0,0,0.3);border-radius:10px;padding:12px;border:1px solid rgba(255,255,255,0.08);';

        var canvas = document.createElement('canvas');
        canvas.id = 'hist-canvas';
        canvas.width = 600;
        canvas.height = 200;
        canvas.style.cssText = 'width:100%;height:200px;border-radius:6px;';
        canvasWrap.appendChild(canvas);

        // 统计信息
        var statsBar = document.createElement('div');
        statsBar.id = 'hist-stats';
        statsBar.style.cssText = 'display:flex;justify-content:space-around;padding:10px 16px;background:rgba(0,0,0,0.2);border-radius:8px;font-size:13px;color:var(--cos-text);flex-shrink:0;';
        statsBar.innerHTML =
            '<div>\u5747\u503C: <span id="hist-mean" style="color:var(--cos-accent);font-weight:700;">-</span></div>' +
            '<div>\u4E2D\u4F4D\u6570: <span id="hist-median" style="color:var(--cos-accent);font-weight:700;">-</span></div>' +
            '<div>\u6807\u51C6\u5DEE: <span id="hist-stddev" style="color:var(--cos-accent);font-weight:700;">-</span></div>' +
            '<div>\u8303\u56F4: <span id="hist-range" style="color:var(--cos-accent);font-weight:700;">-</span></div>';

        // 重新上传按钮
        var reuploadBar = document.createElement('div');
        reuploadBar.style.cssText = 'display:flex;gap:10px;justify-content:center;flex-shrink:0;';
        reuploadBar.innerHTML =
            '<button id="hist-reupload-btn" class="hist-btn" style="padding:10px 24px;font-size:14px;">\u{1F504} \u91CD\u65B0\u4E0A\u4F20</button>';

        histArea.appendChild(modeBar);
        histArea.appendChild(canvasWrap);
        histArea.appendChild(statsBar);
        histArea.appendChild(reuploadBar);

        body.appendChild(uploadArea);
        body.appendChild(histArea);

        ov.appendChild(header);
        ov.appendChild(body);
        document.body.appendChild(ov);

        requestAnimationFrame(function() {
            ov.classList.add('cos-overlay-visible');
            ov.style.transform = 'translate(-50%,-50%) scale(1)';
        });

        this._overlay = ov;
        this._histCanvas = canvas;
        this._histCtx = canvas.getContext('2d');

        // 绑定事件
        this._bindEvents(ov);
    },

    _closePanel: function() {
        if (this._overlay) {
            this._overlay.classList.remove('cos-overlay-visible');
            var ov = this._overlay;
            setTimeout(function() { if (ov.parentNode) ov.remove(); }, 200);
            this._overlay = null;
        }
    },

    // ===== 事件绑定 =====

    _bindEvents: function(ov) {
        var self = this;

        // 关闭按钮
        ov.querySelector('.cos-overlay-close').addEventListener('click', function() {
            self._closePanel();
        });

        // 上传区点击
        ov.querySelector('#hist-upload-area').addEventListener('click', function() {
            ov.querySelector('#hist-fileInput').click();
        });

        // 拖放
        var uploadArea = ov.querySelector('#hist-upload-area');
        uploadArea.addEventListener('dragover', function(e) {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--cos-accent)';
            uploadArea.style.background = 'rgba(240,160,80,0.1)';
        });
        uploadArea.addEventListener('dragleave', function() {
            uploadArea.style.borderColor = 'var(--cos-border)';
            uploadArea.style.background = 'var(--cos-surface)';
        });
        uploadArea.addEventListener('drop', function(e) {
            e.preventDefault();
            uploadArea.style.borderColor = 'var(--cos-border)';
            uploadArea.style.background = 'var(--cos-surface)';
            var files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                self._loadImageFile(files[0]);
            }
        });

        // 文件选择
        ov.querySelector('#hist-fileInput').addEventListener('change', function(e) {
            if (e.target.files.length > 0) {
                self._loadImageFile(e.target.files[0]);
            }
        });

        // 重新上传
        ov.querySelector('#hist-reupload-btn').addEventListener('click', function() {
            ov.querySelector('#hist-fileInput').value = '';
            ov.querySelector('#hist-fileInput').click();
        });

        // 模式切换
        ov.querySelectorAll('.hist-mode-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                self._switchMode(btn.dataset.mode);
            });
        });
    },

    // ===== 模式切换 =====

    _switchMode: function(mode) {
        this._mode = mode;
        if (!this._overlay) return;

        var self = this;
        this._overlay.querySelectorAll('.hist-mode-btn').forEach(function(btn) {
            if (btn.dataset.mode === mode) {
                btn.style.background = 'var(--cos-accent)';
                btn.style.color = '#fff';
                btn.style.border = 'none';
                btn.classList.add('hist-mode-active');
            } else {
                btn.style.background = 'var(--cos-surface)';
                btn.style.color = 'var(--cos-text-dim)';
                btn.style.border = '1px solid var(--cos-border)';
                btn.classList.remove('hist-mode-active');
            }
        });

        // 如果已有图片，重新绘制
        if (this._originalImg) {
            this._drawHistogram();
        }
    },

    // ===== 图片加载 =====

    _loadImageFile: function(file) {
        var self = this;
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                self._originalImg = img;
                self._drawHistogram();

                // 显示直方图区，隐藏上传区
                self._overlay.querySelector('#hist-upload-area').style.display = 'none';
                self._overlay.querySelector('#hist-area').style.display = 'flex';
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    // ===== 核心：计算直方图数据 =====

    _calculateHistogram: function(imageData) {
        var data = imageData.data;
        var totalPixels = imageData.width * imageData.height;

        // 初始化直方图数组
        var histogram = {
            red: new Array(256).fill(0),
            green: new Array(256).fill(0),
            blue: new Array(256).fill(0),
            grayscale: new Array(256).fill(0)
        };

        // 计算直方图
        for (var i = 0; i < data.length; i += 4) {
            var r = data[i];
            var g = data[i + 1];
            var b = data[i + 2];

            // 灰度值（加权平均）
            var gray = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

            histogram.red[r]++;
            histogram.green[g]++;
            histogram.blue[b]++;
            histogram.grayscale[gray]++;
        }

        // 计算统计信息
        var stats = this._calculateStats(histogram.grayscale, totalPixels);

        return { histogram: histogram, stats: stats, totalPixels: totalPixels };
    },

    // ===== 计算统计信息 =====

    _calculateStats: function(grayscaleHistogram, totalPixels) {
        // 均值
        var sum = 0;
        var sumSquared = 0;
        for (var i = 0; i < 256; i++) {
            sum += i * grayscaleHistogram[i];
            sumSquared += i * i * grayscaleHistogram[i];
        }
        var mean = sum / totalPixels;

        // 标准差
        var variance = (sumSquared / totalPixels) - (mean * mean);
        var stdDev = Math.sqrt(Math.max(0, variance));

        // 中位数
        var cumulative = 0;
        var median = 0;
        var halfPixels = totalPixels / 2;
        for (var j = 0; j < 256; j++) {
            cumulative += grayscaleHistogram[j];
            if (cumulative >= halfPixels) {
                median = j;
                break;
            }
        }

        // 偏度（Skewness）
        var sumCubed = 0;
        for (var k = 0; k < 256; k++) {
            sumCubed += Math.pow(k - mean, 3) * grayscaleHistogram[k];
        }
        var skewness = stdDev > 0 ? (sumCubed / totalPixels) / Math.pow(stdDev, 3) : 0;

        // 最小值和最大值
        var min = 0;
        for (var m = 0; m < 256; m++) {
            if (grayscaleHistogram[m] > 0) { min = m; break; }
        }
        var max = 255;
        for (var n = 255; n >= 0; n--) {
            if (grayscaleHistogram[n] > 0) { max = n; break; }
        }

        return {
            mean: mean.toFixed(1),
            median: median.toFixed(0),
            stdDev: stdDev.toFixed(1),
            skewness: skewness.toFixed(2),
            min: min,
            max: max
        };
    },

    // ===== 绘制直方图 =====

    _drawHistogram: function() {
        if (!this._originalImg || !this._histCanvas) return;

        var img = this._originalImg;
        var canvas = this._histCanvas;
        var ctx = this._histCtx;

        // 将图片绘制到临时 Canvas 获取像素数据
        var tempCanvas = document.createElement('canvas');
        var maxW = 600, maxH = 400;
        var w = img.width, h = img.height;
        if (w > maxW || h > maxH) {
            var ratio = Math.min(maxW / w, maxH / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
        }
        tempCanvas.width = w;
        tempCanvas.height = h;
        var tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(img, 0, 0, w, h);

        var imageData = tempCtx.getImageData(0, 0, w, h);
        var result = this._calculateHistogram(imageData);
        var histogram = result.histogram;
        var stats = result.stats;

        // 清空画布
        var cw = canvas.width;
        var ch = canvas.height;
        ctx.clearRect(0, 0, cw, ch);

        // 填充背景
        ctx.fillStyle = 'rgba(20, 18, 24, 0.9)';
        ctx.fillRect(0, 0, cw, ch);

        var binWidth = cw / 256;
        var mode = this._mode;

        // 计算最大频率
        var maxFreq = 0;
        if (mode === 'grayscale') {
            maxFreq = Math.max.apply(null, histogram.grayscale);
        } else {
            maxFreq = Math.max(
                Math.max.apply(null, histogram.red),
                Math.max.apply(null, histogram.green),
                Math.max.apply(null, histogram.blue)
            );
        }
        if (maxFreq === 0) maxFreq = 1;

        // 绘制网格
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 0.5;

        // 水平网格线
        for (var gi = 0; gi <= 5; gi++) {
            var gy = ch - (gi / 5) * ch;
            ctx.beginPath();
            ctx.moveTo(0, gy);
            ctx.lineTo(cw, gy);
            ctx.stroke();
        }

        // 垂直网格线
        for (var gj = 0; gj <= 4; gj++) {
            var gx = (gj / 4) * cw;
            ctx.beginPath();
            ctx.moveTo(gx, 0);
            ctx.lineTo(gx, ch);
            ctx.stroke();
        }

        // 绘制直方图柱状
        if (mode === 'grayscale') {
            // 灰度直方图 - 暖白色渐变
            for (var si = 0; si < 256; si++) {
                var freq = histogram.grayscale[si];
                var barH = (freq / maxFreq) * ch * 0.9;
                var sx = si * binWidth;
                var sy = ch - barH;

                // 根据灰度值着色（暗到亮）
                var brightness = Math.round(si / 255 * 200 + 55);
                ctx.fillStyle = 'rgba(' + brightness + ', ' + Math.round(brightness * 0.9) + ', ' + Math.round(brightness * 0.7) + ', 0.85)';
                ctx.fillRect(sx, sy, Math.max(binWidth, 1), barH);
            }
        } else {
            // RGB 三通道直方图
            var channels = [
                { key: 'red', color: 'rgba(255, 80, 60, 0.55)' },
                { key: 'green', color: 'rgba(80, 220, 100, 0.55)' },
                { key: 'blue', color: 'rgba(80, 140, 255, 0.55)' }
            ];

            for (var ci = 0; ci < channels.length; ci++) {
                var channel = channels[ci];
                ctx.fillStyle = channel.color;
                var channelData = histogram[channel.key];
                for (var cj = 0; cj < 256; cj++) {
                    var cFreq = channelData[cj];
                    var cBarH = (cFreq / maxFreq) * ch * 0.9;
                    var cX = cj * binWidth;
                    var cY = ch - cBarH;
                    ctx.fillRect(cX, cY, Math.max(binWidth, 1), cBarH);
                }
            }
        }

        // 绘制坐标轴
        ctx.strokeStyle = 'rgba(255, 200, 150, 0.3)';
        ctx.lineWidth = 1;

        // X 轴
        ctx.beginPath();
        ctx.moveTo(0, ch - 1);
        ctx.lineTo(cw, ch - 1);
        ctx.stroke();

        // Y 轴
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, ch);
        ctx.stroke();

        // X 轴刻度标签
        ctx.fillStyle = 'rgba(255, 200, 150, 0.5)';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        for (var li = 0; li <= 4; li++) {
            var lx = (li / 4) * cw;
            var lval = Math.round((li / 4) * 255);
            ctx.fillText(lval, lx, ch - 4);
        }

        // 更新统计信息
        var meanEl = this._overlay.querySelector('#hist-mean');
        var medianEl = this._overlay.querySelector('#hist-median');
        var stddevEl = this._overlay.querySelector('#hist-stddev');
        var rangeEl = this._overlay.querySelector('#hist-range');

        if (meanEl) meanEl.textContent = stats.mean;
        if (medianEl) medianEl.textContent = stats.median;
        if (stddevEl) stddevEl.textContent = stats.stdDev;
        if (rangeEl) rangeEl.textContent = stats.min + ' - ' + stats.max;
    }
};

/* 内联样式注入 */
(function() {
    var style = document.createElement('style');
    style.textContent =
        '.hist-btn {' +
            'padding:8px 20px;font-size:13px;border:none;border-radius:8px;cursor:pointer;' +
            'font-weight:600;color:#fff;transition:all 0.2s;pointer-events:auto;' +
            'background:var(--cos-surface);border:1px solid var(--cos-border);color:var(--cos-text);' +
        '}' +
        '.hist-btn:hover { transform:translateY(-1px);border-color:var(--cos-accent); }' +
        '.hist-mode-btn:hover { filter:brightness(1.1); }';
    document.head.appendChild(style);
})();
