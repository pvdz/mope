import {phase0} from './phase0.mjs';
import {phase1} from './phase1.mjs';
import {phase2} from './phase2.mjs';
import {phase3} from './phase3.mjs';
import {createLinter} from './lint.mjs';
import {
  BLUE,
  GREEN,
  RED,
  RESET,
  WHITE,
  YELLOW,
  BOLD,

  ASSERT,
  ASSERT_TID,
  clearStdio,
  dir,
  group,
  groupEnd,
  log,
  printNode,
  setStdio,
  tstr,
} from './utils.mjs';
import {setupBuiltins} from './builtins.mjs';

export default function main(code, options = {
  entryPoint: 'index', // filename of entry point, when resolved, imports in entry point code will be from this value
  stdio: undefined, // override logging (doesn't disable the overhead but you can suppress it this way)
  onParse: undefined, // callback triggered immediately after parsing, before further processing, called with the full result of Tenko (by reference) and a Map mapping col x line (like `4x7`) to its token for each token. return value ignored.
  resolve: undefined, // callback to normalize filenames for import/export. called for every new file, every export from, and every import from
  req: undefined, // custom resolver logic for fetching import/export paths (mostly for testing and the repl). given a path it should return a string that is the source of that path.
}) {
  if (options.stdio) {
    setStdio(options.stdio);
  } else {
    clearStdio();
  }

  const backingStore = new Map
  const store = {
    uid: 0,
    instanceId: 0,
    superStack: [], // I think this is fine to share between files..?
    callCache: new Map,
    linter: createLinter(),
    options,

    resolve: options.resolve || ((filename, from) => filename),
    req: options.req,

    // Queue of files to process, in order of discovering them. Use priority map to determine next step.
    // The queue is expanded as imports are discovered. Circular dependencies are not supported.
    queue: [],
    priority: new Map([[null, 1]]), // Map<filename, proprity>. Root=1, any deps get priority+1 of the file that depends on it. Or the max of multiple files depending on it. That way it should bubble the priority properly automatically.

    // File specific data that can't be shared, like globals, imports, and exports
    fileData: new Map,

    // Note: this get/set is about tids, not bound idents in scope (!)
    get(tid, trace) {
      if (trace) log('store.get(', tstr(tid), ')');
      let tee = backingStore.get(tid);
      if (trace) log('- initial:', tee);
      ASSERT(tee, 'a tid should resolve to a tee or it shouldnt exist. the store did not know this tid', ['tid:', tid, 'tee:', tee]);
      while (tee.alias) {
        tee = tee.alias;
        if (trace) log('- aliased:', tee.tid);
      }
      return tee;
    },
    set(tid, tee) {
      ASSERT(tid && tee);
      ASSERT_TID(tee.tid); // the tee should be an actual tee, not random other stuff
      ASSERT(!(tee instanceof Map) && !(tee instanceof Set) && !(tee instanceof Array) && typeof tee === 'object', 'tee is a tee', tee);

      backingStore.set(tid, tee);
    },
    final(tid) {
      // Resolve .alias redirects immediately
      return this.get(tid).tid;
    },
    linkTo(oldTee, withTee) {
      ASSERT(oldTee && withTee && typeof oldTee !== 'string' && typeof withTee !== 'string');
      if (oldTee === withTee) return; // can happen organically
      let tee = oldTee;
      while (tee.alias) {
        tee = tee.alias;
        if (tee === withTee) return; // can happen organically
      }
      tee.alias = withTee
    },
  };

  store.fileData.set('<builtin>', {
    // The builtin file data is to refer to for stuff that happens inside builtins...
    filename: '<builtin>',
    stage: 0,
    code: '',

    result: 'scheduled',
    error: undefined,
    globalActions: undefined, // set after phase2
    store: undefined, // set after phase3
    tenkoOutput: undefined,
    tokens: undefined, // Array<token>
    tokenTable: undefined, // Map<string, token>, "${col}x${row}" -> token
    implicitGlobals: new Set, // Set<string>

    globalTid: undefined, // builtin, unique per file
    globalModuleTid: undefined, // builtin, unique per file

    imports: new Map, // name -> file
    exports: new Map, // name -> tid
  });

  setupBuiltins(store);

  queueFile(store, options.entryPoint || 'index', null, code)

  processQueue(store); //moduleCache, sharedGlobals);

  return store;
}

function queueFile(store, resolvedFilename, fromFilename, sourceCode = null) {
  const prio = store.priority.get(fromFilename) + 1;
  console.log('Queuing', resolvedFilename.replace(/^\/home\/[\w\d]+/, '~'));
  if (store.fileData.has(resolvedFilename)) {
    const fileState = store.fileData.get(resolvedFilename);
    console.log('- File already imported before...');
    if (fileState.stage <= 3) {
      const wasPrio = store.priority.get(resolvedFilename);
      log('- Not finished processing yet, priority was', wasPrio, ', new prio would be', prio, ', making sure it is', Math.max(wasPrio, prio));
      if (prio > wasPrio) store.priority.set(resolvedFilename, prio);
    } else {
      log('- Already finished processing');
    }
  } else {
    console.log('- New file, set to prio', prio);
    store.priority.set(resolvedFilename, prio);
    let code = sourceCode;
    if (sourceCode) {
      log('queueFile: No need to fetch', resolvedFilename, 'because source was passed on (probably entry point?)');
    } else {
      log('queueFile: Fetching', resolvedFilename, 'and processing it first');
      if (!store.req) {
        throw new Error('Must receive a `req` resolver function through options to load imports/exports');
      }
      code = store.req(resolvedFilename, fromFilename);
    }

    store.fileData.set(resolvedFilename, {
      filename: resolvedFilename,
      stage: 0,
      code,

      result: 'scheduled',
      error: undefined,
      globalActions: undefined, // set after phase2
      store: undefined, // set after phase3
      tenkoOutput: undefined,
      tokens: undefined, // Array<token>
      tokenTable: undefined, // Map<string, token>, "${col}x${row}" -> token
      implicitGlobals: new Set, // Set<string>

      globalTid: undefined, // builtin, unique per file
      globalModuleTid: undefined, // builtin, unique per file

      imports: new Map, // name -> file
      exports: new Map, // name -> tid
    });

    store.queue.unshift(resolvedFilename);
  }
}

function processQueue(store) {
  while (store.queue.length) {

    store.queue.sort((a ,b) => store.priority.get(b) - store.priority.get(a));
    const filename = store.queue[0];

    if (store.fileData.get(filename).stage > 3) {
      store.queue.shift();
    } else {
      queueStep(store, filename);
    }
  }
}

function queueStep(store, filename) {
  const fileState = store.fileData.get(filename);
  console.log('Phase', fileState.stage, 'File', filename.replace(/^\/home\/[\w\d]+/, '~'));
  switch (fileState.stage++) {
    case 0: {

      phase0(store, filename);

      // group('# AST:');
      // dir(store.fileData.get(filename).tenkoOutput.ast, {depth: null});
      // groupEnd();

      // group('\n# code');
      // log(state.code);
      // groupEnd();

      return true;
    }

    case 1: {
      phase1(store, filename);

      if (fileState.imports.size) {
        log('\nFile imported', fileState.imports.size, 'symbols. Processing their files first.');
        const files = new Set(fileState.imports.values());
        log('Importing from', files.size, 'distinct files');
        log(fileState.imports, fileState.exports);
        fileState.imports.forEach((resolvedFilename, localNameBinding) => queueFile(store, resolvedFilename, filename));
      }

      // group('\n# AST after phase 1');
      // log(showAst(state.tenkoOutput.ast, {}));
      // groupEnd();

      group('\n# code');
      log(truncCode(fileState.code));
      groupEnd();

      return true;
    }

    case 2: {
      phase2(store, filename);

      // group('\n# AST after phase 2');
      // log(showAst(state.tenkoOutput.ast, {}));
      // groupEnd();

      group('\n# code');
      log(truncCode(fileState.code));
      groupEnd();

      return true;
    }

    case 3: {

      phase3(store, filename);
      fileState.result = 'Pass';

      log('- imports:', fileState.imports);
      log('- exports:', fileState.exports);

      group('\n# code');
      log(truncCode(fileState.code));
      groupEnd();

      return true;
    }
  }

  ASSERT(false, 'fixme');
  return true;
}

function truncCode(code) {
  if (code.length < 1000) return code;
  return code.slice(0, 1000) + '\n<... rest truncated for brevity>\n';
}
