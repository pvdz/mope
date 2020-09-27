import {pass, only, skip, group} from '../utils.mjs';

export const member_expr = () => group('member expression', () => {

  pass('member expression where dynamic property access prop name value is a number', () => {
    // Regression: Dynamic property access was pushing too much to the stack, leading to a crash
    function f() {
      x[1]
    }
    f();
  }, ['IMPLICIT_GLOBAL', 'USED_BINDING_BEFORE_DECL', 'DYNAMIC_PROP_ACCESS']);

  pass('member expression on array returning an index', () => {
    const x = [1, 2];
    function f() {
      return x[1];
    }
    f() === 1;
  }, ['DYNAMIC_INDEX_ACCESS_ARRAY']);

  pass('dynamic property access firing dynprop twice', () => {
    // Regression

    function f() {
      let ectxt = 'foo';
      return '\n`````\n' + (ectxt[ectxt.length-1] !== '\n' ? '\n' : '') + ectxt + '`````\n';
    }
    const a = f();
    a === 'b'
  }, ['DYNAMIC_INDEX_ACCESS_STRING']);
});
