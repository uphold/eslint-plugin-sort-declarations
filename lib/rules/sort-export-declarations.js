'use strict';

const { compareStrings, getTrailingLineComment } = require('../utils');

const GROUPS = {
  LOCAL: 3,
  LOCAL_BINDING: 1,
  NON_LOCAL: 2
};

function getAttachedLeadingComments(node, sourceCode) {
  const attached = [];
  const comments = sourceCode.getCommentsBefore(node);
  let nextLine = node.loc.start.line;

  for (let i = comments.length - 1; i >= 0; i--) {
    const comment = comments[i];

    const tokenBefore = sourceCode.getTokenBefore(comment, { includeComments: false });

    const isInline = tokenBefore !== null && tokenBefore.loc.end.line === comment.loc.start.line;

    if (isInline) break;

    if (comment.loc.end.line === nextLine - 1) {
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

function getGroup(node) {
  if (node.type === 'ExportNamedDeclaration' && node.source === null) {
    return GROUPS.LOCAL_BINDING;
  }

  return node.source.value.startsWith('.') ? GROUPS.LOCAL : GROUPS.NON_LOCAL;
}

function getSortKey(node) {
  if (node.type === 'ExportNamedDeclaration' && node.source === null) {
    return node.specifiers[0]?.exported?.name ?? '';
  }

  return node.source.value;
}

function compare(nodeA, nodeB) {
  const groupA = getGroup(nodeA);
  const groupB = getGroup(nodeB);

  if (groupA !== groupB) return groupA - groupB;

  const keyA = getSortKey(nodeA);
  const keyB = getSortKey(nodeB);

  return compareStrings(keyA, keyB);
}

function isExportStatement(node) {
  return node.type === 'ExportAllDeclaration' || (node.type === 'ExportNamedDeclaration' && node.declaration === null);
}

function getRegions(body) {
  let current = [];
  const regions = [];

  for (const node of body) {
    if (isExportStatement(node)) {
      current.push(node);
    } else if (current.length > 0) {
      regions.push(current);
      current = [];
    }
  }

  if (current.length > 0) regions.push(current);

  return regions;
}

function needsBlankLine(prev, curr) {
  return getGroup(prev) !== getGroup(curr);
}

module.exports = {
  create(context) {
    const { sourceCode } = context;

    return {
      Program(programNode) {
        for (const region of getRegions(programNode.body)) {
          if (region.length < 2) continue;

          const correctOrder = [...region].sort(compare);

          const firstViolation = region.findIndex((node, i) => node !== correctOrder[i]);

          if (firstViolation !== -1) {
            context.report({
              fix(fixer) {
                const parts = [];

                for (let i = 0; i < correctOrder.length; i++) {
                  const curr = correctOrder[i];
                  const prev = correctOrder[i - 1];

                  if (i > 0 && needsBlankLine(prev, curr)) {
                    parts.push('');
                  }

                  parts.push(getFullText(curr, sourceCode));
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

            if (needsBlankLine(prev, curr) && !hasBlank) {
              const [rangeStart] = getFullRange(curr, sourceCode);

              context.report({
                fix(fixer) {
                  return fixer.replaceTextRange([rangeStart, rangeStart], '\n');
                },
                messageId: 'missingBlankLine',
                node: curr
              });
            }

            if (!needsBlankLine(prev, curr) && hasBlank) {
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
      extraBlankLine: 'Remove the blank line before this export.',
      missingBlankLine: 'Add a blank line before this export.',
      sortOrder:
        'Export declarations should be sorted: named local exports first, then non-local re-exports, then local re-exports — all alphabetically within each group.'
    },
    schema: [],
    type: 'suggestion'
  }
};
