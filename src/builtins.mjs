// - `|=` should merge operands to number (`assignable |= parseExpressionFromBinaryOpOnlyStronger(lexerFlags, $tp_rightExprStart_start, $tp_rightExprStart_line, $tp_rightExprStart_column, coalSeen,'right');`)
// - `33:38 [x] IMPLICIT_GLOBAL [window]`

import {
  ASSERT,
  ASSERT_TID,
  BOLD,
  NO_SUPER_PROP_FOR_BUILTINS,
  group,
  groupEnd,
  log,
  RESET,
  tstr,
  createPlaceholder, getIndent
} from "./utils.mjs"
import {merge, testMerge, mergeAll, isPrimitive, mergeTestAll, isPlaceholder} from "./tools.mjs"
import {metaCall, playActionArr, playActionObj, playActionMap, playActionSet, playActionFunc, playActionKind, playActionNew} from "./actions.mjs"

function playActionBuiltinObj(store, tid, props, noProto) {
  // There ought to be as many values on the stack as there are properties with initializers
  // Create a tee with these properties

  const r = playActionObj({filename: '<builtin>', column: 0, line: 0}, store, tid, null, [...props.keys()], [...props.values()]);
  ASSERT(r === tid);
  const tee = store.get(tid);
  tee._class = 'builtin obj';
  tee.builtin = true;
  if (noProto) tee.props.delete('__proto__'); // This is Object.prototype
  return tid;
}

export function setupBuiltins(store) {
  // This makes sure that all files share the same builtin type references

  store.set('boolean', {
    tid: 'boolean',
    type: 'P',
    digest(color) { return color ? tstr('boolean') : 'boolean'; },
    builtin: true,
    set alias(x) { throw do_not_alias_primitives },
  });
  store.set('number', {
    tid: 'number',
    type: 'P',
    digest(color) { return color ? tstr('number') : 'number'; },
    builtin: true,
    set alias(x) { throw do_not_alias_primitives },
  });
  store.set('null', {
    tid: 'null',
    type: 'P',
    digest(color) { return color ? tstr('null') : 'null'; },
    builtin: true,
    set alias(x) { throw do_not_alias_primitives },
  });
  store.set('string', {
    tid: 'string',
    type: 'P',
    digest(color) { return color ? tstr('string') : 'string'; },
    builtin: true,
    set alias(x) { throw do_not_alias_primitives },
  });
  store.set('undefined', {
    tid: 'undefined',
    type: 'P',
    digest(color) { return color ? tstr('undefined') : 'undefined'; },
    builtin: true,
    set alias(x) { throw do_not_alias_primitives },
  });

  createFunction(store, 'Array#concat', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
      log('Call had no args so return the context');
      return contextTid;
    }

    let kindTid;

    // Would be nice to support array-likes in the future...
    const contextTeeToUse = store.get(contextTid);
    if (contextTeeToUse.type !== 'A') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
      kindTid = 'undefined'; // :shrug:
    } else {
      kindTid = contextTeeToUse.kind;
      ASSERT(typeof kindTid === 'string', 'kinds should be strings', kindTid);
      const kindTee = store.get(kindTid);
      if (kindTee.type === 'H') { // If placeholder then we haven't seen any mutations yet
        store.linter.check('ARRAY_LAMBDA_ARR_KIND', locFrom, callerTee.tid);
      }
    }

    // For each arg, if the arg is an array, merge its kind with kindTid, otherwise merge the arg with kindTid
    callArgs.forEach((arg) => {
      const tee = store.get(arg);
      if (tee.type === 'A') {
        kindTid = merge(locFrom, store, tee.kind, kindTid);
      } else {
        kindTid = merge(locFrom, store, arg, kindTid);
      }
    });

    log('Returning fresh arr with resulting kind:', tstr(kindTid));
    return playActionArr(locFrom, store, undefined, stack, kindTid);
  });
  createFunction(store, 'Array#copyWithin', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 1 && callArgs[1] !== 'number') {
      store.linter.check('BUILTIN_ARG2_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 2 && callArgs[2] !== 'number') {
      store.linter.check('BUILTIN_ARG3_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 3) {
      store.linter.check('BUILTIN_ARG4_TMI', locFrom, callerTee.tid);
    }

    // Context ought to be an array type (although it could be anything, of course)
    const contextTee = store.get(contextTid);
    ASSERT(contextTee, 'should receive valid tee', contextTid);
    let kind = 'undefined';
    if (contextTee.type === 'A') {
      log('Creating a new array with the same kind:', tstr(contextTee.kind));
      kind = contextTee.kind;
    } else {
      // We may want to refine this check and support array-like
      store.linter.check('BUILTIN_CONTEXT_ARRAY', locFrom, callerTee.tid);
      log('copyWithin was called with a context that was not array so pushing an array of', tstr('undefined'));
    }

    return playActionArr(locFrom, store, undefined, stack, kind);
  });
  createFunction(store, 'Array#every', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('ARRAY_LAMBDA_UNDERFLOW', locFrom, callerTee.tid);
      log('Call had no args so there is no callback to call');
      return 'boolean';
    }

    if (argCount > 2) {
      store.linter.check('ARRAY_LAMBDA_OVERFLOW', locFrom, callerTee.tid);
    }

    const funcTid = callArgs[0];
    const contextTidToUse = argCount >= 2 ? callArgs[1] : contextTid;
    log('callback:', tstr(funcTid), ', context:', tstr(contextTidToUse));

    const funcTee = store.get(funcTid);
    const contextTeeToUse = store.get(contextTidToUse);
    ASSERT(funcTee && contextTeeToUse);

    // Would be nice to support array-likes in the future...
    if (contextTeeToUse.type !== 'A') {
      store.linter.check('ARRAY_LAMBDA_ARR_CONTEXT', locFrom, callerTee.tid);
    } else {
      const kindTid = contextTeeToUse.kind;
      ASSERT(typeof kindTid === 'string', 'kinds should be strings', kindTid);
      const kindTee = store.get(kindTid);
      if (kindTee.type === 'H') { // If placeholder then we haven't seen any mutations yet
        store.linter.check('ARRAY_LAMBDA_ARR_KIND', locFrom, callerTee.tid);
      }
    }

    if (funcTee.type !== 'F') {
      store.linter.check('ARRAY_LAMBDA_FUNC_ARG', locFrom, callerTee.tid);
      log('Cannot invoke this so ignoring the call. Returning an array of the same kind as the input array:', tstr(contextTeeToUse.kind));
    } else {
      const kindTid = contextTeeToUse.kind || 'undefined'; // Non-arrays and empty arrays have been warned against now
      contextTeeToUse.kind = kindTid; // If it didn't have a type, it does now. TODO: we can do better here ...

      group('Now calling the callback with a', tstr(kindTid), 'and a', tstr('number'), 'and the array being iterated:', tstr(contextTidToUse));
      const returnTid = metaCall(locFrom, funcTee.tid, contextTeeToUse.tid, isNew, stack, 3, [kindTid, 'number', contextTidToUse], -1, store, '', store.instanceId, true);
      log('The Array#every lambda call resulted in', tstr(returnTid));
      groupEnd();

      if (returnTid !== 'boolean' || returnTid !== 'undefined') {
        // Technically it doesn't really matter but for the sake of consistency, the callback ought to either return a boolean or undefined
        store.linter.check('ARRAY_ANYSOME_RETURNS', locFrom, callerTee.tid, returnTid);
      }
    }

    return 'boolean';
  });
  createFunction(store, 'Array#entries', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    store.linter.check('NO_ITERATORS', locFrom, callerTee.tid);

    if (argCount !== 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    const contextTee = store.get(contextTid);
    if (contextTee.type !== 'A') {
      // I _think_ this can be made to work? But too much of an edge case to bother. PR's are welcome. Bring tests.
      store.linter.check('BUILTIN_CONTEXT_ARRAY', locFrom, callerTee.tid);
      // Just return a bool and ignore the call otherwise
      return 'undefined';
    }

    log('Returning', tstr('undefined'));
    return 'undefined';
  });
  createFunction(store, 'Array#fill', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 2 && callArgs[1] !== 'number') {
      store.linter.check('BUILTIN_ARG2_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 3) {
      store.linter.check('BUILTIN_ARG3_TMI', locFrom, callerTee.tid);
    }

    const contextTee = store.get(contextTid);
    if (contextTee.type === 'A') {
      const filler = argCount > 0 ? callArgs[0] : 'undefined';
      const kindTee = store.get(contextTee.kind);
      if (kindTee.type === 'H') {
        // It's okay if this array is empty; in that case the kind is explicitly set now
        log('Now setting the kind of the array to the tid of the first arg:', tstr(filler));
        store.linkTo(kindTee, store.get(filler));
        contextTee.kind = filler;
      } else {
        log('Merge the needle with the kind now...');
        contextTee.kind = merge(locFrom, store, contextTee.kind, filler);
      }
    } else {
      store.linter.check('BUILTIN_CONTEXT_ARRAY', locFrom, callerTee.tid);
    }

    log('Return the same context:', tstr(contextTid));
    return contextTid;
  });
  createFunction(store, 'Array#filter', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('ARRAY_LAMBDA_UNDERFLOW', locFrom, callerTee.tid);
      log('Call had no args so there is no callback to call. Returning an array of type undefined');
      return playActionArr(locFrom, store, undefined, stack, 'undefined');
    }

    if (argCount > 2) {
      store.linter.check('ARRAY_LAMBDA_OVERFLOW', locFrom, callerTee.tid);
    }

    const funcTid = callArgs[0];
    const contextTidToUse = argCount >= 2 ? callArgs[1] : contextTid;
    log('callback:', tstr(funcTid), ', context:', tstr(contextTidToUse));

    const funcTee = store.get(funcTid);
    const contextTeeToUse = store.get(contextTidToUse);
    ASSERT(funcTee && contextTeeToUse);

    let kindTid = 'undefined'; // If the context is not an array
    // Would be nice to support array-likes in the future...
    if (contextTeeToUse.type === 'A') {
      kindTid = contextTeeToUse.kind;
      ASSERT(typeof kindTid === 'string', 'kinds should be strings', kindTid);
      const kindTee = store.get(kindTid);
      if (kindTee.type === 'H') { // If placeholder then we haven't seen any mutations yet
        store.linter.check('ARRAY_LAMBDA_ARR_KIND', locFrom, callerTee.tid);
      }
    } else {
      store.linter.check('ARRAY_LAMBDA_ARR_CONTEXT', locFrom, callerTee.tid);
    }

    if (funcTee.type === 'F') {
      group('Now calling the callback with a', tstr(kindTid), 'and a', tstr('number'), 'and the array being iterated:', tstr(contextTidToUse));
      const returnTid = metaCall(locFrom, funcTee.tid, contextTeeToUse.tid, isNew, stack, 3, [kindTid, 'number', contextTidToUse], -1, store, '', store.instanceId, true);
      log('The Array#filter lambda call resulted in', tstr(returnTid));
      groupEnd();

      if (returnTid !== 'boolean') {
        // This doesn't break the model but the lambda ought to return a boolean for filter.
        store.linter.check('ARRAY_FILTER_RETURNS', locFrom, callerTee.tid);
      }
    } else {
      store.linter.check('ARRAY_LAMBDA_FUNC_ARG', locFrom, callerTee.tid);
      log('Cannot invoke this so ignoring the call. Returning an array of the same kind as the input array:', tstr(contextTeeToUse.kind));
    }

    return playActionArr(locFrom, store, undefined, stack, kindTid);
  });
  createFunction(store, 'Array#find', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('ARRAY_LAMBDA_UNDERFLOW', locFrom, callerTee.tid);
      log('Call had no args so there is no callback to call. Returning an array of type undefined');
      return playActionArr(locFrom, store, undefined, stack, 'undefined');
    }

    if (argCount > 2) {
      store.linter.check('ARRAY_LAMBDA_OVERFLOW', locFrom, callerTee.tid);
    }

    const funcTid = callArgs[0];
    const contextTidToUse = argCount >= 2 ? callArgs[1] : contextTid;
    log('callback:', tstr(funcTid), ', context:', tstr(contextTidToUse));

    const funcTee = store.get(funcTid);
    const contextTeeToUse = store.get(contextTidToUse);
    ASSERT(funcTee && contextTeeToUse);

    let kindTid = 'undefined'; // If the context is not an array
    // Would be nice to support array-likes in the future...
    if (contextTeeToUse.type === 'A') {
      kindTid = contextTeeToUse.kind;
      ASSERT(typeof kindTid === 'string', 'kinds should be strings', kindTid);
      const kindTee = store.get(kindTid);
      if (kindTee.type === 'H') { // If placeholder then we haven't seen any mutations yet
        store.linter.check('ARRAY_LAMBDA_ARR_KIND', locFrom, callerTee.tid);
        log('Sealing the kind now because it is being returned');
        store.linkTo(kindTee, store.get('undefined'));
        kindTid = 'undefined';
        contextTeeToUse.kind = 'undefined';
      }
    } else {
      store.linter.check('ARRAY_LAMBDA_ARR_CONTEXT', locFrom, callerTee.tid);
    }

    if (funcTee.type === 'F') {
      group('Now calling the callback with a', tstr(kindTid), 'and a', tstr('number'), 'and the array being iterated:', tstr(contextTidToUse));
      const returnTid = metaCall(locFrom, funcTee.tid, contextTeeToUse.tid, isNew, stack, 3, [kindTid, 'number', contextTidToUse], -1, store, '', store.instanceId, true);
      log('The Array#find lambda call resulted in', tstr(returnTid));
      groupEnd();

      if (returnTid !== 'boolean') {
        // This doesn't break the model but the lambda ought to return a boolean for find.
        store.linter.check('ARRAY_FILTER_RETURNS', locFrom, callerTee.tid);
      }
    } else {
      store.linter.check('ARRAY_LAMBDA_FUNC_ARG', locFrom, callerTee.tid);
      log('Cannot invoke this so ignoring the call. Returning an array of the same kind as the input array:', tstr(contextTeeToUse.kind));
    }

    log('Returning the kind of the array:', tstr(kindTid));
    return kindTid;
  });
  createFunction(store, 'Array#findIndex', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('ARRAY_LAMBDA_UNDERFLOW', locFrom, callerTee.tid);
      log('Call had no args so there is no callback to call');
      return 'boolean';
    }

    if (argCount > 2) {
      store.linter.check('ARRAY_LAMBDA_OVERFLOW', locFrom, callerTee.tid);
    }

    const funcTid = callArgs[0];
    const contextTidToUse = argCount >= 2 ? callArgs[1] : contextTid;
    log('callback:', tstr(funcTid), ', context:', tstr(contextTidToUse));

    const funcTee = store.get(funcTid);
    const contextTeeToUse = store.get(contextTidToUse);
    ASSERT(funcTee && contextTeeToUse);

    let kindTid = 'undefined';
    // Would be nice to support array-likes in the future...
    if (contextTeeToUse.type === 'A') {
      kindTid = contextTeeToUse.kind;
      ASSERT(typeof kindTid === 'string', 'kinds should be strings', kindTid);
      const kindTee = store.get(kindTid);
      if (kindTee.type === 'H') { // If placeholder then we haven't seen any mutations yet
        store.linter.check('ARRAY_LAMBDA_ARR_KIND', locFrom, callerTee.tid);
      }
    } else {
      store.linter.check('ARRAY_LAMBDA_ARR_CONTEXT', locFrom, callerTee.tid);
    }

    if (funcTee.type !== 'F') {
      store.linter.check('ARRAY_LAMBDA_FUNC_ARG', locFrom, callerTee.tid);
      log('Cannot invoke this so ignoring the call. Returning a', tstr('boolean'));
      return 'boolean';
    }

    group('Now calling the callback with a', tstr(kindTid), 'and a', tstr('number'), 'and the array being iterated:', tstr(contextTidToUse));
    const returnTid = metaCall(locFrom, funcTee.tid, contextTeeToUse.tid, isNew, stack, 3, [kindTid, 'number', contextTidToUse], -1, store, '', store.instanceId, true);
    log('The Array#findIndex lambda call resulted in', tstr(returnTid));
    groupEnd();

    if (returnTid !== 'boolean' || returnTid !== 'undefined') {
      // Technically it doesn't really matter but for the sake of consistency, the callback ought to either return a boolean or undefined
      store.linter.check('ARRAY_FIND_RETURNS', locFrom, callerTee.tid);
    }

    return 'boolean';
  });
  createFunction(store, 'Array#flat', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // TODO: very technically this should do a toString() of the kind and follow that rabbit hole but :shrug:

    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    const contextTee = store.get(contextTid);
    if (contextTee.type !== 'A') {
      store.linter.check('BUILTIN_CONTEXT', locFrom, callerTee.tid);
      log('Returning an array of', tstr('undefined'));
      return playActionArr(locFrom, store, undefined, stack, 'undefined');
    }

    // Fetch the array and recursively find the first non-array. Create a new array with that kind and return it.
    let kindTid = contextTee.kind;
    let kindTee = store.get(kindTid);
    while (kindTee.type === 'A') {
      kindTid = kindTee.kind;
      kindTee = store.get(kindTid);
    }

    log('Returning an array of', tstr(kindTee));
    return playActionArr(locFrom, store, undefined, stack, kindTee);
  });
  createFunction(store, 'Array#flatMap', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('ARRAY_LAMBDA_UNDERFLOW', locFrom, callerTee.tid);
      log('Call had no args so there is no callback to call');
      return 'boolean';
    }

    if (argCount > 2) {
      store.linter.check('ARRAY_LAMBDA_OVERFLOW', locFrom, callerTee.tid);
    }

    const funcTid = callArgs[0];
    const contextTidToUse = argCount >= 2 ? callArgs[1] : contextTid;
    log('callback:', tstr(funcTid), ', context:', tstr(contextTidToUse));

    const funcTee = store.get(funcTid);
    const contextTeeToUse = store.get(contextTidToUse);
    ASSERT(funcTee && contextTeeToUse);

    let kindTid = 'undefined';
    // Would be nice to support array-likes in the future...
    if (contextTeeToUse.type === 'A') {
      kindTid = contextTeeToUse.kind;
      ASSERT(typeof kindTid === 'string', 'kinds should be strings', kindTid);
      const kindTee = store.get(kindTid);
      if (kindTee.type === 'H') { // If placeholder then we haven't seen any mutations yet
        store.linter.check('ARRAY_LAMBDA_ARR_KIND', locFrom, callerTee.tid);
      }
    } else {
      store.linter.check('ARRAY_LAMBDA_ARR_CONTEXT', locFrom, callerTee.tid);
    }

    if (funcTee.type !== 'F') {
      store.linter.check('ARRAY_LAMBDA_FUNC_ARG', locFrom, callerTee.tid);
      log('Cannot invoke this so ignoring the call. Returning a', tstr('boolean'));
      return 'boolean';
    }

    group('Now calling the callback with a', tstr(kindTid), 'and a', tstr('number'), 'and the array being iterated:', tstr(contextTidToUse));
    const returnTid = metaCall(locFrom, funcTee.tid, contextTeeToUse.tid, isNew, stack, 3, [kindTid, 'number', contextTidToUse], -1, store, '', store.instanceId, true);
    log('The Array#flatMap lambda call resulted in', tstr(returnTid), ', that is the kind of the array to be returned');
    groupEnd();

    return playActionArr(locFrom, store, undefined, stack, returnTid);
  });
  createFunction(store, 'Array#forEach', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('ARRAY_LAMBDA_UNDERFLOW', locFrom, callerTee.tid);
      log('Call had no args so there is no callback to call');
      return 'undefined';
    }

    if (argCount > 2) {
      store.linter.check('ARRAY_LAMBDA_OVERFLOW', locFrom, callerTee.tid);
    }

    const funcTid = callArgs[0];
    const contextTidToUse = argCount >= 2 ? callArgs[1] : contextTid;
    log('callback:', tstr(funcTid), ', context:', tstr(contextTidToUse));

    const funcTee = store.get(funcTid);
    const contextTeeToUse = store.get(contextTidToUse);
    ASSERT(funcTee && contextTeeToUse);

    // Would be nice to support array-likes in the future...
    if (contextTeeToUse.type !== 'A') {
      store.linter.check('ARRAY_LAMBDA_ARR_CONTEXT', locFrom, callerTee.tid);
    } else {
      const kindTid = contextTeeToUse.kind;
      ASSERT(typeof kindTid === 'string', 'kinds should be strings', kindTid);
      const kindTee = store.get(kindTid);
      if (kindTee.type === 'H') { // If placeholder then we haven't seen any mutations yet
        store.linter.check('ARRAY_LAMBDA_ARR_KIND', locFrom, callerTee.tid);
      }
    }

    if (funcTee.type !== 'F') {
      store.linter.check('ARRAY_LAMBDA_FUNC_ARG', locFrom, callerTee.tid);
      log('Cannot invoke this so ignoring the call');

      return 'undefined';
    }

    const kindTid = contextTeeToUse.kind || 'undefined'; // Non-arrays and empty arrays have been warned against now

    group('Now calling the callback with a', tstr(kindTid), 'and a', tstr('number'), 'and the array being iterated:', tstr(contextTeeToUse.tid));
    const returnTid = metaCall(locFrom, funcTee.tid, contextTeeToUse.tid, isNew, stack, 3, [kindTid, 'number', contextTeeToUse.tid], -1, store, '', store.instanceId, true);
    log('The Array#forEach lambda call resulted in', tstr(returnTid));
    groupEnd();

    // Ignore return value. And even though from a purist perspective it _ought_ to be undefined, we don't care.
    return 'undefined';
  });
  createFunction(store, 'Array#includes', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('ARRAY_INCLUDES_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 2 && callArgs[1] !== 'number') {
      store.linter.check('BUILTIN_ARG2_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 3) {
      store.linter.check('BUILTIN_ARG3_TMI', locFrom, callerTee.tid);
    }

    const contextTee = store.get(contextTid);
    if (contextTee.type === 'A') {
      const needle = argCount > 0 ? callArgs[0] : 'undefined';
      const kindTee = store.get(contextTee.kind);
      if (kindTee.type === 'H') {
        store.linter.check('ARRAY_KIND_EMPTY', locFrom, callerTee.tid);
        log('Now setting the kind of the array to the tid of the needle:', tstr(needle));
        store.linkTo(kindTee, store.get(needle));
        contextTee.kind = needle;
      } else {
        log('Merge the needle with the kind now...');
        merge(locFrom, store, contextTee.kind, needle);
      }
    } else {
      store.linter.check('BUILTIN_CONTEXT_ARRAY', locFrom, callerTee.tid);
    }

    return 'boolean';
  });
  createFunction(store, 'Array#indexOf', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('ARRAY_INCLUDES_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 2 && callArgs[1] !== 'number') {
      store.linter.check('BUILTIN_ARG2_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 3) {
      store.linter.check('BUILTIN_ARG3_TMI', locFrom, callerTee.tid);
    }

    const contextTee = store.get(contextTid);
    if (contextTee.type === 'A') {
      const needle = argCount > 0 ? callArgs[0] : 'undefined';
      const kindTee = store.get(contextTee.kind);
      if (kindTee.type === 'H') {
        store.linter.check('ARRAY_KIND_EMPTY', locFrom, callerTee.tid);
        log('Now setting the kind of the array to the tid of the needle:', tstr(needle));
        store.linkTo(kindTee, store.get(needle));
        contextTee.kind = needle;
      } else {
        log('Merge the needle with the kind now...');
        merge(locFrom, store, contextTee.kind, needle);
      }
    } else {
      store.linter.check('BUILTIN_CONTEXT_ARRAY', locFrom, callerTee.tid);
    }

    return 'number';
  });
  createFunction(store, 'Array#join', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // TODO: very technically this should do a toString() of the kind and follow that rabbit hole but :shrug:

    if (argCount === 0) {
      store.linter.check('ARRAY_JOIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'string') {
      store.linter.check('BUILTIN_ARG1_STRING', locFrom, callerTee.tid);
    }

    if (argCount > 1) {
      store.linter.check('ARRAY_JOIN_ARG2', locFrom, callerTee.tid);
    }

    const contextTee = store.get(contextTid);
    if (contextTee.type !== 'A') {
      store.linter.check('ARRAY_JOIN_CONTEXT', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'Array#keys', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    store.linter.check('NO_ITERATORS', locFrom, callerTee.tid);

    if (argCount !== 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    const contextTee = store.get(contextTid);
    if (contextTee.type !== 'A') {
      // I _think_ this can be made to work? But too much of an edge case to bother. PR's are welcome. Bring tests.
      store.linter.check('BUILTIN_CONTEXT_ARRAY', locFrom, callerTee.tid);
      // Just return a bool and ignore the call otherwise
      return 'undefined';
    }

    log('Returning', tstr('undefined'));
    return 'undefined';
  });
  createFunction(store, 'Array#lastIndexOf', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('ARRAY_INCLUDES_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 2 && callArgs[1] !== 'number') {
      store.linter.check('BUILTIN_ARG2_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 3) {
      store.linter.check('BUILTIN_ARG3_TMI', locFrom, callerTee.tid);
    }

    const contextTee = store.get(contextTid);
    if (contextTee.type === 'A') {
      const needle = argCount > 0 ? callArgs[0] : 'undefined';
      const kindTee = store.get(contextTee.kind);
      if (kindTee.type === 'H') {
        store.linter.check('ARRAY_KIND_EMPTY', locFrom, callerTee.tid);
        log('Now setting the kind of the array to the tid of the needle:', tstr(needle));
        store.linkTo(kindTee, store.get(needle));
        contextTee.kind = needle;
      } else {
        log('Merge the needle with the kind now...');
        merge(locFrom, store, contextTee.kind, needle);
      }
    } else {
      store.linter.check('BUILTIN_CONTEXT_ARRAY', locFrom, callerTee.tid);
    }

    return 'number';
  });
  createFunction(store, 'Array#map', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('ARRAY_LAMBDA_UNDERFLOW', locFrom, callerTee.tid);
      log('Call had no args so there is no callback to call');
      return playActionArr(locFrom, undefined, store, stack, 'undefined');
    }

    if (argCount > 2) {
      store.linter.check('ARRAY_LAMBDA_OVERFLOW', locFrom, callerTee.tid);
    }

    const funcTid = callArgs[0];
    const contextTidToUse = argCount >= 2 ? callArgs[1] : contextTid;
    log('callback:', tstr(funcTid), ', context:', tstr(contextTidToUse));

    const funcTee = store.get(funcTid);
    const contextTeeToUse = store.get(contextTidToUse);
    ASSERT(funcTee && contextTeeToUse);

    let kindTid = 'undefined';
    // Would be nice to support array-likes in the future...
    if (contextTeeToUse.type === 'A') {
      kindTid = contextTeeToUse.kind;
      ASSERT(typeof kindTid === 'string', 'kinds should be strings', kindTid);
      const kindTee = store.get(kindTid);
      if (kindTee.type === 'H') { // If placeholder then we haven't seen any mutations yet
        store.linter.check('ARRAY_LAMBDA_ARR_KIND', locFrom, callerTee.tid);
      }
    } else {
      store.linter.check('ARRAY_LAMBDA_ARR_CONTEXT', locFrom, callerTee.tid);
    }

    if (funcTee.type !== 'F') {
      store.linter.check('ARRAY_LAMBDA_FUNC_ARG', locFrom, callerTee.tid);
      log('Cannot invoke this so ignoring the call. Assuming the .filter would return an array of the same kind.');
      return playActionArr(locFrom, store, undefined, stack, kindTid);
    }

    group('Now calling the callback with a', tstr(kindTid), 'and a', tstr('number'), 'and the context', tstr(contextTidToUse));
    const returnTid = metaCall(locFrom, funcTee.tid, contextTeeToUse.tid, isNew, stack, 3, [kindTid, 'number', contextTidToUse], -1, store, '', store.instanceId, true);
    log('The Array#map lambda call resulted in', tstr(returnTid));
    groupEnd();

    // Wrap the return type in an array. That's what will be returned.
    return playActionArr(locFrom, store, undefined, stack, returnTid);
  });
  createFunction(store, 'Array#pop', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    store.linter.check('ARRAY_POP_UNDERFLOW', locFrom, callerTee.tid);

    if (argCount > 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    // Context ought to be an array type (although it could be anything, of course)
    const contextTee = store.get(contextTid);
    ASSERT(contextTee, 'should receive valid tee', contextTid);
    if (contextTid[0] !== 'A') {
      // We may want to refine this check and support array-like
      store.linter.check('BUILTIN_CONTEXT_ARRAY', locFrom, callerTee.tid);

      log('Since context is unknown we now push', tstr('undefined'));
      return 'undefined';
    }

    const kindTid = contextTee.kind;
    ASSERT(typeof kindTid === 'string', 'kind should be a string', contextTee.kind);
    const kindTee = store.get(kindTid);
    if (kindTee.type === 'H') { // A placeholder must mean we haven't seen concrete operations to this array yet, right?
      store.linter.check('ARRAY_POP_EMPTY', locFrom, callerTee.tid);
      log('Array had no kind yet so now sealing its kind to', tstr('undefined'));
      store.linkTo(kindTee, store.get('undefined'));
      contextTee.kind = 'undefined';
      return 'undefined';
    }

    log('The array kind is:', tstr(kindTee.tid));
    return kindTee.tid;
  });
  createFunction(store, 'Array#push', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('ARRAY_PUSH_NO_ARGS', locFrom, callerTee.tid);
    }

    // Context ought to be an array type (although it could be anything, of course)
    const contextTee = store.get(contextTid);
    ASSERT(contextTee, 'should receive valid tee', contextTid)

    log('Meta pushing', callArgs.map(tstr).join(', '), 'onto', tstr(contextTee.tid), '(so merging its kind with those args)');

    // We may need to refine this but right now we can verify array tids with their tid prefix
    if (contextTee.type !== 'A') {
      store.linter.check('ARRAY_PUSH_CONTEXT', locFrom, callerTee.tid);
      log('Returning a', tstr('number'), ', but not sure what the runtime would do here');
      return 'number';
    }

    if (argCount === 0) {
      log('There were no args to push into the array. Returning', tstr('number'), ' (new array length)');
      return 'number';
    }

    const kindTee = store.get(contextTee.kind);
    if (kindTee.type === 'H') {
      // I don't think we should throw a lint here. The array is empty but its kind is explicitly
      // set here so that should not be a problem.
      // store.linter.check('ARRAY_KIND_EMPTY', locFrom, callerTee.tid);
      log('Array had no kind yet, setting it to the merged tee of the push args');
      log('Setting it to the tid of the first arg which will be merged with all the others:', tstr(callArgs[0]));

      const argTid = callArgs[0]; // There has to be at least one
      const argTee = store.get(argTid);

      store.linkTo(kindTee, argTee);
      contextTee.kind = argTee.tid;
    }

    // First test the merge (without changes or lints). If that fails, issue (only) a mono_kind error
    const toMerge = [contextTee.kind, ...callArgs];
    log('Merging all other args with the kind', tstr(contextTee.kind));
    if (mergeTestAll(locFrom, toMerge, store)) {
      // Have to do an actual merge, anyways, because it may mutate tees
      contextTee.kind = mergeAll(locFrom, toMerge, store);
    } else {
      // This is what happens when you do [1].push('a')
      store.linter.check('ARR_MONO_KIND', locFrom, callerTee.tid);
    }

    // Array push returns the new size of the array
    return 'number';
  });
  createFunction(store, 'Array#reduce', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('ARRAY_LAMBDA_UNDERFLOW', locFrom, callerTee.tid);
      log('Call had no args so there is no callback to call');
      return playActionArr(locFrom, undefined, store, stack, 'undefined');
    }

    if (argCount > 2) {
      store.linter.check('ARRAY_LAMBDA_OVERFLOW', locFrom, callerTee.tid);
    }

    const funcTid = callArgs[0];
    const contextTidToUse = contextTid; // Note: second arg is NOT context override
    const funcTee = store.get(funcTid);
    const contextTeeToUse = store.get(contextTidToUse);
    log('callback:', tstr(funcTid), ', context:', tstr(contextTidToUse), ', kind:', tstr(contextTeeToUse.kind));

    ASSERT(funcTee && contextTeeToUse);

    let kindTid = 'undefined';
    // Would be nice to support array-likes in the future...
    if (contextTeeToUse.type === 'A') {
      kindTid = contextTeeToUse.kind;
      ASSERT(typeof kindTid === 'string', 'kinds should be strings', kindTid);
      const kindTee = store.get(kindTid);
      if (kindTee.type === 'H') { // If placeholder then we haven't seen any mutations yet
        store.linter.check('ARRAY_REDUCE_ARR_KIND', locFrom, callerTee.tid);
      }
    } else {
      store.linter.check('ARRAY_LAMBDA_ARR_CONTEXT', locFrom, callerTee.tid);
    }

    if (funcTee.type !== 'F') {
      store.linter.check('ARRAY_LAMBDA_FUNC_ARG', locFrom, callerTee.tid);
      log('Cannot invoke this so ignoring the call. Assuming the .filter would return an array of the same kind.');
      return playActionArr(locFrom, store, undefined, stack, kindTid);
    }

    let accTid = kindTid;
    if (argCount > 1) {
      // The second arg is the first accumulator, otherwise the kind of the arg is. They don't need to be the same.
      accTid = callArgs[1];
    }

    group('Now calling the callback with an accumulator', tstr(accTid), ', a current tid', tstr(kindTid), 'and an index', tstr('number'), 'and the context', tstr(contextTidToUse));
    let returnTid = metaCall(locFrom, funcTee.tid, contextTeeToUse.tid, isNew, stack, 4, [accTid, kindTid, 'number', contextTidToUse], -1, store, '', store.instanceId, true);
    log('The Array#reduce lambda call resulted in', tstr(returnTid), '. It ought to be the same as the accumulator', tstr(accTid), 'so merging them now');
    returnTid = merge(locFrom, store, returnTid, accTid);
    groupEnd();

    log('Returning the returned value which is accumulator:', tstr(returnTid));
    return returnTid;
  });
  createFunction(store, 'Array#reduceRight', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('ARRAY_LAMBDA_UNDERFLOW', locFrom, callerTee.tid);
      log('Call had no args so there is no callback to call');
      return playActionArr(locFrom, undefined, store, stack, 'undefined');
    }

    if (argCount > 2) {
      store.linter.check('ARRAY_LAMBDA_OVERFLOW', locFrom, callerTee.tid);
    }

    const funcTid = callArgs[0];
    const contextTidToUse = contextTid; // Note: second arg is NOT context override
    log('callback:', tstr(funcTid), ', context:', tstr(contextTidToUse));

    const funcTee = store.get(funcTid);
    const contextTeeToUse = store.get(contextTidToUse);
    ASSERT(funcTee && contextTeeToUse);

    let kindTid = 'undefined';
    // Would be nice to support array-likes in the future...
    if (contextTeeToUse.type === 'A') {
      kindTid = contextTeeToUse.kind;
      ASSERT(typeof kindTid === 'string', 'kinds should be strings', kindTid);
      const kindTee = store.get(kindTid);
      if (kindTee.type === 'H') { // If placeholder then we haven't seen any mutations yet
        store.linter.check('ARRAY_REDUCE_ARR_KIND', locFrom, callerTee.tid);
      }
    } else {
      store.linter.check('ARRAY_LAMBDA_ARR_CONTEXT', locFrom, callerTee.tid);
    }

    if (funcTee.type !== 'F') {
      store.linter.check('ARRAY_LAMBDA_FUNC_ARG', locFrom, callerTee.tid);
      log('Cannot invoke this so ignoring the call. Assuming the .filter would return an array of the same kind.');
      return playActionArr(locFrom, store, undefined, stack, kindTid);
    }

    let accTid = kindTid;
    if (argCount > 1) {
      // The second arg is the first accumulator, otherwise the kind of the arg is. They don't need to be the same.
      accTid = callArgs[1];
    }

    group('Now calling the callback with an accumulator', tstr(accTid), ', a current tid', tstr(kindTid), 'and an index', tstr('number'), 'and the context', tstr(contextTidToUse));
    let returnTid = metaCall(locFrom, funcTee.tid, contextTeeToUse.tid, isNew, stack, 4, [accTid, kindTid, 'number', contextTidToUse], -1, store, '', store.instanceId, true);
    log('The Array#reduceRight lambda call resulted in', tstr(returnTid), '. It ought to be the same as the accumulator', tstr(accTid), 'so merging them now');
    returnTid = merge(locFrom, store, returnTid, accTid);
    groupEnd();

    log('Returning the returned value which is accumulator:', tstr(returnTid));
    return returnTid;
  });
  createFunction(store, 'Array#reverse', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount > 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    const contextTee = store.get(contextTid);
    if (contextTee.type !== 'A') {
      store.linter.check('BUILTIN_CONTEXT_ARRAY', locFrom, callerTee.tid);
    }

    // Since the array kind os irrelevant to `reverse`, we're gonna skip checking it entirely.
    // The reverse is in place and returns the same context
    return contextTid;
  });
  createFunction(store, 'Array#shift', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    store.linter.check('ARRAY_SHIFT_UNDERFLOW', locFrom, callerTee.tid);

    if (argCount > 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    // Context ought to be an array type (although it could be anything, of course)
    const contextTee = store.get(contextTid);
    ASSERT(contextTee, 'should receive valid tee', contextTid);
    if (contextTid[0] !== 'A') {
      // We may want to refine this check and support array-like
      store.linter.check('BUILTIN_CONTEXT_ARRAY', locFrom, callerTee.tid);

      log('Since context is not an array we now return', tstr('undefined'));
      return 'undefined';
    }

    const kindTee = store.get(contextTee.kind);
    if (kindTee.type === 'H') {
      store.linter.check('ARRAY_SHIFT_EMPTY', locFrom, callerTee.tid);
      log('Array had no kind yet, must be empty, sealing kind to', tstr('undefined'), 'and returning it');
      store.linkTo(kindTee, store.get('undefined'));
      contextTee.kind = 'undefined';
      return 'undefined';
    }

    log('The array kind is:', tstr(kindTee.tid));
    return kindTee.tid;
  });
  createFunction(store, 'Array#slice', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 1 && callArgs[1] !== 'number') {
      store.linter.check('BUILTIN_ARG2_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 2) {
      store.linter.check('BUILTIN_ARG3_TMI', locFrom, callerTee.tid);
    }

    // Context ought to be an array type (although it could be anything, of course)
    const contextTee = store.get(contextTid);
    ASSERT(contextTee, 'should receive valid tee', contextTid);
    let kind = 'undefined';
    if (contextTee.type === 'A') {
      log('Creating a new array with the same kind:', tstr(contextTee.kind));
      kind = contextTee.kind;
    } else {
      // We may want to refine this check and support array-like
      store.linter.check('BUILTIN_CONTEXT_ARRAY', locFrom, callerTee.tid);
      log('Slice was called with a context that was not array so pushing an array of', tstr('undefined'));
    }

    return playActionArr(locFrom, store, undefined, stack, kind);
  });
  createFunction(store, 'Array#some', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('ARRAY_LAMBDA_UNDERFLOW', locFrom, callerTee.tid);
      log('Call had no args so there is no callback to call');
      return 'boolean';
    }

    if (argCount > 2) {
      store.linter.check('ARRAY_LAMBDA_OVERFLOW', locFrom, callerTee.tid);
    }

    const funcTid = callArgs[0];
    const contextTidToUse = argCount >= 2 ? callArgs[1] : contextTid;
    log('callback:', tstr(funcTid), ', context:', tstr(contextTidToUse));

    const funcTee = store.get(funcTid);
    const contextTeeToUse = store.get(contextTidToUse);
    ASSERT(funcTee && contextTeeToUse);

    let kindTid = 'undefined';
    // Would be nice to support array-likes in the future...
    if (contextTeeToUse.type === 'A') {
      kindTid = contextTeeToUse.kind;
      ASSERT(typeof kindTid === 'string', 'kinds should be strings', kindTid);
      const kindTee = store.get(kindTid);
      if (kindTee.type === 'H') { // If placeholder then we haven't seen any mutations yet
        store.linter.check('ARRAY_LAMBDA_ARR_KIND', locFrom, callerTee.tid);
      }
    } else {
      store.linter.check('ARRAY_LAMBDA_ARR_CONTEXT', locFrom, callerTee.tid);
    }

    if (funcTee.type !== 'F') {
      store.linter.check('ARRAY_LAMBDA_FUNC_ARG', locFrom, callerTee.tid);
      log('Cannot invoke this so ignoring the call. Returning a', tstr('boolean'));
      return 'boolean';
    }

    group('Now calling the callback with a', tstr(kindTid), 'and a', tstr('number'), 'and the array being iterated:', tstr(contextTidToUse));
    const returnTid = metaCall(locFrom, funcTee.tid, contextTeeToUse.tid, isNew, stack, 3, [kindTid, 'number', contextTidToUse], -1, store, '', store.instanceId, true);
    log('The Array#some lambda call resulted in', tstr(returnTid));
    groupEnd();

    if (returnTid !== 'boolean' || returnTid !== 'undefined') {
      // Technically it doesn't really matter but for the sake of consistency, the callback ought to either return a boolean or undefined
      store.linter.check('ARRAY_ANYSOME_RETURNS', locFrom, callerTee.tid);
    }

    return 'boolean';
  });
  createFunction(store, 'Array#sort', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // We could warn against no args but it could very well be intentional ...

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    if (argCount > 0) {
      const funcTid = callArgs[0];
      const contextTidToUse = argCount >= 2 ? callArgs[1] : contextTid;
      log('callback:', tstr(funcTid), ', context:', tstr(contextTidToUse));

      const funcTee = store.get(funcTid);
      const contextTeeToUse = store.get(contextTidToUse);
      ASSERT(funcTee && contextTeeToUse);

      let kindTid = 'undefined';
      // Would be nice to support array-likes in the future...
      if (contextTeeToUse.type === 'A') {
        kindTid = contextTeeToUse.kind;
        ASSERT(typeof kindTid === 'string', 'kinds should be strings', kindTid);
        const kindTee = store.get(kindTid);
        if (kindTee.type === 'H') { // If placeholder then we haven't seen any mutations yet
          store.linter.check('ARRAY_LAMBDA_ARR_KIND', locFrom, callerTee.tid);
        }
      } else {
        store.linter.check('ARRAY_LAMBDA_ARR_CONTEXT', locFrom, callerTee.tid);
      }

      if (funcTee.type !== 'F') {
        store.linter.check('ARRAY_LAMBDA_FUNC_ARG', locFrom, callerTee.tid);
        log('Cannot invoke this so ignoring the call. Assuming the .filter would return an array of the same kind.');
        return playActionArr(locFrom, store, undefined, stack, kindTid);
      }

      group('Now calling the callback with the kind', tstr(kindTid), ', twice');
      const returnTid = metaCall(locFrom, funcTee.tid, contextTeeToUse.tid, isNew, stack, 2, [kindTid, kindTid], -1, store, '', store.instanceId, true);
      log('The Array#sort lambda call resulted in', tstr(returnTid), '(which we ignore)');
      groupEnd();
    }

    log('Returning the original context:', tstr(contextTid));
    return contextTid;
  });
  createFunction(store, 'Array#splice', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'number') {
      // Offset of the splice
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 1 && callArgs[1] !== 'number') {
      // Number of elements to remove
      store.linter.check('BUILTIN_ARG2_NUMBER', locFrom, callerTee.tid);
    }

    const newElements = callArgs.slice(2);
    if (argCount > 2) {
      log('Injecting the following tids into the array, meaning we will merge them with its kind: [', newElements.map(tstr).join(', '), ']');
    }

    // Context ought to be an array type (although it could be anything, of course)
    const contextTee = store.get(contextTid);
    ASSERT(contextTee, 'should receive valid tee', contextTid);
    let kind = 'undefined'; // Prefer the type of the arg being injected. But otherwise default to undefined
    if (contextTee.type === 'A') {
      log('Creating a new array with the same kind:', tstr(contextTee.kind));
      kind = contextTee.kind;
    } else {
      // We may want to refine this check and support array-like
      store.linter.check('BUILTIN_CONTEXT_ARRAY', locFrom, callerTee.tid);

      if (newElements.length) {
        log('Slice was called on a non array that injects new elements. This is broken as heck. Returning array with kind of one of the injected elements:', tstr(newElements[newElements.length - 1]));
        kind = newElements[0];
      } else {
        log('Slice was called with a context that was not array so returning an array of', tstr('undefined'));
      }
    }

    if (newElements.length) {
      log('Merging the new elements with the array kind now...');
      kind = mergeAll(locFrom, newElements, store);
    }

    if (contextTee.type === 'A') {
      contextTee.kind = kind;
    }

    ASSERT_TID(kind);

    // Note: splice does return a NEW array. So create its tid now.
    // Splice returns an array with the removed elements, if any.
    return playActionArr(locFrom, store, undefined, stack, kind);
  });
  createFunction(store, 'Array#toString', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // TODO: very technically this should do a toString() of the kind and follow that rabbit hole but :shrug:

    if (argCount > 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    const contextTee = store.get(contextTid);
    if (contextTee.type !== 'A') {
      store.linter.check('ARRAY_JOIN_CONTEXT', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'Array#toLocaleString', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // TODO: very technically this should do a toString() of the kind and follow that rabbit hole but :shrug:

    if (argCount > 0 && callArgs[0] !== 'string') {
      store.linter.check('BUILTIN_ARG1_STRING', locFrom, callerTee.tid);
    }

    // Meh. Ignoring this one.
    // if (argCount > 1 && callArgs[1] !== '...') {
    //   store.linter.check('BUILTIN_ARG1_', locFrom, callerTee.tid);
    // }

    if (argCount > 2) {
      store.linter.check('BUILTIN_ARG3_TMI', locFrom, callerTee.tid);
    }

    const contextTee = store.get(contextTid);
    if (contextTee.type !== 'A') {
      store.linter.check('ARRAY_JOIN_CONTEXT', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'Array#unshift', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('ARRAY_UNSHIFT_NO_ARGS', locFrom, callerTee.tid);
    }

    // Context ought to be an array type (although it could be anything, of course)
    const contextTee = store.get(contextTid);
    ASSERT(contextTee, 'should receive valid tee', contextTid)

    if (contextTee.type !== 'A') {
      store.linter.check('ARRAY_UNSHIFT_CONTEXT', locFrom, callerTee.tid);
      log('Returning a', tstr('number'), 'but not sure what the runtime would do here');
      return 'number';
    }

    if (argCount === 0) {
      store.linter.check('ARRAY_UNSHIFT_NO_ARGS', locFrom, callerTee.tid);
      log('Returning a', tstr('number'), '(new array length)');
      return 'number';
    }

    let kindTee = store.get(contextTee.kind);
    if (kindTee.type === 'H') {
      log('Array had no kind yet, setting it to the merged tee of the unshift args');
      const argTee = store.get(callArgs[0]);
      log('Setting it to the tid of the first arg which will be merged with all the others:', tstr(argTee.tid));
      store.linkTo(kindTee, argTee);
      contextTee.kind = argTee.tid;

      kindTee = argTee;
    }

    log('Merging all args with the kind', tstr(kindTee.tid));
    // First test the merge (without changes or lints). If that fails, issue (only) a mono_kind error
    if (mergeTestAll(locFrom, callArgs, store)) {
      // Have to do an actual merge, anyways, because it may mutate tees
      const kind = mergeAll(locFrom, callArgs, store);
      contextTee.kind = merge(locFrom, store, kind, contextTee.kind);
    } else {
      // This is what happens when you do [1].unshift('a')
      store.linter.check('ARR_MONO_KIND', locFrom, callerTee.tid);
    }

    // Array unshift returns the new size of the array
    return 'number';
  });
  createFunction(store, 'Array#values', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    store.linter.check('NO_ITERATORS', locFrom, callerTee.tid);

    if (argCount !== 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    const contextTee = store.get(contextTid);
    if (contextTee.type !== 'A') {
      // I _think_ this can be made to work? But too much of an edge case to bother. PR's are welcome. Bring tests.
      store.linter.check('BUILTIN_CONTEXT_ARRAY', locFrom, callerTee.tid);
      // Just return a bool and ignore the call otherwise
      return 'undefined';
    }

    log('Returning', tstr('undefined'));
    return 'undefined';
  });

  playActionBuiltinObj(store, 'Array.prototype', new Map([
    ['__proto__', 'Object.prototype'],
    ['concat', 'Array#concat'],
    ['copyWithin', 'Array#copyWithin'],
    ['every', 'Array#every'],
    ['entries', 'Array#entries'],
    ['fill', 'Array#fill'],
    ['forEach', 'Array#forEach'],
    ['filter', 'Array#filter'],
    ['find', 'Array#find'],
    ['findIndex', 'Array#findIndex'],
    ['flat', 'Array#flat'],
    ['flatMap', 'Array#flatMap'],
    ['includes', 'Array#includes'],
    ['indexOf', 'Array#indexOf'],
    ['lastIndexOf', 'Array#lastIndexOf'],
    ['join', 'Array#join'],
    ['length', 'number'],
    ['keys', 'Array#keys'],
    ['map', 'Array#map'],
    ['pop', 'Array#pop'],
    ['push', 'Array#push'],
    ['reduce', 'Array#reduce'],
    ['reduceRight', 'Array#reduceRight'],
    ['reverse', 'Array#reverse'],
    ['shift', 'Array#shift'],
    ['slice', 'Array#slice'],
    ['some', 'Array#some'],
    ['sort', 'Array#sort'],
    ['splice', 'Array#splice'],
    ['toString', 'Array#toString'],
    ['toLocaleString', 'Array#toLocaleString'],
    ['unshift', 'Array#unshift'],
    ['values', 'Array#values'],
  ]));
  createFunction(store, 'Array.from', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0) {
      // Simple edge case
      if (callArgs[0] === 'string') {
        log('Array.from(' + tstr('string') + ') is an array of string');
        return playActionArr(locFrom, store, undefined, stack, 'string');
      }
    }

    store.linter.check('TOFIX', locFrom, callerTee.tid);

    return 'undefined';
  });
  createFunction(store, 'Array.isArray', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('ARRAY_ISARRAY_ARGLESS', locFrom, callerTee.tid);
    }

    // Ignore the first arg type. Technically we could eliminate this call entirely because we should know which
    // values are or aren't arrays. But due to function args being polymorphic that seems unnecessarily tight.

    if (argCount > 1) {
      store.linter.check('ARRAY_ISARRAY_ARG2', locFrom, callerTee.tid);
    }

    return 'boolean';
  });
  createFunction(store, 'Array.of', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('ARRAY_ISARRAY_ARGLESS', locFrom, callerTee.tid);
      const pid = createPlaceholder('HAO', 'array from without params');
      return playActionArr(locFrom, store, undefined, stack, pid);
    }

    let kindTid = mergeAll(locFrom, callArgs, store);

    log('Returning an array of kind', tstr(kindTid));
    return playActionArr(locFrom, store, undefined, stack, kindTid);
  });
  createConstructor(store, 'Array', 'Array.prototype', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    // New behavior is same as without new
    log(BOLD + 'Array' + RESET + '(' + callArgs.map(tstr).join(', ')+')');

    // Edge case: if there was a spread and there was one arg, or two with the first being a number, then create
    // an array with the same kind and call it a day. For anything else issue a lint and merge the array kind with
    // all the other elements.

    let kindTid = 'undefined';
    if (spreadAt === 0 || (spreadAt === 1 && callArgs[0] === 'number')) {
      // This is Array(...x) or Array(10, ...x). Consider the array kind equal to the kind of x, which is the first arg
      // Don't care about other spreadAt cases. TODO: not sure this is even a special case here
      ASSERT((spreadAt === 0 && argCount === 1) || (spreadAt === 1 && argCount === 2), 'argcount should match spread index', argCount, spreadAt);
      log('The spread into Array causes an array by the same kind:', tstr(callArgs[1]));
      kindTid = callArgs[spreadAt === 1 ? 1 : 0];
    } else if (argCount === 0) {
      log('This is `Array()` and it should do the same as `[]`');

      kindTid = createPlaceholder(store, 'HACKE', 'Array() kind');
    } else if (argCount === 1 && callArgs[0] === 'number') {
      // Check if TOP is a number. In that case, pop the arg and return array with unresolved kind
      log('This is `Array(number)` and it should do the same as `[]`, drop the arg');

      kindTid = createPlaceholder(store, 'HACKN', 'Array(number) kind');
    } else {
      ASSERT(argCount > 0 && !(argCount === 1 && callArgs[0] === 'number'), 'this else branch should mean there are args and it is not just a number');
      // Use first arg as kind and merge remaining ones into it
      log('This is `Array(args)` with either multiple args or a single non-number arg. Merge them:', callArgs.map(tstr).join(', '));
      kindTid = mergeAll(locFrom, callArgs, store);
    }
    log('Resulting kind:', tstr(kindTid));
    return playActionArr(locFrom, store, undefined, stack, kindTid);
  }, [['from', 'Array.from'], ['isArray', 'Array.isArray'], ['of', 'Array.of']]);

  createFunction(store, 'Boolean#toString', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount > 0) {
      store.linter.check('BOOLEAN_TOSTRING_ARGS', locFrom, callerTee.tid);
    }

    if (contextTid !== 'boolean') {
      store.linter.check('BOOLEAN_TOSTRING_CONTEXT', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'Boolean#valueof', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount > 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'boolean') {
      store.linter.check('BUILTIN_CONTEXT_BOOL', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('boolean'));
    return 'boolean';
  });
  playActionBuiltinObj(store, 'Boolean.prototype', new Map([
    ['__proto__', 'Object.prototype'],
    ['length', 'number'],
    ['toString', 'Boolean#toString'],
    ['valueof', 'Boolean#valueof'],
  ]));
  createConstructor(store, 'Boolean', 'Boolean.prototype', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // No need to coerce the arg, that's the whole point of calling this function. Arguably this shouldn't be necessary.

    return 'boolean';
  });

  createFunction(store, 'Error#toString', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount > 0) {
      store.linter.check('ERROR_TOSTRING_ARGS', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  playActionBuiltinObj(store, 'Error.prototype', new Map([
    ['__proto__', 'Object.prototype'],
    ['message', 'string'],
    ['name', 'string'], // "Error"
    ['stack', 'string'],
    ['toString', 'Error#toString'],
  ]));
  createConstructor(store, 'Error', 'Error.prototype', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    // Without `new` do the same as if it had been called with `new`
    if (!isNew) {
      return playActionNew(locFrom, store, stack, spreadAt, 'Error', callArgs);
    }

    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount >= 1) {
      if (callArgs[0] === 'string') {
        // It is optional. If it is not given then the .message property is not set at all.
        const tee = store.get(contextTid);
        ASSERT(tee && tee.props, 'error context should be an object', tee);
        tee.setProp('message', 'string');
      } else {
        store.linter.check('ERROR_STRING_ARG', locFrom, callerTee.tid);
      }
    }

    if (argCount >= 2) {
      store.linter.check('ERROR_ARITY', locFrom, callerTee.tid);
    }

    return contextTid;
  });

  createFunction(store, 'Function#apply', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    log('Received args:', callArgs.map(tstr).join(', '));

    // Context ought to be a callable of sorts
    log('Context ought to be callable:', tstr(contextTid));
    const calleeTee = store.get(contextTid);

    // The first arg of the `f.call()` expression is the context of the actual call to `f`
    const givenContext = argCount > 0 ? callArgs[0] : 'undefined';
    log('Given context:', tstr(givenContext));
    // The bound context cannot be overridden through .call, .apply, or .bind
    const calleeContext = calleeTee.boundContext ? calleeTee.boundContext : givenContext;
    if (calleeTee.boundContext) log('The function was bound to', tstr(calleeTee.boundContext));
    log('The context of the .apply invocation will be:', tstr(calleeContext));

    const arrTid = argCount > 1 ? callArgs[1] : 'undefined';

    if (argCount > 2) {
      // Drop the excessive args
      store.linter.check('FUNCTION_APPLY_ARGCOUNT', locFrom, callerTee.tid);
    }

    // Get the kind of the array, assuming that's what it is. TODO: what about string and iterables?
    const kindTid = argCount === 0 ? 'undefined' : playActionKind(locFrom, store, stack, arrTid);
    log('The arguments will be:', tstr(kindTid));

    const indentBefore = getIndent();

    group('Now .call invoking the function...');
    const returnTid = metaCall(locFrom, contextTid, calleeContext, false, stack, argCount > 1 ? 1 : 0, [kindTid], argCount >= 2 ? 0 : -1, store, '', store.instanceId, false);
    log('The .apply resulted in', tstr(returnTid));
    groupEnd();

    ASSERT(indentBefore === getIndent(), 'indent should be same before and after call');

    return returnTid;
  });
  createFunction(store, 'Function#bind', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    log('Args:', callArgs.map(tstr).join(', '));

    // Context ought to be a callable of sorts
    log('Context ought to be callable:', tstr(contextTid));
    const callee = store.get(contextTid);
    ASSERT(callee);

    // The first arg of the `f.bind()` expression is the context of the actual call to `f`
    const givenContext = argCount > 0 ? callArgs[0] : 'undefined';
    log('Given context:', tstr(givenContext));
    // The bound context cannot be overridden through .call, .apply, or .bind
    const calleeContext = callee.boundContext ? callee.boundContext : givenContext;
    if (callee.boundContext) log('The function was bound to', tstr(calleeTee.boundContext));
    log('The context the function is .bind to will be:', tstr(calleeContext));

    const isClass = callee.funcType.startsWith('class');

    ASSERT(typeof callee.thisAccess === 'boolean', 'callee have this');
    if (callee.thisAccess && calleeContext === 'undefined') {
      store.linter.check('FUNCTION_BIND_BAD_CONTEXT', locFrom, callerTee.tid);
    }
    if (isClass) {
      store.linter.check('FUNCTION_BIND_CLASS', locFrom, callerTee.tid);
      if (calleeContext !== 'undefined') {
        store.linter.check('FUNCTION_BIND_CLASS_CONTEXT', locFrom, callerTee.tid);
      }
    } else if (!callee.thisAccess && calleeContext !== 'undefined') {
      // Note: global would be explicit since this is strict mode
      log('This function does not contain the keyword `this` and the context is not `undefined`');
      store.linter.check('FUNCTION_BIND_THISLESS_CONTEXT', locFrom, callerTee.tid);
    }

    const boundParams = callArgs.slice(1); // Ignore first arg since that's the context
    log('Bound params:', boundParams.map(tstr).join(', ') || '<none>');

    // Do not bind more args than there are params
    while (boundParams.length > callee.paramNames.length) {
      boundParams.pop();
    }

    // const [funcName, paramNames, body] = data
    const tid = (isClass ? 'CB' : 'FB') + String(++store.uid);

    const props = new Map([ // This is fresh so do not copy it
      // ['prototype', null], // TODO: bound functions cannot be `new`ed, but they can be `super`ed :/
      ['__proto__', 'Function.prototype'],
    ]);

    if (callee.funcType.startsWith('method')) {
      store.superStack.push(callee.superPropOwner);
    }
    const funcTid = playActionFunc(locFrom, {
      store,
      tid,
      stack,
      closure: callee.parentClosure, // This doesn't change. You can't change this.
      callerContext: calleeContext,
      nid: isClass ? 'class' : callee.nid,
      funcName: callee.funcExprName,
      paramNames: callee.paramNames || [], // Classes can be bound but have no params here
      paramBindingNames: callee.paramBindingNames || [], // Classes can be bound but have no params here
      hasRest: callee.hasRest,
      minParamRequired: callee.minParamRequired,
      body: callee.body,
      funcType: callee.funcType + (callee.funcType.endsWith('-bound') ? '' : '-bound'),
      thisAccess: callee.thisAccess,
      reachableNames: callee.reachableNames,
      ownerClass: callee.ownerClass, // Needed to resolve syntactical owner class for bound class
      superClass: callee.superClass, // Edge case: the super bond survives a .bind(). I know, right.
      boundContext: calleeContext,
      boundParams: boundParams,
      funcTokenIndex: undefined,
      fromFilename: callee.fromFilename, // Actions are still corresponding to nodes in/from this file
      fromColumn: callee.fromColumn,
      fromLine: callee.fromLine,
      userDesc: callee.userDesc + ', bound',
      useProps: props,
    });
    if (callee.funcType.startsWith('method')) {
      store.superStack.pop();
    }

    const btee = store.get(funcTid);
    ASSERT(btee.tid === tid, 'should use passed on tid', btee.tid, tid);
    btee._type = 'bind';
    btee._clone = 'bind(' + btee.tid + ', ' + btee._clone + ')';

    log('Created a bound function for', tstr(callee.tid), 'as', tstr(tid));

    return funcTid;
  });
  createFunction(store, 'Function#call', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // Context ought to be a callable of sorts
    log('Context ought to be callable:', tstr(contextTid));
    const calleeTee = store.get(contextTid);

    // The first arg of the `f.call()` expression is the context of the actual call to `f`
    const givenContext = argCount > 0 ? callArgs[0] : 'undefined'
    // The bound context cannot be overridden through .call, .apply, or .bind
    const calleeContext = calleeTee.boundContext ? calleeTee.boundContext : givenContext;
    log('The context of the .call invocation will be:', tstr(calleeContext));

    group('Now .call invoking the function...');
    const returnTid = metaCall(locFrom, contextTid, calleeContext, false, stack, Math.max(0, argCount - 1), callArgs.slice(1), -1, store, '', store.instanceId, false);
    log('The .call resulted in', tstr(returnTid));
    groupEnd();

    return returnTid;
  });
  createFunction(store, 'Function#toString', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount > 0) {
      store.linter.check('FUNCTION_TOSTRING_ARGS', locFrom, callerTee.tid);
    }

    const tee = store.get(contextTid);
    if (tee.type !== 'F') {
      store.linter.check('FUNCTION_TOSTRING_CONTEXT', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  playActionBuiltinObj(store, 'Function.prototype', new Map([
    ['__proto__', 'Object.prototype'],
    ['apply', 'Function#apply'],
    ['bind', 'Function#bind'],
    ['call', 'Function#call'],
    ['length', 'number'],
    ['name', 'string'],
    ['toString', 'Function#toString'],
  ]));
  createConstructor(store, 'Function', 'Function.prototype', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');
    // The model cannot support this :shrug:
    store.linter.check('TOFIX', locFrom, 'the model does not support dynamic Function creation');
  });

  createFunction(store, 'JSON.stringify', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify

    if (argCount === 0) {
      store.linter.check('JSON_STRINGIFY_ARGLESS', locFrom, callerTee.tid);
    } else {
      const tid = callArgs[0];
      const tee = store.get(tid);
      if (!isPrimitive(tid) && tee.type !== 'A' && tee.type !== 'O') {
        store.linter.check('JSON_STRINGIFY_ARG1', locFrom, callerTee.tid);
      }
    }

    if (argCount >= 2) {
      const arg2 = callArgs[1];
      const tee2 = store.get(arg2);
      if (arg2 !== 'null' && !(tee2.type === 'A' && (tee2.kind === 'string' || tee2.kind === 'number')) && tee2.type !== 'F') {
        // TODO: we can do a more in depth validation of the function...
        store.linter.check('JSON_STRINGIFY_ARG2', locFrom, callerTee.tid);
      }
    }

    if (argCount >= 3) {
      const arg2 = callArgs[2];
      if (arg2 !== 'null' && arg2.kind !== 'string' || arg2.kind !== 'number') {
        store.linter.check('JSON_STRINGIFY_ARG3', locFrom, callerTee.tid);
      }
    }

    if (argCount > 3) {
      store.linter.check('JSON_STRINGIFY_ARG4', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'JSON.parse', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify

    if (argCount === 0) {
      store.linter.check('JSON_PARSE_ARGLESS', locFrom, callerTee.tid);
    } else {
      const tid = callArgs[0];
      if (tid !== 'string') {
        store.linter.check('JSON_PARSE_ARG1', locFrom, callerTee.tid);
      }
    }

    if (argCount >= 2) {
      const arg2 = callArgs[1];
      const tee2 = store.get(arg2);
      if (tee2.type === 'F') {
        // TODO: we can do a more in depth validation of the function...
        store.linter.check('JSON_PARSE_ARG2', locFrom, callerTee.tid);
      }
    }

    if (argCount > 2) {
      store.linter.check('JSON_PARSE_ARG3', locFrom, callerTee.tid);
    }

    store.linter.check('JSON_PARSE_RETURN', locFrom, callerTee.tid);

    // Best guess: an object of sorts.

    log('Returning a fresh object because that seems to be the most likely');
    const objTid = playActionObj(locFrom, store, undefined, stack, [], []);
    log('->', tstr(objTid));
    return objTid;
  });
  playActionBuiltinObj(store, 'JSON', new Map([
    ['__proto__', 'Object.prototype'],
    ['parse', 'JSON.parse'],
    ['stringify', 'JSON.stringify'],
  ]));

  createFunction(store, 'Map#clear', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    const contextTee = store.get(contextTid);
    if (contextTee.type !== 'M') {
      // I _think_ this can be made to work? But too much of an edge case to bother. PR's are welcome. Bring tests.
      store.linter.check('BUILTIN_CONTEXT_MAP', locFrom, callerTee.tid);
      // Just return a bool and ignore the call otherwise
      return 'undefined';
    }

    if (argCount !== 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    log('Returning', tstr('undefined'));
    return 'undefined';
  });
  createFunction(store, 'Map#clear', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    store.linter.check('NO_ITERATORS', locFrom, callerTee.tid);

    const contextTee = store.get(contextTid);
    if (contextTee.type !== 'M') {
      // I _think_ this can be made to work? But too much of an edge case to bother. PR's are welcome. Bring tests.
      store.linter.check('BUILTIN_CONTEXT_MAP', locFrom, callerTee.tid);
      // Just return a bool and ignore the call otherwise
      return 'undefined';
    }

    if (argCount !== 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    log('Returning', tstr('undefined'));
    return 'undefined';
  });
  createFunction(store, 'Map#delete', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    const contextTee = store.get(contextTid);
    if (contextTee.type !== 'M') {
      // I _think_ this can be made to work? But too much of an edge case to bother. PR's are welcome. Bring tests.
      store.linter.check('BUILTIN_CONTEXT_MAP', locFrom, callerTee.tid);
      // Just return a bool and ignore the call otherwise
      return 'boolean';
    }

    let keyKind = contextTee.keyKind;
    ASSERT(keyKind, 'should have a placeholder or more', keyKind);

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    const arg = argCount > 0 ? callArgs[0] : 'undefined';
    if (argCount > 0 && !testMerge(store, keyKind, arg)) {
      store.linter.check('MAP_HAS_ARG1', locFrom, callerTee.tid);
    }

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Merging the arg with the key kind');
    contextTee.keyKind = merge(locFrom, store, keyKind, arg);

    log('Returning', tstr('boolean'));
    return 'boolean';
  });
  createFunction(store, 'Map#entries', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    store.linter.check('NO_ITERATORS', locFrom, callerTee.tid);

    const contextTee = store.get(contextTid);
    if (contextTee.type !== 'M') {
      // I _think_ this can be made to work? But too much of an edge case to bother. PR's are welcome. Bring tests.
      store.linter.check('BUILTIN_CONTEXT_MAP', locFrom, callerTee.tid);
      // Just return a bool and ignore the call otherwise
      return 'undefined';
    }

    if (argCount !== 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    log('Returning', tstr('undefined'));
    return 'undefined';
  });
  createFunction(store, 'Map#forEach', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('MAPSET_FOREACH_ARGLESS', locFrom, callerTee.tid);
      log('Call had no args so there is no callback to call');
      return 'undefined';
    }

    if (argCount > 2) {
      store.linter.check('MAPSET_ARG3_TMI', locFrom, callerTee.tid);
    }

    const funcTid = callArgs[0];
    const contextTidToUse = argCount >= 2 ? callArgs[1] : contextTid;
    log('callback:', tstr(funcTid), ', context:', tstr(contextTidToUse));

    const funcTee = store.get(funcTid);
    const contextTeeToUse = store.get(contextTidToUse);
    ASSERT(funcTee && contextTeeToUse);

    // Would be nice to support array-likes in the future...
    if (contextTeeToUse.type === 'M') {
      const keyKindTid = contextTeeToUse.keyKind;
      ASSERT(typeof keyKindTid === 'string', 'kinds should be strings', keyKindTid);
      const keyKindTee = store.get(keyKindTid);
      if (keyKindTee.type === 'H') { // If placeholder then we haven't seen any mutations yet
        store.linter.check('ARRAY_LAMBDA_ARR_KIND', locFrom, callerTee.tid);
      }

      const valueKindTid = contextTeeToUse.kind;
      ASSERT(typeof valueKindTid === 'string', 'kinds should be strings', valueKindTid);
      const valueKindTee = store.get(valueKindTid);
      if (valueKindTee.type === 'H') { // If placeholder then we haven't seen any mutations yet
        store.linter.check('ARRAY_LAMBDA_ARR_KIND', locFrom, callerTee.tid);
      }

      if (keyKindTee.type === 'H' && valueKindTee.type === 'H') {
        store.linter.check('MAP_FOREACH_MAP_KIND', locFrom, callerTee.tid);
      } else if (keyKindTee.type === 'H') {
        store.linter.check('MAP_FOREACH_MAP_KEY_KIND', locFrom, callerTee.tid);
      } else if (valueKindTee.type === 'H') {
        store.linter.check('MAP_FOREACH_MAP_VALUE_KIND', locFrom, callerTee.tid);
      }
    } else {
      store.linter.check('MAP_FOREACH_CONTEXT', locFrom, callerTee.tid);
      // It's very unlikely that we can call the callback with reasonable args ...
      // Should we ignore it or just call it with undefineds, anyways?
    }

    if (funcTee.type !== 'F') {
      store.linter.check('MAPSET_FOREACH_FUNC_ARG', locFrom, callerTee.tid);
      log('Cannot invoke first arg so ignoring the call');
      return 'undefined';
    }

    const keyKindTid = contextTeeToUse.kind || 'undefined'; // Note: key is the SECOND arg of the callback
    const valueKindTid = contextTeeToUse.kind || 'undefined'; // Note: value is the FIRST arg of the callback

    group('Now calling the callback with a', tstr(valueKindTid), 'and', tstr(keyKindTid), 'and the map being iterated:', tstr(contextTidToUse));
    const returnTid = metaCall(locFrom, funcTee.tid, contextTeeToUse.tid, isNew, stack, 3, [valueKindTid, keyKindTid, contextTidToUse], -1, store, '', store.instanceId, true);
    log('The Map#forEach lambda call resulted in', tstr(returnTid));
    groupEnd();

    // Ignore return value. And even though from a purist perspective it _ought_ to be undefined, we don't care.
    return 'undefined';
  });
  createFunction(store, 'Map#get', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    const contextTee = store.get(contextTid);

    log('- Called', tstr(contextTee.tid) + '.get(', tstr(callArgs[0]), ')');
    log('- Current Map key tid:', tstr(contextTee.keyKind));
    log('- Current Map value tid:', tstr(contextTee.kind));


    if (contextTee.type !== 'M') {
      // I _think_ this can be made to work? But too much of an edge case to bother. PR's are welcome. Bring tests.
      store.linter.check('MAP_GET_CONTEXT', locFrom, callerTee.tid);
      
      // As it stands we can't really do anything here so just return `undefined` as the safest possible value here.
      return 'undefined';
    }
    
    const keyKind = contextTee.keyKind;
    const valueKind = contextTee.kind;
    ASSERT(typeof keyKind === 'string', 'kinds are strings', keyKind);
    ASSERT(typeof valueKind === 'string', 'kinds are strings', valueKind);

    if (argCount === 0) {
      store.linter.check('MAP_GET_ARGLESS', locFrom, callerTee.tid);
    }

    const arg = argCount > 0 ? callArgs[0] : 'undefined';
    if (argCount > 0 && !testMerge(store, keyKind, arg)) {
      store.linter.check('MAP_GET_ARG1', locFrom, callerTee.tid);
    }
    
    if (argCount > 1) {
      store.linter.check('MAP_GET_ARG2', locFrom, callerTee.tid);
    }

    group('Merging the arg with the key kind');
    contextTee.keyKind = merge(locFrom, store, keyKind, arg);
    groupEnd();

    const valueKindTee = store.get(valueKind);
    if (valueKindTee.type === 'H') {
      log('Reading the value of a Map that is undetermined. Now sealing it to', tstr('undefined'));
      contextTee.kind = merge(locFrom, store, valueKind, 'undefined');
    }

    log('Returning the value kind:', tstr(contextTee.kind));
    return contextTee.kind;
  });
  createFunction(store, 'Map#has', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    const contextTee = store.get(contextTid);

    log('- Called', tstr(contextTee.tid) + '.has(', tstr(callArgs[0]), ')');
    log('- Current Map key tid:', tstr(contextTee.keyKind));
    log('- Current Map value tid:', tstr(contextTee.kind));

    if (contextTee.type !== 'M') {
      // I _think_ this can be made to work? But too much of an edge case to bother. PR's are welcome. Bring tests.
      store.linter.check('BUILTIN_CONTEXT_MAP', locFrom, callerTee.tid);

      // Ignore the key, leave a bool on the stack
      return 'boolean';
    }

    // Get the arg
    let arg = argCount > 0 ? callArgs[0] : 'undefined';
    ASSERT_TID(contextTee.keyKind);

    // Merge key kind with the arg
    const keyKindTee = store.get(contextTee.keyKind);
    if (keyKindTee.type === 'H') {
      store.linter.check('ARRAY_SHIFT_EMPTY', locFrom, callerTee.tid);
      log('Map key kind was undetermined. Setting it to the arg tid:', tstr(arg));
      store.linkTo(keyKindTee, store.get(arg));
      contextTee.keyKind = keyKindTee.alias.tid;
    } else {
      log('Merging the map key kind with the tid of the first arg:', tstr(keyKindTee.tid), tstr(arg));
      ASSERT(keyKindTee, 'should have a tee', keyKindTee);
      ASSERT_TID(arg);
      contextTee.keyKind = merge(locFrom, store, keyKindTee.tid, arg);
    }

    log('Merging the arg with the key kind');
    contextTee.keyKind = merge(locFrom, store, contextTee.keyKind, arg);

    log('Returning', tstr('boolean'));
    return 'boolean';
  });
  createFunction(store, 'Map#keys', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    store.linter.check('NO_ITERATORS', locFrom, callerTee.tid);

    const contextTee = store.get(contextTid);
    if (contextTee.type !== 'M') {
      // I _think_ this can be made to work? But too much of an edge case to bother. PR's are welcome. Bring tests.
      store.linter.check('BUILTIN_CONTEXT_MAP', locFrom, callerTee.tid);
      // Just return a bool and ignore the call otherwise
      return 'undefined';
    }

    if (argCount !== 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    log('Returning', tstr('undefined'));
    return 'undefined';
  });
  createFunction(store, 'Map#set', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('MAP_SET_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount === 1) {
      store.linter.check('MAP_SET_ARG2', locFrom, callerTee.tid);
    }
    if (argCount > 2) {
      store.linter.check('MAP_SET_ARG3', locFrom, callerTee.tid);
    }

    const contextTee = store.get(contextTid);

    log('- Called', tstr(contextTee.tid) + '.set(', tstr(callArgs[0]), ',', tstr(callArgs[1]), ')');
    log('- Current Map key tid:', tstr(contextTee.keyKind));
    log('- Current Map value tid:', tstr(contextTee.kind));

    if (contextTee.type !== 'M') {
      // I _think_ this can be made to work? But too much of an edge case to bother. PR's are welcome. Bring tests.
      store.linter.check('MAP_SET_CONTEXT', locFrom, callerTee.tid);

      // As it stands we can't really do anything here so just return the context as the .set would
      return contextTid;
    }

    const keyArg = argCount > 0 ? callArgs[0] : 'undefined';
    log('Merging first arg', tstr(keyArg), 'with key kind:', tstr(contextTee.keyKind));
    contextTee.keyKind = merge(locFrom, store, keyArg, contextTee.keyKind, false);

    const valueArg = argCount > 1 ? callArgs[1] : 'undefined';
    log('Merging second arg', tstr(valueArg), 'with value kind:', tstr(contextTee.kind));
    contextTee.kind = merge(locFrom, store, valueArg, contextTee.kind, false);

    log('Returning the context');
    return contextTid;
  });
  createFunction(store, 'Map#values', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    store.linter.check('NO_ITERATORS', locFrom, callerTee.tid);

    const contextTee = store.get(contextTid);
    if (contextTee.type !== 'M') {
      // I _think_ this can be made to work? But too much of an edge case to bother. PR's are welcome. Bring tests.
      store.linter.check('BUILTIN_CONTEXT_MAP', locFrom, callerTee.tid);
      // Just return a bool and ignore the call otherwise
      return 'undefined';
    }

    if (argCount !== 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    log('Returning', tstr('undefined'));
    return 'undefined';
  });
  playActionBuiltinObj(store, 'Map.prototype', new Map([
    ['__proto__', 'Object.prototype'],
    ['clear', 'Map#clear'],
    ['delete', 'Map#delete'],
    ['entries', 'Map#entries'],
    ['forEach', 'Map#forEach'],
    ['get', 'Map#get'],
    ['has', 'Map#has'],
    ['keys', 'Map#keys'],
    ['set', 'Map#set'],
    ['size', 'number'],
    ['values', 'Map#values'],
  ]));
  createConstructor(store, 'Map', 'Map.prototype', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // A Map expects zero args or one arg that is an iterable (array, for now) of arrays of key:value tuples. That's not gonna work well in our model.
    // Perhaps in the future we can track explicit tuples somehow. Maybe they can be promotable types, which start as tuples and can be locked or mutated but not both?

    if (!isNew) {
      // Runtime error
      store.linter.check('MAP_WITHOUT_NEW', locFrom, callerTee.tid);
    }

    log('There are', argCount, 'args');
    let keyKind;
    let valueKind;

    if (argCount > 0) {
      const tid = callArgs[0];
      log('First arg is', tstr(tid));
      const tee = store.get(tid);
      if (tee.type === 'A') {
        // It has to be an array with zero or more arrays TODO: s/array/iterable
        const outerKind = tee.kind;
        const outerKindTee = store.get(outerKind);
        log('- And its kind is:', tstr(outerKind));
        if (outerKindTee.type === 'H') {
          log('This is a read of the kind and it was undetermined. Seal the kind of the array to `undefined`');
          store.linkTo(outerKindTee, store.get('undefined'));
          tee.kind = 'undefined';
          // Set key/value kind to fresh placeholders (below)
          store.linter.check('MAP_EMPTY_ARRAY', locFrom, callerTee.tid);
        } else {
          // This ought to be a tuple so we got to check that now
          // Due to limitation in this model we can only set key and value ot the same kind
          // That's hardly ever what you want to do (besides string:string) so manual .set loop is the best workaround
          if (outerKindTee.type !== 'A') {
            store.linter.check('MAP_ARG1_SUB_ARR', locFrom, callerTee.tid);
          } else {
            const innerKind = outerKindTee.kind;
            const innerKindTee = store.get(innerKind);
            log('  - Kind of the inner array is', tstr(innerKind), '->', tstr(innerKindTee.tid));
            if (innerKindTee.type === 'H') {
              store.linter.check('MAP_EMPTY_ARRAY', locFrom, callerTee.tid);
              log('Since this is "reading" the kind from the array, we will now seal the kind of the array to', tstr('undefined'));
              store.linkTo(innerKindTee, store.get('undefined'));
              outerKindTee.kind = 'undefined';
              keyKind = 'undefined';
              valueKind = 'undefined';
            } else {
              keyKind = innerKindTee.tid;
              valueKind = innerKindTee.tid;
            }
          }
        }
      } else if (tee.type === 'M') {
        log('A Map instance is a valid arg type. Share the key (', tstr(tee.keyKind), ') and value (', tstr(tee.kind), ') kinds');

        const keyKindTee = store.get(tee.keyKind);
        const valueKindTee = store.get(tee.kind);

        if (keyKindTee.type === 'H') {
          log('The map had an undetermined key kind; sharing the placeholder because why not', tstr(keyKindTee.tid));
        }
        if (valueKindTee.type === 'H') {
          log('The map had an undetermined value kind; sharing the placeholder because why not', tstr(valueKindTee.tid));
        }

        keyKind = tee.keyKind;
        valueKind = tee.kind;
      } else {
        store.linter.check('MAP_ARG1', locFrom, callerTee.tid);
        // Whatever. The key/value kind will get fresh placeholders below.
      }
    }
    log('Resolved key and value kinds based on arg:', tstr(keyKind), tstr(valueKind));

    if (keyKind === undefined) {
      keyKind = createPlaceholder(store, 'HMK', 'new Map() key');
    }

    if (valueKind === undefined) {
      valueKind = createPlaceholder(store, 'HMV', 'new Map() value');
    }

    log('Final Resolved key and value kinds:', tstr(keyKind), tstr(valueKind));

    if (argCount > 1) {
      store.linter.check('MAP_ARG2', locFrom, callerTee.tid);
    }

    ASSERT_TID(keyKind);
    ASSERT_TID(valueKind);

    return playActionMap(locFrom, store, undefined, stack, keyKind, valueKind);
  });

  createFunction(store, 'Math.abs', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.acos', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.acosh', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.asin', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.asinh', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.atan', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.atanh', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.atan2', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount === 0 || callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount <= 1 || callArgs[1] !== 'number') {
      store.linter.check('BUILTIN_ARG2_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 2) {
      store.linter.check('BUILTIN_ARG3_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.cbrt', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.ceil', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.clz32', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.cos', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.cosh', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.exp', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.expm1', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.floor', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.fround', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.hypot', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount !== 1) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount === 1) {
      store.linter.check('BUILTIN_ARG2_MISSING', locFrom, callerTee.tid);
    }

    callArgs.forEach((tid, i) => {
      if (tid !== 'number') store.linter.check('MATH_ARG_NUMBER', locFrom, callerTee.tid, i);
    });

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.imul', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount === 0 || callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount <= 1 || callArgs[1] !== 'number') {
      store.linter.check('BUILTIN_ARG2_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 2) {
      store.linter.check('BUILTIN_ARG3_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.log', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.log1p', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.log10', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.log2', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.max', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount === 1) {
      store.linter.check('BUILTIN_ARG2_MISSING', locFrom, callerTee.tid);
    }

    callArgs.forEach((tid, i) => {
      if (tid !== 'number') store.linter.check('MATH_ARG_NUMBER', locFrom, callerTee.tid, i);
    });

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.min', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount !== 1) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount === 1) {
      store.linter.check('BUILTIN_ARG2_MISSING', locFrom, callerTee.tid);
    }

    callArgs.forEach((tid, i) => {
      if (tid !== 'number') store.linter.check('MATH_ARG_NUMBER', locFrom, callerTee.tid, i);
    });

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.pow', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount === 0 || callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount <= 1 || callArgs[1] !== 'number') {
      store.linter.check('BUILTIN_ARG2_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 2) {
      store.linter.check('BUILTIN_ARG3_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.random', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount > 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.round', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.sign', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.sin', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.sinh', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.sqrt', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.tan', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.tanh', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'Math.trunc', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  playActionBuiltinObj(store, 'Math', new Map([
    ['__proto__', 'Object.prototype'],
    ['E', 'number'],
    ['LN2', 'number'],
    ['LN10', 'number'],
    ['LOG2E', 'number'],
    ['PI', 'number'],
    ['SQRT1_2', 'number'],
    ['SQRT2', 'number'],
    ['abs', 'Math.abs'],
    ['acos', 'Math.acos'],
    ['acosh', 'Math.acosh'],
    ['asin', 'Math.asin'],
    ['asinh', 'Math.asinh'],
    ['atan', 'Math.atan'],
    ['atan2', 'Math.atan2'],
    ['atanh', 'Math.atanh'],
    ['cbrt', 'Math.cbrt'],
    ['ceil', 'Math.ceil'],
    ['clz32', 'Math.clz32'],
    ['cos', 'Math.cos'],
    ['cosh', 'Math.cosh'],
    ['exp', 'Math.exp'],
    ['expm1', 'Math.expm1'],
    ['floor', 'Math.floor'],
    ['fround', 'Math.fround'],
    ['hypot', 'Math.hypot'],
    ['imul', 'Math.imul'],
    ['log', 'Math.log'],
    ['log10', 'Math.log10'],
    ['log1p', 'Math.log1p'],
    ['log2', 'Math.log2'],
    ['max', 'Math.max'],
    ['min', 'Math.min'],
    ['pow', 'Math.pow'],
    ['random', 'Math.random'],
    ['round', 'Math.round'],
    ['sign', 'Math.sign'],
    ['sin', 'Math.sin'],
    ['sinh', 'Math.sinh'],
    ['sqrt', 'Math.sqrt'],
    ['tan', 'Math.tan'],
    ['tanh', 'Math.tanh'],
    ['trunc', 'Math.trunc'],
  ]));

  createFunction(store, 'Number#toExponential', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }

    if (contextTid !== 'number') {
      store.linter.check('BUILTIN_CONTEXT_NUMBER', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'Number#toFixed', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }

    if (contextTid !== 'number') {
      store.linter.check('BUILTIN_CONTEXT_NUMBER', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'Number#toLocaleString', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // Not verifying the second param. Not worth the hassle for me.

    if (argCount > 2) {
      store.linter.check('BUILTIN_ARG3_TMI', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'string') {
      store.linter.check('BUILTIN_ARG1_STRING', locFrom, callerTee.tid);
    }

    if (contextTid !== 'number') {
      store.linter.check('BUILTIN_CONTEXT_NUMBER', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'Number#toPrecision', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }

    if (contextTid !== 'number') {
      store.linter.check('BUILTIN_CONTEXT_NUMBER', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'Number#toString', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');
    if (argCount > 1) {
      store.linter.check('NUMBER_TOSTRING_ARGS', locFrom, callerTee.tid);
    }
    if (argCount > 0) {
      if (callArgs[0] !== 'number') {
        store.linter.check('NUMBER_TOSTRING_NUM', locFrom, callerTee.tid);
      }
    }

    if (contextTid !== 'number') {
      store.linter.check('NUMBER_TOSTRING_CONTEXT', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'Number#valueOf', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount > 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'number') {
      store.linter.check('BUILTIN_CONTEXT_NUMBER', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  playActionBuiltinObj(store, 'Number.prototype', new Map([
    ['__proto__', 'Object.prototype'],
    ['toExponential', 'Number#toExponential'],
    ['toFixed', 'Number#toFixed'],
    ['toLocaleString', 'Number#toLocaleString'],
    ['toPrecision', 'Number#toPrecision'],
    ['toSource', 'Number#toSource'],
    ['toString', 'Number#toString'],
    ['valueOf', 'Number#valueOf'],
  ]));
  createFunction(store, 'Number.isFinite', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('NUMBER_ISFINITE_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('NUMBER_ISFINITE_ARG1', locFrom, callerTee.tid);
    }

    if (argCount > 1) {
      store.linter.check('NUMBER_ISFINITE_ARG2', locFrom, callerTee.tid);
    }

    log('Pushing a', tstr('boolean'));
    return 'boolean';
  });
  createFunction(store, 'Number.isInteger', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    // The second arg is not really locked down to number, but in that case shouldn't it be a typeof check?
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Pushing a', tstr('boolean'));
    return 'boolean';
  });
  createFunction(store, 'Number.isNaN', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    // Number.isNaN is not exactly the same as global.isNaN (unlike parseInt and parseFloat)

    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    // The second arg is not really locked down to number, but in that case shouldn't it be a typeof check?
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Pushing a', tstr('boolean'));
    return 'boolean';
  });
  createFunction(store, 'Number.isSafeInteger', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    // The second arg is not really locked down to number, but in that case shouldn't it be a typeof check?
    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Pushing a', tstr('boolean'));
    return 'boolean';
  });
  createConstructor(store, 'Number', 'String.prototype', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    return 'number';
  }, [
    ['EPSILON', 'number'],
    ['MAX_SAFE_INTEGER', 'number'],
    ['MAX_VALUE', 'number'],
    ['MIN_SAFE_INTEGER', 'number'],
    ['MIN_VALUE', 'number'],
    ['NaN', 'number'],
    ['NEGATIVE_INFINITY', 'number'],
    ['POSITIVE_INFINITY', 'number'],
    ['isFinite', 'Number.isFinite'],
    ['isInteger', 'Number.isInteger'],
    ['isNaN', 'Number.isNaN'],
    ['isSafeInteger', 'Number.isSafeInteger'],
    ['parseFloat', 'global.parseFloat'],
    ['parseInt', 'global.parseInt'],
  ]);

  // All the. Things.
  createFunction(store, 'Object#hasOwnProperty', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'string') {
      store.linter.check('BUILTIN_ARG1_STRING', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('boolean'));
    return 'boolean';
  });
  createFunction(store, 'Object#isPrototypeOf', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && isPrimitive(callArgs[0])) {
      store.linter.check('BUILTIN_ARG1_OBJ', locFrom, callerTee.tid);
      if (callArgs[0] === 'undefined' || callArgs[0] === 'null') {
        log('Actually a runtime error on undefined or null');
      }
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('boolean'));
    return 'boolean';
  });
  createFunction(store, 'Object#propertyIsEnumerable', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0 && callArgs[0] !== 'string') {
      store.linter.check('BUILTIN_ARG1_STRING', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('boolean'));
    return 'boolean';
  });
  createFunction(store, 'Object#toLocaleString', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount > 0) {
      // This should be overridden by subclasses to have args
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'Object#toString', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount > 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'Object#valueOf', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount > 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  playActionBuiltinObj(store, 'Object.prototype', new Map([
    // ['__proto__', 'null'], // has no __proto__ property
    ['hasOwnProperty', 'Object#hasOwnProperty'],
    ['isPrototypeOf', 'Object#isPrototypeOf'],
    ['propertyIsEnumerable', 'Object#propertyIsEnumerable'],
    ['toLocaleString', 'Object#toLocaleString'],
    ['toSource', 'Object#toSource'],
    ['toString', 'Object#toString'],
    ['valueOf', 'Object#valueOf'],
  ]), true);
  createFunction(store, 'Object.assign', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
      log('Returning', tstr('undefined'));
      return 'undefined';
    }

    if (argCount === 1) {
      store.linter.check('BUILTIN_ARG2_MISSING', locFrom, callerTee.tid);
      log('Nothing happens. Returning the first arg', tstr(argCount[0]));
      return argCount[0];
    }

    if (argCount > 2) {
      store.linter.check('BUILTIN_ARG3_TMI', locFrom, callerTee.tid);
    }

    // > Properties in the target object are overwritten by properties in the sources if they have the same key. Later sources' properties overwrite earlier ones.
    // > only copies enumerable and own properties from a source object to a target object
    // so we look at props and merge those. it woulnd't merge getters/setters but we don't support those anyways ^^

    if (callArgs[0] === 'undefined' || callArgs[0] === 'null' || callArgs[1] === 'undefined' || callArgs[1] === 'null') {
      // No error but nothing happens. Return the first arg.
      log('Nothing happens for', tstr('null'), 'and', tstr('undefined'), ', returning the first arg:', tstr(callArgs[0]));
      return callArgs[0];
    }

    const tee1 = store.get(callArgs[0]);
    const tee2 = store.get(callArgs[1]);

    ASSERT(tee1.props && tee2.props, 'both tees should have props of some sort now', tee1, tee2);

    log('intersect the keys');
    const inter = new Set([...tee1.props.keys(), ...tee2.props.keys()]);
    log('- Intersection ->', [...inter].join(', '));
    group('Merge those keys');
    inter.forEach(key => {
      log('- `' + key + '`', tstr(tee1.props.get(key)), tstr(tee2.props.get(key)));
      const tid = merge(locFrom, store, tee1.props.get(key), tee2.props.get(key));
      tee1.setProp(key, tid);
      tee2.setProp(key, tid);
    });
    groupEnd();

    log('Returning the first arg as is:', tstr(callArgs[0]));
    return callArgs[0] || 'undefined';
  });
  createFunction(store, 'Object.create', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
      const objTid = playActionObj(locFrom, store, undefined, stack, [], []);
      log('This is a runtime error but returning a fresh object regardless', tstr(objTid));
      return objTid;
    }

    if (argCount === 1 && callArgs[0] !== 'null' && isPrimitive(callArgs[0])) {
      store.linter.check('BUILTIN_ARG1_OBJ', locFrom, callerTee.tid);
      const objTid = playActionObj(locFrom, store, undefined, stack, [], []);
      log('This is a runtime error but returning a fresh object regardless', tstr(objTid));
      return objTid;
    }

    if (argCount > 1) {
      if (callArgs[1] === 'undefined') {
        // ok. ignore
      } else if (callArgs[1] === 'null') {
        store.linter.check('BUILTIN_ARG1_OBJ', locFrom, callerTee.tid);
        log('This is a runtime error, which we will ignore.');
      } else if (isPrimitive(callArgs[1])) {
        store.linter.check('BUILTIN_ARG1_OBJ', locFrom, callerTee.tid);
        log('Primitives other than `null` will work but are effectively a noop.');
      } else {
        store.linter.check('TOFIX', locFrom, callerTee.tid);
        log('Not supporting the second arg to object.create right now.');
      }
    }

    if (argCount > 2) {
      store.linter.check('BUILTIN_ARG3_TMI', locFrom, callerTee.tid);
    }

    // Create a new object with given first arg as prototype (or none, if that's a null)
    // Ignore the second param as the model doesn't support that granularity yet. Too bad.

    log('Returning new object with __proto__ set to', tstr(callArgs[0]));
    return playActionObj(locFrom, store, undefined, stack, ['__proto__'], [callArgs[0]]);
  });
  createFunction(store, 'Object.defineProperties', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    store.linter.check('TOFIX', locFrom, callerTee.tid);

    log('Returning first arg as-is', tstr(callArgs[0] || 'undefined'));
    return callArgs[0] || 'undefined';
  });
  createFunction(store, 'Object.defineProperties', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    store.linter.check('TOFIX', locFrom, callerTee.tid);

    log('Returning first arg as-is', tstr(callArgs[0] || 'undefined'));
    return callArgs[0] || 'undefined';
  });
  createFunction(store, 'Object.entries', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    store.linter.check('NO_ITERATORS', locFrom, callerTee.tid);

    const contextTee = store.get(contextTid);
    if (contextTee.type !== 'O') {
      // TODO: what about map/set/etc? Do they call their .entries() instead? Or also own properties.
      return 'undefined';
    }

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
      log('Returning an array of', tstr('string'), 'because we know the keys will be strings and since arrays are monomorphic, the values must also be strings');
      return playActionArr(locFrom, store, undefined, stack, 'string');
    }

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    // Do not merge the property values. That's more likely to cause trouble than good. Instead try to merge with string and issue a lint warning otherwise.
    const argTee = store.get(callArgs[0]);
    if (argTee.props) {
      let failed = false;
      // Note: argTee is a Map so .some does not work :(
      argTee.props.forEach((tid, key) => {
        if (!testMerge(store, tid, 'string')) failed = true;
      });
      if (failed) {
        store.linter.check('POLY_OTHER', locFrom, callerTee.tid);
        log('At least one property value was not a', tstr('string'), 'but returning an array of strings anyways so the model is now broken.');
      }
    }

    log('Returning an array of', tstr('string'), 'because it will be a tuple of <key, value> where key must be a string and arrays can only have one type');
    return playActionArr(locFrom, store, undefined, stack, 'string');
  });
  createFunction(store, 'Object.freeze', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
      log('Returning', tstr('undefined'));
      return 'undefined';
    }

    if (isPrimitive(callArgs[0])) {
      store.linter.check('BUILTIN_ARG1_OBJ', locFrom, callerTee.tid);
    }

    // The model doesn't support this meta layer yet
    store.linter.check('TOFIX', locFrom, callerTee.tid);

    log('Returning the first arg as is:', tstr(callArgs[0]));
    return callArgs[0] || 'undefined';
  });
  createFunction(store, 'Object.fromEntries', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // I'm just going to not bother with this function
    store.linter.check('NO_ITERATORS', locFrom, callerTee.tid);

    log('Returning a fresh empty object');
    return playActionObj(locFrom, store, undefined, stack, [], []);
  });
  createFunction(store, 'Object.getOwnPropertyDescriptor', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // I'm just going to not bother with this function
    // The model doesn't support this meta layer yet
    store.linter.check('TOFIX', locFrom, callerTee.tid);

    log('Returning', tstr('undefined'));
    return 'undefined';
  });
  createFunction(store, 'Object.getOwnPropertyDescriptors', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // I'm just going to not bother with this function
    // The model doesn't support this meta layer yet
    store.linter.check('TOFIX', locFrom, callerTee.tid);

    log('Returning', tstr('undefined'));
    return 'undefined';
  });
  createFunction(store, 'Object.getOwnPropertyNames', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // I'm just going to not bother with this function
    // The model doesn't support this meta layer yet
    store.linter.check('TOFIX', locFrom, callerTee.tid);

    log('Returning', tstr('undefined'));
    return 'undefined';
  });
  createFunction(store, 'Object.getOwnPropertySymbols', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // I'm just going to not bother with this function
    // The model doesn't support this meta layer yet
    store.linter.check('TOFIX', locFrom, callerTee.tid);

    log('Returning', tstr('undefined'));
    return 'undefined';
  });
  createFunction(store, 'Object.getPrototypeOf', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    if (argCount > 0 && (callArgs[0] === 'undefined' || callArgs[0] === 'null')) {
      store.linter.check('OBJECT_GETPROTOTYPEOF_NULL', locFrom, callerTee.tid);
      log('Returning', tstr('undefined'), 'for it');
      return 'undefined';
    }

    const argTee = store.get(callArgs[0]);
    ASSERT(argTee.props, 'props on non-nullables should exist?');
    if (argTee.type === 'H') store.linter.check('TOFIX', locFrom, 'todo_prototypeof_placeholder_yikes');

    const proto = argTee.props.get('__proto__') || 'undefined';
    log('Returning', tstr(proto));
    return proto;
  });
  createFunction(store, 'Object.is', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 2) {
      store.linter.check('BUILTIN_ARG3_TMI', locFrom, callerTee.tid);
    }

    log('This should compare two values and they should have the same type so merging them now...');
    merge(locFrom, store, callArgs[0] || 'undefined', callArgs[1] || 'undefined');

    log('Returning', tstr('boolean'));
    return 'boolean';
  });
  createFunction(store, 'Object.isExtensible', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // I'm just going to not bother with this function
    // The model doesn't support this meta layer yet
    store.linter.check('TOFIX', locFrom, callerTee.tid);

    log('Returning', tstr('boolean'));
    return 'boolean';
  });
  createFunction(store, 'Object.isFrozen', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // I'm just going to not bother with this function
    // The model doesn't support this meta layer yet
    store.linter.check('TOFIX', locFrom, callerTee.tid);

    log('Returning', tstr('boolean'));
    return 'boolean';
  });
  createFunction(store, 'Object.isSealed', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // I'm just going to not bother with this function
    // The model doesn't support this meta layer yet
    store.linter.check('TOFIX', locFrom, callerTee.tid);

    log('Returning', tstr('boolean'));
    return 'boolean';
  });
  createFunction(store, 'Object.keys', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    store.linter.check('OBJECT_KEYS', locFrom, callerTee.tid);

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    log('Returning an array of', tstr('string'));
    return playActionArr(locFrom, store, undefined, stack, 'string');
  });
  createFunction(store, 'Object.preventExtensions', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // I'm just going to not bother with this function
    // The model doesn't support this meta layer yet
    store.linter.check('TOFIX', locFrom, callerTee.tid);

    log('Returning', tstr(callArgs[0] || 'undefined'));
    return callArgs[0] || 'undefined';
  });
  createFunction(store, 'Object.seal', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // I'm just going to not bother with this function
    // The model doesn't support this meta layer yet
    store.linter.check('TOFIX', locFrom, callerTee.tid);

    log('Returning', tstr(callArgs[0] || 'undefined'));
    return callArgs[0] || 'undefined';
  });
  createFunction(store, 'Object.setPrototypeOf', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
      log('Returning', tstr('undefined'));
      return 'undefined';
    }

    if (argCount > 0 && isPrimitive(callArgs[0])) {
      store.linter.check('BUILTIN_ARG1_OBJ', locFrom, callerTee.tid);
      log('Runtime does not throw so just returning first arg', tstr(callArgs[0]));
      return callArgs[0];
    }

    if (argCount <= 1 || (callArgs[1] !== 'null' && isPrimitive(callArgs[1]))) {
      store.linter.check('BUILTIN_ARG2_OBJ', locFrom, callerTee.tid);
      log('Will be a runtime error but still just returning first arg', tstr(callArgs[0]));
      return callArgs[0];
    }

    // Do the update...
    const argTee1 = store.get(callArgs[0]);
    const argTee2 = store.get(callArgs[1]);

    ASSERT(argTee1.props, 'we checked that it wasnt a primitive', argTee1);
    log('Now setting the __proto__ of', tstr(argTee1.tid), 'to', tstr(argTee2.tid));
    argTee1.setProp('__proto__', argTee2.tid);

    store.linter.check('SET_PROTO', locFrom, callerTee.tid);

    log('Returning', tstr(argTee1.tid));
    return argTee1.tid;
  });
  createFunction(store, 'Object.values', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    store.linter.check('OBJECT_VALUES', locFrom, callerTee.tid);

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    log('Returning an array of', tstr('undefined'));
    return playActionArr(locFrom, store, undefined, stack, 'undefined');
  });
  createConstructor(store, 'Object', 'Object.prototype', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');
    // Ignore args, push ... input if it was not a primitive, box input if it was...?

    if (argCount === 0) {
      if (isNew) {
        log('This `new` call to `Object` had no args, pushing the context to the stack:');
        log('->', tstr(contextTid));
        return contextTid;
      }

      log('Call to `Object` had no args, create a new object and return it');
      const objTid = playActionObj(locFrom, store, undefined, stack, [], []);
      log('->', tstr(objTid));
      return objTid;
    }

    const firstArgTid = callArgs[0];
    log('First arg is', tstr(firstArgTid));

    const argTee = store.get(firstArgTid);
    log('- tee:', argTee);
    if (isPrimitive(firstArgTid)) {
      log('First arg was a primitive. Box it and return that.');
      store.linter.check('TOFIX', locFrom, 'primitive boxing is not implemented');
    }

    log('First arg was not a primitive. Return as is.');
    log('->', tstr(firstArgTid));
    return firstArgTid;
  }, [
    ['assign', 'Object.assign'],
    ['create', 'Object.create'],
    ['defineProperties', 'Object.defineProperties'],
    ['defineProperty', 'Object.defineProperty'],
    ['entries', 'Object.entries'],
    ['freeze', 'Object.freeze'],
    ['fromEntries', 'Object.fromEntries'],
    ['getOwnPropertyDescriptor', 'Object.getOwnPropertyDescriptor'],
    ['getOwnPropertyDescriptors', 'Object.getOwnPropertyDescriptors'],
    ['getOwnPropertyNames', 'Object.getOwnPropertyNames'],
    ['getOwnPropertySymbols', 'Object.getOwnPropertySymbols'],
    ['getPrototypeOf', 'Object.getPrototypeOf'],
    ['is', 'Object.is'],
    ['isExtensible', 'Object.isExtensible'],
    ['isFrozen', 'Object.isFrozen'],
    ['isSealed', 'Object.isSealed'],
    ['preventExtensions', 'Object.preventExtensions'],
    ['seal', 'Object.seal'],
    ['setPrototypeOf', 'Object.setPrototypeOf'],
    ['values', 'Object.values'],
  ]);

  // All the. Things. afmaken vooral
  createFunction(store, 'RegExp#compile', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('REGEXP_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0) {
      if (callArgs[0] !== 'string') {
        store.linter.check('REGEXP_ARG1', locFrom, callerTee.tid);
      }
    }
    if (argCount > 1) {
      if (callArgs[1] !== 'string') {
        store.linter.check('REGEXP_ARG2', locFrom, callerTee.tid);
      }
    }
    if (argCount > 2) {
      store.linter.check('REGEXP_ARG3', locFrom, callerTee.tid);
    }

    // Create a generic empty object that inherits from RegExp
    // TODO: I think that this can get own properties under certain circumstances, but not from the constructor
    const objRegexTid = playActionObj(locFrom, store, undefined, stack, ['__proto__'], ['RegExp.prototype']);
    log('->', tstr(objRegexTid));
    return objRegexTid;
  });
  createFunction(store, 'RegExp#exec', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'string') {
      store.linter.check('BUILTIN_ARG1_STRING', locFrom, callerTee.tid);
    }

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    const contextTee = store.get(contextTid);
    if (contextTee.type !== 'O' || contextTee.props.get('__proto__') !== 'RegExp.prototype') {
      store.linter.check('BUILTIN_CONTEXT_REGEX', locFrom, callerTee.tid);
    }

    store.linter.check('REGEXP_EXEC_UNSAFE', locFrom, callerTee.tid);

    log('Pushing an array of', tstr('string'));
    return playActionArr(locFrom, store, undefined, stack, 'string');
  });
  createFunction(store, 'RegExp#test', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'string') {
      store.linter.check('BUILTIN_ARG1_STRING', locFrom, callerTee.tid);
    }

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    const contextTee = store.get(contextTid);
    if (contextTee.type !== 'O' || contextTee.props.get('__proto__') !== 'RegExp.prototype') {
      store.linter.check('BUILTIN_CONTEXT_REGEX', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('boolean'));
    return 'boolean';
  });
  createFunction(store, 'RegExp#toString', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount > 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    const contextTee = store.get(contextTid);
    if (contextTee.type !== 'O' || contextTee.props.get('__proto__') !== 'RegExp.prototype') {
      store.linter.check('BUILTIN_CONTEXT_REGEX', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  playActionBuiltinObj(store, 'RegExp.prototype', new Map([
      ['__proto__', 'Object.prototype'],
      ['compile', 'RegExp#compile'],
      ['dotAll', 'boolean'],
      ['exec', 'RegExp#exec'],
      ['flags', 'string'],
      ['global', 'boolean'],
      ['ignoreCase', 'boolean'],
      ['lastIndex', 'number'],
      ['multiline', 'boolean'],
      ['source', 'string'],
      ['sticky', 'boolean'],
      ['test', 'RegExp#test'],
      ['toString', 'RegExp#toString'],
      ['unicode', 'boolean'],
    ]));
  createConstructor(store, 'RegExp', 'RegExp.prototype', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    // RegExp has same behavior with and without `new`
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('REGEXP_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 0) {
      if (callArgs[0] !== 'string') {
        store.linter.check('REGEXP_ARG1', locFrom, callerTee.tid);
      }
    }
    if (argCount > 1) {
      if (callArgs[1] !== 'string') {
        store.linter.check('REGEXP_ARG2', locFrom, callerTee.tid);
      }
    }
    if (argCount > 2) {
      store.linter.check('REGEXP_ARG3', locFrom, callerTee.tid);
    }

    // Create a generic empty object that inherits from RegExp
    // TODO: I think that this can get own properties under certain circumstances, but not from the constructor
    const objRegexTid = playActionObj(locFrom, store, undefined, stack, ['__proto__'], ['RegExp.prototype']);
    log('->', tstr(objRegexTid));
    return objRegexTid;
  });

  createFunction(store, 'Set#add', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');
    if (argCount === 0) {
      store.linter.check('SET_ADD_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    const contextTee = store.get(contextTid);
    if (contextTee.type === 'S') {
      const arg = argCount > 0 ? callArgs[0] : 'undefined';
      ASSERT_TID(arg);
      const kindTee = store.get(contextTee.kind);
      const argTee = store.get(arg);
      log('Merging first arg', tstr(argTee.tid), 'with kind of context', tstr(kindTee.tid));
      // Merge this tid with the kind of the set
      contextTee.kind = merge(locFrom, store, arg, contextTee.kind, false);
    } else {
      // I _think_ this can be made to work? But too much of an edge case to bother. PR's are welcome. Bring tests.
      store.linter.check('BUILTIN_CONTEXT_SET', locFrom, callerTee.tid);
    }

    log('Pushing the context back onto the stack;', tstr(contextTid));
    return contextTid;
  });
  createFunction(store, 'Set#clear', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount > 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    const contextTee = store.get(contextTid);
    if (contextTee.type !== 'S') {
      store.linter.check('BUILTIN_CONTEXT_SET', locFrom, callerTee.tid);
    }


    log('Returning', tstr('undefined'));
    return 'undefined';
  });
  createFunction(store, 'Set#delete', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('SET_ADD_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    const contextTee = store.get(contextTid);
    if (contextTee.type === 'S') {
      const arg = argCount > 0 ? callArgs[0] : 'undefined';
      log('Merging first arg', tstr(arg), 'with kind of context', tstr(contextTee.kind));
      // Merge this tid with the kind of the set
      contextTee.kind = merge(locFrom, store, arg, contextTee.kind, false);
    } else {
      // I _think_ this can be made to work? But too much of an edge case to bother. PR's are welcome. Bring tests.
      store.linter.check('BUILTIN_CONTEXT_SET', locFrom, callerTee.tid);
    }

    log('Returning', tstr('boolean'));
    return 'boolean';
  });
  createFunction(store, 'Set#entries', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    store.linter.check('NO_ITERATORS', locFrom, callerTee.tid);

    const contextTee = store.get(contextTid);
    if (contextTee.type !== 'S') {
      // I _think_ this can be made to work? But too much of an edge case to bother. PR's are welcome. Bring tests.
      store.linter.check('BUILTIN_CONTEXT_MAP', locFrom, callerTee.tid);
      // Just return undefined and ignore the call otherwise
      return 'undefined';
    }

    if (argCount !== 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    log('Returning', tstr('undefined'));
    return 'undefined';
  });
  createFunction(store, 'Set#forEach', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('MAPSET_FOREACH_ARGLESS', locFrom, callerTee.tid);
      log('Call had no args so there is no callback to call');
      return 'undefined';
    }

    if (argCount > 2) {
      store.linter.check('MAPSET_ARG3_TMI', locFrom, callerTee.tid);
    }

    const funcTid = callArgs[0];
    const contextTidToUse = argCount >= 2 ? callArgs[1] : contextTid;
    log('callback:', tstr(funcTid), ', context:', tstr(contextTidToUse));

    const funcTee = store.get(funcTid);
    const contextTeeToUse = store.get(contextTidToUse);
    ASSERT(funcTee && contextTeeToUse);

    if (funcTee.type !== 'F') {
      store.linter.check('MAPSET_FOREACH_FUNC_ARG', locFrom, callerTee.tid);
      log('Cannot invoke this so ignoring the call');
      return 'undefined';
    }

    let kind = 'undefined';
    if (contextTeeToUse.type === 'S') {
      const kindTee = store.get(contextTeeToUse.kind);
      if (kindTee.type === 'H') {
        // TODO: if we think we know a map is empty, should we bother pseudo-invoking its first argument? real JS wouldnt. then there would be no need to seal the set kind
        store.linter.check('SET_FOREACH_SET_KIND', locFrom, callerTee.tid);
        log('Now forcing the empty set kind to', tstr('undefined'),'because it is "read"');
        store.linkTo(kindTee, store.get('undefined'));
        contextTeeToUse.kind = 'undefined';
      } else {
        kind = kindTee.tid;
      }
    } else {
      store.linter.check('SET_FOREACH_CONTEXT', locFrom, callerTee.tid);
    }

    group('Now calling the callback with a', tstr(kind), 'and', tstr(kind), 'and the set being iterated:', tstr(contextTidToUse));
    const returnTid = metaCall(locFrom, funcTee.tid, contextTeeToUse.tid, isNew, stack, 3, [kind, kind, contextTeeToUse.tid], -1, store, '', store.instanceId, true);
    log('The Set#forEach lambda call resulted in', tstr(returnTid));
    groupEnd();

    // Ignore return value. And even though from a purist perspective it _ought_ to be undefined, we don't care.
    return 'undefined';
  });
  createFunction(store, 'Set#has', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('SET_ADD_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    const contextTee = store.get(contextTid);
    if (contextTee.type === 'S') {
      const arg = argCount > 0 ? callArgs[0] : 'undefined';
      log('Merging first arg', tstr(arg), 'with kind of context', tstr(contextTee.kind));
      ASSERT_TID(arg);
      ASSERT_TID(contextTee.kind);
      // Merge this tid with the kind of the set
      contextTee.kind = merge(locFrom, store, arg, contextTee.kind, false);
    } else {
      // I _think_ this can be made to work? But too much of an edge case to bother. PR's are welcome. Bring tests.
      store.linter.check('BUILTIN_CONTEXT_SET', locFrom, callerTee.tid);
    }

    log('Returning', tstr('boolean'));
    return 'boolean';
  });
  createFunction(store, 'Set#values', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount > 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    const contextTee = store.get(contextTid);
    if (contextTee.type !== 'S') {
      store.linter.check('BUILTIN_CONTEXT_SET', locFrom, callerTee.tid);
    }

    store.linter.check('NO_ITERATORS', locFrom, callerTee.tid);

    log('Returning', tstr('undefined'));
    return 'undefined';
  });
  playActionBuiltinObj(store, 'Set.prototype', new Map([
      ['__proto__', 'Object.prototype'],
      ['add', 'Set#add'],
      ['clear', 'Set#clear'],
      ['delete', 'Set#delete'],
      ['entries', 'Set#entries'],
      ['forEach', 'Set#forEach'],
      ['has', 'Set#has'],
      ['size', 'number'],
      ['values', 'Set#values'],
    ]));
  createConstructor(store, 'Set', 'Set.prototype', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // A Set expects zero args or one arg that is an iterable (array, for now) of elements

    if (!isNew) {
      // Runtime error
      store.linter.check('SET_WITHOUT_NEW', locFrom, callerTee.tid);
    }

    log('There are', argCount, 'args');
    let kind;
    if (argCount > 0) {
      const tid = callArgs[0];
      log('First arg is', tstr(tid));
      const tee = store.get(tid);
      if (tee.type === 'A') {
        log('- And its kind is:', tstr(tee.kind), '->', tstr(store.get(tee.kind)));
        ASSERT(typeof tee.kind === 'string', 'kinds are strings', tee.kind);
        const kindTee = store.get(tee.kind);

        if (kindTee.type === 'H') {
          store.linter.check('SET_EMPTY_ARRAY', locFrom, callerTee.tid);
        }

        kind = kindTee.tid;
      } else {
        store.linter.check('SET_ARG1', locFrom, callerTee.tid);
      }
      log('Preliminary kind after processing arg:', tstr(kind));
    }

    if (typeof kind !== 'string') {
      kind = createPlaceholder(store, 'HSK', 'new Set()');
    }

    if (argCount > 1) {
      store.linter.check('SET_ARG2', locFrom, callerTee.tid);
    }

    return playActionSet(locFrom, store, undefined, stack, kind);
  });

  createFunction(store, 'String#charCodeAt', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'String#codePointAt', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // Unlike charCodeAt, the codePointAt function may result in `undefined`, not `NaN`, for non-existing indexes. Meh
    store.linter.check('STRING_CODEPOINTAT_UNSOUND', locFrom, callerTee.tid);

    if (argCount === 0) {
      store.linter.check('STRING_REPEAT_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'String#concat', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    // I guess they should all be strings...
    mergeAll(locFrom, ['string', ...callArgs], store);

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'String#endsWith', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'string') {
      store.linter.check('BUILTIN_ARG1_STRING', locFrom, callerTee.tid);
    }

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('boolean'));
    return 'boolean';
  });
  createFunction(store, 'String#indexOf', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'string') {
      store.linter.check('BUILTIN_ARG1_STRING', locFrom, callerTee.tid);
    }

    if (argCount > 1 && callArgs[1] !== 'number') {
      store.linter.check('BUILTIN_ARG2_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 2) {
      store.linter.check('BUILTIN_ARG3_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'String#includes', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'string') {
      store.linter.check('BUILTIN_ARG1_STRING', locFrom, callerTee.tid);
    }

    if (argCount > 1 && callArgs[1] !== 'number') {
      store.linter.check('BUILTIN_ARG2_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 2) {
      store.linter.check('BUILTIN_ARG3_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('boolean'));
    return 'boolean';
  });
  createFunction(store, 'String#lastIndexOf', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'string') {
      store.linter.check('BUILTIN_ARG1_STRING', locFrom, callerTee.tid);
    }

    if (argCount > 1 && callArgs[1] !== 'number') {
      store.linter.check('BUILTIN_ARG2_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 2) {
      store.linter.check('BUILTIN_ARG3_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'String#localeCompare', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // :shrug:
    store.linter.check('TOFIX', locFrom, callerTee.tid);

    log('Returning a', tstr('boolean'));
    return 'boolean';
  });
  createFunction(store, 'String#match', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0) {
      const tid = callArgs[0];
      const tee = store.get(tid);
      if (tee.type !== 'O' || tee.props.get('__proto__') !== 'RegExp.prototype') {
        log('First arg was:', tee);
        store.linter.check('BUILTIN_ARG1_REGEX', locFrom, callerTee.tid);
      }
    }

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    // TODO: this function returns string or null and we can't determine this ahead of time because it depends on the regex and string being tested...
    store.linter.check('STRING_MATCH_UNSAFE', locFrom, callerTee.tid);
    log('Returning an array of', tstr('string'));
    return playActionArr(locFrom, store, undefined, stack, 'string');
  });
  createFunction(store, 'String#matchAll', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0) {
      const tid = callArgs[0];
      const tee = store.get(tid);
      if (tee.type !== 'O' || tee.props.get('__proto__') !== 'RegExp.prototype') {
        log('First arg was:', tee);
        store.linter.check('BUILTIN_ARG1_REGEX', locFrom, callerTee.tid);
      }
    }

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    // TODO: this function returns string or null and we can't determine this ahead of time because it depends on the regex and string being tested...
    store.linter.check('STRING_MATCH_UNSAFE', locFrom, callerTee.tid);
    log('Returning an array of', tstr('string'));
    return playActionArr(locFrom, store, undefined, stack, 'string');
  });
  createFunction(store, 'String#normalize', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount > 0 && callArgs[0] !== 'string') {
      store.linter.check('BUILTIN_ARG1_STRING', locFrom, callerTee.tid);
    }

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return '/home/ptr/proj/zetype/src/builtins.mjs';
  });
  createFunction(store, 'String#padStart', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 1 && callArgs[1] !== 'string') {
      store.linter.check('BUILTIN_ARG2_STRING', locFrom, callerTee.tid);
    }

    if (argCount > 2) {
      store.linter.check('BUILTIN_ARG3_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'String#padEnd', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 1 && callArgs[1] !== 'string') {
      store.linter.check('BUILTIN_ARG2_STRING', locFrom, callerTee.tid);
    }

    if (argCount > 2) {
      store.linter.check('BUILTIN_ARG3_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'String#padLeft', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 1 && callArgs[1] !== 'string') {
      store.linter.check('BUILTIN_ARG2_STRING', locFrom, callerTee.tid);
    }

    if (argCount > 2) {
      store.linter.check('BUILTIN_ARG3_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'String#padRight', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 1 && callArgs[1] !== 'string') {
      store.linter.check('BUILTIN_ARG2_STRING', locFrom, callerTee.tid);
    }

    if (argCount > 2) {
      store.linter.check('BUILTIN_ARG3_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'String#repeat', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('STRING_REPEAT_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'String#replace', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
      log('Just returning a', tstr('string'), 'now');
      return 'string';
    }

    // First arg can be a string or regex
    // Second arg can be string or callback
    // The callback is unsafe since the arg count and its params depend on the regex matching which the model can't know

    const argTee = store.get(callArgs[0]);
    if (argTee.tid !== 'string' && (argTee.type !== 'O' || argTee.props.get('__proto__') !== 'RegExp.prototype')) {
      store.linter.check('STRING_REPLACE_ARG1', locFrom, callerTee.tid);
    }

    if (argCount < 2) {
      store.linter.check('BUILTIN_ARG2_MISSING', locFrom, callerTee.tid);
      log('Returning a', tstr('string'));
      return 'string';
    }

    if (callArgs[1] === 'string') {
      log('Second arg is a string. Returning a', tstr('string'));
      return 'string';
    }

    const argTee2 = store.get(callArgs[2]);
    if (argTee2.type !== 'F') {
      store.linter.check('STRING_REPLACE_ARG2', locFrom, callerTee.tid);
      log('Second arg is crap. Returning a', tstr('string'));
      return 'string';
    }

    // Invoke the callback with ... zero args? A string spread on zero?

    store.linter.check('STRING_REPLACE_FUNC', locFrom, callerTee.tid);

    log('Now calling callback as if there was a spread of array of strings from the first position. Might not be correct.');
    const returnTid = metaCall(locFrom, argTee2.tid, 'undefined', false, stack, 1, ['string'], 0, store, '', store.instanceId, true);
    if (returnTid !== 'string') {
      store.linter.check('STRING_REPLACE_RETURN', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'String#replaceAll', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
      log('Just returning a', tstr('string'), 'now');
      return 'string';
    }

    // First arg can be a string or regex
    // Second arg can be string or callback
    // The callback is unsafe since the arg count and its params depend on the regex matching which the model can't know

    const argTee = store.get(callArgs[0]);
    if (argTee.tid !== 'string' && (argTee.type !== 'O' || argTee.props.get('__proto__') !== 'RegExp.prototype')) {
      store.linter.check('STRING_REPLACE_ARG1', locFrom, callerTee.tid);
    }

    if (argCount < 2) {
      store.linter.check('BUILTIN_ARG2_MISSING', locFrom, callerTee.tid);
      log('Returning a', tstr('string'));
      return 'string';
    }

    if (callArgs[1] === 'string') {
      log('Second arg is a string. Returning a', tstr('string'));
      return 'string';
    }

    const argTee2 = store.get(callArgs[2]);
    if (argTee2.type !== 'F') {
      store.linter.check('STRING_REPLACE_ARG2', locFrom, callerTee.tid);
      log('Second arg is crap. Returning a', tstr('string'));
      return 'string';
    }

    // Invoke the callback with ... zero args? A string spread on zero?

    store.linter.check('STRING_REPLACE_FUNC', locFrom, callerTee.tid);

    log('Now calling callback as if there was a spread of array of strings from the first position. Might not be correct.');
    const returnTid = metaCall(locFrom, argTee2.tid, 'undefined', false, stack, 1, ['string'], 0, store, '', store.instanceId, true);
    if (returnTid !== 'string') {
      store.linter.check('STRING_REPLACE_RETURN', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'String#search', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('STRING_SPLIT_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0) {
      // split accepts a string or a regex
      const tid = callArgs[0];
      const tee = store.get(tid);
      if ((tee.type !== 'O' || tee.props.get('__proto__') !== 'RegExp.prototype')) {
        store.linter.check('BUILTIN_ARG1_REGEX', locFrom, callerTee.tid);
      }
    }

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return playActionArr(locFrom, store, undefined, stack, 'number');
  });
  createFunction(store, 'String#split', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('STRING_SPLIT_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0) {
      // split accepts a string or a regex
      const tid = callArgs[0];
      const tee = store.get(tid);
      if (tid !== 'string' && (tee.type !== 'O' || tee.props.get('__proto__') !== 'RegExp.prototype')) {
        store.linter.check('STRING_SPLIT_ARG1', locFrom, callerTee.tid);
      }
    }

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning an array of', tstr('string'));
    return playActionArr(locFrom, store, undefined, stack, 'string');
  });
  createFunction(store, 'String#slice', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 1 && callArgs[1] !== 'number') {
      store.linter.check('BUILTIN_ARG2_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 2) {
      store.linter.check('BUILTIN_ARG3_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'String#startsWith', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'string') {
      store.linter.check('BUILTIN_ARG1_STRING', locFrom, callerTee.tid);
    }

    if (argCount > 1 && callArgs[1] !== 'number') {
      store.linter.check('BUILTIN_ARG2_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 2) {
      store.linter.check('BUILTIN_ARG3_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'String#substr', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 1 && callArgs[1] !== 'number') {
      store.linter.check('BUILTIN_ARG2_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 2) {
      store.linter.check('BUILTIN_ARG3_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'String#substring', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'number') {
      store.linter.check('BUILTIN_ARG1_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 1 && callArgs[1] !== 'number') {
      store.linter.check('BUILTIN_ARG2_NUMBER', locFrom, callerTee.tid);
    }

    if (argCount > 2) {
      store.linter.check('BUILTIN_ARG3_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'String#toLocaleLowerCase', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0) {
      const argTee = store.get(callArgs[0]);
      if (argTee.tid !== 'string' && (argTee.type !== 'A' || argTee.kind !== 'string')) {
        store.linter.check('STRING_TLS_ARG1', locFrom, callerTee.tid);
      }
    }

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'String#toLocaleUpperCase', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('BUILTIN_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0) {
      const argTee = store.get(callArgs[0]);
      if (argTee.tid !== 'string' && (argTee.type !== 'A' || argTee.kind !== 'string')) {
        store.linter.check('STRING_TLS_ARG1', locFrom, callerTee.tid);
      }
    }

    if (argCount > 1) {
      store.linter.check('BUILTIN_ARG2_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'String#toLowerCase', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount > 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'String#toString', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');
    if (argCount > 0) {
      store.linter.check('STRING_TOSTRING_ARGS', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('STRING_TOSTRING_CONTEXT', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'String#toUpperCase', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount > 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'String#trim', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount > 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'String#trimLeft', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount > 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'String#trimStart', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount > 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'String#trimRight', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount > 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'String#trimEnd', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount > 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'String#valueOf', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) {
      // Runtime error **shrug**
      store.linter.check('BUILTIN_FUNC_NOT_CONSTRUCTOR', locFrom, callerTee.tid);
    }
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount > 0) {
      store.linter.check('BUILTIN_ARG1_TMI', locFrom, callerTee.tid);
    }

    if (contextTid !== 'string') {
      store.linter.check('BUILTIN_CONTEXT_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('string'));
    return 'string';
  });
  playActionBuiltinObj(store, 'String.prototype', new Map([
      ['__proto__', 'Object.prototype'],
      ['charCodeAt', 'String#charCodeAt'],
      ['codePointAt', 'String#codePointAt'],
      ['concat', 'String#concat'],
      ['endsWith', 'String#endsWith'],
      ['includes', 'String#includes'],
      ['indexOf', 'String#indexOf'],
      ['lastIndexOf', 'String#lastIndexOf'],
      ['length', 'number'],
      ['localeCompare', 'String#localeCompare'],
      ['match', 'String#match'],
      ['matchAll', 'String#matchAll'],
      ['normalize', 'String#normalize'],
      ['padEnd', 'String#padEnd'],
      ['padStart', 'String#padStart'],
      ['repeat', 'String#repeat'],
      ['replace', 'String#replace'],
      ['replaceAll', 'String#replaceAll'],
      ['search', 'String#search'],
      ['slice', 'String#slice'],
      ['split', 'String#split'],
      ['startsWith', 'String#startsWith'],
      ['substring', 'String#substring'],
      ['substr', 'String#substr'],
      ['toLocaletoLowerCase', 'String#toLocaletoLowerCase'],
      ['toLocaleUpperCase', 'String#toLocaleUpperCase'],
      ['toLowerCase', 'String#toLowerCase'],
      ['toString', 'String#toString'],
      ['toUpperCase', 'String#toUpperCase'],
      ['trim', 'String#trim'],
      ['trimLeft', 'String#trimLeft'],
      ['trimRight', 'String#trimRight'],
      ['trimStart', 'String#trimStart'],
      ['trimEnd', 'String#trimEnd'],
      ['valueOf', 'String#valueOf'],
    ]));
  createFunction(store, 'String.fromCharCode', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('STRING_FCC_ARGLESS', locFrom, callerTee.tid);
    }

    callArgs.forEach(tid => {
      if (tid !== 'number') {
        store.linter.check('STRING_FCC_ARGS', locFrom, callerTee.tid); // TODO: the loc should for the particular arg as it will just point to the call right now
      }
    });

    log('Returning a', tstr('string'));
    return 'string';
  });
  createFunction(store, 'String.fromCodePoint', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    if (argCount === 0) {
      store.linter.check('STRING_FCP_ARGLESS', locFrom, callerTee.tid);
    }

    callArgs.forEach(tid => {
      if (tid !== 'number') {
        store.linter.check('STRING_FCP_ARGS', locFrom, callerTee.tid); // TODO: the loc should for the particular arg as it will just point to the call right now
      }
    });

    log('Returning a', tstr('string'));
    return 'string';
  });
  createConstructor(store, 'String', 'String.prototype', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    log('Returning a', tstr('string'));
    return 'string';
  }, [['fromCharCode', 'String.fromCharCode'], ['fromCodePoint', 'String.fromCodePoint']]);

  createFunction(store, 'console.log', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    // if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented'); // I don't think this matters for .log?

    // Ignore args, push an undefined
    if (argCount === 0) {
      store.linter.check('CONSOLE_LOG_ARGLESS', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('undefined'));
    return 'undefined';
  });
  createFunction(store, 'console.warn', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    // if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented'); // I don't think this matters for .warn?

    if (argCount === 0) {
      store.linter.check('CONSOLE_WARN_ARGLESS', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('undefined'));
    return 'undefined';
  });
  createFunction(store, 'console.error', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    // if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented'); // I don't think this matters for .error?

    if (argCount === 0) {
      store.linter.check('CONSOLE_ERROR_ARGLESS', locFrom, callerTee.tid);
    }
    // Ignore args, push an undefined
    if (argCount > 1) {
      store.linter.check('CONSOLE_ERROR_ARGS', locFrom, callerTee.tid);
    }
    if (argCount >= 1 && callArgs[0] !== 'string') {
      store.linter.check('CONSOLE_ERROR_ARG_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('undefined'));
    return 'undefined';
  });
  createFunction(store, 'console.group', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    // if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented'); // I don't think this matters for .group?

    log('Returning a', tstr('undefined'));
    return 'undefined';
  });
  createFunction(store, 'console.groupEnd', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    // if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented'); // I don't think this matters for .groupEnd?

    if (argCount > 0) {
      store.linter.check('CONSOLE_GROUPEND_ARGS', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('undefined'));
    return 'undefined';
  });
  createFunction(store, 'console.dir', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');

    // Ignore args, push an undefined
    if (argCount === 0) {
      store.linter.check('CONSOLE_DIR_ARGLESS', locFrom, callerTee.tid);
    }
    if (argCount > 2) {
      store.linter.check('CONSOLE_DIR_ARGS', locFrom, callerTee.tid);
    }
    if (argCount >= 2 && isPrimitive(callArgs[0])) {
      store.linter.check('CONSOLE_DIR_ARGS', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('undefined'));
    return 'undefined';
  });
  createFunction(store, 'console.trace', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // Ignore args, push an undefined
    if (argCount > 1) {
      store.linter.check('CONSOLE_TRACE_ARGS', locFrom, callerTee.tid);
    }
    if (argCount >= 1 && callArgs[0] !== 'string') {
      store.linter.check('CONSOLE_TRACE_ARG_STRING', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('undefined'));
    return 'undefined';
  });
  createFunction(store, 'console.debug', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // Ignore args, push an undefined
    if (argCount === 0) {
      store.linter.check('CONSOLE_DEBUG_ARGLESS', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('undefined'));
    return 'undefined';
  });
  createFunction(store, 'global.clearInterval', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // First arg should be a number. Over and underflows are ignored.
    // TODO: I wonder if we could use some kind of opaque type to track a setTimeout result vs setInterval result vs other kind of number...

    if (argCount < 1 || callArgs[0] !== 'number') {
      store.linter.check('CLEARINTERVAL_NUM_ARG', locFrom, callerTee.tid);
    }

    if (argCount > 1) {
      store.linter.check('CLEARINTERVAL_EXCESS_ARGS', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('undefined'));
    return 'undefined';
  });
  createFunction(store, 'global.clearTimeout', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // First arg should be a number. Over and underflows are ignored.
    // TODO: I wonder if we could use some kind of opaque type to track a setTimeout result vs setInterval result vs other kind of number...

    if (argCount < 1 || callArgs[0] !== 'number') {
      store.linter.check('CLEARTIMEOUT_NUM_ARG', locFrom, callerTee.tid);
    }

    if (argCount > 1) {
      store.linter.check('CLEARTIMEOUT_EXCESS_ARGS', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('undefined'));
    return 'undefined';
  });
  playActionBuiltinObj(store, 'global.console', new Map([
      ['group', 'console.group'],
      ['groupEnd', 'console.groupEnd'],
      ['log', 'console.log'],
      ['warn', 'console.warn'],
      ['error', 'console.error'],
      ['dir', 'console.dir'],
      ['trace', 'console.trace'],
      ['debug', 'console.debug'],
    ]));
  createFunction(store, 'global.setInterval', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // First arg should be a function of sorts. Second arg should be a number. Under or overflow is ignored.

    if (argCount >= 1) {
      const tee = store.get(callArgs[0]);
      if (tee.tid === 'string') {
        store.linter.check('SETINTERVAL_STRING_ARG', locFrom, callerTee.tid);
      } else if (tee.type !== 'F') {
        store.linter.check('SETINTERVAL_ARG_TYPE', locFrom, callerTee.tid);
      }
    } else {
      store.linter.check('SETINTERVAL_STRING_ARG', locFrom, callerTee.tid);
    }

    if (argCount < 2 || callArgs[1] !== 'number') {
      store.linter.check('SETINTERVAL_NUM_ARG', locFrom, callerTee.tid);
    }

    if (argCount > 2) {
      store.linter.check('SETINTERVAL_EXCESS_ARGS', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'global.setTimeout', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // First arg should be a function of sorts. Second arg should be a number. Under or overflow is ignored.

    if (argCount >= 1) {
      const tee = store.get(callArgs[0]);
      if (tee.tid === 'string') {
        store.linter.check('SETTIMEOUT_STRING_ARG', locFrom, callerTee.tid);
      } else if (tee.type !== 'F') {
        store.linter.check('SETTIMEOUT_ARG_TYPE', locFrom, callerTee.tid);
      }
    } else {
      store.linter.check('SETTIMEOUT_STRING_ARG', locFrom, callerTee.tid);
    }

    if (argCount < 2 || callArgs[1] !== 'number') {
      store.linter.check('SETTIMEOUT_NUM_ARG', locFrom, callerTee.tid);
    }

    if (argCount > 2) {
      store.linter.check('SETTIMEOUT_EXCESS_ARGS', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'global.parseFloat', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // First arg should be a string or number of sorts. Second arg is optionally a number. Under or overflow is ignored.

    if (argCount >= 1) {
      const tid = callArgs[0];
      if (tid !== 'string') {
        store.linter.check('PARSEFLOAT_ARG1', locFrom, callerTee.tid);
      }

      if (argCount >= 2) {
        store.linter.check('PARSEFLOAT_ARG2', locFrom, callerTee.tid);
      }
    } else {
      store.linter.check('PARSEFLOAT_ARGLESS', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, 'global.parseInt', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (isNew) store.linter.check('TOFIX', locFrom, 'new on a non-constructor builtin is not implemented but probably an error');
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');

    // First arg should be a string or number of sorts. Second arg is optionally a number. Under or overflow is ignored.

    if (argCount === 0) {
      store.linter.check('PARSEINT_ARGLESS', locFrom, callerTee.tid);
    }

    if (argCount > 0 && callArgs[0] !== 'string') {
      store.linter.check('PARSEINT_ARG1', locFrom, callerTee.tid);
    }

    if (argCount > 1 && callArgs[1] !== 'number') {
      store.linter.check('PARSEINT_ARG2', locFrom, callerTee.tid);
    }

    if (argCount > 2) {
      store.linter.check('PARSEINT_ARG3', locFrom, callerTee.tid);
    }

    log('Returning a', tstr('number'));
    return 'number';
  });
  createFunction(store, '#constructor_sans_super', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');
    if (!isNew) {
      store.linter.check('CANNOT_CALL_BUILTIN_CONSTRUCTOR', locFrom, callerTee.tid);
    }

    if (argCount) {
      store.linter.check('CALL_ARG_ARITY', locFrom, callerTee.tid);
    }

    log('This is a noop constructor. Returning the context:', tstr(contextTid));
    return contextTid;
  });
  createFunction(store, '#constructor_with_super', (locFrom, callerTee, contextTid, argCount, callArgs, spreadAt, stack, store, closure, isNew, ownerClass) => {
    if (spreadAt >= 0) store.linter.check('TOFIX', locFrom, 'spread on builtin not implemented');
    if (!isNew) {
      store.linter.check('CANNOT_CALL_BUILTIN_CONSTRUCTOR', locFrom, callerTee.tid);
    }

    // This is implicit es6 class constructor `constructor(...args) { super(...args); }`
    // Note: I think there's currently a typo in the spec since v8 and spidermonkey _return_ the super call value. So let's go with that.
    log('Calling super(...args) on superClass', tstr(ownerClass), 'with', argCount, 'args and returning the current context:', tstr(contextTid));

    // This `super()` is determined by the own `__proto__` value of this class
    // `class X {constructor(){ log('A'); }; f(){}} class Y extends X { } new Y(); Y.__proto__ = Object; new Y();`
    // `class X {constructor(){ log('A'); }; f(){}} class Y extends X { constructor(){ super() } } new Y(); Y.__proto__ = Object; new Y();`
    // Both print A for the first `new` and nothing for the second one.

    if (ownerClass === 'Function.prototype') log('The owner class is ' + tstr('Function.prototype') + ' so the parent constructor is ' + tstr('Object'));

    const ownerClassTee = store.get(ownerClass === 'Function.prototype' ? 'Object' : ownerClass);
    // log('ownerClassTee:', ownerClassTee)
    const actualProtoTid = ownerClassTee.props.get('__proto__');
    const targetProtoTid = actualProtoTid === 'Function.prototype' || actualProtoTid === undefined ? 'Object' : actualProtoTid;
    log('The class.__proto__ (super class) is', tstr(actualProtoTid), actualProtoTid !== targetProtoTid ? '(this means the parent class is ' + tstr(targetProtoTid) + ')' : '');
    const protoTee = store.get(targetProtoTid === 'Function.prototype' ? 'Object' : targetProtoTid);
    // log('The proto tee:', protoTee)

    let constructTid = targetProtoTid;
    if (protoTee.type !== 'C' && protoTee.type !== 'F') {
      log('The super class is an illegal value (a lint should have been issued for this already):', tstr(protoTee.tid));
      return 'undefined';
    }

    if (protoTee.funcType === 'class') {
      log('The super class is an es6 class. Getting the constructor');
      const prototypeTid = protoTee.props.get('prototype');
      ASSERT(prototypeTid !== null, 'i dont think i allow this to happen anymore');
      if (prototypeTid === undefined || prototypeTid === 'null') {
        store.linter.check('CONSTRUCTOR_NULL_PARENT', locFrom, callerTee.tid);
      }
      log('- .prototype:', tstr(prototypeTid));
      ASSERT(prototypeTid, 'the prototype of a constructor can not be cleared', prototypeTid, protoTee);
      const prototypeTee = store.get(prototypeTid);
      const constructorTid = prototypeTee.props.get('constructor');
      ASSERT(constructorTid, 'the constructor on an es6 class must always exist, explicitly or implicitly', constructorTid);
      log('- .prototype.constructor:', tstr(constructTid));

      constructTid = constructorTid;
    } else if (protoTee.funcType.startsWith('class')) {
      // A bound class cannot be extends because it has no proto
      log('The superClass value is actually a bound class and this has no prototype which is a runtime error');
      return 'undefined';
    } else {
      log('The super class is an es5 class, so just call it');
    }

    // invoke constructTid as a new call but forcing context as the context... Return whatever it returns.
    group('invoking now');
    const returnTid = metaCall(locFrom, constructTid, contextTid, true, stack, argCount, callArgs, -1, store, targetProtoTid, store.instanceId, false);
    groupEnd();

    // Counter to spec but conform to real world; return the return value
    return returnTid;
  });
}
function createFunction(store, tid, callback) {
  const props = new Map([['__proto__', 'Function.prototype']]);
  store.set(tid, {
    tid,
    type: 'F',
    superPropOwner: NO_SUPER_PROP_FOR_BUILTINS,
    digest(color) { return color ? tstr(tid) : tid; },
    fromFilename: '<builtin>',
    fromColumn: 0,
    fromLine: 0,
    funcType: 'func-builtin',
    builtin: true,
    builtinCode: callback,
    reachableNames: new Map,
    props,
    setProp(name, tid) { this.props.set(name, tid); return tid; },
    seen: new Map,
  });
}
function createConstructor(store, tid, prototype, callback, staticProps = []) {

  const props = new Map([
    ['__proto__', 'Function.prototype'],
    ['prototype', prototype],
  ]);
  staticProps.forEach(([name, tid]) => props.set(name, tid));

  store.set(tid, {
    tid,
    type: 'F',
    superPropOwner: NO_SUPER_PROP_FOR_BUILTINS,
    digest(color) { return color ? tstr(tid) : tid; },
    fromFilename: '<builtin>',
    fromColumn: 0,
    fromLine: 0,
    funcType: 'func-builtin',
    builtin: true,
    builtinCode: callback,
    reachableNames: new Map,
    props,
    setProp(name, tid) { this.props.set(name, tid); return tid; },
    seen: new Map,
  });
}
