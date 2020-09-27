import {pass, only, skip, group} from '../utils.mjs';

export const call = () => group('.call', () => {

  pass('calling with undefined and no args', () => {
    function f(){}
    f.call(undefined);
  });

  pass('calling with undefined and no args should be undefined', () => {
    function f(){}
    f.call(undefined) === undefined;
  });

  pass('calling with undefined and no args should return the number, pass', () => {
    function f(){ return 5; }
    f.call(undefined) === 10;
  });

  pass('calling with undefined and no args should return the number, fail', () => {
    function f(){ return 5; }
    f.call(undefined) === 'str';
  }, ['POLY_PRIMITIVES']);

  pass('calling with undefined and one arg should return the arg, pass', () => {
    function f(x){ return x; }
    f.call(undefined, 20) === 10;
  });

  pass('calling with undefined and one arg should return the arg, fail', () => {
    function f(x){ return x; }
    f.call(undefined, 20) === 'str';
  }, ['POLY_PRIMITIVES']);

  pass('calling with multiple numbers', () => {
    function f(a, b, c, d, e){ return a + b + c + d + e; }
    f.call(undefined, 1, 2, 3, 4, 5) === 6;
  });

  pass('calling with different type args should be okay for call', () => {
    function f(a, b){ }
    f.call(undefined, 1, 'a');
  });

  group('reflective', () => {
    pass('calling reflective function twice with and without arg', () => {
      function f(a) {
        return a;
      }
      f(1) === f() // 1 === undefined
    }, ['CALL_ARG_ARITY', 'POLY_PRIMITIVES']);

    pass('calling reflective function twice with and without arg should detect poly unless checking for undefined', () => {
      function f(a) {
        return a;
      }
      f(undefined) === f()
    }, ['CALL_ARG_ARITY']);

    pass('calling reflective function twice with different type should detect poly', () => {
      function f(a) {
        return a;
      }
      f(1) === f('x')
    }, ['POLY_PRIMITIVES']);

    pass('calling reflective function twice with same type should be ok', () => {
      function f(a) {
        return a;
      }
      f(1) === f(2)
    });
  });
});
