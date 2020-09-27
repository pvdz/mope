import {pass, only, skip, group} from '../utils.mjs';

export const regex = () => group('regex', () => {
  pass('regular expression literal as arg', () => {
    "foo".match(/[a-z]/i)
  }, ['STRING_MATCH_UNSAFE']);
});


