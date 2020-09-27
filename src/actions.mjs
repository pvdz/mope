import {
  ASSERT,
  ASSERT_LOC,
  ASSERT_TID,
  WHITE_BLACK,
  RED,
  BLUE,
  RESET,
  BOLD,
  GREEN,
  PURPLE,
  DIM,

  SUPER_PROP_OWNER_NOT_FOR_CLASS,
  SUPER_PROP_OWNER_NOT_FOR_GLOBAL,
  SUPER_PROP_OWNER_NOT_A_METHOD,
  ASSERT_SUPER_PROP_OWNER,

  NO_DEFAULT_VALUE,
  NO_SUPER_VALUE,

  createPlaceholder,
  createArrayTid,
  createClassTid,
  createFuncoTid,
  createMapTid,
  createObjectTid,
  createSetTid,
  dir,
  getIndent,
  group,
  groupEnd,
  log,
  printNode,
  tstr, YELLOW,
} from "./utils.mjs"
import {
  digest,
  fencedCloneTool,
  fencedCloneToolDebug,
  isPrimitive,
  merge,
  fenceStart,
  fenceStop,
  testMerge,
  mergeAll,
  mergeTestAll,
  tidToString
} from "./tools.mjs"
// import * as Tenko from '../node_modules/tenko/build/tenko.prod.mjs'; // This way it works in browsers and nodejs ... :/
import * as Tenko from '../lib/tenko.prod.mjs'; // This way it works in browsers and nodejs and github pages ... :/

export function playActions(locFrom, store, actions, calleeTee, callerContext, closure, stack) {

  ASSERT(calleeTee.fromFilename, 'every callable should have a fromFilename', calleeTee);

  const filename = calleeTee.fromFilename;

  const indentBefore = getIndent();

  // TOP: callee context
  // OVER: first arg (if any)
  // ROT: second arg (if any)
  let returnValue = undefined;
  actions.forEach(([action, column, line, data]) => {

    const indentBefore = getIndent();
    const r = playAction({filename, column, line}, action, data, store, calleeTee, callerContext, closure, stack);
    ASSERT(indentBefore === getIndent(), 'indent should be same before/after action', action);

    if (action === '@return') {
      if (returnValue === undefined) returnValue = r;
      else returnValue = merge(locFrom, store, returnValue, r);
    }
  });

  ASSERT(indentBefore === getIndent(), 'indent should be same before/after rolling actions');

  if (returnValue === undefined) {
    log('This call did not explicitly return, so it implicitly returns `undefined`');
    returnValue = 'undefined';
  }

  return returnValue;
}

function pushTlog(token, obj) {
  if (!token.tlog) token.tlog = [];
  token.tlog.push(obj);
}

function playAction(locFrom, action, data, store, actionCalleeTee, callerContext, closure, stack) {
  group('-- ', BLUE + action + RESET, DIM + locFrom.column + ':' + locFrom.line + RESET, data, ' '.repeat(50), stack ? '[' + stack.map(tstr).join(', ') + ']' : '<no stack>');

  ASSERT(locFrom.filename === actionCalleeTee.fromFilename, 'filename ought to be the file where the actions are located', locFrom, actionCalleeTee);
  stack.forEach(tid => ASSERT_TID(tid, NO_DEFAULT_VALUE, NO_SUPER_VALUE));

  const fileState = store.fileData.get(locFrom.filename);

  let returns = undefined; // Only used by @return
  switch (action) {
    case '@arguments': {
      const objTid = playActionObj(locFrom, store, undefined, stack, ['length'], ['number']);
      playActionBinding(locFrom, store, stack, closure, 'arguments', 'lex', objTid);
      store.get(objTid).builtin = true; // prevents cloning problems
      log('Created', tstr(objTid), 'as `arguments` object');
      break;
    }

    case '@arr': {
      const [elementCount] = data;

      const tids = [];
      for (let i=0; i<elementCount; ++i) {
        tids.push(stack.pop());
      }

      log('Array elements (' + tids.length + '):', tids.map(tstr).join(', '));

      let canMerge = true;
      if (tids.length > 0) {
        if (!mergeTestAll(locFrom, tids, store)) {
          store.linter.check('ARR_MONO_KIND', locFrom);
          log('Will just use first element as the kind without merging the others:', tstr(tids[0]));
          canMerge = false;
        }
      }

      let kind = tids.length > 0 ? (canMerge ? mergeAll(locFrom, tids, store) : tids[0]) : createPlaceholder(store, 'HAK', 'array kind for empty array literal');

      const arrTid = playActionArr(locFrom, store, undefined, stack, kind);
      log('--> Arr is:', tstr(arrTid));
      stack.push(arrTid);

      break;
    }

    case '@assign': {
      // TODO: clean up
      const [name, op, tokenOpIndex] = data;
      ASSERT(typeof tokenOpIndex === 'number' && tokenOpIndex >= -1, 'tokenOp num', tokenOpIndex);
      const tokenOp = fileState.tokens[tokenOpIndex];
      ASSERT(tokenOp && tokenOp.tlog);

      log('Assignment to `' + name + '`');
      const bindingTid = closure.find(name, locFrom);
      log('Which resolves to tid:', tstr(bindingTid));
      const right = stack.pop();
      if (op !== '=') {
        ASSERT(op[0] !== '=' && op[0] !== '!' && op[op.length - 1] === '=', 'meh');
        if (op === '+=') {
          if (bindingTid !== right || (bindingTid !== 'number' && bindingTid !== 'string')) {
            store.linter.check('COMPOUND_ASSIGN_PLUS', locFrom);
          }
        } else if (right !== 'number' || bindingTid !== 'number') {
          store.linter.check('COMPOUND_ASSIGN_TYPE', locFrom);
        }
      }
      tokenOp.tlog.push({wat: '#binop', left: bindingTid, right});

      log('Which gets this value assigned now:', tstr(right));
      const result = merge(locFrom, store, bindingTid, right);
      if (bindingTid === 'undefined' && result !== 'undefined') {
        log('Updating the binding tid for `' + name + '` to', tstr(result), 'because it was undefined and the merge returned something else. Model is broken, anyways.');
        closure.set(name, result);
      }
      log('Resulting in', tstr(result));
      stack.push(result);

      break;
    }

    case '@binding': {
      const [name, kind] = data;

      ASSERT(locFrom.filename, 'filename should be known?', locFrom);

      const tid = stack.pop();

      playActionBinding(locFrom, store, stack, closure, name, kind, tid);
      break;
    }

    case '@binop': {
      const [operator, tokenOpIndex] = data;

      const left = stack[stack.length - 2];
      const right = stack[stack.length - 1];

      const tokenOp = fileState.tokens[tokenOpIndex];
      tokenOp.tlog.push({wat: '#binop', left, right});

      break;
    }

    case '@body_start': {
      const [] = data;

      // Start of a function body
      // if (actionCalleeTee.funcTokenIndex >= 0) {
      // TODO
      //   const funcTokenIndex = actionCalleeTee.funcTokenIndex;
      //   const fromFilename = actionCalleeTee.fromFilename;
      //   const funcToken = store.fileData.get(fromFilename).tokens[funcTokenIndex];
      //   ASSERT(funcToken.tlog, 'should be set in phase2', funcToken);
      //   funcToken.tlog[funcToken.tlog.length - 1].paramTidDesc = actionCalleeTee.paramBindingNames.map(name => name + ': ' + closure.get(name)).reverse().join(', ') || '<none>';
      // }

      break;
    }

    case '@call': {
      const [argCount, spreadAt] = data;

      // Stack, from top to bottom:
      // - tid to call
      // - tid to be context according to syntax (may be ignored)
      // - args + default, tid pairs (first from the top is arg, second is default) from first to last

      const calleeTid = stack.pop();
      log('Stack has this tid to call:', tstr(calleeTid));
      const calleeTee = store.get(calleeTid);

      // Figure out context. Depends on a few factors like callee AST node and whether function is bound at all.
      const contextOnStack = stack.pop();
      log('Stack has this tid for context:', tstr(contextOnStack));

      const contextTid = calleeTee.boundContext ? calleeTee.boundContext : contextOnStack;
      if (calleeTee.boundContext) log('Callee context is bound to', tstr(calleeTee.boundContext), 'so ignoring context from stack');

      log('Did this call have a spread? spreadAt =', spreadAt);

      // Get args, and also remove them from the stack

      const callArgs = argCount ? stack.slice(-argCount) : [];
      stack.length -= argCount;
      log('Fetched the', argCount, 'args from the stack:', callArgs.map(tstr).join(', '), 'it now has', stack.length, 'items left');

      const indentBefore = getIndent();

      group('invoking now from', locFrom.filename+':'+locFrom.column+':'+locFrom.line);
      const returnTid = metaCall(locFrom, calleeTid, contextTid, false, stack, argCount, callArgs, spreadAt, store, '', store.instanceId, false);
      stack.push(returnTid);
      groupEnd();

      const locFunc = {filename: calleeTee.fromFilename, column: calleeTee.fromColumn, line: calleeTee.fromLine};
      locToToken(store, locFrom).tlog.push({wat: '#invoke', locCall: locFrom, locFunc, calleeTid, argCount, callArgs, contextTid, returned: returnTid});

      log('End of call to', tstr(calleeTid));

      ASSERT(indentBefore === getIndent(), 'indent should be same before and after call');

      break;
    }

    case '@class': {
      // Top on the stack is the prototype object to use (super property access relies on this)
      // Second of stack is the value that the class extends, or `null` if it doesn't extend at all
      // The rest of the stack consists of the methods for this class, in reversed methodNames order

      const [nid, className, methodTypes, methodNames, userDesc] = data;

      const prototypeTid = stack.pop();
      const superClassTid = stack.pop();

      const prototypeTee = store.get(prototypeTid);

      // The stack should have all the method ids, in order of methodNames. Top of stack was last method in class.
      // We collect the static methods to set as own props and record all prototype methods straight on the prototype.

      const staticMethods = []; // In reverse order of appearance (don't think this matters)
      let hasConstructor = false;
      methodNames.forEach((name, i) => {
        const type = methodTypes[i];
        if (type === 'static') {
          log('- Recording static method `' + name + '` as', tstr(stack[stack.length - 1]));
          staticMethods.push([name, stack.pop()]);
        } else {
          // Set directly on the prototype object
          if (name === 'constructor') {
            // parser ensures this does not happen twice
            log('- Recording `constructor` as', tstr(stack[stack.length - 1]));
            hasConstructor = true;
          } else {
            log('- Recording instance method `' + name + '` as', tstr(stack[stack.length - 1]));
          }
          prototypeTee.setProp(name, stack.pop())
        }
      });

      if (!hasConstructor) {
        log('Has no explicit constructor, creating a dud now');
        // Implicit class constructors come in two types: either one that is a noop and returns the instance or one
        // that calls `super()` and then returns the instance (but not the result of `super()`). Depends on `extends`.

        prototypeTee.setProp('constructor', superClassTid === NO_SUPER_VALUE ?  '#constructor_sans_super' : '#constructor_with_super');
      }

      const classTid = playActionClass(locFrom, store, undefined, stack, nid, className, staticMethods, closure, userDesc, prototypeTid, superClassTid);
      stack.push(classTid);

      break;
    }

    case '@condition': {
      let [] = data;

      const tid = stack.pop();
      log('Checking whether', tstr(tid), 'is a boolean because it is used in a statement condition or logical expression');

      if (tid !== 'boolean') {
        // When you use a non-bool like string or number as the condition for `if` or `while`, etc.
        // Doesn't break our model so a lint works too

        if (tid === 'undefined') {
          store.linter.check('TEST_UNDEF', locFrom);
        } else  if (tid === 'null') {
          store.linter.check('TEST_NULL', locFrom);
        } else if (tid === 'number' || tid === 'string') {
          store.linter.check('TEST_NUMSTR', locFrom);
        } else {
          ASSERT(!isPrimitive(tid));
          store.linter.check('TEST_OBJ', locFrom);
        }
      }

      break;
    }

    case '@defaults': {
      let [] = data;

      // Given two tids on the stack, default and then given, determine whether the given value is undefined and
      // that the default value is not null, in that case push the default value back on the stack. Otherwise verify
      // that the default value can be merged to the given value (but do not actually merge) and use the given value.

      const defaultValue = stack.pop();
      const givenValue = stack.pop();

      if (givenValue === 'undefined' && defaultValue !== NO_DEFAULT_VALUE) {
        stack.push(defaultValue);
      } else {
        if (defaultValue !== NO_DEFAULT_VALUE) {
          group('There was an explicit pattern value so default value is not used here. Will do a test merge for linting purposes:');
          if (!testMerge(store, givenValue, defaultValue)) {
            store.linter.check('UNUSED_DEFAULT_ARG_POLY', locFrom);
          }
          groupEnd();
        }
        stack.push(givenValue);
      }

      log('Value:', tstr(givenValue), ', default:', tstr(defaultValue), '--> result:', tstr(stack[stack.length - 1]));

      break;
    }

    case '@drop': {
      stack.pop();
      break;
    }

    case '@dup': {
      stack.push(stack[stack.length - 1]);
      break;
    }

    case '@dyn_get': {

      const [depth] = data;

      const prop = store.final(stack.pop());
      const arrOrStrTee = store.get(stack.pop());
      log('Prop:', prop, ', obj:', arrOrStrTee.tid);

      if (arrOrStrTee.type === 'O' && arrOrStrTee.kind !== false && (prop === 'string' || prop === 'number')) {
        ASSERT_TID(arrOrStrTee.kind);
        log('Dynamic property access on a plain object as if it were a Map. Object has kind', tstr(arrOrStrTee.kind));

        const teeKind = store.get(arrOrStrTee.kind);
        if (teeKind.type === 'H') {
          store.linter.check('DYNAMIC_INDEX_ACCESS_EMPTY_OBJECT', locFrom);
          log('Changing the kind of object from undetermined to ', tstr('undefined'), 'now');
          store.linkTo(teeKind, store.get('undefined'));
          arrOrStrTee.kind = 'undefined';
          stack.push('undefined');
        } else {
          store.linter.check('DYNAMIC_ACCESS_OBJECT_AS_MAP', locFrom);
          log('This was dynamic property access on an object-as-map, returning its kind', tstr(teeKind.tid));
          stack.push(teeKind.tid);
        }
        log('Dynamic lookup on Object-as-Map:', tstr(arrOrStrTee.tid), '--> kind:', tstr(stack[stack.length - 1]));
      } else if (arrOrStrTee.tid === 'string' && prop === 'number') {
        log('Indexed access on a string probably returns a', tstr('string')); // Although, `''[0] === undefined`
        store.linter.check('DYNAMIC_INDEX_ACCESS_STRING', locFrom);
        stack.push('string');
      } else if (arrOrStrTee.type === 'A' && prop === 'number') {
        log('The tee is an array and the property a number; return the kind', tstr(arrOrStrTee.kind));
        const teeKind = store.get(arrOrStrTee.kind);
        if (teeKind.type === 'H') {
          store.linter.check('DYNAMIC_INDEX_ACCESS_EMPTY_ARRAY', locFrom);
          log('Changing the kind of array from undetermined to ', tstr('undefined'), 'now');
          store.linkTo(teeKind, store.get('undefined'));
          arrOrStrTee.kind = 'undefined';
          stack.push('undefined');
        } else {
          store.linter.check('DYNAMIC_INDEX_ACCESS_ARRAY', locFrom);
          log('This was numbered access on an array, returning its kind', tstr(arrOrStrTee.kind));
          stack.push(arrOrStrTee.kind);
        }
        log('Indexed lookup on Array:', tstr(arrOrStrTee.tid), '--> kind:', tstr(stack[stack.length - 1]));
      } else {
        store.linter.check('DYNAMIC_PROP_ACCESS', locFrom, 'phase3, step' + depth);
        stack.push('undefined');
        log('Dynamic property lookup on non-array:', tstr(arrOrStrTee.tid), '-->', tstr('undefined'));
      }

      break;
    }

    case '@dyn_set': {

      const [tokenOpIndex] = data;

      const propTee = store.get(stack.pop());
      const propTid = propTee.tid;
      const objTee = store.get(stack.pop());
      const objTid = objTee.tid;
      const valueTee = store.get(stack.pop());

      log('key:', propTid, ', obj:', objTid);

      if (isPrimitive(objTid)) {
        if (objTid === 'undefined' || objTid === 'null') {
          store.linter.check('PROP_SET_ON_NULL_UNDEF', locFrom);
        } else {
          store.linter.check('PROP_SET_ON_PRIMITIVE', locFrom);
        }
      } else if (objTee.type === 'A' && propTid === 'number') {
        // We can do this, even if we do have to issue a warning for it.
        store.linter.check('DYNAMIC_INDEX_ACCESS_ARRAY', locFrom);
        log('Merging the kind of the array,', tstr(objTee.kind),', with the value being assigned')
        objTee.kind = merge(locFrom, store, objTee.kind, valueTee.tid);

        if (tokenOpIndex >= 0) {
          const tokenOp = fileState.tokens[tokenOpIndex];
          ASSERT(tokenOp && tokenOp.tlog);
          tokenOp.tlog.push({wat: '#set', arrTid: objTid, name: 'kind', valueTid: valueTee.tid});
        }
      } else if (objTee.type === 'O' && objTee.kind !== false && (propTid === 'number' || propTid === 'string')) {
        ASSERT_TID(objTee.kind);
        // This is object-as-a-map and we tentatively support this under objection.

        if (testMerge(store, objTee.kind, valueTee.tid)) {
          objTee.kind = merge(locFrom, store, objTee.kind, valueTee.tid);
          store.linter.check('DYNAMIC_ACCESS_OBJECT_AS_MAP', locFrom);
          log('The object kind is the same as the value being assigned. The model kind of supports this.');
        } else {
          store.linter.check('DYNAMIC_PROP_ACCESS', locFrom);
          log('The kind of the object does not match the value being assigned so this object cannot be used as a map.');
          objTee.kind = false;
        }

        if (tokenOpIndex >= 0) {
          const tokenOp = fileState.tokens[tokenOpIndex];
          ASSERT(tokenOp && tokenOp.tlog);
          tokenOp.tlog.push({wat: '#set', arrTid: objTid, name: 'kind', valueTid: valueTee.tid});
        }
      } else {
        // Not much we can do about this. We don't track the value of the key so we don't know what property is
        // being updated here. Typically you would consider to use a Map here, although there are plenty of legit
        // cases for not doing that. Plus real world code is still riddled with this. Maybe some typing DSL could
        // solve this for us but so far I've not found a way to statically determine this properly.
        store.linter.check('DYNAMIC_PROP_ACCESS', locFrom);
      }

      stack.push(valueTee.tid);

      break;
    }

    case '@export_as': {

      const [name] = data;

      ASSERT(typeof name === 'string');

      const top = stack.pop();
      ASSERT_TID(top);

      log('Recording `' + locFrom.filename + '` to be exporting symbol `' + name + '` with type', tstr(top));
      fileState.exports.set(name, top);

      break;
    }

    case '@func': {
      const [nid, funcName, paramNames, paramBindingNames, hasRest, minParamRequired, body, funcType, thisAccess, reachableNames, funcTokenIndex, fromFilename, fromColumn, fromLine, userDesc] = data

      const funcTid = playActionFunc(locFrom, {
        store,
        tid: undefined,
        stack,
        closure,
        callerContext,
        nid,
        funcName,
        paramNames,
        paramBindingNames,
        hasRest,
        minParamRequired,
        body,
        funcType,
        thisAccess,
        reachableNames,
        ownerClass: undefined,
        superClass: undefined,
        boundArgs: undefined,
        boundContext: undefined,
        funcTokenIndex,
        fromFilename,
        fromColumn,
        fromLine,
        userDesc,
      });
      stack.push(funcTid);

      break;
    }

    case '@func_expr_name': {
      const [name] = data
      // Hack to create local binding of the name of a function expression
      // At compile time (phase 2) we won't know the func reference yet so we can't bind it and when the function
      // gets called we can't really push another reference every time we call just in case, so instead this hack
      // allows me to grab the internal reference of the current calleeTee and bind it to the local binding for its name
      ASSERT(typeof closure.calleeTid === 'string', 'all closures ought to have a reference to the tid that was called when they were created', closure);
      log('Pushing the closure.calleeTid to the stack to create the binding:', tstr(closure.calleeTid));

      playActionBinding(locFrom, store, stack, closure, name, 'var', closure.calleeTid);

      break;
    }

    case '@get': {
      const [propName, hasDefault] = data
      let tee = store.get(stack.pop());
      const tid = tee.tid;
      log('Getting property `' + propName + '` from', tstr(tid));

      if (tid === 'undefined' || tid === 'null') {
        store.linter.check('PROP_ON_NULL_UNDEF', locFrom, propName);
        stack.push('undefined');
      } else {
        let ind = '';

        ASSERT(tee);
        let props = tee.props;
        if (isPrimitive(tee.tid)) {
          log(tstr(tee.tid), 'is a primitive, redirecting to box class');
          let next = '';
          switch (tee.tid) {
            case 'undefined':
              store.linter.check('PROP_ON_NULL_UNDEF', locFrom);
              next = 'undefined';
              break;
            case 'null':
              store.linter.check('PROP_ON_NULL_UNDEF', locFrom);
              next = 'undefined';
              break;
            case 'boolean':
              next = 'Boolean.prototype';
              break;
            case 'number':
              next = 'Number.prototype';
              break;
            case 'string':
              next = 'String.prototype';
              break;
            default:
              ASSERT(false, 'there are only 5 primitives');
          }

          log('=>', tstr(next));
          ind += '  ';
          tee = store.get(next);
          props = tee.props;
        }

        ASSERT(props, 'icanhaz props?', [tee]);

        function dig(props, propName) {
          group();
          log('- dig', propName, '{ '+[...props.entries()].map(([k, v]) => k + ':' + tstr(v)).join(', ')+' }');
          const prop = props.get(propName);
          if (prop !== undefined) {
            log(' - Found! ===>', tstr(prop));
            groupEnd();
            return prop;
          }

          const proto = props.get('__proto__');
          if (proto === undefined) {
            log('- Not found in proto chain, resolving to', tstr('undefined'));
            if (hasDefault) {
              store.linter.check('PROP_NOT_FOUND_HAS_DEFAULT', locFrom, propName);
            } else {
              store.linter.check('PROP_NOT_FOUND', locFrom, propName);
            }
            groupEnd();
            return 'undefined';
          }

          log('=>', tstr(proto));

          const protoTee = store.get(proto);
          ASSERT(protoTee, 'proto should exist', [proto, protoTee]);
          ASSERT(protoTee.props); // This isn't a guarantee, but as long as no test case violates this ...

          const found = dig(protoTee.props, propName);
          if (protoTee.seen.has(propName)) {
            const before = protoTee.seen.get(propName);
            log('Merging resolved property with tee that was already observed on this proto:', tstr(before));
            merge(locFrom, store, found, before);
          } else {
            log('Property not observed before. Marking resolved tid as observed for this property on this proto');
            ASSERT_TID(found);
            protoTee.seen.set(propName, String(found));
          }

          groupEnd();
          return found;
        }

        const propTid = dig(props, propName);
        if (tee.seen.has(propName)) {
          const before = tee.seen.get(propName);
          log('Merging found tid', tstr(propTid), 'with what was already observed for property `' + propName + '`:', tstr(before));
          merge(locFrom, store, propTid, before);
        } else {
          log('Property not observed before. Marking resolved tid as being observed on this object');
          ASSERT_TID(propTid);
          tee.seen.set(propName, String(propTid));
        }

        stack.push(propTid || 'undefined'); // TODO: resolve cache
      }

      locToToken(store, locFrom).tlog.push({wat: '#prop', tid: stack[stack.length - 1]});
      break;
    }

    case '@in': {
      const [node] = data

      const left = stack.pop();
      const right = stack.pop();

      // TODO: for a minifier approach, we should be able to replace this with a true or false

      // switch (left) {
      //   case 'boolean':
      //     if (right !== 'Boolean') {
      //       store.linter.check('INSTANCEOF_FAIL', locFrom);
      //     }
      //     break;
      //   case 'number':
      //     if (right !== 'Number') {
      //       store.linter.check('INSTANCEOF_FAIL', locFrom);
      //     }
      //     break;
      //   case 'string':
      //     if (right !== 'String') {
      //       store.linter.check('INSTANCEOF_FAIL', locFrom);
      //     }
      //     break;
      //   default:
      //     todo // solidify support
      // }

      break;
    }

    case '@instanceof': {
      const [] = data

      const left = stack.pop();
      const right = stack.pop();
      stack.push('boolean');

      // TODO: for a minifier approach, we should be able to replace this with a true or false.

      break;
    }

    case '@ident': {
      const [name] = data;
      const tid = closure.find(name, locFrom);
      log('->', tstr(tid));
      ASSERT(tid, 'ident should receive a tid', tid);
      stack.push(tid);
      // console.log('actionCalleeTee:', actionCalleeTee)
      // console.log('Current file where the call is invoked from?', filename, ', file where current callee is from?', actionCalleeTee.fromFilename)
      // console.log('This token is at', column, line, 'which yields', locToToken(store, filename, column, line))
      locToToken(store, locFrom).tlog.push({wat: '#ident', tid});
      // resolve the ident in the current scope to get its tid and push it
      break;
    }

    case '@import_binding': {

      const [localName, exportedName, fromFilename] = data;

      ASSERT(typeof localName === 'string');
      ASSERT(typeof fromFilename === 'string');

      if (store.fileData.has(fromFilename)) {
        log('Importing `' + exportedName + '` from `' + fromFilename + '`');
        const tid = store.fileData.get(fromFilename).exports.get(exportedName);
        if (tid === undefined) {
          log('The symbol `' + exportedName + '` was not found in the exports for `' + fromFilename + '`. Assuming `undefined` instead.');
          log('The exports object for that file:', store.fileData.get(fromFilename).exports);
          store.linter.check('IMPORT_UNKNOWN', locFrom, '`' + exportedName + '` from ' + fromFilename);
          closure.set(localName, 'undefined');
        } else {
          log('-->', tstr(tid));
          ASSERT_TID(tid);
          ASSERT(store.get(tid), 'todo: different modules should still record to the same store overall...?');

          ASSERT(!closure.has(localName), 'parser should ensure the import binding is unique');
          closure.set(localName, tid);
        }
      } else {
        console.log('Tried to import a symbol `' + exportedName + '` from a file `' + fromFilename + '` but this file is unknown to the system so going to ignore it and assume `undefined` for it.');
        store.linter.check('IMPORT_FILE_UNKNOWN', locFrom, fromFilename, localName);
        closure.set(localName, 'undefined');
      }

      break;
    }

    case '@import_star': {

      const [localName, fromFilename] = data;

      ASSERT(typeof localName === 'string');
      ASSERT(typeof fromFilename === 'string');

      if (store.fileData.has(fromFilename)) {
        const fileData = store.fileData.get(fromFilename);
        log('Importing star from `' + fromFilename + '` for which we registered', fileData.exports.size, 'exported symbols');
        log('Star export objects has these symbols: [', [...fileData.exports.entries()].map(([symbol, tid]) => symbol + ': ' + tstr(tid)).join(', '), ']');

        const propNames = [...fileData.exports.keys()];
        const propTids = [...fileData.exports.values()];
        const objTid = playActionObj(locFrom, store, undefined, stack, propNames, propTids);
        log('Registering star export to name `' + localName + '`');
        closure.set(localName, objTid);
      } else {
        log('Tried to import star from a file `' + fromFilename + '` but this file is unknown to the system so going to ignore it and assume `{}` for it.');
        store.linter.check('IMPORT_FILE_UNKNOWN', locFrom, fromFilename, localName);
        const objTid = playActionObj(locFrom, store, undefined, stack, [], []);
        log('Registering empty star export to name `' + localName + '`');
        closure.set(localName, objTid);
      }

      break;
    }

    case '@kind': {
      const [defaultTidOrTrue, desc] = data;

      const arrTid = stack.pop();

      const kindTid = playActionKind(locFrom, store, stack, arrTid);
      stack.push(kindTid);

      break;
    }

    case '@lint': {
      const [condition, msg] = data;

      const have = stack[stack.length - 1];
      if (condition === 'primitive') {
        if (isPrimitive(have)) store.linter.check(msg, locFrom);
      } else {
        if (have === condition) store.linter.check(msg, locFrom);
      }

      break;
    }

    case '@lint-inv': {
      const [condition, msg] = data;

      const have = stack[stack.length - 1];
      if (condition === 'primitive') {
        if (!isPrimitive(have)) store.linter.check(msg, locFrom);
      } else {
        if (have !== condition) store.linter.check(msg, locFrom);
      }

      break;
    }

    case '@log': {
      // We already print the arg anyways so no need to repeat it
      // const [...args] = data;
      // log('Log:', ...args);
      break;
    }

    case '@logical': {
      const [operator] = data;

      const right = stack.pop();
      const left = stack.pop();
      ASSERT_TID(left);
      ASSERT_TID(right);

      log('Logical operator (`'+operator+'`) found with', tstr(left), 'and', tstr(right));

      switch (left+':'+right) {
        case 'boolean:boolean':
          // This is the norm
          stack.push('boolean');
          break;

        case 'undefined:undefined':
        case 'null:null':
        case 'number:number':
        case 'string:string':
          // This is not the norm but because both sides are the same, the return type must be the same
          store.linter.check('LOGICAL_OPERANDS_SAME_PRIMITIVE', locFrom, left, operator, right);
          stack.push(left);
          break;

        case 'undefined:null':
        case 'undefined:boolean':
        case 'undefined:number':
        case 'undefined:string':
        case 'null:undefined':
        case 'null:boolean':
        case 'null:number':
        case 'null:string':
          // Because we can guarantee a is falsy, we can determine the result based on the operator
          store.linter.check('LOGICAL_OPERANDS_NULL_UNDEF_LEFT', locFrom, left, operator, right);
          if (operator === '&&') {
            log(tstr(left), 'left of `&&` must mean it returns left');
            stack.push(left);
          } else {
            log(tstr(left), 'left of `||` must mean it returns right:', tstr(right));
            stack.push(right);
          }
          break;

        // case 'boolean:undefined':
        // case 'boolean:null':
        // case 'boolean:number':
        // case 'boolean:string':
        // case 'number:undefined':
        // case 'number:null':
        // case 'number:boolean':
        // case 'number:string':
        // case 'string:undefined':
        // case 'string:null':
        // case 'string:boolean':
        // case 'string:number':

        default:
          if (isPrimitive(left)) {
            ASSERT(left !== right, 'all other cases should have been checked', left, right);
            log('Cannot safely determine return type so model is broken now. Will arbitrarily return the left type.');
            store.linter.check('LOGICAL_OPERANDS_PRIM_LEFT', locFrom, left, operator, right);
            stack.push(left);
          } else {
            // This must be an object of sorts. That's always truthy. So if it's left, then return that, otherwise
            // it depends on the type of a whether we can guarantee soundness.
            store.linter.check('LOGICAL_OPERANDS_OBJ_LEFT', locFrom, left, operator, right);
            // This does not even warrant a merge since it always returns the same side
            if (operator === '&&') {
              log(tstr(left), 'left of `&&` must mean it returns right:', tstr(right));
              stack.push(right);
            } else {
              log(tstr(left), 'left of `||` must mean it returns left');
              stack.push(left);
            }
          }
          break;
      }

      break;
    }

    case '@merge': {
      const [] = data;

      const tidA = stack.pop();
      const tidB = stack.pop();
      const tid = merge(locFrom, store, tidA, tidB);
      stack.push(tid);
      break;
    }

    case '@new': {
      const [argCount, spreadAt] = data;

      const wrapperClassTid = stack.pop();


      const callArgs = argCount ? stack.slice(-argCount) : [];
      stack.length -= argCount;

      const newTid = playActionNew(locFrom, store, stack, spreadAt, wrapperClassTid, callArgs);
      stack.push(newTid);

      break;
    }

    case '@obj': {
      const [propNames] = data;

      const propCount = propNames.length;
      const propTids = propCount ? stack.slice(-propCount) : [];
      stack.length -= propCount;
      // propNames.forEach(name => {
      //   propTids.push(stack.pop());
      // });

      const objTid = playActionObj(locFrom, store, undefined, stack, propNames, propTids);
      stack.push(objTid);
      break;
    }

    case '@obj_init': {
      const [propNames, spreads] = data;

      // Top of the stack should be an object, probably clean apart from a __proto__
      // After that, there ought to be as many values on the stack as there are property names passed on

      const tid = stack.pop(); // Get it out of the way. We'll push it back on afterwards.
      const objTee = store.get(tid);

      log('Object to initialize:', tstr(tid));
      log('Properties to init:', propNames);

      group('Processing properties');
      propNames.forEach((name, i) => {
        ASSERT(typeof spreads[i] === 'boolean', 'spreads should be a 1:1 flag for each arg', propNames, spreads);
        if (spreads[i]) {
          // There can be multiple spreads. Their props override the props in this new object
          const tee = store.get(stack.pop());
          log('Prop', i, 'was a spread so copy the props of', tstr(tee.tid));

          // undefined and null are not errors here
          // string is the exception here since that will splat the string into numbered props. which we cant track. :(
          if (isPrimitive(tee.tid)) {
            // This case is unlikely but a noop, except for the string case, which we can't support and causes unsoundness
            if (tee.tid === 'string') {
              store.linter.check('OBJ_SPREAD_STRING', locFrom);
            }
          } else {
            // So how does this work in our model with forward updating props? I guess it works well. Hope I'm not wrong.
            ASSERT(tee.props);
            tee.props.forEach((tid, name) => {
              log('- copying', name, 'as', tstr(tid), 'for spreading');
              objTee.setProp(name, tid);
            });
          }
        } else {
          log('Adding', name, 'as', tstr(stack[stack.length - 1]));
          objTee.setProp(name, stack.pop());
        }
      });
      groupEnd();

      log('->', tstr(tid));
      stack.push(tid);
      break;
    }

    case '@of': {
      // Get the kind of the type on the stack
      // The stack type is the rhs of a for-of loop. Should be a proper iterable but for the moment we'll limit
      // ourselves to strings and arrays. TODO: improve coverage
      const tid = stack.pop();
      ASSERT_TID(tid);
      if (tid === 'string') {
        // Strings are iterable and iterate over each character as an individual string
        log('The kind of a', tstr('string'), 'is a string');
        stack.push('string');
      } else {
        const tee = store.get(tid);

        // TODO: map, set
        if (tee.type !== 'A' && tid !== 'string') {
          store.linter.check('FOR_OF_NON_ARRAY', locFrom);
          log('Pushing `undefined` as the "kind" of this non-array');
          stack.push('undefined');
        } else {
          log('The kind of', tstr(tid), 'is', tstr(tee.kind));
          stack.push(tee.kind);
        }
      }
      break;
    }

    case '@objrest': {
      const [excludedPropNames] = data;

      // Take the object from the stack and create a new, default, object that has all the owh properties of
      // this object, except those passed on in the `excludedPropNames` list. This is how object rest works.
      // (Note: this also does not seem to copy a `__proto__`, if it exists. This is part of the list already.)

      const objTid = stack.pop();
      log('Creating a rest object from the current object:', tstr(objTid), ', without these names:', excludedPropNames);

      const objTee = store.get(objTid);
      ASSERT(objTee);

      const newObjPropNames = [];
      const newObjPropTids = [];

      if (objTee.props) {
        objTee.props.forEach((tid, name) => {
          if (!excludedPropNames.includes(name)) {
            newObjPropTids.push(tid);
            newObjPropNames.push(name);
          }
        })
      } else if (objTid === 'undefined' || objTid === 'null') {
        store.linter.check('PROP_ON_NULL_UNDEF', locFrom);
      } else if (isPrimitive(objTid)) {
        store.linter.check('OBJ_REST_ON_PRIMITIVE', locFrom);
      } else {
        ASSERT(false, 'what is being spread here that as no props and is no primitive? null?', objTee); // TODO: array kind null
      }
      // For the sake of most-likely-to-break-lest; create an object object regardless

      const newObjTid = playActionObj(locFrom, store, undefined, stack, newObjPropNames, newObjPropTids);

      log('Rest result:', tstr(newObjTid));
      stack.push(newObjTid);

      break;
    }

    case '@param_binding': {
      const [name] = data;

      ASSERT(typeof name === 'string', 'name is a string, not a node', name);

      log('Setting param `' + name + '`');
      ASSERT(!closure.has(name), 'the param name should not yet be bound at this point', name, closure);

      const defaultValue = stack.pop();
      ASSERT_TID(defaultValue, NO_DEFAULT_VALUE);

      const argValue = stack.pop();
      ASSERT_TID(argValue);

      log('- Arg value is', tstr(argValue));
      log('- Default value:', tstr(defaultValue));

      // If there was no default then we don't need to do anything here
      if (defaultValue === NO_DEFAULT_VALUE) {
        log('This param has no default value, initialize param to whatever the arg value was');
        closure.set(name, argValue);
      } else if (argValue === 'undefined') {
        log('Overriding the binding with the default value');
        closure.set(name, defaultValue);
      } else {
        group('There was an explicit arg value so default value is not used here. Will do a test merge for linting purposes:');
        // TODO: this may need some more thought since `function f({X = 1} = {x: 'y'}) {}` is probably lintable with some careful code but is missed right now
        if (!testMerge(store, argValue, defaultValue)) {
          store.linter.check('UNUSED_DEFAULT_ARG_POLY', locFrom);
        }
        groupEnd();
        closure.set(name, argValue);
        log('Initialized `' + name + '` to', tstr(argValue));
      }

      const tokenIdent = getFirstToken(store, locFrom);
      const report = {wat: '#init', tid: closure.get(name), name};
      pushTlog(tokenIdent, report);

      break
    }

    case '@plus': {
      const [] = data;

      // The stack will contain two values

      const right = stack.pop();
      const left = stack.pop();
      if (left === 'string' && right === 'string') {
        log('A', tstr('string'), '+', tstr('string'), 'is a', tstr('string'));
        stack.push(left);
      } else if (left === 'number' && right === 'number') {
        log('A', tstr('number'), '+', tstr('number'), 'is a', tstr('number'));
        stack.push(left);
      } else if ((left === 'string' && right === 'number') || (right === 'string' && left === 'number')) {
        log('A', tstr(left), '+', tstr(right), 'is turning a number into a string');
        store.linter.check('PLUS_MERGE_NUM_STR', locFrom, left, right);
        // By far most likely this ends up a string
        stack.push('string');
      } else if ((left === 'string' && isPrimitive(right)) || (right === 'string' && isPrimitive(left))) {
        const nonString = left === 'string' ? right : left;
        log('A', tstr(left), '+', tstr(right), 'is turning a', tstr(nonString), 'into a string');
        store.linter.check('PLUS_MERGE_STR_PRIM', locFrom, left, right);
        // By far most likely this ends up a string
        stack.push('string');
      } else if ((left === 'number' && isPrimitive(right)) || (right === 'number' && isPrimitive(left))) {
        const nonString = left === 'number' ? right : left;
        switch (nonString) {
          case 'undefined':
            store.linter.check('PLUS_MERGE_NUM_UNDEF', locFrom, left, right);
            break;
          case 'null':
            store.linter.check('PLUS_MERGE_NUM_NULL', locFrom, left, right);
            break;
          case 'boolean':
            store.linter.check('PLUS_MERGE_NUM_BOOL', locFrom, left, right);
            break;
          case 'number':
          case 'string':
            return ASSERT(false);
          default:
            ASSERT(false, 'wat primitive?', nonString);

        }
        log('A', tstr(left), '+', tstr(right), 'is turning a', tstr(nonString), 'into a string');
        store.linter.check('PLUS_MERGE_STR_PRIM', locFrom, left, right);
        // By far most likely this ends up a string TODO: but it may not (with valueOf hacks)
        stack.push('string');
      } else {
        // TODO: we can improve these heuristics and support hacks where this still leads to a number. not worth much tho.
        log('A', tstr(left), '+', tstr(right), 'is bad and probably ends up as a', tstr('number'));
        store.linter.check('PLUS_MERGE_TYPE', locFrom, right, right);
        // By far most likely this ends up a string
        merge(locFrom, store, left, right);
        stack.push('string');
      }

      break;
    }

    case '@push': {
      const [tid] = data;
      stack.push(tid);
      break;
    }

    case '@regex': {
      const [] = data;

      const regexObjTid = playActionObj(locFrom, store, undefined, stack, ['__proto__'], ['RegExp.prototype']);
      stack.push(regexObjTid);

      break;
    }

    case '@return': {
      const [] = data;
      // TODO: validate this return value against all other return values, and possibly an implicit return value
      const tid = stack.pop();
      returns = tid;

      break;
    }

    case '@set': {
      const [name, tokenOpIndex] = data;
      ASSERT(typeof tokenOpIndex === 'number' && tokenOpIndex >= -1, 'tokenOp num', tokenOpIndex);

      const _objTid = stack.pop();
      const _valueTid = stack.pop();
      ASSERT_TID(_objTid);
      ASSERT_TID(_valueTid);
      const valueTid = store.final(_valueTid);
      const objTee = store.get(_objTid);
      const objTid = objTee.tid;

      if (tokenOpIndex >= 0) {
        const tokenOp = fileState.tokens[tokenOpIndex];
        ASSERT(tokenOp && tokenOp.tlog);
        tokenOp.tlog.push({wat: '#set', objTid, name, valueTid});
      }

      log('Assigning to property `' + name + '` on', tstr(objTid));
      log('- Current value is:', !isPrimitive(objTid) && objTee.props.has(name) ? tstr(objTee.props.get(name)) : '<does not have this prop>');
      log('- Seen before as:', isPrimitive(objTee.tid) ? '(irrelevant for primitive)' : objTee.seen.has(name) ? tstr(objTee.seen.get(name)) : '<not observed before>');
      log('- Value to assign:', tstr(valueTid));

      if (isPrimitive(objTid)) {
        if (objTid === 'null' || objTid === 'undefined') {
          store.linter.check('PROP_SET_ON_NULL_UNDEF', locFrom, name);
        } else {
          store.linter.check('PROP_SET_ON_PRIMITIVE', locFrom, name);
        }
        log('Ignoring the attempt to set property `' + name + '` to a ' + tstr(valueTid) + ' on a primitive value, as JS would');
        stack.push(valueTid); // JS does return the same value, not the resulting value
      } else {
        const prop = objTee.props.get(name);
        const saw = objTee.seen.get(name);

        if (objTee.props.has(name)) {
          if (name === 'prototype') {
            // This voids the sound-and-completeness :shrug:
            // By changing the .prototype you could in retrospect change the result of reading certain properties for
            // an arbitrary object (existing instances that inherit from this prototype). I think we can support this
            // in full at some point, like by tracking history of properties read on an object at any time.
            store.linter.check('SET_PROTOTYPE', locFrom);

            // TODO: object merge

            objTee.setProp('prototype', valueTid);
            stack.push(valueTid);
          } else if (name === '__proto__') {
            // This voids the sound-and-completeness :shrug:
            // Changing the __proto__ has a bunch of unforseen consequences that are currently ignored. So if you
            // ignore this lint, the onus is on you :)
            store.linter.check('SET_PROTO', locFrom);

            // TODO: object merge

            objTee.setProp('__proto__', valueTid);
            stack.push(valueTid);
          } else {
            log('Object already had this property, merging them');
            const tid = merge(locFrom, store, objTee.props.get(name), valueTid);
            stack.push(tid);
          }
        } else {
          // Note: the seen map still has to merge with the value so may still reject this `set` entirely
          log('Object did not have this property yet');
          if (objTee.seen.has(name)) {
            log('But have observed (seen) this before as a:', tstr(saw));
            // A little silly, but let's ignore assignments of `undefined` in this case.
            // Not likely to that case legit in the wild but no need to warn against it either.
            if (valueTid !== 'undefined') {
              store.linter.check('SET_NEW_BUT_SEEN_PROP', locFrom);
            }
          } else {
            store.linter.check('SET_NEW_UNSEEN_PROP', locFrom, name);
          }
          group('Now setting prop `' + name + '` to', tstr(valueTid));

          const resultTid = objTee.setProp(name, valueTid);
          ASSERT_TID(resultTid, 'each setProp should return the tid', resultTid);
          ASSERT(objTee.props.get(name) === resultTid, 'the prop should now have the returned tid', objTee.props.get(name), resultTid);
          stack.push(resultTid);
          groupEnd();
        }

        if (objTee.seen.has(name)) {

          // If prop === seen then we already did that merge above
          if (prop !== saw) {
            const before = objTee.seen.get(name);
            log('Previously observed this property to be:', tstr(before), 'merging it with the new value:', tstr(valueTid));
            const result = merge(locFrom, store, valueTid, before);
            ASSERT_TID(result);
            objTee.seen.set(name, String(result));
          }
          const tid = stack[stack.length - 1];
          ASSERT_TID(tid);
          objTee.seen.set(name, tid);
        } else {
          log('This property was not observed before. Marking it as observed now'); // TODO: we will probably want a read/write check as well, in which case we should skip this "observe" because it's only relevant when actually read.
          ASSERT_TID(valueTid);
          objTee.seen.set(name, valueTid);
        }

        log('-> prop=', tstr(objTee.props.get(name)), ', seen=', tstr(objTee.seen.get(name)), ', kind=', tstr(objTee.kind));
      }

      break;
    }

    case '@super_call': {
      const [argCount, spreadAt] = data;
      if (spreadAt !== -1) store.linter.check('TOFIX', locFrom, 'super spread');

      // Top of the stack is the `extends` value of the class to which the construct that contains this `super()`
      // belongs, followed by the arg+default pairs, first to last, arg goes first, default goes second

      const superClassTid = stack.pop();
      ASSERT_TID(superClassTid);
      if (superClassTid === 'null') {
        store.linter.check('SUPER_NULL', locFrom);
      }
      log('The `extends` value to use is:', tstr(superClassTid));

      const callArgs = argCount ? stack.slice(-argCount) : [];
      stack.length -= argCount;

      log('Arguments:', callArgs.map(tstr).join(', '));

      if (superClassTid === NO_SUPER_VALUE) {
        // The AST has no node for this meaning the class did not have an `extends` part, different from `extends null`
        store.linter.check('SUPER_CALL_WITHOUT_SUPER', locFrom);
      } else {
        const superClassTee = store.get(superClassTid);
        // TODO: validate that the tee is a valid constructor (not arrow, non-class-bind, builtin funcs, etc)

        // Top of the stack now ought to be the super() args in reverse order. There is no callee since we must manually
        // resolve the constructor function to call.

        // We must now call the constructor-function of the class that is being extended, which is available in the
        // `superClassTee` tee. The `super()` "production" is syntactically restricted to es6 class constructors, so at
        // least that's an invariant.
        // Using `superClassTee` we can go three ways:
        // - the value is not a constructor -> runtime error, already thrown above
        // - the value is an es5 class -> invoke it as a function
        // - the value is an es6 class -> dynamically resolve its constructor and invoke it
        // Context remains the same (ought to be an instance of the caller, subclass of the next callee

        let constructTid = superClassTid;

        if (isPrimitive(superClassTid)) {
          store.linter.check('SUPER_PRIMITIVE', locFrom);
          break;
        }

        // Class may be result of `.bind()`, but that does not change how `super()` resolves here
        if (superClassTee.funcType === 'class' || superClassTee.funcType.startsWith('class-')) {
          log('Resolving the constructor of an es6 class');
          const prototypeTid = superClassTee.props.get('prototype');
          log('.prototype.prototype:', tstr(prototypeTid));
          ASSERT(prototypeTid, 'es6 classes cannot have their prototype stripped');
          const prototypeTee = store.get(prototypeTid);
          ASSERT(prototypeTee, 'should exist');
          const constructorTid = prototypeTee.props.get('constructor');
          ASSERT(constructorTid, 'es6 classes must have a constructor, explicit or implicit', constructorTid);
          constructTid = constructorTid;
          log('.prototype.constructor:', tstr(constructorTid));
        } else {
          log('Value is not a class, calling it as an ES5 class');
        }

        log('Passing on the callerContext as-is:', tstr(callerContext));

        group('invoking now');
        const returnTid = metaCall(locFrom, constructTid, callerContext, true, stack, argCount, callArgs, spreadAt, store, superClassTid, store.instanceId, false);
        stack.push(returnTid);
        groupEnd();
      }

      break;
    }

    case '@super_prop': {
      const [] = data; // this action is supposed to push the value of `super` onto the stack. regular member expression happens based on that.

      // For classes and properties, the property is indirectly bound to the `<owner>.__proto__` where owner is the
      // prototype of a class or an object literal which in source code contained the method containing the super
      // property access. We had to use a special stack to track this because it's a runtime reference.

      const superPropOwnerTid = closure.superPropOwner;
      log('- owner:', tstr(superPropOwnerTid));
      ASSERT(superPropOwnerTid, 'The parser should restrict where super properties are allowed, causing an invariant where this must always be something');
      ASSERT_SUPER_PROP_OWNER(superPropOwnerTid);

      if (typeof superPropOwnerTid === 'number') {
        store.linter.check('SUPER_INVALID', locFrom);
        stack.push('undefined');
        break;
      }

      const superOwnerTee = store.get(superPropOwnerTid);
      ASSERT(superOwnerTee, 'must exist');

      log('superOwnerTee.funcType:', superOwnerTee.funcType);

      if (superOwnerTee.type === 'O') {
        log('Owner is an Object, resolve `owner.__proto__`');

        const protoTid = superOwnerTee.props.get('__proto__');
        log('- owner.__proto__:', tstr(protoTid));

        stack.push(protoTid);
      } else {
        log('Owner is a Class, resolve `owner.prototype`');

        const protoTid = superOwnerTee.props.get('prototype');
        log('- owner.prototype:', tstr(protoTid));

        // The protoTee is what we want to get properties from so that's what we'll leave on the stack
        stack.push(protoTid);
      }

      break;
    }

    case '@super_stack_push': {

      const [] = data;

      const objTid = stack.pop();

      ASSERT_TID(objTid, NO_SUPER_VALUE);
      store.superStack.push(objTid);

      log('super prop owner stack now:', store.superStack.map(tstr).join(', '));
      log('Stack now:', stack.map(tstr).join(', '));

      break;
    }

    case '@super_stack_pop': {
      const [] = data;

      stack.push(store.superStack.pop());

      log('super prop owner stack now:', store.superStack.map(tstr).join(', '));
      log('Stack now:', stack.map(tstr).join(', '));

      break;
    }

    case '@this': {
      const [] = data;

      ASSERT(locFrom.filename, 'filename should be known', locFrom);

      const tid = stack.pop();

      playActionBinding(locFrom, store, stack, closure, 'this', 'lex', tid);
      break;
    }

    default:
      log('todo: implement action:', action);
      ASSERT(false, 'need to implement action ' + action);
  }
  groupEnd();

  return returns;
}

function mapInput(store, tid, arr, map) {
  ASSERT(store);
  ASSERT_TID(tid);
  ASSERT(Array.isArray(arr), 'should receive an array to put tids into', arr);
  ASSERT(map instanceof Map, 'should receive a map for the reverse lookup', map);
  // Add the tid to the arr and its index to the map
  // Walk any properties and kinds, do the same.
  // Ignore builtins (TODO: should also ignore anything that's newer than the fence... but that'll only lead to unnecessary computation, I think of default args. No problem right now.)

  const tee = store.get(tid);
  if (tee.builtin) return; // We can ignore globals for this case
  if (map.has(tee.tid)) return; // the arr should contain unique tids
  const i = arr.length;
  arr.push(tee.tid);
  map.set(tee.tid, i); // Reverse lookup: <tid, index> -> key is tid and maps to arr index
  // Walk through props. It can't be a primitive (-> builtin) so it must have props
  tee.props.forEach(tid => mapInput(store, tid, arr, map));
  if (tee.type === 'A') {
    mapInput(store, tee.kind, arr, map);
  } else if (tee.type === 'S') {
    mapInput(store, tee.kind, arr, map);
  } else if (tee.type === 'M') {
    mapInput(store, tee.keyKind, arr, map);
    mapInput(store, tee.kind, arr, map);
  }

  // I don't think we need to care about anything else? bound stuff, functions, super?
}
function getSimpleState(store, tid, arr) {
  ASSERT(store);
  ASSERT_TID(tid);
  ASSERT(arr === null || Array.isArray(arr), 'arr should be an array or explicitly null', arr);

  const tee = store.get(tid);
  if (tee.builtin) {
    return {
      props: new Map,
      keyKind: undefined,
      valueKind: undefined,
      alias: null,
    };
  }
  ASSERT(isPrimitive(tee.tid) || tee.alias === null, 'should get unaliased tees here', tee.tid, tee);
  ASSERT(tee.alias === null || typeof tee.alias === 'object', 'tee.alias is null or a tee', tee);
  const details = {
    props: new Map(tee.props),
    keyKind: undefined,
    valueKind: undefined,
    alias: tee.alias,
  };
  if (tee.type === 'A') {
    details.valueKind = tee.kind;
  } else if (tee.type === 'S') {
    details.valueKind = tee.kind;
  } else if (tee.type === 'M') {
    details.keyKind = tee.keyKind;
    details.valueKind = tee.kind;
  }

  if (arr) arr.push(details);
  return details;
}
function getDelta(instanceFence, outputDetails, inputDetails, arrInputs, mapReversedInputs, allDeltaMutators) {
  // Properties are only added so we only need to check them one way
  ASSERT(typeof instanceFence === 'number', 'fence is an number', instanceFence);
  ASSERT(outputDetails && typeof outputDetails === 'object', 'outputDetails is a details object', outputDetails);
  ASSERT(inputDetails && typeof inputDetails === 'object', 'inputDetails is a details object', inputDetails);
  ASSERT(Array.isArray(arrInputs), 'inputDetails is an array', arrInputs);
  ASSERT(mapReversedInputs instanceof Map, 'mapReversedInputs is a map', mapReversedInputs);

  let mutators = [];
  outputDetails.props.forEach((addedTid, name) => {
    if (!inputDetails.props.has(name)) {
      // Add mutator
      mutators.push((store, tid, currentInputs) => {
        const tee = store.get(tid); // This is a "current call input tid"

        store.linter.suppress(true); // Should disable linting to prevent duplicate messages due to cloning
        const cachedTid = fencedCloneToolDebug(instanceFence, addedTid, store, new Map, arrInputs, mapReversedInputs, allDeltaMutators, currentInputs, false, '<cloning a prop for updating delta>');
        store.linter.suppress(false);

        tee.setProp(name, cachedTid);
      });
    }
  });

  if (outputDetails.keyKind !== undefined) {
    // Add mutator
    mutators.push((store, tid, currentInputs) => {
      const tee = store.get(tid); // This is a "current call input tid"

      store.linter.suppress(true); // Should disable linting to prevent duplicate messages due to cloning
      const cachedTid = fencedCloneToolDebug(instanceFence, outputDetails.keyKind, store, new Map, arrInputs, mapReversedInputs, allDeltaMutators, currentInputs, false, '<cloning the key kind for updating delta>');
      store.linter.suppress(false);

      tee.keyKind = cachedTid;
    });
  }

  if (outputDetails.valueKind !== undefined) {
    // Add mutator
    mutators.push((store, tid, currentInputs) => {
      const tee = store.get(tid); // This is a "current call input tid"

      store.linter.suppress(true); // Should disable linting to prevent duplicate messages due to cloning
      const cachedTid = fencedCloneToolDebug(instanceFence, outputDetails.valueKind, store, new Map, arrInputs, mapReversedInputs, allDeltaMutators, currentInputs, false, '<cloning the value kind for updating delta>');
      store.linter.suppress(false);

      // Same for array, map, and set (it finally pays off!)
      tee.kind = cachedTid;
    });
  }

  ASSERT(inputDetails.alias === null, 'the alias should not yet be set (always initialized to null)', inputDetails);
  ASSERT(outputDetails.alias === null || typeof outputDetails.alias === 'object', 'alias is a null or a tee', outputDetails);
  if (outputDetails.alias !== null) {
    // Add mmutator
    mutators.push((store, tid, currentInputs) => {
      const tee = store.get(tid); // This is a "current call input tid"

      store.linter.suppress(true); // Should disable linting to prevent duplicate messages due to cloning
      const cachedTid = fencedCloneToolDebug(instanceFence, outputDetails.alias.tid, store, new Map, arrInputs, mapReversedInputs, allDeltaMutators, currentInputs, false, '<cloning the alias for updating delta>');
      store.linter.suppress(false);

      // Same for array, map, and set (it finally pays off!)
      store.linkTo(tee, store.get(cachedTid)); // A little tricky :/
    })
  }

  return mutators;
}
function getDeltas(store, instanceFence, arrInputs, befores, mapReversedInputs) {
  ASSERT(store);
  ASSERT(typeof instanceFence === 'number', 'instance fence is a number', instanceFence);
  ASSERT(Array.isArray(arrInputs), 'arrInputs is an array', arrInputs);
  ASSERT(Array.isArray(befores), 'befores is an array', befores);
  ASSERT(mapReversedInputs instanceof Map, 'mapReversedInputs is a map', mapReversedInputs);

  // Find differences in props and kinds and return a list of callbacks that, given a store and tid, will apply the
  // delta to that tid as well (add properties / set kinds / set alias).
  const deltaMutators = [];
  for (let i=0; i<arrInputs.length; ++i) {
    const state = getSimpleState(store, store.final(arrInputs[i]), null);
    const mutators = getDelta(instanceFence, state, befores[i], arrInputs, mapReversedInputs, deltaMutators);
    deltaMutators.push(mutators);
  }
  return deltaMutators;
}
function scanInputs(store, tids) {
  const arrInputs = [];
  const mapReversedInputs = new Map;

  tids.forEach(tid => {
    mapInput(store, tid, arrInputs, mapReversedInputs);
  });

  const befores = []; // "simple" data structure with the relevant tids per tid: props, kinds. recursively (?)
  arrInputs.forEach(tid => getSimpleState(store, store.final(tid), befores));

  return {arrInputs, mapReversedInputs, befores};
}

export function metaCall(
  locFrom, // Filename with actual code that triggered this call (indirectly for stuff coming from builtins)
  calleeTid,
  contextTid,
  isNew,
  stack,
  initialArgCount,
  initialCallArgs,
  spreadAt,
  store,
  classTid,
  instanceFence,
  lambdaCallback, // For lambda callbacks; suppress lint errors if more args were passed than params and context for arrows
) {
  // Should not use the stack anymore. Args and context should be passed on explicitly.

  // The instanceFence is used to determine whether the returned value (recursively) should be cloned or returned as is.
  // The idea is that a reference that already existed before calling the current function is passed on, perhaps
  // indirectly (as a property for example) and when using a cached return value, should not be cloned.
  // If the value has a newer instance id then it was created during the call to this function and if we are to use
  // it from the cache, the returned tee should be cloned, recursively applying this heuristic to any properties or
  // other tees the cached tee may reference.
  // Functions and classes are tbd in this but I think can get the same treatment.

  log('metaCall(' + tstr(calleeTid) + ') with', initialArgCount, 'args, last arg' + (spreadAt>=0?'':' NOT')+' being a '+(spreadAt>=0?BOLD:'')+'spread'+RESET);
  ASSERT(locFrom && locFrom.filename, 'metaCall should have an origin, or the builtin placeholder', locFrom);

  log('Initial args: [', initialCallArgs.map(tstr).join(', '), ']');
  log('Resolving callee:', tstr(calleeTid));
  if (isNew) {
    log('This is `new` on', tstr(classTid));
    ASSERT(classTid, 'new should receive the classTid');
  }
  // Resolve tid
  const calleeTee = store.get(calleeTid);
  ASSERT(calleeTee);

  let tokenData;
  if (calleeTee.funcTokenIndex >= 0) {
    const funcTokenIndex = calleeTee.funcTokenIndex;
    const fromFilename = calleeTee.fromFilename;
    const funcToken = store.fileData.get(fromFilename).tokens[funcTokenIndex];
    ASSERT(funcToken.tlog, 'should be set in phase2', funcToken);
    tokenData = {
      wat: isNew ? '#new' : '#call',
      locFrom,
      inputArgTids: initialArgCount ? initialCallArgs.slice(0) : [],
      finalArgTids: undefined,
      paramTidDesc: calleeTee.builtin ? '<not tracked for builtins>' : calleeTee.paramNames.length ? undefined : '<none>', // map paramBindingNames to their resolved tids at the start of the call
      contextTid,
      spreadAt,
      returnValue: undefined,
    };
    funcToken.tlog.push(tokenData);
  }

  log('Callee tee.type:', calleeTee.type);
  if (calleeTee.type !== 'F' && calleeTee.type !== 'C') {
    store.linter.check('CALLED_UNCALLABLE', locFrom);
    log('Not a callable tee. Ignoring the call. Returning `undefined`');

    if (tokenData) {
      tokenData.finalArgTids = '<unchecked>';
      tokenData.returnValue = 'undefined';
    }

    return 'undefined';
  }

  // Each builtin handler should deal with arg count themselves
  // Rest param counts as a param too (just not as min required)
  const paramCount = calleeTee.builtin ? initialArgCount : calleeTee.paramNames.length;

  function fullDigest(color) {
    // log('Generating callee digest', tstr(calleeTid))
    const digestCallee = (isNew ? (color ? BOLD + 'new' + RESET + ' ' : 'new ') : '') + digest(calleeTid, store, color, false, true);
    // log('Generating args digest', [...initialCallArgs, ...new Array(paramCount).fill('undefined')].slice(0, paramCount).map(tstr).join(', '))
    const digestArgs = [...initialCallArgs, ...new Array(paramCount).fill('undefined')].slice(0, paramCount).map((tid, i) => digest(tid, store, color, true)).join(', ');
    // log('Generating context digest', tstr(contextTid))
    const digestContext = contextTid === 'global' ? (color ? tstr('G') : 'G') : digest(contextTid, store, color, true);
    // log('Generating super digest', tstr(classTid))
    const digestSuper = classTid && digest(classTid, store, color, true);

    // This was an attempt at creating a different digest but I think it only made things worse
    // const digestCallee = (isNew ? (color ? BOLD + 'new' + RESET + ' ' : 'new ') : '') + tidToString(calleeTid, store, true, -1);
    // // const digestCallee = (isNew ? (color ? BOLD + 'new' + RESET + ' ' : 'new ') : '') + digest(calleeTid, store, color, false, true);
    //
    // const digestArgs = [...initialCallArgs, ...new Array(paramCount).fill('undefined')].slice(0, paramCount).map(tid => tidToString(tid, store, true, -1)).join(',');
    // // const digestArgs = [...initialCallArgs, ...new Array(paramCount).fill('undefined')].slice(0, paramCount).map((tid, i) => digest(tid, store, color, true)).join(', ');
    //
    // const digestContext = contextTid === 'global' ? (color ? tstr('G') : 'G') : tidToString(contextTid, store, true, -1);
    // // const digestContext = contextTid === 'global' ? (color ? tstr('G') : 'G') : digest(contextTid, store, color, true);
    //
    // const digestSuper = classTid && tidToString(classTid, store, true, -1);
    // // const digestSuper = classTid && digest(classTid, store, color, true);

    return `${calleeTee.builtin ? (color ? YELLOW + 'G' + RESET : 'G') : calleeTee.parentClosure.digest(color)}  ${color?DIM:''}###${color?RESET:''}  ${digestCallee} :: [${digestArgs}] :: ${digestContext} :: ${digestSuper}`;
  }

  // const callDigestColor = fullDigest(true);

  const callDigest = fullDigest(false);
  log(YELLOW + 'Digest:' + RESET, callDigest);

  const hasRest = calleeTee.hasRest;

  const nettoArgCount = (calleeTee.boundParams ? calleeTee.boundParams.length : 0) + initialArgCount;
  if (!calleeTee.builtin && (nettoArgCount < calleeTee.minParamRequired) || (!lambdaCallback && !hasRest && nettoArgCount > paramCount)) {
    // Issue this before cache check because it will digest ignores arg count and makes no difference between `undefined` arg and implicit value
    store.linter.check('CALL_ARG_ARITY', locFrom);
  }

  const callCache = store.callCache;
  if (callCache.has(callDigest)) {
    const {cachedTid, cachedFence, arrInputs: cachedInputs, mapReversedInputs, deltaMutators, ...rest} = callCache.get(callDigest);
    const resolvedTee = store.get(cachedTid, true);
    const resolvedTid = resolvedTee.tid;

    if (resolvedTee.iid > calleeTee.cachedFence) store.linter.check('TOFIX', locFrom, 'I dont know what this means');

    log('Digest cached:', callDigest);
    log('Result:', tstr(cachedTid), '-->', tstr(resolvedTid));
    log(WHITE_BLACK + 'Returning cached call result!' + RESET);
    log('Closure has instance fence at:', cachedFence, ', cached return value has iid:', resolvedTee.builtin ? 'builtin' : resolvedTee.iid, 'so', cachedFence < resolvedTee.iid ? 'AM' : 'NOT', 'cloning the return value');
    // log('Cached artifacts:');
    // log('- cachedInputs:', cachedInputs.length > 20 ? '<big>' : cachedInputs);
    // log('- mapReversedInputs:', mapReversedInputs.size > 20 ? '<big>' : mapReversedInputs);
    // log('- deltaMutators:', deltaMutators.size > 20 ? '<big>' : deltaMutators);

    ASSERT(JSON.stringify(rest) === '{}');

    const currentInputs = [];
    [...initialCallArgs, contextTid].forEach(tid => mapInput(store, tid, currentInputs, new Map)); // We don't need the map

    // We need to clone the object, recursively for any object found that was created after the fence
    // Any object that was created before the fence needs to use the tid of the current call in the same position
    // That's what we use the arrInputs, mapReversedInputs, and deltaMutators for.

    store.linter.suppress(true); // Should disable linting to prevent duplicate messages due to cloning
    const returnedTid = fencedCloneTool(cachedFence, resolvedTee.tid, store, new Map, cachedInputs, mapReversedInputs, deltaMutators, currentInputs, 'for call cache');
    store.linter.suppress(false);

    log('Fenced clone:', tstr(returnedTid));

    if (tokenData) {
      tokenData.finalArgTids = '<cached>';
      tokenData.returnValue = returnedTid;
    }

    return returnedTid;
  }

  const pid = createPlaceholder(store, 'H', 'return value to represent return value for recursive calls');

  log('Not cached. Placeholder tid for cached call:', tstr(pid));
  callCache.set(callDigest, {
    cachedTid: pid,
    cachedFence: instanceFence,
    arrInputs: [],
    mapReversedInputs: new Map,
    deltaMutators: [],
  });

  // We should be able to keep the stack as is but we could add guards to prevent stack underflows. That's not
  // something that could be forced by bugs in user code but only through bugs in our code.
  const stackSizeBefore = stack.slice(0);
  log('Stack size before:', stackSizeBefore.length, ', stack:', stack.map(t => tstr(t)).join(', '));

  log('- Owner class:', tstr(classTid), [classTid]);
  log('- Owner class parent:', classTid ? tstr(store.get(classTid).superClass) : 'not a class');
  log('- Context:', tstr(contextTid));
  log('- superPropOwner:', tstr(calleeTee.superPropOwner), calleeTee.tid === '#constructor_with_super' ? '(dynamically resolved by default constructor)' : calleeTee.tid === '#constructor_sans_super' ? '(should not need it)' : ''); // undefined for the autogenerated default constructors
  log('- funcType:', calleeTee.funcType);
  log('- loc:', calleeTee.fromFilename + ':' + calleeTee.fromLine + ':' + calleeTee.fromColumn);
  log('- instanceFence:', instanceFence, ', store iid:', store.instanceId);

  ASSERT_SUPER_PROP_OWNER(calleeTee.superPropOwner);

  // Make the current closure that of the function itself (caller closure is irrelevant for the call)
  const newClosure = new Map;
  const closureFilename = calleeTee.fromFilename;
  const calleeClosure = {
    class: 'closure',
    type: 'call',
    digest(color) {
      return callDigest // color ? callDigestColor : callDigest;
    },
    get(name) { return newClosure.get(name); },
    set(name, tid) { return newClosure.set(name, tid); },
    has(name) { return newClosure.has(name); },
    str() {
      const arr = [];
      newClosure.forEach((tid, key) => arr.push(key + ':' + tstr(tid)));
      return (calleeTee.parentClosure ? calleeTee.parentClosure.str() + ' >> ' : '') + arr.join(', ');
    },
    find(name, locFrom) {
      ASSERT(typeof name === 'string', 'must find a name', name);
      ASSERT_LOC(locFrom);

      log('Looking for `' + name + '` in function scope');
      let closure = calleeClosure;
      do {
        log('checking:', closure.type);
        if (closure.has(name)) return closure.get(name);
        log('- Not found in ' + closure.type + ' closure, ' + (closure.parentClosure ? 'checking parent ' + closure.parentClosure.type + ' scope...' : 'has no parent scope so this is an error'));
        closure = closure.parentClosure;
      } while (closure);

      store.linter.check('USED_BINDING_BEFORE_DECL', locFrom, name);
      log('Marking `' + name + '` as an implicit global in', closureFilename);
      store.fileData.get(closureFilename).implicitGlobals.add(name);
      newClosure.set(name, 'undefined'); // I guess
      return 'undefined'; // Let it poly out
    },
    parentClosure: calleeTee.parentClosure,
    superPropOwner: calleeTee.superPropOwner,
    instanceFence, // Any iid higher than this was created after this closure
    calleeTid,
    filename: closureFilename,
  };

  log('- Local scope:', calleeClosure.str());

  if (calleeTee.builtin) {
    group('Calling a builtin [' + tstr(calleeTee.tid) + ']:');
    if (calleeTee.boundContext) store.linter.check('TOFIX', locFrom, 'do we need to resolve bound context/params before going into');
    if (calleeTee.boundParams) store.linter.check('TOFIX', locFrom, 'do we need to resolve bound context/params before going into');

    // Record details of the inputs before going into the builtin. In this case we have to check all the args, as is.
    const {arrInputs, mapReversedInputs, befores} = scanInputs(store, [...initialCallArgs, contextTid]);

    const updateTo = calleeTee.builtinCode(locFrom, calleeTee, contextTid, initialArgCount, initialCallArgs, spreadAt, stack, store, calleeClosure, isNew, classTid);

    // Now record any changes to the input tids for posterity. And to replay them on cached calls.
    const deltaMutators = getDeltas(store, instanceFence, arrInputs, befores, mapReversedInputs);

    log('Merging', tstr(updateTo), 'to the call placeholder', tstr(pid), 'after calling a builtin');
    merge(locFrom, store, updateTo, pid);

    if (updateTo) {
      group('Making sure the cache gets a fenced clone for', tstr(updateTo), 'in case the instance was generated _inside_ the builtin call');
      // We need to make sure the cache retains a copy of the object "as it was returned", such that later mutations are
      // not reflected by the copy if it was created during the call. For instances that were created before the call,
      // those should be shared by reference since they are closures (globals/builtins are closures too, in a way)
      // If `updateTo` is `undefined` and not a tid then we skip this step... TODO

      let cachedTid = updateTo;
      if (!isPrimitive(cachedTid)) {
        store.linter.suppress(true); // Should disable linting to prevent duplicate messages due to cloning
        cachedTid = fencedCloneToolDebug(instanceFence, updateTo, store, new Map, arrInputs, mapReversedInputs, deltaMutators, arrInputs, true, '<cloning returned value for call cache>');
        store.linter.suppress(false);
      }

      log('Updating call cache for', tstr(cachedTid),':');
      // log('- cachedFence:', instanceFence);
      // log('- cachedInputs:', arrInputs)
      // log('- mapReversedInputs:', mapReversedInputs);
      // log('- deltaMutators:', deltaMutators);

      callCache.set(callDigest, {
        cachedTid,
        cachedFence: instanceFence,
        arrInputs,
        mapReversedInputs,
        deltaMutators,
      });

      groupEnd();
    }

    if (tokenData) {
      tokenData.finalArgTids = '<builtin>';
      tokenData.returnValue = updateTo;
    }

    groupEnd();
    return updateTo;
  }

  if (calleeTee.funcExprName) {
    log('Initializing the func expr name `' + calleeTee.funcExprName + '` to ', tstr(calleeTid));
    newClosure.set(calleeTee.funcExprName, calleeTid);
  }

  ASSERT(typeof calleeTee.thisAccess === 'boolean', 'callables have this');
  // It's easy and often benign to trigger this lint (member expression) so let's not for now
  // if (!isNew && !calleeTee.thisAccess && contextTid !== 'undefined' && contextTid !== 'global') {
  //   store.linter.check('CONTEXT_NO_THIS', locFrom);
  // }
  if (calleeTee.thisAccess && contextTid === 'undefined') {
    store.linter.check('CONTEXT_MISSING', locFrom);
  }
  if (!lambdaCallback && calleeTee.funcType === 'arrow' && contextTid !== 'undefined') { // Note: if context is global it must be explicit
    store.linter.check('ARROW_WITH_CONTEXT', locFrom);
  }

  const contextTee = store.get(contextTid);
  ASSERT(contextTee);

  // Get actions for that function
  const actions = calleeTee.body;

  log('- Param count:', paramCount, ', last rest?', hasRest, ', arg count:', initialArgCount, ', bound arg count:', (calleeTee.boundParams ? calleeTee.boundParams.length : 0), ', min args expected:', calleeTee.minParamRequired);
  log('- Args: [', initialCallArgs.map(tstr).join(', '), ']', spreadAt < 0 ? ', without spread' : ', with spread at arg' + spreadAt);
  log('- Bound args:', (calleeTee.boundParams ? calleeTee.boundParams.map(tstr).join(', ') : '<none>'));

  const args = [];

  if (calleeTee.boundParams) {
    calleeTee.boundParams.forEach(tid => args.push(tid));
  }
  initialCallArgs.forEach(tid => args.push(tid));
  log('Concrete args before pruning ->', args.map(tstr).join(', '));
  args.forEach(a => ASSERT_TID(a));

  if (spreadAt >= 0) {
    group('spread arg');
    ASSERT(spreadAt === args.length - 1, 'the model should only allow to pass through a spread into call args when its the last arg', spreadAt, args);
    log('Check if the arg position of the spread starts at least _after_ all non-rest params.');
    log('Spread is at', spreadAt, ', param count:', paramCount, ', is last rest param?', hasRest);

    if (spreadAt < (paramCount - 1)) {
      store.linter.check('SPREAD_BEFORE_REST', locFrom);
      // That said, we can sure assume that it worked as it might
      // Take the spread arg from the list, pad the args to match the param list (also cover the rest param because why not)
      const spreadArg = args.pop();
      log('Mapping the array being spread onto any remaining uncovered param, acting as if they were all given a', tstr(spreadArg));
      while (args.length < paramCount) args.push(spreadArg);
      log('The new args after extrapolating the spreaded arg:', args.map(tstr).join(', '));
    }

    groupEnd();
  }

  log('Final call args before trimming/padding:', args.map(tstr).join(', '));

  if (hasRest) {
    group('Rest');
    log('This has a rest');
    log('- initialArgCount:', initialArgCount);
    log('- args.length:', args.length);
    log('- params:', calleeTee.paramNames.length);
    log('- excess args to merge into rest:', args.slice(calleeTee.paramNames.length - 1));

    if (calleeTee.paramNames.length <= args.length) {
      // The last param is a rest. Create an array for the rest. Merge any param in excess of the (param count - 1) to
      // the kind of the rest.
      let kind = args.pop();
      ASSERT_TID(kind);

      log('Merging excess args with the rest param');
      while (args.length >= calleeTee.paramNames.length) {
        ASSERT_TID(args[args.length - 1]);
        kind = merge(locFrom, store, kind, args.pop());
      }

      // Put the rest-kind into the arg position. The restAt parameter will cause the func to interpret that
      // arg as the rest-kind, so no need to create an array with it here.
      args.push(kind);

      log('Setting rest param kind to', tstr(kind));
    }
    groupEnd();
  }

  if (paramCount !== args.length) {
    // Well that's awkward. Either we need to drop args or pad args.

    // todo: de arg filler kijkt naar param count maar moet special casen voor rest param. niet zomaar undefined maar een leeg array

    if (paramCount > args.length) {
      log('Function actually has', paramCount, 'params and we end up with', args.length, 'args, so padding the rest with `undefined`');
      // There are more params than args passed on. Pad the remaining params with `undefined`. (TODO: arg defualts?)
      while (args.length < paramCount) {
        log('- appending `undefined`');
        args.push('undefined');
      }
      if (hasRest) {
        // Create an empty array
        const pid = createPlaceholder(store, 'HRA', 'function rest param without args to cover them');
        args[args.length - 1] = pid;
      }
    } else if (paramCount < args.length) {
      log('Function only has', paramCount, 'params and we end up with', args.length, 'args, so trimming the excess');
      // There are fewer params than args passed on. Drop all args that can not be mapped to a param because we
      // can't inspect them anyways and as such they're irrelevant to the model.
      while (args.length > paramCount) {
        args.pop();
      }
    } else {
      ASSERT(false);
    }
  } else {
    log('Number of args was equal to the number of params');
  }

  log('Final call args:', args.map(tstr).join(', '));

  // Put the normalized arg list back onto the stack (in reverse order!)
  for (let i=args.length - 1; i>=0; --i) {
    stack.push(args[i]);
  }

  if (tokenData) {
    tokenData.finalArgTids = args.slice(0);
  }

  // Push context to use for this call. All function bodies should start with a @binding of `this` and setup of `arguments`
  ASSERT(actions.length, 'should at least setup this/arguments to consume the context on the stack');
  log('The context of this call is:', tstr(contextTid));
  stack.push(contextTid);

  const {arrInputs, mapReversedInputs, befores} = scanInputs(store, [...args, contextTid]);

  const indentBefore = getIndent();

  // Replay (recursively)
  group('Start of ' + actions.length + ' playActions() (stack.length=' + stack.length + ', initialArgCount=' + initialArgCount + ', args.length=' + args.length + ', top of stack is context. Stack: [ ' + stack.map(tstr).join(', ') + ' ])');
  const returnedTid = playActions(locFrom, store, actions, calleeTee, contextTid, calleeClosure, stack);
  groupEnd();

  log('Stack size after:', stack.length, ', expecting it to be', stackSizeBefore.length, ', stack: [', stack.map(t => tstr(t)).join(', '), ']');
  ASSERT(indentBefore === getIndent(), 'group()/groupEnd() indentation changed. fixme');

  // The call should pop for each param it has and once for context
  ASSERT(stackSizeBefore.length === stack.length, 'should only pop param count and not change the stack otherwise (return value is pushed after this assert)', 'before:', stackSizeBefore, 'after:', stack);

  // TODO: fix this. this will be bad for references, mutations of args, and a whole lot of other things. (same for builtin path)
  let updateTo = isNew && isPrimitive(returnedTid) ? contextTid : returnedTid;

  // If we return a cached call result then for every tid that existed before the call (instance fence) find its index
  // and apply the delta to the tid of the current call. If any.
  const deltaMutators = getDeltas(store, instanceFence, arrInputs, befores, mapReversedInputs);

  if (updateTo === pid) {
    store.linter.check('INFINITE_RECURSION_MAYBE', locFrom);
    log('Infinite recursion detected... I think?');
  } else {

// fixme
    const arrOutput = [];
    const mapReversedOutput = new Map;
    mapInput(store, updateTo, arrOutput, mapReversedOutput);


    log('Merging', tstr(updateTo), 'to placeholder', tstr(pid));
    merge(locFrom, store, updateTo, pid);

    if (updateTo) {
      // We need to make sure the cache retains a copy of the object "as it was returned", such that later mutations are
      // not reflected by the copy if it was created during the call. For instances that were created before the call,
      // those should be shared by reference since they are closures (globals/builtins are closures too, in a way)
      // If `updateTo` is `undefined` and not a tid then we skip this step... TODO

      group('Making sure the cache gets a fenced clone for', tstr(updateTo), 'in case the instance was generated _inside_ the call');
      store.linter.suppress(true); // Should disable linting to prevent duplicate messages due to cloning
      const cachedTid = fencedCloneToolDebug(instanceFence, updateTo, store, new Map, arrInputs, mapReversedInputs, deltaMutators, arrInputs, true, '<cloning returned value for call cache>');
      store.linter.suppress(false);

      log('Updating call cache for', tstr(cachedTid),':');
      // log('- cachedFence:', instanceFence);
      // log('- cachedInputs:', arrInputs)
      // log('- mapReversedInputs:', mapReversedInputs);
      // log('- deltaMutators:', deltaMutators);

      callCache.set(callDigest, {
        cachedTid,
        cachedFence: instanceFence,
        arrInputs,
        mapReversedInputs,
        deltaMutators,
      });
      groupEnd();
    }
  }

  if (tokenData) {
    tokenData.returnValue = updateTo;
  }

  log('Function call returned:', tstr(updateTo));

  return updateTo;
}

export function playActionArr(locFrom, store, tid = createArrayTid(store), stack, kind) {
  // There ought to be elementCount values on the stack to be the kind of this array
  // Store ought to be global (but I may want to reconsider my choice of putting the uid counter in there...)

  ASSERT_TID(kind);
  const props = new Map([
    ['__proto__', 'Array.prototype'],
  ]);
  store.set(tid, {
    _class: 'arr',
    _clone: '#',
    tid,
    type: 'A',
    kind,
    iid: ++store.instanceId,
    props,
    setProp(name, tid) { this.props.set(name, tid); return tid; },
    seen: new Map(props),
    alias: null,
    locFrom,
    fencedClone(fence, recur = new Map, debugDesc, arrInputs, mapReversedInputs, deltaMutators, currentInputs) {
      const tid = store.final(this.tid);
      // if (root) fenceStart(tid, store);
      group('arr.fencedClone(' + fence + ', ' + debugDesc + ')');

      let ctid = recur.get(tid);
      if (ctid) {
        log('This tid is part of a recursive type. Using the fenced clone that was already generated for this tid:', tstr(ctid));
      } else {
        // Pre-generate the array tid to create so we can put it in the recur cache. Prevents `a=[]; a[0]=a` problems
        ctid = createArrayTid(store);
        recur.set(tid, ctid);

        const kind = store.final(this.kind);
        if (kind !== this.kind) log('The kind of', tstr(tid), 'is', tstr(this.kind),', which is aliased to', tstr(kind));
        const clonedKind = fencedCloneTool(fence, kind, store, recur, arrInputs, mapReversedInputs, deltaMutators, currentInputs, 'fetch kind');

        playActionArr(locFrom, store, ctid, stack, clonedKind);

        log('Clone1 the props into the cloned array');
        const ctee = store.get(ctid);
        ctee.props = new Map([...this.props.entries()].map(([key, value]) => [key, fencedCloneTool(fence, value, store, recur, arrInputs, mapReversedInputs, deltaMutators, currentInputs, debugDesc)]));
      }

      log('</arr.fencedClone>');
      groupEnd();
      return ctid;
    },
  });

  return tid;
}

function playActionBinding(locFrom, store, stack, closure, name, kind, tid) {
  log('- Set `' + name + '` to', tstr(tid), 'of type', kind);

  const fileState = store.fileData.get(locFrom.filename);

  const tokenIdent = getFirstToken(store, locFrom);
  let tokenOp = fileState.tokens[tokenIdent.n + 1];

  while (tokenOp && (Tenko.isWhiteToken(tokenOp.type))) tokenOp = fileState.tokens[tokenOp.n + 1];

  const report = {wat: '#init', tid, name};
  pushTlog(tokenIdent, report);
  if (tokenOp.str === '=') pushTlog(tokenOp, report);

  if (kind === 'var' && closure.has(name)) {
    const mtid = merge(locFrom, store, tid, closure.get(name));
    closure.set(name, mtid);
  } else {
    /*
      // Happens at least for this case
      function shadowedFunction(){
        let shadowedFunction = 1;
        shadowedFunction === 'str'; // fail
      }
      shadowedFunction();
     */
    ASSERT(!closure.has(name) || fileState.implicitGlobals.has(name), 'either the binding already didnt exist or its lex and it shouldnt exist yet or it was already reported as an implicit global', name, kind, closure, fileState.implicitGlobals, fileState.filename, closure.filename);
    closure.set(name, tid);
  }
}

export function playActionClass(locFrom, store, tid = createClassTid(store), stack, nid, className, staticMethods, closure, userDesc, prototypeTid, superClassTid) {
  // Top of stack should be prototype object, then super class, then in source code order (static and instance mixed) the methods

  log('The class prototype tid:', tstr(prototypeTid));
  const prototypeTee = store.get(prototypeTid);

  log('This class extends:', tstr(superClassTid), typeof superClassTid === 'string' ? '' : '(-> ' + tstr('Function.prototype') + ')');
  ASSERT_TID(superClassTid, NO_SUPER_VALUE);
  const superClassTee = superClassTid === NO_SUPER_VALUE ? null : store.get(superClassTid);

  ASSERT(!superClassTee || (!prototypeTee.builtin && !prototypeTee.prototypeOf), 'i think, or fixme', prototypeTee);
  prototypeTee.prototypeOf = tid;

  if (superClassTid !== NO_SUPER_VALUE) {
    // At definition time the super class must be a constructor with a .prototype property that exists with an object
    if (superClassTid === 'null') {
      store.linter.check('EXTENDS_NULL', locFrom);
    } else if (isPrimitive(superClassTee)) {
      // This is a runtime error but my model doesn't care much
      store.linter.check('EXTENDS_PRIMITIVE', locFrom);
    } else {
      const prototypeTid = superClassTee.props.get('prototype');
      if (prototypeTid === undefined) {
        store.linter.check('EXTENDS_NO_PROTO', locFrom);
      } else if (prototypeTid !== null && prototypeTid !== 'null') { // null is okay here! Object has null, for example. You can extend Object. You do.
        if (isPrimitive(prototypeTid)) {
          store.linter.check('EXTENDS_BAD_PROTO', locFrom);
        }
      }
    }
  }

  // If this class extends then set __proto__ to its .prototype. If it does not extend, set it to Object.prototype
  const protoTid = superClassTid !== NO_SUPER_VALUE && superClassTee.props ? superClassTee.props.get('prototype') : 'Object.prototype';
  if (protoTid === undefined) {
    log('Not setting a `prototype.__proto__` property because there was no prototype at all');
  } else {
    log('Setting the .prototype.__proto__ (on ' + tstr(prototypeTid) + ') of the class to:', tstr(protoTid));
    // ASSERT(prototypeTee.props.get('__proto__') === 'Object.prototype' || prototypeTee.props.get('__proto__') === protoTid, 'keeps default value, or in case of a clone, already set to target value', prototypeTee.props.get('__proto__'));
    prototypeTee.setProp('__proto__', protoTid);
  }

  log('Static method entries:', staticMethods);

  const props = new Map([
    ['prototype', prototypeTid],
    ['__proto__', superClassTid === NO_SUPER_VALUE ? 'Function.prototype' : superClassTid],
    ...staticMethods,
  ]);

  store.set(tid, {
    _class: 'funco',
    _type: 'class',
    _name: className,
    _clone: '#',
    tid,
    type: 'C',
    iid: ++store.instanceId,
    paramNames: [], // not used
    minParamRequired: -1,
    body: [], // not used
    funcType: 'class',
    ownerClass: tid, // Used for bound class to be able to resolve the original class
    superClass: superClassTid,
    funcExprName: '', // not used
    thisAccess: false, // not used
    superPropOwner: SUPER_PROP_OWNER_NOT_FOR_CLASS,
    parentClosure: closure, // not used
    props,
    setProp(name, tid) { this.props.set(name, tid); return tid; },
    seen: new Map(props),
    alias: null,
    userDesc, // For reporting to the user what kind of value this is ("the class named A starting at x,y")
    locFrom,
    fencedClone(fence, recur = new Map, debugDesc, arrInputs, mapReversedInputs, deltaMutators, currentInputs) {
      const tid = store.final(this.tid);
      // if (root) fenceStart(tid, store);
      group('class.fencedClone(' + fence + ', ' + debugDesc + ')');

      let ctid = recur.get(tid);
      if (ctid) {
        log('This tid is part of a recursive type. Using the fenced clone that was already generated for this tid:', tstr(ctid));
      } else {
        // Pre-generate the array tid to create so we can put it in the recur cache. Prevents `a=[]; a[0]=a` problems
        ctid = createClassTid(store);
        recur.set(tid, ctid);

        const superClassTidClone = superClassTid === NO_SUPER_VALUE ? NO_SUPER_VALUE : fencedCloneTool(fence, superClassTid, store, recur, arrInputs, mapReversedInputs, deltaMutators, currentInputs, 'superClass(' + debugDesc + ')');
        const prototypeTidClone = fencedCloneTool(fence, prototypeTid, store, recur, arrInputs, mapReversedInputs, deltaMutators, currentInputs, 'prototype(' + debugDesc + ')');

        playActionClass(locFrom, store, ctid, stack, nid, className, [], closure, this.userDesc, prototypeTidClone, superClassTidClone);

        // The concept of a class, initially, does not change (I hope...). So we only need to clone the props.
        const ctee = store.get(ctid);
        ASSERT(ctee, 'should have a class tee now?', ctid, ctee);
        log('Clone2 the props into the cloned function');
        ctee.props = new Map([...this.props.entries()].map(([key, value]) => [key, fencedCloneTool(fence, value, store, recur, arrInputs, mapReversedInputs, deltaMutators, currentInputs, debugDesc)]));
      }

      log('</class.fencedClone>');
      groupEnd();
      return ctid;
    },
  });

  log('->', tstr(tid));
  return tid;
}

export function playActionFunc(locFrom, {
  store,
  tid = createFuncoTid(store),
  stack,
  closure,
  callerContext,
  nid,
  funcName,
  paramNames,
  paramBindingNames,
  hasRest,
  minParamRequired,
  body,
  funcType,
  thisAccess,
  reachableNames,
  ownerClass,
  superClass = NO_SUPER_VALUE,
  boundContext,
  boundParams,
  funcTokenIndex = -1,
  fromFilename,
  fromColumn,
  fromLine,
  userDesc,
  useProps = false,
  ...rest
}) {
  // Note: this function assumes an superOwner was pushed onto the superStack before this calle (!)
  ASSERT(['decl', 'expr', 'method', 'decl-bound', 'expr-bound', 'method-bound', 'class-bound', 'arrow'].includes(funcType), 'funcType is an enum', funcType);
  ASSERT(JSON.stringify(rest) === '{}', 'should not receive additional args', rest);

  log(
    'playActionFunc(locFrom, {store, tid:', tstr(tid),', stack, closure, callerContext:',tstr(callerContext),', nid:', [nid], ', funcName: ', [funcName],
    ', paramNames: [', paramNames.join(', '), '], paramBindingNames: [', paramBindingNames.join(', '), '], hasRest: ', hasRest, ', minParamRequired:', minParamRequired,
    ', body, funcType:', funcType, ', thisAccess:', thisAccess, ', ownerClass:', tstr(ownerClass),
    ', funcTokenIndex:', funcTokenIndex, ', fromFilename:', fromFilename, ', userDesc)'
  );

  if (ownerClass === undefined) {
    // new (f.bind())() should still create a new instance of this function, even though a bound function has no prototype
    ownerClass = tid;
  }

  let superPropOwner = SUPER_PROP_OWNER_NOT_A_METHOD;
  if (funcType.startsWith('method')) {
    ASSERT(store.superStack.length > 0, 'the owner parent class of the method should be pushed onto the stack before this call');
    superPropOwner = store.superStack[store.superStack.length - 1];
  }

  let props;
  if (useProps) {
    group('Using props that were passed on');
    props = useProps;
  } else {
    group('Creating the fresh prototype object to use with this function instance');

    // Note: column+1 to make the locFrom different than the funco for digest recursion checks... I may come to regret this
    const protoTid = playActionObj({filename: fromFilename, column: fromColumn + 1, line: fromLine}, store, undefined, stack, [], [])

    props = new Map([
      ['prototype', protoTid],
      ['__proto__', 'Function.prototype'],
    ]);
  }

  groupEnd();

  log('- prototype:', tstr(props.get('prototype')));
  log('- __proto__:', tstr(props.get('__proto__')));
  log('- superPropOwner:', tstr(superPropOwner));

  ASSERT_SUPER_PROP_OWNER(superPropOwner);
  const tee = {
    _class: 'funco',
    _type: '@',
    _clone: '#',
    tid,
    type: 'F',
    iid: ++store.instanceId,
    nid, // uniquely describes this function body (for digest)
    paramNames, // Only names of ident params, ignores patterns, are not "unique" in case that matters
    paramBindingNames, // All names bound through params, includes both patterns and idents, should be "unique"
    hasRest,
    minParamRequired,
    boundContext, // May be undefined
    boundParams, // May be undefined
    body,
    funcType,
    ownerClass,
    superClass,
    funcExprName: funcType === 'expr' || funcType.startsWith('method') ? funcName : '',
    thisAccess,
    reachableNames, // All binding names reachable from this function, excluding underlying shadows/this/arguments. Used for digest.
    superPropOwner,
    parentClosure: closure,
    props,
    setProp(name, tid) { this.props.set(name, tid); return tid; },
    seen: new Map(props),
    alias: null,
    userDesc,
    funcTokenIndex,
    fromFilename,
    fromColumn,
    fromLine,
    locFrom: {filename: fromFilename, column: fromColumn, line: fromLine},
    fencedClone(fence, recur = new Map, debugDesc, arrInputs, mapReversedInputs, deltaMutators, currentInputs) {
      const tid = store.final(this.tid);
      // if (root) fenceStart(tid, store);
      group('func.fencedClone(' + fence + ', ' + debugDesc + ')');

      ASSERT_SUPER_PROP_OWNER(superPropOwner);

      // We don't need to clone the actual function stuff. That's immutable (I hope...). But we do need to clone the props on the func.

      let ctid = recur.get();
      if (recur.has(tid)) {
        log('This tid is part of a recursive type. Using the fenced clone that was already generated for this tid:', tstr(ctid));
      } else {
        // Pre-generate the array tid to create so we can put it in the recur cache. Prevents `a=[]; a[0]=a` problems
        ctid = createFuncoTid(store);
        recur.set(tid, ctid);

        if (funcType.startsWith('method')) {
          store.superStack.push(superPropOwner);
        }
        playActionFunc(locFrom, {
          store,
          tid: ctid,
          stack,
          closure,
          callerContext,
          nid,
          funcName,
          paramNames,
          paramBindingNames,
          hasRest,
          minParamRequired,
          body,
          funcType,
          thisAccess,
          reachableNames,
          ownerClass,
          superClass,
          boundContext,
          boundParams,
          funcTokenIndex,
          fromColumn,
          fromLine,
          fromFilename,
          userDesc,
        });
        if (funcType.startsWith('method')) {
          store.superStack.pop();
        }

        log('Clone3 the props into the cloned function');
        const ctee = store.get(ctid);
        ctee.props = new Map([...this.props.entries()].map(([key, value]) => [key, fencedCloneTool(fence, value, store, recur, arrInputs, mapReversedInputs, deltaMutators, currentInputs, debugDesc)]));
      }

      log('</func.fencedClone>');
      groupEnd();
      return ctid;
    },
  };

  store.set(tid, tee);
  log('->', tstr(tid));
  return tid;
}

export function playActionKind(locFrom, store, stack, arrTid) {
  ASSERT(arrTid, 'should be something on the stack');
  const tee = store.get(arrTid);
  ASSERT(tee, 'should lead to a tee');

  let kind = 'undefined';
  if (tee.type === 'A') {
    ASSERT_TID(tee.kind);
    const kindTee = store.get(tee.kind);
    if (kindTee.type === 'H') {
      // What if the read is from a spread? In that case we don't care about this ...
      store.linter.check('ARRAY_KIND_READ_BUT_UNDET', locFrom);
      log('Setting the kind of this array to', tstr('undefined'), 'because it was undetermined while being queried');
      store.linkTo(kindTee, store.get('undefined'));
      tee.kind = 'undefined';
    } else {
      kind = tee.kind;
    }
  } else {
    store.linter.check('ARRAY_KIND', locFrom);
  }
  log('Array:', tstr(arrTid), '--> kind:', tstr(kind));

  return kind;
}

export function playActionMap(locFrom, store, tid = createMapTid(store), stack, keyKind, valueKind) {
  // There ought to be 2 values on the stack to be the kind of this map; top is value kind, second is key kind
  // Store ought to be global (but I may want to reconsider my choice of putting the uid counter in there...)

  log('Creating Map instance with key kind =', tstr(keyKind), ' and value kind =', tstr(valueKind), 'as', tstr(tid));
  ASSERT_TID(keyKind);
  ASSERT_TID(valueKind);
  const props = new Map([
    ['__proto__', 'Map.prototype'],
  ]);
  store.set(tid, {
    _class: 'map',
    _clone: '#',
    tid,
    type: 'M',
    keyKind,
    kind: valueKind, // When looking up the kind of an iterable, maps return their value kind, so make the `kind` key that of value
    iid: ++store.instanceId,
    props,
    setProp(name, tid) { this.props.set(name, tid); return tid; },
    seen: new Map(props),
    alias: null,
    locFrom,
    fencedClone(fence, recur = new Map, debugDesc, arrInputs, mapReversedInputs, deltaMutators, currentInputs) {
      const tid = store.final(this.tid);
      // if (root) fenceStart(tid, store);
      group('map.fencedClone(' + fence + ', ' + debugDesc + ')');

      let ctid = recur.get(tid);
      if (ctid) {
        log('This tid is part of a recursive type. Using the fenced clone that was already generated for this tid:', tstr(ctid));
      } else {
        // Pre-generate the array tid to create so we can put it in the recur cache. Prevents `a=[]; a[0]=a` problems
        ctid = createMapTid(store);
        recur.set(tid, ctid);

        const keyArg = fencedCloneTool(fence, keyKind, store, recur, arrInputs, mapReversedInputs, deltaMutators, currentInputs, 'kind');
        const valueArg = fencedCloneTool(fence, valueKind, store, recur, arrInputs, mapReversedInputs, deltaMutators, currentInputs, 'kind');

        playActionMap(locFrom, store, ctid, stack, keyArg, valueArg);

        log('Clone6 the props into the cloned array');
        const ctee = store.get(ctid);
        ctee.props = new Map([...this.props.entries()].map(([key, value]) => [key, fencedCloneTool(fence, value, store, recur, arrInputs, mapReversedInputs, deltaMutators, currentInputs, debugDesc)]));
      }

      log('</map.fencedClone>');
      groupEnd();
      return ctid;
    },
  });

  return tid;
}

export function playActionNew(locFrom, store, stack, spreadAt, wrapperClassTid, argTids) {
  // Top of stack ought to be the function to be called, followed by the args in order

  // A `new` is similar to a call except it has special rules for context and the return value
  // In addition, certain things can only be `new`ed, only be `call`ed, and some can be both.

  // Args are same as for regular function (arg+default pairs)

  log('Stack at start of @new:', stack.map(tstr).join(', '));

  // The context is created before the call so we need to log the instance fence here
  const instanceFence = store.instanceId;

  log('Stack has this wrapper tid to `new` on:', tstr(wrapperClassTid));
  const wrapperClassTee = store.get(wrapperClassTid);
  log('Type of callee:', BOLD + wrapperClassTee.funcType + RESET, ', owner class:', tstr(wrapperClassTee.ownerClass));

  // Unwrap the class in case it was bound (pretty much a noop otherwise, but good to be consistent)
  // This principle holds for es5 and es6 class behavior
  const classTid = wrapperClassTee.ownerClass === undefined ? wrapperClassTee.tid : wrapperClassTee.ownerClass; // used for .bind on classes
  log('owner class (to use in case of .bind):', tstr(classTid));
  const classTee = store.get(classTid);

  if (!classTee || !classTee.props) {
    // Not a class, not even callable, consider this a noop, return undefined
    store.linter.check('NEW_NOT_CONSTRUCTOR', locFrom);
    return 'undefined';
  }

  if (classTee.funcType && classTee.funcType.startsWith('class-bind')) store.linter.check('TOFIX', locFrom, '??');
  if (classTee.funcType && classTee.funcType.startsWith('arrow')) store.linter.check('TOFIX', locFrom, '??');
  if (classTee.funcType && !classTee.funcType.startsWith('decl') && !classTee.funcType.startsWith('expr') && !classTee.funcType.startsWith('method') && !classTee.funcType.startsWith('class') && !classTee.funcType.startsWith('func-builtin')) store.linter.check('TOFIX', locFrom, '??');

  if (classTee.boundContext && classTee.funcType !== 'class-bound') {
    // Technically this could be a runtime error. But I don't care for our model as long as the rest holds...
    store.linter.check('FUNCTION_BIND_NEW', locFrom);
  }

  // The context is a fresh object whose __proto__ points to the invoked class'es .prototype
  // There are two paths here; es5 and es6 classes

  group('Creating the fresh object instance to be the context of this `new` call');
  const instanceTid = playActionObj(locFrom, store, undefined, stack, ['__proto__'], [classTee.props.get('prototype') || 'Object.prototype']);
  groupEnd();

  let constructTid = classTid;
  if (classTee.funcType.startsWith('class')) { // can be class, can be a .bind() result on a class
    log('This is a class, must resolve the constructor from owner class:', tstr(classTid));
    const prototypeTid = classTee.props.get('prototype');
    log('- .prototype:', tstr(prototypeTid));
    ASSERT(prototypeTid, 'the prototype of a constructor can not be cleared', prototypeTid);
    const prototypeTee = store.get(prototypeTid);
    const constructorTid = prototypeTee.props.get('constructor');
    ASSERT(constructorTid, 'the constructor on an es6 class must always exist, explicitly or implicitly', constructorTid);
    log('- .prototype.constructor:', tstr(constructTid));

    constructTid = constructorTid;
  }

  log('Did this call have a spread? spreadAt =', spreadAt);

  group('invoking now');
  let returnTid = metaCall(locFrom, constructTid, instanceTid, true, stack, argTids.length, argTids, spreadAt, store, classTid, instanceFence, false);
  groupEnd();

  if (['undefined', 'null', 'boolean', 'number', 'string'].includes(returnTid)) {
    log('The `new` call returned a primitive (', tstr(returnTid), '). Force returning the object instance instead:', tstr(instanceTid));
    returnTid = instanceTid;
  }

  log('Stack at end of @new:', stack.map(tstr).join(', '));
  return returnTid;
}

export function playActionObj(locFrom, store, tid = createObjectTid(store), _stack, propNames, propTids) {
  // There ought to be as many values on the stack as there are properties with initializers
  // Create a tee with these properties

  ASSERT(propNames instanceof Array, 'prop names should be array', propNames);

  const props = new Map
  propNames.forEach((name, i) => {
    props.set(name, propTids[i]);
  });
  if (!props.has('__proto__')) {
    props.set('__proto__', 'Object.prototype');
  }

  //The `kind` state gives us an outside chance of supporting dynamic properties when used as a Map. Set it to `false`
  // once there are at least two properties with different tids. Since we will always issue a model-breaking warning
  // I think it's fine to ignore `undefined` here, as well as the value of `__proto__`.
  let lastKind = '';
  props.forEach((tid, name) => {
    if (name === '__proto__') return; // ignore
    if (tid === 'undefined') return; // ignore
    if (lastKind === '') lastKind = tid;
    if (lastKind !== tid) lastKind = false;
  });
  const kind = lastKind === '' ? createPlaceholder(store, 'HOK', 'object kind') : lastKind;

  store.set(tid, {
    _class: 'obj',
    tid,
    type: 'O',
    iid: ++store.instanceId,
    props,
    setProp(name, tid) {
      // Note: this.props may not be props so do not assume this

      log('props.set(', name, ',', tstr(tid), ')');
      this.props.set(name, tid);
      ASSERT(this.kind === false || ASSERT_TID(this.kind), 'object kind is special cased', this.kind);
      group('Updating object kind');
      if (name !== '__proto__' && tid !== 'undefined' && this.kind !== false && testMerge(store, this.kind, tid)) {
        this.kind = merge(locFrom, store, this.kind, tid);
      } else {
        log('The object can no longer be used as a hashmap. Dynamic property access will now return `undefined` and a lint error.');
        this.kind = false;
      }
      groupEnd();
      log('setProp returning', tstr(tid), 'and the prop is now recorded as', tstr(this.props.get(name)));
      return tid;
    },
    seen: new Map(props),
    kind, // tid or false
    alias: null,
    locFrom, // Used to detect recursive objects created through recursive functions
    fencedClone(fence, recur = new Map, debugDesc, arrInputs, mapReversedInputs, deltaMutators, currentInputs) {
      const tid = store.final(this.tid);
      group('obj.fencedClone(' + fence + ', ' + debugDesc + ') on', tstr(tid), recur.size < 5 ? ', recur=' : (', recur has ' + recur.size + ' items'), recur.size < 5 ? recur : '');

      let ctid = recur.get(tid);
      if (ctid) {
        log('This tid is part of a recursive type. Using the fenced clone that was already generated for this tid:', tstr(ctid));
      } else {
        // Pre-generate the array tid to create so we can put it in the recur cache. Prevents `a=[]; a[0]=a` problems
        ctid = createObjectTid(store);
        recur.set(tid, ctid);

        // Create fresh object without props through normal path, then replace the props with the clones
        playActionObj(locFrom, store, ctid, _stack, [], []);

        log('Clone4 the props into the cloned object');
        const ctee = store.get(ctid);
        ctee.kind = this.kind === false ? false : fencedCloneTool(fence, this.kind, store, recur, arrInputs, mapReversedInputs, deltaMutators, currentInputs, debugDesc);
        ctee.props = new Map([...this.props.entries()].map(([key, value]) => [key, fencedCloneTool(fence, value, store, recur, arrInputs, mapReversedInputs, deltaMutators, currentInputs, debugDesc)]));
      }

      log('</obj.fencedClone>');
      groupEnd();
      return ctid;
    },
  });

  log('->', tstr(tid), ', iid:', store.instanceId);
  return tid;
}

export function playActionSet(locFrom = {filename: '<builtin>', column: 0, line: 0}, store, tid = createSetTid(store), stack, kind) {
  // There ought to be 1 value on the stack to be the kind of this set
  // Store ought to be global (but I may want to reconsider my choice of putting the uid counter in there...)

  log('Creating Set instance with kind =', tstr(kind), 'as', tstr(tid));
  ASSERT_TID(kind);

  const props = new Map([
    ['__proto__', 'Set.prototype'],
  ]);
  store.set(tid, {
    _class: 'set',
    _clone: '#',
    tid,
    type: 'S',
    kind,
    iid: ++store.instanceId,
    props,
    setProp(name, tid) { this.props.set(name, tid); return tid; },
    seen: new Map(props),
    alias: null,
    locFrom,
    fencedClone(fence, recur = new Map, debugDesc, arrInputs, mapReversedInputs, deltaMutators, currentInputs) {
      const tid = store.final(this.tid);
      group('set.fencedClone(' + fence + ', ' + debugDesc + ')');

      let ctid = recur.get(tid);
      if (ctid) {
        log('This tid is part of a recursive type. Using the fenced clone that was already generated for this tid:', tstr(ctid));
      } else {
        // Pre-generate the array tid to create so we can put it in the recur cache. Prevents `a=[]; a[0]=a` problems
        ctid = createSetTid(store);
        recur.set(tid, ctid);

        const kindClone = fencedCloneTool(fence, kind, store, recur, arrInputs, mapReversedInputs, deltaMutators, currentInputs, 'kind');

        playActionSet(locFrom, store, ctid, stack, kindClone);

        log('Clone5 the props into the cloned array');
        const ctee = store.get(ctid);
        ctee.props = new Map([...this.props.entries()].map(([key, value]) => [key, fencedCloneTool(fence, value, store, recur, arrInputs, mapReversedInputs, deltaMutators, currentInputs, debugDesc)]));
      }

      log('</set.fencedClone>');
      groupEnd();
      return ctid;
    },
  });

  return tid;
}

function locToToken(store, {filename, column, line}) {
  const token = store.fileData.get(filename).tokenTable.get(column + 'x' + line);
  ASSERT(token, 'all known locs should have a token');
  return token;
}

function getFirstToken(store, loc) {
  return store.fileData.get(loc.filename).tokenTable.get(loc.column + 'x' + loc.line);
}
