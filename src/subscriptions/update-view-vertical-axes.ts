import type { AnimationData } from "../store-types";
import { TrackRender, VerticalAxis, VerticalAxisRange, ComputedRowData } from "../types";

/**
 * Expand a spline-view vertical range with padding, enforcing a minimum span
 * so that near-flat value ranges don't get stretched into exaggerated steps.
 * For degenerate (zero-span) ranges, creates a synthetic expansion. For
 * non-finite inputs, falls back to [-1, 1].
 */
function expandSplineRange(rawMin: number, rawMax: number): [number, number] {
  if (!Number.isFinite(rawMin) || !Number.isFinite(rawMax)) {
    return [-1, 1];
  }

  let min = rawMin;
  let max = rawMax;
  const span = max - min;

  if (span === 0) {
    // Degenerate: create a synthetic range around the constant value.
    const center = min;
    const halfSpan = Math.abs(center) > 0 ? Math.abs(center) * 0.5 : 1;
    min = center - halfSpan;
    max = center + halfSpan;
  } else {
    // Enforce a minimum visible span so near-flat sections render as flat
    // rather than being stretched into step-like artifacts. The threshold
    // is relative to the magnitude of the values (or absolute 1e-2 at zero).
    const center = (min + max) / 2;
    const minSpan = Math.max(Math.abs(center) * 0.01, 1e-2);
    if (span < minSpan) {
      const halfMin = minSpan / 2;
      min = center - halfMin;
      max = center + halfMin;
    }

    const pad = (max - min) * 0.125;
    min -= pad;
    max += pad;
  }

  return [min, max];
}

interface RowLookup {
  flat: string[];
  spline: string[];
}

function normalizeRowLookup(rowIds: AnimationData["sourceRowIds"] | undefined): RowLookup {
  if (!rowIds) {
    return { flat: [], spline: [] };
  }
  if (Array.isArray(rowIds)) {
    return { flat: rowIds, spline: rowIds };
  }
  return rowIds;
}

interface ViewAxisContext {
  viewId: string;
  verticalAxis: VerticalAxis;
  rowIds: string[];
  rowSet: Set<string>;
  isSplineView: boolean;
  uniformRange?: VerticalAxisRange;
}

function buildViewContexts(
  rowMap: Record<string, ComputedRowData>,
  editorViews: AnimationData["editorViews"],
  sourceRowIds: AnimationData["sourceRowIds"],
  sourceRowIdsByView: AnimationData["sourceRowIdsByView"],
): ViewAxisContext[] {
  return Object.entries(editorViews).map(([viewId, view]) => {
    const trackRender = view.trackRender ?? TrackRender.Key;
    const preferredAxis = view.verticalAxis ?? VerticalAxis.Normalized;
    const isSplineView = trackRender === TrackRender.Spline;
    const verticalAxis = isSplineView ? preferredAxis : VerticalAxis.Normalized;
    const lookup = normalizeRowLookup(sourceRowIdsByView[viewId] ?? sourceRowIds);
    const rowIds = isSplineView ? lookup.spline : lookup.flat;
    const rowSet = new Set(rowIds);

    let uniformRange: VerticalAxisRange | undefined;
    if (verticalAxis === VerticalAxis.Uniform) {
      let min = Number.POSITIVE_INFINITY;
      let max = Number.NEGATIVE_INFINITY;

      rowIds.forEach((rowId) => {
        const row = rowMap[rowId];
        if (!row) return;
        min = Math.min(min, row.verticalBounds.min);
        max = Math.max(max, row.verticalBounds.max);
      });

      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        min = -1;
        max = 1;
      }

      if (isSplineView) {
        [min, max] = expandSplineRange(min, max);
      }

      uniformRange = { min, max, visualOffset: 0 };
    }

    return {
      viewId,
      verticalAxis,
      rowIds,
      rowSet,
      isSplineView,
      uniformRange,
    };
  });
}

export function projectRowVerticalAxes(
  rowMap: Record<string, ComputedRowData>,
  editorViews: AnimationData["editorViews"],
  sourceRowIds: AnimationData["sourceRowIds"],
  sourceRowIdsByView: AnimationData["sourceRowIdsByView"],
): { rows: Record<string, ComputedRowData>; changed: boolean } {
  const hasRows = rowMap && Object.keys(rowMap).length > 0;
  if (!hasRows) {
    return { rows: rowMap, changed: false };
  }

  const viewContexts = buildViewContexts(rowMap, editorViews, sourceRowIds, sourceRowIdsByView);
  const result: Record<string, ComputedRowData> = {};

  if (viewContexts.length === 0) {
    let changed = false;
    Object.entries(rowMap).forEach(([rowId, row]) => {
      if (row.verticalAxisByView && Object.keys(row.verticalAxisByView).length > 0) {
        result[rowId] = { ...row, verticalAxisByView: undefined };
        changed = true;
      } else {
        result[rowId] = row;
      }
    });
    return { rows: result, changed };
  }

  let anyChanges = false;

  Object.entries(rowMap).forEach(([rowId, row]) => {
    let rowChanged = false;
    const nextAxisByView: Record<string, VerticalAxisRange> = {};

    viewContexts.forEach((context) => {
      if (!context.rowSet.has(rowId)) return;

      let min = row.verticalBounds.min;
      let max = row.verticalBounds.max;
      if (context.isSplineView) {
        [min, max] = expandSplineRange(min, max);
      }

      const range =
        context.verticalAxis === VerticalAxis.Uniform && context.uniformRange
          ? { ...context.uniformRange }
          : {
              min,
              max,
              visualOffset: 0,
            };

      const previous = row.verticalAxisByView?.[context.viewId];
      nextAxisByView[context.viewId] = range;

      if (
        !previous ||
        previous.min !== range.min ||
        previous.max !== range.max ||
        (previous.visualOffset ?? 0) !== (range.visualOffset ?? 0)
      ) {
        rowChanged = true;
      }
    });

    if (row.verticalAxisByView) {
      Object.keys(row.verticalAxisByView).forEach((viewId) => {
        if (!(viewId in nextAxisByView)) {
          rowChanged = true;
        }
      });
    }

    if (rowChanged) {
      result[rowId] = {
        ...row,
        verticalAxisByView: Object.keys(nextAxisByView).length > 0 ? nextAxisByView : undefined,
      };
      anyChanges = true;
    } else {
      result[rowId] = row;
    }
  });

  return { rows: result, changed: anyChanges };
}
