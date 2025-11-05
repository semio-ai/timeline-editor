import { getLookup, PlayerDirection, RawValue, usePlayerStore } from "@semio/utils";
import { shallow } from "zustand/shallow";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import {
  computeTrackInterpolator,
  computeTrackViolations,
  matchingIdentityRawValue,
  rawValueMultiplyScalar,
} from "../functions";
import { AnimationInstance, Violation } from "../types";
import { computeDerivativeInterpolator } from "../functions/compute-derivative-interpolator";
import { logDerivedEvent } from "../utils/derived-debug";
import { buildTrackKey } from "../utils/track-key";

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
      const storeSnapshot = api.getState();
      const selectedCount = Array.from(storeSnapshot.selectionState.keypoints.values()).reduce(
        (total, ids) => total + ids.size,
        0,
      );

      logDerivedEvent("updateTrackInterpolatorsAndResults", "start", () => ({
        trackId,
        namespace,
        dragActive: Boolean(storeSnapshot.dragState),
        selectedCount,
        stamp: playerState.player.stamp,
      }));

      const stamp = playerState.player.stamp;
      const playing = playerState.player.running;
      const currentDirection = playerState.player._currentDirection;
      const speed = playerState.player.speed;
      const multiplier = (currentDirection === PlayerDirection.Reverse ? -1 : 1) * speed;

      const newVals = new Map<string, RawValue | undefined>();
      const newVelocities = new Map<string, RawValue | undefined>();
      let newViolations: Violation[] = [];

      const lookup = getLookup(namespace, track.animatableId ?? trackId);
      const trackKey = buildTrackKey(namespace, instance.id, trackId);

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
          ? computeTrackViolations(
              trackInterp,
              duration,
              trackId,
              namespace,
              instance.id,
              animatableValue,
            )
          : []),
      ];

      set((state: AnimationData) => {
        return {
          trackInterpolators: {
            ...state.trackInterpolators,
            [lookup]: {
              value: trackInterp,
              derivative: derivativeInterp,
            },
          },
          values: new Map([...state.values, ...newVals]),
          velocities: new Map([...state.velocities, ...newVelocities]),
          violations: {
            ...state.violations,
            [trackKey]: newViolations,
          },
        };
      });

      logDerivedEvent("updateTrackInterpolatorsAndResults", "end", () => ({
        trackId,
        namespace,
        violationsCount: newViolations.length,
        dragActive: Boolean(api.getState().dragState),
      }));
    },
    { fireImmediately: true, equalityFn: shallow },
  );
}
