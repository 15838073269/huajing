/**
 * ============================================
 *   视频播放插件 (VideoSkill)
 *   从 v64/js/video.js 改写为 v65 技能插件
 * ============================================
 *
 * 功能：
 * - 拖放视频文件到画布
 * - 创建视频播放器（显示在世界上）
 * - 播放/暂停控制
 * - 进度条
 * - 懒加载（IntersectionObserver）
 * - 多视频同时播放开关
 * - 播放器元素可拖拽移动
 *
 * UI: 视频播放器直接放在世界层上，使用世界坐标
 * 完全独立，不依赖 AudioSystem, app
 */
var VideoSkill = {
    // ===== 基本信息 =====
    id: 'video',
    name: '视频播放',
    icon: '影',
    description: '拖放视频文件，支持多视频播放',
    key: '4',

    // ===== 内部状态 =====
    _world: null,
    _layer: null,
    _elements: [],            // 在世界里创建的DOM元素

    // 视频播放器列表
    _videoPlayers: [],

    // 允许多视频同时播放
    _allowMultiple: false,

    // 懒加载
    _lazyLoadEnabled: true,
    _intersectionObserver: null,
    _loadedVideos: {},

    // Object URL 管理
    _objectUrls: [],

    // 拖拽事件处理函数引用
    _dragHandlers: [],

    // 全局 drop 事件处理函数
    _globalDropHandler: null,
    _globalDragOverHandler: null,

    // 加载动画样式是否已注入
    _styleInjected: false,

    // 冷蓝配色
    _colors: {
        bg: 'rgba(15, 25, 50, 0.92)',
        border: 'rgba(100, 160, 255, 0.25)',
        accent: '#38bdf8',
        accentHover: '#7dd3fc',
        text: '#e8edf5',
        textMuted: '#94a3b8',
        progressBg: 'rgba(56, 189, 248, 0.15)',
        progressFill: '#38bdf8',
        overlay: 'rgba(0, 0, 0, 0.6)'
    },

    // ===== 生命周期 =====

    /**
     * 激活插件
     * @param {GameWorld} world - 游戏世界对象
     */
    activate: function(world) {
        this._world = world;
        this._layer = world.getLayer();

        // 注入加载动画样式
        this._injectSpinnerStyle();

        // 初始化拖放
        this._initDragAndDrop();

        // 初始化懒加载
        this._initLazyLoading();

        // 更新子工具栏
        SkillSystem.renderSubTools();
    },

    /**
     * 停用插件，清理资源
     */
    deactivate: function() {
        // 只解绑拖放事件，不删除视频窗口
        this._removeGlobalDragEvents();

        // 暂停所有播放（不删除）
        this._videoPlayers.forEach(function(p) {
            if (p.video) p.video.pause();
            if (p.isPlaying) p.isPlaying = false;
        });
    },

    // ===== 子工具栏 =====

    /**
     * 返回工具按钮列表
     */
    getSubTools: function() {
        var self = this;
        return [
            {
                label: '拖放视频到画布',
                action: function() {}
            },
            {
                label: this._allowMultiple ? '多播: 开' : '多播: 关',
                action: function() {
                    self._toggleMultiplePlayback();
                    SkillSystem.renderSubTools();
                }
            },
            {
                label: '全部暂停',
                action: function() {
                    self._pauseAll();
                }
            },
            {
                label: '清空全部',
                action: function() {
                    self._clearAll();
                }
            }
        ];
    },

    // ===== 保存/恢复 =====

    /**
     * 保存状态
     */
    save: function() {
        var players = [];
        this._videoPlayers.forEach(function(p) {
            players.push({
                id: p.id,
                x: parseInt(p.element.style.left) || 0,
                y: parseInt(p.element.style.top) || 0,
                width: p.width || 200,
                height: p.height || 160,
                isPlaying: p.isPlaying,
                currentTime: p.video ? p.video.currentTime : 0,
                fileName: p.fileName || ''
            });
        });

        return {
            players: players,
            allowMultiple: this._allowMultiple,
            lazyLoadEnabled: this._lazyLoadEnabled
        };
    },

    /**
     * 恢复状态（视频文件需要重新拖放）
     * @param {Object} data - save() 返回的数据
     */
    load: function(data) {
        if (!data) return;
        if (typeof data.allowMultiple === 'boolean') {
            this._allowMultiple = data.allowMultiple;
        }
        if (typeof data.lazyLoadEnabled === 'boolean') {
            this._lazyLoadEnabled = data.lazyLoadEnabled;
        }
        console.log('VideoSkill: 状态已加载，视频文件需重新拖放');
    },

    // ===== 拖放处理 =====

    /**
     * 初始化拖放功能
     */
    _initDragAndDrop: function() {
        var self = this;

        this._globalDragOverHandler = function(e) {
            e.preventDefault();
            e.stopPropagation();
        };

        this._globalDropHandler = function(e) {
            e.preventDefault();
            e.stopPropagation();

            try {
                var files = e.dataTransfer.files;

                if (files.length > 0) {
                    for (var i = 0; i < files.length; i++) {
                        var file = files[i];
                        if (file.type.startsWith('video/') || file.name.toLowerCase().match(/\.(mp4|webm|ogg|avi|mov|wmv|flv|mkv)$/i)) {
                            // 将屏幕坐标转换为世界坐标
                            var worldPos = self._world.screenToWorld(e.clientX + i * 320, e.clientY);
                            self._handleVideoFileDrop(file, worldPos.x, worldPos.y);
                        }
                    }
                }
            } catch (error) {
                console.error('VideoSkill: 处理拖拽释放失败:', error);
            }
        };

        document.addEventListener('dragover', this._globalDragOverHandler);
        document.addEventListener('drop', this._globalDropHandler);
    },

    /**
     * 移除全局拖放事件
     */
    _removeGlobalDragEvents: function() {
        if (this._globalDragOverHandler) {
            document.removeEventListener('dragover', this._globalDragOverHandler);
        }
        if (this._globalDropHandler) {
            document.removeEventListener('drop', this._globalDropHandler);
        }
    },

    /**
     * 处理视频文件拖放
     */
    _handleVideoFileDrop: function(file, wx, wy) {
        try {
            var videoUrl = URL.createObjectURL(file);
            this._objectUrls.push(videoUrl);
            this._createVideoPlayer(videoUrl, wx, wy, file.name);
        } catch (error) {
            console.error('VideoSkill: 处理视频文件失败:', error);
        }
    },

    // ===== 视频播放器 =====

    /**
     * 生成随机暖色调颜色
     */
    _getRandomColor: function() {
        var ranges = [[0, 60], [300, 360]];
        var range = ranges[Math.floor(Math.random() * ranges.length)];
        var hue = range[0] + Math.floor(Math.random() * (range[1] - range[0]));
        var saturation = 60 + Math.floor(Math.random() * 30);
        var lightness = 45 + Math.floor(Math.random() * 15);
        return 'hsl(' + hue + ', ' + saturation + '%, ' + lightness + '%)';
    },

    /**
     * 注入加载动画 CSS
     */
    _injectSpinnerStyle: function() {
        if (this._styleInjected) return;
        this._styleInjected = true;

        var style = document.createElement('style');
        style.textContent =
            '.vskill-loading-spinner {' +
            '  width: 36px; height: 36px;' +
            '  border: 3px solid rgba(56,189,248,0.3);' +
            '  border-top-color: #38bdf8;' +
            '  border-radius: 50%;' +
            '  animation: vskill-spin 0.8s linear infinite;' +
            '}' +
            '@keyframes vskill-spin {' +
            '  to { transform: rotate(360deg); }' +
            '}' +
            '.vskill-loading-text {' +
            '  color: #e8edf5; margin-top: 8px; font-size: 12px;' +
            '}';
        document.head.appendChild(style);
    },

    /**
     * 创建视频播放器
     */
    _createVideoPlayer: function(videoUrl, wx, wy, fileName) {
        var self = this;
        var playerId = 'video-player-' + Date.now();
        var color = this._getRandomColor();

        // 视频容器
        var videoContainer = document.createElement('div');
        videoContainer.id = playerId;
        videoContainer.style.cssText = 'position:absolute;left:' + wx + 'px;top:' + wy + 'px;' +
            'width:240px;height:180px;border-radius:10px;border:2px solid ' + this._colors.border + ';' +
            'background:' + color + ';cursor:pointer;display:flex;flex-direction:column;' +
            'align-items:center;justify-content:center;z-index:1000;overflow:hidden;' +
            'box-shadow:0 6px 24px rgba(0,0,0,0.4);pointer-events:auto;user-select:none;';

        // 加载指示器
        var loadingIndicator = document.createElement('div');
        loadingIndicator.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,0.7);' +
            'display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:10;border-radius:8px;';
        loadingIndicator.innerHTML = '<div class="vskill-loading-spinner"></div>' +
            '<div class="vskill-loading-text">加载中...</div>';

        // 视频元素
        var videoElement = document.createElement('video');
        videoElement.dataset.src = videoUrl;
        videoElement.preload = 'auto';
        videoElement.loop = true;
        videoElement.muted = this._allowMultiple;
        videoElement.playsInline = true;
        videoElement.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000;';

        // 关闭按钮
        var closeBtn = document.createElement('div');
        closeBtn.style.cssText = 'position:absolute;top:4px;right:4px;z-index:10;' +
            'background:rgba(0,0,0,0.6);color:#fff;font-size:10px;line-height:1;padding:2px 5px;' +
            'border-radius:3px;cursor:pointer;opacity:0;transition:opacity 0.2s;';
        closeBtn.textContent = '关';
        closeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            self._removeVideoPlayer(playerId);
        });

        // 播放按钮覆盖层
        var playOverlay = document.createElement('div');
        playOverlay.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;' +
            'z-index:5;pointer-events:none;transition:opacity 0.2s ease;';
        playOverlay.innerHTML = '<div style="width:48px;height:48px;border-radius:50%;background:rgba(0,0,0,0.6);' +
            'display:flex;align-items:center;justify-content:center;font-size:20px;color:white;' +
            'border:2px solid rgba(255,255,255,0.3);">▶</div>';

        // 底部标题栏
        var titleBar = document.createElement('div');
        titleBar.style.cssText = 'position:absolute;bottom:0;left:0;right:0;background:rgba(0,0,0,0.7);' +
            'color:' + this._colors.text + ';padding:5px 10px;font-size:11px;text-align:center;' +
            'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-radius:0 0 8px 8px;' +
            'transition:opacity 0.2s ease;pointer-events:none;';
        titleBar.textContent = fileName || '视频 ' + (this._videoPlayers.length + 1);

        // 进度条
        var progressContainer = document.createElement('div');
        progressContainer.style.cssText = 'position:absolute;bottom:24px;left:0;right:0;height:3px;' +
            'background:' + this._colors.progressBg + ';cursor:pointer;z-index:6;opacity:0;' +
            'transition:opacity 0.2s ease;';
        var progressBar = document.createElement('div');
        progressBar.style.cssText = 'height:100%;width:0%;background:' + this._colors.progressFill + ';border-radius:0 2px 2px 0;';
        progressContainer.appendChild(progressBar);

        // 组装
        videoContainer.appendChild(loadingIndicator);
        videoContainer.appendChild(closeBtn);
        videoContainer.appendChild(videoElement);
        videoContainer.appendChild(playOverlay);
        videoContainer.appendChild(progressContainer);
        videoContainer.appendChild(titleBar);

        // 添加到世界层
        this._layer.appendChild(videoContainer);
        this._elements.push(videoContainer);

        // 播放器信息
        var playerInfo = {
            id: playerId,
            element: videoContainer,
            video: videoElement,
            loadingIndicator: loadingIndicator,
            playOverlay: playOverlay,
            titleBar: titleBar,
            progressContainer: progressContainer,
            progressBar: progressBar,
            isPlaying: false,
            currentTime: 0,
            fileName: fileName || '',
            width: 240,
            height: 180,
            color: color
        };
        this._videoPlayers.push(playerInfo);

        // ===== 视频事件 =====
        this._setupVideoEvents(videoElement, playerInfo, loadingIndicator);

        // ===== 播放/暂停点击 =====
        videoContainer.addEventListener('click', function(e) {
            e.stopPropagation();
            self._togglePlayback(playerId);
        });

        // 悬停显示进度条
        videoContainer.addEventListener('mouseenter', function() {
            progressContainer.style.opacity = '1';
            closeBtn.style.opacity = '1';
        });
        videoContainer.addEventListener('mouseleave', function() {
            if (!playerInfo.isPlaying) {
                progressContainer.style.opacity = '0';
            }
            closeBtn.style.opacity = '0';
        });

        // 进度条点击跳转
        progressContainer.addEventListener('click', function(e) {
            e.stopPropagation();
            if (videoElement.duration) {
                var rect = progressContainer.getBoundingClientRect();
                var ratio = (e.clientX - rect.left) / rect.width;
                videoElement.currentTime = ratio * videoElement.duration;
            }
        });

        // ===== 拖拽 =====
        this._makeDraggable(videoContainer, playerId);

        // ===== 右键删除 =====
        this._setupRightClickDelete(videoContainer, playerId);

        // ===== 懒加载或立即加载 =====
        if (this._lazyLoadEnabled) {
            this._observeVideo(playerInfo);
        } else {
            videoElement.src = videoUrl;
        }

        console.log('VideoSkill: 播放器创建成功:', playerId);
    },

    /**
     * 设置视频事件监听
     */
    _setupVideoEvents: function(videoElement, playerInfo, loadingIndicator) {
        var self = this;
        var isFirstLoad = true;

        // 加载开始
        videoElement.addEventListener('loadstart', function() {
            if (isFirstLoad) {
                loadingIndicator.style.display = 'flex';
                var text = loadingIndicator.querySelector('.vskill-loading-text');
                if (text) text.textContent = '开始加载...';
            }
        });

        // 缓冲进度
        videoElement.addEventListener('progress', function() {
            if (videoElement.buffered.length > 0) {
                var buffered = videoElement.buffered.end(0);
                var duration = videoElement.duration || 1;
                var percent = Math.round((buffered / duration) * 100);
                var text = loadingIndicator.querySelector('.vskill-loading-text');
                if (text && percent < 100 && isFirstLoad) {
                    text.textContent = '缓冲中... ' + percent + '%';
                }
            }
        });

        // 元数据加载完成 - 调整大小
        videoElement.addEventListener('loadedmetadata', function() {
            if (isFirstLoad) {
                var text = loadingIndicator.querySelector('.vskill-loading-text');
                if (text) text.textContent = '准备播放...';
            }

            var vw = videoElement.videoWidth;
            var vh = videoElement.videoHeight;
            if (!vw || !vh) return;

            var aspectRatio = vw / vh;
            var maxDim = 640;
            var minDim = 200;

            var finalW, finalH;
            if (vw > vh) {
                finalW = Math.max(minDim, Math.min(maxDim, vw * 0.5));
                finalH = finalW / aspectRatio;
            } else {
                finalH = Math.max(minDim, Math.min(maxDim, vh * 0.5));
                finalW = finalH * aspectRatio;
            }

            finalW = Math.max(minDim, Math.min(maxDim, finalW));
            finalH = Math.max(minDim, Math.min(maxDim, finalH));

            playerInfo.element.style.width = finalW + 'px';
            playerInfo.element.style.height = finalH + 'px';
            playerInfo.width = finalW;
            playerInfo.height = finalH;
        });

        // 可以播放
        videoElement.addEventListener('canplay', function() {
            loadingIndicator.style.display = 'none';
            isFirstLoad = false;
        });

        videoElement.addEventListener('canplaythrough', function() {
            loadingIndicator.style.display = 'none';
        });

        // 等待缓冲
        videoElement.addEventListener('waiting', function() {
            if (isFirstLoad) {
                loadingIndicator.style.display = 'flex';
                var text = loadingIndicator.querySelector('.vskill-loading-text');
                if (text) text.textContent = '缓冲中...';
            }
        });

        // 加载错误
        videoElement.addEventListener('error', function() {
            loadingIndicator.style.display = 'flex';
            var text = loadingIndicator.querySelector('.vskill-loading-text');
            if (text) text.textContent = '加载失败';
            console.error('VideoSkill: 视频加载错误', playerInfo.id);
        });

        // 时间更新 - 更新进度条
        videoElement.addEventListener('timeupdate', function() {
            playerInfo.currentTime = videoElement.currentTime;
            if (videoElement.duration) {
                var percent = (videoElement.currentTime / videoElement.duration) * 100;
                playerInfo.progressBar.style.width = percent + '%';
            }
        });

        // 播放结束
        videoElement.addEventListener('ended', function() {
            if (videoElement.loop) {
                playerInfo.isPlaying = true;
            } else {
                playerInfo.isPlaying = false;
                playerInfo.playOverlay.style.opacity = '1';
                playerInfo.titleBar.style.opacity = '1';
            }
        });
    },

    /**
     * 切换播放/暂停
     */
    _togglePlayback: function(playerId) {
        var player = this._videoPlayers.find(function(p) { return p.id === playerId; });
        if (!player) return;

        // 如果不允许同时播放，暂停其他
        if (!this._allowMultiple) {
            this._videoPlayers.forEach(function(p) {
                if (p.id !== playerId && p.isPlaying) {
                    p.video.pause();
                    p.isPlaying = false;
                    p.playOverlay.style.opacity = '1';
                    p.titleBar.style.opacity = '1';
                    p.progressContainer.style.opacity = '0';
                }
            });
        }

        if (player.isPlaying) {
            // 暂停
            player.video.pause();
            player.isPlaying = false;
            player.playOverlay.style.opacity = '1';
            player.titleBar.style.opacity = '1';
            player.progressContainer.style.opacity = '0';
        } else {
            // 播放
            if (player.currentTime > 0) {
                player.video.currentTime = player.currentTime;
            }
            player.video.play();
            player.isPlaying = true;
            player.playOverlay.style.opacity = '0';
            player.titleBar.style.opacity = '0';
            player.progressContainer.style.opacity = '1';
        }
    },

    /**
     * 切换多视频同时播放
     */
    _toggleMultiplePlayback: function() {
        this._allowMultiple = !this._allowMultiple;

        if (this._allowMultiple) {
            // 开启多播时，关闭所有声音
            this._videoPlayers.forEach(function(p) {
                p.video.muted = true;
            });
        } else {
            // 关闭多播时，暂停所有并取消静音
            this._videoPlayers.forEach(function(p) {
                if (p.isPlaying) {
                    p.video.pause();
                    p.isPlaying = false;
                    p.playOverlay.style.opacity = '1';
                    p.titleBar.style.opacity = '1';
                    p.progressContainer.style.opacity = '0';
                }
                p.video.muted = false;
            });
        }
    },

    /**
     * 暂停所有视频
     */
    _pauseAll: function() {
        this._videoPlayers.forEach(function(p) {
            if (p.isPlaying) {
                p.video.pause();
                p.isPlaying = false;
                p.playOverlay.style.opacity = '1';
                p.titleBar.style.opacity = '1';
                p.progressContainer.style.opacity = '0';
            }
        });
    },

    /**
     * 清空所有视频
     */
    _clearAll: function() {
        var self = this;

        this._videoPlayers.forEach(function(p) {
            if (p.video) p.video.pause();
            if (self._lazyLoadEnabled) {
                self._unobserveVideo(p);
            }
        });

        this._elements.forEach(function(el) {
            if (el && el.parentNode) el.parentNode.removeChild(el);
        });
        this._elements = [];
        this._videoPlayers = [];

        // 释放 Object URL
        this._objectUrls.forEach(function(url) {
            URL.revokeObjectURL(url);
        });
        this._objectUrls = [];
        this._loadedVideos = {};
    },

    // ===== 懒加载 =====

    /**
     * 初始化懒加载
     */
    _initLazyLoading: function() {
        if (!('IntersectionObserver' in window)) {
            console.log('VideoSkill: 浏览器不支持 IntersectionObserver');
            this._lazyLoadEnabled = false;
            return;
        }

        var self = this;
        this._intersectionObserver = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                var playerId = entry.target.id;
                var player = self._videoPlayers.find(function(p) { return p.id === playerId; });
                if (!player) return;

                if (entry.isIntersecting) {
                    self._loadVideo(player);
                } else {
                    self._unloadVideo(player);
                }
            });
        }, {
            root: null,
            rootMargin: '200px',
            threshold: 0.01
        });
    },

    /**
     * 开始观察视频
     */
    _observeVideo: function(player) {
        if (!this._lazyLoadEnabled || !this._intersectionObserver) return;
        this._intersectionObserver.observe(player.element);
    },

    /**
     * 停止观察视频
     */
    _unobserveVideo: function(player) {
        if (!this._lazyLoadEnabled || !this._intersectionObserver) return;
        this._intersectionObserver.unobserve(player.element);
    },

    /**
     * 加载视频
     */
    _loadVideo: function(player) {
        if (this._loadedVideos[player.id]) return;

        var videoUrl = player.video.dataset.src;
        if (!videoUrl) return;

        player.video.src = videoUrl;
        this._loadedVideos[player.id] = true;

        player.video.addEventListener('error', function() {
            if (player.loadingIndicator) {
                var text = player.loadingIndicator.querySelector('.vskill-loading-text');
                if (text) text.textContent = '加载失败';
            }
        }, { once: true });
    },

    /**
     * 卸载视频
     */
    _unloadVideo: function(player) {
        if (!this._loadedVideos[player.id]) return;

        if (player.isPlaying) {
            player.video.pause();
            player.isPlaying = false;
            player.playOverlay.style.opacity = '1';
            player.titleBar.style.opacity = '1';
            player.progressContainer.style.opacity = '0';
        }

        player.video.removeAttribute('src');
        player.video.load();
        delete this._loadedVideos[player.id];
    },

    /**
     * 切换懒加载
     */
    _toggleLazyLoading: function() {
        this._lazyLoadEnabled = !this._lazyLoadEnabled;

        if (!this._lazyLoadEnabled) {
            // 关闭懒加载 - 加载所有视频
            var self = this;
            this._videoPlayers.forEach(function(player) {
                self._unobserveVideo(player);
                self._loadVideo(player);
            });
        } else {
            // 开启懒加载 - 观察所有视频
            var self2 = this;
            this._videoPlayers.forEach(function(player) {
                self2._observeVideo(player);
            });
        }
    },

    // ===== 通用功能 =====

    /**
     * 让元素可以在世界里拖拽（使用世界事件系统）
     */
    _makeDraggable: function(el, id) {
        var self = this;
        var isDragging = false;
        var startX, startY, origX, origY;

        el.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return;
            e.stopPropagation();
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            origX = parseInt(el.style.left) || 0;
            origY = parseInt(el.style.top) || 0;
            el.style.cursor = 'grabbing';
            el.style.zIndex = '2000';
            el.style.transition = 'none';
        });

        var onMove = function(data) {
            if (!isDragging) return;
            var worldStart = self._world.screenToWorld(startX, startY);
            var worldNow = self._world.screenToWorld(data.screenX, data.screenY);
            var newX = origX + (worldNow.x - worldStart.x);
            var newY = origY + (worldNow.y - worldStart.y);
            el.style.left = newX + 'px';
            el.style.top = newY + 'px';
        };

        var onUp = function() {
            if (!isDragging) return;
            isDragging = false;
            el.style.cursor = 'pointer';
            el.style.zIndex = '1000';
            el.style.transition = 'all 0.1s ease';
        };

        this._world.on('mousemove', onMove);
        this._world.on('mouseup', onUp);

        var cleanup = function() {
            self._world.off('mousemove', onMove);
            self._world.off('mouseup', onUp);
        };
        this._dragHandlers.push({ cleanup: cleanup });
        el._cleanup = cleanup;
    },

    /**
     * 设置右键拖拽删除
     */
    _setupRightClickDelete: function(element, id) {
        var self = this;
        var isDragging = false;
        var startX, startY;

        element.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            e.stopPropagation();
        });

        element.addEventListener('mousedown', function(e) {
            if (e.button === 2) {
                e.preventDefault();
                e.stopPropagation();
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
            }
        });

        var onMove = function(data) {
            if (!isDragging) return;
            var dx = data.screenX - startX;
            var dy = data.screenY - startY;
            var distance = Math.sqrt(dx * dx + dy * dy);

            if (distance > 30) {
                self._removeVideoPlayer(id);
                isDragging = false;
            }
        };

        var onUp = function() {
            isDragging = false;
        };

        this._world.on('mousemove', onMove);
        this._world.on('mouseup', onUp);

        this._dragHandlers.push({
            cleanup: function() {
                self._world.off('mousemove', onMove);
                self._world.off('mouseup', onUp);
            }
        });
    },

    /**
     * 移除视频播放器
     */
    _removeVideoPlayer: function(playerId) {
        var index = this._videoPlayers.findIndex(function(p) { return p.id === playerId; });
        if (index !== -1) {
            var player = this._videoPlayers[index];

            if (player.video) {
                player.video.pause();
            }

            if (this._lazyLoadEnabled) {
                this._unobserveVideo(player);
            }

            if (player.element && player.element.parentNode) {
                player.element.parentNode.removeChild(player.element);
            }

            // 从 _elements 中移除
            var elIdx = this._elements.indexOf(player.element);
            if (elIdx !== -1) this._elements.splice(elIdx, 1);

            // 清理拖拽事件
            if (player.element && player.element._cleanup) {
                player.element._cleanup();
            }

            delete this._loadedVideos[playerId];
            this._videoPlayers.splice(index, 1);
        }
    }
};
