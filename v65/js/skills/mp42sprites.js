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
 *   - 选中帧上行/下行分组（拖拽）
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
    _frameRows: [],
    _isPlaying: false,
    _animationId: null,
    _currentFrameIndex: 0,
    _hiddenVideo: null,
    _previewCanvas: null,
    _previewCtx: null,
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
            { label: '全选/取消', action: function() { self._toggleSelectAll(); } },
            { label: '播放选中', action: function() { self._playSelectedFrames(); } },
            { label: '下载序列图', action: function() { self._downloadStrip(); } }
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

        // 主体：左右布局
        var body = document.createElement('div');
        body.className = 'ms-body';

        // === 左侧工具栏 ===
        var sidebar = document.createElement('div');
        sidebar.className = 'ms-sidebar';
        sidebar.innerHTML =
            '<div class="ms-sidebar-section">' +
                '<div class="ms-sidebar-title">上传</div>' +
                '<input type="file" id="msVideoInput" accept="video/*" style="display:none;">' +
                '<button class="ms-sidebar-btn ms-btn-primary" id="msUploadBtn">上传视频</button>' +
            '</div>' +
            '<div class="ms-sidebar-section">' +
                '<div class="ms-sidebar-title">帧缩放</div>' +
                '<input type="range" id="msFrameZoom" min="0.5" max="3" step="0.25" value="1" class="ms-slider">' +
                '<div class="ms-slider-label"><span id="msFrameZoomVal">1x</span></div>' +
            '</div>' +
            '<div class="ms-sidebar-section">' +
                '<div class="ms-sidebar-title">选中帧缩放</div>' +
                '<input type="range" id="msSelectedZoom" min="0.5" max="3" step="0.25" value="1" class="ms-slider">' +
                '<div class="ms-slider-label"><span id="msSelectedZoomVal">1x</span></div>' +
            '</div>' +
            '<div class="ms-sidebar-section">' +
                '<div class="ms-sidebar-title">操作</div>' +
                '<button class="ms-sidebar-btn ms-btn-warning" id="msClearBtn" disabled>清空选择</button>' +
                '<button class="ms-sidebar-btn ms-btn-primary" id="msPlayBtn" disabled>播放选中</button>' +
            '</div>' +
            '<div class="ms-sidebar-section">' +
                '<div class="ms-sidebar-title">导出</div>' +
                '<label class="ms-checkbox-label">' +
                    '<input type="checkbox" id="msMattingMode" checked> 背景抠图' +
                '</label>' +
                '<button class="ms-sidebar-btn ms-btn-success" id="msDownloadBtn" disabled>下载序列图</button>' +
            '</div>';
        body.appendChild(sidebar);

        // === 右侧内容区 ===
        var main = document.createElement('div');
        main.className = 'ms-main';

        // 进度条
        var progressWrap = document.createElement('div');
        progressWrap.className = 'ms-progress-wrap';
        progressWrap.id = 'msProgressWrap';
        progressWrap.style.display = 'none';
        progressWrap.innerHTML =
            '<div class="ms-progress-bar"><div class="ms-progress-fill" id="msProgressFill">0%</div></div>';
        main.appendChild(progressWrap);

        // 帧信息
        var framesInfo = document.createElement('div');
        framesInfo.className = 'ms-frames-info';
        framesInfo.id = 'msFramesInfo';
        framesInfo.textContent = '请上传视频文件';
        main.appendChild(framesInfo);

        // 帧网格区域
        var framesSection = document.createElement('div');
        framesSection.className = 'ms-frames-section';
        framesSection.id = 'msFramesSection';
        framesSection.style.display = 'none';

        var framesHeader = document.createElement('div');
        framesHeader.className = 'ms-section-header';
        framesHeader.innerHTML =
            '<div><span class="ms-section-title">序列帧列表</span></div>' +
            '<div class="ms-section-actions">' +
                '<button class="ms-sm-btn ms-btn-primary" id="msSelectAllBtn">全选</button>' +
            '</div>';
        framesSection.appendChild(framesHeader);

        var framesGrid = document.createElement('div');
        framesGrid.className = 'ms-frames-grid';
        framesGrid.id = 'msFramesGrid';
        framesSection.appendChild(framesGrid);

        main.appendChild(framesSection);

        // 选中帧区域
        var selectedSection = document.createElement('div');
        selectedSection.className = 'ms-selected-section';
        selectedSection.id = 'msSelectedSection';
        selectedSection.style.display = 'none';

        var selectedHeader = document.createElement('div');
        selectedHeader.className = 'ms-section-header';
        selectedHeader.innerHTML =
            '<div><span class="ms-section-title">已选择的序列帧</span> ' +
                '<span class="ms-badge" id="msSelectedBadge">0 帧</span></div>';
        selectedSection.appendChild(selectedHeader);

        var selectedContainer = document.createElement('div');
        selectedContainer.className = 'ms-selected-container';

        // 上行
        var row1Wrap = document.createElement('div');
        row1Wrap.className = 'ms-row-wrap';
        row1Wrap.innerHTML = '<div class="ms-row-label">上行</div>';
        var row1 = document.createElement('div');
        row1.className = 'ms-selected-grid';
        row1.id = 'msSelectedRow1';
        row1Wrap.appendChild(row1);
        selectedContainer.appendChild(row1Wrap);

        // 下行
        var row2Wrap = document.createElement('div');
        row2Wrap.className = 'ms-row-wrap';
        row2Wrap.innerHTML = '<div class="ms-row-label">下行</div>';
        var row2 = document.createElement('div');
        row2.className = 'ms-selected-grid';
        row2.id = 'msSelectedRow2';
        row2Wrap.appendChild(row2);
        selectedContainer.appendChild(row2Wrap);

        selectedSection.appendChild(selectedContainer);
        main.appendChild(selectedSection);

        // 预览区域
        var previewSection = document.createElement('div');
        previewSection.className = 'ms-preview-section';
        previewSection.id = 'msPreviewSection';
        previewSection.style.display = 'none';

        var previewHeader = document.createElement('div');
        previewHeader.className = 'ms-section-header';
        previewHeader.innerHTML = '<span class="ms-section-title">预览播放</span>';
        previewSection.appendChild(previewHeader);

        var previewContainer = document.createElement('div');
        previewContainer.className = 'ms-preview-container';
        var previewCanvas = document.createElement('canvas');
        previewCanvas.className = 'ms-preview-canvas';
        previewCanvas.id = 'msPreviewCanvas';
        previewContainer.appendChild(previewCanvas);
        previewSection.appendChild(previewContainer);

        main.appendChild(previewSection);

        body.appendChild(main);
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
        this._previewCanvas = previewCanvas;
        this._previewCtx = previewCanvas.getContext('2d');

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
            ov.querySelector('#msFramesGrid').style.gridTemplateColumns =
                'repeat(auto-fill, minmax(' + newSize + 'px, 1fr))';
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

        // 播放
        ov.querySelector('#msPlayBtn').addEventListener('click', function() {
            self._playSelectedFrames();
        });

        // 下载
        ov.querySelector('#msDownloadBtn').addEventListener('click', function() {
            self._downloadStrip();
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
        this._frameRows = [];
        this._stopPreview();

        var progressWrap = this._overlay.querySelector('#msProgressWrap');
        var progressFill = this._overlay.querySelector('#msProgressFill');
        var framesGrid = this._overlay.querySelector('#msFramesGrid');
        var framesInfo = this._overlay.querySelector('#msFramesInfo');
        var framesSection = this._overlay.querySelector('#msFramesSection');
        var selectedSection = this._overlay.querySelector('#msSelectedSection');
        var previewSection = this._overlay.querySelector('#msPreviewSection');

        framesGrid.innerHTML = '';
        selectedSection.style.display = 'none';
        previewSection.style.display = 'none';

        progressWrap.style.display = 'block';
        progressFill.style.width = '0%';
        progressFill.textContent = '0%';
        framesInfo.textContent = '正在提取视频帧...';

        var url = URL.createObjectURL(file);
        this._hiddenVideo.src = url;

        this._hiddenVideo.onloadedmetadata = function() {
            var duration = self._hiddenVideo.duration;
            var fps = 10;
            var totalFrames = Math.floor(duration * fps);
            var frameInterval = 1 / fps;
            var i = 0;

            function captureNext() {
                if (i >= totalFrames) {
                    progressWrap.style.display = 'none';
                    framesInfo.textContent = '共 ' + self._frames.length + ' 帧，已选择 0 帧';
                    framesSection.style.display = 'block';
                    self._updateButtons();
                    return;
                }

                var time = i * frameInterval;
                self._hiddenVideo.currentTime = time;

                self._hiddenVideo.onseeked = function() {
                    var canvas = document.createElement('canvas');
                    canvas.width = self._hiddenVideo.videoWidth;
                    canvas.height = self._hiddenVideo.videoHeight;
                    var ctx = canvas.getContext('2d');
                    ctx.drawImage(self._hiddenVideo, 0, 0);

                    self._frames.push({
                        index: i,
                        dataUrl: canvas.toDataURL('image/png'),
                        width: canvas.width,
                        height: canvas.height,
                        canvas: canvas
                    });

                    // 添加到网格
                    var frameItem = document.createElement('div');
                    frameItem.className = 'ms-frame-item';
                    frameItem.dataset.index = i;
                    frameItem.innerHTML =
                        '<img src="' + self._frames[i].dataUrl + '" draggable="false">' +
                        '<div class="ms-frame-number">' + (i + 1) + '</div>' +
                        '<div class="ms-play-order"></div>' +
                        '<div class="ms-frame-check">\u2713</div>';

                    frameItem.addEventListener('click', (function(idx) {
                        return function() { self._toggleFrameSelection(idx); };
                    })(i));

                    framesGrid.appendChild(frameItem);

                    i++;
                    var progress = Math.round((i / totalFrames) * 100);
                    progressFill.style.width = progress + '%';
                    progressFill.textContent = progress + '%';
                    framesInfo.textContent = '正在提取帧... ' + i + '/' + totalFrames;

                    setTimeout(captureNext, 0);
                };
            }

            captureNext();
        };
    },

    // ===== 帧选择 =====

    _toggleFrameSelection: function(index) {
        var framesGrid = this._overlay.querySelector('#msFramesGrid');
        var frameItem = framesGrid.children[index];
        var pos = this._selectedFrames.indexOf(index);

        if (pos !== -1) {
            this._selectedFrames.splice(pos, 1);
            this._frameRows.splice(pos, 1);
            frameItem.classList.remove('selected');

            if (this._selectedFrames.length === 0) {
                this._stopPreview();
                this._overlay.querySelector('#msPreviewSection').style.display = 'none';
            }
        } else {
            this._selectedFrames.push(index);
            this._frameRows.push(1);
            frameItem.classList.add('selected');
        }

        this._updatePlayOrder();
        this._updateFramesInfo();
        this._updateButtons();
        this._renderSelectedFrames();
    },

    _toggleSelectAll: function() {
        var allSelected = this._selectedFrames.length === this._frames.length;

        if (allSelected) {
            this._selectedFrames = [];
            this._frameRows = [];
        } else {
            this._selectedFrames = [];
            this._frameRows = [];
            for (var i = 0; i < this._frames.length; i++) {
                this._selectedFrames.push(i);
                this._frameRows.push(1);
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
        this._stopPreview();
        this._overlay.querySelector('#msPreviewSection').style.display = 'none';

        var framesGrid = this._overlay.querySelector('#msFramesGrid');
        this._selectedFrames.forEach(function(frameIndex) {
            var item = framesGrid.children[frameIndex];
            if (item) item.classList.remove('selected');
        });

        this._selectedFrames = [];
        this._frameRows = [];
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
        this._overlay.querySelector('#msPlayBtn').disabled = !has;
        this._overlay.querySelector('#msDownloadBtn').disabled = !has;
        this._overlay.querySelector('#msClearBtn').disabled = !has;
    },

    // ===== 选中帧预览 =====

    _renderSelectedFrames: function() {
        var self = this;
        var selectedSection = this._overlay.querySelector('#msSelectedSection');
        var row1 = this._overlay.querySelector('#msSelectedRow1');
        var row2 = this._overlay.querySelector('#msSelectedRow2');
        var badge = this._overlay.querySelector('#msSelectedBadge');

        if (this._selectedFrames.length === 0) {
            selectedSection.style.display = 'none';
            return;
        }

        selectedSection.style.display = 'block';
        badge.textContent = this._selectedFrames.length + ' 帧';
        row1.innerHTML = '';
        row2.innerHTML = '';

        this._selectedFrames.forEach(function(frameIndex, order) {
            var frame = self._frames[frameIndex];
            var item = document.createElement('div');
            item.className = 'ms-selected-item';
            item.draggable = true;
            item.dataset.order = order;
            item.dataset.row = self._frameRows[order] || 1;

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

            // 拖拽
            item.addEventListener('dragstart', function(e) {
                self._draggedItem = item;
                self._draggedOrder = parseInt(item.dataset.order);
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', self._draggedOrder.toString());
            });
            item.addEventListener('dragend', function() {
                item.classList.remove('dragging');
                document.querySelectorAll('.ms-selected-item').forEach(function(el) {
                    el.classList.remove('drag-over');
                });
                row1.classList.remove('drag-over');
                row2.classList.remove('drag-over');
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
                var draggedRow = self._frameRows[self._draggedOrder];
                var targetRow = self._frameRows[targetOrder];

                if (draggedRow === targetRow) {
                    var draggedFrameIndex = self._selectedFrames[self._draggedOrder];
                    var draggedFrameRow = self._frameRows[self._draggedOrder];
                    self._selectedFrames.splice(self._draggedOrder, 1);
                    self._frameRows.splice(self._draggedOrder, 1);
                    var newTargetOrder = targetOrder > self._draggedOrder ? targetOrder - 1 : targetOrder;
                    self._selectedFrames.splice(newTargetOrder, 0, draggedFrameIndex);
                    self._frameRows.splice(newTargetOrder, 0, draggedFrameRow);
                    self._updatePlayOrder();
                    self._renderSelectedFrames();
                } else {
                    self._frameRows[self._draggedOrder] = targetRow;
                    self._renderSelectedFrames();
                }
            });

            var row = self._frameRows[order] || 1;
            if (row === 1) {
                row1.appendChild(item);
            } else {
                row2.appendChild(item);
            }
        });

        // 行拖放区域
        this._setupRowDropZones(row1, row2);
    },

    _setupRowDropZones: function(row1, row2) {
        var self = this;
        function setupZone(el, row) {
            el.ondragover = function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                el.classList.add('drag-over');
            };
            el.ondragleave = function() {
                el.classList.remove('drag-over');
            };
            el.ondrop = function(e) {
                e.preventDefault();
                el.classList.remove('drag-over');
                var draggedOrder = parseInt(e.dataTransfer.getData('text/plain'));
                if (!isNaN(draggedOrder) && self._frameRows[draggedOrder] !== undefined) {
                    self._frameRows[draggedOrder] = row;
                    self._updatePlayOrder();
                    self._renderSelectedFrames();
                }
            };
        }
        setupZone(row1, 1);
        setupZone(row2, 2);
    },

    // ===== 播放预览 =====

    _playSelectedFrames: function() {
        if (this._selectedFrames.length === 0) return;
        this._stopPreview();

        var previewSection = this._overlay.querySelector('#msPreviewSection');
        previewSection.style.display = 'block';
        previewSection.scrollIntoView({ behavior: 'smooth' });

        var firstFrame = this._frames[this._selectedFrames[0]];
        this._previewCanvas.width = firstFrame.width;
        this._previewCanvas.height = firstFrame.height;

        // 构建播放顺序：先 row1，再 row2
        var playOrder = [];
        for (var i = 0; i < this._selectedFrames.length; i++) {
            if (this._frameRows[i] === 1) playOrder.push(i);
        }
        for (var i = 0; i < this._selectedFrames.length; i++) {
            if (this._frameRows[i] === 2) playOrder.push(i);
        }

        var loadedImages = [];
        for (var j = 0; j < playOrder.length; j++) {
            var img = new Image();
            img.src = this._frames[this._selectedFrames[playOrder[j]]].dataUrl;
            loadedImages.push(img);
        }

        var self = this;
        this._isPlaying = true;
        this._currentFrameIndex = 0;

        var fps = 10;
        var frameDelay = 1000 / fps;

        function renderFrame() {
            if (!self._isPlaying) return;
            var img = loadedImages[self._currentFrameIndex];
            if (img.complete) {
                self._previewCtx.clearRect(0, 0, self._previewCanvas.width, self._previewCanvas.height);
                self._previewCtx.drawImage(img, 0, 0);
            }
            self._currentFrameIndex = (self._currentFrameIndex + 1) % playOrder.length;
        }

        renderFrame();
        this._animationId = setInterval(renderFrame, frameDelay);
    },

    _stopPreview: function() {
        if (this._isPlaying) {
            this._isPlaying = false;
            if (this._animationId) {
                clearInterval(this._animationId);
                this._animationId = null;
            }
        }
    },

    // ===== 下载序列图 =====

    _downloadStrip: function() {
        var self = this;
        if (this._selectedFrames.length === 0) return;

        var mattingMode = this._overlay.querySelector('#msMattingMode').checked;

        this._showLoading(mattingMode ? '正在处理图像...' : '正在生成序列图...');

        var playOrder = [];
        for (var i = 0; i < this._selectedFrames.length; i++) {
            if (this._frameRows[i] === 1) playOrder.push(i);
        }
        for (var i = 0; i < this._selectedFrames.length; i++) {
            if (this._frameRows[i] === 2) playOrder.push(i);
        }

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
        this._frameRows = [];
        this._previewCanvas = null;
        this._previewCtx = null;
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

        /* 主体 */
        '.ms-body { display:flex;flex:1;overflow:hidden; }' +

        /* 左侧工具栏 */
        '.ms-sidebar { width:200px;flex-shrink:0;background:rgba(20,35,70,0.6);border-right:1px solid rgba(100,160,255,0.15);' +
            'padding:12px;overflow-y:auto;display:flex;flex-direction:column;gap:14px; }' +
        '.ms-sidebar-section { display:flex;flex-direction:column;gap:6px; }' +
        '.ms-sidebar-title { font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;' +
            'margin-bottom:2px;display:flex;align-items:center;gap:6px; }' +
        '.ms-sidebar-title::before { content:"";width:3px;height:12px;background:#38bdf8;border-radius:2px; }' +
        '.ms-sidebar-btn { padding:8px 14px;border:none;border-radius:8px;cursor:pointer;' +
            'font-size:13px;font-weight:600;color:#fff;transition:all .15s;text-align:center; }' +
        '.ms-sidebar-btn:hover:not(:disabled) { transform:translateY(-1px);box-shadow:0 4px 12px rgba(0,0,0,.3); }' +
        '.ms-sidebar-btn:active:not(:disabled) { transform:scale(0.92); }' +
        '.ms-sidebar-btn:disabled { opacity:.35;cursor:not-allowed;transform:none; }' +
        '.ms-btn-primary { background:#38bdf8; }' +
        '.ms-btn-primary:hover:not(:disabled) { background:#0ea5e9; }' +
        '.ms-btn-success { background:linear-gradient(135deg,#11998e,#38ef7d); }' +
        '.ms-btn-warning { background:rgba(255,255,255,.08);color:#e8edf5;border:1px solid rgba(100,160,255,0.15); }' +
        '.ms-btn-warning:hover:not(:disabled) { background:rgba(255,255,255,.12); }' +
        '.ms-slider { width:100%;cursor:pointer;accent-color:#38bdf8; }' +
        '.ms-slider-label { font-size:12px;color:#94a3b8;text-align:center; }' +
        '.ms-checkbox-label { display:flex;align-items:center;gap:6px;font-size:13px;color:#cbd5e1;cursor:pointer; }' +
        '.ms-checkbox-label input { width:16px;height:16px;accent-color:#38bdf8; }' +

        /* 右侧内容 */
        '.ms-main { flex:1;overflow-y:auto;padding:16px;background:rgba(255,255,255,.02); }' +

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
        '.ms-frames-section,.ms-selected-section,.ms-preview-section { margin-bottom:16px;' +
            'padding:14px;background:rgba(255,255,255,.02);border-radius:10px;border:1px dashed rgba(100,160,255,0.2); }' +
        '.ms-section-header { display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px; }' +
        '.ms-section-title { font-size:13px;color:#e8edf5;font-weight:700; }' +
        '.ms-badge { background:#38bdf8;color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:700; }' +
        '.ms-sm-btn { padding:5px 12px;border:none;border-radius:8px;cursor:pointer;font-size:12px;' +
            'font-weight:600;color:#fff;transition:all .15s; }' +
        '.ms-sm-btn:hover { transform:translateY(-1px); }' +
        '.ms-sm-btn:active { transform:scale(0.92); }' +

        /* 帧网格 */
        '.ms-frames-grid { display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;' +
            'max-height:400px;overflow-y:auto;padding:10px;background:rgba(0,0,0,.2);border-radius:10px;border:1px solid rgba(100,160,255,0.15); }' +
        '.ms-frame-item { position:relative;cursor:pointer;border-radius:8px;overflow:hidden;' +
            'transition:all .15s;border:2px solid transparent; }' +
        '.ms-frame-item:hover { transform:scale(1.03);box-shadow:0 4px 12px rgba(0,0,0,.3); }' +
        '.ms-frame-item.selected { border-color:#38bdf8;box-shadow:0 0 12px rgba(56,189,248,.4); }' +
        '.ms-frame-item img { width:100%;height:auto;display:block; }' +
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
        '.ms-row-wrap { display:flex;align-items:flex-start;gap:8px; }' +
        '.ms-row-label { background:#38bdf8;color:#fff;padding:5px 8px;border-radius:6px;font-weight:700;font-size:12px;' +
            'min-width:40px;text-align:center;flex-shrink:0; }' +
        '.ms-selected-grid { display:flex;flex-wrap:wrap;gap:6px;min-height:50px;padding:8px;background:rgba(0,0,0,.2);' +
            'border-radius:8px;border:1px dashed rgba(100,160,255,0.2);flex:1;transition:all .15s; }' +
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

        /* 预览 */
        '.ms-preview-container { display:flex;justify-content:center;align-items:center;min-height:200px;' +
            'background:rgba(0,0,0,.4);border-radius:8px;overflow:hidden; }' +
        '.ms-preview-canvas { max-width:100%;max-height:500px; }' +

        /* Loading */
        '.ms-loading { position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.6);' +
            'display:flex;justify-content:center;align-items:center;z-index:10; }' +
        '.ms-loading-content { background:rgba(20,35,70,0.9);padding:30px 40px;border-radius:14px;text-align:center;border:1px solid rgba(100,160,255,0.15); }' +
        '.ms-spinner { width:36px;height:36px;border:3px solid rgba(56,189,248,0.2);border-top:3px solid #38bdf8;' +
            'border-radius:50%;animation:ms-spin 1s linear infinite;margin:0 auto 14px; }' +
        '@keyframes ms-spin { 0%{transform:rotate(0)} 100%{transform:rotate(360deg)} }' +
        '.ms-loading-text { font-size:13px;color:#94a3b8; }' +

        /* 滚动条 */
        '.ms-main::-webkit-scrollbar-track { background:transparent; }' +
        '.ms-main::-webkit-scrollbar-thumb { background:rgba(56,189,248,0.2);border-radius:3px; }' +
        '.ms-sidebar::-webkit-scrollbar-track { background:transparent; }' +
        '.ms-sidebar::-webkit-scrollbar-thumb { background:rgba(56,189,248,0.2);border-radius:3px; }' +

        /* 隐藏 file input */
        '.ms-overlay input[type="file"] { display:none; }';
    document.head.appendChild(s);
})();
