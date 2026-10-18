import { describe, expect, it } from "vitest";
import { computeRowData } from "../functions/compute-row-data";
import { computeInstanceTrackViolations } from "../functions/compute-track-violations";
import { createTestAnimationStore, TRACK_IDS } from "../test-fixtures/animation-store-factory";
import { TrackRender, ViolationType } from "../types";
import { trackCurve, type TrackEvaluator } from "../functions/track-curve";
import { testTrackEvaluator } from "../test-fixtures/track-evaluator";
import { randomAnimation } from "../test-fixtures/random-animation";
import { referenceCurve } from "../test-fixtures/reference-curve";
import type { SimpleTrack } from "../types/data/simple-track";
import { StandardTransitionType } from "../types";

const ramp: SimpleTrack = {
  id: "r",
  name: "ramp",
  animatableId: "x",
  points: [
    { id: "a", stamp: -1, value: 0, transitions: { out: StandardTransitionType.Linear } },
    { id: "b", stamp: 1, value: 2, transitions: { in: StandardTransitionType.Linear } },
  ],
};

describe("exact track evaluation", () => {
  it("evaluates a short ramp without a bake or clip duration, including before zero", () => {
    const curve = trackCurve(ramp, testTrackEvaluator)!;
    const values = curve.values(new Float64Array([-10, -0.875, 0.25, 10]));
    [0, 0.125, 1.25, 2].forEach((expected, i) => expect(values[i]).toBeCloseTo(expected, 14));
    expect(curve(0.123456789)).toBeCloseTo(1.123456789, 12);
    expect(curve.velocity(0.123456789)).toBeCloseTo(1000, 9);
    expect(Array.from(curve.velocities(new Float64Array([-10, 0, 10]))!)).toEqual([0, 1000, 0]);
    expect(trackCurve(ramp, undefined)).toBeUndefined();
    expect(trackCurve({ ...ramp, points: [] }, testTrackEvaluator)).toBeUndefined();
  });

  it.each([
    ["a", "b", "c"],
    [false, true, false],
  ])("steps at interior knots and plays the last at its instant: %s", (a, b, c) => {
    const track: SimpleTrack = {
      ...ramp,
      points: [
        { id: "a", stamp: -10, value: a },
        { id: "b", stamp: 0, value: b },
        { id: "c", stamp: 10, value: c },
      ],
    };
    const curve = trackCurve(track, testTrackEvaluator)!;
    expect(curve.values(new Float64Array([-20, -10, 0, 0.001, 10, 20]))).toEqual([
      a,
      a,
      a,
      b,
      c,
      c,
    ]);
    expect(curve.velocity(1)).toBeUndefined();
    expect(curve.velocities(new Float64Array([1]))).toBeUndefined();
  });

  it("lets the later duplicate take over and holds a track with one key", () => {
    const track: SimpleTrack = {
      ...ramp,
      points: [
        { id: "a", stamp: -1, value: 1 },
        { id: "b", stamp: -1, value: 2 },
      ],
    };
    expect(trackCurve(track, testTrackEvaluator)!(-2)).toBe(1);
    expect(trackCurve(track, testTrackEvaluator)!(-1)).toBe(2);
    expect(trackCurve(track, testTrackEvaluator)!(0)).toBe(2);
    expect(trackCurve({ ...track, points: [track.points[0]] }, testTrackEvaluator)!(-100)).toBe(1);
  });

  it("caches by content, recompiles edits, isolates evaluators and frees evictions", () => {
    let compiles = 0;
    let frees = 0;
    const evaluator: TrackEvaluator = {
      compile(json) {
        compiles += 1;
        const compiled = testTrackEvaluator.compile(json);
        let freed = false;
        return {
          ...compiled,
          values(times) {
            if (freed) throw new Error("freed resource");
            return compiled.values(times);
          },
          free: () => {
            frees += 1;
            freed = true;
          },
        };
      },
    };
    const curve = trackCurve(ramp, evaluator);
    expect(trackCurve(structuredClone(ramp), evaluator)).toBe(curve);
    expect(compiles).toBe(1);
    const edited = structuredClone(ramp);
    edited.points[1].value = 3;
    expect(trackCurve(edited, evaluator)).not.toBe(curve);
    expect(trackCurve(ramp, testTrackEvaluator)).not.toBe(curve);
    for (let i = 0; i < 512; i += 1) trackCurve({ ...ramp, name: `copy-${i}` }, evaluator);
    expect(frees).toBe(2);
    expect(curve!(0)).toBeCloseTo(1, 12);
    expect(compiles).toBe(515);
    expect(
      trackCurve(ramp, {
        compile() {
          throw new Error("cannot compile");
        },
      }),
    ).toBeUndefined();
  });

  it("matches the exact oracle on the generated scalar corpus", () => {
    for (let seed = 0; seed < 120; seed += 1) {
      const generated = randomAnimation(seed);
      for (const track of Object.values(generated.tracks)) {
        const curve = trackCurve(track, testTrackEvaluator)!;
        const oracle = referenceCurve(track, { active: true, timescale: 1, offset: 0 });
        const times = Float64Array.from([
          -100,
          ...track.points.map((point) => point.stamp),
          1.123456,
          713.42,
          4000,
        ]);
        const values = curve.values(times);
        const velocities = curve.velocities(times);
        times.forEach((time, i) => {
          const expected = oracle(time);
          if (typeof expected.value === "number") {
            expect(values[i]).toBeCloseTo(expected.value, 9);
            expect(velocities![i]).toBeCloseTo(expected.velocity!, 7);
          } else expect(values[i]).toBe(expected.value);
        });
      }
    }
  });
});

it("draws every value segment, including before zero, with one host batch per row", () => {
  const store = createTestAnimationStore({ includeNamespaceB: false });
  const state = store.getState();
  const row = Object.values(state.instancedTrackSources).find(
    (candidate) => candidate.data.length === 1 && candidate.data[0].trackId === TRACK_IDS.OPACITY,
  )!;
  const track = state.tracks[TRACK_IDS.OPACITY];
  let batches = 0;
  let negativeTime = false;
  const evaluator: TrackEvaluator = {
    compile() {
      return {
        kind: "number",
        values(times) {
          batches += 1;
          negativeTime ||= times.some((time) => time < 0);
          return new Float64Array(times.length).fill(123);
        },
        velocities: () => undefined,
        free() {},
      };
    },
  };
  const computed = computeRowData(
    row,
    {
      ...state.tracks,
      [track.id]: {
        ...track,
        points: [
          { id: "before", stamp: -100, value: 0 },
          { id: "after", stamp: 100, value: 1 },
        ],
      },
    },
    {},
    state.animatables,
    undefined,
    state.selectionState,
    { animations: state.animations, namespaces: state.namespaces, trackEvaluator: evaluator },
  );
  expect(batches).toBe(1);
  expect(negativeTime).toBe(true);
  const segment = computed.render!.segments!.find(
    (candidate) => candidate.startKeypointId === "before" && candidate.endKeypointId === "after",
  )!;
  expect(segment).toBeDefined();
  const sample = segment.samples[TrackRender.Spline]!;
  if (sample.kind !== "direct") throw new Error("Expected direct row samples");
  for (let i = 1; i < sample.points.length; i += 2) expect(sample.points[i]).toBe(123);
});

it("batches violation values and exact velocities in world time", () => {
  let valueCalls = 0;
  let velocityCalls = 0;
  const curve = Object.assign(
    () => {
      throw new Error("scalar evaluation in batch analysis");
    },
    {
      values(times: Float64Array) {
        valueCalls += 1;
        return new Float64Array(times.length);
      },
      velocities(times: Float64Array) {
        velocityCalls += 1;
        return new Float64Array(times.length).fill(2);
      },
      velocity: () => 2,
    },
  );
  const violations = computeInstanceTrackViolations(curve, 1000, 2, "t", "ns", "i", {
    id: "x",
    name: "X",
    type: "number",
    default: 0,
    constraints: { velocity: 3 },
  });
  expect(valueCalls).toBe(1);
  expect(velocityCalls).toBe(1);
  expect(violations).toMatchObject([
    { type: ViolationType.Velocity, stampRange: { start: 0, end: 1000 } },
  ]);
});
