import type { RawValue } from "@semio/utils";
import { test, expect } from "vitest";
import type { Track } from "../types";
import { StandardTransitionType, TransitionDirective } from "../types";
import { computeTrackInterpolator } from "../functions/compute-track-interpolator";
import { instances, tracks } from "./animation-data";

const expectNumber = (value: unknown): number => {
  if (typeof value !== "number") {
    throw new Error(
      `Expected number but received ${value === undefined ? "undefined" : typeof value}`,
    );
  }
  return value;
};

test("should return the interpolated values for each track", () => {
  const defaultTrack1Interpolator = computeTrackInterpolator(tracks.track1, instances.default);
  const defaultTrack2Interpolator = computeTrackInterpolator(tracks.track2, instances.default);
  const doublespeedTrack1Interpolator = computeTrackInterpolator(
    tracks.track1,
    instances.doublespeed,
  );
  const offsetTrack1Interpolator = computeTrackInterpolator(tracks.track1, instances.offset);
  const offsetDoublespeedTrack1Interpolator = computeTrackInterpolator(
    tracks.track1,
    instances.offsetDoublespeed,
  );

  // Stamps are in ms. Track1 has keypoints at 100, 300, 900ms with values 10, 15, 20.
  // Track2 has keypoints at 100, 900ms with values 1.2, 2.1.

  // At or before the first keypoint world stamp, should return first value
  expect(expectNumber(defaultTrack1Interpolator(0))).toBeCloseTo(10);
  expect(expectNumber(defaultTrack2Interpolator(0))).toBeCloseTo(1.2);

  // At exact keypoint stamps
  expect(expectNumber(defaultTrack1Interpolator(300))).toBeCloseTo(15);

  // Midpoint of track2 (linear-ish between 100ms and 900ms)
  expect(expectNumber(defaultTrack2Interpolator(500))).toBeCloseTo(1.65);

  // At or after the last keypoint, should return last value
  expect(expectNumber(defaultTrack1Interpolator(1000))).toBeCloseTo(20);
  expect(expectNumber(defaultTrack2Interpolator(1000))).toBeCloseTo(2.1);

  // Double-speed: at t=0 (before content), same as default
  expect(expectNumber(doublespeedTrack1Interpolator(0))).toBeCloseTo(10);

  // Midpoint comparisons — double-speed and offset instances should produce
  // equivalent values at their respective world times
  const midDefault = expectNumber(defaultTrack1Interpolator(500));
  const midDouble = expectNumber(doublespeedTrack1Interpolator(500));
  expect(midDefault).toBeCloseTo(midDouble);
  expect(expectNumber(offsetTrack1Interpolator(500))).toBeCloseTo(midDefault);
  expect(expectNumber(offsetDoublespeedTrack1Interpolator(500))).toBeCloseTo(midDefault);

  // End points
  expect(expectNumber(offsetDoublespeedTrack1Interpolator(1000))).toBeCloseTo(20);
});

test("falls back inferred-auto-clamped directives to cubic in interpolator path", () => {
  const directiveTrack: Track<RawValue> = {
    id: "directive",
    name: "directive",
    animatableId: "directive",
    groupName: "directive",
    points: [
      {
        id: "a",
        stamp: 0,
        value: 0,
        transitions: {
          out: TransitionDirective.InferredAutoClamped,
        },
      },
      {
        id: "b",
        stamp: 1000,
        value: 10,
        transitions: {
          in: TransitionDirective.InferredAutoClamped,
        },
      },
    ],
  };
  const cubicTrack: Track<RawValue> = {
    ...directiveTrack,
    id: "cubic",
    points: [
      {
        id: "a",
        stamp: 0,
        value: 0,
        transitions: { out: StandardTransitionType.Cubic },
      },
      {
        id: "b",
        stamp: 1000,
        value: 10,
        transitions: { in: StandardTransitionType.Cubic },
      },
    ],
  };

  const directiveInterpolator = computeTrackInterpolator(directiveTrack, instances.default);
  const cubicInterpolator = computeTrackInterpolator(cubicTrack, instances.default);

  // Sample at several ms positions
  [0, 250, 500, 750, 1000].forEach((t) => {
    expect(expectNumber(directiveInterpolator(t))).toBeCloseTo(expectNumber(cubicInterpolator(t)));
  });
});
