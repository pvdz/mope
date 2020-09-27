import {pass, only, skip, group} from '../utils.mjs';

export const props = () => group('props', () => {
  pass('accessing a property of an object literal in global', () => {
    const obj = {a: 10};
    obj.a === 10;
  });

  pass('accessing a property of an object literal in func', () => {
    function f() {
      const obj = {a: 10};
      obj.a === 10;
    }
    f();
  });

  pass('accessing a property of an object literal through closure in func', () => {
    const obj = {a: 10};
    function f() {
      obj.a === 10;
    }
    f();
  });

  pass('returning prop value', () => {
    function f() {
      const obj = {a: 10};
      return obj.a;
    }
    f() === 10;
  });

  pass('returning prop from closure', () => {
    const obj = {a: 10};
    function f() {
      return obj.a;
    }
    f() === 10;
  });

  group('unknown properties on objects', () => {
    pass('unknown property on object', () => {
      let o = {};
      o.foo === undefined;
    }, ['PROP_NOT_FOUND']);

    pass('own property on object, with read first', () => {
      let o = {};
      o.foo === undefined;
      o.foo = 2; // poly
      o.foo === 2;
    }, ['PROP_NOT_FOUND', 'SET_NEW_BUT_SEEN_PROP', 'POLY_PRIMITIVES']);

    pass('own property on object, with read first, no comparison', () => {
      let o = {};
      o.foo === undefined;
      o.foo = 2; // poly
      // o.foo === 2;
    }, ['PROP_NOT_FOUND', 'SET_NEW_BUT_SEEN_PROP', 'POLY_PRIMITIVES']);

    pass('own property on object, without read first', () => {
      let o = {};
      // o.foo === undefined;
      o.foo = 2;
      o.foo === 2; // This probably wouldn't trigger an error because our system didn't look into `foo` earlier.
    }, ['SET_NEW_UNSEEN_PROP']);

    pass('inherited property on object, with read first', () => {
      let o = {};
      o.foo === undefined;
      Object.prototype.foo = 2;
      o.foo === 2; // The lookup should return `number` and remember that it returned `undefined` for this prop before and then throw a poly because of that (not because of the comparison)
    }, ['PROP_NOT_FOUND', 'SET_NEW_BUT_SEEN_PROP', 'POLY_PRIMITIVES', 'POLY_PRIMITIVES']);

    pass('inherited property on object, without read first', () => {
      let o = {};
      // o.foo === undefined;
      Object.prototype.foo = 2; // Triggers a lint error
      o.foo === 2; // This probably wouldn't trigger an error because our system didn't look into `foo` earlier.
    }, ['SET_NEW_UNSEEN_PROP']);

    pass('inherited property on object', () => {
      let o = {};
      o.foo === undefined; // (lint 1)
      Object.prototype.foo = 2; // This shouldn't fail
      // In JS, the next would no longer be true, our model should be able to reflect this
      // However, the prototype object can be an arbitrary Tee. We can't retroactively sweep through all Tees that
      // inherit from it and validate the lookup chain.
      o.foo === 2; // (lint 2)
    }, ['PROP_NOT_FOUND', 'SET_NEW_BUT_SEEN_PROP', 'POLY_PRIMITIVES', 'POLY_PRIMITIVES']);

    pass('inherited type poly', () => {
      // Is this a poly error? A lint? function!=number. Or duncare about shadowing inherited props.
      let o = {toString: 1};
    });

    pass('inherited type poly updating the proto', () => {
      let o = {foo: 1};
      Object.prototype.foo = 'x'; // Can we detect a poly here? Do we even want to?
    }, ['SET_NEW_UNSEEN_PROP']);
  });

  group('unknown properties on primitives', () => {
    pass('unknown properties on a string', () => {
      // When we allow properties to be expanding forward we record unknown properties as undefined. What ought to
      // happen when reading an unknown property on a primitive?
      "Foo".bar === undefined;
    }, ['PROP_NOT_FOUND']);

    pass('unknown properties on a string that is later added to String.prototype', () => {
      // This case is possible, where in the first read the property doesn't exist. Then after updating its prototype,
      // the string will resolve the property to a different type. But we can't seal the property on the string type.
      "Foo".bar === undefined; // undefined
      String.prototype.bar = 2;
      "foo".bar === 2; // number, but our model mandates it should return the same type
    }, ['PROP_NOT_FOUND', 'SET_NEW_BUT_SEEN_PROP', 'POLY_PRIMITIVES']);
  });

  group('changing inherited props', () => {
    pass('changing inherited props, base case', () => {
      let s = 'foo';
      s.bar === undefined;
    }, ['PROP_NOT_FOUND']);

    pass('changing inherited props, base inheritance case', () => {
      let s = 'foo';
      String.prototype.bar = 1; // (lint)
      s.bar === 1; // (no lint because inheritance caught it due to previous line)
    }, ['SET_NEW_UNSEEN_PROP']);

    pass('changing inherited props, base double inheritance case', () => {
      // Note: strings inherit from String.prototype which inherits from Object.prototype
      let s = 'foo';
      Object.prototype.bar = 1; // lint (note: this is Object.prototype, not String)
      s.bar === 1; // no lint
    }, ['SET_NEW_UNSEEN_PROP']);

    pass('changing inherited props, both inheritances have it set with different type', () => {
      // Note: strings inherit from String.prototype which inherits from Object.prototype
      // This looks benign. But it fails because the lookup for String.prototype.bar also checks Object.prototype.bar
      // so it returns `undefined` there. So when it is then explicitly set in the next line, it should poly a
      // number to undefined.
      String.prototype.bar = 'x'; // only line that triggers a lint
      Object.prototype.bar = 1; // poly number to undefined
    }, ['SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP']);

    pass('updating a subclass property should not affect the property of its parent, even when unknown', () => {
      // The first line does a write but also triggers a lookup. This lookup should not walk the prototypal chain
      // because a write only affects own properties.
      String.prototype.bar = 'x'; // lint
      Object.prototype.bar === undefined; // lint
    }, ['SET_NEW_UNSEEN_PROP', 'PROP_NOT_FOUND']);

    pass('updating a parent class property should not affect the property of its child, even when unknown', () => {
      // Note: strings inherit from String.prototype which inherits from Object.prototype
      Object.prototype.bar = 1; // lint
      // It shouldn't care that the parent type is a number because the write only affects own properties
      String.prototype.bar = 'x'; // lint
    }, ['SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP']);

    pass('a property lookup should always return the same type, regardless of inheritance tricks', () => {
      // Note: strings inherit from String.prototype which inherits from Object.prototype
      let s = 'foo';
      Object.prototype.bar = 1;
      s.bar === 1;
      String.prototype.bar = 'x';
      s.bar === 'x'; // This should trigger an error. The model should detect that it returned a different type for resolving the same property on the same object in the same scope/store.
    }, ['SET_NEW_UNSEEN_PROP', 'SET_NEW_BUT_SEEN_PROP', 'POLY_PRIMITIVES']);
  });

  group('prototypal changes', () => {
    pass('make sure prototypal changes afterwards do not change what we already saw', () => {
      function g() {
        function A() {}
        let a = new A();
        a.foo === undefined;
        A.prototype.foo = 1; // Ideally, this step should cause the poly
      }
      g();
    }, ['PROP_NOT_FOUND', 'SET_NEW_BUT_SEEN_PROP', 'POLY_PRIMITIVES']);

    pass('make sure prototypal changes afterwards do not change what we already saw, moved constructor out', () => {
      function A() {}
      function g() {
        let a = new A();
        a.foo === undefined;
        A.prototype.foo = 1; // Ideally, this step should cause the poly
      }
      g();
    }, ['PROP_NOT_FOUND', 'SET_NEW_BUT_SEEN_PROP', 'POLY_PRIMITIVES']);

    pass('every tee should return the same tid for the same prop, including inherited, change proto first', () => {
      function A() {}
      function g() {
        let a = new A();
        a.foo === undefined; // .foo is 1 now so this should poly
      }
      A.prototype.foo = 1; // this should cause g() to fail
      g();
    }, ['SET_NEW_UNSEEN_PROP', 'POLY_PRIMITIVES']);

    pass('changing prototype after a function instantiates an object should not be ok because it changes a return type', () => {
      function A() {}
      function g() {
        let a = new A();
        a.foo === undefined;
        return a;
      }
      const b = g();
      A.prototype.foo = 1; // Ideally, this step should cause the poly
      b.foo === undefined; // This should hold. But the above line would violate it.
    }, ['PROP_NOT_FOUND', 'SET_NEW_BUT_SEEN_PROP', 'POLY_PRIMITIVES', 'POLY_PRIMITIVES', 'POLY_PRIMITIVES']);

    pass('changing prototype after a function instantiates an object should not be ok because it changes a return type, dont pass', () => {
      function A() {}
      function g() {
        let a = new A();
        a.foo === undefined;
        return a;
      }
      const b = g();
      A.prototype.foo = 1; // Ideally, this step should cause the poly
      b.foo === 1; // Should not be allowed since `b.foo` was already seen to return `undefined`
    }, ['PROP_NOT_FOUND', 'SET_NEW_BUT_SEEN_PROP', 'POLY_PRIMITIVES', 'POLY_PRIMITIVES']);

    skip('changing prototype after a function instantiates an object should not be ok', () => {
      // skip: The system will currently allow this because the problem is only flagged when a property on an object resolves to a different value. But I think I'd want this principle to apply to finding `undefined` on a prototype as well, like this test tries to show.
      function A() {}
      function g() {
        let a = new A();
        a.foo === undefined;
      }
      g();
      A.prototype.foo = 1; // Ideally, this step should cause the poly
      // b.foo === undefined; // This should hold. But the above line would violate it.
    }, ['PROP_NOT_FOUND', 'SET_NEW_BUT_SEEN_PROP']);

    skip('changing prototype after a function instantiates checked on another instance after that change', () => {
      // skip: The system will currently allow this because the problem is only flagged when a property on an object resolves to a different value. But I think I'd want this principle to apply to finding `undefined` on a prototype as well, like this test tries to show.
      function A() {}
      function g() {
        let a = new A();
        a.foo === undefined;
      }
      g();
      A.prototype.foo = 1; // Ideally, this step should cause the poly
      new A().foo === 1; // This, by itself, is okay since it was just set like this in the previous line
    }, ['PROP_NOT_FOUND', 'SET_NEW_BUT_SEEN_PROP']);

    skip('every tee should return the same tid for the same prop, including inherited', () => {
      // skip: The system will currently allow this because the problem is only flagged when a property on an object resolves to a different value. But I think I'd want this principle to apply to finding `undefined` on a prototype as well, like this test tries to show.
      function A() {}
      function g() {
        let a = new A();
        a.foo === undefined;
      }
      g();
      A.prototype.foo = 1; // Ideally, this step should cause the poly
      g();
    }, ['PROP_NOT_FOUND', 'SET_NEW_BUT_SEEN_PROP']);
  });

  pass('can not set `null` to a constructor prototype', () => {
    // Weird edge case, but this would hold in JS. We can side step it because it violates mono principles.
    function f(){}
    f.prototype = null; // TODO: perhaps this is already a poly error in our system, though
    // (new f).__proto__ === undefined; // It is undefined, not null
  }, ['SET_PROTOTYPE']);

  group('read write order', () => {
    pass('outer object gets shared by two functions in same scope', () => {
      const o = {};
      function a() {
        o.x = 1; // lint
        // o.x === 1;
      }
      function b() {
        // Should remember the assignment of number to .x in the call to a()
        o.x === 1;
      }
      a();
      // Since in the a() call, o.x is set to a number, the read from b should also return a number, so it fails
      b();
    }, ['SET_NEW_UNSEEN_PROP']);

    pass('global, read write order', () => {
      const o = {};
      function a() {
        o.x = 1; // lint
        o.x === 1;
      }
      function b() {
        o.x === undefined;
      }
      a();
      // Since in the a() call, o.x is set to a number, the read from b should also return a number, so it fails
      b();
    }, ['SET_NEW_UNSEEN_PROP', 'POLY_PRIMITIVES']);

    pass('global, read write order, flipped', () => {
      const o = {};
      function a() {
        o.x === undefined; // lint
      }
      function b() {
        o.x = 1; // lint
        o.x === 1;
      }
      a();
      // Since in the a() call, o.x is sealed to undefined, the write from b will fail to merge to number
      b();
    }, ['PROP_NOT_FOUND', 'SET_NEW_BUT_SEEN_PROP', 'POLY_PRIMITIVES']);

    pass('fresh, read write order', () => {
      function f() {
        return {};
      }
      function a(o) {
        o.x = 1; // lint
        o.x === 1;
      }
      function b(o) {
        o.x === undefined; // lint (because o should be a new instance, not sharing the refs to the o in a)
      }
      // In the first call, the returned object first gets x set to 1 and then read and compared to 1
      a(f());
      // In the second call, the returned object gets read and compared to undefined
      b(f());
      // This will break if, amongst other reasons, the props obj of the object from f() are shared between both instances
    }, ['SET_NEW_UNSEEN_PROP', 'PROP_NOT_FOUND']);

    pass('fresh, read write order, flipped', () => {
      function f() {
        // This function is a problem because the call will be cached so the same object reference is returned
        // This was fine when all types were absolutely sealed but now that objects are forward registering properties
        // the sharing of the object reference causes problems and breaks this caching model.
        // The same will apply to functions (or classes) with expandos.
        return {};
      }
      function a(o) {
        o.x === undefined; // PROP_NOT_FOUND
      }
      function b(o) {
        o.x = 1; // SET_NEW_UNSEEN_PROP (because o should be a new instance, not sharing the refs to the o in a)
        o.x === 1;
      }
      // In the first call, the returned object gets read and compared to undefined
      a(f());
      // In the second call, the returned object first gets x set to 1 and then read and compared to 1
      b(f());
      // This will break if, amongst other reasons, the props obj of the object from f() are shared between both instances
    }, ['PROP_NOT_FOUND', 'SET_NEW_UNSEEN_PROP']);

    pass('(partial) fresh, read write order, flipped, returning', () => {
      // Partial of the next test
      function f() {
        return {};
      }
      function a(o) {
        o.x === undefined; // lint
        return o;
      }
      // function b(o) {
      //   o.x = 1;
      //   o.x === 1;
      //   return o;
      // }

      let x = f();
      x = a(x);

      // let y = f();
      // y = b(y);
    }, ['PROP_NOT_FOUND']);

    pass('fresh, read write order, flipped, returning', () => {
      // Caching breaks returning fresh obji leading to a shared props map reference leading to the demo'd problem breaking
      // This problem applies to all Tees since all Tees now track the return type of a prop accessed on that Tee
      // Some ways to solve this;
      // - make sure objects are shadowed when entering a new scope
      // - make sure objects are shadowed and then replace them whenever something is added to their own props or known return values
      // - shadow an object when it is returned?
      // --> all non-global non-builtin arguments should be shadowed. that way they dont share the props/retval map references
      function f() {
        return {};
      }
      function a(o) {
        o.x === undefined; // lint
        return o;
      }
      function b(o) {
        o.x = 1; // lint (because o should be a new instance, not sharing the refs to the o in a)
        o.x === 1;
        // The problem is now here. Because `o` is shadowed regardless, it wants to merge the `o` when being returned
        // and it gets merged with itself, basically. But that means it's redirecting itself to itself. Depending on
        // which way the coin flip lands, that could end in an infinite loop in the higher scope, when looking under
        // the shadow. Can we safely generically and efficiently prevent this?
        return o;
      }

      let x = f();
      x = a(x);

      let y = f();
      y = b(y);
    }, ['PROP_NOT_FOUND', 'SET_NEW_UNSEEN_PROP']);

    pass('same read write order with indirect cache problem', () => {
      function f(a) {
        function g(b) {
          return {b: b};
        }
        return g(a);
      }
      function a(o) {
        o.x === undefined; // lint
      }
      function b(o) {
        o.x = 1; // lint (because o should be a new instance, not sharing the refs to the o in a)
        o.x === 1;
      }
      // The idea is that g() is called with a string and a number, breaking the cache for g and f
      a(f(1));
      b(f('a'));
    }, ['PROP_NOT_FOUND', 'SET_NEW_UNSEEN_PROP']);
  });

  pass('regression crashing when trying to read property from aliased placeholder', () => {
    // This would crash the interpreter
    let scene;
    scene = new A
    scene.background = new A
  }, ['BINDING_NO_INIT', 'IMPLICIT_GLOBAL', 'USED_BINDING_BEFORE_DECL', 'NEW_NOT_CONSTRUCTOR', 'NEW_NOT_CONSTRUCTOR', 'PROP_SET_ON_NULL_UNDEF']);

  pass('regression crashing when trying to call property from aliased placeholder', () => {
    let scene;
    scene = new THREE
    scene.add(train);
  }, ['BINDING_NO_INIT', 'IMPLICIT_GLOBAL', 'IMPLICIT_GLOBAL', 'USED_BINDING_BEFORE_DECL', 'NEW_NOT_CONSTRUCTOR', 'USED_BINDING_BEFORE_DECL', 'PROP_ON_NULL_UNDEF', 'CALLED_UNCALLABLE']);

  pass('set array property dynamic', () => {
    let a = [1];
    let b = a[1] = 2;
    b === 1; // test "return value" of setting a dynamic prop
  }, ['DYNAMIC_INDEX_ACCESS_ARRAY']);
});
