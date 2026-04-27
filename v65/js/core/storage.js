/**
 * Storage - 存储系统（IndexedDB，自动从localStorage迁移）
 */
var GameStorage = (function() {
    var DB_NAME = 'CosGameDB';
    var DB_VER = 1;
    var STORE = 'gameData';
    var KEY = 'cos_v65';
    var _db = null;
    var _migrated = false;

    function openDB() {
        if (_db) return Promise.resolve(_db);
        return new Promise(function(res, rej) {
            var r = indexedDB.open(DB_NAME, DB_VER);
            r.onupgradeneeded = function(e) {
                var db = e.target.result;
                if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
            };
            r.onsuccess = function(e) {
                _db = e.target.result;
                res(_db);
            };
            r.onerror = function(e) { rej(e); };
        });
    }

    // 从localStorage迁移旧数据到IndexedDB
    function migrate() {
        if (_migrated) return Promise.resolve();
        _migrated = true;
        try {
            var old = localStorage.getItem(KEY);
            if (old) {
                var data = JSON.parse(old);
                localStorage.removeItem(KEY);
                return openDB().then(function(db) {
                    var tx = db.transaction(STORE, 'readwrite');
                    tx.objectStore(STORE).put(data, KEY);
                });
            }
        } catch(e) {}
        return Promise.resolve();
    }

    return {
        save: function(s) {
            try {
                openDB().then(function(db) {
                    var tx = db.transaction(STORE, 'readwrite');
                    tx.objectStore(STORE).put(s, KEY);
                }).catch(function() {});
            } catch(e) {}
        },
        load: function() {
            return migrate().then(function() {
                return openDB().then(function(db) {
                    return new Promise(function(res) {
                        var tx = db.transaction(STORE, 'readonly');
                        var req = tx.objectStore(STORE).get(KEY);
                        req.onsuccess = function() { res(req.result || null); };
                        req.onerror = function() { res(null); };
                    });
                });
            }).catch(function() { return null; });
        },
        clear: function() {
            try {
                openDB().then(function(db) {
                    var tx = db.transaction(STORE, 'readwrite');
                    tx.objectStore(STORE).delete(KEY);
                }).catch(function() {});
            } catch(e) {}
        }
    };
})();
