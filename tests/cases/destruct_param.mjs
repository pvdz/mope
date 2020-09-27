import {pass, only, skip, group} from '../utils.mjs';

export const destruct_param = () => group('destruct_param', () => {
  // const arrow = (  [x]          ) => {}
  // const arrow = (  [x = y]      ) => {}
  // const arrow = (  [x: []]      ) => {}
  // const arrow = (  [x: [] = y]  ) => {}
  // const arrow = (  [x: {}]      ) => {}
  // const arrow = (  [x: {} = y]  ) => {}
  // const arrow = (  [...x]       ) => {}

  group('param arr pattern', () => {
    group('param arr pattern without default', () => {
      // const arrow = (  [x]          ) => {}
      pass('param arr pattern base', () => {
        function f([x]) {}
        f([1]);
      }, ['ARRAY_PATTERN_UNSOUND']);

      pass('param arr pattern without default', () => {
        function f([x]) {
          return x;
        }
        f([1]) === 1;
      }, ['ARRAY_PATTERN_UNSOUND']);

      pass('param arr pattern without default bad', () => {
        function f([x]) {
          return x;
        }
        f([1]) === 'x';
      }, ['ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

      pass('param arr pattern without default no arg', () => {
        function f([x]) {
          return x;
        }
        f() === undefined;
      }, ['ARRAY_PATTERN_UNSOUND', 'CALL_ARG_ARITY', 'ARRAY_KIND']);

      pass('param arr pattern without default no arg bad', () => {
        function f([x]) {
          return x;
        }
        f() === 1;
      }, ['ARRAY_PATTERN_UNSOUND', 'CALL_ARG_ARITY', 'ARRAY_KIND', 'POLY_PRIMITIVES']);

      pass('param arr pattern without default empty arg', () => {
        function f([x]) {
          return x;
        }
        f([]) === undefined;
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET']);

      pass('param arr pattern without default empty arg bad', () => {
        function f([x]) {
          return x;
        }
        f([]) === 1;
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET', 'POLY_PRIMITIVES']);
    });

    group('param arr pattern with param default', () => {
      // const arrow = (  [x]=y          ) => {}
      pass('param arr pattern with param default unchecked', () => {
        function f([x] = [1]) {}
        f([1]);
      }, ['ARRAY_PATTERN_UNSOUND']);

      pass('param arr pattern with param default', () => {
        function f([x] = [1]) {
          return x;
        }
        f([1]) === 1;
      }, ['ARRAY_PATTERN_UNSOUND']);

      pass('param arr pattern with param default bad', () => {
        function f([x] = [1]) {
          return x;
        }
        f([1]) === 'x';
      }, ['ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

      pass('param arr pattern with param default no arg', () => {
        function f([x] = [1]) {
          return x;
        }
        f() === 1; // The arg should get the default so x becomes 1 from the default value
      }, ['ARRAY_PATTERN_UNSOUND']);

      pass('param arr pattern with param default no arg bad', () => {
        function f([x] = [1]) {
          return x;
        }
        f() === undefined;
      }, ['ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

      pass('param arr pattern with param default empty arg', () => {
        function f([x] = [1]) {
          return x;
        }
        f([]) === undefined;
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET']);

      pass('param arr pattern with param default empty arg bad', () => {
        function f([x] = [1]) {
          return x;
        }
        f([]) === 1;
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET', 'POLY_PRIMITIVES']);
    });

    group('param arr pattern with pattern default', () => {
      // const arrow = (  [x]=y          ) => {}
      pass('param arr pattern with pattern default unchecked', () => {
        function f([x = 1]) {}
        f([1]);
      }, ['ARRAY_PATTERN_UNSOUND']);

      pass('param arr pattern with pattern default', () => {
        function f([x = 1]) {
          return x;
        }
        f([1]) === 1;
      }, ['ARRAY_PATTERN_UNSOUND']);

      pass('param arr pattern with pattern default bad', () => {
        function f([x = 1]) {
          return x;
        }
        f([1]) === 'x';
      }, ['ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

      pass('param arr pattern with pattern default no arg', () => {
        function f([x = 1]) {
          return x;
        }
        f() === 1; // Note: this crashes because it'll try to destructure `undefined`
      }, ['ARRAY_PATTERN_UNSOUND', 'CALL_ARG_ARITY', 'ARRAY_KIND']);

      pass('param arr pattern with pattern default no arg bad', () => {
        function f([x = 1]) {
          return x;
        }
        f() === undefined; // Note: this crashes because it'll try to destructure `undefined`
      }, ['ARRAY_PATTERN_UNSOUND', 'CALL_ARG_ARITY', 'ARRAY_KIND', 'POLY_PRIMITIVES']);

      pass('param arr pattern with pattern default empty arg', () => {
        function f([x = 1]) {
          return x;
        }
        f([]) === 1;
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET']);

      pass('param arr pattern with pattern default empty arg bad', () => {
        function f([x = 1]) {
          return x;
        }
        f([]) === undefined;
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET', 'POLY_PRIMITIVES']);
    });

    group('param arr pattern with param and pattern default', () => {
      // const arrow = (  [x]=y          ) => {}
      pass('param arr pattern with param and pattern default unchecked', () => {
        function f([x = 1] = [2]) {}
        f([1]);
      }, ['ARRAY_PATTERN_UNSOUND']);

      pass('param arr pattern with param and pattern default', () => {
        function f([x = 1] = [2]) {
          return x;
        }
        f([1]) === 1;
      }, ['ARRAY_PATTERN_UNSOUND']);

      pass('param arr pattern with param and pattern default bad', () => {
        function f([x = 1] = [2]) {
          return x;
        }
        f([1]) === 'x';
      }, ['ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

      pass('param arr pattern with param and pattern default no arg', () => {
        function f([x = 1] = [2]) {
          return x;
        }
        f() === 1; // Will crash because it tries to desturcture `undefined`
      }, ['ARRAY_PATTERN_UNSOUND']);

      pass('param arr pattern with param and pattern default no arg bad', () => {
        function f([x = 1] = [2]) {
          return x;
        }
        f() === undefined; // Will crash because it tries to desturcture `undefined`
      }, ['ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

      pass('param arr pattern with param and pattern default empty arg', () => {
        function f([x = 1] = [2]) {
          return x;
        }
        f([]) === 1;
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET']);

      pass('param arr pattern with param and pattern default empty arg bad', () => {
        function f([x = 1] = [2]) {
          return x;
        }
        f([]) === undefined;
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET', 'POLY_PRIMITIVES']);
    });

    group('param arr pattern with object', () => {
      group('param arr pattern with shorthand object', () => {
        pass('param arr pattern with shorthand object unchecked', () => {
          function f([{x}]) {}
          f([{x: 1}]);
        }, ['ARRAY_PATTERN_UNSOUND']);

        pass('param arr pattern with shorthand object checked', () => {
          function f([{x}]) {
            return x
          }
          f([{x: 1}]) === 1
        }, ['ARRAY_PATTERN_UNSOUND']);

        pass('param arr pattern with shorthand object checked bad', () => {
          function f([{x}]) {
            return x
          }
          f([{x: 1}]) === 'x'
        }, ['ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

        pass('param arr pattern with shorthand object ident default checked', () => {
          function f([{x = 1}]) {
            return x
          }
          f([{}]) === 1
        }, ['ARRAY_PATTERN_UNSOUND', 'PROP_NOT_FOUND_HAS_DEFAULT']);

        pass('param arr pattern with shorthand object ident default checked bad', () => {
          function f([{x = 1}]) {
            return x
          }
          f([{}]) === 'x'
        }, ['ARRAY_PATTERN_UNSOUND', 'PROP_NOT_FOUND_HAS_DEFAULT', 'POLY_PRIMITIVES']);

        pass('param arr pattern with shorthand object pattern default checked', () => {
          function f([{x} = {x: 1}]) {
            return x
          }
          f([]) === 1 // [] means the default is triggered so f should return 1 so this passes
        }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET']);

        pass('param arr pattern with shorthand object pattern default checked bad', () => {
          function f([{x} = {x: 1}]) {
            return x
          }
          f([]) === 'x'
        }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET', 'POLY_PRIMITIVES']);

        pass('param arr pattern with shorthand object param default checked', () => {
          function f([{x}] = [{x: 1}]) {
            return x
          }
          f() === 1
        }, ['ARRAY_PATTERN_UNSOUND']);

        pass('param arr pattern with shorthand object param default checked bad', () => {
          function f([{x}] = [{x: 1}]) {
            return x
          }
          f() === 'x'
        }, ['ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);
      })

      group('param arr pattern with alias object', () => {
        pass('param arr pattern with alias object unchecked', () => {
          function f([{a: x}]) {}
          f([{a: 1}]);
        }, ['ARRAY_PATTERN_UNSOUND']);

        pass('param arr pattern with alias object checked', () => {
          function f([{a: x}]) {
            return x
          }
          f([{a: 1}]) === 1
        }, ['ARRAY_PATTERN_UNSOUND']);

        pass('param arr pattern with alias object checked bad', () => {
          function f([{a: x}]) {
            return x
          }
          f([{a: 1}]) === 'x'
        }, ['ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

        pass('param arr pattern with alias object ident default checked', () => {
          function f([{a: x = 1}]) {
            return x
          }
          f([{}]) === 1
        }, ['ARRAY_PATTERN_UNSOUND', 'PROP_NOT_FOUND_HAS_DEFAULT']);

        pass('param arr pattern with alias object ident default checked bad', () => {
          function f([{a: x = 1}]) {
            return x
          }
          f([{}]) === 'x'
        }, ['ARRAY_PATTERN_UNSOUND', 'PROP_NOT_FOUND_HAS_DEFAULT', 'POLY_PRIMITIVES']);

        pass('param arr pattern with alias object pattern default checked', () => {
          function f([{a: x} = {a: 1}]) {
            return x
          }
          f([]) === 1
        }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET']);

        pass('param arr pattern with alias object pattern default checked bad', () => {
          function f([{a: x} = {a: 1}]) {
            return x
          }
          f([]) === 'x'
        }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET', 'POLY_PRIMITIVES']);

        pass('param arr pattern with alias object param default checked', () => {
          function f([{a: x}] = [{a: 1}]) {
            return x
          }
          f() === 1
        }, ['ARRAY_PATTERN_UNSOUND']);

        pass('param arr pattern with alias object param default checked bad', () => {
          function f([{a: x}] = [{a: 1}]) {
            return x
          }
          f() === 'x'
        }, ['ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);
      })
    });

    group('param arr pattern with arr', () => {
      pass('param arr pattern with arr unchecked', () => {
        function f([[x]]) {}
        f([[1]]);
      }, ['ARRAY_PATTERN_UNSOUND']);

      pass('param arr pattern with arr checked', () => {
        function f([[x]]) {
          return x
        }
        f([[1]]) === 1
      }, ['ARRAY_PATTERN_UNSOUND']);

      pass('param arr pattern with arr checked bad', () => {
        function f([[x]]) {
          return x
        }
        f([[1]]) === 'x'
      }, ['ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

      pass('param arr pattern with arr ident default checked', () => {
        function f([[x = 1]]) {
          return x
        }
        f([[]]) === 1
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET']);

      pass('param arr pattern with arr ident default checked bad', () => {
        function f([[x = 1]]) {
          return x
        }
        f([[]]) === 'x'
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET', 'POLY_PRIMITIVES']);

      pass('param arr pattern with arr pattern default checked', () => {
        function f([[x] = [1]]) {
          return x
        }
        f([]) === 1
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET']);

      pass('param arr pattern with arr pattern default checked bad', () => {
        function f([[x] = [1]]) {
          return x
        }
        f([]) === 'x'
      }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND_READ_BUT_UNDET', 'POLY_PRIMITIVES']);

      pass('param arr pattern with arr param default checked', () => {
        function f([[x] = [1]]) {
          return x
        }
        f() === 1
      }, ['ARRAY_PATTERN_UNSOUND', 'CALL_ARG_ARITY', 'ARRAY_KIND']);

      pass('param arr pattern with arr param default checked bad', () => {
        function f([[x] = [1]]) {
          return x
        }
        f() === 'x'
      }, ['ARRAY_PATTERN_UNSOUND', 'CALL_ARG_ARITY', 'ARRAY_KIND', 'POLY_PRIMITIVES']);
    })

  });

  group('param obj pattern', () => {
    group('param obj flat pattern shorthand', () => {
      group('param obj pattern shorthand without default', () => {
        // const arrow = (  {x}          ) => {}
        pass('param obj pattern shorthand one prop, base', () => {
          function f({x}) {}
          f({x: 1});
        });

        pass('param obj pattern shorthand one prop', () => {
          function f({x}) {
            return x;
          }
          f({x: 1}) === 1;
        });

        pass('param obj pattern shorthand one prop (counter)', () => {
          function f({x}) {
            return x;
          }
          f({x: 1}) === 'x';
        }, ['POLY_PRIMITIVES']);

        pass('param obj pattern shorthand one prop without arg', () => {
          function f({x}) {
            return x;
          }
          f();
        }, ['CALL_ARG_ARITY', 'PROP_ON_NULL_UNDEF']);

        pass('param obj pattern shorthand one prop without arg should return undefined', () => {
          function f({x}) {
            return x;
          }
          f() === undefined;
        }, ['CALL_ARG_ARITY', 'PROP_ON_NULL_UNDEF']);

        pass('param obj pattern shorthand one prop with empty obj arg', () => {
          function f({x}) {
            return x;
          }
          f({}); // Wont have x
        }, ['PROP_NOT_FOUND']);

        pass('param obj pattern shorthand one prop with empty obj arg, checked', () => {
          function f({x}) {
            return x;
          }
          f({}) === undefined; // Wont have x
        }, ['PROP_NOT_FOUND']);

        pass('param obj pattern shorthand one prop with empty obj arg, checked (counter)', () => {
          function f({x}) {
            return x;
          }
          f({}) === 1; // Wont have x, should be undefined
        }, ['PROP_NOT_FOUND', 'POLY_PRIMITIVES']);
      });

      group('param obj pattern shorthand with param default', () => {
        // const arrow = (  {x}=z          ) => {}

        pass('param obj pattern shorthand default with prop', () => {
          function f({x} = {x: 1}) {}
          f();
        });

        pass('param obj pattern shorthand default with prop, checked', () => {
          function f({x} = {x: 1}) {
            return x;
          }
          f() === 1;
        });

        pass('param obj pattern shorthand default with prop, checked (counter)', () => {
          function f({x} = {x: 1}) {
            return x;
          }
          f() === 'x';
        }, ['POLY_PRIMITIVES']);

        pass('param obj pattern shorthand default not used', () => {
          function f({x} = {x: 1}) {
            return x;
          }
          f(1);
        }, ['UNUSED_DEFAULT_ARG_POLY', 'PROP_NOT_FOUND']);

        pass('param obj pattern shorthand default not used, checked', () => {
          function f({x} = {x: 1}) {
            return x;
          }
          f(1) === undefined;
        }, ['UNUSED_DEFAULT_ARG_POLY', 'PROP_NOT_FOUND']);

        pass('param obj pattern shorthand default not used, checked (counter)', () => {
          function f({x} = {x: 1}) {
            return x;
          }
          f(1) === 1;
        }, ['UNUSED_DEFAULT_ARG_POLY', 'PROP_NOT_FOUND', 'POLY_PRIMITIVES']);
      });

      group('param obj pattern shorthand with pattern default', () => {
        // const arrow = (  {x=z}          ) => {}

        pass('param obj pattern shorthand default with prop default', () => {
          function f({x= 1}) {
            return x;
          }
          f({});
        }, ['PROP_NOT_FOUND_HAS_DEFAULT']);

        pass('param obj pattern shorthand default with prop default, checked', () => {
          function f({x= 1}) {
            return x;
          }
          f({}) === 1;
        }, ['PROP_NOT_FOUND_HAS_DEFAULT']);

        pass('param obj pattern shorthand default with prop default, checked (counter)', () => {
          function f({x= 1}) {
            return x;
          }
          f({}) === 'x';
        }, ['PROP_NOT_FOUND_HAS_DEFAULT', 'POLY_PRIMITIVES']);

        pass('param obj pattern shorthand default prop default on primitive', () => {
          function f({x = 1}) {
            return x;
          }
          f(1);
        }, ['PROP_NOT_FOUND_HAS_DEFAULT']);

        pass('param obj pattern shorthand default not used on primitive, checked', () => {
          function f({x = 1}) {
            return x;
          }
          f(1) === 1;
        }, ['PROP_NOT_FOUND_HAS_DEFAULT']);

        pass('param obj pattern shorthand default not used on primitive, checked (counter)', () => {
          function f({x = 1}) {
            return x;
          }
          f(1) === undefined;
        }, ['PROP_NOT_FOUND_HAS_DEFAULT', 'POLY_PRIMITIVES']);
      });

      group('param obj pattern shorthand with pattern and param default', () => {
        // const arrow = (  {x=z}={x=a}      ) => {}

        pass('param obj pattern shorthand default with unused param and pattern default without props', () => {
          function f({x= 1} = {}) {
            return x;
          }
          f({});
        }, ['PROP_NOT_FOUND_HAS_DEFAULT']);

        pass('param obj pattern shorthand default with unused param and pattern default with props', () => {
          function f({x= 1} = {x: 2}) {
            return x;
          }
          f({});
        }, ['PROP_NOT_FOUND_HAS_DEFAULT']);

        pass('param obj pattern shorthand default with unused param and pattern default with props, sans arg', () => {
          function f({x= 1} = {x: 2}) {
            return x;
          }
          f();
        }, []);

        skip('param obj pattern shorthand default with unused param and pattern default with bad props', () => {
          // fail: v4 cannot detect that the param default would assign a different type to x than the pattern default
          function f({x= 1} = {x: 'y'}) {
            return x;
          }
          f({}); // should use default so x returns a string. but x's own default is different from the param default so it should poly
        }, []);

        pass('param obj pattern shorthand default with used prop default and unused pattern default', () => {
          function f({x= 1} = {x: 2}) {
            return x;
          }
          f() === 1;
        }, []);

        pass('param obj pattern shorthand default with used prop default and used good pattern default', () => {
          function f({x= 1} = {}) {
            return x;
          }
          f() === 1;
        }, ['PROP_NOT_FOUND_HAS_DEFAULT']);

        pass('param obj pattern shorthand default with used prop default and used bad pattern default', () => {
          function f({x= 'x'} = {}) {
            return x;
          }
          f() === 1;
        }, ['PROP_NOT_FOUND_HAS_DEFAULT', 'POLY_PRIMITIVES']);
      });
    });

    group('param obj flat pattern colon', () => {
      group('param obj pattern colon without default', () => {
        // const arrow = (  {a: x}          ) => {}
        pass('param obj pattern colon one prop, base', () => {
          function f({a: x}) {}
          f({a: 1});
        });

        pass('param obj pattern colon one prop', () => {
          function f({a: x}) {
            return x;
          }
          f({a: 1}) === 1;
        });

        pass('param obj pattern colon one prop (counter)', () => {
          function f({a: x}) {
            return x;
          }
          f({a: 1}) === 'x';
        }, ['POLY_PRIMITIVES']);

        pass('param obj pattern colon one prop without arg', () => {
          function f({a: x}) {
            return x;
          }
          f();
        }, ['CALL_ARG_ARITY', 'PROP_ON_NULL_UNDEF']);

        pass('param obj pattern colon one prop without arg should return undefined', () => {
          function f({a: x}) {
            return x;
          }
          f() === undefined;
        }, ['CALL_ARG_ARITY', 'PROP_ON_NULL_UNDEF']);

        pass('param obj pattern colon one prop with empty obj arg', () => {
          function f({a: x}) {
            return x;
          }
          f({}); // Wont have x
        }, ['PROP_NOT_FOUND']);

        pass('param obj pattern colon one prop with empty obj arg, checked', () => {
          function f({a: x}) {
            return x;
          }
          f({}) === undefined; // Wont have x
        }, ['PROP_NOT_FOUND']);

        pass('param obj pattern colon one prop with empty obj arg, checked (counter)', () => {
          function f({a: x}) {
            return x;
          }
          f({}) === 1; // Wont have x, should be undefined
        }, ['PROP_NOT_FOUND', 'POLY_PRIMITIVES']);
      });

      group('param obj pattern colon with param default', () => {
        // const arrow = (  {a: x}=z          ) => {}

        pass('param obj pattern colon default with prop', () => {
          function f({a: x} = {a: 1}) {}
          f();
        });

        pass('param obj pattern colon default with prop, checked', () => {
          function f({a: x} = {a: 1}) {
            return x;
          }
          f() === 1;
        });

        pass('param obj pattern colon default with prop, checked (counter)', () => {
          function f({a: x} = {a: 1}) {
            return x;
          }
          f() === 'x';
        }, ['POLY_PRIMITIVES']);

        pass('param obj pattern colon default not used', () => {
          function f({a: x} = {a: 1}) {
            return x;
          }
          f(1);
        }, ['UNUSED_DEFAULT_ARG_POLY', 'PROP_NOT_FOUND']);

        pass('param obj pattern colon default not used, checked', () => {
          function f({a: x} = {a: 1}) {
            return x;
          }
          f(1) === undefined;
        }, ['UNUSED_DEFAULT_ARG_POLY', 'PROP_NOT_FOUND']);

        pass('param obj pattern colon default not used, checked (counter)', () => {
          function f({a: x} = {a: 1}) {
            return x;
          }
          f(1) === 1;
        }, ['UNUSED_DEFAULT_ARG_POLY', 'PROP_NOT_FOUND', 'POLY_PRIMITIVES']);
      });

      group('param obj pattern colon with pattern default', () => {
        // const arrow = (  {a: x=z}          ) => {}

        pass('param obj pattern colon default with prop default', () => {
          function f({a: x= 1}) {
            return x;
          }
          f({});
        }, ['PROP_NOT_FOUND_HAS_DEFAULT']);

        pass('param obj pattern colon default with prop default, checked', () => {
          function f({a: x= 1}) {
            return x;
          }
          f({}) === 1;
        }, ['PROP_NOT_FOUND_HAS_DEFAULT']);

        pass('param obj pattern colon default with prop default, checked (counter)', () => {
          function f({a: x= 1}) {
            return x;
          }
          f({}) === 'x';
        }, ['PROP_NOT_FOUND_HAS_DEFAULT', 'POLY_PRIMITIVES']);

        pass('param obj pattern colon default prop default on primitive', () => {
          function f({a: x = 1}) {
            return x;
          }
          f(1);
        }, ['PROP_NOT_FOUND_HAS_DEFAULT']);

        pass('param obj pattern colon default not used on primitive, checked', () => {
          function f({a: x = 1}) {
            return x;
          }
          f(1) === 1;
        }, ['PROP_NOT_FOUND_HAS_DEFAULT']);

        pass('param obj pattern colon default not used on primitive, checked (counter)', () => {
          function f({a: x = 1}) {
            return x;
          }
          f(1) === undefined;
        }, ['PROP_NOT_FOUND_HAS_DEFAULT', 'POLY_PRIMITIVES']);
      });

      group('param obj pattern colon with pattern and param default', () => {
        // const arrow = (  {x=z}={x=a}      ) => {}

        pass('param obj pattern colon default with unused param and pattern default without props', () => {
          function f({a: x= 1} = {}) {
            return x;
          }
          f({});
        }, ['PROP_NOT_FOUND_HAS_DEFAULT']);

        pass('param obj pattern colon default with unused param and pattern default with props', () => {
          function f({a: x= 1} = {a: 2}) {
            return x;
          }
          f({});
        }, ['PROP_NOT_FOUND_HAS_DEFAULT']);

        skip('param obj pattern colon default with unused param and pattern default with bad props', () => {
          // fail: v4 cannot detect that the param default would assign a different type to x than the pattern default
          function f({a: x= 1} = {a: 'y'}) {
            return x;
          }
          f({});
        }, ['PROP_NOT_FOUND_HAS_DEFAULT', 'UNUSED_DEFAULT_ARG_POLY']);

        pass('param obj pattern colon default with used prop default and unused pattern default', () => {
          function f({a: x= 1} = {a: 2}) {
            return x;
          }
          f() === 1;
        }, []);

        pass('param obj pattern colon default with used prop default and used good pattern default', () => {
          function f({x= 1} = {}) {
            return x;
          }
          f() === 1;
        }, ['PROP_NOT_FOUND_HAS_DEFAULT']);

        pass('param obj pattern colon default with used prop default and used bad pattern default', () => {
          function f({x= 'x'} = {}) {
            return x;
          }
          f() === 1;
        }, ['PROP_NOT_FOUND_HAS_DEFAULT', 'POLY_PRIMITIVES']);
      });
    });

    group('param obj obj pattern colon', () => {
      group('param obj pattern colon without default', () => {
        // const arrow = (  {a: {}}          ) => {}

        pass('param obj obj pattern, base', () => {
          function f({a: {b}}) {}
          f({a: {b: 1}});
        });

        pass('param obj obj pattern, checked', () => {
          function f({a: {b}}) {
            return b;
          }
          f({a: {b: 1}}) === 1;
        });

        pass('param obj obj pattern, checked bad', () => {
          function f({a: {b}}) {
            return b;
          }
          f({a: {b: 1}}) === 'x';
        }, ['POLY_PRIMITIVES']);

        pass('param obj obj pattern without prop without fallback', () => {
          function f({a: {b}}) {
            return b;
          }
          f({});
        }, ['PROP_NOT_FOUND', 'PROP_ON_NULL_UNDEF']);

        pass('param obj obj pattern without prop with pattern default', () => {
          function f({a: {b} = {b: 1}}) {
            return b;
          }
          f({}) === 1;
        }, ['PROP_NOT_FOUND_HAS_DEFAULT']);

        pass('param obj obj pattern without prop with pattern default bad', () => {
          function f({a: {b} = {b: 1}}) {
            return b;
          }
          f({}) === 'x';
        }, ['PROP_NOT_FOUND_HAS_DEFAULT', 'POLY_PRIMITIVES']);

        pass('param obj obj pattern without prop with param unused default', () => {
          function f({a: {b}} = {a: {b: 1}}) {
            return b;
          }
          f({}) === undefined;
        }, ['PROP_NOT_FOUND', 'PROP_ON_NULL_UNDEF']);

        pass('param obj obj pattern without prop with param unused default bad', () => {
          function f({a: {b}} = {a: {b: 1}}) {
            return b;
          }
          f({}) === 1
        }, ['PROP_NOT_FOUND', 'PROP_ON_NULL_UNDEF', 'POLY_PRIMITIVES']);

        pass('param obj obj pattern without prop with param default', () => {
          function f({a: {b}} = {a: {b: 1}}) {
            return b;
          }
          f() === 1;
        });

        pass('param obj obj pattern without prop with param default bad', () => {
          function f({a: {b}} = {a: {b: 1}}) {
            return b;
          }
          f() === 'x'
        }, ['POLY_PRIMITIVES']);
      });

      group('param obj pattern colon with param default', () => {
        // const arrow = (  {a: x}=z          ) => {}

        pass('param obj pattern colon default with param default with prop', () => {
          function f({a: x} = {a: 1}) {}
          f();
        });

        pass('param obj pattern colon default with param default  prop, checked', () => {
          function f({a: x} = {a: 1}) {
            return x;
          }
          f() === 1;
        });

        pass('param obj pattern colon default with param default prop, checked (counter)', () => {
          function f({a: x} = {a: 1}) {
            return x;
          }
          f() === 'x';
        }, ['POLY_PRIMITIVES']);

        pass('param obj pattern colon default with param default not used', () => {
          function f({a: x} = {a: 1}) {
            return x;
          }
          f(1);
        }, ['UNUSED_DEFAULT_ARG_POLY', 'PROP_NOT_FOUND']);

        pass('param obj pattern colon default with param default not used, checked', () => {
          function f({a: x} = {a: 1}) {
            return x;
          }
          f(1) === undefined;
        }, ['UNUSED_DEFAULT_ARG_POLY', 'PROP_NOT_FOUND']);

        pass('param obj pattern colon default with param default not used, checked (counter)', () => {
          function f({a: x} = {a: 1}) {
            return x;
          }
          f(1) === 1;
        }, ['UNUSED_DEFAULT_ARG_POLY', 'PROP_NOT_FOUND', 'POLY_PRIMITIVES']);
      });

      group('param obj pattern colon with pattern default', () => {
        // const arrow = (  {a: x=z}          ) => {}

        pass('param obj pattern colon with pattern default with prop default', () => {
          function f({a: x= 1}) {
            return x;
          }
          f({});
        }, ['PROP_NOT_FOUND_HAS_DEFAULT']);

        pass('param obj pattern colon with pattern default with prop default, checked', () => {
          function f({a: x= 1}) {
            return x;
          }
          f({}) === 1;
        }, ['PROP_NOT_FOUND_HAS_DEFAULT']);

        pass('param obj pattern colon with pattern default with prop default, checked (counter)', () => {
          function f({a: x= 1}) {
            return x;
          }
          f({}) === 'x';
        }, ['PROP_NOT_FOUND_HAS_DEFAULT', 'POLY_PRIMITIVES']);

        pass('param obj pattern colon with pattern default prop default on primitive', () => {
          function f({a: x = 1}) {
            return x;
          }
          f(1);
        }, ['PROP_NOT_FOUND_HAS_DEFAULT']);

        pass('param obj pattern colon with pattern default not used on primitive, checked', () => {
          function f({a: x = 1}) {
            return x;
          }
          f(1) === 1;
        }, ['PROP_NOT_FOUND_HAS_DEFAULT']);

        pass('param obj pattern colon with pattern default not used on primitive, checked (counter)', () => {
          function f({a: x = 1}) {
            return x;
          }
          f(1) === undefined;
        }, ['PROP_NOT_FOUND_HAS_DEFAULT', 'POLY_PRIMITIVES']);
      });

      group('param obj pattern colon with pattern and param default', () => {
        // const arrow = (  {x:{y}}={x:{y:1}}      ) => {}
        // const arrow = (  {x:{y}={y:1}}          ) => {}

        pass('param obj obj pattern colon default with unused param and pattern default without props', () => {
          function f({a: x= 1} = {}) {
            return x;
          }
          f({});
        }, ['PROP_NOT_FOUND_HAS_DEFAULT']);

        pass('param obj obj pattern colon default with unused param and pattern default with props', () => {
          function f({a: x= 1} = {a: 2}) {
            return x;
          }
          f({});
        }, ['PROP_NOT_FOUND_HAS_DEFAULT']);

        skip('param obj obj pattern colon default with unused param and pattern default with bad props', () => {
          // fail: v4 cannot detect that the param default would assign a different type to x than the pattern default
          function f({a: x= 1} = {a: 'y'}) {
            return x;
          }
          f({});
        }, ['PROP_NOT_FOUND', 'UNUSED_DEFAULT_ARG_POLY']);

        pass('param obj obj pattern colon default with used prop default and unused pattern default', () => {
          function f({a: x= 1} = {a: 2}) {
            return x;
          }
          f() === 1;
        }, []);

        pass('param obj obj pattern colon default with used prop default and used good pattern default', () => {
          function f({x= 1} = {}) {
            return x;
          }
          f() === 1;
        }, ['PROP_NOT_FOUND_HAS_DEFAULT']);

        pass('param obj obj pattern colon default with used prop default and used bad pattern default', () => {
          function f({x= 'x'} = {}) {
            return x;
          }
          f() === 1;
        }, ['PROP_NOT_FOUND_HAS_DEFAULT', 'POLY_PRIMITIVES']);
      });
    });
  });

  group('param rest pattern', () => {
    pass('param rest pattern arr base unchecked', () => {
      function f([...x]) {}
    }, ['ARRAY_PATTERN_UNSOUND']);

    pass('param rest pattern arr base checked', () => {
      function f([...x]) {
        return x
      }
      f([1, 2]) === [3]
    }, ['ARRAY_PATTERN_UNSOUND']);

    pass('param rest pattern arr base checked bad', () => {
      function f([...x]) {
        return x
      }
      f([1, 2]) === [3]
    }, ['ARRAY_PATTERN_UNSOUND']);

    pass('param rest pattern obj base unchecked', () => {
      function f({...x}) {}
    });

    pass('param rest pattern obj base checked', () => {
      function f({...x}) {
        return x
      }
      f({x: 1}) === {x: 2}
    });

    pass('param rest pattern obj base checked bad', () => {
      function f([...x]) {
        return x
      }
      f([1, 2]) === [3]
    }, ['ARRAY_PATTERN_UNSOUND']);

    group('param obj pattern with prop and rest', () => {
      pass('param obj pattern with prop and rest, uncalled', () => {
        function playActionFunc({x, ...rest}) {}
      });

      pass('param obj pattern with prop and rest, pass', () => {
        function playActionFunc({a, ...rest}) { return {a, rest}; }
        playActionFunc({a: 1, b: 2}) === {a: 2, rest: {b: 3}};
      });

      pass('param obj pattern with prop and rest, fail 1', () => {
        function playActionFunc({a, ...rest}) { return {a, rest}; }
        playActionFunc({a: 1, b: 2}) === {a: "x", rest: {b: 3}};
      }, ['POLY_PRIMITIVES']);

      pass('param obj pattern with prop and rest, fail 2', () => {
        function playActionFunc({a, ...rest}) { return {a, rest}; }
        playActionFunc({a: 1, b: 2}) === {a: 2, rest: {b: "x"}};
      }, ['POLY_PRIMITIVES']);

      pass('param obj pattern with prop and rest, fail 3', () => {
        function playActionFunc({a, ...rest}) { return {a, rest}; }
        playActionFunc({a: 1, b: 2}) === {a: 2, rest: []};
      }, ['POLY_OTHER', 'TOFIX']);
    });
  });

  group('param nested rest pattern', () => {
    pass('param rest pattern obj in arr base unchecked', () => {
      function f([{...x}]) {}
    }, ['ARRAY_PATTERN_UNSOUND']);

    pass('param rest pattern obj in arr base checked', () => {
      function f([{...x}]) {
        return x
      }
      f([{a: 1, b: 2}]) === {a: 10, b: 20}
    }, ['ARRAY_PATTERN_UNSOUND']);

    pass('param rest pattern obj in arr base checked bad', () => {
      function f([{...x}]) {
        return x
      }
      f([{a: 1, b: 2}]) === {a: 'x', b: 20}
    }, ['ARRAY_PATTERN_UNSOUND', 'POLY_PRIMITIVES']);

    pass('param rest pattern obj in arr passing on a number to an obj rest', () => {
      function f([{...x}]) {
        return x
      }
      f([1, 2]) === {}
    }, ['ARRAY_PATTERN_UNSOUND', 'OBJ_REST_ON_PRIMITIVE']);

    pass('param rest pattern arr in arr passing on a number to an arr rest', () => {
      function f([[...x]]) {
        return x
      }
      f([1, 2]) === [undefined] // it'll be undefined because it can't get a `kind` from a number
    }, ['ARRAY_PATTERN_UNSOUND', 'ARRAY_KIND']);

    pass('param rest pattern arr in obj base unchecked', () => {
      function f({a: [...x]}) {}
    });

    pass('param rest pattern arr in obj base checked', () => {
      function f({a: [...x]}) {
        return x
      }
      f({a: [1]}) === [2]
    });

    pass('param rest pattern arr in obj base checked bad', () => {
      function f({a: [...x]}) {
        return x
      }
      f({a: [1]}) === ['a']
    }, ['POLY_PRIMITIVES']);
  });

  // const arrow = (  {x: []}      ) => {}
  // const arrow = (  {x: [] = y}  ) => {}
  // const arrow = (  {...x}       ) => {}

});
