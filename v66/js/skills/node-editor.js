/**
 * 节点编辑器技能 - 完整独立插件
 * 从 v64/script.js 移植，适配 v66 世界引擎 API
 * 完全独立，不引用任何外部模块
 *
 * v2 重写：修复行号同步、大小自适应、UI布局等问题
 */
var NodeEditorSkill = {
    id: 'node-editor',
    name: '节点编辑',
    icon: '<span style="color:#38bdf8;">写</span>',
    description: '分镜式节点编辑器',

    // === 内部状态 ===
    _world: null,
    _layer: null,
    _nodes: [],
    _conns: [],
    _counter: 0,
    _selected: null,
    _dragNode: null,
    _dragOff: { x: 0, y: 0 },
    _activeConn: null,
    _isCutting: false,
    _cutPath: [],
    _svgEl: null,
    _svgGroup: null,
    _laserPath: null,
    _minimapEl: null,
    _minimapCanvas: null,
    _minimapViewEl: null,
    _minimapDirty: true,
    _minimapCache: null,
    _lastMinimapUpdate: 0,
    _minimapUpdateInterval: 100,
    _quadTree: null,
    _nodeMap: {},
    _visibleUpdateRequested: false,
    _styleEl: null,
    _handlers: {},
    _defaultW: 380,
    _defaultH: 180,

    // 常量
    _HEADER_H: 32,
    _LINE_NUM_W: 32,
    _TA_PAD_H: 8,    // textarea 上下 padding
    _TA_PAD_W: 10,   // textarea 左右 padding
    _MIN_W: 320,
    _MIN_H: 180,
    _MAX_W: 800,
    _MAX_H: 600,
    _FONT: '"Cascadia Code","Fira Code",Consolas,monospace',
    _FONT_SIZE: 12,
    _LINE_HEIGHT: 1.6,

    // ========== 激活 ==========
    activate: function(world) {
        this._world = world;
        this._layer = world.getLayer();
        this._bindFileDrop();

        // 如果已有 DOM（切换回来）
        if (this._svgEl) {
            // 没有节点就创建一个默认节点
            if (this._nodes.length === 0) {
                var self = this;
                setTimeout(function() {
                    var bounds = self._world.getVisibleBounds();
                    var cx = (bounds.left + bounds.right) / 2;
                    var cy = (bounds.top + bounds.bottom) / 2;
                    self._addNode(cx - self._defaultW / 2, cy - self._defaultH / 2, '1', '');
                    self._drawConns();
                    self._updateMinimap();
                    self._updateVisibleNodes();
                }, 50);
            }
            return;
        }

        // 首次激活：创建 DOM
        this._injectStyles();

        // 初始化四叉树
        this._quadTree = new QuadTreeNode({ x: -100000, y: -100000, width: 200000, height: 200000 });

        // 创建 SVG 连线层
        this._svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        this._svgEl.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:1px;pointer-events:none;z-index:0;overflow:visible;';
        this._svgGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this._svgEl.appendChild(this._svgGroup);

        // 激光切割路径
        this._laserPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        this._laserPath.setAttribute('fill', 'none');
        this._laserPath.setAttribute('stroke', '#ff4444');
        this._laserPath.setAttribute('stroke-width', '2');
        this._laserPath.setAttribute('stroke-linecap', 'round');
        this._laserPath.setAttribute('opacity', '0.8');
        this._svgEl.appendChild(this._laserPath);

        this._layer.appendChild(this._svgEl);

        // 创建小地图
        this._createMinimap();

        // 绑定事件
        this._bindEvents();

        // 恢复保存的数据（如果有）
        if (this._pendingLoad) {
            var data = this._pendingLoad;
            this._pendingLoad = null;
            this._counter = data.counter || 0;
            var nodes = data.nodes || [];
            for (var i = 0; i < nodes.length; i++) {
                var nd = nodes[i];
                this._addNode(nd.x, nd.y, nd.title, nd.content, nd.w, nd.h, nd.isInstance, nd.originalId, nd.id);
            }
            this._conns = (data.conns || []).slice();
            if (this._nodes.length === 0) this._counter = 0;
        }

        // 没有节点就创建一个默认节点
        if (this._nodes.length === 0) {
            var self = this;
            setTimeout(function() {
                var bounds = self._world.getVisibleBounds();
                var cx = (bounds.left + bounds.right) / 2;
                var cy = (bounds.top + bounds.bottom) / 2;
                self._addNode(cx - self._defaultW / 2, cy - self._defaultH / 2, '1', '');
                self._drawConns();
                self._updateMinimap();
                self._updateVisibleNodes();
            }, 50);
        }

        // 初始渲染
        this._drawConns();
        this._updateMinimap();
        this._updateVisibleNodes();
    },

    // ========== 停用 ==========
    deactivate: function() {
        this._unbindFileDrop();
    },

    // ========== 文件拖拽 ==========

    _supportedExtensions: ['.txt', '.md', '.markdown', '.js', '.json', '.html', '.css', '.xml', '.yml', '.yaml', '.csv', '.log', '.ini', '.cfg', '.conf', '.env', '.sh', '.bat', '.py', '.ts', '.jsx', '.tsx', '.vue', '.svelte', '.sql', '.gitignore', '.dockerfile'],

    _bindFileDrop: function() {
        var self = this;
        this._fd_onDragOver = function(e) { e.preventDefault(); e.stopPropagation(); };
        this._fd_onDrop = function(e) { e.preventDefault(); e.stopPropagation(); self._handleFileDrop(e); };
        document.addEventListener('dragover', this._fd_onDragOver);
        document.addEventListener('drop', this._fd_onDrop);
    },

    _unbindFileDrop: function() {
        if (this._fd_onDragOver) document.removeEventListener('dragover', this._fd_onDragOver);
        if (this._fd_onDrop) document.removeEventListener('drop', this._fd_onDrop);
    },

    _handleFileDrop: function(e) {
        var files = e.dataTransfer.files;
        if (!files || !files.length) return;
        // 只处理拖拽到画布区域（世界层）
        if (!this._layer || !this._layer.parentElement) return;
        var rect = this._layer.parentElement.getBoundingClientRect();
        if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) return;

        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            if (this._isTextFile(file)) {
                this._readFileToNode(file, e.clientX, e.clientY);
            }
        }
    },

    _isTextFile: function(file) {
        var name = file.name.toLowerCase();
        for (var i = 0; i < this._supportedExtensions.length; i++) {
            if (name.endsWith(this._supportedExtensions[i])) return true;
        }
        return false;
    },

    _readFileToNode: function(file, clientX, clientY) {
        var self = this;
        var reader = new FileReader();
        reader.onload = function(event) {
            var content = event.target.result;
            var ws = self._world.screenToWorld(clientX, clientY);
            self._addNode(ws.x - self._defaultW / 2, ws.y - self._defaultH / 2, file.name, content);
            self._minimapDirty = true;
        };
        reader.readAsText(file, 'utf-8');
    },

    // ========== 子工具栏 ==========
    getSubTools: function() {
        return [
            { label: '增', action: this._addNodeAtRandom.bind(this) },
            { label: '合', action: this._exportCode.bind(this) },
            { label: '出', action: this._exportJson.bind(this) },
            { label: '入', action: this._importJson.bind(this) },
            { label: '删', action: this._clearAll.bind(this) }
        ];
    },

    // ========== 保存 ==========
    save: function() {
        return null; // 不保存，每次打开都创建默认节点
    },

    // ========== 加载（只恢复数据，DOM 在 activate 时创建） ==========
    load: function(data) {
        if (!data) return;
        // 保存待恢复的数据，activate 时会读取
        this._pendingLoad = data;
    },

    // ========== 样式注入 ==========
    _injectStyles: function() {
        if (this._styleEl) return;
        var style = document.createElement('style');
        style.id = 'ne-injected-styles';
        style.textContent = [
            /* 节点容器 - 圆角 8px */
            '.ne-node{position:absolute;min-width:160px;background:rgba(15,25,50,0.95);border:1.5px solid rgba(100,160,255,0.2);border-radius:8px;overflow:visible;user-select:none;transition:border-color 0.15s,box-shadow 0.15s;z-index:1;}',
            '.ne-node:active{cursor:grabbing;}',
            '.ne-node.ne-selected{border-color:#38bdf8;box-shadow:0 0 16px rgba(56,189,248,0.3);}',
            '.ne-node.ne-instance{border-color:rgba(176,144,224,0.35);border-style:dashed;}',
            '.ne-node.ne-instance.ne-selected{border-color:#b090e0;box-shadow:0 0 16px rgba(176,144,224,0.3);}',

            /* 标题栏 - flex 布局，标题不截断 */
            '.ne-node-header{display:flex;align-items:center;padding:4px 8px;background:linear-gradient(135deg,rgba(56,189,248,0.12) 0%,rgba(56,189,248,0.04) 100%);border-bottom:1px solid rgba(100,160,255,0.1);border-radius:8px 8px 0 0;min-height:32px;cursor:grab;}',
            '.ne-node-header:active{cursor:grabbing;}',
            '.ne-instance .ne-node-header{background:linear-gradient(135deg,rgba(176,144,224,0.12) 0%,rgba(176,144,224,0.04) 100%);}',

            /* 标题文字 - flex:1 占满剩余空间，不截断 */
            '.ne-node-title{flex:1;min-width:0;font-size:11px;font-weight:600;color:#38bdf8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}',
            '.ne-instance .ne-node-title{color:#b090e0;}',

            /* 坐标 - 紧凑显示 */
            '.ne-node-coords{font-size:9px;color:#475569;margin:0 4px;flex-shrink:0;font-family:"Cascadia Code","Fira Code",Consolas,monospace;}',

            /* 工具按钮 - 紧凑小圆点设计，hover 显示 tooltip */
            '.ne-node-tools{display:flex;gap:2px;flex-shrink:0;margin-left:auto;}',
            '.ne-node-tool{width:20px;height:20px;border:none;border-radius:50%;background:rgba(255,255,255,0.04);color:#94a3b8;font-size:11px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all 0.15s;padding:0;line-height:1;position:relative;}',
            '.ne-node-tool:hover{background:rgba(255,255,255,0.12);color:#e8edf5;transform:scale(1.15);}',
            '.ne-node-tool.ne-danger:hover{background:rgba(224,96,96,0.2);color:#e06060;}',
            '.ne-node-tool:active{transform:scale(0.92);}',

            /* 编辑器区域 */
            '.ne-editor-wrapper{display:flex;height:calc(100% - 32px);overflow:hidden;border-radius:0 0 8px 8px;}',

            /* 行号 - 与 textarea 完全同步的字体、行高、padding */
            '.ne-line-numbers{min-width:32px;width:32px;padding:8px 4px 8px 6px;text-align:right;font-family:"Cascadia Code","Fira Code",Consolas,monospace;font-size:12px;line-height:1.6;color:#475569;background:rgba(0,0,0,0.15);overflow:hidden;user-select:none;border-right:1px solid rgba(100,160,255,0.06);}',
            '.ne-line-num{margin:0;padding:0;height:1.6em;line-height:1.6;display:block;}',

            /* textarea */
            '.ne-code-input{flex:1;padding:8px 10px;border:none;outline:none;resize:none;background:transparent;color:#e8edf5;font-size:12px;line-height:1.6;font-family:"Cascadia Code","Fira Code",Consolas,monospace;white-space:pre;overflow:auto;}',
            '.ne-code-input::placeholder{color:#475569;}',

            /* 端口 - Y 坐标在编辑区域中点 = calc(50% + 16px) */
            '.ne-port{position:absolute;width:12px;height:12px;border-radius:50%;background:#38bdf8;border:2px solid #0f1932;cursor:crosshair;transition:transform 0.15s,box-shadow 0.15s;z-index:5;}',
            '.ne-port:hover{transform:translateY(-50%) scale(1.5);box-shadow:0 0 10px rgba(56,189,248,0.3);}',
            '.ne-port-in{left:-6px;top:calc(50% + 16px);transform:translateY(-50%);}',
            '.ne-port-out{right:-6px;top:calc(50% + 16px);transform:translateY(-50%);}',
            '.ne-port-in:hover{transform:translateY(-50%) scale(1.5);}',
            '.ne-port-out:hover{transform:translateY(-50%) scale(1.5);}',

            /* 连线 */
            '.ne-conn-path{fill:none;stroke:#38bdf8;stroke-width:2;opacity:0.5;stroke-linecap:round;}',

            /* 小地图 */
            '.ne-minimap{position:fixed;bottom:80px;right:16px;width:140px;height:140px;background:rgba(15,25,50,0.9);border:1px solid rgba(100,160,255,0.12);border-radius:8px;overflow:hidden;z-index:8000;pointer-events:auto;box-shadow:0 4px 20px rgba(0,0,0,0.4);}',
            '.ne-minimap canvas{width:100%;height:100%;}',
            '.ne-minimap-viewport{position:absolute;border:1.5px solid rgba(56,189,248,0.6);border-radius:2px;pointer-events:none;background:rgba(56,189,248,0.05);}',

            /* 激光切割光标 */
            '.ne-cutting-cursor{cursor:crosshair !important;}'
        ].join('\n');
        document.head.appendChild(style);
        this._styleEl = style;
    },

    // ========== 小地图 ==========
    _createMinimap: function() {
        var self = this;
        this._minimapEl = document.createElement('div');
        this._minimapEl.className = 'ne-minimap';
        this._minimapCanvas = document.createElement('canvas');
        this._minimapCanvas.width = 140;
        this._minimapCanvas.height = 140;
        this._minimapEl.appendChild(this._minimapCanvas);
        this._minimapViewEl = document.createElement('div');
        this._minimapViewEl.className = 'ne-minimap-viewport';
        this._minimapEl.appendChild(this._minimapViewEl);
        document.body.appendChild(this._minimapEl);

        // 小地图点击导航
        this._minimapEl.addEventListener('mousedown', function(e) {
            e.stopPropagation();
            e.preventDefault();
            self._minimapNavigate(e);
        });
    },

    _minimapNavigate: function(e) {
        if (!this._minimapCache) return;
        var rect = this._minimapCanvas.getBoundingClientRect();
        var mx = e.clientX - rect.left;
        var my = e.clientY - rect.top;
        var cache = this._minimapCache;
        var wx = mx / cache.scale + cache.minX;
        var wy = my / cache.scale + cache.minY;
        this._world.panTo(wx, wy, true);
    },

    _updateMinimap: function() {
        var now = Date.now();
        if (!this._minimapDirty && now - this._lastMinimapUpdate < this._minimapUpdateInterval) {
            this._updateMinimapViewport();
            return;
        }

        var ctx = this._minimapCanvas.getContext('2d');
        this._minimapCanvas.width = 140;
        this._minimapCanvas.height = 140;
        ctx.clearRect(0, 0, 140, 140);

        if (this._nodes.length === 0) return;

        // 计算节点边界
        var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (var i = 0; i < this._nodes.length; i++) {
            var n = this._nodes[i];
            if (n.x < minX) minX = n.x;
            if (n.y < minY) minY = n.y;
            if (n.x + n.w > maxX) maxX = n.x + n.w;
            if (n.y + n.h > maxY) maxY = n.y + n.h;
        }
        minX -= 500; minY -= 500; maxX += 500; maxY += 500;
        var rangeX = maxX - minX, rangeY = maxY - minY;
        var scale = Math.min(140 / rangeX, 140 / rangeY);

        // 绘制节点
        ctx.fillStyle = 'rgba(150,150,150,0.8)';
        for (var i = 0; i < this._nodes.length; i++) {
            var n = this._nodes[i];
            var x = (n.x + n.w / 2 - minX) * scale;
            var y = (n.y + n.h / 2 - minY) * scale;
            ctx.beginPath();
            ctx.arc(x, y, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }

        // 绘制连接线
        ctx.strokeStyle = 'rgba(56,189,248,0.3)';
        ctx.lineWidth = 0.5;
        for (var i = 0; i < this._conns.length; i++) {
            var c = this._conns[i];
            var fn = this._nodeMap[c.from];
            var tn = this._nodeMap[c.to];
            if (!fn || !tn) continue;
            var x1 = (fn.x + fn.w / 2 - minX) * scale;
            var y1 = (fn.y + fn.h / 2 - minY) * scale;
            var x2 = (tn.x + tn.w / 2 - minX) * scale;
            var y2 = (tn.y + tn.h / 2 - minY) * scale;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        this._minimapCache = { minX: minX, minY: minY, scale: scale };
        this._minimapDirty = false;
        this._lastMinimapUpdate = now;
        this._updateMinimapViewport();
    },

    _updateMinimapViewport: function() {
        if (!this._minimapCache || !this._minimapViewEl) return;
        var cache = this._minimapCache;
        var st = this._world.getState();
        var vw = window.innerWidth / st.scale;
        var vh = window.innerHeight / st.scale;
        var vx = (-st.offsetX / st.scale) - cache.minX;
        var vy = (-st.offsetY / st.scale) - cache.minY;

        var viewW = vw * cache.scale;
        var viewH = vh * cache.scale;

        this._minimapViewEl.style.width = viewW + 'px';
        this._minimapViewEl.style.height = viewH + 'px';
        this._minimapViewEl.style.left = (vx * cache.scale) + 'px';
        this._minimapViewEl.style.top = (vy * cache.scale) + 'px';
    },

    // ========== 事件绑定 ==========
    _bindEvents: function() {
        var self = this;

        // 双击空白处创建节点
        this._handlers.dblclick = function(e) {
            var target = e.target;
            // 只在空白处创建（不在节点上、不在小地图上）
            if (!target.closest('.ne-node') && !target.closest('.ne-minimap')) {
                e.preventDefault();
                var ws = self._world.screenToWorld(e.clientX, e.clientY);
                self._addNode(ws.x - self._defaultW / 2, ws.y - self._defaultH / 2,
                    '' + (self._counter + 1), '');
                self._minimapDirty = true;
                self._updateMinimap();
            }
        };

        // 鼠标按下 - 直接监听 document 以便 stopPropagation 阻止世界平移
        this._handlers.mousedown = function(e) {
            var target = e.target;

            // 只处理世界层内的事件
            if (!target.closest('#cos-world')) return;

            // 右键 = 激光切割
            if (e.button === 2) {
                e.preventDefault();
                e.stopPropagation();
                self._isCutting = true;
                self._cutPath = [];
                self._world.getLayer().parentElement.classList.add('ne-cutting-cursor');
                return;
            }

            // 左键
            if (e.button === 0) {
                // 端口 - 开始连线
                if (target.classList.contains('ne-port-out')) {
                    e.preventDefault();
                    e.stopPropagation();
                    var nodeEl = target.closest('.ne-node');
                    var nid = parseInt(nodeEl.dataset.id);
                    var nd = self._nodeMap[nid];
                    if (!nd) return;
                    self._activeConn = {
                        fromId: nid,
                        sx: nd.x + nd.w,
                        sy: nd.y + self._HEADER_H / 2 + nd.h / 2  // 编辑区域中点
                    };
                    return;
                }

                // 节点标题栏 - 开始拖拽
                if (target.closest('.ne-node-header') && target.closest('.ne-node')) {
                    e.preventDefault();
                    e.stopPropagation();
                    var nodeEl = target.closest('.ne-node');
                    var nid = parseInt(nodeEl.dataset.id);
                    var nd = self._nodeMap[nid];
                    if (!nd) return;

                    self._select(nid);
                    self._dragNode = nd;
                    var ws = self._world.screenToWorld(e.clientX, e.clientY);
                    self._dragOff.x = ws.x - nd.x;
                    self._dragOff.y = ws.y - nd.y;
                    return;
                }

                // 节点其他区域 - 选中
                if (target.closest('.ne-node') && !target.closest('.ne-node-tool') && !target.closest('.ne-code-input')) {
                    var nodeEl = target.closest('.ne-node');
                    var nid = parseInt(nodeEl.dataset.id);
                    self._select(nid);
                    return;
                }
            }
        };

        // 鼠标移动
        this._handlers.mousemove = function(data) {
            // 拖拽节点
            if (self._dragNode) {
                var nd = self._dragNode;
                nd.x = data.worldX - self._dragOff.x;
                nd.y = data.worldY - self._dragOff.y;
                nd.el.style.left = nd.x + 'px';
                nd.el.style.top = nd.y + 'px';
                // 更新坐标显示
                var coordsEl = nd.el.querySelector('.ne-node-coords');
                if (coordsEl) {
                    coordsEl.textContent = Math.round(nd.x) + ',' + Math.round(nd.y);
                }
                self._drawConns();
                self._minimapDirty = true;
            }

            // 拖拽连线
            if (self._activeConn) {
                self._drawTempConn(self._activeConn.sx, self._activeConn.sy, data.worldX, data.worldY);
            }

            // 激光切割
            if (self._isCutting) {
                self._drawLaser(data.worldX, data.worldY);
            }
        };

        // 鼠标松开
        this._handlers.mouseup = function(data) {
            // 结束拖拽
            if (self._dragNode) {
                var nd = self._dragNode;
                self._world.markContent(nd.x, nd.y, nd.w, nd.h);
                self._dragNode = null;
                self._rebuildQuadTree();
                self._updateMinimap();
                self._updateVisibleNodes();
            }

            // 结束连线
            if (self._activeConn) {
                var sp = self._world.worldToScreen(data.worldX, data.worldY);
                var target = document.elementFromPoint(sp.x, sp.y);

                if (target && target.classList.contains('ne-port-in')) {
                    var targetNodeEl = target.closest('.ne-node');
                    var toId = parseInt(targetNodeEl.dataset.id);
                    if (toId !== self._activeConn.fromId) {
                        var exists = false;
                        for (var i = 0; i < self._conns.length; i++) {
                            if (self._conns[i].from === self._activeConn.fromId && self._conns[i].to === toId) {
                                exists = true;
                                break;
                            }
                        }
                        if (!exists) {
                            self._conns.push({ from: self._activeConn.fromId, to: toId });
                        }
                    }
                } else {
                    // 拖到空白处 -> 创建新节点并连接
                    var w = self._defaultW, h = self._defaultH;
                    var nx = data.worldX - w / 2;
                    var ny = data.worldY - h / 2;
                    if (self._checkOverlap(nx, ny, w, h)) {
                        var pos = self._findNonOverlapPos(w, h);
                        nx = pos.x;
                        ny = pos.y;
                    }
                    var newId = self._addNode(nx, ny, '' + (self._counter + 1), '');
                    self._conns.push({ from: self._activeConn.fromId, to: newId });
                    self._minimapDirty = true;
                    self._updateMinimap();
                }
                self._activeConn = null;
                self._drawConns();
            }

            // 结束激光切割
            if (self._isCutting) {
                self._isCutting = false;
                self._cutPath = [];
                if (self._laserPath) self._laserPath.setAttribute('d', '');
                var layerParent = self._world.getLayer().parentElement;
                if (layerParent) layerParent.classList.remove('ne-cutting-cursor');
                self._drawConns();
                self._minimapDirty = true;
                self._updateMinimap();
                self._updateVisibleNodes();
            }
        };

        // 右键菜单（备用，在空白处右键）
        this._handlers.contextmenu = function(data) {
            // 已在 mousedown 中处理右键
        };

        // 视图变换时更新（节流，避免拖拽画布卡顿）
        var _tfThrottled = false;
        this._handlers.transform = function() {
            if (_tfThrottled) return;
            _tfThrottled = true;
            requestAnimationFrame(function() {
                _tfThrottled = false;
                self._drawConns();
                self._updateMinimap();
                self._updateVisibleNodes();
            });
        };

        // Escape 取消选中
        this._handlers.escape = function() {
            self._select(null);
        };

        // 画布激光删除节点后，清理内部数据
        this._handlers.laserDelete = function(data) {
            var el = data.element;
            if (!el || !el.dataset.id) return;
            var id = parseInt(el.dataset.id);
            var nd = self._nodeMap[id];
            if (!nd) return;
            // 从数据中移除
            self._nodes = self._nodes.filter(function(n) { return n.id !== id; });
            delete self._nodeMap[id];
            // 删除相关连接
            self._conns = self._conns.filter(function(c) { return c.from !== id && c.to !== id; });
            // 清理内容标记
            self._world.clearContent(nd.x, nd.y, nd.w, nd.h);
            // 重建四叉树
            self._quadTree.rebuild(self._nodes);
            // 重绘
            self._drawConns();
            self._minimapDirty = true;
            self._updateMinimap();
        };

        // mousedown 用捕获阶段绑定到 document，确保在 world.js 之前处理
        document.addEventListener('mousedown', this._handlers.mousedown, true);
        this._world.on('mousemove', this._handlers.mousemove);
        this._world.on('mouseup', this._handlers.mouseup);
        this._world.on('contextmenu', this._handlers.contextmenu);
        this._world.on('transform', this._handlers.transform);
        this._world.on('escape', this._handlers.escape);
        this._world.on('laser-delete', this._handlers.laserDelete);

        // 双击事件绑定到世界元素
        var worldEl = this._world.getLayer().parentElement;
        if (worldEl) {
            worldEl.addEventListener('dblclick', this._handlers.dblclick);
        }
    },

    _unbindEvents: function() {
        if (!this._world) return;
        document.removeEventListener('mousedown', this._handlers.mousedown, true);
        this._world.off('mousemove', this._handlers.mousemove);
        this._world.off('mouseup', this._handlers.mouseup);
        this._world.off('contextmenu', this._handlers.contextmenu);
        this._world.off('transform', this._handlers.transform);
        this._world.off('escape', this._handlers.escape);
        this._world.off('laser-delete', this._handlers.laserDelete);

        var worldEl = this._world.getLayer().parentElement;
        if (worldEl && this._handlers.dblclick) {
            worldEl.removeEventListener('dblclick', this._handlers.dblclick);
        }
    },

    // ========== 节点 CRUD ==========
    _addNode: function(x, y, title, content, w, h, isInstance, originalId, forceId) {
        var self = this;
        var id = forceId || ++this._counter;
        if (id > this._counter) this._counter = id;

        w = w || this._defaultW;
        h = h || this._defaultH;

        var nd = {
            id: id, x: x, y: y, w: w, h: h,
            title: title || ('' + id),
            content: content || '',
            isInstance: !!isInstance,
            originalId: originalId || null,
            el: null, isRendered: false
        };
        this._nodes.push(nd);
        this._nodeMap[id] = nd;
        this._quadTree.insert(nd);

        // 创建 DOM
        var el = self._buildNodeDOM(nd);
        this._layer.appendChild(el);
        nd.el = el;
        nd.isRendered = true;

        // 初始化行号同步
        var ta = el.querySelector('.ne-code-input');
        var ln = el.querySelector('.ne-line-numbers');
        self._updateLineNumbers(ta, ln);

        // 绑定编辑器事件
        self._bindEditorEvents(nd, ta, ln);

        // 标记内容区域
        this._world.markContent(x, y, w, h);
        return id;
    },

    /**
     * 构建节点 DOM 元素（共用方法，避免 _addNode 和 _renderNode 重复代码）
     */
    _buildNodeDOM: function(nd) {
        var self = this;
        var el = document.createElement('div');
        el.className = 'ne-node' + (nd.isInstance ? ' ne-instance' : '');
        el.setAttribute('data-skill-id', 'node-editor');
        el.setAttribute('data-cos-deletable', '');
        el.dataset.id = nd.id;
        el.style.cssText = 'width:' + nd.w + 'px;height:' + nd.h + 'px;left:' + nd.x + 'px;top:' + nd.y + 'px;';

        // 工具按钮 - 使用紧凑符号 + title tooltip
        var tools = '';
        if (nd.isInstance) {
            tools = '<button class="ne-node-tool" data-act="locate" title="\u5B9A\u4F4D\u672C\u4F53">\u5B9A</button>' +
                    '<button class="ne-node-tool ne-danger" data-act="del" title="\u5220\u9664">\u5173</button>';
        } else {
            tools = '<button class="ne-node-tool" data-act="copy" title="\u590D\u5236">\u590D</button>' +
                    '<button class="ne-node-tool" data-act="shadow" title="\u5F71\u5B50">\u5F71</button>' +
                    '<button class="ne-node-tool" data-act="small" title="\u7F29\u5C0F">\u5C0F</button>' +
                    '<button class="ne-node-tool" data-act="big" title="\u653E\u5927">\u5927</button>' +
                    '<button class="ne-node-tool ne-danger" data-act="del" title="\u5220\u9664">\u5173</button>';
        }

        // 影子节点显示本体标题
        var origIndex = '';
        if (nd.isInstance && nd.originalId && this._nodeMap[nd.originalId]) {
            origIndex = ' (' + this._nodeMap[nd.originalId].title + ')';
        }

        el.innerHTML =
            '<div class="ne-node-header">' +
                '<span class="ne-node-title">' + (nd.isInstance ? '\uD83D\uDC7B ' : '') + self._esc(nd.title) + origIndex + '</span>' +
                '<span class="ne-node-coords">' + Math.round(nd.x) + ',' + Math.round(nd.y) + '</span>' +
                '<div class="ne-node-tools">' + tools + '</div>' +
            '</div>' +
            '<div class="ne-editor-wrapper">' +
                '<div class="ne-line-numbers"></div>' +
                '<textarea class="ne-code-input" spellcheck="false" placeholder="\u8F93\u5165\u5185\u5BB9..."' + (nd.isInstance ? ' readonly' : '') + '>' + self._esc(nd.content) + '</textarea>' +
            '</div>' +
            '<div class="ne-port ne-port-in"></div>' +
            '<div class="ne-port ne-port-out"></div>';

        return el;
    },

    /**
     * 绑定编辑器相关事件（textarea 输入、滚动、Tab、粘贴 + 工具按钮）
     */
    _bindEditorEvents: function(nd, ta, ln) {
        var self = this;
        var el = nd.el;

        // 工具按钮事件
        var toolBtns = el.querySelectorAll('.ne-node-tool');
        for (var i = 0; i < toolBtns.length; i++) {
            (function(btn) {
                btn.addEventListener('mousedown', function(e) { e.stopPropagation(); });
                btn.addEventListener('click', function(e) {
                    e.stopPropagation();
                    var act = btn.dataset.act;
                    if (act === 'copy') self._copyNode(nd.id);
                    else if (act === 'shadow') self._createShadow(nd.id);
                    else if (act === 'locate') self._locateOriginal(nd.id);
                    else if (act === 'del') self._removeNode(nd.id);
                    else if (act === 'small') self._resizeNode(nd.id, 'min');
                    else if (act === 'big') self._resizeNode(nd.id, 'max');
                });
            })(toolBtns[i]);
        }

        // 文本编辑事件（非影子节点）
        if (!nd.isInstance) {
            // 输入事件：更新内容、行号、同步影子
            ta.addEventListener('input', function() {
                nd.content = ta.value;
                self._updateLineNumbers(ta, ln);
                self._syncShadows(nd.id);
            });

            // 滚动事件：同步行号滚动位置
            ta.addEventListener('scroll', function() {
                ln.scrollTop = ta.scrollTop;
            });

            // 滚轮事件：阻止冒泡到画布缩放，允许 textarea 原生滚动
            ta.addEventListener('wheel', function(e) {
                e.stopPropagation();
            });

            // Tab 键插入缩进
            ta.addEventListener('keydown', function(e) {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    var start = ta.selectionStart;
                    var end = ta.selectionEnd;
                    var val = ta.value;
                    ta.value = val.substring(0, start) + '  ' + val.substring(end);
                    ta.selectionStart = ta.selectionEnd = start + 2;
                    ta.dispatchEvent(new Event('input'));
                }
            });

            // 粘贴处理
            ta.addEventListener('paste', function(e) {
                e.preventDefault();
                var text = (e.clipboardData || window.clipboardData).getData('text/plain');
                var start = ta.selectionStart;
                var end = ta.selectionEnd;
                var val = ta.value;
                ta.value = val.substring(0, start) + text + val.substring(end);
                ta.selectionStart = ta.selectionEnd = start + text.length;
                ta.dispatchEvent(new Event('input'));
            });
        }
    },

    /**
     * 更新行号 - 使用 div 元素确保与 textarea 行高完全一致
     * 每个 div 的 line-height 和 font-size 与 textarea 相同
     */
    _updateLineNumbers: function(ta, ln) {
        var lineCount = Math.max((ta.value || '').split('\n').length, 1);
        var html = '';
        for (var i = 1; i <= lineCount; i++) {
            html += '<div class="ne-line-num">' + i + '</div>';
        }
        ln.innerHTML = html;
    },

    _syncShadows: function(origId) {
        var orig = this._nodeMap[origId];
        if (!orig) return;
        for (var i = 0; i < this._nodes.length; i++) {
            var nd = this._nodes[i];
            if (nd.isInstance && nd.originalId === origId) {
                nd.content = orig.content;
                var ta = nd.el.querySelector('.ne-code-input');
                var ln = nd.el.querySelector('.ne-line-numbers');
                if (ta) {
                    ta.value = orig.content;
                    this._updateLineNumbers(ta, ln);
                }
            }
        }
    },

    _copyNode: function(id) {
        var orig = this._nodeMap[id];
        if (!orig) return;
        var w = Math.max(this._defaultW, orig.w);
        var h = orig.h;
        var pos = this._findNonOverlapPos(w, h);
        this._addNode(pos.x, pos.y, '' + (this._counter + 1), orig.content, w, h);
        this._minimapDirty = true;
        this._updateMinimap();
    },

    _createShadow: function(id) {
        var orig = this._nodeMap[id];
        if (!orig) return;
        var w = Math.max(this._defaultW, orig.w);
        var h = orig.h;
        var pos = this._findNonOverlapPos(w, h);
        this._addNode(pos.x, pos.y, '' + (this._counter + 1), orig.content, w, h, true, id);
        this._minimapDirty = true;
        this._updateMinimap();
    },

    _locateOriginal: function(shadowId) {
        var shadow = this._nodeMap[shadowId];
        if (!shadow || !shadow.originalId) return;
        var orig = this._nodeMap[shadow.originalId];
        if (!orig) return;
        this._world.panTo(orig.x + orig.w / 2, orig.y + orig.h / 2, true);
        this._select(orig.id);
        if (orig.el) {
            orig.el.style.boxShadow = '0 0 24px rgba(240,160,80,0.5)';
            setTimeout(function() { orig.el.style.boxShadow = ''; }, 1200);
        }
    },

    _removeNode: function(id) {
        var nd = this._nodeMap[id];
        if (!nd) return;

        // 级联删除影子节点
        var toDelete = [id];
        for (var i = 0; i < this._nodes.length; i++) {
            var n = this._nodes[i];
            if (n.isInstance && n.originalId === id) {
                toDelete.push(n.id);
            }
        }

        // 删除所有相关节点
        for (var i = 0; i < toDelete.length; i++) {
            var delId = toDelete[i];
            var delNd = this._nodeMap[delId];
            if (delNd && delNd.el) delNd.el.remove();
            this._nodes = this._nodes.filter(function(n) { return n.id !== delId; });
            delete this._nodeMap[delId];
            this._conns = this._conns.filter(function(c) { return c.from !== delId && c.to !== delId; });
        }

        if (this._selected === id) this._selected = null;
        this._rebuildQuadTree();
        this._drawConns();
        this._minimapDirty = true;
        this._updateMinimap();
        this._updateVisibleNodes();
    },

    _select: function(id) {
        for (var i = 0; i < this._nodes.length; i++) {
            var n = this._nodes[i];
            if (n.el) {
                if (id !== null && n.id === id) {
                    n.el.classList.add('ne-selected');
                } else {
                    n.el.classList.remove('ne-selected');
                }
            }
        }
        this._selected = id;
    },

    _addNodeAtRandom: function() {
        var w = this._defaultW, h = this._defaultH;
        // 在当前视口中心附近创建，而不是固定(0,0)
        var bounds = this._world.getVisibleBounds();
        var cx = (bounds.left + bounds.right) / 2;
        var cy = (bounds.top + bounds.bottom) / 2;
        // 居中偏移（让节点中心对齐视口中心）
        var pos = { x: cx - w / 2, y: cy - h / 2 };
        this._addNode(pos.x, pos.y, '' + (this._counter + 1), '');
        this._minimapDirty = true;
        this._updateMinimap();
    },

    // ========== 节点大小调整 ==========
    _resizeNode: function(id, mode) {
        var nd = this._nodeMap[id];
        if (!nd || !nd.el) return;

        var el = nd.el;
        var ta = el.querySelector('.ne-code-input');
        var ln = el.querySelector('.ne-line-numbers');

        if (mode === 'max') {
            // 大模式：根据 textarea 的 scrollWidth/scrollHeight 计算真实内容尺寸
            // 临时缩小 textarea 让内容溢出，scrollWidth/scrollHeight 反映真实内容大小
            var oldW = ta.style.width;
            var oldH = ta.style.height;
            var oldOverflow = ta.style.overflow;
            ta.style.width = '1px';
            ta.style.height = '1px';
            ta.style.overflow = 'hidden';
            // 强制重排
            ta.offsetHeight;
            var sw = ta.scrollWidth;  // 内容真实宽度（含 padding）
            var sh = ta.scrollHeight;  // 内容真实高度（含 padding）
            // 恢复
            ta.style.width = oldW;
            ta.style.height = oldH;
            ta.style.overflow = oldOverflow;

            // 计算新尺寸
            // 宽度 = 行号宽度(32px) + textarea 内容宽度(scrollWidth)
            // 高度 = 标题栏(32px) + textarea 内容高度(scrollHeight)
            nd.w = Math.min(this._MAX_W, Math.max(this._MIN_W, this._LINE_NUM_W + sw));
            nd.h = Math.min(this._MAX_H, Math.max(this._MIN_H, this._HEADER_H + sh));
        } else {
            // 小模式
            nd.w = this._MIN_W;
            nd.h = this._MIN_H;
        }

        el.style.width = nd.w + 'px';
        el.style.height = nd.h + 'px';

        // 确保编辑器区域正确
        var wrapper = el.querySelector('.ne-editor-wrapper');
        if (wrapper) {
            wrapper.style.width = '100%';
            wrapper.style.height = 'calc(100% - ' + this._HEADER_H + 'px)';
        }
        ln.style.minWidth = this._LINE_NUM_W + 'px';
        ln.style.width = this._LINE_NUM_W + 'px';
        ln.style.height = '100%';
        ta.style.flex = '1';
        ta.style.height = '100%';

        this._updateLineNumbers(ta, ln);
        this._drawConns();
        this._minimapDirty = true;
        this._updateMinimap();
        this._rebuildQuadTree();
    },

    // ========== 连线渲染 ==========
    _drawConns: function() {
        if (!this._svgGroup) return;
        this._svgGroup.innerHTML = '';

        // 重新添加激光路径
        if (this._laserPath && this._laserPath.parentNode !== this._svgEl) {
            this._svgEl.appendChild(this._laserPath);
        }

        var self = this;
        var visibleBounds = this._getVisibleBounds();

        for (var i = 0; i < this._conns.length; i++) {
            var c = self._conns[i];
            var fn = self._nodeMap[c.from];
            var tn = self._nodeMap[c.to];
            if (!fn || !tn) continue;

            // 只渲染至少一个端点在可见区域内的连线
            if (!self._isNodeInBounds(fn, visibleBounds) && !self._isNodeInBounds(tn, visibleBounds)) continue;

            var p1 = self._getOut(fn);
            var p2 = self._getIn(tn);
            self._drawCurve(p1, p2, c.from, c.to);
        }
    },

    _drawCurve: function(p1, p2, fromId, toId) {
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        var cp = Math.abs(p1.x - p2.x) * 0.4;
        path.setAttribute('d', 'M ' + p1.x + ' ' + p1.y + ' C ' + (p1.x + cp) + ' ' + p1.y + ', ' + (p2.x - cp) + ' ' + p2.y + ', ' + p2.x + ' ' + p2.y);
        path.setAttribute('class', 'ne-conn-path');
        if (fromId !== undefined && toId !== undefined) {
            path.dataset.from = fromId;
            path.dataset.to = toId;
        }
        this._svgGroup.appendChild(path);
    },

    _drawTempConn: function(x1, y1, x2, y2) {
        var old = this._svgGroup.querySelector('.ne-temp-conn');
        if (old) old.remove();

        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        var cp = Math.abs(x1 - x2) * 0.4;
        path.setAttribute('d', 'M ' + x1 + ' ' + y1 + ' C ' + (x1 + cp) + ' ' + y1 + ', ' + (x2 - cp) + ' ' + y2 + ', ' + x2 + ' ' + y2);
        path.setAttribute('class', 'ne-conn-path ne-temp-conn');
        path.style.opacity = '0.3';
        path.style.strokeDasharray = '6 3';
        this._svgGroup.appendChild(path);
    },

    /**
     * 获取输入端口位置（左侧，编辑区域中点）
     * Y = 节点顶部 + 标题栏高度 + 编辑区域高度/2 = y + HEADER_H/2 + h/2
     */
    _getIn: function(n) {
        return { x: n.x, y: n.y + this._HEADER_H / 2 + n.h / 2 };
    },

    /**
     * 获取输出端口位置（右侧，编辑区域中点）
     */
    _getOut: function(n) {
        return { x: n.x + n.w, y: n.y + this._HEADER_H / 2 + n.h / 2 };
    },

    // ========== 激光切割 ==========
    _drawLaser: function(x, y) {
        this._cutPath.push({ x: x, y: y });
        if (this._cutPath.length > 10) this._cutPath.shift();

        // 绘制激光路径
        var d = '';
        for (var i = 0; i < this._cutPath.length; i++) {
            d += (i === 0 ? 'M' : 'L') + ' ' + this._cutPath[i].x + ' ' + this._cutPath[i].y + ' ';
        }
        if (this._laserPath) this._laserPath.setAttribute('d', d);

        if (this._cutPath.length > 1) {
            var p1 = this._cutPath[this._cutPath.length - 2];
            var p2 = { x: x, y: y };

            // 删除相交的连接线
            var connsToDelete = [];
            for (var i = 0; i < this._conns.length; i++) {
                var c = this._conns[i];
                var n1 = this._nodeMap[c.from];
                var n2 = this._nodeMap[c.to];
                if (n1 && n2) {
                    if (this._checkLineIntersect(p1, p2, this._getOut(n1), this._getIn(n2))) {
                        connsToDelete.push(i);
                    }
                }
            }
            for (var i = connsToDelete.length - 1; i >= 0; i--) {
                this._conns.splice(connsToDelete[i], 1);
            }

            // 删除相交的节点
            for (var i = 0; i < this._nodes.length; i++) {
                var nd = this._nodes[i];
                if (x >= nd.x && x <= nd.x + nd.w && y >= nd.y && y <= nd.y + nd.h) {
                    this._removeNode(nd.id);
                    break;
                }
            }

            this._drawConns();
        }
    },

    _checkLineIntersect: function(p0, p1, p2, p3) {
        var s1_x = p1.x - p0.x, s1_y = p1.y - p0.y;
        var s2_x = p3.x - p2.x, s2_y = p3.y - p2.y;
        var denom = -s2_x * s1_y + s1_x * s2_y;
        if (denom === 0) return false;
        var s = (-s1_y * (p0.x - p2.x) + s1_x * (p0.y - p2.y)) / denom;
        var t = (s2_x * (p0.y - p2.y) - s2_y * (p0.x - p2.x)) / denom;
        return (s >= 0 && s <= 1 && t >= 0 && t <= 1);
    },

    // ========== 虚拟化渲染 ==========
    _getVisibleBounds: function() {
        var bounds = this._world.getVisibleBounds();
        var buffer = 200;
        return {
            left: bounds.left - buffer,
            top: bounds.top - buffer,
            right: bounds.right + buffer,
            bottom: bounds.bottom + buffer
        };
    },

    _isNodeInBounds: function(node, bounds) {
        return node.x < bounds.right &&
               node.x + node.w > bounds.left &&
               node.y < bounds.bottom &&
               node.y + node.h > bounds.top;
    },

    _updateVisibleNodes: function() {
        var self = this;
        if (this._visibleUpdateRequested) return;
        this._visibleUpdateRequested = true;
        requestAnimationFrame(function() {
            var visibleBounds = self._getVisibleBounds();
            var visibleNodes = self._quadTree.query(visibleBounds);
            var visibleIds = {};
            for (var i = 0; i < visibleNodes.length; i++) {
                visibleIds[visibleNodes[i].id] = true;
            }

            for (var i = 0; i < self._nodes.length; i++) {
                var nd = self._nodes[i];
                var isVisible = !!visibleIds[nd.id];

                if (isVisible && !nd.isRendered) {
                    self._renderNode(nd);
                } else if (!isVisible && nd.isRendered) {
                    self._hideNode(nd);
                }
            }
            self._visibleUpdateRequested = false;
        });
    },

    _renderNode: function(nd) {
        if (nd.isRendered) return;
        var self = this;

        // 构建新 DOM
        var el = self._buildNodeDOM(nd);
        self._layer.appendChild(el);
        nd.el = el;
        nd.isRendered = true;

        // 初始化行号
        var ta = el.querySelector('.ne-code-input');
        var ln = el.querySelector('.ne-line-numbers');
        self._updateLineNumbers(ta, ln);

        // 绑定事件
        self._bindEditorEvents(nd, ta, ln);

        // 选中状态
        if (self._selected === nd.id) {
            el.classList.add('ne-selected');
        }
    },

    _hideNode: function(nd) {
        if (!nd.isRendered || !nd.el) return;
        nd.el.remove();
        nd.el = null;
        nd.isRendered = false;
    },

    // ========== 防重叠布局 ==========
    _checkOverlap: function(x1, y1, w1, h1, x2, y2, w2, h2) {
        return !(x1 + w1 <= x2 || x1 >= x2 + w2 || y1 + h1 <= y2 || y1 >= y2 + h2);
    },

    _findNonOverlapPos: function(w, h) {
        var offset = 40;

        if (this._nodes.length === 0) {
            return { x: 0, y: 0 };
        }

        var st = this._world.getState();
        var viewLeft = (-st.offsetX) / st.scale;
        var viewRight = viewLeft + (window.innerWidth / st.scale);

        var lastNode = this._nodes[this._nodes.length - 1];
        var x = lastNode.x + lastNode.w + offset;
        var y = lastNode.y;

        var overlap = false;
        for (var i = 0; i < this._nodes.length; i++) {
            var n = this._nodes[i];
            if (this._checkOverlap(x, y, w, h, n.x, n.y, n.w, n.h)) {
                overlap = true;
                break;
            }
        }

        if (overlap || x + w > viewRight) {
            x = viewLeft;
            y = lastNode.y + lastNode.h + offset;

            var found = false;
            var attempts = 0;
            while (attempts < 100) {
                overlap = false;
                for (var i = 0; i < this._nodes.length; i++) {
                    var n = this._nodes[i];
                    if (this._checkOverlap(x, y, w, h, n.x, n.y, n.w, n.h)) {
                        overlap = true;
                        break;
                    }
                }
                if (!overlap) { found = true; break; }
                y += h + offset;
                attempts++;
            }
            if (found) return { x: x, y: y };

            x = lastNode.x;
            y = lastNode.y + lastNode.h + offset;
            attempts = 0;
            while (attempts < 100) {
                overlap = false;
                for (var i = 0; i < this._nodes.length; i++) {
                    var n = this._nodes[i];
                    if (this._checkOverlap(x, y, w, h, n.x, n.y, n.w, n.h)) {
                        overlap = true;
                        break;
                    }
                }
                if (!overlap) return { x: x, y: y };
                y += h + offset;
                attempts++;
            }
            return { x: lastNode.x + offset, y: lastNode.y + offset };
        }

        return { x: x, y: y };
    },

    // ========== 四叉树 ==========
    _rebuildQuadTree: function() {
        this._quadTree.clear();
        for (var i = 0; i < this._nodes.length; i++) {
            this._quadTree.insert(this._nodes[i]);
        }
    },

    // ========== 导出代码 ==========
    _exportCode: function() {
        if (this._nodes.length === 0) {
            this._showToast('\u6CA1\u6709\u8282\u70B9\u53EF\u5BFC\u51FA');
            return;
        }

        // 构建邻接表
        var adj = {};
        for (var i = 0; i < this._nodes.length; i++) {
            adj[this._nodes[i].id] = [];
        }
        for (var i = 0; i < this._conns.length; i++) {
            var c = this._conns[i];
            if (adj[c.from]) adj[c.from].push(c.to);
        }

        // BFS 遍历
        var firstId = this._nodes[0].id;
        var visited = {};
        var queue = [firstId];
        visited[firstId] = true;

        while (queue.length > 0) {
            var currentId = queue.shift();
            var neighbors = adj[currentId] || [];
            for (var i = 0; i < neighbors.length; i++) {
                if (!visited[neighbors[i]]) {
                    visited[neighbors[i]] = true;
                    queue.push(neighbors[i]);
                }
            }
        }

        // BFS 顺序生成代码
        var bfsOrder = [];
        var bfsVisited = {};
        var bfsQueue = [firstId];
        bfsVisited[firstId] = true;

        while (bfsQueue.length > 0) {
            var cid = bfsQueue.shift();
            bfsOrder.push(cid);
            var neighbors = adj[cid] || [];
            for (var i = 0; i < neighbors.length; i++) {
                if (visited[neighbors[i]] && !bfsVisited[neighbors[i]]) {
                    bfsVisited[neighbors[i]] = true;
                    bfsQueue.push(neighbors[i]);
                }
            }
        }

        // 添加未访问的节点
        for (var i = 0; i < this._nodes.length; i++) {
            if (!bfsVisited[this._nodes[i].id]) {
                bfsOrder.push(this._nodes[i].id);
            }
        }

        // 拼接代码
        var self = this;
        var finalCode = bfsOrder.map(function(oid) {
            var n = self._nodeMap[oid];
            return n ? n.content.trim() : '';
        }).join('\n\n');

        this._showOverlay('\u5BFC\u51FA\u4EE3\u7801', finalCode);
    },

    // ========== 导出 JSON ==========
    _exportJson: function() {
        var data = this.save();
        var json = JSON.stringify(data, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'node-editor-' + Date.now() + '.json';
        a.click();
        URL.revokeObjectURL(url);
        this._showToast('JSON \u5DF2\u5BFC\u51FA');
    },

    // ========== 导入 JSON ==========
    _importJson: function() {
        var self = this;
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.addEventListener('change', function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    var data = JSON.parse(ev.target.result);
                    self.load(data);
                    self._showToast('JSON \u5DF2\u5BFC\u5165');
                } catch (err) {
                    self._showToast('\u5BFC\u5165\u5931\u8D25: ' + err.message);
                }
            };
            reader.readAsText(file);
        });
        input.click();
    },

    // ========== 清空 ==========
    _clearAll: function() {
        this._clearAllInternal();
        this._drawConns();
        this._minimapDirty = true;
        this._updateMinimap();
        // 立即保存空状态
        if (typeof autoSave === 'function') autoSave();
    },

    _clearAllInternal: function() {
        for (var i = 0; i < this._nodes.length; i++) {
            var nd = this._nodes[i];
            if (nd.el) nd.el.remove();
        }
        this._nodes = [];
        this._conns = [];
        this._nodeMap = {};
        this._counter = 0;
        this._selected = null;
        this._dragNode = null;
        this._activeConn = null;
        if (this._svgGroup) this._svgGroup.innerHTML = '';
        if (this._quadTree) this._quadTree.clear();
    },

    // ========== UI 辅助 ==========
    _esc: function(s) {
        var d = document.createElement('div');
        d.textContent = s || '';
        return d.innerHTML;
    },

    _showToast: function(msg) {
        if (typeof showToast === 'function') showToast(msg);
    },

    _showOverlay: function(title, content) {
        if (typeof showOverlay === 'function') {
            var safeContent = content.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
            var html = '<pre style="white-space:pre-wrap;font-family:Consolas,monospace;font-size:12px;line-height:1.6;color:#e8edf5;margin:0;max-height:50vh;overflow-y:auto;">' + safeContent + '</pre>' +
                '<button onclick="var ta=document.createElement(\'textarea\');ta.style.cssText=\'position:fixed;opacity:0;\';ta.value=this.dataset.code;document.body.appendChild(ta);ta.select();document.execCommand(\'copy\');document.body.removeChild(ta);this.textContent=\'\u5DF2\u590D\u5236!\';this.style.background=\'rgba(128,216,160,0.2)\';setTimeout(function(){this.textContent=\'\u590D\u5236\u4EE3\u7801\';this.style.background=\'rgba(56,189,248,0.12)\';}.bind(this),1500);" data-code="' + safeContent.replace(/"/g,'&quot;') + '" style="margin-top:10px;padding:6px 16px;border:1px solid rgba(100,160,255,0.2);border-radius:8px;background:rgba(56,189,248,0.12);color:#38bdf8;font-size:11px;cursor:pointer;font-family:inherit;">\u590D\u5236\u4EE3\u7801</button>';
            showOverlay(title, html, '600px');
        }
    },
};

// ========== 四叉树空间索引 ==========
var QuadTreeNode = (function() {
    function QuadTreeNode(bounds) {
        this.bounds = bounds; // {x, y, width, height}
        this.nodes = [];
        this.children = null;
        this.maxNodes = 8;
    }

    // 插入对象
    QuadTreeNode.prototype.insert = function(obj) {
        if (this.children) {
            var index = this.getChildIndex(obj);
            if (index !== -1) {
                this.children[index].insert(obj);
                return;
            }
        }
        this.nodes.push(obj);
        if (this.nodes.length > this.maxNodes && !this.children) {
            this.split();
        }
    };

    // 分裂为四个子节点
    QuadTreeNode.prototype.split = function() {
        var b = this.bounds;
        var hw = b.width / 2;
        var hh = b.height / 2;
        this.children = [
            new QuadTreeNode({ x: b.x, y: b.y, width: hw, height: hh }),
            new QuadTreeNode({ x: b.x + hw, y: b.y, width: hw, height: hh }),
            new QuadTreeNode({ x: b.x, y: b.y + hh, width: hw, height: hh }),
            new QuadTreeNode({ x: b.x + hw, y: b.y + hh, width: hw, height: hh })
        ];
        for (var i = this.nodes.length - 1; i >= 0; i--) {
            var obj = this.nodes[i];
            var idx = this.getChildIndex(obj);
            if (idx !== -1) {
                this.children[idx].insert(obj);
                this.nodes.splice(i, 1);
            }
        }
    };

    // 获取对象应插入的子节点索引
    QuadTreeNode.prototype.getChildIndex = function(obj) {
        var b = this.bounds;
        var hw = b.width / 2;
        var hh = b.height / 2;
        var leftHalf = obj.x + obj.w <= b.x + hw;
        var rightHalf = obj.x >= b.x + hw;
        var topHalf = obj.y + obj.h <= b.y + hh;
        var bottomHalf = obj.y >= b.y + hh;
        if (leftHalf && topHalf) return 0;
        if (rightHalf && topHalf) return 1;
        if (leftHalf && bottomHalf) return 2;
        if (rightHalf && bottomHalf) return 3;
        return -1;
    };

    // 查询范围内的对象
    QuadTreeNode.prototype.query = function(range, found) {
        if (!found) found = [];
        if (!this.isIntersecting(range)) return found;
        for (var i = 0; i < this.nodes.length; i++) {
            if (this.isObjIntersecting(this.nodes[i], range)) {
                found.push(this.nodes[i]);
            }
        }
        if (this.children) {
            for (var i = 0; i < this.children.length; i++) {
                this.children[i].query(range, found);
            }
        }
        return found;
    };

    // 检查边界是否相交
    QuadTreeNode.prototype.isIntersecting = function(range) {
        var b = this.bounds;
        return !(b.x + b.width < range.left || b.x > range.right || b.y + b.height < range.top || b.y > range.bottom);
    };

    // 检查对象是否与范围相交
    QuadTreeNode.prototype.isObjIntersecting = function(obj, range) {
        return !(obj.x + obj.w < range.left || obj.x > range.right || obj.y + obj.h < range.top || obj.y > range.bottom);
    };

    // 清空
    QuadTreeNode.prototype.clear = function() {
        this.nodes = [];
        if (this.children) {
            for (var i = 0; i < this.children.length; i++) {
                this.children[i].clear();
            }
            this.children = null;
        }
    };

    // 重建
    QuadTreeNode.prototype.rebuild = function(nodes) {
        this.clear();
        for (var i = 0; i < nodes.length; i++) {
            this.insert(nodes[i]);
        }
    };

    return QuadTreeNode;
})();
