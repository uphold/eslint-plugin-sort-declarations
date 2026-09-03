# eslint-plugin-sort-declarations

An ESLint plugin to sort module-level and block-level declarations.

## Status

[![npm version][npm-image]][npm-url]
[![build status][ci-image]][ci-url]

## Installation

You'll first need to install [ESLint](https://eslint.org/):

```sh
npm install eslint --save-dev
```

Next, install `eslint-plugin-sort-declarations`:

```sh
npm install eslint-plugin-sort-declarations --save-dev
```

## Configuration

```js
// eslint.config.js
const sortDeclarations = require('eslint-plugin-sort-declarations');

module.exports = [
  {
    plugins: {
      'sort-declarations': sortDeclarations
    },
    rules: {
      'sort-declarations/sort-export-declarations': 'error',
      'sort-declarations/sort-module-declarations': 'error',
      'sort-declarations/sort-variable-declarations': 'error'
    }
  }
];
```

## Rules

### `sort-export-declarations`

Enforces a consistent ordering of module-level `export` statements that don't declare a value (`export * from '...'`, `export { name } from '...'`, `export { name };`). Declarations are grouped and sorted as follows:

1. Local bindings — `export { name };` with no `from` source
2. Non-local re-exports — `export * from 'react'`, `export { name } from 'lodash'`
3. Local re-exports — `export * from './local'`, `export { name } from './local'`

Within each group, declarations are sorted alphabetically (case-sensitive) by their exported name (for local bindings) or source path (for re-exports). Any non-export statement between export declarations starts a new region, sorted independently of the others. A blank line is required between groups and removed between declarations within the same group.

This rule is auto-fixable.

**Example:**

```js
// ✗ incorrect
export * from './local';
export * from 'react';

// ✓ correct
export * from 'react';

export * from './local';
```

### `sort-module-declarations`

Enforces a consistent ordering of module-level declarations. Declarations are grouped and sorted as follows:

1. SCREAMING_SNAKE_CASE constants
2. `let` / `var` declarations
3. `const` declarations
4. `const` call/new-expression declarations
5. Functions
6. PropTypes objects

Within each group, declarations with dependencies on other declarations in the same group come first, then the rest are sorted alphabetically. Blank lines between groups and between dependent declarations are enforced.

In files containing GraphQL tagged template literals (`gql` / `graphql`), a separate ordering is applied:

1. Fragments
2. Queries
3. Mutations
4. Subscriptions
5. `let` / `var` declarations
6. `const` declarations (includes SCREAMING_SNAKE)
7. `const` call/new-expression declarations
8. Functions
9. PropTypes objects

`require()` calls are not sorted and act as region separators — declarations on either side of a `require` are sorted independently.

This rule is auto-fixable.

**Example:**

```js
// ✗ incorrect
const b = 1;
const a = 2;

// ✓ correct
const a = 2;
const b = 1;
```

### `sort-variable-declarations`

Enforces a consistent ordering of variable declarations both at module level and inside blocks (`BlockStatement`).

**Sort order within a group:**

1. Array destructuring (`const [a] = ...`)
2. Object destructuring (`const { a } = ...`)
3. Identifiers (`const a = ...`)

Within each type, declarations are sorted alphabetically (case-insensitive) by the first key or element name.

**Block-level sub-groups** — declarations are further ordered by:

1. General declarations
2. `useMemo` calls
3. `useCallback` calls

In blocks, all variable declarations must appear before any non-variable statements. `IfStatement` nodes act as region separators — declarations on either side are sorted independently.

**Blank line rules:**

- A blank line is required between a declaration and one that depends on it.
- A blank line is required between multi-line declarations.
- A blank line is required between different sub-groups.
- Blank lines between non-dependent one-liners in the same group are removed.

**Exclusions:**

- `require()` calls are not sorted.
- Declarations with multiple declarators (`const a = 1, b = 2`) are not sorted.
- A `'worklet'` directive at the top of a block is skipped.
- Groups containing inter-dependencies are not reordered (dependency order is preserved).

This rule is auto-fixable.

**Example:**

```js
// ✗ incorrect
const { z, a } = obj;

// ✓ correct
const { a, z } = obj;
```

#### Safety model — when sorting is suppressed

Reordering variable declarations is only safe when the reorder is **observably equivalent** to the original — i.e. no caller can tell which order ran. Most of the time that's true (declarations are independent), but it's not always true: an initializer can have side effects (mutations, async work, IO, throws), or read state that an earlier statement mutated. The rule cannot prove purity from static analysis alone, so it relies on a layered allowlist of shapes that are safe by construction or by convention.

The rule **suppresses sorting** for any group containing a declaration whose initializer is not on the allowlist. This is intentionally conservative — false negatives (a safe sort skipped) are cosmetic; false positives (an unsafe sort applied) corrupt program behaviour. Past examples of false positives that motivated this design:

- `setTimeout(() => abort(), t)` placed _after_ `await fetch(...)` → abort timer never fires.
- `parts.join('-')` placed _before_ `parts.pop()` → pop mutates after the join, joined string is wrong.
- `await stepPromise` placed _before_ the `callback()` that triggers it → promise hangs forever.
- `const oldestAllowedDate = new Date(todayAtMidnight)` reordered relative to `const todayAtMidnight = new Date()` — non-deterministic timestamp swap.

#### Allowlist layers

An initializer is considered safe to reorder if it falls into one of these layers (defined in `lib/rules/sort-variable-declarations.js`):

1. **Pure value shapes** — literals, identifiers, `this`, function/arrow/class expressions, JSX, member access, unary/binary/logical/conditional expressions, array/object literals, template literals (with pure interpolations), and TypeScript casts. Recursive: a parent shape is pure only if all its children are pure.

2. **Hook calls** — any call whose callee starts with `use` (`useFoo(...)`, `Namespace.useBar(...)`). React's rules-of-hooks guarantees these are called in the same order on every render once the source is fixed.

3. **Known-pure built-in callees** — `Number`, `String`, `Boolean`, `BigInt`, `parseInt`, `parseFloat`, `isNaN`, `isFinite`, `Object.{freeze, keys, values, entries, fromEntries, create, ...}`, `Array.{from, of, isArray}`, `Math.{abs, ceil, floor, round, sqrt, pow, max, min, ...}` (excluding `random`), `JSON.{stringify, parse}`, `Number.{isInteger, isFinite, ...}`, `String.{fromCharCode, fromCodePoint}`, `Symbol.{for, keyFor}` (excluding the `Symbol(...)` constructor), `PropTypes.{any, array, arrayOf, bool, element, elementType, exact, func, instanceOf, node, number, object, objectOf, oneOf, oneOfType, shape, string, symbol}` (validator factories only — excludes side-effecting `checkPropTypes`/`resetWarningCache`), plus a curated set of String/Array prototype reads (`toLowerCase`, `toUpperCase`, `trim`, `slice`, `concat`, `at`, `indexOf`, `lastIndexOf`, `includes`, `split`, `match`, `padStart`, `padEnd`, `toString`, `valueOf`, `toFixed`, etc.). All require their arguments to be pure.

4. **Project-convention callees** — identifier callees matching `get*`, `is*`, `has*`, `format*` (with the next character uppercase, so `getter`/`formatter`/`gettext` are correctly rejected) plus the bare `t` (i18n). Member calls are accepted when the namespace is a PascalCase identifier (`DateHelper.getFormattedDate`, `I18n.t`, `IdentityHelper.getIdentity`); lowercase namespaces (`localStorage.getItem`, `obj.get`, `props.handler`) are rejected because they could be IO, mutation, or arbitrary instance methods.

#### Cross-statement guard

When the rule moves variable declarations across non-variable statements (the _vars-before-non-vars_ reorder), it applies a stricter check than the within-block sort: it bails on **any** non-hook call in the moved declaration's initializer, even if that call is on the allowlist. The reason is that the moved declaration may _read state mutated by the non-var statement_ it crosses (e.g., `MockDate.set(now); const r = isDateInLastMonth(date)` — `isDateInLastMonth` reads the mocked `Date.now()`, which the prior statement just set). Hook calls are excepted because hooks are conventionally called at the top of components and are not interleaved with mutating statements.

#### Known limitations and accepted false negatives

These shapes are **rejected** by the allowlist even though they are usually safe in practice. Sorting is suppressed for groups containing them:

- `new Blob(...)`, `new FormData()`, `new XMLHttpRequest()`, `new Proxy(...)`, `new BigNumber(...)`, `new MyClass()` — all `NewExpression` is blocked because the rule can't distinguish value-semantic constructors from non-deterministic (`new Date()`) or registration-side-effecting (`new EventEmitter()`) ones.
- `arr.map(fn)` / `.filter(fn)` / `.find(fn)` / `.some(fn)` / `.every(fn)` / `.reduce(fn)` — the callback is invoked synchronously during the call. Pure if the callback is a projection (`x => x.foo`); unsafe if the callback has side effects. The rule has no way to verify callback purity.
- `<expr>.format(...)`, `<expr>.gt(x)`, `<expr>.lt(x)`, `<expr>.div(x)`, `<expr>.isZero()` — library-specific value methods (BigNumber, day.js, Intl). Pure in their own libraries but the property name alone doesn't prove that. To allowlist these, you'd need to either expand the prototype-methods set (risk of false positives) or relax the PascalCase requirement on member calls (risk of allowing `obj.set(...)`-style mutations).
- `localStorage.getItem(...)`, `sessionStorage.getItem(...)`, `path.join(...)`, `queryString.parse(...)` — pure reads on lowercase namespaces. Could be allowlisted by adding the namespace to `KNOWN_PURE_NAMESPACES` if you accept the risk that another module of the same name might shadow them.
- `form.watch(...)`, `handleSubmit(...)`, `getValues()` (react-hook-form) — read-only subscriptions / pure factories. Allowlisting them would require either an explicit member-name list or relaxing the PascalCase requirement.

These shapes are **accepted** by the allowlist even though they could be unsafe under specific anti-conventions:

- `getOrCreateUser(...)` — matches `get*`, treated as pure, but actually mutates if missing. The rule cannot detect this from the name alone.
- `getNextId()` — matches `get*`, but advances a counter on each call. Order matters but the rule won't see it.
- `isAuthenticated()` — typically a pure predicate, but might trigger token refresh as a side effect.
- Plain member access `obj.foo` — could be a getter property with side effects (rare in practice but legal).

The accepted-false-positives set is small in practice: in an audit of ~360 affected files in the host codebase, only two project-helper callees turned out to be borderline (`getRootNavigator` returning a navigation singleton, `getGeolocation` reading `document.cookie`).

#### How to tighten or loosen

To make the rule **more conservative** (skip more sorts):

- Remove entries from `KNOWN_PURE_GLOBAL_FNS`, `KNOWN_PURE_NAMESPACES`, `KNOWN_PURE_PROTOTYPE_METHODS`, or `PROJECT_CONVENTION_PREFIXES` in `lib/rules/sort-variable-declarations.js`.
- Drop `'t'` from `PROJECT_CONVENTION_EXACT_NAMES` if your codebase has non-i18n functions named `t`.
- Add the PascalCase namespace requirement to the bare-identifier project-convention check (currently bare identifiers like `getFoo()` are accepted regardless of where they're imported from).
- Drop the project-convention layer entirely — sorting only applies to pure value shapes, hooks, and built-ins.

To make the rule **more permissive** (sort more aggressively):

- Add specific lowercase namespaces to `KNOWN_PURE_NAMESPACES` (`form`, `localStorage`, `path`, `queryString`) if your team is confident those names are not shadowed by mutating instances.
- Add prototype methods to `KNOWN_PURE_PROTOTYPE_METHODS` for libraries you rely on (`gt`, `lt`, `isZero`, `decimalPlaces`, `toISOString`, `getMonth`, etc.). Watch for ambiguous names — `replace` is excluded because of `history.replace(...)` / `router.replace(...)`.
- Allowlist specific `NewExpression` callees — e.g., a `KNOWN_PURE_CONSTRUCTORS = new Set(['Blob', 'FormData', 'XMLHttpRequest', 'Proxy', 'BigNumber'])`. Note that `new Date()` and `new EventEmitter()` should NEVER be on this list.
- Relax the project-convention member-call check to allow lowercase namespaces (this widens coverage to `localStorage.getItem`, `obj.getX`, etc., at the cost of accepting `cache.getOrCreate(...)`-style anti-conventions).

When loosening, audit a sample of affected files to confirm the new sorts are observably safe. The test file (`tests/sort-variable-declarations.js`) documents many edge cases — both `valid` (must-not-sort) and `invalid` (must-sort) — which serve as a regression suite for any allowlist change.

#### Risk taxonomy (what _could_ break if the rule were too permissive)

These are the categories of order-sensitive code the rule is designed to avoid touching. The test file contains a `valid` test for each:

1. **Side-effecting calls** — `arr.pop()`, `set.add(x)`, `nextId()`, `logger.info(...)`, `iter.next()`.
2. **Non-deterministic calls** — `Date.now()`, `performance.now()`, `Math.random()`, `crypto.randomBytes()`, `uuid()`, `new Date()`.
3. **Promise creation order** — `fetchFoo(); fetchBar();` (network requests fire on creation).
4. **Throw ordering** — `parseStrict(input); audit(input);` — order changes which one throws first and which side effects already happened.
5. **Tagged templates** — `` sql`...` ``, `` gql`...` `` — the tag function executes on creation.
6. **`let` reassigned downstream** — only matters if the initializer is itself impure (covered by category 1).
7. **Getter side effects on member access** — known limitation; rule trusts the convention.
8. **Stateful iterables consumed via spread** — `[...gen()]` (spread of a call) is correctly blocked; `[...sharedIter]` (spread of an identifier) is a known limitation.
9. **`new Expression` with side effects** — `new EventEmitter()`, `new AbortController()` — all `NewExpression` is blocked uniformly.

## License

[MIT](https://opensource.org/licenses/MIT)

## Contributing

### Development

Install dependencies:

```bash
npm i
```

Run tests:

```bash
npm run test
```

### Cutting a release

The release process is automated via the [release](https://github.com/uphold/eslint-plugin-sort-declarations/actions/workflows/release.yaml) GitHub workflow. Run it by clicking the "Run workflow" button.

[npm-image]: https://img.shields.io/npm/v/eslint-plugin-sort-declarations.svg
[npm-url]: https://www.npmjs.com/package/eslint-plugin-sort-declarations
[ci-image]: https://github.com/uphold/eslint-plugin-sort-declarations/actions/workflows/ci.yml/badge.svg?branch=master
[ci-url]: https://github.com/uphold/eslint-plugin-sort-declarations/actions/workflows/ci.yml
