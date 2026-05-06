const FILTERED_SOURCE_ROW_PREFIX = "filtered:";
const FILTERED_SOURCE_ROW_DELIMITER = ":";

export function buildFilteredSourceRowId(viewId: string, rowId: string): string {
  return `${FILTERED_SOURCE_ROW_PREFIX}${viewId}${FILTERED_SOURCE_ROW_DELIMITER}${rowId}`;
}

export function isFilteredSourceRowId(rowId: string): boolean {
  return rowId.startsWith(FILTERED_SOURCE_ROW_PREFIX);
}

export function parseFilteredSourceRowId(
  rowId: string,
): { viewId: string; rowId: string } | null {
  if (!isFilteredSourceRowId(rowId)) return null;
  const body = rowId.slice(FILTERED_SOURCE_ROW_PREFIX.length);
  const delimiterIndex = body.indexOf(FILTERED_SOURCE_ROW_DELIMITER);
  if (delimiterIndex < 0) return null;
  return {
    viewId: body.slice(0, delimiterIndex),
    rowId: body.slice(delimiterIndex + 1),
  };
}
