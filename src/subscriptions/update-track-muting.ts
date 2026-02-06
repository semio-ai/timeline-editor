import { shallow } from "zustand/shallow";
import { produce } from "immer";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";

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
      namespaces: state.namespaces,
      animations: state.animations,
      tracks: state.tracks,
      tracksRevision: state.tracksRevision ?? 0,
    }),
    ({ namespaces, animations, tracks }) => {
      const tracksToMute = new Set<string>();

      Object.values(namespaces).forEach((namespace) => {
        const unmutedByAnimatable = new Set<string>();
        Object.values(namespace.animationInstances ?? {}).forEach((instance) => {
          const animation = animations[instance.animationId];
          if (!animation) return;

          animation.tracks.forEach((trackId) => {
            const track = tracks[trackId];
            if (!track) return;
            const animatableId = track.animatableId;
            if (!animatableId) return;

            const isMuted = track.settings?.muted ?? false;
            if (isMuted) return;

            if (unmutedByAnimatable.has(animatableId)) {
              tracksToMute.add(trackId);
            } else {
              unmutedByAnimatable.add(animatableId);
            }
          });
        });
      });

      if (tracksToMute.size === 0) return;

      set(
        produce((state: AnimationData) => {
          tracksToMute.forEach((trackId) => {
            const track = state.tracks[trackId];
            if (!track) return;
            if (!track.settings) {
              track.settings = {};
            }
            track.settings.muted = true;
          });
          state.tracksRevision = (state.tracksRevision ?? 0) + 1;
        }),
      );
    },
    { fireImmediately: true, equalityFn: shallow },
  );
}
