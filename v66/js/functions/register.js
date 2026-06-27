// ========================================
//  单函数注册 —— 每个函数只干一件事
//  AI 通过 FunctionRegistry.list() 发现，
//  通过 FunctionRegistry.call() 调用
//  复杂功能用 workflow 组合
// ========================================

(function() {

  // ==================== 上传 ====================

  FunctionRegistry.register('upload.text', {
    description: '打开文件选择器，上传一个文本文件，返回文件内容',
    params: [],
    handler: function() {
      return CosAPI.file.pick('.txt,.md,.json,.csv,.js,.html,.css,.xml,.yaml,.toml', false).then(function(file) {
        return new Promise(function(res, rej) {
          var r = new FileReader();
          r.onload = function() { res(r.result); };
          r.onerror = function() { rej(new Error('读取失败')); };
          r.readAsText(file);
        });
      });
    }
  });

  FunctionRegistry.register('upload.image', {
    description: '打开文件选择器，上传一张图片，返回 dataURL',
    params: [],
    handler: function() {
      return CosAPI.file.pick('image/*', false).then(function(file) {
        return CosAPI.file.toDataURL(file);
      });
    }
  });

  FunctionRegistry.register('upload.audio', {
    description: '打开文件选择器，上传一个音频文件，返回 ArrayBuffer',
    params: [],
    handler: function() {
      return CosAPI.file.pick('audio/*', false).then(function(file) {
        return new Promise(function(res, rej) {
          var r = new FileReader();
          r.onload = function() { res(r.result); };
          r.onerror = function() { rej(new Error('读取失败')); };
          r.readAsArrayBuffer(file);
        });
      });
    }
  });

  FunctionRegistry.register('upload.video', {
    description: '打开文件选择器，上传一个视频文件，返回 dataURL',
    params: [],
    handler: function() {
      return CosAPI.file.pick('video/*', false).then(function(file) {
        return CosAPI.file.toDataURL(file);
      });
    }
  });

  FunctionRegistry.register('upload.binary', {
    description: '打开文件选择器，上传任意文件，返回 ArrayBuffer',
    params: [],
    handler: function() {
      return CosAPI.file.pick(undefined, false).then(function(file) {
        return new Promise(function(res, rej) {
          var r = new FileReader();
          r.onload = function() { res(r.result); };
          r.onerror = function() { rej(new Error('读取失败')); };
          r.readAsArrayBuffer(file);
        });
      });
    }
  });

  FunctionRegistry.register('upload.fromURL', {
    description: '从 URL 加载远程资源，返回 dataURL',
    params: [
      { name: 'url', type: 'string', description: '远程资源 URL' },
      { name: 'responseType', type: 'string', description: '响应类型: dataURL | text | blob (默认 dataURL)' }
    ],
    handler: function(params) {
      return new Promise(function(res, rej) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', params.url, true);
        if (params.responseType === 'text') {
          xhr.responseType = 'text';
          xhr.onload = function() { res(xhr.response); };
        } else if (params.responseType === 'blob') {
          xhr.responseType = 'blob';
          xhr.onload = function() {
            var r = new FileReader();
            r.onload = function() { res(r.result); };
            r.readAsDataURL(xhr.response);
          };
        } else {
          xhr.responseType = 'blob';
          xhr.onload = function() {
            var r = new FileReader();
            r.onload = function() { res(r.result); };
            r.readAsDataURL(xhr.response);
          };
        }
        xhr.onerror = function() { rej(new Error('加载失败')); };
        xhr.send();
      });
    }
  });

  // ==================== 文件 ====================

  FunctionRegistry.register('file.save', {
    description: '将数据保存为文件并下载到本地',
    params: [
      { name: 'data', type: 'Blob|string|Uint8Array', description: '要保存的数据' },
      { name: 'filename', type: 'string', description: '文件名，如 "output.png"' }
    ],
    handler: function(params) {
      CosAPI.file.save(params.data, params.filename || 'download');
    }
  });

  FunctionRegistry.register('file.toDataURL', {
    description: '将 File 或 Blob 转换为 dataURL 字符串',
    params: [
      { name: 'blob', type: 'Blob|File', description: '要转换的二进制对象' }
    ],
    handler: function(params) {
      return CosAPI.file.toDataURL(params.blob);
    }
  });

  FunctionRegistry.register('file.readText', {
    description: '将 File 或 Blob 读取为文本字符串',
    params: [
      { name: 'blob', type: 'Blob|File', description: '要读取的文件' }
    ],
    handler: function(params) {
      return new Promise(function(res, rej) {
        var r = new FileReader();
        r.onload = function() { res(r.result); };
        r.onerror = function() { rej(new Error('读取失败')); };
        r.readAsText(params.blob);
      });
    }
  });

  FunctionRegistry.register('file.readBuffer', {
    description: '将 File 或 Blob 读取为 ArrayBuffer',
    params: [
      { name: 'blob', type: 'Blob|File', description: '要读取的文件' }
    ],
    handler: function(params) {
      return new Promise(function(res, rej) {
        var r = new FileReader();
        r.onload = function() { res(r.result); };
        r.onerror = function() { rej(new Error('读取失败')); };
        r.readAsArrayBuffer(params.blob);
      });
    }
  });

  FunctionRegistry.register('file.newBlob', {
    description: '从文本或二进制数据创建 Blob 对象',
    params: [
      { name: 'data', type: 'string|ArrayBuffer|Uint8Array', description: '数据' },
      { name: 'mime', type: 'string', description: 'MIME 类型，如 "image/png"' }
    ],
    handler: function(params) {
      return new Blob([params.data], { type: params.mime || '' });
    }
  });

  FunctionRegistry.register('file.loadURL', {
    description: '从 URL 获取资源，以指定类型返回 (text/arrayBuffer/blob)',
    params: [
      { name: 'url', type: 'string', description: '资源 URL' },
      { name: 'type', type: 'string', description: '返回类型: text | arrayBuffer | blob' }
    ],
    handler: function(params) {
      return new Promise(function(res, rej) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', params.url, true);
        xhr.responseType = params.type || 'text';
        xhr.onload = function() { res(xhr.response); };
        xhr.onerror = function() { rej(new Error('加载失败')); };
        xhr.send();
      });
    }
  });

  // ==================== 云存储 ====================

  FunctionRegistry.register('cloud.push', {
    description: '将 dataURL 导出到云盘',
    params: [
      { name: 'dataURL', type: 'string', description: '数据的 dataURL' },
      { name: 'source', type: 'string', description: '来源标识' }
    ],
    handler: function(params) {
      return CosAPI.cloud.push(params.dataURL, params.source || '来源');
    }
  });

  FunctionRegistry.register('cloud.pull', {
    description: '从云盘导入数据，返回 dataURL',
    params: [],
    handler: function() {
      return CosAPI.cloud.pull();
    }
  });

  // ==================== UI ====================

  FunctionRegistry.register('ui.toast', {
    description: '显示一条短暂的提示消息',
    params: [
      { name: 'message', type: 'string', description: '提示内容' }
    ],
    handler: function(params) {
      CosAPI.ui.toast(params.message || '');
    }
  });

  FunctionRegistry.register('ui.confirm', {
    description: '显示确认对话框，用户点确定返回 true，取消返回 false',
    params: [
      { name: 'message', type: 'string', description: '对话框内容' }
    ],
    handler: function(params) {
      return CosAPI.ui.confirm(params.message || '确认?');
    }
  });

  FunctionRegistry.register('ui.prompt', {
    description: '显示输入对话框，返回用户输入的文本',
    params: [
      { name: 'message', type: 'string', description: '提示文字' },
      { name: 'defaultValue', type: 'string', description: '默认值' }
    ],
    handler: function(params) {
      return prompt(params.message || '', params.defaultValue || '');
    }
  });

  FunctionRegistry.register('ui.showLoading', {
    description: '显示全屏加载动画',
    params: [
      { name: 'message', type: 'string', description: '加载提示文字' }
    ],
    handler: function(params) {
      CosAPI.ui.showLoading(params.message || '加载中...');
    }
  });

  FunctionRegistry.register('ui.hideLoading', {
    description: '隐藏全屏加载动画',
    params: [],
    handler: function() {
      CosAPI.ui.showLoading(false);
    }
  });

  FunctionRegistry.register('ui.colorPicker', {
    description: '打开颜色选择器，返回选中颜色的十六进制字符串',
    params: [
      { name: 'defaultColor', type: 'string', description: '默认颜色，如 "#38bdf8"' }
    ],
    handler: function(params) {
      var input = document.createElement('input');
      input.type = 'color';
      input.value = params.defaultColor || '#38bdf8';
      input.click();
      return new Promise(function(res) {
        input.onchange = function() { res(input.value); };
        input.onblur = function() { res(input.value); };
      });
    }
  });

  // ==================== 图像 ====================

  FunctionRegistry.register('image.load', {
    description: '将 dataURL 加载为 HTML Image 元素',
    params: [
      { name: 'dataURL', type: 'string', description: '图片 dataURL' }
    ],
    handler: function(params) {
      return CosAPI.image.load(params.dataURL);
    }
  });

  FunctionRegistry.register('image.toCanvas', {
    description: '将 Image 元素绘制到 Canvas 并返回',
    params: [
      { name: 'image', type: 'HTMLImageElement', description: '图片元素' }
    ],
    handler: function(params) {
      return CosAPI.image.toCanvas(params.image);
    }
  });

  FunctionRegistry.register('image.toDataURL', {
    description: '将 Canvas 导出为 dataURL',
    params: [
      { name: 'canvas', type: 'HTMLCanvasElement', description: 'Canvas 元素' },
      { name: 'format', type: 'string', description: '格式: image/png | image/jpeg (默认 png)' },
      { name: 'quality', type: 'number', description: 'JPEG 质量 0-1，默认 0.92' }
    ],
    handler: function(params) {
      return params.canvas.toDataURL(params.format || 'image/png', params.quality);
    }
  });

  FunctionRegistry.register('image.crop', {
    description: '裁剪 Canvas 的指定区域，返回新的 Canvas',
    params: [
      { name: 'canvas', type: 'HTMLCanvasElement', description: '源 Canvas' },
      { name: 'x', type: 'number', description: '裁剪起始 X' },
      { name: 'y', type: 'number', description: '裁剪起始 Y' },
      { name: 'w', type: 'number', description: '裁剪宽度' },
      { name: 'h', type: 'number', description: '裁剪高度' }
    ],
    handler: function(params) {
      return CosAPI.image.crop(params.canvas, params.x, params.y, params.w, params.h);
    }
  });

  FunctionRegistry.register('image.resize', {
    description: '缩放 Canvas 到指定尺寸，返回新的 Canvas',
    params: [
      { name: 'canvas', type: 'HTMLCanvasElement', description: '源 Canvas' },
      { name: 'w', type: 'number', description: '目标宽度' },
      { name: 'h', type: 'number', description: '目标高度' }
    ],
    handler: function(params) {
      return CosAPI.image.resize(params.canvas, params.w, params.h);
    }
  });

  FunctionRegistry.register('image.size', {
    description: '获取图片元素的原始宽高',
    params: [
      { name: 'image', type: 'HTMLImageElement', description: '图片元素' }
    ],
    handler: function(params) {
      return CosAPI.image.size(params.image);
    }
  });

  FunctionRegistry.register('image.rotate', {
    description: '旋转 Canvas 指定角度，返回新的 Canvas',
    params: [
      { name: 'canvas', type: 'HTMLCanvasElement', description: '源 Canvas' },
      { name: 'degrees', type: 'number', description: '旋转角度，如 90' }
    ],
    handler: function(params) {
      var c = document.createElement('canvas');
      var a = params.degrees * Math.PI / 180;
      var sin = Math.abs(Math.sin(a)), cos = Math.abs(Math.cos(a));
      c.width = params.canvas.width * cos + params.canvas.height * sin;
      c.height = params.canvas.width * sin + params.canvas.height * cos;
      var ctx = c.getContext('2d');
      ctx.translate(c.width / 2, c.height / 2);
      ctx.rotate(a);
      ctx.drawImage(params.canvas, -params.canvas.width / 2, -params.canvas.height / 2);
      return c;
    }
  });

  FunctionRegistry.register('image.flipH', {
    description: '水平翻转 Canvas，返回新的 Canvas',
    params: [
      { name: 'canvas', type: 'HTMLCanvasElement', description: '源 Canvas' }
    ],
    handler: function(params) {
      var c = document.createElement('canvas');
      c.width = params.canvas.width;
      c.height = params.canvas.height;
      var ctx = c.getContext('2d');
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(params.canvas, 0, 0);
      return c;
    }
  });

  FunctionRegistry.register('image.flipV', {
    description: '垂直翻转 Canvas，返回新的 Canvas',
    params: [
      { name: 'canvas', type: 'HTMLCanvasElement', description: '源 Canvas' }
    ],
    handler: function(params) {
      var c = document.createElement('canvas');
      c.width = params.canvas.width;
      c.height = params.canvas.height;
      var ctx = c.getContext('2d');
      ctx.translate(0, c.height);
      ctx.scale(1, -1);
      ctx.drawImage(params.canvas, 0, 0);
      return c;
    }
  });

  FunctionRegistry.register('image.trim', {
    description: '裁剪 Canvas 的透明边缘，返回新的 Canvas',
    params: [
      { name: 'canvas', type: 'HTMLCanvasElement', description: '源 Canvas' }
    ],
    handler: function(params) {
      var ctx = params.canvas.getContext('2d');
      var d = ctx.getImageData(0, 0, params.canvas.width, params.canvas.height);
      var data = d.data;
      var top = null, bottom = null, left = null, right = null;
      for (var y = 0; y < params.canvas.height; y++) {
        for (var x = 0; x < params.canvas.width; x++) {
          var i = (y * params.canvas.width + x) * 4;
          if (data[i + 3] > 0) {
            if (top === null) top = y;
            bottom = y;
            if (left === null || x < left) left = x;
            if (right === null || x > right) right = x;
          }
        }
      }
      if (top === null) return params.canvas;
      var w = right - left + 1, h = bottom - top + 1;
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(params.canvas, left, top, w, h, 0, 0, w, h);
      return c;
    }
  });

  FunctionRegistry.register('image.grayscale', {
    description: '将 Canvas 转为灰度，返回新的 Canvas',
    params: [
      { name: 'canvas', type: 'HTMLCanvasElement', description: '源 Canvas' }
    ],
    handler: function(params) {
      var c = document.createElement('canvas');
      c.width = params.canvas.width;
      c.height = params.canvas.height;
      var ctx = c.getContext('2d');
      ctx.drawImage(params.canvas, 0, 0);
      var d = ctx.getImageData(0, 0, c.width, c.height);
      for (var i = 0; i < d.data.length; i += 4) {
        var gray = 0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2];
        d.data[i] = d.data[i + 1] = d.data[i + 2] = gray;
      }
      ctx.putImageData(d, 0, 0);
      return c;
    }
  });

  FunctionRegistry.register('image.brightness', {
    description: '调整 Canvas 亮度，delta 范围 -255 ~ 255',
    params: [
      { name: 'canvas', type: 'HTMLCanvasElement', description: '源 Canvas' },
      { name: 'delta', type: 'number', description: '亮度调整值，正数变亮' }
    ],
    handler: function(params) {
      var c = document.createElement('canvas');
      c.width = params.canvas.width;
      c.height = params.canvas.height;
      var ctx = c.getContext('2d');
      ctx.drawImage(params.canvas, 0, 0);
      var d = ctx.getImageData(0, 0, c.width, c.height);
      var v = params.delta || 0;
      for (var i = 0; i < d.data.length; i += 4) {
        d.data[i] = Math.max(0, Math.min(255, d.data[i] + v));
        d.data[i + 1] = Math.max(0, Math.min(255, d.data[i + 1] + v));
        d.data[i + 2] = Math.max(0, Math.min(255, d.data[i + 2] + v));
      }
      ctx.putImageData(d, 0, 0);
      return c;
    }
  });

  FunctionRegistry.register('image.contrast', {
    description: '调整 Canvas 对比度，factor 范围 0 ~ 3，1 为原始',
    params: [
      { name: 'canvas', type: 'HTMLCanvasElement', description: '源 Canvas' },
      { name: 'factor', type: 'number', description: '对比度系数' }
    ],
    handler: function(params) {
      var c = document.createElement('canvas');
      c.width = params.canvas.width;
      c.height = params.canvas.height;
      var ctx = c.getContext('2d');
      ctx.drawImage(params.canvas, 0, 0);
      var d = ctx.getImageData(0, 0, c.width, c.height);
      var f = params.factor || 1;
      for (var i = 0; i < d.data.length; i += 4) {
        d.data[i] = Math.max(0, Math.min(255, (d.data[i] - 128) * f + 128));
        d.data[i + 1] = Math.max(0, Math.min(255, (d.data[i + 1] - 128) * f + 128));
        d.data[i + 2] = Math.max(0, Math.min(255, (d.data[i + 2] - 128) * f + 128));
      }
      ctx.putImageData(d, 0, 0);
      return c;
    }
  });

  FunctionRegistry.register('image.saturation', {
    description: '调整 Canvas 饱和度，factor 范围 0 ~ 3，0为灰度，1为原始',
    params: [
      { name: 'canvas', type: 'HTMLCanvasElement', description: '源 Canvas' },
      { name: 'factor', type: 'number', description: '饱和度系数' }
    ],
    handler: function(params) {
      var c = document.createElement('canvas');
      c.width = params.canvas.width;
      c.height = params.canvas.height;
      var ctx = c.getContext('2d');
      ctx.drawImage(params.canvas, 0, 0);
      var d = ctx.getImageData(0, 0, c.width, c.height);
      var f = params.factor || 1;
      var data = d.data;
      for (var i = 0; i < data.length; i += 4) {
        var gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        data[i] = Math.max(0, Math.min(255, gray + (data[i] - gray) * f));
        data[i + 1] = Math.max(0, Math.min(255, gray + (data[i + 1] - gray) * f));
        data[i + 2] = Math.max(0, Math.min(255, gray + (data[i + 2] - gray) * f));
      }
      ctx.putImageData(d, 0, 0);
      return c;
    }
  });

  FunctionRegistry.register('image.histogram', {
    description: '计算 Canvas 的直方图数据，返回 { r, g, b, gray } 每个频道的 256 个值',
    params: [
      { name: 'canvas', type: 'HTMLCanvasElement', description: '源 Canvas' }
    ],
    handler: function(params) {
      var ctx = params.canvas.getContext('2d');
      var d = ctx.getImageData(0, 0, params.canvas.width, params.canvas.height);
      var r = new Array(256).fill(0), g = new Array(256).fill(0), b = new Array(256).fill(0), gray = new Array(256).fill(0);
      for (var i = 0; i < d.data.length; i += 4) {
        r[d.data[i]]++;
        g[d.data[i + 1]]++;
        b[d.data[i + 2]]++;
        gray[Math.round(0.299 * d.data[i] + 0.587 * d.data[i + 1] + 0.114 * d.data[i + 2])]++;
      }
      return { r: r, g: g, b: b, gray: gray };
    }
  });

  FunctionRegistry.register('image.removeBackground', {
    description: '使用色度键（绿幕/蓝幕）移除背景，color 为要移除的颜色 hex，threshold 为容差 0-255',
    params: [
      { name: 'canvas', type: 'HTMLCanvasElement', description: '源 Canvas' },
      { name: 'color', type: 'string', description: '要移除的颜色，如 "#00ff00" 代表绿幕' },
      { name: 'threshold', type: 'number', description: '容差值，默认 100' }
    ],
    handler: function(params) {
      var c = document.createElement('canvas');
      c.width = params.canvas.width;
      c.height = params.canvas.height;
      var ctx = c.getContext('2d');
      ctx.drawImage(params.canvas, 0, 0);
      var d = ctx.getImageData(0, 0, c.width, c.height);
      var hex = params.color || '#00ff00';
      var tr = parseInt(hex.slice(1, 3), 16), tg = parseInt(hex.slice(3, 5), 16), tb = parseInt(hex.slice(5, 7), 16);
      var th = params.threshold || 100;
      for (var i = 0; i < d.data.length; i += 4) {
        var dist = Math.sqrt(
          (d.data[i] - tr) * (d.data[i] - tr) +
          (d.data[i + 1] - tg) * (d.data[i + 1] - tg) +
          (d.data[i + 2] - tb) * (d.data[i + 2] - tb)
        );
        if (dist < th) d.data[i + 3] = 0;
      }
      ctx.putImageData(d, 0, 0);
      return c;
    }
  });

  FunctionRegistry.register('image.merge', {
    description: '将多个 Canvas 按网格排列合并为一个大 Canvas',
    params: [
      { name: 'canvases', type: 'array', description: 'Canvas 数组' },
      { name: 'cols', type: 'number', description: '列数' }
    ],
    handler: function(params) {
      var list = params.canvases || [];
      if (!list.length) return null;
      var cols = params.cols || Math.ceil(Math.sqrt(list.length));
      var rows = Math.ceil(list.length / cols);
      var cellW = list[0].width, cellH = list[0].height;
      for (var i = 1; i < list.length; i++) {
        cellW = Math.max(cellW, list[i].width);
        cellH = Math.max(cellH, list[i].height);
      }
      var c = document.createElement('canvas');
      c.width = cols * cellW;
      c.height = rows * cellH;
      var ctx = c.getContext('2d');
      for (var i = 0; i < list.length; i++) {
        var col = i % cols, row = Math.floor(i / cols);
        ctx.drawImage(list[i], col * cellW, row * cellH);
      }
      return c;
    }
  });

  FunctionRegistry.register('image.splitGrid', {
    description: '将 Canvas 按网格切割成多个小 Canvas',
    params: [
      { name: 'canvas', type: 'HTMLCanvasElement', description: '源 Canvas' },
      { name: 'cols', type: 'number', description: '列数' },
      { name: 'rows', type: 'number', description: '行数' }
    ],
    handler: function(params) {
      var c = params.canvas;
      var cols = params.cols || 1, rows = params.rows || 1;
      var cw = Math.floor(c.width / cols), ch = Math.floor(c.height / rows);
      var result = [];
      for (var r = 0; r < rows; r++) {
        for (var co = 0; co < cols; co++) {
          var cell = document.createElement('canvas');
          cell.width = cw; cell.height = ch;
          cell.getContext('2d').drawImage(c, co * cw, r * ch, cw, ch, 0, 0, cw, ch);
          result.push(cell);
        }
      }
      return result;
    }
  });

  // ==================== 音频 ====================

  FunctionRegistry.register('audio.decode', {
    description: '将音频 ArrayBuffer 解码为 AudioBuffer',
    params: [
      { name: 'arrayBuffer', type: 'ArrayBuffer', description: '音频二进制数据' }
    ],
    handler: function(params) {
      return CosAPI.audio.decode(params.arrayBuffer);
    }
  });

  FunctionRegistry.register('audio.encodeWAV', {
    description: '将 AudioBuffer 编码为 WAV 格式的 Blob',
    params: [
      { name: 'audioBuffer', type: 'AudioBuffer', description: '解码后的音频数据' }
    ],
    handler: function(params) {
      var ab = params.audioBuffer;
      var numChannels = ab.numberOfChannels;
      var sampleRate = ab.sampleRate;
      var length = ab.length;
      var buffer = ab.getChannelData(0);
      var dataSize = length * numChannels * 2;
      var header = new ArrayBuffer(44 + dataSize);
      var view = new DataView(header);

      function writeStr(offset, str) {
        for (var i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
      }
      function writeU16(offset, v) { view.setUint16(offset, v, true); }
      function writeU32(offset, v) { view.setUint32(offset, v, true); }

      writeStr(0, 'RIFF');
      writeU32(4, 36 + dataSize);
      writeStr(8, 'WAVE');
      writeStr(12, 'fmt ');
      writeU32(16, 16);
      writeU16(20, 1);
      writeU16(22, numChannels);
      writeU32(24, sampleRate);
      writeU32(28, sampleRate * numChannels * 2);
      writeU16(32, numChannels * 2);
      writeU16(34, 16);
      writeStr(36, 'data');
      writeU32(40, dataSize);

      var offset = 44;
      for (var i = 0; i < length; i++) {
        var s = Math.max(-1, Math.min(1, buffer[i]));
        view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        offset += 2;
      }
      return new Blob([header], { type: 'audio/wav' });
    }
  });

  FunctionRegistry.register('audio.play', {
    description: '播放一个 AudioBuffer',
    params: [
      { name: 'audioBuffer', type: 'AudioBuffer', description: '要播放的音频' }
    ],
    handler: function(params) {
      var ac = new (window.AudioContext || window.webkitAudioContext)();
      var src = ac.createBufferSource();
      src.buffer = params.audioBuffer;
      src.connect(ac.destination);
      src.start(0);
      return src;
    }
  });

  FunctionRegistry.register('audio.stop', {
    description: '停止音频播放（传入 audio.play 返回的 AudioBufferSourceNode）',
    params: [
      { name: 'source', type: 'AudioBufferSourceNode', description: '播放源节点' }
    ],
    handler: function(params) {
      try { params.source.stop(); } catch(e) {}
    }
  });

  FunctionRegistry.register('audio.getDuration', {
    description: '获取 AudioBuffer 的时长（秒）',
    params: [
      { name: 'audioBuffer', type: 'AudioBuffer', description: '音频数据' }
    ],
    handler: function(params) {
      return params.audioBuffer.duration;
    }
  });

  FunctionRegistry.register('audio.trimSilence', {
    description: '移除 AudioBuffer 首尾的静音部分，threshold 为音量阈值(0-1)，默认 0.02',
    params: [
      { name: 'audioBuffer', type: 'AudioBuffer', description: '音频数据' },
      { name: 'threshold', type: 'number', description: '静音阈值，默认 0.02' }
    ],
    handler: function(params) {
      var ab = params.audioBuffer;
      var data = ab.getChannelData(0);
      var th = params.threshold || 0.02;
      var start = 0, end = data.length - 1;
      while (start < end && Math.abs(data[start]) < th) start++;
      while (end > start && Math.abs(data[end]) < th) end--;
      if (start >= end) return ab;
      var len = end - start + 1;
      var ac = new (window.AudioContext || window.webkitAudioContext)();
      var buf = ac.createBuffer(ab.numberOfChannels, len, ab.sampleRate);
      for (var ch = 0; ch < ab.numberOfChannels; ch++) {
        var chData = ab.getChannelData(ch);
        var out = buf.getChannelData(ch);
        for (var i = 0; i < len; i++) out[i] = chData[start + i];
      }
      return buf;
    }
  });

  FunctionRegistry.register('audio.FFT', {
    description: '对音频数据执行 FFT，返回频域数据（实部和虚部）',
    params: [
      { name: 'samples', type: 'Float32Array|Array', description: '时域采样数据' }
    ],
    handler: function(params) {
      var N = params.samples.length;
      var real = new Float64Array(N);
      var imag = new Float64Array(N);
      for (var i = 0; i < N; i++) real[i] = params.samples[i];
      // Cooley-Tukey FFT
      function fft(real, imag) {
        var n = real.length;
        if (n <= 1) return;
        var evenR = new Float64Array(n / 2), evenI = new Float64Array(n / 2);
        var oddR = new Float64Array(n / 2), oddI = new Float64Array(n / 2);
        for (var i = 0; i < n / 2; i++) {
          evenR[i] = real[2 * i]; evenI[i] = imag[2 * i];
          oddR[i] = real[2 * i + 1]; oddI[i] = imag[2 * i + 1];
        }
        fft(evenR, evenI); fft(oddR, oddI);
        for (var i = 0; i < n / 2; i++) {
          var angle = -2 * Math.PI * i / n;
          var cr = Math.cos(angle), ci = Math.sin(angle);
          var tr = cr * oddR[i] - ci * oddI[i];
          var ti = cr * oddI[i] + ci * oddR[i];
          real[i] = evenR[i] + tr; imag[i] = evenI[i] + ti;
          real[i + n / 2] = evenR[i] - tr; imag[i + n / 2] = evenI[i] - ti;
        }
      }
      fft(real, imag);
      return { real: real, imag: imag };
    }
  });

  FunctionRegistry.register('audio.formatTime', {
    description: '将秒数格式化为 MM:SS 字符串',
    params: [
      { name: 'seconds', type: 'number', description: '秒数' }
    ],
    handler: function(params) {
      var s = Math.floor(params.seconds || 0);
      var m = Math.floor(s / 60);
      s = s % 60;
      return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
    }
  });

  // ==================== 视频 ====================

  FunctionRegistry.register('video.load', {
    description: '打开文件选择器，上传一个视频文件',
    params: [],
    handler: function() {
      return new Promise(function(res, rej) {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'video/*';
        input.onchange = function() {
          var file = input.files[0];
          if (!file) { rej(new Error('未选择文件')); return; }
          CosAPI.file.toDataURL(file).then(res);
        };
        input.click();
      });
    }
  });

  FunctionRegistry.register('video.captureFrame', {
    description: '从视频元素或 dataURL 捕获当前帧为 Canvas',
    params: [
      { name: 'video', type: 'HTMLVideoElement|string', description: 'Video 元素或 dataURL' }
    ],
    handler: function(params) {
      if (typeof params.video === 'string') {
        var img = new Image();
        img.src = params.video;
        return new Promise(function(res) {
          img.onload = function() {
            var c = document.createElement('canvas');
            c.width = img.width; c.height = img.height;
            c.getContext('2d').drawImage(img, 0, 0);
            res(c);
          };
        });
      }
      var v = params.video;
      var c = document.createElement('canvas');
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext('2d').drawImage(v, 0, 0);
      return c;
    }
  });

  FunctionRegistry.register('video.extractFrames', {
    description: '从 dataURL 视频提取帧，按间隔秒数采样，返回 Canvas 数组',
    params: [
      { name: 'dataURL', type: 'string', description: '视频 dataURL' },
      { name: 'interval', type: 'number', description: '采样间隔（秒），默认 1' },
      { name: 'maxFrames', type: 'number', description: '最大帧数，默认 30' }
    ],
    handler: function(params) {
      return new Promise(function(res, rej) {
        var video = document.createElement('video');
        video.src = params.dataURL;
        video.preload = 'auto';
        video.onloadedmetadata = function() {
          var duration = video.duration;
          var interval = params.interval || 1;
          var max = params.maxFrames || 30;
          var count = Math.min(Math.ceil(duration / interval), max);
          var frames = [];
          video.onseeked = function() {
            var c = document.createElement('canvas');
            c.width = video.videoWidth; c.height = video.videoHeight;
            c.getContext('2d').drawImage(video, 0, 0);
            frames.push(c);
            if (frames.length >= count) {
              video.remove();
              res(frames);
              return;
            }
            video.currentTime = frames.length * interval;
          };
          video.currentTime = 0;
        };
        video.onerror = function() { rej(new Error('视频加载失败')); };
      });
    }
  });

  // ==================== 绘图 ====================

  var _drawingPaths = [];
  var _drawingActive = false;
  var _drawingLayer = null;

  FunctionRegistry.register('draw.start', {
    description: '开始一个新的绘图路径',
    params: [
      { name: 'color', type: 'string', description: '线条颜色，默认 "#38bdf8"' },
      { name: 'width', type: 'number', description: '线条宽度，默认 2' }
    ],
    handler: function(params) {
      _drawingPaths.push({ color: params.color || '#38bdf8', width: params.width || 2, points: [] });
      _drawingActive = true;
      if (!_drawingLayer) {
        _drawingLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        _drawingLayer.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:99999;';
        document.body.appendChild(_drawingLayer);
      }
    }
  });

  FunctionRegistry.register('draw.addPoint', {
    description: '向当前绘图路径添加一个点（坐标相对于视口）',
    params: [
      { name: 'x', type: 'number', description: 'X 坐标' },
      { name: 'y', type: 'number', description: 'Y 坐标' }
    ],
    handler: function(params) {
      if (!_drawingActive || !_drawingPaths.length) return;
      var path = _drawingPaths[_drawingPaths.length - 1];
      path.points.push({ x: params.x, y: params.y });
      var svgPath = _drawingLayer.querySelector('path:last-child');
      if (!svgPath) {
        svgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        svgPath.setAttribute('fill', 'none');
        svgPath.setAttribute('stroke', path.color);
        svgPath.setAttribute('stroke-width', path.width);
        svgPath.setAttribute('stroke-linecap', 'round');
        svgPath.setAttribute('stroke-linejoin', 'round');
        _drawingLayer.appendChild(svgPath);
      }
      var d = '';
      for (var i = 0; i < path.points.length; i++) {
        d += (i === 0 ? 'M' : 'L') + path.points[i].x + ' ' + path.points[i].y;
      }
      svgPath.setAttribute('d', d);
    }
  });

  FunctionRegistry.register('draw.endPath', {
    description: '结束当前绘图路径',
    params: [],
    handler: function() {
      _drawingActive = false;
    }
  });

  FunctionRegistry.register('draw.clear', {
    description: '清除所有绘图内容',
    params: [],
    handler: function() {
      _drawingPaths = [];
      _drawingActive = false;
      if (_drawingLayer) { _drawingLayer.remove(); _drawingLayer = null; }
    }
  });

  FunctionRegistry.register('draw.exportSVG', {
    description: '导出所有绘图为 SVG 字符串',
    params: [],
    handler: function() {
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" style="position:fixed;top:0;left:0;width:100%;height:100%;">';
      for (var i = 0; i < _drawingPaths.length; i++) {
        var p = _drawingPaths[i];
        var d = '';
        for (var j = 0; j < p.points.length; j++) {
          d += (j === 0 ? 'M' : 'L') + p.points[j].x + ' ' + p.points[j].y;
        }
        svg += '<path fill="none" stroke="' + p.color + '" stroke-width="' + p.width + '" d="' + d + '"/>';
      }
      svg += '</svg>';
      return svg;
    }
  });

  // ==================== 工具 ====================

  FunctionRegistry.register('util.escapeHtml', {
    description: '转义 HTML 特殊字符，防止 XSS',
    params: [
      { name: 'text', type: 'string', description: '原始文本' }
    ],
    handler: function(params) {
      var div = document.createElement('div');
      div.appendChild(document.createTextNode(params.text || ''));
      return div.innerHTML;
    }
  });

  FunctionRegistry.register('util.randomColor', {
    description: '生成一个随机十六进制颜色',
    params: [],
    handler: function() {
      return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
    }
  });

  FunctionRegistry.register('util.uuid', {
    description: '生成一个 UUID v4 字符串',
    params: [],
    handler: function() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    }
  });

  FunctionRegistry.register('util.base64', {
    description: '将字符串编码为 Base64',
    params: [
      { name: 'text', type: 'string', description: '要编码的文本' }
    ],
    handler: function(params) {
      return btoa(unescape(encodeURIComponent(params.text || '')));
    }
  });

  FunctionRegistry.register('util.base64Decode', {
    description: '将 Base64 解码为字符串',
    params: [
      { name: 'base64', type: 'string', description: 'Base64 编码的文本' }
    ],
    handler: function(params) {
      return decodeURIComponent(escape(atob(params.base64 || '')));
    }
  });

  // ==================== 数学 ====================

  FunctionRegistry.register('math.evaluate', {
    description: '计算数学表达式，返回结果字符串',
    params: [
      { name: 'expression', type: 'string', description: '数学表达式，如 "1+2*3"' }
    ],
    handler: function(params) {
      try {
        return String(eval(params.expression));
      } catch(e) {
        return '错误: ' + e.message;
      }
    }
  });

  // ==================== 数据 ====================

  FunctionRegistry.register('data.saveLocal', {
    description: '保存数据到 localStorage',
    params: [
      { name: 'key', type: 'string', description: '存储键名' },
      { name: 'value', type: 'any', description: '要存储的值（自动 JSON 序列化）' }
    ],
    handler: function(params) {
      try {
        localStorage.setItem(params.key, JSON.stringify(params.value));
      } catch(e) {}
    }
  });

  FunctionRegistry.register('data.loadLocal', {
    description: '从 localStorage 读取数据',
    params: [
      { name: 'key', type: 'string', description: '存储键名' }
    ],
    handler: function(params) {
      try {
        return JSON.parse(localStorage.getItem(params.key));
      } catch(e) { return null; }
    }
  });

  FunctionRegistry.register('data.removeLocal', {
    description: '从 localStorage 删除指定键',
    params: [
      { name: 'key', type: 'string', description: '存储键名' }
    ],
    handler: function(params) {
      try { localStorage.removeItem(params.key); } catch(e) {}
    }
  });

  FunctionRegistry.register('data.saveJSON', {
    description: '将数据保存为 JSON 文件并下载',
    params: [
      { name: 'data', type: 'any', description: '要保存的数据' },
      { name: 'filename', type: 'string', description: '文件名，如 "data.json"' }
    ],
    handler: function(params) {
      var blob = new Blob([JSON.stringify(params.data, null, 2)], { type: 'application/json' });
      CosAPI.file.save(blob, params.filename || 'data.json');
    }
  });

  // ==================== 设置 ====================

  FunctionRegistry.register('settings.get', {
    description: '获取指定设置的当前值',
    params: [
      { name: 'key', type: 'string', description: '设置键名，如 "bgColor"' }
    ],
    handler: function(params) {
      if (typeof Settings !== 'undefined') {
        if (params.key === 'bgColor') return Settings.getBgColor();
      }
      return null;
    }
  });

  FunctionRegistry.register('settings.getBgColor', {
    description: '获取编辑器背景色',
    params: [],
    handler: function() {
      if (typeof Settings !== 'undefined') return Settings.getBgColor();
      return '#0a0f1a';
    }
  });

  FunctionRegistry.register('settings.setBgColor', {
    description: '设置编辑器背景色',
    params: [
      { name: 'color', type: 'string', description: '颜色值，如 "#1a1a2e"' }
    ],
    handler: function(params) {
      if (typeof Settings !== 'undefined') Settings.setBgColor(params.color || '#0a0f1a');
    }
  });

  // ==================== AI ====================

  FunctionRegistry.register('ai.chat', {
    description: '向 AI 发送聊天消息，返回回复文本',
    params: [
      { name: 'message', type: 'string', description: '用户消息' },
      { name: 'system', type: 'string', description: '系统提示词（可选）' }
    ],
    handler: function(params) {
      return new Promise(function(res, rej) {
        if (typeof _callLLM === 'function') {
          _callLLM(params.message, params.system || '', function(reply) { res(reply); });
        } else {
          // 尝试从 gui skill 调用
          var msgs = params.system ? [{ role: 'system', content: params.system }, { role: 'user', content: params.message }]
                                   : [{ role: 'user', content: params.message }];
          var data = { model: 'gpt-4o', messages: msgs };
          var key = '';
          try {
            var k = JSON.parse(localStorage.getItem('imgGenSettings') || '{}');
            key = k.apiKey || '';
          } catch(e) {}
          if (!key) { rej(new Error('未配置 API Key')); return; }
          fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
            body: JSON.stringify(data)
          }).then(function(r) { return r.json(); }).then(function(j) {
            res(j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content : JSON.stringify(j));
          }).catch(rej);
        }
      });
    }
  });

  FunctionRegistry.register('ai.generateImage', {
    description: '使用 AI 生成图片（文生图），返回 dataURL',
    params: [
      { name: 'prompt', type: 'string', description: '图片描述提示词' },
      { name: 'size', type: 'string', description: '图片尺寸，如 "1024x1024"' }
    ],
    handler: function(params) {
      return new Promise(function(res, rej) {
        var size = (params.size || '1024x1024').split('x');
        var data = { model: 'dall-e-3', prompt: params.prompt, n: 1, size: params.size || '1024x1024' };
        var key = '';
        try {
          var k = JSON.parse(localStorage.getItem('imgGenSettings') || '{}');
          key = k.apiKey || '';
        } catch(e) {}
        if (!key) { rej(new Error('未配置 API Key')); return; }
        fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
          body: JSON.stringify(data)
        }).then(function(r) { return r.json(); }).then(function(j) {
          if (j.data && j.data[0] && j.data[0].url) {
            var imgUrl = j.data[0].url;
            // fetch image as dataURL
            fetch(imgUrl).then(function(r) { return r.blob(); }).then(function(blob) {
              var fr = new FileReader();
              fr.onload = function() { res(fr.result); };
              fr.readAsDataURL(blob);
            });
          } else {
            rej(new Error(JSON.stringify(j)));
          }
        }).catch(rej);
      });
    }
  });

  // ==================== 工作流 ====================

  FunctionRegistry.register('flow.sequence', {
    description: '顺序执行多个步骤，每个步骤是 { fn, params }，返回所有结果',
    params: [
      { name: 'steps', type: 'array', description: '步骤数组' }
    ],
    handler: function(params) {
      var steps = params.steps || [];
      return steps.reduce(function(p, step) {
        return p.then(function(results) {
          return FunctionRegistry.call(step.fn, step.params || {}).then(function(r) {
            results.push(r);
            return results;
          });
        });
      }, Promise.resolve([]));
    }
  });

  FunctionRegistry.register('flow.branch', {
    description: '条件分支，condition 为真执行 thenSteps，否则执行 elseSteps',
    params: [
      { name: 'condition', type: 'boolean', description: '判断条件' },
      { name: 'thenSteps', type: 'array', description: '真分支步骤' },
      { name: 'elseSteps', type: 'array', description: '假分支步骤' }
    ],
    handler: function(params) {
      var target = params.condition ? (params.thenSteps || []) : (params.elseSteps || []);
      return target.reduce(function(p, step) {
        return p.then(function(results) {
          return FunctionRegistry.call(step.fn, step.params || {}).then(function(r) {
            results.push(r);
            return results;
          });
        });
      }, Promise.resolve([]));
    }
  });

  FunctionRegistry.register('flow.loop', {
    description: '循环执行指定步骤多次',
    params: [
      { name: 'times', type: 'number', description: '循环次数' },
      { name: 'steps', type: 'array', description: '每次循环执行的步骤' }
    ],
    handler: function(params) {
      var times = params.times || 1;
      var steps = params.steps || [];
      var results = [];
      var chain = Promise.resolve(null);
      for (var i = 0; i < times; i++) {
        chain = chain.then(function(idx) {
          return function() {
            return steps.reduce(function(p, step) {
              return p.then(function(rs) {
                return FunctionRegistry.call(step.fn, step.params || {}).then(function(r) {
                  rs.push(r);
                  return rs;
                });
              });
            }, Promise.resolve([])).then(function(r) {
              results[idx] = r;
            });
          };
        }(i));
      }
      return chain.then(function() { return results; });
    }
  });

})();
