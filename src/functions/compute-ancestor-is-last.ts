import type { SourceRow } from "../types";

/**
 * For each row, computes an array of boolean flags indicating whether
 * each ancestor (from root to parent) is the last child at its level.
 * This drives tree connector line rendering — a vertical continuation
 * line is drawn at depth N only if the ancestor at depth N is NOT the
 * last child (there are more siblings below).
 *
 * @param rows - Ordered list of visible source rows (from sourceRowIds.flat)
 * @param rowLookup - Lookup from row ID to SourceRow
 * @returns Map from row ID to ancestorIsLast boolean array (length = row.depth)
 */
export function computeAncestorIsLast(
  rowIds: string[],
  rowLookup: Record<string, SourceRow>,
): Map<string, boolean[]> {
  const result = new Map<string, boolean[]>();

  // Build parent→children index and collect parent chains
  const parentChains = new Map<string, string[]>(); // rowId → [root, ..., parent]

  for (const rowId of rowIds) {
    const row = rowLookup[rowId];
    if (!row) continue;

    const depth = row.depth ?? 0;
    if (depth === 0) {
      parentChains.set(rowId, []);
      continue;
    }

    // Walk up the parent chain
    const chain: string[] = [];
    let currentId: string | undefined = row.parentId;
    while (currentId) {
      chain.unshift(currentId);
      const parent = rowLookup[currentId];
      currentId = parent?.parentId;
    }
    parentChains.set(rowId, chain);
  }

  // For each row, build the ancestorIsLast array from its parent chain
  for (const rowId of rowIds) {
    const row = rowLookup[rowId];
    if (!row) continue;

    const chain = parentChains.get(rowId) ?? [];
    const ancestors: boolean[] = [];

    for (const ancestorId of chain) {
      const ancestor = rowLookup[ancestorId];
      ancestors.push(ancestor?.isLastChild ?? false);
    }

    result.set(rowId, ancestors);
  }

  return result;
}
