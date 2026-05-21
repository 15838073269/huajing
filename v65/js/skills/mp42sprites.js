/**
 * 视频转序列帧技能
 * 基于 v63/js/mp42sprites.js 改写为 v65 插件
 *
 * 功能：
 *   - 视频文件上传
 *   - 按帧提取（10fps）
 *   - 帧缩放控制
 *   - 帧选择/全选/清空
 *   - 选中帧缩放控制
 *   - 选中帧自由拖拽排序
 *   - 选中帧预览播放
 *   - 背景抠图模式
 *   - 下载序列图条
 *   - loading 遮罩
 *   - 切换插件保留面板
 */
var Mp42SpritesSkill = {

    // ===== 基本信息 =====
    id: 'mp42sprites',
    name: '视频序列帧',
    icon: '<span style="color:#ef4444;">帧</span>',
    description: '视频帧提取+预览+下载',
    key: '4',

    // ===== 内部状态 =====
    _world: null,
    _overlay: null,
    _frames: [],
    _selectedFrames: [],

    _hiddenVideo: null,
    _origPreviewCanvas: null,
    _origPreviewCtx: null,
    _procPreviewCanvas: null,
    _procPreviewCtx: null,
    _draggedItem: null,
    _draggedOrder: null,
    _frameZoom: 1,
    _selectedZoom: 1,

    // ===== 生命周期 =====

    activate: function(world) {
        this._world = world;
        if (this._overlay) {
            SkillSystem.renderSubTools();
            return;
        }
        this._createOverlay();
        SkillSystem.renderSubTools();
    },

    deactivate: function() {
        this._stopPreview();
        // 不隐藏窗口
    },

    getSubTools: function() {
        var self = this;
        return [
            { label: '全选/取消', action: function() { self._toggleSelectAll(); } }
        ];
    },

    save: function() { return {}; },
    load: function(data) {},

    // ===== 面板创建 =====

    _createOverlay: function() {
        var self = this;
        var ov = document.createElement('div');
        ov.className = 'ms-overlay';
        ov.setAttribute('data-skill-id', 'mp42sprites');
        ov.style.cssText = 'position:fixed;width:1200px;height:700px;z-index:9999;' +
            'background:#0f3460;color:#eee;display:flex;flex-direction:column;border-radius:10px;' +
            'box-shadow:0 8px 40px rgba(0,0,0,.6);overflow:hidden;user-select:none;resize:both;' +
            'min-width:800px;min-height:500px;' +
            'left:' + Math.max(20, (window.innerWidth - 1200) / 2) + 'px;' +
            'top:' + Math.max(20, (window.innerHeight - 700) / 2) + 'px;';

        // 主容器
        var panel = document.createElement('div');
        panel.className = 'ms-panel';

        // 标题栏
        var header = document.createElement('div');
        header.className = 'ms-header';
        header.innerHTML = '<h1>视频转序列图</h1><button class="ms-close-btn" id="msCloseBtn">关</button>';
        panel.appendChild(header);

        // 主体：2列2行 grid，左列播放器与右列内容对应行等高
        var body = document.createElement('div');
        body.className = 'ms-body';

        // ---- 第1行左列：原图帧播放器 ----
        var leftTop = document.createElement('div');
        leftTop.className = 'ms-grid-cell ms-left-top';
        leftTop.innerHTML =
            '<div class="ms-cell-header">原图帧播放' +
                '<button class="ms-sm-btn ms-btn-primary" id="msPlayOrigBtn" disabled>播放</button>' +
            '</div>' +
            '<div class="ms-cell-body">' +
                '<canvas class="ms-play-canvas" id="msOrigPreview"></canvas>' +
            '</div>';
        body.appendChild(leftTop);

        // ---- 第1行右列：上传 + 进度 + 帧信息 + 帧网格 ----
        var rightTop = document.createElement('div');
        rightTop.className = 'ms-grid-cell ms-right-top';
        rightTop.innerHTML =
            '<div id="msProgressWrap" class="ms-progress-wrap" style="display:none">' +
                '<div class="ms-progress-bar"><div class="ms-progress-fill" id="msProgressFill">0%</div></div>' +
            '</div>' +
            '<div class="ms-upload-area">' +
                '<input type="file" id="msVideoInput" accept="video/*" style="display:none;">' +
                '<button class="ms-upload-btn" id="msUploadBtn">上传视频</button>' +
            '</div>' +
            '<div class="ms-frames-info" id="msFramesInfo">请上传视频文件</div>' +
            '<div class="ms-frames-section" id="msFramesSection" style="display:none">' +
                '<div class="ms-section-header">' +
                    '<span class="ms-section-title">序列帧列表</span>' +
                    '<div class="ms-hdr-controls">' +
                        '<span class="ms-hdr-label">缩放</span>' +
                        '<input type="range" id="msFrameZoom" min="0.5" max="3" step="0.25" value="1" class="ms-hdr-slider">' +
                        '<span class="ms-hdr-val" id="msFrameZoomVal">1x</span>' +
                        '<button class="ms-sm-btn ms-btn-primary" id="msSelectAllBtn">全选</button>' +
                    '</div>' +
                '</div>' +
                '<div class="ms-frames-grid" id="msFramesGrid"></div>' +
            '</div>';
        body.appendChild(rightTop);

        // ---- 第2行右列：已选择的序列帧 ----
        var rightBottom = document.createElement('div');
        rightBottom.className = 'ms-grid-cell ms-right-bottom';
        rightBottom.innerHTML =
            '<div class="ms-selected-section" id="msSelectedSection">' +
                '<div class="ms-section-header">' +
                    '<div class="ms-hdr-left">' +
                        '<span class="ms-section-title">已选择的序列帧</span>' +
                        '<span class="ms-badge" id="msSelectedBadge">0 帧</span>' +
                    '</div>' +
                    '<div class="ms-hdr-controls">' +
                        '<span class="ms-hdr-label">缩放</span>' +
                        '<input type="range" id="msSelectedZoom" min="0.5" max="3" step="0.25" value="1" class="ms-hdr-slider">' +
                        '<span class="ms-hdr-val" id="msSelectedZoomVal">1x</span>' +
                        '<button class="ms-sm-btn ms-btn-warning" id="msClearBtn" disabled>清空</button>' +
                    '</div>' +
                '</div>' +
                '<div class="ms-select-toolbar" id="msSelectToolbar">' +
                    '<button class="ms-sm-btn ms-btn-outline" id="msOddBtn">奇数</button>' +
                    '<button class="ms-sm-btn ms-btn-outline" id="msEvenBtn">偶数</button>' +
                    '<button class="ms-sm-btn ms-btn-outline" id="msHalfBtn">二分</button>' +
                    '<span class="ms-tb-label">循环</span>' +
                    '<input type="number" class="ms-tb-input" id="msLoopInput" value="1" min="1">' +
                    '<button class="ms-sm-btn ms-btn-outline" id="msLoopBtn">提取</button>' +
                '</div>' +
                '<div class="ms-selected-container">' +
                    '<div class="ms-row-wrap">' +
                        '<div class="ms-selected-grid ms-selected-grid-single" id="msSelectedRow"></div>' +
                    '</div>' +
                '</div>' +
            '</div>';
        // ---- 第2行左列：已选帧播放器 ----
        var leftBottom = document.createElement('div');
        leftBottom.className = 'ms-grid-cell ms-left-bottom';
        leftBottom.innerHTML =
            '<div class="ms-cell-header">已选帧播放' +
                '<button class="ms-sm-btn ms-btn-primary" id="msPlayProcBtn" disabled>播放</button>' +
            '</div>' +
            '<div class="ms-cell-body">' +
                '<canvas class="ms-play-canvas" id="msProcPreview"></canvas>' +
            '</div>';
        body.appendChild(leftBottom);

        body.appendChild(rightBottom);

        panel.appendChild(body);

        // Loading 遮罩
        var loadingOverlay = document.createElement('div');
        loadingOverlay.className = 'ms-loading';
        loadingOverlay.id = 'msLoading';
        loadingOverlay.style.display = 'none';
        loadingOverlay.innerHTML =
            '<div class="ms-loading-content">' +
                '<div class="ms-spinner"></div>' +
                '<div class="ms-loading-text" id="msLoadingText">处理中...</div>' +
            '</div>';
        panel.appendChild(loadingOverlay);

        ov.appendChild(panel);
        document.body.appendChild(ov);

        // 使用通用窗口缩放（四角+四边）
        if (typeof SkillSystem !== 'undefined' && SkillSystem.WindowHelper) {
            WindowHelper.makeResizable(ov, { minWidth: 500, minHeight: 400, storeKey: 'ms-window-rect' });
        }

        this._overlay = ov;
        this._origPreviewCanvas = ov.querySelector('#msOrigPreview');
        this._origPreviewCtx = this._origPreviewCanvas.getContext('2d');
        this._procPreviewCanvas = ov.querySelector('#msProcPreview');
        this._procPreviewCtx = this._procPreviewCanvas.getContext('2d');

        // 隐藏 video
        this._hiddenVideo = document.createElement('video');
        this._hiddenVideo.style.display = 'none';
        this._hiddenVideo.muted = true;
        document.body.appendChild(this._hiddenVideo);

        // 绑定事件
        this._bindEvents();
    },

    // ===== 事件绑定 =====

    _bindEvents: function() {
        var self = this;
        var ov = this._overlay;

        // 关闭
        ov.querySelector('#msCloseBtn').addEventListener('click', function() {
            self._destroy();
            if (typeof SkillSystem !== 'undefined') SkillSystem.deactivate();
        });

        // 上传
        ov.querySelector('#msUploadBtn').addEventListener('click', function() {
            ov.querySelector('#msVideoInput').click();
        });
        ov.querySelector('#msVideoInput').addEventListener('change', function(e) {
            self._handleVideoUpload(e);
        });

        // 帧缩放
        ov.querySelector('#msFrameZoom').addEventListener('input', function(e) {
            self._frameZoom = parseFloat(e.target.value);
            ov.querySelector('#msFrameZoomVal').textContent = self._frameZoom + 'x';
            var baseSize = 150;
            var newSize = Math.round(baseSize * self._frameZoom);
            self._applyFrameItemSize(newSize);
        });

        // 选中帧缩放
        ov.querySelector('#msSelectedZoom').addEventListener('input', function(e) {
            self._selectedZoom = parseFloat(e.target.value);
            ov.querySelector('#msSelectedZoomVal').textContent = self._selectedZoom + 'x';
            self._renderSelectedFrames();
        });

        // 全选
        ov.querySelector('#msSelectAllBtn').addEventListener('click', function() {
            self._toggleSelectAll();
        });

        // 清空
        ov.querySelector('#msClearBtn').addEventListener('click', function() {
            self._clearSelection();
        });

        // 原图帧播放 → 播放全部帧
        ov.querySelector('#msPlayOrigBtn').addEventListener('click', function() {
            self._playAllFrames();
        });
        // 已选帧播放 → 播放已选帧
        ov.querySelector('#msPlayProcBtn').addEventListener('click', function() {
            self._playSelectedFrames();
        });

        // 快速提取
        ov.querySelector('#msOddBtn').addEventListener('click', function() {
            self._quickSelect('odd');
        });
        ov.querySelector('#msEvenBtn').addEventListener('click', function() {
            self._quickSelect('even');
        });
        ov.querySelector('#msHalfBtn').addEventListener('click', function() {
            self._quickSelect('half');
        });
        ov.querySelector('#msLoopBtn').addEventListener('click', function() {
            var n = parseInt(ov.querySelector('#msLoopInput').value) || 1;
            self._quickSelect('loop', n);
        });

        // 窗口拖拽
        var headerEl = ov.querySelector('.ms-header');
        var hDown = false, hStartX = 0, hStartY = 0, hLeft = 0, hTop = 0;
        headerEl.addEventListener('mousedown', function(e) {
            if (e.target.closest('.ms-close-btn')) return;
            hDown = true;
            hStartX = e.clientX;
            hStartY = e.clientY;
            hLeft = ov.offsetLeft;
            hTop = ov.offsetTop;
            e.preventDefault();
        });
        document.addEventListener('mousemove', function(e) {
            if (!hDown) return;
            ov.style.left = (hLeft + e.clientX - hStartX) + 'px';
            ov.style.top = (hTop + e.clientY - hStartY) + 'px';
        });
        document.addEventListener('mouseup', function() {
            hDown = false;
        });
    },

    // ===== 视频处理 =====

    _handleVideoUpload: function(e) {
        var self = this;
        var file = e.target.files[0];
        if (!file) return;

        this._frames = [];
        this._selectedFrames = [];
        this._stopPreview();
        // 清空左侧预览
        if (this._origPreviewCtx) {
            this._origPreviewCtx.clearRect(0, 0, this._origPreviewCanvas.width, this._origPreviewCanvas.height);
        }
        if (this._procPreviewCtx) {
            this._procPreviewCtx.clearRect(0, 0, this._procPreviewCanvas.width, this._procPreviewCanvas.height);
        }

        var progressWrap = this._overlay.querySelector('#msProgressWrap');
        var progressFill = this._overlay.querySelector('#msProgressFill');
        var framesGrid = this._overlay.querySelector('#msFramesGrid');
        var framesInfo = this._overlay.querySelector('#msFramesInfo');
        var framesSection = this._overlay.querySelector('#msFramesSection');

        framesGrid.innerHTML = '';

        progressWrap.style.display = 'block';
        progressFill.style.width = '0%';
        progressFill.textContent = '0%';
        framesInfo.textContent = '正在提取视频帧...';

        var url = URL.createObjectURL(file);
        this._hiddenVideo.src = url;

        var _captureMeta = null; // { fps, totalFrames, frameInterval, i }

        this._hiddenVideo.onloadedmetadata = function() {
            var duration = self._hiddenVideo.duration;
            if (!duration || !isFinite(duration)) { framesInfo.textContent = '无法读取视频时长'; return; }
            var fps = 10;
            var totalFrames = Math.floor(duration * fps);
            var frameInterval = 1 / fps;
            _captureMeta = { fps: fps, totalFrames: totalFrames, frameInterval: frameInterval, i: 0 };

            // 等视频真正解码出画面后再开始
            self._hiddenVideo.oncanplay = function() {
                self._hiddenVideo.oncanplay = null;
                _captureNext();
            };
            // 如果 canplay 已过，loadeddata 兜底
            self._hiddenVideo.onloadeddata = function() {
                self._hiddenVideo.onloadeddata = null;
                if (_captureMeta && _captureMeta.i === 0) {
                    self._hiddenVideo.oncanplay = null;
                    _captureNext();
                }
            };
        };

        function _captureNext() {
            var meta = _captureMeta;
            if (!meta || meta.i >= meta.totalFrames) {
                progressWrap.style.display = 'none';
                framesInfo.textContent = '共 ' + self._frames.length + ' 帧，已选择 0 帧';
                framesSection.style.display = 'block';
                self._applyFrameItemSize(150);
                self._updateButtons();
                _captureMeta = null;
                return;
            }

            var time = meta.i * meta.frameInterval;

            // 先绑定事件，再设 currentTime
            self._hiddenVideo.onseeked = function() {
                self._hiddenVideo.onseeked = null;
                // 等下一帧确保画面渲染完成
                requestAnimationFrame(function() {
                    var canvas = document.createElement('canvas');
                    canvas.width = self._hiddenVideo.videoWidth;
                    canvas.height = self._hiddenVideo.videoHeight;
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(self._hiddenVideo, 0, 0);

                    self._frames.push({
                        index: meta.i,
                        dataUrl: canvas.toDataURL('image/png'),
                        width: canvas.width,
                        height: canvas.height,
                        canvas: canvas
                    });

                    // 添加到网格
                    var frameItem = document.createElement('div');
                    frameItem.className = 'ms-frame-item';
                    frameItem.dataset.index = meta.i;
                    frameItem.innerHTML =
                        '<img src="' + self._frames[meta.i].dataUrl + '" draggable="false">' +
                        '<div class="ms-frame-number">' + (meta.i + 1) + '</div>' +
                        '<div class="ms-play-order"></div>' +
                        '<div class="ms-frame-check">\u2713</div>';

                    frameItem.addEventListener('click', (function(idx) {
                        return function() { self._toggleFrameSelection(idx); };
                    })(meta.i));

                    framesGrid.appendChild(frameItem);

                    meta.i++;
                    var progress = Math.round((meta.i / meta.totalFrames) * 100);
                    progressFill.style.width = progress + '%';
                    progressFill.textContent = progress + '%';
                    framesInfo.textContent = '正在提取帧... ' + meta.i + '/' + meta.totalFrames;

                    setTimeout(_captureNext, 0);
                });
            };

            // 触发 seek
            self._hiddenVideo.currentTime = time;

            // seeked 可能不触发时的兜底
            if (meta.i === 0 || self._hiddenVideo.currentTime === time) {
                setTimeout(function() {
                    if (self._hiddenVideo.onseeked) {
                        self._hiddenVideo.onseeked();
                    }
                }, 150);
            }
        }
    },

    // ===== 帧渲染辅助 =====

    _applyFrameItemSize: function(sizePx) {
        var grid = this._overlay.querySelector('#msFramesGrid');
        if (!grid) return;
        var items = grid.querySelectorAll('.ms-frame-item');
        items.forEach(function(item) {
            item.style.width = sizePx + 'px';
            item.style.height = sizePx + 'px';
            var img = item.querySelector('img');
            if (img) {
                img.style.width = (sizePx - 4) + 'px';
                img.style.height = (sizePx - 4) + 'px';
            }
        });
    },

    // ===== 帧选择 =====

    _toggleFrameSelection: function(index) {
        var framesGrid = this._overlay.querySelector('#msFramesGrid');
        var frameItem = framesGrid.children[index];
        var pos = this._selectedFrames.indexOf(index);

        if (pos !== -1) {
            this._selectedFrames.splice(pos, 1);
            frameItem.classList.remove('selected');
        } else {
            this._selectedFrames.push(index);
            frameItem.classList.add('selected');
        }

        this._updatePlayOrder();
        this._updateFramesInfo();
        this._updateButtons();
        this._renderSelectedFrames();
    },

    _quickSelect: function(mode, n) {
        if (!this._frames.length) return;
        this._clearSelectionNoRedraw();
        var total = this._frames.length;

        if (mode === 'odd') {
            // 奇数帧：第1,3,5帧… → 0-based索引 0,2,4…
            for (var i = 0; i < total; i += 2) this._selectedFrames.push(i);
        } else if (mode === 'even') {
            // 偶数帧：第2,4,6帧… → 0-based索引 1,3,5…
            for (var i = 1; i < total; i += 2) this._selectedFrames.push(i);
        } else if (mode === 'half') {
            // 二分法：逐级取中点，最多取到 1/8 精度
            var result = [0, total - 1];
            function addMidpoints(lo, hi, depth) {
                if (depth >= 3 || lo + 1 >= hi) return; // 最多3层
                var mid = Math.floor((lo + hi) / 2);
                if (result.indexOf(mid) >= 0) return;
                result.push(mid);
                addMidpoints(lo, mid, depth + 1);
                addMidpoints(mid, hi, depth + 1);
            }
            addMidpoints(0, total - 1, 0);
            result.sort(function(a, b) { return a - b; });
            this._selectedFrames = result;
        } else if (mode === 'loop') {
            n = Math.max(1, Math.floor(n));
            var count = Math.floor(total / n);
            for (var i = 0; i < count; i++) this._selectedFrames.push(i);
        }

        this._updateGridSelection();
        this._updatePlayOrder();
        this._updateFramesInfo();
        this._updateButtons();
        this._renderSelectedFrames();
    },

    _clearSelectionNoRedraw: function() {
        var framesGrid = this._overlay.querySelector('#msFramesGrid');
        this._selectedFrames.forEach(function(frameIndex) {
            var item = framesGrid.children[frameIndex];
            if (item) item.classList.remove('selected');
        });
        this._selectedFrames = [];
    },

    _updateGridSelection: function() {
        var framesGrid = this._overlay.querySelector('#msFramesGrid');
        this._selectedFrames.forEach(function(idx) {
            var item = framesGrid.children[idx];
            if (item) item.classList.add('selected');
        });
    },

    _toggleSelectAll: function() {
        var allSelected = this._selectedFrames.length === this._frames.length;

        if (allSelected) {
            this._selectedFrames = [];
        } else {
            this._selectedFrames = [];
            for (var i = 0; i < this._frames.length; i++) {
                this._selectedFrames.push(i);
            }
        }

        var framesGrid = this._overlay.querySelector('#msFramesGrid');
        Array.from(framesGrid.children).forEach(function(item) {
            if (allSelected) {
                item.classList.remove('selected');
            } else {
                item.classList.add('selected');
            }
        });

        this._updatePlayOrder();
        this._updateFramesInfo();
        this._updateButtons();
        this._renderSelectedFrames();
    },

    _clearSelection: function() {
        var framesGrid = this._overlay.querySelector('#msFramesGrid');
        this._selectedFrames.forEach(function(frameIndex) {
            var item = framesGrid.children[frameIndex];
            if (item) item.classList.remove('selected');
        });

        this._selectedFrames = [];
        this._updatePlayOrder();
        this._updateFramesInfo();
        this._updateButtons();
        this._renderSelectedFrames();
    },

    _updatePlayOrder: function() {
        var framesGrid = this._overlay.querySelector('#msFramesGrid');
        var self = this;
        this._selectedFrames.forEach(function(frameIndex, order) {
            var item = framesGrid.children[frameIndex];
            if (item) {
                var orderEl = item.querySelector('.ms-play-order');
                orderEl.textContent = order + 1;
            }
        });
    },

    _updateFramesInfo: function() {
        this._overlay.querySelector('#msFramesInfo').textContent =
            '共 ' + this._frames.length + ' 帧，已选择 ' + this._selectedFrames.length + ' 帧';
    },

    _updateButtons: function() {
        var has = this._selectedFrames.length > 0;
        var hasFrames = this._frames.length > 0;
        var ov = this._overlay;
        var origPlay = ov.querySelector('#msPlayOrigBtn');
        if (origPlay) origPlay.disabled = !hasFrames;
        var procPlay = ov.querySelector('#msPlayProcBtn');
        if (procPlay) procPlay.disabled = !has;
        var clearBtn = ov.querySelector('#msClearBtn');
        if (clearBtn) clearBtn.disabled = !has;
        // 快速提取按钮
        ['#msOddBtn','#msEvenBtn','#msHalfBtn','#msLoopBtn'].forEach(function(id) {
            var btn = ov.querySelector(id);
            if (btn) btn.disabled = !hasFrames;
        });
    },

    // ===== 选中帧预览 =====

    _renderSelectedFrames: function() {
        var self = this;
        var row = this._overlay.querySelector('#msSelectedRow');
        var badge = this._overlay.querySelector('#msSelectedBadge');

        badge.textContent = this._selectedFrames.length + ' 帧';
        row.innerHTML = '';

        this._selectedFrames.forEach(function(frameIndex, order) {
            var frame = self._frames[frameIndex];
            var item = document.createElement('div');
            item.className = 'ms-selected-item';
            item.draggable = true;
            item.dataset.order = order;

            var baseSize = 80;
            var size = Math.round(baseSize * self._selectedZoom);
            item.style.width = size + 'px';
            item.style.height = size + 'px';

            item.innerHTML =
                '<img src="' + frame.dataUrl + '" draggable="false">' +
                '<div class="ms-selected-order">' + (order + 1) + '</div>' +
                '<div class="ms-selected-remove">&times;</div>';

            // 移除
            item.querySelector('.ms-selected-remove').addEventListener('click', function(e) {
                e.stopPropagation();
                self._toggleFrameSelection(frameIndex);
            });

            // 拖拽（仅同一行内重排）
            item.addEventListener('dragstart', function(e) {
                self._draggedItem = item;
                self._draggedOrder = parseInt(item.dataset.order);
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', self._draggedOrder.toString());
            });
            item.addEventListener('dragend', function() {
                item.classList.remove('dragging');
                row.querySelectorAll('.ms-selected-item').forEach(function(el) {
                    el.classList.remove('drag-over');
                });
                row.classList.remove('drag-over');
                self._draggedItem = null;
                self._draggedOrder = null;
            });
            item.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (item !== self._draggedItem) item.classList.add('drag-over');
            });
            item.addEventListener('dragleave', function() {
                item.classList.remove('drag-over');
            });
            item.addEventListener('drop', function(e) {
                e.preventDefault();
                e.stopPropagation();
                item.classList.remove('drag-over');
                if (item === self._draggedItem) return;

                var targetOrder = parseInt(item.dataset.order);
                var draggedFrameIndex = self._selectedFrames[self._draggedOrder];
                self._selectedFrames.splice(self._draggedOrder, 1);
                var newTargetOrder = targetOrder > self._draggedOrder ? targetOrder - 1 : targetOrder;
                self._selectedFrames.splice(newTargetOrder, 0, draggedFrameIndex);
                self._updatePlayOrder();
                self._renderSelectedFrames();
            });

            row.appendChild(item);
        });
    },

    // ===== 播放预览 =====

    _playAllFrames: function() {
        if (this._frames.length === 0) return;
        this._stopCanvas(this._origPreviewCanvas);
        var allOrder = [];
        for (var i = 0; i < this._frames.length; i++) allOrder.push(i);
        this._startPlayback(this._origPreviewCanvas, this._origPreviewCtx, allOrder, false);
    },

    _playSelectedFrames: function() {
        if (this._selectedFrames.length === 0) return;
        this._stopCanvas(this._procPreviewCanvas);
        var selOrder = this._selectedFrames.slice();
        this._startPlayback(this._procPreviewCanvas, this._procPreviewCtx, selOrder, false);
    },

    _startPlayback: function(canvas, ctx, frameIndices, applyMatting) {
        if (frameIndices.length === 0) return;
        this._stopCanvas(canvas);

        var firstFrame = this._frames[frameIndices[0]];
        canvas.width = firstFrame.width;
        canvas.height = firstFrame.height;

        var self = this;
        var pending = frameIndices.length;

        function onImageReady() {
            pending--;
            if (pending > 0) return;
            canvas._playing = true;
            canvas._frameIdx = 0;
            var fps = 10;
            var frameDelay = 1000 / fps;

            function renderFrame() {
                if (!canvas._playing) return;
                var idx = frameIndices[canvas._frameIdx];
                var srcFrame = self._frames[idx];
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                if (applyMatting) {
                    self._removeBackground(srcFrame.canvas).then(function(resultCanvas) {
                        ctx.drawImage(resultCanvas, 0, 0);
                    });
                } else {
                    ctx.drawImage(srcFrame.canvas, 0, 0);
                }
                canvas._frameIdx = (canvas._frameIdx + 1) % frameIndices.length;
            }

            renderFrame();
            canvas._animId = setInterval(renderFrame, frameDelay);
        }

        for (var j = 0; j < frameIndices.length; j++) {
            var img = new Image();
            img.onload = onImageReady;
            img.onerror = onImageReady;
            img.src = this._frames[frameIndices[j]].dataUrl;
        }
    },

    _stopCanvas: function(canvas) {
        if (canvas && canvas._playing) {
            canvas._playing = false;
            if (canvas._animId) {
                clearInterval(canvas._animId);
                canvas._animId = null;
            }
        }
    },

    _stopPreview: function() {
        this._stopCanvas(this._origPreviewCanvas);
        this._stopCanvas(this._procPreviewCanvas);
    },

    // ===== 下载序列图 =====

    _downloadStrip: function(applyMatting) {
        var self = this;
        if (this._selectedFrames.length === 0) return;

        var mattingMode = applyMatting;
        this._showLoading(mattingMode ? '正在处理图像...' : '正在生成序列图...');

        var playOrder = this._selectedFrames.map(function(_, i) { return i; });

        var processedFrames = [];
        var idx = 0;

        function processNext() {
            if (idx >= playOrder.length) {
                self._hideLoading();
                var firstFrame = processedFrames[0];
                var stripCanvas = document.createElement('canvas');
                stripCanvas.width = firstFrame.width * processedFrames.length;
                stripCanvas.height = firstFrame.height;
                var stripCtx = stripCanvas.getContext('2d');
                processedFrames.forEach(function(canvas, i) {
                    stripCtx.drawImage(canvas, i * firstFrame.width, 0);
                });
                var stripDataURL = stripCanvas.toDataURL('image/png');
                var link = document.createElement('a');
                link.download = 'sequence_strip.png';
                link.href = stripDataURL;
                link.click();
                if (typeof CosCloudDrive !== 'undefined') {
                    CosCloudDrive.add('序列图 ' + new Date().toLocaleTimeString(), '视频抽帧', stripDataURL);
                }
                return;
            }

            var frame = self._frames[self._selectedFrames[playOrder[idx]]];
            self._overlay.querySelector('#msLoadingText').textContent = (mattingMode ? '正在处理图像' : '正在生成序列图') + ' (' + (idx + 1) + '/' + playOrder.length + ')';

            if (mattingMode) {
                self._removeBackground(frame.canvas).then(function(result) {
                    processedFrames.push(result);
                    idx++;
                    setTimeout(processNext, 0);
                });
            } else {
                processedFrames.push(frame.canvas);
                idx++;
                setTimeout(processNext, 0);
            }
        }

        setTimeout(processNext, 100);
    },

    // ===== 背景抠图 =====

    _removeBackground: function(sourceCanvas) {
        return new Promise(function(resolve) {
            var canvas = document.createElement('canvas');
            canvas.width = sourceCanvas.width;
            canvas.height = sourceCanvas.height;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(sourceCanvas, 0, 0);
            var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            var data = imageData.data;
            var bgColor = _detectBackgroundColor(data, canvas.width, canvas.height);
            var tolerance = 50;
            var edgeTolerance = 30;

            for (var i = 0; i < data.length; i += 4) {
                var r = data[i], g = data[i + 1], b = data[i + 2];
                var dist = Math.sqrt(Math.pow(r - bgColor.r, 2) + Math.pow(g - bgColor.g, 2) + Math.pow(b - bgColor.b, 2));
                if (dist < tolerance) {
                    data[i + 3] = 0;
                } else if (dist < tolerance + edgeTolerance) {
                    var alpha = Math.round(((dist - tolerance) / edgeTolerance) * 255);
                    data[i + 3] = alpha;
                    var blend = alpha / 255;
                    data[i] = Math.round(bgColor.r + (r - bgColor.r) * blend);
                    data[i + 1] = Math.round(bgColor.g + (g - bgColor.g) * blend);
                    data[i + 2] = Math.round(bgColor.b + (b - bgColor.b) * blend);
                }
            }

            ctx.putImageData(imageData, 0, 0);
            resolve(canvas);
        });
    },

    // ===== Loading =====

    _showLoading: function(text) {
        var loading = this._overlay.querySelector('#msLoading');
        this._overlay.querySelector('#msLoadingText').textContent = text || '处理中...';
        loading.style.display = 'flex';
    },

    _hideLoading: function() {
        this._overlay.querySelector('#msLoading').style.display = 'none';
    },

    // ===== 销毁（关闭按钮调用） =====

    _destroy: function() {
        this._stopPreview();
        if (this._hiddenVideo) {
            this._hiddenVideo.pause();
            this._hiddenVideo.src = '';
            if (this._hiddenVideo.parentNode) this._hiddenVideo.parentNode.removeChild(this._hiddenVideo);
            this._hiddenVideo = null;
        }
        if (this._overlay && this._overlay.parentNode) {
            this._overlay.parentNode.removeChild(this._overlay);
        }
        this._overlay = null;
        this._frames = [];
        this._selectedFrames = [];
        this._origPreviewCanvas = null;
        this._origPreviewCtx = null;
        this._procPreviewCanvas = null;
        this._procPreviewCtx = null;
    }
};

/**
 * 检测背景色（四角采样）
 */
function _detectBackgroundColor(data, width, height) {
    var sampleSize = 50;
    var colors = [];
    var regions = [
        { x0: 0, y0: 0, x1: sampleSize, y1: sampleSize },
        { x0: width - sampleSize, y0: 0, x1: width, y1: sampleSize },
        { x0: 0, y0: height - sampleSize, x1: sampleSize, y1: height },
        { x0: width - sampleSize, y0: height - sampleSize, x1: width, y1: height }
    ];
    regions.forEach(function(reg) {
        for (var x = reg.x0; x < reg.x1; x++) {
            for (var y = reg.y0; y < reg.y1; y++) {
                var i = (y * width + x) * 4;
                colors.push({ r: data[i], g: data[i + 1], b: data[i + 2] });
            }
        }
    });
    var avgR = Math.round(colors.reduce(function(s, c) { return s + c.r; }, 0) / colors.length);
    var avgG = Math.round(colors.reduce(function(s, c) { return s + c.g; }, 0) / colors.length);
    var avgB = Math.round(colors.reduce(function(s, c) { return s + c.b; }, 0) / colors.length);
    return { r: avgR, g: avgG, b: avgB };
}

/* ===== 内联样式 ===== */
(function() {
    var s = document.createElement('style');
    s.textContent =
        /* 面板 */
        '.ms-overlay { font-family:"Segoe UI",system-ui,sans-serif; }' +
        '.ms-panel { width:100%;height:100%;background:rgba(15,25,50,0.95);color:#e8edf5;' +
            'overflow:hidden;display:flex;flex-direction:column; }' +
        '.ms-header { display:flex;justify-content:space-between;align-items:center;padding:10px 20px;' +
            'background:rgba(20,35,70,0.8);border-bottom:1px solid rgba(100,160,255,0.15);flex-shrink:0;cursor:move;user-select:none; }' +
        '.ms-header h1 { margin:0;font-size:16px;background:linear-gradient(135deg,#38bdf8,#7dd3fc);' +
            '-webkit-background-clip:text;-webkit-text-fill-color:transparent; }' +
        '.ms-close-btn { padding:5px 14px;background:rgba(220,80,60,.2);border:1px solid rgba(220,80,60,.3);' +
            'color:#e87060;border-radius:8px;cursor:pointer;font-size:13px;transition:all .15s; }' +
        '.ms-close-btn:hover { background:rgba(220,80,60,.4); }' +
        '.ms-close-btn:active { transform:scale(0.92); }' +

        /* 主体：2列2行 grid */
        '.ms-body { display:grid;grid-template-columns:280px 1fr;grid-template-rows:1fr 1fr;flex:1;overflow:hidden; }' +
        '.ms-grid-cell { overflow-y:auto;padding:12px;display:flex;flex-direction:column; }' +
        '.ms-left-top { grid-column:1;grid-row:1;background:rgba(20,35,70,0.6);border-right:1px solid rgba(100,160,255,0.15);' +
            'border-bottom:1px solid rgba(100,160,255,0.08); }' +
        '.ms-left-bottom { grid-column:1;grid-row:2;background:rgba(20,35,70,0.6);border-right:1px solid rgba(100,160,255,0.15); }' +
        '.ms-right-top { grid-column:2;grid-row:1;background:rgba(255,255,255,.02);border-bottom:1px solid rgba(100,160,255,0.08); }' +
        '.ms-right-bottom { grid-column:2;grid-row:2;background:rgba(255,255,255,.02); }' +

        /* 左列播放器 */
        '.ms-cell-header { font-size:11px;font-weight:700;color:#94a3b8;letter-spacing:1px;' +
            'display:flex;align-items:center;justify-content:space-between;flex-shrink:0;padding-bottom:8px;' +
            'border-bottom:1px solid rgba(100,160,255,0.08);margin-bottom:8px; }' +
        '.ms-cell-header::before { content:"";width:3px;height:12px;background:#38bdf8;border-radius:2px;' +
            'margin-right:8px; }' +
        '.ms-cell-body { flex:1;min-height:0;display:flex;align-items:center;justify-content:center;' +
            'background:rgba(0,0,0,.3);border-radius:8px;overflow:hidden; }' +
        '.ms-play-canvas { max-width:100%;max-height:100%;object-fit:contain; }' +

        /* 上传区域 */
        '.ms-upload-area { margin-bottom:10px;text-align:center;flex-shrink:0; }' +
        '.ms-upload-btn { padding:10px 28px;border:none;border-radius:10px;cursor:pointer;' +
            'font-size:14px;font-weight:700;color:#fff;background:linear-gradient(135deg,#38bdf8,#0ea5e9);' +
            'box-shadow:0 4px 14px rgba(56,189,248,.25);transition:all .15s; }' +
        '.ms-upload-btn:hover { transform:translateY(-2px);box-shadow:0 6px 20px rgba(56,189,248,.35); }' +
        '.ms-upload-btn:active { transform:scale(0.95); }' +
        '.ms-btn-primary { background:#38bdf8; }' +
        '.ms-btn-primary:hover:not(:disabled) { background:#0ea5e9; }' +

        /* 右列 */
        '.ms-right-top { gap:6px; }' +
        '.ms-right-bottom { gap:6px; }' +

        /* 进度条 */
        '.ms-progress-wrap { margin-bottom:14px; }' +
        '.ms-progress-bar { width:100%;height:22px;background:rgba(0,0,0,.3);border-radius:8px;overflow:hidden; }' +
        '.ms-progress-fill { height:100%;background:linear-gradient(90deg,#38bdf8,#7dd3fc);width:0%;' +
            'transition:width .3s;display:flex;align-items:center;justify-content:center;color:#fff;' +
            'font-size:11px;font-weight:700;min-width:40px; }' +

        /* 帧信息 */
        '.ms-frames-info { padding:8px 12px;font-size:12px;color:#94a3b8;background:rgba(0,0,0,.2);border-radius:8px;' +
            'margin-bottom:14px;border:1px solid rgba(100,160,255,0.15); }' +

        /* 区块 */
        '.ms-frames-section,.ms-selected-section { margin-bottom:16px;' +
            'padding:14px;background:rgba(255,255,255,.02);border-radius:10px;border:1px dashed rgba(100,160,255,0.2); }' +
        '.ms-section-header { display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px; }' +
        '.ms-section-title { font-size:13px;color:#e8edf5;font-weight:700; }' +
        '.ms-badge { background:#38bdf8;color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700; }' +
        '.ms-sm-btn { padding:5px 12px;border:none;border-radius:8px;cursor:pointer;font-size:12px;' +
            'font-weight:600;color:#fff;transition:all .15s;white-space:nowrap; }' +
        '.ms-sm-btn:hover { transform:translateY(-1px); }' +
        '.ms-sm-btn:active { transform:scale(0.92); }' +
        '.ms-sm-btn:disabled { opacity:.35;cursor:default;transform:none; }' +
        '.ms-sm-btn.ms-btn-primary { background:#38bdf8; }' +
        '.ms-sm-btn.ms-btn-primary:hover:not(:disabled) { background:#0ea5e9; }' +
        '.ms-sm-btn.ms-btn-warning { background:#f59e0b; }' +
        '.ms-sm-btn.ms-btn-warning:hover:not(:disabled) { background:#d97706; }' +
        '.ms-sm-btn.ms-btn-success { background:#10b981; }' +
        '.ms-sm-btn.ms-btn-success:hover:not(:disabled) { background:#059669; }' +
        '.ms-sm-btn.ms-btn-outline { background:transparent;border:1px solid rgba(100,160,255,0.25);color:#94a3b8; }' +
        '.ms-sm-btn.ms-btn-outline:hover:not(:disabled) { border-color:#38bdf8;color:#38bdf8; }' +
        '.ms-select-toolbar { display:flex;align-items:center;gap:6px;padding:6px 0;flex-shrink:0;flex-wrap:wrap; }' +
        '.ms-tb-label { font-size:11px;color:#64748b;white-space:nowrap;margin-left:4px; }' +
        '.ms-tb-input { width:48px;padding:3px 6px;background:rgba(0,0,0,.3);border:1px solid rgba(100,160,255,0.15);' +
            'border-radius:6px;color:#e2e8f0;font-size:12px;text-align:center;outline:none; }' +
        '.ms-tb-input:focus { border-color:rgba(56,189,248,.4); }' +
        '.ms-hdr-left { display:flex;align-items:center;gap:8px; }' +
        '.ms-hdr-controls { display:flex;align-items:center;gap:8px;flex-shrink:0; }' +
        '.ms-hdr-label { font-size:11px;color:#64748b;white-space:nowrap; }' +
        '.ms-hdr-slider { width:80px;height:3px;-webkit-appearance:none;appearance:none;' +
            'background:rgba(56,189,248,0.15);border-radius:2px;outline:none;cursor:pointer; }' +
        '.ms-hdr-slider::-webkit-slider-thumb { -webkit-appearance:none;appearance:none;' +
            'width:10px;height:10px;border-radius:50%;background:#38bdf8;border:none;cursor:pointer; }' +
        '.ms-hdr-val { font-size:10px;color:#94a3b8;min-width:20px;text-align:center; }' +
        '.ms-hdr-checkbox { display:inline-flex;align-items:center;gap:4px;font-size:11px;color:#94a3b8;cursor:pointer; }' +
        '.ms-hdr-checkbox input[type="checkbox"] { accent-color:#38bdf8; }' +

        /* 帧网格 — 横向滚动 */
        '.ms-frames-grid { display:flex;gap:8px;padding:10px;background:rgba(0,0,0,.2);' +
            'border-radius:10px;border:1px solid rgba(100,160,255,0.15);overflow-x:auto;overflow-y:hidden;min-height:170px;flex-shrink:0; }' +
        '.ms-frame-item { position:relative;cursor:pointer;border-radius:8px;overflow:hidden;' +
            'transition:all .15s;border:2px solid transparent;flex-shrink:0; }' +
        '.ms-frame-item:hover { transform:scale(1.03);box-shadow:0 4px 12px rgba(0,0,0,.3); }' +
        '.ms-frame-item.selected { border-color:#38bdf8;box-shadow:0 0 12px rgba(56,189,248,.4); }' +
        '.ms-frame-item img { display:block;object-fit:cover;border-radius:6px; }' +
        '.ms-frame-number { position:absolute;top:3px;left:3px;background:rgba(0,0,0,.7);color:#fff;' +
            'padding:1px 5px;border-radius:3px;font-size:10px;font-weight:700; }' +
        '.ms-play-order { position:absolute;top:3px;right:26px;background:rgba(56,189,248,.9);color:#fff;' +
            'padding:1px 5px;border-radius:3px;font-size:10px;font-weight:700;display:none;min-width:16px;text-align:center; }' +
        '.ms-frame-item.selected .ms-play-order { display:block; }' +
        '.ms-frame-check { position:absolute;top:3px;right:3px;width:20px;height:20px;background:#38bdf8;' +
            'border-radius:50%;display:none;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:11px; }' +
        '.ms-frame-item.selected .ms-frame-check { display:flex; }' +

        /* 选中帧 */
        '.ms-selected-container { display:flex;flex-direction:column;gap:10px; }' +
        '.ms-row-wrap { display:flex;align-items:flex-start; }' +
        '.ms-selected-grid { display:flex;flex-wrap:wrap;gap:6px;min-height:50px;padding:8px;background:rgba(0,0,0,.2);' +
            'border-radius:8px;border:1px dashed rgba(100,160,255,0.2);flex:1;transition:all .15s; }' +
        '.ms-selected-grid-single { display:flex;flex-wrap:nowrap;gap:6px;overflow-x:auto;overflow-y:hidden;' +
            'min-height:100px;align-items:flex-start;padding:8px; }' +
        '.ms-selected-grid.drag-over { border-color:#38bdf8;background:rgba(56,189,248,.08); }' +
        '.ms-selected-item { position:relative;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.3);' +
            'transition:all .15s;cursor:grab;flex-shrink:0; }' +
        '.ms-selected-item:active { cursor:grabbing; }' +
        '.ms-selected-item.dragging { opacity:.5;transform:scale(1.1);box-shadow:0 6px 20px rgba(56,189,248,.4); }' +
        '.ms-selected-item.drag-over { border:2px dashed #38bdf8; }' +
        '.ms-selected-item:hover { transform:scale(1.08);box-shadow:0 4px 12px rgba(56,189,248,.3); }' +
        '.ms-selected-item img { width:100%;height:100%;object-fit:cover; }' +
        '.ms-selected-order { position:absolute;top:2px;left:2px;background:rgba(56,189,248,.9);color:#fff;' +
            'padding:1px 4px;border-radius:3px;font-size:9px;font-weight:700; }' +
        '.ms-selected-remove { position:absolute;top:2px;right:2px;width:14px;height:14px;background:rgba(220,80,60,.8);' +
            'color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:11px;' +
            'cursor:pointer;opacity:0;transition:opacity .15s; }' +
        '.ms-selected-item:hover .ms-selected-remove { opacity:1; }' +



        /* Loading */
        '.ms-loading { position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.6);' +
            'display:flex;justify-content:center;align-items:center;z-index:10; }' +
        '.ms-loading-content { background:rgba(20,35,70,0.9);padding:30px 40px;border-radius:14px;text-align:center;border:1px solid rgba(100,160,255,0.15); }' +
        '.ms-spinner { width:36px;height:36px;border:3px solid rgba(56,189,248,0.2);border-top:3px solid #38bdf8;' +
            'border-radius:50%;animation:ms-spin 1s linear infinite;margin:0 auto 14px; }' +
        '@keyframes ms-spin { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }' +
        '.ms-loading-text { font-size:13px;color:#94a3b8; }' +

        /* 滚动条 */
        '.ms-grid-cell::-webkit-scrollbar-track, .ms-frames-grid::-webkit-scrollbar-track, .ms-selected-grid-single::-webkit-scrollbar-track { background:transparent; }' +
        '.ms-grid-cell::-webkit-scrollbar-thumb, .ms-frames-grid::-webkit-scrollbar-thumb, .ms-selected-grid-single::-webkit-scrollbar-thumb { background:rgba(56,189,248,0.2);border-radius:3px; }' +

        /* 隐藏 file input */
        '.ms-overlay input[type="file"] { display:none; }';
    document.head.appendChild(s);
})();
