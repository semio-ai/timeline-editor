import { shallow } from "zustand/shallow";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import { ComputedRowData } from "../types";
import { computeRowData } from "../functions/compute-row-data";

export function updateComputedRowData(
  api: AnimationApi,
  set: AnimationStoreSetter,
  _get: AnimationStoreGetter,
): () => void {
  return api.subscribe(
    (state: AnimationData) => ({
      dragState: state.dragState,
      violations: state.violations,
      tracks: state.tracks,
      instancedTrackSources: state.instancedTrackSources,
      animatables: state.animatables,
    }),
    ({ dragState, violations, tracks, instancedTrackSources, animatables }) => {
      const computedRowData: Record<string, ComputedRowData> = {};

      Object.values(instancedTrackSources).forEach((instancedTrackSource) => {
        const rowComputedData = computeRowData(
          instancedTrackSource,
          tracks,
          violations,
          animatables,
          dragState,
        );
        computedRowData[instancedTrackSource.id] = rowComputedData;
      });

      set({ computedRowData });
    },
    {
      equalityFn: (a, b) => {
        return (
          shallow(a.dragState, b.dragState) &&
          shallow(a.violations, b.violations) &&
          shallow(a.tracks, b.tracks) &&
          shallow(a.instancedTrackSources, b.instancedTrackSources) &&
          shallow(a.animatables, b.animatables)
        );
      },
      fireImmediately: true,
    },
  );
}
