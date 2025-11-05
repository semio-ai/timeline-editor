import { shallow } from "zustand/shallow";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import { ComputedRowData } from "../types";
import { computeRowData } from "../functions/compute-row-data";
import { logDerivedEvent } from "../utils/derived-debug";

export function updateComputedRowData(
  api: AnimationApi,
  set: AnimationStoreSetter,
  _get: AnimationStoreGetter,
): () => void {
  return api.subscribe(
    (state: AnimationData) => ({
      dragState: state.dragState,
      selectionState: state.selectionState,
      violations: state.violations,
      tracks: state.tracks,
      instancedTrackSources: state.instancedTrackSources,
      animatables: state.animatables,
      animations: state.animations,
      namespaces: state.namespaces,
    }),
    ({
      dragState,
      selectionState,
      violations,
      tracks,
      instancedTrackSources,
      animatables,
      animations,
      namespaces,
    }) => {
      logDerivedEvent("updateComputedRowData", "start", () => ({
        dragActive: Boolean(dragState),
        selectionTracks: selectionState.keypoints.size,
        rowCount: Object.keys(instancedTrackSources).length,
        violationTrackCount: Object.keys(violations).length,
      }));

      const computedRowData: Record<string, ComputedRowData> = {};

      Object.values(instancedTrackSources).forEach((instancedTrackSource) => {
        const rowComputedData = computeRowData(
          instancedTrackSource,
          tracks,
          violations,
          animatables,
          dragState,
          selectionState,
          {
            animations,
            namespaces,
          },
        );
        computedRowData[instancedTrackSource.id] = rowComputedData;
      });

      set({ computedRowData });

      logDerivedEvent("updateComputedRowData", "end", () => ({
        dragActive: Boolean(api.getState().dragState),
        rowCount: Object.keys(computedRowData).length,
      }));
    },
    {
      equalityFn: (a, b) => {
        return (
          shallow(a.dragState, b.dragState) &&
          shallow(a.selectionState, b.selectionState) &&
          shallow(a.violations, b.violations) &&
          shallow(a.tracks, b.tracks) &&
          shallow(a.instancedTrackSources, b.instancedTrackSources) &&
          shallow(a.animatables, b.animatables) &&
          shallow(a.animations, b.animations) &&
          shallow(a.namespaces, b.namespaces)
        );
      },
      fireImmediately: true,
    },
  );
}
