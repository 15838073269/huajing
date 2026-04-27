/**
 * PluginLoader - 自动发现并加载插件
 * 自动扫描所有已注册的全局插件对象，无需手动注册
 *
 * 约定：
 * 1. 插件文件放在 js/skills/ 目录下
 * 2. 插件对象必须挂载到 window 上（全局变量）
 * 3. 插件对象必须有 id、name、icon、activate 属性
 * 4. 在 index.html 中用 <script> 标签引入即可，无需改 main.js
 */
var PluginLoader = (function() {

    // 已知的系统对象（不是插件）
    var systemGlobals = [
        'GameWorld', 'SkillSystem', 'GameStorage', 'PluginLoader',
        'window', 'document', 'navigator', 'location', 'history',
        'localStorage', 'sessionStorage', 'fetch', 'XMLHttpRequest',
        'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
        'requestAnimationFrame', 'cancelAnimationFrame',
        'console', 'alert', 'confirm', 'prompt',
        'JSON', 'Math', 'Date', 'Array', 'Object', 'String', 'Number',
        'Boolean', 'RegExp', 'Error', 'Promise', 'Map', 'Set',
        'parseInt', 'parseFloat', 'isNaN', 'isFinite',
        'encodeURI', 'decodeURI', 'encodeURIComponent', 'decodeURIComponent',
        'showOverlay', 'showToast'
    ];

    /**
     * 自动扫描全局变量，发现插件对象
     * 插件对象必须满足：有 id、name、icon、activate 属性
     */
    function scan() {
        var found = [];
        for (var key in window) {
            if (systemGlobals.indexOf(key) !== -1) continue;
            if (typeof window[key] !== 'object' || window[key] === null) continue;
            var obj = window[key];
            // 检查是否像插件对象
            if (obj.id && obj.name && obj.icon && typeof obj.activate === 'function') {
                found.push(obj);
            }
        }
        return found;
    }

    /**
     * 自动注册所有发现的插件到商店
     */
    function autoRegister() {
        var found = scan();
        found.forEach(function(plugin) {
            SkillSystem.registerPlugin(plugin);
            console.log('[PluginLoader] 发现插件: ' + plugin.name + ' (' + plugin.id + ')');
        });
        return found;
    }

    /**
     * 注册一个全局变量名为"非插件"
     */
    function markAsSystem(name) {
        if (systemGlobals.indexOf(name) === -1) {
            systemGlobals.push(name);
        }
    }

    return {
        scan: scan,
        autoRegister: autoRegister,
        markAsSystem: markAsSystem
    };
})();
