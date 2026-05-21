/**
 * 文件夹图片浏览技能
 * 从 v64/js/game.js 改写为 v65 插件
 *
 * 功能：
 *   - 文件夹拖放到画布
 *   - 扫描文件夹中的图片文件
 *   - 网格预览缩略图
 *   - 点击缩略图查看大图
 *   - 图片懒加载
 *   - 关闭面板
 */
var FolderBrowserSkill = {

    // ===== 基本信息 =====
    id: 'folder-browser',
    name: '文件夹浏览',
    icon: '<span style="color:#38bdf8;">图</span>',
    description: '拖放文件夹，网格预览浏览',
    key: '3',

    // ===== 内部状态 =====
    _world: null,
    _folders: {},            // 文件夹数据 { name: { name, images, panel } }
    _panelCounter: 0,        // 面板计数器（用于定位）
    _previewOverlay: null,   // 大图预览层
    _dropHandler: null,      // 拖放事件处理函数
    _dragOverHandler: null,

    // ===== 生命周期 =====

    activate: function(world) {
        this._world = world;
        this._setupDragDrop();
        // 如果没有画布图片，尝试恢复
        if (this._world && this._world.getLayer()) {
            var existing = this._world.getLayer().querySelectorAll('.fb-canvas-image');
            if (existing.length === 0) {
                this._loadFromStorage();
            }
        }
        SkillSystem.renderSubTools();
    },

    deactivate: function() {
        this._removeDragDrop();
        // 不关闭面板和画布图片，只解绑拖拽事件
    },

    getSubTools: function() {
        var self = this;
        return [
            {
                label: '选择文件夹',
                action: function() {
                    self._openFolderPicker();
                }
            },
            {
                label: '关闭所有面板',
                action: function() {
                    self._closeAllPanels();
                }
            },
            {
                label: '清空画布图片',
                action: function() {
                    self._clearCanvasImages();
                }
            }
        ];
    },

    save: function() {
        var layer = this._world && this._world.getLayer();
        var images = [];
        if (layer) {
            var els = layer.querySelectorAll('.fb-canvas-image');
            for (var i = 0; i < els.length; i++) {
                var el = els[i];
                var img = el.querySelector('img');
                if (img) {
                    images.push({
                        src: img.src,
                        name: el.title || '',
                        x: parseInt(el.style.left) || 0,
                        y: parseInt(el.style.top) || 0,
                        w: parseInt(el.style.width) || 200,
                        h: parseInt(el.style.height) || 200
                    });
                }
            }
        }
        try { localStorage.setItem('fb-canvas-images', JSON.stringify(images)); } catch(e) {}
        return { folderCount: Object.keys(this._folders).length };
    },

    load: function(data) {
        if (!data) return;
        var self = this;
        try {
            var saved = JSON.parse(localStorage.getItem('fb-canvas-images'));
            if (saved && saved.length) {
                // 等 world 就绪后恢复
                setTimeout(function() {
                    var layer = self._world && self._world.getLayer();
                    if (!layer) return;
                    saved.forEach(function(item) {
                        var el = document.createElement('div');
                        el.className = 'fb-canvas-image';
                        el.style.cssText = 'position:absolute;left:' + item.x + 'px;top:' + item.y + 'px;' +
                            'width:' + item.w + 'px;height:' + item.h + 'px;pointer-events:auto;cursor:grab;' +
                            'border-radius:4px;overflow:hidden;';
                        var img = document.createElement('img');
                        img.src = item.src;
                        img.style.cssText = 'width:100%;height:100%;display:block;pointer-events:none;';
                        el.appendChild(img);
                        el.title = item.name;

                        // 拖拽移动
                        var dragging = false, sx, sy, ox, oy;
                        el.addEventListener('mousedown', function(e) {
                            if (e.button !== 0) return;
                            e.stopPropagation();
                            dragging = true;
                            sx = e.clientX; sy = e.clientY;
                            ox = parseInt(el.style.left) || 0;
                            oy = parseInt(el.style.top) || 0;
                            el.style.cursor = 'grabbing';
                        });
                        document.addEventListener('mousemove', function(e) {
                            if (!dragging) return;
                            el.style.left = (ox + e.clientX - sx) + 'px';
                            el.style.top = (oy + e.clientY - sy) + 'px';
                        });
                        document.addEventListener('mouseup', function() {
                            if (!dragging) return;
                            dragging = false;
                            el.style.cursor = 'grab';
                        });

                        // 关闭按钮
                        var closeBtn = document.createElement('div');
                        closeBtn.style.cssText = 'position:absolute;top:2px;right:2px;' +
                            'background:rgba(0,0,0,0.6);color:#fff;font-size:10px;line-height:1;padding:2px 5px;' +
                            'border-radius:3px;cursor:pointer;display:none;z-index:2;';
                        closeBtn.textContent = '关';
                        closeBtn.addEventListener('click', function(e) {
                            e.stopPropagation();
                            if (el.parentNode) el.parentNode.removeChild(el);
                        });
                        el.appendChild(closeBtn);
                        el.addEventListener('mouseenter', function() { closeBtn.style.display = 'block'; });
                        el.addEventListener('mouseleave', function() { closeBtn.style.display = 'none'; });

                        layer.appendChild(el);
                    });
                }, 100);
            }
        } catch(e) {}
    },

    // ===== 拖放设置 =====

    _setupDragDrop: function() {
        var self = this;

        this._dragOverHandler = function(e) {
            e.preventDefault();
            e.stopPropagation();
        };

        this._dropHandler = function(e) {
            e.preventDefault();
            e.stopPropagation();

            // 处理从面板拖出的图片到画布
            var imageData = e.dataTransfer.getData('text/plain');
            var imageName = e.dataTransfer.getData('application/x-image-name');
            if (imageData && imageData.startsWith('data:image') && imageName) {
                self._placeImageOnCanvas(imageData, imageName, e.clientX, e.clientY);
                return;
            }

            // 处理文件夹拖入
            if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
                self._processDragItems(e.dataTransfer.items);
            }

            // 处理图片文件拖入：单张直接放画布，多张当文件夹
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                var imageFiles = [];
                for (var i = 0; i < e.dataTransfer.files.length; i++) {
                    if (e.dataTransfer.files[i].type.match(/image\//)) {
                        imageFiles.push(e.dataTransfer.files[i]);
                    }
                }
                if (imageFiles.length === 1) {
                    // 单张图片直接放画布
                    self._dropSingleImageToCanvas(imageFiles[0], e.clientX, e.clientY);
                } else if (imageFiles.length > 1) {
                    // 多张图片当文件夹处理
                    self._processSingleFileDrag(e.dataTransfer.files);
                }
            }
        };

        document.addEventListener('dragover', this._dragOverHandler);
        document.addEventListener('drop', this._dropHandler);
    },

    _removeDragDrop: function() {
        if (this._dragOverHandler) {
            document.removeEventListener('dragover', this._dragOverHandler);
            this._dragOverHandler = null;
        }
        if (this._dropHandler) {
            document.removeEventListener('drop', this._dropHandler);
            this._dropHandler = null;
        }
    },

    _dropSingleImageToCanvas: function(file, clientX, clientY) {
        var self = this;
        var reader = new FileReader();
        reader.onload = function(e) {
            self._placeImageOnCanvas(e.target.result, file.name, clientX, clientY);
        };
        reader.readAsDataURL(file);
    },

    _placeImageOnCanvas: function(dataURL, name, clientX, clientY) {
        var layer = this._world.getLayer();
        if (!layer) return;
        var worldPos = this._world.screenToWorld(clientX, clientY);

        var img = document.createElement('img');
        img.src = dataURL;
        img.onload = function() {
            var maxW = 200, maxH = 200;
            var scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
            var w = Math.round(img.naturalWidth * scale);
            var h = Math.round(img.naturalHeight * scale);

            var el = document.createElement('div');
            el.style.cssText = 'position:absolute;left:' + (worldPos.x - w / 2) + 'px;top:' + (worldPos.y - h / 2) + 'px;' +
                'width:' + w + 'px;height:' + h + 'px;pointer-events:auto;cursor:grab;' +
                'border-radius:4px;overflow:hidden;';
            el.className = 'fb-canvas-image';
            img.style.cssText = 'width:100%;height:100%;display:block;pointer-events:none;';
            el.appendChild(img);
            el.title = name;

            // 拖拽移动
            var dragging = false, sx, sy, ox, oy;
            el.addEventListener('mousedown', function(e) {
                if (e.button !== 0) return;
                e.stopPropagation();
                dragging = true;
                sx = e.clientX; sy = e.clientY;
                ox = parseInt(el.style.left) || 0;
                oy = parseInt(el.style.top) || 0;
                el.style.cursor = 'grabbing';
            });
            var onMove = function(data) {
                if (!dragging) return;
                var ws = layer.closest('[data-world]') || layer;
                // 简单用屏幕像素差
                el.style.left = (ox + data.screenX - sx) + 'px';
                el.style.top = (oy + data.screenY - sy) + 'px';
            };
            var onUp = function() {
                if (!dragging) return;
                dragging = false;
                el.style.cursor = 'grab';
            };
            // 用 document 事件确保拖出元素也能继续
            document.addEventListener('mousemove', function(e) { onMove({screenX:e.clientX, screenY:e.clientY}); });
            document.addEventListener('mouseup', onUp);

            // 关闭按钮
            var closeBtn = document.createElement('div');
            closeBtn.style.cssText = 'position:absolute;top:2px;right:2px;' +
                'background:rgba(0,0,0,0.6);color:#fff;font-size:10px;line-height:1;padding:2px 5px;' +
                'border-radius:3px;cursor:pointer;display:none;z-index:2;';
            closeBtn.textContent = '关';
            closeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                document.removeEventListener('mousemove', moveHandler);
                document.removeEventListener('mouseup', upHandler);
                if (el.parentNode) el.parentNode.removeChild(el);
            });
            el.appendChild(closeBtn);
            var moveHandler = function(e) { onMove({screenX:e.clientX, screenY:e.clientY}); };
            var upHandler = onUp;
            // 修正：用具名引用方便清理
            el.addEventListener('mouseenter', function() { closeBtn.style.display = 'block'; });
            el.addEventListener('mouseleave', function() { closeBtn.style.display = 'none'; });

            layer.appendChild(el);
        };
    },

    // ===== 处理拖拽项 =====

    _processDragItems: function(items) {
        var isFileProtocol = window.location.protocol === 'file:';
        var self = this;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.kind === 'file') {
                var entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
                if (entry && entry.isDirectory) {
                    if (isFileProtocol) {
                        // file:// 协议下使用文件输入作为后备方案
                        self._createFileInputForFolder(entry.name);
                    } else {
                        // http:// 协议下使用 webkitGetAsEntry
                        self._createFolderPanel(entry);
                    }
                }
            }
        }
    },

    _processSingleFileDrag: function(files) {
        var self = this;
        for (var i = 0; i < files.length; i++) {
            var file = files[i];
            if (file.type.match(/image\//)) {
                self._handleImageFile(file);
            }
        }
    },

    // ===== 文件夹选择器 =====

    _openFolderPicker: function() {
        var self = this;
        var fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.webkitdirectory = true;
        fileInput.multiple = true;
        fileInput.style.display = 'none';

        fileInput.addEventListener('change', function(event) {
            var files = event.target.files;
            if (files.length > 0) {
                // 获取文件夹名
                var folderName = files[0].webkitRelativePath.split('/')[0];
                self._handleFolderFiles(folderName, files);
            }
            document.body.removeChild(fileInput);
        });

        document.body.appendChild(fileInput);
        try {
            fileInput.click();
        } catch (error) {
            console.log('\u81EA\u52A8\u89E6\u53D1\u6587\u4EF6\u9009\u62E9\u5931\u8D25');
        }
    },

    // ===== file:// 协议后备方案 =====

    _createFileInputForFolder: function(folderName) {
        var self = this;
        var fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.webkitdirectory = true;
        fileInput.multiple = true;
        fileInput.style.display = 'none';

        fileInput.addEventListener('change', function(event) {
            var files = event.target.files;
            if (files.length > 0) {
                self._handleFolderFiles(folderName, files);
            }
            document.body.removeChild(fileInput);
        });

        document.body.appendChild(fileInput);
        try {
            fileInput.click();
        } catch (error) {
            console.log('\u81EA\u52A8\u89E6\u53D1\u6587\u4EF6\u9009\u62E9\u5931\u8D25\uFF0C\u9700\u8981\u7528\u6237\u624B\u52A8\u9009\u62E9');
        }
    },

    // ===== 处理文件夹文件 =====

    _handleFolderFiles: function(folderName, files) {
        if (this._folders[folderName]) return;

        this._folders[folderName] = {
            name: folderName,
            images: [],
            panel: null
        };

        var panel = this._createPanel(folderName);
        this._folders[folderName].panel = panel;

        var self = this;
        var imageFiles = [];

        // 筛选图片文件
        for (var i = 0; i < files.length; i++) {
            if (files[i].name.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i)) {
                imageFiles.push(files[i]);
            }
        }

        // 逐个读取图片
        imageFiles.forEach(function(file) {
            var imageId = Date.now() + Math.random();
            var reader = new FileReader();
            reader.onload = function(event) {
                var dataURL = event.target.result;
                self._folders[folderName].images.push({
                    id: imageId,
                    name: file.name,
                    file: file,
                    src: dataURL
                });
                self._addImageToPanel(folderName, imageId, file.name, dataURL);
            };
            reader.readAsDataURL(file);
        });
    },

    // ===== 处理拖拽的图片文件 =====

    _handleImageFile: function(file) {
        var self = this;
        var folderName = '\u62D6\u62FD\u56FE\u7247';

        if (!this._folders[folderName]) {
            this._folders[folderName] = {
                name: folderName,
                images: [],
                panel: null
            };

            var panel = this._createPanel(folderName);
            this._folders[folderName].panel = panel;
        }

        var imageId = Date.now() + Math.random();
        var reader = new FileReader();
        reader.onload = function(event) {
            var dataURL = event.target.result;
            self._folders[folderName].images.push({
                id: imageId,
                name: file.name,
                file: file,
                src: dataURL
            });
            self._addImageToPanel(folderName, imageId, file.name, dataURL);
        };
        reader.readAsDataURL(file);
    },

    // ===== 创建文件夹面板 =====

    _createFolderPanel: function(directory) {
        var folderName = directory.name;
        if (this._folders[folderName]) return;

        this._folders[folderName] = {
            name: folderName,
            images: [],
            panel: null
        };

        var panel = this._createPanel(folderName);
        this._folders[folderName].panel = panel;

        this._loadFolderContent(directory, folderName);
    },

    _createPanel: function(folderName) {
        var self = this;
        this._panelCounter++;

        var panel = document.createElement('div');
        panel.className = 'fb-folder-panel';
        panel.style.cssText =
            'position:fixed;left:10px;top:' + (this._panelCounter * 20 + 60) + 'px;' +
            'width:280px;height:340px;' +
            'background:rgba(15,25,50,0.96);border:1px solid rgba(100,160,255,0.12);' +
            'border-radius:14px;z-index:1002;pointer-events:auto;' +
            'display:flex;flex-direction:column;box-shadow:0 8px 32px rgba(0,0,0,0.5);';

        // 头部
        var header = document.createElement('div');
        header.className = 'fb-panel-header';
        header.style.cssText =
            'display:flex;justify-content:space-between;align-items:center;' +
            'padding:12px 14px 8px 14px;cursor:move;user-select:none;flex-shrink:0;';

        var titleSpan = document.createElement('span');
        titleSpan.style.cssText = 'color:var(--cos-accent);font-size:14px;font-weight:700;';
        titleSpan.textContent = '\u{1F4C1} ' + folderName;

        var countSpan = document.createElement('span');
        countSpan.className = 'fb-image-count';
        countSpan.style.cssText = 'color:var(--cos-text-dim);font-size:11px;margin-left:8px;';
        countSpan.textContent = '0 \u5F20';

        var closeBtn = document.createElement('span');
        closeBtn.className = 'fb-close-btn';
        closeBtn.style.cssText = 'color:#aaa;font-size:11px;cursor:pointer;line-height:1;padding:2px 6px;border-radius:4px;border:1px solid rgba(170,170,170,0.3);transition:all 0.2s;';
        closeBtn.textContent = '关';
        closeBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            self._closeFolderPanel(folderName);
        });
        closeBtn.addEventListener('mouseenter', function() {
            closeBtn.style.color = '#ff6b6b';
            closeBtn.style.background = 'rgba(255,107,107,0.15)';
        });
        closeBtn.addEventListener('mouseleave', function() {
            closeBtn.style.color = '#aaa';
            closeBtn.style.background = 'transparent';
        });

        var titleWrap = document.createElement('div');
        titleWrap.style.cssText = 'display:flex;align-items:center;';
        titleWrap.appendChild(titleSpan);
        titleWrap.appendChild(countSpan);

        header.appendChild(titleWrap);
        header.appendChild(closeBtn);

        // 图片网格
        var grid = document.createElement('div');
        grid.className = 'fb-image-grid';
        grid.dataset.folder = folderName;
        grid.style.cssText =
            'display:grid;grid-template-columns:repeat(3,1fr);gap:4px;' +
            'padding:10px;flex:1;overflow-y:auto;align-content:start;';

        // 滚动懒加载
        grid.addEventListener('scroll', function() {
            self._handlePanelScroll(folderName, panel);
        });

        panel.appendChild(header);
        panel.appendChild(grid);
        document.body.appendChild(panel);

        // 让面板可拖拽
        this._makePanelDraggable(panel);

        // 四角+四边缩放
        this._makePanelResizable(panel);

        return panel;
    },

    // ===== 加载文件夹内容（webkit directory reader）=====

    _loadFolderContent: function(directory, folderName) {
        var self = this;
        var reader = directory.createReader();

        var readEntries = function() {
            reader.readEntries(function(entries) {
                if (entries.length) {
                    entries.forEach(function(entry) {
                        if (entry.isFile && entry.name.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i)) {
                            entry.file(function(file) {
                                var imageId = Date.now() + Math.random();
                                self._folders[folderName].images.push({
                                    id: imageId,
                                    name: file.name,
                                    file: file,
                                    src: null  // 懒加载
                                });
                                self._addImageToPanel(folderName, imageId, file.name, null);
                            });
                        }
                    });
                    setTimeout(readEntries, 0);
                }
            });
        };

        readEntries();
    },

    // ===== 添加缩略图到面板 =====

    _addImageToPanel: function(folderName, imageId, name, dataURL) {
        var folder = this._folders[folderName];
        if (!folder || !folder.panel) return;

        var grid = folder.panel.querySelector('.fb-image-grid');
        var self = this;

        var item = document.createElement('div');
        item.className = 'fb-image-item';
        item.dataset.folder = folderName;
        item.dataset.imageId = imageId;
        item.style.cssText =
            'width:100%;aspect-ratio:1;background:rgba(255,255,255,0.04);' +
            'border:1px solid rgba(255,255,255,0.06);border-radius:6px;' +
            'overflow:hidden;cursor:pointer;position:relative;' +
            'transition:all 0.2s;display:flex;align-items:center;justify-content:center;';

        // 悬停效果
        item.addEventListener('mouseenter', function() {
            item.style.borderColor = 'var(--cos-accent)';
            item.style.transform = 'scale(1.05)';
            item.style.zIndex = '10';
        });
        item.addEventListener('mouseleave', function() {
            item.style.borderColor = 'rgba(255,255,255,0.06)';
            item.style.transform = 'scale(1)';
            item.style.zIndex = '1';
        });

        // 占位符
        var placeholder = document.createElement('div');
        placeholder.className = 'fb-placeholder';
        placeholder.style.cssText =
            'color:rgba(255,255,255,0.25);font-size:10px;text-align:center;' +
            'padding:6px;word-break:break-all;line-height:1.3;overflow:hidden;';
        placeholder.textContent = name;

        // 图片元素
        var img = document.createElement('img');
        img.alt = name;
        img.style.cssText =
            'width:100%;height:100%;object-fit:cover;display:none;' +
            'transition:opacity 0.3s;';

        item.appendChild(placeholder);
        item.appendChild(img);
        grid.appendChild(item);

        // 如果已有 dataURL，直接显示
        if (dataURL) {
            img.src = dataURL;
            img.style.display = 'block';
            placeholder.style.display = 'none';
        }

        // 点击查看大图
        item.addEventListener('click', function() {
            self._loadAndPreview(folderName, imageId);
        });

        // 拖拽到画布
        item.draggable = true;
        item.addEventListener('dragstart', function(e) {
            var folder = self._folders[folderName];
            var image = folder && folder.images.find(function(img) { return img.id === imageId; });
            if (image && image.src) {
                e.dataTransfer.setData('text/plain', image.src);
                e.dataTransfer.setData('application/x-image-name', name);
            } else {
                e.preventDefault();
            }
        });

        // 更新计数
        this._updateImageCount(folderName);
    },

    // ===== 更新图片计数 =====

    _updateImageCount: function(folderName) {
        var folder = this._folders[folderName];
        if (!folder || !folder.panel) return;

        var countEl = folder.panel.querySelector('.fb-image-count');
        if (countEl) {
            countEl.textContent = folder.images.length + ' \u5F20';
        }
    },

    // ===== 懒加载 =====

    _loadImageIfNeeded: function(folderName, imageId, imgElement) {
        var folder = this._folders[folderName];
        if (!folder) return;

        var image = null;
        for (var i = 0; i < folder.images.length; i++) {
            if (folder.images[i].id == imageId) {
                image = folder.images[i];
                break;
            }
        }
        if (!image) return;

        // 已加载
        if (image.src) {
            if (imgElement) {
                imgElement.src = image.src;
                imgElement.style.display = 'block';
                var ph = imgElement.previousElementSibling;
                if (ph && ph.className === 'fb-placeholder') {
                    ph.style.display = 'none';
                }
            }
            return;
        }

        // 未加载，读取文件
        if (image.file) {
            var reader = new FileReader();
            reader.onload = function(event) {
                var dataURL = event.target.result;
                image.src = dataURL;
                if (imgElement) {
                    imgElement.src = dataURL;
                    imgElement.style.display = 'block';
                    var ph2 = imgElement.previousElementSibling;
                    if (ph2 && ph2.className === 'fb-placeholder') {
                        ph2.style.display = 'none';
                    }
                }
            };
            reader.readAsDataURL(image.file);
        }
    },

    _handlePanelScroll: function(folderName, panel) {
        var grid = panel.querySelector('.fb-image-grid');
        if (!grid) return;

        var items = grid.querySelectorAll('.fb-image-item');
        var panelRect = panel.getBoundingClientRect();
        var self = this;

        items.forEach(function(item) {
            var itemRect = item.getBoundingClientRect();

            // 检查是否在可视区域附近（预加载 100px）
            if (itemRect.top < panelRect.bottom + 100 && itemRect.bottom > panelRect.top - 100) {
                var imageId = item.dataset.imageId;
                var imgElement = item.querySelector('img');
                if (imageId && imgElement && imgElement.style.display === 'none') {
                    self._loadImageIfNeeded(folderName, imageId, imgElement);
                }
            }
        });
    },

    // ===== 大图预览 =====

    _loadAndPreview: function(folderName, imageId) {
        var self = this;
        var folder = this._folders[folderName];
        if (!folder) return;

        var image = null;
        for (var i = 0; i < folder.images.length; i++) {
            if (folder.images[i].id == imageId) {
                image = folder.images[i];
                break;
            }
        }
        if (!image) return;

        // 确保图片已加载
        var showPreview = function(src) {
            self._showPreview(src, image.name);
        };

        if (image.src) {
            showPreview(image.src);
        } else if (image.file) {
            var reader = new FileReader();
            reader.onload = function(event) {
                image.src = event.target.result;
                showPreview(image.src);
            };
            reader.readAsDataURL(image.file);
        }
    },

    _showPreview: function(src, name) {
        this._closePreview();
        var self = this;

        var ov = document.createElement('div');
        ov.className = 'fb-preview-overlay';
        ov.style.cssText =
            'position:fixed;top:0;left:0;width:100%;height:100%;' +
            'background:rgba(0,0,0,0.85);z-index:2000;display:flex;' +
            'align-items:center;justify-content:center;flex-direction:column;gap:16px;' +
            'cursor:pointer;animation:fbFadeIn 0.2s ease;';

        var img = document.createElement('img');
        img.src = src;
        img.style.cssText =
            'max-width:90vw;max-height:80vh;object-fit:contain;border-radius:8px;' +
            'box-shadow:0 4px 24px rgba(0,0,0,0.6);pointer-events:auto;';

        var nameBar = document.createElement('div');
        nameBar.style.cssText = 'color:var(--cos-text);font-size:13px;background:rgba(0,0,0,0.5);padding:6px 16px;border-radius:20px;';
        nameBar.textContent = name;

        var hint = document.createElement('div');
        hint.style.cssText = 'color:rgba(255,255,255,0.4);font-size:12px;';
        hint.textContent = '\u70B9\u51FB\u4EFB\u610F\u4F4D\u7F6E\u5173\u95ED';

        ov.appendChild(img);
        ov.appendChild(nameBar);
        ov.appendChild(hint);

        ov.addEventListener('click', function() {
            self._closePreview();
        });

        document.body.appendChild(ov);
        this._previewOverlay = ov;
    },

    _closePreview: function() {
        if (this._previewOverlay) {
            this._previewOverlay.remove();
            this._previewOverlay = null;
        }
    },

    // ===== 面板拖拽 =====

    _makePanelDraggable: function(panel) {
        var header = panel.querySelector('.fb-panel-header');
        var isDragging = false;
        var offsetX = 0, offsetY = 0;

        header.addEventListener('mousedown', function(e) {
            if (e.target.classList.contains('fb-close-btn')) return;
            isDragging = true;
            var rect = panel.getBoundingClientRect();
            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;
            panel.style.cursor = 'grabbing';
            panel.style.transition = 'none';
        });

        document.addEventListener('mousemove', function(e) {
            if (!isDragging) return;
            panel.style.left = (e.clientX - offsetX) + 'px';
            panel.style.top = (e.clientY - offsetY) + 'px';
        });

        document.addEventListener('mouseup', function() {
            if (isDragging) {
                isDragging = false;
                panel.style.cursor = 'move';
            }
        });
    },

    _makePanelResizable: function(panel) {
        var dirs = ['nw','ne','sw','se','n','s','w','e'];
        var cursors = { nw:'nwse-resize', ne:'nesw-resize', sw:'nesw-resize', se:'nwse-resize', n:'ns-resize', s:'ns-resize', w:'ew-resize', e:'ew-resize' };
        var styles = {
            nw: 'top:0;left:0;width:20px;height:20px;',
            ne: 'top:0;right:0;width:20px;height:20px;',
            sw: 'bottom:0;left:0;width:20px;height:20px;',
            se: 'bottom:0;right:0;width:20px;height:20px;',
            n:  'top:0;left:20px;right:20px;height:10px;',
            s:  'bottom:0;left:20px;right:20px;height:10px;',
            w:  'left:0;top:20px;bottom:20px;width:10px;',
            e:  'right:0;top:20px;bottom:20px;width:10px;'
        };
        var state = { active: false, dir: '', startX: 0, startY: 0, startL: 0, startT: 0, startW: 0, startH: 0 };

        dirs.forEach(function(dir) {
            var h = document.createElement('div');
            h.style.cssText = 'position:absolute;z-index:99999;cursor:' + cursors[dir] + ';' + styles[dir];
            h.addEventListener('mousedown', function(e) {
                e.preventDefault();
                e.stopPropagation();
                state.active = true;
                state.dir = dir;
                state.startX = e.clientX;
                state.startY = e.clientY;
                var r = panel.getBoundingClientRect();
                state.startL = r.left;
                state.startT = r.top;
                state.startW = r.width;
                state.startH = r.height;
            });
            panel.appendChild(h);
        });

        document.addEventListener('mousemove', function(e) {
            if (!state.active) return;
            var dx = e.clientX - state.startX;
            var dy = e.clientY - state.startY;
            var nL = state.startL, nT = state.startT, nW = state.startW, nH = state.startH;
            var d = state.dir;
            if (d.indexOf('e') >= 0) nW = Math.max(200, state.startW + dx);
            if (d.indexOf('w') >= 0) { nW = Math.max(200, state.startW - dx); nL = state.startL + state.startW - nW; }
            if (d.indexOf('s') >= 0) nH = Math.max(200, state.startH + dy);
            if (d.indexOf('n') >= 0) { nH = Math.max(200, state.startH - dy); nT = state.startT + state.startH - nH; }
            panel.style.left = nL + 'px';
            panel.style.top = nT + 'px';
            panel.style.width = nW + 'px';
            panel.style.height = nH + 'px';
        });

        document.addEventListener('mouseup', function() {
            if (state.active) {
                state.active = false;
                try {
                    var r = panel.getBoundingClientRect();
                    localStorage.setItem('fb-panel-rect', JSON.stringify({ w: Math.round(r.width), h: Math.round(r.height), l: Math.round(r.left), t: Math.round(r.top) }));
                } catch(e) {}
            }
        });
    },

    // ===== 关闭面板 =====

    _closeFolderPanel: function(folderName) {
        var folder = this._folders[folderName];
        if (folder && folder.panel) {
            folder.panel.remove();
        }
        delete this._folders[folderName];
    },

    _closeAllPanels: function() {
        var names = Object.keys(this._folders);
        var self = this;
        names.forEach(function(name) {
            self._closeFolderPanel(name);
        });
        this._panelCounter = 0;
    },

    _clearCanvasImages: function() {
        var layer = this._world && this._world.getLayer();
        if (!layer) return;
        if (!layer.querySelectorAll('.fb-canvas-image').length) return;
        if (!confirm('确定清空画布上的所有图片？此操作不可撤销。')) return;
        var imgs = layer.querySelectorAll('.fb-canvas-image');
        for (var i = 0; i < imgs.length; i++) {
            if (imgs[i].parentNode) imgs[i].parentNode.removeChild(imgs[i]);
        }
    }
};

/* 内联样式注入 */
(function() {
    var style = document.createElement('style');
    style.textContent =
        '@keyframes fbFadeIn { from { opacity:0; } to { opacity:1; } }' +
        '.fb-folder-panel::-webkit-scrollbar { width:4px; }' +
        '.fb-folder-panel::-webkit-scrollbar-track { background:transparent; }' +
        '.fb-folder-panel::-webkit-scrollbar-thumb { background:rgba(56,189,248,0.2);border-radius:2px; }' +
        '.fb-folder-panel::-webkit-scrollbar-thumb:hover { background:rgba(56,189,248,0.4); }' +
        '.fb-image-grid::-webkit-scrollbar { width:4px; }' +
        '.fb-image-grid::-webkit-scrollbar-track { background:transparent; }' +
        '.fb-image-grid::-webkit-scrollbar-thumb { background:rgba(56,189,248,0.15);border-radius:2px; }';
    document.head.appendChild(style);
})();
