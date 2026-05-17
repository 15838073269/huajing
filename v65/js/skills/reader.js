/**
 * ============================================
 *   文本阅读器插件 (ReaderSkill)
 *   支持阅读、编辑、保存文本文件
 * ============================================
 *
 * 支持格式：.txt, .md, .js, .json, .html, .css, .xml, .yml, .yaml, .csv, .log, .ini, .cfg, .conf, .env, .sh, .bat, .py, .ts, .jsx, .tsx, .vue, .svelte, .sql, .gitignore, .dockerfile
 */
var ReaderSkill = {
    id: 'reader',
    name: '文本阅读器',
    icon: '读',
    category: '工具',
    description: '支持格式: txt md json js html css xml yml yaml csv log ini cfg conf env sh bat py ts jsx tsx vue svelte sql gitignore dockerfile',
    key: '3',

    _world: null,
    _layer: null,
    _cards: [],
    _cardData: [],

    _supportedExtensions: ['.txt', '.md', '.markdown', '.js', '.json', '.html', '.css', '.xml', '.yml', '.yaml', '.csv', '.log', '.ini', '.cfg', '.conf', '.env', '.sh', '.bat', '.py', '.ts', '.jsx', '.tsx', '.vue', '.svelte', '.sql', '.gitignore', '.dockerfile'],

    _supportedMimeTypes: ['text/plain', 'text/markdown', 'application/javascript', 'application/json', 'text/html', 'text/css', 'text/xml', 'text/yaml', 'text/csv'],

    activate: function(world) {
        this._world = world;
        this._layer = world.getLayer();
        this._bindDragDrop();
        // 如果没有卡片，尝试从 localStorage 恢复
        if (this._cards.length === 0) {
            this._loadFromStorage();
        }
        SkillSystem.renderSubTools();
    },

    deactivate: function() {
        this._unbindDragDrop();
        // 不删除卡片，只解绑拖拽事件
    },

    getSubTools: function() {
        var self = this;
        return [
            {
                label: '拖放文件到画布',
                action: function() {}
            },
            {
                label: '清空所有卡片',
                title: '支持格式: .txt .md .js .json .html .css .xml .yml .yaml .csv .log .ini .cfg .conf .env .sh .bat .py .ts .jsx .tsx .vue .svelte .sql .gitignore .dockerfile',
                action: function() {
                    self._clearAllCards();
                }
            }
        ];
    },

    save: function() {
        this._saveToStorage();
        return { cards: this._cardData.length };
    },

    load: function(data) {
        this._loadFromStorage();
    },

    _saveToStorage: function() {
        var data = [];
        for (var i = 0; i < this._cardData.length; i++) {
            var card = this._cardData[i];
            var textarea = this._cards[i] ? this._cards[i]._textarea : null;
            data.push({
                fileName: card.fileName,
                content: textarea ? textarea.value : card.content,
                x: card.x,
                y: card.y,
                w: card.w,
                h: card.h
            });
        }
        try { localStorage.setItem('reader-cards', JSON.stringify(data)); } catch(e) {}
    },

    _loadFromStorage: function() {
        var self = this;
        try {
            var saved = JSON.parse(localStorage.getItem('reader-cards'));
            if (saved && saved.length) {
                setTimeout(function() {
                    saved.forEach(function(c) {
                        self._createCard(c.fileName, c.content, c.x, c.y, c.w, c.h);
                    });
                }, 100);
            }
        } catch(e) {}
    },

    _bindDragDrop: function() {
        var self = this;
        this._onDragEnter = function(e) { e.preventDefault(); e.stopPropagation(); };
        this._onDragOver = function(e) { e.preventDefault(); e.stopPropagation(); };
        this._onDrop = function(e) { e.preventDefault(); e.stopPropagation(); self._handleDrop(e); };
        document.addEventListener('dragenter', this._onDragEnter);
        document.addEventListener('dragover', this._onDragOver);
        document.addEventListener('drop', this._onDrop);
    },

    _unbindDragDrop: function() {
        document.removeEventListener('dragenter', this._onDragEnter);
        document.removeEventListener('dragover', this._onDragOver);
        document.removeEventListener('drop', this._onDrop);
    },

    _handleDrop: function(e) {
        var files = e.dataTransfer.files;
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            if (this._isSupportedTextFile(file)) {
                this._readTextFile(file, e.clientX, e.clientY);
            }
        }
    },

    _isSupportedTextFile: function(file) {
        var name = file.name.toLowerCase();
        for (var i = 0; i < this._supportedExtensions.length; i++) {
            if (name.endsWith(this._supportedExtensions[i])) return true;
        }
        for (var j = 0; j < this._supportedMimeTypes.length; j++) {
            if (file.type === this._supportedMimeTypes[j]) return true;
        }
        return false;
    },

    _readTextFile: function(file, clientX, clientY) {
        var self = this;
        var reader = new FileReader();
        reader.onload = function(event) {
            var content = event.target.result;
            var worldPos = self._world.screenToWorld(clientX, clientY);
            self._createCard(file.name, content, worldPos.x, worldPos.y);
        };
        reader.onerror = function(error) {
            console.error('ReaderSkill: 读取文件失败:', error);
        };
        reader.readAsText(file, 'utf-8');
    },

    _createCard: function(fileName, content, wx, wy, w, h) {
        var self = this;
        var cardW = w || 420;
        var cardH = h || 300;
        var cardX = wx - cardW / 2;
        var cardY = wy - cardH / 2;
        cardX = this._findNonOverlapPos(cardX, cardY, cardW, cardH);

        var card = document.createElement('div');
        card.style.cssText = 'position:absolute;' +
            'left:' + cardX + 'px;top:' + cardY + 'px;' +
            'width:' + cardW + 'px;height:' + cardH + 'px;' +
            'background:rgba(15,25,50,0.92);' +
            'border:1px solid rgba(100,160,255,0.15);' +
            'border-radius:12px;' +
            'color:#e8edf5;font-size:13px;' +
            'pointer-events:auto;overflow:hidden;' +
            'display:flex;flex-direction:column;' +
            'box-shadow:0 4px 20px rgba(0,0,0,0.4);';

        // 头部：文件名 + 保存按钮 + 关闭按钮
        var header = document.createElement('div');
        header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;' +
            'padding:6px 10px;background:rgba(56,189,248,0.06);' +
            'border-bottom:1px solid rgba(100,160,255,0.1);' +
            'cursor:grab;flex-shrink:0;';

        var title = document.createElement('span');
        title.style.cssText = 'font-size:12px;font-weight:bold;color:#38bdf8;' +
            'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;margin-right:8px;';
        title.textContent = fileName;
        title.title = fileName;

        // 保存按钮
        var saveBtn = document.createElement('span');
        saveBtn.style.cssText = 'cursor:pointer;color:#88aa88;font-size:11px;' +
            'padding:2px 8px;border-radius:4px;flex-shrink:0;margin-right:4px;' +
            'border:1px solid rgba(136,170,136,0.3);transition:all 0.2s;';
        saveBtn.textContent = '保存';
        saveBtn.title = '保存文件到本地';

        saveBtn.addEventListener('mouseenter', function() {
            saveBtn.style.background = 'rgba(136,170,136,0.2)';
            saveBtn.style.color = '#aaddaa';
        });
        saveBtn.addEventListener('mouseleave', function() {
            saveBtn.style.background = '';
            saveBtn.style.color = '#88aa88';
        });
        saveBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            var textarea = card._textarea;
            if (!textarea) return;
            var blob = new Blob([textarea.value], {type: 'text/plain;charset=utf-8'});
            var a = document.createElement('a');
            a.href = URL.createObjectURL(blob);
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(a.href);
            // 闪烁反馈
            saveBtn.textContent = '已保存';
            saveBtn.style.color = '#66cc66';
            setTimeout(function() { saveBtn.textContent = '保存'; saveBtn.style.color = '#88aa88'; }, 1000);
        });

        var closeBtn = document.createElement('span');
        closeBtn.style.cssText = 'cursor:pointer;color:#64748b;font-size:11px;' +
            'padding:2px 6px;border-radius:6px;flex-shrink:0;' +
            'border:1px solid rgba(100,160,255,0.3);transition:all 0.2s;';
        closeBtn.textContent = '关';
        closeBtn.title = '关闭';

        closeBtn.addEventListener('mouseenter', function() {
            closeBtn.style.background = 'rgba(255,80,80,0.3)';
            closeBtn.style.color = '#ff6666';
        });
        closeBtn.addEventListener('mouseleave', function() {
            closeBtn.style.background = '';
            closeBtn.style.color = '#64748b';
        });
        closeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            self._removeCard(card, cardX, cardY, cardW, cardH);
        });

        header.appendChild(title);
        header.appendChild(saveBtn);
        header.appendChild(closeBtn);

        // 内容区域：可编辑 textarea
        var body = document.createElement('div');
        body.style.cssText = 'flex:1;overflow:hidden;display:flex;flex-direction:column;';

        var textarea = document.createElement('textarea');
        textarea.style.cssText = 'flex:1;width:100%;padding:8px 10px;resize:none;border:none;outline:none;' +
            'background:transparent;color:#c8bfb0;font-size:12px;line-height:1.6;' +
            'font-family:Consolas,Monaco,"Courier New",monospace;' +
            'white-space:pre-wrap;word-break:break-all;overflow-y:auto;overflow-x:auto;';
        textarea.value = content;
        textarea.spellcheck = false;
        card._textarea = textarea;

        // 确保 textarea 内滚轮正常工作
        textarea.addEventListener('wheel', function(e) {
            e.stopPropagation();
        }, {passive: true});

        body.appendChild(textarea);
        card.appendChild(header);
        card.appendChild(body);

        this._makeDraggable(card, header);

        this._layer.appendChild(card);
        this._cards.push(card);

        this._cardData.push({
            fileName: fileName,
            content: content,
            x: cardX,
            y: cardY,
            w: cardW,
            h: cardH
        });

        this._world.markContent(cardX, cardY, cardW, cardH);
        this._saveToStorage();
    },

    _removeCard: function(card, x, y, w, h) {
        if (card._cleanup) card._cleanup();
        var idx = this._cards.indexOf(card);
        if (idx !== -1) {
            this._cards.splice(idx, 1);
            this._cardData.splice(idx, 1);
        }
        if (card.parentNode) card.parentNode.removeChild(card);
        this._world.clearContent(x, y, w, h);
        this._saveToStorage();
    },

    _clearAllCards: function() {
        var cardsCopy = this._cards.slice();
        for (var i = 0; i < cardsCopy.length; i++) {
            var card = cardsCopy[i];
            if (card._cleanup) card._cleanup();
            if (card.parentNode) card.parentNode.removeChild(card);
        }
        this._cards = [];
        this._cardData = [];
        this._saveToStorage();
    },

    _findNonOverlapPos: function(x, y, w, h) {
        var maxAttempts = 20;
        var offset = 0;
        for (var attempt = 0; attempt < maxAttempts; attempt++) {
            var overlap = false;
            for (var i = 0; i < this._cardData.length; i++) {
                var d = this._cardData[i];
                if (this._isOverlap(x + offset, y, w, h, d.x, d.y, d.w, d.h)) {
                    overlap = true; break;
                }
            }
            if (!overlap) break;
            offset += 30;
        }
        return x + offset;
    },

    _isOverlap: function(x1, y1, w1, h1, x2, y2, w2, h2) {
        return !(x1 + w1 < x2 || x1 > x2 + w2 || y1 + h1 < y2 || y1 > y2 + h2);
    },

    _makeDraggable: function(card, handle) {
        var self = this;
        var isDragging = false;
        var startX, startY, origX, origY;

        handle.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return;
            e.stopPropagation();
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            origX = parseInt(card.style.left) || 0;
            origY = parseInt(card.style.top) || 0;
            handle.style.cursor = 'grabbing';
        });

        var onMove = function(data) {
            if (!isDragging) return;
            var worldStart = self._world.screenToWorld(startX, startY);
            var worldNow = self._world.screenToWorld(data.screenX, data.screenY);
            var newX = origX + (worldNow.x - worldStart.x);
            var newY = origY + (worldNow.y - worldStart.y);
            card.style.left = newX + 'px';
            card.style.top = newY + 'px';
            var idx = self._cards.indexOf(card);
            if (idx !== -1 && self._cardData[idx]) {
                self._cardData[idx].x = newX;
                self._cardData[idx].y = newY;
            }
        };

        var onUp = function() {
            if (!isDragging) return;
            isDragging = false;
            handle.style.cursor = 'grab';
        };

        this._world.on('mousemove', onMove);
        this._world.on('mouseup', onUp);

        card._cleanup = function() {
            self._world.off('mousemove', onMove);
            self._world.off('mouseup', onUp);
        };
    }
};
