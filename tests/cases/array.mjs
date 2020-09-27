import {pass, only, skip, group} from '../utils.mjs';

export const array = () => group('array', () => {

  pass('base array case with numbers', () => {
    let x = [1, 2, 3];
  });

  pass('arrays must be monomorphic too', () => {
    let y = ["a", "b", "c"];
  });

  pass('merge two same kinds of arrays', () => {
    let x = [1, 2, 3];
    let y = [4, 5, 6];
    x === y
  });

  pass('merge two different kinds of arrays', () => {
    let x = [1, 2, 3];
    let y = ["a", "b", "c"];
    x === y
  }, ['POLY_PRIMITIVES'])

  pass('empty array case', () => {
    // This would create an array with a TBD as `kind`
    let x = [];
  });

  pass('arrays must fail when not monomorphic', () => {
    // (we'll worry later about accessing them in a sound way)
    let x = [1, "a"];
  }, ['ARR_MONO_KIND'])

  group('array#push', () => {
    pass('should push same type to an array', () => {
      // underwater test for generics; Array#push must accept the same type of the array.kids tid
      let a = [1, 2, 3];
      a.push(4);
    });

    pass('should push same type to an array (counter test)', () => {
      // underwater test for generics; Array#push must accept the same type of the array.kids tid
      let a = ['failure'];
      a.push(1);
    }, ['ARR_MONO_KIND'])

    pass('push a number onto empty array', () => {
      let a = [];
      a.push(1);
    });

    pass('push two numbers onto empty array', () => {
      let a = [];
      a.push(1);
      a.push(2);
    });

    pass('push a number and string onto empty array', () => {
      let a = [];
      a.push(1);
      a.push('x');
    }, ['ARR_MONO_KIND']);

    pass('Array#push should return number, fail', () => {
      [].push(1) === undefined
    }, ['POLY_PRIMITIVES']);

    pass('Array#push should return number, pass', () => {
      [].push(1) === 1
    });

    pass('Array#push without args is a lint error', () => {
      [].push()
    }, ['ARRAY_PUSH_NO_ARGS']);

    pass('Array#push should be called on arrays but who knows', () => {
      Array.prototype.push.call({}, 1);
    },['ARRAY_PUSH_CONTEXT']);
  });

  group('array#pop', () => {
    pass('Array#pop ignores args', () => {
      [].pop({}, 1);
    }, ['ARRAY_POP_UNDERFLOW', 'BUILTIN_ARG1_TMI', 'ARRAY_POP_EMPTY']);
  });

  pass('a resolved number array can always be compared to an unresolved array', () => {
    [1] === [];
  });

  pass('a resolved string array can always be compared to an unresolved array', () => {
    ['x'] === [];
  });

  pass('two unresolved arrays can be compared', () => {
    [] === [];
  });

  group('Array constructor', () => {
    pass('called without args, compared to empty array', () => {
      // This should be considered equivalent
      Array() === [];
    });

    pass('called without args, pushed, compared to same kind of array', () => {
      // This should be considered equivalent
      const a = Array();
      a.push(1);
      a === [1]; // Both are arrays of kind number so this is ok
    });

    pass('called without args, pushed, compared to different kind of array, string number', () => {
      const a = Array();
      a.push(1);
      a === ['x']; // poly for mixed kind
    }, ['POLY_PRIMITIVES']);

    pass('called without args, pushed, compared to different kind of array, number string', () => {
      const a = Array();
      a.push('x');
      a === [1]; // poly for mixed kind
    }, ['POLY_PRIMITIVES']);

    pass('called with a string, compared to same kind of array', () => {
      // This should be considered equivalent
      const a = Array('x');
      a === ['x'];
    });

    pass('called with a number, compared to same kind of array', () => {
      // This should be considered equivalent
      const a = Array(1);
      a === [1];
    });

    pass('called with a number, compared to a string array', () => {
      // Pass because Array(1) is the same as `[]` in terms of typing
      const a = Array(1);
      a === ['x'];
    });

    pass('called with numbers, compared to a string array', () => {
      const a = Array(1, 2);
      a === ['x'];
    }, ['POLY_PRIMITIVES']);

    pass('called with numbers, compared to a number array', () => {
      const a = Array(1, 2);
      a === [1];
    });

    pass('called with a number, compared to a number', () => {
      // This should be considered equivalent
      const a = Array(1);
      a === 1; // no.
    }, ['POLY_PRIMITIVES']);

    pass('calling Array with one number arg should work', () => {
      Array(2);
    });

    pass('calling Array with one number arg can be compared to empty array', () => {
      Array(2) === [];
    });

    pass('calling Array with one number arg can be compared to number array', () => {
      Array(2) === [1];
    });

    pass('calling Array with one number arg can be compared to string array', () => {
      Array(2) === ['x'];
    });

    pass('calling Array with undefined should still make the kind undefined, pass', () => {
      Array(undefined) === [undefined, undefined];
    });

    pass('calling Array with undefined should still make the kind undefined, fail', () => {
      Array(undefined) === [1, 2];
    }, ['POLY_PRIMITIVES']);

    pass('calling Array with null should still make the kind null, pass', () => {
      Array(null) === [null, null];
    });

    pass('calling Array with null should still make the kind null, fail', () => {
      Array(null) === [1, 2];
    }, ['POLY_PRIMITIVES']);
  });

  group('lambda methods', () => {
    pass('Array#forEach ok', () => {
      [1, 2, 3].forEach((num, i) => num + i);
    });

    pass('Array#forEach bad', () => {
      [1, 2, 3].forEach((num) => num === 'x');
    }, ['POLY_PRIMITIVES']);

    pass('Array#map ok uncompared', () => {
      [1, 2, 3].map((num, i) => num + i)
    }, []);

    pass('Array#map ok checked', () => {
      const a = [1, 2, 3].map((num, i) => num + i)
      const b = [10, 11];
      a === b
    }, []);

    pass('Array#map bad arg', () => {
      [1, 2, 3].map((num, i) => num === 'a');
    }, ['POLY_PRIMITIVES']);

    pass('Array#map bad return', () => {
      [1, 2, 3].map((num, i) => num) === ['x'];
    }, ['POLY_PRIMITIVES']);

    pass('Array#map not properly draining args', () => {
      // This was causing stack underflow because it was trying to drain the first two args, which are explicitly popped
      function f() {
        const a = [];
        a.map('x');
      }
      switch (true) {
        case null: f()
      }
    }, ['POLY_PRIMITIVES', 'ARRAY_LAMBDA_ARR_KIND', 'ARRAY_LAMBDA_FUNC_ARG']);
  });

  group('Array#splice', () => {
    pass('Array#splice, checking args', () => {
      // Checking whether it properly cuts the args (and ignores the first two) when merging with kind
      const arr = ['x', 'y'];
      arr.splice(1, 2, 'a', 'b', 'c');
    });
  });
});
