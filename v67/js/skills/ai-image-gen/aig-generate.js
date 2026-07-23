/**
 * AI 生图 - 生成 API 调用 + 画布占位图 + 计时器
 * 仅 GPT-Image，支持连续提交
 */

AIImageGenSkill._generate = async function() {
    var self = this;
    this._generating = true;

    this._collectFormParams();
    var fs = this._formState;

    var rawPrompt = (fs.prompt || '').trim();
    if (!rawPrompt) { this._setStatus('⚠️ 输入提示词'); return; }

    var apiKey = (this._getCurrentApiKey() || '').trim();
    if (!apiKey) { this._setStatus('⚠️ 设置 API Key'); return; }

    // 从提示词末尾提取 -宽x高 分辨率后缀
    var prompt = rawPrompt;
    var overrideSize = null;
    var sizeMatch = rawPrompt.match(/\s*-(\d+x\d+)\s*$/);
    if (sizeMatch) {
        overrideSize = sizeMatch[1];
        prompt = rawPrompt.substring(0, rawPrompt.lastIndexOf(sizeMatch[0])).trim();
    }

    // 自动保存提示词到模板：每次提交都把当前提示词塞进模板面板
    // addTemplate 现在会立即同步写入内存+localStorage（立即可见），不再依赖异步加载完成，
    // 因此不再需要 _ensureLoaded 等待，也不再需要强制 activate（避免 activate 触发 _loadData 覆盖内存新增项）。
    var _ptSave = function() {
        if (!PromptTemplateSkill || !PromptTemplateSkill.addTemplate) return;
        if (rawPrompt !== fs._lastSavedPrompt) {
            PromptTemplateSkill.addTemplate(rawPrompt);
            fs._lastSavedPrompt = rawPrompt;
        }
    };
    if (typeof PromptTemplateSkill !== 'undefined') {
        _ptSave();
    } else {
        // 兜底：理论上 main.js 启动已加载本插件；极端情况下未加载则动态加载后再保存
        try {
            var _s = document.createElement('script');
            _s.src = 'js/skills/prompt-template.js?v=131';
            _s.onload = function() { _ptSave(); };
            _s.onerror = function() {};
            document.head.appendChild(_s);
        } catch(e) {}
    }

    // 标题栏状态仅显示"生成中"
    this._setStatus('⏳ 生成中...');

    var startTime = Date.now();

    // 创建画布占位图
    var placeholderId = null;
    var timerOverlay = null;
    var parentId = fs.canvasParentId || null;

    if (typeof CanvasImages !== 'undefined') {
        var res = this._computeResolution(fs.mode, fs.baseK, fs.ratioW, fs.ratioH);
        var pw = res ? res.width : 512;
        var ph = res ? res.height : 512;
        var placeholderDataUrl = this._makePlaceholderImage(pw, ph);
        try {
            placeholderId = await CanvasImages.place(placeholderDataUrl, null, null, 'AI生图⏳', parentId);
            timerOverlay = this._addTimerOverlay(placeholderId);
        } catch(e) { /* 放置失败不影响生成 */ }
    }

    // 计时器（仅更新画布占位图覆层）
    var timerInterval = setInterval(function() {
        var elapsed = Math.floor((Date.now() - startTime) / 1000);
        if (timerOverlay) {
            var timeEl = timerOverlay.querySelector('.aig-timer-time');
            if (timeEl) timeEl.textContent = '⏳ ' + elapsed + 's';
        }
    }, 500);

    try {
        var isImg2Img = fs.refImages && fs.refImages.length > 0;
        var resp;

        // ===== GPT-Image =====
        if (isImg2Img) {
            // 图生图：FormData + /images/edits
            var formData = new FormData();
            for (var ri = 0; ri < fs.refImages.length; ri++) {
                var refData = fs.refImages[ri].dataURL;
                var raw = refData.indexOf('base64,') > -1 ? refData : 'data:image/png;base64,' + refData;
                var binary = atob(raw.split('base64,')[1]);
                var arr = new Uint8Array(binary.length);
                for (var bi = 0; bi < binary.length; bi++) arr[bi] = binary.charCodeAt(bi);
                var fileName = fs.refImages[ri].name || ('ref_' + ri + '.png');
                formData.append('image', new File([new Blob([arr], { type: 'image/png' })], fileName, { type: 'image/png' }));
            }
            formData.append('prompt', prompt);
            formData.append('model', 'gpt-image-2');
            formData.append('n', String(fs.numImages || 1));
            formData.append('size', overrideSize || this._getSizeString(fs));
            if (fs.quality) formData.append('quality', fs.quality);
            resp = await fetch((this._getCurrentApiBase() || 'https://api3.wlai.vip') + '/v1/images/edits', {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Authorization': 'Bearer ' + apiKey },
                body: formData
            });
        } else {
            // 文生图：JSON + /images/generations
            var bodyObj = {
                model: 'gpt-image-2',
                prompt: prompt,
                n: fs.numImages || 1,
                size: overrideSize || this._getSizeString(fs)
            };
            if (fs.quality) bodyObj.quality = fs.quality;
            resp = await fetch((this._getCurrentApiBase() || 'https://api3.wlai.vip') + '/v1/images/generations', {
                method: 'POST',
                headers: { 'Accept': 'application/json', 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyObj)
            });
        }

        var data = await resp.json();
        if (!resp.ok) throw new Error((data && data.error && data.error.message) ? data.error.message : JSON.stringify(data));
        if (!data.data || data.data.length === 0) throw new Error('返回数据为空');

        // 收集结果
        var dataUrls = [];
        for (var di = 0; di < data.data.length; di++) {
            var item = data.data[di];
            if (item.b64_json) {
                var mime = item.b64_json.indexOf('/9j/') === 0 ? 'image/jpeg' : 'image/png';
                dataUrls.push('data:' + mime + ';base64,' + item.b64_json);
            } else if (item.url) {
                try {
                    var blob = await fetch(item.url).then(function(r) { return r.blob(); });
                    dataUrls.push(await new Promise(function(res) {
                        var fr = new FileReader();
                        fr.onload = function() { res(fr.result); };
                        fr.readAsDataURL(blob);
                    }));
                } catch(e) {
                    dataUrls.push(item.url);
                }
            }
        }

        if (dataUrls.length === 0) throw new Error('无图片数据');

        var totalSec = ((Date.now() - startTime) / 1000).toFixed(1);

        // 取占位图坐标，让结果图落回原位（而非重新自动定位）
        var phX = null, phY = null;
        if (placeholderId && typeof CanvasImages !== 'undefined' && CanvasImages.getById) {
            var phItem = CanvasImages.getById(placeholderId);
            if (phItem) { phX = phItem.x; phY = phItem.y; }
        }

        // 移除占位图
        if (placeholderId && typeof CanvasImages !== 'undefined') {
            CanvasImages.remove(placeholderId);
        }

        // 将结果图放到画布（落在占位图原位，多张向右下错位）
        if (typeof CanvasImages !== 'undefined') {
            var CASCADE = 28;
            var prevId = parentId;
            for (var pi = 0; pi < dataUrls.length; pi++) {
                try {
                    var newId = await CanvasImages.place(dataUrls[pi], phX, phY, 'AI生图', prevId);
                    if (phX != null) { phX += CASCADE; phY += CASCADE; }
                    prevId = newId;
                } catch(e) {}
            }
        }

        // 保存到历史：用当次参数的快照，避免 async 连续提交时共享的 this._formState 被改写导致 prompt 串写
        var snap = {
            prompt: rawPrompt,
            model: fs.model || 'gpt-image-2',
            mode: fs.mode || 'auto',
            baseK: fs.baseK || '1k',
            ratioW: fs.ratioW || 1,
            ratioH: fs.ratioH || 1,
            quality: fs.quality || 'medium',
            format: fs.format || 'png'
        };
        this._saveToHistory(snap, dataUrls, totalSec);

        this._setStatus('✅ ' + totalSec + 's (' + dataUrls.length + ' 张)');

    } catch(e) {
        var errSec = ((Date.now() - startTime) / 1000).toFixed(1);

        // 移除占位图
        if (placeholderId && typeof CanvasImages !== 'undefined') {
            CanvasImages.remove(placeholderId);
        }

        this._setStatus('❌ ' + errSec + 's ' + (e.message || e).substring(0, 30));
    } finally {
        clearInterval(timerInterval);
        self._generating = false;
    }
};

// ========== 占位图生成 ==========

AIImageGenSkill._makePlaceholderImage = function(w, h) {
    var maxSide = 512;
    var sc = Math.min(maxSide / w, maxSide / h, 1);
    var cw = Math.round(w * sc);
    var ch = Math.round(h * sc);

    var canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    var ctx = canvas.getContext('2d');

    // 深色背景
    ctx.fillStyle = '#1a2540';
    ctx.fillRect(0, 0, cw, ch);

    // 边框
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, cw - 4, ch - 4);

    // 占位图不画文字：状态文字统一由计时器覆层（aig-timer-overlay）显示，
    // 避免占位图自带文字与覆层文字叠加看不清。

    return canvas.toDataURL('image/png');
};

// ========== 计时器覆层 ==========

AIImageGenSkill._addTimerOverlay = function(placeholderId) {
    if (!placeholderId) return null;
    var el = document.querySelector('.ci-item[data-id="' + placeholderId + '"]');
    if (!el) return null;
    var wrap = el.querySelector('.ci-img-wrap');
    if (!wrap) return null;

    var overlay = document.createElement('div');
    overlay.className = 'aig-timer-overlay';
    overlay.innerHTML =
        '<div class="aig-timer-text">' +
            '<div class="aig-timer-time">⏳ 0s</div>' +
            '<div class="aig-timer-label">AI生成中</div>' +
        '</div>';
    wrap.appendChild(overlay);
    return overlay;
};
