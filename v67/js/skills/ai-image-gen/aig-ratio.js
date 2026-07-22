/**
 * AI 生图 - 比例选择面板
 * 适配表单状态（替代原节点系统）
 * 使用公共库 cos-pwin / cos-pwin-hdr / cos-pclose / CosUI.draggable
 */

AIImageGenSkill._openRatioPanel = function() {
    var self = this;
    var fs = this._formState;

    // 关闭已有面板
    if (this._ratioPanelEl && this._ratioPanelEl.parentNode) {
        this._ratioPanelEl.parentNode.removeChild(this._ratioPanelEl);
        this._ratioPanelEl = null;
    }

    // 使用公共窗口样式
    var panel = document.createElement('div');
    panel.className = 'cos-pwin aig-overlay';
    panel.style.width = '340px';
    panel.style.zIndex = 2147483647;
    panel.style.minWidth = '300px';
    panel.style.minHeight = '200px';

    // 定位到主窗口右侧
    if (this._overlay) {
        var or = this._overlay.getBoundingClientRect();
        var left = or.right + 6;
        if (left + 340 > window.innerWidth) left = or.left - 346;
        panel.style.left = Math.max(2, left) + 'px';
        panel.style.top = Math.max(2, or.top) + 'px';
    } else {
        panel.style.left = Math.max(20, (window.innerWidth - 340) / 2) + 'px';
        panel.style.top = Math.max(20, (window.innerHeight - 420) / 2) + 'px';
    }
    panel.addEventListener('contextmenu', function(e) { e.preventDefault(); });

    // 标题栏
    var header = document.createElement('div');
    header.className = 'cos-pwin-hdr';
    header.innerHTML =
        '<span class="cos-pwin-hdr-title">\ud83d\udcd0 选择比例</span>' +
        '<div class="cos-pwin-hdr-right">' +
            '<span class="cos-pclose" title="关闭">\u00d7</span>' +
        '</div>';
    panel.appendChild(header);

    // 拖拽
    if (typeof CosUI !== 'undefined' && CosUI.draggable) {
        CosUI.draggable.bind(panel, header, { closeSelector: '.cos-pclose' });
    }

    // 关闭
    panel.querySelector('.cos-pclose').addEventListener('click', function() {
        if (panel.parentNode) panel.parentNode.removeChild(panel);
        if (self._ratioPanelEl === panel) self._ratioPanelEl = null;
    });

    // 表格内容
    var body = document.createElement('div');
    body.className = 'aig-rp-body cos-pscroll';
    body.innerHTML = this._buildRatioGrid(fs);
    panel.appendChild(body);

    // 底部
    var foot = document.createElement('div');
    foot.className = 'aig-rp-foot';
    foot.innerHTML = this._ratioFootHTML(fs);
    panel.appendChild(foot);

    // 分辨率选择行（1K/2K/4K）—— 与比例共同决定最终像素，放进面板顶部避免漏选
    var baseRow = document.createElement('div');
    baseRow.className = 'aig-rp-base';
    baseRow.innerHTML = this._buildBaseRow(fs);
    panel.insertBefore(baseRow, body);
    this._bindBaseRow(baseRow, body, foot);

    document.body.appendChild(panel);
    this._ratioPanelEl = panel;

    // 单元格点击
    this._bindRatioCells(body, foot, fs);
};

AIImageGenSkill._buildRatioGrid = function(fs) {
    var vals = this._RATIO_VALS;
    var html = '<div class="aig-rp-grid">';
    html += '<div></div>';
    for (var ci = 0; ci < vals.length; ci++) {
        html += '<div class="rp-h">' + vals[ci] + '</div>';
    }
    for (var ri = 0; ri < vals.length; ri++) {
        html += '<div class="rp-v">' + vals[ri] + '</div>';
        for (var cj = 0; cj < vals.length; cj++) {
            var w = vals[ri], h = vals[cj];
            var active = (fs.ratioW === w && fs.ratioH === h) ? ' active' : '';
            var longS = Math.max(w, h), shortS = Math.min(w, h);
            var exceed = (longS / shortS > 3);
            var isDupSquare = (w === h && w > 1);
            var rawMax = this._BASE_MAP[fs.baseK] || 1024;
            var rawW, rawH;
            if (w >= h) { rawW = rawMax; rawH = Math.round(rawMax * h / w / 16) * 16; }
            else { rawH = rawMax; rawW = Math.round(rawMax * w / h / 16) * 16; }
            var rawPx = rawW * rawH;
            var rawValid = rawPx >= 655360 && rawPx <= 8294400 && rawW % 16 === 0 && rawH % 16 === 0;
            var label = this._ratioLabel(w, h);
            var disabled = (exceed || isDupSquare || !rawValid) ? ' disabled' : '';
            html += '<div class="rp-cell' + active + disabled + '" data-w="' + w + '" data-h="' + h + '">' + label + '</div>';
        }
    }
    html += '</div>';
    return html;
};

AIImageGenSkill._bindRatioCells = function(body, foot, fs) {
    var self = this;
    body.querySelectorAll('.rp-cell:not(.disabled)').forEach(function(cell) {
        cell.addEventListener('click', function() {
            var w = parseInt(this.getAttribute('data-w'));
            var h = parseInt(this.getAttribute('data-h'));
            fs.ratioW = w;
            fs.ratioH = h;
            body.querySelectorAll('.rp-cell').forEach(function(c) { c.classList.remove('active'); });
            this.classList.add('active');
            foot.innerHTML = '当前: <span class="rp-cur">' + self._ratioLabel(w, h) + '</span>';
            // 更新主表单的比例按钮文字
            var ratioBtn = self._formBody ? self._formBody.querySelector('[data-action="openratio"]') : null;
            if (ratioBtn) ratioBtn.textContent = '比例 ' + self._ratioLabel(w, h);
            self._lastParams = self._collectLastParams();
            self._autoSave();
        });
    });
};

AIImageGenSkill._buildBaseRow = function(fs) {
    var baseKeys = ['1k', '2k', '4k'];
    var baseLabels = { '1k': '1K 1024', '2k': '2K 2048', '4k': '4K 3840' };
    var html = '<span class="aig-rp-base-l">分辨率</span>';
    for (var i = 0; i < baseKeys.length; i++) {
        var bk = baseKeys[i];
        var active = (fs.baseK === bk) ? ' active' : '';
        html += '<div class="aig-size-btn' + active + '" data-action="basesel" data-value="' + bk + '">' + baseLabels[bk] + '</div>';
    }
    return html;
};

AIImageGenSkill._bindBaseRow = function(baseRow, body, foot) {
    var self = this;
    baseRow.querySelectorAll('[data-action="basesel"]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var bk = btn.getAttribute('data-value');
            self._formState.baseK = bk;
            baseRow.querySelectorAll('[data-action="basesel"]').forEach(function(b) {
                b.classList.toggle('active', b.getAttribute('data-value') === bk);
            });
            // 网格单元格有效性依赖 baseK，需重建
            body.innerHTML = self._buildRatioGrid(self._formState);
            self._bindRatioCells(body, foot, self._formState);
            foot.innerHTML = self._ratioFootHTML(self._formState);
            // 同步主表单的 1K/2K/4K 高亮
            if (self._formBody) {
                self._formBody.querySelectorAll('.aig-size-btn[data-action="basesel"]').forEach(function(b) {
                    b.classList.toggle('active', b.getAttribute('data-value') === bk);
                });
            }
            self._lastParams = self._collectLastParams();
            self._autoSave();
        });
    });
};

AIImageGenSkill._ratioFootHTML = function(fs) {
    var r = this._computeResolution(fs.mode, fs.baseK, fs.ratioW, fs.ratioH);
    if (!r) {
        return '比例 ' + this._ratioLabel(fs.ratioW, fs.ratioH) +
            ' · <b>1024×1024</b> <span class="aig-rp-warn">⚠ 该组合违反尺寸规则，将回退 1K</span>';
    }
    return '比例 ' + this._ratioLabel(fs.ratioW, fs.ratioH) + ' · <b>' + r.width + '×' + r.height + '</b>';
};

AIImageGenSkill._refreshRatioPanel = function() {
    var panel = this._ratioPanelEl;
    if (!panel) return;
    var fs = this._formState;
    var body = panel.querySelector('.aig-rp-body');
    var foot = panel.querySelector('.aig-rp-foot');
    var baseRow = panel.querySelector('.aig-rp-base');
    if (!body) return;

    body.innerHTML = this._buildRatioGrid(fs);
    if (baseRow) baseRow.innerHTML = this._buildBaseRow(fs);
    if (foot) foot.innerHTML = this._ratioFootHTML(fs);
    this._bindRatioCells(body, foot, fs);
    if (baseRow) this._bindBaseRow(baseRow, body, foot);
};
