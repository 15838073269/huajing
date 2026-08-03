/**
 * AI 生图 - IndexedDB 持久化（设置 + 历史）
 * 仅 GPT-Image
 */

AIImageGenSkill._getDB = function() {
    return new Promise(function(res, rej) {
        var r = indexedDB.open('AIGWorkspace', 4);
        r.onupgradeneeded = function(e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
            if (!db.objectStoreNames.contains('images')) db.createObjectStore('images');
            if (!db.objectStoreNames.contains('history')) db.createObjectStore('history', { autoIncrement: true });
            if (!db.objectStoreNames.contains('history-images')) db.createObjectStore('history-images');
        };
        r.onsuccess = function(e) { res(e.target.result); };
        r.onerror = function(e) { rej(e); };
    });
};

AIImageGenSkill._autoSave = function() {
    var self = this;
    var meta = {
        lastParams: this._lastParams || { mode: 'auto', baseK: '1k', ratioW: 1, ratioH: 1 },
        apiConfigs: this._apiConfigs || [],
        currentApiId: this._currentApiId || null,
        defaultModel: this._defaultModel || 'gpt-image-2',
        formState: {
            mode: this._formState.mode,
            baseK: this._formState.baseK,
            ratioW: this._formState.ratioW,
            ratioH: this._formState.ratioH,
            model: this._formState.model,
            quality: this._formState.quality,
            format: this._formState.format,
            numImages: this._formState.numImages
        }
    };
    this._getDB().then(function(db) {
        var tx = db.transaction('meta', 'readwrite');
        tx.objectStore('meta').put(meta, 'workspace');
    }).catch(function() {});
};

AIImageGenSkill._loadSettings = function() {
    var self = this;
    return new Promise(function(resolve) {
        self._getDB().then(function(db) {
            var tx = db.transaction('meta', 'readonly');
            var req = tx.objectStore('meta').get('workspace');
            req.onsuccess = function() {
                var meta = req.result;
                if (meta) {
                    // 兼容旧版本的单个 API 配置
                    if (meta.apiConfigs && meta.apiConfigs.length > 0) {
                        self._apiConfigs = meta.apiConfigs;
                        // 向后兼容：为缺少 model 字段的旧配置补上默认值
                        self._apiConfigs.forEach(function(api) {
                            if (!api.model) api.model = '';
                        });
                        self._currentApiId = meta.currentApiId || (self._apiConfigs.length > 0 ? self._apiConfigs[0].id : null);
                    } else if (meta.apiKey) {
                        // 从旧版本迁移 - 清理旧版本中的硬编码URL
                        var oldBase = meta.apiBase || '';
                        self._apiConfigs = [
                            {
                                id: 1,
                                name: 'API 1',
                                base: oldBase.startsWith('http') ? oldBase : '',
                                key: meta.apiKey || '',
                                model: meta.defaultModel || '',
                                active: true
                            }
                        ];
                        self._currentApiId = 1;
                    }
                    if (meta.defaultModel) self._defaultModel = meta.defaultModel;
                    if (meta.lastParams) self._lastParams = meta.lastParams;
                    if (meta.formState) {
                        var fs = meta.formState;
                        self._formState.mode = fs.mode || 'auto';
                        self._formState.baseK = fs.baseK || '1k';
                        self._formState.ratioW = fs.ratioW || 1;
                        self._formState.ratioH = fs.ratioH || 1;
                        self._formState.model = 'gpt-image-2'; // UI 用的默认模型，实际 API 调用使用 apiConfigs 中的 model
                        self._formState.quality = fs.quality || 'medium';
                        self._formState.format = fs.format || 'png';
                        self._formState.numImages = fs.numImages || 1;
                    }
                    if (meta.lastParams) {
                        self._formState.mode = meta.lastParams.mode || self._formState.mode;
                        self._formState.baseK = meta.lastParams.baseK || self._formState.baseK;
                        self._formState.ratioW = meta.lastParams.ratioW || self._formState.ratioW;
                        self._formState.ratioH = meta.lastParams.ratioH || self._formState.ratioH;
                    }
                }
                // 刷新表单 UI（保留已设置的参考图和提示词）
                if (self._overlay) {
                    var savedRefs = self._formState.refImages || [];
                    var savedPrompt = self._formState.prompt || '';
                    var savedParentId = self._formState.canvasParentId || null;
                    self._renderForm();
                    if (savedRefs.length > 0) {
                        self._formState.refImages = savedRefs;
                        self._formState.canvasParentId = savedParentId;
                        self._renderRefGrid();
                    }
                    if (savedPrompt) {
                        self._formState.prompt = savedPrompt;
                        var ta = self._formBody ? self._formBody.querySelector('#aigPrompt') : null;
                        if (ta) ta.value = savedPrompt;
                    }
                    if (self._pendingPrompt) {
                        var pp = self._pendingPrompt;
                        self._pendingPrompt = null;
                        self._formState.prompt = pp;
                        var ta2 = self._formBody ? self._formBody.querySelector('#aigPrompt') : null;
                        if (ta2) { ta2.value = pp; ta2.focus(); }
                    }
                }
                resolve();
            };
            req.onerror = function() { resolve(); };
        }).catch(function() { resolve(); });
    });
};
