import type { SourceRow, VisibleSourceRowIds } from "../types";

const EMPTY_FLAT_ROW_IDS: string[] = [];
const EMPTY_SPLINE_ROW_IDS: string[] = [];

const DEFAULT_ROW_LOOKUP: VisibleSourceRowIds = {
  flat: EMPTY_FLAT_ROW_IDS,
  spline: EMPTY_SPLINE_ROW_IDS,
};

/**
 * Normalizes row lookup state into a {flat, spline} shape.
 * The array fallback supports older state snapshots.
 */
export function normalizeVisibleSourceRowIds(
  rows: VisibleSourceRowIds | string[] | undefined,
): VisibleSourceRowIds {
  if (!rows) return DEFAULT_ROW_LOOKUP;
  if (Array.isArray(rows)) {
    return { flat: rows, spline: rows };
  }
  return rows;
}

export function filterVisibleSourceRowIds(
  sourceRowIds: VisibleSourceRowIds,
  query: string,
  matchesRowId: (rowId: string, normalizedQuery: string) => boolean,
): VisibleSourceRowIds {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return sourceRowIds;
  }

  const matchCache = new Map<string, boolean>();
  const matches = (rowId: string): boolean => {
    const cached = matchCache.get(rowId);
    if (cached !== undefined) return cached;
    const next = matchesRowId(rowId, normalizedQuery);
    matchCache.set(rowId, next);
    return next;
  };

  return {
    flat: sourceRowIds.flat.filter(matches),
    spline: sourceRowIds.spline.filter(matches),
  };
}

export function matchesSourceRowQuery(
  rowId: string,
  normalizedQuery: string,
  lookups: {
    sourceRows: Record<string, SourceRow | undefined>;
    tracks: Record<string, { name?: string } | undefined>;
    animatables: Record<string, { name?: string } | undefined>;
  },
): boolean {
  const row = lookups.sourceRows[rowId];
  if (!row) return false;

  return (
    includesQuery(row.name, normalizedQuery) ||
    includesQuery(row.id, normalizedQuery) ||
    row.data.some((datum) => {
      const trackName = lookups.tracks[datum.trackId]?.name;
      const animatableName = lookups.animatables[datum.animatableId]?.name;
      return (
        includesQuery(trackName, normalizedQuery) ||
        includesQuery(animatableName, normalizedQuery) ||
        includesQuery(datum.trackId, normalizedQuery) ||
        includesQuery(datum.animatableId, normalizedQuery)
      );
    })
  );
}

function includesQuery(value: string | undefined, normalizedQuery: string): boolean {
  if (!value) return false;
  return value.toLowerCase().includes(normalizedQuery);
}
