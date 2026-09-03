'use strict';

const {
  collectDeclaredNames,
  collectTypeQueryRefs,
  collectUsedIdentifiers,
  compareStrings,
  groupHasDependencies,
  isOneLiner
} = require('../utils');

const KNOWN_PURE_GLOBAL_FNS = new Set([
  'parseInt',
  'parseFloat',
  'isNaN',
  'isFinite',
  'Number',
  'String',
  'Boolean',
  'BigInt'
]);

const KNOWN_PURE_NAMESPACES = {
  Array: new Set(['from', 'of', 'isArray']),
  JSON: new Set(['stringify', 'parse']),
  Math: new Set([
    'abs',
    'ceil',
    'floor',
    'round',
    'trunc',
    'sqrt',
    'cbrt',
    'pow',
    'exp',
    'log',
    'log2',
    'log10',
    'log1p',
    'expm1',
    'sin',
    'cos',
    'tan',
    'asin',
    'acos',
    'atan',
    'atan2',
    'sinh',
    'cosh',
    'tanh',
    'asinh',
    'acosh',
    'atanh',
    'hypot',
    'max',
    'min',
    'sign',
    'fround',
    'clz32',
    'imul'
  ]),
  Number: new Set(['isInteger', 'isFinite', 'isNaN', 'isSafeInteger', 'parseInt', 'parseFloat']),
  Object: new Set([
    'freeze',
    'keys',
    'values',
    'entries',
    'fromEntries',
    'create',
    'getOwnPropertyNames',
    'getOwnPropertyDescriptor',
    'getPrototypeOf',
    'is',
    'isFrozen',
    'isSealed'
  ]),
  PropTypes: new Set([
    'any',
    'array',
    'arrayOf',
    'bool',
    'element',
    'elementType',
    'exact',
    'func',
    'instanceOf',
    'node',
    'number',
    'object',
    'objectOf',
    'oneOf',
    'oneOfType',
    'shape',
    'string',
    'symbol'
  ]),
  String: new Set(['fromCharCode', 'fromCodePoint', 'raw']),
  Symbol: new Set(['for', 'keyFor'])
};

const KNOWN_PURE_PROTOTYPE_METHODS = new Set([
  'at',
  'charAt',
  'charCodeAt',
  'codePointAt',
  'concat',
  'endsWith',
  'includes',
  'indexOf',
  'lastIndexOf',
  'match',
  'matchAll',
  'normalize',
  'padEnd',
  'padStart',
  'repeat',
  'slice',
  'split',
  'startsWith',
  'substr',
  'substring',
  'toExponential',
  'toFixed',
  'toLowerCase',
  'toPrecision',
  'toString',
  'toUpperCase',
  'trim',
  'trimEnd',
  'trimStart',
  'valueOf'
]);

const PROJECT_CONVENTION_EXACT_NAMES = new Set(['t']);
const PROJECT_CONVENTION_PREFIXES = ['get', 'is', 'has', 'format'];

function containsSuperCall(node) {
  if (!node || typeof node !== 'object') return false;
  if (Array.isArray(node)) return node.some(containsSuperCall);

  if (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'ClassDeclaration' ||
    node.type === 'ClassExpression'
  ) {
    return false;
  }

  if (
    node.type === 'ExpressionStatement' &&
    node.expression.type === 'CallExpression' &&
    node.expression.callee.type === 'Super'
  ) {
    return true;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent') continue;
    if (value && typeof value === 'object' && containsSuperCall(value)) return true;
  }

  return false;
}

function containsThisExpression(node) {
  if (!node || typeof node !== 'object') return false;
  if (node.type === 'ThisExpression') return true;
  if (Array.isArray(node)) return node.some(containsThisExpression);

  if (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'ClassDeclaration' ||
    node.type === 'ClassExpression'
  ) {
    return false;
  }

  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent') continue;
    if (value && typeof value === 'object' && containsThisExpression(value)) return true;
  }

  return false;
}

function getAttachedLeadingComments(node, sourceCode) {
  const attached = [];
  const comments = sourceCode.getCommentsBefore(node);
  let nextLine = node.loc.start.line;
  let isFirst = true;

  for (let i = comments.length - 1; i >= 0; i--) {
    const comment = comments[i];

    const tokenBefore = sourceCode.getTokenBefore(comment, { includeComments: false });

    if (tokenBefore !== null && tokenBefore.loc.end.line === comment.loc.start.line) break;

    const gap = nextLine - comment.loc.end.line;

    if (isFirst ? gap <= 2 : gap === 1) {
      attached.unshift(comment);
      nextLine = comment.loc.start.line;
      isFirst = false;
    } else {
      break;
    }
  }

  return attached;
}

function getFullRange(node, sourceCode) {
  const commentsAfter = sourceCode.getCommentsAfter(node);
  const leadingComments = getAttachedLeadingComments(node, sourceCode);

  const trailingComment =
    commentsAfter.length > 0 &&
    commentsAfter[0].type === 'Line' &&
    commentsAfter[0].loc.start.line === node.loc.end.line
      ? commentsAfter[0]
      : null;

  const anchor = leadingComments.length > 0 ? leadingComments[0] : node;
  const end = trailingComment ? trailingComment.range[1] : node.range[1];

  const start = sourceCode.text.lastIndexOf('\n', anchor.range[0] - 1) + 1;

  return [start, end];
}

function getFullText(node, sourceCode) {
  const [start, end] = getFullRange(node, sourceCode);

  return sourceCode.text.slice(start, end);
}

function getSortName(id) {
  if (id.type === 'ArrayPattern') {
    const first = id.elements.find(Boolean);

    if (!first) return '';
    if (first.type === 'Identifier') return first.name;
    if (first.type === 'AssignmentPattern' && first.left.type === 'Identifier') return first.left.name;
    if (first.type === 'RestElement' && first.argument.type === 'Identifier') return first.argument.name;

    return '';
  }

  if (id.type === 'ObjectPattern') {
    const [first] = id.properties;

    if (!first) return '';

    if (first.type === 'Property') {
      if (first.key.type === 'Identifier') return first.key.name;
      if (first.key.type === 'Literal') return String(first.key.value);
    }

    if (first.type === 'RestElement' && first.argument.type === 'Identifier') return first.argument.name;

    return '';
  }

  if (id.type === 'Identifier') return id.name;

  return '';
}

function getTopLevelCallee(init) {
  if (!init) return null;

  if (init.type === 'CallExpression') {
    if (init.callee.type === 'Identifier') return init.callee.name;
  }

  if (init.type === 'MemberExpression') return getTopLevelCallee(init.object);

  return null;
}

function getTypeOrder(id) {
  if (id.type === 'ArrayPattern') return 0;
  if (id.type === 'ObjectPattern') return 1;

  return 2;
}

function compareDeclarations(declA, declB) {
  const idA = declA.declarations[0]?.id;
  const idB = declB.declarations[0]?.id;

  if (!idA || !idB) return 0;

  const typeOrderDiff = getTypeOrder(idA) - getTypeOrder(idB);

  if (typeOrderDiff !== 0) return typeOrderDiff;

  const nameA = getSortName(idA);
  const nameB = getSortName(idB);

  return compareStrings(nameA, nameB);
}

function getUsedInInits(node) {
  const used = new Set();

  node.declarations.forEach(declarator => {
    if (declarator.init) collectUsedIdentifiers(declarator.init, used);
    if (declarator.id?.typeAnnotation) collectTypeQueryRefs(declarator.id.typeAnnotation, used);
  });

  return used;
}

function buildHasExternalVarDepMap(body, outerDeclaredNames = new Set()) {
  const allDeclared = new Set(outerDeclaredNames);
  const varDecls = body.filter(n => n.type === 'VariableDeclaration');

  for (const decl of varDecls) collectDeclaredNames(decl, allDeclared);

  const map = new Map();

  for (const decl of varDecls) {
    const own = new Set();

    collectDeclaredNames(decl, own);
    let hasDep = false;
    const used = getUsedInInits(decl);

    for (const name of used) {
      if (allDeclared.has(name) && !own.has(name)) {
        hasDep = true;
        break;
      }
    }

    map.set(decl, hasDep);
  }

  return map;
}

function buildVarDepsMap(declarations) {
  const nameToDecl = new Map();

  for (const decl of declarations) {
    const names = new Set();

    collectDeclaredNames(decl, names);
    for (const name of names) nameToDecl.set(name, decl);
  }

  const deps = new Map();

  for (const decl of declarations) {
    const used = getUsedInInits(decl);
    const declDeps = new Set();

    for (const name of used) {
      const dep = nameToDecl.get(name);

      if (dep && dep !== decl) declDeps.add(dep);
    }

    deps.set(decl, declDeps);
  }

  return deps;
}

function getVarGroup(decl) {
  if (decl.declarations.length !== 1) return 0;
  const callee = getTopLevelCallee(decl.declarations[0]?.init);

  if (callee === 'useCallback') return 2;
  if (callee === 'useMemo') return 1;

  return 0;
}

function compareDeclarationsInBlock(declA, declB) {
  const groupDiff = getVarGroup(declA) - getVarGroup(declB);

  if (groupDiff !== 0) return groupDiff;

  return compareDeclarations(declA, declB);
}

function hasBlankLineBetween(nodeA, nodeB, sourceCode) {
  if (nodeB.loc.start.line - nodeA.loc.end.line <= 1) return false;

  const between = sourceCode.getText().slice(nodeA.range[1], nodeB.range[0]);

  return /\n[ \t]*\n/.test(between);
}

function isCallOrNewInit(init) {
  if (!init) return false;
  if (init.type === 'CallExpression' || init.type === 'NewExpression') return true;

  if (init.type === 'BinaryExpression') {
    const { left, right } = init;

    return (
      left?.type === 'CallExpression' ||
      left?.type === 'NewExpression' ||
      right?.type === 'CallExpression' ||
      right?.type === 'NewExpression'
    );
  }

  return false;
}

function isConsoleStatement(node) {
  if (node.type !== 'ExpressionStatement') return false;
  const { expression } = node;

  if (expression.type !== 'CallExpression') return false;
  const { callee } = expression;

  if (callee.type !== 'MemberExpression') return false;
  if (callee.object.type !== 'Identifier') return false;

  return callee.object.name === 'console';
}

function isEligibleForSort(decl) {
  if (decl.declarations.length !== 1 || !decl.declarations[0].id) return false;
  const [{ init }] = decl.declarations;

  return !(init?.type === 'CallExpression' && init?.callee?.type === 'Identifier' && init?.callee?.name === 'require');
}

function buildGlobalSortText(mergedVarOrder, nonVarNodes, deps, sourceCode) {
  const parts = [];

  for (let i = 0; i < mergedVarOrder.length; i++) {
    const curr = mergedVarOrder[i];

    if (i > 0) {
      const prev = mergedVarOrder[i - 1];

      const prevHasDep = (deps.get(prev) ?? new Set()).size > 0;
      const currHasDep = (deps.get(curr) ?? new Set()).size > 0;

      const transitionToDep = currHasDep && !prevHasDep;
      const currDirectlyDependsOnPrev = (deps.get(curr) ?? new Set()).has(prev);
      const groupChanged = getVarGroup(curr) !== getVarGroup(prev);
      const eitherMultiLine = !isOneLiner(prev) || !isOneLiner(curr);

      const outOfAlphaOrder =
        !eitherMultiLine && isEligibleForSort(prev) && isEligibleForSort(curr) && compareDeclarations(prev, curr) > 0;

      if (transitionToDep || currDirectlyDependsOnPrev || groupChanged || eitherMultiLine || outOfAlphaOrder)
        parts.push('');
    }

    parts.push(getFullText(curr, sourceCode));
  }

  if (nonVarNodes.length > 0) {
    parts.push('');

    for (let i = 0; i < nonVarNodes.length; i++) {
      if (i > 0 && (!isOneLiner(nonVarNodes[i - 1]) || !isOneLiner(nonVarNodes[i]))) parts.push('');
      parts.push(getFullText(nonVarNodes[i], sourceCode));
    }
  }

  return parts.join('\n');
}

function isHookLikeCall(init) {
  if (!init || init.type !== 'CallExpression') return false;

  const { callee } = init;

  if (callee.type === 'Identifier') return callee.name.startsWith('use');
  if (callee.type === 'MemberExpression' && !callee.computed) {
    if (callee.object.type === 'Identifier' && callee.object.name.startsWith('use')) return true;
    if (callee.property?.type === 'Identifier' && callee.property.name.startsWith('use')) return true;
  }

  return false;
}

function initializerContainsAnyCall(node) {
  if (!node || typeof node !== 'object') return false;
  if (Array.isArray(node)) return node.some(initializerContainsAnyCall);

  if (node.type === 'CallExpression' || node.type === 'OptionalCallExpression') {
    if (isHookLikeCall(node)) return false;
    return true;
  }

  if (node.type === 'NewExpression' || node.type === 'TaggedTemplateExpression') return true;

  if (
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'ClassDeclaration' ||
    node.type === 'ClassExpression'
  )
    return false;

  for (const [key, value] of Object.entries(node)) {
    if (key === 'parent') continue;
    if (value && typeof value === 'object' && initializerContainsAnyCall(value)) return true;
  }

  return false;
}

function isWorkletDirective(node) {
  return (
    node.type === 'ExpressionStatement' && node.expression.type === 'Literal' && node.expression.value === 'worklet'
  );
}

function matchesProjectConventionName(name) {
  if (PROJECT_CONVENTION_EXACT_NAMES.has(name)) return true;

  for (const prefix of PROJECT_CONVENTION_PREFIXES) {
    if (name.length <= prefix.length || !name.startsWith(prefix)) continue;
    const next = name.charCodeAt(prefix.length);
    if (next >= 65 && next <= 90) return true;
  }

  return false;
}

function isProjectConventionCallee(callee) {
  if (!callee) return false;
  if (callee.type === 'Identifier') return matchesProjectConventionName(callee.name);

  if (callee.type === 'MemberExpression' && !callee.computed && callee.property?.type === 'Identifier') {
    if (callee.object.type !== 'Identifier') return false;
    if (!/^[A-Z][A-Za-z0-9]*$/.test(callee.object.name)) return false;
    return matchesProjectConventionName(callee.property.name);
  }

  return false;
}

function mergeWithIneligible(allVarDecls, eligible, eligibleSorted) {
  const eligibleSet = new Set(eligible);
  const queue = [...eligibleSorted];
  let qi = 0;

  return allVarDecls.map(decl => (eligibleSet.has(decl) ? queue[qi++] : decl));
}

function topoSortVarDecls(declarations, deps, compare) {
  const originalIndex = new Map(declarations.map((d, i) => [d, i]));
  const remaining = new Set(declarations);
  const result = [];

  while (remaining.size > 0) {
    const available = [...remaining].filter(decl => [...(deps.get(decl) ?? [])].every(dep => !remaining.has(dep)));

    if (available.length === 0) {
      result.push(...[...remaining].sort((a, b) => originalIndex.get(a) - originalIndex.get(b)));
      break;
    }

    const minGroup = Math.min(...available.map(getVarGroup));

    const inMinGroup = available.filter(decl => getVarGroup(decl) === minGroup);

    const noDeps = inMinGroup.filter(decl => (deps.get(decl) ?? new Set()).size === 0);

    const oneLinerNoDeps = noDeps.filter(isOneLiner);

    const candidates = oneLinerNoDeps.length > 0 ? oneLinerNoDeps : noDeps.length > 0 ? noDeps : inMinGroup;

    const next = candidates.reduce((min, d) => (compare(d, min) < 0 ? d : min));

    result.push(next);
    remaining.delete(next);
  }

  return result;
}

function isKnownPureCallee(callee) {
  if (!callee) return false;
  if (callee.type === 'Identifier') return KNOWN_PURE_GLOBAL_FNS.has(callee.name);

  if (callee.type === 'MemberExpression' && !callee.computed && callee.property?.type === 'Identifier') {
    if (callee.object.type === 'Identifier') {
      const allowed = KNOWN_PURE_NAMESPACES[callee.object.name];
      if (allowed?.has(callee.property.name)) return true;
    }

    if (KNOWN_PURE_PROTOTYPE_METHODS.has(callee.property.name)) return isPureSortableInit(callee.object);
  }

  return false;
}

function isPureSortableInit(node) {
  if (!node) return true;

  switch (node.type) {
    case 'Literal':
    case 'NullLiteral':
    case 'BooleanLiteral':
    case 'NumericLiteral':
    case 'StringLiteral':
    case 'BigIntLiteral':
    case 'RegExpLiteral':
    case 'Identifier':
    case 'ThisExpression':
    case 'ArrowFunctionExpression':
    case 'FunctionExpression':
    case 'ClassExpression':
    case 'JSXElement':
    case 'JSXFragment':
      return true;

    case 'TemplateLiteral':
      return node.expressions.every(isPureSortableInit);

    case 'MemberExpression':
    case 'OptionalMemberExpression':
      return isPureSortableInit(node.object) && (!node.computed || isPureSortableInit(node.property));

    case 'UnaryExpression':
      return node.operator !== 'delete' && isPureSortableInit(node.argument);

    case 'BinaryExpression':
    case 'LogicalExpression':
      return isPureSortableInit(node.left) && isPureSortableInit(node.right);

    case 'ConditionalExpression':
      return isPureSortableInit(node.test) && isPureSortableInit(node.consequent) && isPureSortableInit(node.alternate);

    case 'ArrayExpression':
      return node.elements.every(el => el === null || isPureSortableInit(el));

    case 'SpreadElement':
      return isPureSortableInit(node.argument);

    case 'ObjectExpression':
      return node.properties.every(p => {
        if (p.type === 'SpreadElement') return isPureSortableInit(p.argument);
        if (p.computed) return isPureSortableInit(p.key) && isPureSortableInit(p.value);
        return isPureSortableInit(p.value);
      });

    case 'CallExpression':
    case 'OptionalCallExpression':
      if (isHookLikeCall(node)) return true;
      if (isKnownPureCallee(node.callee)) return node.arguments.every(isPureSortableInit);
      if (isProjectConventionCallee(node.callee)) return node.arguments.every(isPureSortableInit);
      return false;

    case 'NewExpression':
      return isHookLikeCall(node);

    case 'TSAsExpression':
    case 'TSNonNullExpression':
    case 'TSSatisfiesExpression':
      return isPureSortableInit(node.expression);

    default:
      return false;
  }
}

function isPureSortableDecl(decl) {
  return decl.declarations.every(d => isPureSortableInit(d.init));
}

function checkGlobalVarSort(body, context, sourceCode) {
  if (body.length === 0) return false;

  const allVarDecls = body.filter(n => n.type === 'VariableDeclaration');
  const nonVarNodes = body.filter(n => n.type !== 'VariableDeclaration');

  if (allVarDecls.length < 2) return false;

  const eligible = allVarDecls.filter(isEligibleForSort);

  if (eligible.length < 2) return false;

  const deps = buildVarDepsMap(allVarDecls);

  const eligibleSorted = topoSortVarDecls(eligible, deps, compareDeclarationsInBlock);

  const mergedVarOrder = mergeWithIneligible(allVarDecls, eligible, eligibleSorted);

  const alreadyInOrder = mergedVarOrder.every((n, i) => n === allVarDecls[i]);
  const lastVarIdx = Math.max(...allVarDecls.map(n => body.indexOf(n)));
  const firstNonVarIdx = nonVarNodes.length > 0 ? Math.min(...nonVarNodes.map(n => body.indexOf(n))) : Infinity;

  const varsBeforeNonVars = lastVarIdx < firstNonVarIdx;

  if (alreadyInOrder && varsBeforeNonVars) return false;

  if (
    !varsBeforeNonVars &&
    eligible.some(decl => decl.declarations.some(d => d.init && containsThisExpression(d.init)))
  ) {
    return false;
  }

  if (!varsBeforeNonVars) {
    let seenNonVar = false;

    for (const node of body) {
      if (node.type !== 'VariableDeclaration') {
        seenNonVar = true;
      } else if (seenNonVar && node.declarations.some(d => d.init && initializerContainsAnyCall(d.init))) {
        return false;
      }
    }
  }

  if (!eligible.every(isPureSortableDecl)) return false;

  const firstViolation = !alreadyInOrder
    ? allVarDecls.find((n, i) => n !== mergedVarOrder[i])
    : allVarDecls.find(n => body.indexOf(n) > firstNonVarIdx);

  context.report({
    fix(fixer) {
      const [, regionEnd] = getFullRange(body[body.length - 1], sourceCode);
      const [regionStart] = getFullRange(body[0], sourceCode);

      return fixer.replaceTextRange(
        [regionStart, regionEnd],
        buildGlobalSortText(mergedVarOrder, nonVarNodes, deps, sourceCode)
      );
    },
    messageId: 'globalUnsorted',
    node: firstViolation
  });

  return true;
}

function checkSortOrder(group, context, sourceCode) {
  const eligible = group.filter(isEligibleForSort);

  if (eligible.length < 2 || groupHasDependencies(eligible)) return;

  const hasOneLiner = eligible.some(isOneLiner);
  const hasMultiLiner = eligible.some(d => !isOneLiner(d));

  if (hasOneLiner && hasMultiLiner) return;

  if (!eligible.every(isPureSortableDecl)) return;

  let firstViolation = null;

  for (let i = 0; i < eligible.length - 1; i++) {
    if (compareDeclarations(eligible[i], eligible[i + 1]) > 0) {
      firstViolation = eligible[i + 1];
      break;
    }
  }

  if (!firstViolation) return;

  const sorted = [...eligible].sort(compareDeclarations);

  const merged = mergeWithIneligible(group, eligible, sorted);

  context.report({
    fix(fixer) {
      const [, endRange] = getFullRange(group[group.length - 1], sourceCode);
      const [startRange] = getFullRange(group[0], sourceCode);
      const parts = merged.map(decl => getFullText(decl, sourceCode));

      return fixer.replaceTextRange([startRange, endRange], parts.join('\n'));
    },
    messageId: 'unsorted',
    node: firstViolation
  });
}

function checkBody(body, context, sourceCode, isBlock = false, outerDeclaredNames = new Set()) {
  if (isBlock && body.length > 0 && isWorkletDirective(body[0])) {
    body = body.slice(1);
  }

  if (isBlock) {
    let hasVarAfterNonVar = false;
    let seenNonVar = false;

    for (const node of body) {
      if (node.type !== 'VariableDeclaration') seenNonVar = true;
      else if (seenNonVar) {
        hasVarAfterNonVar = true;
        break;
      }
    }

    if (hasVarAfterNonVar) {
      const splitIndices = [];

      for (let i = 0; i < body.length; i++) {
        if (body[i].type === 'IfStatement' || containsSuperCall(body[i]) || isConsoleStatement(body[i]))
          splitIndices.push(i);
      }

      if (splitIndices.length > 0) {
        let start = 0;
        const priorDeclaredNames = new Set(outerDeclaredNames);

        for (const splitIdx of splitIndices) {
          if (splitIdx > start) {
            const slice = body.slice(start, splitIdx);

            checkBody(slice, context, sourceCode, true, priorDeclaredNames);

            for (const node of slice) {
              if (node.type === 'VariableDeclaration') collectDeclaredNames(node, priorDeclaredNames);
            }
          }

          start = splitIdx + 1;
        }

        if (start < body.length) checkBody(body.slice(start), context, sourceCode, true, priorDeclaredNames);

        return;
      }

      const hadViolation = checkGlobalVarSort(body, context, sourceCode);

      if (hadViolation) return;

      let segment = [];
      const priorSegmentNames = new Set(outerDeclaredNames);

      for (const node of body) {
        if (node.type === 'VariableDeclaration') {
          segment.push(node);
        } else {
          if (segment.length > 0) {
            checkBody(segment, context, sourceCode, true, priorSegmentNames);
            for (const segNode of segment) collectDeclaredNames(segNode, priorSegmentNames);
            segment = [];
          }
        }
      }

      if (segment.length > 0) checkBody(segment, context, sourceCode, true, priorSegmentNames);

      return;
    }

    const hadViolation = checkGlobalVarSort(body, context, sourceCode);

    if (hadViolation) return;
  }

  let currentGroup = [];
  const groupDeclaredNames = new Set();
  const hasExternalVarDep = buildHasExternalVarDepMap(body, outerDeclaredNames);
  let prevDeclaration = null;
  let prevNonVar = null;

  const flushGroup = () => {
    checkSortOrder(currentGroup, context, sourceCode);
    currentGroup = [];
  };

  for (const node of body) {
    if (node.type !== 'VariableDeclaration') {
      flushGroup();
      groupDeclaredNames.clear();
      prevDeclaration = null;

      if (isBlock && prevNonVar) {
        const capturedPrevNonVar = prevNonVar;
        const eitherMultiLine = !isOneLiner(prevNonVar) || !isOneLiner(node);
        const hasBlanks = hasBlankLineBetween(prevNonVar, node, sourceCode);
        const nextRequiresBlankAfterGuard = node.type === 'ExpressionStatement' || node.type === 'VariableDeclaration';

        const prevIsInlineGuardClause =
          capturedPrevNonVar.type === 'IfStatement' && capturedPrevNonVar.consequent.type === 'ReturnStatement';

        if (eitherMultiLine && !hasBlanks) {
          context.report({
            fix(fixer) {
              const [lineStart] = getFullRange(node, sourceCode);

              return fixer.replaceTextRange([lineStart, lineStart], '\n');
            },
            messageId: 'multilineNewline',
            node
          });
        } else if (prevIsInlineGuardClause && nextRequiresBlankAfterGuard && !hasBlanks) {
          context.report({
            fix(fixer) {
              const [lineStart] = getFullRange(node, sourceCode);

              return fixer.replaceTextRange([lineStart, lineStart], '\n');
            },
            messageId: 'guardClauseNewline',
            node
          });
        } else if (!eitherMultiLine && hasBlanks && node.type !== 'ReturnStatement' && !prevIsInlineGuardClause) {
          context.report({
            fix(fixer) {
              const [end] = node.range;
              const [, start] = capturedPrevNonVar.range;

              const between = sourceCode.getText().slice(start, end);

              return fixer.replaceTextRange([start, end], between.replace(/\n[ \t]*\n/, '\n'));
            },
            messageId: 'unnecessaryNewline',
            node
          });
        }
      }

      prevNonVar = node;
      continue;
    }

    if (prevDeclaration && hasBlankLineBetween(prevDeclaration, node, sourceCode)) {
      if (isOneLiner(prevDeclaration) && isOneLiner(node)) {
        if (isBlock) {
          const nodeUsesPrev = [...getUsedInInits(node)].some(n => groupDeclaredNames.has(n));
          const sameGroup = getVarGroup(prevDeclaration) === getVarGroup(node);
          const transitionToDep = !hasExternalVarDep.get(prevDeclaration) && hasExternalVarDep.get(node);

          if (
            !nodeUsesPrev &&
            !transitionToDep &&
            sameGroup &&
            sourceCode.getTokensBetween(prevDeclaration, node).length === 0
          ) {
            const capturedPrev = prevDeclaration;

            context.report({
              fix(fixer) {
                const [end] = node.range;
                const [, start] = capturedPrev.range;

                const between = sourceCode.getText().slice(start, end);

                return fixer.replaceTextRange([start, end], between.replace(/\n[ \t]*\n/, '\n'));
              },
              messageId: 'unnecessaryNewline',
              node
            });
          }
        } else {
          const nodeInit = node.declarations[0]?.init;
          const prevInit = prevDeclaration.declarations[0]?.init;

          const prevIsFunc = prevInit?.type === 'ArrowFunctionExpression' || prevInit?.type === 'FunctionExpression';
          const nodeIsFunc = nodeInit?.type === 'ArrowFunctionExpression' || nodeInit?.type === 'FunctionExpression';
          const prevDeclaredNames = new Set();
          const usedInNode = getUsedInInits(node);
          const usedInPrev = getUsedInInits(prevDeclaration);

          collectDeclaredNames(prevDeclaration, prevDeclaredNames);

          const sameSiblingPattern =
            !prevIsFunc &&
            !nodeIsFunc &&
            isCallOrNewInit(prevInit) === isCallOrNewInit(nodeInit) &&
            usedInPrev.size > 0 &&
            usedInNode.size === usedInPrev.size &&
            [...usedInPrev].every(name => usedInNode.has(name)) &&
            ![...usedInNode].some(name => prevDeclaredNames.has(name));

          if (sameSiblingPattern) {
            const capturedPrev = prevDeclaration;

            context.report({
              fix(fixer) {
                const [end] = node.range;
                const [, start] = capturedPrev.range;

                const between = sourceCode.getText().slice(start, end);

                return fixer.replaceTextRange([start, end], between.replace(/\n[ \t]*\n/, '\n'));
              },
              messageId: 'unnecessaryNewline',
              node
            });
          }
        }
      }

      flushGroup();
      groupDeclaredNames.clear();
    }

    let reportedMissing = false;
    const usedInInits = getUsedInInits(node);

    for (const name of usedInInits) {
      if (groupDeclaredNames.has(name)) {
        const capturedPrev = prevDeclaration;

        context.report({
          data: { dependency: name },
          fix(fixer) {
            const comments = sourceCode
              .getCommentsBefore(node)
              .filter(comment => comment.loc.start.line > capturedPrev.loc.end.line);

            const insertBefore = comments.length > 0 ? comments[0] : node;

            const [lineStart] = getFullRange(insertBefore, sourceCode);

            return fixer.insertTextBeforeRange([lineStart, lineStart], '\n');
          },
          messageId: 'missingNewline',
          node
        });

        reportedMissing = true;
        break;
      }
    }

    if (isBlock && !reportedMissing && prevDeclaration && !hasBlankLineBetween(prevDeclaration, node, sourceCode)) {
      if (!isOneLiner(prevDeclaration) || !isOneLiner(node)) {
        context.report({
          fix(fixer) {
            const [lineStart] = getFullRange(node, sourceCode);

            return fixer.replaceTextRange([lineStart, lineStart], '\n');
          },
          messageId: 'multilineNewline',
          node
        });
      }
    }

    currentGroup.push(node);
    collectDeclaredNames(node, groupDeclaredNames);
    prevDeclaration = node;
  }

  flushGroup();
}

module.exports = {
  create(context) {
    const sourceCode = context.sourceCode;

    return {
      BlockStatement(node) {
        checkBody(node.body, context, sourceCode, true);
      },
      Program(node) {
        checkBody(node.body, context, sourceCode);
      }
    };
  },
  meta: {
    fixable: 'code',
    messages: {
      globalUnsorted:
        'Variable declarations should all appear before non-variable statements and be grouped: general declarations first, then useMemo, then useCallback. Within each group, sort alphabetically (respecting dependencies).',
      guardClauseNewline: 'Inline guard clause (if/return without braces) must be followed by an empty line.',
      missingNewline: "Uses '{{dependency}}' declared above — add an empty line between them.",
      multilineNewline: 'Multi-line declarations require an empty line between them.',
      unnecessaryNewline: 'Independent one-liners — remove the empty line between them.',
      unsorted:
        'Variable declarations should be ordered: array destructuring ([...]) first, object destructuring ({...}) second, then identifiers. Within each type, sort alphabetically.'
    },
    schema: [],
    type: 'suggestion'
  }
};
