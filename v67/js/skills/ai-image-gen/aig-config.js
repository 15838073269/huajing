/**
 * AI 生图 - 对象声明 + 属性 + 模型配置 + 分辨率计算
 */

var AIImageGenSkill = {
    id: 'ai-image-gen',
    name: 'AI生图',
    icon: '<span style="color:#fbbf24;">生</span>',
    description: '画布联动 - 文生图/图生图',
    key: '7',

    _world: null,
    _overlay: null,
    _modalEl: null,
    _modalCreated: false,
    _apiConfigs: [
        {
            id: 1,
            name: 'API 1',
            base: 'https://api3.wlai.vip',
            key: '',
            active: true
        }
    ],
    _currentApiId: 1,
    _defaultModel: 'gpt-image-2',
    _historyRecords: null,
    _historyPage: 0,
    _HISTORY_PAGE_SIZE: 20,

    _modelConfigs: {
        'gpt-image-2': {
            sizes: [
                {v:'1024x1024',l:'1K方'},
                {v:'1536x1024',l:'1K横'},
                {v:'1024x1536',l:'1K竖'},
                {v:'2048x2048',l:'2K方'},
                {v:'2048x1152',l:'2K横'},
                {v:'1152x2048',l:'2K竖'},
                {v:'3840x3840',l:'4K方'},
                {v:'3840x2160',l:'4K横'},
                {v:'2160x3840',l:'4K竖'}
            ],
            qualities: [
                {v:'medium',l:'中'},
                {v:'low',l:'低'},
                {v:'high',l:'高'},
                {v:'auto',l:'自动'}
            ],
            formats: [
                {v:'png',l:'PNG'},
                {v:'jpeg',l:'JPEG'},
                {v:'webp',l:'WebP'}
            ]
        },
    },

    _settingsEl: null,
    _ratioPanelEl: null,
    _lastParams: { mode: 'auto', baseK: '1k', ratioW: 1, ratioH: 1 },

    // 表单状态（替代原节点系统）
    _formState: {
        prompt: '',
        mode: 'auto',
        baseK: '1k',
        ratioW: 1,
        ratioH: 1,
        model: 'gpt-image-2',
        quality: 'medium',
        format: 'png',
        numImages: 1,
        refImages: [],
        refLock: false,
        canvasParentId: null
    },

    // ===== 分辨率计算 =====

    _RATIO_VALS: [1,2,3,4,5,9,16,21],
    _BASE_MAP: { 'auto': 0, '1k': 1024, '2k': 2048, '4k': 3840 },
    _API_MAX_SIDE: 3840,  // 后端尺寸规则：最大边长 ≤ 3840（其余 3 条规则由 _computeResolution 强制）

    _computeResolution: function(mode, baseK, ratioW, ratioH) {
        var maxSide = this._BASE_MAP[baseK];
        if (!maxSide) return null;
        if (mode === 'auto') {
            // 方形仍需遵守总像素上限（4K 方 = 3840² 超过 8294400，非法）
            if (maxSide * maxSide > 8294400) return null;
            return { width: maxSide, height: maxSide };
        }
        if (!ratioW || !ratioH) return null;

        var w, h;
        if (ratioW >= ratioH) {
            // 横向/方形
            w = maxSide;
            h = Math.round(maxSide * ratioH / ratioW / 16) * 16;
        } else {
            // 竖向
            h = maxSide;
            w = Math.round(maxSide * ratioW / ratioH / 16) * 16;
        }

        // 规则3: 长边/短边 ≤ 3:1
        if (Math.max(w, h) / Math.min(w, h) > 3) return null;

        // 规则4: 总像素 655360 ~ 8294400
        var pixels = w * h;
        if (pixels < 655360) {
            // 像素不足 → 补足短边至满足最小值
            var minShort = Math.ceil(655360 / maxSide / 16) * 16;
            if (ratioW >= ratioH) h = minShort;
            else w = minShort;
            pixels = w * h;
            // 补足后再次检查比例
            if (Math.max(w, h) / Math.min(w, h) > 3) return null;
        }
        if (pixels > 8294400) return null;

        return { width: w, height: h };
    },

    _ratioLabel: function(ratioW, ratioH) {
        if (!ratioW || !ratioH) return '--:--';
        return ratioW + ':' + ratioH;
    },

    _getSizeString: function(nd) {
        var mode = nd.mode || this._formState.mode;
        var baseK = nd.baseK || this._formState.baseK;
        var ratioW = nd.ratioW || this._formState.ratioW;
        var ratioH = nd.ratioH || this._formState.ratioH;
        var r = this._computeResolution(mode, baseK, ratioW, ratioH);
        if (r) return r.width + 'x' + r.height;
        if (nd.size && nd.size.indexOf('x') > -1) return nd.size;
        return '1024x1024';
    },

    // 从旧 size 字符串推断 baseK/ratio（用于兼容旧存档）
    _inferFromOldSize: function(oldSize) {
        if (!oldSize || oldSize.indexOf('x') === -1) return null;
        var parts = oldSize.split('x');
        var ow = parseInt(parts[0]), oh = parseInt(parts[1]);
        if (isNaN(ow) || isNaN(oh)) return null;
        // 确定 baseK
        var maxSide = Math.max(ow, oh);
        var baseK = '1k';
        if (maxSide > 1024) baseK = '2k';
        if (maxSide > 2048) baseK = '4k';
        // 计算最简比例
        var g = function(a,b){ while(b){ var t=b; b=a%b; a=t; } return a; }(ow, oh);
        return { baseK: baseK, ratioW: ow/g, ratioH: oh/g };
    },

    // ===== API 管理 =====
    _getCurrentApi: function() {
        return this._apiConfigs.find(api => api.id === this._currentApiId) || this._apiConfigs[0];
    },
    
    _getCurrentApiKey: function() {
        var api = this._getCurrentApi();
        return api ? api.key : '';
    },
    
    _getCurrentApiBase: function() {
        var api = this._getCurrentApi();
        return api ? api.base : 'https://api3.wlai.vip';
    },
    
    _addApi: function(name, base, key) {
        var newId = Math.max(...this._apiConfigs.map(api => api.id)) + 1;
        var newApi = {
            id: newId,
            name: name || 'API ' + newId,
            base: base || 'https://api3.wlai.vip',
            key: key || '',
            active: false
        };
        this._apiConfigs.push(newApi);
        this._autoSave();
        return newApi;
    },
    
    _removeApi: function(id) {
        if (this._apiConfigs.length <= 1) return false;
        this._apiConfigs = this._apiConfigs.filter(api => api.id !== id);
        if (this._currentApiId === id) {
            this._currentApiId = this._apiConfigs[0].id;
            this._apiConfigs[0].active = true;
        }
        this._autoSave();
        return true;
    },
    
    _switchApi: function(id) {
        this._apiConfigs.forEach(api => api.active = false);
        var targetApi = this._apiConfigs.find(api => api.id === id);
        if (targetApi) {
            targetApi.active = true;
            this._currentApiId = id;
            this._autoSave();
            return true;
        }
        return false;
    },
    
    _updateApi: function(id, updates) {
        var api = this._apiConfigs.find(api => api.id === id);
        if (api) {
            Object.assign(api, updates);
            this._autoSave();
            return true;
        }
        return false;
    }
};
