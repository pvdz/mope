// "ConditionalExpression"

import {pass, only, skip, group} from '../utils.mjs';

export const do_while = () => group('do_while', () => {

  group('legacy tests to sort and verify', () => {
    pass('do-while has boolean test', () => {
      do { } while (true);
    });
    pass('do-while has boolean test (counter)', () => {
      do { } while (1);
    }, ['TEST_NUMSTR']);
  });


  pass('condition of while is a bool', () => {
    do ; while (true);
  });

  pass('condition of while cannot be string', () => {
    do ; while ('foo');
  }, ['TEST_NUMSTR']);
});
