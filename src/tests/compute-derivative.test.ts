import { expect, test } from "vitest";
import { computeTrackInterpolator } from "../functions/compute-track-interpolator";
import { computeDerivative } from "../functions/compute-derivative";
import { instances, tracks } from "./animation-data";

test("derivative should be 0 at flat points of the curves for 1000ms animations", () => {
  const defaultTrack1Interpolator = computeTrackInterpolator(tracks.track1, instances.default);

  const derivativeA = computeDerivative(defaultTrack1Interpolator, 0.05, 1000);
  const derivativeB = computeDerivative(defaultTrack1Interpolator, 0.95, 1000);

  // Test the interpolated values at different times
  // the method `toBeCloseTo` tests that the values are close to each other with
  // floating-point precision
  expect(derivativeA).toBeCloseTo(0);
  expect(derivativeB).toBeCloseTo(0);
});

test("derivative should be non-zero at points of change for 1000ms animations", () => {
  const defaultTrack1Interpolator = computeTrackInterpolator(tracks.track1, instances.default);

  const derivativeC = computeDerivative(defaultTrack1Interpolator, 0.15, 1000);
  const derivativeD = computeDerivative(defaultTrack1Interpolator, 0.85, 1000);

  // Test the interpolated values at different times
  // the method `toBeCloseTo` tests that the values are close to each other with
  // floating-point precision
  expect(derivativeC).not.toBeCloseTo(0);
  expect(derivativeD).not.toBeCloseTo(0);
});

test("derivative should be 0 at flat points of the curves for 500ms animations", () => {
  const defaultTrack1Interpolator = computeTrackInterpolator(tracks.track1, instances.default);

  const derivativeA = computeDerivative(defaultTrack1Interpolator, 0.05, 500);
  const derivativeB = computeDerivative(defaultTrack1Interpolator, 0.95, 500);

  // Test the interpolated values at different times
  // the method `toBeCloseTo` tests that the values are close to each other with
  // floating-point precision
  expect(derivativeA).toBeCloseTo(0);
  expect(derivativeB).toBeCloseTo(0);
});

test("derivative of a double-speed animation should be double a default-speed animation", () => {
  const defaultTrack1Interpolator = computeTrackInterpolator(tracks.track1, instances.default);
  const doublespeedTrack1Interpolator = computeTrackInterpolator(
    tracks.track1,
    instances.doublespeed,
  );

  const derivativeDefault = computeDerivative(defaultTrack1Interpolator, 0.5, 1000);
  const derivativeDoubleSpeed = computeDerivative(doublespeedTrack1Interpolator, 0.25, 1000);

  const defaultPosition = defaultTrack1Interpolator(0.5);
  const doubleSpeedPosition = doublespeedTrack1Interpolator(0.25);

  expect(defaultPosition).toBeCloseTo(doubleSpeedPosition as number);
  expect(derivativeDefault).toBeCloseTo(derivativeDoubleSpeed / 2, 2);
});
