var FunctionRegistry = (function() {
  var _fns = {};

  function register(name, def) {
    if (!name || !def || !def.handler) return;
    _fns[name] = {
      name: name,
      description: def.description || '',
      params: def.params || [],
      returns: def.returns || '',
      handler: def.handler
    };
  }

  function get(name) {
    return _fns[name] || null;
  }

  function call(name, params) {
    var fn = _fns[name];
    if (!fn) throw new Error('Function not found: ' + name);
    return fn.handler(params || {});
  }

  function list(filter) {
    var result = [];
    for (var k in _fns) {
      if (!_fns.hasOwnProperty(k)) continue;
      if (filter && k.indexOf(filter) < 0) continue;
      var fn = _fns[k];
      result.push({
        name: fn.name,
        description: fn.description,
        params: fn.params,
        returns: fn.returns
      });
    }
    return result;
  }

  return {
    register: register,
    get: get,
    call: call,
    list: list
  };
})();
