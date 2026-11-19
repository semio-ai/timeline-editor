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
 * or of several. A row of one instance holds its derived stamps in that
 * instance's local time; a row of several holds them in world time. Every
 * reader of a row's stamps decides which by asking this, so they agree.
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

/** Which rows a row is drawn from, and the instance each is drawn through. */
export interface RowDrawing {
  /** The row its keys are listed and read from. */
  keyRowId: string;
  /** The instance the keys' stamps are taken to world time through, if any. */
  keyInstanceId?: string;
  /** The instance its segments, violations and handles are drawn through, if any. */
  rowInstanceId?: string;
}

/**
 * How a row is drawn in a view. Its segments, violations and handles come from
 * the row itself; its keys from the view's filtered copy of it when there is
 * one, a row of its own whose columns differ from the full row's wherever the
 * filter hides a key, and which can be of one instance when the full row is of
 * several. Each is drawn through the time of the row it is read from: its one
 * instance's, or none for a row of several, whose stamps are in world time.
 */
export function rowDrawing(
  sources: Record<string, SourceRow>,
  rowId: string,
  viewId?: string,
): RowDrawing {
  const filteredId = viewId ? buildFilteredSourceRowId(viewId, rowId) : undefined;
  const keyRowId = filteredId && sources[filteredId] ? filteredId : rowId;
  return {
    keyRowId,
    keyInstanceId: rowInstanceOf(sources[keyRowId])?.instanceId,
    rowInstanceId: rowInstanceOf(sources[rowId])?.instanceId,
  };
}
