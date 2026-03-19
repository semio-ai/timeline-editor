import type { AnimationData } from "../store-types";
import { TrackRender, VerticalAxis, VerticalAxisRange, ComputedRowData } from "../types";

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
        if (!Number.isFinite(min) || !Number.isFinite(max)) {
          min = -1;
          max = 1;
        } else if (min === max) {
          // Synthetic expansion for degenerate (constant-value) domains so that
          // downstream linear scales receive a non-zero range. This is computed
          // from canonical bounds only — stable during drag operations.
          const center = min;
          const halfSpan = Math.abs(center) > 0 ? Math.abs(center) * 0.5 : 1;
          min = center - halfSpan;
          max = center + halfSpan;
        } else {
          const pad = (max - min) * 0.125;
          min -= pad;
          max += pad;
        }
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
        if (!Number.isFinite(min) || !Number.isFinite(max)) {
          min = -1;
          max = 1;
        } else if (min === max) {
          // Synthetic expansion for degenerate (constant-value) domains so that
          // downstream linear scales receive a non-zero range. This is computed
          // from canonical bounds only — stable during drag operations.
          const center = min;
          const halfSpan = Math.abs(center) > 0 ? Math.abs(center) * 0.5 : 1;
          min = center - halfSpan;
          max = center + halfSpan;
        } else {
          const pad = (max - min) * 0.125;
          min -= pad;
          max += pad;
        }
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
