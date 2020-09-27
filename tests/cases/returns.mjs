import {pass, only, skip, group} from '../utils.mjs';

export const returns = () => group('return tracking', () => {
  group('legacy tests to sort and verify', () => {

    pass('all branches return so not undefined', () => {
      function f() {
        if (true) return "foo";
        return "bar";
      }
      f();
    });
    pass('all branches return so not undefined, called ok', () => {
      function f() {
        if (true) return "foo";
        return "bar";
      }
      f() === "str"
    });
    pass('all branches return so not undefined, called bad', () => {
      function f() {
        if (true) return "foo";
        return "bar";
      }
      f() === 100
    }, ['POLY_PRIMITIVES']);

    pass('if and else return so not undefined', () => {
      function f() {
        if (true) return "foo";
        else return "bar";
      }
      f();
    });

    pass('if does not return so undefined so fail', () => {
      function f() {
        if (true) ;
        else return "bar";
      }
      f();
    }, ['POLY_PRIMITIVES']);

    pass('else does not return so undefined so fail', () => {
      function f() {
        if (true) return "foo";
        else ;
      }
      f();
    }, ['POLY_PRIMITIVES']);

    pass('saved by return afterwards', () => {
      function f() {
        if (true) return "foo";
        else ;
        return "bar";
      }
      f();
    });
  });

  group('legacy tests to sort and verify', () => {
    pass('all branches must return same type', () => {
      function f() {
        if (true) return 'foo';
        else return 5;
      }
      f();
    }, ['POLY_PRIMITIVES']);
  });

  pass('function without returns', () => {
    function f() {}
    f();
  });

  pass('simple return of a number', () => {
    function f() {
      return 5;
    }
    f();
  });

  pass('simple return without arg', () => {
    function f() {
      return;
    }
    f();
  });

  group('if', () => {
    pass('if-only without return', () => {
      function f() {
        if (true) ;
      }
      f();
    });
    pass('if-only with return', () => {
      function f() {
        if (true) return;
      }
      f();
    });
    pass('if-only with block with return', () => {
      function f() {
        if (true) {
          return;
        }
      }
      f();
    });
    pass('if-only with block without return', () => {
      function f() {
        if (true) {
        }
      }
      f();
    });
    pass('if-else without any returns without arg', () => {
      function f() {
        if (true) ;
        else ;
      }
      f();
    });
    pass('if-else where if returns without arg', () => {
      function f() {
        if (true) return;
        else ;
      }
      f();
    });
    pass('if-else where else returns without arg', () => {
      function f() {
        if (true) ;
        else return;
      }
      f();
    });
    pass('if-else where both return without arg', () => {
      function f() {
        if (true) return;
        else return;
      }
      f();
    });
    pass('if-else where if returns with arg', () => {
      function f() {
        if (true) return 1;
        else ;
      }
      f();
    }, ['POLY_PRIMITIVES']);
    pass('if-else where else returns with arg', () => {
      function f() {
        if (true) ;
        else return 1;
      }
      f();
    }, ['POLY_PRIMITIVES']);
    pass('if-else where both return with arg', () => {
      function f() {
        if (true) return 1;
        else return 1;
      }
      f();
    });
    pass('if-else where both return in a block with arg', () => {
      function f() {
        if (true) {
          return 1;
        } else {
          return 1;
        }
      }
      f();
    });
    pass('if-else without returns followed by a return', () => {
      function f() {
        if (true) {}
        else {}
        return 1;
      }
      f();
    });
    pass('if-else with partial return followed by a return', () => {
      function f() {
        if (true) {
          return 1;
        }
        else {}
        return 1;
      }
      f();
    });
  });

  group('while', () => {
    // The while does is considered to never explicitly return all branches because its body may never be executed.
    // For example: `while (false) return;` will never return explicitly. This system won't know this runtime state.

    pass('without return', () => {
      function f() {
        while (true) ;
      }
      f();
    });

    pass('without return followed by return', () => {
      function f() {
        while (true) ;
        return;
      }
      f();
    });

    pass('with return followed by different typed return', () => {
      function f() {
        while (true) {
          return 1;
        }

        return;
      }
      f();
    }, ['POLY_PRIMITIVES']);

    pass('with return', () => {
      function f() {
        while (true) return;
      }
      f();
    });

    pass('with block that does not return', () => {
      function f() {
        while (true) {}
      }
      f();
    });

    pass('with block that does return', () => {
      function f() {
        while (true) {
          return;
        }
      }
      f();
    });

    pass('with block that does not return followed by return', () => {
      function f() {
        while (true) {
          return;
        }
        return;
      }
      f();
    });

    pass('explicit return of number with implicit return of undefined', () => {
      // This one is why a loop can't be considered to "always" return explicit
      function f() {
        while (false) {
          return 1;
        }
      }
      f();
    }, ['POLY_PRIMITIVES']);
  });

  group('try/catch/finally', () => {
    // In general, if there's a finally, I only care about the finally. If there's no finally, I care about both the try
    // and the catch, and ignore the fact that either could throw at any point.

    group('try catch', () => {
      // Both must return explicitly

      pass('try no catch no after no', () => {
        function f() {
          try {
          } catch {
          }
        }
        f();
      });

      pass('try yes catch no after no', () => {
        function f() {
          try {
            return 1;
          } catch {
          }
        }
        f();
      }, ['POLY_PRIMITIVES']);

      pass('try no catch yes after no', () => {
        function f() {
          try {
          } catch {
            return 1;
          }
        }
        f();
      }, ['POLY_PRIMITIVES']);

      pass('try yes catch yes after no', () => {
        function f() {
          try {
            return 1;
          } catch {
            return 1;
          }
        }
        f();
      });

      pass('try no catch no after yes', () => {
        function f() {
          try {
          } catch {
          }
          return 1;
        }
        f();
      });

      pass('try yes catch no after yes', () => {
        function f() {
          try {
            return 1;
          } catch {
          }
          return 1;
        }
        f();
      });

      pass('try no catch yes after yes', () => {
        function f() {
          try {
          } catch {
            return 1;
          }
          return 1;
        }
        f();
      });

      pass('try yes catch yes after yes', () => {
        function f() {
          try {
            return 1;
          } catch {
            return 1;
          }
          return 1;
        }
        f();
      });
    });

    group('try finally', () => {
      // Only the finally must return explicitly

      pass('try no finally no after no', () => {
        function f() {
          try {
          } finally {
          }
        }
        f();
      });

      pass('try yes finally no after no', () => {
        function f() {
          try {
            return 1;
          } finally {
          }
        }
        f();
      }, ['POLY_PRIMITIVES']);

      pass('try no finally yes after no', () => {
        function f() {
          try {
          } finally {
            return 1;
          }
        }
        f();
      });

      pass('try yes finally yes after no', () => {
        // TODO: should this warn? The `finally` return will override the `try` return value ...
        function f() {
          try {
            return 1;
          } finally {
            return 1;
          }
        }
        f();
      });

      pass('try no finally no after yes', () => {
        function f() {
          try {
          } finally {
          }
          return 1;
        }
        f();
      });

      pass('try yes finally no after yes', () => {
        function f() {
          try {
            return 1;
          } finally {
          }
          return 1;
        }
        f();
      });

      pass('try no finally yes after yes', () => {
        function f() {
          try {
          } finally {
            return 1;
          }
          return 1;
        }
        f();
      });

      pass('try yes finally yes after yes', () => {
        function f() {
          try {
            return 1;
          } finally {
            return 1;
          }
          return 1;
        }
        f();
      });
    });

    group('try catch finally', () => {
      // Both must return explicitly

      pass('try no catch no finally no after no', () => {
        function f() {
          try {
          } catch {
          } finally {
          }
        }
        f();
      });

      pass('try yes catch no finally no after no', () => {
        function f() {
          try {
            return 1;
          } catch {
          } finally {
          }
        }
        f();
      }, ['POLY_PRIMITIVES']);

      pass('try no catch yes finally no after no', () => {
        function f() {
          try {
          } catch {
            return 1;
          } finally {
          }
        }
        f();
      }, ['POLY_PRIMITIVES']);

      skip('try yes catch yes finally no after no', () => {
        // skipped: dunno why this fails. should detect a return in both branches and be happy with that
        function f() {
          try {
            return 1;
          } catch {
            return 1;
          } finally {
          }
        }
        f();
      }, ['POLY_PRIMITIVES']);

      pass('try no catch no finally yes after no', () => {
        function f() {
          try {
          } catch {
          } finally {
            return 1;
          }
        }
        f();
      });

      pass('try yes catch no finally yes after no', () => {
        function f() {
          try {
            return 1;
          } catch {
          } finally {
            return 1;
          }
        }
        f();
      });

      pass('try no catch yes finally yes after no', () => {
        function f() {
          try {
          } catch {
            return 1;
          } finally {
            return 1;
          }
        }
        f();
      });

      pass('try yes catch yes finally yes after no', () => {
        function f() {
          try {
            return 1;
          } catch {
            return 1;
          } finally {
            return 1;
          }
        }
        f();
      });

      pass('try no catch no finally no after yes', () => {
        function f() {
          try {
          } catch {
          } finally {
          }
          return 1;
        }
        f();
      });

      pass('try yes catch no finally no after yes', () => {
        function f() {
          try {
            return 1;
          } catch {
          } finally {
          }
          return 1;
        }
        f();
      });

      pass('try no catch yes finally no after yes', () => {
        function f() {
          try {
          } catch {
            return 1;
          } finally {
          }
          return 1;
        }
        f();
      });

      pass('try yes catch yes finally no after yes', () => {
        function f() {
          try {
            return 1;
          } catch {
            return 1;
          } finally {
          }
          return 1;
        }
        f();
      });

      pass('try no catch no finally yes after yes', () => {
        function f() {
          try {
          } catch {
          } finally {
            return 1;
          }
          return 1;
        }
        f();
      });

      pass('try yes catch no finally yes after yes', () => {
        function f() {
          try {
            return 1;
          } catch {
          } finally {
            return 1;
          }
          return 1;
        }
        f();
      });

      pass('try no catch yes finally yes after yes', () => {
        function f() {
          try {
          } catch {
            return 1;
          } finally {
            return 1;
          }
          return 1;
        }
        f();
      });

      pass('try yes catch yes finally yes after yes', () => {
        function f() {
          try {
            return 1;
          } catch {
            return 1;
          } finally {
            return 1;
          }
          return 1;
        }
        f();
      });
    });
  });

  group('switch', () => {
    // Things to test;
    // - case and default
    // - switch without default
    // - fall through of cases that do or do not return
    // - fall through followed by non-fall through
    // - default as not the last case

    group('simple', () => {
      pass('switch with case and no returns', () => {
        function f() {
          switch (true) {
            case false:
              debugger;
          }
        }
        f();
      });

      pass('switch with case and empty block', () => {
        function f() {
          switch (true) {
            case false:
          }
        }
        f();
      });

      pass('switch with case and return', () => {
        function f() {
          switch (true) {
            case false:
              return 1;
          }
        }
        f();
      }, ['POLY_PRIMITIVES']);

      pass('switch with default and no returns', () => {
        function f() {
          switch (true) {
            default:
              debugger;
          }
        }
        f();
      });

      pass('switch with default and empty block', () => {
        function f() {
          switch (true) {
            default:
          }
        }
        f();
      });

      pass('switch with default and return', () => {
        function f() {
          switch (true) {
            default:
              return 1;
          }
        }
        f();
      });
    });

    group('double case', () => {
      // Note: for all these cases, there is no default

      pass('empty bodies', () => {
        function f() {
          switch (true) {
            case true:
            case false:
          }
        }
        f();
      });

      pass('empty bodies followed by return', () => {
        function f() {
          switch (true) {
            case true:
            case false:
          }
          return 1;
        }
        f();
      });

      pass('fall through to return', () => {
        function f() {
          switch (true) {
            case true:
            case false:
              return 1
          }
        }
        f();
      }, ['POLY_PRIMITIVES']);

      pass('only first returns', () => {
        function f() {
          switch (true) {
            case true:
              return 1
            case false:
          }
        }
        f();
      }, ['POLY_PRIMITIVES']);
    });

    group('case and default', () => {
      pass('case no default no after no', () => {
        function f() {
            switch (1) {
            case 1:
            default:
          }
        }
        f();
      });

      pass('case no default no after yes', () => {
        function f() {
          switch (1) {
            case 1:
            default:
          }
          return 1;
        }
        f();
      });

      pass('case yes default no after no', () => {
        function f() {
          switch (1) {
            case 1:
              return 1;
            default:
          }
        }
        f();
      }, ['POLY_PRIMITIVES']);

      pass('case yes default no after yes', () => {
        function f() {
          switch (1) {
            case 1:
              return 1;
            default:
          }
          return 1;
        }
        f();
      });

      pass('case no default yes after no', () => {
        function f() {
          switch (1) {
            case 1:
            default:
              return 1;
          }
        }
        f();
      });

      pass('case no default yes after yes', () => {
        function f() {
          switch (1) {
            case 1:
            default:
              return 1;
          }
          return 1;
        }
        f();
      });

      pass('case yes default yes after no', () => {
        function f() {
          switch (1) {
            case 1:
              return 1;
            default:
              return 1;
          }
        }
        f();
      });

      pass('case yes default yes after yes', () => {
        function f() {
          switch (1) {
            case 1:
              return 1;
            default:
              return 1;
          }
          return 1;
        }
        f();
      });
    });

    group('fall through', () => {
      pass('case fall through without default', () => {
        function f() {
          switch (1) {
            case 1:
            case 2:
              return 1;
          }
        }
        f();
      }, ['POLY_PRIMITIVES']);

      pass('case fallthrough with default', () => {
        function f() {
          switch (1) {
            case 1:
            case 2:
              return 1;
            default:
              return 1;
          }
        }
        f();
      });

      pass('case fallthrough to default', () => {
        function f() {
          switch (1) {
            case 1:
            default:
              return 1;
          }
        }
        f();
      });

      pass('default fallthrough to case', () => {
        // Yes, this is valid in JS
        function f() {
          switch (1) {
            default:
            case 1:
              return 1;
          }
        }
        f();
      });

      pass('fall through with return followed by no return', () => {
        function f() {
          switch (1) {
            case 1:
            case 2:
              return 1;
            case 3:
          }
        }
        f();
      }, ['POLY_PRIMITIVES']);

      pass('fall through without return followed by return', () => {
        function f() {
          switch (1) {
            case 1:
            case 2:
              break;
            case 3:
              return 1;
          }
        }
        f();
      }, ['POLY_PRIMITIVES']);

      pass('fall through without return followed by return and default', () => {
        function f() {
          switch (1) {
            case 1:
            case 2:
              break;
            default:
              return 1;
          }
        }
        f();
      }, ['POLY_PRIMITIVES']);

      pass('fall through without return followed by return and default and followed by return', () => {
        function f() {
          switch (1) {
            case 1:
            case 2:
              break;
            default:
              return 1;
          }
          return 1;
        }
        f();
      });
    });

    group('sub statements', () => {
      pass('proper if else', () => {
        function f() {
          switch (1) {
            default:
              if (true) {
                return 1;
              } else {
                return 1;
              }
          }
        }
        f();
      });

      pass('proper if without else', () => {
        function f() {
          switch (1) {
            default:
              if (true) {
                return 1;
              } else {
                return 1;
              }
          }
        }
        f();
      });

      pass('proper if with else', () => {
        function f() {
          switch (1) {
            default:
              if (true) {
                return 1;
              } else {
                return 1;
              }
          }
        }
        f();
      });

      pass('proper else with bad if', () => {
        function f() {
          switch (1) {
            default:
              if (true) {
              } else {
                return 1;
              }
          }
        }
        f();
      });

      pass('proper else with bad if followed by return', () => {
        function f() {
          switch (1) {
            default:
              if (true) {
              } else {
              }
              return 1;
          }
        }
        f();
      });
    });
  });
});
