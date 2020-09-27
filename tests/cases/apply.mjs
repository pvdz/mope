import {pass, only, skip, group} from '../utils.mjs';

export const apply = () => group('.apply', () => {

  pass('applying with undefined and no arg', () => {
    function f(){}
    f.apply(undefined);
  }, ['ARRAY_KIND']);

  pass('applying with undefined and no args should be undefined', () => {
    function f(){}
    f.apply(undefined) === undefined;
  }, ['ARRAY_KIND']);

  pass('applying with undefined and no args should return the number, pass', () => {
    function f(){ return 5; }
    f.apply(undefined) === 10;
  }, ['ARRAY_KIND']);

  pass('applying with undefined and no args should return the number, fail', () => {
    function f(){ return 5; }
    f.apply(undefined) === 'str';
  }, ['ARRAY_KIND', 'POLY_PRIMITIVES']);

  pass('applying with undefined and one arg should return the arg, pass', () => {
    function f(x){ return x; }
    f.apply(undefined, [20]) === 10;
  });

  pass('applying with undefined and one arg should return the arg, fail', () => {
    function f(x){ return x; }
    f.apply(undefined, [20]) === 'str';
  }, ['POLY_PRIMITIVES'])

  pass('applying with multiple numbers', () => {
    function f(a, b, c, d, e){ return a + b + c + d + e; }
    f.apply(undefined, [1, 2, 3, 4, 5]) === 6;
  }, ['CALL_ARG_ARITY', 'SPREAD_BEFORE_REST'])

  pass('applying with different type args should be bad for call', () => {
    function f(a, b){ }
    f.apply(undefined, [1, 'a']);
  }, ['ARR_MONO_KIND', 'CALL_ARG_ARITY', 'SPREAD_BEFORE_REST'])

  pass('second arg to .apply must be an array', () => {
    function f(a, b){ }
    f.apply(undefined, 1);
  }, ['ARRAY_KIND', 'CALL_ARG_ARITY', 'SPREAD_BEFORE_REST'])

  pass('any arg over two to apply are ignored', () => {
    function f(a, b){ }
    f.apply(undefined, [], 1, 2);
  }, ['FUNCTION_APPLY_ARGCOUNT', 'ARRAY_KIND_READ_BUT_UNDET', 'CALL_ARG_ARITY', 'SPREAD_BEFORE_REST']);
});
