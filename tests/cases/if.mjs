import {pass, only, skip, group} from '../utils.mjs';

export const if_else = () => group('if_else', () => {
  group('`if` condition must be bool', () => {
    pass('conditions are true for sure', () => {
      if (true) {}
    });

    pass('conditions are false for sure', () => {
      if (false) {}
    });

    pass('conditions might also be null later, for now let\'s keep them strictly boolean', () => {
      if (null) {}
    }, ['TEST_NULL']);

    pass('conditions might also be undefined later, for now let\'s keep them strictly boolean', () => {
      if (undefined) {}
    }, ['TEST_UNDEF']);

    pass('conditions won\'t ever accept single string or other things', () => {
      if ('') {}
    }, ['TEST_NUMSTR']);

    pass('conditions won\'t ever accept double string or other things', () => {
      if ("") {}
    }, ['TEST_NUMSTR']);


    pass('conditions won\'t ever accept regex or other things', () => {
      if (/$/) {}
    }, ['TEST_OBJ']);

    pass('conditions won\'t ever accept functions or other things', () => {
      if (function(){}) {}
    }, ['TEST_OBJ']);
  });
});
