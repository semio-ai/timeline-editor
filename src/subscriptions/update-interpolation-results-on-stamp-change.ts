import { PlayerData, PlayerDirection, RawValue, usePlayerStore, getLookup } from "@semio/utils";
import { shallow } from "zustand/shallow";
import type { AnimationApi, AnimationStoreGetter, AnimationStoreSetter } from "../store-types";
import { matchingIdentityRawValue, rawValueMultiplyScalar } from "../functions";
import { parseTrackKey } from "../utils/track-key";

export function updateInterpolationResultsOnStampChange(
  _api: AnimationApi,
  _set: AnimationStoreSetter,
  get: AnimationStoreGetter,
): () => void {
  const updateValues = get().updateValues;
  const updateVelocities = get().updateVelocities;

  return usePlayerStore.subscribe(
    (state: PlayerData) => ({
      stamp: state.player.stamp,
      running: state.player.running,
      speed: state.player.speed,
      currentDirection: state.player._currentDirection,
    }),
    ({ stamp, running, currentDirection, speed }) => {
      const snapshot = get().derivedSnapshot;
      const result = new Map<string, RawValue | undefined>();
      const velocities = new Map<string, RawValue | undefined>();
      const multiplier = (currentDirection === PlayerDirection.Reverse ? -1 : 1) * speed;

      if (snapshot) {
        Object.entries(snapshot.tracks).forEach(([trackKey, track]) => {
          const { namespaceId } = parseTrackKey(trackKey);
          const animatableId = track.metadata?.animatableId;
          if (!animatableId) return;
          const lookup = getLookup(namespaceId, animatableId);

          // Handle velocity calculation from canonical derivative.
          const vel = track.canonical.derivative(stamp);
          if (vel !== undefined) {
            if (running) {
              velocities.set(lookup, rawValueMultiplyScalar(vel, multiplier));
            } else {
              velocities.set(lookup, matchingIdentityRawValue(vel));
            }
          } else {
            velocities.set(lookup, undefined);
          }

          // Handle current value from canonical interpolator.
          result.set(lookup, track.canonical.interpolator(stamp));
        });
      }
      updateValues(result);
      updateVelocities(velocities);
    },
    { equalityFn: shallow, fireImmediately: true },
  );
}
