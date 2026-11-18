import { isEqual } from "lodash";
import { shallow } from "zustand/shallow";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import { computeVisibleSourceRowIds } from "../functions";
import { normalizeVisibleSourceRowIds } from "../functions/filter-visible-source-row-ids";

/**
 * Updates sourceRowIds when globalSourceTree changes.
 * Walks the full tree (including entity/instance groups) to compute
 * visible row IDs, respecting group expanded/collapsed state.
 */
export function updateSourceRowIds(
  api: AnimationApi,
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
): () => void {
  return api.subscribe(
    (state: AnimationData) => ({
      globalSourceTree: state.globalSourceTree,
      editorViews: state.editorViews,
    }),
    ({ globalSourceTree, editorViews }) => {
      const current = get();
      const baseRowIds = computeVisibleSourceRowIds(globalSourceTree);
      const sourceRowIdsByView: AnimationData["sourceRowIdsByView"] = {};

      // Ids whose content is unchanged keep their objects, so a write that
      // leaves the visible rows as they were changes no derived input.
      Object.values(editorViews).forEach((view) => {
        const hiddenSourceTrackIds = new Set(view.hiddenSourceTrackIds ?? []);
        const viewRows = computeVisibleSourceRowIds(globalSourceTree, { hiddenSourceTrackIds });
        const next = normalizeVisibleSourceRowIds(viewRows);
        const previous = current.sourceRowIdsByView?.[view.id];
        sourceRowIdsByView[view.id] = previous && isEqual(previous, next) ? previous : next;
      });
      const byViewUnchanged =
        current.sourceRowIdsByView !== undefined &&
        shallow(current.sourceRowIdsByView, sourceRowIdsByView);

      const nextRowIds = normalizeVisibleSourceRowIds(baseRowIds);
      const rowIdsUnchanged =
        current.sourceRowIds !== undefined && isEqual(current.sourceRowIds, nextRowIds);
      if (rowIdsUnchanged && byViewUnchanged) return;

      set({
        sourceRowIds: rowIdsUnchanged ? current.sourceRowIds : nextRowIds,
        sourceRowIdsByView: byViewUnchanged ? current.sourceRowIdsByView : sourceRowIdsByView,
      });
    },
    {
      equalityFn: (current, previous) => {
        return (
          current.globalSourceTree === previous.globalSourceTree &&
          shallow(current.editorViews, previous.editorViews)
        );
      },
      fireImmediately: true,
    },
  );
}
