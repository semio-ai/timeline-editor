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
  _get: AnimationStoreGetter,
): () => void {
  return api.subscribe(
    (state: AnimationData) => ({
      globalSourceTree: state.globalSourceTree,
      editorViews: state.editorViews,
    }),
    ({ globalSourceTree, editorViews }) => {
      const baseRowIds = computeVisibleSourceRowIds(globalSourceTree);
      const sourceRowIdsByView: AnimationData["sourceRowIdsByView"] = {};

      Object.values(editorViews).forEach((view) => {
        const hiddenSourceTrackIds = new Set(view.hiddenSourceTrackIds ?? []);
        const viewRows = computeVisibleSourceRowIds(globalSourceTree, { hiddenSourceTrackIds });
        sourceRowIdsByView[view.id] = normalizeVisibleSourceRowIds(viewRows);
      });

      const sourceRowIds = normalizeVisibleSourceRowIds(baseRowIds);

      set({ sourceRowIds, sourceRowIdsByView });
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
