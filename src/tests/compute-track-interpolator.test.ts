import { test, expect } from "vitest";
import { RawValue } from "@semio/utils";
import type { Animation, Track } from "../types";
import { computeTrackInterpolator } from "../functions/compute-track-interpolator";

test("should return the interpolated values for each track", () => {
  // Define the animation data structure
  const animation: Animation = {
    id: "animation1",
    name: "Animation 1",
    tracks: ["track1", "track2"],
    groups: new Map(),
    transitions: new Map(),
    duration: 2,
    instances: {
      default: { offset: 0, timescale: 1 },
      doublespeed: { offset: 0, timescale: 2 },
      offset: { offset: 0.5, timescale: 1 },
      offsetDoublespeed: { offset: 0.5, timescale: 2 },
    },
  };

  const tracks: Record<string, Track<RawValue>> = {
    track1: {
      id: "track1",
      name: "Track 1",
      points: [
        { id: "point1", stamp: 0.1, value: 10 },
        { id: "point2", stamp: 0.3, value: 15 },
        { id: "point3", stamp: 0.9, value: 20 },
      ],
    },
    track2: {
      id: "track2",
      name: "Track 2",
      points: [
        { id: "point4", stamp: 0.1, value: 1.2 },
        { id: "point5", stamp: 0.9, value: 2.1 },
      ],
    },
  };

  const defaultTrack1Interpolator = computeTrackInterpolator(
    tracks.track1,
    animation.instances.default,
  );

  const defaultTrack2Interpolator = computeTrackInterpolator(
    tracks.track2,
    animation.instances.default,
  );
  const doublespeedTrack1Interpolator = computeTrackInterpolator(
    tracks.track1,
    animation.instances.doublespeed,
  );
  const offsetTrack1Interpolator = computeTrackInterpolator(
    tracks.track1,
    animation.instances.offset,
  );
  const offsetDoublespeedTrack1Interpolator = computeTrackInterpolator(
    tracks.track1,
    animation.instances.offsetDoublespeed,
  );

  // Test the interpolated values at different times
  // the method `toBeCloseTo` tests that the values are close to each other with
  // floating-point precision
  expect(defaultTrack1Interpolator(0)).toBeCloseTo(10);
  expect(defaultTrack2Interpolator(0)).toBeCloseTo(1.2);
  expect(defaultTrack1Interpolator(0.3)).toBeCloseTo(15);
  expect(defaultTrack2Interpolator(0.5)).toBeCloseTo(1.65);
  expect(defaultTrack1Interpolator(1)).toBeCloseTo(20);
  expect(defaultTrack2Interpolator(1)).toBeCloseTo(2.1);
  expect(doublespeedTrack1Interpolator(0)).toBeCloseTo(10);
  expect(doublespeedTrack1Interpolator(0.5)).toBeCloseTo(20);
  expect(offsetTrack1Interpolator(0.5)).toBeCloseTo(10);
  expect(offsetDoublespeedTrack1Interpolator(0.5)).toBeCloseTo(10);
  expect(offsetDoublespeedTrack1Interpolator(1)).toBeCloseTo(20);
  expect(offsetDoublespeedTrack1Interpolator(0.65)).toBeCloseTo(15);
});
