import type { SourceRow } from "../types";

/**
 * Given a source row ID, resolve all descendant leaf row IDs.
 * If the row is a leaf, returns [rowId].
 * If the row is a group, recursively collects all leaf descendants.
 */
export function resolveLeafRowIds(
  rowId: string,
  instancedTrackSources: Record<string, SourceRow>,
): string[] {
  const row = instancedTrackSources[rowId];
  if (!row) return [];

  if (!row.isGroup) return [rowId];

  // Collect children whose parentId matches this row
  const leaves: string[] = [];
  for (const child of Object.values(instancedTrackSources)) {
    if (child.parentId === rowId) {
      leaves.push(...resolveLeafRowIds(child.id, instancedTrackSources));
    }
  }
  return leaves;
}
