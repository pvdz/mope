import {pass, only, skip, group} from '../utils.mjs';

export const recursion = () => group('recursion', () => {
  group('some legacy recursion tests', () => {
    pass('infinite recursion', () => {
      f();
      function f(){ f(); }
    });
    pass('(un)conditional infinite recursion', () => {
      f();
      function f(){ if (true) f(); }
    });
    pass('chicken egg recursion', () => {
      // Have to figure out a generic way of discovering infinite recursion
      f();
      function f(){
        // can never determine the type of this return... maybe that's by design
        return f();
      }
    });

    pass('polymorphic recursion', () => {
      function f(a){
        if (false) return f(a);
        return a;
      }
      f(1);
    });
    pass('memoization cannot simply manually process the end because the recursion may not be the last call', () => {
      f(1);
      function f(x){
        f(1);
        f(1);
        return x;
      }
    });
    pass('dead code infi recursion', () => {
      f();
      function f(){
        if (false) return 3;
        else return f();
      }
    });
    pass('dead code infi recursion v2', () => {
      f();
      function f(){
        if (true) return f();
        else return 3;
      }
    });
    pass('flip flop recursion (dead)', () => {
      let x = f();
      function f(){ return h(); };
      function h(){
        return {a: 0}; // this determines the return type of h() (but since that doesn't happen until after all calls are replayed, this wont be set in the recursion call)
        return f(); // this should assume the return type of previous line (but wont since that merge wont happen)
      };
    });
    pass('flip flop recursion (bad)', () => {
      let x = f();
      function f(){ return h(); };
      function h(){
        return f(); // could technically detect h() somewhere returning some form of object
        return {a: 0};
      };
    });
    pass('dead code recursion should not be a problem', () => {
      let x = f();
      g(x);
      function g(o){ return o.a; }
      function f(){ return h(); };
      function h(){
        return {a: 0};
        return f(); // inifini recursion but dead code so not a problem for real world (inference should not lock up over it either way)
      };
    });
    pass('dead code recursion (with arg) should not be a problem', () => {
      let x = f(1, 2, 'a');
      g(x);
      function g(o){ return o.a; }
      function f(a, b, c){ return h(); };
      function h(){
        return {a: 0};
        return f(1, 2, 'a');
      };
    });
  });

  pass('recursion much?', () => {
    function f(x){ g(x); }
    // Remember; on a generic level we cant determine whether the recursion ends since we dont evaluate the args and
    // because of this thing called the halting problem.
    function g(x){ f(x); }
    // So what's queued now? Unresolveable type?
    f(1); // And now?
    f('a'); // And now?
    // I guess we can somehow hash the types so we can compare them
  });

  pass('weird recursive function I dont even know if this should work at all', () => {
    function f(g){
      return g(f);
    }
    f(f);
  });

  group('merging funcs', () => {
    pass('inner to outer recursion or loop or whatever', () => {
      let f = function(a){
        function g() {
          function h() {
            f = function(b){};
          }
        }
      };
      f(5);
    });
    pass('inner to outer recursion or loop or whatever (counter case)', () => {
      // skip: v4 func merge
      let f = function(a){
        function g() {
          function h() {
            f = function(){}; // wrong arity
          }
          h();
        }
        g();
      };
      f(5);
    }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);
    pass('or the more common lazy instantiation pattern', () => {
      // skip: v4 func merge
      let f = function(x) {
        f = x ? function(x){ return x; } : function(x){ return x; };
        return f(x); // we have to run three checks for this one; the recursion and the two funcs above
      };
      f(true);
      f(false);
    }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX', 'FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);
    pass('the lazy pattern must not be poly', () => {
      // skip: v4 func merge
      let f = function(x) {
        f = x > 1 ? function(x){ return x; } : function(x){ return 5; };
        return f(x);
      };
      f(1);
      f(2);
    }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX', 'FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);
    pass('the lazy pattern must not be poly (counter test 1)', () => {
      // skip: v4 func merge
      let f = function(x) {
        f = x > 1 ? function(x){ return x; } : function(x){ return 'oops'; };
        return f(x);
      };
      f(1);
      f(2);
    }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX', 'FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);
    pass('the lazy pattern must not be poly (counter test 2)', () => {
      // skip: v4 func merge
      let f = function(x) {
        f = x ? function(x){ return x; } : function(x){ return 5; };
        return f(x);
      };
      f(true);
      f(false);
    }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX', 'FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);
  });

  pass('an uncalled function calling itself should not crash', () => {
    function f() {
      f();
    }
  });

  pass('an function calling itself should not crash', () => {
    function f() {
      f();
    }
    f();
  });

  skip('recursive object structure', () => {
    // skip: the choice was not to make this work for v4

    // Have to make a choice. Either objects are all different due to object reference or they are the same but then
    // we can't track forward updating properties that happen afterwards.

    A();

    function A(parent) {
      // The first object is "object at x:y with a property parent with value undefined"
      // The second object is "object at x:y with a property parent that is whatever the object was at x:y"
      // Unfortunately every recursive call gets an object that is fresh so the digest is not the same making it harder
      // to detect the recursion.
      A({parent});
    }

    // But the solution also has to maintain the logic for this case... (different test)
    // function f(a) { return a; }
    // let a = f({})
    // let b = f({})
    // a.foo = 'x';
    // a.foo === b.foo // poly
  }, ['CALL_ARG_ARITY']);


  pass('recursive object reference', () => {

    // This is a recursion problem where a fresh object is returned. How would that work in the cache?
    function A(parent) {
      // The first call would create an object {parent: value}
      // The second call would create an object {parent: recur^1} but how would that convey the final value?
      // Inside out? {parent: {parent: {parent: 1}}}
      return {parent};
    }
    A(1);


    // This is the example where the reference matters
    let a = A(1);
    let b = A(1);
    a.foo = 'x'; // SET_NEW_UNSEEN_PROP
    b.foo = 1; // SET_NEW_UNSEEN_PROP This should not be a poly because A returns a fresh object


    // This example shows that the problem may be transitive
    // The same object literal node gets different tyeps for its values so that, by itself at least, is not a safe recursion check
    function B(x) {
      return {x};
    }
    let c = A(B('a'));
    let d = A(B(1));

    // Ok what about the shape of a node from the same origin should be considered equal for the sake of calling funcs?
  }, ['SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP']);

  skip('recursive object with diff', () => {
    // skip: v4 cannot support this

    function make(parent) {
      return {
        parent,
      };
    }

    const a = make(undefined);
    const b = make(undefined); // cached
    a.foo = 'x'; // type(a) !== type(b) because they have different properties
    a.foo === b.foo; // should be poly

    // How would the model know that A(B(A(B(A(B... results in a recursive object structure? The initial call to
    // make will be `make(undefined)` again. Returns a cached (fenced, so fresh) object. But could it just add the
    // origin (and fence?) of the object to the digest to figure out that it's a recursive object? digest-wise?
    A();

    function A(x) {
      // The first object is "object at x:y with a property parent with value null"
      // The second object is "object at x:y with a property parent that is whatever the object was at x:y"
      A(make(x));
    }
  }, ['SET_NEW_UNSEEN_PROP', 'PROP_NOT_FOUND', 'POLY_PRIMITIVES', 'CALL_ARG_ARITY']);

  skip('recursive object structure with augment', () => {
    // skip: v4 cannot support this

    function make(parent) {
      return {
        parent,
      };
    }

    const m = make(undefined);
    m.foo = 1;

    A();

    function A(x) {
      // For the typing the origin of the object shouldn't matter. Not bound to a lexical origin.
      // For recursion, how else can you tell?
      const q = make(x); // Call 1: x=undefined, Call n: x = {parent:<object, with props, with seen, with parent set to ????>}
      if (false) q.foo = 'x'; // The condition shouldn't matter for our model. It'll still set .foo to a string
      A(q);
    }
  }, ['SET_NEW_UNSEEN_PROP', 'CALL_ARG_ARITY', 'SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP']);

  pass('recursive obj that is obvious ', () => {
    A();

    function G(xs) {
      return {xs};
    }

    function A(x) {
      B(x);
    }

    function B(x1) {
      // The first object is "object at x:y with a property parent with value null"
      // The second object is "object at x:y with a property parent that is whatever the object was at x:y"
      // How do you know an object structure is recursive...
      // Position isn't enough because that depends on how the object was initialized, with what values, and what
      // kind of properties it received/will receive.

      const g1 = G(1);
      const g2 = G(1);
      const g3 = G(1);
      const g4 = G(1);

      // Is g1 the same as g2?

      g1.parent = g2;
      g2.parent = g3;
      g3.parent = g4;

      // What about now?

      g4.parent = 1;

      // And now?

      // Regardless, this is final. Recursive function calls would not be.
    }
  }, ['CALL_ARG_ARITY', 'SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP']);

  pass('recursion placeholders being assigned properties', () => {
    A();
    function B(obj) {
      obj.foo = 1; // obj will be a placeholder initially, while the recursion resolves
    }
    function A() {
      let rhsAssignable = A();
      B(rhsAssignable);
    }
  }, ['SET_NEW_UNSEEN_PROP']);

  pass('recursive object property lookup', () => {
    // This case was causing infinite loop

    X({});

    function X(s) {
      let n = {
        parent: s,
      };
      n = n.parent;
      return s;
    }
  });

  pass('infinite loop while merging recursive object structure', () => {
    // This was causing inifinite loop when merging because left and right would try to merge the parent props
    // which would induce merging their props, which meant merging their parnet props, etc.
    let a = {foo: 1};
    a.parent = a;

    let b = {foo: 1};
    b.parent = b;

    // Merge with recursion
    a === b;
  }, ['SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP']);

  group('recursive model getting deep cloned', () => {
    pass('recursive model should be fence cloned properly', () => {
      // The idea of this test is that an object with recursive properties that is returned
      // from a function, should be properly fenceCloned if the function gets called twice.
      // This means that the cycles in the object should also be cycles in the clone, and
      // not separate objects.

      function f() {
        const a = {};
        a.b = {c: a};
        return a;
      }

      f();
      f(); // This should proc a cached call, which will deep fence clone the returned object
    }, ['SET_NEW_UNSEEN_PROP']);

    pass('show that cloned object is indeed cloned', () => {
      function f() {
        const a = {};
        a.b = {c: a};
        return a;
      }

      const a = f();
      const b = f(); // This should proc a cached call, which will deep fence clone the returned object

      a.foo = 'x';
      a.foo === b.foo // should fail
    }, ['SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP', 'PROP_NOT_FOUND', 'POLY_PRIMITIVES']);

    pass('the cycles in the cloned object should be cycles', () => {
      function f() {
        const a = {};
        a.b = {c: a};
        return a;
      }

      const a = f();
      const b = f(); // This should proc a cached call, which will deep fence clone the returned object

      // Original object
      a.foo = 'x';
      a.b.c.foo === a.foo // this should pass because a.b.c === a

      // Do the same on the clone
      b.foo = 'x';
      b.b.c.foo === b.foo // this should pass because a.b.c === a
  }, ['SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP']);
  });

  group('cloning identical twins', () => {
    // Test whether `const a = {}; const b = {x: a, y: a}` clones properly
    pass('just cloning identical twin props', () => {
      function f() {
        const a = {};
        const b = {x: a, y : a};
        return b;
      }

      const a = f();
      const b = f();
    });

    pass('verify twins affect each other', () => {
      function f() {
        const a = {};
        const b = {x: a, y : a};
        return b;
      }

      const a = f();

      a.x.foo = 'x';
      a.x.foo === a.y.foo // should pass
    }, ['SET_NEW_UNSEEN_PROP']);

    pass('verify cloned twins affect each other', () => {
      function f() {
        const a = {};
        const b = {x: a, y : a};
        return b;
      }

      const a = f();
      const b = f();
      // b should be a deep clone but the same should hold as before
      b.x.foo = 'x';
      b.y.foo === 'x' // should pass
    }, ['SET_NEW_UNSEEN_PROP']);

    pass('verify the cloned twins do not affect the original twins', () => {
      function f() {
        const a = {};
        const b = {x: a, y : a};
        return b;
      }

      const a = f();
      const b = f();

      b.x.foo = 'x';
      b.y.foo === 'x' // should pass
      a.x.foo === 'x' // should fail
      a.y.foo === 'x' // should fail
    }, ['SET_NEW_UNSEEN_PROP', 'PROP_NOT_FOUND', 'POLY_PRIMITIVES', 'PROP_NOT_FOUND', 'POLY_PRIMITIVES']);
  });

  pass('cloning an array that contains itself', () => {
    function f() {
      const a = [];
      a.push(a);
      return a;
    }

    f();
    f();
  });

  group('functional recursion problems', () => {
    // This is the case that did in v4. And the end of the project.
    // Fixing this requires changing the digest, which is ridiculously hard to get right for this case.

    skip('func calling into itself with new func', () => {
      // skip: infinite recursive loop in v4
      // The problem with this case is that the new function may have access to a bunch of values that is different
      // for each invocation. So either it would need to sample each scope, recursively, and create a digest for all
      // that, or it has to consider it a new instance every time. The latter is the case right now and that will
      // ignite this call into an infinite loop where the digest sees a new function every time so it doesn't trigger
      // caches.
      function f(g) {
        f(() => {})
      }
      f();
    });

    skip('new calling into new with function as arg', () => {
      // skip: infinite recursive loop in v4
      // The model will treat each function as fresh, causing it to fail to create a recursion breaking digest
      class A {
        constructor(g) {
          new A(() => {});
        }
      }

      new A(() => {});
    });
  });
});
