import {pass, only, skip, group} from '../utils.mjs';

export const string = () => group('string', () => {
  pass('call padStart on a group', () => {
    // Regression where args were not properly passed on somehow
    let maxPointerlineLen = 2;
    'x'.padStart(maxPointerlineLen, ' ')
  });
});
