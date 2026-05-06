import type { SourceRow } from "../types";

/**
 * For each row, computes an array of boolean flags indicating whether
 * each ancestor (from root to parent) is the last child at its level.
 * This drives tree connector line rendering — a vertical continuation
 * line is drawn at depth N only if the ancestor at depth N is NOT the
 * last child (there are more siblings below).
 *
 * @param rowIds - Ordered list of visible source rows (from sourceRowIds.flat)
 * @param rowLookup - Lookup from row ID to SourceRow
 * @returns Map from row ID to ancestorIsLast boolean array (length = row.depth)
 */
export function computeAncestorIsLast(
  rowIds: string[],
  rowLookup: Record<string, SourceRow>,
): Map<string, boolean[]> {
  const result = new Map<string, boolean[]>();

  for (const rowId of rowIds) {
    const row = rowLookup[rowId];
    if (!row) continue;

    const depth = row.depth ?? 0;
    if (depth === 0) {
      result.set(rowId, []);
      continue;
    }

    // Walk up the parent chain, collecting isLastChild flags as we go.
    // Flags are pushed in leaf-to-root order, then reversed once so the
    // returned array is root-to-parent (the order renderers index into).
    const ancestors: boolean[] = [];
    let currentId: string | undefined = row.parentId;
    while (currentId) {
      const ancestor = rowLookup[currentId];
      ancestors.push(ancestor?.isLastChild ?? false);
      currentId = ancestor?.parentId;
    }
    ancestors.reverse();
    result.set(rowId, ancestors);
  }

  return result;
}
