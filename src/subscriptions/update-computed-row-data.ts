import { shallow } from "zustand/shallow";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import { ComputedRowData, TrackKey } from "../types";
import { buildDerivedSnapshot } from "../functions";
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
      tracks: state.tracks,
      instancedTrackSources: state.instancedTrackSources,
      animatables: state.animatables,
      animations: state.animations,
      namespaces: state.namespaces,
    }),
    ({
      dragState,
      selectionState,
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
      }));

      const snapshotVersion = (api.getState().derivedSnapshot?.version ?? 0) + 1;
      const snapshot = buildDerivedSnapshot({
        tracks,
        namespaces,
        animations,
        animatables,
        instancedTrackSources,
        dragState,
        selectionState,
        version: snapshotVersion,
      });

      const computedRowData: Record<string, ComputedRowData> = {};
      Object.entries(snapshot.rows).forEach(([rowId, row]) => {
        computedRowData[rowId] = row.computed;
      });

      const canonicalViolations: AnimationData["violations"] = {};
      Object.keys(snapshot.tracks).forEach((key) => {
        const trackKey = key as TrackKey;
        canonicalViolations[trackKey] = snapshot.tracks[trackKey].canonical.violations;
      });

      set({
        derivedSnapshot: snapshot,
        computedRowData,
        violations: canonicalViolations,
      });

      logDerivedEvent("updateComputedRowData", "end", () => ({
        dragActive: Boolean(api.getState().dragState),
        rowCount: Object.keys(computedRowData).length,
        version: snapshot.version,
      }));
    },
    {
      equalityFn: (a, b) => {
        return (
          shallow(a.dragState, b.dragState) &&
          shallow(a.selectionState, b.selectionState) &&
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
