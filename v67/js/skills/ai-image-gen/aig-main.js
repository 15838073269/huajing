/**
 * AI 生图 - 公开 API + 工具方法 + 销毁
 */

// ========== 公开方法（供提示词模板调用） ==========

AIImageGenSkill.insertPrompt = function(text) {
    if (!text) return;
    if (!this._overlay || !this._overlay.parentNode) { this._pendingPrompt = text; return; }
    this._formState.prompt = text;
    var ta = this._formBody ? this._formBody.querySelector('#aigPrompt') : null;
    if (ta) { ta.value = text; ta.focus(); }
    this._setStatus('已插入提示词');
};

// ========== 工具 ==========

AIImageGenSkill._setStatus = function(msg) {
    var el = this._overlay ? this._overlay.querySelector('#aigStatus') : null;
    if (el) el.textContent = msg;
};

// ========== 画布联动：自动从画布拾取参考图 ==========

AIImageGenSkill._autoPickFromCanvas = function() {
    if (this._formState.refLock) return false;   // 锁定状态下不覆盖用户参考图
    if (typeof CanvasImages === 'undefined') return false;

    // 优先取多选列表（框选），无则回退单选
    var list = CanvasImages.getSelectedList ? CanvasImages.getSelectedList('display') : null;
    if (!list || !list.length) {
        var selId = CanvasImages.getSelectedId();
        if (!selId) return false;
        var d = CanvasImages.getSelected('display');
        if (!d) return false;
        list = [{ id: selId, dataURL: d }];
    }

    // 签名：同一批选中不重复导入
    var sig = list.map(function(x) { return x.id; }).join(',');
    if (this._formState.canvasSig === sig && this._formState.refImages.length > 0) {
        this._setStatus('已导入所选画布图片');
        return true;
    }

    if (list.length > 16) list = list.slice(0, 16);
    this._formState.refImages = list.map(function(x) { return { dataURL: x.dataURL, name: '画布图片' }; });
    this._formState.canvasSig = sig;
    this._formState.canvasParentId = list[0].id;
    this._renderForm();
    this._autoSave();
    this._setStatus('已从画布导入 ' + list.length + ' 张参考图，输入提示词后生成');
    return true;
};

// ========== 画布选中实时联动（方案A：窗口常驻时自动跟随画布选中变化） ==========

AIImageGenSkill._startCanvasWatch = function() {
    var self = this;
    if (this._canvasWatchTimer) return;
    if (this._lastWatchSig === undefined) this._lastWatchSig = null;
    this._canvasWatchTimer = setInterval(function() {
        if (!self._overlay || !self._overlay.parentNode) return;
        if (self._formState.refLock) return;
        if (self._generating) return;
        var sig = self._getCanvasSig();
        if (sig === self._lastWatchSig) return;
        self._lastWatchSig = sig;
        if (sig) self._autoPickFromCanvas();
    }, 200);
};

AIImageGenSkill._stopCanvasWatch = function() {
    if (this._canvasWatchTimer) { clearInterval(this._canvasWatchTimer); this._canvasWatchTimer = null; }
};

AIImageGenSkill._getCanvasSig = function() {
    if (typeof CanvasImages === 'undefined') return '';
    var list = CanvasImages.getSelectedList ? CanvasImages.getSelectedList('display') : null;
    if (list && list.length) return list.map(function(x) { return x.id; }).join(',');
    var id = CanvasImages.getSelectedId ? CanvasImages.getSelectedId() : null;
    return id || '';
};

AIImageGenSkill._saveWindowSize = function() {
    if (!this._overlay || !this._overlay.parentNode || this._overlay.style.display === 'none') return;
    var r = this._overlay.getBoundingClientRect();
    try { localStorage.setItem('aig-win-v3', JSON.stringify({ w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top) })); } catch(e) {}
};

AIImageGenSkill._destroy = function() {
    this._stopCanvasWatch();
    this._saveWindowSize();
    if (this._overlay && this._overlay.parentNode) this._overlay.parentNode.removeChild(this._overlay);
    if (this._modalEl && this._modalEl.parentNode) this._modalEl.parentNode.removeChild(this._modalEl);
    if (this._historyEl && this._historyEl.parentNode) this._historyEl.parentNode.removeChild(this._historyEl);
    if (this._settingsEl && this._settingsEl.parentNode) this._settingsEl.parentNode.removeChild(this._settingsEl);
    if (this._ratioPanelEl && this._ratioPanelEl.parentNode) this._ratioPanelEl.parentNode.removeChild(this._ratioPanelEl);
    this._modalCreated = false; this._modalEl = null; this._overlay = null;
    this._historyEl = null; this._historyBody = null;
    this._settingsEl = null; this._ratioPanelEl = null; this._formBody = null;
    this._formEventsBound = false;
};
