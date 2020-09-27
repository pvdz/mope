
/*

// next steps:
- make the last set of class tests work. abolish the shadowing, pave the way for mode v4
- defineProperty trickery


// fixing maps/sets?
// we could look into promises, but that seems like a bigger problem to tackle
// dare i say optionals/nullables? might have the same way forward as plusses ..
// or pattern stuff, but that's not really problem solving. that's just polish.
// collect which properties are looked up on values

this was the todo list from v2 before this v3

- spread
- optional / nullable
- classes / super
- try / catch (and throwing in general?)
- tagged templates
- destructuring (assignment, arrow, catch)
- return type of asyncs
- constructor and new.target
- new and classes
- new and (arrows/bind

- defining all the spec builtins
- knowing that something is an object, just not what kind of object? like `instanceof` and `in`
- constructors
- any non-lexical bindings (`var`) are undefined until defined. Inside any function these are nullable. drat.
- can we assert TDZ in our model?
- workaround for delete? `(({a, ...r})=>r)(obj)`, () => {let {a, ...r} = obj`
- freezing / frozen objects
  - how to deal with an object that gets frozen? how to deal with the before/after. I guess `x = {}; x = freeze(x)` is illegal because its not monomorphic -> `x={};y=freeze(x)`
  - obj attributes (writable/configurable/etc)
- classes;
  - does a class represent an opaque type? are two different classes with same sig of same type?
  - what are hte limits to subclassing for us?



- before we would shadow tees when entering a new scope but now we will create a new global tee instead
- this should allow us to work around the problem of returning references from the same function multiple times and resolving to the value under the shadow in global space
- the potential downside is losing a guarantee about the whole thing being final, but i think I kinda lost that one already when I went with props and tribute, nayways.



 */


// function f(){ return this }; f.apply(bar);
// `function f(){ f.toString(); f.toString(16); f * f }` -> "any kind of value; number or user object; must be number"
// chained calls, a()() and a().b()

import {
  ASSERT,
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

  dir,
  group,
  groupEnd,
  log,
  printNode,
  tstr, ASSERT_LOC,
} from "./utils.mjs"
import {YELLOW} from './utils.mjs';
import builtinGlobalBindings from './globals.mjs';
import {playActions} from './actions.mjs';

export function phase3(store, filename) {
  group('\n\n\n##################################\n## phase3  ::  ' + filename + '\n##################################\n\n\n');
  
  const fileState = store.fileData.get(filename);

  const globalTid = 'G' + String(++store.uid);
  const globalTee = {
    _class: 'global obj',
    tid: globalTid,
    type: 'O', // Any need to make it special?
    builtin: true, // Safe to do?
    iid: 0,
    props: new Map,
    setProp(name, tid) { this.props.set(name, tid); return tid; },
    seen: new Map,
    alias: null,
    fromFilename: filename,
    fromColumn: 0,
    fromLine: 0,
    locFrom: {filename, column: -1, line: -1},
    fencedClone(fence, recur = new Map, debugDesc, arrInputs, mapReversedInputs, deltaMutators, currentInputs) {
      ASSERT(false, 'why is this called on global?');
      // (If this needs to be implemented see the object type)
    },
  };
  store.set(globalTid, globalTee);
  fileState.globalTid = globalTid;

  const globalModuleTid = 'O' + String(++store.uid);
  {
    const props = new Map;
    const tee = {
      _class: 'global.module obj',
      tid: globalModuleTid,
      type: 'O', // Any need to make it special?
      builtin: true, // Safe to do?
      iid: 0,
      // props: new Map([['exports', globalModuleExportsTid]]),
      // seen: new Map([['exports', globalModuleExportsTid]]),
      props,
      setProp(name, tid) { this.props.set(name, tid); return tid; },
      seen: new Map,
      alias: null,
      locFrom: {filename, column: -2, line: -1},
      fencedClone(fence, recur = new Map, debugDesc, arrInputs, mapReversedInputs, deltaMutators, currentInputs) {
        ASSERT(false, 'why is this called on global.module?');
        // (If this needs to be implemented see the object type)
      },
    };
    store.set(globalModuleTid, tee);
    fileState.globalModuleTid = globalModuleTid;
  }

  const closureMap = new Map(builtinGlobalBindings);
  let closure = {
    class: 'closure',
    type: 'global',
    digest(color) { return color ? YELLOW + 'G' + RESET : 'G'; },
    get(name) { return closureMap.get(name); },
    set(name, tid) { return closureMap.set(name, tid); },
    has(name) { return closureMap.has(name); },
    str() {
      return '<global scope>';
    },
    find(name, locFrom) {
      ASSERT(typeof name === 'string', 'must find a name', name);
      ASSERT_LOC(locFrom);

      log('Looking for `' + name + '` in global scope');
      if (closureMap.has(name)) return closureMap.get(name);

      store.linter.check('USED_BINDING_BEFORE_DECL', locFrom, name);
      log('Marking `' + name + '` as an implicit global');
      store.fileData.get(filename).implicitGlobals.add(name);
      closureMap.set(name, 'undefined'); // I guess
      return 'undefined'; // Let it poly out
    },
    parentClosure: null,
    superPropOwner: SUPER_PROP_OWNER_NOT_FOR_GLOBAL,
    instanceFence: 0, // Any iid higher than this was created after this closure (in global, that's everything that's not builtin)
    calleeTid: 'global',
    filename,
  };

  closure.set('window', globalTid);
  closure.set('global', globalTid);
  closure.set('module', globalModuleTid);

  const stack = [];

  const locFrom = {filename, column: 0, line: 0};
  playActions(locFrom, store, fileState.globalActions, globalTee, 'undefined', closure, stack);

  groupEnd();

  return store;
}




