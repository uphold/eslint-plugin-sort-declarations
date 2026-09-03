'use strict';

const {
  SKIP_KEYS,
  collectPatternNames,
  collectTypeQueryRefs,
  collectUsedIdentifiers,
  compareStrings,
  getAllDeclaredNames,
  getTrailingLineComment,
  isOneLiner,
  topoSortAlpha
} = require('../utils');

const GQL_GROUPS = {
  CONST: 2,
  CONST_CALL: 3,
  FRAGMENT: 4,
  FUNCTION: 8,
  LET_OR_VAR: 1,
  MUTATION: 6,
  PROP_TYPES: 9,
  QUERY: 5,
  SUBSCRIPTION: 7
};

const GQL_TAGS = new Set(['gql', 'graphql']);

const GROUPS = {
  CONST: 3,
  CONST_CALL: 4,
  FUNCTION: 5,
  LET_OR_VAR: 2,
  PROP_TYPES: 6,
  SCREAMING_SNAKE: 1
};

const SCREAMING_SNAKE_RE = /^[A-Z][A-Z0-9_]*$/;

function collectLocalBindings(node, names) {
  if (!node || typeof node !== 'object') return;

  if (Array.isArray(node)) {
    for (const child of node) collectLocalBindings(child, names);

    return;
  }

  if (!node.type) return;

  if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
    for (const param of node.params) collectPatternNames(param, names);
    collectLocalBindings(node.body, names);

    return;
  }

  if (node.type === 'FunctionDeclaration') {
    if (node.id) names.add(node.id.name);

    return;
  }

  if (node.type === 'VariableDeclarator') {
    collectPatternNames(node.id, names);
  }

  if (node.type === 'CatchClause' && node.param) {
    collectPatternNames(node.param, names);
  }

  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    collectLocalBindings(node[key], names);
  }
}

function containsPropTypesRef(node) {
  if (!node || typeof node !== 'object') return false;
  if (Array.isArray(node)) return node.some(containsPropTypesRef);

  if (node.type === 'MemberExpression' && node.object?.type === 'Identifier' && node.object?.name === 'PropTypes')
    return true;

  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    if (containsPropTypesRef(node[key])) return true;
  }

  return false;
}

function getAttachedLeadingComments(node, sourceCode) {
  const attached = [];
  const comments = sourceCode.getCommentsBefore(node);
  let nextLine = node.loc.start.line;

  for (let i = comments.length - 1; i >= 0; i--) {
    const comment = comments[i];

    const isBlockWithOneBlankLine = comment.type === 'Block' && comment.loc.end.line === nextLine - 2;
    const tokenBefore = sourceCode.getTokenBefore(comment, { includeComments: false });

    const isInline = tokenBefore !== null && tokenBefore.loc.end.line === comment.loc.start.line;

    if (isInline) break;

    if (comment.loc.end.line === nextLine - 1 || isBlockWithOneBlankLine) {
      attached.unshift(comment);
      nextLine = comment.loc.start.line;
    } else {
      break;
    }
  }

  return attached;
}

function getEffectiveStartLine(node, sourceCode) {
  const comments = getAttachedLeadingComments(node, sourceCode);

  return comments.length > 0 ? comments[0].loc.start.line : node.loc.start.line;
}

function getFullRange(node, sourceCode) {
  const leadingComments = getAttachedLeadingComments(node, sourceCode);
  const trailingComment = getTrailingLineComment(node, sourceCode);

  const end = trailingComment ? trailingComment.range[1] : node.range[1];
  const start = leadingComments.length > 0 ? leadingComments[0].range[0] : node.range[0];

  return [start, end];
}

function getFullText(node, sourceCode) {
  const [start, end] = getFullRange(node, sourceCode);

  return sourceCode.text.slice(start, end);
}

function hasDependency(nodeA, nodeB, depsMap) {
  const aDeps = depsMap.get(nodeA) ?? new Set();
  const bDeps = depsMap.get(nodeB) ?? new Set();

  return aDeps.has(nodeB) || bDeps.has(nodeA);
}

function buildSandwichedNodeSet(correctOrder, groupMap, depsMap) {
  const byGroup = new Map();

  for (const node of correctOrder) {
    const gid = groupMap.get(node);

    if (!byGroup.has(gid)) byGroup.set(gid, []);
    byGroup.get(gid).push(node);
  }

  const sandwichedNodes = new Set();

  for (const [, nodes] of byGroup) {
    if (!nodes.some(node => !isOneLiner(node))) continue;

    let groupHasSandwich = false;
    let i = 0;

    while (i < nodes.length) {
      if (!isOneLiner(nodes[i])) {
        i++;
        continue;
      }

      let j = i + 1;

      while (j < nodes.length && isOneLiner(nodes[j]) && !hasDependency(nodes[j - 1], nodes[j], depsMap)) {
        j++;
      }

      if (j - i >= 2) {
        const hasAfter = j < nodes.length && !isOneLiner(nodes[j]);
        const hasBefore = i > 0 && !isOneLiner(nodes[i - 1]);

        if (hasBefore && hasAfter) {
          groupHasSandwich = true;
        }
      }

      i = j;
    }

    if (groupHasSandwich) {
      for (const node of nodes) {
        sandwichedNodes.add(node);
      }
    }
  }

  return sandwichedNodes;
}

function unwrap(node) {
  return node.type === 'ExportNamedDeclaration' ? node.declaration : node;
}

function getBody(node) {
  const decl = unwrap(node);

  if (!decl) return null;
  if (decl.type === 'FunctionDeclaration') return decl.body;
  if (decl.type === 'VariableDeclaration') return decl.declarations[0]?.init ?? null;

  return null;
}

function getGqlCategory(node) {
  const decl = unwrap(node);

  if (decl?.type !== 'VariableDeclaration') return null;
  const init = decl.declarations[0]?.init;

  if (!init || init.type !== 'TaggedTemplateExpression') return null;
  const tagName = init.tag.type === 'Identifier' ? init.tag.name : init.tag.property?.name;

  if (!GQL_TAGS.has(tagName)) return null;

  const firstWord = init.quasi.quasis[0]?.value?.cooked?.trimStart().split(/[\s({]/)[0] ?? '';

  if (firstWord === 'fragment') return 'fragment';
  if (firstWord === 'query') return 'query';
  if (firstWord === 'mutation') return 'mutation';
  if (firstWord === 'subscription') return 'subscription';

  return 'fragment';
}

function fileHasGraphql(body) {
  return body.some(node => getGqlCategory(node) !== null);
}

function getIdTypeOrder(node) {
  const decl = unwrap(node);

  if (decl?.type !== 'VariableDeclaration') return 2;
  const id = decl.declarations[0]?.id;

  if (id?.type === 'ArrayPattern') return 0;
  if (id?.type === 'ObjectPattern') return 1;

  return 2;
}

function getLocalBindings(declNode) {
  const decl = unwrap(declNode);
  const names = new Set();

  if (!decl) return names;

  if (decl.type === 'FunctionDeclaration') {
    for (const param of decl.params) collectPatternNames(param, names);
    collectLocalBindings(decl.body, names);

    return names;
  }

  if (decl.type === 'VariableDeclaration') {
    const init = decl.declarations[0]?.init;

    if (init) collectLocalBindings(init, names);
  }

  return names;
}

function buildDepsMap(declarations) {
  const nameToDecl = new Map();

  for (const decl of declarations) {
    for (const name of getAllDeclaredNames(decl)) {
      nameToDecl.set(name, decl);
    }
  }

  const deps = new Map();

  for (const decl of declarations) {
    const body = getBody(decl);
    const localNames = getLocalBindings(decl);
    const ownNames = getAllDeclaredNames(decl);

    const used = body ? collectUsedIdentifiers(body) : new Set();
    const unwrapped = unwrap(decl);

    if (unwrapped?.type === 'VariableDeclaration') {
      const id = unwrapped.declarations[0]?.id;

      if (id?.typeAnnotation) collectTypeQueryRefs(id.typeAnnotation, used);
    }

    deps.set(
      decl,
      new Set(
        [...used]
          .filter(ident => nameToDecl.has(ident) && !ownNames.has(ident) && !localNames.has(ident))
          .map(ident => nameToDecl.get(ident))
      )
    );
  }

  return { deps };
}

function getName(node) {
  const decl = unwrap(node);

  if (!decl) return null;

  if (decl.type === 'FunctionDeclaration') return decl.id?.name ?? null;

  if (decl.type === 'VariableDeclaration' && decl.declarations.length === 1) {
    const [{ id }] = decl.declarations;

    if (!id) return null;
    if (id.type === 'Identifier') return id.name;

    if (id.type === 'ArrayPattern') {
      const first = id.elements.find(Boolean);

      return first?.type === 'Identifier' ? first.name : null;
    }

    if (id.type === 'ObjectPattern') {
      const [first] = id.properties;

      if (first?.type === 'Property' && first.key?.type === 'Identifier') return first.key.name;
    }
  }

  return null;
}

function compareNames(nodeA, nodeB) {
  const orderA = getIdTypeOrder(nodeA);
  const orderB = getIdTypeOrder(nodeB);

  if (orderA !== orderB) return orderA - orderB;

  const nameA = getName(nodeA) ?? '';
  const nameB = getName(nodeB) ?? '';

  return compareStrings(nameA, nameB);
}

function isCallExpressionConst(node) {
  const decl = unwrap(node);

  if (decl?.type !== 'VariableDeclaration') return false;
  const init = decl.declarations[0]?.init;

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

function isFunction(node) {
  const decl = unwrap(node);

  if (!decl) return false;
  if (decl.type === 'FunctionDeclaration') return true;

  if (decl.type === 'VariableDeclaration') {
    const init = decl.declarations[0]?.init;

    if (init?.type === 'ArrowFunctionExpression' || init?.type === 'FunctionExpression') return true;
  }

  return false;
}

function isLetOrVar(node) {
  const decl = unwrap(node);

  return decl?.type === 'VariableDeclaration' && (decl.kind === 'let' || decl.kind === 'var');
}

function isPropTypes(node) {
  const decl = unwrap(node);

  if (decl?.type !== 'VariableDeclaration') return false;
  const init = decl.declarations[0]?.init;

  return init?.type === 'ObjectExpression' && containsPropTypesRef(init);
}

function isRequire(node) {
  const decl = unwrap(node);

  if (decl?.type !== 'VariableDeclaration') return false;
  const init = decl.declarations[0]?.init;

  return init?.type === 'CallExpression' && init.callee?.type === 'Identifier' && init.callee.name === 'require';
}

function isScreamingSnake(node) {
  const name = getName(node);

  return name !== null && SCREAMING_SNAKE_RE.test(name);
}

function getGroup(node) {
  if (isPropTypes(node)) return GROUPS.PROP_TYPES;
  if (isScreamingSnake(node)) return GROUPS.SCREAMING_SNAKE;
  if (isFunction(node)) return GROUPS.FUNCTION;
  if (isLetOrVar(node)) return GROUPS.LET_OR_VAR;
  if (isCallExpressionConst(node)) return GROUPS.CONST_CALL;

  return GROUPS.CONST;
}

function getGroupForFile(node, hasGraphql) {
  if (isPropTypes(node)) return hasGraphql ? GQL_GROUPS.PROP_TYPES : GROUPS.PROP_TYPES;

  const gqlCat = getGqlCategory(node);

  if (hasGraphql && gqlCat) {
    return GQL_GROUPS[gqlCat.toUpperCase()];
  }

  if (hasGraphql) {
    if (isFunction(node)) return GQL_GROUPS.FUNCTION;
    if (isLetOrVar(node)) return GQL_GROUPS.LET_OR_VAR;
    if (isCallExpressionConst(node)) return GQL_GROUPS.CONST_CALL;

    return GQL_GROUPS.CONST;
  }

  return getGroup(node);
}

function buildGroupMap(nodes, hasGraphql) {
  const map = new Map();

  for (const node of nodes) {
    map.set(node, getGroupForFile(node, hasGraphql));
  }

  return map;
}

function isSortable(node) {
  return getName(node) !== null && !isRequire(node);
}

function getSortableRegions(body) {
  let current = [];
  const regions = [];

  for (const node of body) {
    if (isSortable(node)) {
      current.push(node);
    } else if (current.length > 0) {
      regions.push(current);
      current = [];
    }
  }

  if (current.length > 0) regions.push(current);

  return regions;
}

function makeCompare(groupMap) {
  return (nodeA, nodeB) => {
    const groupA = groupMap.get(nodeA);
    const groupB = groupMap.get(nodeB);

    if (groupA !== groupB) return groupA - groupB;

    return compareNames(nodeA, nodeB);
  };
}

function computeCorrectOrder(declarations, groupMap) {
  const { deps } = buildDepsMap(declarations);

  return topoSortAlpha(declarations, deps, makeCompare(groupMap));
}

function wouldSeparateWithoutDep(prev, curr, depsMap, groupMap, sandwichedNodes) {
  if (groupMap.get(prev) !== groupMap.get(curr)) return true;
  if (hasDependency(prev, curr, depsMap)) return true;
  if ((prev.type === 'ExportNamedDeclaration') !== (curr.type === 'ExportNamedDeclaration')) return true;

  if (isOneLiner(prev) && isOneLiner(curr)) {
    if (isFunction(prev) && isFunction(curr)) return sandwichedNodes.has(prev) && sandwichedNodes.has(curr);

    return false;
  }

  if (isFunction(prev) && isFunction(curr)) return true;

  return true;
}

function buildDependentInGroupSet(sortedOrder, depsMap, groupMap, sandwichedNodes) {
  const dependents = new Set();
  let currentCluster = new Set();

  for (let i = 0; i < sortedOrder.length; i++) {
    const curr = sortedOrder[i];

    let separated = i === 0 || wouldSeparateWithoutDep(sortedOrder[i - 1], curr, depsMap, groupMap, sandwichedNodes);

    if (!separated) {
      const currDeps = depsMap.get(curr) ?? new Set();

      for (const dep of currDeps) {
        if (currentCluster.has(dep)) {
          dependents.add(curr);
          separated = true;
          break;
        }
      }
    }

    if (separated) {
      currentCluster = new Set([curr]);
    } else {
      currentCluster.add(curr);
    }
  }

  return dependents;
}

function needsBlankLine(prev, curr, depsMap, { dependentInGroup, groupMap, sandwichedNodes }) {
  if (dependentInGroup.has(curr)) return true;

  return wouldSeparateWithoutDep(prev, curr, depsMap, groupMap, sandwichedNodes);
}

module.exports = {
  create(context) {
    const { sourceCode } = context;

    return {
      Program(programNode) {
        const allSortable = programNode.body.filter(isSortable);
        const hasGraphql = fileHasGraphql(programNode.body);

        const groupMap = buildGroupMap(allSortable, hasGraphql);
        const allDepsMap = buildDepsMap(allSortable).deps;

        for (const region of getSortableRegions(programNode.body)) {
          if (region.length < 2) continue;

          const correctOrder = computeCorrectOrder(region, groupMap);

          const sandwichedNodes = buildSandwichedNodeSet(correctOrder, groupMap, allDepsMap);

          const dependentInGroup = buildDependentInGroupSet(correctOrder, allDepsMap, groupMap, sandwichedNodes);
          const firstViolation = region.findIndex((decl, i) => getName(decl) !== getName(correctOrder[i]));

          if (firstViolation !== -1) {
            context.report({
              fix(fixer) {
                const parts = [];

                for (let i = 0; i < correctOrder.length; i++) {
                  const curr = correctOrder[i];
                  const prev = correctOrder[i - 1];

                  if (
                    i > 0 &&
                    needsBlankLine(prev, curr, allDepsMap, { dependentInGroup, groupMap, sandwichedNodes, sourceCode })
                  ) {
                    parts.push('');
                  }

                  parts.push(getFullText(correctOrder[i], sourceCode));
                }

                const [, endRange] = getFullRange(region[region.length - 1], sourceCode);
                const [startRange] = getFullRange(region[0], sourceCode);

                return fixer.replaceTextRange([startRange, endRange], parts.join('\n'));
              },
              messageId: 'sortOrder',
              node: region[firstViolation]
            });

            continue;
          }

          for (let i = 1; i < region.length; i++) {
            const curr = region[i];
            const prev = region[i - 1];

            const currStart = getEffectiveStartLine(curr, sourceCode);
            const trailingComment = getTrailingLineComment(prev, sourceCode);

            const effectivePrevEnd = trailingComment ? trailingComment.loc.end.line : prev.loc.end.line;

            const hasBlank = currStart - effectivePrevEnd > 1;

            if (
              needsBlankLine(prev, curr, allDepsMap, { dependentInGroup, groupMap, sandwichedNodes, sourceCode }) &&
              !hasBlank
            ) {
              const [rangeStart] = getFullRange(curr, sourceCode);

              context.report({
                fix(fixer) {
                  return fixer.replaceTextRange([rangeStart, rangeStart], '\n');
                },
                messageId: 'missingBlankLine',
                node: curr
              });
            }

            if (
              !needsBlankLine(prev, curr, allDepsMap, { dependentInGroup, groupMap, sandwichedNodes, sourceCode }) &&
              hasBlank
            ) {
              const [currRangeStart] = getFullRange(curr, sourceCode);
              const [, prevRangeEnd] = getFullRange(prev, sourceCode);

              context.report({
                fix(fixer) {
                  return fixer.replaceTextRange([prevRangeEnd, currRangeStart], '\n');
                },
                messageId: 'extraBlankLine',
                node: curr
              });
            }
          }
        }
      }
    };
  },
  meta: {
    fixable: 'code',
    messages: {
      extraBlankLine: 'Remove the blank line before this declaration.',
      missingBlankLine: 'Add a blank line before this declaration.',
      sortOrder:
        'Module-level declarations should be sorted: SCREAMING_SNAKE constants first, then let/var declarations, then plain const declarations, then const declarations initialized with a call or new expression, then functions, then PropTypes objects. In files with GraphQL: non-GQL declarations come first (let/var, plain const, call-expression const), then GQL declarations (fragments, queries, mutations, subscriptions), then functions, then PropTypes. Within each group: dependencies first, then alphabetically.'
    },
    schema: [],
    type: 'suggestion'
  }
};
