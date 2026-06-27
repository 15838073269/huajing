/* ============================================
 *   书境 — 文件阅读器插件（画境 v66）
 *   兔师兄 · 自动识别编码
 *   从 standalone 书境.html 适配为 v66 Type A 插件
 * ============================================
 *
 * 功能：
 * - File System Access API 目录选择
 * - 文件树浏览 + 名称搜索
 * - 纯文本/Markdown 阅读
 * - 自动编码检测（UTF-8/UTF-16/GBK）
 * - Magic Byte 二进制识别（30+ 格式）
 * - 152 种文件格式分类（16 大类）
 * - 文本统计（字数/行数/页数/中英文）
 * - 内联编辑 + 保存（File System Access Writable）
 * - 竖排切换 / 字号调整
 * - IndexedDB 持久化目录句柄
 */

var BookReader = {

    // ===== 基本信息 =====
    id: 'book-reader',
    name: '书境',
    icon: '<span style="color:#38bdf8;">书</span>',
    description: '文件阅读器，支持 152 种格式自动识别',

    // ===== 文本外部化 =====
    TEXTS: {
        TITLE: '书境',
        SUBTITLE: '兔师兄 · 自动识别编码',
        BTN_SELECT_FOLDER: '点击选择文件夹',
        BTN_CHANGE_FOLDER: '切换文件夹',
        BTN_CLOSE: '关',
        BTN_DELETE: '删',
        BTN_VERTICAL: '竖排',
        BTN_EDIT: '编辑',
        BTN_SAVE: '保存',
        BTN_COPIED: '已复制',
        BTN_CLEAR: '清除',
        SEARCH_PLACEHOLDER: '搜索...',
        SCANNING: '扫描中...',
        SCAN_FAILED: '扫描失败',
        NO_FILES: '该文件夹中没有找到支持的文本文件',
        LOADING: '加载中...',
        LOAD_FAILED: '加载失败',
        NO_PREVIEW: '无法预览',
        UNSUPPORTED_PREVIEW: '不支持预览此文件类型',
        EMPTY_FOLDER: '该文件夹没有找到支持的文本文件',
        EMPTY_HINT: '支持: txt/md/json/xml/html/css/js/py/java 等',
        CONFIRM_DELETE: '确认删除',
        CONFIRM_CLEAR: '清除当前文件夹，重新选择？',
        CONFIRM_SWITCH: '切换文件夹？当前文件夹将被清除',
        NEED_WRITE_PERM: '需要写权限才能删除',
        NEED_WRITE_SAVE: '需要写权限才能保存',
        SAVE_SUCCESS: '已保存',
        SAVE_FAILED: '保存失败',
        HANDLE_LOST: '文件句柄丢失',
        DELETED: '已删除',
        REMAINING: '剩余',
        FILES_COUNT: '个文件',
        DIR_ERROR: '目录读取错误',
        TOAST_LOADED: '已加载',
        MSG_FILE_COUNT: '共 {0} 个文件',
        MSG_CAT_COUNT: '{0}x{1}',
        CONFIRM_DEL_FILE: '确认删除「{0}」？',
        CONFIRM_DEL_DIR: '确认删除文件夹「{0}」及其中全部内容？',
        NO_CHROME_API: '请用 Chrome/Edge',
        RETRY: '点击重试',
        HELP_TITLE: '帮助',
        EMPTY_READER: '从左侧选择一本书开始阅读',
        FORMAT_SHOWCASE_TITLE: '—— 共 {0} 种文件格式 ——',
    },

    // ===== 内部状态 =====
    _world: null,
    _overlay: null,
    _overlayBody: null,
    _treeEl: null,
    _contentEl: null,
    _headerEl: null,
    _infoEl: null,
    _fileTitleEl: null,
    _fmtBadgeEl: null,
    _vertBtn: null,
    _searchInput: null,
    _editBtn: null,
    _fileTitleText: null,

    rootDir: null,
    fileMap: {},
    allPaths: [],
    fsVal: 16,
    vert: false,
    curPath: null,
    curIdx: -1,
    lastEnc: 'utf-8',
    editMode: false,
    _rawText: '',

    // ===== 文件分类系统 (152 格式) =====
    FILE_CATS: {
        doc:    { label: '文档',   cls: 'd', exts: 'md markdown txt tex rst org nfo pdf ofd typ typst'.split(' ') },
        office: { label: 'Office', cls: 'o', exts: 'docx docm dotx dotm doc dot xlsx xltx xlsm xlsb xls xlt xltm csv ods fods numbers pptx pptm potx potm ppsx ppsm'.split(' ') },
        code:   { label: '代码',   cls: 'c', exts: 'js mjs cjs ts tsx jsx py java c cpp cc h hpp cs rs go rb php vue diff dart kotlin scala swift r lua perl groovy'.split(' ') },
        data:   { label: '数据',   cls: 'D', exts: 'json xml yaml yml toml ini cfg conf log sql'.split(' ') },
        web:    { label: '网页',   cls: 'w', exts: 'html htm'.split(' ') },
        img:    { label: '图片',   cls: 'i', exts: 'gif jpg jpeg bmp tiff tif png svg webp ico'.split(' ') },
        audio:  { label: '音频',   cls: 'a', exts: 'mp3 mpeg wav ogg oga opus m4a aac flac weba'.split(' ') },
        video:  { label: '视频',   cls: 'v', exts: 'mp4 mkv webm avi mov wmv flv'.split(' ') },
        archive:{ label: '压缩',   cls: 'r', exts: 'zip zipx 7z rar tar gz gzip tgz bz2 bzip2 tbz tbz2 xz txz lzma zst tzst cab ar cpio iso xar lha lzh jar war ear apk cbz cbr'.split(' ') },
        mail:   { label: '邮件',   cls: 'm', exts: 'eml msg'.split(' ') },
        ebook:  { label: '电子书', cls: 'e', exts: 'epub umd'.split(' ') },
        cad:    { label: 'CAD/3D', cls: 'd', exts: 'dwg dxf dwf dwfx xps glb gltf obj stl ply fbx dae 3ds 3mf amf usd usda usdc usdz kmz pcd wrl vrml xyz vtk vtp step stp iges igs ifc 3dm'.split(' ') },
        eda:    { label: 'EDA',    cls: 'x', exts: 'olb dra'.split(' ') },
        draw:   { label: '绘图',   cls: 'w', exts: 'excalidraw drawio dio'.split(' ') },
    },

    FMT_LABELS: {
        md:'Markdown', markdown:'Markdown', txt:'纯文本', tex:'LaTeX', rst:'RST', org:'Org', nfo:'NFO',
        pdf:'PDF', ofd:'OFD', typ:'Typst', typst:'Typst',
        docx:'Word', docm:'Word(宏)', dotx:'Word模板', dotm:'Word模板(宏)', doc:'Word 97-2003', dot:'Word模板(旧)',
        xlsx:'Excel', xltx:'Excel模板', xlsm:'Excel(宏)', xlsb:'Excel(二进制)', xls:'Excel 97-2003', xlt:'Excel模板(旧)', xltm:'Excel模板(宏)',
        csv:'CSV', ods:'ODS', fods:'FODS', numbers:'Numbers',
        pptx:'PPT', pptm:'PPT(宏)', potx:'PPT模板', potm:'PPT模板(宏)', ppsx:'PPT放映', ppsm:'PPT放映(宏)',
        js:'JavaScript', mjs:'ES Module', cjs:'CommonJS', ts:'TypeScript', tsx:'TSX', jsx:'JSX',
        py:'Python', java:'Java', c:'C', cpp:'C++', cc:'C++', h:'C头文件', hpp:'C++头文件',
        cs:'C#', rs:'Rust', go:'Go', rb:'Ruby', php:'PHP', vue:'Vue', diff:'Diff',
        dart:'Dart', kotlin:'Kotlin', scala:'Scala', swift:'Swift', r:'R', lua:'Lua', perl:'Perl', groovy:'Groovy',
        json:'JSON', xml:'XML', yaml:'YAML', yml:'YAML', toml:'TOML',
        ini:'INI', cfg:'配置', conf:'配置', log:'日志', sql:'SQL',
        html:'HTML', htm:'HTML', svg:'SVG',
        gif:'GIF', jpg:'JPEG', jpeg:'JPEG', bmp:'BMP', tiff:'TIFF', tif:'TIFF', png:'PNG', webp:'WebP', ico:'ICO',
        mp3:'MP3', mpeg:'MPEG', wav:'WAV', ogg:'OGG', oga:'OGA', opus:'OPUS', m4a:'M4A', aac:'AAC', flac:'FLAC', weba:'WEBA',
        mp4:'MP4', mkv:'MKV', webm:'WebM', avi:'AVI', mov:'MOV', wmv:'WMV', flv:'FLV',
        zip:'ZIP', zipx:'ZIPX', '7z':'7z', rar:'RAR', tar:'TAR', gz:'GZIP', gzip:'GZIP', tgz:'TGZ',
        bz2:'BZ2', bzip2:'BZIP2', tbz:'TBZ', tbz2:'TBZ2', xz:'XZ', txz:'TXZ', lzma:'LZMA', zst:'ZST', tzst:'TZST',
        cab:'CAB', ar:'AR', cpio:'CPIO', iso:'ISO', xar:'XAR', lha:'LHA', lzh:'LZH',
        jar:'JAR', war:'WAR', ear:'EAR', apk:'APK', cbz:'CBZ', cbr:'CBR',
        eml:'EML', msg:'MSG', epub:'EPUB', umd:'UMD',
        dwg:'DWG', dxf:'DXF', dwf:'DWF', dwfx:'DWFX', xps:'XPS',
        glb:'GLB', gltf:'GLTF', obj:'OBJ', stl:'STL', ply:'PLY', fbx:'FBX', dae:'DAE', '3ds':'3DS', '3mf':'3MF', amf:'AMF',
        usd:'USD', usda:'USDA', usdc:'USDC', usdz:'USDZ', kmz:'KMZ', pcd:'PCD', wrl:'WRL', vrml:'VRML', xyz:'XYZ',
        vtk:'VTK', vtp:'VTP', step:'STEP', stp:'STP', iges:'IGES', igs:'IGS', ifc:'IFC', '3dm':'3DM',
        olb:'OLB', dra:'DRA', excalidraw:'Excalidraw', drawio:'Draw.io', dio:'Draw.io',
    },

    CAT_COLORS: {
        doc: '#60a5fa', office: '#fb923c', code: '#a78bfa', data: '#fbbf24',
        web: '#34d399', img: '#4ade80', audio: '#2dd4bf', video: '#f472b6',
        archive: '#94a3b8', mail: '#f87171', ebook: '#a8a29e',
        cad: '#60a5fa', eda: '#a78bfa', draw: '#2dd4bf',
    },

    // ── 生命周期 ──

    activate: function(world) {
        this._world = world;
        if (this._overlay) {
            SkillSystem.renderSubTools();
            return;
        }
        this._initLookups();
        this._createOverlay();
        this._bindEvents();
        SkillSystem.renderSubTools();
        this._autoRestore();
    },

    deactivate: function() {
        // 多窗口模式：不做清理，窗口保持打开
    },

    getSubTools: function() {
        var self = this;
        return [
            { label: this.TEXTS.BTN_SELECT_FOLDER, action: function() { self._pickOrClear(); } },
            { label: this.TEXTS.BTN_CLEAR, action: function() { self._clearDir(); } },
        ];
    },

    save: function() {
        return {};
    },

    load: function(data) {
        // 状态通过 IndexedDB 自行管理
    },

    // ===== 初始化 =====

    _initLookups: function() {
        if (this._EXT_CAT) return;
        var self = this;
        this._EXT_CAT = {};
        this._EXT_LABEL = {};
        Object.keys(this.FILE_CATS).forEach(function(cat) {
            var v = self.FILE_CATS[cat];
            v.exts.forEach(function(e) {
                self._EXT_CAT[e] = cat;
                self._EXT_LABEL[e] = self.FMT_LABELS[e] || e.toUpperCase();
            });
        });
    },

    _extOf: function(n) {
        var i = n.lastIndexOf('.');
        return i > 0 ? n.slice(i).toLowerCase() : '';
    },

    _catOf: function(n) {
        return this._EXT_CAT[this._extOf(n).slice(1)] || 'unk';
    },

    _fmtLabel: function(n) {
        return this._EXT_LABEL[this._extOf(n).slice(1)] || '未知';
    },

    _isText: function(n) {
        var i = n.lastIndexOf('.');
        var e = i > 0 ? n.slice(i).toLowerCase() : '';
        return i <= 0 || ['.txt','.md','.markdown','.json','.xml','.html','.htm','.css','.js','.mjs','.cjs','.ts','.tsx','.jsx','.py','.java','.c','.cpp','.cc','.h','.hpp','.cs','.rs','.go','.rb','.php','.sh','.bash','.bat','.ps1','.vue','.diff','.yaml','.yml','.toml','.ini','.cfg','.conf','.log','.csv','.tsv','.sql','.tex','.rst','.org','.nfo','.svg','.scss','.less','.dart','.kotlin','.scala','.swift','.r','.lua','.perl','.groovy','.pl','.pm','.sty','.cls'].indexOf(e) >= 0 || e === '.pdf';
    },

    // ── 创建窗口 ──

    _createOverlay: function() {
        var self = this;
        var T = this.TEXTS;

        var ov = document.createElement('div');
        ov.setAttribute('data-skill-id', this.id);
        ov.style.cssText =
            'position:fixed;z-index:9999;' +
            'background:#0f1525;color:#e8edf5;border-radius:12px;' +
            'border:1px solid rgba(100,160,255,0.15);' +
            'box-shadow:0 8px 40px rgba(0,0,0,.6);overflow:hidden;' +
            'display:flex;flex-direction:column;font-size:13px;' +
            'min-width:600px;min-height:400px;' +
            'left:60px;top:50px;width:860px;height:560px;';

        ov.innerHTML =
            '<div class="br-header" style="display:flex;align-items:center;' +
                'justify-content:space-between;padding:8px 14px;cursor:move;' +
                'user-select:none;flex-shrink:0;background:#16213e;' +
                'border-bottom:1px solid rgba(100,160,255,0.1);">' +
                '<span style="font-weight:600;color:#38bdf8;font-size:14px;">' + T.TITLE + '</span>' +
                '<span style="font-size:10px;color:#475569;">' + T.SUBTITLE + '</span>' +
                '<span class="br-close" style="width:24px;height:24px;display:flex;' +
                'align-items:center;justify-content:center;border-radius:6px;' +
                'cursor:pointer;color:#94a3b8;font-size:16px;">' + '\u00d7' + '</span></div>' +
            '<div class="br-body" style="flex:1;display:flex;overflow:hidden;min-height:0;">' +
                '<div class="br-sidebar" style="width:200px;min-width:120px;flex-shrink:0;' +
                    'display:flex;flex-direction:column;overflow:hidden;' +
                    'border-right:1px solid rgba(100,160,255,0.08);background:rgba(0,0,0,.12);">' +
                    '<div class="br-sb-hd" style="padding:10px 10px 4px;flex-shrink:0;"></div>' +
                    '<input class="br-search" type="text" placeholder="' + T.SEARCH_PLACEHOLDER + '"' +
                    'style="margin:4px 8px;padding:6px 8px;border-radius:6px;border:none;flex-shrink:0;' +
                    'background:rgba(0,0,0,.25);color:#e8edf5;font-size:11px;outline:none;font-family:inherit;">' +
                    '<div class="br-tree" style="flex:1;overflow-y:auto;padding:2px 0;"></div>' +
                '</div>' +
                '<div class="br-main" style="flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;">' +
                    '<div class="br-mh" style="display:none;align-items:center;padding:0 14px;height:36px;' +
                        'flex-shrink:0;background:rgba(22,33,62,.6);border-bottom:1px solid rgba(100,160,255,.05);">' +
                        '<span class="br-mh-title" style="flex:1;font-size:12px;font-weight:500;color:#cbd5e1;' +
                            'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"></span>' +
                        '<div style="display:flex;align-items:center;gap:2px;flex-shrink:0;"></div>' +
                    '</div>' +
                    '<div class="br-cw" style="flex:1;overflow-y:auto;background:rgba(0,0,0,.08);"></div>' +
                '</div>' +
            '</div>';

        document.body.appendChild(ov);
        this._overlay = ov;

        // 禁用右键菜单
        ov.addEventListener('contextmenu', function(e) { e.preventDefault(); });

        // 四角四边缩放 + localStorage 记忆尺寸
        if (typeof WindowHelper !== 'undefined') {
            WindowHelper.makeResizable(ov, { minWidth: 600, minHeight: 400, storeKey: 'br-window-rect' });
        }

        // 标题栏拖拽
        var header = ov.querySelector('.br-header');
        var d = { active: false, sx: 0, sy: 0, ox: 0, oy: 0 };
        header.addEventListener('mousedown', function(e) {
            if (e.target.closest('.br-close')) return;
            d.active = true;
            d.sx = e.clientX; d.sy = e.clientY;
            var r = ov.getBoundingClientRect();
            d.ox = r.left; d.oy = r.top;
            e.preventDefault();
        });
        this._onDragMove = function(e) {
            if (!d.active) return;
            ov.style.left = (d.ox + e.clientX - d.sx) + 'px';
            ov.style.top = (d.oy + e.clientY - d.sy) + 'px';
        };
        this._onDragUp = function() { d.active = false; };
        document.addEventListener('mousemove', this._onDragMove);
        document.addEventListener('mouseup', this._onDragUp);

        // 关闭按钮
        ov.querySelector('.br-close').addEventListener('click', function() {
            self._destroy();
        });

        // 缓存 DOM 引用
        this._overlayBody = ov.querySelector('.br-body');
        this._treeEl = ov.querySelector('.br-tree');
        this._contentEl = ov.querySelector('.br-cw');
        this._headerEl = ov.querySelector('.br-mh');
        this._fileTitleEl = ov.querySelector('.br-mh-title');
        this._fmtBadgeEl = ov.querySelector('.br-mh div:last-child');
        this._searchInput = ov.querySelector('.br-search');
        this._sbHd = ov.querySelector('.br-sb-hd');

        // 搜索
        this._searchInput.addEventListener('input', function() {
            self._filterTree();
        });

        // 侧边栏头部按钮
        this._renderSbHd();

        // 显示欢迎页
        this._renderWelcome();
    },

    _destroy: function() {
        document.removeEventListener('mousemove', this._onDragMove);
        document.removeEventListener('mouseup', this._onDragUp);
        this._unbindEvents();
        if (this._overlay && this._overlay.parentNode) {
            this._overlay.parentNode.removeChild(this._overlay);
        }
        this._overlay = null;
        this._overlayBody = null;
        this._treeEl = null;
        this._contentEl = null;
        this._headerEl = null;
        this._fileTitleEl = null;
        this._fmtBadgeEl = null;
        this._vertBtn = null;
        this._searchInput = null;
        this._editBtn = null;
        this._sbHd = null;
        SkillSystem.deactivate();
    },

    // ── 事件绑定 ──

    _bindEvents: function() {
        var self = this;
        this._onDelegate = function(e) {
            // 文件夹展开/折叠（必须在 .br-tr 之前，因为文件夹行也有 .br-tr）
            var dirRow = e.target.closest('.br-dir');
            if (dirRow && dirRow.dataset.path) {
                var ch = dirRow.parentElement.querySelector('.br-ch');
                if (ch) { ch.classList.toggle('br-op'); }
                return;
            }
            // 文件点击
            var tr = e.target.closest('.br-tr');
            if (tr && tr.dataset.path) {
                self._loadFile(tr.dataset.path);
                return;
            }
            // 删除文件按钮
            var delFile = e.target.closest('.br-del-file');
            if (delFile && delFile.dataset.path) {
                e.stopPropagation();
                self._delFile(delFile.dataset.path);
                return;
            }
            // 删除文件夹按钮
            var delDir = e.target.closest('.br-del-dir');
            if (delDir && delDir.dataset.path) {
                e.stopPropagation();
                self._delDir(delDir.dataset.path);
                return;
            }
        };
        this._overlay.addEventListener('click', this._onDelegate);
    },

    _unbindEvents: function() {
        if (this._overlay && this._onDelegate) {
            this._overlay.removeEventListener('click', this._onDelegate);
        }
    },

    // ── 侧边栏头部 ──

    _renderSbHd: function() {
        var self = this;
        var T = this.TEXTS;
        if (!this._sbHd) return;
        if (this.rootDir) {
            this._sbHd.innerHTML =
                '<div style="display:flex;align-items:center;gap:4px;font-size:11px;color:#38bdf8;' +
                'overflow:hidden;">' +
                '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' +
                '\ud83d\udcc2 ' + this._esc(this.rootDir.name) + '</span>' +
                '<span class="br-clear-btn" style="font-size:12px;cursor:pointer;color:#e87060;' +
                'padding:1px 4px;border-radius:4px;flex-shrink:0;">' + '\u00d7' + '</span></div>';
            this._sbHd.querySelector('.br-clear-btn').addEventListener('click', function(e) {
                e.stopPropagation();
                self._clearDir();
            });
        } else {
            this._sbHd.innerHTML = '<div class="br-select-btn" style="padding:6px 10px;' +
                'border-radius:8px;background:rgba(56,189,248,.1);cursor:pointer;font-size:11px;' +
                'color:#38bdf8;text-align:center;">' +
                '\ud83d\udcc2 ' + T.BTN_SELECT_FOLDER + '</div>';
            this._sbHd.querySelector('.br-select-btn').addEventListener('click', function() {
                self._pickDir();
            });
        }
    },

    // ── 自动恢复 ──

    _DB_NAME: 'Guji',
    _DB_STORE: 'h',

    _openDB: function() {
        var self = this;
        return new Promise(function(o, f) {
            var r = indexedDB.open(self._DB_NAME, 1);
            r.onupgradeneeded = function() { r.result.createObjectStore(self._DB_STORE); };
            r.onsuccess = function() { o(r.result); };
            r.onerror = function() { f(r.error); };
        });
    },

    _saveHandle: function(h) {
        var self = this;
        this._openDB().then(function(db) {
            var tx = db.transaction(self._DB_STORE, 'readwrite');
            tx.objectStore(self._DB_STORE).put(h, 'r');
        });
    },

    _loadHandle: function() {
        var self = this;
        return this._openDB().then(function(db) {
            return new Promise(function(o) {
                var tx = db.transaction(self._DB_STORE, 'readonly');
                var r = tx.objectStore(self._DB_STORE).get('r');
                r.onsuccess = function() { o(r.result); };
                r.onerror = function() { o(null); };
            });
        });
    },

    _autoRestore: function() {
        var self = this;
        this._loadHandle().then(function(h) {
            if (!h) return;
            try {
                h.queryPermission({ mode: 'read' }).then(function(status) {
                    if (status === 'granted') {
                        self.rootDir = h;
                        self._doLoad(h.name);
                    } else {
                        h.requestPermission({ mode: 'read' }).then(function(s2) {
                            if (s2 === 'granted') {
                                self.rootDir = h;
                                self._doLoad(h.name);
                            }
                        });
                    }
                });
            } catch(e) {}
        });
    },

    // ── 目录操作 ──

    _pickOrClear: function() {
        if (this.rootDir) {
            if (confirm(this.TEXTS.CONFIRM_SWITCH)) this._clearDir();
            return;
        }
        this._pickDir();
    },

    _pickDir: function() {
        var self = this;
        if (!window.showDirectoryPicker) {
            if (this._sbHd) this._sbHd.innerHTML = '\u26a0\ufe0f ' + this.TEXTS.NO_CHROME_API;
            return;
        }
        window.showDirectoryPicker({ mode: 'read', id: 'guji-browser' }).then(function(dir) {
            self.rootDir = dir;
            self._saveHandle(dir);
            self._doLoad(dir.name);
        }).catch(function(e) {
            if (e.name !== 'AbortError' && self._sbHd) {
                self._sbHd.innerHTML = '\u274c ' + self.TEXTS.RETRY;
            }
        });
    },

    _clearDir: function() {
        var self = this;
        if (!confirm(self.TEXTS.CONFIRM_CLEAR)) return;
        self.rootDir = null;
        self.fileMap = {};
        self.allPaths = [];
        self.curPath = null;
        self.curIdx = -1;
        if (self._searchInput) self._searchInput.value = '';
        if (self._treeEl) self._treeEl.innerHTML = '';
        self._hideReader();
        self._renderSbHd();
        self._openDB().then(function(db) {
            var tx = db.transaction(self._DB_STORE, 'readwrite');
            tx.objectStore(self._DB_STORE).delete('r');
        });
    },

    _doLoad: function(name) {
        var self = this;
        this._renderSbHd();
        if (this._searchInput) this._searchInput.style.display = 'block';
        if (this._infoEl) this._infoEl.style.display = 'block';
        this._showContent('<div class="br-ld"><div class="br-sp"></div><span>' + this.TEXTS.SCANNING + '</span></div>');
        this._infoEl = null;
        this.fileMap = {};
        this.allPaths = [];
        this.curPath = null;
        this.curIdx = -1;

        this._scan(this.rootDir, '').then(function() {
            if (self.allPaths.length === 0) {
                self._showContent('<div class="br-wl"><div style="font-size:28px;opacity:.25;">\ud83d\udcc2</div>' +
                    '<div style="font-size:13px;color:#94a3b8;">' + self.TEXTS.NO_FILES + '</div></div>');
                return;
            }
            self._buildTree();
            var catCount = {};
            self.allPaths.forEach(function(p) {
                var c = self._catOf(p);
                catCount[c] = (catCount[c] || 0) + 1;
            });
            var catStr = Object.keys(catCount).sort(function(a, b) { return catCount[b] - catCount[a]; })
                .map(function(c) { return (self.FILE_CATS[c] ? self.FILE_CATS[c].label : c) + '\u00d7' + catCount[c]; })
                .join('  ');
            self._showContent('<div style="font-size:28px;opacity:.25;">\ud83d\udcd6</div>' +
                '<div style="font-size:18px;font-weight:600;color:#cbd5e1;">' + self.TEXTS.TITLE + '</div>' +
                '<div style="font-size:12px;color:#94a3b8;">' +
                self._fmt(self.TEXTS.MSG_FILE_COUNT, self.allPaths.length) + '<br>' +
                self.TEXTS.EMPTY_READER + '</div>' +
                '<div style="font-size:10px;color:#475569;margin-top:4px;">' + catStr + '</div>');
        }).catch(function(e) {
            self._showContent('\u274c ' + self.TEXTS.SCAN_FAILED + ': ' + e.message);
        });
    },

    _scan: function(dir, pre) {
        var self = this;
        return new Promise(function(resolve, reject) {
            (async function() {
                try {
                    var es = [];
                    for await (var e of dir.values()) {
                        es.push(e);
                    }
                    es.sort(function(a, b) { return a.name.localeCompare(b.name, 'zh'); });
                    for (var j = 0; j < es.length; j++) {
                        var ee = es[j];
                        if (ee.name.startsWith('.')) continue;
                        var rp = pre ? pre + '/' + ee.name : ee.name;
                        if (ee.kind === 'directory') {
                            await self._scan(ee, rp);
                        } else if (self._isText(ee.name)) {
                            self.fileMap[rp] = ee;
                            self.allPaths.push(rp);
                        }
                    }
                    resolve();
                } catch (e) {
                    reject(e);
                }
            })();
        });
    },

    // ── 文件树 ──

    _buildTree: function() {
        var t = {};
        this.allPaths.forEach(function(p) {
            var ps = p.split('/');
            var c = t;
            for (var i = 0; i < ps.length; i++) {
                if (i === ps.length - 1) {
                    if (!c._f) c._f = [];
                    c._f.push(p);
                } else {
                    if (!c[ps[i]]) c[ps[i]] = {};
                    c = c[ps[i]];
                }
            }
        });
        if (this._treeEl) {
            this._treeEl.innerHTML = '';
            this._rTree(t, this._treeEl, '');
        }
    },

    _rTree: function(n, con, pp) {
        var self = this;
        var ds = Object.keys(n).filter(function(k) { return k !== '_f'; })
            .sort(function(a, b) { return a.localeCompare(b, 'zh'); });
        ds.forEach(function(name) {
            var fp = pp ? pp + '/' + name : name;
            var div = document.createElement('div');
            div.className = 'br-ti';
            div.dataset.path = fp;

            var row = document.createElement('div');
            row.className = 'br-tr br-dir';
            row.dataset.path = fp;
            row.innerHTML = '<span style="width:16px;text-align:center;flex-shrink:0;font-size:10px;opacity:.4;">\ud83d\udcc2</span>' +
                '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;">' +
                self._esc(name) + '</span>';

            var ch = n[name];
            var total = (ch._f || []).length;
            Object.keys(ch).forEach(function(k) {
                if (k !== '_f') total += self._cnt(ch[k]);
            });
            if (total > 0) {
                var c = document.createElement('span');
                c.style.cssText = 'font-size:10px;color:#475569;background:rgba(255,255,255,.03);padding:0 5px;border-radius:4px;flex-shrink:0;';
                c.textContent = total + '个';
                row.appendChild(c);
            }
            var del = document.createElement('span');
            del.className = 'br-del-dir';
            del.dataset.path = fp;
            del.textContent = '\u00d7';
            del.style.cssText = 'font-size:12px;cursor:pointer;padding:0 5px;border-radius:4px;color:#e87060;flex-shrink:0;margin-left:auto;opacity:0;transition:.12s;';
            row.appendChild(del);

            div.appendChild(row);
            var cd = document.createElement('div');
            cd.className = 'br-ch';
            self._rTree(ch, cd, fp);
            div.appendChild(cd);
            con.appendChild(div);
        });

        if (n._f) {
            n._f.forEach(function(fp) {
                var nm = fp.split('/').pop();
                var div = document.createElement('div');
                div.className = 'br-ti';
                div.dataset.path = fp;

                var row = document.createElement('div');
                row.className = 'br-tr';
                row.dataset.path = fp;
                var cat = self._catOf(nm);
                var tag = self.FILE_CATS[cat];
                var tc = tag ? self.CAT_COLORS[cat] : '#5f6368';
                var tagLabel = tag ? tag.label : '?';
                row.innerHTML =
                    '<span style="font-size:9px;padding:0 5px;border-radius:3px;flex-shrink:0;font-weight:500;' +
                    'background:' + tc + '20;color:' + tc + ';margin-right:3px;">' + tagLabel + '</span>' +
                    '<span style="width:16px;text-align:center;flex-shrink:0;font-size:10px;opacity:.4;">' + self._fIcon(nm) + '</span>' +
                    '<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;">' +
                    self._esc(nm) + '</span>';

                var del = document.createElement('span');
                del.className = 'br-del-file';
                del.dataset.path = fp;
                del.textContent = '\u00d7';
                del.style.cssText = 'font-size:12px;cursor:pointer;padding:0 5px;border-radius:4px;color:#e87060;flex-shrink:0;margin-left:auto;opacity:0;transition:.12s;';
                row.appendChild(del);

                div.appendChild(row);
                con.appendChild(div);
            });
        }
    },

    _cnt: function(n) {
        var t = (n._f || []).length;
        Object.keys(n).forEach(function(k) {
            if (k !== '_f') t += this._cnt(n[k]);
        }, this);
        return t;
    },

    _fIcon: function(n) {
        var e = this._extOf(n).slice(1);
        var o = {
            txt:'\ud83d\udcc4', md:'\ud83d\udcdd', markdown:'\ud83d\udcdd', tex:'\ud83d\udcd1', rst:'\ud83d\udcc4', org:'\ud83d\udcc4', nfo:'\ud83d\udcc4',
            pdf:'\ud83d\udcd5', ofd:'\ud83d\udcd5', typ:'\ud83d\udcc4', typst:'\ud83d\udcc4',
            docx:'\ud83d\udcd8', docm:'\ud83d\udcd8', doc:'\ud83d\udcd8',
            xlsx:'\ud83d\udcca', csv:'\ud83d\udcca', ods:'\ud83d\udcca',
            pptx:'\ud83d\udcd9',
            js:'\u26a1', mjs:'\u26a1', cjs:'\u26a1', ts:'\ud83d\udd35', tsx:'\ud83d\udd35', jsx:'\u26a1',
            py:'\ud83d\udc0d', java:'\u2615', c:'\u2699', cpp:'\u2699', cc:'\u2699', h:'\u2699', hpp:'\u2699',
            cs:'\ud83d\udca0', rs:'\ud83e\udd80', go:'\ud83d\udd35', rb:'\ud83d\udc8e', php:'\ud83d\udc18', vue:'\ud83d\udc9a',
            json:'\ud83d\udccb', xml:'\ud83d\udcf0', yaml:'\ud83d\udcd0', yml:'\ud83d\udcd0', toml:'\ud83d\udd27',
            ini:'\u2699', cfg:'\u2699', conf:'\u2699', log:'\ud83d\udccb', sql:'\ud83d\udfc4',
            html:'\ud83c\udf10', htm:'\ud83c\udf10', svg:'\ud83d\uddbc', css:'\ud83c\udfa8', scss:'\ud83c\udfa8', less:'\ud83c\udfa8',
            gif:'\ud83d\uddbc', jpg:'\ud83d\uddbc', jpeg:'\ud83d\uddbc', png:'\ud83d\uddbc', webp:'\ud83d\uddbc', ico:'\ud83d\uddbc',
            mp3:'\ud83c\udfb5', wav:'\ud83c\udfb5', ogg:'\ud83c\udfb5', flac:'\ud83c\udfb5',
            mp4:'\ud83c\udfac', mkv:'\ud83c\udfac', webm:'\ud83c\udfac', avi:'\ud83c\udfac',
            zip:'\ud83d\udce6', '7z':'\ud83d\udce6', rar:'\ud83d\udce6', tar:'\ud83d\udce6', gz:'\ud83d\udce6',
            epub:'\ud83d\udcd6', umd:'\ud83d\udcd6',
            dwg:'\ud83d\udcd0', dxf:'\ud83d\udcd0', glb:'\ud83e\uddca', gltf:'\ud83e\uddca', obj:'\ud83e\uddca', stl:'\ud83e\uddca',
        };
        return o[e] || '\ud83d\udcc4';
    },

    // ── 搜索过滤 ──

    _filterTree: function() {
        var q = this._searchInput ? this._searchInput.value.trim().toLowerCase() : '';
        var items = this._treeEl ? this._treeEl.querySelectorAll('.br-ti') : [];
        var self = this;
        items.forEach(function(item) { item.style.display = ''; });
        var chs = this._treeEl ? this._treeEl.querySelectorAll('.br-ch') : [];
        chs.forEach(function(ch) { ch.classList.remove('br-op'); });
        if (!q) return;
        items.forEach(function(item) {
            var nm = item.querySelector('.br-tr span:nth-child(2)');
            if (!nm) return;
            if (nm.textContent.toLowerCase().includes(q)) {
                nm.innerHTML = self._hl(nm.textContent, q);
                var p = item.parentElement;
                while (p) {
                    if (p.classList.contains('br-ch')) p.classList.add('br-op');
                    p = p.parentElement;
                }
            } else {
                item.style.display = 'none';
            }
        });
    },

    // ── 加载文件 ──

    _loadFile: function(fp) {
        var self = this;
        this.curPath = fp;
        this.curIdx = this.allPaths.indexOf(fp);
        this._headerEl.style.display = '';
        this._showContent('<div class="br-ld"><div class="br-sp"></div><span>' + this.TEXTS.LOADING + '</span></div>');

        // 高亮
        var acts = this._treeEl.querySelectorAll('.br-tr.br-act');
        acts.forEach(function(e) { e.classList.remove('br-act'); });
        var tgt = this._treeEl.querySelector('.br-ti[data-path="' + this._escA(fp) + '"] .br-tr');
        if (tgt) tgt.classList.add('br-act');

        // 展开父路径
        var ps = fp.split('/');
        var a = '';
        for (var i = 0; i < ps.length - 1; i++) {
            a = a ? a + '/' + ps[i] : ps[i];
            var pel = this._treeEl.querySelector('.br-ti[data-path="' + this._escA(a) + '"]');
            if (pel) {
                var ch = pel.querySelector('.br-ch');
                if (ch) ch.classList.add('br-op');
            }
        }

        var h = this.fileMap[fp];
        if (!h) {
            this._showContent('\u274c ' + this.TEXTS.LOAD_FAILED);
            return;
        }
        h.getFile().then(function(f) {
            var nm = fp.split('/').pop();
            var nm2 = nm.replace(/\.[^.]+$/i, '');
            var ext = nm.includes('.') ? nm.slice(nm.lastIndexOf('.')).toLowerCase() : '';

            if (ext === '.pdf') {
                var url = URL.createObjectURL(f);
                self._fileTitleEl.textContent = nm2;
                self._setBadge('pdf', 'PDF');
                self._vertBtn = null;
                var cw = self._contentEl;
                cw.innerHTML = '';
                var emb = document.createElement('embed');
                emb.src = url;
                emb.type = 'application/pdf';
                emb.style.cssText = 'width:100%;height:100%;border:none;';
                cw.appendChild(emb);
                return;
            }

            f.arrayBuffer().then(function(buf) {
                var finfo = self._identifyFileFromBuf(buf, f.name, f.size, f.lastModified);
                if (!finfo.isText) {
                    self._fileTitleEl.textContent = nm2;
                    self._setBadge(self._EXT_CAT[ext.slice(1)] || 'unk', self._fmtLabel(nm));
                    self._showContent(
                        '<div style="display:flex;flex-direction:column;align-items:center;' +
                        'justify-content:center;height:100%;color:#94a3b8;gap:8px;">' +
                        '<div>\u274c</div>' +
                        '<div style="font-size:14px;font-weight:500;">' + self.TEXTS.NO_PREVIEW + '</div>' +
                        '<div style="font-size:12px;color:#475569;">' +
                        finfo.confidence + '<br>' + finfo.sizeStr + ' \u00b7 ' + finfo.timeStr + '</div></div>');
                    return;
                }
                var text = new TextDecoder(finfo.encoding, { fatal: false }).decode(buf);
                var st = self._textStats(text);
                var infoParts = [finfo.sizeStr, finfo.timeStr, finfo.encoding.toUpperCase()];
                infoParts.push(st.chars + '\u5b57', st.lines + '\u884c', st.pages + '\u9875');
                self._fileTitleEl.textContent = nm2;
                self._setBadge(self._catOf(nm), self._fmtLabel(nm) + ' \u00b7 ' + finfo.encoding.toUpperCase());
                self.vert = false;
                self._rawText = text;

                // 渲染内容
                var cw = self._contentEl;
                var tb = document.createElement('div');
                tb.style.cssText = 'display:flex;align-items:center;justify-content:flex-end;gap:6px;' +
                    'padding:6px 14px;border-bottom:1px solid rgba(100,160,255,.04);flex-shrink:0;';
                var eb = document.createElement('button');
                eb.textContent = '\u270f\ufe0f ' + self.TEXTS.BTN_EDIT;
                eb.className = 'br-edit-btn';
                eb.style.cssText = 'padding:3px 10px;border-radius:6px;border:none;' +
                    'background:transparent;cursor:pointer;font-size:11px;color:#38bdf8;' +
                    'font-family:inherit;transition:.12s;white-space:nowrap;';
                eb.onmouseenter = function() { eb.style.background = 'rgba(56,189,248,.1)'; };
                eb.onmouseleave = function() { eb.style.background = 'transparent'; };
                eb.onclick = function() { self._toggleEdit(); };
                tb.appendChild(eb);

                var vb = document.createElement('button');
                vb.textContent = self.TEXTS.BTN_VERTICAL;
                vb.className = 'br-vert-btn';
                vb.style.cssText = 'padding:3px 10px;border-radius:6px;border:none;' +
                    'background:transparent;cursor:pointer;font-size:11px;color:#94a3b8;' +
                    'font-family:inherit;transition:.12s;white-space:nowrap;';
                vb.onmouseenter = function() { vb.style.background = 'rgba(255,255,255,.03)'; };
                vb.onmouseleave = function() { vb.style.background = 'transparent'; };
                vb.onclick = function() { self._toggleV(); };
                tb.appendChild(vb);

                var fsDown = document.createElement('button');
                fsDown.textContent = 'A-';
                fsDown.style.cssText = 'padding:3px 8px;border-radius:6px;border:none;' +
                    'background:transparent;cursor:pointer;font-size:11px;color:#94a3b8;' +
                    'font-family:inherit;transition:.12s;';
                fsDown.onmouseenter = function() { fsDown.style.background = 'rgba(255,255,255,.03)'; };
                fsDown.onmouseleave = function() { fsDown.style.background = 'transparent'; };
                fsDown.onclick = function() { self._fs(-1); };
                tb.appendChild(fsDown);

                var fsUp = document.createElement('button');
                fsUp.textContent = 'A+';
                fsUp.style.cssText = 'padding:3px 8px;border-radius:6px;border:none;' +
                    'background:transparent;cursor:pointer;font-size:11px;color:#94a3b8;' +
                    'font-family:inherit;transition:.12s;';
                fsUp.onmouseenter = function() { fsUp.style.background = 'rgba(255,255,255,.03)'; };
                fsUp.onmouseleave = function() { fsUp.style.background = 'transparent'; };
                fsUp.onclick = function() { self._fs(1); };
                tb.appendChild(fsUp);

                var d = document.createElement('div');
                d.className = 'br-ct';
                d.style.fontSize = self.fsVal + 'px';
                if (ext === '.md') {
                    self._renderMD(text, fp).then(function(html) { d.innerHTML = html; });
                } else {
                    d.textContent = text;
                }
                self.editMode = false;
                cw.innerHTML = '';
                cw.appendChild(tb);
                cw.appendChild(d);

                // 更新信息栏
                if (self._infoEl) {
                    self._infoEl.textContent = finfo.confidence + ' | ' + infoParts.join(' \u00b7 ');
                }

            }).catch(function(e) {
                self._showContent('\u274c ' + self.TEXTS.LOAD_FAILED + ': ' + e.message);
            });
        }).catch(function(e) {
            self._showContent('\u274c ' + self.TEXTS.LOAD_FAILED + ': ' + e.message);
        });
    },

    _toggleEdit: function() {
        var cw = this._contentEl;
        var btn = cw.querySelector('.br-edit-btn');
        var self = this;
        if (!this.editMode) {
            var txt = this._rawText || '';
            var tb = document.createElement('div');
            tb.style.cssText = 'display:flex;align-items:center;justify-content:flex-end;gap:6px;' +
                'padding:6px 14px;border-bottom:1px solid rgba(100,160,255,.04);flex-shrink:0;';
            var sb = document.createElement('button');
            sb.textContent = '\ud83d\udcbe ' + this.TEXTS.BTN_SAVE;
            sb.className = 'br-edit-btn';
            sb.style.cssText = 'padding:3px 10px;border-radius:6px;border:none;' +
                'background:rgba(56,189,248,.15);cursor:pointer;font-size:11px;color:#38bdf8;' +
                'font-weight:500;font-family:inherit;';
            sb.onclick = function() { self._saveFile(); };
            tb.appendChild(sb);
            var ta = document.createElement('textarea');
            ta.className = 'br-edit-area';
            ta.value = txt;
            cw.innerHTML = '';
            cw.appendChild(tb);
            cw.appendChild(ta);
            this.editMode = true;
            ta.focus();
            ta.scrollTop = 0;
        } else {
            this._saveFile();
        }
    },

    _saveFile: function() {
        var self = this;
        if (!this.curPath || !this.editMode) return;
        var ta = this._contentEl.querySelector('.br-edit-area');
        if (!ta) return;
        var content = ta.value;
        var handle = this.fileMap[this.curPath];
        if (!handle) { alert(this.TEXTS.HANDLE_LOST); return; }

        this._ensureRW().then(function(ok) {
            if (!ok) { alert(self.TEXTS.NEED_WRITE_SAVE); return; }
            var encoder = new TextEncoder();
            var uint8 = encoder.encode(content);
            handle.createWritable().then(function(writable) {
                writable.write(uint8).then(function() {
                    return writable.close();
                }).then(function() {
                    self.editMode = false;
                    self._rawText = content;
                    var ext = self.curPath.includes('.') ? self.curPath.slice(self.curPath.lastIndexOf('.')).toLowerCase() : '';
                    var nm = self.curPath.split('/').pop().replace(/\.[^.]+$/i, '');
                    var cw = self._contentEl;
                    var tb = document.createElement('div');
                    tb.style.cssText = 'display:flex;align-items:center;justify-content:flex-end;' +
                        'gap:6px;padding:6px 14px;border-bottom:1px solid rgba(100,160,255,.04);flex-shrink:0;';
                    var eb = document.createElement('button');
                    eb.textContent = '\u270f\ufe0f ' + self.TEXTS.BTN_EDIT;
                    eb.className = 'br-edit-btn';
                    eb.style.cssText = 'padding:3px 10px;border-radius:6px;border:none;' +
                        'background:transparent;cursor:pointer;font-size:11px;color:#38bdf8;' +
                        'font-family:inherit;transition:.12s;';
                    eb.onmouseenter = function() { eb.style.background = 'rgba(56,189,248,.1)'; };
                    eb.onmouseleave = function() { eb.style.background = 'transparent'; };
                    eb.onclick = function() { self._toggleEdit(); };
                    tb.appendChild(eb);

                    var vb = document.createElement('button');
                    vb.textContent = self.TEXTS.BTN_VERTICAL;
                    vb.className = 'br-vert-btn' + (self.vert ? ' br-act' : '');
                    vb.style.cssText = 'padding:3px 10px;border-radius:6px;border:none;' +
                        'background:transparent;cursor:pointer;font-size:11px;color:#94a3b8;' +
                        'font-family:inherit;transition:.12s;white-space:nowrap;';
                    vb.onmouseenter = function() { vb.style.background = 'rgba(255,255,255,.03)'; };
                    vb.onmouseleave = function() { vb.style.background = 'transparent'; };
                    vb.onclick = function() { self._toggleV(); };
                    tb.appendChild(vb);

                    var fsDown = document.createElement('button');
                    fsDown.textContent = 'A-';
                    fsDown.style.cssText = 'padding:3px 8px;border-radius:6px;border:none;' +
                        'background:transparent;cursor:pointer;font-size:11px;color:#94a3b8;' +
                        'font-family:inherit;transition:.12s;';
                    fsDown.onmouseenter = function() { fsDown.style.background = 'rgba(255,255,255,.03)'; };
                    fsDown.onmouseleave = function() { fsDown.style.background = 'transparent'; };
                    fsDown.onclick = function() { self._fs(-1); };
                    tb.appendChild(fsDown);

                    var fsUp = document.createElement('button');
                    fsUp.textContent = 'A+';
                    fsUp.style.cssText = 'padding:3px 8px;border-radius:6px;border:none;' +
                        'background:transparent;cursor:pointer;font-size:11px;color:#94a3b8;' +
                        'font-family:inherit;transition:.12s;';
                    fsUp.onmouseenter = function() { fsUp.style.background = 'rgba(255,255,255,.03)'; };
                    fsUp.onmouseleave = function() { fsUp.style.background = 'transparent'; };
                    fsUp.onclick = function() { self._fs(1); };
                    tb.appendChild(fsUp);

                    var d = document.createElement('div');
                    d.className = 'br-ct' + (self.vert ? ' br-v' : '');
                    d.style.fontSize = self.fsVal + 'px';
                    if (ext === '.md') {
                        self._renderMD(content, self.curPath).then(function(html) { d.innerHTML = html; });
                    } else {
                        d.textContent = content;
                    }
                    cw.innerHTML = '';
                    cw.appendChild(tb);
                    cw.appendChild(d);
                    self._fileTitleEl.textContent = nm + '  ' + self.TEXTS.SAVE_SUCCESS + ' \u2713';
                }).catch(function(e) {
                    alert(self.TEXTS.SAVE_FAILED + ': ' + e.message);
                });
            }).catch(function(e) {
                alert(self.TEXTS.SAVE_FAILED + ': ' + e.message);
            });
        });
    },

    _ensureRW: function() {
        var self = this;
        if (!this.rootDir) return Promise.resolve(false);
        return this.rootDir.queryPermission({ mode: 'readwrite' }).then(function(s) {
            if (s === 'granted') return true;
            return self.rootDir.requestPermission({ mode: 'readwrite' }).then(function(s2) {
                return s2 === 'granted';
            });
        }).catch(function() { return false; });
    },

    // ── 删除 ──

    _delFile: function(fp) {
        var self = this;
        var nm = fp.split('/').pop();
        if (!confirm(this._fmt(this.TEXTS.CONFIRM_DEL_FILE, nm))) return;
        this._ensureRW().then(function(ok) {
            if (!ok) { alert(self.TEXTS.NEED_WRITE_PERM); return; }
            var h = self.fileMap[fp];
            if (!h) return;
            h.remove().then(function() {
                delete self.fileMap[fp];
                var i = self.allPaths.indexOf(fp);
                if (i >= 0) self.allPaths.splice(i, 1);
                self._buildTree();
                if (self.curPath === fp) self._hideReader();
            }).catch(function(e) {
                alert(self.TEXTS.SAVE_FAILED + ': ' + e.message);
            });
        });
    },

    _delDir: function(fp) {
        var self = this;
        var nm = fp.split('/').pop();
        if (!confirm(this._fmt(this.TEXTS.CONFIRM_DEL_DIR, nm))) return;
        this._ensureRW().then(function(ok) {
            if (!ok) { alert(self.TEXTS.NEED_WRITE_PERM); return; }
            var parts = fp.split('/');
            var dir = self.rootDir;
            var chain = Promise.resolve();
            parts.forEach(function(p) {
                chain = chain.then(function() { return dir.getDirectoryHandle(p); });
            });
            chain.then(function(h) {
                return h.remove({ recursive: true });
            }).then(function() {
                self.fileMap = {};
                self.allPaths = [];
                return self._scan(self.rootDir, '');
            }).then(function() {
                self._buildTree();
                if (self.curPath && self.curPath.startsWith(fp + '/')) self._hideReader();
            }).catch(function(e) {
                alert(self.TEXTS.SAVE_FAILED + ': ' + e.message);
            });
        });
    },

    // ── 内容区域 ──

    _showContent: function(html) {
        if (this._contentEl) {
            this._contentEl.innerHTML =
                '<div style="display:flex;flex-direction:column;align-items:center;' +
                'justify-content:center;height:100%;color:#94a3b8;gap:8px;padding:20px;text-align:center;">' +
                html + '</div>';
        }
    },

    _hideReader: function() {
        this._headerEl.style.display = 'none';
        this.curPath = null;
        this.curIdx = -1;
        this._renderWelcome();
    },

    _renderWelcome: function() {
        var self = this;
        var T = this.TEXTS;
        var CAT_ICONS = {
            doc:'\ud83d\udcc4', office:'\ud83d\udcca', code:'\ud83d\udcbb', data:'\ud83d\udccb',
            web:'\ud83c\udf10', img:'\ud83d\uddbc', audio:'\ud83c\udfb5', video:'\ud83c\udfac',
            archive:'\ud83d\udce6', mail:'\u2709\ufe0f', ebook:'\ud83d\udcd6', cad:'\ud83d\udcd0',
            eda:'\ud83d\udd0c', draw:'\u270f\ufe0f',
        };
        var html = '<div style="font-size:28px;opacity:.25;">\ud83d\udcd6</div>' +
            '<div style="font-size:18px;font-weight:600;color:#cbd5e1;">' + T.TITLE + '</div>' +
            '<div style="font-size:12px;color:#475569;margin-bottom:6px;">' + T.SUBTITLE + '</div>' +
            '<div style="font-size:12px;color:#94a3b8;">' + T.EMPTY_READER + '</div>' +
            '<div class="br-fmt-sc" style="width:100%;max-width:580px;margin:12px auto 0;text-align:left;">';

        Object.keys(this.FILE_CATS).forEach(function(cat) {
            var v = self.FILE_CATS[cat];
            var color = self.CAT_COLORS[cat] || '#5f6368';
            html += '<div style="margin:4px 0 2px;display:flex;align-items:center;gap:4px;font-size:10px;font-weight:600;flex-wrap:wrap;">' +
                '<span style="padding:1px 6px;border-radius:4px;flex-shrink:0;' +
                'background:' + color + '15;color:' + color + ';">' + (CAT_ICONS[cat] || '') + ' ' + v.label + '</span>' +
                '<span style="font-weight:400;font-size:9px;color:#475569;">(' + v.exts.length + '\u79cd)</span></div><div>';
            v.exts.forEach(function(e) {
                var lb = self._EXT_LABEL[e] || e.toUpperCase();
                html += '<span style="display:inline-flex;align-items:center;gap:2px;padding:1px 5px;' +
                    'margin:1px;border-radius:4px;font-size:9px;white-space:nowrap;color:#64748b;transition:.1s;">' +
                    self._esc(lb) + '</span>';
            });
            html += '</div>';
        });

        var totalExts = 0;
        Object.keys(this.FILE_CATS).forEach(function(cat) {
            totalExts += self.FILE_CATS[cat].exts.length;
        });
        html += '<div style="text-align:center;margin-top:8px;font-size:9px;color:#475569;">' +
            self._fmt(T.FORMAT_SHOWCASE_TITLE, totalExts) + '</div></div>';

        this._showContent(html);
    },

    _setBadge: function(cat, label) {
        if (!this._fmtBadgeEl) return;
        var color = this.CAT_COLORS[cat] || '#5f6368';
        var catLabel = this.FILE_CATS[cat] ? this.FILE_CATS[cat].label : '';
        this._fmtBadgeEl.innerHTML =
            '<span style="padding:2px 8px;border-radius:5px;font-size:9px;font-weight:600;' +
            'letter-spacing:.2px;flex-shrink:0;white-space:nowrap;' +
            'background:' + color + '20;color:' + color + ';">' +
            (catLabel ? catLabel + ' \u00b7 ' : '') + this._esc(label) + '</span>';
    },

    _toggleV: function() {
        var e = this._contentEl ? this._contentEl.querySelector('.br-ct') : null;
        if (!e) return;
        this.vert = !this.vert;
        e.classList.toggle('br-v', this.vert);
        var btn = this._contentEl.querySelector('.br-vert-btn');
        if (btn) btn.classList.toggle('br-act', this.vert);
    },

    _fs: function(d) {
        this.fsVal = Math.max(12, Math.min(32, this.fsVal + d));
        var e = this._contentEl ? this._contentEl.querySelector('.br-ct') : null;
        if (e) e.style.fontSize = this.fsVal + 'px';
    },

    // ── 文件识别 ──

    _identifyFileFromBuf: function(buf, name, size, lastModified) {
        var raw = new Uint8Array(buf);
        var info = {
            size: size,
            lastModified: new Date(lastModified),
            ext: name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '',
            isText: true,
            encoding: 'utf-8',
            confidence: '',
            sizeStr: '',
            timeStr: '',
        };

        info.sizeStr = info.size < 1024 ? info.size + ' B' :
            info.size < 1048576 ? (info.size / 1024).toFixed(1) + ' KB' :
            (info.size / 1048576).toFixed(1) + ' MB';

        var d = info.lastModified;
        info.timeStr = d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0') + ' ' +
            String(d.getHours()).padStart(2, '0') + ':' +
            String(d.getMinutes()).padStart(2, '0');

        // Magic byte 检测
        var isBinary = raw.length > 0 && (
            (raw.length >= 2 && raw[0] === 0xFF && raw[1] === 0xD8) ||
            (raw.length >= 4 && raw[0] === 0x89 && raw[1] === 0x50 && raw[2] === 0x4E && raw[3] === 0x47) ||
            (raw.length >= 4 && raw[0] === 0x47 && raw[1] === 0x49 && raw[2] === 0x46 && raw[3] === 0x38) ||
            (raw.length >= 4 && raw[0] === 0x25 && raw[1] === 0x50 && raw[2] === 0x44 && raw[3] === 0x46) ||
            (raw.length >= 4 && raw[0] === 0x52 && raw[1] === 0x49 && raw[2] === 0x46 && raw[3] === 0x46) ||
            (raw.length >= 4 && ((raw[0] === 0x00 && raw[1] === 0x00 && raw[2] === 0x01 && raw[3] === 0x00) || (raw[0] === 0x00 && raw[1] === 0x00 && raw[2] === 0x02 && raw[3] === 0x00))) ||
            (raw.length >= 4 && raw[0] === 0x1A && raw[1] === 0x45 && raw[2] === 0xDF && raw[3] === 0xA3) ||
            (raw.length >= 2 && raw[0] === 0x1F && raw[1] === 0x8B) ||
            (raw.length >= 4 && raw[0] === 0x50 && raw[1] === 0x4B && raw[2] === 0x03 && raw[3] === 0x04) ||
            (raw.length >= 4 && raw[0] === 0xD0 && raw[1] === 0xCF && raw[2] === 0x11 && raw[3] === 0xE0) ||
            (raw.length >= 2 && raw[0] === 0x42 && raw[1] === 0x4D) ||
            (raw.length >= 4 && raw[0] === 0x4D && raw[1] === 0x5A) ||
            (raw.length >= 4 && raw[0] === 0x49 && raw[1] === 0x49 && raw[2] === 0x2A && raw[3] === 0x00) ||
            (raw.length >= 4 && raw[0] === 0x4D && raw[1] === 0x4D && raw[2] === 0x00 && raw[3] === 0x2A) ||
            (raw.length >= 4 && raw[0] === 0x66 && raw[1] === 0x4C && raw[2] === 0x61 && raw[3] === 0x43) ||
            (raw.length >= 3 && raw[0] === 0x49 && raw[1] === 0x44 && raw[2] === 0x33) ||
            (raw.length >= 4 && ((raw[0] === 0x4F && raw[1] === 0x67 && raw[2] === 0x67 && raw[3] === 0x53) || (raw[0] === 0x4F && raw[1] === 0x67 && raw[2] === 0x67 && raw[3] === 0x48))) ||
            (raw.length >= 8 && raw[0] === 0x52 && raw[1] === 0x49 && raw[2] === 0x46 && raw[3] === 0x46 && raw[8] === 0x57 && raw[9] === 0x41 && raw[10] === 0x56 && raw[11] === 0x45) ||
            (raw.length >= 4 && raw[0] === 0x66 && raw[1] === 0x74 && raw[2] === 0x79 && raw[3] === 0x70) ||
            (raw.length >= 4 && raw[0] === 0x30 && raw[1] === 0x26 && raw[2] === 0xB2 && raw[3] === 0x75) ||
            (raw.length >= 7 && raw[0] === 0x52 && raw[1] === 0x61 && raw[2] === 0x72 && raw[3] === 0x21 && raw[4] === 0x1A && raw[5] === 0x07) ||
            (raw.length >= 5 && raw[0] === 0x25 && raw[1] === 0x21 && raw[2] === 0x50 && raw[3] === 0x53) ||
            (raw.length >= 2 && raw[0] === 0x1F && raw[1] === 0x9D) ||
            (raw.length >= 4 && raw[0] === 0xFD && raw[1] === 0x37 && raw[2] === 0x7A && raw[3] === 0x58) ||
            (raw.length >= 4 && raw[0] === 0x28 && raw[1] === 0xB5 && raw[2] === 0x2F && raw[3] === 0xFD) ||
            (raw.length >= 4 && raw[0] === 0x4C && raw[1] === 0x5A && raw[2] === 0x49 && raw[3] === 0x50) ||
            (raw.length >= 4 && raw[0] === 0x4F && raw[1] === 0x54 && raw[2] === 0x54 && raw[3] === 0x4F) ||
            (raw.length >= 4 && raw[0] === 0x77 && raw[1] === 0x76 && raw[2] === 0x70 && raw[3] === 0x6B) ||
            (raw.length >= 3 && raw[0] === 0x43 && raw[1] === 0x57 && raw[2] === 0x53)
        );

        if (isBinary) { info.isText = false; info.confidence = '\u26a0\ufe0f \u4e8c\u8fdb\u5236\u6587\u4ef6\u5934'; return info; }

        if (raw.length === 0) { info.confidence = '\u26a0\ufe0f \u7a7a\u6587\u4ef6'; info.isText = false; return info; }

        var scanLen = Math.min(raw.length, 4096);
        var nulls = 0, ctrl = 0, printable = 0;
        for (var i = 0; i < scanLen; i++) {
            var b = raw[i];
            if (b === 0) nulls++;
            else if (b < 0x20 && b !== 0x09 && b !== 0x0A && b !== 0x0D) ctrl++;
            else if (b >= 0x20 && b <= 0x7E) printable++;
        }
        var ratio = scanLen > 0 ? printable / scanLen : 0;
        if (nulls > scanLen * 0.02) { info.isText = false; info.confidence = '\u274c \u542b\u5927\u91cf null \u5b57\u8282'; return info; }
        if (ctrl > scanLen * 0.1 && ratio < 0.5) { info.isText = false; info.confidence = '\u274c \u975e\u6587\u672c\u5185\u5bb9'; return info; }

        info.confidence = ratio > 0.8 ? '\u2705 \u7eaf\u6587\u672c' : ratio > 0.5 ? '\ud83d\udd36 \u6df7\u5408\u5185\u5bb9' : '\u26a0\ufe0f \u53ef\u7591';

        // 编码检测
        var len = Math.min(raw.length, 50000);
        if (len >= 2 && raw[0] === 0xFF && raw[1] === 0xFE) { info.encoding = 'utf-16le'; return info; }
        if (len >= 2 && raw[0] === 0xFE && raw[1] === 0xFF) { info.encoding = 'utf-16be'; return info; }

        var gbk = 0, u8 = 0;
        for (var j = 0; j < len - 1; j++) {
            var bj = raw[j];
            if (bj < 0x80) continue;
            if (bj >= 0xE0 && bj <= 0xEF && j + 2 < len && raw[j+1] >= 0x80 && raw[j+1] <= 0xBF && raw[j+2] >= 0x80 && raw[j+2] <= 0xBF) { u8++; j += 2; continue; }
            if (bj >= 0x81 && bj <= 0xFE) { var b2 = raw[j+1]; if ((b2 >= 0x40 && b2 <= 0x7E) || (b2 >= 0x80 && b2 <= 0xFE)) { gbk++; j++; continue; } }
        }
        info.encoding = (gbk > u8 * 2 && gbk > 5) ? 'gbk' : 'utf-8';
        return info;
    },

    // ── 文本统计 ──

    _textStats: function(text) {
        var chars = text.length;
        var charsNoSpace = text.replace(/\s/g, '').length;
        var lines = text.split(/\r?\n/).length;
        var cjk = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/g) || []).length;
        var words_en = (text.match(/[a-zA-Z0-9]+(?:[''-][a-zA-Z0-9]+)*/g) || []).length;
        var paras = text.split(/\n\s*\n/).filter(function(p) { return p.trim(); }).length;
        var pages = Math.max(1, Math.round(chars / 1500));
        return { chars: chars, charsNoSpace: charsNoSpace, lines: lines, cjk: cjk, words_en: words_en, paras: paras, pages: pages };
    },

    // ── Markdown 渲染 ──

    _renderMD: function(text, fp) {
        var self = this;
        var dir = fp.includes('/') ? fp.slice(0, fp.lastIndexOf('/')) : '';
        var imgRE = /!\[([^\]]*)\]\(([^)]+)\)/g;
        var imgs = [], m;
        while ((m = imgRE.exec(text)) !== null) imgs.push({ alt: m[1], src: m[2] });

        var imgMap = {};
        var chain = Promise.resolve();
        imgs.forEach(function(img) {
            if (img.src.startsWith('http://') || img.src.startsWith('https://') || img.src.startsWith('data:')) return;
            var relPath = dir ? dir + '/' + img.src : img.src;
            var h = self.fileMap[relPath];
            if (h) {
                chain = chain.then(function() {
                    return h.getFile().then(function(file) {
                        imgMap[img.src] = URL.createObjectURL(file);
                    }).catch(function() {});
                });
            }
        });

        return chain.then(function() {
            var html = text
                .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
                .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
                .replace(/`([^`]+)`/g, '<code>$1</code>')
                .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(_, alt, src) {
                    var url = imgMap[src] || src;
                    return '<img src="' + self._escA(url) + '" alt="' + self._esc(alt) + '" ' +
                        'style="max-width:100%;border-radius:6px;margin:12px 0">';
                })
                .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" style="color:#38bdf8;">$1</a>')
                .replace(/^###### (.*$)/gm, '<h6>$1</h6>')
                .replace(/^##### (.*$)/gm, '<h5>$1</h5>')
                .replace(/^#### (.*$)/gm, '<h4>$1</h4>')
                .replace(/^### (.*$)/gm, '<h3>$1</h3>')
                .replace(/^## (.*$)/gm, '<h2>$1</h2>')
                .replace(/^# (.*$)/gm, '<h1>$1</h1>')
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/\*(.+?)\*/g, '<em>$1</em>')
                .replace(/^- (.*$)/gm, '<li>$1</li>')
                .replace(/\n/g, '<br>');
            return html;
        });
    },

    // ── 工具函数 ──

    _fmt: function(str, a, b) {
        return str.replace('{0}', a != null ? a : '').replace('{1}', b != null ? b : '');
    },

    _esc: function(s) {
        var d = document.createElement('div');
        d.textContent = s;
        return d.innerHTML;
    },

    _escA: function(s) {
        return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    },

    _hl: function(t, q) {
        var i = t.toLowerCase().indexOf(q);
        if (i < 0) return this._esc(t);
        return this._esc(t.slice(0, i)) + '<mark style="background:rgba(56,189,248,.15);color:#38bdf8;border-radius:2px;padding:0 2px;">' +
            this._esc(t.slice(i, i + q.length)) + '</mark>' +
            this._esc(t.slice(i + q.length));
    },
};

/* ===== 样式（IIFE 注入，避免 CSS 变量） ===== */
(function() {
    var s = document.createElement('style');
    s.textContent =

        /* ── 通用滚动条 ── */
        '.br-tree::-webkit-scrollbar, .br-cw::-webkit-scrollbar { width:4px; }' +
        '.br-tree::-webkit-scrollbar-thumb, .br-cw::-webkit-scrollbar-thumb { background:rgba(56,189,248,.12);border-radius:2px; }' +

        /* ── 搜索框 ── */
        '.br-search:focus { background:rgba(0,0,0,.35); }' +
        '.br-search::placeholder { color:#475569; }' +

        /* ── 文件树条目 ── */
        '.br-tr { display:flex;align-items:center;gap:2px;padding:3px 8px;' +
            'cursor:pointer;font-size:11px;color:#94a3b8;transition:.1s;border-radius:0; }' +
        '.br-tr:hover { background:rgba(255,255,255,.03); }' +
        '.br-tr.br-act { background:rgba(56,189,248,.08);color:#38bdf8;font-weight:500; }' +
        '.br-tr:hover .br-del-file, .br_tr:hover .br-del-dir { opacity:.4 !important; }' +
        '.br-del-file:hover, .br-del-dir:hover { opacity:1 !important;background:rgba(232,112,96,.08) !important; }' +
        '.br-ch { display:none; }' +
        '.br-ch.br-op { display:block; }' +
        '.br-ch .br-tr { padding-left:24px !important; }' +
        '.br-ch .br-ch .br-tr { padding-left:36px !important; }' +

        /* ── 内容区 ── */
        '.br-ct { padding:24px 28px 60px;max-width:700px;margin:0 auto;line-height:2;' +
            'color:#e8edf5;white-space:pre-wrap;word-break:break-word;' +
            'font-family:"Noto Serif SC","Source Han Serif SC",STSong,SimSun,"Songti SC",Georgia,serif; }' +
        '.br-ct img { max-width:100%;border-radius:8px;margin:16px 0;box-shadow:0 2px 12px rgba(0,0,0,.2); }' +
        '.br-ct pre { background:rgba(0,0,0,.2);border-radius:8px;padding:16px;overflow-x:auto;margin:12px 0; }' +
        '.br-ct code { font-size:13px;background:rgba(0,0,0,.2);padding:2px 6px;border-radius:4px;color:#a0e8a0; }' +
        '.br-ct pre code { background:none;padding:0;font-size:13px;line-height:1.6; }' +
        '.br-ct h1,.br-ct h2,.br-ct h3,.br-ct h4 { margin:20px 0 8px;font-weight:600;color:#e8edf5; }' +
        '.br-ct h1 { font-size:22px; }.br-ct h2 { font-size:19px; }.br-ct h3 { font-size:17px; }.br-ct h4 { font-size:15px; }' +
        '.br-ct li { margin:2px 0 2px 20px;list-style:disc; }' +
        '.br-ct a { color:#38bdf8;text-decoration:none; }.br-ct a:hover { text-decoration:underline; }' +
        '.br-ct.br-v { writing-mode:vertical-rl;max-width:none;padding:28px 32px;height:100%;overflow-y:auto;line-height:1.8;font-size:17px; }' +

        /* ── 编辑区 ── */
        '.br-edit-area { width:100%;height:100%;border:none;outline:none;resize:none;' +
            'padding:24px 28px;font-size:14px;' +
            'font-family:"SF Mono","Fira Code","Cascadia Code",monospace;line-height:1.7;' +
            'color:#e8edf5;background:rgba(0,0,0,.1);tab-size:2; }' +
        '.br-edit-area:focus { box-shadow:inset 0 0 0 1px rgba(56,189,248,.3); }' +

        /* ── 加载动画 ── */
        '.br-ld { display:flex;align-items:center;justify-content:center;height:100%;color:#94a3b8;gap:8px; }' +
        '.br-sp { width:14px;height:14px;border:2px solid rgba(56,189,248,.15);' +
            'border-top-color:#38bdf8;border-radius:50%;animation:br-spin .6s linear infinite; }' +
        '@keyframes br-spin { to { transform:rotate(360deg); } }' +

        /* ── 按钮激活 ── */
        '.br-vert-btn.br-act { background:rgba(56,189,248,.1) !important;color:#38bdf8 !important;font-weight:500; }' +

        /* ── 类别颜色 ── */
        '.br-ti-tag { font-size:9px;padding:0 5px;border-radius:3px;flex-shrink:0;margin-right:2px;font-weight:500; }' +

        ''; // 末尾方便追加

    document.head.appendChild(s);
})();
