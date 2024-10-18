import { test, expect } from "vitest";
import { RawValue } from "@semio/utils";
import { createTrackViolations } from "../actions/create-track-violations";
import { createAnimationCache } from "../actions/create-animation-cache";
import { createTrackInterpolator } from "../actions/create-track-interpolator";
import {
  ViolationType,
  Keyframe,
  Track,
  TrackGroup,
  Transition,
  Keypoint,
  Animation,
} from "../types";

test("An animation that shifts from within to outside bounds gets a bounds error at the midpoint", () => {
  const simpleAnimation: Animation = {
    id: "animation1",
    name: "Animation 1",
    points: new Map<string, Keypoint<RawValue>>([
      ["point1", { id: "point1", frame: "frame1", track: "track1", value: -1 }],
      ["point2", { id: "point2", frame: "frame2", track: "track1", value: 1 }],
    ]),
    frames: new Map<string, Keyframe>([
      ["frame1", { id: "frame1", stamp: 0, points: ["point1"] }],
      ["frame2", { id: "frame2", stamp: 1, points: ["point2"] }],
    ]),
    tracks: new Map<string, Track>([
      [
        "track1",
        {
          id: "track1",
          name: "Track 1",
          points: ["point1", "point2"],
        },
      ],
    ]),
    groups: new Map<string, TrackGroup>(),
    transitions: new Map<string, Transition>(),
    frameOrder: ["frame1", "frame2"],
    trackOrder: ["track1"],
    duration: 2000,
    instances: {
      default: { offset: 0, timescale: 1 },
      doublespeed: { offset: 0, timescale: 2 },
      offset: { offset: 0.5, timescale: 1 },
      offsetDoublespeed: { offset: 0.5, timescale: 2 },
    },
  };

  // Create the animation cache
  const animationCache = createAnimationCache(simpleAnimation);

  // Create the animation interpolator
  const track1Interpolator = createTrackInterpolator(
    animationCache.get("track1")!,
    simpleAnimation.instances.default,
  );

  // Compute the track violations
  const violations = createTrackViolations(
    track1Interpolator,
    simpleAnimation.duration,
    "track1",
    "default",
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
  expect(violations[0]?.type).toEqual(ViolationType.Boundary);
  expect(violations[0]?.stampRange?.[0]).toBeCloseTo(0.5);
  expect(violations[0]?.stampRange?.[1]).toBeCloseTo(1);
});

test("An animation with a velocity limit of 0 returns a violation for the entire change duration", () => {
  const animation: Animation = {
    id: "animation1",
    name: "Animation 1",
    points: new Map<string, Keypoint<RawValue>>([
      ["point1", { id: "point1", frame: "frame1", track: "track1", value: -1 }],
      ["point2", { id: "point2", frame: "frame2", track: "track1", value: -1 }],
      ["point3", { id: "point3", frame: "frame3", track: "track1", value: 1 }],
      ["point4", { id: "point4", frame: "frame4", track: "track1", value: 1 }],
    ]),
    frames: new Map<string, Keyframe>([
      ["frame1", { id: "frame1", stamp: 0, points: ["point1"] }],
      ["frame2", { id: "frame2", stamp: 0.25, points: ["point2"] }],
      ["frame3", { id: "frame3", stamp: 0.75, points: ["point3"] }],
      ["frame4", { id: "frame4", stamp: 1, points: ["point4"] }],
    ]),
    tracks: new Map<string, Track>([
      [
        "track1",
        {
          id: "track1",
          name: "Track 1",
          points: ["point1", "point2", "point3", "point4"],
        },
      ],
    ]),
    groups: new Map<string, TrackGroup>(),
    transitions: new Map<string, Transition>(),
    frameOrder: ["frame1", "frame2", "frame3", "frame4"],
    trackOrder: ["track1"],
    duration: 2000,
    instances: {
      default: { offset: 0, timescale: 1 },
      doublespeed: { offset: 0, timescale: 2 },
      offset: { offset: 0.5, timescale: 1 },
      offsetDoublespeed: { offset: 0.5, timescale: 2 },
    },
  };

  // Create the animation cache
  const animationCache = createAnimationCache(animation);

  // Create the animation interpolator
  const track1Interpolator = createTrackInterpolator(
    animationCache.get("track1")!,
    animation.instances.default,
  );

  // Compute the track violations
  const violations = createTrackViolations(
    track1Interpolator,
    animation.duration,
    "track1",
    "default",
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
  expect(violations[0]?.stampRange?.[0]).toBeCloseTo(0.25);
  expect(violations[0]?.stampRange?.[1]).toBeCloseTo(0.75);
});
