import {pass, only, skip, group} from '../utils.mjs';

export const v4 = () => group('v4', () => {
  pass('Returning fresh var, as arg to function that assigns number and then fresh var that assigns a string, should be fine', () => {
    function f(x, v) {
      x.v = v;
    }

    function g() {
      return {};
    }

    f(g(), 1);
    f(g(), 'x');
  }, ['SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP']);

  pass('Same object closed over by different funcs that assign different prop, should be poly for sure. This is bad', () => {
    function f() {
      o.x = 1;
    }

    function g() {
      o.x = 'x';
    }

    const o = {};
    f(o);
    g(o);
  }, ['CALL_ARG_ARITY', 'SET_NEW_UNSEEN_PROP', 'CALL_ARG_ARITY', 'POLY_PRIMITIVES']);

  pass('Same object, _passed on_ to different funcs that assign different type to same prop. I think we would want this to poly?', () => {
    function f(a) {
      a.x = 1;
    }

    function g(a) {
      a.x = 'x';
    }

    const o = {};
    f(o);
    g(o);
  }, ['SET_NEW_UNSEEN_PROP', 'POLY_PRIMITIVES']);

  pass('Same object but it is shallow cloned and assigned back to same binding. This is grey area because typing is same but reference is broken so not an error. Do we poly anyways? (Leaning towards yes.)', () => {
    // -> no. assignment to the same binding so same reference so ends up poly
    function f(a) {
      a = {...a};
      a.x = 1;
    }

    function g(a) {
      a = {...a};
      a.x = 'x';
    }

    const o = {};
    f(o);
    g(o);
  }, ['SET_NEW_UNSEEN_PROP', 'POLY_PRIMITIVES']);

  pass('Same object being shallow cloned and assigned to different binding. This is even fuzzier because it already wasn\'t poly and now it\'s not even the same binding. Do we poly? In v3 we would for sure. How do we distinct this case formally?', () => {
    // -> assignment to fresh binding so schedule an init (or whatever) and allow distinction of instances
    function f(a) {
      const b = {...a};
      b.x = 1;
    }

    function g(a) {
      const b = {...a};
      b.x = 'x';
    }

    const o = {};
    f(o);
    g(o);
  }, ['SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP']);

  pass('Same but with object assign, where we can\'t detect this in phase1/2', () => {
    // -> same, proof that this could solve it by checking at runtime
    function f(a) {
      const b = Object.assign({}, a);
      b.x = 1;
    }

    function g(a) {
      const b = Object.assign({}, a);
      b.x = 'x';
    }

    const o = {};
    f(o);
    g(o);
  }, ['SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP']);

  pass('But what about multiple invokations and mixes of object refs? There might not be one object ref to track so how would you still know that o and p both got x assigned twice, but still to poly for p? this would need to resolve in a single invoke() or cache...', () => {
    // - "mutator"? would replay property mutations or something
    // - depends on input ...
    function f(a) {
      a.x = 1;
    }

    function g(a) {
      a.x = 1;
    }

    function h(a) {
      a.x = 'x';
    }

    const o = {};
    f(o);
    g(o);
    const p = {};
    f(p);
    g(p);
    h(p);
  }, ['SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP', 'POLY_PRIMITIVES']);

  pass('functions should maintain input-output delts for the cache. At the end of a function, a snapshot of the input value is compared to a snapshot of the end value and that\'s the trasnformation that will be applied to all inputs of that kind', () => {
    // the references will play a relevant role as to what part of the modification is returned to the caller. I think we want to mimic JS and so objects are passed on by reference so any changes are too.
    // this is where binding initializations can play a role in receiving a different reference, where mutations are not shared with the inputs.
    function f(a) {
      a.b = 10;
      a.b = {x: 10};
      a.b.x
    }

    f({b: 1});
    f({b: {x: 1}});
  }, ['POLY_PRIMITIVES', 'PROP_NOT_FOUND', 'POLY_PRIMITIVES', 'POLY_PRIMITIVES']);

  skip('When f gets replayed for the second time it merely replays the transformations on the inputs and yields the return value, if any. considering the same inputs, it should not require a replay just to get to the same outputs', () => {
    // skip: this replay doesn't work properly
    function f(a) {
      a.b = 10;
    }

    f({});
    const x = {};
    f(x);
    x.b === 10 // it should remember remember and not POLY here
  }, ['SET_NEW_UNSEEN_PROP', 'PROP_NOT_FOUND', 'POLY_PRIMITIVES']);

  pass('Merging functions does not get easier with this change tho. but it already wasn\'t easy, anyways.', () => {
  // How did I ever think I could merge functions with arguments?
    function f(a) {
      a === 1
    }

    function g(a) {
      a === 'x'
    }

    f === g
  }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);

  pass('Merging functions does not get easier with this change tho. but it already wasn\'t easy, anyways. v2', () => {
    // Ok that was easy but... :/
    // You could fix that with some sort of replay queue, which replays each function back-to-back with fresh initial snapshots. for each replay the input transformations should match and the returned value should also match. those can still be cached but it does get a little explody
    function f(a) {
      a.x === 1
    }

    function g(a) {
      a.x === 'x'
    }

    f === g
  }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);

  pass('should context be snapshot as well? calling with fresh references', () => {
    function f(o, p){
      function g() {
        this.x = p
      }

      g.call(o);
    }
    f({}, 1);
    f({}, 'x');
  }, ['SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP']);

  skip('should context be snapshot as well? calling with inspectable references', () => {
    // skip: v4 is not taking the context into account so it fails the test currently
    function f(){ return {}}
    function g(){ this.x = 1; }
    const a = f();
    const b = f();
    g.call(a)
    g.call(b) // how does b get the same updates as g runs a cached call?
    b.x === 1; // If a cached call of g messes up then this fails
  }, ['SET_NEW_UNSEEN_PROP', 'PROP_NOT_FOUND']);

  skip('should super class changes be snapshot as well? calling with inspectable references', () => {
    // skip: v4 does not properly deal with the non-existing super and crashes
    class A {}
    class B extends A {
      f() { super.x = 1 }
    }
    class C {}
    class D extends C {
      f() { super.x = 1 }
    }

    function f(X) {
      new X().f()
    }
    f(B);
    f(D);
    C.prototype.x === 1; // This will fail if cached replay of f fails
  });

  skip('should super object changes be snapshot as well? calling with inspectable references', () => {
    // skip: v4 does not properly deal with the non-existing super and crashes
    const A = {};
    const B = {
      __proto__: A,
      f(){ super.x = 1 }
    };
    const C = {};
    const D = {
      __proto__: C,
      f(){ super.x = 1 }
    };

    function f(X) {
      new X.f()
    }
    f(B);
    f(D);
    C.x === 1; // This will fail if cached replay of f fails
  });

  skip('what if you change something in a closure and the whole thing is reset? so observable side effects of things that are not direct inputs', () => {
    // skip: v4 fails this test
    function f(o) {
      function g() { o.x = 1; }
      g();
    }
    const a = {};
    const b = {};
    f(a);
    f(b);
    b.x === 1; // This fails if cached replay of g, by extension of cached replay of f, does not replay properly
  }, ['SET_NEW_UNSEEN_PROP', 'PROP_NOT_FOUND']);
});


// Invariant:
// - A function with input set A should always have output set A
//   - This seems to hold recursively and for closures etc.
//   - An input set is <args, context, super>
//   - An output set is <return value, property mutations to any inputs by reference>
//   - Open question: How do match digest? As long as we don't support nullables, a function called with an object with one property is the same as a function called with no properties but how do we do a proper subset check since there may be many objects involved?
//   - If you pass on a function then it, worst case, has zero typing information about its params, context, super, or return type. But as long as the other types are the same then the invariant holds recursively and this function, regardless of how it is used, acts the same.
//   -


