import { shallow } from "zustand/shallow";
import { isEqual } from "lodash";
import { AnimationData, AnimationStoreGetter, AnimationStoreSetter } from "../store-types";
import { AnimationApi } from "../store";
import { AnimationInstance, Animation } from "../types";
import { updateTrackInterpolatorsAndResults } from "./update-track-interpolators-and-results";

export function updateAllInterpolatorsAndResultsOnDataChange(
  api: AnimationApi,
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
): () => void {
  return api.subscribe(
    (state: AnimationData) => ({
      namespaceInfo: state.namespaceInfo,
      animations: state.animations,
      subscribes: state.trackSubscribers,
    }),
    ({ namespaceInfo, animations, subscribes }) => {
      // Clear the previous subscriptions for each track
      subscribes.forEach((trackUnsub) => {
        trackUnsub();
      });
      // console.log(namespaceInfo, animations, subscribes);
      // for each namespace -> for each instance -> for each track in the instance's aninimation subscribe... to namespace/track
      if (!namespaceInfo) return;

      const namespaceTrackPairs: [string, string, number, AnimationInstance][] = [];
      Object.entries(namespaceInfo).forEach(([namespace, instances]) => {
        Object.entries(instances).forEach(([_instanceId, instance]) => {
          const animation = animations[instance.animationId];
          if (animation) {
            animation.tracks.forEach((trackId) => {
              namespaceTrackPairs.push([namespace, trackId, animation.duration, instance]);
            });
          }
        });
      });

      const newSubscribes = namespaceTrackPairs.map(([namespace, trackId, duration, instance]) => {
        return updateTrackInterpolatorsAndResults(
          api,
          set,
          get,
          trackId,
          namespace,
          duration,
          instance,
        );
      });

      set({ trackSubscribers: newSubscribes });
    },
    {
      equalityFn: (current: AnimationsAndSubscribes, previous: AnimationsAndSubscribes) => {
        // We only care about cases where the individual track ids change across all animations
        const allCurrent = new Set(Object.values(current.animations).map((a) => a.tracks));
        const allPrevious = new Set(Object.values(previous.animations).map((a) => a.tracks));
        return (
          isEqual(allCurrent, allPrevious) &&
          shallow(current.namespaceInfo, previous.namespaceInfo) &&
          isEqual(current.subscribes.length, previous.subscribes.length)
        );
      },
    },
  );
}

interface AnimationsAndSubscribes {
  namespaceInfo: Record<string, Record<string, AnimationInstance>>;
  animations: Record<string, Animation>;
  subscribes: (() => void)[];
}
