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

        // 点击插件窗口时自动切换到对应插件 + 窗口置顶
        // 绘画模式特殊：激活期间不允许自动切换
        document.addEventListener('mousedown', function(e) {
            // 查找插件窗口容器
            var win = e.target.closest('[data-skill-id]');
            if (win) {
                var topZ = (window.__cos_topZ || 10000) + 1;
                window.__cos_topZ = topZ;
                win.style.zIndex = topZ;
                var skillId = win.getAttribute('data-skill-id');
                if (skillId && skillId !== activeSkill && skills[skillId]) {
                    if (activeSkill === 'drawing' || activeSkill === 'ui-debugger') return;
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

    // 显示插件包裹（改用独立窗口，和插件窗口一致）
    function showStore() {
        var installed = Object.keys(skills);
        var available = Object.keys(plugins);

        // 关闭已有的包裹窗口
        var oldBag = document.querySelector('[data-skill-id="__bag__"]');
        if (oldBag) { oldBag.remove(); }

        var ov = document.createElement('div');
        ov.setAttribute('data-skill-id', '__bag__');
        var topZ = (window.__cos_topZ || 10000) + 1;
        window.__cos_topZ = topZ;
        ov.style.cssText =
            'position:fixed;z-index:' + topZ + ';background:#0f1525;color:#e8edf5;border-radius:12px;' +
            'border:1px solid rgba(100,160,255,0.15);box-shadow:0 8px 40px rgba(0,0,0,0.6);' +
            'overflow:hidden;display:flex;flex-direction:column;font-size:13px;' +
            'width:380px;height:400px;left:' + Math.max(20, (window.innerWidth - 380) / 2) + 'px;' +
            'top:' + Math.max(20, (window.innerHeight - 400) / 2) + 'px;';

        var html =
            '<div class="cos-overlay-header" style="display:flex;align-items:center;justify-content:space-between;' +
            'padding:10px 14px;border-bottom:1px solid rgba(100,160,255,0.1);cursor:move;user-select:none;flex-shrink:0;">' +
            '<span style="font-weight:600;color:#38bdf8;font-size:14px;">包裹</span>' +
            '<span class="cos-overlay-close" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;' +
            'border-radius:6px;cursor:pointer;color:#94a3b8;font-size:16px;">×</span></div>' +
            '<div class="cos-overlay-body" style="flex:1;overflow-y:auto;padding:10px 14px;">' +
            '<div class="cos-bag">' +
            '<div class="cos-bag-search"><input type="text" class="cos-bag-search-input" id="cosBagSearch" ' +
            'placeholder="输入编号或名称搜索..." style="width:100%;padding:6px 10px;border-radius:8px;border:1px solid rgba(100,160,255,0.12);' +
            'background:rgba(20,30,60,0.5);color:#e8edf5;font-size:12px;outline:none;"></div>' +
            '<div class="cos-bag-zone-label" style="font-size:11px;color:#94a3b8;margin:8px 0 4px;">已装备</div>' +
            '<div class="cos-bag-zone" id="cosBagInstalled" data-zone="installed" style="display:flex;flex-wrap:wrap;gap:4px;">';

        installed.forEach(function(id, idx) {
            var s = skills[id];
            var num = (typeof PLUGIN_NUMBERS !== 'undefined' && PLUGIN_NUMBERS[id]) ? PLUGIN_NUMBERS[id] : '';
            html += '<div class="cos-bag-item installed" draggable="true" data-id="' + id + '" data-zone="installed" title="' + s.name + '" ' +
                'style="display:flex;align-items:center;gap:6px;padding:4px 8px;border-radius:6px;border:1px solid rgba(100,160,255,0.08);' +
                'background:rgba(20,30,60,0.4);cursor:grab;font-size:12px;">' +
                '<span class="cos-bag-icon">' + s.icon + '</span><span class="cos-bag-name">' + s.name + '</span>' +
                (num ? '<span class="cos-bag-num" style="font-size:10px;color:#475569;margin-left:2px;">' + num + '</span>' : '') + '</div>';
        });
        html += '</div>';

        html += '<div class="cos-bag-zone-label" style="font-size:11px;color:#94a3b8;margin:8px 0 4px;">背包</div>';
        html += '<div class="cos-bag-zone" id="cosBagAvailable" data-zone="available" style="display:flex;flex-wrap:wrap;gap:4px;">';
        available.forEach(function(id) {
            var s = plugins[id];
            html += '<div class="cos-bag-item" draggable="true" data-id="' + id + '" data-zone="available" title="' + s.name + '" ' +
                'style="display:flex;align-items:center;gap:6px;padding:4px 8px;border-radius:6px;border:1px solid rgba(100,160,255,0.08);' +
                'background:rgba(20,30,60,0.2);cursor:grab;font-size:12px;">' +
                '<span class="cos-bag-icon">' + s.icon + '</span><span class="cos-bag-name">' + s.name + '</span></div>';
        });
        html += '</div>';

        if (installed.length === 0 && available.length === 0) {
            html += '<div style="text-align:center;padding:20px;color:var(--cos-text-dim);">暂无可用插件</div>';
        }

        html += '</div></div>';

        ov.innerHTML = html;
        document.body.appendChild(ov);

        // 禁用右键菜单
        ov.addEventListener('contextmenu', function(e) { e.preventDefault(); });

        // 预设初始尺寸位置（始终覆盖，防止旧数据缺 left/top 导致跑角落）
        try {
            var cl = Math.max(20, (window.innerWidth - 380) / 2);
            var ct = Math.max(20, (window.innerHeight - 400) / 2);
            localStorage.setItem('cos-bag-rect', JSON.stringify({ w: 380, h: 400, l: Math.round(cl), t: Math.round(ct) }));
        } catch(e) {}
        if (typeof WindowHelper !== 'undefined') {
            WindowHelper.makeResizable(ov, { minWidth: 320, minHeight: 250, storeKey: 'cos-bag-rect' });
        }

        // 拖拽
        var header = ov.querySelector('.cos-overlay-header');
        var dState = { active: false, sx: 0, sy: 0, ox: 0, oy: 0 };
        header.addEventListener('mousedown', function(e) {
            if (e.target.closest('.cos-overlay-close')) return;
            dState.active = true;
            dState.sx = e.clientX; dState.sy = e.clientY;
            dState.ox = ov.offsetLeft;
            dState.oy = ov.offsetTop;
            e.preventDefault();
        });
        function onBagMove(e) {
            if (!dState.active) return;
            ov.style.left = (dState.ox + e.clientX - dState.sx) + 'px';
            ov.style.top = (dState.oy + e.clientY - dState.sy) + 'px';
        }
        function onBagUp() { dState.active = false; }
        document.addEventListener('mousemove', onBagMove);
        document.addEventListener('mouseup', onBagUp);

        // 关闭
        ov.querySelector('.cos-overlay-close').addEventListener('click', function() {
            document.removeEventListener('mousemove', onBagMove);
            document.removeEventListener('mouseup', onBagUp);
            ov.remove();
        });

        // 点击置顶
        ov.addEventListener('mousedown', function() {
            var tz = (window.__cos_topZ || 10000) + 1;
            window.__cos_topZ = tz;
            ov.style.zIndex = tz;
        });

        setTimeout(function() {
            // 搜索过滤
            var searchInput = document.getElementById('cosBagSearch');
            var allItems = document.querySelectorAll('.cos-bag-item');
            var installedItems = document.querySelectorAll('#cosBagInstalled .cos-bag-item');
            var availableItems = document.querySelectorAll('#cosBagAvailable .cos-bag-item');
            if (searchInput) {
                searchInput.focus();
                searchInput.addEventListener('input', function() {
                    var query = this.value.trim().toLowerCase();
                    allItems.forEach(function(item) {
                        if (!query) {
                            item.style.display = '';
                            return;
                        }
                        var numVal = (typeof PLUGIN_NUMBERS !== 'undefined' && PLUGIN_NUMBERS[item.dataset.id]) ? String(PLUGIN_NUMBERS[item.dataset.id]) : '';
                        var nameVal = (item.dataset.zone === 'installed' ? skills[item.dataset.id] : plugins[item.dataset.id]);
                        nameVal = nameVal ? nameVal.name.toLowerCase() : '';
                        var match = numVal === query || nameVal.indexOf(query) >= 0;
                        item.style.display = match ? '' : 'none';
                    });
                });
            }

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

        // 切换插件时窗口置顶
        var win = document.querySelector('[data-skill-id="' + skillId + '"]');
        if (win) {
            var topZ = (window.__cos_topZ || 10000) + 1;
            window.__cos_topZ = topZ;
            win.style.zIndex = topZ;
        }
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

        // 按颜色分组
        inner.innerHTML = '';
        var groups = {};
        skillOrder.forEach(function(id) {
            if (!skills[id]) return;
            var m = skills[id].icon && skills[id].icon.match(/color:#([a-f0-9]+)/i);
            var color = m ? m[1] : 'default';
            if (!groups[color]) groups[color] = [];
            groups[color].push(id);
        });

        var colorKeys = Object.keys(groups);
        colorKeys.forEach(function(color, gi) {
            // 创建颜色组容器
            var groupEl = document.createElement('div');
            groupEl.className = 'cos-hotbar-group';

            groups[color].forEach(function(id) {
                var skill = skills[id];
                if (!skill) return;
                var el = document.createElement('div');
                el.className = 'cos-skill' + (activeSkill === id ? ' cos-skill-active' : '');
                el.draggable = true;
                el.dataset.skillId = id;
                var num = (typeof PLUGIN_NUMBERS !== 'undefined' && PLUGIN_NUMBERS[id]) ? PLUGIN_NUMBERS[id] : '';
                el.innerHTML = '<span class="cos-skill-icon">' + skill.icon + '</span><span class="cos-skill-label">' + skill.name + '</span>' +
                    (num ? '<span class="cos-skill-num">' + num + '</span>' : '');
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
                // 拖拽排序（组内）
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
                groupEl.appendChild(el);
            });

            inner.appendChild(groupEl);

            // 颜色组之间加分隔线
            if (gi < colorKeys.length - 1) {
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

        // 云盘 + 商店（分隔符在最右边）
        var sep = document.createElement('div');
        sep.className = 'cos-hotbar-sep';
        inner.appendChild(sep);
        // 盘 → 包
        var cdBtn = document.createElement('div');
        cdBtn.className = 'cos-skill cos-skill-store';
        cdBtn.style.cssText = 'background:rgba(56,189,248,0.12);border:1px solid rgba(56,189,248,0.25);';
        cdBtn.innerHTML = '<span style="font-size:14px;font-weight:bold;color:#38bdf8;">盘</span>';
        cdBtn.addEventListener('click', function() {
            if (typeof CosCloudDrive !== 'undefined') CosCloudDrive.open();
        });
        cdBtn.addEventListener('mouseenter', function() {
            tip.innerHTML = '<b>本地云盘</b><br>所有插件的共享素材箱';
            tip.classList.add('visible');
        });
        cdBtn.addEventListener('mousemove', function(e) {
            var rect = cdBtn.getBoundingClientRect();
            tip.style.left = (rect.left + rect.width / 2) + 'px';
            tip.style.top = (rect.top - 8) + 'px';
            tip.style.transform = 'translate(-50%, -100%)';
        });
        cdBtn.addEventListener('mouseleave', function() {
            tip.classList.remove('visible');
        });
        inner.appendChild(cdBtn);

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
        setSkillOrder: function(order) { skillOrder = order || []; renderHotbar(); },
        WindowHelper: WindowHelper
    };
})();
