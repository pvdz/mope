import {pass, only, skip, group} from '../utils.mjs';

export const spread_rest = () => group('spread_rest', () => {

  pass('spread base', () => {
    let x = [1, 2, 3];
    let y = [...x];
  });

  pass('spread should match', () => {
    let x = [1, 2, 3];
    [...x] === [4, 5, 6]; // we dont care about references, only that the type matches
  });

  pass('spread should match (counter test)', () => {
    let x = [1, 2, 3];
    [...x] === ['a', 'b', 'c']
  }, ['POLY_PRIMITIVES']);

  group('spread onto a rest', () => {
    pass('spread with one element in a call', () => {
      function f(...rest) {}
      f(...[1]);
    });

    pass('spread with multiple elements in a call', () => {
      function f(...rest) {}
      f(...[1,2,3]);
    });

    pass('spread should match rest type', () => {
      function f(...rest) {
        rest === [1]
      }
      f(...[1,2,3]);
    });

    pass('spread should math rest type (counter test)', () => {
      function f(...rest) {
        rest === ['a']
      }
      f(...[1,2,3]);
    }, ['POLY_PRIMITIVES']);

    pass('spread on regular params that match the type', () => {
      function f(x, ...rest) {
        x === 1;
        rest === [1]
      }
      f(...[1,2,3]);
    }, ['SPREAD_BEFORE_REST']);

    pass('spread on regular params is not allowed because the array might be empty', () => {
      function f(x, ...rest) {}
      f(...[1,2,3]);
    }, ['SPREAD_BEFORE_REST']);
  });

  group('spread on regular params', () => {
    pass('spread without rest is not allowed', () => {
      function f(x, y, z) {}
      f(...[1,2,3]);
    }, ['CALL_ARG_ARITY', 'SPREAD_BEFORE_REST']);

    pass('food for thought; if length is explicitly checked it could be ok? array with explicitly same arity', () => {
      function f(x, y, z) {}
      const x = [1,2,3];
      // could pass on the temporary guarantee that the array (we'll know the type when we actually process it)
      // will have 3 arguments to match the call args. sort of like a pseudo-dsl refinement.
      x.length === 3 && f(...x);
    }, ['CALL_ARG_ARITY', 'SPREAD_BEFORE_REST', 'LOGICAL_OPERANDS_PRIM_LEFT']);

    pass('food for thought; if length is explicitly to at least the fixed args? array with at least the arity', () => {
      function f(x, ...r) {}
      const x = [1,2,3];
      // similar refinement but with rest it may also be larger
      x.length >= 1 && f(...x);
    }, ['SPREAD_BEFORE_REST', 'LOGICAL_OPERANDS_PRIM_LEFT']);

    pass('food for thought; if length is explicitly to at least the fixed args? array which would leave rest empty', () => {
      function f(x, ...r) {}
      const x = [1,2,3];
      // it is acceptable if the rest arg is an empty array
      x.length === 1 && f(...x);
    }, ['SPREAD_BEFORE_REST', 'LOGICAL_OPERANDS_PRIM_LEFT']);
  });

  group('spread into array', () => {
    pass('spread array into another array', () => {
      let x = [1, 2];
      [1, ...x];
    });

    pass('spread array into another array (counter test)', () => {
      let x = [1, 2];
      ['a', ...x];
    }, ['ARR_MONO_KIND']);

    pass('spread array as first element into another array', () => {
      let x = [1, 2];
      [...x, 1];
    });

    pass('spread array as first element into another array (counter test)', () => {
      let x = [1, 2];
      [...x, 'a'];
    }, ['ARR_MONO_KIND']);

    pass('spread array into empty array', () => {
      let x = [1, 2];
      [...x];
    });

    pass('spread empty array into empty array', () => {
      [...[]];
    }, ['ARRAY_KIND_READ_BUT_UNDET']);

    pass('spread empty array into another array', () => {
      [1, ...[]];
    }, ['ARRAY_KIND_READ_BUT_UNDET', 'ARR_MONO_KIND']);

    pass('spread empty array as first element of another array', () => {
      [...[], 1];
    }, ['ARRAY_KIND_READ_BUT_UNDET', 'ARR_MONO_KIND']);
  });

  group('popping from rest', () => {
    pass('can access rest array even without args', () => {
      function f(...a) {
        return a.pop();
      }
      f();
    }, ['ARRAY_POP_UNDERFLOW', 'ARRAY_POP_EMPTY']);
    pass('arrays inherit type from args', () => {
      function f(...a) {
        a.pop() === 1;
      }
      f(1);
      f(2);
    }, ['ARRAY_POP_UNDERFLOW']);
    pass('arrays inherit type from args (counter test)', () => {
      function f(...a) {
        a.pop() === 1;
      }
      f(1);
      f('a');
    }, ['ARRAY_POP_UNDERFLOW', 'ARRAY_POP_UNDERFLOW', 'POLY_PRIMITIVES']);
  });

  pass('spread only allowed as last part to a call', () => {
    // poly because Array(1, 'x') is [1, 'x'] is poly

    let a = [1,2,3,4]
    let b = ['a','b','c','d']
    // Now crash because we don't support spreads that are not the last element
    // The reason is simple; we do not know the size of an array so we cannot properly map the elements
    // The way this is handled is by emitting a lint warning and passing on the kind of the array as one arg element
    new Array('x', ...b, ...a, 'y');
    // [ 'x', 'a', 'b', 'c', 'd', 1, 2, 3, 4, 'y' ]
  }, ['SPREAD_NOT_TAIL', 'SPREAD_NOT_TAIL', 'POLY_PRIMITIVES']);

  pass('call spread without filling spread', () => {
    // We can have the rule that a spreaded function must be called with at least the number of params up to the spread
    // On the other hand we do plan to allow for args to be optional if they have a default (which array arguably is)
    // One question could be to ask what the type is of an array without params... undefineds?
    // And is a spreaded array read-only?
    function f(a, ...b) {}
    f(1);
  });

  pass('call spread with one arg in spread', () => {
    function f(a, ...b) {}
    f(1, 2);
  });
  pass('call spread with multiple args in spread', () => {
    function f(a, ...b) {}
    f(1, 2, 3, 4);
  });
  pass('spread args must be same type', () => {
    function f(a, ...b) {}
    f(1, 2, 'a', 4);
  }, ['POLY_PRIMITIVES']);
  pass('function with only spread', () => {
    function f(...a) {}
    f();
    f(1);
    f(1, 2);
  });

  group('is array', () => {
    pass('spread arg is array', () => {
      function f(...a) {
        a.length === 2;
      }
      f(1, 2);
    });
    pass('spread arg is array even when empty', () => {
      function f(...a) {
        a.length === 0;
      }
      f();
    });
    pass('spread arg is array even when elements are passed on', () => {
      function f(...a) {
        a.length === 2;
      }
      f('a', 'b');
    });
    pass('spread arg is instanceof array even when empty', () => {
      function f(...a) {
        a instanceof Array;
      }
      f();
    }, ['INSTANCEOF_OBSOLETE']);
    pass('spread arg is instanceof array even when elements are passed on', () => {
      function f(...a) {
        a instanceof Array;
      }
      f('a', 'b');
    }, ['INSTANCEOF_OBSOLETE']);
  });

  group('juggle spread/rest', () => {
    pass('juggle the spread rest across a function', () => {
      function g(...a) {
        Array(...a);
      }
      function f(...a) {
        g(...a);
      }
      f(3);
      // f('a');
      // f(3, 4);
      // f('a', 'b');
    });

    pass('next level with spread/rest', () => {
      function f(...a) {
        function g(...a) {
          Array(...a);
        }
        g(...a);
      }
      f(3);
      f('a');
      f(3, 4);
      f('a', 'b');
    });
  });
});
