import { shallow } from "zustand/shallow";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
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

function arraysEqual(left: string[], right: string[]): boolean {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) {
      return false;
    }
  }
  return true;
}

function rowLookupEqual(a: RowLookup, b: RowLookup): boolean {
  return arraysEqual(a.flat, b.flat) && arraysEqual(a.spline, b.spline);
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
): ViewAxisContext[] {
  const lookup = normalizeRowLookup(sourceRowIds);
  return Object.entries(editorViews).map(([viewId, view]) => {
    const trackRender = view.trackRender ?? TrackRender.Key;
    const preferredAxis = view.verticalAxis ?? VerticalAxis.Normalized;
    const isSplineView = trackRender === TrackRender.Spline;
    const verticalAxis = isSplineView ? preferredAxis : VerticalAxis.Normalized;
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
        const span = max - min;
        if (Number.isFinite(span) && span !== 0) {
          const pad = span * 0.125;
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
): { rows: Record<string, ComputedRowData>; changed: boolean } {
  const hasRows = rowMap && Object.keys(rowMap).length > 0;
  if (!hasRows) {
    return { rows: rowMap, changed: false };
  }

  const viewContexts = buildViewContexts(rowMap, editorViews, sourceRowIds);
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
        const span = max - min;
        if (Number.isFinite(span) && span !== 0) {
          const pad = span * 0.125;
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

export function updateViewVerticalAxes(
  api: AnimationApi,
  set: AnimationStoreSetter,
  _get: AnimationStoreGetter,
): () => void {
  return api.subscribe(
    (state: AnimationData) => ({
      computedRowData: state.computedRowData,
      editorViews: state.editorViews,
      sourceRowIds: state.sourceRowIds,
      derivedMode: state.derivedMode,
    }),
    ({ computedRowData, editorViews, sourceRowIds, derivedMode }) => {
      if (derivedMode === "snapshot") {
        return;
      }

      const { rows, changed } = projectRowVerticalAxes(computedRowData, editorViews, sourceRowIds);
      if (!changed) {
        return;
      }
      set({ computedRowData: rows });
    },
    {
      equalityFn: (a, b) =>
        rowLookupEqual(normalizeRowLookup(a.sourceRowIds), normalizeRowLookup(b.sourceRowIds)) &&
        shallow(a.editorViews, b.editorViews) &&
        shallow(a.computedRowData, b.computedRowData) &&
        a.derivedMode === b.derivedMode,
      fireImmediately: true,
    },
  );
}
