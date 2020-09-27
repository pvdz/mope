import {pass, only, skip, group} from '../utils.mjs';

export const map = () => group('map', () => {
  group('Map constructor', () => {
    pass('map constructor sans args', () => {
      new Map();
    });

    pass('map constructor with num:num', () => {
      new Map([[1, 2], [10, 20]]);
    });

    pass('map constructor with empty array', () => {
      new Map([]);
    }, ['MAP_EMPTY_ARRAY']);

    pass('map constructor with empty double array', () => {
      new Map([[]]);
    }, ['MAP_EMPTY_ARRAY']);

    pass('map constructor with num:num and num:string', () => {
      new Map([[1, 2], ['x', 'x']]);
    }, ['POLY_PRIMITIVES']);

    pass('map constructor with num:string', () => {
      new Map([[1, 'x']]);
    }, ['ARR_MONO_KIND']);

    pass('map constructor with Set:Set', () => {
      // Should be okay since the model just cares about the tid structure
      new Map([[new Set([1]), new Set([1])]]);
    });

    pass('map constructor with string arg', () => {
      new Map('baaad');
    }, ['MAP_ARG1']);

    pass('map constructor with string array arg', () => {
      new Map(['baaad']);
    }, ['MAP_ARG1_SUB_ARR']);

    skip('map constructor with nested string array arg', () => {
      // skip: cannot track array arity so cannot validate the arg here (although it'll be a runtime error so unlikely to occur?)
      // TODO: this model doesn't know about the number of elements of an array so it can't properly validate this
      //       although it could explicitly check the constructor arg with array literal as initializer. and perhas
      //       later with tuple support. but it'll be hacky at best.
      new Map([['baaad']]);
    });

    pass('map constructor with second arg', () => {
      new Map([[1, 1]], 2);
    }, ['MAP_ARG2']);

    pass('map must be called with new', () => {
      Map([['foo', 'bar']]);
    }, ['MAP_WITHOUT_NEW']);

    pass('compare map instances to each other, pass', () => {
      const a = new Map([[1, 1]]);
      const b = new Map([[2, 3]]);

      a === b;
    });

    pass('compare map instances to each other, fail', () => {
      const a = new Map([[1, 2]]);
      const b = new Map([['x', 'y']]);

      a === b;
    }, ['POLY_PRIMITIVES']);
  });

  group('Map#set', () =>{
    group('Map#set without init', () => {
      pass('Map#set without init, zero args', () => {
        new Map().set();
      }, ['MAP_SET_ARGLESS']);

      pass('Map#set without init, one arg', () => {
        new Map().set('x');
      }, ['MAP_SET_ARG2']);

      pass('Map#set without init, two args', () => {
        new Map().set('x', 'y');
      });

      pass('Map#set without init, three args', () => {
        new Map().set('x', 'y', 'z');
      }, ['MAP_SET_ARG3']);

      pass('Map#set without init, two different args', () => {
        new Map().set('x', 1);
      });
    });

    group('Map#set with init', () => {
      pass('Map#set with init, zero args', () => {
        new Map([['a', 'b']]).set();
      }, ['MAP_SET_ARGLESS', 'POLY_PRIMITIVES', 'POLY_PRIMITIVES']);

      pass('Map#set with init, one arg', () => {
        new Map([['a', 'b']]).set('x');
      }, ['MAP_SET_ARG2', 'POLY_PRIMITIVES']);

      pass('Map#set with init, two args', () => {
        new Map([['a', 'b']]).set('x', 'y');
      });

      pass('Map#set with init, three args', () => {
        new Map([['a', 'b']]).set('x', 'y', 'z');
      }, ['MAP_SET_ARG3']);

      pass('Map#set with init, to different key', () => {
        new Map([['a', 'b']]).set(1, 'x');
      }, ['POLY_PRIMITIVES']);

      pass('Map#set with init, to different value', () => {
        new Map([['a', 'b']]).set('x', 1);
      }, ['POLY_PRIMITIVES']);

      pass('Map#set with init, to different key and value', () => {
        new Map([['a', 'b']]).set(1, 2);
      }, ['POLY_PRIMITIVES', 'POLY_PRIMITIVES']);
    });

    pass('Map#set called with bad context', () => {
      Map.prototype.set.call([], 1, 2);
    }, ['MAP_SET_CONTEXT']);
  });
});
