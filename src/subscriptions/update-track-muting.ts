import { shallow } from "zustand/shallow";
import { produce } from "immer";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import { collectSourceTracks } from "../functions/source-utils";
import { computeUpdatedSources } from "../functions/compute-updated-sources";

/**
 * Ensures only one unmuted track per animatable within each namespace.
 * Additional unmuted tracks targeting the same animatable are muted.
 */
export function updateTrackMuting(
  api: AnimationApi,
  set: AnimationStoreSetter,
  _get: AnimationStoreGetter,
): () => void {
  return api.subscribe(
    (state: AnimationData) => ({
      globalSourceTree: state.globalSourceTree,
    }),
    ({ globalSourceTree }) => {
      const tracksToMute = new Set<string>();
      const unmutedByNamespace = new Map<string, Set<string>>();

      // Collect all tracks across the entire tree
      const tracks = collectSourceTracks(globalSourceTree);
      tracks.forEach((track) => {
        const animatableId = track.animatableId;
        if (!animatableId) return;
        if (track.muted) return;

        const namespaceId = track.namespaceId;
        const unmutedForNamespace = unmutedByNamespace.get(namespaceId) ?? new Set<string>();
        if (unmutedForNamespace.has(animatableId)) {
          tracksToMute.add(track.id);
        } else {
          unmutedForNamespace.add(animatableId);
          unmutedByNamespace.set(namespaceId, unmutedForNamespace);
        }
      });

      if (tracksToMute.size === 0) return;

      set(
        produce((state: AnimationData) => {
          const updates: Record<string, { muted?: boolean }> = {};
          tracksToMute.forEach((sourceId) => {
            updates[sourceId] = { muted: true };
          });
          // Update the tree in-place — computeUpdatedSources walks Source[]
          // recursively and applies updates to matching source IDs.
          state.globalSourceTree = computeUpdatedSources(state.globalSourceTree, updates);
        }),
      );
    },
    { fireImmediately: true, equalityFn: shallow },
  );
}
