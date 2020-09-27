import {
  ASSERT,
  ASSERT_LOC,
  ASSERT_TID,
  ASSERT_SUPER_PROP_OWNER,
  BOLD,
  DIM,
  getIndent,
  group,
  groupEnd,
  log,
  RESET,
  tstr,
  WHITE_BLACK,
  YELLOW, NO_SUPER_VALUE, createPlaceholder
} from "./utils.mjs"

export function merge(locFrom, store, a, b, testing = false, recur = new Set) {
  // returns resulting tid after merge, does not read/write the stack
  ASSERT(arguments.length === 4 || arguments.length === 5 || arguments.length === 6, 'arg count to merge');
  locFrom === null || ASSERT_LOC(locFrom); // testMerge will set this to null

  log((testing ? 'Test-' : '') + 'Merging', tstr(a), 'with', tstr(b));
  ASSERT_TID(a);
  ASSERT_TID(b);

  const A = store.get(a);
  const B = store.get(b);

  // store.get will have resolved aliases
  a = A.tid;
  b = B.tid;

  if (a === b) {
    log('Same tid, nothing to do');
    return a;
  }

  const pair = a + ':' + b;
  if (recur.has(pair)) {
    log('A and B are already being merged. There is recursion in their model. Ignoring this and returning A');
    return a;
  }
  recur.add(pair);

  const tidA = A.tid;
  const tidB = B.tid;

  if (tidA === tidB) {
    log('Same tid, nothing to do');
    return a;
  }

  if (A.type === 'H') {
    log('Merging a placeholder A', tstr(A.tid), 'to', tstr(tidB));
    if (B.type === 'H') {
      log('Merging two placeholders...');
    }

    if (A.props.size) {
      if (!testing && isPrimitive(b)) {
        store.linter.check('POLY_PRIMITIVE_TO_PLACEHOLDER_WITH_PROPS', locFrom, tidA, tidB);
      }
      mergeProps(locFrom, store, tidB, B, tidA, A, testing, recur);
    }

    if (!testing) {
      store.linkTo(A, B);
    }

    return tidB;
  }

  if (B.type === 'H') {
    log('Merging a placeholder B', tstr(B.tid), 'to', tstr(tidA));
    if (!testing) {
      store.linkTo(B, A);
    }
    return tidA;
  }

  if (isPrimitive(tidA) || isPrimitive(tidB)) {
    if (testing) throw 1;
    store.linter.check('POLY_PRIMITIVES', locFrom, tidA, tidB);
    if (tidA === 'undefined') {
      log('- Since A is `undefined`, B is more likely to be relevant (under assumption that the model is no longer sound, anyways)');
      return tidB;
    }
    return tidA;
  }

  if (A === B) {
    log('Since A and B are equal while they are different tids, cosnidering them merged to:', tstr(A.tid))
    // Note: A.tid may not be tidA nor tidB
    return A.tid;
  }

  if (A.builtin && B.builtin) {
    if (testing) throw 2;
    store.linter.check('POLY_BUILTINS', locFrom);
    return tidA;
  }

  if (A.builtin) {
    // We can merge plain objects with builtin objects...
    if (A.type === 'O' && B.type === 'O') {
      return mergeObjects(locFrom, store, tidA, A, tidB, B, testing, recur);
    }

    // Technically we could try to merge a builtin array with user array but I'm not sure there are valid use cases here
    // These aren't primitives
    // Merging functions / classes / constructors is tbd

    if (testing) throw 3;
    store.linter.check('POLY_BUILTIN_ARRAY', locFrom);
    return tidA;
  }

  if (B.builtin) {
    // We can merge plain objects with builtin objects...
    if (B.type === 'O' && tidA[0] === 'O') {
      return mergeObjects(locFrom, store, tidB, B, tidA, A, testing, recur);
    }

    // Technically we could try to merge a builtin array with user array but I'm not sure there are valid use cases here
    // These aren't primitives
    // Merging functions / classes / constructors is tbd

    if (testing) throw 32;
    store.linter.check('POLY_BUILTIN_ARRAY', locFrom);
    return tidA;
  }

  if (A.type === 'A' && B.type === 'A') { // arrays
    return mergeIterables(locFrom, store, tidA, A, tidB, B, testing, recur);
  }

  if (A.type === 'O' && B.type === 'O') { // objects
    return mergeObjects(locFrom, store, tidA, A, tidB, B, testing, recur);
  }

  if (A.type === 'F' || B.type === 'F') {

    // log(A.parentClosure.digest(true))
    // log(B.parentClosure.digest(true))
    // if (A.nid === B.nid && A.parentClosure.digest() === B.parentClosure.digest()) {
    //   log('yeees?')
    // }
    //
    // log('Merging two functions?');
    // log(A.nid, B.nid)
    // log(A)
    // log(B)
    if (testing) throw 64;
    store.linter.check('FUNCTION_MERGE', locFrom);
  }

  if (A.type === 'S' && B.type === 'S') {
    return mergeIterables(locFrom, store, tidA, A, tidB, B, testing, recur);
  }

  if (A.type === 'M' && B.type === 'M') {
    return mergeMaps(locFrom, store, tidA, A, tidB, B, testing, recur);
  }

  if (testing) throw 4;
  store.linter.check('POLY_OTHER', locFrom);

  store.linter.check('TOFIX', locFrom, 'this is an unknown merge kind and it is not implemented');
  return tidA;
}
function mergeIterables(locFrom, store, tidA, A, tidB, B, testing, recur) {
  log('Merging two iterables, so compare their `kind`:', tstr(A.kind), 'vs', tstr(B.kind));

  ASSERT(A.type === B.type, 'should already have been checked to be the same');

  if (A.kind === B.kind) {
    log('Hack: Iterables with same kind, setting B to A');
    if (!testing) {
      store.linkTo(B, A);
    }
    mergeProps(locFrom, store, tidA, A, tidB, B, testing, recur);
    return tidA;
  }

  const kindTeeA = store.get(A.kind);
  const kindTeeB = store.get(B.kind);

  if (kindTeeA.type === 'H') {
    log('The kind of A was undetermined so setting A to B');
    if (!testing) {
      if (kindTeeA !== kindTeeB) {
        store.linkTo(kindTeeA, kindTeeB);
      }
      A.kind = kindTeeB.tid;
      store.linkTo(A, B);
    }
    mergeProps(locFrom, store, tidB, B, tidA, A, testing, recur);
    return tidB;
  }

  if (kindTeeB.type === 'H') {
    log('The kind of B was undetermined so setting B to A');
    if (!testing) {
      if (kindTeeA !== kindTeeB) {
        store.linkTo(kindTeeB, kindTeeA);
      }
      B.kind = kindTeeA.tid;
      store.linkTo(B, A);
    }
    mergeProps(locFrom, store, tidA, A, tidB, B, testing, recur);
    return tidA;
  }

  log('A and B kind are set and different; merging them');

  if (!testing) A.kind = B.kind = merge(locFrom, store, A.kind, B.kind, testing, recur);
  if (!testing) {
    store.linkTo(B, A);
  }

  mergeProps(locFrom, store, tidA, A, tidB, B, testing, recur);

  log('Iterables merged. Pointing B to A.');

  if (!testing) {
    store.linkTo(B, A);
  }

  return tidA;
}
function mergeMaps(locFrom, store, tidA, A, tidB, B, testing, recur) {
  log('Merging two maps, so compare their key and value kinds. Key: ', tstr(A.keyKind), 'vs', tstr(B.keyKind), '. Value: ', tstr(A.kind), 'vs', tstr(B.kind));

  ASSERT(A.type === B.type, 'should already have been checked to be the same');

  if (A.keyKind === B.keyKind && A.kind === B.kind) {
    log('Hack: Map with same key and value kinds, setting B to A');
    if (!testing) {
      store.linkTo(B, A);
    }
    mergeProps(locFrom, store, tidA, A, tidB, B, testing, recur);
    return tidA;
  }

  const keyKindTeeA = store.get(A.keyKind);
  const keyKindTeeB = store.get(B.keyKind);
  const valueKindTeeA = store.get(A.kind);
  const valueKindTeeB = store.get(B.kind);

  if (keyKindTeeA.type === 'H' && valueKindTeeA.type === 'H') {
    log('The key and value kinds of A were undetermined so setting A to B');
    if (!testing) {
      if (keyKindTeeA !== keyKindTeeB) {
        store.linkTo(keyKindTeeA, keyKindTeeB);
      }
      if (valueKindTeeA !== valueKindTeeB) {
        store.linkTo(valueKindTeeA, keyKindTeeB);
      }
      A.keyKind = keyKindTeeB.tid;
      A.kind = valueKindTeeB.tid;
      store.linkTo(A, B);
    }
    mergeProps(locFrom, store, tidB, B, tidA, A, testing, recur);
    return tidB;
  }

  if (keyKindTeeB.type === 'H' && valueKindTeeB.type === 'H') {
    log('The key and value kinds of B was undetermined so setting B to A');
    if (!testing) {
      if (keyKindTeeA !== keyKindTeeB) {
        store.linkTo(keyKindTeeB, keyKindTeeA);
      }
      if (valueKindTeeA !== valueKindTeeB) {
        store.linkTo(valueKindTeeB, keyKindTeeA);
      }
      B.keyKind = keyKindTeeA.tid;
      B.kind = valueKindTeeA.tid;
      store.linkTo(B, A);
    }
    mergeProps(locFrom, store, tidA, A, tidB, B, testing, recur);
    return tidA;
  }

  log('A and B key or value kinds are set and differently; merging them');

  if (!testing) {
    A.keyKind = B.keyKind = merge(locFrom, store, A.keyKind, B.keyKind, testing, recur);
    A.kind = B.kind = merge(locFrom, store, A.kind, B.kind, testing, recur);
    store.linkTo(B, A);
  }

  mergeProps(locFrom, store, tidA, A, tidB, B, testing, recur);

  log('Maps merged. Pointing B to A.');

  if (!testing) {
    store.linkTo(B, A);
  }

  return tidA;
}
function mergeObjects(locFrom, store, tidA, A, tidB, B, testing, recur) {
  log('Merging two objects');
  log('A.props is', A.props);
  log('B.props is', B.props);

  ASSERT(A !== B);
  ASSERT(!B.builtin);

  mergeProps(locFrom, store, tidA, A, tidB, B, testing, recur);

  log('Arrays merged. Replacing', tidB, 'in store with the Tee of', tidA);

  if (!testing) {
    store.linkTo(B, A);
  }

  return tidA;
}
function mergeProps(locFrom, store, tidA, A, tidB, B, testing, recur) {
  ASSERT(!B.builtin, 'A may be built-in but B should not be because that is basically being replaced', A, B);
  ASSERT(A.props && B.props, 'A and B ought to have properties', A, B);
  ASSERT(A !== B);

  // TODO: merge seen as well...????

  // Merge the props of B into the props of A
  B.props.forEach((b, name) => {
    log('- Merging prop', [name]);
    const a = A.props.get(name);
    if (a !== b) {
      if (!testing) {
        if (name === '__proto__') store.linter.check('PROTO_MERGE', locFrom);
        if (name === 'prototype') store.linter.check('PROTO_MERGE', locFrom);
      }

      if (a === undefined) {
        if (!testing) A.setProp(name, b);
      } else if (b !== undefined) {
        if (!testing) A.setProp(name, merge(locFrom, store, a, b, testing, recur));
      }
    }
  });
}

export function testMerge(store, tidA, tidB) {
  // This merge should be side effect free. It's not quite "free" so take care.
  try {
    merge(null, store, tidA, tidB, true);
    return true;
  } catch (v) {
    log('- Test merge threw:', v);
    ASSERT(typeof v === 'number', 'the test merge ought to only throw codes, this one threw something else', v);
    return false;
  }
}

export function mergeAll(locFrom, tids, store) {
  ASSERT(tids.length, 'do not call this with an empty array', tids);
  tids.forEach(tid => ASSERT_TID(tid));

  log('mergeAll with tids:', tids.map(tstr).join(', '));

  let tid = tids[0];
  for (let i=1; i<tids.length; ++i) {
    tid = merge(locFrom, store, tid, tids[i]);
  }

  log('-> mergeAll result:', tstr(tid));

  return tid;
}
export function mergeTestAll(locFrom, tids, store) {
  ASSERT(tids.length, 'do not call this with an empty array', tids);
  tids.forEach(tid => ASSERT_TID(tid));

  log('mergeAll with tids:', tids.map(tstr).join(', '));

  const tid = tids[0];
  for (let i=1; i<tids.length; ++i) {
    if (!testMerge(store, tid, tids[i])) {
      log('-> mergeTestAll result:', false);
      return false;
    }
  }

  log('-> mergeTestAll result:', true);

  return true;
}

let abc = 0;
export function fencedCloneToolDebug(fence, tid, store, recur, arrInputs, mapReversedInputs, deltaMutators, currentInputs, root, debugDesc) {
  ASSERT(typeof fence === 'number', 'fence is an number', fence);
  ASSERT_TID(tid);
  ASSERT(store);
  ASSERT(recur instanceof Map, 'recur is a map', recur);
  ASSERT(Array.isArray(arrInputs), 'arrInputs is an array', arrInputs);
  ASSERT(mapReversedInputs instanceof Map, 'recur is a map', mapReversedInputs);
  ASSERT(Array.isArray(deltaMutators), 'arrInputs is an array', deltaMutators);
  ASSERT(deltaMutators.every(a => Array.isArray(a)), 'arrInputs is an array of arrays', deltaMutators);
  ASSERT(Array.isArray(currentInputs), 'arrInputs is an array', currentInputs);
  ASSERT(typeof debugDesc === 'string', 'debugDesc is an string', debugDesc);

  if (isPrimitive(tid)) return tid;

  let indentBefore = getIndent();

  if (root) fenceStart(tid, store);
  let r = '<crash>';
  try {
    r = fencedCloneTool(fence, tid, store, recur, arrInputs, mapReversedInputs, deltaMutators, currentInputs, debugDesc);
    ASSERT(indentBefore === getIndent(), 'indent should be same if the process didnt crash', indentBefore, getIndent());
    return r;
  } finally {
    if (root) fenceStop(tid, r, store);
  }
}
export function fenceStart(tid, store) {
  return; // enable to debug some cloning

  const tee = store.get(tid);
  console.log('----', ++abc, tstr(tid), tee.tid !== tid ? '--> ' + tstr(tee.tid) : '');//, store.get(tid));

  console.time('print time');
  const s = tidToString(tid, store);
  console.timeEnd('print time');

  console.log('Input tee:');
  console.log(s);

  console.time('fence time');
}
export function fenceStop(inputTid, cloneTid, store) {
  return; // enable to debug some cloning

  console.timeEnd('fence time');
  if (cloneTid === '<crash>') return;

  console.time('print time');
  const t = tidToString(cloneTid, store);
  console.timeEnd('print time');

  console.log('Clone tee:');
  console.log(t);
}
export function fencedCloneTool(fence, inpTid, store, recur, arrInputs, mapReversedInputs, deltaMutators, currentInputs, debugDesc) {
  ASSERT(typeof fence === 'number', 'fence is an number', fence);
  ASSERT_TID(inpTid);
  ASSERT(store);
  ASSERT(recur instanceof Map, 'recur is a map', recur);
  ASSERT(Array.isArray(arrInputs), 'arrInputs is an array', arrInputs);
  ASSERT(mapReversedInputs instanceof Map, 'recur is a map', mapReversedInputs);
  ASSERT(Array.isArray(deltaMutators), 'arrInputs is an array', deltaMutators);
  ASSERT(deltaMutators.every(a => Array.isArray(a)), 'arrInputs is an array of arrays', deltaMutators);
  ASSERT(Array.isArray(currentInputs), 'arrInputs is an array', currentInputs);
  ASSERT(typeof debugDesc === 'string', 'debugDesc is an string', debugDesc);

  log('- fencedCloneTool(', tstr(inpTid), ', ' + debugDesc + ')');
  ASSERT(fencedCloneTool.length === arguments.length, 'arg count');
  ASSERT(inpTid, 'should receive a tid', inpTid, arguments);
  const tee = store.get(inpTid);
  ASSERT(tee);
  const tid = tee.tid;

  if (tee.builtin) {
    log('  -> builtin, not cloning');
    return tee.tid;
  }
  if (tee.type === 'H') {
    const pid = createPlaceholder(store, tee.tid + 'CL', 'cloning placeholder ' + tee.tid);
    log('  -> placeholder; cloned to', tstr(pid)); // It is a bug if you don't
    return pid;
  }

  const alreadyCloned = recur.get(tid);
  if (alreadyCloned) {
    // It may not have finished cloning (for recursive / cycles) or it may have (same refs in siblings branches)
    log('This tid was already cloned so returning the tid of that clone:', tstr(alreadyCloned));
    return alreadyCloned;
  }

  ASSERT(tee.iid, 'non-builtins should have an iid', tee);
  if (tee.iid <= fence) {
    group();
    log('-> created before fence, not cloning. Need to find input tid for this of the current call and return that tid (not the initial call that got cached)');
    log('-> Cached input tid:', tstr(tee.tid), ', now need to find the index');
    log('- mapReversedInputs:', mapReversedInputs.size > 20 ? '<many>' : mapReversedInputs);
    // Find the "index" of this tid
    const index = mapReversedInputs.get(tee.tid);
    // If the tid is not mapped then it's a closure.

    //probleem: een closure kan ook een andere waarde hebben afhankelijk van de closure. MAar de digest zou dit moeten afvangen voor ons.
    if (index === undefined) {
      log('No index so this must be a closure (or a bug..). Returning the cached tid', tstr(tee.tid));
      groupEnd();
      return tee.tid;
    }

    // Return the input tid of the current call at the same index
    const currentTee = store.get(currentInputs[index]);
    log('Current input tid:', tstr(currentTee.tid));
    const mutators = deltaMutators[index];
    ASSERT(Array.isArray(mutators), 'each index should be a set of zero or more mutator functions', mutators);
    mutators.forEach(mutator => mutator(store, currentTee.tid, currentInputs));
    groupEnd();
    return currentTee.tid;
  }

  // Note: the returned tid may not exist in the store yet (in case of recursion)
  const ctid = tee.fencedClone(fence, recur, debugDesc, arrInputs, mapReversedInputs, deltaMutators, currentInputs);
  log('  -> cloned to', tstr(ctid));

  return ctid;
}

export function isPrimitive(inp) {
  const tid = typeof inp !== 'string' ? inp.tid : inp;
  ASSERT(typeof tid === 'string', 'gimme tees or strings', inp);
  return ['undefined', 'null', 'boolean', 'number', 'string'].includes(tid);
}

export function isPlaceholder(inp, store) {
  const tid = typeof inp !== 'string' ? inp.tid : inp;
  ASSERT(typeof tid === 'string', 'gimme tees or strings', inp);
  const tee = store.get(tid);
  return tee.type === 'H';
}

export function digest(inTee, store, color, printFuncDigest, isCallee, depth = 0, recur = new Map) {
  ASSERT(inTee, 'get tee', inTee);
  ASSERT(store);
  ASSERT_TID(typeof inTee === 'string' ? inTee : inTee.tid);
  const tee = store.get(typeof inTee === 'string' ? inTee : inTee.tid);
  // console.log(' '.repeat(depth) + '| digest:', tstr(tee.tid), tidToString(tee.tid, store, true, depth * 2));
  const r = _digest(tee, store, color, printFuncDigest, isCallee, depth+2, recur);
  // console.log(' '.repeat(depth) + '|-', r);
  return r;
}
function _digest(tee, store, color, printFuncDigest, isCallee, depth = 0, recur) {

  if (tee.builtin) {
    if (color) return isCallee ? YELLOW + tee.tid + RESET : tstr(tee.tid);
    return tee.tid;
  }

  if (recur.has(tee.tid)) return '^' + recur.get(tee.tid);
  recur.set(tee.tid, recur.size);

  if (depth > 20) {
    if (depth > 100) {
      // Print a bunch before bailing permanently
      ASSERT(false, 'very large digest? this is probably a recursion problem...? (increase count to verify)'); // it may be legit. :/
    }
  }
  ASSERT(tee, 'input should be a tee or the tid of a string, and it wasnt', arguments);

  ASSERT(tee.props, 'all non-builtins have properties', tee);
  let props = [];

  tee.props.forEach((tid, key) => {
    const tee = store.get(tid);
    ASSERT(tee, 'tid should exist', tid, tee);
    ASSERT(tee.builtin || tee.locFrom, 'non-builtin tees should have a locFrom', tid, tee);

    if (key === '__proto__') {
      if (tee.type === 'A' && tid === 'Array.prototype') return;
      if (tee.type === 'C' && tid === 'Function.prototype') return;
      if (tee.type === 'F' && tid === 'Function.prototype') return;
      if (tee.type === 'O' && tid === 'Object.prototype') return;
      if (tee.type === 'M' && tid === 'Map.prototype') return;
      if (tee.type === 'S' && tid === 'Set.prototype') return;
      props.push('__proto__:' + tid); // Let's not traverse inherited properties
      return;
    }

    props.push(key + ':' + digest(tid, store, color, undefined, undefined, depth + 1, recur))
  })
  props = props.filter(Boolean);
  if (!tee.props.has('__proto__')) props.push('__proto__:<none>');

  const d = color ? DIM : '';
  const y = color ? YELLOW : '';
  const r = color ? RESET : '';

  switch (tee.type) {
    case 'A': { // array
      return y + 'Array' + r + '['+(tee.kind ? digest(tee.kind, store, color, undefined, undefined, depth + 1, recur) : '??')+']<'+props.join(',')+'>';
    }
    case 'C': { // class
      const bound = tee.tid[1] === 'B';
      return y + 'Class' + (bound?'.bind':'') + r + '<'+props.join(',')+'>';
    }
    case 'F': { // function
      const bound = tee.tid[1] === 'B';
      const propsPart = unchangedConstructor(tee, store) ? '!!' : props.join(', ');
      const ownDigest = (printFuncDigest ? '{' + d + tee.parentClosure.digest() + RESET + '}' : '');
      const scopeDigest = [];
      tee.reachableNames.forEach((newName, oldName) => {
        scopeDigest.push(oldName+'='+tee.parentClosure.get(oldName));
      });

      return y + 'Func' + (bound?'.bind':'') + '['+tee.nid+']' + r + '<'+propsPart+'><'+scopeDigest.join(',')+'>' + ownDigest;
    }
    case 'O': { // object
      return y + 'Object' + r + '<' + props.join(',') + '>';
    }
    case 'H': { // placeholder
      // This is tricky but for now return the place holder tid as a way of guaranteeing uniqueness.
      return tee.tid;
    }
    case 'S': { // Set
      return y + 'Set' + r + '<' + (tee.kind ? digest(tee.kind, store, color, undefined, undefined, depth + 1, recur) : '??') + '>';
    }
    case 'M': { // Map
      return y + 'Map' + r + '<' + (tee.keyKind ? digest(tee.keyKind, store, color, undefined, undefined, depth + 1, recur) : '??') + ', ' + (tee.kind ? digest(tee.kind, store, color, undefined, undefined, depth + 1, recur) : '??') + '>';
    }
    default:
      log(tee);
      store.linter.check('TOFIX', {filename: '<unknown>', column: 0, line: 0}, 'new tee type not yet implemented');
  }
}

export function unchangedConstructor(tee, store) {
  const props = tee.props;
  if (props.size !== 2) return false;
  const prototype = props.get('prototype');
  if (prototype === undefined) return false;
  const proto = props.get('__proto__');
  if (proto === undefined) return false;

  const p = store.get(prototype);
  if (!p || !p.props) return false;
  if (p.props.size !== 1) return false;
  if (p.props.get('__proto__') !== 'Object.prototype') return false;

  if (proto !== 'Function.prototype') return false;

  return true;
}

function ind(indent, extra) {
  if (indent === -1) return '';
  return ' '.repeat(indent + extra);
}

export function tidToString(_tid, store, digest = false, indent = 0, depth = 0, recur = new Map, recurId = new Map) {
  ASSERT_TID(_tid, NO_SUPER_VALUE);
  // If indent is -1 then do not indent or space

  if (_tid === NO_SUPER_VALUE) return 'NO_SUPER_VALUE';

  const tee = store.get(_tid);
  const tid = tee.tid;

  if (tee.builtin) return tid;
  const ref = recur.get(tid);
  if (typeof ref === 'number') return '<cycle['+( tid)+']^'+ref+'>';
  else if (ref) return '<same-ref['+( tid)+']>';
  recur.set(tid, depth);
  recurId.set(tid, recurId.size);
  const r = _tidToString(tee, tid, store, digest, indent, depth, recur, recurId);
  recur.set(tid, r);
  return r;
}
function _tidToString(tee, tid, store, digest, indent , depth, recur, recurId) {
  const nl = ~indent ? '\n' : '';
  const printid = tid // digest ? recurId.get(tid) : tid;

  switch (tee.type) {
    case 'A': // Array
      return 'Array('+printid+')<' + nl +
        ind(indent, 2) + tidToString(tee.kind, store, digest, ~indent ? indent + 2 : indent, depth + 1, recur, recurId) + nl +
        ind(indent, 0) + '>' + tidToStringProps(tee, store, digest, indent, depth + 1, recur, recurId);
    case 'C': // Class
      return 'Class('+printid+', ' + tidToString(tee.superClass, store, digest, indent, depth + 1, recur) + ')' + tidToStringProps(tee, store, indent, depth + 1, recur, recurId);
    case 'F': // Function
      return 'Function('+printid+')' + tidToStringProps(tee, store, digest, indent, depth + 1, recur, recurId);
    case 'H': // PlaceHolder
      return 'PlaceHolder('+printid+')' + tidToStringProps(tee, store, digest, indent, depth + 1, recur, recurId);
    case 'M': // Map
      return 'Map('+printid+')<' + nl +
        ind(indent, 2) + tidToString(tee.keyKind, store, digest, ~indent ? indent + 2 : indent, depth + 1, recur, recurId) + ',' + nl +
        ind(indent, 2) + tidToString(tee.kind, store, digest, ~indent ? indent + 2 : indent, depth + 1, recur, recurId) + nl +
        ind(indent, 0) + '>' + tidToStringProps(tee, store, digest, indent, depth + 1, recur, recurId);
    case 'O': // Object
      return 'Object('+printid+')' + (tidToStringProps(tee, store, digest, indent, depth + 1, recur, recurId) || '<{}>');
    case 'S': // Set
      return 'Set('+printid+')<' + nl +
        ind(indent, 2) + tidToString(tee.kind, store, digest, ~indent ? indent + 2 : indent, depth + 1, recur, recurId) + nl +
        ind(indent, 0) + '>' + tidToStringProps(tee, store, digest, indent, depth + 1, recur, recurId);
    default: 
      console.log(tee);
      ASSERT(false, 'need to implement new tee type', tee);
  }
}
export function tidToStringProps(tee, store, digest, indent, depth, recur, recurId) {
  let s = [];
  tee.props.forEach((tid, key) => {
    if (key === '__proto__') {
      // Hide the __proto__ if it's the default (most of the time that's the case)
      // Be explicit when there is no __proto__
      if ([
        'A:Array.prototype',
        'C:Function.prototype',
        'F:Function.prototype',
        'M:Map.prototype',
        'O:Object.prototype',
        'S:Set.prototype',
      ].includes(tee.type + ':' + tid)) return; // omit
    }
    s.push(key + (~indent ? ': ' : ':') + tidToString(tid, store, digest, ~indent ? indent + 2 : indent, depth, recur, recurId));
  });
  if (!tee.props.has('__proto__')) s.push('__proto__' + (~indent ? ': ' : ':') + '<none>');
  if (tee.type !== 'H' && !tee.props.has('__proto__')) {
    s.push('__proto__: <none>');
  }
  if (!s.length) return '';
  const nl = ~indent ? '\n' : '';
  const sp = ~indent ? ' ' : '';
  return '<+{' + nl +
    s
      .map(s => ind(indent, 2) + s + nl)
      .join(~indent ? '' : ',') +
    ind(indent, 0) +
  '}>';
}
