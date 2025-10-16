import { shallow } from "zustand/shallow";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import { computeConsolidatedSourceRow } from "../functions";

export function updateConsolidatedSourceRow(
  api: AnimationApi,
  set: AnimationStoreSetter,
  _get: AnimationStoreGetter,
): () => void {
  return api.subscribe(
    (state: AnimationData) => ({
      sourcesByAnimationInstance: state.sourcesByAnimationInstance,
      activeInstanceId: state.selectionState.instanceId,
    }),
    ({ sourcesByAnimationInstance, activeInstanceId }) => {
      // Compute a single consolidated source row for all views
      const allSources = Object.values(sourcesByAnimationInstance).flat();

      if (allSources.length === 0) {
        // No sources available, remove global entry
        set((state) => {
          const { global: _, ...rest } = state.instancedTrackSources;
          return { instancedTrackSources: rest };
        });
        return;
      }

      const consolidated = computeConsolidatedSourceRow(
        allSources,
        activeInstanceId ?? undefined,
        "global",
      );

      set((state) => ({
        instancedTrackSources: {
          ...state.instancedTrackSources,
          global: consolidated,
        },
      }));
    },
    {
      equalityFn: (a, b) =>
        shallow(a.sourcesByAnimationInstance, b.sourcesByAnimationInstance) &&
        a.activeInstanceId === b.activeInstanceId,
      fireImmediately: true,
    },
  );
}
