/**
 * 画境 v67 - 启动入口
 */
(function() {
    document.addEventListener('DOMContentLoaded', function() {
        var worldEl = document.getElementById('cos-world');
        var hotbarEl = document.getElementById('cos-hotbar');
        var subtoolsEl = document.getElementById('cos-subtools');

        // 初始化游戏世界
        GameWorld.init(worldEl);

        // 初始化画布图片管理引擎（LOD 缩略图 + 持久化 + 选中 + 视口裁剪）
        if (typeof CanvasImages !== 'undefined') CanvasImages.init(GameWorld);

        // 初始化技能系统
        SkillSystem.init(hotbarEl, subtoolsEl);

        // 初始化设置面板（固定功能）
        if (typeof SettingsPanel !== 'undefined') SettingsPanel.init();

        // 动态加载插件清单中的 JS 文件，然后启动
        loadPlugins().then(function() {
            PluginLoader.autoRegister();
            restoreState();
        });

        // HUD 信息
        GameWorld.on('transform', function(s) {
            var el = document.getElementById('cos-zoom');
            if (el) el.textContent = Math.round(s.scale * 100) + '%';
        });

        // 保存
        setInterval(autoSave, 30000);
        window.addEventListener('beforeunload', autoSave);

        // HUD 按钮
        document.getElementById('cos-btn-reset').addEventListener('click', function() { GameWorld.resetView(); });
    });

    /**
     * 根据 plugins.js 中的 PLUGIN_LIST 动态加载插件脚本
     */
    function loadPlugins() {
        if (typeof PLUGIN_LIST === 'undefined' || !PLUGIN_LIST.length) {
            return Promise.resolve();
        }
        var promises = PLUGIN_LIST.map(function(src) {
            return new Promise(function(resolve) {
                var s = document.createElement('script');
                s.src = src + '?v=133';
                s.async = false; // 保证多文件插件的执行顺序
                s.onload = resolve;
                s.onerror = function() { console.warn('[PluginLoader] 加载失败: ' + src); resolve(); };
                document.head.appendChild(s);
            });
        });
        return Promise.all(promises);
    }

    function autoSave() {
        var state = {
            version: 5,
            world: GameWorld.getState(),
            activeSkill: SkillSystem.getActiveId(),
            installedPlugins: Object.keys(SkillSystem.getAll()),
            skillOrder: SkillSystem.getSkillOrder(),
            skills: {}
        };
        var all = SkillSystem.getAll();
        for (var id in all) {
            if (all[id].save) {
                try { state.skills[id] = all[id].save(); } catch(e) {}
            }
        }
        GameStorage.save(state);
        // beforeunload 场景：同步写 localStorage 兜底
        try { localStorage.setItem('cos_v65_backup', JSON.stringify(state)); } catch(e) {}
    }

    async function restoreState() {
        var state = await GameStorage.load();
        // IndexedDB 无数据时尝试 localStorage 兜底
        if (!state) {
            try {
                var bak = localStorage.getItem('cos_v65_backup');
                if (bak) { state = JSON.parse(bak); localStorage.removeItem('cos_v65_backup'); }
            } catch(e) {}
        }
        if (!state) {
            // 首次使用：自动安装所有可用插件
            var allPlugins = SkillSystem.getPlugins();
            Object.keys(allPlugins).forEach(function(id) {
                SkillSystem.installPlugin(id);
            });
            return;
        }
        if (!state.version || state.version < 4) {
            GameStorage.clear();
            // 版本不兼容：重新安装所有插件
            var allP = SkillSystem.getPlugins();
            Object.keys(allP).forEach(function(id) {
                SkillSystem.installPlugin(id);
            });
            return;
        }
        if (state.installedPlugins) {
            state.installedPlugins.forEach(function(id) {
                var plugin = SkillSystem.getPlugins()[id];
                if (plugin) SkillSystem.installPlugin(id);
            });
        }
        // 自动安装：仅补装本次新增的插件（不影响用户主动卸载/禁用的其它插件）
        (function() {
            var NEW = ['seamless-tile'];
            var installed = SkillSystem.getAll();
            NEW.forEach(function(id) {
                if (!installed[id] && SkillSystem.getPlugins()[id]) SkillSystem.installPlugin(id);
            });
            // 将无缝平铺分配到红色区（落红栏）；用户仍可在「包裹」窗口拖动改区
            try {
                var a = JSON.parse(localStorage.getItem('cos-bag-assignments') || '{}');
                if (!a['seamless-tile']) {
                    a['seamless-tile'] = 'red';
                    localStorage.setItem('cos-bag-assignments', JSON.stringify(a));
                }
            } catch (e) {}
        })();
        // 插件全部注册后再恢复排序
        if (state.skillOrder) SkillSystem.setSkillOrder(state.skillOrder);
        if (state.world) GameWorld.setState(state.world);
        if (state.skills) {
            for (var id in state.skills) {
                var skill = SkillSystem.getAll()[id];
                if (skill && skill.load) {
                    try { skill.load(state.skills[id]); } catch(e) {}
                }
            }
        }
        if (state.activeSkill && SkillSystem.getAll()[state.activeSkill]) {
            SkillSystem.activate(state.activeSkill);
        }
    }
})();
