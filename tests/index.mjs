// ran on node 10 (because 12 requires .mjs for import), to tun these tests simply:
// `node --experimental-modules tests/index.mjs`

// requires a node with esm support
// node --experimental-modules tests/index.mjs
import main from "../src/index.mjs";
import * as testGenerators from './cases/index.mjs';
import {onlies, getTestCases} from './utils.mjs';

const RED = '\x1b[31;1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const BLUE = '\x1b[34;1m';
const WHITE = '\x1b[37m';
const BOLD = '\x1b[;1;1m';
const RESET = '\x1b[0m';
const WHITE_BLACK = '\x1b[30;47m';

const GOOD = '\x1b[40m 🙂 \x1b[0m';
const BAD = '\x1b[41m 👎 \x1b[0m';
Error.stackTraceLimit = Infinity;

function test({files, caseIndex, caseCount, desc, lints = [], withOutput = false, ...other}) {
  if (JSON.stringify(other) !== '{}') {
    console.log('received these unexpected args:', other);
    test_arg_count
  }

  const code = '// ' + caseIndex + ' / ' + caseCount + '\n' + files.index; // .index is the main entry point

  console.log('############################################################################## start of test', caseIndex, '/', caseCount, '[', desc, ']');
  if (withOutput) {
    console.log('code:');
    console.log(code);
    console.log('############################################################################## start of test', caseIndex, '/', caseCount, '[', desc, ']');
    console.group();
  }

  let msg = '';
  let lastError = false;
  let store;
  try {
    store = main(code, {
      entryPoint: 'index',
      stdio: withOutput ? undefined :() => {},
      req: (importPath) => {
        return '// path: ' + importPath + '\n' + files[importPath];
      },
    });
  } catch (e) {
    lastError = e;
  }

  // console.log('-->', store)

  // let rest;
  // {
  //   const {tokens, tokenTable, tenkoOutput, ...r} = result;
  //   rest = r;
  //   console.log({tokens:'<...>', tokenTable:'<...>', tokens:'<...>', ...rest})
  // }
  if (withOutput) {
    console.groupEnd();
  }

  if (lastError) {
    if (!withOutput) {
      console.log(WHITE_BLACK + 'Test crashed, re-running it with output' + RESET);
      return test({files, caseIndex, caseCount, desc, lints, withOutput: true});
    }

    console.error('Error: ' + lastError.message);

    // Collapse the console.group indent because it was cut-off at an unknown indentation level. We can only reset it to zero now.
    for (let i=0; i<20;++i) console.groupEnd();

    console.log('############################################################################## end of test', caseIndex, '/', caseCount, '[', desc, ']');

    console.log(`TEST ${RED}FAIL${RESET} Threw an error`);
    console.log(lastError.stack)
    throw new Error();
  }

  // For now we won't bother to (indicate in the) test which file triggered the lint.
  const lintMessages = store && store.linter.getMessages().map(o => o.type);

  // const lintMessages = result.lint.getMessages();
  const actualLints = lintMessages.length ? lintMessages.join(' , ') : '<none>';
  const expectLints = lints.length ? lints.join(' , ') : '<none>';

    if (withOutput) {
      console.log('############################################################################## end of test', caseIndex, '/', caseCount, '[', desc, ']');
      console.log('code:');
      store.fileData.forEach(fd => {
        if (fd.filename !== '<builtin>') {
          if (store.fileData.size > 2) console.log('###########################\n## File:', fd.filename, '\n###########################');
          console.log(fd.code);
        }
      });
      console.log('############################################################################## end of test', caseIndex, '/', caseCount, '[', desc, ']');
    }
  if (expectLints === actualLints) {

    console.log('@@ End of test; TEST '+GREEN+'PASS'+RESET+': expectations were met\n');
    if (withOutput) console.log('');
  } else {
    if (!withOutput) {
      console.log(WHITE_BLACK + 'Test did not pass, re-running it with output' + RESET);
      return test({files, caseIndex, caseCount, desc, lints, withOutput: true});
    }

    if (expectLints !== actualLints) {
      console.log(`${msg}${(msg ? '\n' : '')}Expected lints do not match actual lints: Expected: ${expectLints}. Actual: ${BOLD + actualLints + RESET}
Copy pasta:
${desc}
}, ${lintMessages.length ? '[' + lintMessages.map(s => "'" + s + "'").join(', ') + ']' : '[]'});
  `
      );
      console.log(`TEST ${RED}FAIL${RESET} Did not throw but had a ${BOLD}lint${RESET} mismatch`);
      throw new Error();
    }
  }
}

const cases = [].concat(
  ...Object.keys(testGenerators).map(desc => [...getTestCases(testGenerators[desc])])
);

cases.forEach(([desc, {files, only, lints, skip}], caseIndex) => {
  if (skip) {
    return;
  }
  if (onlies() && !only) {
    // At least one case was prefixed with `only` so ignore non-prefixed cases
    return;
  }

  test({files, caseIndex, caseCount: cases.length, desc, lints, withOutput: onlies() === 1});
})

console.log(`Suite finished, ${GREEN}all ${cases.length} tests passed${RESET}, wow, you must be skipping a few ;)`);

