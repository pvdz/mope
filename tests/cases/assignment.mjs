import {pass, only, skip, group} from '../utils.mjs';

export const assignment = () => group('assignment', () => {
  pass('assigning number to a number', () => {
    let x = 1;
    x = 2;
  });

  pass('assigning string to a number', () => {
    let x = 1;
    x = 'foo';
  }, ['POLY_PRIMITIVES']);

  pass('assigning number to a string', () => {
    let x = 'foo';
    x = 1;
  }, ['POLY_PRIMITIVES']);

  pass('compound assign multiply to number', () => {
    let x = 1;
    x *= 5;
  });

  pass('compound assign multiply to string', () => {
    let x = 1;
    x *= 'foo';
  }, ['COMPOUND_ASSIGN_TYPE', 'POLY_PRIMITIVES']);

  pass('result compared to correct type', () => {
    let x = 1;
    (x = 2) === 3;
  });

  pass('result compared to wrong type', () => {
    let x = 1;
    (x = 2) === 'foo';
  }, ['POLY_PRIMITIVES']);
});
