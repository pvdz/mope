import {pass, only, skip, group} from '../utils.mjs';

export const group_comma = () => group('group_comma', () => {
  pass('a comma expression has the value of the right-most value', () => {
    (1, 2, 'a') === 'a'
  });

  pass('a comma expression has the value of the right-most value (counter)', () => {
    (1, 2, 3) === 'a'
  }, ['POLY_PRIMITIVES']);

  pass('stack underflow with group inside ternary', () => {
    // The group was dropping all parts, but it should be keeping the last one
    1 ? 2 : (3, 4);
  }, ['POLY_PRIMITIVES']);
});
