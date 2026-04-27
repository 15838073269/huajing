/**
 * 图片调色技能
 * 从 v64/js/imgine3.js 改写为 v65 插件（简化版，去掉曲线/色轮/蒙版）
 *
 * 功能：
 *   - 图片上传（拖放或点击选择）
 *   - 色彩调整: temperature, tint, saturation
 *   - 明度调整: brightness, contrast, highlight, shadow
 *   - 效果: sharpen, clarity, grain, fade, vignette
 *   - HSL: hue, saturation, lightness
 *   - 左右对比预览
 *   - 重置参数
 *   - 下载调色后的图片
 */
var ImageColorSkill = {

    // ===== 基本信息 =====
    id: 'image-color',
    name: '图片调色',
    icon: '色',
    description: '色彩/明度/效果/HSL调整',
    key: '5',

    // ===== 内部状态 =====
    _world: null,
    _overlay: null,
    _originalImg: null,       // 原始 Image 对象
    _editedCanvas: null,      // 调色预览 Canvas
    _editedCtx: null,
    _originalCanvas: null,    // 原图对比 Canvas
    _originalCtx: null,
    _activeTab: 'color',      // 当前标签页

    // 调色参数
    _params: {
        // 色彩组
        temperature: 0,
        tint: 0,
        saturation: 0,
        // 明度组
        brightness: 0,
        contrast: 0,
        highlight: 0,
        shadow: 0,
        // 效果组
        sharpen: 0,
        clarity: 0,
        grain: 0,
        fade: 0,
        vignette: 0,
        // HSL组
        hue: 0,
        hslSaturation: 0,
        hslLightness: 0
    },

    // 标签页定义
    _tabs: [
        {
            id: 'color', name: '\u8272\u5F69', color: 'var(--cos-accent)',
            params: [
                { key: 'temperature', name: '\u8272\u6E29' },
                { key: 'tint', name: '\u8272\u8C03' },
                { key: 'saturation', name: '\u9971\u548C\u5EA6' }
            ]
        },
        {
            id: 'light', name: '\u660E\u5EA6', color: '#5B9BD5',
            params: [
                { key: 'brightness', name: '\u4EAE\u5EA6' },
                { key: 'contrast', name: '\u5BF9\u6BD4\u5EA6' },
                { key: 'highlight', name: '\u9AD8\u5149' },
                { key: 'shadow', name: '\u9634\u5F71' }
            ]
        },
        {
            id: 'effect', name: '\u6548\u679C', color: '#70C050',
            params: [
                { key: 'sharpen', name: '\u9510\u5316' },
                { key: 'clarity', name: '\u6E05\u6670' },
                { key: 'grain', name: '\u9897\u7C92' },
                { key: 'fade', name: '\u892A\u8272' },
                { key: 'vignette', name: '\u6697\u89D2' }
            ]
        },
        {
            id: 'hsl', name: 'HSL', color: '#C070D0',
            params: [
                { key: 'hue', name: '\u8272\u76F8' },
                { key: 'hslSaturation', name: '\u9971\u548C\u5EA6' },
                { key: 'hslLightness', name: '\u4EAE\u5EA6' }
            ]
        }
    ],

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
                label: '\u{1F504} \u91CD\u7F6E\u53C2\u6570',
                action: function() {
                    self._resetAllParams();
                }
            },
            {
                label: '\u{1F4BE} \u4E0B\u8F7D\u7ED3\u679C',
                action: function() {
                    self._downloadResult();
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
        return {};
    },

    load: function(data) {},

    // ===== 面板管理 =====

    _showPanel: function() {
        this._closePanel();
        var self = this;

        var ov = document.createElement('div');
        ov.className = 'cos-overlay';
        ov.style.cssText = 'width:96vw;max-width:1200px;max-height:90vh;left:50%;top:50%;transform:translate(-50%,-50%) scale(0.95);display:flex;flex-direction:column;';

        var header = document.createElement('div');
        header.className = 'cos-overlay-header';
        header.innerHTML = '<span>\u{1F3A8} \u56FE\u7247\u8C03\u8272</span><button class="cos-overlay-close">\u2715</button>';

        var body = document.createElement('div');
        body.className = 'cos-overlay-body';
        body.style.cssText = 'flex:1;overflow:hidden;padding:16px;display:flex;gap:16px;';

        // ===== 左侧：预览区 =====
        var leftPanel = document.createElement('div');
        leftPanel.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:12px;min-width:0;';

        // 上传区
        var uploadArea = document.createElement('div');
        uploadArea.id = 'ica-upload-area';
        uploadArea.style.cssText = 'border:2px dashed var(--cos-border);border-radius:12px;padding:32px;text-align:center;cursor:pointer;transition:all 0.3s;background:var(--cos-surface);flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;';
        uploadArea.innerHTML =
            '<div style="font-size:40px;margin-bottom:8px;">\u{1F3A8}</div>' +
            '<div style="color:var(--cos-text);font-size:14px;">\u62D6\u653E\u56FE\u7247\u5230\u8FD9\u91CC\uFF0C\u6216\u70B9\u51FB\u9009\u62E9\u6587\u4EF6</div>' +
            '<input type="file" id="ica-fileInput" accept="image/*" style="display:none;">';

        // 对比预览区（初始隐藏）
        var compareArea = document.createElement('div');
        compareArea.id = 'ica-compare-area';
        compareArea.style.cssText = 'display:none;flex:1;flex-direction:column;gap:12px;';
        compareArea.innerHTML =
            '<div style="display:flex;gap:12px;flex:1;min-height:0;">' +
                '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;background:rgba(0,0,0,0.2);border-radius:10px;padding:10px;overflow:hidden;">' +
                    '<div style="font-size:13px;font-weight:700;color:#5B9BD5;">\u539F\u56FE</div>' +
                    '<canvas id="ica-original-canvas" style="max-width:100%;max-height:100%;border-radius:6px;border:1px solid rgba(255,255,255,0.08);"></canvas>' +
                '</div>' +
                '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;background:rgba(0,0,0,0.2);border-radius:10px;padding:10px;overflow:hidden;">' +
                    '<div style="font-size:13px;font-weight:700;color:var(--cos-accent);">\u8C03\u8272</div>' +
                    '<canvas id="ica-edited-canvas" style="max-width:100%;max-height:100%;border-radius:6px;border:1px solid rgba(255,255,255,0.08);"></canvas>' +
                '</div>' +
            '</div>' +
            '<div style="display:flex;gap:10px;justify-content:center;flex-shrink:0;">' +
                '<button id="ica-reset-btn" class="ica-btn ica-btn-blue" style="padding:10px 24px;font-size:14px;">\u{1F504} \u91CD\u7F6E\u53C2\u6570</button>' +
                '<button id="ica-download-btn" class="ica-btn ica-btn-accent" style="padding:10px 24px;font-size:14px;">\u{1F4BE} \u4E0B\u8F7D\u8C03\u8272\u56FE</button>' +
                '<button id="ica-reupload-btn" class="ica-btn" style="padding:10px 20px;font-size:14px;">\u{1F504} \u91CD\u65B0\u4E0A\u4F20</button>' +
            '</div>';

        leftPanel.appendChild(uploadArea);
        leftPanel.appendChild(compareArea);

        // ===== 右侧：参数区 =====
        var rightPanel = document.createElement('div');
        rightPanel.style.cssText = 'width:300px;flex-shrink:0;display:flex;flex-direction:column;gap:0;background:var(--cos-surface);border-radius:10px;overflow:hidden;border:1px solid var(--cos-border);';

        // 标签页导航
        var tabNav = document.createElement('div');
        tabNav.style.cssText = 'display:flex;border-bottom:1px solid var(--cos-border);flex-shrink:0;';
        this._tabs.forEach(function(tab, i) {
            var btn = document.createElement('button');
            btn.className = 'ica-tab-btn' + (i === 0 ? ' ica-tab-active' : '');
            btn.dataset.tab = tab.id;
            btn.textContent = tab.name;
            btn.style.cssText = 'flex:1;padding:10px 4px;font-size:12px;font-weight:600;cursor:pointer;border:none;' +
                'background:' + (i === 0 ? tab.color : 'transparent') + ';' +
                'color:' + (i === 0 ? '#fff' : 'var(--cos-text-dim)') + ';' +
                'transition:all 0.2s;';
            tabNav.appendChild(btn);
        });

        // 标签页内容
        var tabContent = document.createElement('div');
        tabContent.style.cssText = 'flex:1;overflow-y:auto;padding:12px;';

        this._tabs.forEach(function(tab, i) {
            var pane = document.createElement('div');
            pane.className = 'ica-tab-pane';
            pane.dataset.tab = tab.id;
            pane.style.cssText = 'display:' + (i === 0 ? 'block' : 'none') + ';';

            tab.params.forEach(function(param) {
                var container = document.createElement('div');
                container.style.cssText = 'margin-bottom:14px;';

                var header = document.createElement('div');
                header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;';

                var nameSpan = document.createElement('span');
                nameSpan.textContent = param.name;
                nameSpan.style.cssText = 'font-size:13px;color:var(--cos-text);';

                var valueSpan = document.createElement('span');
                valueSpan.id = 'ica-val-' + param.key;
                valueSpan.textContent = '0';
                valueSpan.style.cssText = 'font-size:13px;font-weight:700;color:var(--cos-accent);min-width:30px;text-align:right;';

                var slider = document.createElement('input');
                slider.type = 'range';
                slider.id = 'ica-slider-' + param.key;
                slider.min = '-100';
                slider.max = '100';
                slider.value = '0';
                slider.dataset.param = param.key;
                slider.style.cssText = 'width:100%;height:6px;-webkit-appearance:none;appearance:none;background:rgba(255,255,255,0.15);border-radius:3px;outline:none;cursor:pointer;';

                header.appendChild(nameSpan);
                header.appendChild(valueSpan);
                container.appendChild(header);
                container.appendChild(slider);
                pane.appendChild(container);
            });

            tabContent.appendChild(pane);
        });

        rightPanel.appendChild(tabNav);
        rightPanel.appendChild(tabContent);

        body.appendChild(leftPanel);
        body.appendChild(rightPanel);

        ov.appendChild(header);
        ov.appendChild(body);
        document.body.appendChild(ov);

        requestAnimationFrame(function() {
            ov.classList.add('cos-overlay-visible');
            ov.style.transform = 'translate(-50%,-50%) scale(1)';
        });

        this._overlay = ov;

        // 保存 Canvas 引用
        this._originalCanvas = ov.querySelector('#ica-original-canvas');
        this._originalCtx = this._originalCanvas.getContext('2d');
        this._editedCanvas = ov.querySelector('#ica-edited-canvas');
        this._editedCtx = this._editedCanvas.getContext('2d');

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
        ov.querySelector('#ica-upload-area').addEventListener('click', function() {
            ov.querySelector('#ica-fileInput').click();
        });

        // 拖放
        var uploadArea = ov.querySelector('#ica-upload-area');
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
        ov.querySelector('#ica-fileInput').addEventListener('change', function(e) {
            if (e.target.files.length > 0) {
                self._loadImageFile(e.target.files[0]);
            }
        });

        // 重新上传
        ov.querySelector('#ica-reupload-btn').addEventListener('click', function() {
            ov.querySelector('#ica-fileInput').value = '';
            ov.querySelector('#ica-fileInput').click();
        });

        // 重置
        ov.querySelector('#ica-reset-btn').addEventListener('click', function() {
            self._resetAllParams();
        });

        // 下载
        ov.querySelector('#ica-download-btn').addEventListener('click', function() {
            self._downloadResult();
        });

        // 标签页切换
        ov.querySelectorAll('.ica-tab-btn').forEach(function(btn) {
            btn.addEventListener('click', function() {
                self._switchTab(btn.dataset.tab);
            });
        });

        // 滑块事件
        ov.querySelectorAll('input[type="range"][data-param]').forEach(function(slider) {
            slider.addEventListener('input', function(e) {
                var param = e.target.dataset.param;
                var value = parseInt(e.target.value);
                self._updateParam(param, value);
            });
        });
    },

    // ===== 标签页切换 =====

    _switchTab: function(tabId) {
        if (!this._overlay) return;
        this._activeTab = tabId;

        var self = this;
        this._overlay.querySelectorAll('.ica-tab-btn').forEach(function(btn) {
            var tab = self._tabs.find(function(t) { return t.id === btn.dataset.tab; });
            if (btn.dataset.tab === tabId) {
                btn.style.background = tab.color;
                btn.style.color = '#fff';
            } else {
                btn.style.background = 'transparent';
                btn.style.color = 'var(--cos-text-dim)';
            }
        });

        this._overlay.querySelectorAll('.ica-tab-pane').forEach(function(pane) {
            pane.style.display = pane.dataset.tab === tabId ? 'block' : 'none';
        });
    },

    // ===== 图片加载 =====

    _loadImageFile: function(file) {
        var self = this;
        var reader = new FileReader();
        reader.onload = function(e) {
            var img = new Image();
            img.onload = function() {
                self._originalImg = img;
                self._resetAllParams();
                self._drawOriginal();
                self._applyPreview();

                // 显示对比区，隐藏上传区
                self._overlay.querySelector('#ica-upload-area').style.display = 'none';
                self._overlay.querySelector('#ica-compare-area').style.display = 'flex';
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    },

    _drawOriginal: function() {
        if (!this._originalImg) return;
        var img = this._originalImg;

        // 计算合适的 Canvas 尺寸
        var maxW = 400, maxH = 500;
        var w = img.width, h = img.height;
        if (w > maxW || h > maxH) {
            var ratio = Math.min(maxW / w, maxH / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
        }

        this._originalCanvas.width = w;
        this._originalCanvas.height = h;
        this._editedCanvas.width = w;
        this._editedCanvas.height = h;

        this._originalCtx.drawImage(img, 0, 0, w, h);
        this._editedCtx.drawImage(img, 0, 0, w, h);
    },

    // ===== 参数更新 =====

    _updateParam: function(param, value) {
        this._params[param] = value;

        // 更新数值显示
        var valEl = this._overlay.querySelector('#ica-val-' + param);
        if (valEl) valEl.textContent = value;

        // 实时预览
        this._applyPreview();
    },

    _resetAllParams: function() {
        var self = this;
        var keys = Object.keys(this._params);
        keys.forEach(function(key) {
            self._params[key] = 0;
            var slider = self._overlay ? self._overlay.querySelector('#ica-slider-' + key) : null;
            if (slider) slider.value = 0;
            var valEl = self._overlay ? self._overlay.querySelector('#ica-val-' + key) : null;
            if (valEl) valEl.textContent = '0';
        });
        this._applyPreview();
        showToast('\u53C2\u6570\u5DF2\u91CD\u7F6E');
    },

    // ===== 核心：像素级调色处理 =====

    _applyPreview: function() {
        if (!this._originalImg || !this._editedCanvas) return;

        var p = this._params;
        var canvas = this._editedCanvas;
        var ctx = this._editedCtx;
        var w = canvas.width;
        var h = canvas.height;

        // 从原图绘制到临时 Canvas
        var tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        var tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(this._originalImg, 0, 0, w, h);

        var imageData = tempCtx.getImageData(0, 0, w, h);
        var data = imageData.data;

        // 预计算常量
        var tempFactor = p.temperature / 100;
        var tintFactor = p.tint / 100;
        var satFactor = p.saturation / 100;
        var brightFactor = p.brightness / 100;
        var contrastFactor = 1 + p.contrast / 100;
        var hlFactor = p.highlight / 100;
        var shFactor = p.shadow / 100;
        var sharpFactor = p.sharpen / 100;
        var clarityFactor = p.clarity / 100;
        var fadeFactor = p.fade / 100;
        var vigFactor = p.vignette / 100;
        var grainFactor = p.grain / 100;
        var hueShift = p.hue / 100;
        var hslSatFactor = p.hslSaturation / 100;
        var hslLightShift = p.hslLightness / 200;

        // 暗角预计算
        var centerX = w / 2;
        var centerY = h / 2;
        var maxDist = Math.sqrt(centerX * centerX + centerY * centerY);

        for (var i = 0; i < data.length; i += 4) {
            var r = data[i];
            var g = data[i + 1];
            var b = data[i + 2];

            // 1. 色温
            r = r + tempFactor * 20;
            b = b - tempFactor * 20;

            // 2. 色调
            g = g + tintFactor * 20;

            // 3. 饱和度
            var hsl = this._rgbToHsl(this._clamp(r), this._clamp(g), this._clamp(b));
            var adjS = Math.max(0, Math.min(1, hsl[1] * (1 + satFactor)));
            var rgb = this._hslToRgb(hsl[0], adjS, hsl[2]);
            r = rgb[0]; g = rgb[1]; b = rgb[2];

            // 4. 亮度
            r = r * (1 + brightFactor);
            g = g * (1 + brightFactor);
            b = b * (1 + brightFactor);

            // 5. 对比度
            r = ((r / 255 - 0.5) * contrastFactor + 0.5) * 255;
            g = ((g / 255 - 0.5) * contrastFactor + 0.5) * 255;
            b = ((b / 255 - 0.5) * contrastFactor + 0.5) * 255;

            // 6. 高光/阴影（需要当前亮度）
            hsl = this._rgbToHsl(this._clamp(r), this._clamp(g), this._clamp(b));
            var lum = hsl[2];
            if (lum > 0.7) {
                r += hlFactor * 30;
                g += hlFactor * 30;
                b += hlFactor * 30;
            }
            if (lum < 0.3) {
                r += shFactor * 30;
                g += shFactor * 30;
                b += shFactor * 30;
            }

            // 7. 清晰度
            var gray = (r + g + b) / 3;
            var diff = gray - (this._clamp(r) + this._clamp(g) + this._clamp(b)) / 3;
            r += diff * clarityFactor;
            g += diff * clarityFactor;
            b += diff * clarityFactor;

            // 8. 褪色
            r = r * (1 - fadeFactor) + 128 * fadeFactor;
            g = g * (1 - fadeFactor) + 128 * fadeFactor;
            b = b * (1 - fadeFactor) + 128 * fadeFactor;

            // 9. 暗角
            if (vigFactor > 0) {
                var px = (i / 4) % w;
                var py = Math.floor((i / 4) / w);
                var dist = Math.sqrt((px - centerX) * (px - centerX) + (py - centerY) * (py - centerY));
                var vig = 1 - (dist / maxDist) * vigFactor;
                r *= vig;
                g *= vig;
                b *= vig;
            }

            // 10. 颗粒
            if (grainFactor !== 0) {
                var noise = (Math.random() - 0.5) * grainFactor * 50;
                r += noise;
                g += noise;
                b += noise;
            }

            // 11. HSL 调整
            hsl = this._rgbToHsl(this._clamp(r), this._clamp(g), this._clamp(b));
            var adjH = hsl[0] + hueShift;
            adjH = ((adjH % 1) + 1) % 1;
            var adjHS = Math.max(0, Math.min(1, hsl[1] * (1 + hslSatFactor)));
            var adjL = Math.max(0, Math.min(1, hsl[2] + hslLightShift));
            rgb = this._hslToRgb(adjH, adjHS, adjL);
            r = rgb[0]; g = rgb[1]; b = rgb[2];

            // 12. 锐化（边缘增强）
            if (sharpFactor !== 0) {
                var px2 = (i / 4) % w;
                var py2 = Math.floor((i / 4) / w);
                if (px2 > 0 && py2 > 0 && px2 < w - 1 && py2 < h - 1) {
                    var neighbors =
                        data[(py2 - 1) * w * 4 + (px2 - 1) * 4] +
                        data[(py2 - 1) * w * 4 + px2 * 4] +
                        data[(py2 - 1) * w * 4 + (px2 + 1) * 4] +
                        data[py2 * w * 4 + (px2 - 1) * 4] +
                        data[py2 * w * 4 + (px2 + 1) * 4] +
                        data[(py2 + 1) * w * 4 + (px2 - 1) * 4] +
                        data[(py2 + 1) * w * 4 + px2 * 4] +
                        data[(py2 + 1) * w * 4 + (px2 + 1) * 4];
                    var avg = neighbors / 8;
                    r = r + (r - avg) * sharpFactor;
                    g = g + (g - avg) * sharpFactor;
                    b = b + (b - avg) * sharpFactor;
                }
            }

            data[i] = this._clamp(r);
            data[i + 1] = this._clamp(g);
            data[i + 2] = this._clamp(b);
        }

        tempCtx.putImageData(imageData, 0, 0);
        ctx.clearRect(0, 0, w, h);
        ctx.drawImage(tempCanvas, 0, 0);
    },

    // ===== 下载 =====

    _downloadResult: function() {
        if (!this._originalImg) {
            showToast('\u8BF7\u5148\u4E0A\u4F20\u56FE\u7247');
            return;
        }

        // 用原始尺寸生成最终结果
        var img = this._originalImg;
        var w = img.width;
        var h = img.height;

        var tempCanvas = document.createElement('canvas');
        tempCanvas.width = w;
        tempCanvas.height = h;
        var tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(img, 0, 0, w, h);

        var imageData = tempCtx.getImageData(0, 0, w, h);
        var data = imageData.data;
        var p = this._params;

        // 预计算常量（同 _applyPreview）
        var tempFactor = p.temperature / 100;
        var tintFactor = p.tint / 100;
        var satFactor = p.saturation / 100;
        var brightFactor = p.brightness / 100;
        var contrastFactor = 1 + p.contrast / 100;
        var hlFactor = p.highlight / 100;
        var shFactor = p.shadow / 100;
        var sharpFactor = p.sharpen / 100;
        var clarityFactor = p.clarity / 100;
        var fadeFactor = p.fade / 100;
        var vigFactor = p.vignette / 100;
        var grainFactor = p.grain / 100;
        var hueShift = p.hue / 100;
        var hslSatFactor = p.hslSaturation / 100;
        var hslLightShift = p.hslLightness / 200;
        var centerX = w / 2;
        var centerY = h / 2;
        var maxDist = Math.sqrt(centerX * centerX + centerY * centerY);
        var self = this;

        for (var i = 0; i < data.length; i += 4) {
            var r = data[i];
            var g = data[i + 1];
            var b = data[i + 2];

            r = r + tempFactor * 20;
            b = b - tempFactor * 20;
            g = g + tintFactor * 20;

            var hsl = self._rgbToHsl(self._clamp(r), self._clamp(g), self._clamp(b));
            var adjS = Math.max(0, Math.min(1, hsl[1] * (1 + satFactor)));
            var rgb = self._hslToRgb(hsl[0], adjS, hsl[2]);
            r = rgb[0]; g = rgb[1]; b = rgb[2];

            r = r * (1 + brightFactor);
            g = g * (1 + brightFactor);
            b = b * (1 + brightFactor);

            r = ((r / 255 - 0.5) * contrastFactor + 0.5) * 255;
            g = ((g / 255 - 0.5) * contrastFactor + 0.5) * 255;
            b = ((b / 255 - 0.5) * contrastFactor + 0.5) * 255;

            hsl = self._rgbToHsl(self._clamp(r), self._clamp(g), self._clamp(b));
            var lum = hsl[2];
            if (lum > 0.7) { r += hlFactor * 30; g += hlFactor * 30; b += hlFactor * 30; }
            if (lum < 0.3) { r += shFactor * 30; g += shFactor * 30; b += shFactor * 30; }

            var gray = (r + g + b) / 3;
            var diff = gray - (self._clamp(r) + self._clamp(g) + self._clamp(b)) / 3;
            r += diff * clarityFactor;
            g += diff * clarityFactor;
            b += diff * clarityFactor;

            r = r * (1 - fadeFactor) + 128 * fadeFactor;
            g = g * (1 - fadeFactor) + 128 * fadeFactor;
            b = b * (1 - fadeFactor) + 128 * fadeFactor;

            if (vigFactor > 0) {
                var px = (i / 4) % w;
                var py = Math.floor((i / 4) / w);
                var dist = Math.sqrt((px - centerX) * (px - centerX) + (py - centerY) * (py - centerY));
                var vig = 1 - (dist / maxDist) * vigFactor;
                r *= vig; g *= vig; b *= vig;
            }

            if (grainFactor !== 0) {
                var noise = (Math.random() - 0.5) * grainFactor * 50;
                r += noise; g += noise; b += noise;
            }

            hsl = self._rgbToHsl(self._clamp(r), self._clamp(g), self._clamp(b));
            var adjH = hsl[0] + hueShift;
            adjH = ((adjH % 1) + 1) % 1;
            var adjHS = Math.max(0, Math.min(1, hsl[1] * (1 + hslSatFactor)));
            var adjL = Math.max(0, Math.min(1, hsl[2] + hslLightShift));
            rgb = self._hslToRgb(adjH, adjHS, adjL);
            r = rgb[0]; g = rgb[1]; b = rgb[2];

            data[i] = self._clamp(r);
            data[i + 1] = self._clamp(g);
            data[i + 2] = self._clamp(b);
        }

        tempCtx.putImageData(imageData, 0, 0);

        var link = document.createElement('a');
        link.download = 'color_adjusted_' + Date.now() + '.png';
        link.href = tempCanvas.toDataURL('image/png');
        link.click();

        showToast('\u8C03\u8272\u56FE\u7247\u5DF2\u4E0B\u8F7D');
    },

    // ===== 颜色工具函数 =====

    _rgbToHsl: function(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        var max = Math.max(r, g, b);
        var min = Math.min(r, g, b);
        var h, s, l = (max + min) / 2;

        if (max === min) {
            h = s = 0;
        } else {
            var d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
            else if (max === g) h = (b - r) / d + 2;
            else h = (r - g) / d + 4;
            h /= 6;
        }
        return [h, s, l];
    },

    _hslToRgb: function(h, s, l) {
        var r, g, b;
        if (s === 0) {
            r = g = b = l;
        } else {
            function hue2rgb(p, q, t) {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            }
            var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            var p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
    },

    _clamp: function(v) {
        return Math.max(0, Math.min(255, Math.round(v)));
    }
};

/* 内联样式注入 */
(function() {
    var style = document.createElement('style');
    style.textContent =
        '.ica-btn {' +
            'padding:8px 20px;font-size:13px;border:none;border-radius:8px;cursor:pointer;' +
            'font-weight:600;color:#fff;transition:all 0.2s;pointer-events:auto;' +
            'background:var(--cos-surface);border:1px solid var(--cos-border);color:var(--cos-text);' +
        '}' +
        '.ica-btn:hover { transform:translateY(-1px);border-color:var(--cos-accent); }' +
        '.ica-btn-accent { background:var(--cos-accent);border:none;color:#fff; }' +
        '.ica-btn-accent:hover { filter:brightness(1.1); }' +
        '.ica-btn-blue { background:#5B9BD5;border:none;color:#fff; }' +
        '.ica-btn-blue:hover { filter:brightness(1.1); }' +
        /* 滑块样式 */
        'input[type="range"]::-webkit-slider-thumb {' +
            '-webkit-appearance:none;width:16px;height:16px;border-radius:50%;' +
            'background:var(--cos-accent);cursor:pointer;border:2px solid rgba(255,255,255,0.3);' +
            'box-shadow:0 1px 4px rgba(0,0,0,0.3);' +
        '}' +
        'input[type="range"]::-moz-range-thumb {' +
            'width:16px;height:16px;border-radius:50%;' +
            'background:var(--cos-accent);cursor:pointer;border:2px solid rgba(255,255,255,0.3);' +
            'box-shadow:0 1px 4px rgba(0,0,0,0.3);' +
        '}';
    document.head.appendChild(style);
})();
