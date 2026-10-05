import { test, expect } from "vitest";
import { computeTrackViolations } from "../functions/compute-track-violations";
import { ViolationType } from "../types";
import { curveOf } from "./curves";

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
  // The track's curve, as the module bakes it
  const track1Interpolator = curveOf(track1);

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

test("a value hovering at the limit within float tolerance produces no bound violation", () => {
  const max = 1;
  // A segment held flat AT the limit samples from the spline as max ± float
  // error; a strict `>` test would paint scattered violations across the range.
  const interpolator = (time: number) => max + Math.sin(time / 10) * 1e-9;

  const violations = computeTrackViolations(interpolator, 2000, "track1", "default", "some", {
    id: "some-animatable-id",
    name: "Some Animatable",
    type: "number",
    default: 0,
    constraints: { min: -1, max, velocity: 1e9 },
  });

  expect(violations.filter((v) => v.type === ViolationType.Upper)).toHaveLength(0);
});

test("a value clearly beyond the limit still reports a bound violation", () => {
  const max = 1;
  const interpolator = () => max + 0.5; // well past the tolerance

  const violations = computeTrackViolations(interpolator, 2000, "track1", "default", "some", {
    id: "some-animatable-id",
    name: "Some Animatable",
    type: "number",
    default: 0,
    constraints: { min: -1, max, velocity: 1e9 },
  });

  expect(violations.some((v) => v.type === ViolationType.Upper)).toBe(true);
});

test("a velocity sitting at the limit within float tolerance produces no velocity violation", () => {
  const limit = 1; // per second
  // Linear motion whose computed velocity is the limit plus float-level error.
  // (velocity = k * 1000 per second; see computeTrackViolations' timeDelta.)
  const k = (1 + 1e-9) / 1000;
  const interpolator = (time: number) => k * time;

  const violations = computeTrackViolations(interpolator, 2000, "track1", "default", "some", {
    id: "some-animatable-id",
    name: "Some Animatable",
    type: "number",
    default: 0,
    constraints: { min: -1e9, max: 1e9, velocity: limit },
  });

  expect(violations.filter((v) => v.type === ViolationType.Velocity)).toHaveLength(0);
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

  // The track's curve, as the module bakes it
  const track1Interpolator = curveOf(track1);

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
