import { shallow } from "zustand/shallow";
import { isEqual } from "lodash";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import { Source } from "../types";
import { computeDefaultSourcesFromInstance } from "../functions";

/**
 * Updates global sources when namespaces, animations, tracks, or animatables change.
 * This maintains a single source of truth for all views.
 */
export function updateGlobalSources(
  api: AnimationApi,
  set: AnimationStoreSetter,
  _get: AnimationStoreGetter,
): () => void {
  return api.subscribe(
    (state: AnimationData) => ({
      namespaces: state.namespaces,
      animations: state.animations,
      tracks: state.tracks,
      animatables: state.animatables,
    }),
    ({ namespaces, animations, tracks, animatables }) => {
      // Generate global sources for all animation instances across all namespaces
      const sourcesByAnimationInstance: Record<string, Source[]> = {};

      const namespaceKeys = Object.keys(namespaces);

      for (const namespace of namespaceKeys) {
        const animationInstances = Object.values(namespaces[namespace].animationInstances);
        for (const animationInstance of animationInstances) {
          const sources = computeDefaultSourcesFromInstance(
            namespace,
            animationInstance,
            animations,
            animatables,
            tracks,
          );

          sourcesByAnimationInstance[animationInstance.id] = sources;
        }
      }

      set({
        sourcesByAnimationInstance,
      });
    },
    {
      equalityFn: (current, previous) => {
        // Check if the structure of namespaces/animations/tracks has changed
        const allCurrentTracks = new Set(
          Object.values(current.animations).flatMap((a) => a.tracks),
        );
        const allPreviousTracks = new Set(
          Object.values(previous.animations).flatMap((a) => a.tracks),
        );

        // Check if animation IDs have changed
        const currentAnimationIds = new Set(Object.keys(current.animations));
        const previousAnimationIds = new Set(Object.keys(previous.animations));

        return (
          isEqual(allCurrentTracks, allPreviousTracks) &&
          isEqual(currentAnimationIds, previousAnimationIds) &&
          shallow(current.namespaces, previous.namespaces) &&
          shallow(current.animatables, previous.animatables)
        );
      },
      fireImmediately: true,
    },
  );
}
