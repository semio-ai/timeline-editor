import { shallow } from "zustand/shallow";
import { isEqual } from "lodash";
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
      globalSourceTree: state.globalSourceTree,
      activeInstanceId: state.selectionState.instanceId,
      keySelection: state.selectionState.keypoints,
    }),
    ({ globalSourceTree, activeInstanceId, keySelection }) => {
      // Compute a single consolidated source row from the full tree
      const allSources = globalSourceTree;

      if (allSources.length === 0) {
        // No sources available, remove global entry
        set((state) => {
          const { global: _, ...rest } = state.instancedTrackSources;
          return { instancedTrackSources: rest };
        });
        return;
      }

      const selectedTrackIds = new Set<string>();
      const registerSelectionKey = (key: string) => {
        if (!key) return;
        selectedTrackIds.add(key);
        const tail = key.split("/").pop();
        if (tail) {
          selectedTrackIds.add(tail);
          const base = tail.split(".")[0];
          if (base) {
            selectedTrackIds.add(base);
          }
        }
      };

      keySelection.forEach((keypoints, trackKey) => {
        if (keypoints && keypoints.size > 0) {
          registerSelectionKey(trackKey);
        }
      });

      const consolidated = computeConsolidatedSourceRow(
        allSources,
        activeInstanceId ?? null,
        selectedTrackIds,
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
      equalityFn: (a, b) => {
        const signature = (selection: AnimationData["selectionState"]["keypoints"]) =>
          Array.from(selection.entries())
            .map(([trackKey, ids]) => ({
              trackKey,
              ids: Array.from(ids).sort(),
            }))
            .sort((left, right) => left.trackKey.localeCompare(right.trackKey));

        return (
          a.globalSourceTree === b.globalSourceTree &&
          a.activeInstanceId === b.activeInstanceId &&
          isEqual(signature(a.keySelection), signature(b.keySelection))
        );
      },
      fireImmediately: true,
    },
  );
}
