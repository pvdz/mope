import {pass, only, skip, group} from '../utils.mjs';

export const destruct_decl = () => group('destruct_decl', () => {
  // We don't need to worry about var/let/const differences here (the parser checks this for us).

  group('obj pattern', () => {
    // const { x          } = {}
    // const { x = y      } = {}
    // const { x: []      } = {}
    // const { x: [] = y  } = {}
    // const { x: {}      } = {}
    // const { x: {} = y  } = {}
    // const { ...x       } = {}
    // const { y, ...x    } = {}
    // const { ...x, y    } = {}

    pass('var obj pattern baseline ident pass', () => {
      const {x} = {x: 1};
      x === 1;
    });

    pass('var obj pattern baseline ident fail', () => {
      const {x} = {x: 'x'};
      x === 1;
    }, ['POLY_PRIMITIVES']);

    pass('var obj pattern baseline ident empty', () => {
      const {x} = {};
      x === undefined;
    }, ['PROP_NOT_FOUND']);

    group('with default', () => {
      pass('var obj pattern baseline ident with default, rhs has it, pass', () => {
        const {x = 1} = {x: 1};
        x === 1;
      });

      pass('var obj pattern baseline ident with default, rhs has it, fail', () => {
        const {x = 1} = {x: 1};
        x === 'x';
      }, ['POLY_PRIMITIVES']);

      pass('var obj pattern baseline ident with default, rhs has undefined, pass', () => {
        const {x = 1} = {x: undefined};
        x === 1;
      });

      pass('var obj pattern baseline ident with default, rhs has undefined, fail', () => {
        const {x = 1} = {x: undefined};
        x === 'x';
      }, ['POLY_PRIMITIVES']);

      pass('var obj pattern baseline ident with default, rhs empty, pass', () => {
        const {x = 1} = {};
        x === 1;
      }, ['PROP_NOT_FOUND_HAS_DEFAULT']);

      pass('var obj pattern baseline ident with default, rhs empty, fail', () => {
        const {x = 1} = {};
        x === 'x';
      }, ['PROP_NOT_FOUND_HAS_DEFAULT', 'POLY_PRIMITIVES']);

      pass('var obj pattern baseline ident with default, rhs undefined, fail 1', () => {
        // Throws because you cannot destruct undefined
        const {x = 1} = undefined;
        x === 1;
      }, ['PROP_ON_NULL_UNDEF']);

      pass('var obj pattern baseline ident with default, rhs undefined, fail 2', () => {
        // Throws because you cannot destruct undefined
        const {x = 1} = undefined;
        x === 'x';
      }, ['PROP_ON_NULL_UNDEF', 'POLY_PRIMITIVES']);

      pass('var obj pattern baseline ident with default, rhs undefined, fail 3', () => {
        // Throws because you cannot destruct undefined
        const {x = 1} = undefined;
        x === undefined; // Our model will issue a lint warning and return undefined for trying.
      }, ['PROP_ON_NULL_UNDEF', 'POLY_PRIMITIVES']);
    });

    pass('var obj pattern nested object pass', () => {
      const obj = {x: {y: 1}};
      const {x: {y}} = obj;
      y === 1;
    });

    pass('var obj pattern nested object fail', () => {
      const {x: {y}} = {x: {y: 1}};
      y === 'x';
    }, ['POLY_PRIMITIVES']);

    pass('var obj pattern nested object with default pass', () => {
      const {x: {y = 1}} = {x: {}};
      y === 1;
    }, ['PROP_NOT_FOUND_HAS_DEFAULT']);

    pass('var obj pattern nested object with default fail', () => {
      const {x: {y = 1}} = {x: {}};
      y === 'x';
    }, ['PROP_NOT_FOUND_HAS_DEFAULT', 'POLY_PRIMITIVES']);

    pass('var obj pattern nested array pass', () => {
      const {x: [y]} = {x: [1]};
      y === 1;
    }, ['ARRAY_PATTERN_UNSOUND']);

    pass('var obj pattern nested array fail', () => {
      const {x: [y]} = {x: [1]};
      y === 'x';
    }, ['ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

    pass('var obj pattern nested array with default pass', () => {
      const {x: [y = 1]} = {x: []};
      y === 1;
    }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET']);

    pass('var obj pattern nested array with default fail', () => {
      const {x: [y = 1]} = {x: []};
      y === 'x';
    }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET', 'POLY_PRIMITIVES']);

    group('rest', () => {
      pass('var obj pattern rest, pass', () => {
        const {...a} = {a: 1};
        a === {a: 2};
      }, []);

      pass('var obj pattern rest, fail', () => {
        const {...a} = {a: 1};
        a === {a: 'x'};
      }, ['POLY_PRIMITIVES']);

      pass('var obj pattern ident and rest, pass', () => {
        const {b, ...a} = {a: 1, b: 2};
        b === 1;
        a === {a: 1};
      }, []);

      pass('var obj pattern ident and rest, fail 1', () => {
        const {b, ...a} = {a: 1, b: 2};
        b === 'x';
      }, ['POLY_PRIMITIVES']);

      pass('var obj pattern ident and rest, fail 2', () => {
        const {b, ...a} = {a: 1, b: 2};
        a === {a: 'x'};
      }, ['POLY_PRIMITIVES']);

      pass('var obj pattern rest empty, pass', () => {
        const {...a} = {};
        a === {};
      }, []);

      pass('var obj pattern rest undefined, pass', () => {
        const {...a} = undefined;
        a === {};
      }, ['PROP_ON_NULL_UNDEF']);
    });

    group('nested obj rest', () => {
      pass('var obj pattern nested obj rest, pass', () => {
        const {x: {...a}} = {x: {a: 1}};
        a === {a: 2};
      }, []);

      pass('var obj pattern nested obj rest, fail', () => {
        const {x: {...a}} = {x: {a: 1}};
        a === {a: 'x'};
      }, ['POLY_PRIMITIVES']);

      pass('var obj pattern ident and nested obj rest, pass', () => {
        const {x: {b, ...a}} = {x: {a: 1, b: 2}};
        b === 1;
        a === {a: 1};
      }, []);

      pass('var obj pattern ident and nested obj rest, fail 1', () => {
        const {x: {b, ...a}} = {x: {a: 1, b: 2}};
        b === 'x';
      }, ['POLY_PRIMITIVES']);

      pass('var obj pattern ident and nested obj rest, fail 2', () => {
        const {x: {b, ...a}} = {x: {a: 1, b: 2}};
        a === {a: 'x'};
      }, ['POLY_PRIMITIVES']);

      pass('var obj pattern nested rest nested obj empty, pass', () => {
        const {x: {...a}} = {x: {}};
        a === {};
      }, []);

      pass('var obj pattern nested obj rest empty, pass', () => {
        const {x: {...a}} = {};
        a === {};
      }, ['PROP_NOT_FOUND', 'PROP_ON_NULL_UNDEF']);

      pass('var obj pattern nested obj rest undefined, pass', () => {
        const {x: {...a}} = undefined;
        a === {};
      }, ['PROP_ON_NULL_UNDEF', 'PROP_ON_NULL_UNDEF']);
    });

    group('nested arr rest', () => {
      pass('var obj pattern nested arr rest, pass', () => {
        const {x: [...a]} = {x: [1]};
        a === [2];
      }, ['ARRAY_PATTERN_UNSOUND']);

      pass('var obj pattern nested arr rest, fail', () => {
        const {x: [...a]} = {x: [1]};
        a === ['x'];
      }, ['ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

      pass('var obj pattern ident and nested arr rest, pass', () => {
        const {x: [b, ...a]} = {x: [10, 20]};
        b === 1;
        a === [1];
      }, ['ARRAY_PATTERN_UNSOUND']);

      pass('var obj pattern ident and nested arr rest, fail 1', () => {
        const {x: [b, ...a]} = {x: [10, 20]};
        b === 'x';
      }, ['ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

      pass('var obj pattern ident and nested arr rest, fail 2', () => {
        const {x: [b, ...a]} = {x: [10, 20]};
        a === ['x'];
      }, ['ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

      pass('var obj pattern nested rest nested arr empty, pass', () => {
        const {x: [...a]} = {x: []};
        a === [undefined];
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET']);

      pass('var obj pattern nested arr rest empty, pass', () => {
        const {x: [...a]} = {};
        a === [undefined];
      }, ['ARRAY_PATTERN_UNSOUND', 'PROP_NOT_FOUND', 'ARRAY_KIND']);

      pass('var obj pattern nested arr rest undefined, pass', () => {
        const {x: [...a]} = undefined;
        a === [undefined];
      }, ['ARRAY_PATTERN_UNSOUND', 'PROP_ON_NULL_UNDEF', 'ARRAY_KIND']);
    });


    group('destructuring var binding', () => {
      group('let obj destructuring obj with default', () => {
        pass('let obj destructuring obj with default, prop is not binding, unused', () => {
          let c = 3;
          let d = {
            a: 1,
          };
          let {
            a: b = c,
          } = d;
        });

        pass('let obj destructuring obj with default, prop is not binding, pass', () => {
          let c = 3;
          let d = {
            a: 1,
          };
          let {
            a: b = c,
          } = d;

          b === 2
        });

        pass('let obj destructuring obj with default, prop is not binding, fail', () => {
          let c = 3;
          let d = {
            a: 1,
          };
          let {
            a: b = c,
          } = d;

          b === 'foo'
        }, ['POLY_PRIMITIVES']);
      });

      group('let obj destructuring empty obj with default', () => {
        pass('let obj destructuring empty obj with default, prop is not binding, unused', () => {
          let c = 3;
          let d = {};
          let {
            a: b = c,
          } = d;
        }, ['PROP_NOT_FOUND_HAS_DEFAULT']);

        pass('let obj destructuring empty obj with default, prop is not binding, pass', () => {
          let c = 3;
          let d = {};
          let {
            a: b = c,
          } = d;

          b === 2
        }, ['PROP_NOT_FOUND_HAS_DEFAULT']);

        pass('let obj destructuring empty obj with default, prop is not binding, fail', () => {
          let c = 3;
          let d = {};
          let {
            a: b = c,
          } = d;

          b === 'foo'
        }, ['PROP_NOT_FOUND_HAS_DEFAULT', 'POLY_PRIMITIVES']);
      });

      pass('let obj destructuring should ignore properties that are not bindings', () => {
        let a = 1; // <-- should be fine and not clash with the destructuring.
        let c = 3;
        let d = {};
        let {
          a: b = c,
        } = d;
      }, ['PROP_NOT_FOUND_HAS_DEFAULT']);
    });
  });

  group('arr pattern', () => {
    // const [ x       ] = []
    // const [ x = y   ] = []
    // const [ []      ] = []
    // const [ [] = y  ] = []
    // const [ {}      ] = []
    // const [ {} = y  ] = []
    // const [ ...x    ] = []
    // const [ y, ...x ] = []

    pass('var arr pattern baseline ident pass', () => {
      const [x] = [1];
      x === 1;
    }, ['ARRAY_PATTERN_UNSOUND']);

    pass('var arr pattern baseline ident fail', () => {
      const [x] = [1];
      x === 'x';
    }, ['ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

    pass('var arr pattern baseline ident empty', () => {
      const [x] = [];
      x === undefined;
    }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET']);

    group('with default', () => {
      pass('var arr pattern baseline ident with default, rhs has it, pass', () => {
        const [x = 1] = [1];
        x === 1;
      }, ['ARRAY_PATTERN_UNSOUND']);

      pass('var arr pattern baseline ident with default, rhs has it, fail', () => {
        const [x = 1] = [1];
        x === 'x';
      }, ['ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

      pass('var arr pattern baseline ident with default, rhs empty, pass', () => {
        const [x = 1] = [];
        x === 1;
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET']);

      pass('var arr pattern baseline ident with default, rhs empty, fail', () => {
        const [x = 1] = [];
        x === 'x';
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET', 'POLY_PRIMITIVES']);

      pass('var arr pattern baseline ident with default, rhs undefined, fail 1', () => {
        // Throws because you cannot destruct undefined
        const [x = 1] = undefined;
        x === 1;
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND']);

      pass('var arr pattern baseline ident with default, rhs undefined, fail 2', () => {
        // Throws because you cannot destruct undefined
        const [x = 1] = undefined;
        x === 'x';
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND', 'POLY_PRIMITIVES']);

      pass('var arr pattern baseline ident with default, rhs undefined, fail 3', () => {
        // Throws because you cannot destruct undefined
        const [x = 1] = undefined;
        x === undefined; // Our model will issue a lint warning and return undefined for trying.
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND', 'POLY_PRIMITIVES']);
    });

    pass('var arr pattern nested object pass', () => {
      const [{y}] = [{y: 1}];
      y === 1;
    }, ['ARRAY_PATTERN_UNSOUND']);

    pass('var arr pattern nested object fail', () => {
      const [{y}] = [{y: 1}];
      y === 'x';
    }, ['ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

    pass('var arr pattern nested object with default pass', () => {
      const [{y = 1}] = [{}];
      y === 1;
    }, ['ARRAY_PATTERN_UNSOUND', 'PROP_NOT_FOUND_HAS_DEFAULT']);

    pass('var arr pattern nested object with default fail', () => {
      const [{y = 1}] = [{}];
      y === 'x';
    }, ['ARRAY_PATTERN_UNSOUND', 'PROP_NOT_FOUND_HAS_DEFAULT', 'POLY_PRIMITIVES']);

    pass('var arr pattern nested array pass', () => {
      const [[y = 1]] = [[1]];
      y === 1;
    }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_PATTERN_UNSOUND']);

    pass('var arr pattern nested array fail', () => {
      const [[y = 1]] = [[1]];
      y === 'x';
    }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

    pass('var arr pattern nested array with default pass', () => {
      const [[y = 1]] = [[]];
      y === 1;
    }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET']);

    pass('var arr pattern nested array with default fail', () => {
      const [[y = 1]] = [[]];
      y === 'x';
    }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET', 'POLY_PRIMITIVES']);

    group('rest', () => {
      pass('var arr pattern rest, pass', () => {
        const [...a] = [1];
        a === [1];
      }, ['ARRAY_PATTERN_UNSOUND']);

      pass('var arr pattern rest, fail', () => {
        const [...a] = [1];
        a === ['x'];
      }, ['ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

      pass('var arr pattern ident and rest, pass', () => {
        const [x, ...a] = [1];
        x === 1;
        a === [1];
      }, ['ARRAY_PATTERN_UNSOUND']);

      pass('var arr pattern ident and rest, fail 1', () => {
        const [x, ...a] = [1];
        x === 'x';
      }, ['ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

      pass('var arr pattern ident and rest, fail 2', () => {
        const [x, ...a] = [1];
        a === ['x'];
      }, ['ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

      pass('var arr pattern rest empty, pass', () => {
        const [...a] = [];
        a === [undefined];
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET']);

      pass('var arr pattern rest empty, fail', () => {
        // can we support this? Technically this isn't so bad. We'd have to merge the undetermined kinds expicitly,
        // rather than sealing them to undefined (which is causing the poly with string)
        const [...a] = [];
        a === ['x'];
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET', 'POLY_PRIMITIVES']);

      pass('var arr pattern rest undefined, pass', () => {
        const [...a] = [];
        a === [undefined];
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET']);
    });

    group('nested arr rest', () => {
      pass('var arr pattern nested arr rest, pass', () => {
        const [[...a]] = [[1]];
        a === [1];
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_PATTERN_UNSOUND']);

      pass('var arr pattern nested arr rest, fail', () => {
        const [[...a]] = [[1]];
        a === ['x'];
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

      pass('var arr pattern ident and nested arr rest, pass', () => {
        const [[x, ...a]] = [[1]];
        x === 1;
        a === [1];
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_PATTERN_UNSOUND']);

      pass('var arr pattern ident and nested arr rest, fail 1', () => {
        const [[x, ...a]] = [[1]];
        x === 'x';
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

      pass('var arr pattern ident and nested arr rest, fail 2', () => {
        const [[x, ...a]] = [[1]];
        a === ['x'];
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

      pass('var arr pattern nested arr rest nested empty, pass', () => {
        const [[...a]] = [[]];
        a === [undefined];
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET']);

      pass('var arr pattern nested arr rest nested empty, fail', () => {
        const [[...a]] = [[]];
        a === ['x'];
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET', 'POLY_PRIMITIVES']);

      pass('var arr pattern nested arr rest empty, pass', () => {
        const [[...a]] = [];
        a === [undefined];
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET', 'ARRAY_KIND']);

      pass('var arr pattern nested arr rest empty, fail', () => {
        const [[...a]] = [];
        a === ['x'];
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET', 'ARRAY_KIND', 'POLY_PRIMITIVES']);

      pass('var arr pattern nested arr rest undefined, pass', () => {
        const [[...a]] = undefined;
        a === [undefined];
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND', 'ARRAY_KIND']);

      pass('var arr pattern nested arr rest undefined, fail', () => {
        const [[...a]] = undefined;
        a === ['x'];
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND', 'ARRAY_KIND', 'POLY_PRIMITIVES']);
    });

    group('nested obj rest', () => {
      pass('var arr pattern nested obj rest, pass', () => {
        const [{...a}] = [{x: 1}];
        a === {x: 1};
      }, ['ARRAY_PATTERN_UNSOUND']);

      pass('var arr pattern nested obj rest, fail', () => {
        const [{...a}] = [{x: 1}];
        a === {x: 'x'};
      }, ['ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

      pass('var arr pattern ident and nested obj rest, pass', () => {
        const [{x, ...a}] = [{x: 1, y: 2}];
        x === 10;
        a === {y: 20};
      }, ['ARRAY_PATTERN_UNSOUND']);

      pass('var arr pattern ident and nested obj rest, fail 1', () => {
        const [{x, ...a}] = [{x: 1, y: 2}];
        x === 'x';
      }, ['ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

      pass('var arr pattern ident and nested obj rest, fail 2', () => {
        const [{x, ...a}] = [{x: 1, y: 2}];
        a === {y: 'x'};
      }, ['ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

      pass('var arr pattern nested obj rest nested empty, pass', () => {
        const [{...a}] = [{}];
        a === {};
      }, ['ARRAY_PATTERN_UNSOUND']);

      pass('var arr pattern nested obj rest empty, pass', () => {
        const [{...a}] = [];
        a === {};
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET', 'PROP_ON_NULL_UNDEF']);

      pass('var arr pattern nested obj rest undefined, pass', () => {
        const [{...a}] = undefined;
        a === {};
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND', 'PROP_ON_NULL_UNDEF']);
    });
  });
});
