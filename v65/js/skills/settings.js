/**
 * ============================================
 *   设置面板 - 固定功能（非插件）
 *   右上角 ⚙️ 按钮触发
 * ============================================
 */

var SettingsPanel = (function() {

    var _overlay = null;
    var _defaultBgColor = '#0a0e1a';
    var DB_NAME = 'EditorSettingsDB';
    var DB_VER = 1;
    var STORE = 'settings';

    // ===== IndexedDB 辅助方法 =====

    function _openDB() {
        return new Promise(function(res, rej) {
            var r = indexedDB.open(DB_NAME, DB_VER);
            r.onupgradeneeded = function(e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
            };
            r.onsuccess = function(e) { res(e.target.result); };
            r.onerror = function(e) { rej(e); };
        });
    }

    function _saveSetting(key, value) {
        _openDB().then(function(db) {
            var tx = db.transaction(STORE, 'readwrite');
            tx.objectStore(STORE).put(value, key);
        }).catch(function() {});
    }

    function _loadSetting(key) {
        return _openDB().then(function(db) {
            return new Promise(function(res) {
                var tx = db.transaction(STORE, 'readonly');
                var req = tx.objectStore(STORE).get(key);
                req.onsuccess = function() { res(req.result !== undefined ? req.result : null); };
                req.onerror = function() { res(null); };
            });
        }).catch(function() { return null; });
    }

    // ===== 初始化（main.js 启动时调用） =====

    function init() {
        var btn = document.getElementById('cos-btn-settings');
        if (btn) {
            btn.addEventListener('click', function() {
                show();
            });
        }
        loadSettings();
    }

    // ===== 面板显示/隐藏 =====

    function show() {
        close();
        var panel = createPanel();
        document.body.appendChild(panel);
        _overlay = panel;
        bindEvents(panel);
    }

    function close() {
        if (_overlay && _overlay.parentNode) {
            _overlay.parentNode.removeChild(_overlay);
        }
        _overlay = null;
    }

    // ===== 背景颜色 =====

    function getBgColor() {
        var world = document.getElementById('cos-world');
        return world ? (world.dataset.bgColor || _defaultBgColor) : _defaultBgColor;
    }

    function setBgColor(color) {
        var world = document.getElementById('cos-world');
        if (world) {
            world.style.backgroundColor = color;
            world.dataset.bgColor = color;
        }
        _saveSetting('editorBackgroundColor', color);
    }

    // ===== 网格 =====

    function showGrid() {
        if (typeof GameWorld !== 'undefined') GameWorld.showGrid();
        _saveSetting('editorGridVisible', 'true');
    }

    function hideGrid() {
        if (typeof GameWorld !== 'undefined') GameWorld.hideGrid();
        _saveSetting('editorGridVisible', 'false');
    }

    function isGridVisible() {
        if (typeof GameWorld !== 'undefined') return GameWorld.isGridVisible();
        return false;
    }

    // ===== 加载/重置 =====

    async function loadSettings() {
        var savedColor = await _loadSetting('editorBackgroundColor');
        if (savedColor) setBgColor(savedColor);

        var savedGrid = await _loadSetting('editorGridVisible');
        if (savedGrid === 'true') {
            showGrid();
        } else if (savedGrid === 'false') {
            hideGrid();
        }
    }

    function resetAll() {
        setBgColor(_defaultBgColor);
        showGrid();
        showToast('所有设置已重置');
        close();
        show();
    }

    // ===== 面板构建 =====

    function createPanel() {
        var overlay = document.createElement('div');
        overlay.id = 'settings-skill-overlay';
        overlay.style.cssText =
            'position:fixed;top:0;left:0;width:100%;height:100%;' +
            'background:rgba(0,0,0,0.5);z-index:9998;' +
            'display:flex;align-items:center;justify-content:center;' +
            'animation:settingsFadeIn 0.2s ease;';

        var styleEl = document.createElement('style');
        styleEl.textContent =
            '@keyframes settingsFadeIn { from { opacity: 0; } to { opacity: 1; } }' +
            '@keyframes settingsSlideIn { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }';
        overlay.appendChild(styleEl);

        var panel = document.createElement('div');
        panel.style.cssText =
            'background:rgba(15,25,50,0.98);border:1px solid rgba(100,160,255,0.25);' +
            'border-radius:18px;padding:0;max-width:480px;width:90%;' +
            'max-height:85vh;overflow:hidden;' +
            'box-shadow:0 8px 40px rgba(0,0,0,0.5),inset 0 1px 0 rgba(100,160,255,0.08);' +
            'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
            'animation:settingsSlideIn 0.25s ease;';

        panel.innerHTML =
            '<div style="display:flex;align-items:center;justify-content:space-between;' +
            'padding:16px 20px;background:rgba(56,189,248,0.1);border-bottom:1px solid rgba(100,160,255,0.15);">' +
                '<span style="color:#38bdf8;font-size:18px;font-weight:bold;">⚙️ 设置</span>' +
                '<button id="settings-close-btn" style="background:rgba(220,80,60,0.2);border:1px solid rgba(220,80,60,0.3);' +
                'color:#e87060;border-radius:10px;padding:6px 14px;cursor:pointer;font-size:13px;transition:all 0.15s;">✕ 关闭</button>' +
            '</div>' +
            '<div style="padding:20px;overflow-y:auto;max-height:calc(85vh - 60px);">' +
                '<div style="margin-bottom:24px;">' +
                    '<h3 style="color:#38bdf8;margin:0 0 14px 0;font-size:15px;font-weight:bold;' +
                    'border-bottom:1px solid rgba(100,160,255,0.15);padding-bottom:8px;">基本设置</h3>' +
                    // 背景颜色
                    '<div style="display:flex;align-items:center;justify-content:space-between;' +
                    'padding:14px 16px;background:rgba(10,18,35,0.6);border-radius:12px;' +
                    'border:1px solid rgba(255,255,255,0.06);margin-bottom:12px;">' +
                        '<div>' +
                            '<div style="color:#e8edf5;font-size:14px;font-weight:bold;">🎨 背景颜色</div>' +
                            '<div style="color:#94a3b8;font-size:12px;margin-top:2px;">自定义画布背景色</div>' +
                        '</div>' +
                        '<div style="display:flex;align-items:center;gap:10px;">' +
                            '<input type="color" id="settings-bg-color" value="' + getBgColor() + '" ' +
                            'style="width:44px;height:34px;border:2px solid rgba(100,160,255,0.25);border-radius:10px;' +
                            'cursor:pointer;background:transparent;padding:0;">' +
                            '<button id="settings-reset-color" style="background:rgba(56,189,248,0.12);' +
                            'border:1px solid rgba(56,189,248,0.2);color:#38bdf8;border-radius:10px;' +
                            'padding:6px 12px;cursor:pointer;font-size:12px;transition:all 0.15s;">恢复默认</button>' +
                        '</div>' +
                    '</div>' +
                    // 网格
                    '<div style="display:flex;align-items:center;justify-content:space-between;' +
                    'padding:14px 16px;background:rgba(10,18,35,0.6);border-radius:12px;' +
                    'border:1px solid rgba(255,255,255,0.06);margin-bottom:12px;">' +
                        '<div>' +
                            '<div style="color:#e8edf5;font-size:14px;font-weight:bold;">📐 网格显示</div>' +
                            '<div style="color:#94a3b8;font-size:12px;margin-top:2px;">显示/隐藏背景参考网格</div>' +
                        '</div>' +
                        '<button id="settings-grid-toggle" style="padding:8px 20px;border:none;border-radius:20px;cursor:pointer;' +
                        'font-size:13px;font-weight:bold;transition:all 0.2s;' +
                        (isGridVisible()
                            ? 'background:linear-gradient(135deg,#38bdf8,#0ea5e9);color:#fff;box-shadow:0 2px 10px rgba(56,189,248,0.4);'
                            : 'background:rgba(71,85,105,0.5);color:#94a3b8;box-shadow:0 2px 8px rgba(0,0,0,0.2);')
                        + '">' + (isGridVisible() ? '开启' : '关闭') + '</button>' +
                    '</div>' +
                    // 重置
                    '<div style="display:flex;align-items:center;justify-content:space-between;' +
                    'padding:14px 16px;background:rgba(10,18,35,0.6);border-radius:12px;' +
                    'border:1px solid rgba(255,255,255,0.06);margin-bottom:12px;">' +
                        '<div>' +
                            '<div style="color:#e8edf5;font-size:14px;font-weight:bold;">🔄 重置设置</div>' +
                            '<div style="color:#94a3b8;font-size:12px;margin-top:2px;">恢复所有设置为默认值</div>' +
                        '</div>' +
                        '<button id="settings-reset-all" style="background:rgba(220,80,60,0.15);' +
                        'border:1px solid rgba(220,80,60,0.25);color:#e87060;border-radius:22px;' +
                        'padding:8px 20px;cursor:pointer;font-size:13px;font-weight:bold;transition:all 0.15s;">重置</button>' +
                    '</div>' +
                '</div>' +
                // 关于
                '<div style="margin-bottom:16px;">' +
                    '<h3 style="color:#38bdf8;margin:0 0 14px 0;font-size:15px;font-weight:bold;' +
                    'border-bottom:1px solid rgba(100,160,255,0.15);padding-bottom:8px;">关于</h3>' +
                    '<div style="padding:16px;background:rgba(10,18,35,0.6);border-radius:12px;' +
                    'border:1px solid rgba(255,255,255,0.06);text-align:center;">' +
                        '<div style="font-size:28px;margin-bottom:8px;">🎨</div>' +
                        '<div style="color:#38bdf8;font-size:16px;font-weight:bold;margin-bottom:4px;">画境</div>' +
                        '<div style="color:#94a3b8;font-size:12px;margin-bottom:12px;">v65</div>' +
                        '<div style="color:#475569;font-size:11px;">作者：兔师兄369</div>' +
                    '</div>' +
                '</div>' +
            '</div>';

        overlay.appendChild(panel);
        return overlay;
    }

    function bindEvents(overlay) {
        // 关闭按钮
        overlay.querySelector('#settings-close-btn').addEventListener('click', close);

        // 点击遮罩关闭
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) close();
        });

        // 背景颜色
        overlay.querySelector('#settings-bg-color').addEventListener('input', function() {
            setBgColor(this.value);
        });

        // 恢复默认颜色
        overlay.querySelector('#settings-reset-color').addEventListener('click', function() {
            setBgColor(_defaultBgColor);
            overlay.querySelector('#settings-bg-color').value = _defaultBgColor;
            showToast('背景颜色已恢复默认');
        });

        // 网格开关
        overlay.querySelector('#settings-grid-toggle').addEventListener('click', function() {
            if (isGridVisible()) {
                hideGrid();
                this.textContent = '关闭';
                this.style.background = 'rgba(71,85,105,0.5)';
                this.style.color = '#94a3b8';
                this.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
            } else {
                showGrid();
                this.textContent = '开启';
                this.style.background = 'linear-gradient(135deg,#38bdf8,#0ea5e9)';
                this.style.color = '#fff';
                this.style.boxShadow = '0 2px 10px rgba(56,189,248,0.4)';
            }
        });

        // 重置
        overlay.querySelector('#settings-reset-all').addEventListener('click', resetAll);
    }

    function showToast(message) {
        if (typeof showToast === 'function') showToast(message);
    }

    // 公开接口
    return {
        init: init,
        show: show,
        close: close,
        loadSettings: loadSettings
    };

})();
