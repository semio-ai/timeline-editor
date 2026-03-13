import { isEqual } from "lodash";
import { shallow } from "zustand/shallow";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import type { SourceRow } from "../types";
import {
  filterVisibleSourceRowIds,
  matchesSourceRowQuery,
  normalizeVisibleSourceRowIds,
} from "../functions/filter-visible-source-row-ids";
import {
  buildFilteredGlobalRowId,
  isFilteredGlobalRowId,
} from "../functions/view-filtered-global-row";
import { buildTrackKey } from "../utils/track-key";

export function updateViewFilteredGlobalRows(
  api: AnimationApi,
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
): () => void {
  return api.subscribe(
    (state: AnimationData) => ({
      editorViews: state.editorViews,
      sourceRowIds: state.sourceRowIds,
      sourceRowIdsByView: state.sourceRowIdsByView,
      tracks: state.tracks,
      animatables: state.animatables,
      globalRow: state.instancedTrackSources.global,
    }),
    ({ editorViews, sourceRowIds, sourceRowIdsByView, tracks, animatables, globalRow }) => {
      const state = get();
      const sourceRows = state.instancedTrackSources;
      const normalizedRowLookup = normalizeVisibleSourceRowIds(sourceRowIds);
      const baseGlobal: SourceRow = globalRow ?? { id: "global", data: [] };

      const filteredRows: Record<string, SourceRow> = {};

      Object.values(editorViews).forEach((view) => {
        const viewRowLookup = normalizeVisibleSourceRowIds(
          sourceRowIdsByView[view.id] ?? normalizedRowLookup,
        );
        const query = view.trackFilter?.trim();
        const filteredLookup = query
          ? filterVisibleSourceRowIds(viewRowLookup, query, (rowId, normalizedQuery) =>
              matchesSourceRowQuery(rowId, normalizedQuery, {
                sourceRows,
                tracks,
                animatables,
              }),
            )
          : viewRowLookup;

        const visibleTrackKeys = new Set<string>();
        filteredLookup.spline.forEach((rowId) => {
          const row = sourceRows[rowId];
          if (!row) return;
          row.data.forEach((entry) => {
            visibleTrackKeys.add(buildTrackKey(entry.namespaceId, entry.instanceId, entry.trackId));
          });
        });

        const filteredRowId = buildFilteredGlobalRowId(view.id);
        filteredRows[filteredRowId] = {
          ...baseGlobal,
          id: filteredRowId,
          data: baseGlobal.data.filter((entry) =>
            visibleTrackKeys.has(buildTrackKey(entry.namespaceId, entry.instanceId, entry.trackId)),
          ),
        };
      });

      const currentFilteredIds = Object.keys(sourceRows).filter(isFilteredGlobalRowId);
      const nextFilteredIds = Object.keys(filteredRows);
      const filteredRowsChanged =
        currentFilteredIds.length !== nextFilteredIds.length ||
        currentFilteredIds.some((rowId) => !filteredRows[rowId]) ||
        nextFilteredIds.some((rowId) => !isEqual(sourceRows[rowId], filteredRows[rowId]));

      if (!filteredRowsChanged) {
        return;
      }

      const nextSourceRows: Record<string, SourceRow> = {};
      Object.entries(sourceRows).forEach(([rowId, row]) => {
        if (isFilteredGlobalRowId(rowId)) return;
        nextSourceRows[rowId] = row;
      });
      Object.assign(nextSourceRows, filteredRows);
      set({ instancedTrackSources: nextSourceRows });
    },
    {
      equalityFn: shallow,
      fireImmediately: true,
    },
  );
}
