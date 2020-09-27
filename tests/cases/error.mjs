// The built-in Error constructors

import {pass, only, skip, group} from '../utils.mjs';

export const error_constructors = () => group('error_constructors', () => {

  group('simple cases', () => {
    pass('Create a new error with arg', () => {
      new Error('with message');
    });

    pass('Create a new error without arg', () => {
      new Error();
    });

    pass('Calling Error with arg', () => {
      Error('with message');
    });

    pass('Calling Error without arg', () => {
      Error();
    });
  })

  group('message prop', () => {
    pass('creating new with arg creates message prop', () => {
      const e = new Error('a');
      e.message === 'b';
    });

    pass('creating new without arg does not create message prop', () => {
      const e = new Error();
      e.message === 'b';
    }, []);

    pass('creating new without arg does not create message prop but prototype defaults it to string', () => {
      const e = new Error();
      e.message === undefined;
    }, ['POLY_PRIMITIVES']);

    pass('calling with arg creates message prop', () => {
      const e = Error('a');
      e.message === 'b';
    });

    pass('calling without arg does not create message prop', () => {
      const e = Error();
      e.message === 'b';
    }, []);

    pass('calling without arg does not create message prop but prototype defaults it to string', () => {
      const e = Error();
      e.message === undefined;
    }, ['POLY_PRIMITIVES']);
  });

});
