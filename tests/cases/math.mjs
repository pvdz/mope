import {pass, only, skip, group} from '../utils.mjs';

export const math = () => group('math', () => {
  group('Math.min', () => {
    pass('Math.min argless', () => {
      Math.min();
    }, ['BUILTIN_ARGLESS']);
  });
});
