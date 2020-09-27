import {pass, only, skip, group} from '../utils.mjs';

export const voidd = () => group('voidd', () => {
  pass('void is always undefined', () => {
    (void 1) === undefined
  });

  pass('void is not a number', () => {
    (void 1) === 1
  }, ['POLY_PRIMITIVES']);
});
