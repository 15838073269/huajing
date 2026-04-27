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
    var skillOrder = [];   // 技能排列顺序

    function init(hotbarContainer, subtoolsContainer) {
        hotbarEl = hotbarContainer;
        subtoolsEl = subtoolsContainer;
        renderHotbar(); // 初始渲染（包含商店按钮）

        // 点击插件窗口时自动切换到对应插件（捕获阶段，优先于插件的 stopPropagation）
        // 绘画模式特殊：激活期间不允许自动切换
        document.addEventListener('mousedown', function(e) {
            var target = e.target.closest('[data-skill-id]');
            if (target) {
                var skillId = target.getAttribute('data-skill-id');
                if (skillId && skillId !== activeSkill && skills[skillId]) {
                    // 绘画模式不允许自动切换
                    if (activeSkill === 'drawing') return;
                    activate(skillId);
                }
            }
        }, true);
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

    // 显示插件包裹
    function showStore() {
        var installed = Object.keys(skills);
        var available = Object.keys(plugins);

        var html = '<div class="cos-bag">';

        // 安装区（上方）
        html += '<div class="cos-bag-zone-label">已装备</div>';
        html += '<div class="cos-bag-zone" id="cosBagInstalled" data-zone="installed">';
        installed.forEach(function(id) {
            var s = skills[id];
            html += '<div class="cos-bag-item installed" draggable="true" data-id="' + id + '" data-zone="installed" title="' + s.name + '">' +
                '<span class="cos-bag-icon">' + s.icon + '</span><span class="cos-bag-name">' + s.name + '</span></div>';
        });
        html += '</div>';

        // 卸载区（下方）
        html += '<div class="cos-bag-zone-label">背包</div>';
        html += '<div class="cos-bag-zone" id="cosBagAvailable" data-zone="available">';
        available.forEach(function(id) {
            var s = plugins[id];
            html += '<div class="cos-bag-item" draggable="true" data-id="' + id + '" data-zone="available" title="' + s.name + '">' +
                '<span class="cos-bag-icon">' + s.icon + '</span><span class="cos-bag-name">' + s.name + '</span></div>';
        });
        html += '</div>';

        if (installed.length === 0 && available.length === 0) {
            html += '<div style="text-align:center;padding:20px;color:var(--cos-text-dim);">暂无可用插件</div>';
        }

        html += '</div>';

        showOverlay('包裹', html, '320px');

        setTimeout(function() {
            var installedZone = document.getElementById('cosBagInstalled');
            var availableZone = document.getElementById('cosBagAvailable');
            if (!installedZone || !availableZone) return;

            // 拖拽事件
            [installedZone, availableZone].forEach(function(zone) {
                zone.addEventListener('dragover', function(e) {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    zone.classList.add('drag-over');
                });
                zone.addEventListener('dragleave', function() {
                    zone.classList.remove('drag-over');
                });
                zone.addEventListener('drop', function(e) {
                    e.preventDefault();
                    zone.classList.remove('drag-over');
                    var id = e.dataTransfer.getData('text/plain');
                    var targetZone = zone.dataset.zone;
                    if (targetZone === 'installed') {
                        installPlugin(id);
                    } else {
                        uninstallPlugin(id);
                    }
                    showStore();
                });
            });

            // 物品拖拽
            document.querySelectorAll('.cos-bag-item').forEach(function(item) {
                item.addEventListener('dragstart', function(e) {
                    e.dataTransfer.setData('text/plain', item.dataset.id);
                    e.dataTransfer.effectAllowed = 'move';
                });
            });

            // 悬浮提示（先清理旧的）
            var oldTip = document.querySelector('.cos-bag-tip');
            if (oldTip) oldTip.remove();
            var tip = document.createElement('div');
            tip.className = 'cos-bag-tip';
            document.body.appendChild(tip);

            document.querySelectorAll('.cos-bag-item').forEach(function(item) {
                item.addEventListener('mouseenter', function(e) {
                    var id = item.dataset.id;
                    var s = skills[id] || plugins[id];
                    if (!s) return;
                    tip.innerHTML = '<b>' + s.name + '</b>' +
                        (s.description ? '<br>' + s.description : '');
                    tip.classList.add('visible');
                });
                item.addEventListener('mousemove', function(e) {
                    tip.style.left = (e.clientX + 12) + 'px';
                    tip.style.top = (e.clientY + 12) + 'px';
                });
                item.addEventListener('mouseleave', function() {
                    tip.classList.remove('visible');
                });
            });

            // 关闭时清理提示（关闭按钮、Esc、点击遮罩）
            function cleanupTip() {
                if (tip.parentNode) tip.parentNode.removeChild(tip);
            }
            var closeBtn = document.querySelector('.cos-overlay-close');
            if (closeBtn) closeBtn.addEventListener('click', cleanupTip);
            var overlay = document.querySelector('.cos-overlay');
            if (overlay) {
                overlay.addEventListener('click', function(e) {
                    if (e.target === overlay) cleanupTip();
                });
            }
            document.addEventListener('keydown', function esc(e) {
                if (e.code === 'Escape') { cleanupTip(); document.removeEventListener('keydown', esc); }
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

        // 清理旧的 tip
        var oldTip = document.querySelector('.cos-hotbar-tip');
        if (oldTip) oldTip.remove();

        // 创建全局 tip
        var tip = document.createElement('div');
        tip.className = 'cos-hotbar-tip';
        document.body.appendChild(tip);

        // 同步 skillOrder：新注册的插件追加到末尾
        var keys = Object.keys(skills);
        keys.forEach(function(id) {
            if (skillOrder.indexOf(id) === -1) skillOrder.push(id);
        });
        // 移除已卸载的
        skillOrder = skillOrder.filter(function(id) { return skills[id]; });

        // 保留分隔符和技能名称
        inner.innerHTML = '';
        skillOrder.forEach(function(id, i) {
            var skill = skills[id];
            if (!skill) return;
            var el = document.createElement('div');
            el.className = 'cos-skill' + (activeSkill === id ? ' cos-skill-active' : '');
            el.draggable = true;
            el.dataset.skillId = id;
            el.innerHTML = '<span class="cos-skill-icon">' + skill.icon + '</span><span class="cos-skill-label">' + skill.name + '</span>';
            el.addEventListener('click', function() {
                if (activeSkill === id) deactivate();
                else activate(id);
            });
            // 悬浮提示
            el.addEventListener('mouseenter', function() {
                tip.innerHTML = '<b>' + skill.name + '</b>' +
                    (skill.description ? '<br>' + skill.description : '');
                tip.classList.add('visible');
            });
            el.addEventListener('mousemove', function(e) {
                var rect = el.getBoundingClientRect();
                tip.style.left = (rect.left + rect.width / 2) + 'px';
                tip.style.top = (rect.top - 8) + 'px';
                tip.style.transform = 'translate(-50%, -100%)';
            });
            el.addEventListener('mouseleave', function() {
                tip.classList.remove('visible');
            });
            // 拖拽排序
            el.addEventListener('dragstart', function(e) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', id);
                el.classList.add('cos-skill-dragging');
            });
            el.addEventListener('dragend', function() {
                el.classList.remove('cos-skill-dragging');
                inner.querySelectorAll('.cos-skill').forEach(function(s) { s.classList.remove('cos-skill-drag-over'); });
            });
            el.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                el.classList.add('cos-skill-drag-over');
            });
            el.addEventListener('dragleave', function() {
                el.classList.remove('cos-skill-drag-over');
            });
            el.addEventListener('drop', function(e) {
                e.preventDefault();
                el.classList.remove('cos-skill-drag-over');
                var dragId = e.dataTransfer.getData('text/plain');
                if (!dragId || dragId === id) return;
                var fromIdx = skillOrder.indexOf(dragId);
                var toIdx = skillOrder.indexOf(id);
                if (fromIdx === -1 || toIdx === -1) return;
                skillOrder.splice(fromIdx, 1);
                skillOrder.splice(toIdx, 0, dragId);
                renderHotbar();
            });
            inner.appendChild(el);

            // 每5个加个分隔符
            if ((i + 1) % 5 === 0 && i < skillOrder.length - 1) {
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
        storeBtn.innerHTML = '<span style="font-size:14px;font-weight:bold;color:#f0c878;">包</span>';
        storeBtn.addEventListener('click', function() { showStore(); });
        storeBtn.addEventListener('mouseenter', function() {
            tip.innerHTML = '<b>包裹</b><br>管理插件装备';
            tip.classList.add('visible');
        });
        storeBtn.addEventListener('mousemove', function(e) {
            var rect = storeBtn.getBoundingClientRect();
            tip.style.left = (rect.left + rect.width / 2) + 'px';
            tip.style.top = (rect.top - 8) + 'px';
            tip.style.transform = 'translate(-50%, -100%)';
        });
        storeBtn.addEventListener('mouseleave', function() {
            tip.classList.remove('visible');
        });
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

    // 快捷键已禁用 — 避免在输入框中误触发
    // 所有技能切换通过鼠标点击底部栏完成

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
        renderSubTools: renderSubTools,
        getSkillOrder: function() { return skillOrder.slice(); },
        setSkillOrder: function(order) { skillOrder = order || []; renderHotbar(); }
    };
})();
