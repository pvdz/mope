import {pass, only, skip, group} from '../utils.mjs';

export const binding = () => group('binding', () => {
  group('legacy tests to sort and verify', () => {

    pass('set x to string first then compare to returned number type of func call', () => {
      function f() {
        return 20;
      }

      let x = "foo";
      x = f(); // fail
    }, ['POLY_PRIMITIVES']);

    pass('set x to string first then compare to returned string type of func call', () => {
      function f() {
        return "woo";
      }

      let x = "foo";
      x = f(); // pass
    });


    pass('no init is undefined (compare to undefined)', () => {
      let x, y;
      x = undefined;
    }, ['BINDING_NO_INIT', 'BINDING_NO_INIT']);

    pass('no init is undefined (compare to number)', () => {
      let x, y;
      x = 5;
    }, ['BINDING_NO_INIT', 'BINDING_NO_INIT']);


    pass('assert return type of a function must be undefined if there were no other returns', () => {
      function f(a) {
      }

      let x = undefined;
      x = f(5);
    });


    pass('init to empty obj', () => {
      let a = {};
    });

    pass('merge two empty objects', () => {
      let a = {};
      a = {};
    });

    pass('merge empty object with non-empty', () => {
      let a = {};
      a = {x: 1};
    });

    pass('merge incompatible objects', () => {
      let a = {x: true};
      a = {x: 1};
    }, ['POLY_PRIMITIVES']);

    pass('merge compatible objects', () => {
      let a = {x: true};
      a = {x: false};
    });


    group('tdz', () => {
      // Need to figure out whether we would want to support tdz or not. Is there an example poc that we cant prove?
      pass('accessing let in tdz should fail hard', () => {
        let f = a.f;
        let a = {
          x: 123, f() {
            return this.x;
          }
        };
      }, ['USED_BINDING_BEFORE_DECL', 'PROP_ON_NULL_UNDEF']);

      pass('maybe we cant do tdz scanning after all', () => {
        // Since we ignore logic branching, we can't generically tell whether or not a var is in tdz. Should we try at all?
        // In this case the first call will not touch y which is tdz, next call changes y but by then y is no longer tdz,
        let x = false;
        f(); // fail because `y` is accessed in TDZ (model will throw a lint and return undefined)
        let y = 10;
        f();

        function f() {
          if (x) y = 20;
          x = true;
        }
      }, ['USED_BINDING_BEFORE_DECL', 'POLY_PRIMITIVES']);

      pass('accessing a let in tdz in an exported function', {
        // The export part was relevant for triggering a crash because it was recording an implicit global for the wrong file
        index: () => {
          `import f from './a'`;
          f();
        },
        './a': () => {
          function f() {
            tdz
            let tdz = 1
          }
          `export default f`;
        },
      }, ['USED_BINDING_BEFORE_DECL']);
    });

    pass('do block scopes mess with loops and funcs or something?', () => {
      // probably not
      function f(a, b) {
        while (true) {
          let c = a;
          return c;
        }
        return 4;
      }

      f(1, 2);
    });

    pass('function does not refer to outer binding but nested function does so still relevant', () => {
      function f(a, b) {
        function g() {
          function h(x) {
            return b;
          }

          return h(a);
        }

        return g();
      }

      f(1, 2);
    });
  });

  group('global shadowing', () => {
    pass('global block shadow', () => {
      let x = 5;
      var a = 1;
      {
        let x = 'foo';
        let y = 1;
        var a = 2;
        var b = 3;
      }
    });

    pass('global block shadow find inner ref, pass', () => {
      let x = 5;
      {
        let x = 'foo';

        x === 'string';
      }
    });

    pass('global block shadow find ref, fail', () => {
      let x = 5;
      {
        let x = 'foo';

        x === 10;
      }
    }, ['POLY_PRIMITIVES']);

    pass('global block shadow find outer ref, pass', () => {
      let x = 5;
      {
        let x = 'foo';
      }
      x === 10;
    });

    pass('global block shadow find outer, fail', () => {
      let x = 5;
      {
        let x = 'foo';
      }
      x === 'string';
    }, ['POLY_PRIMITIVES']);
  });

  group('function shadowing', () => {
    pass('function block shadow', () => {
      function f() {
        let x = 5;
        {
          let x = 'foo';
        }
      }

      f();
    });

    pass('function block shadow find inner ref, pass', () => {
      function f() {
        let x = 5;
        {
          let x = 'foo';

          x === 'string';
        }
      }

      f();
    });

    pass('function block shadow find ref, fail', () => {
      function f() {
        let x = 5;
        {
          let x = 'foo';

          x === 10;
        }
      }

      f();
    }, ['POLY_PRIMITIVES']);

    pass('function block shadow find outer ref, pass', () => {
      function f() {
        let x = 5;
        {
          let x = 'foo';
        }
        x === 10;
      }

      f();
    });

    pass('function block shadow find outer, fail', () => {
      function f() {
        let x = 5;
        {
          let x = 'foo';
        }
        x === 'string';
      }

      f();
    }, ['POLY_PRIMITIVES']);
  });
});
