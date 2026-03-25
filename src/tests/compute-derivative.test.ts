import { expect, test } from "vitest";
import { computeTrackInterpolator } from "../functions/compute-track-interpolator";
import { computeDerivativeInterpolator } from "../functions/compute-derivative-interpolator";
import { instances, tracks } from "./animation-data";

const expectNumber = (value: unknown): number => {
  if (typeof value !== "number") {
    throw new Error(
      `Expected number but received ${value === undefined ? "undefined" : typeof value}`,
    );
  }
  return value;
};

test("derivative should be 0 at flat points of the curves for 1000ms animations", () => {
  const defaultTrack1Interpolator = computeTrackInterpolator(tracks.track1, instances.default);

  // Flat regions: before first keypoint (100ms) and after last (900ms)
  const derivativeA = expectNumber(
    computeDerivativeInterpolator(defaultTrack1Interpolator, 1000)(50),
  );
  const derivativeB = expectNumber(
    computeDerivativeInterpolator(defaultTrack1Interpolator, 1000)(950),
  );

  expect(derivativeA).toBeCloseTo(0);
  expect(derivativeB).toBeCloseTo(0);
});

test("derivative should be non-zero at points of change for 1000ms animations", () => {
  const defaultTrack1Interpolator = computeTrackInterpolator(tracks.track1, instances.default);

  // Points between keypoints where value is changing
  const derivativeC = expectNumber(
    computeDerivativeInterpolator(defaultTrack1Interpolator, 1000)(200),
  );
  const derivativeD = expectNumber(
    computeDerivativeInterpolator(defaultTrack1Interpolator, 1000)(600),
  );

  expect(derivativeC).not.toBeCloseTo(0);
  expect(derivativeD).not.toBeCloseTo(0);
});

test("derivative should be 0 at flat points of the curves for 500ms animations", () => {
  const defaultTrack1Interpolator = computeTrackInterpolator(tracks.track1, instances.default);

  // Flat regions outside the keypoint range
  const derivativeA = expectNumber(
    computeDerivativeInterpolator(defaultTrack1Interpolator, 500)(50),
  );
  const derivativeB = expectNumber(
    computeDerivativeInterpolator(defaultTrack1Interpolator, 500)(950),
  );

  expect(derivativeA).toBeCloseTo(0);
  expect(derivativeB).toBeCloseTo(0);
});

test("derivative at same world time is consistent regardless of instance timescale", () => {
  // computeTrackInterpolator already bakes timescale into the world→local mapping,
  // so the derivative in world time should be identical for default and double-speed
  // instances at the same world timestamp.
  const defaultTrack1Interpolator = computeTrackInterpolator(tracks.track1, instances.default);
  const doublespeedTrack1Interpolator = computeTrackInterpolator(
    tracks.track1,
    instances.doublespeed,
  );

  const duration = 1000;
  const t = 200; // ms — both instances are in an active interpolation region here

  const derivativeDefault = expectNumber(
    computeDerivativeInterpolator(defaultTrack1Interpolator, duration)(t),
  );
  const derivativeDoubleSpeed = expectNumber(
    computeDerivativeInterpolator(doublespeedTrack1Interpolator, duration)(t),
  );

  expect(Math.abs(derivativeDefault)).toBeGreaterThan(0);
  expect(derivativeDefault).toBeCloseTo(derivativeDoubleSpeed);
});
