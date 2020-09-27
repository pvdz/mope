import {pass, only, skip, group} from '../utils.mjs';

export const functions = () => group('functions', () => {

  group('nested func ids', () => {
    pass('func decl in func decl', () => {
      function f(n) {
        function g(m) {
          m
        }
        n
        g()
      }
      f();
    }, ['CALL_ARG_ARITY', 'CALL_ARG_ARITY']);

    pass('named func expr in func decl', () => {
      function f(n) {
        let x = function g(m) {
          m
          g()
        }
        n
        x()
      }
      f();
    }, ['CALL_ARG_ARITY', 'CALL_ARG_ARITY', 'CALL_ARG_ARITY']);

    pass('anon func expr in func decl', () => {
      function f(n) {
        let x = function g(m) {
          m
          g()
        }
        n
        x();
      }
      f();
    }, ['CALL_ARG_ARITY', 'CALL_ARG_ARITY', 'CALL_ARG_ARITY']);

    pass('func decl in named func expr', () => {
      let x = function f(n) {
        function g(m) {
          m
        }
        n
        g()
        f()
      }
      x()
    }, ['CALL_ARG_ARITY', 'CALL_ARG_ARITY', 'CALL_ARG_ARITY']);

    pass('func decl in anon func expr', () => {
      let x = function(n) {
        function g(m) {
          m
        }
        n
        g()
      }
      x()
    }, ['CALL_ARG_ARITY', 'CALL_ARG_ARITY']);

    pass('named func expr in named func expr', () => {
      let x = function f(n) {
        let y = function g(m) {
          m
          g()
        }
        n
        f()
        y()
      }
      x();
    }, ['CALL_ARG_ARITY', 'CALL_ARG_ARITY', 'CALL_ARG_ARITY', 'CALL_ARG_ARITY']);

    pass('anon func expr in anon func expr', () => {
      let x = function(n) {
        let y = function(m) {
          m
        }
        n
        y()
      }
      x();
    }, ['CALL_ARG_ARITY', 'CALL_ARG_ARITY']);
  });

  group('legacy tests to sort and verify', () => {
    group('merge funcs', () => {
      // skip: v4 we cant merge funcs right now
      pass('if two functions are merged they must both test all call replays', () => {
        function f(a){}
        function g(b){}
        f === g; // merge the funcs
        f(1);
      }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);

      pass('reject if any function of the merged functions would reject (v1)', () => {
        function f(a){}
        function g(b){ b === 'a'; }
        f === g; // merge the funcs
        f(1); // fails the call to g
      }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);

      pass('reject if any function of the merged functions would reject (v1, rev)', () => {
        function f(b){ b === 'a'; }
        function g(a){}
        f === g; // merge the funcs
        g(1); // fails the call to g
      }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);

      pass('reject if any function of the merged functions would reject (v2)', () => {
        function f(a){}
        function g(b){ b === 'a'; }
        f === g; // merge the funcs
        g(1); // fails the call to g (but is okay for f)
      }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX', 'POLY_PRIMITIVES']);

      pass('reject if any function of the merged functions would reject (v2, rev)', () => {
        function f(b){ b === 'a'; }
        function g(a){}
        f === g; // merge the funcs
        f(1); // fails the call to g (but is okay for f)
      }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX', 'POLY_PRIMITIVES']);

      pass('function must also "eval" to same return type for each call', () => {
        function f(a){ return 1; }
        function g(b){ return 2; }
        f === g; // merge the funcs
        g(1);
      }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);

      pass('function must also "eval" to same return type for each call (counter test)', () => {
        // Normally not a problem in our system but in this case the "g()" call expression expects one type and both
        // the functions should return it as they were merged.
        function f(a){ return 1; }
        function g(b){ return 'a'; }
        f === g; // merge the funcs
        g(1);
      }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);

      pass('function must also "eval" to same return type for each call (counter test, rev)', () => {
        // Normally not a problem in our system but in this case the "g()" call expression expects one type and both
        // the functions should return it as they were merged.
        function g(a){ return 1; }
        function f(b){ return 'a'; }
        f === g; // merge the funcs
        f(1);
      }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);

      pass('potential v3 problem but its not where a closure could be affected by two funcs that are merged', () => {
        // It shouldn't be a problem because the binding must be resolved by the time that inner f and g get instantiated
        // at which point the binding is immutable and so there's no way for f and g to replay in such a way that a
        // binding gets different type assigned. Same for argument, since that too must be resolved when f and g get
        // instantiated. I think this is fine and generically don't see another way of breaking this.
        // That means that function merging should be safe and thanks to shadowing we should be able to safely replay
        // both functions without risking cross pollution due to function body code being different (potentially even
        // differently typed, even if it accepts the same type inputs/outputs/context/etc).

        function outer(x) {
          function f(a){
            x = a
          }
          function g(b){
            x = b
          }

          f === g; // merge the funcs
        }

        outer(1);
      }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);

      pass('merge two functions with different arity but where rest can cover it', () => {
        function f(a, b, c) {
          // Force the args to be numbers
          a === 1
          b === 2
          c === 3
        }
        f(1, 2, 3);

        // In the counter test, the rest (or a) should not be casted to a number and it should poly fail, anyways
        function g(a, ...b) {
          // Force the args to be numbers
          a === 1
          b.forEach(n => n === 2);
        }
        f(1, 2, 3);
        g(1, 2, 3);

        f === g;
      }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);
    });

    pass('do we merge funco or funci (simple case)', () => {
      function A(x) {
        return x;
      }
      function C(y) {
        return y;
      }

      A(99) === C(103)
      A('yes') === C('no')
    });

    pass('do we merge funco or funci', () => {
      function A(x) {
        function B() {
          return x;
        }
        return B;
      }
      function C(y) {
        function D() {
          return y;
        }
        return D;
      }

      A(99) === C(103)
      A('yes') === C('no')
    }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX', 'FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);

    group('polyfunc', () => {
      pass('functions can be called with- and return different types', () => {
        function f(a) { return a; }
        f(1);
        f("a");
      });
      pass('function should be callable with same type', () => {
        function g(unused) {    }
        g('a');
        g('a');
      });
      pass('setup for arg typing', () => {
        function f(x) {
          return x;
        }
        f(1);
        f(2);
      });
    });

    group('poly args and caching', () => {
      pass('x and y should be same because the arg is the same', () => {
        function f(x) {
          return x;
        }
        let x = f(1);
        // this call should be memoized
        let y = f(2);
        // this would fail if the type is not the same
        x === y
      });
      pass('x and y should be different because the arg is different', () => {
        function f(x) {
          return x;
        }
        let x = f(1);
        // this call should NOT be memoized
        let y = f('a');
        // this fails because the type is not the same
        x === y
      }, ['POLY_PRIMITIVES']);
      pass('return value when objliteral (deep) type depends on call arg (ok)', () => {
        function f(x) {
          return {prop: x};
        }
        let x = f(1);
        // this call should be memoized
        let y = f(2);
        // type of x.prop == y.prop so this passes
        x === y
      });
      pass('return value when objliteral (deep) type depends on call arg (bad)', () => {
        function f(x) {
          return {prop: x};
        }
        // x should be a direct link to the object literal of this particular replay (where prop ends up a number)
        let x = f(1);
        // this call should NOT be memoized
        // y should be a direct link to the object literal of this particular replay (where prop ends up a string)
        let y = f('a');
        // type of x.prop != y.prop so this rejects
        x === y
      }, ['POLY_PRIMITIVES']);
    });

    pass('func without params should still consume all args passed on', () => {
      function f() {}
      f(12,3,4,54)
    }, ['CALL_ARG_ARITY']);

    pass('func arity fail (g has no args but is called with one)', () => {
      function f(y){
        let x = y;
        function g() {
          t(x, 'a');
        }
        function h() {
          t(x, 'b');
        }
        function t(z, zz) {
          z === zz; // POLY_PRIMITIVES
        }
        g(x); // CALL_ARG_ARITY (2x)
        h(x); // CALL_ARG_ARITY (2x)
      }
      f('x');
      f(1);
    }, ['CALL_ARG_ARITY', 'CALL_ARG_ARITY', 'CALL_ARG_ARITY', 'POLY_PRIMITIVES', 'CALL_ARG_ARITY']);

    group('this used to be a problem', () => {

      pass('x will be known before g(x) is called because f() resolves before g()', () => {
        let x = f();
        let y = g(x);
        function g(o){ return o.a; }
        function f(){ return {a: 0}; }
      });
      pass('x only resolves before the g(x) call if we actively maintain an order for replays (queue h() before g(x))', () => {
        let x = f();
        g(x);
        function g(o){ return o.a; }
        function f(){ return h(); }
        function h(){ return {a: 0}; }
      });
    });

    pass('nested function calls', () => {
      function f(){}
      function g(){}
      f(g()); // CALL_ARG_ARITY
    }, ['CALL_ARG_ARITY']);
    pass('nested function calls with args', () => {
      function f(a){}
      function g(b){}
      f(g(1));
    });

    group('func expr', () => {
      pass('func expr ids', () => {
        let x = function iamtheneedlepleasefindme(){};
      });
      group('pair', () => {
        group('outer func check', () => {
          pass('make sure func ids are read from the correct scope, outer func is num (func decl, let shadow), fail', () => {
            function shadowedFunction(){
              let shadowedFunction = 1;
              shadowedFunction === 1;
            }
            shadowedFunction === 1; // fail because shadowedFunction is a func in this scope
          }, ['POLY_PRIMITIVES']);
          pass('make sure func ids are read from the correct scope, outer func is num (func decl, var shadow), fail', () => {
            function shadowedFunction(){
              var shadowedFunction = 1;
              shadowedFunction === 1;
            }
            shadowedFunction === 1; // fail because shadowedFunction is a func in this scope
          }, ['POLY_PRIMITIVES']);
          pass('make sure func ids are read from the correct scope, outer func is num (func expr, let shadow), fail', () => {
            let outerFunction = function shadowedFunction(){
              let shadowedFunction = 1;
              shadowedFunction === 1;
            }
            outerFunction === 1; // fail because shadowedFunction is a func in this scope
          }, ['FUNC_EXPR_NAME_SHADOW', 'POLY_PRIMITIVES']);
          pass('make sure func ids are read from the correct scope, outer func is num (func expr, var shadow), fail', () => {
            let outerFunction = function shadowedFunction(){
              var shadowedFunction = 1; // lint: shadow a func expr name in func root
              shadowedFunction === 1;
            }
            outerFunction === 1; // fail because shadowedFunction is a func in this scope
          }, ['FUNC_EXPR_NAME_SHADOW', 'POLY_PRIMITIVES']);
        });

        group('shadowed uncalled', () => {
          pass('make sure func ids are read from the correct scope (func decl, let shadow), nocall, pass', () => {
            function shadowedFunction(){
              let shadowedFunction = 1;
              shadowedFunction === 1; // pass because shadowedFunction is a num in this scope
            }
          });
          pass('make sure func ids are read from the correct scope (func decl, var shadow), nocall, pass', () => {
            function shadowedFunction(){
              var shadowedFunction = 1;
              shadowedFunction === 1; // pass because shadowedFunction is a num in this scope
            }
          });
          pass('make sure func ids are read from the correct scope (func expr, let shadow), nocall, pass', () => {
            let outerFunction = function shadowedFunction(){
              let shadowedFunction = 1;
              shadowedFunction === 1;
            }
          }, ['FUNC_EXPR_NAME_SHADOW']);
          pass('make sure func ids are read from the correct scope (func expr, var shadow), nocall, pass', () => {
            let outerFunction = function shadowedFunction(){
              var shadowedFunction = 1;
              shadowedFunction === 1;
            }
          }, ['FUNC_EXPR_NAME_SHADOW']);

          pass('make sure func ids are read from the correct scope (func decl, let shadow), nocall, bad', () => {
            function shadowedFunction(){
              let shadowedFunction = 1;
              shadowedFunction === 'str';
            }
          });
          pass('make sure func ids are read from the correct scope (func decl, var shadow), nocall, bad', () => {
            function shadowedFunction(){
              var shadowedFunction = 1;
              shadowedFunction === 'str';
            }
          });
          pass('make sure func ids are read from the correct scope (func expr, let shadow), nocall, bad', () => {
            let outerFunction = function shadowedFunction(){
              let shadowedFunction = 1;
              shadowedFunction === 'str';
            }
          }, ['FUNC_EXPR_NAME_SHADOW']);
          pass('make sure func ids are read from the correct scope (func expr, var shadow), nocall, bad', () => {
            let outerFunction = function shadowedFunction(){
              var shadowedFunction = 1;
              shadowedFunction === 'str';
            }
          }, ['FUNC_EXPR_NAME_SHADOW']);
        });

        group('shadowed called', () => {
          pass('make sure func ids are read from the correct scope (func decl, let shadow), pass', () => {
            function shadowedFunction(){
              let shadowedFunction = 1;
              shadowedFunction === 1; // pass because shadowedFunction is a num in this scope
            }
            shadowedFunction();
          });
          pass('make sure func ids are read from the correct scope (func decl, var shadow), pass', () => {
            function shadowedFunction(){
              var shadowedFunction = 1;
              shadowedFunction === 1; // pass because shadowedFunction is a num in this scope
            }
            shadowedFunction();
          });
          pass('make sure func ids are read from the correct scope (func expr, let shadow), pass', () => {
            let outerFunction = function shadowedFunction(){
              let shadowedFunction = 1;
              shadowedFunction === 1;
            }
            outerFunction();
          }, ['FUNC_EXPR_NAME_SHADOW']);
          pass('make sure func ids are read from the correct scope (func expr, var shadow), pass', () => {
            var outerFunction = function shadowedFunction(x){
              let shadowedFunction = 1;
              shadowedFunction === 1;
            }
            outerFunction('x');
          }, ['FUNC_EXPR_NAME_SHADOW']);

          pass('make sure func ids are read from the correct scope (func decl, let shadow), fail', () => {
            function shadowedFunction(){
              let shadowedFunction = 1;
              shadowedFunction === 'str'; // fail
            }
            shadowedFunction();
          }, ['POLY_PRIMITIVES']);
          pass('make sure func ids are read from the correct scope (func decl, var shadow), fail', () => {
            function shadowedFunction(){
              var shadowedFunction = 1;
              shadowedFunction === 'str'; // fail
            }
            shadowedFunction();
          }, ['POLY_PRIMITIVES']);
          pass('make sure func ids are read from the correct scope (func expr, let shadow), fail', () => {
            let outerFunction = function shadowedFunction(){
              let shadowedFunction = 1;
              shadowedFunction === 'str'; // fail
            }
            outerFunction();
          }, ['FUNC_EXPR_NAME_SHADOW', 'POLY_PRIMITIVES']);
          pass('make sure func ids are read from the correct scope (func expr, var shadow), fail', () => {
            var outerFunction = function shadowedFunction(){
              let shadowedFunction = 1;
              shadowedFunction === 'str'; // fail
            }
            outerFunction();
          }, ['FUNC_EXPR_NAME_SHADOW', 'POLY_PRIMITIVES']);
        });

        group('arg shadowing', () => {
          pass('func expr arg shadwing the func expr name, pass', () => {
            let outerFunction = function shadowedFunction(shadowedFunction){
              shadowedFunction === 1
            }
            outerFunction(2);
          }, ['FUNC_EXPR_NAME_SHADOW']);
          pass('func expr arg shadwing the func expr name, fail', () => {
            let outerFunction = function shadowedFunction(shadowedFunction){
              shadowedFunction === 'str'
            }
            outerFunction(2);
          }, ['FUNC_EXPR_NAME_SHADOW', 'POLY_PRIMITIVES']);
        });
      });
    });


    pass('function arity', () => {
      // skip: v4 func merge
      function f(a, b) {}

      f = function(a){};
    }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);

    pass('simple mono call', () => {
      function f(x) { return x === 5; }
      f(1);
    });

    pass('simple which is poly', () => {
      function f(x) { return x === 5; }
      f('x');
    }, ['POLY_PRIMITIVES']);

    pass('simple which is poly in the second call', () => {
      function f(x) { return x === 5; }
      f(1);
      f('x');
    }, ['POLY_PRIMITIVES']);

    pass('simple which is poly in the first call', () => {
      function f(x) { return x === 5; }
      f('x');
      f(1);
    }, ['POLY_PRIMITIVES']);

    pass('return type is part of the (outer) sig', () => {
      function f() {
        return 5;
      }

      f = function(){}; // fail, because the return type is different (number vs undefined)
    }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);

    pass('return type is part of the (outer) sig and will throw before even being called', () => {
      function f() {
        return 5;
      }
      let x = f();

      f = function(){}; // fail, return type is different
      x = f();
    }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);

    group('transitivity through inheritance', () => {
      pass('transitivity through inheritance, revealed with hoisting', () => {
        // - upcast unknown object to function 'function f(d){} f(g.toString); function g(){}' ->
        //  - so doesn't that make Function#toString an opaque type?
        //  -> no because types with same sig are fine too
        //  - is 'd' some function that returns a string or the built-in specifically?
        //  -> I guess internally the built-in is used as an opaque type since built-ins take precedence. but two built-ins with the same sig are fine to share a type.

        function f(d){} // d is any type
        f(g.toString); // d is still any type, and is the same as g.toString
        function g(){} // now we know g.toString is Function#toString and d should be set to this sig as well
      });

      pass('transitivity through inheritance, matching plain func signature', () => {
        function f(d){} // d is any type
        f(g.toString); // d is still any type, and is the same as g.toString
        function g(){} // now we know g.toString is Function#toString and d should be set to this sig as well
        f(function(){ return "foo"; }); // same sig as Function#toString
      });

      pass('transitivity through inheritance, not an error when d is unused', () => {
        function f(d){} // d is Function#toString and Number#toString
        f(g.toString); // d is still any type, and is the same as g.toString
        function g(){} // now we know g.toString is Function#toString and d should be set to this sig as well
        f(5..toString); // Number#toString different sig as Function#toString which is fine when unused
      });

      pass('transitivity through inheritance (called without args)', () => {
        // old test, fixed in model v4
        function f(d){ return d(); } // d is Function#toString and Number#toString so this fails for num
        f(g.toString); // d is still any type, and is the same as g.toString
        function g(){} // now we know g.toString is Function#toString and d should be set to this sig as well
        f(5..toString); // Number#toString different sig as Function#toString which is poly when called
      }, ['FUNCTION_TOSTRING_CONTEXT', 'NUMBER_TOSTRING_CONTEXT']);
      pass('transitivity through inheritance (called string args)', () => {
        // old test, fixed in model v4
        // The string arg should be a number
        function f(d){ return d('okay'); } // d is Function#toString and Number#toString so this fails for num.tostr
        f(g.toString); // d is still any type, and is the same as g.toString
        function g(){} // now we know g.toString is Function#toString and d should be set to this sig as well
        f(5..toString); // Number#toString different sig as Function#toString which is poly when called
      }, ['FUNCTION_TOSTRING_ARGS', 'FUNCTION_TOSTRING_CONTEXT', 'NUMBER_TOSTRING_NUM', 'NUMBER_TOSTRING_CONTEXT']);

      pass('transitivity through inheritance, error when d is called with incorrect arity (called with an arg)', () => {
        // old test, fixed in model v4
        // this should emit a warning when calling g.toString with a number
        // This should fail because the toString methods are context sensitive
        function f(d){ return d(16); } // d is Function#toString and Number#toString so this fails for str
        f(g.toString); // d is still any type, and is the same as g.toString
        function g(){} // now we know g.toString is Function#toString and d should be set to this sig as well
        f(5..toString); // Number#toString different sig as Function#toString which is poly when called
      }, ['FUNCTION_TOSTRING_ARGS', 'FUNCTION_TOSTRING_CONTEXT', 'NUMBER_TOSTRING_CONTEXT']);

      pass('transitivity through inheritance, both built-in toStrings have same function sig', () => {
        // This should fail because the toString methods are context sensitive
        function f(d){ return d(); } // in both calls the func has arity=0 and returns a string
        let x = f(g.toString); // d is still any type, and is the same as g.toString
        function g(){}
        let y = f("foo".toString); // Different functions both return the same type so should be ok
        x === y; // both strings
      }, ['FUNCTION_TOSTRING_CONTEXT', 'STRING_TOSTRING_CONTEXT']);

      pass('transitivity through inheritance, same sig with different builtin should not bounce on merging two builtins', () => {
        function f(d){} // d is any type
        f(g.toString); // d is still any type, and is the same as g.toString
        function g(){} // now we know g.toString is Function#toString and d should be set to this sig as well
        f({}.toString); // now merging Function#toString with Object#toString
      });
    });

    pass('passed on function with different return type 1', () => {
      function f(d){ return d(); } // in both calls the func has arity=0 and returns a number
      let x = f(function(){ return 1; });
      let y = f(function(){ return 100; });
      x === y; // number to number, pass
    });

    pass('passed on function with different return type 2', () => {
      function f(d){ return d(); } // in both calls the func has arity=0 but the return type differs
      let x = f(function(){ return 'a'; });
      let y = f(function(){ return 1; });
      x === y; // string to number, fail
    }, ['POLY_PRIMITIVES']);

    group('v2 model stuff', () => {

      pass('Func arg that is constrained by usage', () => {
        function f(a, b) {
          return a * b;
        }
      });
      pass('Func arg that is poly in nature', () => {
        function f(a, b) {
          return a + b;
        }
        f(1, 2);
        f('a', 'b');
      });
      pass('Func arg that is poly in nature when the function is hoisted', () => {
        // Do we store a list of all combinations of types such that we can verify them all once we see the function?
        // And possibly not even then (due to context)
        // This can be especially problematic with deep complex data structures like AST nodes
        f(1, 2);
        f('a', 'b');
        function f(a, b) {
          return a + b;
        }
      });
      pass('How does that work with transitive poly?', () => {
        // We start with the same unknown function f receiving two values with a certain sig
        f(1, 2);
        f("a", "b");
        // But f relays to g, re-using the args should not be relevant at this point
        function f(a, b) {
          g(a, b, a);
          g(b, a, b);
        }
        // And g is poly by nature, accepting numbers and strings, but only one type at a time...
        // Do the args of g tie indirectly to the args of f? Does that work at scale?
        function g(a, b, c) {
          return a + b + c;
        }
        // Now g is determined to have the same types for a, b, and c when called. Furthermore these args
        // are tied to the type of f. But not individually or otherwise g's args could be poly relative to
        // each other. If we store the set of types for each call to g then we can verify them all and future
        // ones going forward when we encounter g.
        // When the code found f it couldnt verify anything. It stored placeholders for the args and has to verify
        // each call with the types of the call for each input.
      });
      pass('Can we always resolve this type? Even with dynamic function args?', () => {
        f(function(h){ return h(1, 2) + h(3, 4); }, function(a, b){ return a + b; });
        // Func f has a call cached which passes on two functions where one serves as the arg for the other
        function f(g, h) {
          return g(h);
        }
      });
      pass('Can two different functions properly resolve?', () => {
        function f(g, x) {
          // This means g is forced to a function and calls are queued with x, for all the different ways that f is called
          // Or perhaps that is irrelevant and it is only relevant that each call to f resolves to a proper g, capabable to
          // receive whatever the value of x is in that particular call. Even if it hasn't been resolved at this point.
          // Doesn't that lead to a higher likelihood that certain types are never resolved? Maybe...
          return g(x);
        }
        // Now f gets two functions cached with different type for x and they should still resolve to match
        f(x => x * x , 3);
        f(x => x + x , 'a');
      });
      pass('When is a function type deferred and when is it required?', () => {
        function f(g, x, y, o, s, r) {
          g(); // g must be a callable of sorts, but the actual type is still tbd
          ++x; // x must be a number
          x + s // s must be number because x must be a number
          y + y // y must be a plus, number, or string but anything else throws
          o.a.b.c // deferred. o could have a parent that contains a.b.c, or own prop a with parent b.c, etc
          return r; // and some are simply never forced...
        }
      });
      pass('Should functions as args still have the same arity requirements? (fixed)', () => {
        function f(g, b) {
          // The model is fine with mapping input params to `undefined`, or even arg defaulting to another type
          if (b) g(1, 2); // CALL_ARG_ARITY in the second call to f()
          else g(1, 2, 3); // this call is cached so lints are not triggered for it again
        }
        f((a,b) => a+b, true);
        f((a,b,c) => a+b, false);
      }, ['CALL_ARG_ARITY', 'CALL_ARG_ARITY']);
      pass('Should functions as args still have the same arity requirements? (broken)', () => {
        // This test was broken because, once fixed, the system would correctly detect that the last call was effectively doing 1+2+undefined :)
        function f(g, b) {
          // The model is fine with mapping input params to `undefined`, or even arg defaulting to another type
          if (b) g(1, 2); // CALL_ARG_ARITY in the second call to f(). This will cause the last call to do 1+2+undefined
          else g(1, 2, 3); // this call is cached so lints are not triggered for it again
        }
        f((a,b) => a+b, true);
        f((a,b,c) => a+b+c, false);
      }, ['CALL_ARG_ARITY', 'CALL_ARG_ARITY', 'PLUS_MERGE_NUM_UNDEF', 'PLUS_MERGE_STR_PRIM']);
      pass('Function arg arity', () => {
        function f(g, b) {
          if (b) g(1, 2);
          else g(1, 2);
        }
        f((a,b) => a+b, true);
        f((a,b) => a+b, false);
      });
      pass('function passed on to multiple calls, refined each step', () => {
        // Should a function kind of compile its type checks?
        function f1(g, a, b) { g(1, a, b); }
        function f2(g, a, b) { g(a, 2, b); }
        function f3(g, a, b) { g(a, b, 3); }
        // These are three different funcs, do not share any state
        function g(a, b, c){ return a+a }
        // Now we call the funcs with the same function, which should refine its type
        f1(g, 8, 9);
        f2(g, 8, 9);
        f3(g, 8, 9);
        // Each call should have refined the g function args. Each step refining one arg to a number.
        // No compilation needed for that tho.
      });
      group('pair', () => {
        pass('function passed on to multiple calls, can take different types per call, same args', () => {
          function f(g, x, y, b) {
            if (b) g(x);
            else g(y);
          }
          function g(a){}
          // Now when f is called, g can get either x or y passed on. And since g doesnt refine the type, it depend on f which
          // in turn depends on the callers.
          f(g, 1, 1, true);
          // It should be fine to use completely different types for x and y now
          f(g, 'a', 'b', false);
          // If the function compiled a pseudo-type-function then we could just invoke that with the input types
          // as parameters and let it resolve that way. It would make g get a number and a string. Especially
          // generically and at scale, this may be the best option...
        });
        pass('function passed on to multiple calls, can take different types per call, different args', () => {
          function f(g, x, y, b) {
            if (b) g(x);
            else g(y);
          }
          function g(a){}
          f(g, 1, 1, true);
          f(g, 'a', 'b', false);
          // For this call, the return type of 'f' would become a string or a number, which should fail
          f(g, 'a', 1, false);
        });
      })
      group('pair', () => {
        pass('func that returns arg, called with other args, should match input types, pass case', () => {
          function f(g, x, y, b) {
            if (b) return g(x); // Recognize that g returns input type, so type(x) must equal type(y) to pass
            else return g(y);
          }
          function g(a){ return a; } // Return the input type
          f(g, 1, 1, true);
          f(g, 'a', 'b', false);
        });
        pass('function passed on to multiple calls, can take different types per call, fail case', () => {
          function f(g, x, y, b) {
            if (b) return g(x); // Recognize that g returns input type, so type(x) must equal type(y) to pass
            else return g(y);
          }
          function g(a){ return a; } // Return the input type
          f(g, 1, 1, true);
          f(g, 'a', 'b', false);
          // This makes it fail because type(g('a')) !== type(g(1))
          f(g, 'a', 1, false);
        }, ['POLY_PRIMITIVES']);
      })
      pass('Branches must have same type', () => {
        function f(g, x, y, b) {
          // We don't evaluate the conditions so we don't know here whether or not to apply
          // g(x) or g(y). We have to infer both as an option and leave it at that, even for
          // cases where we might know, like boolean args (can always improve that later).
          // This does mean that the sig must be monomorphic across the entire function.
          if (b) g(x);
          else g(y);
        }
        function g(a){}
        // This is fine
        f(g, 1, 2, true);
        // This is fine too, individual calls can get different types so it's fine to get a number before and string now
        f(g, 'a', 'b', true);
      });
      pass('Branches must have same type (nested functions can also be called polymorphic)', () => {
        function f(g, x, y, b) {
          // We don't evaluate the conditions so we don't know here whether or not to apply
          // g(x) or g(y). We have to infer both as an option and leave it at that, even for
          // cases where we might know, like boolean args (can always improve that later).
          // This does mean that the sig must be monomorphic across the entire function.
          if (b) g(x);
          else g(y);
        }
        function g(a){}
        // This is fine
        f(g, 1, 2, true);
        // This is fine too, individual calls can get different types so it's fine to get a number before and string now
        f(g, 'a', 'b', true);
        // Reject this call because this will cause f to ("potentially", in the generic case) try g(1) and g('a')
        f(g, 1, 'a', true);
      });
    });


    pass('the shape of a binding must always be the same but the type may differ per call', () => {
      // Basically that means a binding must always have certain properties as they are used in a function
      // but they don't necessarily have to have the same type for each call.
      function f(a) {
        return a.toString;
      }
      // TBD if the return type must match, but I don't think so? Otoh the func arg is part of the shape so there's that
      f(1); // maybe this should be 'true' or something
      f('a');
    });

    pass('the infer lock mechanisms on functions we know better', () => {
      function f(a) {
        function g(a) {
          Array(a);
          Array(1);
        }
        g(a);
      }
      f(3);
      f('a');
    });

    pass('nested func calls mach 2', () => {
      function f(a) {
        function g(x) {}
        g(1);
        g(a);
      }
      // Each call to f will cause the system to run through g with two inputs
      // In the future we can probably cache static calls, although they'll probably be rare
      // This may cause a bit of an explosion of the world model but we can try it first at least, who knows
      // We'll probably run into a snag with circular / recursive references. Hopefully type hashing will save us :)
      f(1);
      f('a');
      // (fyi: future is now. this works)
    });



    group('perhaps its just inherit stuff', () => {
      pass('simple case of inherited callable with one builtin', () => {
        // skipped in v3: has not yet decided on how to deal with builtin rest behavior but i'm pretty sure merging .push with an a simple function without rest should be invalid. did this test try to test something else? should it pass?
        // Simple builtin case
        let f = [].push;
        // This can't fail immediately because g can be anything, although it at least has to be callable
        f = g;
        function g(a){}
      }, ['POLY_BUILTIN_ARRAY']);

      pass('indirect case of callable assignment with inheritance', () => {
        // skipped v3: has not yet decided on how to deal with builtin rest behavior but i'm pretty sure merging .push with an a simple function without rest should be invalid. did this test try to test something else? should it pass?
        // Simple builtin case
        let f = [].push;
        // g can eventually be tracked down to function h, but there's resolution to happen first
        let g = h;
        f = g;
        function h(a){}
      }, ['POLY_BUILTIN_ARRAY']);
    });




    pass('transitivity', () => {
      let x = f;
      x = g;
      x = h;
      function f(){}
      function g(){}
      function h(){}
    }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX', 'FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);

    pass('transitivity in a func', () => {
      function f(a){
        function g(b){
          b = g
        }
      }
      function g(){}
      f(function(){});
    });
  });

  group('poly returns', () => {
    pass('function returning arg called twice with numbers', () => {
      function f(a) {
        return a;
      }
      f(1) === 8;
      f(2) === 8;
    });

    pass('function returning arg called twice with strings', () => {
      function f(a) {
        return a;
      }
      f('a') === 'x';
      f('a') === 'x';
    });

    pass('function returning arg called with string then number', () => {
      function f(a) {
        return a;
      }
      f('a') === 'x';
      f(1) === 8;
    });

    pass('function returning arg called with number then string', () => {
      function f(a) {
        return a;
      }
      f(1) === 8;
      f('a') === 'x';
    });
  });

  pass('passing on the same function twice should not cause a problem when shadowing', () => {
    function f() {}
    function g(a, b) {}
    g(f, f);
  });

  group('memoize does not care about calling scope', () => {
    pass('call a local function from inside and outside its defining scope, pass', () => {
      function f() {
        function g() {
          return 1;
        }
        g() === 10;
        return g;
      }

      f()() === 10;
    });

    pass('call a local function from inside and outside its defining scope, fail 1', () => {
      function f() {
        function g() {
          return 1;
        }
        g() === 'x';
        return g;
      }

      f()() === 10;
    }, ['POLY_PRIMITIVES']);

    pass('call a local function from inside and outside its defining scope, fail 2', () => {
      function f() {
        function g() {
          return 1;
        }
        g() === 10;
        return g;
      }

      f()() === 'x';
    }, ['POLY_PRIMITIVES']);
  });

  group('calling functions', () => {
    pass('call a method', () => {
      let x = {
        f(){ return 1; },
      };
      x.f();
    });

    pass('call a bool', () => {
      let x = {
        f: true,
      };
      x.f();
    }, ['CALLED_UNCALLABLE']);

    pass('call inherited toString', () => {
      function f(){ return x.toString(); }
      let x = {};
    });

    pass('actually call inherited toString', () => {
      function f(){ return x.toString(); }
      let x = {};
      f();
    });

    pass('unknown whether x has own property toString or inherited only', () => {
      function f(){ return x.toString(); }
      let x = function(){};
    });

    pass('(actually call) unknown whether x has own property toString or inherited only', () => {
      function f(){ return x.toString(); }
      let x = function(){};
      f();
    });

    group('tostring arg', () => {
      pass('number does accept a number, object does not, but its fine', () => {
        function f(){ return x.toString(16); }
        let x = {};
      });
      pass('(actually call) number does accept a number, object does not, but its fine', () => {
        function f(){ return x.toString(16); }
        let x = {};
        f();
      }, ['BUILTIN_ARG1_TMI']);
      pass('number does accept a number', () => {
        function f(){ return x.toString(16); }
        let x = 15;
      });
      pass('(actually call) number does accept a number', () => {
        function f(){ return x.toString(16); }
        let x = 15;
        f();
      });
    });
  });

  group('expandos', () => {
    pass('closure problems with func expandos, inner func', () => {
      function g(a) {
        function f(){}
        f.x = a;
      }
      g(1);
      g('x'); // if `f` doesn't get properly shadowed then this will fail
    }, ['SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP']);

    pass('closure problems with func expandos, passing on a func', () => {
      function f(){}
      function g(func, a) {
        func.x = a;
      }
      g(f, 1);
      g(f, 'x'); // if `f` is passed by reference so the system should detect the poly
    }, ['SET_NEW_UNSEEN_PROP', 'POLY_PRIMITIVES']);
  });

  group('trojan horsing', () => {
    pass('returning a value that was passed in should not duplicate the reference', () => {
      // This was failing in v4 because the digest was not making a distinction between the object in the first and
      // second call. And because the object had an instance id from before the call, it would not clone the cached
      // result, meaning it would always return the uncloned version of the first call. Had to update the digest to
      // include the iid to fix it.

      function f(a) {
        return a;
      }

      let a = f({})
      let b = f({})

      a.foo = 'x';
      b.foo === 'x' // this should issue a POLY (!)
    }, ['SET_NEW_UNSEEN_PROP', 'PROP_NOT_FOUND', 'POLY_PRIMITIVES']);

    pass('trojan horsing, an arg in the simple way', () => {
      // input is returned. the cache should check whether the input was returned, and if so, not clone that but
      // return the same value that's passed on as an arg or context (or part of either)
      function f(a) {
        return a;
      }

      let a = f({})
      let b = f({})
      a.foo = 'x';
      b.foo === 'x'; // b != a so this should poly
    }, ['SET_NEW_UNSEEN_PROP', 'PROP_NOT_FOUND', 'POLY_PRIMITIVES']);

    pass('trojan horsing, returning part of an arg', () => {
      // in this case input is returned as part of the returned object. when cloning this will be realized and
      // it will not clone. as before, it should figure out where the reference came from and funnel it through
      // from the current call (not the cached call), while still cloning the rest
      function g(a) {
        return {a};
      }

      let a = g({})
      let b = g({})
      a.foo = 'x';
      b.foo === 'x'; // b != a so this should poly
    }, ['SET_NEW_UNSEEN_PROP', 'PROP_NOT_FOUND', 'POLY_PRIMITIVES']);

    pass('trojan horsing, part of an arg as a part of the return value', () => {
      // similar to before, the returned value contains a part that is a part of the input. This exemplifies
      // the potential complexity in doing these lookups.
      function h(a) {
        return {b: a.b};
      }

      let a = h({b: {}})
      let b = h({b: {}})
      a.foo = 'x';
      b.foo === 'x'; // b != a so this should poly
    }, ['SET_NEW_UNSEEN_PROP', 'PROP_NOT_FOUND', 'POLY_PRIMITIVES']);

    pass('trojan horsing, a closure in the simple way', () => {
      let a = {};
      function f(a) {
        return a;
      }

      let b = f(a)
      let c = f(a)
      b.foo = 'x';
      c.foo === 'x'; // a==b==c so should pass
    }, ['SET_NEW_UNSEEN_PROP']);

    pass('trojan horsing, returning a closure as part of the return type', () => {
      let a = {};
      function g() {
        return {a};
      }

      let b = g()
      let c = g()
      b.a.foo = 'x';
      c.a.foo === 'x'; // a===b.a===c.a so should be ok
    }, ['SET_NEW_UNSEEN_PROP']);

    pass('trojan horsing, part of a closure as a part of the return value', () => {
      let a = {b: {}}
      function h() {
        return {b: a.b};
      }

      let b = h()
      let c = h()
      b.b.foo = 'x';
      c.b.foo === 'x'; // a === b.b === c.b so should be ok
    }, ['SET_NEW_UNSEEN_PROP']);
  });
});
