import {pass, only, skip, group} from '../utils.mjs';

export const switches = () => group('switches', () => {
  pass('switch case tests are equal to the switch main test', () => {
    switch (1) {
      case 1:
        break;
      case 2:
        break;
    }
  });

  pass('switch case tests are equal to the switch main test (counter)', () => {
    switch (1) {
      case 'a':
        break;
      case 'b':
        break;
    }
  }, ['POLY_PRIMITIVES']);

  pass('default case', () => {
    switch (1) {
      case 1:
        break;
      case 2:
        break;
      default:
        break;
    }
  });

  pass('(counter)', () => {
    switch (1) {
      case 'a':
        break;
      case 'b':
        break;
      default:
        break;
    }
  }, ['POLY_PRIMITIVES']);
});
