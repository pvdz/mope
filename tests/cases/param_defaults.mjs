import {pass, only, skip, group} from '../utils.mjs';

export const param_defaults = () => group('param defaults', () => {
  group('call', () => {
    pass('a function with param default', () => {
      function f(a = 1) {}
    });

    pass('call a function with param default with an arg of same type', () => {
      function f(a = 1) {}
      f(2);
    });

    pass('call a function with param default with an arg of different type', () => {
      function f(a = 1) {}
      f('x');
    }, ['UNUSED_DEFAULT_ARG_POLY']);

    pass('call a function with param default without args', () => {
      function f(a = 1) {}
      f();
    });

    pass('call a function with param default with same type and without arg', () => {
      function f(a = 1) {}
      f(2);
      f();
    });

    pass('call a function with param default with an arg of different type and without arg', () => {
      function f(a = 1) {}
      f('x');
      f();
    }, ['UNUSED_DEFAULT_ARG_POLY']);
  });

  group('position of the default', () => {
    pass('last arg with default, all args, same', () => {
      function f(a, b, c = 1) {}
      f(1, 2, 3);
    });

    pass('last arg with default, all args, diff', () => {
      function f(a, b, c = 1) {}
      f(1, 2, 'x');
    }, ['UNUSED_DEFAULT_ARG_POLY']);

    pass('last arg with default, all args, undefined', () => {
      function f(a, b, c = 1) {}
      f(1, 2, undefined);
    });

    pass('last arg with default, 2 args', () => {
      function f(a, b, c = 1) {}
      f(1, 2);
    });

    pass('last arg with default, 1 arg', () => {
      function f(a, b, c = 1) {}
      f(1);
    }, ['CALL_ARG_ARITY']);

    pass('last arg with default, no args', () => {
      function f(a, b, c = 1) {}
      f();
    }, ['CALL_ARG_ARITY']);

    pass('multiple trailing args with default with minimal args', () => {
      function f(a, b, c = 1, d = 'x', e = true) {}
      f(1, 2);
    });

    pass('middle arg with default, all args, same', () => {
      function f(a, b = 1, c) {}
      f(1, 2, 3);
    });

    pass('middle arg with default, all args, diff', () => {
      function f(a, b = 1, c) {}
      f(1, 'x', 2);
    }, ['UNUSED_DEFAULT_ARG_POLY']);

    pass('middle arg with default, all args, undefined', () => {
      function f(a, b = 1, c) {}
      f(1, undefined, 2);
    });

    pass('middle arg with default, 2 args', () => {
      function f(a, b = 1, c) {}
      f(1, 2);
    }, ['CALL_ARG_ARITY']);

    pass('middle arg with default, 1 arg', () => {
      function f(a, b = 1, c) {}
      f(1);
    }, ['CALL_ARG_ARITY']);

    pass('middle arg with default, no args', () => {
      function f(a = 1, b, c) {}
      f();
    }, ['CALL_ARG_ARITY']);

    pass('first arg with default, all args, same', () => {
      function f(a = 1, b, c) {}
      f(1, 2, 3);
    });

    pass('first arg with default, all args, diff', () => {
      function f(a = 1, b, c) {}
      f('x', 1, 2);
    }, ['UNUSED_DEFAULT_ARG_POLY']);

    pass('first arg with default, all args, undefined', () => {
      function f(a = 1, b, c) {}
      f(undefined, 1, 2);
    });

    pass('first arg with default, 2 args', () => {
      function f(a = 1, b, c) {}
      f(1, 2);
    }, ['CALL_ARG_ARITY']);

    pass('first arg with default, 1 arg', () => {
      function f(a = 1, b, c) {}
      f(1);
    }, ['CALL_ARG_ARITY']);

    pass('first arg with default, no args', () => {
      function f(a = 1, b, c) {}
      f();
    }, ['CALL_ARG_ARITY']);
  });

  group('merging param with default inside the func', () => {
    pass('param default merged with same type inside func, called with same type', () => {
      function f(a = 1) {
        a === 1
      }
      f(1);
    });

    pass('param default merged with same type inside func, called without args', () => {
      function f(a = 1) {
        a === 1
      }
      f();
    });

    pass('param default merged with different type inside func, called with same type', () => {
      // A little tricky to lint against because you'd have to merge the default with the arg even though it may
      // never actually be called that way. And in that case it's benign (but we wouldn't detect it and that makes it
      // trickier). Otoh, we could have a post check step that asserts whether or not all shadows of the param
      // can actually be merged with the default. TODO <--^^
      function f(a = 1) {
        a === 'x'
      }
      f(1); // This should trigger a poly
    }, ['POLY_PRIMITIVES']);

    pass('param default merged with same type inside func, called with different type', () => {
      function f(a = 1) {
        a === 1
      }
      f('x');
    }, ['UNUSED_DEFAULT_ARG_POLY', 'POLY_PRIMITIVES']);

    pass('param default merged with different type inside func, called with different type', () => {
      function f(a = 1) {
        a === 'y'
      }
      f('x'); // This should be fine TODO: it would be nice to trigger a lint warning...
    }, ['UNUSED_DEFAULT_ARG_POLY']);

    pass('param default merged with different type inside func, called without arg', () => {
      function f(a = 1) {
        a === 'y'
      }
      f(); // The default should trigger a poly error now
    }, ['POLY_PRIMITIVES']);
  });

  pass('param and default evaluation order, no args', () => {
    function f(a = 1, b = a, c = b) {
      return c;
    }
    f() === 1; // no poly, no arity warning, should return 1
  });

  pass('param and default evaluation order, given arg', () => {
    function f(a, b = a, c = b) {
      return c;
    }
    f(1) === 1; // no poly, no arity warning, should return 1
  });
});
