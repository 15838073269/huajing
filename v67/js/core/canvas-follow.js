/**
 * canvas-follow.js —— 画布选中实时联动共享轮询器
 *
 * 背景：CanvasImages 不派发“选中变化”事件，且插件窗口常驻时需要跟随画布选中切换输入源。
 * 这里提供一个轻量轮询器，供各插件复用，避免每个插件各写一套 setInterval。
 *
 * 用法：
 *   var stop = CanvasFollow.bind(onChange, {
 *     isAlive: function(){ return !!(self._overlay && self._overlay.parentNode); }, // 窗口销毁后自然失效
 *     paused: function(){ return !!self._cfLock; },                                  // 锁定（如手动上传）时暂停
 *     interval: 200
 *   });
 *   // stop() 用于销毁时停止
 *
 * onChange(sig) 仅在画布选中签名变化且非空时触发；首次绑定以当前签名为准，不会立即触发。
 */
(function () {
    'use strict';

    function currentSig() {
        if (typeof CanvasImages === 'undefined') return '';
        var list = CanvasImages.getSelectedList ? CanvasImages.getSelectedList('display') : null;
        if (list && list.length) return 'L:' + list.map(function (x) { return x.id; }).join(',');
        var id = CanvasImages.getSelectedId ? CanvasImages.getSelectedId() : null;
        return id ? 'S:' + id : '';
    }

    window.CanvasFollow = {
        sig: currentSig,
        bind: function (onChange, opts) {
            opts = opts || {};
            var last = (typeof opts.initialSig === 'string') ? opts.initialSig : currentSig();
            var timer = setInterval(function () {
                try {
                    if (opts.isAlive && opts.isAlive() === false) return;
                    if (opts.paused && opts.paused()) return;
                    var s = currentSig();
                    if (s === last) return;
                    last = s;
                    if (s && typeof onChange === 'function') onChange(s);
                } catch (e) {
                    // 单 tick 异常不应杀死整条轮询
                }
            }, opts.interval || 200);
            return function stop() { clearInterval(timer); };
        }
    };
})();
