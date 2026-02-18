const FILTERED_GLOBAL_ROW_PREFIX = "global-filtered:";

export function buildFilteredGlobalRowId(viewId: string): string {
  return `${FILTERED_GLOBAL_ROW_PREFIX}${viewId}`;
}

export function isFilteredGlobalRowId(rowId: string): boolean {
  return rowId.startsWith(FILTERED_GLOBAL_ROW_PREFIX);
}
