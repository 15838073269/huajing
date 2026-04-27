/**
 * SkillSystem - 技能系统
 * 每个技能 = 一种在世界中操作的能力
 */
var SkillSystem = (function() {
    var skills = {};       // skillId -> skill object（已安装）
    var plugins = {};      // skillId -> skill object（插件商店，可用但未安装）
    var activeSkill = null;
    var hotbarEl = null;
    var subtoolsEl = null;

    function init(hotbarContainer, subtoolsContainer) {
        hotbarEl = hotbarContainer;
        subtoolsEl = subtoolsContainer;
    }

    /**
     * 注册技能
     * @param {Object} skill
     *   {
     *     id: 'node-editor',
     *     name: '节点编辑',
     *     icon: '🔗',
     *     key: '1',           // 快捷键
     *     activate(world) {},   // 激活
     *     deactivate() {},     // 停用
     *     getSubTools() [],    // 子工具列表
     *     save() {},
     *     load(data) {}
     *   }
     */
    function register(skill) {
        if (!skill.id) return;
        skills[skill.id] = skill;
        delete plugins[skill.id]; // 从商店移除
        renderHotbar();
    }

    // 注册到插件商店（不安装，不显示在技能栏）
    function registerPlugin(skill) {
        if (!skill.id) return;
        plugins[skill.id] = skill;
    }

    // 从商店安装插件
    function installPlugin(skillId) {
        var skill = plugins[skillId];
        if (!skill) return;
        skills[skillId] = skill;
        delete plugins[skillId];
        renderHotbar();
        showToast('已安装: ' + skill.name);
    }

    // 卸载插件
    function uninstallPlugin(skillId) {
        if (activeSkill === skillId) deactivate();
        var skill = skills[skillId];
        if (skill) {
            plugins[skillId] = skill; // 放回商店
            delete skills[skillId];
        }
        renderHotbar();
        showToast('已卸载: ' + (skill ? skill.name : skillId));
    }

    // 获取商店中的插件
    function getPlugins() { return plugins; }

    // 显示插件商店
    function showStore() {
        var installed = Object.keys(skills);
        var available = Object.keys(plugins);

        var html = '<div style="margin-bottom:12px;font-size:11px;color:var(--cos-text-dim);">已安装的技能可以卸载，商店中的插件可以安装</div>';

        if (installed.length > 0) {
            html += '<div style="font-size:11px;color:var(--cos-accent);margin-bottom:6px;font-weight:600;">已安装</div>';
            installed.forEach(function(id) {
                var s = skills[id];
                html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-radius:var(--cos-radius-xs);margin-bottom:3px;background:rgba(255,255,255,0.03);">' +
                    '<span style="font-size:20px;margin-right:8px;">' + s.icon + '</span>' +
                    '<span style="flex:1;font-size:12px;">' + s.name + '</span>' +
                    '<button class="cos-store-btn cos-store-uninstall" data-id="' + id + '">卸载</button>' +
                '</div>';
            });
        }

        if (available.length > 0) {
            html += '<div style="font-size:11px;color:var(--cos-green);margin:12px 0 6px;font-weight:600;">可用插件</div>';
            available.forEach(function(id) {
                var s = plugins[id];
                html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 8px;border-radius:var(--cos-radius-xs);margin-bottom:3px;background:rgba(255,255,255,0.03);">' +
                    '<span style="font-size:20px;margin-right:8px;">' + s.icon + '</span>' +
                    '<span style="flex:1;font-size:12px;">' + s.name + '</span>' +
                    '<button class="cos-store-btn cos-store-install" data-id="' + id + '">安装</button>' +
                '</div>';
            });
        }

        if (installed.length === 0 && available.length === 0) {
            html += '<div style="text-align:center;padding:20px;color:var(--cos-text-dim);">暂无可用插件</div>';
        }

        showOverlay('插件商店', html);

        // 绑定按钮事件
        setTimeout(function() {
            document.querySelectorAll('.cos-store-install').forEach(function(btn) {
                btn.addEventListener('click', function() { installPlugin(btn.dataset.id); showStore(); });
            });
            document.querySelectorAll('.cos-store-uninstall').forEach(function(btn) {
                btn.addEventListener('click', function() { uninstallPlugin(btn.dataset.id); showStore(); });
            });
        }, 50);
    }

    function unregister(id) {
        if (activeSkill === id) deactivate();
        delete skills[id];
        renderHotbar();
    }

    function activate(skillId) {
        if (activeSkill === skillId) return;
        if (activeSkill) deactivate();

        var skill = skills[skillId];
        if (!skill) return;

        activeSkill = skillId;
        if (skill.activate) {
            try { skill.activate(GameWorld); }
            catch(e) { console.error('Skill activate error:', e); }
        }

        renderHotbar();
        renderSubTools();
        GameWorld.emit('skillChanged', { skillId: skillId, skill: skill });
    }

    function deactivate() {
        if (!activeSkill) return;
        var skill = skills[activeSkill];
        if (skill && skill.deactivate) {
            try { skill.deactivate(); }
            catch(e) { console.error('Skill deactivate error:', e); }
        }
        activeSkill = null;
        renderHotbar();
        renderSubTools();
    }

    function getActive() {
        return activeSkill ? skills[activeSkill] : null;
    }

    function getActiveId() { return activeSkill; }

    function getAll() { return skills; }

    function renderHotbar() {
        if (!hotbarEl) return;
        var inner = hotbarEl.querySelector('.cos-hotbar-inner');
        if (!inner) return;

        // 保留分隔符和技能名称
        inner.innerHTML = '';
        var keys = Object.keys(skills);
        keys.forEach(function(id, i) {
            var skill = skills[id];
            var el = document.createElement('div');
            el.className = 'cos-skill' + (activeSkill === id ? ' cos-skill-active' : '');
            el.innerHTML =
                '<span>' + skill.icon + '</span>' +
                (skill.key ? '<span class="cos-skill-key">' + skill.key + '</span>' : '') +
                '<span class="cos-skill-tooltip">' + skill.name + '</span>';
            el.addEventListener('click', function() {
                if (activeSkill === id) deactivate();
                else activate(id);
            });
            inner.appendChild(el);

            // 每5个加个分隔符
            if ((i + 1) % 5 === 0 && i < keys.length - 1) {
                var sep = document.createElement('div');
                sep.className = 'cos-hotbar-sep';
                inner.appendChild(sep);
            }
        });

        // 当前技能名称
        var nameEl = document.createElement('span');
        nameEl.className = 'cos-skill-name';
        nameEl.textContent = activeSkill ? skills[activeSkill].name : '';
        inner.appendChild(nameEl);

        // 商店按钮（始终显示在最右边）
        var sep = document.createElement('div');
        sep.className = 'cos-hotbar-sep';
        inner.appendChild(sep);
        var storeBtn = document.createElement('div');
        storeBtn.className = 'cos-skill cos-skill-store';
        storeBtn.style.cssText = 'background:linear-gradient(135deg,rgba(240,160,80,0.3),rgba(240,160,80,0.15));border:2px solid rgba(240,160,80,0.6);box-shadow:0 0 12px rgba(240,160,80,0.25);';
        storeBtn.innerHTML = '<span style="font-size:26px;filter:brightness(1.3) drop-shadow(0 0 4px rgba(240,160,80,0.5));">🧩</span><span class="cos-skill-tooltip">插件商店</span>';
        storeBtn.addEventListener('click', function() { showStore(); });
        inner.appendChild(storeBtn);
    }

    function renderSubTools() {
        if (!subtoolsEl) return;
        if (!activeSkill || !skills[activeSkill].getSubTools) {
            subtoolsEl.classList.remove('cos-subtools-visible');
            subtoolsEl.innerHTML = '';
            return;
        }

        var tools = skills[activeSkill].getSubTools();
        if (!tools || tools.length === 0) {
            subtoolsEl.classList.remove('cos-subtools-visible');
            subtoolsEl.innerHTML = '';
            return;
        }

        subtoolsEl.innerHTML = '';
        tools.forEach(function(tool) {
            var btn = document.createElement('button');
            btn.className = 'cos-subtool-btn' + (tool.active ? ' cos-subtool-active' : '');
            if (tool.html) {
                btn.innerHTML = tool.html;
            } else {
                btn.textContent = tool.icon ? tool.icon + ' ' + tool.label : tool.label;
            }
            if (tool.title) btn.title = tool.title;
            btn.addEventListener('click', function() {
                if (tool.action) tool.action();
                renderSubTools();
            });
            subtoolsEl.appendChild(btn);
        });

        subtoolsEl.classList.add('cos-subtools-visible');
    }

    // 快捷键
    document.addEventListener('keydown', function(e) {
        if (e.target.closest('.ne-node-textarea')) return;
        var keys = Object.keys(skills);
        keys.forEach(function(id) {
            if (skills[id].key && e.key === skills[id].key) {
                if (activeSkill === id) deactivate();
                else activate(id);
            }
        });
    });

    return {
        init: init,
        register: register,
        registerPlugin: registerPlugin,
        installPlugin: installPlugin,
        uninstallPlugin: uninstallPlugin,
        getPlugins: getPlugins,
        showStore: showStore,
        unregister: unregister,
        activate: activate,
        deactivate: deactivate,
        getActive: getActive,
        getActiveId: getActiveId,
        getAll: getAll,
        renderSubTools: renderSubTools
    };
})();
