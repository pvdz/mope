import {pass, only, skip, group} from '../utils.mjs';

export const catch_clause = () => group('catch_clause', () => {
  pass('catch var is reachable', () => {
    try { throw 1; } catch (e) { e === 1; }
  }, ['POLY_PRIMITIVES']);

  pass('catch var not present', () => {
    try {
    } catch {
    }
  });

  pass('catch var is shadowed', () => {
    let e = 'a';
    try { throw 1; } catch (e) { e === 1; }
  }, ['POLY_PRIMITIVES']);
});
