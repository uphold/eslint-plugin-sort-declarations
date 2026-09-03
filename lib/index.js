'use strict';
const { name, version } = require('../package.json');

module.exports = Object.freeze({
  meta: { name, namespace: 'sort-declarations', version },
  rules: {
    'sort-export-declarations': require('./rules/sort-export-declarations'),
    'sort-module-declarations': require('./rules/sort-module-declarations'),
    'sort-variable-declarations': require('./rules/sort-variable-declarations')
  }
});
