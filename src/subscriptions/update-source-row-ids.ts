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
 * Updates sourceRowIds when sourcesByAnimationInstance changes.
 * This handles updating the list of visible rows when groups are expanded/collapsed.
 */
export function updateSourceRowIds(
  api: AnimationApi,
  set: AnimationStoreSetter,
  _get: AnimationStoreGetter,
): () => void {
  return api.subscribe(
    (state: AnimationData) => ({
      sourcesByAnimationInstance: state.sourcesByAnimationInstance,
      editorViews: state.editorViews,
    }),
    ({ sourcesByAnimationInstance, editorViews }) => {
      const baseRowIds = { flat: [] as string[], spline: [] as string[] };
      const sourceRowIdsByView: AnimationData["sourceRowIdsByView"] = {};

      Object.values(sourcesByAnimationInstance).forEach((sources) => {
        const visibleIds = computeVisibleSourceRowIds(sources);
        baseRowIds.flat.push(...visibleIds.flat);
        baseRowIds.spline.push(...visibleIds.spline);
      });

      Object.values(editorViews).forEach((view) => {
        const hiddenSourceTrackIds = new Set(view.hiddenSourceTrackIds ?? []);
        const viewRows = { flat: [] as string[], spline: [] as string[] };
        Object.values(sourcesByAnimationInstance).forEach((sources) => {
          const visibleIds = computeVisibleSourceRowIds(sources, { hiddenSourceTrackIds });
          viewRows.flat.push(...visibleIds.flat);
          viewRows.spline.push(...visibleIds.spline);
        });

        sourceRowIdsByView[view.id] = normalizeVisibleSourceRowIds(viewRows);
      });

      const sourceRowIds = normalizeVisibleSourceRowIds(baseRowIds);

      set({ sourceRowIds, sourceRowIdsByView });
    },
    {
      equalityFn: (current, previous) => {
        return (
          shallow(current.sourcesByAnimationInstance, previous.sourcesByAnimationInstance) &&
          shallow(current.editorViews, previous.editorViews)
        );
      },
      fireImmediately: true,
    },
  );
}
