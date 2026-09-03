'use strict';

const { RuleTester } = require('eslint');
const rule = require('../lib/rules/sort-module-declarations');

const esmTester = new RuleTester({ parserOptions: { ecmaVersion: 2020, sourceType: 'module' } });
const ruleTester = new RuleTester({ parserOptions: { ecmaVersion: 2020 } });

ruleTester.run('sort-module-declarations', rule, {
  invalid: [
    // two single-line functions out of alphabetical order
    {
      code: 'function zoo() {}\n\nfunction alpha() {}',
      errors: [{ messageId: 'sortOrder' }],
      output: 'function alpha() {}\nfunction zoo() {}'
    },
    // three single-line functions out of order — all reordered in one fix
    {
      code: 'function zoo() {}\n\nfunction alpha() {}\n\nfunction mid() {}',
      errors: [{ messageId: 'sortOrder' }],
      output: 'function alpha() {}\nfunction mid() {}\nfunction zoo() {}'
    },
    // function (group 5) before SCREAMING_SNAKE const (group 1) — group ordering violated
    {
      code: 'function zoo() {}\n\nconst A = 1;',
      errors: [{ messageId: 'sortOrder' }],
      output: 'const A = 1;\n\nfunction zoo() {}'
    },
    // two single-line functions out of alphabetical order
    {
      code: 'function b() {}\n\nfunction a() {}',
      errors: [{ messageId: 'sortOrder' }],
      output: 'function a() {}\nfunction b() {}'
    },
    // two same-group one-liner consts in wrong order — no blank line needed between them
    {
      code: 'const b = 1;\nconst a = 2;',
      errors: [{ messageId: 'sortOrder' }],
      output: 'const a = 2;\nconst b = 1;'
    },
    // uppercase sorts before lowercase — Garden (G=71) before ball (b=98)
    {
      code: 'const ball = 1;\nconst Garden = 2;',
      errors: [{ messageId: 'sortOrder' }],
      output: 'const Garden = 2;\nconst ball = 1;'
    },
    // multi-line functions in wrong order — body text swapped correctly
    {
      code: ['function b() {', '  return 1;', '}', '', 'function a() {', '  return 2;', '}'].join('\n'),
      errors: [{ messageId: 'sortOrder' }],
      output: ['function a() {', '  return 2;', '}', '', 'function b() {', '  return 1;', '}'].join('\n')
    },
    // three multi-line functions out of order — all reordered in one fix
    {
      code: [
        'function c() {',
        '  return 1;',
        '}',
        '',
        'function a() {',
        '  return 2;',
        '}',
        '',
        'function b() {',
        '  return 3;',
        '}'
      ].join('\n'),
      errors: [{ messageId: 'sortOrder' }],
      output: [
        'function a() {',
        '  return 2;',
        '}',
        '',
        'function b() {',
        '  return 3;',
        '}',
        '',
        'function c() {',
        '  return 1;',
        '}'
      ].join('\n')
    },
    // sort violation + missing blank line — fixed in one pass
    {
      code: ['function b() {', '  return 1;', '}', 'function a() {', '  return 2;', '}'].join('\n'),
      errors: [{ messageId: 'sortOrder' }],
      output: ['function a() {', '  return 2;', '}', '', 'function b() {', '  return 1;', '}'].join('\n')
    },
    // SCREAMING_SNAKE after regular const — sort + blank line fixed in one pass
    {
      code: ['const alpha = 1;', 'const BETA = 2;'].join('\n'),
      errors: [{ messageId: 'sortOrder' }],
      output: ['const BETA = 2;', '', 'const alpha = 1;'].join('\n')
    },
    // const (group 3) before function (group 5) but missing blank line — sort + blank line fixed in one pass
    {
      code: ['function a() {', '  return 1;', '}', 'const b = 1;'].join('\n'),
      errors: [{ messageId: 'sortOrder' }],
      output: ['const b = 1;', '', 'function a() {', '  return 1;', '}'].join('\n')
    },
    // missing blank line between const (group 3) and function (group 5) — different groups require blank line
    {
      code: ['const a = 1;', 'function b() {', '  return 1;', '}'].join('\n'),
      errors: [{ messageId: 'missingBlankLine' }],
      output: ['const a = 1;', '', 'function b() {', '  return 1;', '}'].join('\n')
    },
    // missing blank line between two adjacent multi-line functions in same group
    {
      code: ['function a() {', '  return 1;', '}', 'function b() {', '  return 2;', '}'].join('\n'),
      errors: [{ messageId: 'missingBlankLine' }],
      output: ['function a() {', '  return 1;', '}', '', 'function b() {', '  return 2;', '}'].join('\n')
    },
    // missing blank line between multi-line functions with dependency — dependency check fires for non-one-liners
    {
      code: ['function a() {', '  return 1;', '}', 'function b() {', '  return a();', '}'].join('\n'),
      errors: [{ messageId: 'missingBlankLine' }],
      output: ['function a() {', '  return 1;', '}', '', 'function b() {', '  return a();', '}'].join('\n')
    },
    // let (group 2) after regular const (group 3) — let must come before const
    {
      code: 'const a = 1;\n\nlet b = 2;',
      errors: [{ messageId: 'sortOrder' }],
      output: 'let b = 2;\n\nconst a = 1;'
    },
    // var (group 2) after regular const (group 3) — var must come before const
    {
      code: 'const a = 1;\n\nvar b = 2;',
      errors: [{ messageId: 'sortOrder' }],
      output: 'var b = 2;\n\nconst a = 1;'
    },
    // PropTypes object (group 6) before function (group 5) — functions come before PropTypes
    {
      code: 'const propTypes = { foo: PropTypes.string };\n\nfunction render() {}',
      errors: [{ messageId: 'sortOrder' }],
      output: 'function render() {}\n\nconst propTypes = { foo: PropTypes.string };'
    },
    // dependency ordering — b uses a but b appears first, a must come first
    {
      code: ['function b() {', '  return a();', '}', '', 'function a() {', '  return 1;', '}'].join('\n'),
      errors: [{ messageId: 'sortOrder' }],
      output: ['function a() {', '  return 1;', '}', '', 'function b() {', '  return a();', '}'].join('\n')
    },
    // callDeps — result directly calls foo, foo (arrow fn, group 5) must precede result (const call, group 4)
    {
      code: 'const result = foo();\n\nconst foo = () => {};',
      errors: [{ messageId: 'sortOrder' }],
      output: 'const foo = () => {};\n\nconst result = foo();'
    },
    // const call (group 4) before plain const (group 3) — plain const must come first
    {
      code: 'const result = foo();\nconst value = 42;',
      errors: [{ messageId: 'sortOrder' }],
      output: 'const value = 42;\n\nconst result = foo();'
    },
    // missing blank line between plain const (group 3) and const call (group 4)
    {
      code: 'const value = 42;\nconst result = foo();',
      errors: [{ messageId: 'missingBlankLine' }],
      output: 'const value = 42;\n\nconst result = foo();'
    },
    // arrow function (group 5) before SCREAMING_SNAKE const (group 1) — group ordering violated
    {
      code: 'const foo = () => {};\n\nconst LIMIT = 10;',
      errors: [{ messageId: 'sortOrder' }],
      output: 'const LIMIT = 10;\n\nconst foo = () => {};'
    },
    // function expression (group 5) before regular const (group 3) — const must come before function expression
    {
      code: ['const handler = function() {', '  return 1;', '};', '', 'const value = 42;'].join('\n'),
      errors: [{ messageId: 'sortOrder' }],
      output: ['const value = 42;', '', 'const handler = function() {', '  return 1;', '};'].join('\n')
    },
    // const new expression (group 4) before regular const (group 3) — const must come first
    {
      code: ['const store = new Store(', '  option', ');', '', 'const value = 42;'].join('\n'),
      errors: [{ messageId: 'sortOrder' }],
      output: ['const value = 42;', '', 'const store = new Store(', '  option', ');'].join('\n')
    },
    // const call expression (group 4) before regular const (group 3) — const must come first
    {
      code: ['const store = createStore(', '  reducer', ');', '', 'const value = 42;'].join('\n'),
      errors: [{ messageId: 'sortOrder' }],
      output: ['const value = 42;', '', 'const store = createStore(', '  reducer', ');'].join('\n')
    },
    // const member call expression (group 4) before regular const (group 3) — const must come first
    {
      code: ['const store = obj.create(', '  option', ');', '', 'const value = 42;'].join('\n'),
      errors: [{ messageId: 'sortOrder' }],
      output: ['const value = 42;', '', 'const store = obj.create(', '  option', ');'].join('\n')
    },
    // plain Identifier const (order 2) before ArrayPattern const (order 0) — ArrayPattern sorts first, no blank line between one-liner same-group consts
    {
      code: 'const z = 1;\n\nconst [a] = arr;',
      errors: [{ messageId: 'sortOrder' }],
      output: 'const [a] = arr;\nconst z = 1;'
    },
    // plain Identifier const (order 2) before ObjectPattern const (order 1) — ObjectPattern sorts first, no blank line between one-liner same-group consts
    {
      code: 'const z = 1;\n\nconst { x } = obj;',
      errors: [{ messageId: 'sortOrder' }],
      output: 'const { x } = obj;\nconst z = 1;'
    },
    // leading comment moves with its declaration — comment above zoo moves when zoo is reordered
    {
      code: ['// comment for zoo', 'function zoo() {}', '', 'function alpha() {}'].join('\n'),
      errors: [{ messageId: 'sortOrder' }],
      output: ['function alpha() {}', '// comment for zoo', 'function zoo() {}'].join('\n')
    },
    // trailing inline comment moves with its declaration — inline comment after zoo moves during reorder
    {
      code: ['function zoo() {} // zoo comment', '', 'function alpha() {}'].join('\n'),
      errors: [{ messageId: 'sortOrder' }],
      output: ['function alpha() {}', 'function zoo() {} // zoo comment'].join('\n')
    },
    // graphql file — mutation (group 6) before query (group 5), query must come first
    {
      code: ['const MUTATION = gql`mutation { foo }`;', '', 'const QUERY = gql`query { bar }`;'].join('\n'),
      errors: [{ messageId: 'sortOrder' }],
      output: ['const QUERY = gql`query { bar }`;', '', 'const MUTATION = gql`mutation { foo }`;'].join('\n')
    },
    // graphql file — PropTypes (group 9) before query gql (group 5) — query must come first
    {
      code: ['const propTypes = { foo: PropTypes.string };', '', 'const QUERY = gql`query { bar }`;'].join('\n'),
      errors: [{ messageId: 'sortOrder' }],
      output: ['const QUERY = gql`query { bar }`;', '', 'const propTypes = { foo: PropTypes.string };'].join('\n')
    },
    // graphql file — non-GQL plain const (group 2) after gql fragment (group 4) — const must come first
    {
      code: ['const FRAGMENT = gql`fragment F on T { id }`;', '', 'const value = 1;'].join('\n'),
      errors: [{ messageId: 'sortOrder' }],
      output: ['const value = 1;', '', 'const FRAGMENT = gql`fragment F on T { id }`;'].join('\n')
    },
    // graphql file — non-GQL const call (group 3) after gql fragment (group 4) — const call must come first
    {
      code: ['const FRAGMENT = gql`fragment F on T { id }`;', '', 'const Context = Object.freeze({ A: "a" });'].join(
        '\n'
      ),
      errors: [{ messageId: 'sortOrder' }],
      output: ['const Context = Object.freeze({ A: "a" });', '', 'const FRAGMENT = gql`fragment F on T { id }`;'].join(
        '\n'
      )
    },
    // only the out-of-order region is flagged — second region (after require) is already sorted
    {
      code: 'const zoo = 1;\nconst alpha = 2;\nconst x = require("x");\nconst c = 3;\nconst d = 4;',
      errors: [{ messageId: 'sortOrder' }],
      output: 'const alpha = 2;\nconst zoo = 1;\nconst x = require("x");\nconst c = 3;\nconst d = 4;'
    },
    // console.log breaks the sortable region — vars on each side sort within their segment but never across
    {
      code: 'const z = 1;\nconst m = 2;\nconsole.log(m);\nconst b = 3;\nconst a = 4;',
      errors: [{ messageId: 'sortOrder' }, { messageId: 'sortOrder' }],
      output: 'const m = 2;\nconst z = 1;\nconsole.log(m);\nconst a = 4;\nconst b = 3;'
    },
    // uppercase sorts before lowercase — Z (90) < a (97) in code-point order, so Zoo sorts before alpha
    {
      code: 'function Zoo() {}\n\nfunction alpha() {}',
      errors: [{ messageId: 'extraBlankLine' }],
      output: 'function Zoo() {}\nfunction alpha() {}'
    },
    // let one-liners with no blank lines between them, followed by blank-line-separated consts — fix must not insert blank lines between the let declarations
    {
      code: ['let z = 1;', 'let a = 2;', '', 'const b = 3;'].join('\n'),
      errors: [{ messageId: 'sortOrder' }],
      output: ['let a = 2;', 'let z = 1;', '', 'const b = 3;'].join('\n')
    },
    // SCREAMING_SNAKE one-liners with dependency — sorted with blank line between dependent pair
    {
      code: [
        'const INDICATOR_HEIGHT = 48;',
        'const SCALE_MULTIPLIER = 2;',
        '',
        'const INDICATOR_CENTER = INDICATOR_HEIGHT / 2;'
      ].join('\n'),
      errors: [{ messageId: 'sortOrder' }],
      output: [
        'const INDICATOR_HEIGHT = 48;',
        '',
        'const INDICATOR_CENTER = INDICATOR_HEIGHT / 2;',
        'const SCALE_MULTIPLIER = 2;'
      ].join('\n')
    },
    // function (group 5) before independent const (group 3) — const must come first even when another const depends on this function
    {
      code: [
        'const getResources = resources => resources;',
        '',
        'const languageCodes = { EN: "en" };',
        '',
        'const defaultOptions = { r: getResources({}) };'
      ].join('\n'),
      errors: [{ messageId: 'sortOrder' }],
      output: [
        'const languageCodes = { EN: "en" };',
        '',
        'const getResources = resources => resources;',
        '',
        'const defaultOptions = { r: getResources({}) };'
      ].join('\n')
    },
    // extra blank line between two same-group one-liner consts — should be removed
    {
      code: 'const a = 1;\n\nconst b = 2;',
      errors: [{ messageId: 'extraBlankLine' }],
      output: 'const a = 1;\nconst b = 2;'
    },
    // extra blank line between two SCREAMING_SNAKE one-liner consts — should be removed
    {
      code: 'const A = 1;\n\nconst B = 2;',
      errors: [{ messageId: 'extraBlankLine' }],
      output: 'const A = 1;\nconst B = 2;'
    },
    // extra blank line between two one-liner functions — should be removed
    {
      code: 'function alpha() {}\n\nfunction zoo() {}',
      errors: [{ messageId: 'extraBlankLine' }],
      output: 'function alpha() {}\nfunction zoo() {}'
    },
    // missing blank line between dependent one-liner consts — dependency takes priority over the one-liner check
    {
      code: 'const A = 1;\nconst B = A + 1;',
      errors: [{ messageId: 'missingBlankLine' }],
      output: 'const A = 1;\n\nconst B = A + 1;'
    },
    // multiple extra blank lines between one-liner consts — all collapsed to a single newline
    {
      code: 'const a = 1;\n\n\nconst b = 2;',
      errors: [{ messageId: 'extraBlankLine' }],
      output: 'const a = 1;\nconst b = 2;'
    },
    // missing blank line before one-liner with non-adjacent in-group dependency — blank required to keep sort-variable-declarations in agreement
    {
      code: 'const a = 1;\nconst b = 2;\nconst c = a + 1;',
      errors: [{ messageId: 'missingBlankLine' }],
      output: 'const a = 1;\nconst b = 2;\n\nconst c = a + 1;'
    },
    // missing blank line before one-liner depending on two non-adjacent group members — still requires the blank
    {
      code: 'const a = 1;\nconst b = 2;\nconst c = 3;\nconst d = a + b;',
      errors: [{ messageId: 'missingBlankLine' }],
      output: 'const a = 1;\nconst b = 2;\nconst c = 3;\n\nconst d = a + b;'
    },
    // sandwiched one-liner function cluster missing blank line — blank required between cluster items
    {
      code: [
        'function aa() {',
        '  return 1;',
        '}',
        '',
        'function ab() {}',
        'function ac() {}',
        '',
        'function ba() {',
        '  return 2;',
        '}'
      ].join('\n'),
      errors: [{ messageId: 'missingBlankLine' }],
      output: [
        'function aa() {',
        '  return 1;',
        '}',
        '',
        'function ab() {}',
        '',
        'function ac() {}',
        '',
        'function ba() {',
        '  return 2;',
        '}'
      ].join('\n')
    }
  ],
  valid: [
    // single const declaration — nothing to sort
    { code: 'const foo = 1;' },
    // single function declaration — nothing to sort
    { code: 'function foo() {}' },
    // two SCREAMING_SNAKE consts in correct alphabetical order — same group, no blank line needed
    { code: 'const A = 1;\nconst B = 2;' },
    // SCREAMING_SNAKE group then regular const group with blank line separator
    { code: 'const A = 1;\nconst B = 2;\n\nconst a = 3;\nconst b = 4;' },
    // full group ordering — SCREAMING_SNAKE, regular const, functions — all correctly sorted
    {
      code: [
        'const A = 1;',
        'const B = 2;',
        '',
        'const a = 3;',
        'const b = 4;',
        '',
        'function foo() {}',
        'function zoo() {}'
      ].join('\n')
    },
    // two multi-line functions in correct alphabetical order
    {
      code: ['function alpha() {', '  return 1;', '}', '', 'function zoo() {', '  return 2;', '}'].join('\n')
    },
    // function zoo uses alpha — dependency forces alpha before zoo despite reverse alphabetical
    {
      code: ['function zoo() {', '  return 1;', '}', '', 'function alpha() {', '  return zoo();', '}'].join('\n')
    },
    // require calls are not sorted — alphabetical order is irrelevant for requires
    { code: 'const a = require("a");\nconst z = require("z");' },
    // require calls are not sorted — reverse order also valid
    { code: 'const z = require("z");\nconst a = require("a");' },
    // two single-line consts in alphabetical order — no blank line needed between same-group one-liners
    { code: 'const a = 1;\nconst b = 2;' },
    // uppercase before lowercase is already correct — no error
    { code: 'const Garden = 2;\nconst ball = 1;' },
    // two single-line function declarations in alphabetical order — no blank line needed between one-liner functions
    { code: 'function alpha() {}\nfunction zoo() {}' },
    // two one-liner arrow functions in alphabetical order — no blank line needed
    { code: 'const setHidden = () => f();\nconst setVisible = () => f();' },
    // two multi-line functions in alphabetical order with blank line
    {
      code: ['function a() {', '  return 1;', '}', '', 'function b() {', '  return 2;', '}'].join('\n')
    },
    // require breaks sortable region — each region sorted independently, aaa < zoo in second region
    {
      code: 'const foo = 1;\nrequire("side-effect");\nconst aaa = 2;\nconst zoo = 3;'
    },
    // console.log breaks sortable region — declarations on each side stay in their own segment, console.log never moves
    { code: 'const a = 1;\nconsole.log(a);\nconst b = 2;' },
    // console.error and other console methods also break sortable regions
    { code: 'const a = 1;\nconsole.error("oops");\nconst b = 2;\nconst c = 3;' },
    // SCREAMING_SNAKE (group 1) before functions (group 5) with blank line; no blank between one-liner functions
    {
      code: ['const A = 1;', '', 'function foo() {}', 'function zoo() {}'].join('\n')
    },
    // let (group 2) before regular const (group 3) — correct group ordering
    { code: 'let b = 2;\n\nconst a = 1;' },
    // var (group 2) before regular const (group 3) — correct group ordering
    { code: 'var b = 2;\n\nconst a = 1;' },
    // SCREAMING_SNAKE (1), let (2), regular const (3) all in correct order
    { code: 'const A = 1;\n\nlet b = 2;\n\nconst c = 3;' },
    // function (group 5) before PropTypes object (group 6) — correct group ordering
    { code: 'function render() {}\n\nconst propTypes = { foo: PropTypes.string };' },
    // arrow function (group 5) after regular const (group 3)
    { code: 'const a = 1;\n\nconst foo = () => {};' },
    // function expression (group 5) after regular const (group 3)
    {
      code: ['const value = 42;', '', 'const handler = function() {', '  return 1;', '};'].join('\n')
    },
    // const new expression (group 4), comes after regular const (group 3)
    {
      code: ['const value = 42;', '', 'const store = new Store(', '  option', ');'].join('\n')
    },
    // const call expression (group 4), comes after regular const (group 3)
    {
      code: ['const value = 42;', '', 'const store = createStore(', '  reducer', ');'].join('\n')
    },
    // const member call expression (group 4), comes after regular const (group 3)
    {
      code: ['const value = 42;', '', 'const store = obj.create(', '  option', ');'].join('\n')
    },
    // ArrayPattern (sort order 0) before plain Identifier (sort order 2) within same group — no blank line between one-liners
    { code: 'const [a] = arr;\nconst z = 1;' },
    // ObjectPattern (sort order 1) before plain Identifier (sort order 2) within same group — no blank line between one-liners
    { code: 'const { x } = obj;\nconst z = 1;' },
    // ArrayPattern (0) before ObjectPattern (1) before plain Identifier (2) within same group — no blank lines between one-liners
    { code: 'const [a] = arr;\nconst { x } = obj;\nconst z = 1;' },
    // ArrayPattern getName uses first element — [a] sorts as 'a', [b] sorts as 'b'
    { code: 'const [a] = arr;\nconst [b] = other;' },
    // ObjectPattern getName uses first property key — { a } sorts as 'a', { z } sorts as 'z'
    { code: 'const { a } = obj1;\nconst { z } = obj2;' },
    // callDeps — foo (arrow fn, group 5) before result (const call, group 4) due to direct call dependency
    { code: 'const foo = () => {};\n\nconst result = foo();' },
    // plain const (group 3) before const call (group 4) — correct group ordering
    { code: 'const value = 42;\n\nconst result = foo();' },
    // binary expression wrapping a call is still const call — month = getMonth() + 1 must not sort before date/year
    {
      code: [
        'const today = new Date();',
        '',
        'const date = today.getDate();',
        'const month = today.getMonth() + 1;',
        'const year = today.getFullYear();'
      ].join('\n')
    },
    // two same-group const call one-liners in alphabetical order — no blank line needed
    { code: 'const margin = createMixin(def);\nconst padding = createMixin(def);' },
    // const new expression (group 4) after plain const (group 3) — correct ordering
    { code: 'const value = 42;\n\nconst store = new Store(option);' },
    // independent const (group 3) before function (group 5) before dependent const (group 3) — group rules apply to dependencies
    {
      code: [
        'const languageCodes = { EN: "en" };',
        '',
        'const getResources = resources => resources;',
        '',
        'const defaultOptions = { r: getResources({}) };'
      ].join('\n')
    },
    // multi-line functions with dependency and blank line — missingBlankLine satisfied, extraBlankLine does not fire
    {
      code: ['function a() {', '  return 1;', '}', '', 'function b() {', '  return a();', '}'].join('\n')
    },
    // one-liner dependent consts with blank line — dependency takes priority, blank line is required and extraBlankLine does not fire
    { code: 'const A = 1;\n\nconst B = A + 1;' },
    // two sortable regions separated by require — each region is sorted independently
    {
      code: 'const a = 1;\nconst b = 2;\nconst x = require("x");\nconst c = 3;\nconst d = 4;'
    },
    // require calls excluded from sorting regardless of order
    { code: 'const z = require("z");\nconst a = require("a");\nconst m = require("m");' },
    // graphql file — fragment (group 4) before query (group 5) — correct gql group ordering
    {
      code: ['const FRAGMENT = gql`fragment F on T { id }`;', '', 'const QUERY = gql`query { bar }`;'].join('\n')
    },
    // graphql file — query (group 5) before mutation (group 6) — correct gql group ordering
    {
      code: ['const QUERY = gql`query { bar }`;', '', 'const MUTATION = gql`mutation { foo }`;'].join('\n')
    },
    // graphql file — full order: non-gql const, fragment, query, mutation, function, PropTypes
    {
      code: [
        'const value = 1;',
        '',
        'const FRAGMENT = gql`fragment F on T { id }`;',
        '',
        'const QUERY = gql`query { bar }`;',
        '',
        'const MUTATION = gql`mutation { foo }`;',
        '',
        'function render() {}',
        '',
        'const propTypes = { foo: PropTypes.string };'
      ].join('\n')
    },
    // sandwiched one-liner function cluster with blank lines — blank lines present, no error
    {
      code: [
        'function aa() {',
        '  return 1;',
        '}',
        '',
        'function ab() {}',
        '',
        'function ac() {}',
        '',
        'function ba() {',
        '  return 2;',
        '}'
      ].join('\n')
    },
    // one-liner clusters on each side of a multi-liner — one-liners joined within each cluster
    {
      code: [
        'function aa() {}',
        'function ab() {}',
        '',
        'function ba() {',
        '  return 1;',
        '}',
        '',
        'function bb() {}',
        'function bc() {}'
      ].join('\n')
    },
    // single cluster at start, multi-liners at end — one-liners joined
    {
      code: [
        'function aa() {}',
        'function ab() {}',
        '',
        'function ba() {',
        '  return 1;',
        '}',
        '',
        'function bb() {',
        '  return 2;',
        '}'
      ].join('\n')
    },
    // single cluster at end — one-liners joined
    {
      code: [
        'function aa() {',
        '  return 1;',
        '}',
        '',
        'function ab() {',
        '  return 2;',
        '}',
        '',
        'function ba() {}',
        'function bb() {}'
      ].join('\n')
    },
    // all one-liners with dep-separated clusters — dep blank lines required, non-dep one-liners joined
    {
      code: ['const a = 1;', 'const b = 2;', '', 'const c = a + b;', 'const d = 4;', 'const e = 5;'].join('\n')
    },
    // blank line before one-liner with non-adjacent in-group dependency — required so sort-variable-declarations stays in agreement
    {
      code: ['const a = 1;', 'const b = 2;', '', 'const c = a + 1;'].join('\n')
    },
    // non-adjacent dep followed by independent one-liners — subsequent independent nodes cluster without extra blanks
    {
      code: ['const a = 1;', 'const b = 2;', '', 'const c = a + 1;', 'const d = 4;'].join('\n')
    },
    // same-source deps on a separated node — dependents of `today` cluster together without extra blanks between them
    {
      code: [
        'const today = new Date();',
        '',
        'const date = today.getDate();',
        'const month = today.getMonth() + 1;',
        'const year = today.getFullYear();'
      ].join('\n')
    },
    // vite.config.js regression — non-adjacent in-group dep must not oscillate with sort-variable-declarations
    {
      code: [
        "const developmentServerHost = 'uphold.test';",
        'const developmentServerPort = 3000;',
        "const environment = process.env.NODE_ENV || 'development';",
        "const extensions = ['.web.jsx', '.jsx', '.web.js', '.js'];",
        '',
        "const isDevelopment = !['production', 'sandbox'].includes(environment);",
        "const isLocalDevelopment = process.env.LOCAL_DEVELOPMENT === 'true';"
      ].join('\n')
    }
  ]
});

esmTester.run('sort-module-declarations (ESM)', rule, {
  invalid: [
    // exported single-line functions in wrong alphabetical order
    {
      code: 'export function zoo() {}\n\nexport function alpha() {}',
      errors: [{ messageId: 'sortOrder' }],
      output: 'export function alpha() {}\nexport function zoo() {}'
    },
    // exported multi-line functions in wrong order
    {
      code: ['export function zoo() {', '  return 1;', '}', '', 'export function alpha() {', '  return 2;', '}'].join(
        '\n'
      ),
      errors: [{ messageId: 'sortOrder' }],
      output: ['export function alpha() {', '  return 2;', '}', '', 'export function zoo() {', '  return 1;', '}'].join(
        '\n'
      )
    },
    // exported same-group one-liner consts in wrong alphabetical order
    {
      code: 'export const zoo = 1;\nexport const alpha = 2;',
      errors: [{ messageId: 'sortOrder' }],
      output: 'export const alpha = 2;\nexport const zoo = 1;'
    },
    // ESM — missing blank line between SCREAMING_SNAKE const (group 1) and function (group 5)
    {
      code: 'export const A = 1;\nexport function foo() {}',
      errors: [{ messageId: 'missingBlankLine' }],
      output: 'export const A = 1;\n\nexport function foo() {}'
    },
    // ESM — regular const (group 3) before SCREAMING_SNAKE (group 1) — group ordering violated
    {
      code: 'export const b = 2;\n\nexport const A = 1;',
      errors: [{ messageId: 'sortOrder' }],
      output: 'export const A = 1;\n\nexport const b = 2;'
    },
    // ESM — dependency ordering — b uses a but b appears first, a must come first
    {
      code: ['export function b() {', '  return a();', '}', '', 'export function a() {', '  return 1;', '}'].join('\n'),
      errors: [{ messageId: 'sortOrder' }],
      output: ['export function a() {', '  return 1;', '}', '', 'export function b() {', '  return a();', '}'].join(
        '\n'
      )
    },
    // ESM — extra blank line between exported one-liner functions — should be removed
    {
      code: 'export function alpha() {}\n\nexport function zoo() {}',
      errors: [{ messageId: 'extraBlankLine' }],
      output: 'export function alpha() {}\nexport function zoo() {}'
    },
    // ESM — extra blank line between exported one-liner consts — should be removed
    {
      code: 'export const alpha = 1;\n\nexport const zoo = 2;',
      errors: [{ messageId: 'extraBlankLine' }],
      output: 'export const alpha = 1;\nexport const zoo = 2;'
    },
    // ESM — non-exported followed by exported same-group one-liner with no blank — blank required
    {
      code: 'const A = 1;\nexport const B = 2;',
      errors: [{ messageId: 'missingBlankLine' }],
      output: 'const A = 1;\n\nexport const B = 2;'
    },
    // ESM — exported followed by non-exported same-group one-liner with no blank — blank required
    {
      code: 'export const A = 1;\nconst B = 2;',
      errors: [{ messageId: 'missingBlankLine' }],
      output: 'export const A = 1;\n\nconst B = 2;'
    },
    // ESM — extra blank line between exported one-liner functions with shared non-adjacent dep — should be removed
    {
      code: 'export const formatDate = date => date;\n\nexport const formatDateTime = date => date;',
      errors: [{ messageId: 'extraBlankLine' }],
      output: 'export const formatDate = date => date;\nexport const formatDateTime = date => date;'
    }
  ],
  valid: [
    // exported functions in correct alphabetical order — no blank line between one-liners
    { code: 'export function alpha() {}\nexport function zoo() {}' },
    // exported consts in alphabetical order — same group, no blank line needed
    { code: 'export const alpha = 1;\nexport const zoo = 2;' },
    // multi-line exported functions in correct alphabetical order
    {
      code: ['export function alpha() {', '  return 1;', '}', '', 'export function zoo() {', '  return 2;', '}'].join(
        '\n'
      )
    },
    // ESM — SCREAMING_SNAKE (group 1) before regular const (group 3) — correct group ordering
    { code: 'export const A = 1;\n\nexport const b = 2;' },
    // ESM — SCREAMING_SNAKE (group 1) before function (group 5) with blank line
    { code: 'export const A = 1;\n\nexport function foo() {}' },
    // ESM — dependency ordering — a before b because b uses a
    {
      code: ['export function a() {', '  return 1;', '}', '', 'export function b() {', '  return a();', '}'].join('\n')
    },
    // ESM — non-exported followed by exported same-group one-liner with blank line — blank is required due to mixed export status
    { code: 'const A = 1;\n\nexport const B = 2;' },
    // ESM — exported followed by non-exported same-group one-liner with blank line — blank is required due to mixed export status
    { code: 'export const A = 1;\n\nconst B = 2;' }
  ]
});

const tsRuleTester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaVersion: 2020 }
});

tsRuleTester.run('sort-module-declarations (typescript)', rule, {
  invalid: [
    // regression: `typeof y` in a module-scope variable id type annotation is a real dependency
    {
      code: 'const x: typeof y = null;\nconst y = 1;',
      errors: [{ messageId: 'sortOrder' }],
      output: 'const y = 1;\n\nconst x: typeof y = null;'
    }
  ],
  valid: [
    // `typeof y` in id type annotation — x correctly ordered after y
    { code: 'const y = 1;\n\nconst x: typeof y = null;' }
  ]
});
