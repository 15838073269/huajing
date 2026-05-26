/**
 * CosAPI — 纯函数 API 层
 * 可被插件 / AI / 低代码组合器同时调用
 * 无 UI 依赖，所有返回 Promise 的函数都可被 await
 */
var CosAPI = (function() {

  // ========================================
  //  File — 文件操作
  // ========================================
  var file = {

    /**
     * 弹出文件选择对话框
     * @param {string} accept - MIME 类型过滤，如 'image/*', 'audio/*', 'video/*'
     * @param {boolean} multiple - 是否多选
     * @returns {Promise<Array<{name, dataURL, type, file}>>}
     */
    pick: function(accept, multiple) {
      return new Promise(function(resolve) {
        var input = document.createElement('input');
        input.type = 'file';
        if (accept) input.accept = accept;
        if (multiple) input.multiple = true;
        input.style.display = 'none';
        document.body.appendChild(input);
        input.addEventListener('change', function() {
          var files = Array.from(input.files);
          if (!files.length) { document.body.removeChild(input); resolve([]); return; }
          var results = [];
          var pending = files.length;
          files.forEach(function(file, idx) {
            var reader = new FileReader();
            reader.onload = function(e) {
              results[idx] = { name: file.name, dataURL: e.target.result, type: file.type, file: file };
              pending--;
              if (pending === 0) {
                document.body.removeChild(input);
                resolve(results);
              }
            };
            reader.readAsDataURL(file);
          });
        });
        input.click();
      });
    },

    /**
     * 快捷选取单个文件
     * @returns {Promise<{name, dataURL, type, file}|null>}
     */
    pickOne: function(accept) {
      return file.pick(accept, false).then(function(list) {
        return list.length > 0 ? list[0] : null;
      });
    },

    /**
     * 触发浏览器下载
     * @param {string} dataURL - 图片/文件 dataURL
     * @param {string} filename - 下载文件名
     */
    save: function(dataURL, filename) {
      var link = document.createElement('a');
      link.download = filename || 'download_' + Date.now() + '.png';
      link.href = dataURL;
      link.click();
    },

    /**
     * 将 File 对象转为 dataURL
     * @param {File} file
     * @returns {Promise<string>}
     */
    toDataURL: function(file) {
      return new Promise(function(resolve) {
        var reader = new FileReader();
        reader.onload = function(e) { resolve(e.target.result); };
        reader.readAsDataURL(file);
      });
    }

  };

  // ========================================
  //  Cloud — 云盘操作
  // ========================================
  var cloud = {

    /**
     * 导出到云盘
     * @param {string} dataURL - 图片 dataURL
     * @param {string} name - 显示名称
     * @param {string} source - 来源说明（如"裁剪"）
     */
    push: function(dataURL, name, source) {
      if (typeof CosCloudDrive === 'undefined') return false;
      CosCloudDrive.add(name || (source + ' ' + new Date().toLocaleTimeString()), source || '插件', dataURL);
      return true;
    },

    /**
     * 从云盘选择一张图片
     * @returns {Promise<{dataURL, name, id, w, h}|null>}
     */
    pull: function() {
      return new Promise(function(resolve) {
        if (typeof CosCloudDrive === 'undefined') { resolve(null); return; }
        CosCloudDrive.setOnSelect(function(item) {
          if (CosCloudDrive._overlay) CosCloudDrive._overlay.style.display = 'none';
          CosCloudDrive.setOnSelect(null);
          resolve(item);
        });
        CosCloudDrive.open();
      });
    }

  };

  // ========================================
  //  Image — 图片处理
  // ========================================
  var image = {

    /**
     * 加载图片
     * @param {string} src - dataURL 或 URL
     * @returns {Promise<HTMLImageElement>}
     */
    load: function(src) {
      return new Promise(function(resolve, reject) {
        var img = new Image();
        img.onload = function() { resolve(img); };
        img.onerror = function() { reject(new Error('Image load failed: ' + src.slice(0, 60))); };
        img.src = src;
      });
    },

    /**
     * 创建离屏 canvas 并绘制图片
     * @param {HTMLImageElement|HTMLVideoElement} source
     * @param {number} [w] - 输出宽度（默认自然宽）
     * @param {number} [h] - 输出高度（默认自然高）
     * @returns {HTMLCanvasElement}
     */
    toCanvas: function(source, w, h) {
      var c = document.createElement('canvas');
      c.width = w || source.naturalWidth || source.videoWidth || source.width;
      c.height = h || source.naturalHeight || source.videoHeight || source.height;
      c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
      return c;
    },

    /**
     * Canvas → dataURL
     * @param {HTMLCanvasElement} canvas
     * @param {string} format - 'image/png' 或 'image/jpeg'
     * @param {number} quality - 0~1
     * @returns {string}
     */
    toDataURL: function(canvas, format, quality) {
      return canvas.toDataURL(format || 'image/png', quality || 0.92);
    },

    /**
     * 裁剪图片
     * @param {HTMLImageElement|string} src - Image 对象或 dataURL
     * @param {number} x
     * @param {number} y
     * @param {number} w
     * @param {number} h
     * @returns {Promise<string>} 裁剪后的 dataURL
     */
    crop: function(src, x, y, w, h) {
      var p = (src instanceof HTMLImageElement) ? Promise.resolve(src) : image.load(src);
      return p.then(function(img) {
        var c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d').drawImage(img, x, y, w, h, 0, 0, w, h);
        return c.toDataURL('image/png');
      });
    },

    /**
     * 缩放图片
     * @param {HTMLImageElement|string} src
     * @param {number} w - 目标宽度
     * @param {number} h - 目标高度
     * @returns {Promise<string>} dataURL
     */
    resize: function(src, w, h) {
      var p = (src instanceof HTMLImageElement) ? Promise.resolve(src) : image.load(src);
      return p.then(function(img) {
        var c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        return c.toDataURL('image/png');
      });
    },

    /**
     * 获取图片自然尺寸
     * @param {string} src
     * @returns {Promise<{w, h}>}
     */
    size: function(src) {
      return image.load(src).then(function(img) {
        return { w: img.naturalWidth, h: img.naturalHeight };
      });
    }

  };

  // ========================================
  //  Audio — 音频处理
  // ========================================
  var audio = {

    /**
     * 解码音频文件为 AudioBuffer
     * @param {ArrayBuffer|Blob} data
     * @returns {Promise<AudioBuffer>}
     */
    decode: function(data) {
      return new Promise(function(resolve, reject) {
        if (!(data instanceof ArrayBuffer)) {
          // Blob → ArrayBuffer
          var reader = new FileReader();
          reader.onload = function(e) { audio.decode(e.target.result).then(resolve).catch(reject); };
          reader.onerror = reject;
          reader.readAsArrayBuffer(data);
          return;
        }
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        ctx.decodeAudioData(data, function(buf) {
          resolve(buf);
        }, function(err) {
          reject(err);
        });
      });
    }

  };

  // ========================================
  //  UI — 轻量提示
  // ========================================
  var ui = {

    /**
     * 显示 toast 消息
     * @param {string} msg
     */
    toast: function(msg) {
      if (typeof showToast === 'function') { showToast(msg); return; }
      console.log('[CosAPI] ' + msg);
    },

    /**
     * Promise 化的 confirm
     * @param {string} msg
     * @returns {Promise<boolean>}
     */
    confirm: function(msg) {
      return Promise.resolve(window.confirm(msg));
    },

    /**
     * 显示 loading 遮罩（需传入 overlay 容器）
     * @param {HTMLElement} container
     * @param {string} text
     * @returns {Function} hide 函数
     */
    showLoading: function(container, text) {
      var el = document.createElement('div');
      el.style.cssText = 'position:absolute;inset:0;z-index:99999;display:flex;align-items:center;' +
        'justify-content:center;background:rgba(0,0,0,0.6);border-radius:8px;' +
        'font-size:14px;color:#38bdf8;flex-direction:column;gap:12px;';
      el.innerHTML = '<div style="width:32px;height:32px;border:3px solid rgba(56,189,248,0.2);' +
        'border-top-color:#38bdf8;border-radius:50%;animation:cos-spin .8s linear infinite;"></div>' +
        '<span>' + (text || '处理中...') + '</span>';
      container.appendChild(el);
      return function() { if (el.parentNode) el.parentNode.removeChild(el); };
    }

  };

  return {
    file: file,
    cloud: cloud,
    image: image,
    audio: audio,
    ui: ui
  };

})();

// 注入 loading 动画关键帧
(function() {
  if (document.getElementById('cos-api-style')) return;
  var s = document.createElement('style');
  s.id = 'cos-api-style';
  s.textContent = '@keyframes cos-spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(s);
})();
