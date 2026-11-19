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

/** An instance, by the namespace it plays under and its id. */
export interface RowInstance {
  namespaceId: string;
  instanceId: string;
}

/**
 * The one instance a row's entries belong to, or undefined for a row of none
 * or of several. The derived build asks this to decide which time a row's
 * stamps are in (its one instance's local time, or world time for a row of
 * several) and records the answer on the row (`ComputedRowData.time`), which
 * is what readers of the stamps convert with.
 */
export function rowInstanceOf(row: SourceRow | undefined): RowInstance | undefined {
  let found: RowInstance | undefined;
  for (const entry of row?.data ?? []) {
    if (!entry.instanceId) continue;
    if (!found) {
      found = { namespaceId: entry.namespaceId, instanceId: entry.instanceId };
    } else if (found.namespaceId !== entry.namespaceId || found.instanceId !== entry.instanceId) {
      return undefined;
    }
  }
  return found;
}

/** Whether a row's entries belong to more than one instance. */
export function spansSeveralInstances(row: SourceRow): boolean {
  return row.data.some((entry) => entry.instanceId) && !rowInstanceOf(row);
}

/**
 * The row a view lists and reads a row's keys from: the view's filtered copy
 * of it when there is one, a row of its own whose columns differ from the
 * full row's wherever the filter hides a key, and which can be of one
 * instance when the full row is of several. The row's segments, violations
 * and handles come from the full row. Each carries the time its stamps are
 * in (`ComputedRowData.time`).
 */
export function keyRowOf(
  sources: Record<string, SourceRow>,
  rowId: string,
  viewId?: string,
): string {
  const filteredId = viewId ? buildFilteredSourceRowId(viewId, rowId) : undefined;
  return filteredId && sources[filteredId] ? filteredId : rowId;
}
