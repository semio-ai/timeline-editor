import { describe, expect, test } from "vitest";
import type { AnimatableValue } from "@semio/utils";
import { computeTrackInterpolator } from "../functions/compute-track-interpolator";
import { exportEffectiveMotion, type EffectiveMotionKey } from "../functions/export-effective-motion";
import { StandardTransitionType, TransitionDirective, type Animation, type Track } from "../types";

const animation: Animation = { id: "a", name: "Wave", tracks: ["t"], groups: [] };
const animatables: Record<string, AnimatableValue> = {
  joint: {
    id: "joint", type: "number", default: 0, constraints: {},
    pub: { public: true, output: "HeadYaw", units: "rad" },
  },
};
const track: Track<number> = {
  id: "t", name: "Internal label", animatableId: "joint",
  points: [
    { id: "p0", stamp: 0, value: 0, transitions: { out: StandardTransitionType.Linear } },
    { id: "p1", stamp: 1000, value: 1, transitions: {
      in: { x: -250, y: -0.1 }, out: TransitionDirective.InferredAutoClamped,
    } },
    { id: "p2", stamp: 2000, value: 0, transitions: { in: StandardTransitionType.Quad } },
  ],
};

function cubic(a: number, b: number, c: number, d: number, t: number): number {
  const u = 1 - t;
  return u * u * u * a + 3 * u * u * t * b + 3 * u * t * t * c + t * t * t * d;
}

function sample(keys: EffectiveMotionKey[], timeMs: number): number {
  const index = keys.findIndex((key, i) => i + 1 < keys.length && timeMs <= keys[i + 1].timeMs);
  const start = keys[index];
  const end = keys[index + 1];
  let low = 0;
  let high = 1;
  for (let i = 0; i < 50; i += 1) {
    const mid = (low + high) / 2;
    const x = cubic(start.timeMs, start.timeMs + start.out!.deltaTimeMs,
      end.timeMs + end.in!.deltaTimeMs, end.timeMs, mid);
    if (x < timeMs) low = mid;
    else high = mid;
  }
  const t = (low + high) / 2;
  return cubic(start.value, start.value + start.out!.deltaValue,
    end.value + end.in!.deltaValue, end.value, t);
}

describe("effective motion export", () => {
  test("exports resolved joint names and samples the same curve as playback", () => {
    const result = exportEffectiveMotion(animation, { t: track }, animatables);
    expect(result).toMatchObject({
      format: "semio-effective-motion", version: 1, animationName: "Wave",
      timeBasis: "animation-local", timeUnit: "ms",
      channels: [{ output: "HeadYaw", units: "rad" }],
    });
    const keys = result.channels[0].keys;
    expect(keys[1].out).toBeDefined();
    expect(keys[1].in).toBeDefined();
    expect(keys[1].out).not.toEqual(keys[1].in);
    expect(JSON.stringify(result)).not.toContain("inferred-auto-clamped");
    expect(JSON.stringify(result)).not.toContain('"animatableId"');
    expect(JSON.stringify(result)).not.toContain('"trackId"');
    const interpolate = computeTrackInterpolator(track, {
      id: "instance", animationId: "a", settings: { active: true, offset: 0, timescale: 1 },
    });
    for (const timeMs of [100, 300, 650, 900, 1100, 1400, 1750, 1950]) {
      expect(sample(keys, timeMs)).toBeCloseTo(interpolate(timeMs) as number, 3);
    }
  });

  test("omits muted tracks and rejects ambiguous or missing output mappings", () => {
    expect(() => exportEffectiveMotion(animation, { t: { ...track, settings: { muted: true } } }, animatables))
      .toThrow("no playable numeric tracks");
    expect(() => exportEffectiveMotion(animation, { t: track }, {}))
      .toThrow("no resolved output name");
    expect(() => exportEffectiveMotion({ ...animation, tracks: ["t", "copy"] },
      { t: track, copy: { ...track, id: "copy" } }, animatables))
      .toThrow('Multiple tracks target "HeadYaw"');
  });

  test("exports clamped geometry instead of oversized authored handles", () => {
    const oversized: Track<number> = {
      ...track,
      points: [
        { id: "first", stamp: 0, value: 0, transitions: { out: { x: 5000, y: 10 } } },
        { id: "last", stamp: 1000, value: 1, transitions: { in: { x: -5000, y: -10 } } },
      ],
    };
    const keys = exportEffectiveMotion(animation, { t: oversized }, animatables).channels[0].keys;
    expect(keys[0].out!.deltaTimeMs).toBeLessThan(1001);
    expect(keys[1].in!.deltaTimeMs).toBeGreaterThan(-1001);
    expect(keys[0].out!.deltaTimeMs).not.toBe(5000);
  });

  test("rejects keys that cannot be represented unambiguously", () => {
    const simultaneous: Track<number> = {
      ...track,
      points: [{ id: "a", stamp: 10, value: 0 }, { id: "b", stamp: 10, value: 1 }],
    };
    expect(() => exportEffectiveMotion(animation, { t: simultaneous }, animatables))
      .toThrow("simultaneous keys");
  });
});
