import {pass, only, skip, group} from '../utils.mjs';

import fs from 'fs';

export const files = () => group('files', () => {
  pass('left-pad.js', '////\n' + fs.readFileSync('./tests/files/left-pad.js', 'utf8'), ['SET_NEW_UNSEEN_PROP'])
});
