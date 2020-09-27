import main from "../src/index.mjs";
import fs from 'fs';
import path from 'path';

// Waiting for import.meta.resolve to be supported but meanwhile we can hack around it
import { createRequire } from 'module';
const require = createRequire(import.meta.url); // This is the old `require`

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('Usage: `mope -e some/entrypoint.js -v\n\n  -v   Verbose (complete trace of what happens)\n  -e   Entry point to start processing (defaults to process mope itself)\n  -h   This "help" screen');
}

const withOutput = process.argv.includes('-v');
const entryPoint = process.argv.includes('-e') ? process.argv[process.argv.indexOf('-e') + 1] : './bin/run.mjs'

console.log('- Starting analysis now...');
console.log('- Entry point:', entryPoint);

const targetFileResolved = path.resolve(entryPoint);
const code = fs.readFileSync(targetFileResolved, 'utf8');

const exportedFiles = {
  index: code,
};

const fileMaps = {}; // fromFilename -> relative filename -> normalized filename
const store = main(code, {
  entryPoint: targetFileResolved,
  stdio: withOutput ? undefined : () => {},
  resolve(filename, fromFilename) {
    // console.log('resolver(', filename, ',', fromFilename, ')');
    let result = filename;
    if (fromFilename === null) {
      result = targetFileResolved;
    } else {
      // If a filename does not start with `.` or `/` then assume it's a npm package reference and let resolve do its thing
      const toResolve = (filename.startsWith('.') || filename.startsWith('/')) ? path.join(path.dirname(fromFilename), filename) : fromFilename;
      result = require.resolve(toResolve);
    }
    if (!fileMaps[fromFilename.replace(/^\/home\/\w+\//, '~/')]) fileMaps[fromFilename.replace(/^\/home\/\w+\//, '~/')] = {};
    fileMaps[fromFilename.replace(/^\/home\/\w+\//, '~/')][filename.replace(/^\/home\/\w+\//, '~/')] = result.replace(/^\/home\/\w+\//, '~/');
    console.log('Resolving path:', filename.replace(/^\/home\/[\w\d+]+\//, '~/'), 'from', fromFilename ? fromFilename.replace(/^\/home\/[\w\d+]+\//, '~/') : '<entry point>', '-->', result.replace(/^\/home\/[\w\d+]+\//, '~/'));
    return result;
  },
  req(importPath, fromFilename) {
    // console.log('Want path:', importPath.replace(/^\/home\/[\w\d+]+\//, '~/'), 'from:', fromFilename ? fromFilename.replace(/^\/home\/[\w\d+]+\//, '~/') : '<entry point>');
    let from = importPath;
    // if (importPath === '/home/ptr/proj/tenko/src/lexer.mjs') from = '/home/ptr/proj/tenko/src/xyz.mjs'; // Reroute for testing
    const code = fs.readFileSync(from, 'utf8');
    exportedFiles[importPath.replace(/^\/home\/\w+\//, '~/')] = code;
    return code;
  },
});

fileMaps.index = fileMaps[targetFileResolved.replace(/^\/home\/\w+\//, '~/')];

console.log('- Writing case:');
fs.writeFileSync('bin/result/exported_case.js', `window.exportedCase = ${JSON.stringify({mapper: fileMaps, files: exportedFiles, only: false, skip: false})};`);
console.log('(Finished gen.mjs gracefully, you can load bin/result/exported_case.js in the UI)');
