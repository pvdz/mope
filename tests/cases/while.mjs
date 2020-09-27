import {pass, only, skip, group} from '../utils.mjs';

export const while_stmt = () => group('while_stmt', () => {
  pass('while has boolean test', () => {
    while (true);
  });

  pass('while has boolean test (counter)', () => {
    while (1);
  }, ['TEST_NUMSTR']);
});
