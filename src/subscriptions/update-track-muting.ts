import { shallow } from "zustand/shallow";
import { produce } from "immer";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import { computeUpdatedSources } from "../functions/compute-updated-sources";
import { collectSourceTracks } from "../functions/source-utils";

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
      sourcesByAnimationInstance: state.sourcesByAnimationInstance,
    }),
    ({ sourcesByAnimationInstance }) => {
      const tracksToMute = new Set<string>();
      const unmutedByNamespace = new Map<string, Set<string>>();

      Object.values(sourcesByAnimationInstance).forEach((sources) => {
        const tracks = collectSourceTracks(sources);
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
      });

      if (tracksToMute.size === 0) return;

      set(
        produce((state: AnimationData) => {
          const updates: Record<string, { muted?: boolean }> = {};
          tracksToMute.forEach((sourceId) => {
            updates[sourceId] = { muted: true };
          });
          const nextSourcesByInstance: Record<
            string,
            AnimationData["sourcesByAnimationInstance"][string]
          > = {};
          Object.entries(state.sourcesByAnimationInstance).forEach(([instanceId, sources]) => {
            nextSourcesByInstance[instanceId] = computeUpdatedSources(sources, updates);
          });
          state.sourcesByAnimationInstance = nextSourcesByInstance;
        }),
      );
    },
    { fireImmediately: true, equalityFn: shallow },
  );
}
