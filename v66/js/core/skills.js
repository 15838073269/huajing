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

    var ZONE_KEYS = ['red', 'green', 'blue'];
    var ZONE_COLORS = { red: '#ef4444', green: '#4ecca3', blue: '#38bdf8' };
    function _getZoneColor(zone) { return ZONE_COLORS[zone] || null; }
    function _getAssignments() {
        try { return JSON.parse(localStorage.getItem('cos-bag-assignments')) || {}; } catch(e) { return {}; }
    }
    function _saveAssignments(a) {
        try { localStorage.setItem('cos-bag-assignments', JSON.stringify(a)); } catch(e) {}
    }
    function _getDisabled() {
        try { return JSON.parse(localStorage.getItem('cos-bag-disabled')) || []; } catch(e) { return []; }
    }
    function _saveDisabled(d) {
        try { localStorage.setItem('cos-bag-disabled', JSON.stringify(d)); } catch(e) {}
    }
    function _toggleDisabled(id) {
        var d = _getDisabled();
        var idx = d.indexOf(id);
        if (idx === -1) d.push(id);
        else d.splice(idx, 1);
        _saveDisabled(d);
        return d;
    }
    // 迁移旧数据：按 icon 原有颜色自动分配
    function _initAssignments() {
        var a = _getAssignments();
        var changed = false;
        Object.keys(skills).forEach(function(id) {
            if (a[id]) return;
            var s = skills[id];
            var m = s.icon && s.icon.match(/color:#([a-f0-9]+)/i);
            var c = m ? m[1].toLowerCase() : '';
            var zone = c === 'ef4444' ? 'red' : c === '4ecca3' ? 'green' : c === '38bdf8' ? 'blue' : null;
            if (zone) { a[id] = zone; changed = true; }
        });
        if (changed) _saveAssignments(a);
    }
    // 插件图标替换为区域颜色
    function _getSkillIcon(skill, zone) {
        var zc = _getZoneColor(zone);
        if (!zc) return skill.icon || '';
        var icon = skill.icon || '';
        if (/color:#[a-f0-9]+/i.test(icon)) {
            return icon.replace(/color:#[a-f0-9]+/gi, 'color:' + zc);
        }
        return '<span style="color:' + zc + ';">' + icon + '</span>';
    }

    function showStore() {
        var oldBag = document.querySelector('[data-skill-id="__bag__"]');
        if (oldBag) { oldBag.remove(); }

        _initAssignments();
        var assignments = _getAssignments();

        var ov = document.createElement('div');
        ov.setAttribute('data-skill-id', '__bag__');
        var topZ = (window.__cos_topZ || 10000) + 1;
        window.__cos_topZ = topZ;
        ov.style.cssText =
            'position:fixed;z-index:' + topZ + ';background:#0f1525;color:#e8edf5;border-radius:12px;' +
            'border:1px solid rgba(100,160,255,0.15);box-shadow:0 8px 40px rgba(0,0,0,0.6);' +
            'overflow:hidden;display:flex;flex-direction:column;font-size:13px;' +
            'width:420px;height:500px;left:' + Math.max(20, (window.innerWidth - 420) / 2) + 'px;' +
            'top:' + Math.max(20, (window.innerHeight - 500) / 2) + 'px;';

        function _defaultZone(s) {
            var m = s.icon && s.icon.match(/color:#([a-f0-9]+)/i);
            var c = m ? m[1].toLowerCase() : '';
            return c === 'ef4444' ? 'red' : c === '4ecca3' ? 'green' : 'blue';
        }

        var disabledList = _getDisabled();
        var zoneItems = { red: [], green: [], blue: [] };
        var allIds = {};
        Object.keys(skills).forEach(function(id) { allIds[id] = skills[id]; });
        Object.keys(plugins).forEach(function(id) { if (!allIds[id]) allIds[id] = plugins[id]; });

        Object.keys(allIds).forEach(function(id) {
            var s = allIds[id];
            var zone = assignments[id] || _defaultZone(s);
            var isAssigned = !!assignments[id];
            var isDisabled = disabledList.indexOf(id) !== -1;
            zoneItems[zone].push({ id: id, skill: s, installed: !!skills[id], assigned: isAssigned, disabled: isDisabled });
        });

        var zoneMeta = [
            { key: 'red',   label: '红', cssColor: '#ef4444' },
            { key: 'green', label: '绿', cssColor: '#4ecca3' },
            { key: 'blue',  label: '蓝', cssColor: '#38bdf8' }
        ];

        var html =
            '<div class="cos-overlay-header" style="display:flex;align-items:center;justify-content:space-between;' +
            'padding:10px 14px;border-bottom:1px solid rgba(100,160,255,0.1);cursor:move;user-select:none;flex-shrink:0;">' +
            '<span style="font-weight:600;color:#38bdf8;font-size:14px;">包裹</span>' +
            '<span class="cos-overlay-close" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;' +
            'border-radius:6px;cursor:pointer;color:#94a3b8;font-size:16px;">×</span></div>' +
            '<div class="cos-overlay-body" style="flex:1;overflow-y:auto;padding:6px 14px 10px;">';

        // 3 个拖拽区域
        zoneMeta.forEach(function(meta) {
            var items = zoneItems[meta.key];
            html += '<div class="cos-bag-zone" data-zone="' + meta.key + '" ' +
                'style="margin-bottom:8px;border:1px dashed ' + meta.cssColor + '30;border-radius:8px;padding:6px 8px;' +
                'min-height:0;transition:border-color .2s,background .2s;' +
                'background:' + (items.length ? meta.cssColor + '08' : 'transparent') + ';">' +
                '<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">' +
                '<span style="width:8px;height:8px;border-radius:50%;background:' + meta.cssColor + ';box-shadow:0 0 6px ' + meta.cssColor + '40;"></span>' +
                '<span style="font-size:11px;font-weight:600;color:' + meta.cssColor + ';">' + meta.label + '</span>' +
                '<span style="font-size:10px;color:#475569;">' + items.length + '</span>' +
                '</div>' +
                '<div class="cos-bag-zone-inner" style="display:flex;flex-wrap:wrap;gap:6px;min-height:30px;">';
            items.forEach(function(item) {
                var num = (typeof PLUGIN_NUMBERS !== 'undefined' && PLUGIN_NUMBERS[item.id]) ? PLUGIN_NUMBERS[item.id] : '';
                var itemColor = item.assigned ? meta.cssColor : null;
                if (item.disabled) itemColor = '#666';
                html += _bagItemHtml(item, itemColor, num);
            });
            html += '</div></div>';
        });

        if (Object.keys(allIds).length === 0) {
            html += '<div style="text-align:center;padding:30px 0;color:#475569;">暂无可用插件</div>';
        }
        html += '</div>';

        ov.innerHTML = html;

        function _bagItemHtml(item, zoneColor, num) {
            var icon = item.skill.icon || '';
            var c = item.disabled ? '#666' : zoneColor;
            if (c) {
                if (/color:#[a-f0-9]+/i.test(icon)) {
                    icon = icon.replace(/color:#[a-f0-9]+/gi, 'color:' + c);
                } else {
                    icon = '<span style="color:' + c + ';">' + icon + '</span>';
                }
            }
            var dimmed = !c;
            return '<div class="cos-bag-item" draggable="true" data-id="' + item.id + '" ' +
                'style="width:52px;height:52px;display:flex;flex-direction:column;align-items:center;justify-content:center;' +
                'border-radius:8px;border:1px solid ' + (dimmed ? 'rgba(100,160,255,0.08)' : c + '50') + ';' +
                'background:' + (dimmed ? 'rgba(20,30,60,0.2)' : c + '15') + ';' +
                'color:#e8edf5;transition:all .15s;position:relative;user-select:none;cursor:grab;' +
                'opacity:' + (dimmed ? '0.4' : '1') + ';" title="' + item.skill.name + '">' +
                '<span style="font-size:16px;font-weight:bold;">' + icon + '</span>' +
                '<span style="font-size:8px;color:#94a3b8;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:48px;text-align:center;">' + item.skill.name + '</span>' +
                (num ? '<span style="position:absolute;right:1px;bottom:1px;font-size:7px;color:#475569;">' + num + '</span>' : '') +
                '</div>';
        }
        document.body.appendChild(ov);

        ov.addEventListener('contextmenu', function(e) { e.preventDefault(); });

        try {
            var saved = JSON.parse(localStorage.getItem('cos-bag-rect'));
            if (saved && saved.h) {
                var sw = window.innerWidth, sh = window.innerHeight;
                var w = Math.min(saved.w, sw - 20);
                var h = Math.min(saved.h, sh - 20);
                var l = Math.max(0, Math.min(saved.l, sw - w));
                var t = Math.max(0, Math.min(saved.t, sh - h));
                ov.style.width = w + 'px';
                ov.style.height = h + 'px';
                ov.style.left = l + 'px';
                ov.style.top = t + 'px';
            } else {
                // 手动计算高度：每行 58px(52 图标 + 6 gap)，420px 宽约 7 个/行
                var _zoneH = 0;
                ['red','green','blue'].forEach(function(k) {
                    var n = zoneItems[k] ? zoneItems[k].length : 0;
                    if (!n) { _zoneH += 56; return; } // 空：label(16) + inner min(30) + pad(2) + margin(8)
                    var rows = Math.ceil(n / 7);
                    var innerH = Math.max(rows * 58, 30);
                    _zoneH += 12 + innerH + 8; // padding + inner + margin-bottom
                });
                var totalH = Math.min(_zoneH + 56, window.innerHeight - 40); // + header(~40) + body pad(16)
                totalH = Math.max(totalH, 120);
                var cl = Math.max(20, (window.innerWidth - 420) / 2);
                var ct = Math.max(20, (window.innerHeight - totalH) / 2);
                ov.style.width = '420px';
                ov.style.height = totalH + 'px';
                ov.style.left = cl + 'px';
                ov.style.top = ct + 'px';
                localStorage.setItem('cos-bag-rect', JSON.stringify({ w: 420, h: totalH, l: Math.round(cl), t: Math.round(ct) }));
            }
        } catch(e) {}
        if (typeof WindowHelper !== 'undefined') {
            WindowHelper.makeResizable(ov, { minWidth: 300, minHeight: 200, storeKey: 'cos-bag-rect' });
        }

        // 标题栏拖拽
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

        ov.querySelector('.cos-overlay-close').addEventListener('click', function() {
            document.removeEventListener('mousemove', onBagMove);
            document.removeEventListener('mouseup', onBagUp);
            ov.remove();
        });
        ov.addEventListener('mousedown', function() {
            var tz = (window.__cos_topZ || 10000) + 1;
            window.__cos_topZ = tz;
            ov.style.zIndex = tz;
        });

        // 清理旧 tips，创建新 tip
        var oldTip = document.querySelector('.cos-bag-tip');
        if (oldTip) oldTip.remove();
        var tip = document.createElement('div');
        tip.className = 'cos-bag-tip';
        document.body.appendChild(tip);

        ov.querySelectorAll('.cos-bag-zone').forEach(function(zone) {
            zone.addEventListener('dragover', function(e) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                zone.style.borderColor = (_getZoneColor(zone.dataset.zone) || '#666') + '80';
                zone.style.background = (_getZoneColor(zone.dataset.zone) || '#666') + '15';
            });
            zone.addEventListener('dragleave', function() {
                var m = zoneMeta.find(function(x) { return x.key === zone.dataset.zone; });
                zone.style.borderColor = m ? m.cssColor + '30' : 'rgba(100,160,255,0.12)';
                zone.style.background = 'transparent';
            });
            zone.addEventListener('drop', function(e) {
                e.preventDefault();
                var m2 = zoneMeta.find(function(x) { return x.key === zone.dataset.zone; });
                zone.style.borderColor = m2 ? m2.cssColor + '30' : 'rgba(100,160,255,0.12)';
                zone.style.background = 'transparent';
                var dragId = e.dataTransfer.getData('text/plain');
                var targetZone = zone.dataset.zone;
                if (!dragId) return;
                var a = _getAssignments();
                a[dragId] = targetZone;
                _saveAssignments(a);
                showStore();
            });
        });

        ov.querySelectorAll('.cos-bag-item').forEach(function(el) {
            var id = el.dataset.id;
            el.addEventListener('dragstart', function(e) {
                e.dataTransfer.setData('text/plain', id);
                e.dataTransfer.effectAllowed = 'move';
            });
            el.addEventListener('click', function(e) {
                if (e.target.closest('.cos-bag-item')) {
                    if (skills[id]) {
                        _toggleDisabled(id);
                    } else if (plugins[id]) {
                        installPlugin(id);
                    }
                    showStore();
                }
            });
            el.addEventListener('mouseenter', function(e) {
                var s = skills[id] || plugins[id];
                if (!s) return;
                var disabled = _getDisabled().indexOf(id) !== -1;
                var hint = disabled ? '<span style="color:#94a3b8;">（点击启用）</span>' :
                    (skills[id] ? '<span style="color:#38bdf8;">（点击禁用）</span>' : '<span style="color:#38bdf8;">（点击安装）</span>');
                tip.innerHTML = '<b>' + s.name + '</b>' + (s.description ? '<br>' + s.description : '') + '<br>' + hint;
                tip.classList.add('visible');
            });
            el.addEventListener('mousemove', function(e) {
                tip.style.left = (e.clientX + 12) + 'px';
                tip.style.top = (e.clientY + 12) + 'px';
            });
            el.addEventListener('mouseleave', function() {
                tip.classList.remove('visible');
            });
        });

        var closeBtn2 = ov.querySelector('.cos-overlay-close');
        if (closeBtn2) {
            closeBtn2.addEventListener('click', function cleanupTip() {
                if (tip.parentNode) tip.parentNode.removeChild(tip);
            });
        }
        document.addEventListener('keydown', function esc(e) {
            if (e.code === 'Escape') {
                if (tip.parentNode) tip.parentNode.removeChild(tip);
                document.removeEventListener('keydown', esc);
            }
        });
        renderHotbar();
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

        // 按区域颜色分组
        inner.innerHTML = '';
        var assignments = _getAssignments();
        var disabled = _getDisabled();
        var groups = { red: [], green: [], blue: [], _other: [], _disabled: [] };
        var groupOrder = ['red', 'green', 'blue', '_other'];
        skillOrder.forEach(function(id) {
            if (!skills[id]) return;
            if (disabled.indexOf(id) !== -1) { groups._disabled.push(id); return; }
            var zone = assignments[id];
            if (zone && groups[zone]) groups[zone].push(id);
            else groups._other.push(id);
        });

        // 正常区域
        groupOrder.forEach(function(gk, gi) {
            var ids = groups[gk];
            if (!ids || ids.length === 0) return;
            var zoneColor = _getZoneColor(gk);

            var groupEl = document.createElement('div');
            groupEl.className = 'cos-hotbar-group';

            ids.forEach(function(id) {
                var skill = skills[id];
                if (!skill) return;
                var el = document.createElement('div');
                el.className = 'cos-skill' + (activeSkill === id ? ' cos-skill-active' : '');
                el.draggable = true;
                el.dataset.skillId = id;
                var num = (typeof PLUGIN_NUMBERS !== 'undefined' && PLUGIN_NUMBERS[id]) ? PLUGIN_NUMBERS[id] : '';
                var iconHtml = _getSkillIcon(skill, gk);
                el.innerHTML = '<span class="cos-skill-icon">' + iconHtml + '</span><span class="cos-skill-label">' + skill.name + '</span>' +
                    (num ? '<span class="cos-skill-num">' + num + '</span>' : '');
                el.addEventListener('click', function() {
                    if (activeSkill === id) deactivate();
                    else activate(id);
                });
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

            if (gi < groupOrder.length - 1) {
                var nextIds = groups[groupOrder[gi + 1]];
                if (nextIds && nextIds.length > 0) {
                    var sep = document.createElement('div');
                    sep.className = 'cos-hotbar-sep';
                    inner.appendChild(sep);
                }
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
