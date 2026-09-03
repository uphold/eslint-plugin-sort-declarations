'use strict';

const SKIP_KEYS = new Set(['type', 'loc', 'range', 'start', 'end', 'parent', 'tokens', 'comments']);

function collectPatternNames(pattern, names) {
  if (!pattern) return;

  switch (pattern.type) {
    case 'Identifier':
      names.add(pattern.name);
      break;
    case 'ArrayPattern':
      pattern.elements.forEach(el => el && collectPatternNames(el, names));
      break;
    case 'ObjectPattern':
      pattern.properties.forEach(prop => {
        if (prop.type === 'Property') collectPatternNames(prop.value, names);
        else if (prop.type === 'RestElement') collectPatternNames(prop.argument, names);
      });
      break;
    case 'RestElement':
      collectPatternNames(pattern.argument, names);
      break;
    case 'AssignmentPattern':
      collectPatternNames(pattern.left, names);
      break;
    default:
      break;
  }
}

function collectDeclaredNames(declaration, names) {
  declaration.declarations.forEach(declarator => collectPatternNames(declarator.id, names));
}

function collectTypeQueryRefs(node, used) {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    node.forEach(child => collectTypeQueryRefs(child, used));

    return;
  }

  if (!node.type) return;

  if (node.type === 'TSTypeQuery') {
    let expr = node.exprName;

    while (expr && expr.type === 'TSQualifiedName') expr = expr.left;
    if (expr && expr.type === 'Identifier') used.add(expr.name);

    return;
  }

  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    collectTypeQueryRefs(node[key], used);
  }
}

function collectUsedIdentifiers(node, used = new Set()) {
  function collectParamDefaults(param) {
    if (!param) return;

    if (param.type === 'AssignmentPattern') {
      collectUsedIdentifiers(param.right, used);
      collectParamDefaults(param.left);
    } else if (param.type === 'ObjectPattern') {
      for (const prop of param.properties) {
        if (prop.type === 'Property') collectParamDefaults(prop.value);
        else if (prop.type === 'RestElement') collectParamDefaults(prop.argument);
      }
    } else if (param.type === 'ArrayPattern') {
      for (const el of param.elements) {
        if (el) collectParamDefaults(el);
      }
    }
  }

  if (!node || typeof node !== 'object') return used;

  if (Array.isArray(node)) {
    node.forEach(child => collectUsedIdentifiers(child, used));

    return used;
  }

  if (!node.type) return used;

  if (node.type === 'Identifier' || node.type === 'JSXIdentifier') {
    used.add(node.name);

    return used;
  }

  if (node.type === 'JSXMemberExpression') {
    collectUsedIdentifiers(node.object, used);

    return used;
  }

  if (node.type === 'MemberExpression') {
    collectUsedIdentifiers(node.object, used);
    if (node.computed) collectUsedIdentifiers(node.property, used);

    return used;
  }

  if (node.type === 'Property') {
    if (node.computed) collectUsedIdentifiers(node.key, used);
    collectUsedIdentifiers(node.value, used);

    return used;
  }

  if (
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'FunctionExpression' ||
    node.type === 'FunctionDeclaration'
  ) {
    const boundNames = new Set();

    node.params.forEach(param => collectPatternNames(param, boundNames));
    node.params.forEach(param => collectParamDefaults(param));

    if (node.body && node.body.type === 'BlockStatement') {
      node.body.body.forEach(stmt => {
        if (stmt.type === 'VariableDeclaration') {
          stmt.declarations.forEach(d => collectPatternNames(d.id, boundNames));
        }
      });
    }

    const bodyUsed = new Set();

    collectUsedIdentifiers(node.body, bodyUsed);

    node.params.forEach(param => {
      if (param && param.typeAnnotation) collectTypeQueryRefs(param.typeAnnotation, bodyUsed);
    });

    if (node.returnType) collectTypeQueryRefs(node.returnType, bodyUsed);

    for (const name of bodyUsed) {
      if (!boundNames.has(name)) used.add(name);
    }

    return used;
  }

  if (node.type === 'VariableDeclaration') {
    node.declarations.forEach(declarator => {
      if (declarator.init) collectUsedIdentifiers(declarator.init, used);

      if (declarator.id) {
        collectParamDefaults(declarator.id);
        if (declarator.id.typeAnnotation) collectTypeQueryRefs(declarator.id.typeAnnotation, used);
      }
    });

    return used;
  }

  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    collectUsedIdentifiers(node[key], used);
  }

  return used;
}

function compareStrings(a, b) {
  if (a < b) {
    return -1;
  }

  if (a > b) {
    return 1;
  }

  return 0;
}

function getAllDeclaredNames(node) {
  const decl = node.type === 'ExportNamedDeclaration' ? node.declaration : node;
  const names = new Set();

  if (!decl) return names;

  if (decl.type === 'FunctionDeclaration') {
    if (decl.id) names.add(decl.id.name);
  } else if (decl.type === 'VariableDeclaration') {
    decl.declarations.forEach(declarator => collectPatternNames(declarator.id, names));
  }

  return names;
}

function getTrailingLineComment(node, sourceCode) {
  const commentsAfter = sourceCode.getCommentsAfter(node);

  if (
    commentsAfter.length > 0 &&
    commentsAfter[0].type === 'Line' &&
    commentsAfter[0].loc.start.line === node.loc.end.line
  ) {
    return commentsAfter[0];
  }

  return null;
}

function groupHasDependencies(group) {
  const declaredNames = new Set();

  for (const decl of group) {
    const usedInInits = new Set();

    decl.declarations.forEach(declarator => {
      if (declarator.init) collectUsedIdentifiers(declarator.init, usedInInits);
    });

    for (const name of usedInInits) {
      if (declaredNames.has(name)) return true;
    }

    collectDeclaredNames(decl, declaredNames);
  }

  return false;
}

function isOneLiner(node) {
  return node.loc.start.line === node.loc.end.line;
}

function topoSortAlpha(declarations, deps, compare) {
  const originalIndex = new Map(declarations.map((d, i) => [d, i]));
  const remaining = new Set(declarations);
  const result = [];

  while (remaining.size > 0) {
    const available = [...remaining].filter(decl => [...(deps.get(decl) ?? [])].every(dep => !remaining.has(dep)));

    if (available.length === 0) {
      // Cycle detected — preserve original order to avoid introducing no-use-before-define violations
      result.push(...[...remaining].sort((a, b) => originalIndex.get(a) - originalIndex.get(b)));
      break;
    }

    available.sort(compare);
    result.push(available[0]);
    remaining.delete(available[0]);
  }

  return result;
}

module.exports = {
  SKIP_KEYS,
  collectDeclaredNames,
  collectPatternNames,
  collectTypeQueryRefs,
  collectUsedIdentifiers,
  compareStrings,
  getAllDeclaredNames,
  getTrailingLineComment,
  groupHasDependencies,
  isOneLiner,
  topoSortAlpha
};
