import { shallow } from "zustand/shallow";
import {
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
      derivedSnapshot: state.derivedSnapshot,
    }),
    ({ computedRowData, editorViews, sourceRowIds, derivedMode, derivedSnapshot }) => {
      const rowMap: Record<string, ComputedRowData> =
        derivedMode === "snapshot" && derivedSnapshot
          ? Object.fromEntries(
              Object.entries(derivedSnapshot.rows).map(([rowId, row]) => [rowId, row.computed]),
            )
          : computedRowData;

      const hasRows = rowMap && Object.keys(rowMap).length > 0;
      if (!hasRows) return;

      const lookup = normalizeRowLookup(sourceRowIds);

      const viewContexts: ViewAxisContext[] = Object.entries(editorViews).map(([viewId, view]) => {
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

          // Apply symmetric padding for spline views so plotted values occupy ~80% of the visual height.
          if (isSplineView) {
            const span = max - min;
            if (Number.isFinite(span) && span !== 0) {
              const pad = span * 0.125; // 12.5% per side → 25% total expansion
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

      if (viewContexts.length === 0) {
        // Nothing to update but ensure we clear stale maps if necessary.
        let hasAnyVerticalMaps = false;
        Object.values(rowMap).forEach((row) => {
          if (row.verticalAxisByView && Object.keys(row.verticalAxisByView).length > 0) {
            hasAnyVerticalMaps = true;
          }
        });
        if (!hasAnyVerticalMaps) {
          return;
        }
        const clearedData: Record<string, ComputedRowData> = {};
        Object.entries(rowMap).forEach(([rowId, row]) => {
          if (row.verticalAxisByView && Object.keys(row.verticalAxisByView).length > 0) {
            clearedData[rowId] = { ...row, verticalAxisByView: undefined };
          } else {
            clearedData[rowId] = row;
          }
        });
        set({ computedRowData: clearedData });
        return;
      }

      const updates: Record<string, ComputedRowData> = {};
      let anyChanges = false;

      Object.entries(rowMap).forEach(([rowId, row]) => {
        let rowChanged = false;
        const nextAxisByView: Record<string, VerticalAxisRange> = {};

        viewContexts.forEach((context) => {
          if (!context.rowSet.has(rowId)) {
            return;
          }

          // Base per-row bounds with optional symmetric padding for spline views.
          let min = row.verticalBounds.min;
          let max = row.verticalBounds.max;
          if (context.isSplineView) {
            const span = max - min;
            if (Number.isFinite(span) && span !== 0) {
              const pad = span * 0.125; // 12.5% per side → 25% total expansion
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
          updates[rowId] = {
            ...row,
            verticalAxisByView: Object.keys(nextAxisByView).length > 0 ? nextAxisByView : undefined,
          };
          anyChanges = true;
        }
      });

      if (anyChanges) {
        set((state: AnimationData) => {
          const mergedComputed = { ...state.computedRowData };
          Object.entries(updates).forEach(([rowId, row]) => {
            mergedComputed[rowId] = row;
          });

          let nextSnapshot = state.derivedSnapshot;
          if (state.derivedMode === "snapshot" && state.derivedSnapshot) {
            const updatedRows = { ...state.derivedSnapshot.rows };
            Object.entries(updates).forEach(([rowId, row]) => {
              const existing = state.derivedSnapshot?.rows[rowId];
              if (!existing) return;
              updatedRows[rowId] = {
                ...existing,
                computed: row,
              };
            });
            nextSnapshot = {
              ...state.derivedSnapshot,
              rows: updatedRows,
            };
          }

          const result: Partial<AnimationData> = {
            computedRowData: mergedComputed,
          };
          if (nextSnapshot !== state.derivedSnapshot) {
            result.derivedSnapshot = nextSnapshot;
          }

          return result;
        });
      }
    },
    {
      equalityFn: (a, b) =>
        a.computedRowData === b.computedRowData &&
        shallow(a.editorViews, b.editorViews) &&
        rowLookupEqual(normalizeRowLookup(a.sourceRowIds), normalizeRowLookup(b.sourceRowIds)),
      fireImmediately: true,
    },
  );
}
