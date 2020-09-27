import {pass, only, skip, group} from '../utils.mjs';

export const trycatch = () => group('trycatch', () => {
  pass('try block scope not resolving binding from outer scope', () => {
    // This was a regression where x wouldn't resolve inside the try block
    const x = 'x'
    try {
      x === 'x'
    } catch {}
  });

  pass('try scoping inside a function', () => {
    function f() {
      const x = 'x'
      try {
        x === 'x'
      } catch {}
    }
    f();
  });
});


