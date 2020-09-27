import {pass, only, skip, group} from '../utils.mjs';

export const for_loop = () => group('for_loop', () => {
  group('legacy tests to sort and verify', () => {

    pass('for-loop has boolean test', () => {
      for (;true;);
    });
    pass('for-loop has boolean test (counter)', () => {
      for (;1;);
    }, ['TEST_NUMSTR']);
    pass('for-loop test is optional', () => {
      for (;;);
    });

  });

  group('for-loop', () => {
    pass('second part is a bool', () => {
      for (1; true; 2) ;
    });

    pass('second part cannot be a string', () => {
      for (1; 'str'; 2) ;
    }, ['TEST_NUMSTR']);

    pass('second part may be empty', () => {
      // TODO: we'd probably want to verify that this loop _has_ a break/return/throw at all. But we can't guarantee anything.
      for (1; ; 2) ;
    });
  });
});
