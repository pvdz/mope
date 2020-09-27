// Tests in this file should run first. Uncover simply diagnostics before running more complex/specific tests
import {pass, only, skip, group} from '../utils.mjs';

export const _base = () => group('base', () => {
  pass('just a var without init', () => {
    let nothing;
  }, ['BINDING_NO_INIT']);

  pass('just a var with init', () => {
    let nothing = 1;
  });

  pass('just a function', () => {
    function f() {}
  });

  pass('just calling a function', () => {
    function f() {}
    f();
  });
});
