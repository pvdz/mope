import {pass, only, skip, group} from '../utils.mjs';

export const closure = () => group('closure', () => {

  group('legacy tests to sort and verify', () => {

    pass('inner closure', () => {
      function f(y){
        let x = y;
        function g() {}
        g();
      }
      f(1);
    });
    pass('closure typing should work', () => {
      // x should be known when replaying the call to g
      function f(y){
        let x = y;
        function g(z) {
          return z;
        }
        g(x);
      }
      f(1);
    });
    pass('smallest closure test case that fails', () => {
      // scope id = 0
      function f($a){
        function g($b) {
          function t($c) {}
          t($b);
        }
        g($a);
      }
      f(100);
    });
    pass('simple closures passing', () => {
      function A(outer_arg){
        let local_var = outer_arg
        function B(b_arg_1, b_arg_2) {
          // this is called 4x;
          // z = string, zz = string (through g)
          // z = string, zz = string (through h)
          // z = number, zz = number (through g)
          // z = number, zz = number (through h)
          b_arg_1 === b_arg_2;
        }
        function C(c_arg) {
          B(local_var, c_arg); // mmmmmmm, halp
        }
        function D(d_arg) {
          B(local_var, d_arg); // mmmmmmm, halp
        }

        C(local_var);
        D(local_var);
      }
      A('x');
      A(1);
    });
    pass('simple example of closure (passing)', () => {
      // scope id = 0
      function f(x){
        function g(y) {
          return x === y;
        }
        g('a');
        g('b');
      }
      f('x');
      f('y');
    });
    pass('simpler example of closure (failing)', () => {
      function f(x){
        function g(y) {
          return x === y; // POLY_PRIMITIVES; 'a' !== 1
        }
        g('a');
      }
      f(1);
    }, ['POLY_PRIMITIVES']);
    pass('simple example of closure (failing)', () => {
      function f(x){
        function g(y) {
          return x === y; // POLY_PRIMITIVES
        }
        g('a');
        g('b');
      }
      f('x');
      f(1);
    }, ['POLY_PRIMITIVES']);
    pass('simple example of return binding', () => {
      function f(a) {
        return a; // return node should bind dynamically to a per call
      }
      f(1) === 1;
      f('a') === 'a';
    });
    pass('simple closures failing', () => {
      // scope id = 0
      function f(y){
        let x = y // has a baseline tid which has a lexical scope-id and is cloned for each call-id
        // scope id = 0-1, call-id = A
        function g() {
          // scope id = 0-1-2
          t(x, 'a'); // mmmmmmm, halp
        }
        function h() {
          // scope id = 0-1-3
          t(x, 'b'); // mmmmmmm, halp
        }
        function t(z, zz) {
          // scope id = 0-1-4
          // this is called 3x;
          // z = string, zz = string (through g)
          // z = string, zz = string (through h)
          // z = number, zz = string (through g) // crash
          z === zz;
        }
        // when walking this function in ast but when replaying x would be a clone. it should queue a call and pass on the current scope-id context and call-id so they can pair
        g(); // [g, [x], 0-1], creates z' with replay params scope-id=0-1
        h();
      }
      f('x'); // [f, ['x'], 0], creates y' g' h' t' with replay params scope-id=0 and call-id=0
      f(1); // [f, [1], 0], creates y' g' h' t' with replay params scope-id=0 and call-id=1
    }, ['POLY_PRIMITIVES']);




    pass('closures and func calls, named func expr', () => {
      // What if we have a function that returns a closure
      // then calling that returned function from a different
      // depth will not allow us to propagate the call stack depth etc.
      function f(z){
        let x = z;
        return function(){ return x; }
      }
      // When f is called it will clone fg to the current call-id and return
      // that tid. So when that gets called it should still have the call-id
      // reference to make sure that the references it looks up resolve to
      // the proper closure var reference.
      f(1)() === 1;
      f("a")() === 'a';
    });

    pass('closures and func calls, anon func expr', () => {
      // What if we have a function that returns a closure
      // then calling that returned function from a different
      // depth will not allow us to propagate the call stack depth etc.
      function f(z){
        let x = z;
        return function(){ return x; }
      }
      // When f is called it will clone fg to the current call-id and return
      // that tid. So when that gets called it should still have the call-id
      // reference to make sure that the references it looks up resolve to
      // the proper closure var reference.
      // But what if the function has no id to clone? Do we create an id of
      // our own anyways? Something underwater to proc the cloning process?
      f(1)() === 1;
      f("a")() === 'a';
    });

    group('v2 model function stuff', () => {

      pass('Should be able to call closures with any types if they don\'t use the arg anyways', () => {
        function f(cb, x, y) {
          cb(x);
          cb(y);
        }
        function g(a){}
        f(g, 'a', 'b');
        f(g, 1, 'a');
      });
      pass('Should be able to call closures with any types and return it', () => {
        function f(cb, x, y) {
          cb(x);
          cb(y);
        }
        function g(a){ return a; }
        f(g, 'a', 'b');
        f(g, 1, 'a');
      });
      pass('polymorphic branches test should fail when taking return type into account', () => {
        function f(callback, x, y, b) {
          let c = callback(x);
          if (b) c = callback(y); // POLY_PRIMITIVES (c=x=y, x=1, y='a')
        }
        function g(a){ return a; }
        f(g, 1, 'a', true);
      }, ['POLY_PRIMITIVES']);
      pass('polymorphic branches test should fail when taking return type into account (memoization case)', () => {
        function f(callback, x, y, b) {
          let c = callback(x);
          if (b) c = callback(y); // the very last global call should cause this to be number=string
        }
        function g(a){ return a; }
        f(g, 1, 2, true);
        f(g, 'a', 'b', true);
        // at this point g cases are memoized for string and number and should still cause trouble here
        f(g, 1, 'a', true);
      }, ['POLY_PRIMITIVES']);
      pass('What if we pass on a poly function arg to another func? (v1)', () => {
        function f(g, x, y, b) {
          if (b) g(x);
          else g(y);
          h(g, x);
        }
        function g(a) {}
        f(g, 1, 2, true);
        f(g, 'a', 'b', true);
        // Now h should have two calls queued with f:g and f:x as type
        // Do they now run all the call args of f through g too? The next test scales this a bit further.
        function h(g, x) { g(x); }
      });
      pass('What if we pass on a poly function arg to another func? (v2, bugged)', () => {
        function A(thisisfuncb, arg1, arg2) {
          function C(unused) {
            // and then B will call arg1(arg2), and should fail.
            return thisisfuncb(arg1, arg2);
          }
          return C(arg1 + arg2);
        }
        A(B, 1, 2);
        A(B, 'a', 'b');
        // H is called with f:a f:b and g:c. In turn, g has a number cached.
        function B(g, x) { g(x); }
      }, ['CALLED_UNCALLABLE', 'CALLED_UNCALLABLE']);

      pass('super simple two pingpong', () => {
        function A(closureB) { closureB(A); }
        function B(closureA) { closureA(B); }
        A(B);
      });

      pass('two pingpong with bad arg count', () => {
        function g(hprime) { hprime(g); }
        function h(gprime) { gprime(); } // fail
        g(h);
      }, ['CALL_ARG_ARITY', 'CALLED_UNCALLABLE']);

      pass('What if we pass on a poly function arg to another func? (v2-2, fixed)', () => {
        function f(hprime) {
          // tid=4
          // suid=2
          // global ## global.4(<22:global>)
          function g() {
            // tid=11
            // suid=3
            // suid=5
            // global ## global.4(<22:global>) ## global.11()
            // global ## global.11()
            hprime(g);
          }
          g();
        }
        function h(gprime) {
          // tid=22
          // suid=4
          // gprime is a closure without args that'll cal h again with the same arg
          // global ## global.22(<11:global ## global.4(<22:global>)>)
          gprime();
        }
        // global
        f(h);
      });
      pass('What if we pass on a poly function arg to another func? (v2-1, fixed)', () => {
        function f(hprime) {
          function g() {
            return hprime(g);
          }
          return g();
        }
        f(h);
        function h(gprime) { gprime(); }
      });

      pass('What if we pass on a poly function arg to another func? (v2, fixed)', () => {
        function f(h, a, b) {
          function g(c) {
            return h(g, c);
          }
          return g(a + b);
        }
        f(h, 1, 2);
        f(h, 'a', 'b');
        // H is called with f:a f:b and g:c. In turn, g has a number cached.
        function h(gprime, x) { gprime(x); }
      });
    });





    pass('should global functions also infer lock the arg type?', () => {
      function f(a, b) {
        g(a, b);
        // How is this different than a function that is called from global with different args?
        // So why would it lock down 'a' to be a number?
        // And why would this case be different when g is a local function?
        g(1, b);
      }
      function g(a, b) { return a + b; }
      f(1, 2);
    });






    pass('closure call in different scopes, neither accessible from the other, connecting arg<>param', () => {
      function f(a){
        function g(b){ a === b } // doing 2 === 1
        return g;
      }
      function h(x){
        x(1); // this is g
      }
      h(f(2));
    });

    pass('simpler closured bindings outside of a func are not shadowed in a call to that func so their type must match', () => {
      // call f with number. returns g
      // call h with (the returned) g
      // call x (which is g) with string
      // g will access a with number and b with string. the assignment should reject.

      function f(a){
        function g(b){
          // doing 'pass' === 'pass', should reject with a poly because a is not part
          // of the scope of g and is therefor not shadowed and starts as a number due to f(2)
          a = b;
          // a === b
        }
        return g;
      }
      function h(x){
        x('pass');
      }
      h(f(2));
    }, ['POLY_PRIMITIVES']);

    pass('closured bindings outside of a func are not shadowed in a call to that func so their type must match', () => {
      // call f with number. returns g
      // call h with (the returned) g
      // call x (which is g) with string
      // g will access a with number and b with string. the assignment should reject.

      function f(a){
        function g(b){
          // doing 'pass' === 'pass', should reject with a poly because a is not part
          // of the scope of g and is therefor not shadowed and starts as a number due to f(2)
          a = b;
          // a === b
        }
        return g;
      }
      function h(x){
        x('pass');
      }
      h(f(2));
    }, ['POLY_PRIMITIVES']);

    pass('simpler accessing closure from different scopes (bugged test)', () => {
      // call f with 1 2, retursn g
      // call g, returns boolean (1====2)
      // call r, which is a boolean, fail.
      // (skipping because we currently dont support function polys)

      function f(a, b){
        function g() { return a === b; }
        return g;
      }
      function h(cb) {
        cb();
      }
      let r = f(1, 2)(); // (The system caught this and reported a fail :)
      r(); // calling a boolean?
    }, ['CALLED_UNCALLABLE']);

    pass('accessing closure from different scopes (bugged test)', () => {
      // call f with 1 2, retursn g
      // call g, returns boolean (1====2)
      // call r, which is a boolean, fail.
      // (skipping because we currently dont support function polys)

      function f(a, b){
        function g() { return a === b; }
        return g;
      }
      function h(cb) {
        cb();
      }
      let r = f(1, 2)(); // (The system caught this and reported a fail :)
      r(); // calling a boolean?
      h(r); // AGAIN?
    }, ['CALLED_UNCALLABLE', 'CALLED_UNCALLABLE']);

    pass('accessing closure from different scopes', () => {
      function f(a, b){
        function g() { return a === b; }
        return g;
      }
      function h(cb) {
        cb();
      }
      let r = f(1, 2);
      r();
      h(r);
    });







  });

  pass('calling a function instance inside a function call, simple case', () => {
    function f() {

      function g() {}

      return g();
    }
    f();
  });


  group('simple local closure case', () => {
    pass('simple local closure case; pass', () => {
      function f() {
        const x = 5;
        return function() {
          return x;
        };
      }

      // Calling f returns a function, calling that function returns x
      // The function instance is created in the closure for calling `f` but invoked from global
      // The lookup for the Tee should find the function instance where x still has access to x, not the func from main.
      f()() === 10;
    });

    pass('simple local closure case; fail', () => {
      function f() {
        const x = 5;
        return function() {
          return x;
        }
      }

      // Calling f returns a function, calling that function returns x
      f()() === 'no';
    }, ['POLY_PRIMITIVES']);
  });

  group('simple global closure case', () => {
    pass('simple global closure case; pass', () => {
      const x = 5;
      function f() {
        return function() {
          return x;
        }
      }

      // Calling f returns a function, calling that function returns x
      f()() === 10;
    });

    pass('simple global closure case; fail', () => {
      const x = 5;
      function f() {
        return function() {
          return x;
        }
      }

      // Calling f returns a function, calling that function returns x
      f()() === 'no';
    }, ['POLY_PRIMITIVES']);
  });

  group('local closure shadowing global', () => {
    pass('local closure shadowing global; pass', () => {
      const x = 'ignore me';
      function f() {
        const x = 5;
        return function() {
          return x;
        }
      }

      // Calling f returns a function, calling that function returns x
      f()() === 10;
    });

    pass('local closure shadowing global; fail', () => {
      const x = 'really ignore me';
      function f() {
        const x = 5;
        return function() {
          return x;
        }
      }

      // Calling f returns a function, calling that function returns x
      f()() === 'no';
    }, ['POLY_PRIMITIVES']);
  });

  group('deep closure accessed from higher up', () => {
    pass('confirm the inner func return a string when being explicit', () => {
      function f() {
        function g() {
          function h() {
            function i() {
              return 'foo';
            }
            return i;
          }
          return h(); // This is what f()() ultimately returns
        }
        return g();
      }

      f()() === 10;
    }, ['POLY_PRIMITIVES']);

    pass('confirm the inner func return a string when returning arg directly', () => {
      function theOuterFunction() {
        function theInnerFunction(theArgument) {
          return theArgument;
        }
        return theInnerFunction('arbitrary value'); // This is what f()() ultimately returns
      }

      theOuterFunction() === 10;
    }, ['POLY_PRIMITIVES']);

    pass('a closure wrapping a nested arg and accessed from higher up; pass', () => {
      function f() {
        function g() {
          function h(x) {
            function i() {
              return x;
            }
            return i;
          }
          return h(5); // This is what f()() ultimately returns
        }
        return g();
      }

      f()() === 10;
    });

    pass('an somewhat simpler closure returning a local num; pass', () => {
      function h() {
        const x = 5;
        function i() {
          return x;
        }
        return i;
      }

      h()() === 10;
      h()() === 20; // In some future, this whole statement is a cached result because it is identical to the previous
    });

    pass('an even simpler closure wrapping a nested arg and accessed from higher up; pass', () => {
      function h(x) {
        function i() {
          return x;
        }
        return i;
      }

      h(1)() === 10;
    });

    pass('an somewhat simpler closure wrapping a nested arg and accessed from higher up; pass', () => {
      function h(x) {
        function i() {
          return x;
        }
        return i;
      }

      h(1)() === 10;
      h('x')() === 'y';
    });

    pass('an even simpler closure wrapping a nested arg and accessed from higher up; fail', () => {
      function h(x) {
        function i() {
          return x;
        }
        return i;
      }

      h('x')() === 10;
    }, ['POLY_PRIMITIVES']);

    pass('a simpler closure wrapping a nested arg and accessed from higher up; fail', () => {
      function A() {
        function B(x) {
          function C() {
            return x;
          }
          return C;
        }
        return B('x'); // This is what f()() ultimately returns
      }

      A()() === 10;
    }, ['POLY_PRIMITIVES']);

    pass('a closure wrapping a nested arg and accessed from higher up; fail', () => {
      function f() {
        function g() {
          function h(x) {
            function i() {
              return x;
            }
            return i;
          }
          return h('x'); // This is what f()() ultimately returns
        }
        return g();
      }

      f()() === 10;
    }, ['POLY_PRIMITIVES']);
  });

  group('conceptual problem', () => {
    // (See last case in this test group for details)
    pass('simpler case of func receiving poly func testing string', () => {
      function A(f) {
        let x = f();
        function B() {
          return x.length
        }
        return B;
      }
      const func1 = A(function(){
        return {length: 'foo'};
      });
      func1() === 'x';
    });

    pass('halfwit conceptual problem of a closure being called in its own lexicographical scope, deal with same AST node resolve to different types in same lexicographical scope', () => {
      // This requires recursive support
      function A(f) {
        let x = f();

        function B() {
          return x;
        }

        return B;
      }

      function X(){
        return 'foo';
      }
      function Y(){
        return 123;
      }

      A(X);
      A(Y);
    });

    pass('simpler conceptual problem of a closure being called in its own lexicographical scope, deal with same AST node resolve to different types in same lexicographical scope', () => {
      // This requires recursive support
      function A(f) {
        let x = f();

        function B() {
          return x;
        }

        return B;
      }

      function X(){
        return 'foo';
      }
      function Y(){
        return 123;
      }

      const func1 = A(X);
      const func2 = A(Y);

      func1() === 'xyz';
      func2() === 0;
    });

    pass('double object pass; conceptual problem of a closure being called in its own lexicographical scope, deal with same AST node resolve to different types in same lexicographical scope', () => {
      function A(f) {
        let x = f();

        function B() {
          return x.length
        }

        return B;
      }

      const func1 = A(function(){
        return {length: 'foo'};
      });
      const func2 = A(function(){
        return {length: 5};
      });

      func1() === 'x';
      func2() === 0;
    });

    pass('double object fail; conceptual problem of a closure being called in its own lexicographical scope, deal with same AST node resolve to different types in same lexicographical scope', () => {
      function A(f) {
        let x = f();

        function B() {
          return x.length
        }

        return B;
      }

      const func1 = A(function(){
        return {length: 'foo'};
      });
      const func2 = A(function(){
        return {length: 5};
      });

      func1() === 'x';
      func2() === 'y';
    }, ['POLY_PRIMITIVES']);

    pass('real conceptual problem of a closure being called in its own lexicographical scope, deal with same AST node resolve to different types in same lexicographical scope', () => {
      // This requires recursive support
      function A(f) {
        let x = f();

        function B() {
          return x.length
        }

        return B;
      }

      const func1 = A(function(){
        return {length: 'foo'};
      });
      const func2 = A(func1); // this calls func1() !

      // The first call will set x to the object. The returned function, func1, will return obj.length, which is 'foo'
      func1() === 'x'; // (!!!) this is the _same_ func1() call (!!!)
      // The second call will pass on func1, which returns 'foo', and return func2 which returns 'foo'.length: 3
      func2() === 0;
      // The point is that r gets called (as f) in the second call om the same lexicographical position as it was (in a
      // previous call) instantiated. But both instances of r will have access to an x with different type; the first
      // is an object and the second is a string. The system should properly resolve the closures and return the proper
      // types for each respective call, regardless of where it is called.
      // Since `func2()` returns 3, this should pass.
    });

    pass('looping conceptual problem of a closure being called in its own lexicographical scope, deal with same AST node resolve to different types in same lexicographical scope', () => {
      // This requires recursive support
      function A(f) {
        let x = f();

        function B() {
          return x.length
        }

        return B;
      }

      const func1 = A(function(){
        return {length: 'foo'};
      });
      func1() === 'x';

      let func2 = A(func1);
      while (false) {
        func2() === 0;
        func2 = A(func2); // This is poly because func1 is a different arg (different digest) than func2 and it'll be hard to merge closures
      }
    }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);

    pass('simpler merging functions with closures, fail', () => {
      // This requires recursive support
      function A(f) {
        let x = f();

        function B() {
          return x.length
        }

        return B;
      }
      function C() {
        return {length: 'foo'};
      }

      const func1 = A(C);     // call C which returns B which would return obj.length which returns a string
      const func2 = A(func1); // call func1 (B) which returns B which would return B.length which returns a number

      // 'foo' === 0
      func1() === func2()
    }, ['POLY_PRIMITIVES']);

    pass('(broken) simpler merging functions with closures, pass', () => {
      // This test is flawed.
      // - A(C) returns B closing over x where x is the object {length:500}
      // - A(func1) returns B closing over x where x is the length of B (not B itself)
      // - the final two calls will try to get the length from the object (500) and the number (undefined) so it fails
      // - hence the lint warning, too

      // This requires recursive support
      function A(f) {
        let x = f(); // The second time A is called f==B so this line calls B and returns a number.

        function B() {
          return x.length
        }

        return B;
      }
      function C() {
        return {length: 500};
      }

      const func1 = A(C);     // call C which returns B which would return obj.length which returns a number
      const func2 = A(func1); // call func1 (B) returns B which would return 0..length which is undefined

      // 500 === 0
      func1() === func2() // func2() returns 0..length so it emits a lint error and return undefined
    }, ['PROP_NOT_FOUND', 'POLY_PRIMITIVES']);

    pass('merging functions with closures; fail', () => {
      // v4: this is no longer supported
      // This requires recursive support
      function A(f) {
        let x = f();

        function B() {
          return x.length
        }

        return B;
      }

      const func1 = A(function(){
        return {length: 'foo'};
      });
      const func2 = A(func1);

      function C(D) {
        // Should this run through func1 and func2? Because they return different types (number / string) and we won't
        // know this until we actually replay them.
        // Maybe that's ... fine?
        // The funcis can get merged. If func2 never gets invoked, that's ok, too

        // This only returns string, since that's what func1 returns
        return D();
      }
      C(func1) === 'foo'; // only returns string since that's what func1 returns
      C(func2) === 'foo'; // only returns number since that's what func2 returns
    }, ['POLY_PRIMITIVES']);

    pass('merging functions with closures; pass', () => {
      // This requires recursive support
      function A(f) {
        let x = f();

        function B() {
          return x.length
        }

        return B;
      }

      const func1 = A(function(){
        return {length: 'foo'};
      });
      const func2 = A(func1);

      function C(D) {
        // Should this run through func1 and func2? Because they return different types (number / string) and we won't
        // know this until we actually replay them.
        // Maybe that's ... fine?
        // The funcis can get merged. If func2 never gets invoked, that's ok, too

        // This only returns string, since that's what func1 returns
        return D();
      }
      C(func1) === 'foo'; // only returns string since that's what func1 returns
      C(func2) === 20;    // only returns number since that's what func2 returns
    });
    pass('merging functions with closures does not call all functions for all worlds', () => {
      // This requires recursive support
      function A(f) {
        let x = f();

        function B() {
          return x.length
        }

        return B;
      }

      const func1 = A(function(){
        return {length: 'foo'};
      });
      const func2 = A(func1);

      function C(D) {
        // Should this run through func1 and func2? Because they return different types (number / string) and we won't
        // know this until we actually replay them.
        // Maybe that's ... fine?
        // The funcis can get merged. If func2 never gets invoked, that's ok, too
        return D();
      }
      C(func1);
    });

    pass('if two functions explicitly return a different primitive then they cant be merged', () => {
      function A() {
        return 'x';
      }
      function B() {
        return 1;
      }
      A === B // fail?
    }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);

    pass('if two functions explicitly cast their param to a different primitive then they cant be merged', () => {
      // skip: merging functions
      function A(x) {
        x === 'x';
      }
      function B(y) {
        y === 1;
      }
      A === B // fail?
    }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);

    pass('detecting indirect casting of params in phase2', () => {
      // skip: merging functions
      function A(x) {
        function C() {
          x === 'x';
        }
        return C();
      }

      function B(y) {
        function D() {
          y === 1;
        }
        return D();
      }

      // A.x is forced to string while B.y is forced to number and so at this point the funcos will be merged and fail
      A === B
    }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);

    pass('detecting indirect casting of params in after calling', () => {
      function A(x) {
        function C() {
          x === 'x';
        }
        return C();
      }

      function B(y) {
        function D() {
          y === 1;
        }
        return D();
      }

      // Cast the params
      A('foo');
      B(53);

      // This was already going to be a problem without the previous calls :)
      A === B
    }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);

    pass('would detect incompatible indirect castings ultimately', () => {
      function A(x) {
        function C() {
          x === 'x';
        }
        return C();
      }

      function B(y) {
        function D() {
          y === 1;
        }
        return D();
      }

      function E(func) {
        func('x')
      }
      A === B // fine (although we know this is `false`, so there's that)
      E(A); // pass
      E(B); // fail
    }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX', 'POLY_PRIMITIVES']);
  });
});
