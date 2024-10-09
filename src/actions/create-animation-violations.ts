import { AnimatableValue, getLookup, type RawValue } from "@semio/utils";
import type { Animation, Violation, AnimationInterpolator } from "../types";
import type { Control } from "../temp-duplicate-types";
import { createTrackViolations } from "./create-track-violations";

// @description
// This function takes in the animation data structure, and returns a function of time,
// which returns the interpolated value of the animation at that time.
// @param animation: Animation - the animation data structure
// @returns: AnimationInterpolator - a function that takes in a time and returns the interpolated
// value of the animation at that time.
export function createAnimationViolations(
  animations: Record<string, Animation>,
  controls: Record<string, Control>,
  animationInterpolator: AnimationInterpolator,
  animatableValues: Record<string, AnimatableValue>,
): Record<string, Violation[]> {
  const violationsByTrackAndNamespace = new Map<string, Violation[]>();
  let cache = new Map<string, Map<string, RawValue | undefined>>();
  Object.values(animations).forEach((animation) => {
    Object.keys(animation.instances).forEach((instance) => {
      animation.trackOrder.forEach((trackId: string) => {
        // Find the corresponding AnimatableValue for this track, if it exists
        // If it doesn't exist, we don't need to check for violations
        const animatableValueId = Object.values(controls).find(
          (control) => control.writeId === trackId,
        )?.readId;
        const animatableValue = animatableValueId
          ? animatableValues[animatableValueId]
          : undefined;
        if (!animatableValue) {
          return;
        }
        // Since there is an animatable value, we need to check for violations
        const violationResult = createTrackViolations(
          animationInterpolator,
          animation.duration,
          trackId,
          instance,
          animatableValue,
          cache,
        );
        violationsByTrackAndNamespace.set(
          getLookup(instance, trackId),
          violationResult.violations,
        );
        cache = violationResult.cache;
      });
    });
  });

  return {};
}
