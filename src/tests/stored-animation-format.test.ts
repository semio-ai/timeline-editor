import { describe, expect, it } from "vitest";
import { migrateAnimationData } from "../functions/migrate-animation-data";
import {
  readStoredAnimation,
  writeStoredAnimation,
  clipTrackJson,
} from "../functions/stored-animation-format";
import {
  AnimationFormatSupport,
  classifyAnimationFormat,
} from "../functions/migrate-animation-format";
import { resolveStoredAnimationDuration } from "../functions/compute-animation-extent";
import { StandardTransitionType, TransitionDirective, TransitionPairing } from "../types";
import type { Animation } from "../types";
import type { SimpleTrack } from "../types/data/simple-track";
import { createAnimationStore } from "../store";

const animation: Animation = {
  id: "a",
  name: "Wave",
  tracks: ["t"],
  groups: [{ id: "g", name: "Arms", children: ["t"] }],
  defaultViewportExtent: 2345.123456,
};
const track: SimpleTrack = {
  id: "t",
  name: "Elbow",
  animatableId: "joint",
  inputKey: "joint/angle",
  groupName: "Arm",
  settings: { color: "red", muted: true },
  points: [
    {
      id: "p",
      stamp: -0.000001,
      value: 0,
      transitions: {
        in: { x: -0.000000123456, y: 0.25 },
        out: StandardTransitionType.Sine,
        pairing: TransitionPairing.Paired,
      },
    },
    {
      id: "q",
      stamp: 1234.567891,
      value: 1,
      transitions: {
        in: TransitionDirective.ExplicitHandles,
        out: TransitionDirective.InferredAutoClamped,
        pairing: TransitionPairing.Free,
      },
    },
  ],
};

describe("stored clip format", () => {
  it("round trips integer nanosecond stamps, unrounded handles and editor metadata", () => {
    const document = writeStoredAnimation(animation, { t: track });
    expect(document).toMatchObject({
      formatVersion: 3,
      lengthNs: 2345123456,
      tracks: [{ points: [{ timeNs: -1 }, { timeNs: 1234567891 }] }],
    });
    expect(document.tracks[0].points[0].transitions?.in).toEqual({ dtNs: -0.123456, dv: 0.25 });
    expect(document.tracks[0].settings).toEqual({ color: "red" });
    const runtime = readStoredAnimation(JSON.parse(JSON.stringify(document)));
    expect(runtime).toEqual({
      ...animation,
      formatVersion: 2,
      tracks: [{ ...track, settings: { color: "red" } }],
    });
    expect(JSON.parse(clipTrackJson(track))).toEqual(
      JSON.parse(JSON.stringify(document.tracks[0])),
    );
    expect(resolveStoredAnimationDuration(document)).toBe(animation.defaultViewportExtent);
    expect(
      writeStoredAnimation({ ...animation, defaultViewportExtent: undefined }, { t: track })
        .lengthNs,
    ).toBe(1234567891);
    expect(
      writeStoredAnimation({ ...animation, tracks: [], defaultViewportExtent: undefined }, {})
        .lengthNs,
    ).toBe(1e9);
  });

  it.each([...Object.values(StandardTransitionType), ...Object.values(TransitionDirective)])(
    "round trips named transition %s",
    (transition) => {
      const changed: SimpleTrack = {
        ...track,
        points: [
          { id: "p", stamp: 0.0000016, value: 2, transitions: { in: transition, out: transition } },
        ],
      };
      const saved = writeStoredAnimation(animation, { t: changed });
      expect(saved.tracks[0].points[0].timeNs).toBe(2);
      expect(readStoredAnimation(saved).tracks[0].points[0]).toMatchObject({
        stamp: 0.000002,
        transitions: { in: transition, out: transition },
      });
    },
  );

  it.each([true, false, "idle"])("round trips scalar value %s", (value) => {
    const saved = writeStoredAnimation(animation, {
      t: { ...track, points: [{ id: "p", stamp: 0, value }] },
    });
    expect(readStoredAnimation(saved).tracks[0].points[0].value).toBe(value);
  });

  it("reads formats 1 and 2 in their stated units", () => {
    const legacy = {
      id: "v1",
      name: "v1",
      groups: [],
      duration: 2000,
      tracks: [
        {
          ...track,
          points: [{ id: "p", stamp: 0.5, value: 1, transitions: { in: { x: -0.1, y: 2 } } }],
        },
      ],
    };
    for (const formatVersion of [undefined, 1]) {
      const runtime = readStoredAnimation({ ...legacy, formatVersion });
      expect(runtime.tracks[0].points[0]).toMatchObject({
        stamp: 1000,
        transitions: { in: { x: -200, y: 2 } },
      });
      expect(runtime.defaultViewportExtent).toBe(2000);
      expect(runtime.formatVersion).toBe(2);
    }
    const currentMs = { ...legacy, formatVersion: 2 };
    expect(readStoredAnimation(currentMs)).toBe(currentMs);
    expect(classifyAnimationFormat(2)).toBe(AnimationFormatSupport.Millisecond);
    expect(classifyAnimationFormat(3)).toBe(AnimationFormatSupport.Current);
  });

  it.each([4, 99, "3", -1])("refuses version %s before reading tracks", (version) => {
    const content = {
      formatVersion: version,
      get tracks(): never {
        throw new Error("tracks inspected");
      },
    };
    expect(() => readStoredAnimation(content)).toThrow(
      typeof version === "number" && version > 3
        ? "This animation was saved by a newer version of Studio. Reload Studio to open it."
        : "This animation has an unreadable format version and cannot be opened.",
    );
  });

  it("omits invalid transitions and refuses composite values", () => {
    const invalid: SimpleTrack = {
      ...track,
      points: [
        {
          id: "p",
          stamp: 0,
          value: 1,
          transitions: { in: "unknown" as StandardTransitionType, out: { x: Infinity, y: 1 } },
        },
      ],
    };
    const points = JSON.parse(clipTrackJson(invalid)).points;
    expect(points[0].transitions).toEqual({});
    invalid.points[0].transitions!.out = { x: 1, y: NaN };
    expect(JSON.parse(clipTrackJson(invalid)).points[0].transitions).toEqual({});
    expect(() =>
      writeStoredAnimation(animation, {
        t: { ...track, points: [{ id: "bad", stamp: 0, value: { x: 1, y: 2 } }] },
      }),
    ).toThrow("must be scalar");
  });

  it("flattens known composite schemas and refuses saving an unresolved composite", () => {
    const content = {
      id: "a",
      name: "A",
      groups: [],
      formatVersion: 2,
      tracks: [
        {
          id: "t",
          name: "T",
          animatableId: "vector",
          points: [{ id: "p", stamp: 100, value: { x: 1, y: 2 } }],
        },
      ],
    };
    const known = migrateAnimationData(content, {
      vector: {
        id: "vector",
        name: "V",
        type: "vector2",
        default: { x: 0, y: 0 },
        constraints: {},
      },
    });
    expect(known.animation.tracks.map((item) => item.points[0].value)).toEqual([1, 2]);
    const unresolved = migrateAnimationData(content, {});
    expect(unresolved.animation.tracks[0].points[0].value).toEqual({ x: 1, y: 2 });
    expect(() =>
      writeStoredAnimation({ ...animation, tracks: ["t"] }, { t: unresolved.animation.tracks[0] }),
    ).toThrow("must be scalar");
  });

  it("saves store content as format 3 and reloads it in milliseconds", () => {
    const store = createAnimationStore();
    const document = writeStoredAnimation(animation, { t: track });
    store.getState().addAnimation(document);
    expect(store.getState().tracks.t.points[1].stamp).toBe(1234.567891);
    expect(store.getState().getStorableAnimation("a")).toEqual(document);
    expect(store.getState().getAnimationsToSave()).toEqual([document]);
  });
});
