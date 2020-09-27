// This is about the language feature `arguments`
import {pass, only, skip, group} from '../utils.mjs';

export const arguments_feat = () => group('arguments', () => {
  group('resolving', () => {
    pass('arguments is an implicit local var for functions', () => {
      function f() { return arguments; }
      f();
    });

    pass('global has no arguments', () => {
      const a = arguments;
    }, ['IMPLICIT_GLOBAL', 'USED_BINDING_BEFORE_DECL']);

    group('nested function inheritance', () => {
      pass('an arrow inherits the parent func arguments 1', () => {
        function f() { return () => arguments; }
        f();
        // f()();
      });

      pass('an arrow inherits the parent func arguments 2', () => {
        function f() { return () => arguments; }
        f();
        f()();
      });

      pass('an arrow inherits the parent arguments recursively 1', () => {
        function f() { return () => () => arguments; }
        f();
        // f()();
        // f()()();
      });

      pass('an arrow inherits the parent arguments recursively 2', () => {
        function f() { return () => () => arguments; }
        f();
        f()();
        // f()();
      });

      pass('an arrow inherits the parent arguments recursively 3', () => {
        function f() { return () => () => arguments; }
        f();
        f()();
        f()()();
      });
    });

    pass('an arrow cannot inherit arguments from global', () => {
      const f = () => arguments;
      f();
    }, ['USED_BINDING_BEFORE_DECL']);

    group('nested arrow inheritance', () => {
      pass('an arrow cannot double inherit arguments from global 1', () => {
        // the inner most arrow does not get called so this is not an error
        const f = () => () => arguments;
        f();
        // f()();
      });

      pass('an arrow cannot double inherit arguments from global 2', () => {
        const f = () => () => arguments;
        f();
        f()();
      }, ['USED_BINDING_BEFORE_DECL']);
    })
  });

  group('typing', () => {
    // We can support typing of arguments but we'd have to work around the numbered access
    // We might support that as a special syntactical case that we control tightly since it's immutable.
    // And of course we can type `.length` trivially.

    pass('arguments.length is a number', () => {
      function f() {
        arguments.length === 5;
      }
      f();
    });

    pass('inherited arguments.length is also a number', () => {
      function f() {
        return () => arguments.length === 5;
      }
      f();
    });

  });
});
