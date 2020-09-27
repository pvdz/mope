import {pass, only, skip, group} from '../utils.mjs';

export const plus = () => group('plus', () => {

  pass('basis number', () => {
    1 + 2
  });

  pass('basis string', () => {
    'x' + 'y'
  });

  pass('basis mixed string number', () => {
    'x' + 1
  }, ['PLUS_MERGE_NUM_STR']);

  pass('basis mixed number string', () => {
    1 + 'x'
  }, ['PLUS_MERGE_NUM_STR']);

  group('plussing uninitialized vars', () => {
    pass('first unknown addition then refined to string', () => {
      let x = '', y = '';
      x + y;
      x + "";
      x + 'foo'; // pass
    });

    pass('must have init', () => {
      let x, y;
      x + y;
      x + "";
      x + 'foo'; // fail
    }, ['BINDING_NO_INIT', 'BINDING_NO_INIT', 'PLUS_MERGE_TYPE', 'PLUS_MERGE_TYPE', 'PLUS_MERGE_TYPE']);

    pass('cannot add a string to a number', () => {
      let x = '';
      x + "";
      x + 5; // reject, x was added to number and string
    }, ['PLUS_MERGE_NUM_STR']);

    pass('cannot plus a boolean', () => {
      let x = false;
      x + true; // reject, cannot add a boolean
    }, ['PLUS_MERGE_TYPE']);
  });

  group('merging functions that plus params', () => {
    pass('cannot plus to a function', () => {
      function f(a, b) {
        return a + b;
      }

      f = 10; // fail, f is a function type
    }, ['POLY_PRIMITIVES']);

    pass('fail for return type (the + is string or number while implicit return is undefined)', () => {
      function f(a, b) {
        return a + b;
      }

      f = function(a, b){}; // fail, return type is different (tbd vs undefined)
    }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);

    pass('pass because the types are unresolved and have same arity otherwise', () => {
      function f(a, b) {
        return a + b;
      }

      f = function(a, b){ return a + b; }; // pass, TODO: should consider function decls immutable
    }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);

    pass('cannot overwrite a function declaration', () => {
      // v4: function merge
      // TODO: this should just be a linting rule, not a zetype check
      function f(a, b) {
        return a + b;
      }

      f = function(a, b){ return a + a; }; // type sig matches but should consider function decls immutable
    }, ['FUNCTION_MERGE', 'POLY_OTHER', 'TOFIX']);
  });

  group('adding numbers inside functions', () => {
    pass('plus in a func, uncalled', () => {
      function f(a, b) {
        return a + b;
      }
    });

    pass('add two nums in func', () => {
      function f(a, b) {
        return a + b;
      }

      f(5, 10); // pass
    });
    pass('add two strings in func', () => {
      function f(a, b) {
        return a + b;
      }

      f('a', 'b'); // pass
    });
    pass('call same func with different types', () => {
      function f(a, b) {
        return a + b;
      }

      f('a', 'b');
      f(1, 2);
    });
    pass('call same func with different types and compare output types (plus returns number of string)', () => {
      function f(a, b) {
        return a + b;
      }

      // the comparison fails because + returns the type of its args, so number and string in this case
      f('a', 'b') === f(1, 2);
    }, ['POLY_PRIMITIVES']);

    pass('add num to str', () => {
      function f(a, b) {
        return a + b;
      }

      f("x", 5);
    }, ['PLUS_MERGE_NUM_STR']);

    pass('add str to bool', () => {
      function f(a, b) {
        return a + b;
      }

      f("x", true);
    }, ['PLUS_MERGE_STR_PRIM']);

    pass('cannot add two bools', () => {
      function f(a, b) {
        return a + b;
      }

      f(true, false); // fail
    }, ['PLUS_MERGE_TYPE']);
  });

  pass('unroll the deferred calls', () => {
    // What would that look like with nested functions?
    function f(a, b) {
      // is this the same as when the function was not nested?
      function g(a, b) {
        return a + b;
      }
      // this should be type-evaluated for every call to f
      return g(a, b);
    }
    f(1, 2);
    f('a', 'b');
    // f(1, 'b'); // boom
  });
  pass('locking the type of an arg by inference', () => {
    function f(a, b) {
      g(a, b);
      // This basically means that whatever g is, it has to be a function that accepts a number as the first type.
      // That implies that 'a' is a number.
      // This is an invariant to this function because g is a local function. But what about global functions?
      g(1, b);
      function g(a, b) { return a + b; }
    }
    f(1, 2);
  });

  group('input args and output', () => {
    pass('result is same; num num num', () => {
      1 === (2 + 3)
    });

    pass('result is same; str num num', () => {
      'x' === (2 + 3)
    }, ['POLY_PRIMITIVES']);

    pass('result is same; num str num', () => {
      1 === ('y' + 3)
    }, ['PLUS_MERGE_NUM_STR', 'POLY_PRIMITIVES']);

    pass('result is same; str str num', () => {
      'x' === ('y' + 3)
    }, ['PLUS_MERGE_NUM_STR']);

    pass('result is same; num num str', () => {
      1 === (2 + 'z')
    }, ['PLUS_MERGE_NUM_STR', 'POLY_PRIMITIVES']);

    pass('result is same; str num str', () => {
      'x' === (2 + 'z')
    }, ['PLUS_MERGE_NUM_STR']);

    pass('result is same; num str str', () => {
      1 === ('y' + 'z')
    }, ['POLY_PRIMITIVES']);

    pass('result is same; str str str', () => {
      'x' === ('y' + 'z')
    });
  });

  group('unresolved', () => {
    pass('nothing resolved', () => {
      function f(a, b, c) {
        a === (b + c);
      }
    });

    pass('result variable that gets resolved', () => {
      function f(a, b, c) {
        a === (b + c);
        a === 'x';
      }
    });

    pass('input variable that gets resolved', () => {
      function f(a, b, c) {
        a === (b + c);
        b === 'x';
      }
    });
  });

  group('funcs with poly args', () => {
    pass('calling func with addition once with numbers', () => {
      function f(a, b) {
        return a + b;
      }
      f(1, 2) === 3
    });

    pass('calling func with addition once with number and string 1', () => {
      function f(a, b) {
        return a + b;
      }
      f(1, 'a') === 3
    }, ['PLUS_MERGE_NUM_STR', 'POLY_PRIMITIVES']);

    pass('calling func with addition once with number and string 2', () => {
      function f(a, b) {
        return a + b;
      }
      f(1, 'a') === 'c'
    }, ['PLUS_MERGE_NUM_STR']);

    pass('calling func with addition twice with numbers', () => {
      function f(a, b) {
        return a + b;
      }
      f(1, 2) === 3
      f(3, 4) === 3
    });

    pass('calling func with addition twice with strings', () => {
      function f(a, b) {
        return a + b;
      }
      f('a', 'b') === 'c'
      f('d', 'e') === 'c'
    });

    pass('calling func with addition numbers then with strings', () => {
      function f(a, b) {
        return a + b;
      }
      f(1, 2) === 3
      f('a', 'b') === 'c'
    });
  });

  group('merging plusses with plusses', () => {
    pass('unresolved plus merge in func', () => {
      function f(a, b, c, d) {
        const x = a + b;
        const y = c + d;
        return x + y;
      }
    });

    pass('call plus merges with only nums', () => {
      function f(a, b, c, d) {
        const x = a + b;
        const y = c + d;
        return x + y;
      }
      f(1, 2, 3, 4);
    });

    pass('call plus merges with only strings', () => {
      function f(a, b, c, d) {
        const x = a + b;
        const y = c + d;
        return x + y;
      }
      f('a', 'b', 'c', 'd');
    });

    pass('call plus merges with nums and strings', () => {
      function f(a, b, c, d) {
        const x = a + b;
        const y = c + d;
        return x + y;
      }
      f(1, 2, 'c', 'd');
    }, ['PLUS_MERGE_NUM_STR']);

    pass('call plus merges with strings and nums', () => {
      function f(a, b, c, d) {
        const x = a + b;
        const y = c + d;
        return x + y;
      }
      f('c', 'd', 1, 2);
    }, ['PLUS_MERGE_NUM_STR']);

    pass('call plus merges with only nums checking correct return', () => {
      function f(a, b, c, d) {
        const x = a + b;
        const y = c + d;
        return x + y;
      }
      f(1, 2, 3, 4) === 10;
    });

    pass('call plus merges with only strings checking correct return', () => {
      function f(a, b, c, d) {
        const x = a + b;
        const y = c + d;
        return x + y;
      }
      f('a', 'b', 'c', 'd') === 'x';
    });

    pass('call plus merges with only nums checking bad return', () => {
      function f(a, b, c, d) {
        const x = a + b;
        const y = c + d;
        return x + y;
      }
      f(1, 2, 3, 4) === 'z';
    }, ['POLY_PRIMITIVES']);

    pass('call plus merges with only strings checking bad return', () => {
      function f(a, b, c, d) {
        const x = a + b;
        const y = c + d;
        return x + y;
      }
      f('a', 'b', 'c', 'd') === 9;
    }, ['POLY_PRIMITIVES']);

    group('advanced closure trickery with arg', () => {
      pass('merge with plus in upper scope, 123', () => {
        function A(a, b, c) {
          function B(c, d) {
            return c + d;
          }

          return B(a, b) + c;
        }

        A(1, 2, 3);
      });

      pass('merge with plus in upper scope, a23', () => {
        function A(a, b, c) {
          function B(c, d) {
            return c + d;
          }

          return B(a, b) + c;
        }

        A('a', 2, 3);
      }, ['PLUS_MERGE_NUM_STR', 'PLUS_MERGE_NUM_STR']);

      pass('merge with plus in upper scope, 1b3', () => {
        function A(a, b, c) {
          function B(c, d) {
            return c + d;
          }

          return B(a, b) + c;
        }

        A(1, 'b', 3);
      }, ['PLUS_MERGE_NUM_STR', 'PLUS_MERGE_NUM_STR']);

      pass('merge with plus in upper scope, ab3', () => {
        function A(a, b, c) {
          function B(c, d) {
            return c + d;
          }

          return B(a, b) + c;
        }

        A('a', 'b', 3);
      }, ['PLUS_MERGE_NUM_STR']);

      pass('merge with plus in upper scope, 12c', () => {
        function A(a, b, c) {
          function B(c, d) {
            return c + d;
          }

          return B(a, b) + c;
        }

        A(1, 2, 'c');
      }, ['PLUS_MERGE_NUM_STR']);

      pass('merge with plus in upper scope, a2c', () => {
        function A(a, b, c) {
          function B(c, d) {
            return c + d;
          }

          return B(a, b) + c;
        }

        A('a', 2, 'c');
      }, ['PLUS_MERGE_NUM_STR']);

      pass('merge with plus in upper scope, 1bc', () => {
        function A(a, b, c) {
          function B(c, d) {
            return c + d;
          }

          return B(a, b) + c;
        }

        A(1, 'b', 'c');
      }, ['PLUS_MERGE_NUM_STR']);

      pass('merge with plus in upper scope, abc', () => {
        function A(a, b, c) {
          function B(c, d) {
            return c + d;
          }

          return B(a, b) + c;
        }

        A('a', 'b', 'c');
      });

      pass('called twice with different types', () => {
        function A(a, b, c) {
          function B(c, d) {
            return c + d;
          }

          return B(a, b) + c;
        }

        A(1, 2, 3);
        A('a', 'b', 'c');
      });
    });

    group('advanced closure trickery upper arg', () => {
      pass('ua merge with plus in upper scope, 123', () => {
        function A(a, b, c) {
          function B() {
            return a + b;
          }

          return B() + c;
        }

        A(1, 2, 3);
      });

      pass('ua merge with plus in upper scope, a23', () => {
        function A(a, b, c) {
          function B() {
            return a + b;
          }

          return B() + c;
        }

        A('a', 2, 3);
      }, ['PLUS_MERGE_NUM_STR', 'PLUS_MERGE_NUM_STR']);

      pass('ua merge with plus in upper scope, 1b3', () => {
        function A(a, b, c) {
          function B() {
            return a + b;
          }

          return B() + c;
        }

        A(1, 'b', 3);
      }, ['PLUS_MERGE_NUM_STR', 'PLUS_MERGE_NUM_STR']);

      pass('ua merge with plus in upper scope, ab3', () => {
        function A(a, b, c) {
          function B() {
            return a + b;
          }

          return B() + c;
        }

        A('a', 'b', 3);
      }, ['PLUS_MERGE_NUM_STR']);

      pass('ua merge with plus in upper scope, 12c', () => {
        function A(a, b, c) {
          function B() {
            return a + b;
          }

          return B() + c;
        }

        A(1, 2, 'c');
      }, ['PLUS_MERGE_NUM_STR']);

      pass('ua merge with plus in upper scope, a2c', () => {
        function A(a, b, c) {
          function B() {
            return a + b;
          }

          return B() + c;
        }

        A('a', 2, 'c');
      }, ['PLUS_MERGE_NUM_STR']);

      pass('ua merge with plus in upper scope, 1bc', () => {
        function A(a, b, c) {
          function B() {
            return a + b;
          }

          return B() + c;
        }

        A(1, 'b', 'c');
      }, ['PLUS_MERGE_NUM_STR']);

      pass('ua merge with plus in upper scope, abc', () => {
        function A(a, b, c) {
          function B() {
            return a + b;
          }

          return B() + c;
        }

        A('a', 'b', 'c');
      });

      pass('ua called twice with different types', () => {
        function A(a, b, c) {
          function B() {
            return a + b;
          }

          return B() + c;
        }

        A('a', 'b', 'c');
        A(1, 2, 3);
      });
    });
  });
});
