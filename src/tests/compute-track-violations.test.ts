import { test, expect } from "vitest";
import { computeTrackViolations } from "../functions/compute-track-violations";
import { computeTrackInterpolator } from "../functions/compute-track-interpolator";
import { ViolationType } from "../types";

test("An animation that shifts from within to outside bounds gets a bounds error at the midpoint", () => {
  const track1 = {
    id: "track1",
    animatableId: "animatable1",
    name: "Track 1",
    points: [
      { id: "point1", stamp: 0, value: -1 },
      { id: "point2", stamp: 2000, value: 1 },
    ],
  };
  const defaultInstance = {
    id: "some",
    animationId: "thing",
    settings: { offset: 0, timescale: 1, active: true },
  };
  // Note: timescale/offset alter world-time sampling, so violations can differ per instance.

  // Create the animation interpolator
  const track1Interpolator = computeTrackInterpolator(track1, defaultInstance);

  // Compute the track violations
  const violations = computeTrackViolations(
    track1Interpolator,
    2000,
    "track1",
    "default",
    defaultInstance.id,
    {
      id: "some-animatable-id",
      name: "Some Animatable",
      type: "number",
      default: 0,
      constraints: {
        min: -1,
        max: 0,
        velocity: 10,
      },
    },
  );

  expect(violations.length).toEqual(1);
  const violation = violations[0];
  expect(violation).toBeDefined();
  if (!violation) {
    throw new Error("Expected a violation");
  }
  expect(violation.type).toEqual(ViolationType.Upper);
  expect(violation.stampRange.start).toBeCloseTo(1010, 0); // ~50.5% of 2000ms
  expect(violation.stampRange.end).toBeCloseTo(2000, 0);
});

test("An animation with a velocity limit of 0 returns a violation for the entire change duration", () => {
  const track1 = {
    id: "track1",
    animatableId: "animatable1",
    name: "Track 1",
    points: [
      { id: "point1", stamp: 0, value: -1 },
      { id: "point2", stamp: 500, value: -1 },
      { id: "point3", stamp: 1500, value: 1 },
      { id: "point4", stamp: 2000, value: 1 },
    ],
  };
  const defaultInstance = {
    id: "some",
    animationId: "thing",
    settings: { offset: 0, timescale: 1, active: true },
  };

  // Create the animation interpolator
  const track1Interpolator = computeTrackInterpolator(track1, defaultInstance);

  // Compute the track violations
  const violations = computeTrackViolations(
    track1Interpolator,
    2000,
    "track1",
    "default",
    defaultInstance.id,
    {
      id: "some-animatable-id",
      name: "Some Animatable",
      type: "number",
      default: 0,
      constraints: {
        min: -1,
        max: 1,
        velocity: 0,
      },
    },
  );

  expect(violations.length).toEqual(1);
  expect(violations[0]?.type).toEqual(ViolationType.Velocity);
  // Violation boundaries have ~10ms precision (step interval)
  expect(violations[0]?.stampRange.start).toBeCloseTo(500, -2);
  expect(violations[0]?.stampRange.end).toBeCloseTo(1500, -2);
});
