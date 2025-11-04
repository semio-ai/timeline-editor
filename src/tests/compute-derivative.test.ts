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

  const derivativeA = expectNumber(
    computeDerivativeInterpolator(defaultTrack1Interpolator, 1000)(0.05),
  );
  const derivativeB = expectNumber(
    computeDerivativeInterpolator(defaultTrack1Interpolator, 1000)(0.95),
  );

  // Test the interpolated values at different times
  // the method `toBeCloseTo` tests that the values are close to each other with
  // floating-point precision
  expect(derivativeA).toBeCloseTo(0);
  expect(derivativeB).toBeCloseTo(0);
});

test("derivative should be non-zero at points of change for 1000ms animations", () => {
  const defaultTrack1Interpolator = computeTrackInterpolator(tracks.track1, instances.default);

  const derivativeC = expectNumber(
    computeDerivativeInterpolator(defaultTrack1Interpolator, 1000)(0.15),
  );
  const derivativeD = expectNumber(
    computeDerivativeInterpolator(defaultTrack1Interpolator, 1000)(0.85),
  );

  // Test the interpolated values at different times
  // the method `toBeCloseTo` tests that the values are close to each other with
  // floating-point precision
  expect(derivativeC).not.toBeCloseTo(0);
  expect(derivativeD).not.toBeCloseTo(0);
});

test("derivative should be 0 at flat points of the curves for 500ms animations", () => {
  const defaultTrack1Interpolator = computeTrackInterpolator(tracks.track1, instances.default);

  const derivativeA = expectNumber(
    computeDerivativeInterpolator(defaultTrack1Interpolator, 500)(0.05),
  );
  const derivativeB = expectNumber(
    computeDerivativeInterpolator(defaultTrack1Interpolator, 500)(0.95),
  );

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

  const approximate = (
    interp: (t: number) => number | undefined,
    duration: number,
    t: number,
  ): number | undefined => {
    const delta = 2.5 / duration;
    const a = interp(t - delta);
    const b = interp(t + delta);
    if (typeof a !== "number" || typeof b !== "number") return undefined;
    const dist = (b - a) / (2 * delta);
    return dist / (duration / 1000);
  };

  const derivativeDefault = expectNumber(
    computeDerivativeInterpolator(defaultTrack1Interpolator, 1000)(0.5),
  );
  const derivativeDoubleSpeed = expectNumber(
    computeDerivativeInterpolator(doublespeedTrack1Interpolator, 1000)(0.5),
  );

  const expectedDefault = approximate(
    defaultTrack1Interpolator as (t: number) => number | undefined,
    1000,
    0.5,
  );
  const expectedDouble = approximate(
    doublespeedTrack1Interpolator as (t: number) => number | undefined,
    1000,
    0.5,
  );

  expect(expectedDefault).toBeDefined();
  expect(expectedDouble).toBeDefined();
  expect(derivativeDefault).toBeCloseTo(expectNumber(expectedDefault));
  expect(derivativeDoubleSpeed).toBeCloseTo(expectNumber(expectedDouble));
});
