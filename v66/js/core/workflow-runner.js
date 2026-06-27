var WorkflowRunner = (function() {
  function execute(workflow) {
    if (!workflow || !workflow.steps) return Promise.resolve(null);
    var ctx = { steps: {} };
    return runSteps(workflow.steps, ctx).then(function(results) {
      return { results: results, context: ctx };
    });
  }

  function runSteps(steps, ctx) {
    var results = [];
    return steps.reduce(function(promise, step, idx) {
      return promise.then(function() {
        return runStep(step, ctx).then(function(r) {
          results.push(r);
          if (step.id) ctx.steps[step.id] = r;
          return r;
        });
      });
    }, Promise.resolve(null)).then(function() { return results; });
  }

  function runStep(step, ctx) {
    if (!step || !step.type) return Promise.resolve(null);

    switch (step.type) {
      case 'call':
        return callFn(step, ctx);

      case 'branch':
        return runBranch(step, ctx);

      case 'loop':
        return runLoop(step, ctx);

      default:
        return Promise.resolve(null);
    }
  }

  function callFn(step, ctx) {
    try {
      var result = FunctionRegistry.call(step.fn, step.params || {});
      if (result && typeof result.then === 'function') {
        return result;
      }
      return Promise.resolve(result);
    } catch (e) {
      return Promise.reject(e);
    }
  }

  function evalCondition(expr, ctx) {
    try {
      return !!(new Function('ctx', 'return (' + expr + ')')(ctx));
    } catch (e) {
      try {
        return !!new Function('ctx', 'return ' + expr)(ctx);
      } catch (e2) {
        return false;
      }
    }
  }

  function runBranch(step, ctx) {
    var branch = evalCondition(step.condition || 'true', ctx);
    var targetSteps = branch ? step.then : step.else;
    if (!targetSteps || !targetSteps.length) return Promise.resolve(null);
    return runSteps(targetSteps, ctx);
  }

  function runLoop(step, ctx) {
    var times = step.times || 1;
    var allResults = [];
    var chain = Promise.resolve(null);
    for (var i = 0; i < times; i++) {
      chain = chain.then(function(idx) {
        return function() {
          return runSteps(step.steps || [], ctx).then(function(r) {
            allResults[idx] = r;
          });
        };
      }(i));
    }
    return chain.then(function() { return allResults; });
  }

  return {
    execute: execute
  };
})();
