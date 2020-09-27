import {pass, only, skip, group} from '../utils.mjs';

export const typeoff = () => group('typeoff', () => {
  pass('typeof is always a string', () => {
    (typeof 1) === 'string'
  });

  pass('typeof not a number', () => {
    (typeof 1) === 1
  }, ['POLY_PRIMITIVES']);
});
