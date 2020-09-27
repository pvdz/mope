import {pass, only, skip, group} from '../utils.mjs';

export const object = () => group('object', () => {
  pass('assert x has an own prop toString', () => {
    function f(){ return x.toString(); }
    let x = {};
    x.toString = function(){ return "x"; };
  }, ['SET_NEW_UNSEEN_PROP']);

  pass('Object#toString returns a string but is updated with a function with no return value, uups', () => {
    function f(){ return x.toString(); }
    let x = {};
    x.toString = function(){};
  }, ['SET_NEW_UNSEEN_PROP']);

  group('object struct', () => {
    pass('object structures, pass case', () => {
      let o = {
        a: {
          b: {
            c: 10,
          },
        },
        d: 20,
      };
      o.a.b.c + o.d
    });

    pass('object structures, fail case', () => {
      let o = {
        a: {
          b: {
            c: 10,
          },
        },
        d: "nope",
      };
      o.a.b.c + o.d
    }, ['PLUS_MERGE_NUM_STR']);
  });

  group('obj args with property types', () => {
    pass('obj args with same prop types', () => {
      function f(a, b) {
        return a.foo + b.foo;
      }
      f({foo: 1}, {foo: 2});
      f({foo: 'a'}, {foo: 'b'});
    });

    pass('obj args with different prop types', () => {
      function f(a, b) {
        return a.foo + b.foo;
      }
      f({foo: 1}, {foo: 'b'});
    }, ['PLUS_MERGE_NUM_STR']);

    pass('obj args with same prop types twice', () => {
      function f(a, b) {
        return a.foo + b.foo;
      }
      // the shape of the args might be different as long as the type of accessed props are not...
      // I guess the function is agnostic until call replays and properties are arbitrarily comparable
      // since they have their own type
      f({x: 1, foo: 1}, {x: 'a', foo: 2});
      f({x: {}, foo: 1}, {x: true, foo: 2});
    });

    pass('obj args with same prop types and more to plus', () => {
      function f(a, b) {
        return a.foo + b.foo + 5;
      }
      f({foo: 1}, {foo: 2});
    });
  });

  group('objlit and assigning to prop of arg in func', () => {
    pass('assign to prop of object in two functions with different type', () => {
      // Surely this should reject in our model since it would conflict in the real JS.
      function f(a) {
        a.x = 5;
      }
      function g(a) {
        a.x = 'x';
      }
      let o = {};
      f(o);
      g(o); // o.x is assigned a string, when it is already a number. proving this change ought to be reflected
    }, ['SET_NEW_UNSEEN_PROP', 'POLY_PRIMITIVES']);

    pass('assign to prop of returned object in two functions with different type', () => {
      // Surely this should reject in our model since it would conflict in the real JS.
      function f(a) {
        a.x = 5;
      }
      function g(a) {
        a.x = 'x';
      }
      function h() {
        return {};
      }
      let o = h();
      f(o);
      g(o); // o.x is assigned a string, when it is already a number. proving this change ought to be reflected
    }, ['SET_NEW_UNSEEN_PROP', 'POLY_PRIMITIVES']);

    pass('assign to prop of two objects in two functions with different type', () => {
      // Surely this should reject in our model since it would conflict in the real JS.
      function f(a) {
        a.x = 5;
      }
      function g(a) {
        a.x = 'x';
      }
      function h() {
        return {};
      }
      let o = h();
      f(o);
      let p = h();
      g(p); // pass. p is a different object. object literal Tee should not be shared between o and p
    }, ['SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP']);

    pass('ok so caching return values works, does it need shallow or deep cloning', () => {
      // What if it returns an object which has an unknown property that is an argument (so tbd in phase2)
      function f(a) {
        a.x = 5;
      }
      function g(a) {
        a.x = 'x';
      }
      function h(w) {
        return {w};
      }
      let o = h(1);
      f(o);
      let p = h('a'); // should be fine and not be troubled by the first call to h with a different type
      g(p); // pass. p is a different object. object literal Tee should not be shared between o and p
    }, ['SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP']);
  });

  group('obj spread', () => {
    pass('shallow object clone', () => {
      const a = {};
      const b = { ...a };
    });

    pass('shallow object clone compared', () => {
      const a = {};
      const b = { ...a };

      a === b
    });

    pass('shallow object clone own reference 1', () => {
      const a = {};
      const b = { ...a };

      a.foo = 'x';
      b.foo === undefined // pass
    }, ['SET_NEW_UNSEEN_PROP', 'PROP_NOT_FOUND']);

    pass('shallow object clone own reference 2', () => {
      const a = {};
      const b = { ...a };

      b.foo = 'x';
      a.foo === undefined // pass
    }, ['SET_NEW_UNSEEN_PROP', 'PROP_NOT_FOUND']);
  });

  group('objects as maps', () => {
    pass('using obj as map, pass', () => {
      let obj = {a: 1};
      obj['x'] === 1; // pass, with dynamic access warning
    }, ['DYNAMIC_ACCESS_OBJECT_AS_MAP']);

    pass('using obj as map, fail', () => {
      let obj = {a: 1};
      obj['x'] === 'x'; // poly, with dynamic access warning
    }, ['DYNAMIC_ACCESS_OBJECT_AS_MAP', 'POLY_PRIMITIVES']);

    pass('using obj as map, bad', () => {
      let obj = {a: 1, b: 'x'};
      obj['x'] === 1; // dynamic access warning, fail (because the lookup returns undefined)
    }, ['DYNAMIC_PROP_ACCESS', 'POLY_PRIMITIVES']);
  });

  group('object references', () => {
    pass('function that returns a fresh object called twice gets different type for same prop', () => {
      // (The reason is that we otherwise can't make a reliable call digest)
      function f() {
        return {};
      }
      f().a = 1;
      f().a = 'a'; // In JS this would be fine but in our model we can't support this so a POLY will trigger
    }, ['SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP']);

    pass('object that returns arg which are two distinct obj instances gets prop with different type', () => {
      function f() { return {}; }
      function g(a) { return a; }
      g(f()).a = 1;
      g(f()).a = 'x';
    }, ['SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP']);
  });
});
