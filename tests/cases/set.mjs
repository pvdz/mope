import {pass, only, skip, group} from '../utils.mjs';

export const set = () => group('set', () => {
  group('Set constructor', () => {
    pass('set constructor sans args', () => {
      new Set();
    });

    pass('set constructor with num array', () => {
      new Set([1, 2, 3]);
    });

    pass('set constructor with empty array', () => {
      new Set([]);
    }, ['SET_EMPTY_ARRAY']);

    pass('set constructor with string arg', () => {
      new Set('baaad');
    }, ['SET_ARG1']);

    pass('set constructor with second arg', () => {
      new Set([1], 2);
    }, ['SET_ARG2']);

    pass('set must be called with new', () => {
      Set(['foo']);
    }, ['SET_WITHOUT_NEW']);

    pass('compare set instances to each other, pass', () => {
      const a = new Set([1]);
      const b = new Set([2]);

      a === b;
    });

    pass('compare set instances to each other, fail', () => {
      const a = new Set([1]);
      const b = new Set(['x']);

      a === b;
    }, ['POLY_PRIMITIVES']);
  });

  group('Set#set', () =>{
    group('Set#set without init', () => {
      pass('Set#set without init, zero args', () => {
        new Set().add();
      }, ['SET_ADD_ARGLESS']);

      pass('Set#set without init, one arg', () => {
        new Set().add('x');
      }, []);

      pass('Set#set without init, two args', () => {
        new Set().add('x', 'y');
      }, ['BUILTIN_ARG2_TMI']);
    });

    group('Set#set with init', () => {
      pass('Set#set with init, zero args', () => {
        new Set(['a']).add();
      }, ['SET_ADD_ARGLESS', 'POLY_PRIMITIVES']);

      pass('Set#set with init, one arg', () => {
        new Set(['a']).add('x');
      }, []);

      pass('Set#set with init, two args', () => {
        new Set(['a']).add('x', 'y');
      }, ['BUILTIN_ARG2_TMI']);

      pass('Set#set with init, to different kind', () => {
        new Set(['a']).add(1);
      }, ['POLY_PRIMITIVES']);
    });

    pass('Set#set called with bad context', () => {
      Set.prototype.add.call([], 1, 2);
    }, ['BUILTIN_ARG2_TMI', 'BUILTIN_CONTEXT_SET']);
  });
});
