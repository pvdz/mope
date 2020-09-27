import {pass, only, skip, group} from '../utils.mjs';

export const logical = () => group('logical', () => {
  pass('&& is a boolean with boolean operands', () => {
    (true && false) === true
  });

  pass('&& is not a number', () => {
    (true && false) === 1
  }, ['POLY_PRIMITIVES']);

  pass('&& does not accept a number lhs', () => {
    (1 && false) === true
  }, ['LOGICAL_OPERANDS_PRIM_LEFT', 'POLY_PRIMITIVES']);

  pass('&& does not accept a number rhs', () => {
    (true && 1) === true
  }, ['LOGICAL_OPERANDS_PRIM_LEFT']);

  pass('&& does not accept a number both', () => {
    (0 && 1) === true
  }, ['LOGICAL_OPERANDS_SAME_PRIMITIVE', 'POLY_PRIMITIVES']);

  pass('|| is a boolean with boolean operands', () => {
    (true || false) === true
  });

  pass('|| is not a number', () => {
    (true || false) === 1
  }, ['POLY_PRIMITIVES']);

  pass('|| does not accept a number lhs', () => {
    (1 || false) === true
  }, ['LOGICAL_OPERANDS_PRIM_LEFT', 'POLY_PRIMITIVES']);

  pass('|| does not accept a number rhs', () => {
    (true || 1) === true
  }, ['LOGICAL_OPERANDS_PRIM_LEFT']);

  pass('|| does not accept a number both', () => {
    (0 || 1) === true
  }, ['LOGICAL_OPERANDS_SAME_PRIMITIVE', 'POLY_PRIMITIVES']);
});
