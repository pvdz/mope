// import * as Tenko from '../node_modules/tenko/build/tenko.prod.mjs'; // This way it works in browsers and nodejs ... :/
import * as Tenko from '../lib/tenko.prod.mjs'; // This way it works in browsers and nodejs and github pages ... :/

import {
  ASSERT,
  DIM,
  BOLD,
  RESET,
  BLUE,

  NO_SUPER_VALUE,

  dir,
  group,
  groupEnd,
  log,
  printNode, tstr, NO_DEFAULT_VALUE, createPlaceholder,
} from "./utils.mjs"

// Functions have been hoisted, scopes have been resolved, time to merge AST nodes and leave as few nodes as possible
// without actually interpreting code.
// For example, return statement return value tid get merged with the return keyword and the whole statement node.

export function phase2(store, filename) {
  const fileState = store.fileData.get(filename);
  const {tokens, tokenTable} = fileState;
  const linter = store.linter;

  const lexScopeStack = [];
  const rootScopeStack = [];
  const superCallStack = []; // `super()` is validated by the parser so we don't have to worry about scoping rules

  group('\n\n\n##################################\n## phase2  ::  ' + filename + '\n##################################\n\n\n');

  let actions = [];
  stmt(fileState.tenkoOutput.ast);
  $(fileState.tenkoOutput.ast, '@log', 'End of Program');
  fileState.globalActions = actions;

  log('\nCompiled actions:');
  dir(actions, {depth: null});
  log('\nprint friendly actions:');
  const printFriendly = actions.slice(0,20).map(function r(action, _, __, indent = '  ') {
    if (action[0] === '@func') {
      return indent + action[0] + ',' + action[3].slice(0, 5) + ', ' + action[3].slice(7).join(', ') + action.slice(4).join(', ') + ':\n' + action[3][6].map(a => r(a, _, __, indent + '  ')).join('\n');
    }
    return indent + action.join(', ');
  }).join('\n').split('\n');
  log('\n' + printFriendly.slice(0, 100).join('\n'), printFriendly.length >= 100 ? '(... ' + (printFriendly.length - 100) + ' more actions suppressed...)' : '');

  groupEnd();

  function $(node, action, ...args) {
    const {loc: {start: {column, line}}} = node;
    actions.push([action, column, line, args]);
  }
  function _$(node, action, ...args) {
    const {loc: {start: {column, line}}} = node;
    actions.unshift([action, column, line, args]);
  }

  function getFirstToken(node) {
    ASSERT(node, 'getFirstToken wants a node', node);
    const token = tokenTable.get(node.loc.start.column + 'x' + node.loc.start.line);
    ASSERT(token, 'each ast node should be able to find the first token of that node', node, token);
    return token;
  }
  function getPrevTokenPastGroupAndSpaces(node) {
    const tokenRhs = getFirstToken(node);
    let tokenPrev = tokens[tokenRhs.n - 1];
    while (tokenPrev && (Tenko.isWhiteToken(tokenPrev.type) || tokenPrev.str === '(')) {
      tokenPrev = tokens[tokenPrev.n - 1];
    }
    ASSERT(tokenPrev, 'should have found a token', tokenPrev);
    return tokenPrev;
  }

  function findUniqueNameForBindingIdent(node, startAtPArent = false) {
    ASSERT(node && node.type === 'Identifier', 'need ident node for this', node);
    log('Finding unique name for `' + node.name + '`');
    let index = lexScopeStack.length;
    if (startAtPArent) --index; // For example: func decl id has to be looked up outside its own inner scope
    while (--index >= 0) {
      // log('- lex level', index,':', lexScopeStack[index].$z.nameMapping.has(node.name));
      if (lexScopeStack[index].$z.nameMapping.has(node.name)) {
        break;
      }
    }
    if (index < 0) {
      log('The ident `' + node.name + '` could not be resolved');
      linter.check('IMPLICIT_GLOBAL', {filename, column: node.loc.start.column, line: node.loc.start.line}, node.name);
      // Register one...
      log('Creating global binding for `' + node.name + '` now');
      lexScopeStack[0].$z.nameMapping.set(node.name, node.name);
      index = 0;
    }
    const uniqueName = lexScopeStack[index].$z.nameMapping.get(node.name);
    ASSERT(uniqueName !== undefined, 'should exist');
    log('Should be bound in scope index', index, 'mapping to `' + uniqueName + '`');
    return uniqueName;
  }

  function stmt(node, isExport = false) {
    group(DIM + 'stmt(' + RESET + BLUE + node.type + RESET + DIM + ')' + RESET);

    if (node.$scope || (node.type === 'TryStatement' && node.handler)) {
      if (node.$scope) lexScopeStack.push(node);
      else lexScopeStack.push(node.handler);
      if (['Program', 'FunctionExpression', 'ArrowFunctionExpression', 'FunctionDeclaration'].includes(node.type)) {
        rootScopeStack.push(node);
      }
    }

    switch (node.type) {
      case 'BlockStatement': {
        node.body.forEach(node => stmt(node));
        break;
      }

      case 'BreakStatement': {
        // TODO: is there anything regarding labels our system can deal with that regular parsers can't?
        break;
      }

      case 'ClassDeclaration': {
        processClass(node, false, isExport);
        break;
      }

      case 'ContinueStatement': {
        // TODO: is there anything regarding labels our system can deal with that regular parsers can't?
        break;
      }

      case 'DebuggerStatement': {
        break;
      }

      case 'DoWhileStatement': {
        stmt(node.body);

        expr(node.test);
        $(node, '@condition');

        break;
      }

      case 'ExportAllDeclaration': {
        // export * from 'foo'
        const source = node.source.value;
        ASSERT(typeof source === 'string');
        store.linter.check('TOFIX', {filename, column: node.loc.start.column, line: node.loc.start.line}, 'todo_export_star');
        break;
      }

      case 'ExportDefaultDeclaration': {
        // export default expr
        // export default function(){}
        // export default class(){}

        // Note: imports/exports are not properly tracked. Only do the effort to cover executed code for now.

        if (node.declaration.type === 'FunctionDeclaration' || node.declaration.type === 'ClassDeclaration') {
          log('Export defaulting a function or class. Treating it a regular declaration that exports as `default`.');
          // It's kind of relevant to parse them as statements because of how their id gets bound
          stmt(node.declaration, 'default');
        } else {
          expr(node.declaration);
          $(node, '@dup', '<export default value>');
          $(node, '@export_as', 'default');
        }
        break;
      }

      case 'ExportNamedDeclaration': {
        // These have a declaration and no specifiers:
        // - export function f (){}
        // - export class g {}
        // - export let a
        // - export const b = 1
        // - export var c = 2

        // These have specifiers and no declaration. One specifier per exported symbols.
        // Type of export may affect type of specifier node
        // - var d,e; export {d,e}
        // - export {x}
        // - export {x as y}
        // - export x from 'foo'
        // - export {x} from 'foo'
        // - export * as y from 'foo'     (not same as only *)
        // - export {x as z} from 'foo'

        if (node.source) {
          // export ... from
          store.linter.check('TOFIX', locFrom, callerTee.tid);
        } else if (node.declaration) {
          if (node.declaration.type === 'FunctionDeclaration' || node.declaration.type === 'VariableDeclaration' || node.declaration.type === 'ClassDeclaration') {
            stmt(node.declaration, true);
          } else {
            ASSERT(false, 'fixme', node);
          }
        } else {
          node.specifiers.forEach(snode => {
            ASSERT(snode.local.type === 'Identifier', 'fixme if different', snode);
            ASSERT(snode.exported.type === 'Identifier', 'fixme if different', snode);

            $(snode.local, '@ident', snode.local.name);
            getFirstToken(snode.local).tlog = [];
            $(snode, '@export_as', snode.exported.name);
          });
        }
        break;
      }

      case 'ExpressionStatement': {
        expr(node.expression);
        $(node, '@drop'); // Ignore the type of the expression
        break;
      }

      case 'EmptyStatement': {
        break;
      }

      case 'ForStatement': {
        if (node.init) {
          if (node.init.type === 'VariableDeclaration') {
            stmt(node.init);
          } else {
            expr(node.init); // TODO: what about var/let/const here?
            $(node, '@drop');
          }
        }
        if (node.test) {
          expr(node.test);
          $(node, '@condition');
        }
        if (node.update) {
          expr(node.update);
          $(node, '@drop');
        }
        stmt(node.body);
        break;
      }

      case 'ForInStatement': {
        $(node, '@push', 'string'); // Init the binding to a string; it'll receive property names

        if (node.left.type === 'VariableDeclaration') {
          ASSERT(node.left.declarations.length === 1, 'I think this is syntactically enforced?');
          ASSERT(node.left.declarations[0].type === 'VariableDeclarator');
          const id = node.left.declarations[0].id;
          ASSERT(id && id.type === 'Identifier');
          ASSERT(!node.left.declarations[0].init, 'for-in lhs should not be allowed to have an init');

          log('For-in lhs:');
          const uniqueName = findUniqueNameForBindingIdent(id);
          $(id, '@binding', uniqueName, node.left.kind);
        } else {
          expr(node.left);
          $(node, '@merge');
          $(node, '@drop');
        }

        expr(node.right);
        $(node, '@lint', 'primitive', 'FOR_IN_RHS_PRIMITIVE');
        $(node, '@drop');

        stmt(node.body);
        break;
      }

      case 'ForOfStatement': {
        // TODO: This needs proper support for iterable stuff for true support. We could start with superficial support.
        if (node.await) store.linter.check('TOFIX', {filename, column: node.loc.start.column, line: node.loc.start.line}, 'todo_for_await');

        // Get the kind of the type of the rhs. Initially, that means string for strings and kind for arrays.
        expr(node.right);
        $(node, '@of');

        if (node.left.type === 'VariableDeclaration') {
          ASSERT(node.left.declarations.length === 1, 'I think this is syntactically enforced?');
          ASSERT(node.left.declarations[0].type === 'VariableDeclarator');
          const id = node.left.declarations[0].id;
          ASSERT(id && id.type === 'Identifier');
          ASSERT(!node.left.declarations[0].init, 'for-in lhs should not be allowed to have an init');

          log('For-of lhs:');
          const uniqueName = findUniqueNameForBindingIdent(id);
          $(id, '@binding', uniqueName, node.left.kind);
        } else {
          expr(node.left);
          $(node, '@merge');
          $(node, '@drop');
        }

        stmt(node.body);
        break;
      }

      case 'FunctionDeclaration': {
        let abak = actions;
        actions = []

        $(node, '@log', 'start of func decl ' + (node.id ? node.id.name : '{anon}'));

        $(node, '@this'); // Top of the stack ought to be the context
        $(node, '@arguments');

        const {minParamRequired, hasRest, paramBindingNames} = processFuncArgs(node);

        $(node, '@body_start');

        stmt(node.body);

        log('The explicitReturns value for its body is:', [node.body.$z.explicitReturns]);
        if (node.body.$z.explicitReturns !== 'yes') {
          // Implicitly return `undefined`
          $(node, '@push', 'undefined');
          $(node, '@return');
        }

        let funcActions = actions;
        actions = abak;

        if (node.id) {
          group('Function decl id:');
          const uniqueName = findUniqueNameForBindingIdent(node.id, true);
          groupEnd();

          _$(node.id, '@binding', uniqueName, 'lex');
        }
        else store.linter.check('TOFIX', {filename, column: node.loc.start.column, line: node.loc.start.line}, 'todo_export_default_without_name'); // I mean this'll just crash? :)

        // For functions, focus on the `function` keyword
        let funcToken = getFirstToken(node);
        while (funcToken && (funcToken.str === 'export' || funcToken.str === 'default' || Tenko.isWhiteToken(funcToken.type))) {
          funcToken = tokens[funcToken.n + 1];
        }
        ASSERT(funcToken.str === 'function', 'pretty sure this is an invariant', funcToken);
        funcToken.tlog = [];


        if (isExport) {
          ASSERT(node.id, 'exported functions (not by default) must have an id as per syntax');
          log('Registering as exported default value');
          _$(node, '@export_as', isExport === true ? node.id.name : 'default');
          _$(node, '@dup', '(exported func value)'); // Note: _$ is reverse order
        }

        const desc = 'Function<' + (node.id ? node.id.name : '<anon>') + ': line ' + node.loc.start.line + ', column ' + node.loc.start.column + '>';
        _$(node, '@func', 'N' + node.$z.tid + '=' + (node.id ? node.id.name : 'anon'), node.id ? node.id.name : '', node.params.map(node => node.name), paramBindingNames, hasRest, minParamRequired, funcActions, 'decl', !!node.$z.thisAccess, node.$z.reachableNames, funcToken.n, filename, node.loc.start.column, node.loc.start.line, desc);

        break;
      }

      case 'IfStatement': {
        expr(node.test);
        $(node, '@condition');

        stmt(node.consequent);
        if (node.alternate) stmt(node.alternate);

        break;
      }

      case 'ImportDeclaration': {

        const source = node.source;
        ASSERT(typeof source.value === 'string', 'source should be a string', node);
        ASSERT(typeof store.options.resolve === 'function' || store.options.resolve === undefined, 'resolve should be a func or unset', store.options);
        const from = store.resolve(source.value, filename);

        node.specifiers.forEach(snode => {
          const local = snode.local;
          ASSERT(local && local.type === 'Identifier', 'local should be an ident', snode);
          const uniqueName = findUniqueNameForBindingIdent(local); // I dont think this is ever different, but w/e


          switch (snode.type) {
            case 'ImportDefaultSpecifier': {
              // import x from 'y'
              log('Importing the default export from `0' + from + '` as `' + local.name + '` (-> `' + uniqueName + '`)');
              $(snode, '@import_binding', uniqueName, 'default', from);
              break;
            }
            case 'ImportSpecifier': {
              // import {x} from 'y'       // local === imported
              // import {x,y,z} from 'y'   // will be three individual specifier nodes
              // import {x as y} from 'y'

              const imported = snode.imported;
              ASSERT(imported && imported.type === 'Identifier', 'each specifier should have exactly one imported symbol', snode);
              log('Importing the exported symbol `' + imported.name + '` from `' + from + '` as `' + local.name + '` (-> `' + uniqueName + '`)');
              $(snode, '@import_binding', uniqueName, imported.name, from);
              break;
            }
            case 'ImportNamespaceSpecifier': {
              // import * as x from 'y'
              log('Importing all exports from module `' + from + '` as an object in `' + local.name + '` (-> `' + uniqueName + '`)');
              $(snode, '@import_star', uniqueName, from);
              break;
            }
            default: {
              ASSERT(false, 'fixme');
            }
          }
        });

        break;
      }

      case 'Program': {
        node.body.forEach(node => stmt(node));
        break;
      }

      case 'ReturnStatement': {
        if (node.argument) expr(node.argument);
        else $(node, '@push', 'undefined');
        $(node, '@return'); // Assumes an (implicit or explicit) arg is pushed
        break;
      }

      case 'TryStatement': {
        stmt(node.block);
        if (node.handler) {

          if (node.handler.param) {
            log('Processing catch clause');
            // Catch clause is present. Register the binding.
            ASSERT(node.handler.param.type === 'Identifier', 'todo catch clauses that are not idents', node.handler.param);
            const uniqueName = findUniqueNameForBindingIdent(node.handler.param);
            // This is a weakness in our model ... We may need to restrict what kind of values can be thrown. Or only
            // allow the error object to be considered an instance of Error. We can disallow throwing anything else
            // so that leaves built in errors and they all subclass Error, so Error is the common denominator.

            // So here we will initialize the catch var as an Error instance and that's it.
            $(node.handler.param, '@push', 'Error.prototype');
            $(node.handler.param, '@obj', ['__proto__']);
            // And this will be the init value of the binding
            $(node.handler.param, '@binding', uniqueName, 'let'); // TODO: let? I think so :)
          }
          stmt(node.handler.body);
        }
        if (node.finalizer) {
          stmt(node.finalizer);
        }
        break;
      }

      case 'SwitchStatement': {
        expr(node.discriminant);
        node.cases.forEach(cnode => {
          // Defaults have no test
          if (cnode.test) {
            // All cases must have test for same type as discriminant (switch value)
            expr(cnode.test);
            $(cnode.test, '@merge'); // pop the test and the discriminant, merge them, result will be pushed to be the new discriminant. it is dropped later.
          }
          cnode.consequent.forEach(stmt);
        });
        $(node, '@drop'); // drop the discriminant
        break;
      }

      case 'ThrowStatement': {
        expr(node.argument);
        $(node, '@drop');
        break;
      }

      case 'VariableDeclaration': {
        const kind = node.kind;
        node.declarations.forEach(dnode => {
          if (dnode.init) {
            expr(dnode.init);
          } else {
            const pid = createPlaceholder(store, 'HB', 'binding `' + dnode.id ? dnode.id.name : '<destruct>' + '` without init');
            linter.check('BINDING_NO_INIT', {filename, column: dnode.id.loc.start.column, line: dnode.id.loc.start.line}, dnode.id.name);
            log('Created placeholder', tstr(pid), 'for the binding');
            $(dnode, '@push', pid);
          }

          // The paramNode can be either an Identifier or a pattern of sorts
          if (dnode.id.type === 'Identifier') {
            // Simple case. Create the binding and be done.

            log('Var decl id:');
            const uniqueName = findUniqueNameForBindingIdent(dnode.id);

            if (isExport) {
              $(dnode, '@dup', '<exported binding decl>');
              $(dnode, '@export_as', isExport === true ? uniqueName : 'default');
            }

            $(dnode, '@binding', uniqueName, kind);
          } else if (dnode.id.type === 'ArrayPattern') {
            // Complex case. Sort out the final param value vs default, then walk through the destructuring pattern.

            if (isExport) store.linter.check('TOFIX', {filename, column: node.loc.start.column, line: node.loc.start.line}, 'exported array pattern');

            linter.check('ARRAY_PATTERN_UNSOUND', {filename, column: dnode.id.loc.start.column, line: dnode.id.loc.start.line});

            // Next we are going to pushpop the top value recursively to process all parts of the pattern

            dnode.id.elements.forEach(node => destructBindingArrayElement(node, kind));

            $(dnode, '@drop'); // Drop the param array value. It should still be here and we don't need it anymore.
          } else {
            // Complex case. Sort out the final param value vs default, then walk through the destructuring pattern.

            if (isExport) store.linter.check('TOFIX', {filename, column: node.loc.start.column, line: node.loc.start.line}, 'exported object pattern');

            ASSERT(dnode.id.type === 'ObjectPattern', 'fixme if else', dnode.id);

            // Next we are going to pushpop the top value recursively to process all parts of the pattern

            dnode.id.properties.forEach(ppnode => destructBindingObjectProp(ppnode, dnode.id, kind));

            $(dnode, '@drop'); // Drop the param value. It should still be here and we don't need it anymore.
          }

        });
        break;
      }

      case 'WhileStatement': {
        expr(node.test);
        $(node, '@condition');

        stmt(node.body);

        break;
      }

      default: {
        log('unknown statement node:', node);
        log('Missing support for stmt ' + node.type);
        throw new Error('Missing support for stmt ' + node.type)
      }
    }

    if (node.$scope || (node.type === 'TryStatement' && node.handler)) {
      lexScopeStack.pop();
      if (['Program', 'FunctionExpression', 'ArrowFunctionExpression', 'FunctionDeclaration'].includes(node.type)) {
        rootScopeStack.pop();
      }
    }

    groupEnd();
  }
  function expr(node, isMethod = false, isCallee = false, methodName = '') {
    // Every call should take nothing from the stack and leave one type on the stack

    group(DIM + 'expr(' + RESET + BLUE + node.type + RESET + DIM + ')' + RESET);

    if (node.$scope) {
      lexScopeStack.push(node);
      if (['Program', 'FunctionExpression', 'ArrowFunctionExpression', 'FunctionDeclaration'].includes(node.type)) {
        rootScopeStack.push(node);
      }
    }

    switch (node.type) {
      case 'ArrayExpression': {
        if (node.elements.length === 0) {
          log('Empty array, pushing a placeholder to the stack');

          const pid = 'HEAK' + String(++store.uid); // placeholder id (holder, empty, array, kind)
          store.set(pid, {_class: 'placeholder', tid: pid, type: 'H', props: new Map, seen: new Map, placeholder: true, alias: null});
          log('Created a placeholder tee for kind:', tstr(pid));

          $(node, '@push', pid);
        } else {
          for (let i=0; i<node.elements.length; ++i) {
            const elNode = node.elements[i];
            if (elNode.type === 'SpreadElement') {
              // Special case spread because its behavior differs per parent case
              expr(elNode.argument);
              // Stack should now have an array and the owner array should have its kind merged like all other elements
              $(node, '@kind', '<empty array literal>'); // Ignore if the array is empty... (in that case dup the stack)
            } else {
              expr(elNode);
            }
          }
        }
        $(node, '@arr', Math.max(1, node.elements.length));
        break;
      }

      case 'AssignmentExpression': {

        // Get the starting tokens;
        // - left (either the property name or the binding ident)
        // - operator (the first non-space token left of node.right
        // - right (first token of the value being assigned)

        const tokenOp = getPrevTokenPastGroupAndSpaces(node.right);
        ASSERT(tokenOp.str.slice(-1) === '=', 'should have found the assign op', tokenOp);
        tokenOp.tlog = [];

        expr(node.right);

        if (node.left.type === 'MemberExpression') {
          if (node.left.computed) {
            // No warning yet; this may be
            // - an indexed array assignment
            // - a primitve update
            // - a object-as-map half-supported update
            // Some warning will be shown by dyn_set
            expr(node.left.object);
            expr(node.left.property);
            $(node, '@dyn_set', tokenOp.n);
          } else {
            expr(node.left.object);
            $(node, '@set', node.left.property.name, tokenOp.n);
          }
        } else {
          // TODO: patterns

          const uniqueName = findUniqueNameForBindingIdent(node.left);
          $(node, '@assign', uniqueName, node.operator, tokenOp.n);
        }

        break;
      }

      case 'ArrowFunctionExpression': {
        let abak = actions;
        actions = [];

        $(node, '@log', 'start of arrow');

        $(node, '@drop'); // Drop the context of the call. Arrows inherit this from their parent function.

        const {minParamRequired, hasRest, paramBindingNames} = processFuncArgs(node);

        $(node, '@body_start');

        if (node.expression) {
          expr(node.body);
          $(node, '@return');
        } else {
          stmt(node.body);
          log('The explicitReturns value for its body is:', [node.body.$z.explicitReturns]);
          if (node.body.$z.explicitReturns !== 'yes') {
            // Implicitly return `undefined`
            $(node, '@push', 'undefined');
            $(node, '@return');
          }
        }

        let funcActions = actions;
        actions = abak;

        // For arrows, focus on the `=>` token. A little annoying since we have to skip an arbitrary header
        // but we can use the body node as an offset and seek backwards to find the `=>` token.
        // For method shorthands, we won't have an `=>` token but immediately find the `)` token. Need to figure out
        // how to deal with that visually.
        let funcToken = getFirstToken(node.body);
        while (funcToken && funcToken.str !== '=>') {
          funcToken = tokens[funcToken.n - 1];
        }
        ASSERT(funcToken && funcToken.str === '=>', 'pretty sure this is an invariant', funcToken);
        funcToken.tlog = [];

        const desc = 'Arrow<line ' + node.loc.start.line + ', column ' + node.loc.start.column + '>';
        $(node, '@func', 'N' + node.$z.tid + '=arrow', '', node.params.map(node => node.name), paramBindingNames, hasRest, minParamRequired, funcActions, 'arrow', false, node.$z.reachableNames, funcToken.n, filename, node.loc.start.column, node.loc.start.line, desc);
        break;
      }

      case 'BinaryExpression': {
        log('Operator:', node.operator);

        expr(node.left);
        expr(node.right);

        const tokenOp = getPrevTokenPastGroupAndSpaces(node.right);
        ASSERT(tokenOp.str === node.operator, 'should have found the binary op', tokenOp);
        tokenOp.tlog = [];
        $(node, '@binop', node.operator, tokenOp.n); // Assumes two values on the stack but won't consume them

        switch (node.operator) {
          case '+': {
            // Both sides have to be either a number or a string and equal to each other at this point
            // Returns the same type.
            $(node, '@plus');
            break;
          }
          case '-': {
            $(node, '@push', 'number');
            $(node, '@merge');
            $(node, '@merge');
            $(node, '@drop'); // Don't care about the merged value, it always returns a number
            $(node, '@push', 'number');
            break;
          }
          case '==':
          case '!=':
            store.linter.check('TOFIX', {filename, column: node.loc.start.column, line: node.loc.start.line}, 'weak comparison is bad and not implemented');
            $(node, '@merge');
            break;
          case '===':
          case '!==':
            $(node, '@merge');
            $(node, '@drop'); // Don't care about the merged value
            $(node, '@push', 'boolean');
            break;
          case '<':
          case '<=':
          case '>':
          case '>=':
            // Merge left and right with number and return a boolean
            $(node, '@push', 'number');
            $(node, '@merge'); // must return a number
            $(node, '@merge');
            $(node, '@drop'); // Don't care about the merged value
            $(node, '@push', 'boolean');
            break;

          case 'instanceof': {
            // This model should conclusively determine the truth value of any `instanceof` expression
            linter.check('INSTANCEOF_OBSOLETE', {filename, column: node.loc.start.column, line: node.loc.start.line});

            // TODO: figure out the rules, proper
            $(node, '@instanceof');

            break;
          }

          case 'in': {
            // This model should conclusively determine the truth value of any `in` expression
            linter.check('IN_OBSOLETE', {filename, column: node.loc.start.column, line: node.loc.start.line});

            // Require the lhs to be a string
            expr(node.left);
            $(node, '@push', 'string');
            $(node, '@merge');

            // TODO: figure out valid values of rhs. Probably have to verify that state in the @in callback
            expr(node.right);
            $(node, '@in', node);

            break;
          }

          default:
            // Merge left and right with number and return a number
            $(node, '@push', 'number');
            $(node, '@merge'); // Should return a number
            $(node, '@merge'); // Should return a number
            break;
        }

        break;
      }

      case 'CallExpression': {
        log(DIM + 'Setting up call args' + RESET);
        let spreadAt = -1; // If this call contained a spread, we have to verify it starts on-or-after the rest param, at runtime.
        node.arguments.forEach((anode, i) => {
          if (anode.type === 'SpreadElement') {
            log('Spread in a call. Complicated because we can not know the array size in our model. Hence we can only support a handful of cases, mostly concerning this at the end of the arg list');
            // TODO: we can do checks around the spread and see if they are the same type
            // TODO: can ignore empty arrays (although is that really worth it in the real world?)
            // For sound and completeness, we can only support a spread if it is covered in a rest param
            // Since otherwise we wouldn't know whether to substitute the kind being spreaded, or undefined / default.
            if (i !== 0) { // note: reversed order, so we expect rest to be index 0
              // We currently can't reliably support a spread argument that is not at the tail of the argument list
              // No need to check further at runtime.
              linter.check('SPREAD_NOT_TAIL', {filename, column: anode.loc.start.column, line: anode.loc.start.line});
            } else {
              spreadAt = (node.arguments.length - 1) - i; // Note: list is reversed!
            }
            // Either way, get the kind, push it onto the stack for good measure...
            expr(anode.argument);
            $(node, '@kind', '<call spread arg>');
          } else {
            expr(anode)
          }
        });
        log(DIM + 'Setting up callee to call' + RESET);
        if (node.callee.type === 'Super') {
          // Note: the extends of the class to which this constructor belongs is syntactically bound to this super()
          log('This is a `super()` call');
          const ownerFunction = superCallStack[superCallStack.length - 1];
          ASSERT(ownerFunction && ownerFunction.superClass, 'parser should validate that a `super()` call is contained in an es6 constructor which must mean the owner class is extending a value', ownerFunction);
          expr(ownerFunction.superClass); // put it on the stack
          $(node, '@super_call', node.arguments.length, spreadAt);
        } else {
          log(DIM + 'Setting up call context' + RESET);
          if (node.callee.type !== 'MemberExpression') $(node, '@push', 'undefined'); // in strict mode implicit context is undefined, not global
          log('Putting the callee on the stack');
          expr(node.callee, false, true);
          log(DIM + 'Setting up call with ' + node.arguments.length + ' args' + RESET);
          $(node, '@call', node.arguments.length, spreadAt);

          getFirstToken(node).tlog = [];        }
        break;
      }

      case 'ClassExpression': {
        processClass(node, true, false);
        break;
      }

      case 'ConditionalExpression': {
        expr(node.test);
        $(node, '@push', 'boolean');
        $(node, '@merge'); // Merge condition with bool
        $(node, '@drop'); // pop the bool
        expr(node.consequent);
        expr(node.alternate);
        $(node, '@merge'); // Merge consequent with alternate (not with bool) and return it
        break;
      }

      case 'FunctionExpression': {
        log('isMethod:', isMethod);

        let abak = actions;
        actions = [];

        $(node, '@log', 'start of func expr ' + (node.id ? node.id.name : '{anon}'));

        if (node.id) {
          // Oh fun, function expression id scoping
          let has = false;
          let scope = node.$scope;
          ASSERT(scope.type === Tenko.SCOPE_LAYER_FUNC_BODY, 'please no 1', scope);
          let names = scope.names;
          if (names !== Tenko.HAS_NO_BINDINGS && names.has('shadowedFunction')) has = true;
          scope = scope.parent;
          ASSERT(scope.type === Tenko.SCOPE_LAYER_FUNC_PARAMS, 'please no 2', scope);
          names = scope.names;
          if (names !== Tenko.HAS_NO_BINDINGS && names.has('shadowedFunction')) has = true;
          scope = scope.parent;
          ASSERT(scope.type === Tenko.SCOPE_LAYER_FUNC_ROOT, 'please no 3', scope);
          names = scope.names;
          if (names !== Tenko.HAS_NO_BINDINGS && names.has('shadowedFunction')) has = true;
          scope = scope.parent;
          ASSERT(scope.type === Tenko.SCOPE_LAYER_GLOBAL, 'please no 4', scope);

          if (has) {
            log('The func expr name was shadowed by a param name or local var, ignoring it');
            linter.check('FUNC_EXPR_NAME_SHADOW', {filename, column: node.id.loc.start.column, line: node.id.loc.start.line});
          } else {
            // Ok, the func expr had a name the name was not shadowed, record it
            log('Making sure the func name gets bound properly');
            // Specific hack because we won't have access to the 'current" func instance otherwise
            log('Function param id:');
            const uniqueName = findUniqueNameForBindingIdent(node.id);
            $(node, '@func_expr_name', uniqueName);
          }
        } else if (isMethod) {
          log('Function expression is a method with key: `' + methodName + '`');
          ASSERT(methodName, 'all methods have a key', methodName); // TODO: What about computed keys?
        } else {
          log('Function expression has no name');
        }

        $(node, '@binding', 'this', 'lex'); // Top of the stack ought to be the context for this call
        $(node, '@push', 'number');
        $(node, '@obj', ['length']); // Create the arguments object and put it on the stack
        $(node, '@binding', 'arguments', 'lex');

        const {minParamRequired, hasRest, paramBindingNames} = processFuncArgs(node);

        $(node, '@body_start');

        stmt(node.body);

        log('The explicitReturns value for its body is:', [node.body.$z.explicitReturns]);
        if (node.body.$z.explicitReturns !== 'yes') {
          // Implicitly return `undefined`
          $(node, '@push', 'undefined');
          $(node, '@return');
        }

        let funcActions = actions;
        actions = abak;

        // For functions, focus on the `function` keyword
        let funcToken = getFirstToken(node);
        funcToken.tlog = [];

        const debugName = (isMethod ? methodName : node.id ? node.id.name : '<anon>');
        const desc = (isMethod ? 'Method' : 'Function') + '<' + debugName + ': line ' + node.loc.start.line + ', column ' + node.loc.start.column + '>';
        $(node, '@func', 'N' + node.$z.tid + '=' + debugName, node.id ? node.id.name : '', node.params.map(node => node.name), paramBindingNames, hasRest, minParamRequired, funcActions, isMethod ? 'method' : 'expr', !!node.$z.thisAccess, node.$z.reachableNames, funcToken.n, filename, node.loc.start.column, node.loc.start.line, desc);
        break;
      }

      case 'Identifier': {
        const uniqueName = findUniqueNameForBindingIdent(node);
        log('Queueing lookup for `' + uniqueName + '`');
        $(node, '@ident', uniqueName);

        getFirstToken(node).tlog = [];
        break;
      }

      case 'Literal': {
        if (typeof node.value === 'string') {
          $(node, '@push', 'string');
        } else if (typeof node.value === 'number') {
          $(node, '@push', 'number');
        } else if (typeof node.value === 'boolean') {
          $(node, '@push', 'boolean');
        } else if (node.regex !== undefined) {
          $(node, '@push', 'RegExp.prototype');
          $(node, '@obj', ['__proto__']);
        } else if (node.value === null) {
          $(node, '@push', 'null');
        } else {
          log('Missing support for literal', node);
          store.linter.check('TOFIX', {filename, column: node.loc.start.column, line: node.loc.start.line}, 'unknown literal type');
        }
        break;
      }

      case 'LogicalExpression': {
        // The operands of the logical expression (&& and ||) are expected to be bool, even though JS doesn't care
        // They return whichever value is truthy, which is impossible for the model to determine, so we return boolean

        // Technically both sides ought to be bools. But for hte model, at least they ought to be the same type.
        // The operator will return that type (not bool), so check for bool but don't automatically return it.

        expr(node.left);
        expr(node.right);

        const tokenOp = getPrevTokenPastGroupAndSpaces(node.right);
        ASSERT(tokenOp.str === node.operator, 'should have found the binary op', tokenOp);
        tokenOp.tlog = [];
        $(node, '@binop', node.operator, tokenOp.n); // Assumes two values on the stack but won't consume them

        $(node, '@logical', node.operator);
        break;
      }

      case 'MemberExpression': {
        const nameStack = [];
        const dynaStack = [];
        function r(node) {
          if (node.type === 'MemberExpression') {
            if (node.computed) {
              // All bets are off now. We cannot support this completely (though we could support _some_ cases).
              // We'll now unconditionally attempt to treat the access as an indexed array access (we can refine checks
              // for this). So do a @kind and if that fails too, it will return an `undefined`, otherwise it'll work
              // as intended.
              log('Dynamic property access. Last ditch effort: attempting to get the kind of an array or treat plain object as map');
              dynaStack.push(true);
              nameStack.push(node.property);
              r(node.object);
            } else {
              dynaStack.push(false);
              nameStack.push(node.property);
              r(node.object);
            }
          } else if (node.type === 'Super') {
            log('This is a `super.prop` property');
            // The instance that owns the method containing this super prop can be found at the top of store.get('#superStack')
            $(node, '@super_prop'); // Root object
          } else {
            expr(node); // Root object
          }
        }
        r(node);

        while (nameStack.length > 0) {
          const wasDynamic = dynaStack.pop();
          const nameNode = nameStack.pop();

          if (nameStack.length === 0 && isCallee) {
            // The top address is now the callee. We want to get a method from it (consumes top)
            // AND use it as context for the call (also consumes top), so dupe it here
            $(node, '@dup', '<top is called and serves as context>');
          }

          if (wasDynamic) { // Dynamic property access; trying to get the kind of the array as the "get", or kind of object-as-map
            expr(nameNode);
            $(nameNode, '@dyn_get', nameStack.length);
          } else {
            ASSERT(nameNode && nameNode.type === 'Identifier', 'the stack should contain ident nodes or zeroes', nameNode);
            $(nameNode, '@get', nameNode.name);
            getFirstToken(nameNode).tlog = [];
          }
        }
        break;
      }

      case 'NewExpression': {
        let spreadAt = -1; // see CallExpression
        log(DIM + 'Setting up `new` args' + RESET);

        node.arguments.forEach((node, i) => {
          if (node.type === 'SpreadElement') {
            log('Spread in a `new`. Complicated because we can not know the array size in our model. Hence we can only support a handful of cases, mostly concerning this at the end of the arg list');
            // TODO: we can do checks around the spread and see if they are the same type
            // TODO: can ignore empty arrays (although is that really worth it in the real world?)
            // For sound and completeness, we can only support a spread if it is covered in a rest param
            // Since otherwise we wouldn't know whether to substitute the kind being spreaded, or undefined / default.
            if (i !== 0) { // note: reversed order, so we expect rest to be index 0
              // We currently can't reliably support a spread argument that is not at the tail of the argument list
              // No need to check further at runtime.
              linter.check('SPREAD_NOT_TAIL', {filename, column: node.loc.start.column, line: node.loc.start.line});
            } else {
              spreadAt = i;
            }
            // Either way, get the kind, push it onto the stack for good measure...
            expr(node.argument);
            $(node, '@kind', '<spread arg>');
          } else {
            expr(node)
          }
        });

        expr(node.callee);
        $(node, '@new', node.arguments.length, spreadAt);
        break;
      }

      case 'ObjectExpression': {
        $(node, '@obj', []);

        $(node, '@super_stack_push'); // Make the object reference available to any methods that use super properties

        const spreads = [];
        node.properties.forEach(pnode => {
          if (pnode.type === 'SpreadElement') {
            expr(pnode.argument);
            spreads.push(true);
          } else {
            ASSERT(pnode.type === 'Property', 'fixmeifnot', pnode);
            ASSERT(!pnode.computed, 'computed prop wot?', pnode);
            ASSERT(pnode.key.type === 'Identifier' || pnode.key.type === 'Literal', 'prop key should be ident or num/str', pnode);

            ASSERT(pnode.value);
            expr(pnode.value, pnode.method ? 'method' : '', false, pnode.method ? (pnode.key.type === 'Identifier' ? pnode.key.name : String(pnode.key.value)) : undefined);
            spreads.push(false);
          }
        });

        $(node, '@super_stack_pop');

        $(node, '@obj_init', node.properties.map(node => node.type === 'Property' ? (node.key.type === 'Identifier' ? node.key.name : String(node.key.value)) : '<spread>').reverse(), spreads);

        break;
      }

      case 'RegExpLiteral': {
        $(node, '@regex');
        break;
      }

      case 'SequenceExpression': {
        node.expressions.forEach((enode, i) => {
          group('Sequence part', (i + 1), '/', node.expressions.length);
          expr(enode);
          if (i < node.expressions.length - 1) {
            log('This is not the last value in the sequence so dropping it');
            // Only keep the last expression value on the stack. The rest is discarded.
            $(node, '@drop');
          } else {
            log('This is the last value in the sequence so that is what it returns');
          }
          groupEnd();
        });
        break;
      }

      case 'Super': {
        // Two cases:
        // - call
        // - prop
        // The call is syntactically restricted to es6 constructors of classes that extend _something_. That something
        // is only checked at runtime, and so `super` is only resolved at runtime as well.
        // The prop can occur in any class method or object method. This usage is syntactically restircted to the
        // method shorthand syntax and its reference is bound to the initial object of its __proto__. That bond cannot
        // be broken or changed in JS (unlike call, which is an indirect lookup).

        // This handler is a noop because the MemberExpression and CallExpression handlers should handle super
        break;
      }

      case 'TemplateLiteral': {
        node.expressions.forEach(node => {
          expr(node);
          $(node, '@lint-inv', 'string', 'TEMPLATE_EXPR_STRING');
          $(node, '@drop'); // TODO: if not string, resolve the .toString/.valueOf as JS would, etc.
        });

        $(node, '@push', 'string');
        break;
      }

      case 'ThisExpression': {
        // It's a hack but since you can't declare a local binding named `this`, we can get away with it.
        log('Queueing lookup explicitly for `this`');
        $(node, '@ident', 'this');
        getFirstToken(node).tlog = [];
        break;
      }

      case 'UnaryExpression': {
        log('Operator:', node.operator);

        expr(node.argument);

        switch (node.operator) {
          case 'delete': {
            store.linter.check('DELETE_MEH', {filename, column: node.loc.start.column, line: node.loc.start.line});
            $(node, '@drop');
            $(node, '@push', 'boolean');
            break;
          }

          case '+':
          case '-':
          case '~': {
            $(node, '@push', 'number');
            $(node, '@merge');
            break;
          }

          case '!': {
            $(node, '@push', 'boolean');
            $(node, '@merge');
            break;
          }

          case 'typeof': {
            // Trick question ;)
            $(node, '@drop');
            $(node, '@push', 'string');
            break;
          }

          case 'void': {
            $(node, '@drop');
            $(node, '@push', 'undefined');
            break;
          }

          default: {
            store.linter.check('TOFIX', {filename, column: node.loc.start.column, line: node.loc.start.line}, 'unknown unary op');
          }
        }

        break;
      }

      case 'UpdateExpression': {
        // TODO: there is a subtle difference between prefix and postfix that we can catch as a nice gimmick
        expr(node.argument);
        $(node, '@push', 'number');
        $(node, '@merge');
        break;
      }

      default: {
        log('unknown expression node:', node);
        throw new Error('Missing support for expr ' + node.type)
      }
    }

    if (node.$scope) {
      lexScopeStack.pop();
      if (['Program', 'FunctionExpression', 'ArrowFunctionExpression', 'FunctionDeclaration'].includes(node.type)) {
        rootScopeStack.pop();
      }
    }

    groupEnd();
  }

  function processClass(node, isExpr, isExport) {
    superCallStack.push(node);

    // Put the `extends` expression on the stack, or an actual `null` to signify there wasn't any
    if (node.superClass) expr(node.superClass);
    else $(node, '@push', NO_SUPER_VALUE);

    // Track the total number of methods, static or proto, because they will be put on the stack mixed
    let methodTypes = [];
    let methodNames = [];

    if (node.body.body.length > 0) {
      $(node, '@super_stack_push'); // Put the proto object reference onto a proto stack while we parse out the methods

      log('Processing', node.body.body.length, 'potential methods');
      node.body.body.forEach(node => {
        if (!node) return; // possible
        ASSERT(node.type === 'MethodDefinition', 'expand once class syntax is not just method definitions');
        const methodName = (node.key ? node.key.name : '<??>');
        log('- ' + (methodTypes.length + 1) + ': a ' + (node.static ? 'static' : 'proto') + ' method: `' + methodName + '`');

        if (node.computed) {
          linter.check('CLASS_COMPUTED_METHOD', {filename, column: node.loc.start.column, line: node.loc.start.line});
        }

        ASSERT(node.key && node.key.type === 'Identifier', 'if the method is not dynamic, the key must exist and must be an ident', node);
        ASSERT(node.value.type === 'FunctionExpression', 'for now, method values are func expr nodes');

        // TODO: constructor path
        // TODO: tag as methods, perhaps the class can patch that up for us... we also need to know which methods are static
        expr(node.value, 'method', false, methodName);

        methodNames.push(node.key.name);
        methodTypes.push(node.static ? 'static' : 'proto');
      });

      $(node, '@super_stack_pop'); // Bring the proto object back to the stack to serve as a stack arg to @class
    }

    // Put the future prototype object on the stack.
    $(node, '@obj', []);

    const desc = 'Class<' + (node.id ? node.id.name : '<anon>') + ': line ' + node.loc.start.line + ', column ' + node.loc.start.column + '>';
    $(node, '@class', 'N' + node.$z.tid + '=' + (node.id ? node.id.name : 'anon'), node.id ? node.id.name : '', methodTypes.reverse(), methodNames.reverse(), desc);

    if (isExport) {
      ASSERT(node.id, 'exported classes (not by default) must have an id as per syntax');
      $(node, '@dup');
      $(node, '@export_as', isExport === true ? node.id.name : 'default');
    }

    if (isExpr) {
      // TODO: how do we best model the class expression id being accessible inside the class? fake an arrow?
      if (node.id) store.linter.check('TOFIX', {filename, column: node.loc.start.column, line: node.loc.start.line}, 'class expression id is a small scoping nightmare. just skip tests with a class expr id; not a vital path to cover atm');
    } else {
      if (node.id) {
        log('Class id:');
        const uniqueName = findUniqueNameForBindingIdent(node.id);
        $(node, '@binding', uniqueName, 'lex');
      } else {
        store.linter.check('TOFIX', {filename, column: node.loc.start.column, line: node.loc.start.line}, 'exported class as a default has no name');
      }
    }

    superCallStack.pop();
  }

  function processFuncArgs(node) {
    $(node, '@log', '### <function param setup> ###');

    let minParamRequired = 0; // Ends up as the last non-rest param without default, +1
    let hasRest = false;
    let paramBindingNames = []; // Includes names inside pattern

    group('Compiling params');
    node.params.forEach((pnode, i) => {
      // The rest param can not have a default so check that one first
      if (pnode.type === 'RestElement') {
        log('- param', i, 'is a rest');
        ASSERT(i === node.params.length - 1, 'rest must be last element');
        // - Rest cannot have a default, but must be an array
        // - Do not increment min req count for the rest.
        // - The top of the stack should be the _kind_ (not the actual array) of the rest array. It may be null,
        //   in that case there were not enough args to also cover the rest param. (Or, somehow the kind of an
        //   empty array leaked into it ...)
        $(pnode, '@arr', 1);
        ASSERT(pnode.argument.type === 'Identifier', 'fixme for non-ident rest params', pnode);
        hasRest = true;

        $(pnode, '@push', NO_DEFAULT_VALUE); // Ignore the default. Rest doesn't have it.

        // The name may not match, for example a func expr with the same name as one of its args
        const uniqueName = findUniqueNameForBindingIdent(pnode.argument);
        $(pnode, '@param_binding', uniqueName);
        paramBindingNames.push(uniqueName);
      } else {
        // Now there's basically two states: a param with a default or without a default. The params with a default
        // have an node that is basically "boxed" into an AssignmentPattern. Put the right value on the stack and
        // continue to process the left value. Otherwise, put null on the stack and process the node itself.

        let paramNode = pnode;
        if (pnode.type === 'AssignmentPattern') {
          log('- param', i, 'has a default');
          ASSERT(pnode.left.type === 'Identifier' || pnode.left.type === 'ObjectPattern' || pnode.left.type === 'ArrayPattern', 'fixme if different', pnode.left);
          // Put right on the stack as the param default, continue to process left
          expr(pnode.right);
          paramNode = pnode.left;
        } else {
          minParamRequired = i + 1;
          log('- param', i, 'has no default, min args now at:', minParamRequired);
          // Put null on the stack, to signify no param default, and continue to process this node
          $(pnode, '@push', NO_DEFAULT_VALUE);
          // Need at least this many args
        }

        // The paramNode can be either an Identifier or a pattern of sorts
        if (paramNode.type === 'Identifier') {
          // Simple case. Create the param binding and be done.

          // The name may not match, for example a func expr with the same name as one of its args
          const uniqueName = findUniqueNameForBindingIdent(paramNode);
          $(pnode, '@param_binding', uniqueName);
          paramBindingNames.push(uniqueName);
        } else if (paramNode.type === 'ArrayPattern') {
          // Complex case. Sort out the final param value vs default, then walk through the destructuring pattern.

          linter.check('ARRAY_PATTERN_UNSOUND', {filename, column: paramNode.loc.start.column, line: paramNode.loc.start.line});

          $(pnode, '@defaults');

          // Next we are going to pushpop the top value recursively to process all parts of the pattern

          paramNode.elements.forEach(n => processArrayPatternElement(n, paramBindingNames));

          $(pnode, '@drop'); // Drop the param array value. It should still be here and we don't need it anymore.
        } else {
          // Complex case. Sort out the final param value vs default, then walk through the destructuring pattern.

          ASSERT(paramNode.type === 'ObjectPattern', 'fixme if else', paramNode);

          $(pnode, '@defaults');

          // Next we are going to pushpop the top value recursively to process all parts of the pattern

          paramNode.properties.forEach(pnode => processObjectPatternProp(pnode, paramNode, paramBindingNames));

          $(pnode, '@drop'); // Drop the param value. It should still be here and we don't need it anymore.
        }
      }
    });
    log('Min args now at:', minParamRequired);
    groupEnd();

    $(node, '@log', '### </function param setup> ###');

    return {minParamRequired, hasRest, paramBindingNames};
  }
  function processArrayPatternElement(node, paramBindingNames) {
    // The top of the stack ought to be the _array_ whose elements is being processed and they should all
    // resolve to the same type as the `kind` of the array.
    // Note: This call should not modify the stack before/after.

    $(node, '@dup'); // Leave the array on the stack
    $(node, '@kind', '<array pattern element>'); // Get the kind of the arr that should be on top right now.

    // `enode` is one element of the array. If the element had a default, apply that logic now
    let enode = node;
    if (node.type === 'AssignmentPattern') {
      expr(node.right);
      enode = node.left;
    } else {
      $(node, '@push', NO_DEFAULT_VALUE);
    }

    $(node, '@defaults');

    // The top of the stack should now be the type of the element currently being processed. It is either
    // the kind of the array of which this element is a part of, or if that is `undefined` it is the
    // default if the element has any;
    // - f(['x']) function f([a=1]){}  -> a is type string
    // - f([]) function f([a=1]){}     -> a is type number
    // - f() function f([a=1]){}       -> error (lint warnings)

    if (enode.type === 'ObjectPattern') {
      // Top of stack must now be object. Process it recursively then drop it.
      enode.properties.forEach(e => processObjectPatternProp(e, enode, paramBindingNames));
      $(node, '@drop');
    } else if (enode.type === 'ArrayPattern') {
      // Top of stack must now be array. Process it recursively then drop it.
      enode.elements.forEach(n => processArrayPatternElement(n, paramBindingNames));
      $(node, '@drop');
    } else if (enode.type === 'RestElement') {
      ASSERT(enode.argument.type === 'Identifier', 'fixme if different', enode); // This can be an arr/obj pattern, too
      // Assume that the array gets the same kind as the array being spread from
      $(node, '@arr', 1); // "1 arg". The kind is shared and assumed not to be undefined.

      // The name may not match, for example a func expr with the same name as one of its args
      const uniqueName = findUniqueNameForBindingIdent(enode.argument);
      // Now create a binding with the property value onto this name
      $(node, '@binding', uniqueName, 'var');
      paramBindingNames.push(uniqueName);
    } else {
      ASSERT(enode.type === 'Identifier', 'fixme if different', enode);

      // The name may not match, for example a func expr with the same name as one of its args
      const uniqueName = findUniqueNameForBindingIdent(enode);
      // Now create a binding with the property value onto this name
      $(node, '@binding', uniqueName, 'var');
      paramBindingNames.push(uniqueName);
    }
  }
  function processObjectPatternProp(node, objNode, paramBindingNames) {
    // The top of the stack ought to be the _obj_ whose properties are being processed and they should all
    // resolve to properties of this object. Current call processed one such property node.
    // Note: This call should not modify the stack before/after.

    ASSERT(node.type === 'Property' || node.type === 'ObjectPattern' || node.type === 'RestElement', 'fixme for other types', node);

    // Note: If there is a default, the .value will be an AssignmentPattern:
    // {x}
    // {x:y}
    // {x=z}
    // {x:y=z}

    if (node.type === 'RestElement') {
      // A rest element does not have a key/value property like other property nodes do
      ASSERT(node.argument.type === 'Identifier', 'fixme if different', node); // This can be an arr/obj pattern, too

      // Rest is more difficult because you have take the input object, eliminate all properties that are
      // explicitly checked, then take the resulting set of properties and construct a new object with that

      const unusedNames = objNode.properties.map(pnode => {
        if (pnode.type === 'Property') {
          if (pnode.computed) {
            linter.check('DYNAMIC_PROP_ACCESS', {filename, column: pnode.loc.start.column, line: pnode.loc.start.line}, 'destructuring');

            store.linter.check('TOFIX', {filename, column: node.loc.start.column, line: node.loc.start.line}, 'destructuring dynamic property stuff'); // check how to make dyn_prop stuff work when destructuring

            // We may be able to salvage this, tentatively and under protest, if this is a plain object and all props have the same tid
            expr(pnode.property);
            // The action should assert the property on the stack to be a string or number, then discard it
            // If the object is a plain object (type='o') and it has a non-false .kind, then return that kind. Otherwise return undefined.
            $(pnode, '@dyn_prop');

            return null;
          }
          ASSERT(pnode.key.type === 'Identifier');
          return pnode.key.name;
        } else {
          ASSERT(pnode.type === 'RestElement');
          return null;
        }
      }).filter(Boolean);

      $(node, '@objrest', [...unusedNames, '__proto__']); // proto appears not to be copied regardless

      // The name may not match, for example a func expr with the same name as one of its args
      const uniqueName = findUniqueNameForBindingIdent(node.argument);
      // Now create a binding with the property value onto this name
      $(node, '@binding', uniqueName, 'var');
      paramBindingNames.push(uniqueName);
    } else {
      ASSERT(node.key.type === 'Identifier', 'fixme for other key types', node.key);
      ASSERT(node.value.type === 'Identifier' || node.value.type === 'AssignmentPattern' || node.value.type === 'ObjectPattern' || node.value.type === 'ArrayPattern', 'fixme for other value types', node.value);

      const knode = node.key;

      // Get the property from the top of the stack (but leave the object as well for the next iteration)
      $(node, '@dup');
      $(knode, '@get', knode.name, node.value.type === 'AssignmentPattern');
      getFirstToken(knode).tlog = [];

      // The prop name is not relevant at this point (the prop was fetched and is on top of the stack)
      // Put the default on the stack, prepare the actual value node (binding ident/obj/arr)
      let vnode = node.value;
      if (vnode.type === 'AssignmentPattern') {
        expr(vnode.right);
        vnode = vnode.left;
      } else {
        $(node, '@push', NO_DEFAULT_VALUE);
      }

      $(node, '@defaults');

      if (vnode.type === 'ObjectPattern') {
        // Top of stack must now be object. Process it recursively then drop it.
        vnode.properties.forEach(pnode => processObjectPatternProp(pnode, vnode, paramBindingNames));
        $(node, '@drop');
      } else if (vnode.type === 'ArrayPattern') {
        // Top of stack must now be array. Process it recursively then drop it.
        vnode.elements.forEach(n => processArrayPatternElement(n, paramBindingNames));
        $(node, '@drop');
      } else {
        ASSERT(vnode.type === 'Identifier', 'fixme if different value', vnode);
        // Doesn't matter whether it's shorthand or not; the binding name is in the value node

        // The name may not match, for example a func expr with the same name as one of its args
        const uniqueName = findUniqueNameForBindingIdent(vnode);
        // Now create a binding with the property value onto this name
        $(node, '@binding', uniqueName, 'var');
        paramBindingNames.push(uniqueName);
      }
    }
  }

  function destructBindingObjectProp(pnode, objNode, kind) {
    ASSERT(objNode && typeof objNode === 'object');

    // Can't be assignment on the toplevel (that'd be the decl init)
    if (pnode.type === 'Property') {

      // let {x} = obj
      // -> prop will have key and value be the same Identifier
      // let {x = z} = obj
      // -> prop will have key ident, value be assignment of some rhs to an Identifier with same value as key
      // let {x: y} = obj
      // -> key and value will be different Identifiers
      // let {x: y = z} = obj
      // -> key is Identifier and value is assignment with rhs to different Identifier than key

      if (pnode.computed) {
        // let {[x]: y} = obj
        linter.check('DYNAMIC_PROP_ACCESS', {filename, column: pnode.loc.start.column, line: pnode.loc.start.line}, 'destructuring2');

        store.linter.check('TOFIX', {filename, column: node.loc.start.column, line: node.loc.start.line}, 'destructuring dynamic property stuff'); // Check how to make this dyn_prop stuff work for destructuring

        // We may be able to salvage this, tentatively and under protest, if this is a plain object and all props have the same tid
        expr(pnode.property);
        // The action should assert the property on the stack to be a string or number, then discard it
        // If the object is a plain object (type='o') and it has a non-false .kind, then return that kind. Otherwise return undefined.
        $(pnode, '@dyn_prop');

        return;
      }

      ASSERT(pnode.key.type === 'Identifier', 'fixme if else', pnode.key);

      $(pnode, '@dup');
      $(pnode.key, '@get', pnode.key.name, pnode.value.type === 'AssignmentPattern');
      getFirstToken(pnode.key).tlog = [];

      // Top of the stack should be object being destructured.
      // Value is an Identifier, AssignmentPattern, ObjectPattern, or ArrayPattern. Assignment can nest the other three.
      // Since this path can still require a property lookup on the object on the top of the stack, we'll need to
      // unbox the AssignmentPattern step-by-step, rather than generically. (Because we need to do default.) Very sad.

      if (pnode.value.type === 'Identifier') {
        // No default
        // let {x} = obj
        // let {x:y} = obj
        log('Pattern piece id:');
        const uniqueName = findUniqueNameForBindingIdent(pnode.value);
        $(pnode, '@binding', uniqueName, kind);
      } else if (pnode.value.type === 'ObjectPattern') {
        // let {x: {x}} = obj
        pnode.value.properties.forEach(ppnode => destructBindingObjectProp(ppnode, pnode.value, kind));
        $(pnode, '@drop'); // Drop the param value. It should still be here and we don't need it anymore.
      } else if (pnode.value.type === 'ArrayPattern') {
        // let {x: [x]} = obj
        linter.check('ARRAY_PATTERN_UNSOUND', {filename, column: pnode.loc.start.column, line: pnode.loc.start.line});
        pnode.value.elements.forEach(node => destructBindingArrayElement(node, kind));
        $(pnode, '@drop'); // Drop the param value. It should still be here and we don't need it anymore.
      } else {
        ASSERT(pnode.value.type === 'AssignmentPattern', 'fixme if else', pnode.value); // patterns?
        ASSERT(pnode.value.left.type === 'Identifier', 'left is ident', pnode);

        // let {x = z} = obj
        // let {x: y = z} = obj
        // let {x: {x} = z} = obj
        // let {x: [x] = z} = obj

        let vnode = pnode.value.left;

        // Top of the stack is property obj.x
        // Next we can get the default value (the rhs of the assignment pattern) and run a defaults
        expr(pnode.value.right);
        $(pnode, '@defaults');

        // Top of the stack is now the value to destructure/bind, the second is the parent object

        if (vnode.type === 'Identifier') {
          // No default
          // let {x} = obj
          // let {x:y} = obj

          log('Pattern piece id:');
          const uniqueName = findUniqueNameForBindingIdent(vnode);
          $(pnode, '@binding', uniqueName, kind);
        } else if (vnode.value.type === 'ObjectPattern') {
          // let {x: {x}} = obj
          pnode.value.properties.forEach(ppnode => destructBindingObjectProp(ppnode, pnode.value, kind));
          $(pnode, '@drop'); // Drop the param value. It should still be here and we don't need it anymore.
        } else if (vnode.value.type === 'ArrayPattern') {
          // let {x: [x]} = obj
          linter.check('ARRAY_PATTERN_UNSOUND', {filename, column: vnode.loc.start.column, line: vnode.loc.start.line});
          pnode.value.elements.forEach(node => destructBindingArrayElement(node, kind));
          $(pnode, '@drop'); // Drop the param value. It should still be here and we don't need it anymore.
        } else {
          ASSERT(false, 'fixme for other nodes', vnode);
        }
      }
    } else if (pnode.type === 'RestElement') {
      const unusedNames = objNode.properties.map(pnode => {
        if (pnode.type === 'Property') {
          if (pnode.computed) {
            linter.check('DYNAMIC_PROP_ACCESS', {filename, column: pnode.loc.start.column, line: pnode.loc.start.line}, 'destructuring3');

            store.linter.check('TOFIX', {filename, column: node.loc.start.column, line: node.loc.start.line}, 'destructuring dynamic property stuff'); // check how to make dyn_prop stuff work for destructuring

            // We may be able to salvage this, tentatively and under protest, if this is a plain object and all props have the same tid
            expr(pnode.property);
            // The action should assert the property on the stack to be a string or number, then discard it
            // If the object is a plain object (type='o') and it has a non-false .kind, then return that kind. Otherwise return undefined.
            $(pnode, '@dyn_prop');

            return null;
          }
          ASSERT(pnode.key.type === 'Identifier');
          return pnode.key.name;
        } else {
          ASSERT(pnode.type === 'RestElement');
          return null;
        }
      }).filter(Boolean);

      $(pnode, '@objrest', [...unusedNames, '__proto__']); // proto appears not to be copied regardless

      ASSERT(pnode.argument.type === 'Identifier', 'rest arg is ident or fixme', pnode.argument);
      const uniqueName = findUniqueNameForBindingIdent(pnode.argument);
      $(pnode, '@binding', uniqueName, kind);
    } else {
      ASSERT(false, 'fixme', pnode);
    }
  }
  function destructBindingArrayElement(pnode, kind) {
    // Can't be assignment on the toplevel (that'd be the decl init)

    $(pnode, '@dup');
    $(pnode, '@kind', '<array binding pattern>');

    let enode = pnode;
    if (pnode.type === 'AssignmentPattern') {
      expr(pnode.right);
      enode = pnode.left;
      $(pnode, '@defaults');
    } else {
      // $(pnode, '@push', NO_DEFAULT_VALUE);
      // $(pnode, '@defaults');
    }


    if (enode.type === 'Identifier') {
      // No init
      // $(pnode, '@push', NO_DEFAULT_VALUE);
      // $(pnode, '@defaults'); // If value is undefined and there is a default, use default, otherwise if there is a default, validate it against the value. Leave either on the stack.
      log('Pattern piece id:');
      const uniqueName = findUniqueNameForBindingIdent(enode);
      $(pnode, '@binding', uniqueName, kind);
    } else if (enode.type === 'ObjectPattern') {
      enode.properties.forEach(ppnode => destructBindingObjectProp(ppnode, enode, kind));
      $(pnode, '@drop'); // Drop the param value. It should still be here and we don't need it anymore.
    } else if (enode.type === 'ArrayPattern') {
      linter.check('ARRAY_PATTERN_UNSOUND', {filename, column: enode.loc.start.column, line: enode.loc.start.line});
      enode.elements.forEach(node => destructBindingArrayElement(node, kind));
      $(pnode, '@drop'); // Drop the param value. It should still be here and we don't need it anymore.
    } else if (pnode.type === 'RestElement') {
      ASSERT(pnode.argument.type === 'Identifier', 'fixme if else', pnode.argument);
      // While it could share the type, in theory it's a fresh reference, which is relevant for tracking
      // own properties, so we create a fresh array type for it.
      $(pnode, '@arr', 1);
      // Cannot have initializer. Set to input array because why not.
      const uniqueName = findUniqueNameForBindingIdent(pnode.argument);
      $(pnode, '@binding', uniqueName, kind);
    } else {
      ASSERT(false, 'fixme if else', enode);
    }
  }
}
