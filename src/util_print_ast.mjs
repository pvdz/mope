import Prettier from '../lib/prettier.mjs';

import walk from './walk.mjs';

export function showAst(ast, {pruneProps = ['loc', '$scope', '$uid']}) {
  // This will reorder the keys of the AST (will deopt a bit due to the deletes)
  walk((node, before) => {
    if (!before) {
      Object.getOwnPropertyNames(node).sort((a,b) => {
        return (
          a==='type' ? -1 : b==='type' ? 1
            : a==='zz'   ? -1 : b==='zz'   ? 1
              : a==='id'   ? -1 : b==='id'   ? 1
                : a==='params'?-1 : b==='params'?1
                  : a==='superClass'?-1 : b==='superClass'?1
                    : a < b ? -1 : a===b ? 0 : 1
        )
      }).forEach(k => {
        let v = node[k];
        delete node[k];
        node[k] = v;
      });
    }
  }, ast, 'ast');

  let json = JSON.stringify(ast, (p,v) => {
    if (pruneProps && pruneProps.includes(p)) {
      return undefined;
    }
    if (p === 'explicitReturns' && v === '') {
      return undefined;
    }
    if (p === 'returnTids') {
      return undefined;
    }
    return v;
  });

  if (typeof Prettier === 'undefined') return json;

  // If you have no prettier installed then ignore this step. It's not crucial.
  // log(util.inspect(ast, false, null))
  // node_modules/.bin/prettier --no-bracket-spacing  --print-width 180 --single-quote --trailing-comma all --write <dir>
  return Prettier.format('(' + json + ')', {
    printWidth: 180,
    tabWidth: 2,
    useTabs: false,
    semi: false,
    singleQuote: true,
    trailingComma: 'all',
    bracketSpacing: false,
    parser: 'babylon',
  }).replace(/(?:^;?\(?)|(?:\)[\s\n]*$)/g, '').replace(/'([\w\d$]+)':/g, '$1:');
}
