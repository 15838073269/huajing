/**
 * ============================================
 *   画板插件 - v65 技能
 *   从 v64/drawing.js 提取绘图部分
 * ============================================
 *
 * 功能：
 * - SVG 路径绘制（画笔工具）
 * - 橡皮擦工具
 * - 画笔颜色选择
 * - 画笔粗细调整
 * - 清空画布
 * - 绘制在世界层上（使用 world.getLayer()）
 * - 支持世界缩放和平移（坐标转换用 world.screenToWorld）
 */
var DrawingSkill = {
    // ===== 基本信息 =====
    id: 'drawing',
    name: '画板',
    icon: '绘',
    description: 'SVG画笔+橡皮擦自由绘制',
    key: '2',

    // ===== 内部状态 =====
    _world: null,
    _currentTool: null,       // 'brush' | 'eraser' | null
    _brushColor: '#e8a040',
    _brushSize: 3,
    _paths: [],               // 已完成的路径数据
    _currentPath: null,       // 当前正在绘制的路径
    _isDrawing: false,
    _isErasing: false,
    _svgGroup: null,          // SVG <g> 容器
    _svgCanvas: null,         // SVG 根元素
    // 事件处理函数引用

    // ===== 生命周期 =====

    activate: function(world) {
        this._world = world;

        // SVG 画布放到 document.body 上，position:fixed 确保在所有插件窗口之上
        if (!this._svgCanvas) {
            this._svgCanvas = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            this._svgCanvas.setAttribute('id', 'drawing-skill-svg');
            this._svgCanvas.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;' +
                'pointer-events:none;z-index:10001;overflow:visible;';
            this._svgGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            this._svgGroup.setAttribute('id', 'drawing-skill-group');
            this._svgCanvas.appendChild(this._svgGroup);
        }

        // 添加到 document.body
        if (!this._svgCanvas.parentNode) {
            document.body.appendChild(this._svgCanvas);
        }

        // 绑定事件
        this._bindEvents();

        // 默认激活画笔
        this._currentTool = 'brush';

        // 更新子工具栏
        SkillSystem.renderSubTools();
    },

    deactivate: function() {
        // 只解绑绘画事件，保留 SVG 画布
        this._unbindEvents();
        this._currentTool = null;
        this._isDrawing = false;
        this._isErasing = false;
    },

    // ===== 子工具栏 =====

    getSubTools: function() {
        var self = this;

        // 颜色选择器 HTML
        var colorPicker = '<input type="color" id="drawing-color-picker" value="' + this._brushColor + '" ' +
            'style="width:28px;height:28px;border:2px solid rgba(255,220,180,0.3);border-radius:6px;' +
            'cursor:pointer;background:transparent;padding:0;">';

        // 粗细滑块 HTML
        var sizeSlider = '<input type="range" id="drawing-size-slider" min="1" max="99" value="' + this._brushSize + '" ' +
            'style="width:80px;vertical-align:middle;cursor:pointer;accent-color:#e8a040;">' +
            '<span id="drawing-size-label" style="color:#f0e6d8;font-size:12px;margin-left:4px;">' + this._brushSize + 'px</span>';

        return [
            {
                label: '画笔' + (this._currentTool === 'brush' ? ' ✓' : ''),
                action: function() {
                    self._currentTool = 'brush';
                    SkillSystem.renderSubTools();
                }
            },
            {
                label: '橡皮擦' + (this._currentTool === 'eraser' ? ' ✓' : ''),
                action: function() {
                    self._currentTool = 'eraser';
                    SkillSystem.renderSubTools();
                }
            },
            {
                html: colorPicker
            },
            {
                html: sizeSlider
            },
            {
                label: '清空',
                action: function() {
                    self._clearDrawing();
                }
            }
        ];
    },

    // ===== 保存/恢复 =====

    save: function() {
        return {
            paths: this._paths,
            brushColor: this._brushColor,
            brushSize: this._brushSize,
            currentTool: this._currentTool
        };
    },

    load: function(data) {
        if (!data) return;
        this._brushColor = data.brushColor || '#e8a040';
        this._brushSize = data.brushSize || 3;
        this._currentTool = data.currentTool || 'brush';

        // 恢复路径
        if (data.paths && data.paths.length > 0) {
            this._paths = data.paths;
            var self = this;
            this._paths.forEach(function(pathData) {
                self._renderPath(pathData);
            });
        }
    },

    // ===== 绘画核心逻辑 =====

    /**
     * 开始绘画
     * @param {number} wx - 世界坐标X
     * @param {number} wy - 世界坐标Y
     */
    _startDrawing: function(wx, wy) {
        if (this._currentTool === 'brush') {
            this._isDrawing = true;
            this._currentPath = {
                id: Date.now(),
                color: this._brushColor,
                size: this._brushSize,
                points: [{ x: wx, y: wy }]
            };
        } else if (this._currentTool === 'eraser') {
            this._erase(wx, wy);
            this._isErasing = true;
        }
    },

    /**
     * 绘制中
     * @param {number} wx - 世界坐标X
     * @param {number} wy - 世界坐标Y
     */
    _draw: function(wx, wy) {
        if (this._currentTool === 'brush' && this._isDrawing) {
            this._currentPath.points.push({ x: wx, y: wy });
            this._renderCurrentPath();
        } else if (this._currentTool === 'eraser' && this._isErasing) {
            this._erase(wx, wy);
        }
    },

    /**
     * 结束绘画
     */
    _endDrawing: function() {
        if (this._isDrawing && this._currentPath) {
            // 确保路径有足够的点
            if (this._currentPath.points.length > 1) {
                this._paths.push(this._currentPath);
                this._renderPath(this._currentPath);
            } else {
                // 清除临时路径
                var tempPath = document.getElementById('drawing-temp-path');
                if (tempPath) tempPath.remove();
            }
            this._currentPath = null;
            this._isDrawing = false;
        }
        this._isErasing = false;
    },

    /**
     * 渲染当前正在绘制的临时路径
     */
    _renderCurrentPath: function() {
        // 清除之前的临时路径
        var tempPath = document.getElementById('drawing-temp-path');
        if (tempPath) tempPath.remove();

        // 创建临时路径
        var path = this._createPathElement(this._currentPath);
        path.setAttribute('id', 'drawing-temp-path');
        if (this._svgGroup) {
            this._svgGroup.appendChild(path);
        }
    },

    /**
     * 渲染已完成的路径
     * @param {Object} pathData - 路径数据 { id, color, size, points }
     */
    _renderPath: function(pathData) {
        // 清除临时路径
        var tempPath = document.getElementById('drawing-temp-path');
        if (tempPath) tempPath.remove();

        var path = this._createPathElement(pathData);
        path.setAttribute('id', 'drawing-path-' + pathData.id);
        if (this._svgGroup) {
            this._svgGroup.appendChild(path);
        }
    },

    /**
     * 创建 SVG path 元素
     * @param {Object} pathData - 路径数据
     * @returns {SVGPathElement}
     */
    _createPathElement: function(pathData) {
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        var d = this._generatePathD(pathData.points);
        path.setAttribute('d', d);
        path.setAttribute('class', 'drawing-skill-path');
        path.setAttribute('stroke', pathData.color);
        path.setAttribute('stroke-width', pathData.size);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');
        path.setAttribute('stroke-linejoin', 'round');
        // 不设置 pointer-events 和 cursor，避免鼠标图标闪烁
        return path;
    },

    /**
     * 生成路径的 d 属性字符串
     * @param {Array} points - 点数组 [{x, y}, ...]
     * @returns {string}
     */
    _generatePathD: function(points) {
        if (points.length < 2) return '';

        var d = 'M ' + points[0].x + ' ' + points[0].y;
        for (var i = 1; i < points.length; i++) {
            d += ' L ' + points[i].x + ' ' + points[i].y;
        }
        return d;
    },

    /**
     * 擦除功能 - 删除靠近指定世界坐标的路径
     * @param {number} wx - 世界坐标X
     * @param {number} wy - 世界坐标Y
     */
    _erase: function(wx, wy) {
        var hasErased = false;

        // 检查并处理已保存的路径
        for (var i = this._paths.length - 1; i >= 0; i--) {
            var path = this._paths[i];
            if (this._isPointNearPath(wx, wy, path)) {
                this._paths.splice(i, 1);
                var pathElement = document.getElementById('drawing-path-' + path.id);
                if (pathElement) pathElement.remove();
                hasErased = true;
            }
        }

        // 检查并处理当前正在绘制的临时路径
        if (this._currentPath && this._isPointNearPath(wx, wy, this._currentPath)) {
            this._currentPath = null;
            this._isDrawing = false;
            var tempPath = document.getElementById('drawing-temp-path');
            if (tempPath) tempPath.remove();
            hasErased = true;
        }

        // 重绘所有路径，确保视觉更新
        this._renderAllPaths();

        return hasErased;
    },

    /**
     * 检查点是否靠近路径
     * @param {number} x - 世界坐标X
     * @param {number} y - 世界坐标Y
     * @param {Object} path - 路径数据
     * @returns {boolean}
     */
    _isPointNearPath: function(x, y, path) {
        var points = path.points;
        var threshold = path.size + 10; // 橡皮擦阈值

        for (var i = 0; i < points.length - 1; i++) {
            var p1 = points[i];
            var p2 = points[i + 1];
            var distance = this._getDistanceToLine(x, y, p1, p2);
            if (distance <= threshold) {
                return true;
            }
        }
        return false;
    },

    /**
     * 计算点到线段的距离
     * @param {number} px - 点X
     * @param {number} py - 点Y
     * @param {Object} p1 - 线段起点 {x, y}
     * @param {Object} p2 - 线段终点 {x, y}
     * @returns {number}
     */
    _getDistanceToLine: function(px, py, p1, p2) {
        var A = px - p1.x;
        var B = py - p1.y;
        var C = p2.x - p1.x;
        var D = p2.y - p1.y;

        var dot = A * C + B * D;
        var lenSq = C * C + D * D;
        var param = -1;

        if (lenSq !== 0) {
            param = dot / lenSq;
        }

        var xx, yy;

        if (param < 0) {
            xx = p1.x;
            yy = p1.y;
        } else if (param > 1) {
            xx = p2.x;
            yy = p2.y;
        } else {
            xx = p1.x + param * C;
            yy = p1.y + param * D;
        }

        var dx = px - xx;
        var dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    },

    /**
     * 清空所有绘画
     */
    _clearDrawing: function() {
        if (this._paths.length === 0) return;

        // 清空路径数组
        this._paths = [];

        // 清空 SVG 中的所有路径
        if (this._svgGroup) {
            this._svgGroup.innerHTML = '';
        }
    },

    /**
     * 重绘所有已保存的路径
     */
    _renderAllPaths: function() {
        if (!this._svgGroup) return;

        // 清空现有路径
        this._svgGroup.innerHTML = '';

        // 重新渲染所有路径
        var self = this;
        this._paths.forEach(function(path) {
            self._renderPath(path);
        });
    },

    // ===== 事件绑定 =====

    _bindEvents: function() {
        var self = this;

        // 鼠标按下 - 开始绘画（捕获阶段，阻止画布平移）
        this._onMouseDown = function(e) {
            if (e.button !== 0) return;
            // 只在世界层上才开始绘画，其他UI元素不拦截
            var worldEl = document.getElementById('cos-world');
            if (!worldEl || !worldEl.contains(e.target)) return;

            // 阻止事件到达世界层内部处理，避免触发画布平移
            e.stopPropagation();

            var worldPos = self._world.screenToWorld(e.clientX, e.clientY);
            self._startDrawing(worldPos.x, worldPos.y);
        };

        // 鼠标移动 - 绘制中
        this._onMouseMove = function(e) {
            if (!self._isDrawing && !self._isErasing) return;

            var worldPos = self._world.screenToWorld(e.clientX, e.clientY);
            self._draw(worldPos.x, worldPos.y);
        };

        // 鼠标松开 - 结束绘画
        this._onMouseUp = function(e) {
            if (self._isDrawing || self._isErasing) {
                self._endDrawing();
            }
        };

        // 使用 document 捕获阶段监听，优先于世界层
        document.addEventListener('mousedown', this._onMouseDown, true);
        document.addEventListener('mousemove', this._onMouseMove);
        document.addEventListener('mouseup', this._onMouseUp);

        // 颜色选择器和粗细滑块 - 事件委托
        this._onSubtoolsDelegate = function(e) {
            if (e.target.id === 'drawing-color-picker') {
                self._brushColor = e.target.value;
            } else if (e.target.id === 'drawing-size-slider') {
                self._brushSize = parseInt(e.target.value);
                var label = document.getElementById('drawing-size-label');
                if (label) label.textContent = e.target.value + 'px';
            }
        };
        document.addEventListener('input', this._onSubtoolsDelegate, true);

        // 同步 SVG transform 与世界层 layer 保持一致
        this._syncSvgTransform();
        this._onTransformSync = function() { self._syncSvgTransform(); };
        var layerEl = document.querySelector('.cos-world-layer');
        if (layerEl) {
            this._transformObserver = new MutationObserver(this._onTransformSync);
            this._transformObserver.observe(layerEl, { attributes: true, attributeFilter: ['style'] });
        }
    },

    _syncSvgTransform: function() {
        if (!this._svgCanvas) return;
        var worldEl = document.getElementById('cos-world');
        if (!worldEl) return;
        var r = worldEl.getBoundingClientRect();
        // fixed 定位：用世界容器的屏幕位置 + layer 的 transform
        this._svgCanvas.style.left = r.left + 'px';
        this._svgCanvas.style.top = r.top + 'px';
        var layerEl = document.querySelector('.cos-world-layer');
        if (layerEl) {
            this._svgCanvas.style.transform = layerEl.style.transform || '';
            this._svgCanvas.style.transformOrigin = '0 0';
        }
    },

    _unbindEvents: function() {
        if (this._onMouseDown) document.removeEventListener('mousedown', this._onMouseDown, true);
        if (this._onMouseMove) document.removeEventListener('mousemove', this._onMouseMove);
        if (this._onMouseUp) document.removeEventListener('mouseup', this._onMouseUp);
        if (this._onSubtoolsDelegate) document.removeEventListener('input', this._onSubtoolsDelegate, true);
        if (this._transformObserver) { this._transformObserver.disconnect(); this._transformObserver = null; }
    }
};
