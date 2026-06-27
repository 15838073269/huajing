/**
 * 音频清理插件 - 单文件降噪+剪辑+导出
 */
var AudioCleaner = {
    id: 'audio-cleaner', name: '音频清理', icon: '<span style="color:#38bdf8;">净</span>', category: '音频',
    _world: null, _overlay: null, _srcBuf: null, _onDocMove: null, _onDocUp: null,

    activate: function(world) {
        this._world = world;
        if (this._overlay) { if (!this._overlay.parentNode) document.body.appendChild(this._overlay); SkillSystem.renderSubTools(); return; }
        this._createOverlay();
        SkillSystem.renderSubTools();
    },
    deactivate: function() {},
    getSubTools: function() { return [{ label: '关', action: function() { SkillSystem.deactivate(); } }]; },
    save: function() { return {}; }, load: function() {},

    _getCSS: function() {
        return '.ac-overlay{position:fixed;width:500px;height:280px;z-index:9999;display:flex;flex-direction:column;background:#0f3460;color:#eee;font-family:"Segoe UI",system-ui,sans-serif;border-radius:10px;box-shadow:0 8px 40px rgba(0,0,0,.6);overflow:hidden;user-select:none;}' +
            '.ac-header{display:flex;align-items:center;justify-content:space-between;padding:6px 14px;background:#16213e;border-bottom:1px solid #333;flex-shrink:0;cursor:move;user-select:none;}' +
            '.ac-header h1{font-size:14px;margin:0;color:#eee;}' +
            '.ac-header-right{display:flex;gap:4px;}' +
            '.ac-help-btn{background:rgba(100,160,255,.15);border:1px solid rgba(100,160,255,.25);color:#7dd3fc;border-radius:6px;padding:3px 10px;cursor:pointer;font-size:12px;}' +
            '.ac-help-btn:hover{background:rgba(100,160,255,.25);}' +
            '.ac-close-btn{background:rgba(220,80,60,.2);border:1px solid rgba(220,80,60,.3);color:#e87060;border-radius:6px;padding:3px 10px;cursor:pointer;font-size:11px;}' +
            '.ac-body{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:20px;}' +
            '.ac-file-input{display:none;}' +
            '.ac-file-label{background:rgba(255,255,255,.06);border:1px solid #444;border-radius:6px;padding:8px 18px;cursor:pointer;font-size:13px;color:#bbb;}' +
            '.ac-file-label:hover{background:rgba(255,255,255,.1);}' +
            '.ac-file-name{font-size:12px;color:#666;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}' +
            '.ac-btn{background:linear-gradient(90deg,#e94560,#ff6b9d);border:none;border-radius:6px;padding:8px 24px;color:#fff;font-size:13px;cursor:pointer;transition:opacity .15s;}' +
            '.ac-btn:disabled{opacity:.35;cursor:default;}' +
            '.ac-info{font-size:12px;color:#aaa;min-height:18px;text-align:center;}' +
            '.ac-progress{font-size:11px;color:#666;min-height:16px;text-align:center;}' +
            '.ac-help-overlay{position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(10,15,30,.92);z-index:10000;display:none;flex-direction:column;}' +
            '.ac-help-overlay.show{display:flex;}' +
            '.ac-help-header{display:flex;align-items:center;justify-content:space-between;padding:8px 14px;background:#16213e;border-bottom:1px solid #333;flex-shrink:0;}' +
            '.ac-help-header h2{font-size:14px;margin:0;color:#7dd3fc;}' +
            '.ac-help-close{background:rgba(220,80,60,.2);border:1px solid rgba(220,80,60,.3);color:#e87060;border-radius:6px;padding:2px 10px;cursor:pointer;font-size:11px;}' +
            '.ac-help-body{flex:1;overflow-y:auto;padding:10px 14px;font-size:12px;line-height:1.7;color:#ccc;}' +
            '.ac-help-body h3{margin:12px 0 4px;font-size:14px;color:#7dd3fc;}' +
            '.ac-help-body table{width:100%;border-collapse:collapse;font-size:13px;margin-bottom:6px;}' +
            '.ac-help-body td{padding:4px 8px;border-bottom:1px solid rgba(255,255,255,.06);vertical-align:top;}' +
            '.ac-help-body td:first-child{width:130px;color:#eee;white-space:nowrap;}' +
            '.ac-help-body td:nth-child(2){width:110px;color:#7dd3fc;}' +
            '.ac-help-body td:last-child{color:#ccc;}' +
        '';
    },

    _createOverlay: function() {
        (function() { var id = 'ac-style'; if (!document.getElementById(id)) { var s = document.createElement('style'); s.id = id; s.textContent = AudioCleaner._getCSS(); document.head.appendChild(s); } })();
        var self = this, ov = document.createElement('div');
        ov.className = 'ac-overlay'; ov.setAttribute('data-skill-id', this.id);
        ov.style.left = Math.max(20, (window.innerWidth - 500) / 2) + 'px';
        ov.style.top = Math.max(20, (window.innerHeight - 280) / 2) + 'px';
        document.body.appendChild(ov); this._overlay = ov;

        var hdr = document.createElement('div'); hdr.className = 'ac-header';
        hdr.innerHTML = '<h1>音频清理</h1><div class="ac-header-right"><button class="ac-help-btn" id="ac-help-btn">?</button><button class="ac-close-btn" id="ac-close">关</button></div>';
        ov.appendChild(hdr);

        var body = document.createElement('div'); body.className = 'ac-body';
        body.innerHTML =
            '<input type="file" id="ac-file" class="ac-file-input" accept="audio/*">' +
            '<div><label for="ac-file" class="ac-file-label">导入音频</label><span class="ac-file-name" id="ac-fname"></span></div>' +
            '<button class="ac-btn" id="ac-process">处理并导出</button>' +
            '<div class="ac-info" id="ac-info"></div>' +
            '<div class="ac-progress" id="ac-progress"></div>';
        ov.appendChild(body);

        // 帮助面板
        var helpData = [
        {cat:"蔬菜水果",items:[
        "骨折、骨头断裂 | 芹菜 | 双手握两端慢慢掰断，话筒距断口5cm",
        "刀刺入肉体 | 卷心菜/西瓜 | 菜刀猛插进去，话筒距切口10cm",
        "马蹄声 | 椰子壳(对半剖开) | 两半交替敲击木地板或厚木板，话筒距20cm",
        "血肉模糊、挤压 | 柠檬/橙子 | 手握紧用力捏爆，话筒距10cm",
        "小骨头断裂 | 胡萝卜 | 快速掰成两段，话筒距断口5cm",
        "骨头碎裂 | 冷冻鸡翅 | 用力反折至骨头断裂，话筒距10cm",
        "刀砍骨头 | 鸡腿骨 | 菜刀剁在木砧板上，话筒距20cm"]},
        {cat:"厨房用品",items:[
        "拳头打击 | 湿毛巾卷成条 | 握紧猛甩在木桌面，话筒距30cm",
        "沉闷撞击 | 湿毛巾摊开 | 拍在瓷砖或木地面，话筒距20cm",
        "小雨/大雨 | 烤盘+盐粒 | 盐撒满烤盘双手抖动，话筒距30cm",
        "大雨声 | 喷壶+纸板 | 喷细雾对硬纸板喷，话筒距20cm",
        "开枪声 | 铁皮桶+金属杆 | 用杆猛击桶侧面，话筒距50cm~1m",
        "汽车碰撞 | 铁皮桶 | 推倒滚动，话筒距1m",
        "雷声 | 铁皮/铝板 | 双手抓住两边快速抖动，话筒距30cm",
        "火焰燃烧 | 铝箔纸 | 慢慢搓揉成团再展开，话筒距5cm",
        "篝火 | 塑料袋 | 双手搓揉，话筒距5~10cm",
        "海浪拍岸 | 金属盆+水1/3 | 来回摇晃让水拍打盆壁，话筒距30cm",
        "冒泡喝水 | 水杯+吸管 | 吸管插入水底吹气，话筒距杯口5cm",
        "沉重关门 | 冰箱门 | 用力关上，话筒距50cm",
        "开门 | 生锈铁抽屉 | 缓慢拉开，话筒距20cm",
        "齿轮转动 | 打蛋器手摇 | 不同速度空摇，话筒距10cm",
        "汽车引擎 | 搅拌机 | 空转或放少量水，话筒距50cm",
        "飞机引擎 | 吹风机 | 最大档对着话筒吹距30~50cm",
        "机械运转 | 电风扇 | 录电机运转声，话筒距20cm",
        "电流电焊 | 电蚊拍 | 按下开关靠近话筒5cm",
        "火柴划燃 | 砂纸+木棍 | 包住快速上下摩擦，话筒距5cm",
        "踩雪地 | 玉米淀粉 | 装布袋捏紧再松开，话筒距10cm"]},
        {cat:"工具五金",items:[
        "开枪声 | 钢管+金属桶 | 敲击桶身上部，话筒距50cm~1m",
        "金属碰撞 | 扳手+铁管 | 互相敲击，话筒距30cm",
        "枪上膛 | 金属门栓 | 快速拉开推回，话筒距10cm",
        "铁链声 | 自行车链条 | 提起晃动让链节碰撞，话筒距20cm",
        "弹壳落地 | 硬币3~5枚 | 往水泥地扔，话筒距50cm",
        "锯木头 | 手锯+干树枝 | 来回锯，话筒距20cm",
        "砍树 | 斧头+木头 | 劈柴录砍入+裂开声，话筒距1m",
        "头骨碎裂 | 锤子+椰壳 | 轻敲空椰壳顶部，话筒距20cm",
        "钉钉子 | 锤子+钉子+木板 | 钉钉子，话筒距50cm",
        "铁锹挖土 | 铁锹+沙堆 | 铲沙录铲入+抛洒，话筒距50cm",
        "火车行进 | 钢管 | 铁锤有节奏敲击，话筒距1m",
        "机械伸缩 | 钢卷尺 | 快速拉出再回收，话筒距10cm"]},
        {cat:"纸张布料",items:[
        "踩枯叶碎骨 | 干面条/薯片 | 手里捏碎，话筒距5cm",
        "撕纸声 | 报纸整张 | 匀速撕开，话筒距10cm",
        "蝴蝶翅膀翻书 | 杂志铜版纸 | 快速翻页，话筒距5cm",
        "草地脚步声 | 干纸巾布料 | 双手搓揉，话筒距5cm",
        "风声 | 布条 | 快速在话筒前挥过，距10~20cm",
        "撕布声 | 旧毛巾棉布 | 双手用力撕扯，话筒距10cm",
        "火焰声 | 玻璃纸糖果纸 | 慢慢搓揉成团，话筒距5cm",
        "雨声 | 硬纸板+喷壶 | 喷细雾喷纸板表面，话筒距20cm"]},
        {cat:"塑料橡胶",items:[
        "爆炸声 | 气球大号 | 踩爆，话筒距1m",
        "暴雨声 | 塑料瓶+干豆子 | 用力快速摇晃，话筒距20cm",
        "溪流声 | 塑料瓶+水1/3 | 轻轻前后晃动，话筒距10cm",
        "瀑布声 | 塑料袋+水龙头 | 开小水冲塑料袋表面，话筒距20cm",
        "海浪 | 密封瓶+水1/4 | 来回摇晃，话筒距20cm",
        "汽车刹车 | 橡胶底鞋 | 在瓷砖地面摩擦，话筒距30cm",
        "蜜蜂嗡 | 塑料梳子+纸板 | 梳齿快速刮纸板边缘，话筒距5cm"]},
        {cat:"身体+人声",items:[
        "敲门声 | 手指关节 | 半握拳中指凸出，敲木桌面，话筒距20cm",
        "鸟叫口哨 | 手指+嘴 | 拇指食指沾水按嘴唇向指缝吹气，话筒距5cm",
        "心跳声 | 拳头+桌面 | 拳头包2层毛巾闷击，话筒距30cm",
        "亲吻声 | 自己亲自己 | 对着话筒5cm亲手背",
        "打喷嚏 | 嘴巴 | 吸足气对话筒5cm突然喷出",
        "打嗝 | 吸管+水 | 插入水面快速吸放，话筒距5cm",
        "蛇嘶声 | 嘴巴 | 对话筒2cm拉长说嘶持续3秒",
        "打字机 | 筷子+桌面 | 双手各持一根交替敲，话筒距20cm",
        "脚步声 | 皮鞋 | 木地板不同速度走，话筒距50cm~1m",
        "陷入沼泽 | 手+稀泥 | 伸入泥浆抓握搅动，话筒距20cm",
        "黏液触手 | 手+肥皂水 | 在肥皂水里抓握让气泡破裂，话筒距10cm"]}
        ];
        var helpHtml = '<div class="ac-help-overlay" id="ac-help"><div class="ac-help-header"><h2>破烂拟音参考</h2><button class="ac-help-close" id="ac-help-close">关</button></div><div class="ac-help-body">';
        for (var hi = 0; hi < helpData.length; hi++) { var g = helpData[hi];
            helpHtml += '<h3>' + g.cat + '</h3><table>';
            for (var gi = 0; gi < g.items.length; gi++) { var p = g.items[gi].split('|'); helpHtml += '<tr><td>' + p[0] + '</td><td>' + p[1] + '</td><td>' + p[2] + '</td></tr>'; }
            helpHtml += '</table>'; }
        helpHtml += '</div></div>';
        ov.insertAdjacentHTML('beforeend', helpHtml);

        ov.querySelector('#ac-help-btn').addEventListener('click', function() { ov.querySelector('#ac-help').classList.toggle('show'); });
        ov.querySelector('#ac-help-close').addEventListener('click', function() { ov.querySelector('#ac-help').classList.remove('show'); });
        ov.querySelector('#ac-close').addEventListener('click', function() { self._destroy(); });

        // 文件导入
        var fileInput = ov.querySelector('#ac-file');
        fileInput.addEventListener('change', async function(e) {
            var f = e.target.files[0]; if (!f) return;
            ov.querySelector('#ac-fname').textContent = f.name;
            try { var ab = await f.arrayBuffer(); var ctx = new AudioContext(); self._srcBuf = await ctx.decodeAudioData(ab); ov.querySelector('#ac-info').textContent = '已加载: ' + (self._srcBuf.duration | 0) + 's'; }
            catch (err) { ov.querySelector('#ac-info').textContent = '加载失败'; }
        });

        ov.querySelector('#ac-process').addEventListener('click', function() { self._processSingle(ov); });
        self._bindDrag(hdr, ov);
    },

    _processSingle: function(ov) {
        var self = this, buf = this._srcBuf;
        if (!buf) { ov.querySelector('#ac-info').textContent = '先导入音频'; return; }
        var sr = buf.sampleRate, ch = buf.numberOfChannels, info = ov.querySelector('#ac-info'), progress = ov.querySelector('#ac-progress');
        var btn = ov.querySelector('#ac-process'); btn.disabled = true;
        info.textContent = '处理中...';

        var ch0 = buf.getChannelData(0);
        // 静音检测
        var ws = Math.floor(sr * 0.02), n = Math.floor(ch0.length / ws), rms = new Float32Array(n);
        for (var i = 0; i < n; i++) { var sum = 0; for (var j = 0; j < ws; j++) sum += ch0[i * ws + j] * ch0[i * ws + j]; rms[i] = Math.sqrt(sum / ws); }
        var maxRms = 0; for (var i = 0; i < n; i++) if (rms[i] > maxRms) maxRms = rms[i];
        var sorted = rms.slice().sort(function(a, b) { return a - b; });
        var noiseFloor = sorted[Math.floor(n * 0.1)] || 0;
        var thr = Math.max(noiseFloor * 3, maxRms * 0.005, 0.0005);
        var start = 0, end = n - 1;
        for (var i = 0; i < n; i++) { if (rms[i] > thr) { start = Math.max(0, i - 2); break; } }
        for (var i = n - 1; i >= 0; i--) { if (rms[i] > thr) { end = Math.min(n - 1, i + 2); break; } }
        var trimStart = start * ws, trimLen = Math.min((end - start) * ws, ch0.length - trimStart);
        if (trimLen < 100) { info.textContent = '未检测到有效音频'; btn.disabled = false; return; }
        progress.textContent = '裁剪: 已裁掉 ' + ((buf.length - trimLen) / sr).toFixed(1) + 's 头尾静音';

        // 噪音采样：全曲最安静1秒
        var ws2 = Math.floor(sr * 0.05), n2 = Math.max(1, Math.floor(ch0.length / ws2) - 1), bestRms = Infinity, bestIdx = 0;
        for (var i = 0; i < n2; i++) { var sum = 0; for (var j = 0; j < ws2; j++) sum += ch0[i * ws2 + j] * ch0[i * ws2 + j]; var r = Math.sqrt(sum / ws2); if (r < bestRms) { bestRms = r; bestIdx = i; } }
        var noiseProfile = ch0.slice(Math.max(0, bestIdx * ws2), Math.min(ch0.length, bestIdx * ws2 + sr));

        setTimeout(async function() {
            try {
                var offlineCtx = new OfflineAudioContext(ch, trimLen, sr), sb = offlineCtx.createBuffer(ch, trimLen, sr);
                for (var c = 0; c < ch; c++) { var d = buf.getChannelData(c); for (var i = 0; i < trimLen; i++) sb.getChannelData(c)[i] = d[trimStart + i]; }
                var src = offlineCtx.createBufferSource(); src.buffer = sb;
                var notch = offlineCtx.createBiquadFilter(); notch.type = 'notch'; notch.frequency.value = 50; notch.Q.value = 4;
                var hp = offlineCtx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 120;
                var comp = offlineCtx.createDynamicsCompressor(); comp.threshold.value = -30; comp.ratio.value = 3; comp.attack.value = 0.003; comp.release.value = 0.05;
                src.connect(notch); notch.connect(hp); hp.connect(comp); comp.connect(offlineCtx.destination); src.start();
                progress.textContent = '滤波中...';
                var result = await offlineCtx.startRendering();
                progress.textContent = '降噪中...';
                result = self._applyNoiseReduction(result, noiseProfile, ch);
                var wav = self._encodeWAV(result);
                var a = document.createElement('a'); a.href = URL.createObjectURL(wav); a.download = 'cleaned.wav'; a.click();
                info.textContent = '处理完成';
                progress.textContent = (wav.size / 1024 | 0) + 'KB';
            } catch (err) { info.textContent = '失败: ' + err.message; }
            btn.disabled = false;
        }, 50);
    },

    _applyNoiseReduction: function(buf, noiseProfile, channels) {
        var fftSize = 2048, hop = fftSize / 4, numFrames = Math.max(1, Math.floor((buf.length - fftSize) / hop));
        var wnd = new Float32Array(fftSize); for (var i = 0; i < fftSize; i++) wnd[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / (fftSize - 1));
        var nf = Math.min(20, Math.floor(noiseProfile.length / fftSize)), noiseSpec = new Float32Array(fftSize / 2 + 1);
        if (nf > 0) { for (var f = 0; f < nf; f++) { var off = f * Math.floor(noiseProfile.length / nf), re = new Float32Array(fftSize), im = new Float32Array(fftSize); for (var i = 0; i < fftSize && off + i < noiseProfile.length; i++) { re[i] = noiseProfile[off + i] * wnd[i]; im[i] = 0; } this._FFT(re, im); for (var i = 0; i < fftSize / 2 + 1; i++) noiseSpec[i] += Math.sqrt(re[i] * re[i] + im[i] * im[i]); } for (var i = 0; i < fftSize / 2 + 1; i++) noiseSpec[i] /= nf; }
        for (var c = 0; c < channels; c++) { var data = buf.getChannelData(c).slice(), out = new Float32Array(data.length);
            for (var f = 0; f < numFrames; f++) { var off = f * hop, re = new Float32Array(fftSize), im = new Float32Array(fftSize); for (var i = 0; i < fftSize && off + i < data.length; i++) { re[i] = data[off + i] * wnd[i]; im[i] = 0; } this._FFT(re, im); for (var i = 0; i < fftSize / 2 + 1; i++) { var mag = Math.sqrt(re[i] * re[i] + im[i] * im[i]), phase = Math.atan2(im[i], re[i]), g = 1; if (noiseSpec[i] > 0.001) g = Math.max(0.05, 1 - 0.5 * noiseSpec[i] / (mag + 0.001)); re[i] = mag * g * Math.cos(phase); im[i] = mag * g * Math.sin(phase); } this._IFFT(re, im); for (var i = 0; i < fftSize && off + i < data.length; i++) out[off + i] += re[i] * wnd[i] / (fftSize / 4); }
            var m = 0; for (var i = 0; i < data.length; i++) { if (Math.abs(out[i]) > m) m = Math.abs(out[i]); } if (m > 0) { for (var i = 0; i < data.length; i++) buf.getChannelData(c)[i] = out[i] / m * 0.95; } }
        return buf;
    },

    _FFT: function(re, im) {
        var n = re.length, b = 0; while ((1 << b) < n) b++;
        for (var i = 0; i < n; i++) { var j = 0; for (var k = 0; k < b; k++) j = (j << 1) | ((i >> k) & 1); if (i < j) { var t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
        for (var l = 2; l <= n; l <<= 1) { var a = 2 * Math.PI / l, cr = Math.cos(a), ci = -Math.sin(a); for (var i = 0; i < n; i += l) { var kr = 1, ki = 0; for (var j = 0; j < l / 2; j++) { var tr = re[i + j + l / 2] * kr - im[i + j + l / 2] * ki, ti = re[i + j + l / 2] * ki + im[i + j + l / 2] * kr; re[i + j + l / 2] = re[i + j] - tr; im[i + j + l / 2] = im[i + j] - ti; re[i + j] += tr; im[i + j] += ti; var nr = kr * cr - ki * ci; ki = kr * ci + ki * cr; kr = nr; } } }
    },
    _IFFT: function(re, im) { for (var i = 0; i < re.length; i++) im[i] = -im[i]; this._FFT(re, im); for (var i = 0; i < re.length; i++) { re[i] /= re.length; im[i] = -im[i] / re.length; } },

    _encodeWAV: function(buf) {
        var nc = buf.numberOfChannels, sr = buf.sampleRate, len = buf.length, bs = 16, ba = nc * bs / 8, ds = len * ba, sz = 44 + ds;
        var ab = new ArrayBuffer(sz), v = new DataView(ab);
        var w = function(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
        w(0, 'RIFF'); v.setUint32(4, sz - 8, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true);
        v.setUint16(20, 1, true); v.setUint16(22, nc, true); v.setUint32(24, sr, true); v.setUint32(28, sr * ba, true);
        v.setUint16(32, ba, true); v.setUint16(34, bs, true); w(36, 'data'); v.setUint32(40, ds, true);
        var o = 44; for (var i = 0; i < len; i++) { for (var c = 0; c < nc; c++) { var s = Math.max(-1, Math.min(1, buf.getChannelData(c)[i])); v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7FFF, true); o += 2; } }
        return new Blob([ab], { type: 'audio/wav' });
    },

    _bindDrag: function(hdr, ov) {
        var self = this, dragging = false, startX, startY, startLeft, startTop;
        hdr.addEventListener('mousedown', function(e) { if (e.target.closest('.ac-help-btn,.ac-close-btn')) return; dragging = true; startX = e.clientX; startY = e.clientY; startLeft = ov.offsetLeft; startTop = ov.offsetTop; });
        self._onDocMove = function(e) { if (!dragging) return; ov.style.left = (startLeft + e.clientX - startX) + 'px'; ov.style.top = (startTop + e.clientY - startY) + 'px'; };
        self._onDocUp = function() { dragging = false; };
        document.addEventListener('mousemove', self._onDocMove);
        document.addEventListener('mouseup', self._onDocUp);
    },

    _destroy: function() {
        if (this._onDocMove) document.removeEventListener('mousemove', this._onDocMove);
        if (this._onDocUp) document.removeEventListener('mouseup', this._onDocUp);
        if (this._overlay && this._overlay.parentNode) this._overlay.parentNode.removeChild(this._overlay);
        this._overlay = null; this._srcBuf = null;
        SkillSystem.deactivate();
    }
};
