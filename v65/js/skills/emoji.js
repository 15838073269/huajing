/**
 * ============================================
 *   Emoji 放置插件 - v65 技能
 *   从 v64/drawing.js 提取 Emoji 部分
 * ============================================
 *
 * 功能：
 * - Emoji 分类菜单（中医七情、军事、天气、自然、动物、人物、建筑等）
 * - 点击画布放置 Emoji
 * - 放置的 Emoji 可拖拽移动
 * - Emoji 大小调整
 * - 删除已放置的 Emoji（右键或选中后删除）
 */
var EmojiSkill = {
    // ===== 基本信息 =====
    id: 'emoji',
    name: 'Emoji',
    icon: '颜',
    description: '分类表情素材放置到画布',
    key: '3',

    // ===== 内部状态 =====
    _world: null,
    _layer: null,
    _emojis: [],               // 已放置的 Emoji 数据 [{id, element, x, y, emoji, size}, ...]
    _selectedEmoji: null,      // 当前选中的 Emoji 字符
    _selectedElement: null,    // 当前选中的已放置 Emoji DOM 元素
    _isDragging: false,        // 是否正在拖拽
    _emojiSize: 50,            // 默认 Emoji 大小
    _menuPanel: null,          // Emoji 分类菜单面板
    _menuVisible: false,       // 菜单是否可见
    _currentCategory: 'emotion-joy', // 当前选中的分类

    // ===== Emoji 分类数据 =====
    _categories: [
        {
            id: 'emotion-joy',
            name: '喜',
            emojis: ['🙂', '😊', '😀', '😃', '😄', '😁', '😆', '🤣']
        },
        {
            id: 'emotion-anger',
            name: '怒',
            emojis: ['😒', '😠', '😡', '😤', '🤬', '🤯', '😈', '👿']
        },
        {
            id: 'emotion-worry',
            name: '忧',
            emojis: ['🙁', '😔', '😟', '😞', '😣', '😖', '😫', '😩']
        },
        {
            id: 'emotion-think',
            name: '思',
            emojis: ['🤔', '🧐', '😌', '😶', '😐', '😑', '😬', '🤐']
        },
        {
            id: 'emotion-sad',
            name: '悲',
            emojis: ['☹️', '😕', '😢', '😭', '🥺', '😪', '😓', '😥']
        },
        {
            id: 'emotion-fear',
            name: '恐',
            emojis: ['😱', '😨', '😰', '😳', '😧', '😦', '😮', '😲']
        },
        {
            id: 'emotion-surprise',
            name: '惊',
            emojis: ['😯', '😲', '😳', '😱', '😨', '😰', '🥵', '🥶']
        },
        {
            id: 'military',
            name: '军事',
            emojis: ['🏴', '🏳️', '🏁', '⚔️', '🛡️', '🚀', '✈️', '🚛',
                     '🚜', '💣', '🎯', '🔫', '🏹', '⚙️', '⛓️', '⚠️',
                     '🎰', '🎮', '🎪', '🎭', '🎨', '🎬']
        },
        {
            id: 'weather',
            name: '天气',
            emojis: ['☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️',
                     '🌩️', '⚡', '🌪️', '🌫️', '🌬️', '❄️', '☃️', '⛄',
                     '🌨️', '🌊', '☔', '🌈', '🌂', '🌞', '🌝', '🌛',
                     '🌜', '🌚', '🌕', '🌖', '🌗']
        },
        {
            id: 'nature',
            name: '自然',
            emojis: ['🏔️', '⛰️', '🌋', '🌄', '🌅', '🌆', '🌇', '🌉',
                     '🌌', '🌠', '🏕️', '⛺', '🏖️', '🏝️', '🏜️', '🏞️',
                     '🏟️', '🎢', '🎠']
        },
        {
            id: 'animal',
            name: '动物',
            emojis: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
                     '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵',
                     '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤',
                     '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗',
                     '🐴', '🦄', '🐝', '🪱', '🐛', '🦋', '🐌', '🐞',
                     '🐜', '🦟', '🦗', '🕷️', '🕸️', '🦂', '🐢', '🐍',
                     '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀',
                     '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊']
        },
        {
            id: 'person',
            name: '人物',
            emojis: ['👶', '👧', '🧒', '👦', '👩', '🧑', '👨', '🧓',
                     '👴', '👱', '👩‍🦰', '👨‍🦰', '👩‍🦱', '👮‍♂️', '👷', '👷‍♀️',
                     '👩‍⚕️', '👩‍🎓', '👨‍🏫', '👨‍💻', '👩‍💼', '👨‍💼', '👩‍🔧',
                     '👨‍🔧', '👩‍🎤', '👨‍🎤', '👩‍🎨', '👨‍🎨', '👩‍✈️',
                     '👨‍✈️', '👩‍🚀', '👸', '👳']
        },
        {
            id: 'building',
            name: '建筑',
            emojis: ['🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏨',
                     '🏩', '🏪', '🏫', '🏬', '🏭', '🏯', '🏰', '💒',
                     '🗽', '🌁', '🌃']
        }
    ],

    // ===== 生命周期 =====

    activate: function(world) {
        this._world = world;
        this._layer = world.getLayer();

        // 创建 Emoji 分类菜单面板
        this._createMenuPanel();

        // 绑定事件
        this._bindEvents();

        // 更新子工具栏
        SkillSystem.renderSubTools();
    },

    deactivate: function() {
        this._unbindEvents();

        // 移除菜单面板
        if (this._menuPanel && this._menuPanel.parentNode) {
            this._menuPanel.parentNode.removeChild(this._menuPanel);
        }
        this._menuPanel = null;
        this._menuVisible = false;

        // 取消选中状态
        this._deselectEmoji();

        // 清理所有已放置的 Emoji 元素
        this._emojis.forEach(function(item) {
            if (item.element && item.element.parentNode) {
                item.element.parentNode.removeChild(item.element);
            }
        });
        this._emojis = [];
    },

    // ===== 子工具栏 =====

    getSubTools: function() {
        var self = this;

        // 大小滑块
        var sizeSlider = '<input type="range" id="emoji-size-slider" min="20" max="120" value="' + this._emojiSize + '" ' +
            'style="width:80px;vertical-align:middle;cursor:pointer;accent-color:#38bdf8;">' +
            '<span id="emoji-size-label" style="color:#e8edf5;font-size:12px;margin-left:4px;">' + this._emojiSize + 'px</span>';

        return [
            {
                label: '📋 Emoji 菜单',
                action: function() {
                    self._toggleMenu();
                }
            },
            {
                label: sizeSlider,
                action: function() {
                    // 大小滑块由浏览器原生处理
                    var slider = document.getElementById('emoji-size-slider');
                    var label = document.getElementById('emoji-size-label');
                    if (slider) {
                        slider.addEventListener('input', function(e) {
                            self._emojiSize = parseInt(e.target.value);
                            if (label) label.textContent = e.target.value + 'px';
                            // 如果有选中的已放置 Emoji，实时调整其大小
                            if (self._selectedElement) {
                                self._selectedElement.style.fontSize = self._emojiSize + 'px';
                                // 更新数据
                                var idx = self._findEmojiIndex(self._selectedElement);
                                if (idx !== -1) {
                                    self._emojis[idx].size = self._emojiSize;
                                }
                            }
                        });
                    }
                }
            },
            {
                label: '🗑️ 删除选中',
                action: function() {
                    self._deleteSelected();
                }
            },
            {
                label: '🗑️ 清空全部',
                action: function() {
                    self._clearAll();
                }
            }
        ];
    },

    // ===== 保存/恢复 =====

    save: function() {
        // 序列化所有已放置的 Emoji 数据
        var emojiData = this._emojis.map(function(item) {
            return {
                id: item.id,
                x: item.x,
                y: item.y,
                emoji: item.emoji,
                size: item.size
            };
        });

        return {
            emojis: emojiData,
            emojiSize: this._emojiSize,
            currentCategory: this._currentCategory
        };
    },

    load: function(data) {
        if (!data) return;

        this._emojiSize = data.emojiSize || 50;
        this._currentCategory = data.currentCategory || 'emotion-joy';

        // 恢复已放置的 Emoji
        if (data.emojis && data.emojis.length > 0) {
            var self = this;
            data.emojis.forEach(function(item) {
                self._restoreEmoji(item);
            });
        }
    },

    // ===== Emoji 分类菜单 =====

    /**
     * 创建 Emoji 分类菜单面板（浮动面板）
     */
    _createMenuPanel: function() {
        var self = this;

        this._menuPanel = document.createElement('div');
        this._menuPanel.style.cssText = 'position:fixed;top:80px;right:20px;width:360px;max-height:500px;' +
            'background:rgba(15,25,50,0.85);border:1px solid rgba(100,160,255,0.15);' +
            'border-radius:16px;overflow:hidden;z-index:10000;display:none;' +
            'box-shadow:0 8px 32px rgba(0,0,0,0.4);font-family:system-ui,sans-serif;backdrop-filter:blur(24px) saturate(180%);';

        // 分类标签栏
        var tabBar = document.createElement('div');
        tabBar.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;padding:8px 10px;' +
            'background:rgba(10,15,35,0.7);border-bottom:1px solid rgba(100,160,255,0.1);';

        this._categories.forEach(function(cat) {
            var tab = document.createElement('button');
            tab.textContent = cat.name;
            tab.dataset.category = cat.id;
            tab.style.cssText = 'padding:4px 10px;border:1px solid rgba(100,160,255,0.15);' +
                'border-radius:6px;background:rgba(20,30,60,0.65);color:#e8edf5;font-size:12px;' +
                'cursor:pointer;transition:all 0.2s ease;';
            tab.addEventListener('mouseenter', function() {
                if (self._currentCategory !== cat.id) {
                    tab.style.background = 'rgba(56,189,248,0.12)';
                    tab.style.borderColor = 'rgba(56,189,248,0.25)';
                }
            });
            tab.addEventListener('mouseleave', function() {
                if (self._currentCategory !== cat.id) {
                    tab.style.background = 'rgba(20,30,60,0.65)';
                    tab.style.borderColor = 'rgba(100,160,255,0.15)';
                }
            });
            tab.addEventListener('click', function(e) {
                e.stopPropagation();
                self._currentCategory = cat.id;
                self._renderEmojiGrid();
                self._updateTabStyle();
            });
            tabBar.appendChild(tab);
        });

        this._menuPanel.appendChild(tabBar);

        // Emoji 网格容器
        var gridContainer = document.createElement('div');
        gridContainer.style.cssText = 'padding:10px;max-height:400px;overflow-y:auto;';
        gridContainer.id = 'emoji-skill-grid-container';

        this._menuPanel.appendChild(gridContainer);

        document.body.appendChild(this._menuPanel);

        // 渲染默认分类
        this._renderEmojiGrid();
        this._updateTabStyle();
    },

    /**
     * 更新分类标签的选中样式
     */
    _updateTabStyle: function() {
        var tabs = this._menuPanel.querySelectorAll('[data-category]');
        var self = this;
        tabs.forEach(function(tab) {
            if (tab.dataset.category === self._currentCategory) {
                tab.style.background = 'rgba(56,189,248,0.15)';
                tab.style.borderColor = 'rgba(56,189,248,0.3)';
                tab.style.color = '#38bdf8';
            } else {
                tab.style.background = 'rgba(20,30,60,0.65)';
                tab.style.borderColor = 'rgba(100,160,255,0.15)';
                tab.style.color = '#e8edf5';
            }
        });
    },

    /**
     * 渲染当前分类的 Emoji 网格
     */
    _renderEmojiGrid: function() {
        var container = document.getElementById('emoji-skill-grid-container');
        if (!container) return;

        container.innerHTML = '';

        var self = this;
        var category = null;
        for (var i = 0; i < this._categories.length; i++) {
            if (this._categories[i].id === this._currentCategory) {
                category = this._categories[i];
                break;
            }
        }
        if (!category) return;

        var grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(8,1fr);gap:4px;';

        category.emojis.forEach(function(emoji) {
            var btn = document.createElement('button');
            btn.textContent = emoji;
            btn.style.cssText = 'width:36px;height:36px;border:none;border-radius:8px;' +
                'background:rgba(20,30,60,0.65);cursor:pointer;transition:all 0.2s ease;' +
                'font-size:22px;display:flex;align-items:center;justify-content:center;';
            btn.addEventListener('mouseenter', function() {
                btn.style.transform = 'scale(1.2)';
                btn.style.background = 'rgba(56,189,248,0.25)';
            });
            btn.addEventListener('mouseleave', function() {
                btn.style.transform = 'scale(1)';
                btn.style.background = 'rgba(20,30,60,0.65)';
            });
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                self._selectEmoji(emoji);
            });
            grid.appendChild(btn);
        });

        container.appendChild(grid);
    },

    /**
     * 切换 Emoji 菜单显示/隐藏
     */
    _toggleMenu: function() {
        if (this._menuVisible) {
            this._hideMenu();
        } else {
            this._showMenu();
        }
    },

    /**
     * 显示 Emoji 菜单
     */
    _showMenu: function() {
        if (this._menuPanel) {
            this._menuPanel.style.display = 'block';
            this._menuVisible = true;
        }
    },

    /**
     * 隐藏 Emoji 菜单
     */
    _hideMenu: function() {
        if (this._menuPanel) {
            this._menuPanel.style.display = 'none';
            this._menuVisible = false;
        }
    },

    /**
     * 选择一个 Emoji（准备放置）
     * @param {string} emoji - Emoji 字符
     */
    _selectEmoji: function(emoji) {
        this._selectedEmoji = emoji;
        // 不隐藏菜单，允许连续添加相同的 Emoji
    },

    // ===== Emoji 放置与管理 =====

    /**
     * 在世界坐标位置放置 Emoji
     * @param {number} wx - 世界坐标X
     * @param {number} wy - 世界坐标Y
     */
    _placeEmoji: function(wx, wy) {
        if (!this._selectedEmoji) return;

        var self = this;
        var halfSize = this._emojiSize / 2;

        // 创建 Emoji 元素
        var el = document.createElement('div');
        el.textContent = this._selectedEmoji;
        el.style.cssText = 'position:absolute;pointer-events:auto;cursor:move;' +
            'user-select:none;z-index:15;line-height:1;';
        el.style.left = (wx - halfSize) + 'px';
        el.style.top = (wy - halfSize) + 'px';
        el.style.fontSize = this._emojiSize + 'px';
        el.className = 'emoji-skill-item';

        // 生成唯一 ID
        var id = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        el.dataset.emojiId = id;

        // 添加到世界层
        this._layer.appendChild(el);

        // 保存数据
        var emojiData = {
            id: id,
            element: el,
            x: wx - halfSize,
            y: wy - halfSize,
            emoji: this._selectedEmoji,
            size: this._emojiSize
        };
        this._emojis.push(emojiData);

        // 标记内容区域
        this._world.markContent(wx - halfSize, wy - halfSize, this._emojiSize, this._emojiSize);

        // 让 Emoji 可拖拽
        this._makeDraggable(el);

        // 点击选中 Emoji
        el.addEventListener('click', function(e) {
            e.stopPropagation();
            self._selectPlacedEmoji(el);
        });

        // 右键删除
        el.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self._removeEmoji(el);
        });
    },

    /**
     * 恢复已保存的 Emoji
     * @param {Object} data - Emoji 数据 {id, x, y, emoji, size}
     */
    _restoreEmoji: function(data) {
        var self = this;

        var el = document.createElement('div');
        el.textContent = data.emoji;
        el.style.cssText = 'position:absolute;pointer-events:auto;cursor:move;' +
            'user-select:none;z-index:15;line-height:1;';
        el.style.left = data.x + 'px';
        el.style.top = data.y + 'px';
        el.style.fontSize = (data.size || 50) + 'px';
        el.className = 'emoji-skill-item';
        el.dataset.emojiId = data.id;

        this._layer.appendChild(el);

        var emojiData = {
            id: data.id,
            element: el,
            x: data.x,
            y: data.y,
            emoji: data.emoji,
            size: data.size || 50
        };
        this._emojis.push(emojiData);

        this._world.markContent(data.x, data.y, data.size || 50, data.size || 50);

        // 让 Emoji 可拖拽
        this._makeDraggable(el);

        // 点击选中
        el.addEventListener('click', function(e) {
            e.stopPropagation();
            self._selectPlacedEmoji(el);
        });

        // 右键删除
        el.addEventListener('contextmenu', function(e) {
            e.preventDefault();
            e.stopPropagation();
            self._removeEmoji(el);
        });
    },

    /**
     * 让 Emoji 元素可在世界中拖拽
     * @param {HTMLElement} el - Emoji DOM 元素
     */
    _makeDraggable: function(el) {
        var self = this;
        var isDragging = false;
        var startWorldX, startWorldY, origLeft, origTop;

        el.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return;
            e.stopPropagation();

            isDragging = true;
            startWorldX = e.clientX;
            startWorldY = e.clientY;
            origLeft = parseFloat(el.style.left);
            origTop = parseFloat(el.style.top);
            el.style.cursor = 'grabbing';
            el.style.zIndex = '20'; // 拖拽时提升层级
        });

        var onMove = function(data) {
            if (!isDragging) return;

            // 使用世界坐标差来计算新位置
            var worldStart = self._world.screenToWorld(startWorldX, startWorldY);
            var worldNow = self._world.screenToWorld(data.screenX, data.screenY);
            var newX = origLeft + (worldNow.x - worldStart.x);
            var newY = origTop + (worldNow.y - worldStart.y);

            el.style.left = newX + 'px';
            el.style.top = newY + 'px';

            // 更新数据
            var idx = self._findEmojiIndex(el);
            if (idx !== -1) {
                self._emojis[idx].x = newX;
                self._emojis[idx].y = newY;
            }
        };

        var onUp = function() {
            if (!isDragging) return;
            isDragging = false;
            el.style.cursor = 'move';
            el.style.zIndex = '15';
        };

        this._world.on('mousemove', onMove);
        this._world.on('mouseup', onUp);

        // 记住清理函数
        el._cleanup = function() {
            self._world.off('mousemove', onMove);
            self._world.off('mouseup', onUp);
        };
    },

    /**
     * 选中已放置的 Emoji
     * @param {HTMLElement} el - Emoji DOM 元素
     */
    _selectPlacedEmoji: function(el) {
        // 先取消之前的选中
        this._deselectEmoji();

        this._selectedElement = el;
        el.style.outline = '2px solid rgba(56,189,248,0.8)';
        el.style.outlineOffset = '4px';
        el.style.borderRadius = '4px';
    },

    /**
     * 取消选中
     */
    _deselectEmoji: function() {
        if (this._selectedElement) {
            this._selectedElement.style.outline = 'none';
            this._selectedElement = null;
        }
    },

    /**
     * 删除选中的 Emoji
     */
    _deleteSelected: function() {
        if (this._selectedElement) {
            this._removeEmoji(this._selectedElement);
        }
    },

    /**
     * 删除指定的 Emoji
     * @param {HTMLElement} el - Emoji DOM 元素
     */
    _removeEmoji: function(el) {
        var idx = this._findEmojiIndex(el);
        if (idx !== -1) {
            var item = this._emojis[idx];

            // 清理事件
            if (item.element._cleanup) item.element._cleanup();

            // 清除内容标记
            this._world.clearContent(item.x, item.y, item.size, item.size);

            // 移除 DOM 元素
            if (item.element && item.element.parentNode) {
                item.element.parentNode.removeChild(item.element);
            }

            // 从数组中移除
            this._emojis.splice(idx, 1);

            // 如果删除的是选中的元素，取消选中
            if (this._selectedElement === el) {
                this._selectedElement = null;
            }
        }
    },

    /**
     * 清空所有已放置的 Emoji
     */
    _clearAll: function() {
        var self = this;
        // 倒序遍历，安全删除
        for (var i = this._emojis.length - 1; i >= 0; i--) {
            var item = this._emojis[i];
            if (item.element._cleanup) item.element._cleanup();
            this._world.clearContent(item.x, item.y, item.size, item.size);
            if (item.element && item.element.parentNode) {
                item.element.parentNode.removeChild(item.element);
            }
        }
        this._emojis = [];
        this._selectedElement = null;
    },

    /**
     * 根据 DOM 元素查找 Emoji 数据索引
     * @param {HTMLElement} el - Emoji DOM 元素
     * @returns {number} 索引，-1 表示未找到
     */
    _findEmojiIndex: function(el) {
        var id = el.dataset.emojiId;
        for (var i = 0; i < this._emojis.length; i++) {
            if (this._emojis[i].id === id) return i;
        }
        return -1;
    },

    // ===== 事件绑定 =====

    _bindEvents: function() {
        var self = this;

        // 点击世界放置 Emoji
        this._onWorldClick = function(e) {
            // 排除 UI 元素和 Emoji 元素上的点击
            if (e.target.closest('.cos-hotbar') || e.target.closest('.cos-hud') ||
                e.target.closest('.cos-subtools') || e.target.closest('.cos-overlay') ||
                e.target.closest('.emoji-skill-item')) return;

            // 如果有选中的 Emoji，放置到点击位置
            if (self._selectedEmoji) {
                var worldPos = self._world.screenToWorld(e.clientX, e.clientY);
                self._placeEmoji(worldPos.x, worldPos.y);
            } else {
                // 点击空白处取消选中
                self._deselectEmoji();
            }
        };

        // 点击世界外部关闭菜单
        this._onDocClick = function(e) {
            if (self._menuVisible && !self._menuPanel.contains(e.target)) {
                self._hideMenu();
            }
        };

        // 右键菜单阻止默认行为
        this._onContextMenu = function(e) {
            // 如果右键点击的是 Emoji，由 Emoji 自身处理
            if (e.target.closest('.emoji-skill-item')) return;
            // 其他区域阻止默认右键菜单
            e.preventDefault();
        };

        document.addEventListener('click', this._onDocClick);
        this._world.on('click', this._onWorldClick);
        this._world.on('contextmenu', this._onContextMenu);
    },

    _unbindEvents: function() {
        if (!this._world) return;

        document.removeEventListener('click', this._onDocClick);

        if (this._onWorldClick) this._world.off('click', this._onWorldClick);
        if (this._onContextMenu) this._world.off('contextmenu', this._onContextMenu);

        // 清理所有 Emoji 元素的事件
        this._emojis.forEach(function(item) {
            if (item.element && item.element._cleanup) {
                item.element._cleanup();
            }
        });
    }
};
