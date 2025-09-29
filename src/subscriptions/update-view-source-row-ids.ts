import { shallow } from "zustand/shallow";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import { computeSourceRowsFromSources } from "../functions";

/**
 * Updates sourceRowIds in editorViews when the underlying sources change.
 * This is separated from updateViewTrackSources to avoid circular dependencies.
 */
export function updateViewSourceRowIds(
  api: AnimationApi,
  set: AnimationStoreSetter,
  _get: AnimationStoreGetter,
): () => void {
  return api.subscribe(
    (state: AnimationData) => {
      // Extract only the sourcesByAnimationInstance from each view
      // This avoids subscribing to sourceRowIds itself
      const viewSources: Record<string, Record<string, unknown>> = {};
      Object.entries(state.editorViews).forEach(([viewId, view]) => {
        viewSources[viewId] = view.sourcesByAnimationInstance;
      });
      return viewSources;
    },
    (viewSources) => {
      // Compute the new sourceRowIds for each view
      const updates: Record<string, string[]> = {};

      Object.entries(viewSources).forEach(([viewId, sourcesByAnimationInstance]) => {
        const sourceRowIds: string[] = [];
        Object.values(sourcesByAnimationInstance).forEach((sources: any) => {
          const sourceRows = computeSourceRowsFromSources(sources);
          sourceRows.forEach((sourceRow) => sourceRowIds.push(sourceRow.id));
        });
        updates[viewId] = sourceRowIds;
      });

      // Update only the sourceRowIds in each view
      set((state) => {
        const updatedViews = { ...state.editorViews };
        Object.entries(updates).forEach(([viewId, sourceRowIds]) => {
          if (updatedViews[viewId]) {
            updatedViews[viewId] = {
              ...updatedViews[viewId],
              sourceRowIds,
            };
          }
        });
        return { editorViews: updatedViews };
      });
    },
    {
      equalityFn: (a, b) => {
        // Compare the sourcesByAnimationInstance for each view
        const viewIds = new Set([...Object.keys(a), ...Object.keys(b)]);
        for (const viewId of viewIds) {
          if (!shallow(a[viewId], b[viewId])) {
            return false;
          }
        }
        return true;
      },
    },
  );
}
