import { PlayerData, PlayerDirection, RawValue, usePlayerStore } from "@semio/utils";
import { shallow } from "zustand/shallow";
import type { AnimationApi, AnimationStoreGetter, AnimationStoreSetter } from "../store-types";
import { matchingIdentityRawValue, rawValueMultiplyScalar } from "../functions";
import { resolveTrackInterpolators } from "../utils/resolve-track-interpolator";

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
      const trackInterpolators = resolveTrackInterpolators(get());
      const result = new Map<string, RawValue | undefined>();
      const velocities = new Map<string, RawValue | undefined>();
      const multiplier = (currentDirection === PlayerDirection.Reverse ? -1 : 1) * speed;

      Object.entries(trackInterpolators).forEach(([key, interpolatorCollection]) => {
        // Handle velocity calculation.
        const vel = interpolatorCollection.derivative(stamp);
        if (vel !== undefined) {
          if (running) {
            velocities.set(key, rawValueMultiplyScalar(vel, multiplier));
          } else {
            const stoppedVel = matchingIdentityRawValue(vel);
            velocities.set(key, stoppedVel);
          }
        } else {
          velocities.set(key, undefined);
        }
        // Handle the value calculation.
        result.set(key, interpolatorCollection.value(stamp));
      });
      updateValues(result);
      updateVelocities(velocities);
    },
    { equalityFn: shallow, fireImmediately: true },
  );
}
