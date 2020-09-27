import {pass, only, skip, group} from '../utils.mjs';

export const random = () => group('random', () => {
  pass('this is why closure access should not be shadowed, only local bindings. otherwise this runs the risk of passing', () => {
    function f(x) {
      function y() {
        function z() {
          x = 'x'; // POLY_PRIMITIVES
        }
        z();
        x = 10; // POLY_PRIMITIVES
      }
      y();
    }
    f(); // CALL_ARG_ARITY
  }, ['CALL_ARG_ARITY', 'POLY_PRIMITIVES', 'POLY_PRIMITIVES']);

  pass('just some real code', () => {
    let curtype = 0, $TICK_PURE = 0, $TICK_HEAD = 0;
    function isTemplateStart(curtype) {
      return (curtype & $TICK_PURE) === $TICK_PURE || (curtype & $TICK_HEAD) === $TICK_HEAD;
    }
  });

  pass('wtftoken', () => {
    // Error: that is the token to find
    // (A bug was finding the `(` token when walking back from the init to find the `=` token)
    const ownDigest = (console);
  });


  pass('accessing global builtin props', () => {
    // Error: that is the token to find
    // (A bug was finding the `(` token when walking back from the init to find the `=` token)
    console.log('foo');
  });

  pass('token problem with templates and newlines', () => {
    // Typo was incorrectly looking up the token for this template
    console.log(`
      ${x} // all lints because of x
    `);
  }, ['IMPLICIT_GLOBAL', 'USED_BINDING_BEFORE_DECL', 'TEMPLATE_EXPR_STRING']);

  group('regression: unary ops double evaluating their arg', () => {
    // These cases were trying to uncover why a function call was causing stack underflow crashes
    // Turned out the unary operators were double-evaluating their arg, leaving too many values on the stack.

    pass('exclamation mark regression, was not popping the arg, 1', () => {
      // This was not crashing
      !1
    }, ['POLY_PRIMITIVES']);

    pass('exclamation mark regression, was not popping the arg, 2', () => {
      // This was triggering an argument underflow crash. But removing the if (leaving the x) would work fine...
      function ASSERT(bool) {
        !bool
      }

      ASSERT(1)
    }, ['POLY_PRIMITIVES']);

    pass('exclamation mark regression, was not popping the arg, 3', () => {
      // This was triggering an argument underflow crash. But removing the if (leaving the x) would work fine...
      function ASSERT(bool, desc, ...rest) {
        !bool
      }

      ASSERT(1)
    }, ['CALL_ARG_ARITY', 'POLY_PRIMITIVES']);

    pass('exclamation mark regression, was not popping the arg, 4', () => {
      // This was triggering an argument underflow crash. But removing the if (leaving the x) would work fine...
      function ASSERT(bool, desc, ...rest) {
        if (!bool) x
      }

      ASSERT(1)
    }, ['IMPLICIT_GLOBAL', 'CALL_ARG_ARITY', 'POLY_PRIMITIVES', 'USED_BINDING_BEFORE_DECL']);
  });

  pass('bindings from any scope would be registered as global references',  () => {
    // Regression: Somehow the binding in A got shadowed by the binding in B with the same name
    function A() {
      let wopp = 1
    }
    function B() {
      let wopp = 2
      wopp = 3
    }
    B();
  });

  pass('a map with placeholder kinds should be cloned properly and not share kind references', () => {
    // This should have at least two lints warnings. There was a regression with placeholder cloning where placeholders
    // actually werent cloned and it was leading to sharing the kind between returned objects. Oops.
    function f() {
      return new Map
    }
    const a = f();
    const b = f(); // clone of new map

    a.set('foo', 'bar'); // should not update b's kinds

    const c = b.get('foo'); // set b's key kind to string, seal b's value kind to 'undefined'
    c === 'foo'; // poly value kind; undefined to string
  }, ['POLY_PRIMITIVES']);

  pass('string chain fail', () => {
    function f(returnValue) {
      return returnValue.split('\n').map(s => s.trimRight()).join('\n')
    }
    f('x') === 'y'
  });

  pass('assignment to computed property fails', () => {
    const arr = [];
    arr[1] = 'x';
    arr.pop() === 'x'; // should NOT trigger poly warning (an  indexed array prop warning will have been emitted)
  }, ['DYNAMIC_INDEX_ACCESS_ARRAY', 'ARRAY_POP_UNDERFLOW']);

  group('map cloning regression', () => {
    pass('map clone problem without the clone', () => {
      function getCipherMap (alphabet) {
        return alphabet
        .reduce((charsMap, currentChar) => {

          charsMap.set(currentChar, 'x');
          return charsMap;
        }, new Map);
      }

      const arr = ['x'];
      const cipherMap1 = getCipherMap(arr);
      const cipherMap2 = getCipherMap(arr);
    });

    pass('map doesnt seem to be fence cloned properly', () => {
      // Regression: The getCipherMap returns a Map<string,string> the first time but a Map<string,undefined> the second time
      // This was caused by `new Map` cloning a Map whose kinds had not been resolved yet, causing them to become undefined.

      function getCipherMap (alphabet) {
        return alphabet
          .reduce((charsMap, currentChar) => {
            const charsMapClone = new Map(charsMap);
            charsMapClone.set(currentChar, 'x');
            return charsMapClone;
          }, new Map);
      }

      const arr = ['x'];
      const cipherMap1 = getCipherMap(arr);
      const cipherMap2 = getCipherMap(arr);
    });
  });

  pass('class props order', () => {
    // Regression was processing it in the wrong order, causing the method to be invoked rather than the constructor

    const DEFAULT_BASE = 37;
    const DEFAULT_MODULUS = 101;

    class PolynomialHash {

      constructor({ base = DEFAULT_BASE, modulus = DEFAULT_MODULUS } = {}) {
        this.base = base;
        this.modulus = modulus;
      }

      charToNumber(char) {
        let charCode = char.codePointAt(0);

        // Check if character has surrogate pair.
        const surrogate = char.codePointAt(1);
        if (surrogate !== undefined) {
          const surrogateShift = 2 ** 16;
          charCode += surrogate * surrogateShift;
        }

        return charCode;
      }
    }

    const polynomialHash = new PolynomialHash({ base: 10, modulus: 100 });
  }, ['SET_NEW_UNSEEN_PROP', 'SET_NEW_UNSEEN_PROP']);

  // only('obj spread', () => {
  //   const a = {x: 1, y: 'foo'};
  //   const b = {...a};
  // });
});


