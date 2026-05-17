/**
 * ============================================
 *   🦴 骨骼动画 v11 (WebGL2版)
 *  FK · 时间轴 · 洋葱皮 · 附件 · IK · 约束
 *  缓动 · 弹性 · 路径约束 · FFD · 裁剪 · Godot导出
 *  乔布斯视觉 + 马斯克第一性原理
 * ============================================
 */

var SpineAnimate = (function() {

    var PI = Math.PI, DEG = PI / 180;

    // ===== 状态 =====
    var _overlay, _canvas, _ctx, _events = [], _isOpen = false;
    var _bones = [], _rootBone = null, _selectedBone = null, _hoverBone = null;
    var _nextId = 1, _drag = null;
    var _vx = 0, _vy = 0, _vs = 1;
    var _anims = [], _curAnim = null, _animTime = 0, _playing = false;
    var _autoRecord = true, _lastFrameTime = 0, _raf = null;
    var _hideTimer = null;

    // 新增：洋葱皮
    var _onionSkin = true;
    var _onionBefore = 3; // 前N帧
    var _onionAfter = 3;  // 后N帧

    // 新增：附件
    var _attachments = []; // { bone, image, imageName, offsetX, offsetY, scaleX, scaleY, width, height }
    var _nextAttId = 1;

    // 新增：时间轴展开状态
    var _timelineOpen = false;

    // 新增：IK反向动力学
    var _ikEnabled = true;       // IK总开关
    var _ikIterations = 10;      // CCD迭代次数
    var _ikChain = [];           // 当前IK链（拖拽时动态计算）
    var _ikTarget = null;        // IK目标世界坐标 {x, y}
    var _ikActive = false;       // 当前是否在IK拖拽中

    // 新增：变换约束
    // 第一性原理：约束 = {bone, target, type, mix, offset}
    // 解算公式：output = target * mix + local * (1 - mix)
    var _constraints = [];       // 约杽数组
    var _nextConId = 1;
    var _shiftHeld = false;      // Shift键状态（用于创建约束）
    var _constraintSource = null; // Shift+点击第一个骨骼（约束源）

    // 新增：曲线编辑器状态
    var _curveEditBone = null;    // 正在编辑缓动的骨骼
    var _curveEditTime = 0;       // 正在编辑的关键帧时间
    var _curveEditTrack = null;   // 正在编辑的轨道引用
    var _curveEditIdx = -1;       // 关键帧在轨道中的索引
    var _curveDrag = null;        // {cp: 'in'|'out'} 正在拖拽的控制点

    // v7: 路径约束
    // 第一性原理：路径 = 点数组，骨骼沿路径移动 = 按进度取点
    var _paths = [];              // {id, name, points:[{x,y}], closed:bool}
    var _nextPathId = 1;
    var _pathConstraints = [];    // {id, bone, path, progress, rotateFollow, offset}
    var _nextPCId = 1;
    var _pathEditMode = false;    // 是否在编辑路径
    var _editPathId = null;       // 正在编辑的路径ID
    var _pathDrawMode = false;    // 正在绘制新路径

    // v8: FFD 网格变形
    // 第一性原理：网格 = N×M 控制点，每个点有权重，骨骼移动时按权重变形
    var _ffdMeshes = [];          // {id, bone, cols, rows, width, height, offsets:[{dx,dy}]}
    var _nextFFDId = 1;

    // v9: 裁剪遮罩
    // 第一性原理：遮罩 = 一个骨骼的区域，渲染时 clip 到该区域
    var _clips = [];              // {id, bone, shape:'rect'|'ellipse', params:{}}
    var _nextClipId = 1;

    // ===== 新人模式工作流 =====
    var _userMode = 'novice';     // 'novice' | 'expert'
    var _workflowStep = 0;        // 新人模式当前步骤 0-4
    // 步骤0: 创建骨骼, 1: 添加图片, 2: 添加特效, 3: 导出

    // ===== WebGL2 渲染器 =====
    var _gl = null;                    // WebGL2上下文
    var _glExt = null;                 // 扩展
    var _matrixStack = [];             // 矩阵栈（替代ctx.save/restore）
    var _currentMatrix = new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
    var _projectionMatrix = new Float32Array(16);
    var _viewMatrix = new Float32Array(16);
    var _mvpMatrix = new Float32Array(16);
    var _tempMatrix = new Float32Array(16);
    
    // 着色器程序
    var _shaderPrograms = {};
    var _currentProgram = null;
    
    // 缓冲区
    var _buffers = {};
    var _textures = {};
    var _textureCount = 0;
    
    // 批处理状态
    var _batchVertices = [];
    var _batchColors = [];
    var _batchUVs = [];
    var _batchIndices = [];
    var _batchTexture = null;
    var _batchMode = 'triangles'; // 'triangles' | 'lines'
    var _batchLineWidth = 1;
    var _maxBatchSize = 10000;
    
    // 渲染状态
    var _currentColor = [1,1,1,1];
    var _currentAlpha = 1;
    var _currentLineDash = [];
    var _clipStack = [];  // 裁剪栈
    var _canvasWidth = 0;
    var _canvasHeight = 0;
    var _dpr = 1;

    // ===== 骨骼 =====
    function Bone(name, parent) {
        this.id = _nextId++;
        this.name = name;
        this.parent = parent || null;
        this.children = [];
        this.length = 60;
        this.x = 0; this.y = 0; this.rotation = 0;
        this.scaleX = 1; this.scaleY = 1;
        this.wx = 0; this.wy = 0; this.wr = 0; this.wsx = 1; this.wsy = 1;
        this.sx = 0; this.sy = 0; this.sr = 0; this.ssx = 1; this.ssy = 1; this.sl = 60;
        this.color = '#38bdf8';
        this.ikMin = -180;  // 角度约束下限（度）
        this.ikMax = 180;   // 角度约束上限（度）
        // 弹性物理
        this.jiggle = false;      // 是否启用弹性
        this.jiggleK = 180;       // 弹簧刚度
        this.jiggleD = 12;        // 阻尼系数
        this.jiggleOffset = 0;    // 当前偏移量（度）
        this.jiggleVel = 0;       // 当前速度
        if (parent) parent.children.push(this);
    }

    function addBone(name, parent) {
        var b = new Bone(name || 'bone_' + _nextId, parent);
        if (!_rootBone && !parent) _rootBone = b;
        if (parent) { b.x = parent.length; b.y = 0; }
        b.sx = b.x; b.sy = b.y; b.sr = b.rotation; b.ssx = b.scaleX; b.ssy = b.scaleY; b.sl = b.length;
        _bones.push(b);
        updateFK();
        _checkGuideComplete();
        return b;
    }

    function removeBone(b) {
        if (!b) return;
        b.children.slice().forEach(removeBone);
        if (b.parent) { var i = b.parent.children.indexOf(b); if (i >= 0) b.parent.children.splice(i, 1); }
        var i = _bones.indexOf(b); if (i >= 0) _bones.splice(i, 1);
        _anims.forEach(function(a) { delete a.tracks[b.id]; });
        _attachments = _attachments.filter(function(a) { return a.bone !== b; });
        _constraints = _constraints.filter(function(c) { return c.bone !== b && c.target !== b; });
        _pathConstraints = _pathConstraints.filter(function(pc) { return pc.bone !== b; });
        _ffdMeshes = _ffdMeshes.filter(function(m) { return m.bone !== b; });
        _clips = _clips.filter(function(cl) { return cl.bone !== b; });
        if (_selectedBone === b) _selectedBone = null;
        if (_rootBone === b) _rootBone = null;
    }

    function boneById(id) { for (var i = 0; i < _bones.length; i++) if (_bones[i].id === id) return _bones[i]; return null; }
    function boneEnd(b) { var r = b.wr * DEG; return { x: b.wx + Math.cos(r) * b.length * b.wsx, y: b.wy + Math.sin(r) * b.length * b.wsy }; }

    // ===== FK =====
    function updateFK() { if (_rootBone) _fk(_rootBone); }
    function _fk(b) {
        if (b.parent) {
            var a = b.parent.wr * DEG, c = Math.cos(a), s = Math.sin(a);
            b.wx = b.parent.wx + (c * b.x - s * b.y) * b.parent.wsx;
            b.wy = b.parent.wy + (s * b.x + c * b.y) * b.parent.wsy;
            b.wr = b.parent.wr + b.rotation;
            b.wsx = b.parent.wsx * b.scaleX;
            b.wsy = b.parent.wsy * b.scaleY;
        } else { b.wx = b.x; b.wy = b.y; b.wr = b.rotation; b.wsx = b.scaleX; b.wsy = b.scaleY; }
        b.children.forEach(_fk);
    }

    // ===== IK 反向动力学（第一性原理：CCD算法） =====
    function _getChain(bone) {
        var chain = [];
        var b = bone;
        while (b) { chain.push(b); b = b.parent; }
        return chain;
    }
    function _isEndOfChain(bone) { return bone.children.length === 0; }

    function _solveCCD(target, chain, iterations) {
        if (chain.length < 2) return false;
        var endBone = chain[0];
        for (var iter = 0; iter < iterations; iter++) {
            for (var i = 1; i < chain.length; i++) {
                var joint = chain[i];
                var jx = joint.wx, jy = joint.wy;
                var endPos = boneEnd(endBone);
                var ex = endPos.x, ey = endPos.y;
                var toEnd = Math.atan2(ey - jy, ex - jx);
                var toTarget = Math.atan2(target.y - jy, target.x - jx);
                var delta = (toTarget - toEnd) / DEG;
                while (delta > 180) delta -= 360;
                while (delta < -180) delta += 360;
                joint.rotation += delta;
                joint.rotation = _clampAngle(joint.rotation, joint.ikMin, joint.ikMax);
                updateFK();
                endPos = boneEnd(endBone);
                var dist = Math.hypot(endPos.x - target.x, endPos.y - target.y);
                if (dist < 0.5) return true;
            }
        }
        return false;
    }

    function _clampAngle(angle, min, max) {
        while (angle > 180) angle -= 360;
        while (angle < -180) angle += 360;
        if (angle < min) angle = min;
        if (angle > max) angle = max;
        return angle;
    }

    function _getChainIndex(bone) {
        for (var i = 0; i < _ikChain.length; i++) if (_ikChain[i] === bone) return i;
        return -1;
    }

    // ===== 变换约束 =====
    function addConstraint(bone, target, type) {
        var con = { id: _nextConId++, bone: bone, target: target, type: type || 'rotation', mix: 1.0, offset: 0 };
        _constraints.push(con);
        return con;
    }
    function removeConstraint(con) { var i = _constraints.indexOf(con); if (i >= 0) _constraints.splice(i, 1); }
    function getConstraintsFor(bone) { return _constraints.filter(function(c) { return c.bone === bone || c.target === bone; }); }

    function solveConstraints() {
        for (var i = 0; i < _constraints.length; i++) {
            var c = _constraints[i];
            if (c.mix <= 0) continue;
            var b = c.bone, t = c.target;
            if (c.type === 'rotation') {
                var targetRot = t.wr;
                var localRot = b.rotation;
                b.rotation = targetRot * c.mix + localRot * (1 - c.mix) + c.offset;
            } else if (c.type === 'position') {
                if (!b.parent) {
                    b.x = t.wx * c.mix + b.x * (1 - c.mix) + c.offset;
                    b.y = t.wy * c.mix + b.y * (1 - c.mix);
                } else {
                    var a = -b.parent.wr * DEG, cs = Math.cos(a), sn = Math.sin(a);
                    var ltx = (t.wx - b.parent.wx) / b.parent.wsx;
                    var lty = (t.wy - b.parent.wy) / b.parent.wsy;
                    var plx = cs * ltx - sn * lty;
                    var ply = sn * ltx + cs * lty;
                    b.x = plx * c.mix + b.x * (1 - c.mix) + c.offset;
                    b.y = ply * c.mix + b.y * (1 - c.mix);
                }
            } else if (c.type === 'scale') {
                b.scaleX = t.wsx * c.mix + b.scaleX * (1 - c.mix);
                b.scaleY = t.wsy * c.mix + b.scaleY * (1 - c.mix);
            }
        }
        updateFK();
    }

    // ===== 弹性物理 =====
    function updateJiggle(dt) {
        for (var i = 0; i < _bones.length; i++) {
            var b = _bones[i];
            if (!b.jiggle) continue;
            var springForce = -b.jiggleOffset * b.jiggleK;
            var dampForce = -b.jiggleVel * b.jiggleD;
            var accel = springForce + dampForce;
            b.jiggleVel += accel * dt;
            b.jiggleOffset += b.jiggleVel * dt;
            if (Math.abs(b.jiggleOffset) < 0.001 && Math.abs(b.jiggleVel) < 0.001) {
                b.jiggleOffset = 0; b.jiggleVel = 0;
            }
            b.rotation += b.jiggleOffset;
        }
        updateFK();
    }
    function jiggleImpulse(bone, deltaRotation) { if (!bone.jiggle) return; bone.jiggleVel -= deltaRotation * 0.5; }

    // ===== v7: 路径约束 =====
    function addPath(name, points, closed) {
        var p = { id: _nextPathId++, name: name || 'path_' + _nextPathId, points: points || [], closed: !!closed };
        _paths.push(p);
        return p;
    }
    function removePath(path) {
        _pathConstraints = _pathConstraints.filter(function(pc) { return pc.path !== path; });
        var i = _paths.indexOf(path); if (i >= 0) _paths.splice(i, 1);
    }
    function addPathConstraint(bone, path) {
        var pc = { id: _nextPCId++, bone: bone, path: path, progress: 0, rotateFollow: true, offset: 0 };
        _pathConstraints.push(pc);
        return pc;
    }
    function removePathConstraint(pc) { var i = _pathConstraints.indexOf(pc); if (i >= 0) _pathConstraints.splice(i, 1); }

    function _catmullRom(p0, p1, p2, p3, t) {
        var t2 = t * t, t3 = t2 * t;
        return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    }
    function getPathPoint(path, progress) {
        var pts = path.points;
        if (pts.length < 2) return pts.length ? { x: pts[0].x, y: pts[0].y } : { x: 0, y: 0 };
        var n = pts.length, totalLen = path.closed ? n : n - 1;
        var p = ((progress % 1) + 1) % 1, seg = p * totalLen, i = Math.floor(seg), t = seg - i;
        if (i >= totalLen) { i = totalLen - 1; t = 1; }
        var i0 = path.closed ? (i - 1 + n) % n : Math.max(0, i - 1);
        var i1 = i % n, i2 = (i + 1) % n, i3 = path.closed ? (i + 2) % n : Math.min(n - 1, i + 2);
        return { x: _catmullRom(pts[i0].x, pts[i1].x, pts[i2].x, pts[i3].x, t), y: _catmullRom(pts[i0].y, pts[i1].y, pts[i2].y, pts[i3].y, t) };
    }
    function getPathAngle(path, progress) {
        var eps = 0.001, p1 = getPathPoint(path, progress - eps), p2 = getPathPoint(path, progress + eps);
        return Math.atan2(p2.y - p1.y, p2.x - p1.x) / DEG;
    }
    function solvePathConstraints() {
        for (var i = 0; i < _pathConstraints.length; i++) {
            var pc = _pathConstraints[i], pt = getPathPoint(pc.path, pc.progress);
            if (!pc.bone.parent) { pc.bone.x = pt.x + pc.offset; pc.bone.y = pt.y; }
            else {
                var a = -pc.bone.parent.wr * DEG, cs = Math.cos(a), sn = Math.sin(a);
                var lx = (pt.x - pc.bone.parent.wx) / pc.bone.parent.wsx;
                var ly = (pt.y - pc.bone.parent.wy) / pc.bone.parent.wsy;
                pc.bone.x = (cs * lx - sn * ly) + pc.offset;
                pc.bone.y = (sn * lx + cs * ly);
            }
            if (pc.rotateFollow) pc.bone.rotation = getPathAngle(pc.path, pc.progress) - (pc.bone.parent ? pc.bone.parent.wr : 0);
        }
        updateFK();
    }

    // ===== v8: FFD 网格变形 =====
    function addFFD(bone, cols, rows, width, height) {
        var offsets = [];
        for (var r = 0; r <= rows; r++) for (var c = 0; c <= cols; c++) offsets.push({ dx: 0, dy: 0 });
        var mesh = { id: _nextFFDId++, bone: bone, cols: cols || 3, rows: rows || 3, width: width || 100, height: height || 100, offsets: offsets };
        _ffdMeshes.push(mesh);
        return mesh;
    }
    function removeFFD(mesh) { var i = _ffdMeshes.indexOf(mesh); if (i >= 0) _ffdMeshes.splice(i, 1); }
    function getFFDOffset(mesh, u, v) {
        var cols = mesh.cols, rows = mesh.rows;
        var fu = u * cols, fv = v * rows;
        var iu = Math.floor(fu), iv = Math.floor(fv);
        var tu = fu - iu, tv = fv - iv;
        iu = Math.min(iu, cols - 1); iv = Math.min(iv, rows - 1);
        var idx = function(c, r) { return r * (cols + 1) + c; };
        var o00 = mesh.offsets[idx(iu, iv)] || { dx: 0, dy: 0 };
        var o10 = mesh.offsets[idx(iu + 1, iv)] || { dx: 0, dy: 0 };
        var o01 = mesh.offsets[idx(iu, iv + 1)] || { dx: 0, dy: 0 };
        var o11 = mesh.offsets[idx(iu + 1, iv + 1)] || { dx: 0, dy: 0 };
        return { dx: o00.dx * (1 - tu) * (1 - tv) + o10.dx * tu * (1 - tv) + o01.dx * (1 - tu) * tv + o11.dx * tu * tv, dy: o00.dy * (1 - tu) * (1 - tv) + o10.dy * tu * (1 - tv) + o01.dy * (1 - tu) * tv + o11.dy * tu * tv };
    }

    // ===== v9: 裁剪遮罩 =====
    function addClip(bone, shape, params) {
        var clip = { id: _nextClipId++, bone: bone, shape: shape || 'ellipse', params: params || {} };
        _clips.push(clip);
        return clip;
    }
    function removeClip(clip) { var i = _clips.indexOf(clip); if (i >= 0) _clips.splice(i, 1); }

    // ===== WebGL2 矩阵工具 =====
    function _mat4Identity(out) {
        out[0] = 1; out[1] = 0; out[2] = 0; out[3] = 0;
        out[4] = 0; out[5] = 1; out[6] = 0; out[7] = 0;
        out[8] = 0; out[9] = 0; out[10] = 1; out[11] = 0;
        out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
        return out;
    }
    function _mat4Multiply(out, a, b) {
        for (var i = 0; i < 4; i++) {
            for (var j = 0; j < 4; j++) {
                out[i * 4 + j] = a[i * 4 + 0] * b[0 * 4 + j] + a[i * 4 + 1] * b[1 * 4 + j] + a[i * 4 + 2] * b[2 * 4 + j] + a[i * 4 + 3] * b[3 * 4 + j];
            }
        }
        return out;
    }
    function _mat4Translate(out, x, y) {
        _mat4Identity(out);
        out[12] = x; out[13] = y;
        return out;
    }
    function _mat4Scale(out, x, y) {
        _mat4Identity(out);
        out[0] = x; out[5] = y;
        return out;
    }
    function _mat4RotateZ(out, rad) {
        _mat4Identity(out);
        var c = Math.cos(rad), s = Math.sin(rad);
        out[0] = c; out[1] = s; out[4] = -s; out[5] = c;
        return out;
    }
    function _mat4Ortho(out, left, right, bottom, top, near, far) {
        var lr = 1 / (left - right), bt = 1 / (bottom - top), nf = 1 / (near - far);
        out[0] = -2 * lr; out[1] = 0; out[2] = 0; out[3] = 0;
        out[4] = 0; out[5] = -2 * bt; out[6] = 0; out[7] = 0;
        out[8] = 0; out[9] = 0; out[10] = 2 * nf; out[11] = 0;
        out[12] = (left + right) * lr; out[13] = (top + bottom) * bt; out[14] = (far + near) * nf; out[15] = 1;
        return out;
    }
    function _mat4Copy(out, a) {
        for (var i = 0; i < 16; i++) out[i] = a[i];
        return out;
    }

    // ===== WebGL2 着色器 =====
    function _createShader(gl, type, source) {
        var shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compile error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    function _createProgram(gl, vsSource, fsSource) {
        var vs = _createShader(gl, gl.VERTEX_SHADER, vsSource);
        var fs = _createShader(gl, gl.FRAGMENT_SHADER, fsSource);
        var program = gl.createProgram();
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program link error:', gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }

    // 基础着色器（颜色）
    var _basicVS = `
        attribute vec2 a_position;
        uniform mat4 u_mvpMatrix;
        void main() {
            gl_Position = u_mvpMatrix * vec4(a_position, 0.0, 1.0);
        }
    `;
    var _basicFS = `
        precision mediump float;
        uniform vec4 u_color;
        void main() {
            gl_FragColor = u_color;
        }
    `;

    // 纹理着色器
    var _textureVS = `
        attribute vec2 a_position;
        attribute vec2 a_texCoord;
        uniform mat4 u_mvpMatrix;
        varying vec2 v_texCoord;
        void main() {
            gl_Position = u_mvpMatrix * vec4(a_position, 0.0, 1.0);
            v_texCoord = a_texCoord;
        }
    `;
    var _textureFS = `
        precision mediump float;
        varying vec2 v_texCoord;
        uniform sampler2D u_texture;
        uniform vec4 u_color;
        void main() {
            gl_FragColor = texture2D(u_texture, v_texCoord) * u_color;
        }
    `;

    // ===== WebGL2 初始化 =====
    // 关键：先用临时canvas测试WebGL2+着色器是否可用，避免污染主canvas
    var _webgl2Tested = false;
    var _webgl2Available = false;
    
    function _testWebGL2() {
        return false; // 强制使用 Canvas 2D
    }
    
    function _initWebGL(canvas) {
        if (!_testWebGL2()) {
            console.log('SpineAnimate: WebGL2 not available, using Canvas 2D');
            return null;
        }
        
        var gl = canvas.getContext('webgl2', { alpha: false, antialias: true, preserveDrawingBuffer: false, stencil: true });
        if (!gl) return null;
        
        // 着色器已通过测试，直接编译
        _shaderPrograms.basic = _createProgram(gl, _basicVS, _basicFS);
        _shaderPrograms.texture = _createProgram(gl, _textureVS, _textureFS);
        
        // 获取uniform和attribute位置
        for (var name in _shaderPrograms) {
            var prog = _shaderPrograms[name];
            prog.u_mvpMatrix = gl.getUniformLocation(prog, 'u_mvpMatrix');
            prog.u_color = gl.getUniformLocation(prog, 'u_color');
            prog.a_position = gl.getAttribLocation(prog, 'a_position');
            if (name === 'texture') {
                prog.a_texCoord = gl.getAttribLocation(prog, 'a_texCoord');
                prog.u_texture = gl.getUniformLocation(prog, 'u_texture');
            }
        }
        
        // 创建缓冲区
        _buffers.position = gl.createBuffer();
        _buffers.texCoord = gl.createBuffer();
        _buffers.index = gl.createBuffer();
        
        // 启用混合
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        
        return gl;
    }

    // ===== 渲染API（WebGL2 + Canvas 2D 双引擎）=====
    // 当 _gl 存在时使用 WebGL2，否则回退到 Canvas 2D (_ctx)
    
    function _glSave() {
        if (_ctx) { _ctx.save(); return; }
        _matrixStack.push(new Float32Array(_currentMatrix));
    }
    function _glRestore() {
        if (_ctx) { _ctx.restore(); return; }
        if (_matrixStack.length > 0) _currentMatrix = _matrixStack.pop();
    }
    function _glTranslate(x, y) {
        if (_ctx) { _ctx.translate(x, y); return; }
        _mat4Multiply(_tempMatrix, _currentMatrix, _mat4Translate(new Float32Array(16), x, y));
        _mat4Copy(_currentMatrix, _tempMatrix);
    }
    function _glRotate(rad) {
        if (_ctx) { _ctx.rotate(rad); return; }
        _mat4Multiply(_tempMatrix, _currentMatrix, _mat4RotateZ(new Float32Array(16), rad));
        _mat4Copy(_currentMatrix, _tempMatrix);
    }
    function _glScale(x, y) {
        if (_ctx) { _ctx.scale(x, y); return; }
        _mat4Multiply(_tempMatrix, _currentMatrix, _mat4Scale(new Float32Array(16), x, y));
        _mat4Copy(_currentMatrix, _tempMatrix);
    }

    // 批处理刷新
    function _flushBatch() {
        if (_ctx) return; // Canvas 2D 不需要批处理
        if (_batchVertices.length === 0 || !_gl) return;
        
        var gl = _gl;
        var program = _batchTexture ? _shaderPrograms.texture : _shaderPrograms.basic;
        if (!program) return;
        
        if (_currentProgram !== program) {
            gl.useProgram(program);
            _currentProgram = program;
        }
        
        // 计算MVP矩阵
        _mat4Multiply(_mvpMatrix, _projectionMatrix, _currentMatrix);
        gl.uniformMatrix4fv(program.u_mvpMatrix, false, _mvpMatrix);
        
        // 设置颜色
        var color = [_currentColor[0], _currentColor[1], _currentColor[2], _currentColor[3] * _currentAlpha];
        gl.uniform4fv(program.u_color, color);
        
        // 绑定纹理
        if (_batchTexture && program.u_texture) {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, _batchTexture);
            gl.uniform1i(program.u_texture, 0);
        }
        
        // 上传顶点数据
        gl.bindBuffer(gl.ARRAY_BUFFER, _buffers.position);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(_batchVertices), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(program.a_position);
        gl.vertexAttribPointer(program.a_position, 2, gl.FLOAT, false, 0, 0);
        
        // 上传UV数据
        if (_batchTexture && program.a_texCoord >= 0) {
            gl.bindBuffer(gl.ARRAY_BUFFER, _buffers.texCoord);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(_batchUVs), gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(program.a_texCoord);
            gl.vertexAttribPointer(program.a_texCoord, 2, gl.FLOAT, false, 0, 0);
        }
        
        // 绘制
        var mode = _batchMode === 'lines' ? gl.LINES : gl.TRIANGLES;
        if (_batchIndices.length > 0) {
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, _buffers.index);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(_batchIndices), gl.DYNAMIC_DRAW);
            gl.drawElements(mode, _batchIndices.length, gl.UNSIGNED_SHORT, 0);
        } else {
            gl.drawArrays(mode, 0, _batchVertices.length / 2);
        }
        
        // 禁用纹理坐标属性（防止影响后续非纹理绘制）
        if (_batchTexture && program.a_texCoord >= 0) {
            gl.disableVertexAttribArray(program.a_texCoord);
        }
        
        // 清空批处理
        _batchVertices = [];
        _batchUVs = [];
        _batchIndices = [];
        _batchTexture = null;
    }

    // 添加顶点到批处理
    function _addVertex(x, y, u, v) {
        _batchVertices.push(x, y);
        if (u !== undefined && v !== undefined) _batchUVs.push(u, v);
    }
    function _addIndex(i) { _batchIndices.push(i); }

    // 绘制API
    function _glClear(r, g, b, a) {
        if (_ctx) { _ctx.clearRect(0, 0, _canvas.width, _canvas.height); _ctx.fillStyle = 'rgb('+Math.round(r*255)+','+Math.round(g*255)+','+Math.round(b*255)+')'; _ctx.fillRect(0, 0, _canvas.width, _canvas.height); return; }
        if (!_gl) return;
        _flushBatch();
        _gl.clearColor(r, g, b, a);
        _gl.clear(_gl.COLOR_BUFFER_BIT | _gl.STENCIL_BUFFER_BIT);
    }

    function _glSetColor(hexOrR, g, b, a) {
        if (typeof hexOrR === 'string') {
            var hex = hexOrR.replace('#', '');
            if (hex.length === 3) hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
            var num = parseInt(hex, 16);
            _currentColor[0] = ((num >> 16) & 255) / 255;
            _currentColor[1] = ((num >> 8) & 255) / 255;
            _currentColor[2] = (num & 255) / 255;
            _currentColor[3] = a !== undefined ? a : 1;
        } else {
            _currentColor[0] = hexOrR; _currentColor[1] = g; _currentColor[2] = b; _currentColor[3] = a !== undefined ? a : 1;
        }
        // 同步到 Canvas 2D
        if (_ctx) {
            var ca = _currentColor[3] * _currentAlpha;
            _ctx.fillStyle = 'rgba('+Math.round(_currentColor[0]*255)+','+Math.round(_currentColor[1]*255)+','+Math.round(_currentColor[2]*255)+','+ca+')';
            _ctx.strokeStyle = _ctx.fillStyle;
        }
    }

    function _glSetAlpha(a) {
        _currentAlpha = a;
        if (_ctx) _ctx.globalAlpha = a;
    }

    function _glFillRect(x, y, w, h) {
        if (_ctx) { _ctx.fillRect(x, y, w, h); return; }
        if (!_gl) return;
        if (_batchTexture) _flushBatch();
        _batchMode = 'triangles';
        var base = _batchVertices.length / 2;
        _addVertex(x, y); _addVertex(x + w, y); _addVertex(x, y + h); _addVertex(x + w, y + h);
        _addIndex(base); _addIndex(base + 1); _addIndex(base + 2);
        _addIndex(base + 1); _addIndex(base + 3); _addIndex(base + 2);
        if (_batchVertices.length >= _maxBatchSize * 2) _flushBatch();
    }

    function _glDrawLine(x1, y1, x2, y2, width) {
        width = width || 1;
        if (_ctx) {
            _ctx.lineWidth = width;
            _ctx.beginPath(); _ctx.moveTo(x1, y1); _ctx.lineTo(x2, y2); _ctx.stroke();
            return;
        }
        if (!_gl) return;
        if (width <= 1) {
            if (_batchTexture) _flushBatch();
            if (_batchMode !== 'lines') { _flushBatch(); _batchMode = 'lines'; }
            _addVertex(x1, y1); _addVertex(x2, y2);
        } else {
            if (_batchTexture) _flushBatch();
            if (_batchMode !== 'triangles') { _flushBatch(); _batchMode = 'triangles'; }
            var dx = x2 - x1, dy = y2 - y1;
            var len = Math.hypot(dx, dy);
            if (len === 0) return;
            var nx = -dy / len * width / 2, ny = dx / len * width / 2;
            var base = _batchVertices.length / 2;
            _addVertex(x1 + nx, y1 + ny); _addVertex(x1 - nx, y1 - ny);
            _addVertex(x2 + nx, y2 + ny); _addVertex(x2 - nx, y2 - ny);
            _addIndex(base); _addIndex(base + 1); _addIndex(base + 2);
            _addIndex(base + 1); _addIndex(base + 3); _addIndex(base + 2);
        }
        if (_batchVertices.length >= _maxBatchSize * 2) _flushBatch();
    }

    function _glDrawLines(points) {
        if (_ctx) {
            if (points.length < 2) return;
            _ctx.beginPath(); _ctx.moveTo(points[0].x, points[0].y);
            for (var i = 1; i < points.length; i++) _ctx.lineTo(points[i].x, points[i].y);
            _ctx.stroke();
            return;
        }
        if (!_gl || points.length < 2) return;
        if (_batchTexture) _flushBatch();
        if (_batchMode !== 'lines') { _flushBatch(); _batchMode = 'lines'; }
        for (var i = 0; i < points.length; i++) _addVertex(points[i].x, points[i].y);
        if (_batchVertices.length >= _maxBatchSize * 2) _flushBatch();
    }

    function _glDrawCircle(x, y, r, segments) {
        if (_ctx) {
            _ctx.beginPath(); _ctx.arc(x, y, r, 0, PI * 2); _ctx.fill(); return;
        }
        if (!_gl) return;
        if (_batchTexture) _flushBatch();
        _batchMode = 'triangles';
        segments = segments || 32;
        var base = _batchVertices.length / 2;
        _addVertex(x, y);
        for (var i = 0; i <= segments; i++) {
            var theta = (i / segments) * PI * 2;
            _addVertex(x + Math.cos(theta) * r, y + Math.sin(theta) * r);
        }
        for (var j = 0; j < segments; j++) {
            _addIndex(base); _addIndex(base + j + 1); _addIndex(base + j + 2);
        }
        if (_batchVertices.length >= _maxBatchSize * 2) _flushBatch();
    }

    function _glDrawRing(x, y, r, width, segments) {
        if (_ctx) {
            _ctx.lineWidth = width;
            _ctx.beginPath(); _ctx.arc(x, y, r, 0, PI * 2); _ctx.stroke(); return;
        }
        if (!_gl) return;
        if (_batchTexture) _flushBatch();
        _batchMode = 'triangles';
        segments = segments || 32;
        var innerR = r - width / 2, outerR = r + width / 2;
        var base = _batchVertices.length / 2;
        for (var i = 0; i <= segments; i++) {
            var theta = (i / segments) * PI * 2;
            var c = Math.cos(theta), s = Math.sin(theta);
            _addVertex(x + c * innerR, y + s * innerR);
            _addVertex(x + c * outerR, y + s * outerR);
        }
        for (var j = 0; j < segments; j++) {
            var idx = base + j * 2;
            _addIndex(idx); _addIndex(idx + 1); _addIndex(idx + 2);
            _addIndex(idx + 1); _addIndex(idx + 3); _addIndex(idx + 2);
        }
        if (_batchVertices.length >= _maxBatchSize * 2) _flushBatch();
    }

    function _glDrawEllipse(x, y, rx, ry, segments) {
        if (_ctx) {
            _ctx.beginPath(); _ctx.ellipse(x, y, rx, ry, 0, 0, PI * 2); _ctx.fill(); return;
        }
        if (!_gl) return;
        if (_batchTexture) _flushBatch();
        _batchMode = 'triangles';
        segments = segments || 32;
        var base = _batchVertices.length / 2;
        _addVertex(x, y);
        for (var i = 0; i <= segments; i++) {
            var theta = (i / segments) * PI * 2;
            _addVertex(x + Math.cos(theta) * rx, y + Math.sin(theta) * ry);
        }
        for (var j = 0; j < segments; j++) {
            _addIndex(base); _addIndex(base + j + 1); _addIndex(base + j + 2);
        }
        if (_batchVertices.length >= _maxBatchSize * 2) _flushBatch();
    }

    function _glDrawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) {
        if (_ctx) { _ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh); return; }
        if (!_gl || !img) return;
        if (_batchMode !== 'triangles' || (_batchTexture && _batchTexture !== img._glTexture)) {
            _flushBatch();
        }
        if (!img._glTexture) {
            img._glTexture = _gl.createTexture();
            _gl.bindTexture(_gl.TEXTURE_2D, img._glTexture);
            _gl.texImage2D(_gl.TEXTURE_2D, 0, _gl.RGBA, _gl.RGBA, _gl.UNSIGNED_BYTE, img);
            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_S, _gl.CLAMP_TO_EDGE);
            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_T, _gl.CLAMP_TO_EDGE);
            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MIN_FILTER, _gl.LINEAR);
            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MAG_FILTER, _gl.LINEAR);
        }
        _batchTexture = img._glTexture;
        _batchMode = 'triangles';
        var base = _batchVertices.length / 2;
        var u0 = sx / img.width, v0 = sy / img.height;
        var u1 = (sx + sw) / img.width, v1 = (sy + sh) / img.height;
        _addVertex(dx, dy, u0, v0);
        _addVertex(dx + dw, dy, u1, v0);
        _addVertex(dx, dy + dh, u0, v1);
        _addVertex(dx + dw, dy + dh, u1, v1);
        _addIndex(base); _addIndex(base + 1); _addIndex(base + 2);
        _addIndex(base + 1); _addIndex(base + 3); _addIndex(base + 2);
        if (_batchVertices.length >= _maxBatchSize * 2) _flushBatch();
    }

    // 虚线绘制
    function _glSetLineDash(dash) {
        _currentLineDash = dash || [];
        if (_ctx) _ctx.setLineDash(dash || []);
    }
    function _glDrawDashedLine(x1, y1, x2, y2) {
        if (_ctx) {
            _ctx.setLineDash(_currentLineDash);
            _ctx.beginPath(); _ctx.moveTo(x1, y1); _ctx.lineTo(x2, y2); _ctx.stroke();
            _ctx.setLineDash([]);
            return;
        }
        if (!_gl || _currentLineDash.length < 2) { _glDrawLine(x1, y1, x2, y2); return; }
        var dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy);
        if (len === 0) return;
        var nx = dx / len, ny = dy / len, pos = 0, dashIdx = 0, draw = true;
        while (pos < len) {
            var segLen = Math.min(_currentLineDash[dashIdx % _currentLineDash.length], len - pos);
            if (draw) _glDrawLine(x1 + nx * pos, y1 + ny * pos, x1 + nx * (pos + segLen), y1 + ny * (pos + segLen));
            pos += segLen; dashIdx++; draw = !draw;
        }
    }

    // 裁剪
    function _glBeginClip() {
        if (_ctx) return; // Canvas 2D clip 在 applyClips 中直接处理
        if (!_gl) return;
        _flushBatch();
        _gl.enable(_gl.STENCIL_TEST);
        _clipStack.push(true);
        _gl.stencilFunc(_gl.ALWAYS, _clipStack.length, 0xFF);
        _gl.stencilOp(_gl.KEEP, _gl.KEEP, _gl.REPLACE);
    }
    function _glEndClip() {
        if (_ctx) return;
        if (!_gl || _clipStack.length === 0) return;
        _flushBatch();
        _clipStack.pop();
        if (_clipStack.length === 0) _gl.disable(_gl.STENCIL_TEST);
        else _gl.stencilFunc(_gl.EQUAL, _clipStack.length, 0xFF);
    }

    // 文字绘制
    function _glDrawText(text, x, y, font, align, baseline) {
        if (_ctx) {
            _ctx.font = font || '11px system-ui';
            _ctx.textAlign = align || 'left';
            _ctx.textBaseline = baseline || 'alphabetic';
            _ctx.fillText(text, x, y);
            return;
        }
        if (!_gl) return;
        _flushBatch();
        if (!_textures.textCache) _textures.textCache = {};
        var key = text + '|' + font + '|' + _currentColor.join(',');
        var cache = _textures.textCache[key];
        if (!cache) {
            var cvs = document.createElement('canvas');
            var ctx2 = cvs.getContext('2d');
            var fontSize = parseInt((font || '11px').replace(/[^0-9]/g, '')) || 11;
            ctx2.font = font || '11px system-ui';
            var metrics = ctx2.measureText(text);
            cvs.width = Math.ceil(metrics.width) + 4;
            cvs.height = Math.ceil(fontSize * 1.4) + 4;
            ctx2.font = font || '11px system-ui';
            ctx2.fillStyle = 'white';
            ctx2.textAlign = 'left';
            ctx2.textBaseline = 'top';
            ctx2.fillText(text, 2, 2);
            cache = { texture: _gl.createTexture(), width: cvs.width, height: cvs.height };
            _gl.bindTexture(_gl.TEXTURE_2D, cache.texture);
            _gl.texImage2D(_gl.TEXTURE_2D, 0, _gl.RGBA, _gl.RGBA, _gl.UNSIGNED_BYTE, cvs);
            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_S, _gl.CLAMP_TO_EDGE);
            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_T, _gl.CLAMP_TO_EDGE);
            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MIN_FILTER, _gl.LINEAR);
            _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MAG_FILTER, _gl.LINEAR);
            _textures.textCache[key] = cache;
        }
        var tx = x, ty = y;
        if (align === 'center') tx -= cache.width / 2;
        else if (align === 'right') tx -= cache.width;
        if (baseline === 'middle') ty -= cache.height / 2;
        else if (baseline === 'bottom') ty -= cache.height;
        if (_batchMode !== 'triangles' || _batchTexture !== cache.texture) _flushBatch();
        _batchTexture = cache.texture;
        _batchMode = 'triangles';
        var base = _batchVertices.length / 2;
        _addVertex(tx, ty, 0, 0); _addVertex(tx + cache.width, ty, 1, 0);
        _addVertex(tx, ty + cache.height, 0, 1); _addVertex(tx + cache.width, ty + cache.height, 1, 1);
        _addIndex(base); _addIndex(base + 1); _addIndex(base + 2);
        _addIndex(base + 1); _addIndex(base + 3); _addIndex(base + 2);
        if (_batchVertices.length >= _maxBatchSize * 2) _flushBatch();
    }

    // ===== 碰撞 =====
    function hitTest(wx, wy) {
        for (var fi = 0; fi < _ffdMeshes.length; fi++) {
            var mesh = _ffdMeshes[fi], b = mesh.bone;
            for (var r = 0; r <= mesh.rows; r++) {
                for (var c = 0; c <= mesh.cols; c++) {
                    var u = c / mesh.cols, v = r / mesh.rows;
                    var off = getFFDOffset(mesh, u, v);
                    var px = b.wx + (u - 0.5) * mesh.width * b.wsx + off.dx;
                    var py = b.wy + (v - 0.5) * mesh.height * b.wsy + off.dy;
                    if (Math.hypot(wx - px, wy - py) < 8) return { bone: b, part: 'ffd', mesh: mesh, col: c, row: r };
                }
            }
        }
        for (var i = _bones.length - 1; i >= 0; i--) {
            var b = _bones[i], dx = wx - b.wx, dy = wy - b.wy;
            if (dx * dx + dy * dy < 144) return { bone: b, part: 'joint' };
            var e = boneEnd(b);
            // 骨骼末端检测（用于拖拽调整长度）
            var edx = wx - e.x, edy = wy - e.y;
            if (edx * edx + edy * edy < 100) return { bone: b, part: 'end' };
            var d = ptSeg(wx, wy, b.wx, b.wy, e.x, e.y);
            if (d < 10) return { bone: b, part: 'body' };
        }
        return null;
    }
    function ptSeg(px, py, x1, y1, x2, y2) {
        var dx = x2 - x1, dy = y2 - y1, l2 = dx * dx + dy * dy;
        if (l2 === 0) return Math.hypot(px - x1, py - y1);
        var t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / l2));
        return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    }

    function s2w(sx, sy) {
        var r = _canvas.getBoundingClientRect();
        return { x: (sx - r.left - _canvas.width / 2 / (window.devicePixelRatio || 1) - _vx) / _vs, y: (sy - r.top - _canvas.height / 2 / (window.devicePixelRatio || 1) - _vy) / _vs };
    }

    // ===== 动画 =====
    function Anim(name) { this.id = _nextId++; this.name = name; this.duration = 0; this.tracks = {}; }
    function addAnim(name) { var a = new Anim(name || 'anim'); _anims.push(a); return a; }

    function recordFrame() {
        if (!_curAnim || !_selectedBone || !_autoRecord) return;
        var b = _selectedBone, t = _curAnim.tracks;
        if (!t[b.id]) t[b.id] = { rotate: [], translate: [], scale: [] };
        var tr = t[b.id];
        _setKF(tr.rotate, _animTime, b.rotation);
        _setKF(tr.translate, _animTime, [b.x, b.y]);
        _setKF(tr.scale, _animTime, [b.scaleX, b.scaleY]);
        _updateDur();
        _renderTimeline();
        _checkGuideComplete();
    }
    function _setKF(track, time, value) {
        for (var i = 0; i < track.length; i++) if (Math.abs(track[i].t - time) < 0.001) { track[i].v = value; return; }
        track.push({ t: time, v: value, ci: 0.25, co: 0.75 });
        track.sort(function(a, b) { return a.t - b.t; });
    }
    function _updateDur() {
        var mx = 0;
        for (var id in _curAnim.tracks) { var tr = _curAnim.tracks[id]; ['rotate','translate','scale'].forEach(function(p) { if (tr[p].length) mx = Math.max(mx, tr[p][tr[p].length - 1].t); }); }
        _curAnim.duration = mx;
    }

    function sampleAnimTo(anim, time, bones) {
        for (var id in anim.tracks) {
            var b = null;
            for (var i = 0; i < bones.length; i++) if (bones[i].id === parseInt(id)) { b = bones[i]; break; }
            if (!b) continue;
            var tr = anim.tracks[id];
            if (tr.rotate.length) b.rotation = _lerp(tr.rotate, time, b.sr);
            if (tr.translate.length) { b.x = _lerpXY(tr.translate, time, b.sx, b.sy, 0); b.y = _lerpXY(tr.translate, time, b.sx, b.sy, 1); }
            if (tr.scale.length) { b.scaleX = _lerpXY(tr.scale, time, b.ssx, b.ssy, 0); b.scaleY = _lerpXY(tr.scale, time, b.ssx, b.ssy, 1); }
        }
        for (var j = 0; j < bones.length; j++) { if (!bones[j].parent) _fk(bones[j]); }
    }
    function sampleAnim(anim, time) { sampleAnimTo(anim, time, _bones); }

    // ===== 贝塞尔缓动 =====
    var _easingPresets = {
        linear: { ci: 0, co: 1 }, easeIn: { ci: 0.42, co: 1 }, easeOut: { ci: 0, co: 0.58 },
        easeInOut: { ci: 0.25, co: 0.75 }, bounce: { ci: 0.68, co: -0.55 },
        elastic: { ci: 0.175, co: 0.885 }, sharp: { ci: 0.9, co: 0.1 }
    };
    function _cubicBezier(p1x, p1y, p2x, p2y, x) {
        if (x <= 0) return 0; if (x >= 1) return 1;
        var t = x;
        for (var i = 0; i < 8; i++) {
            var cx = 3 * p1x, bx = 3 * (p2x - p1x) - cx, ax = 1 - cx - bx;
            var dx = t * (cx + t * (bx + t * ax)) - x;
            if (Math.abs(dx) < 1e-7) break;
            var cx2 = cx + t * (2 * bx + 3 * ax * t);
            if (Math.abs(cx2) < 1e-7) break;
            t -= dx / cx2;
        }
        var cy = 3 * p1y, by = 3 * (p2y - p1y) - cy, ay = 1 - cy - by;
        return t * (cy + t * (by + t * ay));
    }
    function _getEasedProgress(kfA, kfB, t) {
        var linear = (t - kfA.t) / (kfB.t - kfA.t);
        if (linear <= 0) return 0; if (linear >= 1) return 1;
        var co = kfA.co != null ? kfA.co : 0.75, ci = kfB.ci != null ? kfB.ci : 0.25;
        return _cubicBezier(co, co, ci, ci, linear);
    }
    function _lerp(kf, t, def) {
        if (!kf.length) return def;
        if (t <= kf[0].t) return kf[0].v;
        if (t >= kf[kf.length - 1].t) return kf[kf.length - 1].v;
        for (var i = 0; i < kf.length - 1; i++) if (t >= kf[i].t && t < kf[i + 1].t) {
            var f = _getEasedProgress(kf[i], kf[i + 1], t);
            return kf[i].v + (kf[i + 1].v - kf[i].v) * f;
        }
        return def;
    }
    function _lerpXY(kf, t, dx, dy, idx) {
        if (!kf.length) return idx === 0 ? dx : dy;
        var g = function(k) { return Array.isArray(k.v) ? k.v[idx] : (idx === 0 ? dx : dy); };
        if (t <= kf[0].t) return g(kf[0]);
        if (t >= kf[kf.length - 1].t) return g(kf[kf.length - 1]);
        for (var i = 0; i < kf.length - 1; i++) if (t >= kf[i].t && t < kf[i + 1].t) {
            var f = _getEasedProgress(kf[i], kf[i + 1], t);
            return g(kf[i]) + (g(kf[i + 1]) - g(kf[i])) * f;
        }
        return idx === 0 ? dx : dy;
    }
    function resetPose() { _bones.forEach(function(b) { b.x = b.sx; b.y = b.sy; b.rotation = b.sr; b.scaleX = b.ssx; b.scaleY = b.ssy; b.length = b.sl; }); updateFK(); }

    function _getAllKFTimes(boneId) {
        if (!_curAnim || !_curAnim.tracks[boneId]) return [];
        var tr = _curAnim.tracks[boneId];
        var times = {};
        ['rotate','translate','scale'].forEach(function(p) { tr[p].forEach(function(k) { times[k.t] = true; }); });
        return Object.keys(times).map(Number).sort(function(a, b) { return a - b; });
    }

    // ===== 渲染 =====
    function render() {
        if (!_canvas) return;
        var dpr = window.devicePixelRatio || 1;
        var w = _canvas.width / dpr, h = _canvas.height / dpr;
        
        // 更新投影矩阵
        if (_gl) {
            _mat4Ortho(_projectionMatrix, -w/2, w/2, h/2, -h/2, -1, 1);
            _gl.viewport(0, 0, _canvas.width, _canvas.height);
            _glClear(6/255, 10/255, 20/255, 1);
            
            // 设置视图变换
            _mat4Identity(_currentMatrix);
            _glTranslate(w / 2 + _vx, h / 2 + _vy);
            _glScale(_vs, _vs);
        } else if (_ctx) {
            // Canvas 2D fallback (用于曲线编辑器)
            _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
            _ctx.fillStyle = '#060a14';
            _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
            _ctx.save();
            _ctx.translate(w / 2 + _vx, h / 2 + _vy);
            _ctx.scale(_vs, _vs);
        }

        _drawGrid(w, h);

        // 解算约束（FK之后、渲染之前）
        if (_constraints.length > 0) solveConstraints();
        // 解算路径约束
        if (_pathConstraints.length > 0) solvePathConstraints();

        // 洋葱皮（在主骨骼之前绘制）
        if (_onionSkin && _curAnim && _curAnim.duration > 0 && _rootBone && !_playing) {
            _drawOnionSkin(w, h);
        }

        // 附件（在骨骼下方，应用裁剪遮罩）
        if (_clips.length > 0) applyClips();
        _drawAttachments();
        if (_clips.length > 0) restoreClips();

        // IK目标点（在主骨骼之前绘制）
        if (_ikActive && _ikTarget) {
            _drawIKTarget(_ikTarget);
        }

        // 主骨骼
        if (_rootBone) _drawBone(_rootBone);

        // 约束连线（在骨骼之上绘制）
        _drawConstraints();

        // 路径渲染
        _drawPaths();

        // FFD网格渲染
        _drawFFDMeshes();

        // 裁剪遮罩渲染
        _drawClips();

        // 空状态
        if (!_rootBone) {
            _glSetColor(200/255, 215/255, 235/255, 0.6);
            _glDrawText('双击这里，开始创建骨骼', 0, 0, (16 / _vs) + 'px system-ui,sans-serif', 'center', 'middle');
            _glSetColor(200/255, 215/255, 235/255, 0.4);
            _glDrawText('拖拽骨骼旋转 · 拖拽末端自动IK · 双击菱形编辑缓动', 0, 24 / _vs, (11 / _vs) + 'px system-ui,sans-serif', 'center', 'middle');
        }

        if (_gl) {
            _flushBatch();
        } else if (_ctx) {
            _ctx.restore();
        }

        // HUD - 使用Canvas 2D绘制（WebGL文字复杂）
        if (_bones.length > 0) {
            var hudCanvas = _gl ? document.createElement('canvas') : null;
            var hudCtx = _gl ? hudCanvas.getContext('2d') : _ctx;
            if (_gl) {
                hudCanvas.width = _canvas.width;
                hudCanvas.height = _canvas.height;
            }
            
            hudCtx.fillStyle = 'rgba(232,237,245,0.7)';
            hudCtx.font = '11px system-ui,sans-serif';
            hudCtx.textAlign = 'left';
            var info = _bones.length + ' 骨骼';
            if (_selectedBone) info += '  ·  ' + _selectedBone.name + '  ' + _selectedBone.rotation.toFixed(0) + '°';
            if (_constraints.length) info += '  ·  🔗 ' + _constraints.length + '约束';
            var jiggleCount = _bones.filter(function(b) { return b.jiggle; }).length;
            if (jiggleCount) info += '  ·  🌊 ' + jiggleCount;
            if (_paths.length) info += '  ·  🛤️ ' + _paths.length;
            if (_ffdMeshes.length) info += '  ·  🔲 ' + _ffdMeshes.length;
            if (_clips.length) info += '  ·  ✂️ ' + _clips.length;
            if (_ikActive) info += '  ·  🦿 IK';
            if (_playing && _curAnim) info += '  ·  ▶  ' + _animTime.toFixed(1) + 's';
            hudCtx.fillText(info, 14, 22);
            // Shift提示
            if (_shiftHeld && !_constraintSource) {
                hudCtx.fillStyle = 'rgba(168,85,247,0.8)';
                hudCtx.font = '10px system-ui,sans-serif';
                hudCtx.fillText('Shift+点击骨骼 → 创建约束', 14, 38);
            } else if (_constraintSource) {
                hudCtx.fillStyle = 'rgba(168,85,247,0.6)';
                hudCtx.font = '10px system-ui,sans-serif';
                hudCtx.fillText('再Shift+点击目标骨骼 → 完成约束', 14, 38);
            }
            
            if (_gl && hudCanvas.width > 0) {
                // 将HUD Canvas作为纹理绘制到WebGL上
                if (!_textures.hud) {
                    _textures.hud = _gl.createTexture();
                }
                _gl.bindTexture(_gl.TEXTURE_2D, _textures.hud);
                _gl.texImage2D(_gl.TEXTURE_2D, 0, _gl.RGBA, _gl.RGBA, _gl.UNSIGNED_BYTE, hudCanvas);
                _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_S, _gl.CLAMP_TO_EDGE);
                _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_WRAP_T, _gl.CLAMP_TO_EDGE);
                _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MIN_FILTER, _gl.LINEAR);
                _gl.texParameteri(_gl.TEXTURE_2D, _gl.TEXTURE_MAG_FILTER, _gl.LINEAR);
                
                // 重置矩阵到屏幕坐标
                var dpr = window.devicePixelRatio || 1;
                var hw = _canvas.width / dpr, hh = _canvas.height / dpr;
                _mat4Identity(_currentMatrix);
                _mat4Ortho(_projectionMatrix, 0, hw, hh, 0, -1, 1);
                _glDrawImage(hudCanvas, 0, 0, hudCanvas.width, hudCanvas.height, 0, 0, hw, hh);
                _flushBatch();
            }
        }
    }

    function _drawGrid(w, h) {
        var gs = 40, s = _vs;
        var x0 = Math.floor((-w / 2 / s - _vx / s) / gs) * gs;
        var x1 = Math.ceil((w / 2 / s - _vx / s) / gs) * gs;
        var y0 = Math.floor((-h / 2 / s - _vy / s) / gs) * gs;
        var y1 = Math.ceil((h / 2 / s - _vy / s) / gs) * gs;
        
        _glSetColor(100/255, 160/255, 255/255, 0.04);
        // 垂直线
        for (var x = x0; x <= x1; x += gs) {
            _glDrawLine(x, y0, x, y1);
        }
        // 水平线
        for (var y = y0; y <= y1; y += gs) {
            _glDrawLine(x0, y, x1, y);
        }
        _flushBatch();
        
        // 坐标轴
        _glSetColor(100/255, 160/255, 255/255, 0.1);
        _glDrawLine(-12, 0, 12, 0);
        _glDrawLine(0, -12, 0, 12);
        _flushBatch();
    }

    // ===== 洋葱皮 =====
    function _drawOnionSkin(w, h) {
        var frameDur = 1 / 24; // 24fps
        // 前帧（蓝色）
        for (var i = 1; i <= _onionBefore; i++) {
            var t = _animTime - i * frameDur;
            if (t < 0) continue;
            var alpha = 0.12 - i * 0.025;
            if (alpha <= 0) continue;
            _drawBoneSnapshot(t, 'rgba(56,189,248,' + alpha + ')');
        }
        // 后帧（红色）
        for (var j = 1; j <= _onionAfter; j++) {
            var t2 = _animTime + j * frameDur;
            if (t2 > _curAnim.duration) continue;
            var alpha2 = 0.12 - j * 0.025;
            if (alpha2 <= 0) continue;
            _drawBoneSnapshot(t2, 'rgba(251,113,133,' + alpha2 + ')');
        }
    }

    function _drawBoneSnapshot(time, color) {
        // 保存当前骨骼状态
        var saved = _bones.map(function(b) { return { x: b.x, y: b.y, rotation: b.rotation, scaleX: b.scaleX, scaleY: b.scaleY, wx: b.wx, wy: b.wy, wr: b.wr, wsx: b.wsx, wsy: b.wsy }; });
        // 采样
        sampleAnim(_curAnim, time);
        // 绘制（半透明）
        if (_rootBone) _drawBoneSimple(_rootBone, color);
        // 恢复
        for (var i = 0; i < _bones.length; i++) {
            var b = _bones[i], s = saved[i];
            b.x = s.x; b.y = s.y; b.rotation = s.rotation; b.scaleX = s.scaleX; b.scaleY = s.scaleY;
            b.wx = s.wx; b.wy = s.wy; b.wr = s.wr; b.wsx = s.wsx; b.wsy = b.wsy;
        }
    }

    function _drawBoneSimple(b, color) {
        var e = boneEnd(b);
        b.children.forEach(function(c) { _drawBoneSimple(c, color); });
        
        // 解析颜色
        var rgba = color.match(/rgba?\(([^)]+)\)/);
        if (rgba) {
            var parts = rgba[1].split(',').map(function(p) { return parseFloat(p.trim()); });
            _glSetColor(parts[0]/255, parts[1]/255, parts[2]/255, parts[3] || 1);
        }
        
        _glDrawLine(b.wx, b.wy, e.x, e.y, 1.5 / _vs);
        _glDrawCircle(b.wx, b.wy, 3 / _vs);
        _flushBatch();
    }

    // ===== 附件渲染 =====
    function _drawAttachments() {
        for (var i = 0; i < _attachments.length; i++) {
            var att = _attachments[i];
            if (!att.image || !att.image.complete || !att.image.naturalWidth) continue;
            var b = att.bone;
            
            _glSave();
            _glTranslate(b.wx, b.wy);
            _glRotate(b.wr * DEG);
            _glScale(b.wsx * att.scaleX, b.wsy * att.scaleY);
            _glSetAlpha(0.9);
            
            // 应用 FFD 变形（如果有）
            var ffdMesh = null;
            for (var fi = 0; fi < _ffdMeshes.length; fi++) {
                if (_ffdMeshes[fi].bone === b) { ffdMesh = _ffdMeshes[fi]; break; }
            }
            if (ffdMesh) {
                // FFD 变形：用网格细分绘制
                var cols = ffdMesh.cols, rows = ffdMesh.rows;
                var fw = ffdMesh.width, fh = ffdMesh.height;
                var aw = att.width, ah = att.height;
                for (var r = 0; r < rows; r++) {
                    for (var c = 0; c < cols; c++) {
                        var u0 = c / cols, v0 = r / rows;
                        var u1 = (c + 1) / cols, v1 = (r + 1) / rows;
                        var o00 = getFFDOffset(ffdMesh, u0, v0);
                        var o10 = getFFDOffset(ffdMesh, u1, v0);
                        var o01 = getFFDOffset(ffdMesh, u0, v1);
                        var o11 = getFFDOffset(ffdMesh, u1, v1);
                        // 源矩形（在附件坐标中）
                        var sx = att.offsetX - aw / 2 + u0 * aw;
                        var sy = att.offsetY - ah / 2 + v0 * ah;
                        var sw = aw / cols, sh = ah / rows;
                        // 目标四边形（简化为矩形+偏移）
                        _glDrawImage(att.image, sx, sy, sw, sh, o00.dx + sx, o00.dy + sy, sw, sh);
                    }
                }
            } else {
                _glDrawImage(att.image, 0, 0, att.image.width, att.image.height, 
                    att.offsetX - att.width / 2, att.offsetY - att.height / 2, att.width, att.height);
            }
            _glSetAlpha(1);
            _glRestore();
        }
        _flushBatch();
    }

    // ===== IK目标点渲染 =====
    function _drawIKTarget(target) {
        // 十字准星
        var s = 8 / _vs;
        _glSetColor(251/255, 191/255, 36/255, 0.6);
        _glDrawLine(target.x - s, target.y, target.x + s, target.y);
        _glDrawLine(target.x, target.y - s, target.x, target.y + s);
        // 外圈
        _glSetColor(251/255, 191/255, 36/255, 0.3);
        _glDrawRing(target.x, target.y, s * 0.7, 1 / _vs);
        // 脉冲光晕
        _glSetColor(251/255, 191/255, 36/255, 0.1);
        _glDrawRing(target.x, target.y, s * 1.5, 1 / _vs);
        _flushBatch();
    }

    // ===== 约束连线渲染 =====
    function _drawConstraints() {
        var typeColors = {
            rotation: { r: 168/255, g: 85/255, b: 247/255, a: 0.5 },   // 紫色=旋转
            position: { r: 34/255, g: 197/255, b: 94/255, a: 0.5 },     // 绿色=位置
            scale: { r: 251/255, g: 146/255, b: 60/255, a: 0.5 }        // 橙色=缩放
        };
        var typeColorsSolid = {
            rotation: '#a855f7',
            position: '#22c55e',
            scale: '#fb923c'
        };
        for (var i = 0; i < _constraints.length; i++) {
            var c = _constraints[i];
            var bx = c.bone.wx, by = c.bone.wy;
            var tx = c.target.wx, ty = c.target.wy;
            var color = typeColors[c.type] || typeColors.rotation;
            var solid = typeColorsSolid[c.type] || typeColorsSolid.rotation;

            // 虚线
            _glSetLineDash([4 / _vs, 4 / _vs]);
            _glSetColor(color.r, color.g, color.b, color.a);
            _glDrawDashedLine(bx, by, tx, ty);
            _flushBatch();
            _glSetLineDash([]);

            // 箭头（指向target方向）
            var angle = Math.atan2(ty - by, tx - bx);
            var mx = (bx + tx) / 2, my = (by + ty) / 2;
            var as = 5 / _vs;
            
            _glSetColor(parseInt(solid.slice(1,3),16)/255, parseInt(solid.slice(3,5),16)/255, parseInt(solid.slice(5,7),16)/255, 0.6);
            // 简化为三角形箭头
            var ax1 = mx + Math.cos(angle) * as;
            var ay1 = my + Math.sin(angle) * as;
            var ax2 = mx + Math.cos(angle + 2.5) * as * 0.7;
            var ay2 = my + Math.sin(angle + 2.5) * as * 0.7;
            var ax3 = mx + Math.cos(angle - 2.5) * as * 0.7;
            var ay3 = my + Math.sin(angle - 2.5) * as * 0.7;
            _glDrawLine(ax1, ay1, ax2, ay2);
            _glDrawLine(ax2, ay2, ax3, ay3);
            _glDrawLine(ax3, ay3, ax1, ay1);
            _flushBatch();
        }
    }

    // ===== 路径渲染 =====
    function _drawPaths() {
        for (var i = 0; i < _paths.length; i++) {
            var path = _paths[i];
            if (path.points.length < 2) continue;
            
            // 用细分绘制平滑路径
            var steps = path.points.length * 10;
            var points = [];
            for (var s = 0; s <= steps; s++) {
                var pt = getPathPoint(path, s / steps);
                points.push(pt);
            }
            
            _glSetColor(34/255, 197/255, 94/255, 0.4);
            _glSetLineDash([6 / _vs, 4 / _vs]);
            _glDrawLines(points);
            _flushBatch();
            _glSetLineDash([]);
            
            // 路径点
            _glSetColor(34/255, 197/255, 94/255, 0.6);
            for (var j = 0; j < path.points.length; j++) {
                _glDrawCircle(path.points[j].x, path.points[j].y, 3 / _vs);
            }
            _flushBatch();
            
            // 路径约束骨骼的位置标记
            for (var k = 0; k < _pathConstraints.length; k++) {
                var pc = _pathConstraints[k];
                if (pc.path !== path) continue;
                var ppt = getPathPoint(path, pc.progress);
                _glSetColor(34/255, 197/255, 94/255, 0.6);
                _glDrawRing(ppt.x, ppt.y, 5 / _vs, 1.5 / _vs);
            }
            _flushBatch();
        }
    }

    // ===== FFD网格渲染 =====
    function _drawFFDMeshes() {
        for (var i = 0; i < _ffdMeshes.length; i++) {
            var mesh = _ffdMeshes[i];
            var b = mesh.bone;
            var cols = mesh.cols, rows = mesh.rows;
            var w = mesh.width, h = mesh.height;
            
            _glSetColor(251/255, 146/255, 60/255, 0.2);
            
            // 水平线
            for (var r = 0; r <= rows; r++) {
                var points = [];
                for (var c = 0; c <= cols; c++) {
                    var u = c / cols, v = r / rows;
                    var off = getFFDOffset(mesh, u, v);
                    var px = b.wx + (u - 0.5) * w * b.wsx + off.dx;
                    var py = b.wy + (v - 0.5) * h * b.wsy + off.dy;
                    points.push({ x: px, y: py });
                }
                _glDrawLines(points);
            }
            // 垂直线
            for (var c2 = 0; c2 <= cols; c2++) {
                var points2 = [];
                for (var r2 = 0; r2 <= rows; r2++) {
                    var u2 = c2 / cols, v2 = r2 / rows;
                    var off2 = getFFDOffset(mesh, u2, v2);
                    var px2 = b.wx + (u2 - 0.5) * w * b.wsx + off2.dx;
                    var py2 = b.wy + (v2 - 0.5) * h * b.wsy + off2.dy;
                    points2.push({ x: px2, y: py2 });
                }
                _glDrawLines(points2);
            }
            _flushBatch();
            
            // 控制点
            _glSetColor(251/255, 146/255, 60/255, 0.5);
            for (var r3 = 0; r3 <= rows; r3++) {
                for (var c3 = 0; c3 <= cols; c3++) {
                    var u3 = c3 / cols, v3 = r3 / rows;
                    var off3 = getFFDOffset(mesh, u3, v3);
                    var px3 = b.wx + (u3 - 0.5) * w * b.wsx + off3.dx;
                    var py3 = b.wy + (v3 - 0.5) * h * b.wsy + off3.dy;
                    _glDrawCircle(px3, py3, 2.5 / _vs);
                }
            }
            _flushBatch();
        }
    }

    // ===== 裁剪遮罩渲染 =====
    function _drawClips() {
        for (var i = 0; i < _clips.length; i++) {
            var cl = _clips[i];
            var b = cl.bone;
            var w = cl.params.width || 60;
            var h = cl.params.height || 60;
            
            _glSave();
            _glTranslate(b.wx, b.wy);
            _glRotate(b.wr * DEG);
            
            _glSetColor(244/255, 114/255, 182/255, 0.4);
            _glSetLineDash([4 / _vs, 3 / _vs]);
            
            if (cl.shape === 'ellipse') {
                _glDrawEllipse(0, 0, w / 2, h / 2);
            } else {
                // 矩形框线
                _glDrawLine(-w/2, -h/2, w/2, -h/2);
                _glDrawLine(w/2, -h/2, w/2, h/2);
                _glDrawLine(w/2, h/2, -w/2, h/2);
                _glDrawLine(-w/2, h/2, -w/2, -h/2);
            }
            _flushBatch();
            _glSetLineDash([]);
            _glRestore();
        }
    }

    function _drawBone(b) {
        var e = boneEnd(b), sel = _selectedBone === b, hov = _hoverBone === b;
        var ikIdx = _getChainIndex(b);
        var inIK = ikIdx >= 0;

        // IK链光晕
        if (inIK && _ikActive) {
            _glSetColor(251/255, 191/255, 36/255, 0.15);
            _glDrawLine(b.wx, b.wy, e.x, e.y);
            _flushBatch();
        }

        // 骨骼主体颜色
        var strokeColor = sel ? '#fbbf24' : (inIK && _ikActive ? '#fbbf24' : (hov ? '#7dd3fc' : b.color));
        var lineWidth = (sel ? 3.5 : (inIK && _ikActive ? 2.5 : 2)) / _vs;
        
        // 解析颜色
        var hex = strokeColor.replace('#', '');
        var r = parseInt(hex.slice(0,2), 16) / 255;
        var g = parseInt(hex.slice(2,4), 16) / 255;
        var bVal = parseInt(hex.slice(4,6), 16) / 255;
        _glSetColor(r, g, bVal, 1);
        
        _glDrawLine(b.wx, b.wy, e.x, e.y);
        _flushBatch();
        
        // 中间箭头
        var rad = b.wr * DEG, c = Math.cos(rad), s = Math.sin(rad);
        var mx = (b.wx + e.x) / 2, my = (b.wy + e.y) / 2, ts = 4 / _vs;
        var triPoints = [
            { x: mx + c * ts, y: my + s * ts },
            { x: mx - s * ts * 0.5 - c * ts * 0.3, y: my + c * ts * 0.5 - s * ts * 0.3 },
            { x: mx + s * ts * 0.5 - c * ts * 0.3, y: my - c * ts * 0.5 - s * ts * 0.3 }
        ];
        _glDrawLine(triPoints[0].x, triPoints[0].y, triPoints[1].x, triPoints[1].y);
        _glDrawLine(triPoints[1].x, triPoints[1].y, triPoints[2].x, triPoints[2].y);
        _glDrawLine(triPoints[2].x, triPoints[2].y, triPoints[0].x, triPoints[0].y);
        _flushBatch();
        
        // 关节
        var jr = (sel ? 6 : 4.5) / _vs;
        _glDrawCircle(b.wx, b.wy, jr);
        _flushBatch();
        
        // 关节内圈
        _glSetColor(6/255, 10/255, 20/255, 1);
        _glDrawCircle(b.wx, b.wy, jr * 0.4);
        _flushBatch();
        
        // 标签
        if (_vs > 0.6) {
            _glSetColor(232/255, 237/255, 245/255, 0.7);
            var label = b.name + (b.jiggle ? ' ~' : '');
            _glDrawText(label, b.wx, b.wy - 9 / _vs, (9 / _vs) + 'px system-ui,sans-serif', 'center', 'bottom');
            _flushBatch();
        }
        
        // 末端小方块（表示可拖拽调整长度）
        if (b.length > 0 && (sel || hov)) {
            var es = 3 / _vs;
            _glSetColor(r, g, bVal, 0.6);
            _glDrawRect(e.x - es, e.y - es, es * 2, es * 2);
            _flushBatch();
        }

        // 递归绘制子节点（在父节点之后）
        b.children.forEach(_drawBone);
    }

    // 裁剪遮罩应用
    function applyClips() {
        if (_clips.length === 0) return;
        
        // Canvas 2D clip
        if (_ctx) {
            for (var i = 0; i < _clips.length; i++) {
                var cl = _clips[i], b = cl.bone;
                var w = cl.params.width || 60, h = cl.params.height || 60;
                _ctx.save();
                _ctx.translate(b.wx, b.wy);
                _ctx.rotate(b.wr * DEG);
                _ctx.beginPath();
                if (cl.shape === 'ellipse') {
                    _ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, PI * 2);
                } else {
                    _ctx.rect(-w/2, -h/2, w, h);
                }
                _ctx.clip();
            }
            return;
        }
        
        // WebGL stencil clip
        if (_gl) {
            _flushBatch();
            _gl.enable(_gl.STENCIL_TEST);
            _gl.clear(_gl.STENCIL_BUFFER_BIT);
            _gl.stencilFunc(_gl.ALWAYS, 1, 0xFF);
            _gl.stencilOp(_gl.KEEP, _gl.KEEP, _gl.REPLACE);
            _gl.colorMask(false, false, false, false);
            
            for (var i = 0; i < _clips.length; i++) {
                var cl = _clips[i], b = cl.bone;
                var w = cl.params.width || 60, h = cl.params.height || 60;
                _glSave();
                _glTranslate(b.wx, b.wy);
                _glRotate(b.wr * DEG);
                if (cl.shape === 'ellipse') _glDrawEllipse(0, 0, w / 2, h / 2);
                else _glFillRect(-w/2, -h/2, w, h);
                _flushBatch();
                _glRestore();
            }
            
            _gl.colorMask(true, true, true, true);
            _gl.stencilFunc(_gl.EQUAL, 1, 0xFF);
            _gl.stencilOp(_gl.KEEP, _gl.KEEP, _gl.KEEP);
        }
    }
    
    function restoreClips() {
        if (_ctx) {
            for (var i = 0; i < _clips.length; i++) _ctx.restore();
            return;
        }
        if (_gl) _gl.disable(_gl.STENCIL_TEST);
    }

    // ===== 视觉时间轴 =====
    function _renderTimeline() {
        var el = _overlay.querySelector('#sa-tl-tracks');
        if (!el) return;
        if (!_curAnim || !_bones.length) {
            el.innerHTML = '<div style="color:rgba(148,163,184,0.3);font-size:10px;text-align:center;padding:8px;">拖拽骨骼自动录制关键帧</div>';
            return;
        }
        var dur = Math.max(_curAnim.duration, 0.5);
        var h = '';
        for (var i = 0; i < _bones.length; i++) {
            var b = _bones[i];
            var times = _getAllKFTimes(b.id);
            var sel = _selectedBone === b;
            h += '<div class="sa-row' + (sel ? ' sel' : '') + '" data-bone-id="' + b.id + '">';
            h += '<span class="sa-row-name" style="color:' + b.color + ';">' + b.name + '</span>';
            h += '<div class="sa-row-track">';
            // 关键帧菱形
            for (var j = 0; j < times.length; j++) {
                var pct = (times[j] / dur * 100).toFixed(2);
                h += '<div class="sa-kf" style="left:' + pct + '%;" data-time="' + times[j] + '" data-bone="' + b.id + '" title="' + times[j].toFixed(2) + 's"></div>';
            }
            h += '</div></div>';
        }
        el.innerHTML = h;

        // 点击关键帧 → 跳转到该时间
        el.querySelectorAll('.sa-kf').forEach(function(kf) {
            kf.addEventListener('click', function(e) {
                e.stopPropagation();
                var t = parseFloat(kf.dataset.time);
                var boneId = parseInt(kf.dataset.bone);
                _animTime = t;
                _selectedBone = boneById(boneId);
                if (!_playing) { sampleAnim(_curAnim, _animTime); }
                render();
                _updateCursor();
                _renderTimeline();
                _closeCurveEditor();
            });
            // 双击关键帧 → 打开曲线编辑器
            kf.addEventListener('dblclick', function(e) {
                e.preventDefault();
                e.stopPropagation();
                var t = parseFloat(kf.dataset.time);
                var boneId = parseInt(kf.dataset.bone);
                _animTime = t;
                _selectedBone = boneById(boneId);
                if (!_playing) { sampleAnim(_curAnim, _animTime); }
                render();
                _updateCursor();
                _renderTimeline();
                _openCurveEditor(boneId, t);
            });
            // 右键删除关键帧
            kf.addEventListener('contextmenu', function(e) {
                e.preventDefault();
                e.stopPropagation();
                var t = parseFloat(kf.dataset.time);
                var boneId = parseInt(kf.dataset.bone);
                if (!_curAnim || !_curAnim.tracks[boneId]) return;
                var tr = _curAnim.tracks[boneId];
                ['rotate','translate','scale'].forEach(function(p) {
                    tr[p] = tr[p].filter(function(k) { return Math.abs(k.t - t) > 0.001; });
                });
                _updateDur();
                render();
                _renderTimeline();
            });
        });

        // 点击行 → 选中骨骼
        el.querySelectorAll('.sa-row').forEach(function(row) {
            row.addEventListener('click', function() {
                _selectedBone = boneById(parseInt(row.dataset.boneId));
                render();
                _renderTimeline();
                _updateIKPanel();
            });
        });
    }

    // ===== 事件 =====
    function _bindEvents() {
        _on(_canvas, 'mousedown', _onDown);
        _on(_canvas, 'mousemove', _onMove);
        _on(_canvas, 'mouseup', _onUp);
        _on(_canvas, 'wheel', _onWheel, { passive: false });
        _on(_canvas, 'dblclick', _onDbl);
        _on(_canvas, 'contextmenu', function(e) {
            e.preventDefault();
            var w = s2w(e.clientX, e.clientY), hit = hitTest(w.x, w.y);
            if (hit && hit.bone && hit.bone.name !== 'root') {
                _confirm('确定删除骨骼 "' + hit.bone.name + '" 吗？\n子骨骼也会一并删除。', function() {
                    removeBone(hit.bone);
                    if (_selectedBone === hit.bone) _selectedBone = null;
                    updateFK(); render(); _renderTimeline();
                }, { title: '删除骨骼', danger: true });
            }
        });
        _on(document, 'keydown', _onKey);
        _on(document, 'keyup', function(e) { if (e.key === 'Shift') { _shiftHeld = false; _constraintSource = null; render(); } });
        _on(_canvas, 'mouseenter', _revealControls);
        // 拖拽图片到画布
        _on(_canvas, 'dragover', function(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
        _on(_canvas, 'drop', _onDrop);
    }

    function _revealControls() {
        var bar = _overlay.querySelector('.sa-float');
        if (bar) bar.style.opacity = '1';
        clearTimeout(_hideTimer);
        if (_userMode === 'novice') return; // 新手模式始终显示
        _hideTimer = setTimeout(function() {
            if (!_playing && !_timelineOpen) {
                if (bar) bar.style.opacity = '0';
            }
        }, 4000);
    }

    function _onDown(e) {
        var w = s2w(e.clientX, e.clientY), hit = hitTest(w.x, w.y);

        // 路径绘制模式：点击添加路径点
        if (_pathDrawMode && e.button === 0) {
            var path = _paths[_paths.length - 1];
            if (path) {
                path.points.push({ x: w.x, y: w.y });
                render();
            }
            return;
        }

        if (e.button === 1 || (e.button === 0 && e.altKey)) {
            _drag = { type: 'pan', sx: e.clientX, sy: e.clientY, ox: _vx, oy: _vy };
            _canvas.style.cursor = 'grabbing';
            return;
        }

        // Shift+点击：创建约束
        if (e.shiftKey && hit) {
            if (!_constraintSource) {
                // 第一次Shift+点击：选择约束源
                _constraintSource = hit.bone;
                _selectedBone = hit.bone;
                render();
            } else if (hit.bone !== _constraintSource) {
                // 第二次Shift+点击：创建约束（默认旋转约束）
                addConstraint(_constraintSource, hit.bone, 'rotation');
                _constraintSource = null;
                render();
                _renderTimeline();
            }
            return;
        }

        // 非Shift点击：清除约束创建状态
        _constraintSource = null;

        if (e.button === 0 && hit) {
            _selectedBone = hit.bone;

            // FFD 控制点拖拽
            if (hit.part === 'ffd') {
                var idx = hit.row * (hit.mesh.cols + 1) + hit.col;
                _drag = { type: 'ffd', mesh: hit.mesh, idx: idx, col: hit.col, row: hit.row, sx: w.x, sy: w.y, odx: hit.mesh.offsets[idx].dx, ody: hit.mesh.offsets[idx].dy };
                render(); _renderTimeline();
                return;
            }

            // IK智能感知：如果拖拽的是末端骨骼且有父级链，自动启用IK
            if (_ikEnabled && hit.part === 'body' && _isEndOfChain(hit.bone) && hit.bone.parent) {
                _ikChain = _getChain(hit.bone);
                _ikTarget = { x: w.x, y: w.y };
                _ikActive = true;
                _drag = { type: 'ik', bone: hit.bone };
            } else if (hit.part === 'end') {
                // 拖拽骨骼末端调整长度
                var e = boneEnd(hit.bone);
                _drag = { type: 'resize', bone: hit.bone, ox: hit.bone.length, od: Math.hypot(w.x - hit.bone.wx, w.y - hit.bone.wy) };
            } else if (hit.part === 'joint') {
                _drag = { type: 'move', bone: hit.bone, sx: w.x, sy: w.y, ox: hit.bone.x, oy: hit.bone.y };
            } else {
                _drag = { type: 'rotate', bone: hit.bone, sa: Math.atan2(w.y - hit.bone.wy, w.x - hit.bone.wx) / DEG, or: hit.bone.rotation };
            }
        } else if (e.button === 0) {
            _selectedBone = null;
        }
        render(); _renderTimeline();
    }

    function _onMove(e) {
        var w = s2w(e.clientX, e.clientY);
        if (_drag) {
            if (_drag.type === 'pan') {
                _vx = _drag.ox + (e.clientX - _drag.sx);
                _vy = _drag.oy + (e.clientY - _drag.sy);
            } else if (_drag.type === 'ik') {
                // IK拖拽：更新目标位置，解算整条链
                _ikTarget = { x: w.x, y: w.y };
                _solveCCD(_ikTarget, _ikChain, _ikIterations);
            } else if (_drag.type === 'ffd') {
                // FFD 控制点拖拽
                var dx = w.x - _drag.sx, dy = w.y - _drag.sy;
                _drag.mesh.offsets[_drag.idx].dx = _drag.odx + dx;
                _drag.mesh.offsets[_drag.idx].dy = _drag.ody + dy;
            } else if (_drag.type === 'move') {
                var b = _drag.bone, dx = w.x - _drag.sx, dy = w.y - _drag.sy;
                if (b.parent) {
                    var a = -b.parent.wr * DEG, c = Math.cos(a), s = Math.sin(a);
                    b.x = _drag.ox + (c * dx - s * dy) / b.parent.wsx;
                    b.y = _drag.oy + (s * dx + c * dy) / b.parent.wsy;
                } else { b.x = _drag.ox + dx; b.y = _drag.oy + dy; }
                updateFK();
            } else if (_drag.type === 'rotate') {
                _drag.bone.rotation = _drag.or + (Math.atan2(w.y - _drag.bone.wy, w.x - _drag.bone.wx) / DEG - _drag.sa);
                updateFK();
            } else if (_drag.type === 'resize') {
                var dist = Math.hypot(w.x - _drag.bone.wx, w.y - _drag.bone.wy);
                _drag.bone.length = Math.max(10, _drag.ox + (dist - _drag.od));
                _drag.bone.sl = _drag.bone.length;
                updateFK();
            }
            render();
            return;
        }
        var hit = hitTest(w.x, w.y);
        if (hit !== _hoverBone) { _hoverBone = hit ? hit.bone : null; render(); }
        _canvas.style.cursor = hit ? (hit.part === 'joint' ? 'grab' : (hit.part === 'end' ? 'ew-resize' : 'pointer')) : 'default';
    }

    function _onUp(e) {
        if (_drag && (_drag.type === 'move' || _drag.type === 'rotate' || _drag.type === 'resize')) {
            var b = _drag.bone;
            // 给弹性骨骼施加冲量
            if (_drag.type === 'rotate') {
                jiggleImpulse(b, b.rotation - _drag.or);
            }
            b.sx = b.x; b.sy = b.y; b.sr = b.rotation; b.ssx = b.scaleX; b.ssy = b.scaleY;
            recordFrame();
            _revealControls();
        } else if (_drag && _drag.type === 'ik') {
            // IK结束：录制整条链的所有骨骼
            _ikActive = false;
            for (var i = 0; i < _ikChain.length; i++) {
                var b = _ikChain[i];
                b.sx = b.x; b.sy = b.y; b.sr = b.rotation; b.ssx = b.scaleX; b.ssy = b.scaleY;
                _selectedBone = b;
                recordFrame();
            }
            _selectedBone = _drag.bone;
            _ikChain = [];
            _ikTarget = null;
            _revealControls();
        }
        _drag = null;
        _canvas.style.cursor = 'default';
        updateFK(); render();
    }

    function _onWheel(e) {
        e.preventDefault();
        var d = e.deltaY > 0 ? 0.92 : 1.08, ns = Math.max(0.1, Math.min(5, _vs * d));
        var r = _canvas.getBoundingClientRect(), cx = e.clientX - r.left, cy = e.clientY - r.top;
        var w = _canvas.width / (window.devicePixelRatio || 1), h = _canvas.height / (window.devicePixelRatio || 1);
        _vx = cx - w / 2 - (cx - w / 2 - _vx) * (ns / _vs);
        _vy = cy - h / 2 - (cy - h / 2 - _vy) * (ns / _vs);
        _vs = ns; render();
    }

    function _onDbl(e) {
        // 路径绘制模式：双击结束
        if (_pathDrawMode) {
            _pathDrawMode = false;
            _canvas.style.cursor = 'default';
            var hint = _overlay.querySelector('#sa-path-hint');
            if (hint) hint.remove();
            var path = _paths[_paths.length - 1];
            if (path && path.points.length < 2) {
                // 路径点太少，移除
                _paths.pop();
            }
            render();
            return;
        }

        var w = s2w(e.clientX, e.clientY), hit = hitTest(w.x, w.y);
        if (hit) {
            var parent = hit.bone, pe = boneEnd(parent);
            var nb = addBone('bone_' + _nextId, parent);
            nb.length = 50; nb.sl = 50;
            nb.rotation = Math.atan2(w.y - pe.y, w.x - pe.x) / DEG - parent.wr;
            nb.sr = nb.rotation;
            _selectedBone = nb;
        } else if (!_rootBone) {
            var b = addBone('root');
            b.x = w.x; b.y = w.y; b.sx = w.x; b.sy = w.y;
            _selectedBone = b;
        }
        updateFK(); render(); _renderTimeline();
    }

    // 拖拽图片到骨骼上
    function _onDrop(e) {
        e.preventDefault();
        if (!_selectedBone) return;
        var files = e.dataTransfer.files;
        if (!files || !files.length) return;
        var file = files[0];
        if (!file.type.startsWith('image/')) return;
        var reader = new FileReader();
        reader.onload = function(ev) {
            var img = new Image();
            img.onload = function() {
                var att = {
                    id: _nextAttId++,
                    bone: _selectedBone,
                    image: img,
                    imageName: file.name,
                    offsetX: 0, offsetY: 0,
                    scaleX: 1, scaleY: 1,
                    width: img.naturalWidth, height: img.naturalHeight
                };
                // 自动缩放大图
                var maxDim = 120;
                if (att.width > maxDim || att.height > maxDim) {
                    var ratio = Math.min(maxDim / att.width, maxDim / att.height);
                    att.width *= ratio; att.height *= ratio;
                    att.scaleX = ratio; att.scaleY = ratio;
                }
                _attachments.push(att);
                render();
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    }

    function _onKey(e) {
        if (!_isOpen) return;
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        if (e.key === 'Shift') _shiftHeld = true;
        if ((e.key === 'Delete' || e.key === 'Backspace') && _selectedBone) {
            // 如果选中骨骼有约束，先删除约束
            var boneCons = getConstraintsFor(_selectedBone);
            if (boneCons.length > 0 && !e.shiftKey) {
                boneCons.forEach(removeConstraint);
                render(); _renderTimeline();
                return;
            }
            removeBone(_selectedBone); _selectedBone = null; render(); _renderTimeline();
        }
        if (e.key === ' ') { e.preventDefault(); togglePlay(); }
        if (e.key === 'Escape') {
            _selectedBone = null; _constraintSource = null;
            // 退出路径绘制模式
            if (_pathDrawMode) {
                _pathDrawMode = false;
                _canvas.style.cursor = 'default';
                var hint = _overlay.querySelector('#sa-path-hint');
                if (hint) hint.remove();
                if (_paths.length && _paths[_paths.length - 1].points.length < 2) _paths.pop();
            }
            render(); _renderTimeline();
        }
        if (e.key === 'o' || e.key === 'O') { _onionSkin = !_onionSkin; render(); } // 洋葱皮开关
    }

    // ===== 播放 =====
    function togglePlay() {
        if (!_curAnim && _anims.length) _curAnim = _anims[0];
        if (!_curAnim) { _curAnim = addAnim('动画 1'); }
        _playing = !_playing;
        if (_playing) { _lastFrameTime = performance.now(); resetPose(); _loop(); _revealControls(); }
        else { if (_raf) cancelAnimationFrame(_raf); resetPose(); render(); }
        _updatePlayBtn();
    }
    function _loop() {
        if (!_playing) return;
        var now = performance.now(), dt = (now - _lastFrameTime) / 1000;
        _lastFrameTime = now; _animTime += dt;
        if (_curAnim.duration > 0 && _animTime > _curAnim.duration) _animTime %= _curAnim.duration;
        if (_curAnim.duration > 0) sampleAnim(_curAnim, _animTime);
        // 弹性物理（在动画采样之后、渲染之前）
        updateJiggle(dt);
        render(); _updateCursor();
        _raf = requestAnimationFrame(_loop);
    }
    function _updatePlayBtn() {
        var b = _overlay.querySelector('#sa-play');
        if (b) b.textContent = _playing ? '⏸' : '▶';
    }
    function _updateCursor() {
        var c = _overlay.querySelector('#sa-cursor');
        if (c && _curAnim && _curAnim.duration > 0) c.style.left = (_animTime / _curAnim.duration * 100) + '%';
        var td = _overlay.querySelector('#sa-time');
        if (td) td.textContent = _animTime.toFixed(2) + 's';
    }

    // ===== 窗口 =====
    function _create() {
        if (_overlay) _overlay.remove();
        _overlay = document.createElement('div');
        _overlay.className = 'sa-overlay';
        _overlay.setAttribute('data-skill-id', 'spine-animate');
        _overlay.innerHTML = _html() + '<style>' + _css() + '</style>';
        document.body.appendChild(_overlay);
        _canvas = _overlay.querySelector('#sa-canvas');
        
        // 尝试初始化WebGL2，失败则回退到Canvas 2D
        _gl = _initWebGL(_canvas);
        if (!_gl) {
            // WebGL2 失败，回退到 Canvas 2D
            _ctx = _canvas.getContext('2d');
            console.log('SpineAnimate: using Canvas 2D renderer');
        } else {
            console.log('SpineAnimate: using WebGL2 renderer');
        }
        
        _makeDrag();
        if (typeof SkillSystem !== 'undefined' && SkillSystem.WindowHelper)
            SkillSystem.WindowHelper.makeResizable(_overlay, { minWidth: 700, minHeight: 480, storeKey: 'sa-win' });
        _restorePos();
        _bindEvents();
        _bindUI();
        requestAnimationFrame(function() {
            _resize();
            if (_userMode === 'novice') {
                var fl = _overlay.querySelector('.sa-float');
                if (fl) fl.classList.add('show');
            }
            _showGuide();
        });
        _on(window, 'resize', _resize);
        render();
        _renderTimeline();
        _isOpen = true;
    }

    function _html() {
        // 模式切换按钮（始终显示在标题栏）
        var modeBtn = '<button class="sa-mode-btn" id="sa-mode-toggle" data-tip="切换新人/专家模式">👤</button>';
        
        // 新人模式工作流引导
        var workflowGuide = '';
        if (_userMode === 'novice') {
            var steps = ['创建骨骼', '添加图片', '添加特效', '导出'];
            var stepDesc = [
                '点击 🦴 创建骨骼，双击画布也可以',
                '点击 🖼️ 按钮添加图片，拖拽到骨骼上绑定',
                '试试 🦿IK · 🌊弹性 · 🧅洋葱皮',
                '点击 ↗ 导出JSON 或 🎮 导出Godot'
            ];
            workflowGuide = '<div class="sa-workflow" id="sa-workflow">' +
                '<div class="sa-workflow-steps">';
            for (var i = 0; i < steps.length; i++) {
                var active = i === _workflowStep ? ' active' : '';
                var done = i < _workflowStep ? ' done' : '';
                workflowGuide += '<div class="sa-workflow-step' + active + done + '" data-step="' + i + '">' +
                    '<span class="sa-wf-num">' + (i < _workflowStep ? '✓' : (i + 1)) + '</span>' +
                    '<span class="sa-wf-name">' + steps[i] + '</span>' +
                    '</div>';
            }
            workflowGuide += '</div>' +
                '<div class="sa-workflow-desc">' + stepDesc[_workflowStep] + '</div>' +
                '<div class="sa-workflow-btns">' +
                    '<button class="sa-wf-btn skip" id="sa-wf-skip">跳过引导</button>' +
                    '<button class="sa-wf-btn" id="sa-wf-prev">上一步</button>' +
                    '<button class="sa-wf-btn primary" id="sa-wf-next">下一步</button>' +
                '</div>' +
                '</div>';
        }

        // 底部按钮布局：左侧播放控制 | 中间教程步骤 | 右侧扩展功能
        var bottomBtns = '';
        bottomBtns =
            // === 左侧：全局播放控制 ===
            '<button class="sa-fb" id="sa-play" data-tip="播放/暂停 (空格)">▶</button>' +
            '<button class="sa-fb" id="sa-stop" data-tip="停止回到起点">⏹</button>' +
            '<div class="sa-tl-bar" id="sa-tl-bar"><div class="sa-tl-cur" id="sa-cursor"></div></div>' +
            '<span class="sa-tl-time" id="sa-time">0.00s</span>' +
            '<div class="sa-sep"></div>' +
            // === 中间：教程步骤按钮 ===
            // 步骤1: 创建骨骼
            '<button class="sa-fb" id="sa-add-bone" data-tip="创建骨骼 (双击画布也可以)">🦴</button>' +
            // 步骤2: 添加图片
            '<button class="sa-fb" id="sa-img" data-tip="添加图片">🖼️</button>' +
            // 步骤3: 添加特效
            '<button class="sa-fb' + (_ikEnabled ? ' active' : '') + '" id="sa-ik" data-tip="IK反向动力学">🦿</button>' +
            '<button class="sa-fb" id="sa-jiggle" data-tip="弹性物理">🌊</button>' +
            '<button class="sa-fb' + (_onionSkin ? ' active' : '') + '" id="sa-onion" data-tip="洋葱皮">🧅</button>' +
            // 步骤4: 导出
            '<button class="sa-fb" id="sa-export" data-tip="导出JSON">↗</button>' +
            '<button class="sa-fb" id="sa-godot" data-tip="导出Godot">🎮</button>' +
            // === 右侧：扩展功能 ===
            '<div class="sa-sep" style="opacity:0.3"></div>' +
            '<button class="sa-fb" id="sa-path" data-tip="路径">🛤️</button>' +
            '<button class="sa-fb" id="sa-ffd" data-tip="FFD">🔲</button>' +
            '<button class="sa-fb" id="sa-clip" data-tip="裁剪">✂️</button>' +
            '<button class="sa-fb" id="sa-tl-toggle" data-tip="时间轴">☰</button>' +
            '<button class="sa-fb" id="sa-import" data-tip="导入">↙</button>' +
            '<button class="sa-fb" id="sa-clear" data-tip="清空">🗑️</button>';

        return '' +
        '<div class="sa-hd">' +
            '<span class="sa-title">🦴</span>' +
            modeBtn +
            '<button class="sa-x" id="sa-close">✕</button>' +
        '</div>' +
        workflowGuide +
        '<div class="sa-canvas-wrap"><canvas id="sa-canvas"></canvas><div id="sa-guide-container"></div></div>' +
        // 浮动控制条
        '<div class="sa-float" id="sa-float">' +
            '<div class="sa-float-inner">' + bottomBtns + '</div>' +
            // 展开的时间轴面板
            '<div class="sa-tl-panel" id="sa-tl-panel">' +
                '<div class="sa-tl-header">' +
                    '<select id="sa-anim-sel" class="sa-anim-sel"></select>' +
                    '<button class="sa-fb-sm" id="sa-new-anim" title="新建动画">+</button>' +
                    '<span class="sa-tl-hint">单击跳转 · 双击编辑缓动 · 右键删除</span>' +
                '</div>' +
                '<div class="sa-tl-tracks" id="sa-tl-tracks"></div>' +
                '<div class="sa-ik-panel" id="sa-ik-panel" style="display:none;">' +
                    '<div class="sa-ik-row"><span class="sa-ik-label">角度约束</span><input type="range" id="sa-ik-min" min="-180" max="0" value="-180" class="sa-ik-range"><span class="sa-ik-val" id="sa-ik-min-val">-180°</span></div>' +
                    '<div class="sa-ik-row"><span class="sa-ik-label"></span><input type="range" id="sa-ik-max" min="0" max="180" value="180" class="sa-ik-range"><span class="sa-ik-val" id="sa-ik-max-val">180°</span></div>' +
                '</div>' +
                '<div class="sa-con-panel" id="sa-con-panel" style="display:none;"><div class="sa-con-header">变换约束</div><div id="sa-con-list"></div></div>' +
                '<div class="sa-jiggle-panel" id="sa-jiggle-panel" style="display:none;">' +
                    '<div class="sa-jiggle-row"><span class="sa-ik-label">弹性</span><input type="range" id="sa-jiggle-k" min="20" max="500" value="180" class="sa-ik-range"><span class="sa-ik-val" id="sa-jiggle-k-val">180</span></div>' +
                    '<div class="sa-jiggle-row"><span class="sa-ik-label">阻尼</span><input type="range" id="sa-jiggle-d" min="1" max="40" value="12" class="sa-ik-range"><span class="sa-ik-val" id="sa-jiggle-d-val">12</span></div>' +
                '</div>' +
                '<div class="sa-curve-panel" id="sa-curve-panel" style="display:none;">' +
                    '<div class="sa-curve-header"><span class="sa-curve-title">缓动曲线</span><button class="sa-curve-close" id="sa-curve-close">✕</button></div>' +
                    '<canvas id="sa-curve-canvas" width="160" height="100"></canvas><div class="sa-curve-presets" id="sa-curve-presets"></div>' +
                '</div>' +
            '</div>' +
        '</div>';
    }

    function _css() {
        return '' +
        '.sa-overlay{position:fixed;width:960px;height:680px;z-index:9999;display:flex;flex-direction:column;' +
            'background:rgba(6,10,20,0.98);color:#e8edf5;font-family:system-ui,-apple-system,sans-serif;border-radius:20px;' +
            'box-shadow:0 12px 60px rgba(0,0,0,.6),0 0 0 1px rgba(100,160,255,0.08);overflow:hidden;user-select:none;}' +
        '.sa-hd{position:absolute;top:0;left:0;right:0;z-index:10;display:flex;align-items:center;justify-content:space-between;' +
            'padding:8px 14px;cursor:grab;}' +
        '.sa-title{font-size:16px;opacity:0.15;pointer-events:none;}' +
        '.sa-x{pointer-events:auto;width:24px;height:24px;border:none;border-radius:50%;' +
            'background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.3);font-size:11px;cursor:pointer;' +
            'transition:all 0.2s;display:flex;align-items:center;justify-content:center;}' +
        '.sa-x:hover{background:rgba(255,255,255,0.12);color:rgba(255,255,255,0.6);}' +
        '.sa-canvas-wrap{flex:1;position:relative;overflow:hidden;cursor:default;}' +
        '.sa-canvas-wrap canvas{display:block;width:100%;height:100%;}' +

        // 模式切换按钮
        '.sa-mode-btn{position:absolute;top:8px;right:40px;width:28px;height:28px;border:none;border-radius:50%;' +
            'background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);font-size:14px;cursor:pointer;' +
            'transition:all 0.2s;display:flex;align-items:center;justify-content:center;z-index:11;}' +
        '.sa-mode-btn:hover{background:rgba(56,189,248,0.2);color:#38bdf8;}' +

        // 工作流引导
        '.sa-workflow{position:absolute;top:44px;left:16px;right:16px;z-index:15;' +
            'background:rgba(15,20,35,0.92);border-radius:12px;' +
            'border:1px solid rgba(100,160,255,0.1);padding:12px 16px;box-shadow:0 4px 20px rgba(0,0,0,.4);}' +
        '.sa-workflow-steps{display:flex;gap:8px;margin-bottom:10px;}' +
        '.sa-workflow-step{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;' +
            'padding:8px 4px;border-radius:8px;background:rgba(255,255,255,0.03);' +
            'border:1px solid transparent;transition:all 0.2s;cursor:pointer;}' +
        '.sa-workflow-step.active{background:rgba(56,189,248,0.15);border-color:rgba(56,189,248,0.3);}' +
        '.sa-workflow-step.done{background:rgba(34,197,94,0.1);border-color:rgba(34,197,94,0.2);}' +
        '.sa-workflow-step.done .sa-wf-num{background:rgba(34,197,94,0.3);color:#22c55e;}' +
        '.sa-wf-num{width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,0.08);' +
            'color:rgba(255,255,255,0.5);font-size:11px;display:flex;align-items:center;justify-content:center;}' +
        '.sa-workflow-step.active .sa-wf-num{background:rgba(56,189,248,0.3);color:#38bdf8;}' +
        '.sa-wf-name{font-size:10px;color:rgba(255,255,255,0.4);}' +
        '.sa-workflow-step.active .sa-wf-name{color:#38bdf8;}' +
        '.sa-workflow-desc{font-size:12px;color:rgba(255,255,255,0.6);text-align:center;margin-bottom:10px;}' +
        '.sa-workflow-btns{display:flex;justify-content:center;gap:10px;}' +
        '.sa-wf-btn{padding:6px 16px;border:none;border-radius:8px;font-size:12px;cursor:pointer;' +
            'background:rgba(255,255,255,0.08);color:rgba(255,255,255,0.6);transition:all 0.2s;}' +
        '.sa-wf-btn:hover{background:rgba(255,255,255,0.12);color:#fff;}' +
        '.sa-wf-btn.primary{background:rgba(56,189,248,0.2);color:#38bdf8;}' +
        '.sa-wf-btn.primary:hover{background:rgba(56,189,248,0.3);}' +
        '.sa-hint-text{font-size:12px;color:rgba(255,255,255,0.5);padding:0 10px;}' +
        '.sa-fb.primary{background:rgba(56,189,248,0.2);color:#38bdf8;}' +
        '.sa-fb.primary:hover{background:rgba(56,189,248,0.3);}' +

        // 引导气泡
        '.sa-guide-bubble{position:absolute;z-index:100;padding:14px 18px;max-width:280px;' +
            'background:rgba(20,30,50,0.96);border:1px solid rgba(56,189,248,0.3);border-radius:12px;' +
            'color:#e8edf5;font-size:13px;line-height:1.6;box-shadow:0 8px 32px rgba(0,0,0,.6);' +
            'pointer-events:auto;animation:sa-guide-in 0.3s ease;}' +
        '.sa-guide-bubble::before{content:"";position:absolute;width:12px;height:12px;' +
            'background:rgba(20,30,50,0.96);border-left:1px solid rgba(56,189,248,0.3);' +
            'border-bottom:1px solid rgba(56,189,248,0.3);transform:rotate(-45deg);}' +
        '.sa-guide-bubble.arrow-top::before{top:-7px;left:50%;margin-left:-6px;transform:rotate(135deg);}' +
        '.sa-guide-bubble.arrow-bottom::before{bottom:-7px;left:50%;margin-left:-6px;transform:rotate(-45deg);}' +
        '.sa-guide-bubble.arrow-left::before{left:-7px;top:50%;margin-top:-6px;transform:rotate(-135deg);}' +
        '.sa-guide-bubble .sa-guide-title{font-size:14px;font-weight:600;color:#38bdf8;margin-bottom:6px;}' +
        '.sa-guide-bubble .sa-guide-action{margin-top:10px;display:flex;gap:8px;}' +
        '.sa-guide-bubble .sa-guide-btn{padding:5px 14px;border:none;border-radius:6px;font-size:12px;cursor:pointer;' +
            'background:rgba(56,189,248,0.2);color:#38bdf8;transition:all 0.15s;}' +
        '.sa-guide-bubble .sa-guide-btn:hover{background:rgba(56,189,248,0.35);}' +
        '.sa-guide-bubble .sa-guide-btn.skip{background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.4);}' +
        '.sa-guide-bubble .sa-guide-btn.skip:hover{color:rgba(255,255,255,0.7);}' +
        '.sa-guide-bubble .sa-guide-check{color:#22c55e;font-weight:600;}' +
        '.sa-guide-highlight{position:absolute;z-index:99;border:2px solid rgba(56,189,248,0.5);' +
            'border-radius:8px;pointer-events:none;animation:sa-guide-pulse 1.5s infinite;}' +
        '@keyframes sa-guide-in{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);}}' +
        '@keyframes sa-guide-pulse{0%,100%{border-color:rgba(56,189,248,0.3);}50%{border-color:rgba(56,189,248,0.7);}}' +

        // 浮动控制条
        '.sa-float{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);z-index:20;' +
            'opacity:0;transition:opacity 0.4s ease;pointer-events:none;width:calc(100% - 32px);max-width:720px;}' +
        '.sa-float.show{opacity:1;pointer-events:auto;}' +
        '.sa-float-inner{display:flex;align-items:center;gap:6px;padding:6px 14px;' +
            'background:rgba(15,20,35,0.88);border-radius:16px;' +
            'border:1px solid rgba(100,160,255,0.08);box-shadow:0 4px 20px rgba(0,0,0,.4);pointer-events:auto;}' +
        '.sa-fb{width:28px;height:28px;border:none;border-radius:50%;' +
            'background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);font-size:12px;cursor:pointer;' +
            'transition:all 0.15s;display:flex;align-items:center;justify-content:center;flex-shrink:0;}' +
        '.sa-fb:hover{background:rgba(56,189,248,0.2);color:#38bdf8;}' +
        '.sa-fb:active{transform:scale(0.88);}' +
        // 自定义 tooltip
        '.sa-fb[data-tip]{position:relative;}' +
        '.sa-fb[data-tip]:hover::after{content:attr(data-tip);position:absolute;bottom:calc(100% + 8px);left:50%;' +
            'transform:translateX(-50%);white-space:nowrap;padding:5px 10px;border-radius:6px;font-size:11px;line-height:1.4;' +
            'background:rgba(15,23,42,0.95);color:#e2e8f0;border:1px solid rgba(100,160,255,0.12);' +
            'box-shadow:0 4px 12px rgba(0,0,0,0.4);pointer-events:none;z-index:100;' +
            'animation:sa-tip-in 0.15s ease;}' +
        '.sa-fb[data-tip]:hover::before{content:"";position:absolute;bottom:calc(100% + 2px);left:50%;' +
            'transform:translateX(-50%);border:5px solid transparent;border-top-color:rgba(15,23,42,0.95);z-index:100;}' +
        '@keyframes sa-tip-in{from{opacity:0;transform:translateX(-50%) translateY(4px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}' +
        '.sa-fb.active{background:rgba(56,189,248,0.2);color:#38bdf8;}' +
        '.sa-fb-sm{width:22px;height:22px;border:none;border-radius:50%;' +
            'background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.4);font-size:13px;cursor:pointer;' +
            'transition:all 0.15s;display:flex;align-items:center;justify-content:center;flex-shrink:0;}' +
        '.sa-fb-sm:hover{background:rgba(56,189,248,0.2);color:#38bdf8;}' +

        // 时间轴条
        '.sa-tl-bar{width:100px;height:3px;background:rgba(255,255,255,0.08);border-radius:2px;' +
            'position:relative;cursor:pointer;flex-shrink:0;}' +
        '.sa-tl-cur{position:absolute;top:-2px;width:3px;height:7px;background:#fbbf24;border-radius:2px;' +
            'z-index:5;transition:left 0.05s;box-shadow:0 0 6px rgba(251,191,36,0.4);}' +
        '.sa-tl-time{font-size:10px;color:rgba(255,255,255,0.3);min-width:36px;text-align:center;flex-shrink:0;}' +
        '.sa-sep{width:1px;height:16px;background:rgba(255,255,255,0.08);flex-shrink:0;}' +

        // 展开的时间轴面板
        '.sa-tl-panel{max-height:0;overflow:hidden;transition:max-height 0.3s ease,opacity 0.3s ease;opacity:0;' +
            'border-radius:0 0 12px 12px;pointer-events:none;}' +
        '.sa-tl-panel.open{max-height:480px;opacity:1;pointer-events:auto;margin-top:6px;}' +
        '.sa-tl-header{display:flex;align-items:center;gap:6px;padding:4px 10px;border-bottom:1px solid rgba(100,160,255,0.06);}' +
        '.sa-anim-sel{padding:2px 6px;background:rgba(0,10,30,0.4);border:1px solid rgba(100,160,255,0.12);' +
            'border-radius:4px;color:#e8edf5;font-size:10px;outline:none;flex-shrink:0;}' +
        '.sa-tl-hint{font-size:9px;color:rgba(148,163,184,0.3);margin-left:auto;}' +
        '.sa-tl-tracks{overflow-y:auto;max-height:200px;padding:2px 0;}' +

        // 时间轴行
        '.sa-row{display:flex;align-items:center;height:22px;cursor:pointer;transition:background 0.1s;}' +
        '.sa-row:hover{background:rgba(100,160,255,0.04);}' +
        '.sa-row.sel{background:rgba(251,191,36,0.06);}' +
        '.sa-row-name{width:60px;font-size:10px;text-align:right;padding-right:8px;flex-shrink:0;' +
            'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:0.7;}' +
        '.sa-row-track{flex:1;height:100%;position:relative;border-bottom:1px solid rgba(255,255,255,0.02);}' +

        // 关键帧菱形
        '.sa-kf{position:absolute;top:50%;width:7px;height:7px;background:#38bdf8;border-radius:1px;' +
            'transform:translate(-50%,-50%) rotate(45deg);cursor:pointer;transition:all 0.1s;z-index:2;' +
            'box-shadow:0 0 4px rgba(56,189,248,0.3);}' +
        '.sa-kf:hover{background:#7dd3fc;transform:translate(-50%,-50%) rotate(45deg) scale(1.4);' +
            'box-shadow:0 0 8px rgba(56,189,248,0.5);}' +

        // IK约束面板
        '.sa-ik-panel{padding:6px 10px;border-top:1px solid rgba(100,160,255,0.06);}' +
        '.sa-ik-row{display:flex;align-items:center;gap:6px;height:20px;}' +
        '.sa-ik-label{font-size:9px;color:rgba(148,163,184,0.4);width:48px;text-align:right;flex-shrink:0;}' +
        '.sa-ik-range{flex:1;height:2px;-webkit-appearance:none;appearance:none;background:rgba(255,255,255,0.08);' +
            'border-radius:1px;outline:none;cursor:pointer;}' +
        '.sa-ik-range::-webkit-slider-thumb{-webkit-appearance:none;width:10px;height:10px;border-radius:50%;' +
            'background:#fbbf24;cursor:pointer;box-shadow:0 0 4px rgba(251,191,36,0.3);}' +
        '.sa-ik-val{font-size:9px;color:rgba(251,191,36,0.6);min-width:32px;text-align:center;}' +

        // 弹性参数面板
        '.sa-jiggle-panel{padding:6px 10px;border-top:1px solid rgba(100,160,255,0.06);}' +
        '.sa-jiggle-row{display:flex;align-items:center;gap:6px;height:20px;}' +

        // 约束面板
        '.sa-con-panel{padding:4px 10px;border-top:1px solid rgba(100,160,255,0.06);}' +
        '.sa-con-header{font-size:9px;color:rgba(148,163,184,0.3);margin-bottom:2px;}' +
        '.sa-con-item{display:flex;align-items:center;gap:4px;height:22px;}' +
        '.sa-con-type{font-size:8px;padding:1px 4px;border-radius:3px;font-weight:bold;flex-shrink:0;min-width:16px;text-align:center;}' +
        '.sa-con-type.rotation{background:rgba(168,85,247,0.2);color:#a855f7;}' +
        '.sa-con-type.position{background:rgba(34,197,94,0.2);color:#22c55e;}' +
        '.sa-con-type.scale{background:rgba(251,146,60,0.2);color:#fb923c;}' +
        '.sa-con-info{font-size:9px;color:rgba(232,237,245,0.4);flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
        '.sa-con-mix{width:50px;height:2px;-webkit-appearance:none;appearance:none;background:rgba(255,255,255,0.08);' +
            'border-radius:1px;outline:none;cursor:pointer;flex-shrink:0;}' +
        '.sa-con-mix::-webkit-slider-thumb{-webkit-appearance:none;width:8px;height:8px;border-radius:50%;' +
            'background:#a855f7;cursor:pointer;}' +
        '.sa-con-del{width:14px;height:14px;border:none;border-radius:50%;' +
            'background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.2);font-size:8px;cursor:pointer;' +
            'display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all 0.1s;}' +
        '.sa-con-del:hover{background:rgba(239,68,68,0.2);color:#ef4444;}' +

        // 贝塞尔曲线编辑器
        '.sa-curve-panel{padding:6px 10px;border-top:1px solid rgba(100,160,255,0.06);}' +
        '.sa-curve-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;}' +
        '.sa-curve-title{font-size:9px;color:rgba(148,163,184,0.4);}' +
        '.sa-curve-close{width:14px;height:14px;border:none;border-radius:50%;' +
            'background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.2);font-size:8px;cursor:pointer;' +
            'display:flex;align-items:center;justify-content:center;}' +
        '.sa-curve-close:hover{background:rgba(255,255,255,0.1);color:rgba(255,255,255,0.5);}' +
        '#sa-curve-canvas{display:block;width:160px;height:100px;border-radius:6px;' +
            'background:rgba(0,10,30,0.3);border:1px solid rgba(100,160,255,0.06);cursor:crosshair;margin:0 auto;}' +
        '.sa-curve-presets{display:flex;gap:3px;margin-top:4px;flex-wrap:wrap;justify-content:center;}' +
        '.sa-curve-pre{padding:2px 6px;border:none;border-radius:4px;font-size:8px;cursor:pointer;' +
            'background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.35);transition:all 0.1s;}' +
        '.sa-curve-pre:hover{background:rgba(56,189,248,0.15);color:#38bdf8;}' +
        '.sa-curve-pre.active{background:rgba(56,189,248,0.2);color:#38bdf8;}' +

        '.sa-overlay ::-webkit-scrollbar{width:3px;}.sa-overlay ::-webkit-scrollbar-track{background:transparent;}' +
        '.sa-overlay ::-webkit-scrollbar-thumb{background:rgba(100,160,255,0.1);border-radius:4px;}' +

        // Toast 通知
        '.sa-toast{position:absolute;top:52px;left:50%;transform:translateX(-50%);z-index:200;' +
            'padding:8px 18px;border-radius:8px;font-size:12px;color:#e8edf5;pointer-events:none;' +
            'animation:sa-toast-in 0.25s ease,sa-toast-out 0.3s ease 1.8s forwards;white-space:nowrap;}' +
        '.sa-toast.info{background:rgba(56,189,248,0.2);border:1px solid rgba(56,189,248,0.3);}' +
        '.sa-toast.warn{background:rgba(251,191,36,0.2);border:1px solid rgba(251,191,36,0.3);}' +
        '.sa-toast.error{background:rgba(239,68,68,0.2);border:1px solid rgba(239,68,68,0.3);}' +
        '@keyframes sa-toast-in{from{opacity:0;transform:translateX(-50%) translateY(-8px);}to{opacity:1;transform:translateX(-50%) translateY(0);}}' +
        '@keyframes sa-toast-out{from{opacity:1;}to{opacity:0;}}' +

        // 自定义对话框
        '.sa-dialog-mask{position:absolute;inset:0;z-index:300;background:rgba(0,0,0,0.5);' +
            'display:flex;align-items:center;justify-content:center;animation:sa-dialog-fade 0.2s ease;}' +
        '.sa-dialog{background:rgba(15,20,35,0.98);border:1px solid rgba(100,160,255,0.15);border-radius:14px;' +
            'padding:20px 24px;min-width:280px;max-width:360px;box-shadow:0 12px 40px rgba(0,0,0,.6);}' +
        '.sa-dialog-title{font-size:14px;font-weight:600;color:#e8edf5;margin-bottom:8px;}' +
        '.sa-dialog-msg{font-size:12px;color:rgba(255,255,255,0.6);margin-bottom:16px;line-height:1.5;}' +
        '.sa-dialog-input{width:100%;padding:7px 10px;background:rgba(0,10,30,0.5);border:1px solid rgba(100,160,255,0.2);' +
            'border-radius:8px;color:#e8edf5;font-size:13px;outline:none;margin-bottom:14px;box-sizing:border-box;}' +
        '.sa-dialog-input:focus{border-color:rgba(56,189,248,0.5);}' +
        '.sa-dialog-btns{display:flex;justify-content:flex-end;gap:8px;}' +
        '.sa-dialog-btn{padding:6px 16px;border:none;border-radius:8px;font-size:12px;cursor:pointer;transition:all 0.15s;}' +
        '.sa-dialog-btn.cancel{background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);}' +
        '.sa-dialog-btn.cancel:hover{background:rgba(255,255,255,0.1);color:#fff;}' +
        '.sa-dialog-btn.ok{background:rgba(56,189,248,0.2);color:#38bdf8;}' +
        '.sa-dialog-btn.ok:hover{background:rgba(56,189,248,0.35);}' +
        '.sa-dialog-btn.danger{background:rgba(239,68,68,0.2);color:#ef4444;}' +
        '.sa-dialog-btn.danger:hover{background:rgba(239,68,68,0.35);}' +
        '@keyframes sa-dialog-fade{from{opacity:0;}to{opacity:1;}}';
    }

    // ===== Toast / Dialog 系统（替代 alert/confirm/prompt）=====
    function _toast(msg, type) {
        if (!_overlay) return;
        var el = document.createElement('div');
        el.className = 'sa-toast ' + (type || 'info');
        el.textContent = msg;
        _overlay.appendChild(el);
        setTimeout(function() { if (el.parentNode) el.remove(); }, 2200);
    }

    function _confirm(msg, onOk, opts) {
        if (!_overlay) return;
        var mask = document.createElement('div');
        mask.className = 'sa-dialog-mask';
        var isDanger = opts && opts.danger;
        mask.innerHTML = '<div class="sa-dialog">' +
            '<div class="sa-dialog-title">' + (opts && opts.title || '确认操作') + '</div>' +
            '<div class="sa-dialog-msg">' + msg + '</div>' +
            '<div class="sa-dialog-btns">' +
                '<button class="sa-dialog-btn cancel">取消</button>' +
                '<button class="sa-dialog-btn ' + (isDanger ? 'danger' : 'ok') + '">' + (isDanger ? '确定清空' : '确定') + '</button>' +
            '</div></div>';
        _overlay.appendChild(mask);
        mask.querySelector('.cancel').onclick = function() { mask.remove(); };
        mask.querySelector(isDanger ? '.danger' : '.ok').onclick = function() { mask.remove(); if (onOk) onOk(); };
    }

    function _prompt(title, defaultVal, onOk) {
        if (!_overlay) return new Promise(function() {});
        return new Promise(function(resolve) {
            var mask = document.createElement('div');
            mask.className = 'sa-dialog-mask';
            mask.innerHTML = '<div class="sa-dialog">' +
                '<div class="sa-dialog-title">' + title + '</div>' +
                '<input class="sa-dialog-input" type="text" value="' + (defaultVal || '') + '">' +
                '<div class="sa-dialog-btns">' +
                    '<button class="sa-dialog-btn cancel">取消</button>' +
                    '<button class="sa-dialog-btn ok">确定</button>' +
                '</div></div>';
            _overlay.appendChild(mask);
            var input = mask.querySelector('.sa-dialog-input');
            input.focus();
            input.select();
            mask.querySelector('.cancel').onclick = function() { mask.remove(); resolve(null); };
            mask.querySelector('.ok').onclick = function() {
                var val = input.value.trim();
                mask.remove();
                resolve(val || null);
                if (onOk) onOk(val);
            };
            input.onkeydown = function(e) {
                if (e.key === 'Enter') mask.querySelector('.ok').click();
                if (e.key === 'Escape') mask.querySelector('.cancel').click();
            };
        });
    }

    // ===== 引导系统 =====
    var _guideData = [
        { title: '第1步：创建骨骼', text: '点击 <strong>🦴</strong> 按钮创建根骨骼，\n再次点击添加子骨骼。\n也可以<strong>双击画布</strong>快速创建。\n\n💡 拖拽骨骼末端可调整长度，\n右键骨骼可删除。', arrow: 'bottom', check: function() { return _bones.length >= 2; } },
        { title: '第2步：添加图片', text: '点击底部 <strong>🖼️</strong> 按钮选择图片，\n然后<strong>拖拽图片</strong>到骨骼上完成绑定。\n图片会跟随骨骼移动。', arrow: 'top', check: function() { return _attachments.length > 0; } },
        { title: '第3步：添加特效', text: '试试底部这些特效按钮：\n<strong>🦿 IK</strong> — 拖拽末端自动解算\n<strong>🌊 弹性</strong> — 骨骼弹性物理\n<strong>🧅 洋葱皮</strong> — 查看前后帧', arrow: 'top', check: function() { return _ikEnabled || _bones.some(function(b) { return b.jiggle; }) || _onionSkin; } },
        { title: '第4步：导出', text: '动画完成！选择导出格式：\n<strong>↗ 导出JSON</strong> — 通用格式\n<strong>🎮 导出Godot</strong> — Godot引擎', arrow: 'top', check: function() { return true; } }
    ];

    function _showGuide() {
        if (_userMode !== 'novice') return;
        var container = _overlay.querySelector('#sa-guide-container');
        if (!container) return;
        
        // 清除旧引导
        container.innerHTML = '';
        
        var step = _guideData[_workflowStep];
        if (!step) return;
        
        // 检查当前步骤是否已完成
        var completed = step.check();
        
        var bubble = document.createElement('div');
        bubble.className = 'sa-guide-bubble arrow-' + (step.arrow || 'bottom');
        
        // 根据步骤定位气泡
        var wrapRect = _overlay.querySelector('.sa-canvas-wrap').getBoundingClientRect();
        var overlayRect = _overlay.getBoundingClientRect();
        var relX = wrapRect.left - overlayRect.left;
        var relY = wrapRect.top - overlayRect.top;
        
        if (_workflowStep === 0) {
            // 画布中央偏上
            bubble.style.left = (relX + wrapRect.width / 2 - 140) + 'px';
            bubble.style.top = (relY + wrapRect.height / 2 - 80) + 'px';
        } else if (_workflowStep <= 2) {
            // 画布中央
            bubble.style.left = (relX + wrapRect.width / 2 - 140) + 'px';
            bubble.style.top = (relY + wrapRect.height / 2 - 60) + 'px';
        } else {
            // 画布中央
            bubble.style.left = (relX + wrapRect.width / 2 - 140) + 'px';
            bubble.style.top = (relY + wrapRect.height / 2 - 60) + 'px';
        }
        
        bubble.innerHTML = '<div class="sa-guide-title">' + step.title + '</div>' +
            '<div>' + step.text.replace(/\n/g, '<br>') + '</div>' +
            '<div class="sa-guide-action">' +
                (completed
                    ? '<span class="sa-guide-check">✓ 已完成</span>'
                    : '') +
                '<button class="sa-guide-btn" id="sa-guide-ok">' + (completed ? '下一步' : '知道了') + '</button>' +
                '<button class="sa-guide-btn skip" id="sa-guide-skip2">跳过引导</button>' +
            '</div>';
        
        container.appendChild(bubble);
        
        // 绑定按钮事件
        _on(bubble.querySelector('#sa-guide-ok'), 'click', function() {
            if (completed && _workflowStep < 3) {
                _workflowStep++;
                _refreshUI();
            } else {
                container.innerHTML = '';
            }
        });
        _on(bubble.querySelector('#sa-guide-skip2'), 'click', function() {
            _userMode = 'expert';
            container.innerHTML = '';
            _refreshUI();
        });
    }

    function _checkGuideComplete() {
        if (_userMode !== 'novice') return;
        var step = _guideData[_workflowStep];
        if (step && step.check()) {
            // 自动刷新引导气泡显示完成状态
            _showGuide();
        }
    }

    function _bindUI() {
        _on(_overlay.querySelector('#sa-close'), 'click', close);

        // 模式切换按钮
        var modeBtn = _overlay.querySelector('#sa-mode-toggle');
        if (modeBtn) {
            _on(modeBtn, 'click', function() {
                _userMode = _userMode === 'novice' ? 'expert' : 'novice';
                _workflowStep = 0;
                // 重新渲染UI
                _overlay.innerHTML = _html() + '<style>' + _css() + '</style>';
                _canvas = _overlay.querySelector('#sa-canvas');
                _gl = _initWebGL(_canvas);
                if (!_gl) _ctx = _canvas.getContext('2d');
                _bindEvents();
                _bindUI();
                _makeDrag();
                requestAnimationFrame(function() { _resize(); });
                render();
            });
        }

        // 工作流按钮
        var wfPrev = _overlay.querySelector('#sa-wf-prev');
        var wfNext = _overlay.querySelector('#sa-wf-next');
        var wfSkip = _overlay.querySelector('#sa-wf-skip');
        if (wfPrev) {
            _on(wfPrev, 'click', function() {
                if (_workflowStep > 0) { _workflowStep--; _refreshUI(); }
            });
        }
        if (wfNext) {
            _on(wfNext, 'click', function() {
                if (_workflowStep < 3) { _workflowStep++; _refreshUI(); }
            });
        }
        if (wfSkip) {
            _on(wfSkip, 'click', function() {
                _userMode = 'expert';
                _refreshUI();
            });
        }

        // 工作流步骤点击
        var wfSteps = _overlay.querySelectorAll('.sa-workflow-step');
        wfSteps.forEach(function(step, idx) {
            _on(step, 'click', function() {
                _workflowStep = idx;
                _refreshUI();
            });
        });
        _on(_overlay.querySelector('#sa-play'), 'click', togglePlay);
        _on(_overlay.querySelector('#sa-stop'), 'click', function() {
            _playing = false; if (_raf) cancelAnimationFrame(_raf);
            _animTime = 0; resetPose(); render(); _updatePlayBtn(); _updateCursor();
        });
        _on(_overlay.querySelector('#sa-export'), 'click', exportJSON);
        _on(_overlay.querySelector('#sa-godot'), 'click', exportGodot);
        _on(_overlay.querySelector('#sa-import'), 'click', importJSON);
        // 创建骨骼按钮
        _on(_overlay.querySelector('#sa-add-bone'), 'click', function() {
            if (!_rootBone) {
                var b = addBone('root');
                b.x = 0; b.y = 0; b.sx = 0; b.sy = 0;
                b.length = 60; b.sl = 60;
                _selectedBone = b;
                updateFK(); render();
                _toast('根骨骼已创建，再点击可添加子骨骼', 'info');
            } else if (_selectedBone) {
                var nb = addBone('bone_' + _nextId, _selectedBone);
                nb.length = 50; nb.sl = 50;
                nb.rotation = 0; nb.sr = 0;
                _selectedBone = nb;
                updateFK(); render();
            } else {
                _toast('请先选中一个骨骼', 'warn');
            }
        });

        // 清空按钮
        _on(_overlay.querySelector('#sa-clear'), 'click', function() {
            if (!_bones.length) return;
            _confirm('确定要清空所有骨骼和数据吗？此操作不可撤销。', function() {
                _bones = []; _anims = []; _attachments = []; _constraints = [];
                _paths = []; _pathConstraints = []; _ffdMeshes = []; _clips = [];
                _selectedBone = null; _rootBone = null; _curAnim = null;
                _nextId = 1; _nextAttId = 1; _nextPathId = 1; _nextPCId = 1; _nextFFDId = 1; _nextClipId = 1;
                resetPose(); render(); _renderTimeline();
            }, { danger: true });
        });
        // 添加图片按钮
        _on(_overlay.querySelector('#sa-img'), 'click', function() {
            if (!_selectedBone) { _toast('请先选中一个骨骼，再添加图片', 'warn'); return; }
            var input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = function(e) {
                var file = e.target.files[0];
                if (!file) return;
                var reader = new FileReader();
                reader.onload = function(ev) {
                    var img = new Image();
                    img.onload = function() {
                        var att = {
                            id: _nextAttId++,
                            bone: _selectedBone,
                            image: img,
                            imageName: file.name,
                            offsetX: 0, offsetY: 0,
                            scaleX: 1, scaleY: 1,
                            width: img.naturalWidth, height: img.naturalHeight
                        };
                        var maxDim = 120;
                        if (att.width > maxDim || att.height > maxDim) {
                            var ratio = Math.min(maxDim / att.width, maxDim / att.height);
                            att.width *= ratio; att.height *= ratio;
                            att.scaleX = att.scaleY = ratio;
                        }
                        _attachments.push(att);
                        render();
                    };
                    img.src = ev.target.result;
                };
                reader.readAsDataURL(file);
            };
            input.click();
        });
        _on(_overlay.querySelector('#sa-tl-bar'), 'click', function(e) {
            if (!_curAnim || _curAnim.duration <= 0) return;
            var r = e.currentTarget.getBoundingClientRect();
            _animTime = ((e.clientX - r.left) / r.width) * _curAnim.duration;
            if (!_playing) { sampleAnim(_curAnim, _animTime); render(); }
            _updateCursor();
        });
        // 洋葱皮开关
        _on(_overlay.querySelector('#sa-onion'), 'click', function() {
            _onionSkin = !_onionSkin;
            this.classList.toggle('active', _onionSkin);
            render();
        });
        // IK开关
        _on(_overlay.querySelector('#sa-ik'), 'click', function() {
            _ikEnabled = !_ikEnabled;
            this.classList.toggle('active', _ikEnabled);
        });
        // 弹性物理开关
        _on(_overlay.querySelector('#sa-jiggle'), 'click', function() {
            if (!_selectedBone) return;
            _selectedBone.jiggle = !_selectedBone.jiggle;
            this.classList.toggle('active', _selectedBone.jiggle);
            _selectedBone.jiggleOffset = 0;
            _selectedBone.jiggleVel = 0;
            render();
            _updateJigglePanel();
        });
        // 弹性参数滑块
        _on(_overlay.querySelector('#sa-jiggle-k'), 'input', function() {
            if (!_selectedBone) return;
            _selectedBone.jiggleK = parseInt(this.value);
            _overlay.querySelector('#sa-jiggle-k-val').textContent = this.value;
        });
        _on(_overlay.querySelector('#sa-jiggle-d'), 'input', function() {
            if (!_selectedBone) return;
            _selectedBone.jiggleD = parseInt(this.value);
            _overlay.querySelector('#sa-jiggle-d-val').textContent = this.value;
        });
        // v7: 路径约束按钮
        _on(_overlay.querySelector('#sa-path'), 'click', function() {
            if (!_selectedBone) return;
            if (!_paths.length) {
                _pathDrawMode = true;
                _paths.push({ id: _nextPathId++, name: '路径 ' + _nextPathId, points: [], closed: false });
                this.classList.add('active');
                _canvas.style.cursor = 'crosshair';
                if (_overlay.querySelector('#sa-path-hint')) _overlay.querySelector('#sa-path-hint').remove();
                var hint = document.createElement('div');
                hint.id = 'sa-path-hint';
                hint.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);' +
                    'background:rgba(34,197,94,0.15);color:#22c55e;padding:8px 16px;border-radius:8px;font-size:12px;' +
                    'pointer-events:none;z-index:30;backdrop-filter:blur(10px);border:1px solid rgba(34,197,94,0.2);';
                hint.textContent = '点击画布添加路径点 · 双击结束 · Esc取消';
                _overlay.appendChild(hint);
            } else {
                var path = _paths[0];
                var existing = _pathConstraints.find(function(pc) { return pc.bone === _selectedBone; });
                if (existing) {
                    removePathConstraint(existing);
                    this.classList.remove('active');
                } else {
                    addPathConstraint(_selectedBone, path);
                    this.classList.add('active');
                }
                render();
            }
        });
        // v8: FFD按钮
        _on(_overlay.querySelector('#sa-ffd'), 'click', function() {
            if (!_selectedBone) return;
            var existing = _ffdMeshes.find(function(m) { return m.bone === _selectedBone; });
            if (existing) {
                removeFFD(existing);
                this.classList.remove('active');
            } else {
                addFFD(_selectedBone, 3, 3, _selectedBone.length * 1.5, _selectedBone.length * 1.5);
                this.classList.add('active');
            }
            render();
        });
        // v9: 裁剪遮罩按钮
        _on(_overlay.querySelector('#sa-clip'), 'click', function() {
            if (!_selectedBone) return;
            var existing = _clips.find(function(cl) { return cl.bone === _selectedBone; });
            if (existing) {
                removeClip(existing);
                this.classList.remove('active');
            } else {
                addClip(_selectedBone, 'ellipse', { width: _selectedBone.length * 1.2, height: _selectedBone.length * 1.2 });
                this.classList.add('active');
            }
            render();
        });
        // 时间轴展开/收起
        _on(_overlay.querySelector('#sa-tl-toggle'), 'click', function() {
            _timelineOpen = !_timelineOpen;
            var panel = _overlay.querySelector('#sa-tl-panel');
            panel.classList.toggle('open', _timelineOpen);
            this.classList.toggle('active', _timelineOpen);
            if (_timelineOpen) { _renderTimeline(); _updateIKPanel(); _updateConPanel(); _updateJigglePanel(); }
        });
        // IK约束滑块
        _on(_overlay.querySelector('#sa-ik-min'), 'input', function() {
            if (!_selectedBone) return;
            _selectedBone.ikMin = parseInt(this.value);
            _overlay.querySelector('#sa-ik-min-val').textContent = this.value + '°';
        });
        _on(_overlay.querySelector('#sa-ik-max'), 'input', function() {
            if (!_selectedBone) return;
            _selectedBone.ikMax = parseInt(this.value);
            _overlay.querySelector('#sa-ik-max-val').textContent = this.value + '°';
        });
        // 新建动画
        _on(_overlay.querySelector('#sa-new-anim'), 'click', function() {
            _prompt('新建动画', '动画 ' + (_anims.length + 1), function(name) {
                if (name) {
                    _curAnim = addAnim(name);
                    _animTime = 0;
                    _updateAnimSelect();
                    _renderTimeline();
                }
            });
        });
        // 动画选择
        _on(_overlay.querySelector('#sa-anim-sel'), 'change', function() {
            _curAnim = _anims.find(function(a) { return a.id === parseInt(this.value); }.bind(this)) || null;
            _animTime = 0; resetPose(); render(); _renderTimeline();
        });
        _updateAnimSelect();
        _bindCurveEditor();
    }

    function _updateIKPanel() {
        var panel = _overlay.querySelector('#sa-ik-panel');
        if (!panel) return;
        if (!_selectedBone || !_timelineOpen) {
            panel.style.display = 'none';
            return;
        }
        panel.style.display = 'block';
        var minR = _overlay.querySelector('#sa-ik-min');
        var maxR = _overlay.querySelector('#sa-ik-max');
        var minV = _overlay.querySelector('#sa-ik-min-val');
        var maxV = _overlay.querySelector('#sa-ik-max-val');
        minR.value = _selectedBone.ikMin;
        maxR.value = _selectedBone.ikMax;
        minV.textContent = _selectedBone.ikMin + '°';
        maxV.textContent = _selectedBone.ikMax + '°';
    }

    function _updateConPanel() {
        var panel = _overlay.querySelector('#sa-con-panel');
        var list = _overlay.querySelector('#sa-con-list');
        if (!panel || !list) return;
        if (!_constraints.length || !_timelineOpen) {
            panel.style.display = 'none';
            return;
        }
        panel.style.display = 'block';
        var h = '';
        for (var i = 0; i < _constraints.length; i++) {
            var c = _constraints[i];
            var typeLabels = { rotation: 'R', position: 'P', scale: 'S' };
            h += '<div class="sa-con-item" data-con-id="' + c.id + '">';
            h += '<span class="sa-con-type ' + c.type + '">' + (typeLabels[c.type] || 'R') + '</span>';
            h += '<span class="sa-con-info">' + c.bone.name + ' → ' + c.target.name + '</span>';
            h += '<input type="range" class="sa-con-mix" min="0" max="100" value="' + Math.round(c.mix * 100) + '" data-con-id="' + c.id + '">';
            h += '<button class="sa-con-del" data-con-id="' + c.id + '">✕</button>';
            h += '</div>';
        }
        list.innerHTML = h;

        // 绑定mix滑块
        list.querySelectorAll('.sa-con-mix').forEach(function(slider) {
            slider.addEventListener('input', function() {
                var conId = parseInt(this.dataset.conId);
                for (var j = 0; j < _constraints.length; j++) {
                    if (_constraints[j].id === conId) {
                        _constraints[j].mix = parseInt(this.value) / 100;
                        render();
                        break;
                    }
                }
            });
        });

        // 绑定删除按钮
        list.querySelectorAll('.sa-con-del').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var conId = parseInt(this.dataset.conId);
                for (var j = 0; j < _constraints.length; j++) {
                    if (_constraints[j].id === conId) {
                        removeConstraint(_constraints[j]);
                        render();
                        _updateConPanel();
                        break;
                    }
                }
            });
        });
    }

    function _updateJigglePanel() {
        var panel = _overlay.querySelector('#sa-jiggle-panel');
        if (!panel) return;
        if (!_selectedBone || !_selectedBone.jiggle || !_timelineOpen) {
            panel.style.display = 'none';
            return;
        }
        panel.style.display = 'block';
        var kR = _overlay.querySelector('#sa-jiggle-k');
        var dR = _overlay.querySelector('#sa-jiggle-d');
        var kV = _overlay.querySelector('#sa-jiggle-k-val');
        var dV = _overlay.querySelector('#sa-jiggle-d-val');
        kR.value = _selectedBone.jiggleK;
        dR.value = _selectedBone.jiggleD;
        kV.textContent = _selectedBone.jiggleK;
        dV.textContent = _selectedBone.jiggleD;
        var btn = _overlay.querySelector('#sa-jiggle');
        if (btn) btn.classList.toggle('active', _selectedBone.jiggle);
    }

    function _openCurveEditor(boneId, time) {
        if (!_curAnim || !_curAnim.tracks[boneId]) return;
        _curveEditBone = boneId;
        _curveEditTime = time;
        var tr = _curAnim.tracks[boneId];
        _curveEditTrack = null;
        _curveEditIdx = -1;
        ['rotate', 'translate', 'scale'].forEach(function(p) {
            if (_curveEditTrack) return;
            for (var i = 0; i < tr[p].length; i++) {
                if (Math.abs(tr[p][i].t - time) < 0.001) {
                    _curveEditTrack = tr[p];
                    _curveEditIdx = i;
                    return;
                }
            }
        });
        var panel = _overlay.querySelector('#sa-curve-panel');
        if (panel) panel.style.display = 'block';
        _renderCurveEditor();
        _renderCurvePresets();
    }

    function _closeCurveEditor() {
        _curveEditBone = null;
        _curveEditTrack = null;
        _curveEditIdx = -1;
        _curveDrag = null;
        var panel = _overlay.querySelector('#sa-curve-panel');
        if (panel) panel.style.display = 'none';
    }

    function _getCurveKF() {
        if (!_curveEditTrack || _curveEditIdx < 0) return null;
        return _curveEditTrack[_curveEditIdx];
    }

    function _renderCurveEditor() {
        var canvas = _overlay.querySelector('#sa-curve-canvas');
        if (!canvas) return;
        var ctx = canvas.getContext('2d');
        var w = 160, h = 100;
        var pad = 12;
        ctx.clearRect(0, 0, w, h);

        // 网格
        ctx.strokeStyle = 'rgba(100,160,255,0.06)';
        ctx.lineWidth = 0.5;
        for (var i = 0; i <= 4; i++) {
            var x = pad + (w - pad * 2) * i / 4;
            var y = pad + (h - pad * 2) * i / 4;
            ctx.beginPath(); ctx.moveTo(x, pad); ctx.lineTo(x, h - pad); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w - pad, y); ctx.stroke();
        }

        // 对角线
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(pad, h - pad);
        ctx.lineTo(w - pad, pad);
        ctx.stroke();
        ctx.setLineDash([]);

        var kf = _getCurveKF();
        if (!kf) return;

        var ci = kf.ci != null ? kf.ci : 0.25;
        var co = kf.co != null ? kf.co : 0.75;

        var cp1x = pad + co * (w - pad * 2);
        var cp1y = h - pad - co * (h - pad * 2);
        var cp2x = pad + ci * (w - pad * 2);
        var cp2y = h - pad - ci * (h - pad * 2);

        // 控制线
        ctx.strokeStyle = 'rgba(56,189,248,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(pad, h - pad); ctx.lineTo(cp1x, cp1y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(w - pad, pad); ctx.lineTo(cp2x, cp2y);
        ctx.stroke();

        // 贝塞尔曲线
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pad, h - pad);
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, w - pad, pad);
        ctx.stroke();

        // 控制点
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath(); ctx.arc(cp1x, cp1y, 4, 0, PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(cp2x, cp2y, 4, 0, PI * 2); ctx.fill();

        // 端点
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath(); ctx.arc(pad, h - pad, 3, 0, PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(w - pad, pad, 3, 0, PI * 2); ctx.fill();

        // 标签
        ctx.fillStyle = 'rgba(148,163,184,0.3)';
        ctx.font = '7px system-ui';
        ctx.textAlign = 'left';
        ctx.fillText('out:' + co.toFixed(2), pad + 2, h - 2);
        ctx.textAlign = 'right';
        ctx.fillText('in:' + ci.toFixed(2), w - pad, pad - 4);
    }

    function _renderCurvePresets() {
        var el = _overlay.querySelector('#sa-curve-presets');
        if (!el) return;
        var kf = _getCurveKF();
        var ci = kf ? (kf.ci != null ? kf.ci : 0.25) : 0.25;
        var co = kf ? (kf.co != null ? kf.co : 0.75) : 0.75;
        var h = '';
        var presetNames = {
            linear: '线性', easeIn: '缓入', easeOut: '缓出',
            easeInOut: '缓入出', bounce: '弹跳', elastic: '弹性', sharp: '锐利'
        };
        for (var name in _easingPresets) {
            var p = _easingPresets[name];
            var isActive = Math.abs(p.ci - ci) < 0.01 && Math.abs(p.co - co) < 0.01;
            h += '<button class="sa-curve-pre' + (isActive ? ' active' : '') + '" data-preset="' + name + '">' + (presetNames[name] || name) + '</button>';
        }
        el.innerHTML = h;

        el.querySelectorAll('.sa-curve-pre').forEach(function(btn) {
            btn.addEventListener('click', function() {
                var preset = _easingPresets[this.dataset.preset];
                if (!preset || !_curveEditTrack || _curveEditIdx < 0) return;
                var kf = _curveEditTrack[_curveEditIdx];
                kf.ci = preset.ci;
                kf.co = preset.co;
                _syncCurveToAllTracks();
                _renderCurveEditor();
                _renderCurvePresets();
                render();
            });
        });
    }

    function _syncCurveToAllTracks() {
        if (!_curveEditBone || !_curAnim || !_curAnim.tracks[_curveEditBone]) return;
        var kf = _getCurveKF();
        if (!kf) return;
        var tr = _curAnim.tracks[_curveEditBone];
        ['rotate', 'translate', 'scale'].forEach(function(p) {
            for (var i = 0; i < tr[p].length; i++) {
                if (Math.abs(tr[p][i].t - _curveEditTime) < 0.001) {
                    tr[p][i].ci = kf.ci;
                    tr[p][i].co = kf.co;
                }
            }
        });
    }

    function _bindCurveEditor() {
        var canvas = _overlay.querySelector('#sa-curve-canvas');
        if (!canvas) return;

        _on(canvas, 'mousedown', function(e) {
            var kf = _getCurveKF();
            if (!kf) return;
            var rect = canvas.getBoundingClientRect();
            var mx = e.clientX - rect.left, my = e.clientY - rect.top;
            var pad = 12, w = 160, h = 100;
            var ci = kf.ci != null ? kf.ci : 0.25;
            var co = kf.co != null ? kf.co : 0.75;
            var cp1x = pad + co * (w - pad * 2);
            var cp1y = h - pad - co * (h - pad * 2);
            var cp2x = pad + ci * (w - pad * 2);
            var cp2y = h - pad - ci * (h - pad * 2);

            if (Math.hypot(mx - cp1x, my - cp1y) < 10) {
                _curveDrag = { cp: 'out' };
            } else if (Math.hypot(mx - cp2x, my - cp2y) < 10) {
                _curveDrag = { cp: 'in' };
            }
        });

        _on(canvas, 'mousemove', function(e) {
            if (!_curveDrag) return;
            var kf = _getCurveKF();
            if (!kf) return;
            var rect = canvas.getBoundingClientRect();
            var mx = e.clientX - rect.left, my = e.clientY - rect.top;
            var pad = 12, w = 160, h = 100;
            var nx = Math.max(0, Math.min(1, (mx - pad) / (w - pad * 2)));
            var ny = Math.max(0, Math.min(1, 1 - (my - pad) / (h - pad * 2)));

            if (_curveDrag.cp === 'out') {
                kf.co = nx;
            } else {
                kf.ci = nx;
            }
            _syncCurveToAllTracks();
            _renderCurveEditor();
            _renderCurvePresets();
            render();
        });

        _on(canvas, 'mouseup', function() { _curveDrag = null; });
        _on(canvas, 'mouseleave', function() { _curveDrag = null; });
        _on(_overlay.querySelector('#sa-curve-close'), 'click', _closeCurveEditor);
    }

    function _updateAnimSelect() {
        var sel = _overlay.querySelector('#sa-anim-sel');
        if (!sel) return;
        sel.innerHTML = '';
        _anims.forEach(function(a) {
            var opt = document.createElement('option');
            opt.value = a.id;
            opt.textContent = a.name + ' (' + a.duration.toFixed(1) + 's)';
            if (_curAnim === a) opt.selected = true;
            sel.appendChild(opt);
        });
    }

    function _refreshUI() {
        if (!_overlay) return;
        _overlay.innerHTML = _html() + '<style>' + _css() + '</style>';
        _canvas = _overlay.querySelector('#sa-canvas');
        _gl = _initWebGL(_canvas);
        if (!_gl) _ctx = _canvas.getContext('2d');
        _bindEvents();
        _bindUI();
        _makeDrag();
        requestAnimationFrame(function() { _resize(); });
        render();
    }

    function _makeDrag() {
        var hd = _overlay.querySelector('.sa-hd'), down = false, sx, sy, sl, st;
        _on(hd, 'mousedown', function(e) {
            if (e.target.closest('button')) return;
            down = true; sx = e.clientX; sy = e.clientY; sl = _overlay.offsetLeft; st = _overlay.offsetTop; e.preventDefault();
        });
        _on(document, 'mousemove', function(e) { if (down) { _overlay.style.left = (sl + e.clientX - sx) + 'px'; _overlay.style.top = (st + e.clientY - sy) + 'px'; } });
        _on(document, 'mouseup', function() {
            if (down) { down = false; try { localStorage.setItem('sa-win', JSON.stringify({ w: _overlay.offsetWidth, h: _overlay.offsetHeight, l: _overlay.offsetLeft, t: _overlay.offsetTop })); } catch(e) {} }
        });
    }

    function _restorePos() {
        try {
            var s = JSON.parse(localStorage.getItem('sa-win'));
            if (s && s.l >= 0 && s.t >= 0 && s.l < window.innerWidth && s.t < window.innerHeight) {
                _overlay.style.width = s.w + 'px'; _overlay.style.height = s.h + 'px';
                _overlay.style.left = s.l + 'px'; _overlay.style.top = s.t + 'px';
                return;
            }
        } catch(e) {}
        // 默认居中
        var ww = window.innerWidth, wh = window.innerHeight;
        _overlay.style.left = Math.max(20, (ww - 960) / 2) + 'px';
        _overlay.style.top = Math.max(20, (wh - 680) / 2) + 'px';
    }

    function _resize() {
        if (!_canvas) return;
        var wr = _canvas.parentElement, dpr = window.devicePixelRatio || 1;
        var w = wr.clientWidth || _overlay.clientWidth || 960;
        var h = wr.clientHeight || (_overlay.clientHeight - 40) || 640;
        _canvas.width = w * dpr; _canvas.height = h * dpr;
        if (_ctx) _ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        if (_gl) {
            // canvas尺寸变化会重置WebGL状态，需要重新设置
            _gl.enable(_gl.BLEND);
            _gl.blendFunc(_gl.SRC_ALPHA, _gl.ONE_MINUS_SRC_ALPHA);
            _currentProgram = null; // 强制重新useProgram
        }
        _canvas.style.width = w + 'px'; _canvas.style.height = h + 'px';
        render();
    }

    function exportGodot() {
        if (!_bones.length) { _toast('没有骨骼数据', 'warn'); return; }
        var godotData = {
            skeleton: {
                bones: _bones.map(function(b, idx) {
                    return {
                        name: b.name,
                        parent: b.parent ? _bones.indexOf(b.parent) : -1,
                        rest: {
                            position: { x: b.sx, y: -b.sy },
                            rotation: -b.sr,
                            scale: { x: b.ssx, y: b.ssy }
                        },
                        length: b.sl
                    };
                })
            },
            animations: _anims.map(function(a) {
                var tracks = {};
                for (var id in a.tracks) {
                    var b = boneById(parseInt(id));
                    if (!b) continue;
                    var boneIdx = _bones.indexOf(b);
                    var tr = a.tracks[id];
                    if (tr.rotate.length) {
                        tracks['bone_' + boneIdx + ':rotation_degrees'] = {
                            times: tr.rotate.map(function(k) { return k.t; }),
                            values: tr.rotate.map(function(k) { return -k.v; })
                        };
                    }
                    if (tr.translate.length) {
                        tracks['bone_' + boneIdx + ':position'] = {
                            times: tr.translate.map(function(k) { return k.t; }),
                            values: tr.translate.map(function(k) { return { x: k.v[0], y: -k.v[1] }; })
                        };
                    }
                    if (tr.scale.length) {
                        tracks['bone_' + boneIdx + ':scale'] = {
                            times: tr.scale.map(function(k) { return k.t; }),
                            values: tr.scale.map(function(k) { return { x: k.v[0], y: k.v[1] }; })
                        };
                    }
                }
                return {
                    name: a.name,
                    length: a.duration,
                    loop: true,
                    tracks: tracks
                };
            }),
            paths: _paths.map(function(p) {
                return {
                    name: p.name,
                    closed: p.closed,
                    points: p.points.map(function(pt) { return { x: pt.x, y: -pt.y }; })
                };
            }),
            pathConstraints: _pathConstraints.map(function(pc) {
                return { bone: _bones.indexOf(pc.bone), pathIndex: _paths.indexOf(pc.path), progress: pc.progress, rotateFollow: pc.rotateFollow };
            }),
            constraints: _constraints.map(function(c) {
                return { bone: c.bone.name, target: c.target.name, type: c.type, mix: c.mix };
            }),
            metadata: {
                source: 'SpineAnimate v11 WebGL2',
                exportTime: new Date().toISOString(),
                boneCount: _bones.length,
                animationCount: _anims.length
            }
        };

        var blob = new Blob([JSON.stringify(godotData, null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'skeleton_godot.json';
        a.click();
    }

    function exportJSON() {
        var data = { bones: _bones.map(function(b) {
            return { name: b.name, parent: b.parent ? b.parent.name : null, length: b.sl, x: b.sx, y: b.sy, rotation: b.sr, scaleX: b.ssx, scaleY: b.ssy, color: b.color, ikMin: b.ikMin, ikMax: b.ikMax, jiggle: b.jiggle, jiggleK: b.jiggleK, jiggleD: b.jiggleD };
        }), animations: _anims.map(function(a) {
            var tracks = {};
            for (var id in a.tracks) { var b = boneById(parseInt(id)); if (!b) continue; var tr = a.tracks[id], t = {}; if (tr.rotate.length) t.rotate = tr.rotate; if (tr.translate.length) t.translate = tr.translate; if (tr.scale.length) t.scale = tr.scale; tracks[b.name] = t; }
            return { name: a.name, duration: a.duration, tracks: tracks };
        }), constraints: _constraints.map(function(c) {
            return { bone: c.bone.name, target: c.target.name, type: c.type, mix: c.mix, offset: c.offset };
        }), paths: _paths.map(function(p) {
            return { name: p.name, points: p.points, closed: p.closed };
        }), pathConstraints: _pathConstraints.map(function(pc) {
            return { bone: pc.bone.name, pathId: pc.path.id, progress: pc.progress, rotateFollow: pc.rotateFollow, offset: pc.offset };
        }), ffdMeshes: _ffdMeshes.map(function(m) {
            return { bone: m.bone.name, cols: m.cols, rows: m.rows, width: m.width, height: m.height, offsets: m.offsets };
        }), clips: _clips.map(function(cl) {
            return { bone: cl.bone.name, shape: cl.shape, params: cl.params };
        })};
        var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'skeleton.json'; a.click();
    }

    function importJSON() {
        var inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json'; inp.style.display = 'none';
        document.body.appendChild(inp);
        inp.onchange = function() {
            var f = inp.files[0]; if (!f) return;
            var r = new FileReader();
            r.onload = function(e) { try { _load(JSON.parse(e.target.result)); } catch (err) { _toast('导入失败: ' + err.message, 'error'); } };
            r.readAsText(f); document.body.removeChild(inp);
        };
        inp.click();
    }

    function _load(data) {
        _bones = []; _anims = []; _attachments = []; _constraints = [];
        _paths = []; _pathConstraints = []; _ffdMeshes = []; _clips = [];
        _selectedBone = null; _rootBone = null; _curAnim = null; _nextId = 1;
        var map = {};
        (data.bones || []).forEach(function(d) {
            var b = addBone(d.name, d.parent ? map[d.parent] : null);
            b.length = d.length || 60; b.sl = b.length;
            b.x = d.x || 0; b.y = d.y || 0; b.rotation = d.rotation || 0;
            b.scaleX = d.scaleX || 1; b.scaleY = d.scaleY || 1; b.color = d.color || '#38bdf8';
            b.ikMin = d.ikMin != null ? d.ikMin : -180; b.ikMax = d.ikMax != null ? d.ikMax : 180;
            b.jiggle = d.jiggle || false; b.jiggleK = d.jiggleK || 180; b.jiggleD = d.jiggleD || 12;
            b.sx = b.x; b.sy = b.y; b.sr = b.rotation; b.ssx = b.scaleX; b.ssy = b.scaleY;
            map[b.name] = b;
        });
        (data.animations || []).forEach(function(d) {
            var a = addAnim(d.name);
            for (var bn in d.tracks) {
                var b = map[bn]; if (!b) continue; var tr = d.tracks[bn];
                if (!a.tracks[b.id]) a.tracks[b.id] = { rotate: [], translate: [], scale: [] };
                if (tr.rotate) tr.rotate.forEach(function(k) { _setKF(a.tracks[b.id].rotate, k.t, k.v); });
                if (tr.translate) tr.translate.forEach(function(k) { _setKF(a.tracks[b.id].translate, k.t, k.v); });
                if (tr.scale) tr.scale.forEach(function(k) { _setKF(a.tracks[b.id].scale, k.t, k.v); });
            }
            var prev = _curAnim; _curAnim = a; _updateDur(); _curAnim = prev;
        });
        if (_anims.length) _curAnim = _anims[0];
        (data.constraints || []).forEach(function(d) {
            var b = map[d.bone], t = map[d.target];
            if (b && t) {
                var c = addConstraint(b, t, d.type || 'rotation');
                c.mix = d.mix != null ? d.mix : 1;
                c.offset = d.offset || 0;
            }
        });
        var pathMap = {};
        (data.paths || []).forEach(function(d) {
            var p = addPath(d.name, d.points || [], d.closed);
            pathMap[p.id] = p;
        });
        (data.pathConstraints || []).forEach(function(d) {
            var b = map[d.bone], p = pathMap[d.pathId];
            if (b && p) {
                var pc = addPathConstraint(b, p);
                pc.progress = d.progress || 0;
                pc.rotateFollow = d.rotateFollow != null ? d.rotateFollow : true;
                pc.offset = d.offset || 0;
            }
        });
        (data.ffdMeshes || []).forEach(function(d) {
            var b = map[d.bone];
            if (!b) return;
            var mesh = addFFD(b, d.cols || 3, d.rows || 3, d.width || 100, d.height || 100);
            if (d.offsets) mesh.offsets = d.offsets;
        });
        (data.clips || []).forEach(function(d) {
            var b = map[d.bone];
            if (b) addClip(b, d.shape || 'ellipse', d.params || {});
        });
        updateFK(); render(); _renderTimeline(); _updateAnimSelect();
    }

    function _on(t, type, fn, opts) { t.addEventListener(type, fn, opts); _events.push({ t: t, type: type, fn: fn }); }

    function open() { if (_overlay) return; _create(); }
    function close() {
        _playing = false; if (_raf) cancelAnimationFrame(_raf);
        _events.forEach(function(e) { e.t.removeEventListener(e.type, e.fn); }); _events = [];
        if (_overlay) { _overlay.remove(); _overlay = null; }
        _canvas = null; _ctx = null; _gl = null; _isOpen = false;
    }

    return {
        id: 'spine-animate', name: '骨骼动画', icon: '🦴',
        description: '完整骨骼动画 · FK/IK · 约束 · 缓动 · 弹性 · 路径 · FFD · 裁剪 · Godot导出 (WebGL2)',
        _world: null, _layer: null,
        activate: function(world) { this._world = world; this._layer = world.getLayer(); open(); },
        deactivate: close,
        getSubTools: function() {
            return [
                { label: '🦴 打开', action: function() { if (!_isOpen) open(); } },
                { label: '↗ 导出JSON', action: exportJSON },
                { label: '🎮 导出Godot', action: exportGodot },
                { label: '↙ 导入', action: importJSON }
            ];
        },
        save: function() {
            if (!_bones.length) return null;
            return { bones: _bones.map(function(b) {
            return { name: b.name, parent: b.parent ? b.parent.name : null, length: b.sl, x: b.sx, y: b.sy, rotation: b.sr, scaleX: b.ssx, scaleY: b.ssy, color: b.color, ikMin: b.ikMin, ikMax: b.ikMax, jiggle: b.jiggle, jiggleK: b.jiggleK, jiggleD: b.jiggleD };
        }), animations: _anims.map(function(a) { var tracks = {}; for (var id in a.tracks) { var b = boneById(parseInt(id)); if (!b) continue; var tr = a.tracks[id], t = {}; if (tr.rotate.length) t.rotate = tr.rotate; if (tr.translate.length) t.translate = tr.translate; if (tr.scale.length) t.scale = tr.scale; tracks[b.name] = t; } return { name: a.name, duration: a.duration, tracks: tracks }; }),
        constraints: _constraints.map(function(c) { return { bone: c.bone.name, target: c.target.name, type: c.type, mix: c.mix, offset: c.offset }; }),
        paths: _paths.map(function(p) { return { name: p.name, points: p.points, closed: p.closed }; }),
        pathConstraints: _pathConstraints.map(function(pc) { return { bone: pc.bone.name, pathId: pc.path.id, progress: pc.progress, rotateFollow: pc.rotateFollow, offset: pc.offset }; }),
        ffdMeshes: _ffdMeshes.map(function(m) { return { bone: m.bone.name, cols: m.cols, rows: m.rows, width: m.width, height: m.height, offsets: m.offsets }; }),
        clips: _clips.map(function(cl) { return { bone: cl.bone.name, shape: cl.shape, params: cl.params }; }) };
        },
        load: function(data) { if (!data || !data.bones) return; _load({ bones: data.bones, animations: data.animations || [] }); if (!_isOpen) open(); }
    };
})();
