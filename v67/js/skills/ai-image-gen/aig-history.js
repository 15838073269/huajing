/**
 * AI 生图 - 历史记录面板 + 导入导出
 * 使用公共库 cos-pwin / cos-pbtn / CosUI.draggable / cos-pempty
 */

AIImageGenSkill._makeThumbnail = function(dataUrl, maxSize) {
    return new Promise(function(resolve) {
        var img = new Image();
        img.onload = function() {
            var scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
            var tw = Math.round(img.width * scale), th = Math.round(img.height * scale);
            var c = document.createElement('canvas');
            c.width = tw; c.height = th;
            c.getContext('2d').drawImage(img, 0, 0, tw, th);
            resolve(c.toDataURL('image/jpeg', 0.7));
        };
        img.onerror = function() { resolve(dataUrl); };
        img.src = dataUrl;
    });
};

AIImageGenSkill._saveToHistory = function(fs, dataUrls, totalSec) {
    if (!dataUrls || !dataUrls.length) return;
    var self = this;
    Promise.all(dataUrls.map(function(url) {
        return self._makeThumbnail(url, 200);
    })).then(function(thumbDataUrls) {
        self._getDB().then(function(db) {
            var tx = db.transaction(['history', 'history-images'], 'readwrite');
            var histStore = tx.objectStore('history');
            var imgStore = tx.objectStore('history-images');
            var addReq = histStore.add({
                prompt: fs.prompt || '',
                thumbDataUrls: thumbDataUrls,
                model: fs.model || 'gpt-image-2',
                size: self._getSizeString(fs),
                mode: fs.mode || 'auto', baseK: fs.baseK || '1k', ratioW: fs.ratioW || 1, ratioH: fs.ratioH || 1,
                quality: fs.quality || 'medium',
                format: fs.format || 'png',
                numImages: dataUrls.length,
                timestamp: Date.now(),
                totalSec: totalSec || ''
            });
            addReq.onsuccess = function() {
                for (var i = 0; i < dataUrls.length; i++) {
                    imgStore.put(dataUrls[i], i === 0 ? addReq.result : addReq.result + '-' + i);
                }
            };
        }).catch(function() {});
    });
};

AIImageGenSkill._showHistory = function() {
    var self = this;
    this._closeHistory();

    // 使用公共窗口样式
    var ov = document.createElement('div');
    ov.className = 'cos-pwin aig-overlay';
    ov.style.width = '740px';
    ov.style.height = '560px';
    ov.style.left = Math.max(20, (window.innerWidth - 740) / 2 + 40) + 'px';
    ov.style.top = Math.max(20, (window.innerHeight - 560) / 2 + 40) + 'px';
    ov.style.minWidth = '400px';
    ov.style.minHeight = '300px';
    ov.style.zIndex = 2147483647;
    ov.setAttribute('data-skill-id', 'ai-image-gen');
    ov.addEventListener('contextmenu', function(e) { e.preventDefault(); });

    // 标题栏（公共 cos-pwin-hdr）
    var header = document.createElement('div');
    header.className = 'cos-pwin-hdr';
    header.innerHTML =
        '<span class="cos-pwin-hdr-title">\ud83d\udccb 生成历史</span>' +
        '<div class="cos-pwin-hdr-right">' +
            '<button class="cos-pbtn cos-pbtn-success cos-pbtn-sm" id="aigHistExport">\ud83d\udce5 导出</button>' +
            '<button class="cos-pbtn cos-pbtn-secondary cos-pbtn-sm" id="aigHistImport">\ud83d\udce9 导入</button>' +
            '<button class="cos-pbtn cos-pbtn-danger cos-pbtn-sm" id="aigHistClear">\ud83d\uddd1 清空历史</button>' +
            '<span class="cos-pclose" id="aigHistClose" title="关闭">\u00d7</span>' +
        '</div>';
    ov.appendChild(header);

    // 内容区（公共 cos-pscroll 滚动）
    var body = document.createElement('div');
    body.className = 'cos-pscroll';
    body.style.flex = '1';
    body.style.overflowY = 'auto';
    body.style.padding = '10px 14px';
    ov.appendChild(body);
    document.body.appendChild(ov);
    this._historyEl = ov;
    this._historyBody = body;

    // 拖拽（使用公共 CosUI.draggable）
    if (typeof CosUI !== 'undefined' && CosUI.draggable) {
        CosUI.draggable.bind(ov, header, { closeSelector: '#aigHistClose,.cos-pclose,button' });
    }

    ov.querySelector('#aigHistClose').addEventListener('click', function() { self._closeHistory(); });
    ov.querySelector('#aigHistExport').addEventListener('click', function() { self._exportHistory(); });
    ov.querySelector('#aigHistImport').addEventListener('click', function() { self._importHistory(); });
    ov.querySelector('#aigHistClear').addEventListener('click', function() {
        if (confirm('确认清空历史？此操作不可撤销。')) { self._clearHistory(); }
    });

    this._historyRecords = null;
    this._historyPage = 0;
    this._refreshHistory();
};

AIImageGenSkill._closeHistory = function() {
    if (this._historyEl && this._historyEl.parentNode) {
        this._historyEl.parentNode.removeChild(this._historyEl);
    }
    this._historyEl = null;
    this._historyBody = null;
    this._historyRecords = null;
    this._historyPage = 0;
};

AIImageGenSkill._clearHistory = function() {
    var self = this;
    this._getDB().then(function(db) {
        var tx = db.transaction(['history', 'history-images'], 'readwrite');
        tx.objectStore('history').clear();
        tx.objectStore('history-images').clear();
        tx.oncomplete = function() {
            self._historyRecords = null;
            self._historyPage = 0;
            if (self._historyBody) {
                // 使用公共 cos-pempty 空状态
                self._historyBody.innerHTML = '<div class="cos-pempty">暂无历史记录。<br>生成图片后自动保存到这里。</div>';
            }
            self._setStatus('历史已清空');
        };
    });
};

AIImageGenSkill._refreshHistory = function() {
    var self = this;
    if (!this._historyBody) return;

    if (this._historyRecords) {
        self._renderHistoryPage();
        return;
    }

    // 使用公共 cos-pempty 加载状态
    this._historyBody.innerHTML = '<div class="cos-pempty">\u23f3 加载中...</div>';
    this._getDB().then(function(db) {
        var tx = db.transaction('history', 'readonly');
        var req = tx.objectStore('history').openCursor(null, 'prev');
        var records = [];
        req.onsuccess = function(e) {
            var cursor = e.target.result;
            if (cursor) {
                var r = cursor.value;
                r.id = cursor.key;
                records.push(r);
                cursor.continue();
            } else {
                if (records.length === 0) {
                    self._historyBody.innerHTML = '<div class="cos-pempty">暂无历史记录。<br>生成图片后自动保存到这里。</div>';
                    return;
                }
                records.sort(function(a, b) { return (b.timestamp || 0) - (a.timestamp || 0); });
                self._historyRecords = records;
                self._historyPage = 0;
                self._renderHistoryPage();
            }
        };
    }).catch(function() {
        self._historyBody.innerHTML = '<div class="cos-pempty">加载失败</div>';
    });
};

AIImageGenSkill._renderHistoryPage = function() {
    var self = this;
    var records = this._historyRecords;
    if (!records || records.length === 0) return;
    var ps = this._HISTORY_PAGE_SIZE;
    var start = this._historyPage * ps;
    var end = Math.min(start + ps, records.length);

    if (start === 0) this._historyBody.innerHTML = '';

    for (var i = start; i < end; i++) {
        var r = records[i];
        var timeStr = r.timestamp ? new Date(r.timestamp).toLocaleString() : '';
        var promptPreview = (r.prompt || '').substring(0, 200);
        if ((r.prompt || '').length > 200) promptPreview += '...';
        var thumbs = r.thumbDataUrls && r.thumbDataUrls.length ? r.thumbDataUrls : (r.thumbDataUrl ? [r.thumbDataUrl] : (r.imageDataUrl ? [r.imageDataUrl] : ['']));
        var thumbsHtml = '';
        for (var ti = 0; ti < thumbs.length; ti++) {
            thumbsHtml += '<img class="aig-history-thumb" src="' + thumbs[ti] + '" data-hist-idx="' + i + '" data-img-idx="' + ti + '" onerror="this.style.display=\'none\'">';
        }
        var entry = document.createElement('div');
        entry.className = 'aig-history-entry';
        entry.innerHTML =
            '<div class="aig-history-thumbs">' + thumbsHtml + '</div>' +
            '<div class="aig-history-info">' +
                '<div class="aig-history-prompt">' + self._escapeHtml(promptPreview) + '</div>' +
                '<div class="aig-history-meta">' +
                    '<span>' + (r.model || '-') + '</span>' +
                    '<span>' + (r.size || '-') + '</span>' +
                    '<span>生成于 ' + timeStr + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="aig-history-actions">' +
                '<button class="aig-history-btn-gen" data-hist-idx="' + i + '" data-action="restore">\ud83d\udd04 还原</button>' +
                '<button class="aig-history-btn-del" data-hist-idx="' + i + '" data-action="delete">\ud83d\uddd1\ufe0f 删除</button>' +
            '</div>';
        self._historyBody.appendChild(entry);
    }

    self._historyBody.querySelectorAll('.aig-history-thumb').forEach(function(img) {
        img.addEventListener('click', function() {
            var idx = parseInt(this.getAttribute('data-hist-idx'));
            var imgIdx = parseInt(this.getAttribute('data-img-idx')) || 0;
            var rec = records[idx];
            if (rec && rec.id !== undefined) {
                self._getDB().then(function(db) {
                    var tx = db.transaction('history-images', 'readonly');
                    var key = imgIdx === 0 ? rec.id : rec.id + '-' + imgIdx;
                    var rq = tx.objectStore('history-images').get(key);
                    rq.onsuccess = function() { if (rq.result) self._viewImage(rq.result); };
                });
            }
        });
    });

    self._historyBody.querySelectorAll('[data-action="restore"]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var idx = parseInt(this.getAttribute('data-hist-idx'));
            self._restoreFromHistory(records[idx]);
        });
    });

    self._historyBody.querySelectorAll('[data-action="delete"]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            var idx = parseInt(this.getAttribute('data-hist-idx'));
            self._deleteHistoryEntry(records[idx]);
        });
    });

    // 加载更多按钮（使用公共 cos-pbtn）
    if (end < records.length) {
        var moreWrap = document.createElement('div');
        moreWrap.style.cssText = 'text-align:center;padding:12px;';
        var moreBtn = document.createElement('button');
        moreBtn.className = 'cos-pbtn cos-pbtn-secondary cos-pbtn-sm';
        moreBtn.textContent = '加载更多 (' + (records.length - end) + ')';
        moreBtn.addEventListener('click', function() {
            self._historyPage++;
            self._renderHistoryPage();
        });
        moreWrap.appendChild(moreBtn);
        self._historyBody.appendChild(moreWrap);
    }
};

AIImageGenSkill._restoreFromHistory = function(record) {
    if (!record) return;
    var self = this;
    var numImages = record.numImages || 1;
    var useFullImages = function(fullDataUrls) {
        // 填充表单参数
        self._formState.prompt = record.prompt || '';
        self._formState.mode = record.mode || 'auto';
        self._formState.baseK = record.baseK || '1k';
        self._formState.ratioW = record.ratioW || 1;
        self._formState.ratioH = record.ratioH || 1;
        self._formState.model = 'gpt-image-2';
        self._formState.quality = record.quality || 'medium';
        self._formState.format = record.format || 'png';
        self._formState.numImages = numImages;
        self._renderForm();
        self._autoSave();
        // 将图片放到画布
        if (typeof CanvasImages !== 'undefined') {
            var prevId = null;
            for (var i = 0; i < fullDataUrls.length; i++) {
                if (fullDataUrls[i]) {
                    CanvasImages.place(fullDataUrls[i], null, null, 'AI生图', prevId).then(function(newId) {
                        prevId = newId;
                    }).catch(function() {});
                }
            }
        }
        self._setStatus('\u2705 已从历史还原 (' + fullDataUrls.filter(Boolean).length + ' 张)');
        if (self._historyEl) self._historyEl.style.zIndex = 10001;
    };
    var loadAll = function() {
        self._getDB().then(function(db) {
            var tx = db.transaction('history-images', 'readonly');
            var results = [], done = 0;
            for (var i = 0; i < numImages; i++) {
                (function(ii) {
                    var key = ii === 0 ? record.id : record.id + '-' + ii;
                    var req = tx.objectStore('history-images').get(key);
                    req.onsuccess = function() { results[ii] = req.result || ''; done++; if (done >= numImages) useFullImages(results); };
                    req.onerror = function() { results[ii] = ''; done++; if (done >= numImages) useFullImages(results); };
                })(i);
            }
        });
    };
    if (record.id !== undefined) { loadAll(); } else { useFullImages([record.imageDataUrl || '']); }
};

AIImageGenSkill._deleteHistoryEntry = function(record) {
    var self = this;
    if (!record) return;
    this._getDB().then(function(db) {
        var tx = db.transaction(['history', 'history-images'], 'readwrite');
        var histStore = tx.objectStore('history');
        var imgStore = tx.objectStore('history-images');
        if (record.id !== undefined) {
            histStore.delete(record.id);
            imgStore.delete(record.id);
        } else {
            var req = histStore.openCursor();
            req.onsuccess = function(e) {
                var cursor = e.target.result;
                if (cursor) {
                    var val = cursor.value;
                    if (val.timestamp === record.timestamp && val.prompt === record.prompt &&
                        (val.imageDataUrl === record.imageDataUrl || val.thumbDataUrl === record.thumbDataUrl)) {
                        cursor.delete();
                        imgStore.delete(cursor.key);
                    }
                    cursor.continue();
                }
            };
        }
        tx.oncomplete = function() {
            self._historyRecords = null;
            self._refreshHistory();
            self._setStatus('已删除历史记录');
        };
    }).catch(function() {});
};

AIImageGenSkill._exportHistory = function() {
    var self = this;
    this._getDB().then(function(db) {
        var histTx = db.transaction('history', 'readonly');
        var curReq = histTx.objectStore('history').openCursor();
        var fullRecords = [];
        curReq.onsuccess = function(e) {
            var cursor = e.target.result;
            if (cursor) {
                var r = cursor.value;
                r.id = cursor.key;
                fullRecords.push(r);
                cursor.continue();
            } else {
                if (fullRecords.length === 0) { self._setStatus('没有历史可导出'); return; }
                if (typeof JSZip === 'undefined') { self._setStatus('缺少 JSZip 库，无法导出'); return; }
                var needKeys = [];
                for (var i = 0; i < fullRecords.length; i++) {
                    var r = fullRecords[i];
                    var n = (r.numImages && r.numImages > 1) ? r.numImages : 1;
                    r._imgCount = n;
                    for (var j = 0; j < n; j++) {
                        var key = j === 0 ? r.id : r.id + '-' + j;
                        needKeys.push({ recIdx: i, imgIdx: j, key: key });
                    }
                }
                var loadImages = function(cb) {
                    if (needKeys.length === 0) { cb({}); return; }
                    var imgTx = db.transaction('history-images', 'readonly');
                    var imgStore = imgTx.objectStore('history-images');
                    var loaded = {}; var done2 = 0; var total = needKeys.length;
                    for (var ii = 0; ii < needKeys.length; ii++) {
                        (function(nk) {
                            var imgReq = imgStore.get(nk.key);
                            imgReq.onsuccess = function() {
                                if (imgReq.result) loaded[nk.recIdx + '-' + nk.imgIdx] = imgReq.result;
                                done2++;
                                if (done2 >= total) cb(loaded);
                            };
                            imgReq.onerror = function() { done2++; if (done2 >= total) cb(loaded); };
                        })(needKeys[ii]);
                    }
                };
                loadImages(function(imgMap) {
                    var zip = new JSZip();
                    for (var i = 0; i < fullRecords.length; i++) {
                        var r = fullRecords[i];
                        var idx = String(i + 1).padStart(3, '0');
                        var base = 'history_' + idx;
                        var ts = r.timestamp ? new Date(r.timestamp).toLocaleString() : '-';
                        var prompt = (r.prompt || '').replace(/\n/g, ' ');
                        for (var j = 0; j < r._imgCount; j++) {
                            var dataUrl = imgMap[i + '-' + j] || (j === 0 ? (r.imageDataUrl || '') : '');
                            if (!dataUrl) continue;
                            var ext = 'png'; var mm = dataUrl.match(/^data:image\/(\w+)/);
                            if (mm) ext = mm[1] === 'jpeg' ? 'jpg' : mm[1];
                            var commaIdx = dataUrl.indexOf(',');
                            var raw = commaIdx > -1 ? dataUrl.slice(commaIdx + 1) : dataUrl;
                            var fBase = r._imgCount > 1 ? base + '_' + String(j + 1).padStart(2, '0') : base;
                            zip.file(fBase + '.' + ext, raw, { base64: true });
                        }
                        var txtContent = 'Prompt: ' + prompt + '\n' +
                            'Model: ' + (r.model || '-') + '\n' +
                            'Size: ' + (r.size || '-') + '\n' +
                            'Quality: ' + (r.quality || '-') + '\n' +
                            '时间: ' + ts + '\n';
                        zip.file(base + '.txt', txtContent);
                    }
                    var jsonMeta = fullRecords.map(function(r) {
                        var c = {};
                        for (var k in r) {
                            if (k !== 'imageDataUrl' && k !== '_imgCount') c[k] = r[k];
                        }
                        return c;
                    });
                    zip.file('history.json', JSON.stringify({ version: 2, records: jsonMeta }, null, 2));
                    zip.generateAsync({ type: 'blob' }).then(function(blob) {
                        var url = URL.createObjectURL(blob);
                        var a = document.createElement('a');
                        a.href = url;
                        a.download = 'ai-history-' + new Date().toISOString().slice(0, 10) + '.zip';
                        a.click();
                        URL.revokeObjectURL(url);
                        self._setStatus('已导出 ' + fullRecords.length + ' 条记录（ZIP）');
                    });
                });
            }
        };
    }).catch(function() {});
};

AIImageGenSkill._importHistory = function() {
    var self = this;
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.zip,application/json,application/zip';
    input.addEventListener('change', function(e) {
        if (!e.target.files.length) return;
        var file = e.target.files[0];
        var isZip = file.name.toLowerCase().endsWith('.zip');
        if (isZip) {
            if (typeof JSZip === 'undefined') { self._setStatus('缺少 JSZip 库'); return; }
            var reader = new FileReader();
            reader.onload = function(ev) {
                JSZip.loadAsync(ev.target.result).then(function(zip) {
                    var entry = zip.file('history.json');
                    if (!entry) { self._setStatus('ZIP 中未找到 history.json'); return; }
                    return entry.async('string');
                }).then(function(jsonStr) {
                    var data = JSON.parse(jsonStr);
                    if (!data.records || !Array.isArray(data.records)) { self._setStatus('无效的历史文件'); return; }
                    self._importRecords(data.records);
                }).catch(function(err) { self._setStatus('导入失败: ' + (err.message || err)); });
            };
            reader.readAsArrayBuffer(file);
        } else {
            var reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    var data = JSON.parse(ev.target.result);
                    if (!data.records || !Array.isArray(data.records)) { self._setStatus('无效的历史文件'); return; }
                    self._importRecords(data.records);
                } catch(e) { self._setStatus('导入失败: ' + e.message); }
            };
            reader.readAsText(file);
        }
    });
    input.click();
};

AIImageGenSkill._importRecords = function(records) {
    var self = this;
    if (!records || records.length === 0) { self._setStatus('没有可导入的记录'); return; }
    self._getDB().then(function(db) {
        var tx = db.transaction(['history', 'history-images'], 'readwrite');
        var histStore = tx.objectStore('history');
        var imgStore = tx.objectStore('history-images');
        var count = 0, done = 0, total = records.length;
        for (var i = 0; i < total; i++) {
            (function(r) {
                var id = r.id;
                var fullDataUrl = r.imageDataUrl || '';
                delete r.id;
                delete r.imageDataUrl;
                if (!r.thumbDataUrl && fullDataUrl) {
                    var img = new Image();
                    img.onload = function() {
                        var scale = Math.min(200 / img.width, 200 / img.height, 1);
                        var c = document.createElement('canvas');
                        c.width = Math.round(img.width * scale);
                        c.height = Math.round(img.height * scale);
                        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                        r.thumbDataUrl = c.toDataURL('image/jpeg', 0.7);
                        var addReq = histStore.add(r);
                        addReq.onsuccess = function() {
                            if (fullDataUrl) imgStore.put(fullDataUrl, addReq.result);
                            count++; done++; if (done >= total) finish();
                        };
                        addReq.onerror = function() { done++; if (done >= total) finish(); };
                    };
                    img.onerror = function() {
                        var addReq = histStore.add(r);
                        addReq.onsuccess = function() {
                            if (fullDataUrl) imgStore.put(fullDataUrl, addReq.result);
                            count++; done++; if (done >= total) finish();
                        };
                        addReq.onerror = function() { done++; if (done >= total) finish(); };
                    };
                    img.src = fullDataUrl;
                } else {
                    var addReq = histStore.add(r);
                    addReq.onsuccess = function() {
                        if (fullDataUrl) imgStore.put(fullDataUrl, addReq.result);
                        count++; done++; if (done >= total) finish();
                    };
                    addReq.onerror = function() { done++; if (done >= total) finish(); };
                }
            })(records[i]);
        }
        function finish() {
            self._historyRecords = null;
            self._refreshHistory();
            self._setStatus('已导入 ' + count + ' 条记录' + (count < total ? '（部分失败）' : ''));
        }
    });
};

AIImageGenSkill._escapeHtml = function(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
};
