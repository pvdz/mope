import {
  ASSERT,
  ASSERT_LOC,
  RESET,
  RED_WHITE,
  WHITE_BLACK,

  dir,
  group,
  groupEnd,
  log,
} from './utils.mjs';

// The system should be able to ignore all lints and still work. So either a lint is actually a permanent LangError or it should be ignore-able by the system.

const LEVEL = {
  L: {kind: 'lint', state: 'ok', desc: 'trivial linting problem, ast based linting would catch this, no problem for the model'},
  W: {kind: 'warn', state: 'ok', desc: 'non-trivial linting problem, no problem for the model'},
  C: {kind: 'crash', state: 'ok', desc: 'this will be a runtime crash error, not a problem for the model'},
  F: {kind: 'fatal', state: 'bad', desc: 'this will be a runtime crash error, model is now in a partially unsound state'},
  B: {kind: 'bad', state: 'bad', desc: 'linting problem, puts the model in a partially unsound state'},
  M: {kind: 'model', state: 'bad', desc: 'problem; this is a limitation of the model and it is now in a partially unsound state'},
};

export const codes = new Map();
// Use `set` because that's the only way to maintain typing in our model. TODO: we could explicitly "DSL" support the map constructor with double array
codes.set('PROP_NOT_FOUND', {level: 'W', code: 'PROP_NOT_FOUND', message: 'Read a property from an object that did not actually have the property. This is valid in JS but signals a potential bug.'});
codes.set('PROP_NOT_FOUND_HAS_DEFAULT', {level: 'W', code: 'PROP_NOT_FOUND_HAS_DEFAULT', message: 'Destructured property not found but had a default so using that.'});
codes.set('IMMUTABLE_CLASS_PROTO', {level: 'E', code: 'IMMUTABLE_CLASS_PROTO', message: 'Tried to overwrite the `.prototype` of an es6 class but that is not possible. This breaks our model so we do not support even attempting it.'});
codes.set('CLASS_COMPUTED_METHOD', {level: 'E', code: 'CLASS_COMPUTED_METHOD', message: 'The method key of a class member cannot be a dynamic property because the model cannot track this.'});
codes.set('ARRAY_PUSH_NO_ARGS', {level: 'W', code: 'ARRAY_PUSH_NO_ARGS', message: 'Called Array#push without any args. This can work but it is a no-op so it signals a potential bug.'});
codes.set('ARRAY_PUSH_CONTEXT', {level: 'W', code: 'ARRAY_PUSH_CONTEXT', message: 'Called Array#push with a context that was not an actual array. This can work but signals a potential bug.'});
codes.set('ARRAY_UNSHIFT_NO_ARGS', {level: 'W', code: 'ARRAY_UNSHIFT_NO_ARGS', message: 'Called `Array#unshift` without any args. This can work but it is a no-op so it signals a potential bug.'});
codes.set('ARRAY_UNSHIFT_CONTEXT', {level: 'W', code: 'ARRAY_UNSHIFT_CONTEXT', message: 'Called `Array#unshift` with a context that was not an actual array. This can work but signals a potential bug.'});
codes.set('ARRAY_ISARRAY_ARGLESS', {level: 'W', code: 'ARRAY_ISARRAY_ARGLESS', message: 'The `Array.isArray` function expects at least one array, otherwise it will check whether `undefined` is an array. Spoiler alert: It is not.'});
codes.set('ARRAY_ISARRAY_ARG2', {level: 'W', code: 'ARRAY_ISARRAY_ARG2', message: 'The `Array.isArray` function ignores any args beyond the first one.'});
codes.set('ARRAY_POP_WITH_ARGS', {level: 'W', code: 'ARRAY_POP_WITH_ARGS', message: 'Called Array#pop with some args but it ignores them so that signals a potential bug.'});
codes.set('ARRAY_POP_UNDERFLOW', {level: 'W', code: 'ARRAY_POP_UNDERFLOW', message: 'Array#pop was used but the model can not guarantee the pop does not create an underflow (returning undefined) so all bets are off now.'});
codes.set('ARRAY_POP_CONTEXT', {level: 'W', code: 'ARRAY_POP_CONTEXT', message: 'Array#pop was called with a non-array for context.'});
codes.set('ARRAY_POP_EMPTY', {level: 'W', code: 'ARRAY_POP_EMPTY', message: 'Array had no kind yet, meaning it was popped before it had a chance to collect any element so pop must have been called on an empty array.'});
codes.set('ARRAY_SHIFT_UNDERFLOW', {level: 'W', code: 'ARRAY_SHIFT_UNDERFLOW', message: 'Array#shift was used but the model can not guarantee the pop does not create an underflow (returning undefined) so all bets are off now.'});
codes.set('ARRAY_SHIFT_EMPTY', {level: 'W', code: 'ARRAY_SHIFT_EMPTY', message: 'Array had no kind yet, meaning it was shifted before it had a chance to collect any element so pop must have been called on an empty array.'});
codes.set('ARRAY_LAMBDA_UNDERFLOW', {level: 'W', code: 'ARRAY_LAMBDA_UNDERFLOW', message: 'One of the array lambda methods was was called with zero arguments. That will lead to a runtime error.'});
codes.set('ARRAY_LAMBDA_OVERFLOW', {level: 'W', code: 'ARRAY_LAMBDA_OVERFLOW', message: 'One of the array lambda methods was was called more than two arguments. Those are ignored.'});
codes.set('ARRAY_LAMBDA_FUNC_ARG', {level: 'W', code: 'ARRAY_LAMBDA_FUNC_ARG', message: 'The first arg of an array lambda method must be a function or it will lead to a runtime error.'});
codes.set('ARRAY_LAMBDA_ARR_CONTEXT', {level: 'W', code: 'ARRAY_LAMBDA_ARR_CONTEXT', message: 'The second arg of a lambda method, and otherwise its context, ought to be an array. This model currently does not support array-like values here.'});
codes.set('ARRAY_LAMBDA_ARR_KIND', {level: 'W', code: 'ARRAY_LAMBDA_ARR_KIND', message: 'An array lambda method was called on an array with unknown type, meaning an empty array. This means the callback was called with `undefined`s, which is not likely to be correct.'});
codes.set('ARRAY_REDUCE_ARR_KIND', {level: 'W', code: 'ARRAY_REDUCE_ARR_KIND', message: 'An array lambda method was called on an array with unknown type, meaning an empty array. This is a runtime error for Array#reduce and Array#reduceRight. No big deal for the model.'});
codes.set('ARRAY_FILTER_RETURNS', {level: 'W', code: 'ARRAY_FILTER_RETURNS', message: 'The function arg of `Array#filter` ought to return an actual boolean.'});
codes.set('ARRAY_FIND_RETURNS', {level: 'W', code: 'ARRAY_FIND_RETURNS', message: 'The function arg of `Array#find` and `Array#findIndex` ought to return an actual boolean.'});
codes.set('ARRAY_ANYSOME_RETURNS', {level: 'W', code: 'ARRAY_ANYSOME_RETURNS', message: 'The function arg of `Array#some` and `Array#any` ought to return a boolean or undefined.'});
codes.set('FUNCTION_TOSTRING_ARGS', {level: 'W', code: 'FUNCTION_TOSTRING_ARGS', message: 'Called Function#toString with some args but it ignores them so that signals a potential bug.'});
codes.set('FUNCTION_TOSTRING_CONTEXT', {level: 'W', code: 'FUNCTION_TOSTRING_CONTEXT', message: 'Function#toString can only be called with a context of a function. It is a runtime error otherwise.'});
codes.set('FUNCTION_APPLY_ARGCOUNT', {level: 'W', code: 'FUNCTION_APPLY_ARGCOUNT', message: 'Only the first and second arg to `Functon#apply` are used. The rest is ignored. Supplying them anyways is a red flag.'});
codes.set('FUNCTION_BIND_BAD_CONTEXT', {level: 'W', code: 'FUNCTION_BIND_BAD_CONTEXT', message: 'Tried to Function#bind an object to `undefined` even though it accesses `this`.'});
codes.set('FUNCTION_BIND_THISLESS_CONTEXT', {level: 'W', code: 'FUNCTION_BIND_THISLESS_CONTEXT', message: 'Tried to Function#bind an object to a function that did not refer to `this`. The context should have no effect so it might signal a unintended bug.'});
codes.set('FUNCTION_BIND_PRIMITIVE', {level: 'W', code: 'FUNCTION_BIND_PRIMITIVE', message: 'Tried to Function#bind with a primitive for context. This will cause the context to be "boxed" to an object. More often than not, this is not the intention.'});
codes.set('FUNCTION_BIND_NULL', {level: 'W', code: 'FUNCTION_BIND_NULL', message: 'Tried to Function#bind a function to null. This effectively attempts to bind to global in non-strict mode, or to `undefined` in strict mode. Intention is unclear.'});
codes.set('FUNCTION_BIND_NEW', {level: 'W', code: 'FUNCTION_BIND_NEW', message: 'Using `new` on a function that is the result of `Function#bind` results in a runtime error.'});
codes.set('FUNCTION_BIND_CLASS', {level: 'W', code: 'FUNCTION_BIND_CLASS', message: 'While `Function#bind` on a class is allowed, it is likely that there are better ways to accomplish the same thing.'});
codes.set('FUNCTION_BIND_CLASS_CONTEXT', {level: 'W', code: 'FUNCTION_BIND_CLASS_CONTEXT', message: 'Calling `Function#bind` on a class with a context other than `undefined` is useless.'});
codes.set('BOOLEAN_TOSTRING_ARGS', {level: 'W', code: 'BOOLEAN_TOSTRING_ARGS', message: 'Called Boolean#toString with some args but it ignores them so that signals a potential bug.'});
codes.set('BOOLEAN_TOSTRING_CONTEXT', {level: 'W', code: 'BOOLEAN_TOSTRING_CONTEXT', message: 'Boolean#toString can only be called with a context of a boolean. It is a runtime error otherwise.'});
codes.set('NUMBER_ISFINITE_ARGLESS', {level: 'W', code: 'NUMBER_ISFINITE_ARGLESS', message: 'Called `Number.isFinite` without any args, meaning it tests `undefined`, which is always `false`.'});
codes.set('NUMBER_ISFINITE_ARG1', {level: 'W', code: 'NUMBER_ISFINITE_ARG1', message: 'Called `Number.isFinite` with an arg that was not a number value, which is always `false`.'});
codes.set('NUMBER_ISFINITE_ARG2', {level: 'W', code: 'NUMBER_ISFINITE_ARG2', message: 'The `Number.isFinite` function ignores any arg except for the first one.'});
codes.set('NUMBER_TOSTRING_ARGS', {level: 'W', code: 'NUMBER_TOSTRING_ARGS', message: 'Called Number#toString with more than one arg but it ignores those so that signals a potential bug.'});
codes.set('NUMBER_TOSTRING_CONTEXT', {level: 'W', code: 'NUMBER_TOSTRING_CONTEXT', message: 'Number#toString can only be called with a context of a number. It is a runtime error otherwise.'});
codes.set('NUMBER_TOSTRING_NUM', {level: 'W', code: 'NUMBER_TOSTRING_NUM', message: 'The first arg to `Number#toString` is optional but if it is given it must be a number.'});
codes.set('STRING_FCC_ARGLESS', {level: 'W', code: 'STRING_FCC_ARGLESS', message: 'Called `String.fromCharCode` without any args but that is probably not what was intended.'});
codes.set('STRING_FCC_ARGS', {level: 'W', code: 'STRING_FCC_ARGS', message: 'Called `String.fromCharCode` with an arg that was not a number. It only expects numbers.'});
codes.set('STRING_FCP_ARGLESS', {level: 'W', code: 'STRING_FCC_ARGLESS', message: 'Called `String.fromCodePoint` without any args but that is probably not what was intended.'});
codes.set('STRING_FCP_ARGS', {level: 'W', code: 'STRING_FCC_ARGS', message: 'Called `String.fromCodePoint` with an arg that was not a number. It only expects numbers.'});
codes.set('STRING_CODEPOINTAT_UNSOUND', {level: 'W', code: 'STRING_CODEPOINTAT_UNSOUND', message: 'The `String#codePointAt` method may return `undefined` for indexes that do not exist, so the model cannot reliably predict the resulting type. It will assume string but the model is unsound now.'});
codes.set('STRING_REPEAT_ARGLESS', {level: 'W', code: 'STRING_REPEAT_ARGLESS', message: 'Called `String#repeat` without any args but which makes it repeat zero times and return an empty string.'});
codes.set('STRING_SPLIT_ARGLESS', {level: 'W', code: 'STRING_SPLIT_ARGLESS', message: 'Called `String#split` without any args but that makes it effectively a noop.'});
codes.set('STRING_SPLIT_ARG1', {level: 'W', code: 'STRING_SPLIT_ARG1', message: 'The `String#split` function expects either a string or a regular expression as first arg.'});
codes.set('STRING_TOSTRING_ARGS', {level: 'W', code: 'STRING_TOSTRING_ARGS', message: 'Called String#toString with some args but it ignores them so that signals a potential bug.'});
codes.set('STRING_TOSTRING_CONTEXT', {level: 'W', code: 'STRING_TOSTRING_CONTEXT', message: 'String#toString can only be called with a context of a string. It is a runtime error otherwise.'});
codes.set('STRING_MATCH_UNSAFE', {level: 'W', code: 'STRING_MATCH_UNSAFE', message: 'String#match can return a `null` or an array of strings and this model cannot determine which ahead of time. Assuming array of strings but this is not sound.'});
codes.set('STRING_REPLACE_ARG1', {level: 'W', code: 'STRING_REPLACE_ARG1', message: 'The first arg to `String#replace` should be a string or regex.'});
codes.set('STRING_REPLACE_ARG2', {level: 'W', code: 'STRING_REPLACE_ARG2', message: 'The second arg to `String#replace` should be a string or function.'});
codes.set('STRING_REPLACE_FUNC', {level: 'W', code: 'STRING_REPLACE_FUNC', message: 'The second arg to `String#replace` as function can not be safely modeled because the function may receive strings or undefined depending on the actual matching. This breaks the model.'});
codes.set('STRING_REPLACE_RETURN', {level: 'W', code: 'STRING_REPLACE_RETURN', message: 'The second arg to `String#replace` is a function that should return a string.'});
codes.set('STRING_TLS_ARG1', {level: 'W', code: 'STRING_TLS_ARG1', message: 'The first arg to `String#toLocaleLowerString` and `String#toLocaleUpperString` is optionally either a string or array of strings.'});
codes.set('CALL_ARG_ARITY', {level: 'W', code: 'CALL_ARG_ARITY', message: 'Called a function with a different number of arguments than it had defined.'});
codes.set('EXTENDS_NULL', {level: 'W', code: 'EXTENDS_NULL', message: 'Found a class which extended a value that resolved to `null`. This is not a problem when defining the class but the class will throw a runtime error if it was ever instantiated.'});
codes.set('EXTENDS_PRIMITIVE', {level: 'W', code: 'EXTENDS_PRIMITIVE', message: 'Found a class which extended a primitive value. This will be a runtime error at declaration time.'});
codes.set('EXTENDS_NO_PROTO', {level: 'W', code: 'EXTENDS_NO_PROTO', message: 'Found a class that extends a value that has no prototype. This will be a runtime error at declaration time.'});
codes.set('EXTENDS_BAD_PROTO', {level: 'W', code: 'EXTENDS_NO_PROTO', message: 'Found a class that extends a value that has a bad prototype value. This will be a runtime error at declaration time.'});
codes.set('ASSERT_WARN_SUPER_WITHOUT_EXTENDS', {level: 'W', code: 'ASSERT_WARN_SUPER_WITHOUT_EXTENDS', message: 'Technically you can extend a class with `Function.prototype` and I would not want to take that power away from you but more often than not it would actually be a bug in the model and I would want to know about it during development..'});
codes.set('SUPER_NULL', {level: 'W', code: 'SUPER_NULL', message: 'Cannot invoke `super()` inside a constructor of a class that extends `null`'});
codes.set('SUPER_PRIMITIVE', {level: 'W', code: 'SUPER_PRIMITIVE', message: 'Cannot invoke `super()` inside a constructor of a class that extends a primitive (number/string/etc'});
codes.set('SUPER_INVALID', {level: 'W', code: 'SUPER_INVALID', message: 'Tried to access a property on `super` but that is not a valid value in the current context / class owner so it will just return `undefined`'});
codes.set('PROTO_MERGE', {level: 'W', code: 'PROTO_MERGE', message: 'Merged the __proto__ of two objects because one pointed to Object.prototype and no property had been resolved on it before. This should be fine but may lead to an unforseen problem case. Also, you probably should not be changing __proto__ after 2020.'});
codes.set('BINDING_NO_INIT', {level: 'W', code: 'BINDING_NO_INIT', message: 'A binding without initializer value is sealed to `undefined`, which is rarely what you want'});
codes.set('INSTANCEOF_OBSOLETE', {level: 'W', code: 'INSTANCEOF_OBSOLETE', message: 'You should not need `instanceof` because the model should be able to determine the truthfulness without a doubt'});
codes.set('INSTANCEOF_FAIL', {level: 'W', code: 'INSTANCEOF_FAIL', message: 'The result of an `instanceof` check was found to be `false` at least once'});
codes.set('IN_OBSOLETE', {level: 'W', code: 'IN_OBSOLETE', message: 'You should not need `in` because the model should be able to determine the truthfulness without a doubt'});
codes.set('IN_FAIL', {level: 'W', code: 'IN_FAIL', message: 'The result of an `in` check was found to be `false` at least once'});
codes.set('CONTEXT_NO_THIS', {level: 'W', code: 'CONTEXT_NO_THIS', message: 'A function was called with a context that was not `undefined` or the global object even though it does not access `this` at all'});
codes.set('CONTEXT_MISSING', {level: 'W', code: 'CONTEXT_MISSING', message: 'A function was called with an `undefined` context even though it does access `this`'});
codes.set('SET_PROTOTYPE', {level: 'W', code: 'SET_PROTOTYPE', message: 'Updating the .prototype of a class or constructor can cause property lookups to change, potentially (and unguardedly so) violating the monomorphic principle of properties. All bets are off.'});
codes.set('SET_PROTO', {level: 'W', code: 'SET_PROTOTYPE', message: 'Updating the .__proto__ can cause property lookups to change on this object and others, potentially (and unguardedly so) violating the monomorphic principle of properties. All bets are off.'});
codes.set('TEST_UNDEF', {level: 'W', code: 'TEST_UNDEF', message: 'Conditional tests should use bools. Undefined will work and does not break the model but are always falsy so may indicate problems.'});
codes.set('TEST_NULL', {level: 'W', code: 'TEST_NULL', message: 'Conditional tests should use bools. Nulls will work and do not break the model but are always falsy so may indicate problems.'});
codes.set('TEST_NUMSTR', {level: 'W', code: 'TEST_NUMSTR', message: 'Conditional tests should use bools. Numbers and strings may work but might hide problems. This warning does not break the model.'});
codes.set('TEST_OBJ', {level: 'W', code: 'TEST_OBJ', message: 'Conditional tests should use bools. Objects will work and do not break the model but are always truthy so may indicate problems.'});
codes.set('FUNC_EXPR_NAME_SHADOW', {level: 'W', code: 'FUNC_EXPR_NAME_SHADOW', message: 'The name of a function expression was shadowed by a param or local var. Can you tell the difference?'});
codes.set('UNUSED_DEFAULT_ARG_POLY', {level: 'W', code: 'UNUSED_DEFAULT_ARG_POLY', message: 'The parameter had a default value with a different type than the arg value, but the default value was not used (in this case) so it was not a problem for this reported case.'});
codes.set('SET_NEW_UNSEEN_PROP', {level: 'W', code: 'SET_NEW_UNSEEN_PROP', message: 'Setting a property on an object that did not have that property before and which was not observed yet. It would be wise and clear to explicitly define all possible properties of an object at declaration time.'});
codes.set('SET_NEW_BUT_SEEN_PROP', {level: 'W', code: 'SET_NEW_BUT_SEEN_PROP', message: 'Setting a property on an object that was observed to be `undefined` before already. This will break the model.'});
codes.set('FOR_IN_RHS_PRIMITIVE', {level: 'W', code: 'FOR_IN_RHS_PRIMITIVE', message: 'The rhs of the for-in is a primitive. This will work but makes it effectively a noop so probably not what was intended.'});
codes.set('FOR_OF_NON_ARRAY', {level: 'W', code: 'FOR_OF_NON_ARRAY', message: 'The rhs of a `for-of` was not an array.'}); // TODO: iterabl
codes.set('TEMPLATE_EXPR_STRING', {level: 'W', code: 'TEMPLATE_EXPR_STRING', message: 'The expressions inside a template string ought to be strings.'});
codes.set('GLOBAL_THIS', {level: 'W', code: 'GLOBAL_THIS', message: 'Detected the `this` keyword in a position where it must refer to the global object but that is `undefined` in strict mode'});
codes.set('ARROW_WITH_CONTEXT', {level: 'W', code: 'ARROW_WITH_CONTEXT', message: 'An arrow was called with an explicit context but arrows are implicitly bound to the context of their parent scope so their own context is moot'});
codes.set('CONSOLE_LOG_ARGLESS', {level: 'W', code: 'CONSOLE_LOG_ARGLESS', message: '`console.log` was called without args. Not illegal but may not be intentional.'});
codes.set('CONSOLE_DEBUG_ARGLESS', {level: 'W', code: 'CONSOLE_DEBUG_ARGLESS', message: '`console.debug` was called without args. Not illegal but may not be intentional.'});
codes.set('CONSOLE_WARN_ARGLESS', {level: 'W', code: 'CONSOLE_WARN_ARGLESS', message: '`console.warn` was called without args. Not illegal but may not be intentional.'});
codes.set('CONSOLE_ERROR_ARGLESS', {level: 'W', code: 'CONSOLE_ERROR_ARGLESS', message: '`console.error` was called without args. Not illegal but may not be intentional.'});
codes.set('CONSOLE_ERROR_ARG_STRING', {level: 'W', code: 'CONSOLE_ERROR_ARG_STRING', message: '`console.error` generally takes a string for the first argument and does not tend to serialize objects in a pretty way'});
codes.set('CONSOLE_ERROR_ARGS', {level: 'W', code: 'CONSOLE_ERROR_ARGS', message: '`console.error` was calledw with multiple args but generally only uses the first arg'});
codes.set('CONSOLE_TRACE_ARG_STRING', {level: 'W', code: 'CONSOLE_TRACE_ARG_STRING', message: '`console.trace` generally takes a string for the first argument and does not tend to serialize objects in a pretty way'});
codes.set('CONSOLE_TRACE_ARGS', {level: 'W', code: 'CONSOLE_TRACE_ARGS', message: '`console.trace` was calledw with multiple args but generally only uses the first arg'});
codes.set('CONSOLE_DIR_ARGLESS', {level: 'W', code: 'CONSOLE_DIR_ARGLESS', message: '`console.dir` was called without args. Not illegal but may not be intentional.'});
codes.set('CONSOLE_DIR_ARGS', {level: 'W', code: 'CONSOLE_DIR_ARGS', message: '`console.dir` generally takes two args where the second is an object with options'});
codes.set('CONSOLE_GROUPEND_ARGS', {level: 'W', code: 'CONSOLE_GROUPEND_ARGS', message: '`console.groupEnd` ignores its arguments so passing them on is not going to work.'});
codes.set('IMPLICIT_GLOBAL', {level: 'W', code: 'IMPLICIT_GLOBAL', message: 'Could not resolve identifier to binding. Implicit global? Missing builtin?'});
codes.set('USED_BINDING_BEFORE_DECL', {level: 'W', code: 'USED_BINDING_BEFORE_DECL', message: 'Either this was an implicit global or it was accessed before actually declaring it (that would be a TDZ violation)'});
codes.set('ARRAY_KIND', {level: 'W', code: 'ARRAY_KIND', message: 'The kind of an array was expected to be fetched but the target value was not an array or string'}); // TODO: iterables
codes.set('ARRAY_KIND_READ_BUT_UNDET', {level: 'W', code: 'ARRAY_KIND_READ_BUT_UNDET', message: 'Tried to read the kind of an array but its kind was undetermined. That should mean it was empty and it returns undefined. The array kind is now set to undefined, although that is probably not correct overall. Model is now unsound.'}); // TODO: iterabl
codes.set('ARRAY_KIND_EMPTY', {level: 'W', code: 'ARRAY_KIND_EMPTY', message: 'The kind of an array was required but the kind was not known yet because it started as an empty array and has not yet received any values'});
codes.set('ARRAY_INCLUDES_ARGLESS', {level: 'W', code: 'ARRAY_INCLUDES_ARGLESS', message: 'The `Array#includes` method needs an arg to search for, otherwise it will search for `undefined`, which is unlikely what you want.'});
codes.set('ARRAY_JOIN_ARGLESS', {level: 'W', code: 'ARRAY_JOIN_ARGLESS', message: 'The `Array#join` method will implicitly use "," as the join string. It is advised to be explicit in that value.'});
codes.set('ARRAY_JOIN_ARG1', {level: 'W', code: 'ARRAY_JOIN_ARG1', message: 'The `Array#join` method expects a string its arg.'});
codes.set('ARRAY_JOIN_ARG2', {level: 'W', code: 'ARRAY_JOIN_ARG2', message: 'The `Array#join` method only uses the first arg to join.'});
codes.set('ARRAY_JOIN_CONTEXT', {level: 'W', code: 'ARRAY_JOIN_CONTEXT', message: 'The `Array#join` method requires an array context.'}); // TODO: it's probably generic (I didn't check
codes.set('ARR_MONO_KIND', {level: 'W', code: 'ARR_MONO_KIND', message: 'For the sake of the model arrays can only be monomorphic. In this case there was at least one element that was not compatible with the others.'});
codes.set('SPREAD_BEFORE_REST', {level: 'W', code: 'SPREAD_BEFORE_REST', message: 'The arg being spread does not fully map into a rest param and since the array being spread might be empty, the model cannot guarantee that the type is or is not undefined due to underflow'});
codes.set('SPREAD_NOT_TAIL', {level: 'W', code: 'SPREAD_NOT_TAIL', message: 'Since the model does not know how many elements an array contains it cannot guarantee anything about the position of fixed args when spreading an array between them so we can only support arg spread at the end of the arg list and only very few cases can work soundly'});
codes.set('MERGING_EMPTY_ARRAYS', {level: 'W', code: 'MERGING_EMPTY_ARRAYS', message: 'Setting the kind of an array, which was unknown, to the kind of another array, which was also unknown. This is a current weakness in the system and breaks the soundness.'});
codes.set('PROP_ON_NULL_UNDEF', {level: 'W', code: 'PROP_ON_NULL_UNDEF', message: 'Attempted to read a property from a value that was `null` or `undefined`, which will guarantee a runtime error.'});
codes.set('OBJ_REST_ON_PRIMITIVE', {level: 'W', code: 'REST_ON_PRIMITIVE', message: 'Passed on a primitive to an object rest pattern. This works but would always results in an empty object.'});
codes.set('DYNAMIC_PROP_ACCESS', {level: 'W', code: 'DYNAMIC_PROP_ACCESS', message: 'Since this model does not track actual values, it cannot support dynamic property access, so this access is assumed to return `undefined`, which is probably incorrect. Try to eliminate the dynamic property access or to consolidate them to small helpers.'});
codes.set('DYNAMIC_INDEX_ACCESS_ARRAY', {level: 'W', code: 'DYNAMIC_INDEX_ACCESS_ARRAY', message: 'Dynamic property access of a number property on an array. We can assume that returns the kind of the array but it is not sound as it may return undefined at runtime for OOB indexes.'});
codes.set('DYNAMIC_INDEX_ACCESS_EMPTY_ARRAY', {level: 'W', code: 'DYNAMIC_INDEX_ACCESS_EMPTY_ARRAY', message: 'Dynamic property access of a number property on an EMPTY array. This probably returns `undefined` at runtime and we consider the model to be unsound because of it.'});
codes.set('DYNAMIC_INDEX_ACCESS_STRING', {level: 'W', code: 'DYNAMIC_INDEX_ACCESS_STRING', message: 'Dynamic property access of a number property on an string. We can assume that returns a string but it is not sound as it may return undefined at runtime for OOB indexes.'});
codes.set('DYNAMIC_INDEX_ACCESS_EMPTY_OBJECT', {level: 'W', code: 'DYNAMIC_INDEX_ACCESS_EMPTY_OBJECT', message: 'Dynamic access on an empty object will return `undefined`. The model is considered to be unsound now.'});
codes.set('DYNAMIC_ACCESS_OBJECT_AS_MAP', {level: 'W', code: 'DYNAMIC_ACCESS_OBJECT_AS_MAP', message: 'Dynamic property access on an object that only has properties of the same kind can work but is unsafe because it may also return `undefined`. The model is broken because it cannot guarantee that.'});
codes.set('COMPUTED_PROPERTY', {level: 'W', code: 'COMPUTED_PROPERTY', message: 'Since this model does not track actual values, it cannot support computed properties as it will not know what property is being set. Try to eliminate the dynamic property access or to consolidate them to small helpers.'});
codes.set('PROP_SET_ON_NULL_UNDEF', {level: 'W', code: 'PROP_SET_ON_NULL_UNDEF', message: 'Attempted to set a property on `null` or `undefined`, which would lead to a runtime error.'});
codes.set('PROP_SET_ON_PRIMITIVE', {level: 'W', code: 'PROP_SET_ON_PRIMITIVE', message: 'Attempted to set a property on a primitive value. This will be ignored by JS and is probably not intentional.'});
codes.set('CALLED_UNCALLABLE', {level: 'W', code: 'CALLED_UNCALLABLE', message: 'Attempted to call a value that was not callable. The attempt is ignored but either means there is a bug in the code or there was a problem that has already been reported on that led to this situation. The call will be a noop and treated as if it returned `undefined`.'});
codes.set('SETTIMEOUT_ARG_TYPE', {level: 'W', code: 'SETTIMEOUT_ARG_TYPE', message: 'The first arg to `setTimeout` should be a function or a string.'});
codes.set('SETTIMEOUT_STRING_ARG', {level: 'W', code: 'SETTIMEOUT_STRING_ARG', message: 'While a string is a valid arg type for `setTimeout`, it does mean this model can not check it, so it cannot support that.'});
codes.set('SETTIMEOUT_NUM_ARG', {level: 'W', code: 'SETTIMEOUT_NUM_ARG', message: 'The second arg of `setTimeout` ought to be a number; the delay in ms.'});
codes.set('SETTIMEOUT_EXCESS_ARGS', {level: 'W', code: 'SETTIMEOUT_EXCESS_ARGS', message: '`setTimeout` received more args than the two it uses.'});
codes.set('SETINTERVAL_ARG_TYPE', {level: 'W', code: 'SETINTERVAL_ARG_TYPE', message: 'The first arg to `setInterval` should be a function or a string.'});
codes.set('SETINTERVAL_STRING_ARG', {level: 'W', code: 'SETINTERVAL_STRING_ARG', message: 'While a string is a valid arg type for `setInterval`, it does mean this model can not check it, so it cannot support that.'});
codes.set('SETINTERVAL_NUM_ARG', {level: 'W', code: 'SETINTERVAL_NUM_ARG', message: 'The second arg of `setInterval` ought to be a number; the interval delay in ms.'});
codes.set('SETINTERVAL_EXCESS_ARGS', {level: 'W', code: 'SETINTERVAL_EXCESS_ARGS', message: '`setInterval` received more args than the two it uses.'});
codes.set('CLEARTIMEOUT_NUM_ARG', {level: 'W', code: 'CLEARTIMEOUT_NUM_ARG', message: '`clearTimeout` expects a number, it ignores anything else.'});
codes.set('CLEARTIMEOUT_EXCESS_ARGS', {level: 'W', code: 'CLEARTIMEOUT_EXCESS_ARGS', message: '`clearTimeout` received more args than the one it uses.'});
codes.set('CLEARINTERVAL_NUM_ARG', {level: 'W', code: 'CLEARINTERVAL_NUM_ARG', message: '`clearInterval` expects a number, it ignores anything else.'});
codes.set('CLEARINTERVAL_EXCESS_ARGS', {level: 'W', code: 'CLEARINTERVAL_EXCESS_ARGS', message: '`clearInterval` received more args than the one it uses.'});
codes.set('ERROR_TOSTRING_ARGS', {level: 'W', code: 'ERROR_TOSTRING_ARGS', message: 'Called Error#toString with some args but it ignores them so that signals a potential bug.'});
codes.set('ERROR_STRING_ARG', {level: 'W', code: 'ERROR_STRING_ARG', message: 'Called Error#toString with an arg that was not a string.'});
codes.set('ARRAY_PATTERN_UNSOUND', {level: 'W', code: 'ARRAY_PATTERN_UNSOUND', message: 'This model does not track array contents so it can not guarantee the array passed on to a destructuring pattern has sufficient elements to cover the entire pattern. It assumes it can but that may be incorrect.'});
codes.set('NEW_NOT_CONSTRUCTOR', {level: 'W', code: 'NEW_NOT_CONSTRUCTOR', message: 'Tried to apply `new` to a value that is not a constructor. Ignoring this and returning `undefined` but that is very unlikely to be correct.'});
codes.set('CANNOT_CALL_BUILTIN_CONSTRUCTOR', {level: 'W', code: 'CANNOT_CALL_BUILTIN_CONSTRUCTOR', message: 'Cannot call this builtin constructor without `new`. That will trigger a runtime error.'});
codes.set('BUILTIN_FUNC_NOT_CONSTRUCTOR', {level: 'W', code: 'BUILTIN_FUNC_NOT_CONSTRUCTOR', message: 'Attempted to use `new` on a built-in function that was not a constructor. That will throw a runtime error.'});
codes.set('CONSTRUCTOR_NULL_PARENT', {level: 'W', code: 'CONSTRUCTOR_NULL_PARENT', message: 'Cannot instantiate a constructor when its prototype is `null` or does not exist at all.'});
codes.set('COMPOUND_ASSIGN_TYPE', {level: 'W', code: 'COMPOUND_ASSIGN_TYPE', message: 'Compound assignment must be numbers operands.'});
codes.set('COMPOUND_ASSIGN_PLUS', {level: 'W', code: 'COMPOUND_ASSIGN_PLUS', message: 'Compound addition assignment (`+=`) must be numbers or string, same on both sides.'});
codes.set('PLUS_MERGE_TYPE', {level: 'W', code: 'PLUS_MERGE_TYPE', message: 'The operands to `+` must either both be number or both be strings.'});
codes.set('PLUS_MERGE_NUM_STR', {level: 'W', code: 'PLUS_MERGE_NUM_STR', message: 'The operands to `+` on a string and a number should really explicitly turn the number into a string first. This warning does not break the model.'});
codes.set('PLUS_MERGE_STR_PRIM', {level: 'W', code: 'PLUS_MERGE_STR_PRIM', message: 'The operands to `+` on a string and another primitive should really explicitly turn the primitive into a string first. This warning does not break the model.'});
codes.set('PLUS_MERGE_NUM_UNDEF', {level: 'W', code: 'PLUS_MERGE_NUM_UNDEF', message: 'The operands to `+` on a number and undefined is going to lead to NaN which is unlikely what you want. This warning does not break the model.'});
codes.set('PLUS_MERGE_NUM_NULL', {level: 'W', code: 'PLUS_MERGE_NUM_NULL', message: 'The operands to `+` on a number and null is going to be a regular addition where `null` is `0`. Might not be intentional. This warning does not break the model.'});
codes.set('PLUS_MERGE_NUM_BOOL', {level: 'W', code: 'PLUS_MERGE_NUM_BOOL', message: 'The operands to `+` on a number and boolean is going add `0` (for `false`) or `1` (for `true`) to the number, which is unlikely what you want. This warning does not break the model.'});
codes.set('POLY_PRIMITIVES', {level: 'W', code: 'POLY_PRIMITIVES', message: 'Tried to merge two primitives together (and not the same ones).'});
codes.set('POLY_BUILTINS', {level: 'W', code: 'POLY_BUILTINS', message: 'Tried to merge two builtin values together (and not the same ones).'});
codes.set('POLY_BUILTIN_ARRAY', {level: 'W', code: 'POLY_BUILTIN_ARRAY', message: 'Tried to merge a non-object with a built-in array.'});
codes.set('POLY_OTHER', {level: 'W', code: 'POLY_OTHER', message: 'Tried to merge two objects together but they at least one property had different types (potentially nested/inherited) and so the objects could not be merged.'});
codes.set('POLY_PRIMITIVE_TO_PLACEHOLDER_WITH_PROPS', {level: 'W', code: 'POLY_PRIMITIVE_TO_PLACEHOLDER_WITH_PROPS', message: 'Merging a placeholder with assigned properties to a primitive. This is probably a bug as you cannot set properties on primitives.'});
codes.set('IMPORT_UNKNOWN', {level: 'W', code: 'IMPORT_UNKNOWN', message: 'Tried to import a symbol from a file but did not find an export in that file for that symbol. This would be a runtime error. The model assumes `undefined` for this import, which is almost guaranteed to be incorrect.'});
codes.set('IMPORT_FILE_UNKNOWN', {level: 'W', code: 'IMPORT_FILE_UNKNOWN', message: 'Tried to import a symbol from a file but the file was not processed by the system yet. Either the system is unaware of the file or there is a circular dependency, which the system does not support.'});
codes.set('FUNCTION_MERGE', {level: 'W', code: 'FUNCTION_MERGE', message: 'Tried to merge two functions and this model does not support that right now. I am not sure what that kind of merge would look like. This means one of the two functions is ignored so the output cannot be trusted.'});
codes.set('PARSEFLOAT_ARG1', {level: 'W', code: 'PARSEFLOAT_ARG1', message: 'The first arg to `parseFloat` ought to be a string. Anything else might be a red flag.'});
codes.set('PARSEFLOAT_ARG2', {level: 'W', code: 'PARSEFLOAT_ARG2', message: 'The `parseFloat` function only uses the first arg. It does not have a base arg like `parseInt`.'});
codes.set('PARSEFLOAT_ARGLESS', {level: 'W', code: 'PARSEFLOAT_ARGLESS', message: 'Calling `parseFloat` without any args is pointless.'});
codes.set('PARSEINT_ARG1', {level: 'W', code: 'PARSEINT_ARG1', message: 'The first arg to `parseInt` ought to be a string. Anything else might be a red flag.'});
codes.set('PARSEINT_ARG2', {level: 'W', code: 'PARSEINT_ARG2', message: 'The second arg to `parseInt` is optional but if supplied should be a number; the base to parse in.'});
codes.set('PARSEINT_ARG3', {level: 'W', code: 'PARSEINT_ARG3', message: 'The `parseInt` function only uses the first two args.'});
codes.set('PARSEINT_1_ARG', {level: 'W', code: 'PARSEINT_1_ARG', message: 'It is strongly adviced to always supply a second arg, even if that is just 10, because JS might potentially parse an octal otherwise.'});
codes.set('PARSEINT_ARGLESS', {level: 'W', code: 'PARSEINT_ARGLESS', message: 'Calling `parseInt` without any args is pointless.'});
codes.set('JSON_STRINGIFY_ARGLESS', {level: 'W', code: 'JSON_STRINGIFY_ARGLESS', message: 'Calling `JSON.stringify` without args is bad.'});
codes.set('JSON_STRINGIFY_ARG1', {level: 'W', code: 'JSON_STRINGIFY_ARG1', message: 'The first arg to `JSON.parse` should be a string)'});
codes.set('JSON_STRINGIFY_ARG2', {level: 'W', code: 'JSON_STRINGIFY_ARG2', message: 'The second arg to `JSON.parse` should be a function.'});
codes.set('JSON_STRINGIFY_ARG3', {level: 'W', code: 'JSON_STRINGIFY_ARG3', message: 'The `JSON.parse` function does not use more than two args so passing on more is a red flag.'});
codes.set('JSON_PARSE_RETURN', {level: 'W', code: 'JSON_PARSE_RETURN', message: 'The model cannot know what the shape is of the call to `JSON.parse` so it cannot verify this code.'});
codes.set('SET_WITHOUT_NEW', {level: 'W', code: 'SET_WITHOUT_NEW', message: 'You must use `new` to call `Set`. It will be a runtime error otherwise.'});
codes.set('SET_ARG1', {level: 'W', code: 'SET_ARG1', message: 'The first arg of `Set` is optional but must be an iterable (the model currently only supports arrays)'}); // TODO
codes.set('SET_ARG2', {level: 'W', code: 'SET_ARG2', message: 'The `Set` constructor only supports zero or one args, ignores others'});
codes.set('SET_EMPTY_ARRAY', {level: 'W', code: 'SET_EMPTY_ARRAY', message: 'Created a new Set by passing on an empty array. Not a problem but may also not be intentional.'});
codes.set('SET_FOREACH_CONTEXT', {level: 'W', code: 'SET_FOREACH_CONTEXT', message: 'The `Set#forEach` function expects the context to be a Set instance.'});
codes.set('SET_FOREACH_SET_KIND', {level: 'W', code: 'SET_FOREACH_SET_KIND', message: 'The `Set#forEach` function was called on a Set whose kind is unknown. It may indicate a problem. Or perhaps the callback is never called (DCE).'});
codes.set('MAPSET_FOREACH_ARGLESS', {level: 'W', code: 'MAPSET_FOREACH_ARGLESS', message: 'Calling `Map#forEach` or `Set#forEach` without args is going to lead to a runtime error.'});
codes.set('MAPSET_FOREACH_ARG3_TMI', {level: 'W', code: 'MAPSET_FOREACH_ARG3_TMI', message: 'The `Map#forEach` and `Set#forEach` functions only accept two args and ignore the rest.'});
codes.set('MAPSET_FOREACH_FUNC_ARG', {level: 'W', code: 'MAPSET_FOREACH_FUNC_ARG', message: 'The `Map#forEach` and `Set#forEach` functions require the first arg to be a function.'});
codes.set('MAP_FOREACH_CONTEXT', {level: 'W', code: 'MAP_FOREACH_CONTEXT', message: 'The `Map#forEach` function expects the context to be a Map instance.'});
codes.set('MAP_FOREACH_MAP_KIND', {level: 'W', code: 'MAP_FOREACH_MAP_KIND', message: 'The `Map#forEach` function was called on a Map whose key and value kind were unknown. This may mean the map was empty when this method was called. Or may indicate a different problem. Or perhaps the callback is never called (DCE).'});
codes.set('MAP_FOREACH_MAP_KEY_KIND', {level: 'W', code: 'MAP_FOREACH_MAP_KEY_KIND', message: 'The `Map#forEach` function was called on a Map whose key kind is unknown. It may indicate a problem. Or perhaps the callback is never called (DCE).'});
codes.set('MAP_FOREACH_MAP_VALUE_KIND', {level: 'W', code: 'MAP_FOREACH_MAP_VALUE_KIND', message: 'The `Map#forEach` function was called on a Map whose value kind is unknown. It may indicate a problem. Or perhaps the callback is never called (DCE).'});
codes.set('MAP_WITHOUT_NEW', {level: 'W', code: 'MAP_WITHOUT_NEW', message: 'You must use `new` to call `Map`. It will be a runtime error otherwise.'});
codes.set('MAP_ARG1', {level: 'W', code: 'MAP_ARG1', message: 'The first arg of `Map` is optional but must be an iterable (the model currently only supports arrays)'}); // TODO
codes.set('MAP_HAS_ARG1', {level: 'W', code: 'MAP_HAS_ARG1', message: 'The first arg of `Map#delete` should be of same kind as the Map but was not.'});
codes.set('MAP_ARG1_SUB_ARR', {level: 'W', code: 'MAP_ARG1_SUB_ARR', message: 'The iterable arg must iterate over an array that is a tuple: [key, value]. Otherwise it will trigger a runtime error.'});
codes.set('MAP_ARG2', {level: 'W', code: 'MAP_ARG2', message: 'The `Map` constructor only supports zero or one args, ignores others'});
codes.set('MAP_EMPTY_ARRAY', {level: 'W', code: 'MAP_EMPTY_ARRAY', message: 'Created a new Map by passing on an empty array. Not a problem but may also not be intentional. This will break the model because the array and map have their kind sealed to `undefined`.'});
codes.set('SET_ADD_ARGLESS', {level: 'W', code: 'SET_ADD_ARGLESS', message: 'While you can call `Set#add` without args, it is the same as calling it with `undefined` and you should be explicit in that to prevent confusion.'});
codes.set('MAP_SET_ARGLESS', {level: 'W', code: 'MAP_SET_ARGLESS', message: 'The `Map#set` method uses the first two args. Zero args is unlikely intentional.'});
codes.set('MAP_SET_ARG2', {level: 'W', code: 'MAP_SET_ARG2', message: 'The `Map#set` method uses the first two args. Even if the second is `undefined` you should pass it explicitly to prevent confusion.'});
codes.set('MAP_SET_ARG3', {level: 'W', code: 'MAP_SET_ARG3', message: 'The `Map#set` method only uses the first two args. Any more may be a mistake.'});
codes.set('MAP_SET_CONTEXT', {level: 'W', code: 'MAP_SET_CONTEXT', message: 'The `Map#set` context must be a Map.'});
codes.set('MAP_GET_ARGLESS', {level: 'W', code: 'MAP_GET_ARGLESS', message: 'The `Map#get` method uses the first arg. Zero args means fetching `undefined`, which is rarely the intention.'});
codes.set('MAP_GET_ARG1', {level: 'W', code: 'MAP_GET_ARG1', message: 'The `Map#get` method should be called with an arg that is the same type as the key type of this map.'});
codes.set('MAP_GET_ARG2', {level: 'W', code: 'MAP_GET_ARG2', message: 'The `Map#set` method only uses the first arg. Any more may be a mistake.'});
codes.set('MAP_GET_CONTEXT', {level: 'W', code: 'MAP_GET_CONTEXT', message: 'The `Map#get` context must be a Map.'});
codes.set('REGEXP_ARGLESS', {level: 'W', code: 'REGEXP_ARGLESS', message: 'The `RegExp` function/constructor works without arguments but it will be rare that you actually do not want it to receive any arguments.'});
codes.set('REGEXP_ARG1', {level: 'W', code: 'REGEXP_ARG1', message: 'The `RegExp` function/constructor expects the first arg to be the regex body and it will coerce the first argument to a string.'});
codes.set('REGEXP_ARG2', {level: 'W', code: 'REGEXP_ARG2', message: 'The `RegExp` function/constructor expects the second arg to be a set of flags, which ought to be strings.'});
codes.set('REGEXP_ARG3', {level: 'W', code: 'REGEXP_ARG3', message: 'The `RegExp` function/constructor ignores any arguments beyond the first two'});
codes.set('REGEXP_EXEC_UNSAFE', {level: 'W', code: 'REGEXP_EXEC_UNSAFE', message: 'RegExp#exec can return a `null` or an array of strings and this model cannot determine which ahead of time. Assuming array of strings but this is not sound.'});
codes.set('BUILTIN_ARGLESS', {level: 'W', code: 'BUILTIN_ARGLESS', message: 'The builtin function was called with zero args, even though it expects args'});
codes.set('BUILTIN_ARG1_STRING', {level: 'W', code: 'BUILTIN_ARG1_STRING', message: 'The builtin function expected the first arg to be a string.'});
codes.set('BUILTIN_ARG1_NUMBER', {level: 'W', code: 'BUILTIN_ARG1_NUMBER', message: 'The builtin function expected the first arg to be a number.'});
codes.set('BUILTIN_ARG1_REGEX', {level: 'W', code: 'BUILTIN_ARG1_REGEX', message: 'The builtin function expected the first arg to be a regex.'});
codes.set('BUILTIN_ARG1_OBJ', {level: 'W', code: 'BUILTIN_ARG1_OBJ', message: 'The builtin function expected the first arg to be some kind of object.'});
codes.set('BUILTIN_ARG1_TMI', {level: 'W', code: 'BUILTIN_ARG1_TMI', message: 'The builtin function expected zero args.'});
codes.set('BUILTIN_ARG2_STRING', {level: 'W', code: 'BUILTIN_ARG2_STRING', message: 'The builtin function expected the second arg to be a string.'});
codes.set('BUILTIN_ARG2_NUMBER', {level: 'W', code: 'BUILTIN_ARG2_NUMBER', message: 'The builtin function expected the second arg to be a number.'});
codes.set('BUILTIN_ARG2_MISSING', {level: 'W', code: 'BUILTIN_ARG2_MISSING', message: 'The builtin function expected at least two args but received fewer.'});
codes.set('BUILTIN_ARG2_OBJ', {level: 'W', code: 'BUILTIN_ARG2_OBJ', message: 'The builtin function expected the second arg to be some kind of object.'});
codes.set('BUILTIN_ARG2_TMI', {level: 'W', code: 'BUILTIN_ARG2_TMI', message: 'The builtin function expected one arg and ignores the rest.'});
codes.set('BUILTIN_ARG3_STRING', {level: 'W', code: 'BUILTIN_ARG3_STRING', message: 'The builtin function expected the third arg to be a string.'});
codes.set('BUILTIN_ARG3_NUMBER', {level: 'W', code: 'BUILTIN_ARG3_NUMBER', message: 'The builtin function expected the third arg to be a number.'});
codes.set('BUILTIN_ARG3_MISSING', {level: 'W', code: 'BUILTIN_ARG3_MISSING', message: 'The builtin function expected at least three args but received fewer.'});
codes.set('BUILTIN_ARG3_TMI', {level: 'W', code: 'BUILTIN_ARG3_TMI', message: 'The builtin function expected two args and ignores the rest.'});
codes.set('BUILTIN_ARG4_TMI', {level: 'W', code: 'BUILTIN_ARG4_TMI', message: 'The builtin function expected three args and ignores the rest.'});
codes.set('BUILTIN_CONTEXT_BOOL', {level: 'W', code: 'BUILTIN_CONTEXT_BOOL', message: 'The builtin function expected the context of the call to be a boolean.'});
codes.set('BUILTIN_CONTEXT_STRING', {level: 'W', code: 'BUILTIN_CONTEXT_STRING', message: 'The builtin function expected the context of the call to be a string.'});
codes.set('BUILTIN_CONTEXT_NUMBER', {level: 'W', code: 'BUILTIN_CONTEXT_NUMBER', message: 'The builtin function expected the context of the call to be a number.'});
codes.set('BUILTIN_CONTEXT_ARRAY', {level: 'W', code: 'BUILTIN_CONTEXT_ARRAY', message: 'The builtin function expected the context of the call to be an array.'});
codes.set('BUILTIN_CONTEXT_REGEX', {level: 'W', code: 'BUILTIN_CONTEXT_STRING', message: 'The builtin function expected the context of the call to be a regex.'});
codes.set('BUILTIN_CONTEXT_MAP', {level: 'W', code: 'BUILTIN_CONTEXT_MAP', message: 'The builtin function expected the context of the call to be a map.'});
codes.set('BUILTIN_CONTEXT_SET', {level: 'W', code: 'BUILTIN_CONTEXT_SET', message: 'The builtin function expected the context of the call to be a set.'});
codes.set('LOGICAL_OPERANDS_SAME_PRIMITIVE', {level: 'W', code: 'LOGICAL_OPERANDS_SAME_PRIMITIVE', message: 'Found a logical operator (`||` or `&&`) with non-bools that were the same. This might work and will not break the model but they ought to be bools.'});
codes.set('LOGICAL_OPERANDS_NULL_UNDEF_LEFT', {level: 'W', code: 'LOGICAL_OPERANDS_NULL_UNDEF_LEFT', message: 'Found a logical operator (`||` or `&&`) with `undefined` or `null` to the left. This will work but the outcome is fixed depending on the op. This will not break the model but might mean trouble.'});
codes.set('LOGICAL_OPERANDS_PRIM_LEFT', {level: 'W', code: 'LOGICAL_OPERANDS_NULL_UNDEF_LEFT', message: 'Found a logical operator (`||` or `&&`) with a "not nullable primitive" to the left. This may work but the outcome cannot be statically determined so it breaks the model.'});
codes.set('LOGICAL_OPERANDS_OBJ_LEFT', {level: 'W', code: 'LOGICAL_OPERANDS_OBJ_LEFT', message: 'Found a logical operator (`||` or `&&`) with an object to the left. This works but the return value is static depending on the operator, may indicate a problem. The operator should be used with bools. This case does not break the model.'});
codes.set('MATH_ARG_NUMBER', {level: 'W', code: 'MATH_ARG_NUMBER', message: 'All args to this math function are expected to be a number.'});
codes.set('NO_ITERATORS', {level: 'W', code: 'NO_ITERATORS', message: 'The model does not support iterators so .keys(), .value(), and .entries() cannot be modeled on Map and Set right now.'});
codes.set('OBJECT_GETPROTOTYPEOF_NULL', {level: 'W', code: 'OBJECT_GETPROTOTYPEOF_NULL', message: 'Trying to get the prototype of `undefined` or `null` will lead to a runtime error. This probably broke the model as we can only return `undefined` for it.'});
codes.set('OBJECT_KEYS', {level: 'W', code: 'OBJECT_KEYS', message: 'The model cannot get the .keys() of an object. It will just return an array of strings since that is the most likely. Should not break the model.'});
codes.set('OBJECT_VALUES', {level: 'W', code: 'OBJECT_VALUES', message: 'This model does not really support doing `Object.values()` on an object. Will return an array of undefined and that is unlikely to be correct.'});
codes.set('INFINITE_RECURSION_MAYBE', {level: 'W', code: 'INFINITE_RECURSION_MAYBE', message: 'Is this a case of infinite recursion? Or regular recursion?'});
codes.set('OBJ_SPREAD_STRING', {level: 'W', code: 'OBJ_SPREAD_STRING', message: 'Spreading a string is legit but this model does not track strings so it cannot know which properties are added as a result so the model is broken now.'});
codes.set('DELETE_MEH', {level: 'W', code: 'DELETE_MEH', message: 'The `delete` operator will remove properties which the model currently does not support.'});
codes.set('TOFIX', {level: 'W', code: 'TOFIX', message: 'This code path is not yet implemented / something is missing. Consider the model broken.'});

export function createLinter() {
  let messages = [];
  let suppressStack = [];
  let suppressed = false;

  function check(type, loc, ...args) {
    ASSERT(codes.has(type), 'Unknown linting code: ' + type);
    if (suppressed) return;

    log('Lint problem: ' + RESET + RED_WHITE + type + RESET, '::', args, '::', codes.get(type).message);

    loc === null || ASSERT_LOC(loc); // test merge will get locs that are null
    messages.push({type, args, loc});
  }
  function setMessages(arr) {
    messages = arr;
  }
  function getMessages() {
    return messages;
  }

  function suppress(bool) {
    ASSERT(typeof bool === 'boolean', 'should be bool', bool);
    if (bool === true) {
      if (suppressStack.length === 0) log(WHITE_BLACK + '!LINT!' + RESET, ':: linting is ' + (bool ? 'now' : 'no longer') + ' suppressed...');
      suppressStack.push(suppressed);
      suppressed = true;
    } else {
      suppressed = suppressStack.pop();
      if (suppressStack.length === 0) log(WHITE_BLACK + '!LINT!' + RESET, ':: linting is ' + (bool ? 'now' : 'no longer') + ' suppressed...');
    }
  }
  function resetSuppress(bool) {
    suppressed = false;
  }

  return {
    check,
    setMessages,
    getMessages,
    suppress,
    resetSuppress,
  };
}
