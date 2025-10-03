import { shallow } from "zustand/shallow";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import { computeVisibleSourceRowIds } from "../functions";

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
    }),
    ({ sourcesByAnimationInstance }) => {
      const sourceRowIds: string[] = [];

      // Compute visible row IDs from all animation instances
      Object.values(sourcesByAnimationInstance).forEach((sources) => {
        const visibleIds = computeVisibleSourceRowIds(sources);
        visibleIds.forEach((id) => sourceRowIds.push(id));
      });

      set({ sourceRowIds });
    },
    {
      equalityFn: (current, previous) => {
        return shallow(current.sourcesByAnimationInstance, previous.sourcesByAnimationInstance);
      },
      fireImmediately: true,
    },
  );
}
