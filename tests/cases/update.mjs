import {pass, only, skip, group} from '../utils.mjs';

export const update = () => group('update', () => {
  pass('++ and -- are numbers', () => {
    let a = 1;
    ++a === 1;
    --a === 1;
    a++ === 1;
    a-- === 1;
  });

  pass('++ prefix is not a string', () => {
    let a = 1;
    ++a === 'a';
  }, ['POLY_PRIMITIVES']);

  pass('-- prefix is not a string', () => {
    let a = 1;
    --a === 'a';
  }, ['POLY_PRIMITIVES']);

  pass('++ suffix is not a string', () => {
    let a = 1;
    a++ === 'a';
  }, ['POLY_PRIMITIVES']);

  pass('-- suffix is not a string', () => {
    let a = 1;
    a-- === 'a';
  }, ['POLY_PRIMITIVES']);
});
