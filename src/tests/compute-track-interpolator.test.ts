import { test, expect } from "vitest";
import { computeTrackInterpolator } from "../functions/compute-track-interpolator";
import { instances, tracks } from "./animation-data";

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
