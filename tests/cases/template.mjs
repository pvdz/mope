// Tests in this file should run first. Uncover simply diagnostics before running more complex/specific tests
import {pass, only, skip, group} from '../utils.mjs';

export const template = () => group('template', () => {
  group('legacy stuff to sort', () => {
    pass('dynamic part of a template must be string', () => {
      `foo${"a"}bar`;
    });

    pass('dynamic part of a template cannot be number', () => {
      `foo${1}bar`;
    }, ['TEMPLATE_EXPR_STRING']);

    pass('conditions won\'t ever accept template string or other things', () => {
      if (``) {}
    }, ['TEST_NUMSTR']);

    pass('string addition', () => {
      let x = '';
      x + `foo`; // pass, both string type
    });

  });

  pass('templates assign', () => {
    let x = `foo`;
  });

  pass('templates are strings', () => {
    let x = `foo`;
    x === 'y';
  });

  pass('templates are not numbers', () => {
    let x = `foo`;
    x === 5;
  }, ['POLY_PRIMITIVES']);

  pass('templates can have parts', () => {
    let y = 'foo';
    let x = `x ${y} z`;
  });

  pass('templates quasis must be strings too', () => {
    let y = 5;
    let x = `x ${y} z`;
  }, ['TEMPLATE_EXPR_STRING']);
});
