import {TenkoError} from './error_tenko.mjs';
import {
  BLUE,
  GREEN,
  RED,
  RESET,
  WHITE,
  YELLOW,

  ASSERT,
  clearStdio,
  dir,
  group,
  groupEnd,
  log,
  printNode,
  setStdio,
} from './utils.mjs';
// import * as Tenko from '../node_modules/tenko/build/tenko.prod.mjs'; // This way it works in browsers and nodejs ... :/
import * as Tenko from '../lib/tenko.prod.mjs'; // This way it works in browsers and nodejs and github pages ... :/

if (typeof window !== 'undefined') window.Tenko = Tenko; // Expose symbols for UI

export function phase0(store, filename) {
  group('\n\n\n##################################\n## phase0  ::  ' + filename + '\n##################################\n\n\n');

  const fileState = store.fileData.get(filename);
  const code = fileState.code;

  log('- Parsing code with Tenko...');

  try {
    fileState.tenkoOutput = Tenko.Tenko(code, {
      exposeScopes: true,
      astUids: true,
      collectTokens: Tenko.COLLECT_TOKENS_ALL,
      goalMode: Tenko.GOAL_MODULE,
      tokenStorage: [],
    });
  } catch (e) {
    throw new TenkoError(e);
  }

  log('- Finished parsing');

  fileState.tokens = fileState.tenkoOutput.tokens;

  // Create a lookup table, rowxcol -> token, so we can map AST nodes to their tokens. Hopefully.
  // Also adds a property to uniquely identify the token based on its position in the token stream.
  fileState.tokenTable = new Map(fileState.tenkoOutput.tokens.map((token, i) => {
    token.n = i;
    token.str = code.slice(token.start, token.stop);
    return [token.column + 'x' + token.line, token]
  }));


  if (store.options.onParse) store.options.onParse(filename, fileState.tenkoOutput, fileState.tokenTable);

  groupEnd();
}
