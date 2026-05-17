/**
 * ============================================
 *   音乐播放插件 (MusicSkill)
 *   从 v64/js/music.js 改写为 v65 技能插件
 * ============================================
 *
 * 功能：
 * - 拖放音频文件到画布
 * - 创建圆形播放按钮（显示在世界上）
 * - 播放/暂停控制
 * - 音乐列表节点（单曲/顺序/随机三种播放模式）
 * - 进度条
 * - 音量控制
 * - 播放器元素可拖拽移动
 *
 * UI: 播放按钮和列表节点直接放在世界层上（world.getLayer()），使用世界坐标
 * 完全独立，不依赖 AudioSystem, app
 */
var MusicSkill = {
    // ===== 基本信息 =====
    id: 'music',
    name: '音乐播放',
    icon: '音',
    description: '拖放音频文件，列表播放+多种模式',
    key: '3',

    // ===== 内部状态 =====
    _world: null,
    _layer: null,
    _elements: [],            // 在世界里创建的DOM元素

    // 音频播放器列表
    _audioPlayers: [],

    // 音乐列表节点
    _musicListNodes: [],

    // 防止重复处理拖拽事件
    _isProcessingDrop: false,

    // 拖拽事件处理函数引用
    _dragHandlers: [],

    // 全局 drop 事件处理函数
    _globalDropHandler: null,
    _globalDragOverHandler: null,

    // 冷蓝配色
    _colors: {
        bg: 'rgba(15, 25, 50, 0.92)',
        border: 'rgba(100, 160, 255, 0.25)',
        accent: '#38bdf8',
        accentHover: '#7dd3fc',
        text: '#e8edf5',
        textMuted: '#94a3b8',
        listBg: 'rgba(10, 18, 40, 0.95)',
        itemBg: 'rgba(20, 35, 70, 0.6)',
        itemHover: 'rgba(30, 50, 90, 0.8)',
        activeBtn: '#38bdf8',
        inactiveBtn: 'rgba(20, 35, 70, 0.8)',
        progressBg: 'rgba(56, 189, 248, 0.15)',
        progressFill: '#38bdf8',
        volumeBg: 'rgba(56, 189, 248, 0.15)',
        volumeFill: '#38bdf8'
    },

    // ===== 生命周期 =====

    /**
     * 激活插件
     * @param {GameWorld} world - 游戏世界对象
     */
    activate: function(world) {
        this._world = world;
        this._layer = world.getLayer();

        // 初始化拖放
        this._initDragAndDrop();

        // 更新子工具栏
        SkillSystem.renderSubTools();
    },

    /**
     * 停用插件，清理资源
     */
    deactivate: function() {
        // 只清理全局拖放事件，保留音频播放、UI和元素拖拽
        this._removeGlobalDragEvents();
    },

    // ===== 子工具栏 =====

    /**
     * 返回工具按钮列表
     */
    getSubTools: function() {
        var self = this;
        return [
            {
                label: '拖放音频到画布',
                action: function() {}
            },
            {
                label: '停',
                action: function() {
                    self._stopAll();
                }
            },
            {
                label: '删',
                action: function() {
                    self._clearAll();
                }
            }
        ];
    },

    // ===== 保存/恢复 =====

    /**
     * 保存状态（音频文件URL无法序列化，只保存元数据）
     */
    save: function() {
        var players = [];
        this._audioPlayers.forEach(function(p) {
            players.push({
                id: p.id,
                x: parseInt(p.element.style.left) || 0,
                y: parseInt(p.element.style.top) || 0,
                color: p.color,
                isPlaying: p.isPlaying,
                currentTime: p.audio ? p.audio.currentTime : 0,
                volume: p.volume !== undefined ? p.volume : 0.8,
                fileName: p.fileName || ''
            });
        });

        var lists = [];
        this._musicListNodes.forEach(function(n) {
            var fileNames = [];
            n.audioFiles.forEach(function(f) {
                fileNames.push(f.name);
            });
            lists.push({
                id: n.id,
                x: parseInt(n.element.style.left) || 0,
                y: parseInt(n.element.style.top) || 0,
                currentIndex: n.currentIndex,
                playbackMode: n.playbackMode,
                isPlaying: n.isPlaying,
                fileNames: fileNames
            });
        });

        return {
            players: players,
            lists: lists
        };
    },

    /**
     * 恢复状态（音频文件需要重新拖放，只恢复UI位置）
     * @param {Object} data - save() 返回的数据
     */
    load: function(data) {
        if (!data) return;
        // 音频文件无法从序列化数据恢复，仅记录日志
        console.log('MusicSkill: 状态已加载，音频文件需重新拖放');
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
            if (self._isProcessingDrop) return;

            e.preventDefault();
            e.stopPropagation();

            try {
                self._isProcessingDrop = true;
                var files = e.dataTransfer.files;

                if (files.length > 0) {
                    // 分离音频文件
                    var audioFiles = [];
                    var otherFiles = [];
                    for (var i = 0; i < files.length; i++) {
                        var file = files[i];
                        if (file.type.startsWith('audio/') || file.name.toLowerCase().match(/\.(mp3|wav|ogg|m4a|aac|flac|wma)$/i)) {
                            audioFiles.push(file);
                        } else {
                            otherFiles.push(file);
                        }
                    }

                    // 将屏幕坐标转换为世界坐标
                    var worldPos = self._world.screenToWorld(e.clientX, e.clientY);

                    if (audioFiles.length === 1) {
                        // 单个音频文件 - 创建独立播放按钮
                        self._handleAudioFileDrop(audioFiles[0], worldPos.x, worldPos.y);
                    } else if (audioFiles.length > 1) {
                        // 多个音频文件 - 创建音乐列表
                        self._createMusicListNode(audioFiles, worldPos.x, worldPos.y);
                    }
                }
            } catch (error) {
                console.error('MusicSkill: 处理拖拽释放失败:', error);
            } finally {
                setTimeout(function() {
                    self._isProcessingDrop = false;
                }, 500);
            }
        };

        // 监听 document 级别的拖放事件
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
     * 处理单个音频文件拖放
     */
    _handleAudioFileDrop: function(file, wx, wy) {
        var self = this;
        try {
            var reader = new FileReader();
            reader.onload = function(event) {
                var audioUrl = event.target.result;
                self._createAudioPlayer(audioUrl, wx, wy, file.name);
            };
            reader.onerror = function(error) {
                console.error('MusicSkill: 文件读取失败:', error);
            };
            reader.readAsDataURL(file);
        } catch (error) {
            console.error('MusicSkill: 初始化文件读取失败:', error);
        }
    },

    // ===== 音频播放器 =====

    /**
     * 生成随机暖色调颜色
     */
    _getRandomColor: function() {
        // 暖色调色相范围：0-60（红-黄），300-360（粉红）
        var ranges = [[0, 60], [300, 360]];
        var range = ranges[Math.floor(Math.random() * ranges.length)];
        var hue = range[0] + Math.floor(Math.random() * (range[1] - range[0]));
        var saturation = 60 + Math.floor(Math.random() * 30);
        var lightness = 45 + Math.floor(Math.random() * 15);
        return 'hsl(' + hue + ', ' + saturation + '%, ' + lightness + '%)';
    },

    /**
     * 创建音频播放器（圆形播放按钮 + 进度条 + 音量控制）
     */
    _createAudioPlayer: function(audioUrl, wx, wy, fileName) {
        var self = this;
        var playerId = 'music-player-' + Date.now();
        var color = this._getRandomColor();

        // 创建播放器容器
        var container = document.createElement('div');
        container.id = playerId;
        container.style.cssText = 'position:absolute;left:' + wx + 'px;top:' + wy + 'px;' +
            'display:flex;flex-direction:column;align-items:center;gap:6px;' +
            'pointer-events:auto;user-select:none;z-index:1000;';

        // 创建圆形播放按钮
        var playButton = document.createElement('button');
        playButton.style.cssText = 'width:56px;height:56px;border-radius:50%;border:2px solid rgba(255,255,255,0.2);' +
            'background:' + color + ';color:white;font-size:20px;cursor:pointer;' +
            'display:flex;align-items:center;justify-content:center;' +
            'box-shadow:0 4px 15px rgba(0,0,0,0.3);transition:transform 0.15s ease,box-shadow 0.15s ease;';
        playButton.innerHTML = '播';
        playButton.title = fileName || '音频';

        // 悬停效果
        playButton.addEventListener('mouseenter', function() {
            playButton.style.transform = 'scale(1.08)';
            playButton.style.boxShadow = '0 6px 20px rgba(0,0,0,0.4)';
        });
        playButton.addEventListener('mouseleave', function() {
            playButton.style.transform = 'scale(1)';
            playButton.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
        });

        // 关闭按钮
        var closeBtn = document.createElement('button');
        closeBtn.textContent = '×';
        closeBtn.style.cssText = 'position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;' +
            'border:1px solid rgba(255,255,255,0.3);background:rgba(0,0,0,0.7);color:#ccc;font-size:12px;' +
            'cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;line-height:1;';
        closeBtn.title = '关闭';
        closeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            self._removePlayer(playerId);
        });

        // 播放按钮容器（用于定位关闭按钮）
        var btnWrap = document.createElement('div');
        btnWrap.style.cssText = 'position:relative;display:inline-block;';
        btnWrap.appendChild(playButton);
        btnWrap.appendChild(closeBtn);

        // 文件名标签
        var nameLabel = document.createElement('div');
        nameLabel.style.cssText = 'color:' + this._colors.text + ';font-size:11px;max-width:100px;' +
            'text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' +
            'text-shadow:0 1px 3px rgba(0,0,0,0.5);pointer-events:none;';
        nameLabel.textContent = fileName || '音频';

        // 进度条容器
        var progressContainer = document.createElement('div');
        progressContainer.style.cssText = 'width:80px;height:4px;background:' + this._colors.progressBg + ';' +
            'border-radius:2px;cursor:pointer;position:relative;overflow:hidden;';

        var progressBar = document.createElement('div');
        progressBar.style.cssText = 'height:100%;width:0%;background:' + this._colors.progressFill + ';' +
            'border-radius:2px;transition:width 0.1s linear;';
        progressContainer.appendChild(progressBar);

        // 组装播放器
        container.appendChild(btnWrap);
        container.appendChild(nameLabel);
        container.appendChild(progressContainer);

        // 创建隐藏的音频元素
        var audioElement = document.createElement('audio');
        audioElement.src = audioUrl;
        audioElement.preload = 'metadata';
        audioElement.style.display = 'none';

        // 添加到世界层
        this._layer.appendChild(container);
        this._layer.appendChild(audioElement);
        this._elements.push(container);
        this._elements.push(audioElement);

        // 存储播放器信息
        var playerInfo = {
            id: playerId,
            element: container,
            audio: audioElement,
            playButton: playButton,
            progressBar: progressBar,
            progressContainer: progressContainer,
            nameLabel: nameLabel,
            isPlaying: false,
            currentTime: 0,
            color: color,
            fileName: fileName || ''
        };
        this._audioPlayers.push(playerInfo);

        // ===== 事件绑定 =====

        // 播放/暂停
        playButton.addEventListener('click', function(e) {
            e.stopPropagation();
            // 如果当前不是音频插件，先切换过来
            if (typeof SkillSystem !== 'undefined' && SkillSystem.getActiveId && SkillSystem.getActiveId() !== 'music') {
                SkillSystem.activate('music');
            }
            self._togglePlayback(playerId);
        });

        // 进度条点击跳转
        progressContainer.addEventListener('click', function(e) {
            e.stopPropagation();
            if (audioElement.duration) {
                var rect = progressContainer.getBoundingClientRect();
                var ratio = (e.clientX - rect.left) / rect.width;
                audioElement.currentTime = ratio * audioElement.duration;
            }
        });

        // 音量控制（已移除）

        // 音频时间更新
        audioElement.addEventListener('timeupdate', function() {
            playerInfo.currentTime = audioElement.currentTime;
            if (audioElement.duration) {
                var percent = (audioElement.currentTime / audioElement.duration) * 100;
                progressBar.style.width = percent + '%';
            }
        });

        // 音频加载元数据
        audioElement.addEventListener('loadedmetadata', function() {
        });

        // 音频结束 - 重新播放（单曲循环）
        audioElement.addEventListener('ended', function() {
            audioElement.currentTime = 0;
            audioElement.play();
        });

        // 让播放器可拖拽
        this._makeDraggable(container, playerId);

        // 右键拖拽删除
        this._setupRightClickDelete(container, playerId, false);

        console.log('MusicSkill: 播放器创建成功:', playerId);
    },

    /**
     * 切换播放/暂停
     */
    _togglePlayback: function(playerId) {
        var player = this._audioPlayers.find(function(p) { return p.id === playerId; });
        if (!player) return;

        if (player.isPlaying) {
            // 暂停
            player.audio.pause();
            player.playButton.innerHTML = '播';
            player.isPlaying = false;
        } else {
            // 暂停其他播放器
            var self = this;
            this._audioPlayers.forEach(function(p) {
                if (p.isPlaying) {
                    p.audio.pause();
                    p.playButton.innerHTML = '播';
                    p.isPlaying = false;
                }
            });
            // 暂停其他音乐列表
            this._musicListNodes.forEach(function(n) {
                if (n.isPlaying) {
                    n.audio.pause();
                    n.isPlaying = false;
                    if (n.currentIndex >= 0 && n.playButtons[n.currentIndex]) {
                        n.playButtons[n.currentIndex].textContent = '播';
                    }
                }
            });

            // 播放
            if (player.currentTime > 0) {
                player.audio.currentTime = player.currentTime;
            }
            player.audio.play();
            player.playButton.innerHTML = '停';
            player.isPlaying = true;
        }
    },

    /**
     * 删除单个音频播放器
     */
    _removePlayer: function(playerId) {
        var idx = this._audioPlayers.findIndex(function(p) { return p.id === playerId; });
        if (idx === -1) return;
        var player = this._audioPlayers[idx];
        if (player.audio) { player.audio.pause(); player.audio.src = ''; }
        if (player.element && player.element.parentNode) player.element.parentNode.removeChild(player.element);
        // 从 elements 数组也移除
        var self = this;
        [player.element, player.audio].forEach(function(el) {
            if (el) {
                var ei = self._elements.indexOf(el);
                if (ei !== -1) self._elements.splice(ei, 1);
            }
        });
        this._audioPlayers.splice(idx, 1);
    },

    /**
     * 停止所有播放
     */
    _stopAll: function() {
        this._audioPlayers.forEach(function(p) {
            if (p.isPlaying) {
                p.audio.pause();
                p.playButton.innerHTML = '播';
                p.isPlaying = false;
            }
        });
        this._musicListNodes.forEach(function(n) {
            if (n.isPlaying) {
                n.audio.pause();
                n.isPlaying = false;
                if (n.currentIndex >= 0 && n.playButtons[n.currentIndex]) {
                    n.playButtons[n.currentIndex].textContent = '播';
                }
            }
        });
    },

    /**
     * 清空所有播放器和列表
     */
    _clearAll: function() {
        // 移除所有播放器元素
        this._audioPlayers.forEach(function(p) {
            if (p.audio) p.audio.pause();
        });
        this._musicListNodes.forEach(function(n) {
            if (n.audio) n.audio.pause();
        });

        this._elements.forEach(function(el) {
            if (el && el.parentNode) el.parentNode.removeChild(el);
        });
        this._elements = [];
        this._audioPlayers = [];
        this._musicListNodes = [];
    },

    // ===== 音乐列表 =====

    /**
     * 创建音乐列表节点
     */
    _createMusicListNode: function(audioFiles, wx, wy) {
        var self = this;
        var nodeId = 'music-list-' + Date.now();

        // 创建列表容器
        var node = document.createElement('div');
        node.id = nodeId;
        node.style.cssText = 'position:absolute;left:' + wx + 'px;top:' + wy + 'px;' +
            'width:360px;min-height:280px;max-height:480px;' +
            'background:' + this._colors.listBg + ';border:1px solid ' + this._colors.border + ';' +
            'border-radius:12px;display:flex;flex-direction:column;overflow:hidden;' +
            'box-shadow:0 8px 32px rgba(0,0,0,0.4);pointer-events:auto;user-select:none;z-index:1000;';

        // 标题栏
        var titleBar = document.createElement('div');
        titleBar.style.cssText = 'padding:10px 14px;background:rgba(80,55,35,0.5);' +
            'display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid ' + this._colors.border + ';';

        var title = document.createElement('div');
        title.style.cssText = 'color:' + this._colors.text + ';font-size:14px;font-weight:bold;';
        title.textContent = '🎵 音乐列表 (' + audioFiles.length + '首)';

        // 播放模式按钮组
        var modeButtons = document.createElement('div');
        modeButtons.style.cssText = 'display:flex;gap:4px;';

        var modes = [
            { key: 'single', label: '单曲' },
            { key: 'order', label: '顺序' },
            { key: 'random', label: '随机' }
        ];

        var modeBtns = {};
        modes.forEach(function(m) {
            var btn = document.createElement('button');
            btn.textContent = m.label;
            btn.dataset.mode = m.key;
            var isActive = m.key === 'order';
            btn.style.cssText = 'padding:3px 10px;border:1px solid ' + (isActive ? this._colors.accent : 'rgba(56,189,248,0.15)') + ';' +
                'border-radius:8px;background:' + (isActive ? this._colors.activeBtn : this._colors.inactiveBtn) + ';' +
                'color:' + (isActive ? '#0c1929' : this._colors.text) + ';font-size:11px;cursor:pointer;' +
                'transition:all 0.15s ease;';
            modeButtons.appendChild(btn);
            modeBtns[m.key] = btn;
        }.bind(this));

        // 关闭按钮
        var closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = 'width:24px;height:24px;display:flex;align-items:center;justify-content:center;' +
            'border-radius:50%;background:transparent;color:' + this._colors.textMuted + ';border:none;cursor:pointer;' +
            'font-size:14px;transition:color 0.15s ease;';
        closeBtn.addEventListener('mouseenter', function() { closeBtn.style.color = '#ff6b6b'; });
        closeBtn.addEventListener('mouseleave', function() { closeBtn.style.color = self._colors.textMuted; });

        titleBar.appendChild(title);
        titleBar.appendChild(modeButtons);
        titleBar.appendChild(closeBtn);

        // 列表容器
        var listContainer = document.createElement('div');
        listContainer.style.cssText = 'flex:1;padding:8px;overflow-y:auto;';

        // 列表
        var ul = document.createElement('ul');
        ul.style.cssText = 'list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:4px;';

        // 音频元素
        var audioElement = document.createElement('audio');
        audioElement.style.display = 'none';

        // 列表节点信息
        var listNodeInfo = {
            id: nodeId,
            element: node,
            audio: audioElement,
            audioFiles: audioFiles,
            currentIndex: -1,
            playbackMode: 'order',
            isPlaying: false,
            currentTime: 0,
            playButtons: [],
            listItems: [],
            modeBtns: modeBtns
        };

        // 进度条（列表底部）
        var listProgressContainer = document.createElement('div');
        listProgressContainer.style.cssText = 'padding:8px 14px;background:rgba(80,55,35,0.3);' +
            'border-top:1px solid ' + this._colors.border + ';display:flex;align-items:center;gap:8px;';

        var listProgressBar = document.createElement('div');
        listProgressBar.style.cssText = 'flex:1;height:4px;background:' + this._colors.progressBg + ';' +
            'border-radius:2px;cursor:pointer;position:relative;overflow:hidden;';

        var listProgressFill = document.createElement('div');
        listProgressFill.style.cssText = 'height:100%;width:0%;background:' + this._colors.progressFill + ';' +
            'border-radius:2px;transition:width 0.1s linear;';
        listProgressBar.appendChild(listProgressFill);

        var listTimeLabel = document.createElement('div');
        listTimeLabel.style.cssText = 'color:' + this._colors.textMuted + ';font-size:10px;min-width:70px;text-align:right;';
        listTimeLabel.textContent = '0:00 / 0:00';

        // 音量控制
        var listVolumeIcon = document.createElement('span');
        listVolumeIcon.style.cssText = 'color:' + this._colors.textMuted + ';font-size:12px;cursor:pointer;';
        listVolumeIcon.textContent = '🔊';

        var listVolumeSlider = document.createElement('input');
        listVolumeSlider.type = 'range';
        listVolumeSlider.min = '0';
        listVolumeSlider.max = '100';
        listVolumeSlider.value = '80';
        listVolumeSlider.style.cssText = 'width:50px;height:3px;cursor:pointer;accent-color:' + this._colors.accent + ';';

        listProgressContainer.appendChild(listVolumeIcon);
        listProgressContainer.appendChild(listVolumeSlider);
        listProgressContainer.appendChild(listProgressBar);
        listProgressContainer.appendChild(listTimeLabel);

        // 添加音乐文件到列表
        audioFiles.forEach(function(file, index) {
            var li = document.createElement('li');
            li.style.cssText = 'padding:8px 12px;border:1px solid rgba(56,189,248,0.08);border-radius:10px;' +
                'background:' + self._colors.itemBg + ';cursor:pointer;display:flex;align-items:center;' +
                'justify-content:space-between;transition:background 0.15s ease;';

            // 悬停效果
            li.addEventListener('mouseenter', function() { li.style.background = self._colors.itemHover; });
            li.addEventListener('mouseleave', function() {
                if (listNodeInfo.currentIndex !== index || !listNodeInfo.isPlaying) {
                    li.style.background = self._colors.itemBg;
                }
            });

            // 序号 + 文件名
            var info = document.createElement('div');
            info.style.cssText = 'display:flex;align-items:center;gap:8px;flex:1;min-width:0;';

            var indexLabel = document.createElement('span');
            indexLabel.style.cssText = 'color:' + self._colors.textMuted + ';font-size:11px;min-width:20px;';
            indexLabel.textContent = String(index + 1);

            var fileName = document.createElement('span');
            fileName.style.cssText = 'color:' + self._colors.text + ';font-size:12px;white-space:nowrap;' +
                'overflow:hidden;text-overflow:ellipsis;';
            fileName.textContent = file.name;

            info.appendChild(indexLabel);
            info.appendChild(fileName);

            // 播放按钮
            var playBtn = document.createElement('button');
            playBtn.textContent = '播';
            playBtn.style.cssText = 'width:28px;height:28px;border:none;border-radius:6px;' +
                'background:' + self._colors.inactiveBtn + ';color:' + self._colors.text + ';cursor:pointer;' +
                'display:flex;align-items:center;justify-content:center;font-size:12px;' +
                'transition:background 0.15s ease;flex-shrink:0;';

            playBtn.addEventListener('mouseenter', function() { playBtn.style.background = self._colors.activeBtn; playBtn.style.color = '#0c1929'; });
            playBtn.addEventListener('mouseleave', function() {
                if (listNodeInfo.currentIndex !== index || !listNodeInfo.isPlaying) {
                    playBtn.style.background = self._colors.inactiveBtn;
                    playBtn.style.color = self._colors.text;
                }
            });

            // 添加到数组
            listNodeInfo.playButtons.push(playBtn);
            listNodeInfo.listItems.push(li);

            // 点击播放
            playBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                self._playFromList(listNodeInfo, index);
            });

            li.addEventListener('click', function() {
                self._playFromList(listNodeInfo, index);
            });

            li.appendChild(info);
            li.appendChild(playBtn);
            ul.appendChild(li);
        });

        // 组装
        listContainer.appendChild(ul);
        node.appendChild(titleBar);
        node.appendChild(listContainer);
        node.appendChild(listProgressContainer);

        // 添加到世界层
        this._layer.appendChild(node);
        this._layer.appendChild(audioElement);
        this._elements.push(node);
        this._elements.push(audioElement);

        // 关闭按钮
        closeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            self._removeMusicListNode(nodeId);
        });

        // 播放模式切换
        modes.forEach(function(m) {
            modeBtns[m.key].addEventListener('click', function(e) {
                e.stopPropagation();
                self._setPlaybackMode(listNodeInfo, m.key);
            });
        });

        // 音频事件
        audioElement.addEventListener('timeupdate', function() {
            listNodeInfo.currentTime = audioElement.currentTime;
            if (audioElement.duration) {
                var percent = (audioElement.currentTime / audioElement.duration) * 100;
                listProgressFill.style.width = percent + '%';
                listTimeLabel.textContent = self._formatTime(audioElement.currentTime) + ' / ' + self._formatTime(audioElement.duration);
            }
        });

        audioElement.addEventListener('ended', function() {
            self._handleMusicEnd(listNodeInfo);
        });

        // 进度条点击
        listProgressBar.addEventListener('click', function(e) {
            e.stopPropagation();
            if (audioElement.duration) {
                var rect = listProgressBar.getBoundingClientRect();
                var ratio = (e.clientX - rect.left) / rect.width;
                audioElement.currentTime = ratio * audioElement.duration;
            }
        });

        // 音量控制
        listVolumeSlider.addEventListener('input', function(e) {
            e.stopPropagation();
            var vol = parseInt(e.target.value) / 100;
            audioElement.volume = vol;
            listVolumeIcon.textContent = vol === 0 ? '🔇' : vol < 0.5 ? '🔉' : '🔊';
        });

        listVolumeIcon.addEventListener('click', function(e) {
            e.stopPropagation();
            if (audioElement.volume > 0) {
                listNodeInfo._prevVolume = audioElement.volume;
                audioElement.volume = 0;
                listVolumeSlider.value = '0';
                listVolumeIcon.textContent = '🔇';
            } else {
                var prev = listNodeInfo._prevVolume || 0.8;
                audioElement.volume = prev;
                listVolumeSlider.value = String(Math.round(prev * 100));
                listVolumeIcon.textContent = prev < 0.5 ? '🔉' : '🔊';
            }
        });

        audioElement.volume = 0.8;

        // 添加到音乐列表节点数组
        this._musicListNodes.push(listNodeInfo);

        // 让列表可拖拽
        this._makeDraggable(node, nodeId);

        // 右键拖拽删除
        this._setupRightClickDelete(node, nodeId, true);

        console.log('MusicSkill: 音乐列表创建成功:', nodeId);
    },

    /**
     * 从音乐列表播放
     */
    _playFromList: function(listNodeInfo, index) {
        var self = this;

        // 暂停其他独立播放器
        this._audioPlayers.forEach(function(p) {
            if (p.isPlaying) {
                p.audio.pause();
                p.playButton.innerHTML = '播';
                p.isPlaying = false;
            }
        });

        // 暂停其他音乐列表
        this._musicListNodes.forEach(function(n) {
            if (n.id !== listNodeInfo.id && n.isPlaying) {
                n.audio.pause();
                n.isPlaying = false;
                if (n.currentIndex >= 0 && n.playButtons[n.currentIndex]) {
                    n.playButtons[n.currentIndex].textContent = '播';
                    n.playButtons[n.currentIndex].style.background = self._colors.inactiveBtn;
                    n.playButtons[n.currentIndex].style.color = self._colors.text;
                    n.listItems[n.currentIndex].style.background = self._colors.itemBg;
                }
            }
        });

        var file = listNodeInfo.audioFiles[index];
        var reader = new FileReader();
        reader.onload = function(event) {
            var audioUrl = event.target.result;
            listNodeInfo.audio.src = audioUrl;
            listNodeInfo.currentIndex = index;

            listNodeInfo.audio.play();
            listNodeInfo.isPlaying = true;

            // 更新按钮和列表项状态
            listNodeInfo.playButtons.forEach(function(btn, i) {
                if (i === index) {
                    btn.textContent = '停';
                    btn.style.background = self._colors.activeBtn;
                    btn.style.color = '#0c1929';
                } else {
                    btn.textContent = '播';
                    btn.style.background = self._colors.inactiveBtn;
                    btn.style.color = self._colors.text;
                }
            });

            listNodeInfo.listItems.forEach(function(item, i) {
                item.style.background = (i === index) ? self._colors.itemHover : self._colors.itemBg;
            });
        };
        reader.readAsDataURL(file);
    },

    /**
     * 设置播放模式
     */
    _setPlaybackMode: function(listNodeInfo, mode) {
        var self = this;
        listNodeInfo.playbackMode = mode;

        // 更新按钮样式
        var modes = ['single', 'order', 'random'];
        modes.forEach(function(m) {
            var btn = listNodeInfo.modeBtns[m];
            if (m === mode) {
                btn.style.background = self._colors.activeBtn;
                btn.style.color = '#0c1929';
                btn.style.borderColor = self._colors.accent;
            } else {
                btn.style.background = self._colors.inactiveBtn;
                btn.style.color = self._colors.text;
                btn.style.borderColor = 'rgba(56,189,248,0.15)';
            }
        });
    },

    /**
     * 处理音乐结束
     */
    _handleMusicEnd: function(listNodeInfo) {
        switch (listNodeInfo.playbackMode) {
            case 'single':
                listNodeInfo.audio.currentTime = 0;
                listNodeInfo.audio.play();
                break;
            case 'order':
                if (listNodeInfo.currentIndex < listNodeInfo.audioFiles.length - 1) {
                    this._playFromList(listNodeInfo, listNodeInfo.currentIndex + 1);
                } else {
                    this._playFromList(listNodeInfo, 0);
                }
                break;
            case 'random':
                var randomIndex = Math.floor(Math.random() * listNodeInfo.audioFiles.length);
                this._playFromList(listNodeInfo, randomIndex);
                break;
        }
    },

    /**
     * 移除音乐列表节点
     */
    _removeMusicListNode: function(nodeId) {
        var index = this._musicListNodes.findIndex(function(n) { return n.id === nodeId; });
        if (index !== -1) {
            var nodeInfo = this._musicListNodes[index];
            if (nodeInfo.audio) {
                nodeInfo.audio.pause();
                if (nodeInfo.audio.parentNode) nodeInfo.audio.parentNode.removeChild(nodeInfo.audio);
            }
            if (nodeInfo.element && nodeInfo.element.parentNode) {
                nodeInfo.element.parentNode.removeChild(nodeInfo.element);
            }
            // 从 _elements 中移除
            var elIdx = this._elements.indexOf(nodeInfo.element);
            if (elIdx !== -1) this._elements.splice(elIdx, 1);
            var audioIdx = this._elements.indexOf(nodeInfo.audio);
            if (audioIdx !== -1) this._elements.splice(audioIdx, 1);

            this._musicListNodes.splice(index, 1);
        }
    },

    // ===== 通用功能 =====

    /**
     * 格式化时间（秒 -> m:ss）
     */
    _formatTime: function(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        var mins = Math.floor(seconds / 60);
        var secs = Math.floor(seconds % 60);
        return mins + ':' + (secs < 10 ? '0' : '') + secs;
    },

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
            el.style.cursor = '';
            el.style.zIndex = '1000';
        };

        this._world.on('mousemove', onMove);
        this._world.on('mouseup', onUp);

        // 记住清理函数
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
    _setupRightClickDelete: function(element, id, isListNode) {
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
                if (isListNode) {
                    self._removeMusicListNode(id);
                } else {
                    self._removeAudioPlayer(id);
                }
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
     * 移除单个音频播放器
     */
    _removeAudioPlayer: function(playerId) {
        var index = this._audioPlayers.findIndex(function(p) { return p.id === playerId; });
        if (index !== -1) {
            var player = this._audioPlayers[index];
            if (player.audio) {
                player.audio.pause();
                if (player.audio.parentNode) player.audio.parentNode.removeChild(player.audio);
            }
            if (player.element && player.element.parentNode) {
                player.element.parentNode.removeChild(player.element);
            }
            // 从 _elements 中移除
            var elIdx = this._elements.indexOf(player.element);
            if (elIdx !== -1) this._elements.splice(elIdx, 1);
            var audioIdx = this._elements.indexOf(player.audio);
            if (audioIdx !== -1) this._elements.splice(audioIdx, 1);

            // 清理拖拽事件
            if (player.element && player.element._cleanup) {
                player.element._cleanup();
            }

            this._audioPlayers.splice(index, 1);
        }
    }
};
