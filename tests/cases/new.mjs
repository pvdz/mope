import {pass, only, skip, group} from '../utils.mjs';

export const neww = () => group('neww', () => {

  pass('new an paramless function without args', () => {
    function f(){}
    new f();
  });

  group('arity', () => {
    pass('new an paramless function with args', () => {
      function f(){}
      new f(1);
    }, ['CALL_ARG_ARITY']);

    pass('new a function with params with args', () => {
      function f(a, b){}
      new f(1, 2);
    });

    pass('new a function with params without args', () => {
      function f(a, b){}
      new f();
    }, ['CALL_ARG_ARITY']);
  });

  group('inheriting from the function constructor', () => {
    pass('context inherits from function', () => {
      function f(){
        this.foo === 1
      }
      f.prototype = {foo: 1};
      new f();
    }, ['SET_PROTOTYPE']);

    pass('context inherits from function (counter test)', () => {
      function f(){
        this.foo === 'a'
      }
      f.prototype = {foo: 1};
      new f();
    }, ['SET_PROTOTYPE', 'POLY_PRIMITIVES']);

    pass('this in constructor passes with new', () => {
      function f(){
        this.Array === 1
      }
      f.prototype = {Array: 1};
      new f();
    }, ['SET_PROTOTYPE']);

    pass('this in constructor fails without new', () => {
      function f(){
        this.Array === 1 // without `new` this ignores the prototype set below
      }
      f.prototype = {Array: 1};
      f(); // implicit context in strict mode is `undefined`
    }, ['SET_PROTOTYPE', 'CONTEXT_MISSING', 'PROP_ON_NULL_UNDEF', 'POLY_PRIMITIVES']);
  });

  group('constructor return type', () => {
    pass('constructor does not return undefined implicitly', () => {
      function f(){}
      new f() === undefined
    }, ['POLY_PRIMITIVES']);

    pass('returns an object by default', () => {
      // this merges two object instances which ultimates merges their __proto__
      function f(){}
      new f() === new f()
    });

    pass('returns a new instance by default', () => {
      function f(){}
      f.prototype = {foo: 1};
      new f().foo === 1
    }, ['SET_PROTOTYPE']);

    pass('returns a new instance by default (counter test)', () => {
      function f(){}
      f.prototype = {foo: 1};
      new f().foo === 'a'
    }, ['SET_PROTOTYPE', 'POLY_PRIMITIVES']);

    group('primitives', () => {
      pass('constructor ignores returned primitives; number', () => {
        function f(){
          return 1;
        }
        new f() === 1
      }, ['POLY_PRIMITIVES']);

      pass('constructor ignores returned primitives; string', () => {
        function f(){
          return 'foo';
        }
        new f() === 'foo'
      }, ['POLY_PRIMITIVES']);

      pass('constructor ignores returned primitives; null', () => {
        function f(){
          return null;
        }
        new f() === null
      }, ['POLY_PRIMITIVES']);

      pass('constructor ignores returned primitives; undefined', () => {
        function f(){
          return undefined;
        }
        new f() === undefined
      }, ['POLY_PRIMITIVES']);

      pass('constructor ignores returned primitives; boolean', () => {
        function f(){
          return true;
        }
        new f() === true
      }, ['POLY_PRIMITIVES']);
    });

    pass('constructor can override returned object', () => {
      let o = {};
      function f(){
        return o;
      }
      new f() === o
    });
  });
});
