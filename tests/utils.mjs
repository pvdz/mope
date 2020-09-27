// This file is used in web interface. Do not include nodejs specific libs (like fs)
let cases = new Map;
let hasOnly = 0;
let considerOnly = false;
let considerSkip = false;
const onlyStack = [];
const skipStack = [];
const groupStack = [];

export function getCases() {
  return cases;
}

export function serialize(input, indexPrefix) {
  // The `input` can either be;
  // - A string that starts with `////\n`
  // - An arrow whose body is the code to test
  // - An object where each key is a file for imports/exports, must at least contain an `index`, which will be the
  //   considered the entry point of the code when running the test.
  // All test cases are normalized to an object where each key is a file, containing at least index, and each value
  // will be a string. All `import` and `export` files are taken as symbols and resolved as-is on this object.

  const files = {};
  let s = '';
  if (typeof input === 'string') {
    files.index = serializeString(input);
  } else if (typeof input === 'function') {
    files.index = serializeArrow(input);
  } else if (input && typeof input === 'object') {
    if (!input.index) {
      console.log([input]);
      throw console.trace('The files object should at least contain the `index` entry point file');
    }
    Object.keys(input).forEach(key => {
      const code = input[key];
      if (typeof code === 'string') {
        files[key] = serializeString(code);
      } else if (typeof code === 'function') {
        files[key] = serializeArrow(code);
      }  else {
        console.log([input]);
        throw console.trace('The test code should be a string, an array, or an object with either for each key');
      }
    });
  } else {
    console.log([input]);
    throw console.trace('The test code should be a string, an array, or an object with either for each key');
  }

  // Deindent the code. Assume the first non-empty line of code is base indentation
  Object.keys(files).forEach(key => {
    const code = files[key];
    const lines = code.split(/\n/g);
    const indent = lines.filter(s => !!s)[0].match(/^ */)[0].length;
    files[key] = (key === 'index' ? indexPrefix : '') + lines.map(s => s.slice(0, indent).trimStart() + s.slice(indent)).join('\n');
  });

  return files;
}

function serializeString(input) {
  if (!input.startsWith('////\n')) {
    console.log([input]);
    throw console.trace('A string input should start with `////\\n`');
  }
  return input.slice(5); // dont use first line as indent
}

function serializeArrow(input) {
  const s = input.toString();
  if (!s.startsWith('() => {') || !s.endsWith('}')) throw console.trace('Arrow should serialize to fixed pattern');
  return s.replace(/`((?:import|export).*?)`/g, '$1').slice('() => {'.length, -1);
}

export function pass(desc, input, lints) {
  if (arguments.length < 2) throw console.trace('arg count; `' + desc + '`');
  if (cases.has(desc)) throw console.trace('Duplicate test name: `' + desc + '`');
  if (lints !== undefined && !Array.isArray(lints)) throw console.trace('lints should be string. probably a pass with an error type? ' + desc);

  if (considerSkip) {
    skip(desc, input, lints);
  } else {
    if (considerOnly) ++hasOnly;
    const files = serialize(input, '// ' + desc + ' \n');
    cases.set(desc, {only: considerOnly, files, lints, skip: false});
  }

  return cases;
}

export function skip(desc, input, lints) {
  if (arguments.length < 2) throw console.trace('arg count; `' + desc + '`');
  if (cases.has(desc)) throw console.trace('Duplicate test name: `' + desc + '`');
  if (lints !== undefined && !Array.isArray(lints)) throw console.trace('lints should be string. probably a pass with an error type? ' + desc);
  const files = serialize(input, '// ' + desc + ' \n');
  cases.set(desc, {only: false, files, lints, skip: true});

  return cases;
}

export function only(desc, input, lints) {
  if (arguments.length < 2) throw console.trace('arg count; `' + desc + '`');
  if (cases.has(desc)) throw console.trace('Duplicate test name: `' + desc + '`');
  if (lints !== undefined && !Array.isArray(lints)) throw console.trace('lints should be string. probably a pass with an error type? ' + desc);

  onlyStack.push(considerOnly);
  considerOnly = true;

  pass(desc, input, lints);

  considerOnly = onlyStack.pop();

  return cases;
}

export function group(desc, cb) {
  if (arguments.length !== 2) throw console.trace('arg count');
  groupStack.push(desc);
  cb();
  groupStack.pop();

  return cases;
}

group.only = only.group = function(desc, cb) {
  if (arguments.length !== 2) throw console.trace('arg count');
  onlyStack.push(considerOnly);
  considerOnly = true;
  cb();
  considerOnly = onlyStack.pop();

  return cases;
};
group.skip = skip.group = function(desc, cb) {
  if (arguments.length !== 2) throw console.trace('arg count');
  skipStack.push(considerSkip);
  considerSkip = true;
  cb();
  considerSkip = skipStack.pop();

  return cases;
};

export function onlies() { return hasOnly; }
export function getTestCases(generator) {
  cases = new Map;
  generator();

  return cases;
}
