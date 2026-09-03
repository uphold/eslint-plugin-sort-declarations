'use strict';

const { RuleTester } = require('eslint');
const rule = require('../lib/rules/sort-variable-declarations');

const ruleTester = new RuleTester({ parserOptions: { ecmaVersion: 2020 } });

ruleTester.run('sort-variable-declarations', rule, {
  invalid: [
    // sort violations
    {
      code: 'const z = 1;\nconst a = 2;',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = 2;\nconst z = 1;'
    },
    // uppercase sorts before lowercase — Garden (G=71) before ball1 (b=98)
    {
      code: 'const ball1 = {};\nconst Garden = {};',
      errors: [{ messageId: 'unsorted' }],
      output: 'const Garden = {};\nconst ball1 = {};'
    },
    {
      code: 'const b = 1;\nconst a = 2;\nconst c = 3;',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = 2;\nconst b = 1;\nconst c = 3;'
    },
    {
      code: 'const foo = 1;\nconst [bar] = [];',
      errors: [{ messageId: 'unsorted' }],
      output: 'const [bar] = [];\nconst foo = 1;'
    },
    {
      code: 'const foo = 1;\nconst { bar } = {};',
      errors: [{ messageId: 'unsorted' }],
      output: 'const { bar } = {};\nconst foo = 1;'
    },
    {
      code: 'const { zoo } = {};\nconst { alpha } = {};',
      errors: [{ messageId: 'unsorted' }],
      output: 'const { alpha } = {};\nconst { zoo } = {};'
    },
    {
      code: 'const [zoo] = [];\nconst [alpha] = [];',
      errors: [{ messageId: 'unsorted' }],
      output: 'const [alpha] = [];\nconst [zoo] = [];'
    },
    {
      code: 'const { zoo } = {};\nconst [alpha] = [];',
      errors: [{ messageId: 'unsorted' }],
      output: 'const [alpha] = [];\nconst { zoo } = {};'
    },
    {
      code: 'function foo() {\n  const z = 1;\n  const a = 2;\n}',
      errors: [{ messageId: 'globalUnsorted' }],
      output: 'function foo() {\n  const a = 2;\n  const z = 1;\n}'
    },
    {
      code: 'const z = 1;\nconst a = 2;\nconst m = 3;',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = 2;\nconst m = 3;\nconst z = 1;'
    },
    {
      code: 'const a = require("a");\nconst z = 1;\nconst b = 2;',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = require("a");\nconst b = 2;\nconst z = 1;'
    },
    // sort violation with leading comment — comment moves with its declaration
    {
      code: '// comment\nconst z = 1;\nconst a = 2;',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = 2;\n// comment\nconst z = 1;'
    },
    // sort violation with comment separated from declaration by a blank line — comment moves with declaration
    {
      code: 'function f() {\n  const z = 1;\n\n  // comment\n\n  const a = 2;\n}',
      errors: [{ messageId: 'globalUnsorted' }],
      output: 'function f() {\n  // comment\n\n  const a = 2;\n  const z = 1;\n}'
    },
    // sort violation where dependency requires blank line — only missingNewline reported
    {
      code: 'const b = 1;\nconst a = b + 1;',
      errors: [{ data: { dependency: 'b' }, messageId: 'missingNewline' }],
      output: 'const b = 1;\n\nconst a = b + 1;'
    },
    // missingNewline violations
    {
      code: 'const a = 1;\nconst b = a + 1;',
      errors: [{ data: { dependency: 'a' }, messageId: 'missingNewline' }],
      output: 'const a = 1;\n\nconst b = a + 1;'
    },
    {
      code: 'const x = foo();\nconst y = x.value;\nconst z = y + 1;',
      errors: [
        { data: { dependency: 'x' }, messageId: 'missingNewline' },
        { data: { dependency: 'y' }, messageId: 'missingNewline' }
      ],
      output: 'const x = foo();\n\nconst y = x.value;\n\nconst z = y + 1;'
    },
    {
      code: 'const a = 1;\nconst b = 2;\nconst c = a + b;',
      errors: [{ data: { dependency: 'a' }, messageId: 'missingNewline' }],
      output: 'const a = 1;\nconst b = 2;\n\nconst c = a + b;'
    },
    {
      code: 'const a = getValue();\n// comment\nconst b = a + 1;',
      errors: [{ data: { dependency: 'a' }, messageId: 'missingNewline' }],
      output: 'const a = getValue();\n\n// comment\nconst b = a + 1;'
    },
    {
      code: 'const a = getValue();\nconst b = getValue();\nconst c = getValue();\nconst d = a + 1;',
      errors: [{ data: { dependency: 'a' }, messageId: 'missingNewline' }],
      output: 'const a = getValue();\nconst b = getValue();\nconst c = getValue();\n\nconst d = a + 1;'
    },
    // unnecessaryNewline violations
    {
      code: 'const a = getValue();\n\nconst b = getValue();',
      errors: [{ messageId: 'unnecessaryNewline' }],
      output: 'const a = getValue();\nconst b = getValue();'
    },
    {
      code: 'const { x } = getX();\n\nconst { y } = getX();',
      errors: [{ messageId: 'unnecessaryNewline' }],
      output: 'const { x } = getX();\nconst { y } = getX();'
    },
    // unnecessaryNewline — siblings sharing deps and both being MemberExpression (same module-level group)
    {
      code: 'const a = obj.x;\n\nconst b = obj.y;',
      errors: [{ messageId: 'unnecessaryNewline' }],
      output: 'const a = obj.x;\nconst b = obj.y;'
    },
    // globalUnsorted violations
    {
      code: 'function f() {\n  const z = 1;\n  foo();\n  const a = 2;\n}',
      errors: [{ messageId: 'globalUnsorted' }],
      output: 'function f() {\n  const a = 2;\n  const z = 1;\n\n  foo();\n}'
    },
    {
      code: 'function f() {\n  const a = 1;\n  foo();\n  const b = 2;\n}',
      errors: [{ messageId: 'globalUnsorted' }],
      output: 'function f() {\n  const a = 1;\n  const b = 2;\n\n  foo();\n}'
    },
    {
      code: 'function f() {\n  const a = 1;\n  useEffect(() => {}, [a]);\n  const b = a + 1;\n}',
      errors: [{ messageId: 'globalUnsorted' }],
      output: 'function f() {\n  const a = 1;\n\n  const b = a + 1;\n\n  useEffect(() => {}, [a]);\n}'
    },
    {
      code: 'function f() {\n  const a = useMemo(() => 1, []);\n  foo();\n  const b = useCallback(() => {}, []);\n}',
      errors: [{ messageId: 'globalUnsorted' }],
      output:
        'function f() {\n  const a = useMemo(() => 1, []);\n\n  const b = useCallback(() => {}, []);\n\n  foo();\n}'
    },
    {
      code: 'function f() {\n  const c = useCallback(() => {}, []);\n  const m = useMemo(() => 1, []);\n  useEffect(() => {}, []);\n  const x = 1;\n}',
      errors: [{ messageId: 'globalUnsorted' }],
      output:
        'function f() {\n  const x = 1;\n\n  const m = useMemo(() => 1, []);\n\n  const c = useCallback(() => {}, []);\n\n  useEffect(() => {}, []);\n}'
    },
    {
      code: 'function f() {\n  const form = useForm();\n  useEffect(() => {}, []);\n  const x = 1;\n}',
      errors: [{ messageId: 'globalUnsorted' }],
      output: 'function f() {\n  const form = useForm();\n  const x = 1;\n\n  useEffect(() => {}, []);\n}'
    },
    {
      code: 'function f() {\n  const m = useMemo(() => v, [v]);\n  useEffect(() => {}, []);\n  const v = useCustomHook();\n}',
      errors: [{ messageId: 'globalUnsorted' }],
      output:
        'function f() {\n  const v = useCustomHook();\n\n  const m = useMemo(() => v, [v]);\n\n  useEffect(() => {}, []);\n}'
    },
    // globalUnsorted — independent identifier must not be displaced by a same-group ObjectPattern whose dep just became available
    {
      code: 'function f() {\n  const { a } = useA();\n  const { b } = useB(a);\n  const x = useX();\n  foo();\n}',
      errors: [{ messageId: 'globalUnsorted' }],
      output: 'function f() {\n  const { a } = useA();\n  const x = useX();\n\n  const { b } = useB(a);\n\n  foo();\n}'
    },
    // formatting fixes only — non-hook call watch(['amount']) blocks global reorder, but formatting violations still fire
    {
      code: "function f() {\n  const {\n    control,\n    watch\n  } = useFormContext();\n  const { t } = useTranslation();\n\n  const [amount] = watch(['amount']);\n\n  const msg = t('x');\n\n  foo();\n}",
      errors: [{ messageId: 'multilineNewline' }, { messageId: 'unnecessaryNewline' }],
      output:
        "function f() {\n  const {\n    control,\n    watch\n  } = useFormContext();\n\n  const { t } = useTranslation();\n\n  const [amount] = watch(['amount']);\n  const msg = t('x');\n\n  foo();\n}"
    },
    // globalUnsorted — wrong group order across blank line (useCallback before useMemo)
    {
      code: 'function f() {\n  const cb = useCallback(() => {}, []);\n\n  const m = useMemo(() => 1, []);\n}',
      errors: [{ messageId: 'globalUnsorted' }],
      output: 'function f() {\n  const m = useMemo(() => 1, []);\n\n  const cb = useCallback(() => {}, []);\n}'
    },
    // globalUnsorted — wrong alphabetical order across blank line (sorts and removes unnecessary blank line)
    {
      code: 'function f() {\n  const z = 1;\n\n  const a = 2;\n}',
      errors: [{ messageId: 'globalUnsorted' }],
      output: 'function f() {\n  const a = 2;\n  const z = 1;\n}'
    },
    // globalUnsorted — topo sort produces alpha order for one-liners (defaultValue before onClick/onSubmit, no blank line needed)
    {
      code: 'function f() {\n  const { b, c } = useBC();\n  const { d, e } = useDE(\n    b\n  );\n  const onClick = () => c;\n  const onSubmit = () => c;\n  const defaultValue = d + 1;\n  bar();\n}',
      errors: [{ messageId: 'globalUnsorted' }],
      output:
        'function f() {\n  const { b, c } = useBC();\n\n  const { d, e } = useDE(\n    b\n  );\n\n  const defaultValue = d + 1;\n  const onClick = () => c;\n  const onSubmit = () => c;\n\n  bar();\n}'
    },
    // multilineNewline — var declarations
    {
      code: 'function f() {\n  const a = useMemo(\n    () => 1,\n    []\n  );\n  const b = useMemo(\n    () => 2,\n    []\n  );\n}',
      errors: [{ messageId: 'multilineNewline' }],
      output:
        'function f() {\n  const a = useMemo(\n    () => 1,\n    []\n  );\n\n  const b = useMemo(\n    () => 2,\n    []\n  );\n}'
    },
    {
      code: 'function f() {\n  const x = 1;\n  const form = useForm({\n    resolver: r\n  });\n}',
      errors: [{ messageId: 'multilineNewline' }],
      output: 'function f() {\n  const x = 1;\n\n  const form = useForm({\n    resolver: r\n  });\n}'
    },
    // multilineNewline — non-var statements
    {
      code: 'function f() {\n  useEffect(() => {\n    doSomething();\n  }, []);\n  useEffect(() => {\n    doOther();\n  }, []);\n}',
      errors: [{ messageId: 'multilineNewline' }],
      output:
        'function f() {\n  useEffect(() => {\n    doSomething();\n  }, []);\n\n  useEffect(() => {\n    doOther();\n  }, []);\n}'
    },
    // unnecessaryNewline extended for block — same group, one-liner, no dep
    // regression: dep on earlier member of group (not just prevDeclaration) should not trigger unnecessaryNewline
    {
      code: 'function f() {\n  const { getAsset } = useAssets();\n  const { t } = useTranslation();\n  const asset = getAsset(balance);\n}',
      errors: [{ data: { dependency: 'getAsset' }, messageId: 'missingNewline' }],
      output:
        'function f() {\n  const { getAsset } = useAssets();\n  const { t } = useTranslation();\n\n  const asset = getAsset(balance);\n}'
    },
    {
      code: 'function f() {\n  const a = useForm();\n\n  const b = 1;\n}',
      errors: [{ messageId: 'unnecessaryNewline' }],
      output: 'function f() {\n  const a = useForm();\n  const b = 1;\n}'
    },
    {
      code: 'function f() {\n  const a = useMemo(() => 1, []);\n\n  const b = useMemo(() => 2, []);\n}',
      errors: [{ messageId: 'unnecessaryNewline' }],
      output: 'function f() {\n  const a = useMemo(() => 1, []);\n  const b = useMemo(() => 2, []);\n}'
    },
    // unnecessaryNewline — blank line between siblings that both depend on an earlier group var (not on each other)
    {
      code: 'function f() {\n  const a = useA();\n\n  const b = useB(a);\n\n  const c = useC(a);\n}',
      errors: [{ messageId: 'unnecessaryNewline' }],
      output: 'function f() {\n  const a = useA();\n\n  const b = useB(a);\n  const c = useC(a);\n}'
    },
    // unnecessaryNewline for consecutive single-line non-vars with blank
    {
      code: 'function f() {\n  useEffect(() => {}, []);\n\n  useEffect(() => {}, []);\n}',
      errors: [{ messageId: 'unnecessaryNewline' }],
      output: 'function f() {\n  useEffect(() => {}, []);\n  useEffect(() => {}, []);\n}'
    },
    // guardClauseNewline — inline guard clause must be followed by a blank line
    {
      code: 'function f() {\n  if (x) return;\n  doSomething();\n}',
      errors: [{ messageId: 'guardClauseNewline' }],
      output: 'function f() {\n  if (x) return;\n\n  doSomething();\n}'
    },
    {
      code: 'const onScroll = event => {\n  if (ref.current?.contains(event.target)) return;\n  onClickOutside();\n};',
      errors: [{ messageId: 'guardClauseNewline' }],
      output:
        'const onScroll = event => {\n  if (ref.current?.contains(event.target)) return;\n\n  onClickOutside();\n};'
    },
    // console.log is a hard boundary — vars on each side are sorted within their segment but never across
    {
      code: 'function f() {\n  const z = 1;\n  const m = 2;\n  console.log(m);\n  const b = 3;\n  const a = 4;\n}',
      errors: [{ messageId: 'globalUnsorted' }, { messageId: 'globalUnsorted' }],
      output: 'function f() {\n  const m = 2;\n  const z = 1;\n  console.log(m);\n  const a = 4;\n  const b = 3;\n}'
    },
    // console.log preserved when only the trailing var segment is unsorted
    {
      code: 'function f() {\n  const z = 1;\n  console.log(z);\n  const m = 2;\n  const a = 3;\n}',
      errors: [{ messageId: 'globalUnsorted' }],
      output: 'function f() {\n  const z = 1;\n  console.log(z);\n  const a = 3;\n  const m = 2;\n}'
    },
    // any console method (console.error, console.warn, etc.) acts as a boundary
    {
      code: 'function f() {\n  console.error("err");\n  const z = 1;\n  const a = 2;\n}',
      errors: [{ messageId: 'globalUnsorted' }],
      output: 'function f() {\n  console.error("err");\n  const a = 2;\n  const z = 1;\n}'
    },
    // project convention: get* computed key — computed member where key is a convention getter is sortable
    {
      code: 'const z = obj[getKey()];\nconst a = obj[getKey()];',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = obj[getKey()];\nconst z = obj[getKey()];'
    },
    // allowlist: two literal initializers — should sort
    {
      code: 'const z = 1;\nconst a = 2;',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = 2;\nconst z = 1;'
    },
    // category 7 — plain member access is sortable (known limitation: getter side effects are statically undetectable)
    // note: treating all member access as impure would block thousands of legitimate sorts
    {
      code: 'const z = obj.zoo;\nconst a = obj.alpha;',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = obj.alpha;\nconst z = obj.zoo;'
    },
    // pure-init let declarations are sortable (known limitation: downstream reassignment is invisible to the rule)
    // note: reordering pure-init lets does not change observable behavior since the initializers have no side effects
    {
      code: 'let z = 1;\nlet a = 2;',
      errors: [{ messageId: 'unsorted' }],
      output: 'let a = 2;\nlet z = 1;'
    },
    // spreading an identifier is sortable (known limitation: rule cannot detect that sharedIter is a stateful iterator)
    // note: the rule treats Identifier as pure; spreading the same identifier twice is an undetectable side-effect pattern
    {
      code: 'const z = [...sharedIter];\nconst a = [...sharedIter];',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = [...sharedIter];\nconst z = [...sharedIter];'
    },
    // allowlist: two arrow function initializers — should sort
    {
      code: 'const z = () => doStuff();\nconst a = () => doOther();',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = () => doOther();\nconst z = () => doStuff();'
    },
    // allowlist: two member-access initializers — should sort
    {
      code: 'const z = props.foo;\nconst a = props.bar;',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = props.bar;\nconst z = props.foo;'
    },
    // allowlist: hook calls — should sort
    {
      code: 'const z = useFoo();\nconst a = useBar();',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = useBar();\nconst z = useFoo();'
    },
    // allowlist: namespaced hook calls (React.useMemo, React.useCallback) — should sort
    {
      code: 'const z = React.useMemo(() => 1, []);\nconst a = React.useMemo(() => 2, []);',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = React.useMemo(() => 2, []);\nconst z = React.useMemo(() => 1, []);'
    },
    // allowlist: JSX initializers — should sort
    {
      code: 'const z = <Foo />;\nconst a = <Bar />;',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = <Bar />;\nconst z = <Foo />;',
      parserOptions: { ecmaFeatures: { jsx: true }, ecmaVersion: 2020 }
    },
    // allowlist: useMemo with non-hook calls inside the deferred body — should sort
    {
      code: 'const z = useMemo(() => doStuff(), []);\nconst a = useMemo(() => doOther(), []);',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = useMemo(() => doOther(), []);\nconst z = useMemo(() => doStuff(), []);'
    },
    // allowlist (built-ins): global fn casts
    {
      code: 'const z = Number(x);\nconst a = Number(y);',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = Number(y);\nconst z = Number(x);'
    },
    // allowlist (built-ins): global parseInt
    {
      code: "const z = parseInt('5', 10);\nconst a = parseInt('3', 10);",
      errors: [{ messageId: 'unsorted' }],
      output: "const a = parseInt('3', 10);\nconst z = parseInt('5', 10);"
    },
    // allowlist (built-ins): global isNaN
    {
      code: 'const z = isNaN(x);\nconst a = isNaN(y);',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = isNaN(y);\nconst z = isNaN(x);'
    },
    // allowlist (built-ins): Object.freeze
    {
      code: 'const z = Object.freeze({});\nconst a = Object.freeze({});',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = Object.freeze({});\nconst z = Object.freeze({});'
    },
    // allowlist (built-ins): Object.keys
    {
      code: 'const z = Object.keys(x);\nconst a = Object.keys(y);',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = Object.keys(y);\nconst z = Object.keys(x);'
    },
    // allowlist (built-ins): JSON.stringify
    {
      code: 'const z = JSON.stringify(x);\nconst a = JSON.stringify(y);',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = JSON.stringify(y);\nconst z = JSON.stringify(x);'
    },
    // allowlist (built-ins): Math.max / Math.min (deterministic)
    {
      code: 'const z = Math.max(1, 2);\nconst a = Math.min(3, 4);',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = Math.min(3, 4);\nconst z = Math.max(1, 2);'
    },
    // allowlist (built-ins): Array.from
    {
      code: 'const z = Array.from(x);\nconst a = Array.from(y);',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = Array.from(y);\nconst z = Array.from(x);'
    },
    // allowlist (built-ins): PropTypes.oneOf
    {
      code: "const z = PropTypes.oneOf(['z']);\nconst a = PropTypes.oneOf(['a']);",
      errors: [{ messageId: 'unsorted' }],
      output: "const a = PropTypes.oneOf(['a']);\nconst z = PropTypes.oneOf(['z']);"
    },
    // allowlist (built-ins): String prototype .toLowerCase()
    {
      code: 'const z = name.toLowerCase();\nconst a = type.toLowerCase();',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = type.toLowerCase();\nconst z = name.toLowerCase();'
    },
    // allowlist (built-ins): String prototype .split()
    {
      code: "const z = path.split('.');\nconst a = name.split('.');",
      errors: [{ messageId: 'unsorted' }],
      output: "const a = name.split('.');\nconst z = path.split('.');"
    },
    // allowlist (built-ins): Array/String .slice()
    {
      code: 'const z = arr.slice(0, 2);\nconst a = list.slice(0, 2);',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = list.slice(0, 2);\nconst z = arr.slice(0, 2);'
    },
    // allowlist (built-ins): .toString() on identifier
    {
      code: 'const z = isOpen.toString();\nconst a = isReady.toString();',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = isReady.toString();\nconst z = isOpen.toString();'
    },
    // allowlist (built-ins): .includes()
    {
      code: "const z = path.includes('foo');\nconst a = name.includes('bar');",
      errors: [{ messageId: 'unsorted' }],
      output: "const a = name.includes('bar');\nconst z = path.includes('foo');"
    },
    // project convention: get* Identifier
    {
      code: 'const z = getRow();\nconst a = getLabel();',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = getLabel();\nconst z = getRow();'
    },
    // project convention: is* Identifier
    {
      code: 'const z = isEmpty(x);\nconst a = isCrypto(x);',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = isCrypto(x);\nconst z = isEmpty(x);'
    },
    // project convention: has* Identifier
    {
      code: 'const z = hasFoo();\nconst a = hasBar();',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = hasBar();\nconst z = hasFoo();'
    },
    // project convention: format* Identifier
    {
      code: 'const z = formatAmount(1);\nconst a = formatTime(2);',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = formatTime(2);\nconst z = formatAmount(1);'
    },
    // project convention: t Identifier (i18n)
    {
      code: "const z = t('a');\nconst a = t('b');",
      errors: [{ messageId: 'unsorted' }],
      output: "const a = t('b');\nconst z = t('a');"
    },
    // project convention: PascalCase namespace + get*
    {
      code: 'const z = DateHelper.getFormattedDate(d);\nconst a = DateHelper.getFormattedTime(d);',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = DateHelper.getFormattedTime(d);\nconst z = DateHelper.getFormattedDate(d);'
    },
    // project convention: PascalCase namespace + t
    {
      code: "const z = I18n.t('z');\nconst a = I18n.t('a');",
      errors: [{ messageId: 'unsorted' }],
      output: "const a = I18n.t('a');\nconst z = I18n.t('z');"
    },
    // project convention: PascalCase namespace + is*
    {
      code: 'const z = AssetHelper.isCrypto(x);\nconst a = AssetHelper.isFiat(x);',
      errors: [{ messageId: 'unsorted' }],
      output: 'const a = AssetHelper.isFiat(x);\nconst z = AssetHelper.isCrypto(x);'
    }
  ],
  valid: [
    { code: 'const a = 1;' },
    // uppercase before lowercase is already correct — no error
    { code: 'const Garden = {};\nconst ball1 = {};' },
    { code: '' },
    { code: 'const a = 1;\nconst b = 2;\nconst c = 3;' },
    { code: 'const [alpha] = [];\nconst { beta } = {};\nconst gamma = 3;' },
    { code: 'const [alpha] = [];\nconst [beta] = [];' },
    { code: 'const { alpha } = {};\nconst { beta } = {};' },
    { code: 'const a = require("a");\nconst b = require("b");' },
    { code: 'const z = require("z");\nconst a = require("a");' },
    { code: 'const z = 1;\n\nconst a = 2;' },
    { code: 'const a = 1;\nconst z = 2;\n\nconst m = 3;\nconst n = 4;' },
    { code: 'const a = 1;\nfoo();\nconst a2 = 2;\nconst z = 3;' },
    { code: 'function foo() {\n  const a = 1;\n  const b = 2;\n}' },
    { code: 'const a = 1;\n\nconst b = a + 1;' },
    { code: 'const a = 1;\nconst b = 2;\n\nconst c = a + b;' },
    { code: 'const a = 1;\nfoo();\nconst b = a + 1;' },
    { code: 'const a = {\n  x: 1\n};\n\nconst b = {\n  y: 2\n};' },
    { code: 'const a = getValue();\nconst b = getValue2();' },
    // regression: sibling decls sharing a used name but differing in module-level group (CONST vs CONST_CALL)
    // must keep the blank line between them — removing it would loop with sort-module-declarations
    {
      code: 'const summaryFile = process.env.GITHUB_STEP_SUMMARY;\n\nconst [command, ...args] = process.argv.slice(2);'
    },
    { code: 'const a = obj.foo;\n\nconst b = obj.bar();' },
    { code: 'const a = new Obj();\n\nconst b = obj.prop;' },
    { code: 'function foo() {\n  const a = 1;\n\n  const b = a + 1;\n}' },
    { code: 'function f() {\n  const a = 1;\n  const b = 2;\n\n  useEffect(() => {}, []);\n}' },
    {
      code: 'function f() {\n  const a = 1;\n  const h = useForm();\n\n  const m = useMemo(() => a, [a]);\n\n  const c = useCallback(() => {}, []);\n\n  useEffect(() => {}, []);\n}'
    },
    { code: 'function f() {\n  const a = 1;\n\n  useEffect(() => {}, []);\n}' },
    {
      code: 'function f() {\n  const a = useMemo(\n    () => 1,\n    []\n  );\n\n  const b = useMemo(\n    () => 2,\n    []\n  );\n}'
    },
    { code: 'function f() {\n  const a = useMemo(() => 1, []);\n  const b = useMemo(() => 2, []);\n}' },
    { code: 'function f() {\n  useEffect(() => {}, []);\n  useEffect(() => {}, []);\n}' },
    {
      code: 'function f() {\n  useEffect(() => {\n    doSomething();\n  }, []);\n\n  useEffect(() => {\n    doOther();\n  }, []);\n}'
    },
    { code: 'function f() {\n  const a = useMemo(() => 1, []);\n\n  const b = useCallback(() => {}, []);\n}' },
    // regression: blank line before a var that uses an earlier (non-immediate) member of the same group must be valid
    {
      code: 'function f() {\n  const { getAsset } = useAssets();\n  const { t } = useTranslation();\n\n  const asset = getAsset(balance);\n}'
    },
    // comment separated by blank line from its declaration — valid when already sorted
    { code: 'function f() {\n  // comment\n\n  const a = 2;\n  const z = 1;\n}' },
    // blank line before return statement is idiomatic and should always be allowed
    { code: 'function f() {\n  doSomething();\n\n  return x;\n}' },
    { code: 'function f() {\n  set(obj, key, val);\n\n  return this;\n}' },
    // inline guard clause with blank line after — valid
    { code: 'function f() {\n  if (x) return;\n\n  doSomething();\n}' },
    {
      code: 'const onScroll = event => {\n  if (ref.current?.contains(event.target)) return;\n\n  onClickOutside();\n};'
    },
    // block-form guard clause (with or without blank line) — ok as is
    { code: 'function f() {\n  if (x) {\n    return;\n  }\n\n  doSomething();\n}' },
    { code: 'function f() {\n  if (x) { return; }\n  doSomething();\n}' },
    // chained inline guard clauses — no blank line needed between them
    { code: 'const step = () => {\n  if (a) return STEPS.A;\n  if (b) return STEPS.B;\n  if (c) return STEPS.C;\n};' },
    // inline guard clause followed by another if — no blank line required
    { code: 'function f() {\n  if (x) return;\n  if (y) doSomething();\n}' },
    // if statement is a hard boundary — vars on either side must not be reordered across it
    { code: 'function f() {\n  const z = 1;\n  if (z) {}\n  const a = 2;\n}' },
    { code: 'function f() {\n  const z = 1;\n  if (!z) { return; }\n  const a = 2;\n  const b = 3;\n}' },
    // regression: inner const declarations inside a callback should not create false cross-declaration dependencies
    {
      code: 'function f() {\n  const { dispatch, useMachineContext } = useMachineInterpreter(machine, {\n    actions: {\n      update: ({ validTargets }) => {\n        const [lockedNode] = validTargets;\n        return lockedNode;\n      }\n    }\n  });\n\n  const [{ validTargets }] = useMachineContext([]);\n\n  const [lockedNode] = validTargets;\n}'
    },
    // regression: mutual body references create a cycle — original order must be preserved (no-use-before-define safe)
    {
      code: 'function f() {\n  const handleErrors = useCallback((err) => { onReset(err); }, []);\n\n  const onReset = useCallback(async (token) => { await handleErrors(token); }, [handleErrors]);\n}'
    },
    // regression: inner const inside try block should not falsely depend on outer var with same name — topo order preserved
    {
      code: 'function f() {\n  const [item, setItem] = useState(null);\n\n  const onFetch = useCallback(async () => {\n    try {\n      const item = await fetchItem();\n      setItem(item);\n    } catch (e) {}\n  }, []);\n}'
    },
    // worklet directive must always remain as the first statement in a function body
    { code: "const f = () => {\n  'worklet';\n\n  const a = 1;\n  const b = 2;\n};" },
    { code: "const f = () => {\n  'worklet';\n\n  const a = 1;\n\n  return a;\n};" },
    // super() is a hard boundary — vars after super() must not be hoisted before it
    {
      code: 'class Foo extends Bar {\n  constructor() {\n    const credentials = getCredentials();\n    super(credentials);\n    const request = this.client.request.bind(this.client);\n    this.client.request = () => {};\n    this.storage = getStorage();\n  }\n}',
      parserOptions: { ecmaVersion: 2020 }
    },
    // super() inside try block is still a hard boundary — vars after the try must not be hoisted before it
    {
      code: 'class Foo extends Bar {\n  constructor(opts) {\n    const x = 1;\n    try {\n      super(opts);\n    } catch (e) {}\n    const y = this.something;\n  }\n}',
      parserOptions: { ecmaVersion: 2020 }
    },
    // vars using `this` must not be hoisted past non-var `this.*` calls they may depend on
    {
      code: 'class Foo extends Bar {\n  constructor() {\n    super();\n    this.setup();\n    const x = this.getValue();\n    this.configure();\n    const y = this.getOther();\n  }\n}',
      parserOptions: { ecmaVersion: 2020 }
    },
    // one-at-a-time topo sort places one-liners in alpha order — defaultValue before onClick/onSubmit
    {
      code: 'function f() {\n  const { b, c } = useBC();\n\n  const { d, e } = useDE(\n    b\n  );\n\n  const defaultValue = d + 1;\n  const onClick = () => c;\n  const onSubmit = () => c;\n\n  bar();\n}'
    },
    // independent identifier (no deps) stays before same-group ObjectPattern whose dep just became available
    {
      code: 'function f() {\n  const { a } = useA();\n  const x = useX();\n\n  const { b } = useB(a);\n\n  foo();\n}'
    },
    // stable: one-liner no-deps decl precedes multi-liner no-deps decl, and transitionToDep blank is preserved (no autofix oscillation)
    {
      code: "function f() {\n  const { t } = useTranslation();\n\n  const {\n    control,\n    watch\n  } = useFormContext();\n\n  const [amount] = watch(['amount']);\n  const msg = t('x');\n\n  foo();\n}"
    },
    // non-hook call initializers after non-var statements must not be reordered (side-effect dependency)
    { code: 'function f() {\n  setup();\n  const result = computeResult();\n}' },
    {
      code: 'function f() {\n  render(component);\n  const el = screen.getByRole("tab");\n  const other = screen.getByRole("button");\n}'
    },
    // console.log between two single vars — each segment has nothing to sort, console.log stays in place
    { code: 'function f() {\n  const z = 1;\n  console.log(z);\n  const a = 2;\n}' },
    // multiple console statements — each acts as a boundary, vars on each side already in order
    {
      code: 'function f() {\n  const a = 1;\n  console.log(a);\n  const b = 2;\n  console.error(b);\n  const c = 3;\n}'
    },
    // console.log at module level — vars on each side already sorted, no cross-segment sort
    { code: 'const a = 1;\nconsole.log(a);\nconst b = 2;' },
    // regression: a non-var statement positioned between two vars where the second var awaits a value
    // produced by the first must not be reordered — moving the await up would skip the synchronous
    // side effect required to resolve the awaited promise (e.g. `callback()` triggering `resolveStep`)
    {
      code:
        'async function emitEvent(callback) {\n' +
        '  const stepPromise = makePromise();\n' +
        '\n' +
        '  callback();\n' +
        '\n' +
        '  const result = await stepPromise;\n' +
        '\n' +
        '  doCleanup();\n' +
        '}'
    },
    // regression: `yield` in a generator var init is also an ordering boundary — non-vars around it
    // must not be reordered
    {
      code:
        'function* gen() {\n' +
        '  const queue = makeQueue();\n' +
        '\n' +
        '  enqueue(queue);\n' +
        '\n' +
        '  const next = yield queue;\n' +
        '\n' +
        '  finalize(next);\n' +
        '}'
    },
    // regression: even when all vars precede non-vars, vars must not be reordered alphabetically when
    // doing so would move a side-effecting initializer across an await — e.g. setTimeout that arms a
    // timer must run before the await it is meant to abort, not after
    {
      code:
        'async function fetchWithTimeout(input, options) {\n' +
        '  const { timeout } = options;\n' +
        '  const controller = new AbortController();\n' +
        '\n' +
        '  const timeoutId = setTimeout(() => controller.abort(), timeout);\n' +
        '  const response = await fetch(input, { signal: controller.signal });\n' +
        '\n' +
        '  clearTimeout(timeoutId);\n' +
        '\n' +
        '  return response;\n' +
        '}'
    },
    // mutation (pop): side-effecting call must not be reordered
    { code: 'const z = stack.pop();\nconst a = stack.pop();' },
    // mutation (push): side-effecting call must not be reordered
    { code: 'const z = arr.push(1);\nconst a = arr.push(2);' },
    // mutation (set add): side-effecting call must not be reordered
    { code: "const z = mySet.add('z');\nconst a = mySet.add('a');" },
    // counter / ID generation: each call returns the next ID in sequence
    { code: 'const zId = nextId();\nconst aId = nextId();' },
    // logging / IO: each call produces an observable side effect
    { code: "const z = logger.info('z');\nconst a = logger.info('a');" },
    // iterator advance: each next() consumes the next element
    { code: 'const z = iter.next().value;\nconst a = iter.next().value;' },
    // computed member access where key is a convention getter (pure): sortable
    // note: getKey() matches the get* convention — reordering is safe
    // clock (Date.now): each call captures a different instant
    { code: 'const zNow = Date.now();\nconst aNow = Date.now();' },
    // clock (performance.now): each call captures a different instant
    { code: 'const zT = performance.now();\nconst aT = performance.now();' },
    // randomness (Math.random): each call returns a different value
    { code: 'const zRand = Math.random();\nconst aRand = Math.random();' },
    // cryptographic randomness: each call returns different bytes
    { code: 'const zBytes = crypto.randomBytes(16);\nconst aBytes = crypto.randomBytes(16);' },
    // UUID generation: each call returns a unique identifier
    { code: 'const zId = uuid();\nconst aId = uuid();' },
    // new Date() constructor: each instantiation captures the current time
    { code: 'const zDate = new Date();\nconst aDate = new Date();' },
    // fetch ordering: promise creation order matters for concurrent effects
    { code: 'const z = fetchFoo();\nconst a = fetchBar();' },
    // side-effecting promise factory: each call starts a job in order
    { code: "const zPromise = startJob('z');\nconst aPromise = startJob('a');" },
    // throw ordering: each call may throw; order affects which error surfaces first
    { code: 'const z = parseStrict(input);\nconst a = audit(input);' },
    // SQL tagged template: tag function may have side effects (query registration, etc.)
    { code: 'const z = sql`SELECT z`;\nconst a = sql`SELECT a`;' },
    // GraphQL tagged template: gql tag may register or deduplicate queries
    { code: 'const z = gql`query Z { z }`;\nconst a = gql`query A { a }`;' },
    // HTML/styled tagged template: tag function may have side effects
    { code: 'const z = html`<div>z</div>`;\nconst a = html`<div>a</div>`;' },
    // impure init + downstream reassignment: reordering would change observable behavior
    { code: 'let z = nextId();\nlet a = nextId();\nz = a;' },
    // spread of call result (stateful iterable) must not be reordered
    { code: 'const z = [...gen()];\nconst a = [...gen()];' },
    // new with side effects (no args): constructor may register or mutate global state
    { code: 'const z = new EventEmitter();\nconst a = new AbortController();' },
    // new with arguments: constructor arguments do not make the expression pure
    { code: 'const z = new MyClass(1, 2);\nconst a = new MyClass(3, 4);' },
    // allowlist (built-ins): Math.random is non-deterministic — must not sort
    { code: 'const z = Math.random();\nconst a = Math.random();' },
    // allowlist (built-ins): Symbol() constructor returns a unique value each call — must not sort
    { code: "const z = Symbol('z');\nconst a = Symbol('a');" },
    // allowlist (built-ins): Date.now is non-deterministic — must not sort
    { code: 'const z = Date.now();\nconst a = Date.now();' },
    // allowlist (built-ins): history.replace has navigation side effects — must not sort
    { code: "const z = history.replace('/z');\nconst a = history.replace('/a');" },
    // allowlist (built-ins): regex.exec mutates lastIndex on global regexes — must not sort
    { code: 'const z = pattern.exec(strA);\nconst a = pattern.exec(strB);' },
    // allowlist (built-ins): .replace on arbitrary identifier (could be history.replace) — must not sort
    { code: "const z = router.replace('/z');\nconst a = router.replace('/a');" },
    // project convention: lowercase namespace + getter — must not sort (namespace not PascalCase)
    { code: "const z = localStorage.getItem('z');\nconst a = localStorage.getItem('a');" },
    // project convention: lowercase namespace + .get — must not sort
    { code: "const z = obj.get('z');\nconst a = obj.get('a');" },
    // project convention: camelCase namespace — must not sort (not PascalCase)
    { code: 'const z = props.getRow();\nconst a = props.getLabel();' },
    // project convention: wrong prefix (do*) — must not sort
    { code: 'const z = doSomething();\nconst a = doOther();' },
    // project convention: mutation verbs — must not sort
    { code: 'const z = createCard(x);\nconst a = createUser(y);' },
    // project convention: mutation verbs as PascalCase members — must not sort
    { code: 'const z = CardService.createCard(x);\nconst a = UserService.deleteUser(y);' },
    // project convention: bare prefix (no suffix) — must not sort
    { code: 'const z = get();\nconst a = is();' },
    // project convention: lowercase next char (getter) — must not sort
    { code: 'const z = getter();\nconst a = setter();' },
    // project convention: lowercase next char (formatter) — must not sort
    { code: 'const z = formatter(x);\nconst a = formatter(y);' },
    // project convention: lowercase next char (gettext) — must not sort
    { code: "const z = gettext('z');\nconst a = gettext('a');" },
    // cross-statement guard: isDateInLastMonth (is* convention) after a side-effecting non-var must not be reordered
    {
      code: 'function f() {\n  const date = "2024-01-01";\n  MockDate.set(now);\n  const result = isDateInLastMonth(date);\n}'
    },
    // cross-statement guard: convention-matching call (is*) must not cross side-effecting non-var statement
    { code: 'function f() {\n  const a = 1;\n  setupMock();\n  const z = isReady(state);\n}' },
    // non-convention call as computed key — order matters (e.g., counter)
    { code: 'const z = obj[nextKey()];\nconst a = obj[nextKey()];' },
    // allowlist (built-ins): PropTypes.checkPropTypes is side-effecting (logs warnings) — must not sort
    { code: 'const z = PropTypes.checkPropTypes(s, p, l, n);\nconst a = PropTypes.checkPropTypes(s2, p2, l2, n2);' },
    // allowlist (built-ins): PropTypes.resetWarningCache mutates internal state — must not sort
    { code: 'const z = PropTypes.resetWarningCache();\nconst a = PropTypes.resetWarningCache();' }
  ]
});

const tsRuleTester = new RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
  parserOptions: { ecmaFeatures: { jsx: true }, ecmaVersion: 2020 }
});

tsRuleTester.run('sort-variable-declarations (typescript)', rule, {
  invalid: [
    // regression: `typeof onSelect` in a parameter type annotation is a real dependency — renderItem must come after onSelect
    {
      code: 'function f() {\n  const { dispatch } = useMachine();\n\n  const renderItem = useCallback(\n    ({ x }: { x: typeof onSelect }) => x,\n    []\n  );\n\n  const onSelect = useCallback(() => dispatch(), [dispatch]);\n}',
      errors: [{ messageId: 'globalUnsorted' }],
      output:
        'function f() {\n  const { dispatch } = useMachine();\n\n  const onSelect = useCallback(() => dispatch(), [dispatch]);\n\n  const renderItem = useCallback(\n    ({ x }: { x: typeof onSelect }) => x,\n    []\n  );\n}'
    },
    // regression: `typeof y` in a declarator id type annotation is a real dependency — x must come after y
    {
      code: 'function f() {\n  const x: typeof y = null;\n  const y = 1;\n\n  foo();\n}',
      errors: [{ messageId: 'globalUnsorted' }],
      output: 'function f() {\n  const y = 1;\n\n  const x: typeof y = null;\n\n  foo();\n}'
    },
    // purely type-only references (not `typeof`) must NOT create value-level deps —
    // uppercase `Transaction` must sort above lowercase `handler`
    {
      code: 'function f() {\n  const handler = (_x: Transaction) => 1;\n  const Transaction = 2;\n}',
      errors: [{ messageId: 'globalUnsorted' }],
      output: 'function f() {\n  const Transaction = 2;\n  const handler = (_x: Transaction) => 1;\n}'
    }
  ],
  valid: [
    // regression: when the later multi-liner uses `typeof onSelect` in its param type,
    // the dep must keep onSelect above it — never pick the no-deps multi-liner first
    'function f() {\n  const { dispatch } = useMachine();\n\n  const onSelect = useCallback(() => dispatch(), [dispatch]);\n\n  const renderItem = useCallback(\n    ({ x }: { x: typeof onSelect }) => x,\n    []\n  );\n}',
    // typeof in a return type annotation is also a dependency
    'function f() {\n  const base = 1;\n\n  const compute = (): typeof base => base;\n}'
  ]
});
