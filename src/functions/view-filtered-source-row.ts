import type { SourceRow } from "../types";

const FILTERED_SOURCE_ROW_PREFIX = "filtered:";
const FILTERED_SOURCE_ROW_DELIMITER = ":";

export function buildFilteredSourceRowId(viewId: string, rowId: string): string {
  return `${FILTERED_SOURCE_ROW_PREFIX}${viewId}${FILTERED_SOURCE_ROW_DELIMITER}${rowId}`;
}

export function isFilteredSourceRowId(rowId: string): boolean {
  return rowId.startsWith(FILTERED_SOURCE_ROW_PREFIX);
}

export function parseFilteredSourceRowId(rowId: string): { viewId: string; rowId: string } | null {
  if (!isFilteredSourceRowId(rowId)) return null;
  const body = rowId.slice(FILTERED_SOURCE_ROW_PREFIX.length);
  const delimiterIndex = body.indexOf(FILTERED_SOURCE_ROW_DELIMITER);
  if (delimiterIndex < 0) return null;
  return {
    viewId: body.slice(0, delimiterIndex),
    rowId: body.slice(delimiterIndex + 1),
  };
}

/**
 * The instance whose time a row's derived data is drawn through: the row's
 * one instance, or none for a row of several, whose data is already in world
 * time. It is read from the row the data was built from, not from a view's
 * filtered copy of it, which can show one instance of a row built from
 * several.
 */
export function drawnInstanceOf(
  sources: Record<string, SourceRow>,
  rowId: string,
): string | undefined {
  const row = sources[rowId];
  if (!row) return undefined;
  const ids = new Set(row.data.map((entry) => entry.instanceId).filter(Boolean));
  return ids.size === 1 ? [...ids][0] : undefined;
}
