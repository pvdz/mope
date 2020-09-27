# Mope

> A mix of Hegel on steroids and Prepack on the meta level

It was never meant to be like [Prepack](https://prepack.io/), and I only learned about [Hegel](https://hegel.js.org/) near the end of my time into this project. But it's a good way to describe it :)

> A broken zero config type checker for JavaScript (ES6 ~ ES2020)

Mope is a failed attempt at creating a zero effort sound and complete type checker that targets a subset of JS. It is broken because there are some inherent problems with the current model (v4) that require a vastly different approach in some areas and because even if that gets fixed, it would still only work on a very strict subset of the language which may not be practical.

Beyond that, it's just too time consuming to eliminate all the rough edges and I cannot justify putting more time into it than I already have at this point.

What's left is a nice experiment with too much time spent. It works to a certain degree but there are too many rough edges for it to be actually useful, including infinite loops, unimplemented language features, and probably a whole bunch of actual bugs.

However, on the surface it looks pretty good :)

## Usage

There's a repl. Start typing. By default it will load a random test case. Refresh to load a new test case.

To run tests (at the time of writing the flag was still required):

```
node --experimental-modules tests/index.mjs
```

To try and parse from an entry point (good luck!):

```
node --experimental-modules tests/gen/gen.mjs
```

You can add `-v` for verbose output. This will greatly help debugging the traces.

You can add `-e <file>` to start parsing that file as entry point. By default it will parse Mope's own `index.mjs`.

After parsing, it will generate a new `exported_case.js`, which you can load in the repl (use a simple local static file server to get that working).

## High level overview

Mope is a type checker that assumes all bindings have a monomorphic typing. To the extreme. However it allows for functions to be polymorphic in terms of their arguments and return values, while demanding the same restrictions from their body.

It starts from an entry point and follows the function flow as a real program does, while ignoring branching logic. It will report any case where a value violates the monomorphic rules. 

These warnings include being used in places where a particular type of value is expected like statement logic expecting booleans (`if (1)`), comparisons against values of different types (`1 === 'a'`), and inconsistent binding initialization (`let a = x ? 'a' : undefined`).

When a function call is encountered it will meta-invoke that function and repeat the same thing. It uses a call cache to memoize the return type, working on the assumption that a function that is called with the same arguments, the same context, and the same closure, should always return the same type. This works quite well except the current model can not easily "merge" function types together, or even detect that two functions are equal, which ultimately completely breaks the caching and all the safety that goes along with it.

It's current model is the fourth version, high level speaking, which is outperforming its predecessors but ultimately still too broken to be useful.

## Tees

I called the type class "Tee" so you'll see "tee" and "tid" a lot. A "tid" is a string that represents the type. For dynamic resolved types that's, at this point, a prefix that's a hint of the type followed by a global increment.

The beauty about this system is that for builtins, the tid describes what they are. For example, "Array#pop" is the tid for the function representing `Array.prototype.pop`. The whole builtin library is modeled this way.

The tids themselves are immutable. Or were, anyways, but the last iteration allowed for non-primitives to have their properties be expanded (only). 

In addition it allowed for a "placeholder" type which could resolve to a non-placeholder at a later time. The placeholders are an artifact of empty arrays, maps, and sets, as well as a trick to catch infinite recursion (`function f(a) { if (--a>0) return f(a); return 0; } f(10);`).

When Tees get merged together into one type, their `.alias` property of one Tee will point to the other Tee. This doesn't always work nicely, especially for placeholders, and may cause some bugs where the code assumes a tid is fully resolved when it isn't yet. An artifact of earlier assumption that tids were immutable and always known at time of evaluation.

## Support

Mope supports a deep level of prototypal inheritance. There's probably some small bugs there but overall it can track inheritance related typing out of the box.

Most of the builtin library is accounted for. These builtins are special cased and should do what the language says it would do, typing wise.

Beyond that it might be faster to state what's not supported;

- async (haven't tried, not sure what problems might show up, if any)
- generators (I think doable, just haven't bothered)
- nullables (inorite, needs to be fixed in v5)
- dynamic property access (some things do work, under protest, like index access on arrays or objects-as-maps)
- merging functions (I have some ideas but ultimately this is quite hard to do)
- branching logic (this was a design decision and ultimately a mistake, needs v5 to get fixed)
- Symbols
- Bigint
- All the edge cases of bind on arrows and classes
- Builtins plain funcs and `new` (many are not implemented)
- Spread on many of the builtins
- for-await
- actual try/catch logic (not sure if that's properly possible?)
- weak comparison (by design although you could implement it)
- meta property level (configurable etc, the defineProperty stuff. Doable but not worth it for me)
- getters/setters (easily doable, just some work)
- valueOf/toString internal logic (like how you can hack around `a--` etc)
- Proxy (this should be doable but will be quite a complexity strain to support)
- eval / Function (nigh impossible)
- non-strict mode (doable but makes the whole model a lot more complex due to edge cases and default global context)
- function param defaults are evaluated right to left, meaning `f(x, y = g(x)){}` will result in assertion errors due to TDZing, sort of
- Recursion cases. This ties into not being able to create a reliable digest for a function call, leaving the model unable to detect certain recursion cases.

## Future

I'm unlikely to continue working on this project any further without some kind of financial motivation. So, never.
