/**
 * ============================================
 *   像素画3D扩展模块 - v65 (重写版)
 *   工作流: 导入图片 -> 3D预览 -> 像素编辑 -> 导出OBJ
 *   依赖: Three.js r128 (全局 THREE), OrbitControls
 *   被 pixel-paint.js 调用
 * ============================================
 */

var PixelPaint3D = (function() {
    'use strict';

    // ---- 常量 ----
    var FACE_COLORS = {
        front:  '#ef4444',
        back:   '#f97316',
        left:   '#22c55e',
        right:  '#3b82f6',
        top:    '#eab308',
        bottom: '#a855f7'
    };

    var FACE_LABELS = {
        front:  '正面',
        back:   '背面',
        left:   '左侧',
        right:  '右侧',
        top:    '顶部',
        bottom: '底部'
    };

    // BoxGeometry 面顺序: +X(右), -X(左), +Y(上), -Y(下), +Z(前), -Z(后)
    var FACE_ORDER = ['right', 'left', 'top', 'bottom', 'front', 'back'];

    // 7个预设视角
    var PRESET_VIEWS = [
        { name: '前', pos: [0, 0, 5],  target: [0, 0, 0] },
        { name: '后', pos: [0, 0, -5], target: [0, 0, 0] },
        { name: '左', pos: [-5, 0, 0], target: [0, 0, 0] },
        { name: '右', pos: [5, 0, 0],  target: [0, 0, 0] },
        { name: '顶', pos: [0, 5, 0.01], target: [0, 0, 0] },
        { name: '底', pos: [0, -5, 0.01], target: [0, 0, 0] },
        { name: '等轴', pos: [3, 3, 3], target: [0, 0, 0] }
    ];

    // ---- 内部状态 ----
    var _mode = '2d';
    var _containerEl = null;
    var _previewCanvas = null;
    var _renderer = null;
    var _scene = null;
    var _camera = null;
    var _controls = null;
    var _cube = null;
    var _materials = [];
    var _textures = [];
    var _animFrameId = null;
    var _resizeObserver = null;

    // 六面像素数据: { front: [[color|null,...],...], ... }
    var _faceData = {
        front:  null,
        back:   null,
        left:   null,
        right:  null,
        top:    null,
        bottom: null
    };

    // 每个面的离屏canvas（像素编辑用）
    var _faceCanvases = {};
    // 每个面的原始图片（缩放时从原始图计算，避免细节丢失）
    var _faceOriginals = {};
    // 每个面的UV偏移和缩放
    var _faceOffsets = {};
    var _faceMeshes = [];
    var _defaultPos = {
        front:  { x: 0, y: 0, z: 0.5 },
        back:   { x: 0, y: 0, z: -0.5 },
        left:   { x: -0.5, y: 0, z: 0 },
        right:  { x: 0.5, y: 0, z: 0 },
        top:    { x: 0, y: 0.5, z: 0 },
        bottom: { x: 0, y: -0.5, z: 0 }
    };
    FACE_ORDER.forEach(function(f) {
        var p = _defaultPos[f];
        _faceCanvases[f] = null;
        _faceOriginals[f] = null;
        _faceOffsets[f] = { x: p.x, y: p.y, z: p.z, width: 1, height: 1 };
    });

    // 当前选中的面（用于标记）
    var _activeFace = 'front';

    // 待分配的图片（手动分配模式）
    var _pendingImages = [];
    var _currentScale = 1; // 当前全局缩放比例（相对于原始图）

    // 视角动画
    var _viewAnimating = false;
    var _viewAnimStart = 0;
    var _viewAnimDuration = 500;
    var _viewFromPos = null;
    var _viewFromTarget = null;
    var _viewToPos = null;
    var _viewToTarget = null;

    // ---- 工具函数 ----
    function _clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

    function _lerp(a, b, t) { return a + (b - a) * t; }

    function _easeInOutCubic(t) {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    // 计算面的有效像素区域（去除空边距）
    function _getFaceBounds(data) {
        if (!data || !data.length || !data[0].length) return null;
        var h = data.length, w = data[0].length;
        var minR = h, maxR = -1, minC = w, maxC = -1;
        for (var r = 0; r < h; r++) {
            for (var c = 0; c < w; c++) {
                if (data[r][c]) {
                    if (r < minR) minR = r;
                    if (r > maxR) maxR = r;
                    if (c < minC) minC = c;
                    if (c > maxC) maxC = c;
                }
            }
        }
        if (maxR < 0) return null;
        return { x: minC, y: minR, w: maxC - minC + 1, h: maxR - minR + 1 };
    }

    // 获取所有面中最大的有效尺寸
    function _getMaxFaceSize() {
        var maxW = 0, maxH = 0;
        FACE_ORDER.forEach(function(face) {
            var b = _getFaceBounds(_faceData[face]);
            if (b) {
                if (b.w > maxW) maxW = b.w;
                if (b.h > maxH) maxH = b.h;
            }
        });
        return { w: maxW || 1, h: maxH || 1 };
    }

    // 从面数据创建离屏 canvas 纹理
    // 优先使用 _faceCanvases 中的实际图片，否则从 _faceData 生成
    function _createFaceCanvas(face) {
        // 如果已有离屏canvas，直接克隆使用（避免修改原始）
        if (_faceCanvases[face]) {
            var src = _faceCanvases[face];
            var clone = document.createElement('canvas');
            clone.width = src.width;
            clone.height = src.height;
            clone.getContext('2d').drawImage(src, 0, 0);
            return clone;
        }

        var data = _faceData[face];
        var canvas = document.createElement('canvas');
        if (!data || !data.length) {
            canvas.width = 1;
            canvas.height = 1;
            return canvas;
        }
        var w = data[0].length;
        var h = data.length;
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, w, h);
        for (var r = 0; r < h; r++) {
            for (var c = 0; c < w; c++) {
                var color = data[r][c];
                if (color) {
                    ctx.fillStyle = color;
                    ctx.fillRect(c, r, 1, 1);
                }
            }
        }
        return canvas;
    }

    // 自动裁剪canvas四周透明区域
    function _trimCanvas(canvas) {
        if (!canvas) return canvas;
        var ctx = canvas.getContext('2d');
        var w = canvas.width, h = canvas.height;
        if (w === 0 || h === 0) return canvas;
        var imgData = ctx.getImageData(0, 0, w, h);
        var d = imgData.data;
        var top = 0, bottom = h - 1, left = 0, right = w - 1;

        while (top < h) { var hp = false; for (var x = 0; x < w; x++) { if (d[(top*w+x)*4+3] > 0) { hp = true; break; } } if (hp) break; top++; }
        while (bottom >= top) { var hp2 = false; for (var x2 = 0; x2 < w; x2++) { if (d[(bottom*w+x2)*4+3] > 0) { hp2 = true; break; } } if (hp2) break; bottom--; }
        while (left < w) { var hp3 = false; for (var y = top; y <= bottom; y++) { if (d[(y*w+left)*4+3] > 0) { hp3 = true; break; } } if (hp3) break; left++; }
        while (right >= left) { var hp4 = false; for (var y2 = top; y2 <= bottom; y2++) { if (d[(y2*w+right)*4+3] > 0) { hp4 = true; break; } } if (hp4) break; right--; }

        if (top === 0 && bottom === h-1 && left === 0 && right === w-1) return canvas;
        var tw = right - left + 1, th = bottom - top + 1;
        if (tw <= 0 || th <= 0) return canvas;
        var trimmed = document.createElement('canvas');
        trimmed.width = tw; trimmed.height = th;
        trimmed.getContext('2d').drawImage(canvas, left, top, tw, th, 0, 0, tw, th);
        return trimmed;
    }

    // 裁剪后自动设置宽高比（width=1，height匹配图片比例，不拉伸）
    function _autoSetFaceSize(face) {
        var canvas = _faceCanvases[face];
        if (!canvas) return;
        var off = _faceOffsets[face];
        if (!off) return;
        off.width = 1;
        off.height = canvas.height / canvas.width;
    }

    // 从 canvas 提取 _faceData 二维数组
    function _extractFaceDataFromCanvas(canvas) {
        if (!canvas) return null;
        var ctx = canvas.getContext('2d');
        var w = canvas.width;
        var h = canvas.height;
        if (w <= 0 || h <= 0) return null;
        var imgData = ctx.getImageData(0, 0, w, h);
        var pixels = imgData.data;
        var result = [];
        for (var r = 0; r < h; r++) {
            var row = [];
            for (var c = 0; c < w; c++) {
                var idx = (r * w + c) * 4;
                var a = pixels[idx + 3];
                if (a < 10) {
                    row.push(null);
                } else {
                    var hex = '#' +
                        ('0' + pixels[idx].toString(16)).slice(-2) +
                        ('0' + pixels[idx + 1].toString(16)).slice(-2) +
                        ('0' + pixels[idx + 2].toString(16)).slice(-2);
                    row.push(hex);
                }
            }
            result.push(row);
        }
        return result;
    }

    // ---- Three.js 初始化 ----
    var _threeInitialized = false;

    function _initThreeJS() {
        if (!THREE) {
            console.warn('PixelPaint3D: THREE not available');
            return false;
        }
        if (!_previewCanvas) return false;

        var w = _previewCanvas.clientWidth || 280;
        var h = _previewCanvas.clientHeight || 400;
        if (w < 1) w = 280;
        if (h < 1) h = 400;

        // 渲染器
        _renderer = new THREE.WebGLRenderer({
            canvas: _previewCanvas,
            antialias: false,
            alpha: true
        });
        _renderer.setPixelRatio(window.devicePixelRatio || 1);
        _renderer.setSize(w, h, false);
        _renderer.setClearColor(0x0d0d1a, 1);

        // 场景
        _scene = new THREE.Scene();

        // 相机
        _camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 100);
        _camera.position.set(3, 3, 3);
        _camera.lookAt(0, 0, 0);

        // 控制器
        if (THREE.OrbitControls) {
            _controls = new THREE.OrbitControls(_camera, _previewCanvas);
            _controls.enableDamping = true;
            _controls.dampingFactor = 0.08;
            _controls.enablePan = true;
            _controls.minDistance = 1;
            _controls.maxDistance = 20;
        }

        // 网格辅助线
        var gridHelper = new THREE.GridHelper(10, 20, 0x333355, 0x222244);
        gridHelper.position.y = -0.5;
        _scene.add(gridHelper);

        // 坐标轴辅助（小型）
        var axesHelper = new THREE.AxesHelper(1.5);
        _scene.add(axesHelper);

        // 初始化材质数组（6个面）
        _materials = [];
        _textures = [];
        for (var i = 0; i < 6; i++) {
            _textures.push(null);
            _materials.push(new THREE.MeshBasicMaterial({
                color: 0x444444,
                transparent: true,
                opacity: 0.3
            }));
        }

        // 创建初始立方体
        _createCube(1, 1, 1);

        // 开始渲染循环
        _startRenderLoop();

        _threeInitialized = true;
        return true;
    }

    function _createCube(sx, sy, sz) {
        if (_cube) {
            _scene.remove(_cube);
            _cube.geometry.dispose();
        }
        var geo = new THREE.BoxGeometry(sx, sy, sz);
        _cube = new THREE.Mesh(geo, _materials);
        _scene.add(_cube);
    }

    function _startRenderLoop() {
        if (_animFrameId) cancelAnimationFrame(_animFrameId);
        function loop() {
            _animFrameId = requestAnimationFrame(loop);
            if (_viewAnimating) {
                _updateViewAnimation();
            }
            if (_controls) _controls.update();
            if (_renderer && _scene && _camera) {
                _renderer.render(_scene, _camera);
            }
        }
        loop();
    }

    function _stopRenderLoop() {
        if (_animFrameId) {
            cancelAnimationFrame(_animFrameId);
            _animFrameId = null;
        }
    }

    function _disposeThreeJS() {
        _stopRenderLoop();
        if (_controls) { _controls.dispose(); _controls = null; }
        if (_cube) { _cube.geometry.dispose(); _cube = null; }
        if (_faceMeshes) {
            _faceMeshes.forEach(function(m) {
                if (m) {
                    if (m.geometry) m.geometry.dispose();
                    if (m.material) {
                        if (m.material.map) m.material.map.dispose();
                        m.material.dispose();
                    }
                    _scene.remove(m);
                }
            });
        }
        _faceMeshes = [];
        _textures.forEach(function(t) { if (t) t.dispose(); });
        _textures = [];
        _materials.forEach(function(m) { m.dispose(); });
        _materials = [];
        if (_renderer) { _renderer.dispose(); _renderer = null; }
        _scene = null;
        _camera = null;
        if (_resizeObserver) { _resizeObserver.disconnect(); _resizeObserver = null; }
        _threeInitialized = false;
    }

    // ---- 视角动画 ----
    function _animateToView(viewIdx) {
        if (viewIdx < 0 || viewIdx >= PRESET_VIEWS.length) return;
        var view = PRESET_VIEWS[viewIdx];
        if (!_camera) return;

        _viewAnimating = true;
        _viewAnimStart = performance.now();
        _viewFromPos = _camera.position.toArray();
        _viewFromTarget = _controls ? _controls.target.toArray() : [0, 0, 0];
        _viewToPos = view.pos.slice();
        _viewToTarget = view.target.slice();
    }

    function _updateViewAnimation() {
        var elapsed = performance.now() - _viewAnimStart;
        var t = _clamp(elapsed / _viewAnimDuration, 0, 1);
        var e = _easeInOutCubic(t);

        _camera.position.set(
            _lerp(_viewFromPos[0], _viewToPos[0], e),
            _lerp(_viewFromPos[1], _viewToPos[1], e),
            _lerp(_viewFromPos[2], _viewToPos[2], e)
        );

        if (_controls) {
            _controls.target.set(
                _lerp(_viewFromTarget[0], _viewToTarget[0], e),
                _lerp(_viewFromTarget[1], _viewToTarget[1], e),
                _lerp(_viewFromTarget[2], _viewToTarget[2], e)
            );
        }

        if (t >= 1) {
            _viewAnimating = false;
        }
    }

    // ---- 纹理更新 ----
    function _updateFaceTextureInternal(face) {
        var idx = FACE_ORDER.indexOf(face);
        if (idx < 0 || !_faceMeshes[idx]) return;
        var mesh = _faceMeshes[idx];
        if (mesh.material && mesh.material.map) {
            mesh.material.map.dispose();
        }
        var tex = new THREE.CanvasTexture(_faceCanvases[face]);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        mesh.material.map = tex;
        mesh.material.needsUpdate = true;
    }

    // ---- 重建3D模型 ----
    function _rebuildCubeInternal() {
        // 移除旧的立方体
        if (_cube) {
            _scene.remove(_cube);
            _cube = null;
        }
        // 移除旧的6个面
        if (_faceMeshes) {
            _faceMeshes.forEach(function(m) { if (m) _scene.remove(m); });
        }
        _faceMeshes = [];

        var hasAny = FACE_ORDER.some(function(f) { return _faceCanvases[f] !== null; });
        if (!hasAny) return;

        // 创建6个独立平面
        FACE_ORDER.forEach(function(face, idx) {
            var canvas = _faceCanvases[face];
            if (!canvas) { _faceMeshes.push(null); return; }

            var off = _faceOffsets[face];
            var w = Math.max(0.01, off.width);
            var h = Math.max(0.01, off.height);

            var geo = new THREE.PlaneGeometry(w, h);
            var tex = new THREE.CanvasTexture(canvas);
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            var mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide });
            var mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(off.x, off.y, off.z);

            // 根据面设置旋转
            switch (face) {
                case 'back':   mesh.rotation.y = Math.PI; break;
                case 'left':   mesh.rotation.y = -Math.PI / 2; break;
                case 'right':  mesh.rotation.y = Math.PI / 2; break;
                case 'top':    mesh.rotation.x = -Math.PI / 2; break;
                case 'bottom': mesh.rotation.x = Math.PI / 2; break;
            }

            _scene.add(mesh);
            _faceMeshes.push(mesh);
        });
    }

    // ---- 导入展开图（十字形布局自动裁剪） ----
    function _importSpriteSheetInternal(img) {
        if (!img) return;

        // 将图片绘制到临时canvas
        var tmpCanvas = document.createElement('canvas');
        tmpCanvas.width = img.width;
        tmpCanvas.height = img.height;
        var tmpCtx = tmpCanvas.getContext('2d');
        tmpCtx.drawImage(img, 0, 0);

        // 十字形布局检测与裁剪
        // 标准十字形布局（4列 x 3行）:
        //        [top]
        // [left] [front] [right] [back]
        //        [bottom]
        var cellW = Math.floor(img.width / 4);
        var cellH = Math.floor(img.height / 3);
        var ratio = img.width / img.height;

        // 十字形布局判断：宽高比在 1.0 ~ 2.0 之间（宽松范围）
        // 很多展开图不完全是4:3
        if (ratio >= 0.8 && ratio <= 2.0 && cellW > 4 && cellH > 4) {
            // 十字形布局
            // top:    col=1, row=0
            // left:   col=0, row=1
            // front:  col=1, row=1
            // right:  col=2, row=1
            // back:   col=3, row=1
            // bottom: col=1, row=2
            var regions = {
                top:    { x: cellW, y: 0, w: cellW, h: cellH },
                left:   { x: 0, y: cellH, w: cellW, h: cellH },
                front:  { x: cellW, y: cellH, w: cellW, h: cellH },
                right:  { x: cellW * 2, y: cellH, w: cellW, h: cellH },
                back:   { x: cellW * 3, y: cellH, w: cellW, h: cellH },
                bottom: { x: cellW, y: cellH * 2, w: cellW, h: cellH }
            };

            var faces = ['front', 'back', 'left', 'right', 'top', 'bottom'];
            faces.forEach(function(face) {
                var r = regions[face];
                var faceCanvas = document.createElement('canvas');
                faceCanvas.width = r.w;
                faceCanvas.height = r.h;
                var fctx = faceCanvas.getContext('2d');
                fctx.drawImage(tmpCanvas, r.x, r.y, r.w, r.h, 0, 0, r.w, r.h);
                faceCanvas = _trimCanvas(faceCanvas);
                _autoSetFaceSize(face);
                _faceCanvases[face] = faceCanvas;
                _faceOriginals[face] = faceCanvas;
                _faceData[face] = _extractFaceDataFromCanvas(faceCanvas);
            });
        } else {
            // 非标准布局：尝试条形布局（6张横排或竖排）
            // 横排: 6列 x 1行
            // 竖排: 1列 x 6行
            if (ratio >= 5) {
                // 横排条形
                var stripW = Math.floor(img.width / 6);
                var stripH = img.height;
                var faceNames = ['front', 'back', 'left', 'right', 'top', 'bottom'];
                faceNames.forEach(function(face, i) {
                    var faceCanvas = document.createElement('canvas');
                    faceCanvas.width = stripW;
                    faceCanvas.height = stripH;
                    var fctx = faceCanvas.getContext('2d');
                    fctx.drawImage(tmpCanvas, i * stripW, 0, stripW, stripH, 0, 0, stripW, stripH);
                    faceCanvas = _trimCanvas(faceCanvas);
                    _autoSetFaceSize(face);
                    _faceCanvases[face] = faceCanvas;
                    _faceOriginals[face] = faceCanvas;
                    _faceData[face] = _extractFaceDataFromCanvas(faceCanvas);
                });
            } else if (ratio < 0.25) {
                // 竖排条形
                var stripW2 = img.width;
                var stripH2 = Math.floor(img.height / 6);
                var faceNames2 = ['front', 'back', 'left', 'right', 'top', 'bottom'];
                faceNames2.forEach(function(face, i) {
                    var faceCanvas = document.createElement('canvas');
                    faceCanvas.width = stripW2;
                    faceCanvas.height = stripH2;
                    var fctx = faceCanvas.getContext('2d');
                    fctx.drawImage(tmpCanvas, 0, i * stripH2, stripW2, stripH2, 0, 0, stripW2, stripH2);
                    faceCanvas = _trimCanvas(faceCanvas);
                    _autoSetFaceSize(face);
                    _faceCanvases[face] = faceCanvas;
                    _faceOriginals[face] = faceCanvas;
                    _faceData[face] = _extractFaceDataFromCanvas(faceCanvas);
                });
            } else {
                // 无法识别的布局：弹出分配界面让用户手动分配
                _showFaceAssignUI([img]);
            }
        }

        // 如果成功裁剪了至少一个面，重建3D模型
        var hasFace = FACE_ORDER.some(function(f) { return _faceCanvases[f] !== null; });
        if (hasFace) {
            _rebuildCubeInternal();
            _updatePreviewInfo();
        }
    }

    // ---- 手动分配图片到面 ----
    function _showFaceAssignUI(images) {
        if (!_containerEl) return;
        // 移除旧的分配UI
        var old = _containerEl.querySelector('.pp3d-assign-ui');
        if (old) old.remove();

        // 生成选项（排除已被其他下拉菜单选中或已有图片的面）
        function _getFaceOptions(excludeFace) {
            var selected = [];
            _containerEl.querySelectorAll('.pp3d-assign-face').forEach(function(sel) {
                if (sel.value) selected.push(sel.value);
            });
            var opts = '<option value="">请选择</option>';
            FACE_ORDER.forEach(function(f) {
                var label = FACE_LABELS[f] || f;
                if (_faceCanvases[f] !== null && f !== excludeFace) {
                    opts += '<option value="' + f + '" disabled>' + label + '(已使用)</option>';
                } else {
                    var disabled = (selected.indexOf(f) >= 0 && f !== excludeFace);
                    var sel = (f === excludeFace) ? ' selected' : '';
                    opts += '<option value="' + f + '"' + (disabled ? ' disabled' : '') + sel + '>' + label + '</option>';
                }
            });
            return opts;
        }

        var html = '<div class="pp3d-assign-ui">';
        html += '<div class="pp3d-assign-title">分配图片到面</div>';
        html += '<div class="pp3d-assign-grid">';
        images.forEach(function(img, i) {
            html += '<div class="pp3d-assign-card">';
            html += '<img class="pp3d-assign-thumb" src="' + img.src + '">';
            html += '<select class="pp3d-assign-face" data-idx="' + i + '">' + _getFaceOptions() + '</select>';
            html += '</div>';
        });
        html += '</div>';
        html += '<button class="pp3d-assign-btn" id="pp3dAssignConfirm">确认分配</button>';
        html += '</div>';

        _containerEl.insertAdjacentHTML('afterbegin', html);

        // 下拉菜单变更时刷新所有选项（自动排除已选中的）
        _containerEl.querySelectorAll('.pp3d-assign-face').forEach(function(sel) {
            sel.addEventListener('change', function() {
                _containerEl.querySelectorAll('.pp3d-assign-face').forEach(function(s) {
                    var cur = s.value;
                    s.innerHTML = _getFaceOptions(cur);
                });
            });
        });

        // 绑定确认按钮
        _containerEl.querySelector('#pp3dAssignConfirm').addEventListener('click', function() {
            var selects = _containerEl.querySelectorAll('.pp3d-assign-face');
            selects.forEach(function(sel) {
                var idx = parseInt(sel.getAttribute('data-idx'));
                var face = sel.value;
                if (!face) return; // 跳过未选择的
                _assignImageToFace(images[idx], face);
            });
            // 移除分配UI
            var ui = _containerEl.querySelector('.pp3d-assign-ui');
            if (ui) ui.remove();
            _pendingImages = [];
            // 更新信息
            _updatePreviewInfo();
        });
    }

    function _assignImageToFace(img, face) {
        if (!FACE_ORDER.includes(face)) return;
        var canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas = _trimCanvas(canvas);
        _autoSetFaceSize(face);
        _faceCanvases[face] = canvas;
        _faceOriginals[face] = canvas;
        _faceData[face] = _extractFaceDataFromCanvas(canvas);
        _updateFaceTextureInternal(face);
        _rebuildCubeInternal();
    }

    // ---- 导入六面独立图 ----
    function _importSixFacesInternal(images) {
        if (!images || images.length === 0) return;

        // 按顺序分配: [正, 背, 左, 右, 顶, 底]
        var faceNames = ['front', 'back', 'left', 'right', 'top', 'bottom'];
        var count = Math.min(images.length, 6);

        for (var i = 0; i < count; i++) {
            var img = images[i];
            if (!img) continue;
            var faceCanvas = document.createElement('canvas');
            faceCanvas.width = img.width;
            faceCanvas.height = img.height;
            var ctx = faceCanvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            faceCanvas = _trimCanvas(faceCanvas);
            _autoSetFaceSize(faceNames[i]);
            _faceCanvases[faceNames[i]] = faceCanvas;
            _faceOriginals[faceNames[i]] = faceCanvas;
            _faceData[faceNames[i]] = _extractFaceDataFromCanvas(faceCanvas);
        }

        // 重建3D模型
        _rebuildCubeInternal();
        _updatePreviewInfo();
    }

    // ---- 导出OBJ ----
    function _exportOBJInternal() {
        // 检查是否有数据
        var hasAny = FACE_ORDER.some(function(f) { return _faceCanvases[f] !== null; });
        if (!hasAny) {
            _showMsg('无3D数据可导出');
            return;
        }

        var obj = '# PixelPaint3D OBJ Export\n';
        obj += '# Generated by PixelPaint3D\n';
        obj += 'mtllib pixel3d.mtl\n\n';

        var vertexOffset = 0;
        var normalOffset = 0;
        var uvOffset = 0;

        // 遍历6个面
        FACE_ORDER.forEach(function(face, fi) {
            var mesh = _faceMeshes[fi];
            if (!mesh) return;

            var geo = mesh.geometry;
            var pos = geo.attributes.position;
            var norm = geo.attributes.normal;
            var uv = geo.attributes.uv;

            if (!pos) return;

            obj += 'g ' + face + '\n';

            // 顶点（应用mesh的世界变换）
            mesh.updateMatrixWorld(true);
            var matrix = mesh.matrixWorld;

            for (var i = 0; i < pos.count; i++) {
                var v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i));
                v.applyMatrix4(matrix);
                obj += 'v ' + v.x.toFixed(6) + ' ' + v.y.toFixed(6) + ' ' + v.z.toFixed(6) + '\n';
            }

            // 法线（应用mesh的世界变换）
            if (norm) {
                var normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
                for (var i = 0; i < norm.count; i++) {
                    var n = new THREE.Vector3(norm.getX(i), norm.getY(i), norm.getZ(i));
                    n.applyMatrix3(normalMatrix).normalize();
                    obj += 'vn ' + n.x.toFixed(6) + ' ' + n.y.toFixed(6) + ' ' + n.z.toFixed(6) + '\n';
                }
            }

            // UV
            if (uv) {
                for (var i = 0; i < uv.count; i++) {
                    obj += 'vt ' + uv.getX(i).toFixed(6) + ' ' + uv.getY(i).toFixed(6) + '\n';
                }
            }

            obj += 'usemtl pixel3d_default\n';

            // 面（索引三角形）
            if (geo.index) {
                var idx = geo.index;
                for (var i = 0; i < idx.count; i += 3) {
                    var a = idx.getX(i) + 1 + vertexOffset;
                    var b = idx.getX(i + 1) + 1 + vertexOffset;
                    var c = idx.getX(i + 2) + 1 + vertexOffset;
                    var na = a + normalOffset;
                    var nb = b + normalOffset;
                    var nc = c + normalOffset;
                    var ta = a + uvOffset;
                    var tb = b + uvOffset;
                    var tc = c + uvOffset;
                    obj += 'f ' + a + '/' + ta + '/' + na + ' ' +
                                   b + '/' + tb + '/' + nb + ' ' +
                                   c + '/' + tc + '/' + nc + '\n';
                }
            } else {
                for (var i = 0; i < pos.count; i += 3) {
                    var a = i + 1 + vertexOffset;
                    var b = i + 2 + vertexOffset;
                    var c = i + 3 + vertexOffset;
                    var na = a + normalOffset;
                    var nb = b + normalOffset;
                    var nc = c + normalOffset;
                    var ta = a + uvOffset;
                    var tb = b + uvOffset;
                    var tc = c + uvOffset;
                    obj += 'f ' + a + '/' + ta + '/' + na + ' ' +
                                   b + '/' + tb + '/' + nb + ' ' +
                                   c + '/' + tc + '/' + nc + '\n';
                }
            }

            vertexOffset += pos.count;
            if (norm) normalOffset += norm.count;
            if (uv) uvOffset += uv.count;

            obj += '\n';
        });

        // 触发下载
        var blob = new Blob([obj], { type: 'text/plain' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = 'pixel3d-cube.obj';
        a.click();
        URL.revokeObjectURL(url);
    }

    // ---- 镂空补充 ----
    function _fillHollowFacesInternal() {
        FACE_ORDER.forEach(function(face) {
            var data = _faceData[face];
            if (!data || !data.length) return;

            var h = data.length;
            var w = data[0].length;

            // 多轮填充：从边缘向内逐步填充空白区域
            var changed = true;
            var maxIter = Math.max(w, h);
            var iter = 0;
            while (changed && iter < maxIter) {
                changed = false;
                iter++;
                for (var r = 0; r < h; r++) {
                    for (var c = 0; c < w; c++) {
                        if (data[r][c] !== null) continue;

                        // 查找相邻的非空像素
                        var neighbors = [];
                        if (r > 0 && data[r - 1][c] !== null) neighbors.push(data[r - 1][c]);
                        if (r < h - 1 && data[r + 1][c] !== null) neighbors.push(data[r + 1][c]);
                        if (c > 0 && data[r][c - 1] !== null) neighbors.push(data[r][c - 1]);
                        if (c < w - 1 && data[r][c + 1] !== null) neighbors.push(data[r][c + 1]);

                        if (neighbors.length >= 2) {
                            // 使用最常见的颜色
                            var colorCount = {};
                            var maxCount = 0;
                            var fillColor = neighbors[0];
                            for (var ni = 0; ni < neighbors.length; ni++) {
                                var nc = neighbors[ni];
                                colorCount[nc] = (colorCount[nc] || 0) + 1;
                                if (colorCount[nc] > maxCount) {
                                    maxCount = colorCount[nc];
                                    fillColor = nc;
                                }
                            }
                            data[r][c] = fillColor;
                            changed = true;
                        }
                    }
                }
            }

            // 同步更新 _faceCanvases
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            var ctx = canvas.getContext('2d');
            for (var r2 = 0; r2 < h; r2++) {
                for (var c2 = 0; c2 < w; c2++) {
                    if (data[r2][c2]) {
                        ctx.fillStyle = data[r2][c2];
                        ctx.fillRect(c2, r2, 1, 1);
                    }
                }
            }
            _faceCanvases[face] = canvas;
            _faceOriginals[face] = canvas;
        });

        // 重建3D模型
        _rebuildCubeInternal();
        _updatePreviewInfo();
    }

    // ---- HTML 生成 ----
    // 模式切换HTML（始终显示在左侧顶部）
    function _buildModeToggleHTML() {
        return '<div class="pp-panel-section" id="ppSec3DMode" style="height:auto;flex:none;">' +
            '<div class="pp3d-tools" id="pp3dModeToggle">' +
            '<div class="pp3d-mode-toggle">' +
                '<button class="pp3d-mode-btn active" data-mode="2d">2D</button>' +
                '<button class="pp3d-mode-btn" data-mode="3d">3D</button>' +
            '</div>' +
            '</div></div>';
    }

    // 3D工具栏HTML（导入/导出按钮 + 面切换按钮）
    function _buildToolbarHTML() {
        var faceBtns = FACE_ORDER.map(function(f) {
            var label = FACE_LABELS[f] || f;
            return '<button class="pp3d-face-btn" data-face="' + f + '">' + label + '</button>';
        }).join('');
        return '<div class="pp3d-toolbar" id="pp3dToolbar" style="display:none;">' +
            '<div class="pp3d-import-section">' +
                '<button id="pp3dImportSprite">导入展开图</button>' +
                '<button id="pp3dImportFaces">导入六面图</button>' +
                '<input type="file" id="pp3dFileSprite" accept="image/*" style="display:none">' +
                '<input type="file" id="pp3dFileFaces" accept="image/*" multiple style="display:none">' +
            '</div>' +
            '<div class="pp3d-face-section" id="pp3dFaceSection" style="display:none;">' +
                '<span class="pp3d-face-label">编辑面:</span>' +
                faceBtns +
                '<button class="pp3d-action-btn" id="pp3dSaveFace" style="margin-left:4px;">保存回3D</button>' +
            '</div>' +
            '<div class="pp3d-scale-section" id="pp3dScaleSection" style="display:none;">' +
                '<span class="pp3d-scale-label">全局缩放:</span>' +
                '<button class="pp3d-action-btn" id="pp3dScaleDown">÷2</button>' +
                '<span class="pp3d-scale-val" id="pp3dScaleVal">100%</span>' +
                '<button class="pp3d-action-btn" id="pp3dScaleUp">×2</button>' +
            '</div>' +
            '<div class="pp3d-actions">' +
                '<button id="pp3dExportSprite">导出展开图</button>' +
                '<button id="pp3dExportOBJ">导出OBJ</button>' +
                '<button id="pp3dClearAll">清除</button>' +
            '</div>' +
        '</div>';
    }

    // 3D预览面板HTML
    function _buildPreviewHTML() {
        var viewBtns = '';
        PRESET_VIEWS.forEach(function(v, i) {
            viewBtns += '<button class="pp3d-view-btn" data-view="' + i + '">' + v.name + '</button>';
        });

        return '<div class="pp3d-preview-panel" id="pp3dPreviewPanel">' +
            '<div class="pp3d-preview-header">' +
                '<span class="pp3d-preview-title">3D 预览</span>' +
                '<div class="pp3d-view-btns">' + viewBtns + '</div>' +
            '</div>' +
            '<div class="pp3d-preview-canvas-wrap" id="pp3dPreviewWrap">' +
                '<canvas id="pp3dPreviewCanvas"></canvas>' +
                '<div class="pp3d-face-props" id="pp3dFaceProps" style="display:none;">' +
                    '<div class="pp3d-props-header">' +
                        '<span class="pp3d-props-title" id="pp3dPropsTitle">正面 属性</span>' +
                        '<button class="pp3d-props-close" id="pp3dPropsClose">×</button>' +
                    '</div>' +
                    '<div class="pp3d-props-body">' +
                        '<div class="pp3d-prop-row"><label>X:</label><input type="range" id="pp3dPropX" min="-2" max="2" step="0.05" value="0"><span id="pp3dPropXVal">0</span></div>' +
                        '<div class="pp3d-prop-row"><label>Y:</label><input type="range" id="pp3dPropY" min="-2" max="2" step="0.05" value="0"><span id="pp3dPropYVal">0</span></div>' +
                        '<div class="pp3d-prop-row"><label>Z:</label><input type="range" id="pp3dPropZ" min="-2" max="2" step="0.05" value="0"><span id="pp3dPropZVal">0</span></div>' +
                        '<div class="pp3d-prop-row" style="border-top:1px solid #222;padding-top:3px;margin-top:3px;"><label>W:</label><input type="range" id="pp3dPropWidth" min="0.1" max="4" step="0.05" value="1"><span id="pp3dPropWidthVal">1</span></div>' +
                        '<div class="pp3d-prop-row"><label>H:</label><input type="range" id="pp3dPropHeight" min="0.1" max="4" step="0.05" value="1"><span id="pp3dPropHeightVal">1</span></div>' +
                        '<button class="pp3d-props-reset" id="pp3dResetFacePos">重置</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div class="pp3d-preview-info" id="pp3dPreviewInfo">暂无3D数据</div>' +
        '</div>';
    }

    function _buildToolHTML() {
        return _buildModeToggleHTML();
    }

    // ---- CSS ----
    function _getCSS() {
        return '' +
        /* 模式切换（左侧顶部） */
        '.pp3d-tools{padding:6px 8px;}' +
        '.pp3d-mode-toggle{display:flex;gap:2px;background:rgba(10,15,35,0.7);border-radius:6px;padding:2px;backdrop-filter:blur(24px) saturate(180%);}' +
        '.pp3d-mode-btn{flex:1;padding:4px 0;border:1px solid rgba(100,160,255,0.15);border-radius:6px;background:rgba(20,30,60,0.65);color:#94a3b8;cursor:pointer;font-size:12px;font-family:inherit;transition:all .15s;}' +
        '.pp3d-mode-btn:hover{color:#e8edf5;transform:translateY(-1px);}' +
        '.pp3d-mode-btn.active{background:#38bdf8;color:#fff;border-color:#38bdf8;}' +

        /* 3D工具栏 */
        '.pp3d-toolbar{display:flex;align-items:center;gap:6px;padding:4px 8px;background:rgba(10,15,35,0.7);border-bottom:1px solid rgba(100,160,255,0.1);flex-shrink:0;flex-wrap:wrap;backdrop-filter:blur(24px) saturate(180%);}' +
        '.pp3d-action-btn{padding:3px 8px;border:1px solid rgba(56,189,248,0.27);border-radius:6px;background:rgba(56,189,248,0.09);color:#38bdf8;cursor:pointer;font-size:10px;font-family:inherit;transition:all .15s;white-space:nowrap;}' +
        '.pp3d-action-btn:hover{background:rgba(56,189,248,0.2);border-color:#38bdf8;transform:translateY(-1px);}' +
        '.pp3d-action-btn.pp3d-danger{color:#e94560;border-color:rgba(233,69,96,0.27);background:rgba(233,69,96,0.09);}' +
        '.pp3d-action-btn.pp3d-danger:hover{background:rgba(233,69,96,0.2);border-color:#e94560;}' +

        /* 导入区域 */
        '.pp3d-import-section{display:flex;gap:4px;padding:4px 6px;flex-wrap:wrap;}' +
        '.pp3d-import-section button{background:rgba(100,160,255,0.15);color:#94a3b8;border:1px solid rgba(100,160,255,0.2);padding:3px 8px;border-radius:6px;font-size:11px;cursor:pointer;font-family:inherit;transition:all .15s;}' +
        '.pp3d-import-section button:hover{border-color:#e94560;color:#e94560;transform:translateY(-1px);}' +

        /* 面切换区域 */
        '.pp3d-face-section{display:flex;align-items:center;gap:3px;padding:4px 6px;flex-wrap:wrap;}' +
        '.pp3d-face-label{font-size:10px;color:#94a3b8;margin-right:2px;}' +
        '.pp3d-face-btn{padding:2px 6px;border:1px solid rgba(100,160,255,0.15);border-radius:6px;background:rgba(20,30,60,0.65);color:#94a3b8;cursor:pointer;font-size:10px;font-family:inherit;transition:all .15s;}' +
        '.pp3d-face-btn:hover{border-color:#38bdf8;color:#38bdf8;transform:translateY(-1px);}' +
        '.pp3d-face-btn.active{background:#38bdf8;color:#fff;border-color:#38bdf8;}' +

        /* 缩放区域 */
        '.pp3d-scale-section{display:flex;align-items:center;gap:4px;padding:4px 6px;flex-wrap:wrap;}' +
        '.pp3d-scale-label{font-size:10px;color:#94a3b8;}' +
        '.pp3d-scale-val{font-size:10px;color:#e94560;min-width:30px;text-align:center;}' +

        /* 操作按钮区域 */
        '.pp3d-actions{display:flex;gap:4px;padding:4px 6px;}' +

        /* 3D预览面板 */
        '.pp3d-preview-panel{flex:1;min-width:0;background:rgba(10,15,35,0.7);display:flex;flex-direction:column;overflow:hidden;backdrop-filter:blur(24px) saturate(180%);}' +
        '.pp3d-preview-header{display:flex;align-items:center;justify-content:space-between;padding:4px 8px;background:rgba(10,15,35,0.7);border-bottom:1px solid rgba(100,160,255,0.1);flex-shrink:0;flex-wrap:wrap;gap:3px;backdrop-filter:blur(24px) saturate(180%);}' +
        '.pp3d-preview-title{font-size:11px;color:#38bdf8;font-weight:bold;}' +
        '.pp3d-view-btns{display:flex;gap:2px;flex-wrap:wrap;}' +
        '.pp3d-view-btn{padding:1px 5px;border:1px solid rgba(100,160,255,0.15);border-radius:6px;background:rgba(20,30,60,0.65);color:#94a3b8;cursor:pointer;font-size:9px;font-family:inherit;transition:all .15s;}' +
        '.pp3d-view-btn:hover{color:#38bdf8;border-color:rgba(56,189,248,0.4);transform:translateY(-1px);}' +
        '.pp3d-preview-canvas-wrap{flex:1;overflow:hidden;position:relative;min-height:100px;}' +
        '.pp3d-preview-canvas-wrap canvas{width:100%;height:100%;display:block;}' +
        '.pp3d-preview-info{padding:3px 8px;font-size:9px;color:#475569;border-top:1px solid rgba(100,160,255,0.1);flex-shrink:0;text-align:center;}' +

        /* 图片分配UI */
        '.pp3d-assign-ui{background:rgba(15,25,50,0.7);border:1px solid rgba(100,160,255,0.15);border-radius:16px;padding:8px;margin:4px;backdrop-filter:blur(24px) saturate(180%);}' +
        '.pp3d-assign-title{font-size:12px;color:#e94560;font-weight:bold;margin-bottom:6px;}' +
        '.pp3d-assign-grid{display:flex;flex-wrap:wrap;gap:6px;}' +
        '.pp3d-assign-card{display:flex;flex-direction:column;align-items:center;gap:3px;background:rgba(10,15,35,0.7);border:1px solid rgba(100,160,255,0.15);border-radius:6px;padding:4px;}' +
        '.pp3d-assign-thumb{width:60px;height:60px;object-fit:contain;border-radius:6px;background:rgba(10,15,35,0.7);}' +
        '.pp3d-assign-face{background:rgba(10,15,35,0.7);border:1px solid rgba(100,160,255,0.15);color:#e8edf5;padding:2px 4px;border-radius:6px;font-size:11px;font-family:inherit;width:100%;}' +
        '.pp3d-assign-face option:disabled{color:#475569;}' +
        '.pp3d-assign-btn{background:#e94560;color:#fff;border:none;padding:4px 12px;border-radius:6px;font-size:11px;cursor:pointer;margin-top:6px;font-family:inherit;transition:all .15s;}' +
        '.pp3d-assign-btn:hover{background:rgba(220,80,60,0.6);transform:translateY(-1px);}' +

        /* 展开图预览 */
        '.pp3d-sprite-preview{position:absolute;top:10px;left:10px;z-index:100;background:rgba(15,25,50,0.7);border:1px solid rgba(100,160,255,0.15);border-radius:16px;padding:4px;max-width:90%;max-height:90%;overflow:auto;backdrop-filter:blur(24px) saturate(180%);}' +
        '.pp3d-sprite-close{position:absolute;top:2px;right:4px;background:none;border:none;color:#e94560;font-size:16px;cursor:pointer;padding:0 4px;}' +
        '.pp3d-sprite-preview img{max-width:100%;max-height:70vh;display:block;image-rendering:pixelated;}' +

        /* 面属性浮动面板 */
        '.pp3d-face-props{position:absolute;bottom:8px;right:8px;z-index:50;background:rgba(10,15,35,0.85);border:1px solid rgba(100,160,255,0.15);border-radius:16px;padding:0;width:200px;box-shadow:0 4px 12px rgba(0,0,0,0.5);backdrop-filter:blur(24px) saturate(180%);}' +
        '.pp3d-props-header{display:flex;justify-content:space-between;align-items:center;padding:4px 6px;border-bottom:1px solid rgba(100,160,255,0.1);}' +
        '.pp3d-props-title{font-size:10px;color:#38bdf8;font-weight:bold;}' +
        '.pp3d-props-close{background:none;border:none;color:#94a3b8;font-size:14px;cursor:pointer;line-height:1;padding:0 2px;}' +
        '.pp3d-props-close:hover{color:#e94560;}' +
        '.pp3d-props-body{padding:4px 6px;}' +
        '.pp3d-prop-row{display:flex;align-items:center;gap:3px;margin-bottom:2px;}' +
        '.pp3d-prop-row label{font-size:9px;color:#94a3b8;min-width:16px;text-align:right;}' +
        '.pp3d-prop-row input[type=range]{flex:1;height:3px;-webkit-appearance:none;background:rgba(100,160,255,0.15);border-radius:2px;outline:none;margin:0;}' +
        '.pp3d-prop-row input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:8px;height:8px;background:#e94560;border-radius:50%;cursor:pointer;}' +
        '.pp3d-prop-row span{font-size:9px;color:#e94560;min-width:20px;text-align:right;}' +
        '.pp3d-props-reset{width:100%;margin-top:3px;padding:2px 0;border:1px solid rgba(100,160,255,0.15);border-radius:6px;background:rgba(20,30,60,0.65);color:#94a3b8;font-size:9px;cursor:pointer;font-family:inherit;transition:all .15s;}' +
        '.pp3d-props-reset:hover{color:#38bdf8;border-color:rgba(56,189,248,0.4);transform:translateY(-1px);}' +

        /* 按钮通用 active 反馈 */
        '.pp3d-mode-btn:active,.pp3d-action-btn:active,.pp3d-face-btn:active,.pp3d-view-btn:active,.pp3d-assign-btn:active,.pp3d-props-reset:active,.pp3d-import-section button:active{transform:scale(0.92);}'
    }

    // ---- 显示面属性面板 ----
    function _showFaceProps(face) {
        _activeFace = face;
        var propsPanel = _containerEl ? _containerEl.querySelector('#pp3dFaceProps') : null;
        if (!propsPanel) return;

        propsPanel.style.display = 'block';

        var titleEl = _containerEl.querySelector('#pp3dPropsTitle');
        if (titleEl) titleEl.textContent = (FACE_LABELS[face] || face) + ' 属性';

        var off = _faceOffsets[face] || { x: 0, y: 0, z: 0, width: 1, height: 1 };

        ['X','Y','Z','Width','Height'].forEach(function(prop) {
            var slider = _containerEl.querySelector('#pp3dProp' + prop);
            var valEl = _containerEl.querySelector('#pp3dProp' + prop + 'Val');
            var key = prop[0].toLowerCase() + prop.slice(1);
            if (slider) slider.value = off[key];
            if (valEl) valEl.textContent = off[key];
        });
    }

    // ---- 事件绑定 ----
    function _bindEvents() {
        if (!_containerEl) return;

        // 模式切换
        var modeBtns = _containerEl.querySelectorAll('.pp3d-mode-btn');
        modeBtns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                PixelPaint3D.setMode(btn.dataset.mode);
            });
        });

        // 导入展开图
        var importSpriteBtn = _containerEl.querySelector('#pp3dImportSprite');
        var fileSpriteInput = _containerEl.querySelector('#pp3dFileSprite');
        if (importSpriteBtn && fileSpriteInput) {
            importSpriteBtn.addEventListener('click', function() {
                fileSpriteInput.click();
            });
            fileSpriteInput.addEventListener('change', function(e) {
                var files = e.target.files;
                if (!files || files.length === 0) return;
                var file = files[0];
                var reader = new FileReader();
                reader.onload = function(ev) {
                    var img = new Image();
                    img.onload = function() {
                        _importSpriteSheetInternal(img);
                        // 自动切换到3D模式
                        if (_mode !== '3d') {
                            API.setMode('3d');
                        }
                    };
                    img.src = ev.target.result;
                };
                reader.readAsDataURL(file);
                // 重置input，允许重复选择同一文件
                fileSpriteInput.value = '';
            });
        }

        // 导入六面图
        var importFacesBtn = _containerEl.querySelector('#pp3dImportFaces');
        var fileFacesInput = _containerEl.querySelector('#pp3dFileFaces');
        if (importFacesBtn && fileFacesInput) {
            importFacesBtn.addEventListener('click', function() {
                fileFacesInput.click();
            });
            fileFacesInput.addEventListener('change', function(e) {
                var files = e.target.files;
                if (!files || files.length === 0) return;
                var loaded = 0;
                var images = [];
                var count = files.length;
                for (var i = 0; i < count; i++) {
                    (function(idx) {
                        var reader = new FileReader();
                        reader.onload = function(ev) {
                            var img = new Image();
                            img.onload = function() {
                                images[idx] = img;
                                loaded++;
                                if (loaded >= count) {
                                    // 过滤掉undefined
                                    var validImages = images.filter(function(im) { return !!im; });
                                    API.importFaceImages(validImages);
                                    // 自动切换到3D模式
                                    if (_mode !== '3d') {
                                        API.setMode('3d');
                                    }
                                }
                            };
                            img.src = ev.target.result;
                        };
                        reader.readAsDataURL(files[idx]);
                    })(i);
                }
                // 重置input
                fileFacesInput.value = '';
            });
        }

        // 导出OBJ
        var exportSpriteBtn = _containerEl.querySelector('#pp3dExportSprite');
        if (exportSpriteBtn) {
            exportSpriteBtn.addEventListener('click', function() {
                API.exportSpriteSheet();
            });
        }
        var exportObjBtn = _containerEl.querySelector('#pp3dExportOBJ');
        if (exportObjBtn) {
            exportObjBtn.addEventListener('click', function() {
                _exportOBJInternal();
            });
        }

        // 清除
        var clearBtn = _containerEl.querySelector('#pp3dClearAll');
        if (clearBtn) {
            clearBtn.addEventListener('click', function() {
                _clearAllData();
            });
        }

        // 面切换按钮
        var faceBtns = _containerEl.querySelectorAll('.pp3d-face-btn');
        faceBtns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                var face = btn.getAttribute('data-face');
                if (face && _faceCanvases[face]) {
                    // 高亮当前按钮
                    faceBtns.forEach(function(b) { b.classList.remove('active'); });
                    btn.classList.add('active');
                    // 加载面到像素编辑区
                    API.editFace(face);
                    // 显示面属性面板
                    _showFaceProps(face);
                }
            });
        });

        // 面属性滑块事件
        ['X','Y','Z','Width','Height'].forEach(function(prop) {
            var slider = _containerEl.querySelector('#pp3dProp' + prop);
            if (!slider) return;
            slider.addEventListener('input', function() {
                var face = _activeFace;
                if (!_faceOffsets[face]) return;
                var key = prop[0].toLowerCase() + prop.slice(1);
                _faceOffsets[face][key] = parseFloat(slider.value);
                var valEl = _containerEl.querySelector('#pp3dProp' + prop + 'Val');
                if (valEl) valEl.textContent = slider.value;
                _rebuildCubeInternal();
            });
        });

        // 重置位置按钮
        var resetBtn = _containerEl.querySelector('#pp3dResetFacePos');
        if (resetBtn) {
            resetBtn.addEventListener('click', function() {
                var face = _activeFace;
                if (!face || !_defaultPos[face]) return;
                var p = _defaultPos[face];
                var off = _faceOffsets[face];
                off.x = p.x; off.y = p.y; off.z = p.z;
                _showFaceProps(face);
                _rebuildCubeInternal();
            });
        }

        // 关闭属性面板
        var closeBtn = _containerEl.querySelector('#pp3dPropsClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', function() {
                var panel = _containerEl.querySelector('#pp3dFaceProps');
                if (panel) panel.style.display = 'none';
            });
        }

        // 保存回3D按钮
        var saveFaceBtn = _containerEl.querySelector('#pp3dSaveFace');
        if (saveFaceBtn) {
            saveFaceBtn.addEventListener('click', function() {
                if (typeof PixelPaintSkill !== 'undefined' && PixelPaintSkill.getEditedFaceCanvas) {
                    var canvas = PixelPaintSkill.getEditedFaceCanvas();
                    var face = PixelPaintSkill._editingFace;
                    if (canvas && face) {
                        API.updateFaceCanvas(face, canvas);
                    }
                }
            });
        }

        // 全局缩放按钮（整数倍：÷2 和 ×2）
        var scaleVal = _containerEl.querySelector('#pp3dScaleVal');
        var scaleDownBtn = _containerEl.querySelector('#pp3dScaleDown');
        var scaleUpBtn = _containerEl.querySelector('#pp3dScaleUp');
        if (scaleDownBtn) {
            scaleDownBtn.addEventListener('click', function() {
                API.scaleAllFaces(0.5);
                if (scaleVal) scaleVal.textContent = '50%';
            });
        }
        if (scaleUpBtn) {
            scaleUpBtn.addEventListener('click', function() {
                API.scaleAllFaces(2);
                if (scaleVal) scaleVal.textContent = '200%';
            });
        }

        // 预设视角
        var viewBtns = _containerEl.querySelectorAll('.pp3d-view-btn');
        viewBtns.forEach(function(btn) {
            btn.addEventListener('click', function() {
                var idx = parseInt(btn.dataset.view);
                _animateToView(idx);
            });
        });

        // 监听预览面板尺寸变化
        var wrap = _containerEl.querySelector('#pp3dPreviewWrap');
        if (wrap && typeof ResizeObserver !== 'undefined') {
            _resizeObserver = new ResizeObserver(function() {
                _onPreviewResize();
            });
            _resizeObserver.observe(wrap);
        }
    }

    function _onPreviewResize() {
        if (!_renderer || !_previewCanvas) return;
        var wrap = _containerEl.querySelector('#pp3dPreviewWrap');
        if (!wrap) return;
        if (_resizeObserver) _resizeObserver.disconnect();
        _resizeObserver = new ResizeObserver(function() {
            var w = wrap.clientWidth;
            var h = wrap.clientHeight;
            if (w <= 0 || h <= 0) return;
            _renderer.setSize(w, h);
            if (_camera) {
                _camera.aspect = w / h;
                _camera.updateProjectionMatrix();
            }
        });
        _resizeObserver.observe(wrap);
        // 立即执行一次
        var w = wrap.clientWidth;
        var h = wrap.clientHeight;
        if (w > 0 && h > 0) {
            _renderer.setSize(w, h);
            if (_camera) { _camera.aspect = w / h; _camera.updateProjectionMatrix(); }
        }
    }

    // ---- 清除所有3D数据 ----
    function _clearAllData() {
        FACE_ORDER.forEach(function(face) {
            _faceCanvases[face] = null;
            _faceOriginals[face] = null;
            _faceOffsets[face] = { x: _defaultPos[face].x, y: _defaultPos[face].y, z: _defaultPos[face].z, width: 1, height: 1 };
            _faceData[face] = null;
        });
        if (_faceMeshes) {
            _faceMeshes.forEach(function(m) { if (m) _scene.remove(m); });
        }
        _faceMeshes = [];
        _pendingImages = [];
        _currentScale = 1;
        // 移除分配UI
        if (_containerEl) {
            var assignUI = _containerEl.querySelector('.pp3d-assign-ui');
            if (assignUI) assignUI.remove();
        }
        _rebuildCubeInternal();
        _updatePreviewInfo();
    }

    // ---- 更新预览信息 ----
    function _updatePreviewInfo() {
        var infoEl = _containerEl ? _containerEl.querySelector('#pp3dPreviewInfo') : null;
        var faceSection = _containerEl ? _containerEl.querySelector('#pp3dFaceSection') : null;

        var hasAny = FACE_ORDER.some(function(f) { return _faceCanvases[f] !== null; });
        if (!hasAny) {
            infoEl.textContent = '暂无3D数据';
            if (faceSection) faceSection.style.display = 'none';
            return;
        }

        // 有数据时显示面切换区域和缩放区域
        if (faceSection) faceSection.style.display = 'flex';
        var scaleSection = _containerEl ? _containerEl.querySelector('#pp3dScaleSection') : null;
        if (scaleSection) scaleSection.style.display = 'flex';

        var parts = [];
        FACE_ORDER.forEach(function(face) {
            if (_faceCanvases[face]) {
                parts.push(FACE_LABELS[face] + ':' + _faceCanvases[face].width + 'x' + _faceCanvases[face].height);
            }
        });
        infoEl.textContent = parts.join(' | ');
    }

    function _showMsg(msg) {
        if (typeof showToast === 'function') showToast(msg);
    }

    // ---- 公开 API ----
    var API = {};

    // 暴露resize方法供像素画调用
    API.onPreviewResize = function() { _onPreviewResize(); };

    /**
     * 初始化3D模块
     * @param {HTMLElement} containerEl - 像素画窗口的DOM元素
     */
    API.init = function(containerEl) {
        _containerEl = containerEl;
        _mode = '2d';
        _activeFace = 'front';

        // 重置面数据
        FACE_ORDER.forEach(function(face) {
            _faceData[face] = null;
            _faceCanvases[face] = null;
            _faceOffsets[face] = { x: _defaultPos[face].x, y: _defaultPos[face].y, z: _defaultPos[face].z, width: 1, height: 1 };
        });

        // 注入CSS
        var styleEl = document.createElement('style');
        styleEl.textContent = _getCSS();
        containerEl.appendChild(styleEl);

        // 1. 模式切换插入到左侧面板顶部
        var panelLeftContent = containerEl.querySelector('#ppPanelLeftContent');
        if (panelLeftContent) {
            var modeWrap = document.createElement('div');
            modeWrap.innerHTML = _buildModeToggleHTML();
            var secSize = containerEl.querySelector('#ppSecSize');
            if (secSize) {
                var hBar = document.createElement('div');
                hBar.className = 'pp-resize-bar-h';
                hBar.dataset.resize = 'ppSec3DMode,ppSecSize';
                panelLeftContent.insertBefore(hBar, secSize);
                while (modeWrap.firstChild) {
                    panelLeftContent.insertBefore(modeWrap.firstChild, hBar);
                }
            } else {
                while (modeWrap.firstChild) {
                    panelLeftContent.appendChild(modeWrap.firstChild);
                }
            }
        }

        // 2. 3D工具栏插入到标签页下方
        var tabBar = containerEl.querySelector('#ppTabBar');
        if (tabBar) {
            var tbWrap = document.createElement('div');
            tbWrap.innerHTML = _buildToolbarHTML();
            while (tbWrap.firstChild) {
                tabBar.parentNode.insertBefore(tbWrap.firstChild, tabBar.nextSibling);
            }
        }

        // 3. 3D预览面板：填充到右侧面板容器中
        var panelRight = containerEl.querySelector('#ppPanelRight');
        if (panelRight) {
            var pvWrap = document.createElement('div');
            pvWrap.innerHTML = _buildPreviewHTML();
            panelRight.appendChild(pvWrap.firstElementChild);
        }

        // 获取预览canvas引用
        _previewCanvas = containerEl.querySelector('#pp3dPreviewCanvas');

        // 绑定事件
        _bindEvents();

        // Three.js 延迟到切换3D模式时初始化
    };

    /**
     * 销毁3D模块
     */
    API.destroy = function() {
        if (_resizeObserver) { _resizeObserver.disconnect(); _resizeObserver = null; }
        _disposeThreeJS();

        if (_containerEl) {
            // 移除模式切换区
            var sec3dMode = _containerEl.querySelector('#ppSec3DMode');
            if (sec3dMode && sec3dMode.parentNode) sec3dMode.parentNode.removeChild(sec3dMode);
            var secSize = _containerEl.querySelector('#ppSecSize');
            if (secSize && secSize.previousSibling) {
                var prev = secSize.previousSibling;
                if (prev.classList && prev.classList.contains('pp-resize-bar-h') && prev.dataset.resize === 'ppSec3DMode,ppSecSize') {
                    prev.parentNode.removeChild(prev);
                }
            }

            // 移除3D工具栏
            var toolbar = _containerEl.querySelector('#pp3dToolbar');
            if (toolbar && toolbar.parentNode) toolbar.parentNode.removeChild(toolbar);

            // 清空右侧面板容器
            var panelRight = _containerEl.querySelector('#ppPanelRight');
            if (panelRight) panelRight.innerHTML = '';
        }

        _containerEl = null;
        _previewCanvas = null;

        FACE_ORDER.forEach(function(face) {
            _faceData[face] = null;
            _faceCanvases[face] = null;
            _faceOffsets[face] = { x: _defaultPos[face].x, y: _defaultPos[face].y, z: _defaultPos[face].z, width: 1, height: 1 };
        });

        _mode = '2d';
    };

    /**
     * 切换2D/3D模式
     * @param {string} mode - '2d' 或 '3d'
     */
    API.setMode = function(mode) {
        if (mode !== '2d' && mode !== '3d') return;
        _mode = mode;

        if (_containerEl) {
            // 更新按钮状态
            var btns = _containerEl.querySelectorAll('.pp3d-mode-btn');
            btns.forEach(function(btn) {
                btn.classList.toggle('active', btn.dataset.mode === mode);
            });

            // 显示/隐藏3D工具栏
            var toolbar = _containerEl.querySelector('#pp3dToolbar');
            if (toolbar) {
                toolbar.style.display = mode === '3d' ? 'flex' : 'none';
            }

            // 显示/隐藏右侧面板
            var panelRight = _containerEl.querySelector('#ppPanelRight');
            if (panelRight) {
                panelRight.style.display = mode === '3d' ? 'flex' : 'none';
            }

            // 切换到3D时初始化Three.js并触发resize
            if (mode === '3d') {
                if (!_threeInitialized) {
                    setTimeout(function() {
                        _initThreeJS();
                    }, 100);
                }
                setTimeout(function() {
                    _onPreviewResize();
                }, 150);
            }
        }
    };

    /**
     * 获取当前模式
     * @returns {string} '2d' 或 '3d'
     */
    API.getMode = function() {
        return _mode;
    };

    /**
     * 获取3D工具HTML（插入到左侧工具区）
     * @returns {string} HTML字符串
     */
    API.getToolHTML = function() {
        return _buildToolHTML();
    };

    /**
     * 获取3D预览面板HTML（插入到右侧）
     * @returns {string} HTML字符串
     */
    API.getPreviewHTML = function() {
        return _buildPreviewHTML();
    };

    /**
     * 更新某个面的纹理（轻量级，不重建立方体）
     * @param {string} face - 面名称
     */
    API.updateFaceTexture = function(face) {
        if (!FACE_ORDER.includes(face)) return;
        if (!_faceData[face] && !_faceCanvases[face]) return;
        _updateFaceTextureInternal(face);
    };

    /**
     * 框选标记：将选区像素数据标记为某个面
     * @param {string} face - 面名称
     * @param {number} x - 选区左上角X
     * @param {number} y - 选区左上角Y
     * @param {number} w - 选区宽度
     * @param {number} h - 选区高度
     * @param {Array} imageData - 二维数组 [[color|null,...],...]
     */
    API.markSelectionAsFace = function(face, x, y, w, h, imageData) {
        if (!FACE_ORDER.includes(face)) return;
        if (!imageData || !imageData.length) return;

        // 深拷贝数据
        var data = [];
        for (var r = 0; r < imageData.length; r++) {
            var row = [];
            for (var c = 0; c < imageData[r].length; c++) {
                row.push(imageData[r][c]);
            }
            data.push(row);
        }

        _faceData[face] = data;

        // 同步生成 _faceCanvases
        var canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        var ctx = canvas.getContext('2d');
        for (var r2 = 0; r2 < h; r2++) {
            for (var c2 = 0; c2 < w; c2++) {
                var color = data[r2] && data[r2][c2];
                if (color) {
                    ctx.fillStyle = color;
                    ctx.fillRect(c2, r2, 1, 1);
                }
            }
        }
        _faceCanvases[face] = canvas;

        // 更新纹理
        _updateFaceTextureInternal(face);

        // 重建立方体（尺寸可能变化）
        _rebuildCubeInternal();

        // 更新信息
        _updatePreviewInfo();

        // 自动切换到3D模式
        if (_mode !== '3d') {
            API.setMode('3d');
        }
    };

    /**
     * 导入展开图（十字形/条形自动裁剪）
     * @param {HTMLImageElement} img - 图片元素
     */
    API.importSpriteSheet = function(img) {
        if (!img) return;
        _importSpriteSheetInternal(img);
        // 自动切换到3D模式
        if (_mode !== '3d') {
            API.setMode('3d');
        }
    };

    /**
     * 导入图片并弹出分配界面，让用户手动选择每张图对应哪个面
     * @param {Array<HTMLImageElement>} images - 图片数组（任意数量）
     */
    API.importFaceImages = function(images) {
        if (!images || !images.length) return;
        _pendingImages = images;
        _showFaceAssignUI(images);
    };

    /**
     * 打开指定面的2D像素编辑器
     * @param {string} face - 面名称
     */
    API.editFace = function(face) {
        if (!FACE_ORDER.includes(face)) return;
        if (!_faceCanvases[face] && !_faceData[face]) return;
        // 通知像素画模块打开2D编辑器
        if (typeof PixelPaintSkill !== 'undefined' && PixelPaintSkill.editFace2D) {
            PixelPaintSkill.editFace2D(face, _faceCanvases[face]);
        }
    };

    /**
     * 像素画编辑完成后更新面数据
     * @param {string} face - 面名称
     * @param {HTMLCanvasElement} canvas - 编辑后的canvas
     */
    API.updateFaceCanvas = function(face, canvas) {
        if (!FACE_ORDER.includes(face)) return;
        if (!canvas) return;

        _faceCanvases[face] = canvas;
        _faceOriginals[face] = canvas; // 编辑后更新原始图
        _faceData[face] = _extractFaceDataFromCanvas(canvas);
        _updateFaceTextureInternal(face);

        _updatePreviewInfo();
    };

    // 全局缩放所有面（累加缩放比例，从原始图计算）
    API.scaleAllFaces = function(factor) {
        _currentScale = Math.max(0.0625, Math.min(1, _currentScale * factor)); // 最小1/16，最大1
        var scale = _currentScale;

        var editingFace = null;
        if (typeof PixelPaintSkill !== 'undefined') editingFace = PixelPaintSkill._editingFace;

        FACE_ORDER.forEach(function(face) {
            var src = _faceOriginals[face] || _faceCanvases[face];
            if (!src) return;
            var nw = Math.max(1, Math.round(src.width * scale));
            var nh = Math.max(1, Math.round(src.height * scale));
            var c = document.createElement('canvas');
            c.width = nw; c.height = nh;
            var ctx = c.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(src, 0, 0, nw, nh);
            _faceCanvases[face] = c;
            _faceData[face] = _extractFaceDataFromCanvas(c);
        });
        _rebuildCubeInternal();
        _updatePreviewInfo();

        // 更新缩放显示
        var scaleVal = _containerEl ? _containerEl.querySelector('#pp3dScaleVal') : null;
        if (scaleVal) scaleVal.textContent = Math.round(scale * 100) + '%';

        // 如果正在编辑某个面，自动刷新像素区
        if (editingFace && _faceCanvases[editingFace]) {
            API.editFace(editingFace);
        }
    };

    // 导出展开图（十字形拼合6面）
    API.exportSpriteSheet = function() {
        var hasAny = FACE_ORDER.some(function(f) { return _faceCanvases[f] !== null; });
        if (!hasAny) return;

        // 用最大面的尺寸作为格子大小
        var cellW = 0, cellH = 0;
        FACE_ORDER.forEach(function(f) {
            var c = _faceCanvases[f];
            if (c) { cellW = Math.max(cellW, c.width); cellH = Math.max(cellH, c.height); }
        });
        if (cellW === 0 || cellH === 0) return;

        // 十字形布局 4列×3行
        var totalW = cellW * 4, totalH = cellH * 3;
        var canvas = document.createElement('canvas');
        canvas.width = totalW; canvas.height = totalH;
        var ctx = canvas.getContext('2d');

        // 各面位置（十字形）
        var positions = {
            top:    { x: cellW,     y: 0 },
            left:   { x: 0,         y: cellH },
            front:  { x: cellW,     y: cellH },
            right:  { x: cellW * 2, y: cellH },
            back:   { x: cellW * 3, y: cellH },
            bottom: { x: cellW,     y: cellH * 2 }
        };

        FACE_ORDER.forEach(function(face) {
            var src = _faceCanvases[face];
            if (!src) return;
            var pos = positions[face];
            ctx.drawImage(src, pos.x, pos.y, cellW, cellH);
        });

        var link = document.createElement('a');
        link.download = 'sprite_sheet.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    };

    /**
     * 导出OBJ文件
     */
    API.exportOBJ = function() {
        _exportOBJInternal();
    };

    /**
     * 镂空补充：检测每个面的空白区域，用相邻边缘颜色填充
     */
    API.fillHollowFaces = function() {
        _fillHollowFacesInternal();
    };

    /**
     * 重建3D模型（所有面）
     */
    API.rebuildCube = function() {
        _rebuildCubeInternal();
        _updatePreviewInfo();
    };

    /**
     * 获取CSS样式
     * @returns {string} CSS字符串
     */
    API.getCSS = function() {
        return _getCSS();
    };

    /**
     * 获取面数据（供外部访问）
     * @param {string} face - 面名称
     * @returns {Array|null} 二维数组或null
     */
    API.getFaceData = function(face) {
        if (!FACE_ORDER.includes(face)) return null;
        return _faceData[face];
    };

    /**
     * 获取所有面数据
     * @returns {Object} 面数据对象
     */
    API.getAllFaceData = function() {
        return JSON.parse(JSON.stringify(_faceData));
    };

    /**
     * 设置面数据（用于恢复/导入）
     * @param {Object} data - 面数据对象
     */
    API.setAllFaceData = function(data) {
        if (!data) return;
        FACE_ORDER.forEach(function(face) {
            if (data[face]) {
                _faceData[face] = data[face];
            }
        });
        _rebuildCubeInternal();
        _updatePreviewInfo();
    };

    /**
     * 获取当前选中的面
     * @returns {string} 面名称
     */
    API.getActiveFace = function() {
        return _activeFace;
    };

    // 暴露内部数据供 pixel-paint.js 访问
    API._faceData = _faceData;
    API._faceCanvases = _faceCanvases;
    API._faceOffsets = _faceOffsets;

    return API;
})();
