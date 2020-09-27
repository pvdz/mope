import * as cases from './index_cases.mjs';

import {getCases} from '../utils.mjs';

export function generateCases() {
  console.log('Generating over', Object.keys(cases))
  Object.keys(cases).forEach(key => cases[key]());
  return getCases();
}
