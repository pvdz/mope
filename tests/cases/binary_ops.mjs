import {pass, only, skip, group} from '../utils.mjs';

export const binary_ops = () => group('binary_ops', () => {
  group('legacy tests to sort and verify', () => {

    ['*', '-', '/', '^', '%', '|', '&', '>>', '>>>', '<<'].forEach(op => {
      pass(op + ' requires two numbers', `////
        let a = 1, b = 2;
        a ${op} b;
      `);

      skip(op + ' does not allow string and number', `////
        // skip: just artificial skip
        let a = "x", b = 2;
        a ${op} b;
      `);

      skip(op + ' does not allow two strings', `////
        // skip: just artificial skip
        let a = "x", b = "y";
        a ${op} b;
      `);
    });
    ['===', '!=='].forEach(op => {
      pass(op + ' works with two numbers', `////
        let a = 1, b = 2;
        a ${op} b;
      `);

      pass(op + ' does not allow string and number', `////
        // skip: just artificial skip
        let a = "x", b = 2;
        a ${op} b;
      `, ['POLY_PRIMITIVES']);

      pass(op + ' works with two strings', `////
        let a = "x", b = "y";
        a ${op} b;
      `);

      // TOOD: more type checks, partial types, etc

      group('mixing plus instances', () => {
        pass(op + ' works with two different plus args', `////
          // The plus args are different types underwater, until they actually resolve, which may be never
          function f(a, b, c, d) {
            a + b;
            c + d;

            a ${op} c; // Should not reject this just because the first plus could be different type versus second plus
          }
        `);
        pass(op + ' passes with two same resolved plus args', `////
          // The plus args are different types underwater, until they actually resolve, which may be never
          // But if they do resolve, they should act as anything else
          function f(a, b, c, d) {
            a + b;
            c + d;

            a ${op} c; // Should not reject this just because the first plus could be different type versus second plus
          }
          f(1, 2, 3, 4); // 1+2, 3+4, so 1 is same type as 3 so comparison is ok
        `);
        pass(op + ' fails with two differently resolved plus args', `////
          // skip: just artificial skip
          // The plus args are different types underwater, until they actually resolve, which may be never
          // But if they do resolve, they should act as anything else
          function f(a, b, c, d) {
            a + b;
            c + d;

            a ${op} c; // Should not reject this just because the first plus could be different type versus second plus
          }
          f(1, 2, 'a', 'b'); // 1+2, 'a'+'b', so 1 is different type as 'a' so comparison not allowed
        `, ['POLY_PRIMITIVES']);
      });
    });
    [
      '<', '<=', '>', '>=',
      '*=', '-=', '/=', '^=', '%=', '|=', '&=', '>>=', '>>>=', '<<=', '**=',
    ].forEach(op => {
      pass(op + ' allows two numbers', `////
        let a = 1, b = 2;
        a ${op} b;
      `);

      skip(op + ' does not allow a string and a number', `////
        // skip: just artificial skip
        let a = "x", b = 2;
        a ${op} b;
      `);

      skip(op + ' does not allow two strings', `////
        // skip: superficial test limitation
        let a = "x", b = "y";
        a ${op} b;
      `);
    });

    group('`instanceof`', () => {
      pass('any string is instanceof String', () => {
        "foo" instanceof String;
      }, ['INSTANCEOF_OBSOLETE']);

      pass('any number is instanceof Number', () => {
        15 instanceof Number;
      }, ['INSTANCEOF_OBSOLETE']);

      pass('rhs of instanceof must be callable', () => {
        "foo" instanceof "Foo";
      }, ['INSTANCEOF_OBSOLETE']);

      pass('if we know instanceof must fail we should report it', () => {
        "foo" instanceof Number;
      }, ['INSTANCEOF_OBSOLETE']);
    });

    group('`in`', () => {
      pass('the `in` should fail if we know the full Tee on the rhs', () => {
        // We know this is dead code, but it's not a type error. Must defer this test until we DCE
        "x" in {};
      }, ['IN_OBSOLETE']);

      pass('the `in` should pass if we know the full Tee on the rhs and it has the prop', () => {
        // This is more compiler stuff. I don't think this should be an error, per se, but since it's something we
        // can prove to be true, the 'in' is dead code and should be removed. Perhaps 'in' has no place in our system.
        "x" in {x: 1};
      }, ['IN_OBSOLETE']);

      pass('lhs of `in` is string, the rhs is object of some sort, the node itself is boolean', () => {
        21 in {};
      }, ['IN_OBSOLETE', 'POLY_PRIMITIVES']);

      pass('no real reason to forbid `in` with a non-object rhs', () => {
        // We may want to consider stripping this for DCE
        "foo" in "bar";
      }, ['IN_OBSOLETE']);
    });
  });

  group('=== / !==', () => {
    pass('strict equal with same types', () => {
      let x = 1;
      let y = 2;
      x === y;
    });

    pass('strict equal with different types', () => {
      let x = 1;
      let y = 'string';
      x === y;
    }, ['POLY_PRIMITIVES']);

    pass('strict unequal with same types', () => {
      let x = 1;
      let y = 2;
      x !== y;
    });

    pass('strict unequal with different types', () => {
      let x = 1;
      let y = 'string';
      x !== y;
    }, ['POLY_PRIMITIVES']);
  });
});
