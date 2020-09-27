// "ConditionalExpression"

import {pass, only, skip, group} from '../utils.mjs';

export const ternary = () => group('ternary', () => {
  pass('lhs of ternary is bool', () => {
    true ? 1 : 2;
  });

  pass('lhs of ternary cannot be string', () => {
    'foo' ? 1 : 2;
  }, ['POLY_PRIMITIVES']);

  pass('return type must be same', () => {
    true ? 1 : 'foo';
  }, ['POLY_PRIMITIVES']);

  pass('return type of ternary matches either branch, pass', () => {
    (true ? 1 : 2) === 10;
  });

  pass('return type of ternary matches either branch, fail', () => {
    (true ? 1 : 2) === 'foo';
  }, ['POLY_PRIMITIVES']);
});
