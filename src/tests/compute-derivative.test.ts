import { expect, test } from "vitest";
import { computeDerivativeInterpolator } from "../functions/compute-derivative-interpolator";
import { tracks } from "./animation-data";
import { curveOf } from "./curves";

const expectNumber = (value: unknown): number => {
  if (typeof value !== "number") {
    throw new Error(
      `Expected number but received ${value === undefined ? "undefined" : typeof value}`,
    );
  }
  return value;
};

test("derivative should be 0 at flat points of the curves for 1000ms animations", () => {
  const defaultTrack1Interpolator = curveOf(tracks.track1);

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
  const defaultTrack1Interpolator = curveOf(tracks.track1);

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
  const defaultTrack1Interpolator = curveOf(tracks.track1);

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
