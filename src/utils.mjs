export const RED = typeof process !== 'undefined' && process.argv.includes('-C') ? '' : '\x1b[31;1m';
export const RED_WHITE = typeof process !== 'undefined' && process.argv.includes('-C') ? '' : '\x1b[41;1m';
export const GREEN = typeof process !== 'undefined' && process.argv.includes('-C') ? '' : '\x1b[32m';
export const YELLOW = typeof process !== 'undefined' && process.argv.includes('-C') ? '' : '\x1b[33;1m';
export const BLUE = typeof process !== 'undefined' && process.argv.includes('-C') ? '' : '\x1b[34;1m';
export const PURPLE = typeof process !== 'undefined' && process.argv.includes('-C') ? '' : '\x1b[35;1m';
export const WHITE = typeof process !== 'undefined' && process.argv.includes('-C') ? '' : '\x1b[37m';
export const RESET = typeof process !== 'undefined' && process.argv.includes('-C') ? '' : '\x1b[0m';
export const DIM = typeof process !== 'undefined' && process.argv.includes('-C') ? '' : '\x1b[30;1m';
export const BOLD = typeof process !== 'undefined' && process.argv.includes('-C') ? '' : '\x1b[;1;1m';
export const TRIBE = typeof process !== 'undefined' && process.argv.includes('-C') ? '' : '\x1b[36;1m';
export const WHITE_BLACK = typeof process !== 'undefined' && process.argv.includes('-C') ? '' : '\x1b[30;47m';

export const NO_DEFAULT_VALUE = {debug: 'NO_DEFAULT_VALUE: the ast had no default value for this node'};
export const NO_SUPER_VALUE = {debug: 'NO_SUPER_VALUE: the ast had no node for the superClass'};
export const SUPER_PROP_OWNER_NOT_FOR_CLASS = {debug: 'SUPER_PROP_OWNER_NOT_FOR_CLASS: this is the class value itself which cannot be invoked so this property is useless'};
export const SUPER_PROP_OWNER_NOT_FOR_GLOBAL = {debug: 'SUPER_PROP_OWNER_NOT_FOR_GLOBAL: this is the global object which has no super owner'};
export const SUPER_PROP_OWNER_NOT_A_METHOD = {debug: 'SUPER_PROP_OWNER_NOT_A_METHOD: regular methods have no super owner'};
export const NO_SUPER_PROP_FOR_BUILTINS = {debug: 'NO_SUPER_PROP_FOR_BUILTINS: built-in functions have no super owner'};

function ASSERT(b, m = '', ...rest) {
  if (!b) {
    groupEnd(true);
    groupEnd(true);
    groupEnd(true);
    groupEnd(true);
    groupEnd(true);
    groupEnd(true);
    groupEnd(true);
    groupEnd(true);
    groupEnd(true);
    groupEnd(true);
    groupEnd(true);

    error('Assertion error happened...');
    log('ASSERTION ARGS:');
    let n = m || '<assertion without desc>';
    log(...rest.length?rest:['<assert had no further args>']);

    if (log !== console.log && typeof window !== 'undefined') {
      console.error('Assertion error happened...');
      console.log('ASSERTION ARGS:');
      console.log(...rest.length ? rest : ['<assert had no further args>']);
    }
    console.trace(n + '; ' + rest.join(', '));
    throw new Error(n);
  }
}
function ASSERT_LOC(loc) {
  ASSERT(typeof loc === 'object' && loc, 'loc should be an object', loc);
  ASSERT(typeof loc.filename === 'string', 'loc filename must be a string', loc);
  ASSERT(typeof loc.column === 'number' && loc.column >= 0, 'loc filename must be a number >=0', loc);
  ASSERT(typeof loc.line === 'number' && loc.line >= 1, 'loc filename must be a number >0', loc);
}
function ASSERT_TID(tid, ...optional) {
  // Certain special tids should only appear in selected contexts and should not leak outside of those contexts
  // ASSERT(!Array.isArray(tid), 'tids should not be arrays', tid);
  ASSERT(typeof tid === 'string' /*|| tid === NO_SUPER_VALUE*/ || optional.includes(tid), 'a tid should be a string or one of a few predefined constants', [tid, optional]);
  // if (!optional.includes('H')) ASSERT(tid[0] !== 'H', 'not expecting placeholders on the stack', tid);
  return true;
}

function printNode(node) {
  ASSERT(node);
  ASSERT(node.type);
  switch (node.type) {
    case 'Identifier':
      return `<<${node.name}>>`;
    case 'Literal':
      return `<${node.raw}>`;
    case 'MemberExpression':
      return `${printNode(node.object)}.${printNode(node.property)}`;
    case 'CallExpression':
      return `${printNode(node.callee)}(${node.arguments.map(printNode).join(', ')})`;
    case 'FunctionDeclaration':
    case 'FunctionExpression':
      return `function${node.id ? ' ' + printNode(node.id) : ''}(${node.params.map(printNode).join(', ')})`;
    case 'ThisExpression':
      return 'this';
    case 'Super':
      return 'super';
    case 'AssignmentPattern':
      ASSERT(node.left.type === 'Identifier', 'todo, fixme if this is different');
      return printNode(node.left)+'='+printNode(node.right);
    case 'NewExpression':
      return 'new ' + printNode(node.callee) + '(' + node.arguments.map(printNode).join(', ') + ')';
    default:
      return `<???${node.type}>`;
  }
  // return `${t}${path.nodes[i].name ? '<' + path.nodes[i].name + '>' : ''}${t === 'Literal' ? '<' + path.nodes[i].raw + '>' : ''}${path.props[i+1] && `[${path.props[i+1]}]` || ''}`
}

const VERBOSE = true;

const Console = {
  log: (...args) => console.log(...args),
  error: (...args) => console.error(...args),
  group: (...args) => console.group(...args),
  groupEnd: (...args) => console.groupEnd(...args),
  dir: (...args) => console.dir(...args),
}

function setStdio(handler) {
  Console.log = (...args) => handler('L', ...args);
  Console.error = (...args) => handler('E', ...args);
  Console.group = (...args) => handler('G', ...args);
  Console.groupEnd = (...args) => handler('F', ...args);
  Console.dir = (...args) => handler('D', ...args);
}

function clearStdio() {
  Console.log = (...args) => console.log(...args);
  Console.error = (...args) => console.log(...args);
  Console.group = (...args) => console.group(...args);
  Console.groupEnd = (...args) => console.groupEnd(...args);
  Console.dir = (...args) => console.dir(...args);
}

let indent = 0;
function log(...args) {
  if (VERBOSE) return Console.log(...args);
}
function error(...args) {
  if (VERBOSE) return Console.error(...args);
}
function group(...args) {
  ++indent;
  if (VERBOSE) return Console.group(...args);
}
function groupEnd(...args) {
  --indent;
  if (VERBOSE) return Console.groupEnd(...args);
}
function dir(...args) {
  if (VERBOSE) return Console.dir(...args);
}

function tstr(tid) {
  if (typeof tid === 'string') return RED + tid + RESET;
  if (tid === NO_DEFAULT_VALUE) return PURPLE + '`NO_DEFAULT_VALUE`' + RESET;
  if (tid === NO_SUPER_VALUE) return PURPLE + '`NO_SUPER_VALUE`' + RESET;
  if (tid === SUPER_PROP_OWNER_NOT_FOR_CLASS) return PURPLE + '`SUPER_PROP_OWNER_NOT_FOR_CLASS`' + RESET;
  if (tid === SUPER_PROP_OWNER_NOT_FOR_GLOBAL) return PURPLE + '`SUPER_PROP_OWNER_NOT_FOR_GLOBAL`' + RESET;
  if (tid === SUPER_PROP_OWNER_NOT_A_METHOD) return PURPLE + '`SUPER_PROP_OWNER_NOT_A_METHOD`' + RESET;
  if (tid === NO_SUPER_PROP_FOR_BUILTINS) return PURPLE + '`NO_SUPER_PROP_FOR_BUILTINS`' + RESET;
  return PURPLE + '`' + tid + '`' + RESET;
}

function ASSERT_SUPER_PROP_OWNER(v) {
  ASSERT(v === NO_SUPER_VALUE || v === NO_SUPER_PROP_FOR_BUILTINS || v === SUPER_PROP_OWNER_NOT_A_METHOD ||  v === SUPER_PROP_OWNER_NOT_FOR_CLASS || v === SUPER_PROP_OWNER_NOT_FOR_GLOBAL || typeof v === 'string', 'super prop owner is a particular set of values but not this one', v);
}

export function createPlaceholder(store, tidPrefix, desc) {
  ASSERT(typeof tidPrefix === 'string' && tidPrefix[0] === 'H', 'the tid should start with an H');
  const pid = tidPrefix + String(++store.uid); // placeholder id (holder, array, kind)
  const props = new Map;
  store.set(pid, {
    _class: 'placeholder',
    tid: pid,
    type: 'H',
    props: props,
    setProp(name, tid) { this.props.set(name, tid); return tid; },
    seen: new Map,
    placeholder: true,
    alias: null,
  });
  log('Created a placeholder tee', tstr(pid), 'for', desc);
  return pid;
}
export function createArrayTid(store) {
  return 'A' + String(++store.uid);
}
export function createClassTid(store) {
  return 'C' + String(++store.uid);
}
export function createFuncoTid(store) {
  return 'F' + String(++store.uid);
}
export function createMapTid(store) {
  return 'M' + String(++store.uid);
}
export function createObjectTid(store) {
  return 'O' + String(++store.uid);
}
export function createSetTid(store) {
  return 'S' + String(++store.uid);
}

function getIndent() {
  // To assert proper group open/close paths
  return indent;
}

export {
  ASSERT,
  ASSERT_LOC,
  ASSERT_TID,
  ASSERT_SUPER_PROP_OWNER,

  clearStdio,
  dir,
  group,
  groupEnd,
  log,
  printNode,
  setStdio,
  tstr,
  getIndent,
};
