import { getLookup, PlayerDirection, RawValue, usePlayerStore } from "@semio/utils";
import { shallow } from "zustand/shallow";
import { AnimationData, AnimationStoreGetter, AnimationStoreSetter } from "../store-types";
import { AnimationApi } from "../store";
import {
  computeTrackInterpolator,
  computeTrackViolations,
  matchingIdentityRawValue,
  rawValueMultiplyScalar,
} from "../functions";
import { AnimationInstance, Violation } from "../types";
import { computeDerivativeInterpolator } from "../functions/compute-derivative-interpolator";

export function updateTrackInterpolatorsAndResults(
  api: AnimationApi,
  set: AnimationStoreSetter,
  _get: AnimationStoreGetter,
  trackId: string,
  namespace: string,
  duration: number,
  instance: AnimationInstance,
): () => void {
  return api.subscribe(
    (state: AnimationData) => ({
      track: state.tracks[trackId],
      animatableValue: state.animatables[state.tracks[trackId].animatableId],
    }),
    ({ track, animatableValue }) => {
      if (!track) return;

      const playerState = usePlayerStore.getState();

      const stamp = playerState.player.stamp;
      const playing = playerState.player.running;
      const currentDirection = playerState.player._currentDirection;
      const speed = playerState.player.speed;
      const multiplier = (currentDirection === PlayerDirection.Reverse ? -1 : 1) * speed;

      const newVals = new Map<string, RawValue | undefined>();
      const newVelocities = new Map<string, RawValue | undefined>();
      let newViolations: Violation[] = [];

      const lookup = getLookup(namespace, track.animatableId ?? trackId);

      const trackInterp = computeTrackInterpolator(track, instance);
      const derivativeInterp = computeDerivativeInterpolator(trackInterp, duration);

      // Handle setting the values.
      newVals.set(lookup, trackInterp(stamp));
      // Handle setting the velocities.
      // If the player is running, we use the derivative interpolator,
      const vel = derivativeInterp(stamp);
      if (vel !== undefined) {
        if (playing) {
          newVelocities.set(lookup, rawValueMultiplyScalar(vel, multiplier));
        } else {
          const stoppedVel = matchingIdentityRawValue(vel);
          newVelocities.set(lookup, stoppedVel);
        }
      } else {
        newVelocities.set(lookup, undefined);
      }

      newVelocities.set(lookup, playing ? derivativeInterp(playerState.player.stamp) : 0);

      newViolations = [
        ...newViolations,
        ...(animatableValue
          ? computeTrackViolations(trackInterp, duration, trackId, namespace, animatableValue)
          : []),
      ];

      set((state: AnimationData) => ({
        trackInterpolators: {
          ...state.trackInterpolators,
          [lookup]: {
            value: trackInterp,
            derivative: derivativeInterp,
          },
        },
        values: new Map([...state.values, ...newVals]),
        velocities: new Map([...state.velocities, ...newVelocities]),
        violations: { ...state.violations, [trackId]: newViolations },
      }));
    },
    { fireImmediately: true, equalityFn: shallow },
  );
}
