import {pass, only, skip, group} from '../utils.mjs';

export const deleted = () => group('deleted', () => {
  group('legacy tests to sort and verify', () => {

    pass('delete is always boolean', () => {
      (delete 1..toString) === true
    }, ['DELETE_MEH']);

    pass('delete is not a number', () => {
      (delete 1..toString) === 1
    }, ['DELETE_MEH', 'POLY_PRIMITIVES']);
  });
});
