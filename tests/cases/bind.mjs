import {pass, only, skip, group} from '../utils.mjs';

export const bind = () => group('bind', () => {
  group('legacy tests to sort and verify', () => {
    group('bind', () => {
      pass('call bind without args', () => {
        // This won't work yet because the argument is optional but we don't support that yet
        function f() {}
        f.bind();
      });

      pass('bind a hoisted func', () => {
        // Point of this function is that a hoisted function is not yet processed so making a clone now makes the args
        // not properly merged, yet. But since a bind does not retain a clone to its original func, we need to make
        // sure the parameter conditions are properly propagated once the hoisted function is processed.

        // Maybe all binds have to be resolved after global?

        // Ultimately we want to connect f to the bound function g, but the bind should do what an actual call would do;
        // create a shadow and only affect the shadow args. So maybe creating a shadow is in fact the correct way here
        // where we treat the call to .bind as invoking a function with closure, except the closure is very unusual?

        function f(x) { x === 5 }
        f.bind(undefined, 5); // Pass: the function does not use `this` so passing `undefined` is correct
      });

      group('bind vs arrow closure', () => {
        pass('binding an arg with .bind', () => {
          function f(x) { x === 5 }
          const g = f.bind(undefined, 5); // Pass: the function does not use `this` so passing `undefined` is correct
        });
        pass('binding an arg with an arrow', () => {
          function f(x) { x === 5 }
          const g = () => f(5);
        });
        pass('.bind should reject if arg would cause poly, even when uncalled', () => {
          // skip: v4 does not work like this so this test would not fail until the bound function is called
          function f(x) { x === 5 }
          const g = f.bind(undefined, 'x'); // Fail, string will compare to number which causes poly, even when not called
        });
        pass('arrow should reject if arg would cause poly, uncalled', () => {
          // skip: arrows
          function f(x) { x === 5 }
          const g = () => f('x'); // Fail, string will compare to number which causes poly, even when not called
        });
        pass('arrow should reject if arg would cause poly, called', () => {
          // skip: arrows
          function f(x) { x === 5 }
          const g = () => f('x'); // Fail, string will compare to number which causes poly, even when not called
          g();
        }, ['POLY_PRIMITIVES']);

        group('next level with partial application', () => {
          pass('binding x to number, calling bound with number', () => {
            function f(x, y) { x === y }
            const g = f.bind(undefined, 5);
            g(6); // Calls f with 5===6 so is fine
          });
          pass('binding x to string, calling bound with string', () => {
            function f(x, y) { x === y }
            const g = f.bind(undefined, 'x');
            g('y'); // Calls f with 'x'==='y' so is fine
          });
          pass('binding x to string, calling bound with number', () => {
            function f(x, y) { x === y }
            const g = f.bind(undefined, 'x');
            g(6); // Calls f with 'x'===6 so is bad
          }, ['POLY_PRIMITIVES']);
          pass('binding x to number, calling bound with string', () => {
            function f(x, y) { x === y }
            const g = f.bind(undefined, 5);
            g('x'); // Calls f with 5==='x' so is bad
          }, ['POLY_PRIMITIVES']);
          pass('binding x to number, calling arrow with number', () => {
            function f(x, y) { x === y }
            const g = (y) => f(5, y);
            g(6); // Calls f with 5===6 so is fine
          });
          pass('binding x to string, calling arrow with number', () => {
            function f(x, y) { x === y }
            const g = (y) => f('x', y);
            g(6); // Calls f with 'x'===6 so is bad
          }, ['POLY_PRIMITIVES']);
          pass('binding x to number, calling arrow with string', () => {
            function f(x, y) { x === y }
            const g = (y) => f(5, y);
            g('x'); // Calls f with 5==='x' so is bad
          }, ['POLY_PRIMITIVES']);
        });

        group('bind should remember bound args when replaying', () => {
          pass('adding two numbers', () => {
            function f(x, y) { return x + y; }
            const g = f.bind(undefined, 5);
            const a = g(6);
            a === 10; // Pass because f(5, 6) will return 11
          });
          pass('adding two strings', () => {
            function f(x, y) { return x + y; }
            const g = f.bind(undefined, 'a');
            const a = g('b');
            a === 'c'; // Pass because f('a', 'b') will return 'ab'
          });
          pass('adding number to string', () => {
            function f(x, y) { return x + y; }
            const g = f.bind(undefined, 5);
            g('b'); // Fail because f(5, 'b') will lead to 5 + 'b'
          }, ['PLUS_MERGE_NUM_STR']);
          pass('adding string to number', () => {
            function f(x, y) { return x + y; }
            const g = f.bind(undefined, 'a');
            g(6); // Fail because f('a', 6) will lead to 'a' + 6
          }, ['PLUS_MERGE_NUM_STR']);
          pass('make sure global param tids are not merged when binding, it should merge shadows', () => {
            function f(x, y) { return x + y; }
            const g = f.bind(undefined, 'a');
            g('b'); // Pass, 'a' + 'b'
            const h = f.bind(undefined, 1); // If the code would merge the bound args to global param tids then this step fails
            h(2); // Pass, 1 + 2.
          });
        });

        group('tbd', () => {
          pass('bind empty func with undefined and no args', () => {
            // skip: we dont make arrow/function distinction yet
            function f() {}
            const g = f.bind(undefined);

            g === f; // Not the same, because arrow != bound function. Or is it? Should we fail on this?
          }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);

          pass('arrow calls empty function', () => {
            // skip: we dont make arrow/function distinction yet
            // TBD: are arrows different from functions? Can we allow them to coexist until the point where they cause trouble?
            function f() {}
            const h = () => f();
            h === f; // Not the same, because arrow != bound function. Or is it? Should we fail on this?
          }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);

          pass('bind returns new reference where arrow retroactively keeps same tid for bound function', () => {
            // skip: we dont make arrow/function distinction yet
            // TBD: are arrows different from functions? Can we allow them to coexist until the point where they cause trouble?
            function f() {}
            const g = f.bind(undefined);
            const h = () => f();

            g === f; // Not the same, because arrow != bound function. Or is it? Should we fail on this?
          }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);
        });
      });

      group('.bind context checks', () => {

        pass('a function without `this` should not receive a context', () => {
          function f() {}
          f.bind({}); // Fail: the function does not use `this` so why pass it a context?
        }, ['FUNCTION_BIND_THISLESS_CONTEXT']);

        pass('a function without `this` should receive undefined as context', () => {
          function f() {}
          f.bind(undefined); // Pass: the function does not use `this` so passing `undefined` is the only valid context
        });

        pass('crash', () => {
          // In this case the function is known to want to read this.x and so binding it to undefined is certainly
          // an error (when the function is called) and dead code otherwise. But in v4, we don't see this until the
          // function actually gets invoked, so we can get away with a lint warning instead.
          function f() { return this.x; }
          f.bind(undefined); // Fail: this.x would fail, demand an object for context
        }, ['FUNCTION_BIND_BAD_CONTEXT']);

        pass('a function with `this` should not receive undefined for context', () => {
          // In this case the function is known to want to read this.x and so binding it to undefined is certainly
          // an error (when the function is called) and dead code otherwise.
          function f() { return this.x; }
          const g = f.bind(undefined); // Fail: this.x would fail, demand an object for context
          g();
        }, ['FUNCTION_BIND_BAD_CONTEXT', 'CONTEXT_MISSING', 'PROP_ON_NULL_UNDEF']);

        pass('function that uses property on `this` should receive context that matches, when called', () => {
          // TODO: I think we can accept these cases. It won't block the model (as long as we treat the return type as undefined) and allows us to report which properties are actually accessed on which objects. super useful.
          function f() { return this.x; }
          f.bind({}); // Fail?: we know `x` doesn't exist so this seems like something we should not allow
        });

        pass('function that uses property on `this` should receive context that matches', () => {
          // TODO: I think we can accept these cases. It won't block the model (as long as we treat the return type as undefined) and allows us to report which properties are actually accessed on which objects. super useful.
          function f() { return this.x; }
          const g = f.bind({}); // Fail?: we know `x` doesn't exist so this seems like something we should not allow
          g();
        }, ['PROP_NOT_FOUND']);

        pass('`.bind` with context that later turns out to be a value that is invalid', () => {
          // TODO: I think we can accept these cases. It won't block the model (as long as we treat the return type as undefined) and allows us to report which properties are actually accessed on which objects. super useful.
          function f() { return this.x; }
          let x = {};
          f.bind(x); // At this point we don't know x yet
        });

        group('bind with context that is not yet known', () => {
          pass('`.bind` with context that later turns out to be a value that is valid, pass', () => {
            function f() { return this.length; }
            f.bind(x); // At this point we don't know x yet
            function x() {} // Functions will have .length so this should validate the bind context value
          });

          pass('`.bind` with context that later turns out to be a value that is valid, fail', () => {
            // TODO: I think we can accept these cases. It won't block the model (as long as we treat the return type as undefined) and allows us to report which properties are actually accessed on which objects. super useful.
            function f() { return this.length; }
            let x = {y: 1}; // No length, no glory
            f.bind(x);
          });

          group('bound function context', () => {
            pass('verify that the function is called with proper value and returns the type, pass arr', () => {
              function f(h) {
                function g() { return this.length; }
                return g.bind(h);
              }
              let j = f([]);
              let n = j();
              n === 0 // f(i) will return a number here; the length of the array
            });

            pass('verify that the function is called with proper value and returns the type, fail arr', () => {
              function f(h) {
                function g() { return this.length; }
                return g.bind(h);
              }
              let j = f([]);
              let n = j();
              n === 'x' // f(i) will return a number here; the length of the array
            }, ['POLY_PRIMITIVES']);

            pass('verify that the function is called with proper value and returns the type, pass func', () => {
              function f(h) {
                function g() { return this.length; }
                return g.bind(h);
              }
              function i() {}
              let j = f(i);
              let n = j();
              n === 0 // f(i) will return a number here; i.length (function arity)
            });

            pass('verify that the function is called with proper value and returns the type, fail func', () => {
              function f(h) {
                function g() { return this.length; }
                return g.bind(h);
              }
              function i() {}
              let j = f(i);
              let n = j();
              n === 'x' // f(i) will return a number here; i.length (function arity)
            }, ['POLY_PRIMITIVES']);

            pass('verify that the function is called with proper value and returns the type, pass obj with length', () => {
              function f(h) {
                function g() { return this.length; }
                return g.bind(h);
              }
              let j = f({length: 'foo'});
              let n = j();
              n === 'x' // call to f will return 'foo'
            });

            pass('verify that the function is called with proper value and returns the type, fail obj with length', () => {
              function f(h) {
                function g() { return this.length; }
                return g.bind(h);
              }
              let j = f({length: true});
              let n = j();
              n === 'x' // call to f will return true
            }, ['POLY_PRIMITIVES']);

            pass('verify that the function is called with proper value and returns the type, pass obj without length', () => {
              function f(h) {
                function g() { return this.length; }
                return g.bind(h);
              }
              let j = f({});
              let n = j();
              n === undefined
            }, ['PROP_NOT_FOUND']);

            pass('verify that the function is called with proper value and returns the type, fail obj without length', () => {
              function f(h) {
                function g() { return this.length; }
                return g.bind(h);
              }
              let j = f({});
              let n = j();
              n === 'x'
            }, ['PROP_NOT_FOUND', 'POLY_PRIMITIVES']);
          });
        });

        pass('function that uses property on `this` `receiving `.bind` context that matches', () => {
          function f() { return this.x; }
          f.bind({x: 5}); // Pass. Function uses this.x and receives an object for context that has an x
        });
      });

      group('bind preserving closure tag', () => {
        pass('bind should preserve closure tag, pass', () => {
          function f() {
            let x = 5;
            return function g() { return x; }
          }

          let boundG = f().bind(undefined);
          boundG() === 5; // Should pass because g closes x, the bind does not change this, so boundG returns 5
        });
        pass('bind should preserve closure tag, fail', () => {
          function f() {
            let x = 5;
            return function g() { return x; }
          }

          let boundG = f().bind(undefined);
          boundG() === 'x'; // Should fail because g closes x, the bind does not change this, so boundG returns 5
        }, ['POLY_PRIMITIVES']);
      });

      group('bound parameters dont affect original func', () => {
        pass('the bound arrows should not affect type of original functions', () => {
          function f(a, b) { a === b }
          const g = f.bind(undefined, 1);
          f('a', 'b');
        });
        pass('the bound function should apply constraints', () => {
          function f(a, b) { a === b }
          const g = f.bind(undefined, 1);
          f('a', 'b');
          g('b'); // Fail because it'll end up doing `1 === 'b'`
        }, ['POLY_PRIMITIVES']);
        pass('bound function should work', () => {
          function f(a, b) { a === b }
          const g = f.bind(undefined, 1);
          f('a', 'b');
          g(2);
        });
      });

      pass('the biggest problem is a tid that may be an object but will be a callable', () => {
        // skip: v4 still has to hash out what to do with func merges. this isn't a problem now, but rather a choice

        // if properties are used on a callable before the callable is uncovered as such then merges will want to
        // try and merge those properties (the parent of a uncovered callable should not be set as I think we can
        // safely apply a rule that callables are not to be extended, and as such only the Function.prototype can
        // have a prototype that is not, well, itself).
        let g = f.bind();
        // lets ignore this case :p
        g = k.bind();
        let h = f;
        // now hte system knows that k and g are something that has .bind as a property but it doesnt know that
        // htey are in fact a callables. the next assignment is going to try to merge them, anywyas. so they
        // ought to be typeof=? with an any prop of bind, in both cases a zero arity function.
        h = k;
        // the question is how often we might use properties of a callable in the general case. functions only
        // have a handful of things you'd validly want to call, stuff like call, apply, bind, toString, toSource,
        // and the length property. it does of course also inherit from object.
        // we can choose to ignore these cases for now and simply postpone any mege on unknown objects while
        // proceeding with anything else?
        // things like call apply bind and tostring may be most common.
        function k(){}
        function f(){}
        // We could also just ban the use of call, apply, and bind in favor of spread and arrow
        // f.call(a, b) -> (...args) => f(...argS). context is trickier since you can only transfer that
        // through the methods or by making the function a property of the target object (which is undesirable)
        // this leaves us with a handful of methods to worry about, so mainly for context and, I suppose, arity.
        // The Object inherited properties are useless and I don't think we'll see a real case for toString.
      }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX', 'FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);

      pass('return value of function for bind', () => {
        function f(cb){ return cb; }
        let g = f.bind();
        let h = g(f);
        h.bind();
      });
    });

  });
});
