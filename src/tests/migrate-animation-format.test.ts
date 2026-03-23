import { describe, it, expect } from "vitest";
import type { StoredAnimation } from "../types";
import { StandardTransitionType, TransitionPairing } from "../types";
import { CURRENT_ANIMATION_FORMAT_VERSION } from "../types/data/animation";
import { migrateToMillisecondStamps } from "../functions/migrate-animation-format";

function makeV1Animation(overrides?: Partial<StoredAnimation>): StoredAnimation {
  return {
    id: "test-anim",
    name: "Test Animation",
    duration: 5000,
    groups: [],
    tracks: [],
    ...overrides,
  };
}

describe("migrateToMillisecondStamps", () => {
  it("returns v2 animations unchanged", () => {
    const v2 = makeV1Animation({
      formatVersion: CURRENT_ANIMATION_FORMAT_VERSION,
      tracks: [
        {
          id: "t1",
          name: "Track 1",
          animatableId: "a1",
          points: [{ id: "k1", stamp: 2500, value: 42 }],
        },
      ],
    });

    const result = migrateToMillisecondStamps(v2);
    expect(result).toBe(v2); // Same reference — no migration
  });

  it("converts normalized stamps to milliseconds", () => {
    const v1 = makeV1Animation({
      duration: 5000,
      tracks: [
        {
          id: "t1",
          name: "Track 1",
          animatableId: "a1",
          points: [
            { id: "k1", stamp: 0, value: 0 },
            { id: "k2", stamp: 0.2, value: 10 },
            { id: "k3", stamp: 0.5, value: 50 },
            { id: "k4", stamp: 1.0, value: 100 },
          ],
        },
      ],
    });

    const result = migrateToMillisecondStamps(v1);

    expect(result.formatVersion).toBe(CURRENT_ANIMATION_FORMAT_VERSION);
    expect(result.tracks[0].points[0].stamp).toBe(0);
    expect(result.tracks[0].points[1].stamp).toBe(1000); // 0.2 * 5000
    expect(result.tracks[0].points[2].stamp).toBe(2500); // 0.5 * 5000
    expect(result.tracks[0].points[3].stamp).toBe(5000); // 1.0 * 5000
  });

  it("converts explicit transition x-deltas to milliseconds", () => {
    const v1 = makeV1Animation({
      duration: 10000,
      tracks: [
        {
          id: "t1",
          name: "Track 1",
          animatableId: "a1",
          points: [
            {
              id: "k1",
              stamp: 0.0,
              value: 0,
              transitions: {
                out: { x: 0.05, y: 0 },
              },
            },
            {
              id: "k2",
              stamp: 0.5,
              value: 100,
              transitions: {
                in: { x: -0.08, y: 1 },
                out: { x: 0.1, y: 0 },
              },
            },
          ],
        },
      ],
    });

    const result = migrateToMillisecondStamps(v1);

    // Stamps
    expect(result.tracks[0].points[0].stamp).toBe(0);
    expect(result.tracks[0].points[1].stamp).toBe(5000);

    // Transition x-deltas scaled, y-deltas preserved
    const k1Out = result.tracks[0].points[0].transitions?.out;
    expect(k1Out).toEqual({ x: 500, y: 0 }); // 0.05 * 10000

    const k2In = result.tracks[0].points[1].transitions?.in;
    expect(k2In).toEqual({ x: -800, y: 1 }); // -0.08 * 10000

    const k2Out = result.tracks[0].points[1].transitions?.out;
    expect(k2Out).toEqual({ x: 1000, y: 0 }); // 0.1 * 10000
  });

  it("preserves string transitions (standard easing types)", () => {
    const v1 = makeV1Animation({
      duration: 5000,
      tracks: [
        {
          id: "t1",
          name: "Track 1",
          animatableId: "a1",
          points: [
            {
              id: "k1",
              stamp: 0,
              value: 0,
              transitions: { out: StandardTransitionType.Cubic },
            },
            {
              id: "k2",
              stamp: 1,
              value: 100,
              transitions: { in: StandardTransitionType.Sine, pairing: TransitionPairing.Paired },
            },
          ],
        },
      ],
    });

    const result = migrateToMillisecondStamps(v1);

    expect(result.tracks[0].points[0].transitions?.out).toBe(StandardTransitionType.Cubic);
    expect(result.tracks[0].points[1].transitions?.in).toBe(StandardTransitionType.Sine);
    expect(result.tracks[0].points[1].transitions?.pairing).toBe(TransitionPairing.Paired);
  });

  it("preserves keypoint values unchanged", () => {
    const v1 = makeV1Animation({
      duration: 2000,
      tracks: [
        {
          id: "t1",
          name: "Track 1",
          animatableId: "a1",
          points: [
            { id: "k1", stamp: 0, value: { x: 1, y: 2, z: 3 } },
            { id: "k2", stamp: 0.5, value: { x: 4, y: 5, z: 6 } },
          ],
        },
      ],
    });

    const result = migrateToMillisecondStamps(v1);

    expect(result.tracks[0].points[0].value).toEqual({ x: 1, y: 2, z: 3 });
    expect(result.tracks[0].points[1].value).toEqual({ x: 4, y: 5, z: 6 });
  });

  it("handles animations with no tracks", () => {
    const v1 = makeV1Animation({ tracks: [] });
    const result = migrateToMillisecondStamps(v1);
    expect(result.formatVersion).toBe(CURRENT_ANIMATION_FORMAT_VERSION);
    expect(result.tracks).toEqual([]);
  });

  it("handles keypoints with no transitions", () => {
    const v1 = makeV1Animation({
      duration: 1000,
      tracks: [
        {
          id: "t1",
          name: "Track 1",
          animatableId: "a1",
          points: [{ id: "k1", stamp: 0.5, value: 42 }],
        },
      ],
    });

    const result = migrateToMillisecondStamps(v1);
    expect(result.tracks[0].points[0].stamp).toBe(500);
    expect(result.tracks[0].points[0].transitions).toBeUndefined();
  });

  it("defaults duration to 5000ms when absent", () => {
    const v1 = {
      id: "test",
      name: "Test",
      tracks: [
        {
          id: "t1",
          name: "Track 1",
          animatableId: "a1",
          points: [{ id: "k1", stamp: 0.5, value: 10 }],
        },
      ],
      groups: [],
      duration: undefined as unknown as number,
    } satisfies StoredAnimation;

    const result = migrateToMillisecondStamps(v1);
    expect(result.tracks[0].points[0].stamp).toBe(2500); // 0.5 * 5000
  });

  it("is idempotent — migrating twice produces the same result", () => {
    const v1 = makeV1Animation({
      duration: 4000,
      tracks: [
        {
          id: "t1",
          name: "Track 1",
          animatableId: "a1",
          points: [
            {
              id: "k1",
              stamp: 0.25,
              value: 0,
              transitions: { out: { x: 0.1, y: 0 } },
            },
          ],
        },
      ],
    });

    const first = migrateToMillisecondStamps(v1);
    const second = migrateToMillisecondStamps(first);

    expect(second).toBe(first); // Same reference — no double migration
    expect(second.tracks[0].points[0].stamp).toBe(1000); // 0.25 * 4000
  });
});
