import { test, expect } from "vitest";
import { RawValue } from "@semio/utils";
import type {
  Animation,
  Keyframe,
  Keypoint,
  Track,
  TrackGroup,
  Transition,
  AnimationCache,
} from "../types";
import { computeAnimationCache } from "../functions/compute-animation-cache";

test("should return a cached array of timestamped values for each track", () => {
  // Define the animation data structure
  const animation: Animation = {
    id: "animation1",
    name: "Animation 1",
    points: new Map<string, Keypoint<RawValue>>([
      ["point1", { id: "point1", frame: "frame1", track: "track1", value: 10 }],
      ["point2", { id: "point2", frame: "frame2", track: "track1", value: 15 }],
      ["point3", { id: "point3", frame: "frame3", track: "track1", value: 20 }],
      ["point4", { id: "point4", frame: "frame1", track: "track2", value: 1.2 }],
      ["point5", { id: "point5", frame: "frame3", track: "track2", value: 2.1 }],
    ]),
    frames: new Map<string, Keyframe>([
      ["frame1", { id: "frame1", stamp: 0.1, points: ["point1", "point4"] }],
      ["frame2", { id: "frame2", stamp: 0.3, points: ["point2"] }],
      ["frame3", { id: "frame3", stamp: 0.9, points: ["point3", "point5"] }],
    ]),
    tracks: new Map<string, Track>([
      [
        "track1",
        {
          id: "track1",
          name: "Track 1",
          points: ["point1", "point2", "point3"],
        },
      ],
      ["track2", { id: "track2", name: "Track 2", points: ["point4", "point5"] }],
    ]),
    groups: new Map<string, TrackGroup>(),
    transitions: new Map<string, Transition>(),
    frameOrder: ["frame1", "frame2", "frame3"],
    trackOrder: ["track1", "track2"],
    duration: 2,
    instances: {
      default: { offset: 0, timescale: 1 },
      doublespeed: { offset: 0, timescale: 2 },
      offset: { offset: 0.5, timescale: 1 },
      offsetDoublespeed: { offset: 0.5, timescale: 2 },
    },
  };

  // Create the animation cache
  const animationCache: AnimationCache = computeAnimationCache(animation);

  /*
    Test the interpolated values at different times
    the method `toBeCloseTo` tests that the values are close to each other with
    floating-point precision
  */
  expect(animationCache.track1[0]?.value).toBe(10);
  expect(animationCache.track1[0]?.stamp).toBe(0.1);

  expect(animationCache.track2[0]?.value).toBe(1.2);
  expect(animationCache.track2[0]?.stamp).toBe(0.1);

  expect(animationCache.track1[1]?.value).toBe(15);
  expect(animationCache.track1[1]?.stamp).toBe(0.3);

  expect(animationCache.track2[1]?.value).toBe(2.1);
  expect(animationCache.track2[1]?.stamp).toBe(0.9);

  expect(animationCache.track1[2]?.value).toBe(20);
  expect(animationCache.track1[2]?.stamp).toBe(0.9);
});
