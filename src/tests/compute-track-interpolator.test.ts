import { test, expect } from "vitest";
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

  // Test the interpolated values at different times
  // the method `toBeCloseTo` tests that the values are close to each other with
  // floating-point precision
  expect(expectNumber(defaultTrack1Interpolator(0))).toBeCloseTo(10);
  expect(expectNumber(defaultTrack2Interpolator(0))).toBeCloseTo(1.2);
  expect(expectNumber(defaultTrack1Interpolator(0.3))).toBeCloseTo(15);
  expect(expectNumber(defaultTrack2Interpolator(0.5))).toBeCloseTo(1.65);
  expect(expectNumber(defaultTrack1Interpolator(1))).toBeCloseTo(20);
  expect(expectNumber(defaultTrack2Interpolator(1))).toBeCloseTo(2.1);
  expect(expectNumber(doublespeedTrack1Interpolator(0))).toBeCloseTo(10);
  const midDefault = expectNumber(defaultTrack1Interpolator(0.5));
  const midDouble = expectNumber(doublespeedTrack1Interpolator(0.5));
  expect(midDefault).toBeCloseTo(15.745849186787382);
  expect(midDouble).toBeCloseTo(midDefault);
  expect(expectNumber(offsetTrack1Interpolator(0.5))).toBeCloseTo(midDefault);
  expect(expectNumber(offsetDoublespeedTrack1Interpolator(0.5))).toBeCloseTo(midDefault);
  expect(expectNumber(offsetDoublespeedTrack1Interpolator(1))).toBeCloseTo(20);
  expect(expectNumber(offsetDoublespeedTrack1Interpolator(0.65))).toBeCloseTo(18.57389205135405);
});
