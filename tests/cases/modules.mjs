import {pass, only, skip, group} from '../utils.mjs';

export const modules = () => group('modules', () => {

  pass('baseline import another module, unused', {
    index: () => {
      `import a from './a'`;
    },
    './a': () => {
      `export default 1`;
    }
  });

  pass('baseline import another module, pass', {
    index: () => {
      `import a from './a'`;
      a === 1;
    },
    './a': () => {
      `export default 1`;
    }
  });

  pass('baseline import another module, fail', {
    index: () => {
      `import a from './a'`;
      a === 'x';
    },
    './a': () => {
      `export default 1`;
    }
  }, ['POLY_PRIMITIVES']);

  group('export default function', () => {
    pass('export default a function, uncalled', () => {
      `export default function f() { return 1; }`
    });

    pass('export default a function, called', () => {
      `export default function f() { return 1; }`
      f();
    });

    pass('calling an exported function', {
      index: () => {
        `import g from './a'`;
        g() === 1
      },
      './a': () => {
        `export default function f() { return 1; }`
      },
    });
  });

  group('global problem', () => {
    pass('double global problem for modules, pass', {
      index: () => {
        `import x from './a'`;
        let y = 1;
        x === y;
      },
      './a': () => {
        let y = 1;
        `export default y`;
        y === 1;
      },
    });

    pass('double global problem for modules, fail 1', {
      index: () => {
        `import x from './a'`;
        let y = 'x';
        x === y;
      },
      './a': () => {
        let y = 1;
        `export default y`;
        y === 1;
      },
    }, ['POLY_PRIMITIVES']);

    pass('double global problem for modules, fail 2', {
      index: () => {
        `import x from './a'`;
        let y = 1;
        x === y;
      },
      './a': () => {
        let y = 1;
        `export default y`;
        y === 'x';
      },
    }, ['POLY_PRIMITIVES']);

    pass('double global problem for modules, fail 3', {
      index: () => {
        `import x from './a'`;
        let y = 1;
        x === y;
      },
      './a': () => {
        let y = 'x';
        `export default y`;
        y === 'x';
      },
    }, ['POLY_PRIMITIVES']);

    pass('exported function should refer to proper global scope, pass', {
      index: () => {
        let x = 'x';
        `import f from './a'`;
        f() === 1;
      },
      './a': () => {
        let x = 1;
        function f() {
          return x;
        }
        `export default f`;
      },
    });

    pass('exported function should refer to proper global scope, fail', {
      index: () => {
        let x = 'x';
        `import f from './a'`;
        f() === 'x';
      },
      './a': () => {
        let x = 1;
        function f() {
          return x;
        }
        `export default f`;
      },
    }, ['POLY_PRIMITIVES']);

    pass('exported function should fail to read global from other module that imports it, fail 1', {
      index: () => {
        let x = 'x';
        `import f from './a'`;
        f() === 'x';
      },
      './a': () => {
        function f() {
          return x; // Should fail to read this, not use the one above
        }
        `export default f`;
      },
    }, ['IMPLICIT_GLOBAL', 'USED_BINDING_BEFORE_DECL', 'POLY_PRIMITIVES']);

    pass('exported function should fail to read global from other module that imports it, fail 2', {
      index: () => {
        let x = 'x';
        `import f from './a'`;
      },
      './a': () => {
        function f() {
          return x; // Should fail to read this, not use the one above
        }
        `export default f`;
        f();
      },
    }, ['IMPLICIT_GLOBAL', 'USED_BINDING_BEFORE_DECL']);
  });

  pass('import star', {
    index: () => {
      `import * as testGenerators from './a'`;
    },
    './a': () => {
      `export function f(){}`
      `export function g(){}`
    },
  });
});
