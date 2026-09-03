'use strict';

const { RuleTester } = require('eslint');
const rule = require('../lib/rules/sort-export-declarations');

const esmTester = new RuleTester({ parserOptions: { ecmaVersion: 2020, sourceType: 'module' } });

esmTester.run('sort-export-declarations', rule, {
  invalid: [
    // two local re-exports out of alphabetical order → fix sorts them
    {
      code: "export * from './zoo';\nexport * from './alpha';",
      errors: [{ messageId: 'sortOrder' }],
      output: "export * from './alpha';\nexport * from './zoo';"
    },
    // three local re-exports with multiple out-of-order → fix sorts all in one pass
    {
      code: "export * from './zoo';\nexport * from './alpha';\nexport * from './mid';",
      errors: [{ messageId: 'sortOrder' }],
      output: "export * from './alpha';\nexport * from './mid';\nexport * from './zoo';"
    },
    // non-local (group 2) appearing AFTER local (group 3) → fix reorders
    {
      code: "export * from './local';\nexport * from 'react';",
      errors: [{ messageId: 'sortOrder' }],
      output: "export * from 'react';\n\nexport * from './local';"
    },
    // local binding (group 1) appearing AFTER non-local (group 2) → fix reorders
    {
      code: "const bar = 1, baz = 2;\nexport * from 'react';\nexport { foo } from 'lodash';\nexport { bar, baz };",
      errors: [{ messageId: 'sortOrder' }],
      output: "const bar = 1, baz = 2;\nexport { bar, baz };\n\nexport { foo } from 'lodash';\nexport * from 'react';"
    },
    // all three groups wrong: local first, then local-binding, then non-local → fix puts them in correct group order
    {
      code: "const bar = 1, baz = 2;\nexport * from './local';\nexport { bar, baz };\nexport * from 'react';",
      errors: [{ messageId: 'sortOrder' }],
      output: "const bar = 1, baz = 2;\nexport { bar, baz };\n\nexport * from 'react';\n\nexport * from './local';"
    },
    // two different groups with no blank line between them → missingBlankLine fix adds \n
    {
      code: "export * from 'react';\nexport * from './local';",
      errors: [{ messageId: 'missingBlankLine' }],
      output: "export * from 'react';\n\nexport * from './local';"
    },
    // two same-group exports with an extra blank line between them → extraBlankLine fix removes it
    {
      code: "export * from './alpha';\n\nexport * from './zoo';",
      errors: [{ messageId: 'extraBlankLine' }],
      output: "export * from './alpha';\nexport * from './zoo';"
    },
    // uppercase sorts before lowercase — Garden (G=71) before ball (b=98)
    {
      code: 'const ball = 1, Garden = 2;\nexport { ball };\nexport { Garden };',
      errors: [{ messageId: 'sortOrder' }],
      output: 'const ball = 1, Garden = 2;\nexport { Garden };\nexport { ball };'
    }
  ],
  valid: [
    // single export — no sorting required
    { code: "export * from './foo';" },
    // uppercase before lowercase is already correct — no error
    { code: 'const Garden = 2, ball = 1;\nexport { Garden };\nexport { ball };' },
    // two sorted local export * — no error
    { code: "export * from './alpha';\nexport * from './zoo';" },
    // many sorted local export * — no error
    { code: "export * from './alpha';\nexport * from './beta';\nexport * from './zoo';" },
    // only group 2 (non-local), sorted alphabetically — no error
    { code: "export * from 'lodash';\nexport * from 'react';" },
    // only group 1 (local binding), sorted alphabetically — no error
    {
      code: 'const bar = 1, foo = 2;\nexport { bar };\nexport { foo };'
    },
    // all three groups in correct order with blank lines between them — no error
    {
      code: "const baz = 1;\nexport { baz };\n\nexport * from 'react';\n\nexport * from './local';"
    },
    // ../ path before ./ path (natural alphabetical, .. < . in ASCII) — no error
    { code: "export * from '../bar';\nexport * from './foo';" },
    // non-export nodes between export regions — each region treated independently
    {
      code: "export * from './alpha';\nexport * from './zoo';\nconst x = 1;\nexport * from 'a';\nexport * from 'b';"
    },
    // just two exports in correct order without blank lines (same group) — no error
    { code: "export * from './alpha';\nexport * from './zoo';" }
  ]
});
