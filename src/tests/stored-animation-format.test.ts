import { describe, expect, it } from "vitest";
import { migrateAnimationData } from "../functions/migrate-animation-data";
import {
  readStoredAnimation,
  writeStoredAnimation,
  clipTrackJson,
  persistStoredAnimation,
  clipTrackColumns,
  clipDocument,
  type ClipTrack,
} from "../functions/stored-animation-format";
import { randomAnimation } from "../test-fixtures/random-animation";
import {
  AnimationFormatSupport,
  classifyAnimationFormat,
} from "../functions/migrate-animation-format";
import { resolveStoredAnimationDuration } from "../functions/compute-animation-extent";
import { StandardTransitionType, TransitionDirective, TransitionPairing } from "../types";
import type { Animation, StoredAnimation } from "../types";
import type { SimpleTrack } from "../types/data/simple-track";
import { createAnimationStore } from "../store";
import { NotAnAnimationError } from "../functions/is-stored-animation-content";
import {
  malformedAnimationCases,
  nanosecondDocument,
  millisecondDocument,
} from "../test-fixtures/stored-animation-content";

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
        in: { x: -0.125, y: 0.25 },
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
  it("round trips integer nanosecond stamps, integer handles and editor metadata", () => {
    const document = writeStoredAnimation(animation, { t: track });
    expect(document).toMatchObject({
      formatVersion: 3,
      defaultViewportExtentNs: 2345123456,
      tracks: [{ points: [{ timeNs: -1 }, { timeNs: 1234567891 }] }],
    });
    expect(document.tracks[0].points[0].transitions?.in).toEqual({ dtNs: -125000, dv: 0.25 });
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
      clipDocument({ ...animation, defaultViewportExtent: undefined }, { t: track }).lengthNs,
    ).toBe(1234567891);
    expect(
      clipDocument({ ...animation, tracks: [], defaultViewportExtent: undefined }, {}).lengthNs,
    ).toBe(1e9);
  });

  it("rounds stored handle nanoseconds while preserving the engine's fractional handles", () => {
    const fractional = structuredClone(track);
    fractional.points[0].transitions!.in = { x: -0.000000123456, y: 0.25 };
    const stored = writeStoredAnimation(animation, { t: fractional });
    expect(stored.tracks[0].points[0].transitions!.in).toEqual({ dtNs: -0, dv: 0.25 });
    expect(readStoredAnimation(stored).tracks[0].points[0].transitions!.in).toEqual({
      x: -0,
      y: 0.25,
    });
    const expected = { dtNs: -0.123456, dv: 0.25 };
    expect(clipDocument(animation, { t: fractional }).tracks[0].points[0].transitions!.in).toEqual(
      expected,
    );
    expect(JSON.parse(clipTrackJson(fractional)).points[0].transitions.in).toEqual(expected);
    expect(clipTrackColumns(fractional, () => 0)!.transitions[1]).toBe(expected.dtNs);
  });

  it.each([
    [5000, 2000, 5000e6],
    [500, 3000, 3000e6],
    [-250, undefined, 1e9],
  ])("prepares a clip from content end %s and viewport %s", (stamp, viewport, expected) => {
    const source = { ...track, points: [{ id: "p", stamp, value: 1 }] };
    expect(
      clipDocument({ ...animation, defaultViewportExtent: viewport }, { t: source }).lengthNs,
    ).toBe(expected);
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

  it("loads format 3 and saves format 2 in milliseconds", () => {
    const store = createAnimationStore();
    const document = writeStoredAnimation(animation, { t: track });
    store.getState().addAnimation(document);
    expect(store.getState().tracks.t.points[1].stamp).toBe(1234.567891);
    expect(store.getState().getStorableAnimation("a")).toEqual(readStoredAnimation(document));
    expect(store.getState().getAnimationsToSave()).toEqual([readStoredAnimation(document)]);
  });

  it("writes a number track's columns as its document writes its points", () => {
    const names = [...Object.values(StandardTransitionType), ...Object.values(TransitionDirective)];
    const codeOf = (name: string) => {
      const code = names.indexOf(name as never);
      return code < 0 ? undefined : code;
    };
    const decode = (columns: Float64Array, at: number) =>
      columns[at] === -1
        ? undefined
        : columns[at] === -2
          ? { dtNs: columns[at + 1], dv: columns[at + 2] }
          : names[columns[at]];
    const odd: SimpleTrack = {
      ...track,
      points: [
        ...track.points,
        {
          id: "r",
          stamp: 2000.0000004,
          value: -0,
          transitions: { in: { x: -0, y: NaN }, out: "unknown" as StandardTransitionType },
        },
      ],
    };
    const generated = Array.from({ length: 30 }, (_, seed) =>
      Object.values(randomAnimation(seed + 1).tracks),
    ).flat();
    for (const each of [track, odd, ...generated]) {
      const document = JSON.parse(clipTrackJson(each)) as { points: ClipTrack["points"] };
      const columns = clipTrackColumns(each, codeOf);
      if (!document.points.every((point) => typeof point.value === "number")) {
        expect(columns).toBeUndefined();
        continue;
      }
      expect(Array.from(columns!.timesNs)).toEqual(document.points.map((point) => point.timeNs));
      expect(Array.from(columns!.values)).toEqual(document.points.map((point) => point.value));
      document.points.forEach((point, i) => {
        expect(decode(columns!.transitions, i * 6)).toEqual(point.transitions?.in);
        expect(decode(columns!.transitions, i * 6 + 3)).toEqual(point.transitions?.out);
      });
    }
    expect(() => clipTrackColumns(track, () => undefined)).toThrow("No code");
  });

  it("stores only the nanosecond viewport hint and ignores an extraneous clip length", () => {
    const document = writeStoredAnimation(animation, { t: track });
    expect(document).not.toHaveProperty("lengthNs");
    expect(document).not.toHaveProperty("defaultViewportExtent");
    expect(readStoredAnimation({ ...document, lengthNs: 10e9 }).defaultViewportExtent).toBe(
      animation.defaultViewportExtent,
    );
    expect(
      readStoredAnimation({ ...nanosecondDocument(), defaultViewportExtentNs: undefined })
        .defaultViewportExtent,
    ).toBeUndefined();
  });

  it.each(malformedAnimationCases)("refuses %s before conversion", (_rule, content) => {
    expect(() => readStoredAnimation(content)).toThrow(NotAnAnimationError);
  });

  it("accepts optional metadata absent and safe integer boundaries", () => {
    expect(
      readStoredAnimation({ formatVersion: 3, id: "a", name: "A", groups: [], tracks: [] }).tracks,
    ).toEqual([]);
    for (const timeNs of [Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER]) {
      const document = nanosecondDocument();
      document.tracks[0].points[0].timeNs = timeNs;
      document.tracks[0].points[0].transitions.in.dtNs = timeNs;
      expect(readStoredAnimation(document).tracks[0].points[0].stamp).toBe(timeNs / 1e6);
    }
  });

  it("saves a loaded format-2 document unchanged field for field", () => {
    const input = millisecondDocument();
    const store = createAnimationStore();
    store.getState().addAnimation(input);
    expect(JSON.parse(JSON.stringify(store.getState().getStorableAnimation(input.id)))).toEqual(
      input,
    );
    expect(JSON.parse(JSON.stringify(persistStoredAnimation(input)))).toEqual(input);
  });

  it("preserves a duration-only format-2 document while using its viewport floor", () => {
    const { defaultViewportExtent: _, ...input } = millisecondDocument();
    const store = createAnimationStore();
    store.getState().addAnimation(input);
    expect(store.getState().animations[input.id].defaultViewportExtent).toBe(input.duration);
    expect(JSON.parse(JSON.stringify(store.getState().getStorableAnimation(input.id)))).toEqual(
      input,
    );
  });

  it("loads, edits, saves and reloads every format-2 field including inputKey", () => {
    const input = millisecondDocument();
    const store = createAnimationStore();
    store.getState().addAnimation(input);
    const edited = structuredClone(input);
    edited.tracks[0].points.at(-1)!.value = 42;
    store.getState().updateKeypoint("t", { id: edited.tracks[0].points.at(-1)!.id, value: 42 });
    const saved = JSON.parse(JSON.stringify(store.getState().getStorableAnimation(input.id)));
    expect(saved).toEqual(edited);
    const reloaded = createAnimationStore();
    reloaded.getState().addAnimation(saved);
    expect(JSON.parse(JSON.stringify(reloaded.getState().getStorableAnimation(input.id)))).toEqual(
      edited,
    );
    expect(readStoredAnimation(saved)).toEqual(edited);
  });

  it("saves an animation holding a composite value in format 2, as it was read", () => {
    const legacy = {
      id: "a",
      name: "A",
      formatVersion: 2,
      groups: [{ id: "g", name: "G", children: ["before", "pose"] }],
      tracks: [
        { id: "before", name: "B", animatableId: "b", points: [{ id: "k", stamp: 0, value: 2 }] },
        {
          id: "pose",
          name: "Head",
          animatableId: "head",
          settings: { color: "red", muted: true },
          points: [
            { id: "p", stamp: 0, value: { x: 1, y: 2, z: 3 } },
            { id: "q", stamp: 500, value: 7 },
          ],
        },
      ],
    };
    const store = createAnimationStore();
    store.getState().addAnimation(legacy as unknown as StoredAnimation);
    // Mute is runtime state, left out of what is saved.
    const asRead = {
      ...legacy,
      tracks: [legacy.tracks[0], { ...legacy.tracks[1], settings: { color: "red" } }],
    };
    expect(store.getState().getStorableAnimation("a")).toEqual(asRead);
    expect(persistStoredAnimation(legacy)).toEqual(asRead);
    // Scalars and composites both save in format 2.
    store.getState().updateTrack({ id: "pose", points: [{ id: "p", stamp: 0, value: 1 }] });
    expect(store.getState().getStorableAnimation("a").formatVersion).toBe(2);
  });
});
