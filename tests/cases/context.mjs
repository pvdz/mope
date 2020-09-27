import {pass, only, skip, group} from '../utils.mjs';

export const context = () => group('context', () => {
  group('base', () => {
    pass('access a property on this, without call', () => {
      function f() {
        return this.foo;
      }
    });

    pass('access a property on this, called', () => {
      function f() {
        return this.foo;
      }
      f(); // implicit context is undefined in strict mode
    }, ['CONTEXT_MISSING', 'PROP_ON_NULL_UNDEF']);

    pass('create a method, uncalled', () => {
      let obj = {
        foo: 10,
        m() { return this.foo; },
      };
    });

    pass('create a method, called', () => {
      let obj = {
        foo: 10,
        m() { return this.foo; },
      };

      obj.m()
    });

    pass('create a method, checked, pass', () => {
      let obj = {
        foo: 10,
        m() { return this.foo; },
      };

      obj.m() === 200;
    });

    pass('create a method, checked, fail', () => {
      let obj = {
        foo: 10,
        m() { return this.foo; },
      };

      obj.m() === 'nope';
    }, ['POLY_PRIMITIVES']);
  });

  group('this properties in same function', () => {
    pass('this properties in same function, uncalled pass', () => {
      function f() {
        this.x === 2;
        return this.x;
      }
    });
    pass('this properties in same function, uncalled fail', () => {
      function f() {
        this.x === 2;
        this.x === 'x';
      }
    });

    pass('this properties in same function, called pass', () => {
      function f() {
        this.x === 2;
        return this.x;
      }

      f.call({x: 1});
    });
    pass('this properties in same function, called fail', () => {
      function f() {
        this.x === 2;
        this.x === 'x';
      }

      f.call({x: 1});
    }, ['POLY_PRIMITIVES']);
});


  group('legacy tests to sort and verify', () => {
    group('old model', () => {
      pass('modeling context simple', () => {
        function f() {
          return this.foo;
        }
        let a = {foo: 1, f};
      });
      pass('modeling context real test', () => {
        function f() {
          return this.foo;
        }
        let a = {foo: 1, f};
        a.f() === 1;
      });
      pass('modeling context counter test', () => {
        function f() {
          return this.foo;
        }
        let a = {foo: 1, f};
        a.f() === 'failure';
      }, ['POLY_PRIMITIVES']);
      pass('modeling context less simple', () => {

        /*
        We have to figure out how to model the "this" keyword without having to tie it down... so like "this.x" can be
        a string and a number and should still be fine (monomorphism would be enforced when using the value in any capacity)
        As soon as you do "let x = this.foo", x is tied to the indirect type determined by "this". That state is local to the
        function though. So when f() returns such an x it has to be finalized. Until that time, it's a bit of a black box.
        Consider it for Array#pop, which has to return the same type for the same context but can return different types for
        different contexts (different arrays).
        This does introduce some implicit, deferred, polymorphism into the system because this kind of poly can run deep. That
        said any referenced functions must still have the same arguments so it's not like this would be allowed;
        "function f(a) { return a + 1; } function g(){ f(this.foo); } g.call({foo: 1}); g.call({foo: 'a'});"
        Although I accidentally made a version where it might be okay. Which is an interesting question by itself; should the
        valuesouterFunction scope enforces it?
        Back to the actual example, using * or % the function f would always need to get a number so this.foo could never be
        a string. Unfortunately that doesn't solve the model completely just yet.



        Ok. Skip to next day (above). We keep having the problem if we consider a polyfill of Map. It has the same library code that
        stores data in the same way. And even if the actual data as key or value is the same per object, it's the library
        code handling different types and rejecting as poly. For the same reason that Map#set wouldn't be able to be poly
        for "a.set("foo", "bar"); b.set(1, 2);", likewise wouldn't a generic Map polyfill be able to do this.

        In other words. I'm screwed. I must have a form of poly for builtins and library work, if nothing else.
        */

        function f() {
          return this.foo;
        }
        let a = {foo: 123, f};
        a = {foo: 'a', f}; // poly because a.foo is seen as string and number now
      }, ['POLY_PRIMITIVES']);
    });

    pass('obj in func getting poly type', () => {
      function f(x) {
        return {x};
      }
      f(1);
      f('a');
    });
    pass('obj in func getting poly type with access, pass regular prop', () => {
      function f(r) {
        return {x: r};
      }
      f(1).x === 2;
      f('a').x === 'b';
    });
    pass('obj in func getting poly type with access, pass shorthand', () => {
      function f(x) {
        return {x};
      }
      f(1).x === 2;
      f('a').x === 'b';
    });
    pass('conceptual check first: obj in func getting poly type with access, fail', () => {
      function f(x) {
        return {x};
      }
      // f(1).x === 2;
      f('a').x === 2; // make sure this fails regardless
    }, ['POLY_PRIMITIVES']);
    pass('obj in func getting poly type with access, fail', () => {
      function f(x) {
        return {x};
      }
      f(1).x === 2;
      f('a').x === 2; // provided the above doesn't leak, this should still fail. if the above leaks, this wont fail.
    }, ['POLY_PRIMITIVES']);

    pass('first steps of context (with simple props) except the test is broken :(', () => {
      // todo: if two funcs have the same body in the same scope etc then they are the same?
      // (this test was written at a time where it was not assumed all types were resolved at call time)
      let a = {x: 123, f(){ this.x; }};
      let b = {x: 'a', f(){ this.x; }};

      // Tell the system a.f and b.f have the same sig
      let f = a.f;
      f = b.f;
      // This test is "broken" because the functions return undefined. That should make the next two lines throw poly.
      a.f() === 132;
      b.f() === 'a';
    }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX', 'POLY_PRIMITIVES', 'POLY_PRIMITIVES']);

    pass('first steps of context (with simple props), with functions returning it', () => {
      // todo: if two functions have the same body in the same scope they are the same?
      // (this test was written at a time where it was not assumed all types were resolved at call time)
      let a = {x: 123, f(){ return this.x; }};
      let b = {x: 'a', f(){ return this.x; }};

      // Tell the system a.f and b.f have the same sig
      let f = a.f;
      f = b.f;
      // This is fine because the merge only merges funco stuff, meaning stuff that is resolved to a type before they
      // can get shadowed. Since neither params nor return type gets shadowed, and context is not bound, this is fine.
      a.f() === 132;
      b.f() === 'a'; // *boom*
    }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);

    group('returning this values', () => {
      pass('matching function prints with variable return type', () => {
        // Note: this test was written when the model did not assume yet that all types must be resolved at call time
        let a = {x: 123, f(){ return this.x; }};
        // explicitly say b.f=a.f, probably easy if the base case passes
        let b = {x: 'a', f: a.f};

        let f = a.f;
        f = b.f;
        a.f() === 132;
        b.f() === 'a'; // *boom*
      });
      pass('matching function prints with fixed return type', () => {
        // Note: this test was written when the model did not assume yet that all types must be resolved at call time
        let a = {x: 123, f(){ a.x; }};
        // similar case to above except a.f always returns a.x, so this should be marked as poly because of b.f()==='a'
        let b = {x: 'a', f: a.f};

        let f = a.f;
        f = b.f;
        a.f() === 132;
        b.f() === 'a'; // *boom*
      }, ['POLY_PRIMITIVES', 'POLY_PRIMITIVES']);

      pass('can call a function with different context shapes', () => {
        let a = {x: 1};
        let b = {x: 'a'};
        function f(){ return this.x; } // the 'this' causes the tid to be indirect, a lookup per call site
        f.call(a);
        f.call(b);
      });

      pass('first steps of context (with actual array), pass', () => {
        // Note: this test was written when the system did not assume all tids had to be resolved at call time
        // Now show the system that a.pop and b.pop are actually Array#pop ...
        let a = {arr: [123], pop(){ return this.arr.pop(); }};
        let b = {arr: [456], pop(){ return this.arr.pop(); }};


        // Tell the system a.pop and b.pop have the same sig
        let pop = a.pop;
        pop = b.pop;
        // Here we tell what we expect a.pop and b.pop to return
        // This should cause a poly detection because a.pop and b.pop were supposed to have the same sig
        a.pop() === 132;
        b.pop() === 789
      }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX', 'ARRAY_POP_UNDERFLOW']);

      pass('first steps of context (with actual array), fail', () => {
        // Note: this test was written when the system did not assume all tids had to be resolved at call time
        // Now show the system that a.pop and b.pop are actually Array#pop ...
        let a = {arr: [123], pop(){ return this.arr.pop(); }};
        let b = {arr: ['a'], pop(){ return this.arr.pop(); }};


        // Tell the system a.pop and b.pop have the same sig
        let pop = a.pop;
        pop = b.pop;
        // Here we tell what we expect a.pop and b.pop to return
        // This should cause a poly detection because a.pop and b.pop were supposed to have the same sig
        a.pop() === 132;
        b.pop() === 'a';
      }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX', 'ARRAY_POP_UNDERFLOW', 'ARRAY_POP_UNDERFLOW']);
    });

  });
});
