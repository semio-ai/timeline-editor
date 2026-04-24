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
  buildFilteredSourceRowId,
  isFilteredSourceRowId,
} from "../functions/view-filtered-source-row";
import { buildTrackKey } from "../utils/track-key";

/**
 * Emits per-view filtered twins of every non-filtered row in
 * `instancedTrackSources`. A twin at id `filtered:<viewId>:<rowId>` holds the
 * subset of that row's `.data` whose tracks pass the view's visibility +
 * `trackFilter`. Consumers that render view-aware aggregates (global row,
 * group rows) resolve through the twin first and fall back to the base row
 * when no twin exists — so a twin is only emitted when it actually differs
 * from the base row. Twins with no surviving entries are dropped entirely.
 */
export function updateViewFilteredSourceRows(
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
      // Surrogate signal: a fresh `global` row identity indicates that
      // `updateInstancedTrackSources` rebuilt the row table.
      instancedTrackSourcesToken: state.instancedTrackSources.global,
    }),
    ({ editorViews, sourceRowIds, sourceRowIdsByView, tracks, animatables }) => {
      const state = get();
      const sourceRows = state.instancedTrackSources;
      const normalizedRowLookup = normalizeVisibleSourceRowIds(sourceRowIds);

      interface ViewContext {
        viewId: string;
        visibleTrackKeys: Set<string>;
      }
      const viewContexts: ViewContext[] = [];

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
            visibleTrackKeys.add(
              buildTrackKey(entry.namespaceId, entry.instanceId, entry.trackId),
            );
          });
        });
        viewContexts.push({ viewId: view.id, visibleTrackKeys });
      });

      const filteredRows: Record<string, SourceRow> = {};

      Object.entries(sourceRows).forEach(([rowId, row]) => {
        if (isFilteredSourceRowId(rowId)) return;

        // Pre-compute each entry's track key once so we don't rebuild it per view.
        const entryKeys = row.data.map((entry) =>
          buildTrackKey(entry.namespaceId, entry.instanceId, entry.trackId),
        );

        viewContexts.forEach(({ viewId, visibleTrackKeys }) => {
          const filteredData = row.data.filter((_, index) =>
            visibleTrackKeys.has(entryKeys[index]),
          );
          if (filteredData.length === 0) return;
          if (filteredData.length === row.data.length) return;

          const filteredRowId = buildFilteredSourceRowId(viewId, rowId);
          filteredRows[filteredRowId] = {
            ...row,
            id: filteredRowId,
            data: filteredData,
          };
        });
      });

      const currentFilteredIds = Object.keys(sourceRows).filter(isFilteredSourceRowId);
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
        if (isFilteredSourceRowId(rowId)) return;
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
