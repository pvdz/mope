import {pass, only, skip, group} from '../utils.mjs';

export const arrows = () => group('arrows', () => {
  group('arrows vs regular functions', () => {
    pass('.call func', () => {
      // The return type should be a number for this test to pass
      function f() { return this.x; }
      const r = f.call({x: 5}); // Number
      r === 10; // Fails if context isn't properly applied
    });

    pass('.call arrow', () => {
      // The return type should be a number for this test to pass
      // For arrows, the context is _fixed_ to the parent context, so this .call should not change it
      // In strict mode (module goal) the `this` in global is `undefined`, so this should reject. The model will assume
      // `undefined` for properties read on `null` or `undefined` values. So `this.x` returns `undefined`, not a number.
      const f = () => { return this.x; }
      const r = f.call({x: 5}); // Undefined
      r === 10; // Would fail because undefined != number
    }, ['GLOBAL_THIS', 'ARROW_WITH_CONTEXT', 'PROP_ON_NULL_UNDEF', 'POLY_PRIMITIVES']);

    pass('arrow call should fail even if return type would match', () => {
      // A .call to an arrow does not change the context. This would be a bug so we should disallow it if we detect it.
      // `this` will be undefined in strict global, but the model will assume `undefined` for the prop read, so pass.
      const f = () => { return this.x; }
      const r = f.call({x: 5}) // Should fail because .call on an arrow does not change the context, silently
      r === undefined; // The return type will be correct
    }, ['GLOBAL_THIS', 'ARROW_WITH_CONTEXT', 'PROP_ON_NULL_UNDEF']);
  });

  group('arrow context', () => {
    pass('arrows should warn when receiving explicit context', () => {
      const f = () => {};
      f.call({});
    }, ['ARROW_WITH_CONTEXT']);

    pass('arrows should expect an undefined context', () => {
      const f = () => {};
      f.call(undefined);
    });
  });

  group('lex bindings in arrows', () => {
    pass('let binding in arrow', () => {
      let f = () => {
        let foo = 1;
        foo === 1;
      };
      f();
    });
  });
});
