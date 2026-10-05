import { describe, expect, test } from "vitest";
import { computeTrackInterpolator } from "../../functions/compute-track-interpolator";
import { resolveAnimationDuration } from "../../functions/compute-animation-extent";
import { toModuleClip, type AroraValueJson, type ModuleClip } from "../../functions/to-module-clip";
import { createTestAnimationStore } from "../../test-fixtures";
import type { Animation, AnimationInstance } from "../../types";
import { StandardTransitionType } from "../../types";
import type { SimpleKeypoint, SimpleTrack } from "../../types/data/simple-track";
import { randomAnimation } from "./random-animation";
import { studioCurve } from "./studio-curve";
import {
  startVizijRuntimeHost,
  type ModuleClipHost,
  type ModuleSample,
} from "./vizij-runtime-host";

const RATE_HZ = 100;
const FRAME_MS = 1000 / RATE_HZ;
const INSTANCE = "instance-1";

/**
 * How closely the module reproduces a numeric Studio curve. It samples in
 * `f32` — clip time normalized to the duration, the timing Bézier inverted by
 * bisection to 1e-6 of a segment — so its value at `t` is the curve's at a
 * time within a few parts per million of the duration, rounded to `f32`.
 */
const TIME_TOLERANCE = 2e-6;
const VALUE_TOLERANCE = 1e-6;

/**
 * How far `computeTrackInterpolator` strays in time: it stops its bisection
 * after twelve steps, so its parameter is off by up to 2^-13, a time error of
 * up to 3·2^-13 of a segment.
 */
const INTERPOLATOR_TIME_TOLERANCE = 4e-4;

/** The module, run in Node; any `ModuleClipHost` serves these tests. */
const host: ModuleClipHost = startVizijRuntimeHost();

describe("toModuleClip", () => {
  test("keys each track under the instance and the animatable's device key", () => {
    const { animation, tracks } = buildScene([
      buildTrack("a", "elbow", [point(0, 0), point(500, 1)]),
      buildTrack("b", "unbound", [point(0, 0), point(500, 1)]),
      buildTrack("c", "wrist", []),
      buildTrack("d", "elbow", [point(0, 5), point(500, 6)]),
      buildTrack("e", "face", [point(0, "idle")]),
    ]);
    const clip = decode(
      toModuleClip(animation, tracks, {
        instanceId: INSTANCE,
        keys: { elbow: "elbow_joint", wrist: "wrist_joint", face: "face" },
      }),
    );

    expect(clip.tracks.map((t) => [t.id, t.animatable_id])).toEqual([
      ["a", `animation/${INSTANCE}/elbow_joint`],
      ["e", `animation/${INSTANCE}/face`],
    ]);
  });

  test("lasts as long as Studio's player plays the animation, in whole milliseconds", () => {
    const short = buildScene([buildTrack("a", "x", [point(0, 0), point(400, 1)])]);
    expect(clipOf(short).duration).toBe(1000);
    expect(clipOf(short).tracks[0].points.map((p) => p.stamp)).toEqual([0, 0.4]);

    const long = buildScene([buildTrack("a", "x", [point(100, 0), point(2500.25, 1)])]);
    expect(clipOf(long).duration).toBe(2501);
    expect(clipOf(long).duration).toBe(
      Math.ceil(resolveAnimationDuration(long.animation, long.tracks)),
    );

    const framed = buildScene([buildTrack("a", "x", [point(0, 0)])]);
    framed.animation.defaultViewportExtent = 3000;
    expect(clipOf(framed).duration).toBe(3000);
  });

  test("normalizes Studio's handles onto each segment", () => {
    const { points } = clipOf(
      buildScene([
        buildTrack("a", "x", [
          point(0, 0, { out: { x: 250, y: 5 } }),
          point(1000, 10, { in: { x: -500, y: 0 } }),
          point(2000, 0, { out: StandardTransitionType.Cubic }),
        ]),
      ]),
    ).tracks[0];

    expect(points[0].out).toEqual([{ x: 0.25, y: 0.5 }]);
    expect(points[1].in).toEqual([{ x: 0.5, y: 1 }]);
    // Cubic, Studio's default on both sides: out (0.65, 0), in (0.35, 1).
    expect(points[1].out[0].x).toBeCloseTo(0.65, 12);
    expect(points[1].out[0].y).toBeCloseTo(0, 12);
    expect(points[2].in[0].x).toBeCloseTo(0.35, 12);
    expect(points[2].in[0].y).toBeCloseTo(1, 12);
    expect(points[0].in).toEqual([]);
    expect(points[2].out).toEqual([]);
  });

  test("cuts a segment where its value turns back, at the curve's own value", () => {
    // From 0 back to 0 through a bump: the module, easing between keypoint
    // values, could not draw it in one segment.
    const bump = buildScene([
      buildTrack("a", "x", [
        point(0, 0, { out: { x: 300, y: 8 } }),
        point(1000, 0, { in: { x: -300, y: 8 } }),
      ]),
    ]);
    const { points } = clipOf(bump).tracks[0];

    expect(points.map((p) => p.id)).toEqual(["k0", "k0~1", "k1"]);
    expect(points[1].stamp).toBeCloseTo(0.5, 12);
    expect(points[1].value).toBeCloseTo(6, 12); // (0 + 3·8 + 3·8 + 0) / 8
    for (const p of points.slice(0, 2)) {
      for (const handle of p.out) expect(Math.abs(handle.y)).toBeLessThanOrEqual(2);
    }
  });

  test("carries strings and booleans as held values, with no handles", () => {
    const { tracks } = clipOf(
      buildScene([
        buildTrack("s", "face", [point(0, "idle"), point(500, "smile")]),
        buildTrack("b", "led", [point(0, false), point(500, true)]),
        buildTrack("n", "x", [point(0, 1.5), point(500, -2)]),
      ]),
    );

    expect(tracks.map((t) => t.points.map((p) => p.raw))).toEqual([
      [{ str: "idle" }, { str: "smile" }],
      [{ bool: false }, { bool: true }],
      [{ f64: 1.5 }, { f64: -2 }],
    ]);
    expect(tracks[0].points[0].out).toEqual([]);
    expect(tracks[1].points[1].in).toEqual([]);
  });

  test("leaves out the keypoints sharing an end stamp that Studio never plays", () => {
    // Before its first segment Studio holds the last keypoint on the first
    // stamp; after its last segment, the first keypoint on the last stamp.
    const ids = (points: SimpleKeypoint[]) =>
      clipOf(buildScene([buildTrack("a", "x", points)])).tracks[0].points.map((p) => p.id);

    expect(ids([point(0, 1), point(0, 2), point(500, 3), point(500, 4)])).toEqual(["k1", "k2"]);
    expect(ids([point(0, 1), point(250, 2), point(250, 3), point(500, 4)])).toEqual([
      "k0",
      "k1",
      "k2",
      "k3",
    ]);
    expect(ids([point(300, "a"), point(300, "b")])).toEqual(["k0"]);
    expect(ids([point(300, true)])).toEqual(["k0"]);
  });

  test("refuses a track that mixes value types or holds a non-finite number or stamp", () => {
    const mixed = buildScene([buildTrack("a", "x", [point(0, 0), point(500, "one")])]);
    expect(() => clipOf(mixed)).toThrow(/mixes number and string/);
    const infinite = buildScene([buildTrack("a", "x", [point(0, 0), point(500, Infinity)])]);
    expect(() => clipOf(infinite)).toThrow(/not a finite number/);
    const unstamped = buildScene([buildTrack("a", "x", [point(0, 0), point(NaN, 1)])]);
    expect(() => clipOf(unstamped)).toThrow(/no finite stamp/);
  });
});

describe("the converted clip through the Vizij animation module", () => {
  const state = createTestAnimationStore().getState();
  const fixtures = Object.values(state.animations).map((animation) => ({
    animation,
    tracks: state.tracks as Record<string, SimpleTrack>,
  }));

  test.each(fixtures.map((f) => [f.animation.id, f] as const))(
    "plays fixture %s as Studio's interpolator does",
    async (_, fixture) => {
      for (const run of [await playThroughModule(fixture), await bakeThroughModule(fixture)]) {
        for (const { track, samples } of run.tracks) {
          const interpolator = computeTrackInterpolator(track, identityInstance(fixture.animation));
          const exact = studioCurve(track);
          const curve = (t: number) => exact(t) as number;
          samples.forEach((sample, i) => {
            const at = run.timesMs[i];
            expectOnCurve(sample, curve, track, at, TIME_TOLERANCE * run.duration);
            // The exact curve is the interpolator's, solved to double precision.
            const window = INTERPOLATOR_TIME_TOLERANCE * run.duration;
            expectOnCurve(interpolator(at) as number, curve, track, at, window);
          });
        }
      }
    },
  );

  const seeds = Array.from({ length: 120 }, (_, i) => i + 1);
  test.each(seeds)("plays generated animation %i as Studio does", async (seed) => {
    const generated = randomAnimation(seed);
    const played = await playThroughModule(generated);
    const baked = await bakeThroughModule(generated);

    for (const run of [played, baked]) {
      for (const { track, samples } of run.tracks) {
        const curve = studioCurve(track);
        // Studio's interpolator throws on a string track (see studioCurve).
        const interpolator =
          typeof samples[0] === "string"
            ? undefined
            : computeTrackInterpolator(track, identityInstance(generated.animation));
        const window = TIME_TOLERANCE * run.duration;
        const lastStamp = Math.max(...track.points.map((p) => p.stamp));
        samples.forEach((sample, i) => {
          const at = run.timesMs[i];
          if (typeof sample === "number") {
            expectOnCurve(sample, (t) => curve(t) as number, track, at, window);
            return;
          }
          // At its last keypoint's own instant, a step track already plays
          // that keypoint in the module, where Studio's interpolator holds
          // the previous value until the next instant. A clip played to its
          // end rests there.
          const settled = at >= lastStamp - window ? Infinity : at;
          expect(sample, `${track.id} at ${at} ms`).toBe(curve(settled));
          if (interpolator) {
            expect(sample, `${track.id} at ${at} ms`).toBe(interpolator(settled));
          }
        });
      }
    }
  });
});

interface ModuleRun {
  duration: number;
  /** The clip time of each sample, in milliseconds. */
  timesMs: number[];
  tracks: { track: SimpleTrack; samples: ModuleSample[] }[];
}

/** The animation played by the module's step at 100 Hz, from 0 past its end. */
async function playThroughModule(scene: Scene): Promise<ModuleRun> {
  const clip = toModuleClip(scene.animation, scene.tracks, {
    instanceId: INSTANCE,
    keys: identityKeys(scene),
  });
  const duration = decode(clip).duration;
  const { series, timesMs } = await host.play(clip, FRAME_MS, Math.ceil(duration / FRAME_MS) + 2);
  return moduleRun(scene, duration, timesMs, series);
}

/** The animation as the module's `bake` samples it at 100 Hz. */
async function bakeThroughModule(scene: Scene): Promise<ModuleRun> {
  const clip = toModuleClip(scene.animation, scene.tracks, {
    instanceId: INSTANCE,
    keys: identityKeys(scene),
  });
  const duration = decode(clip).duration;
  const series = await host.bake(clip, RATE_HZ);
  const frames = [...series.values()][0]?.length ?? 0;
  const timesMs = Array.from({ length: frames }, (_, i) => Math.min(i * FRAME_MS, duration));
  return moduleRun(scene, duration, timesMs, series);
}

function moduleRun(
  scene: Scene,
  duration: number,
  timesMs: number[],
  series: Map<string, ModuleSample[]>,
): ModuleRun {
  const played = scene.animation.tracks
    .map((id) => scene.tracks[id])
    .filter((track) => track.points.length > 0);
  const tracks = played.map((track) => {
    const samples = series.get(`animation/${INSTANCE}/${track.animatableId}`);
    if (!samples) throw new Error(`the module played nothing for ${track.id}`);
    expect(samples).toHaveLength(timesMs.length);
    return { track, samples };
  });
  return { duration, timesMs, tracks };
}

/**
 * Asserts a sampled number is the track's curve at some time within `window`
 * of `at`, to `VALUE_TOLERANCE` of the track's magnitude (its largest
 * keypoint value, at least 1). The curve's range over the window is taken at
 * its ends, its middle and the keypoints inside it, where a handle vertical
 * in time puts an extremum.
 */
function expectOnCurve(
  sample: ModuleSample,
  curve: (t: number) => number,
  track: SimpleTrack,
  at: number,
  window: number,
) {
  if (typeof sample !== "number") throw new Error(`expected a number at ${at} ms, got ${sample}`);
  const stamps = track.points.map((p) => p.stamp).filter((t) => Math.abs(t - at) < window);
  const times = [at - window, at, at + window, ...stamps];
  const around = times.map(curve);
  const scale = Math.max(
    1,
    ...around.map(Math.abs),
    ...track.points.map((p) => Math.abs(p.value as number)),
  );
  const slack = VALUE_TOLERANCE * scale;
  const low = Math.min(...around) - slack;
  const high = Math.max(...around) + slack;
  const message = `${track.id} at ${at} ms: ${sample} outside [${low}, ${high}]`;
  expect(sample, message).toBeGreaterThanOrEqual(low);
  expect(sample, message).toBeLessThanOrEqual(high);
}

// --- building animations ------------------------------------------------------

interface Scene {
  animation: Animation;
  tracks: Record<string, SimpleTrack>;
}

function buildScene(tracks: SimpleTrack[]): Scene {
  return {
    animation: { id: "animation", name: "animation", tracks: tracks.map((t) => t.id), groups: [] },
    tracks: Object.fromEntries(tracks.map((t) => [t.id, t])),
  };
}

function buildTrack(id: string, animatableId: string, points: SimpleKeypoint[]): SimpleTrack {
  points.forEach((p, i) => (p.id = `k${i}`));
  return { id, name: id, animatableId, points };
}

function point(
  stamp: number,
  value: SimpleKeypoint["value"],
  transitions?: SimpleKeypoint["transitions"],
): SimpleKeypoint {
  return { id: "", stamp, value, transitions };
}

function identityKeys(scene: Scene): Record<string, string> {
  return Object.fromEntries(
    Object.values(scene.tracks).map((t) => [t.animatableId, t.animatableId]),
  );
}

function identityInstance(animation: Animation): AnimationInstance {
  return {
    id: INSTANCE,
    animationId: animation.id,
    settings: { active: true, offset: 0, timescale: 1 },
  };
}

function clipOf(scene: Scene) {
  return decode(
    toModuleClip(scene.animation, scene.tracks, {
      instanceId: INSTANCE,
      keys: identityKeys(scene),
    }),
  );
}

// --- reading a clip back --------------------------------------------------------

interface Handle {
  x: number;
  y: number;
}

/** A module clip with its fields named, for assertions. */
function decode(clip: ModuleClip) {
  const fields = byName(clip.struct.fields, ["name", "duration", "tracks"]);
  return {
    name: str(fields.name),
    duration: num(fields.duration),
    tracks: elements(fields.tracks).map((t) => {
      const track = byName(t.fields, ["id", "name", "animatable_id", "points"]);
      return {
        id: str(track.id),
        animatable_id: str(track.animatable_id),
        points: elements(track.points).map((p) => {
          const kp = byName(p.fields, ["id", "stamp", "value", "in", "out"]);
          const handles = (v: AroraValueJson): Handle[] =>
            elements(v).map((h) => {
              const xy = byName(h.fields, ["x", "y"]);
              return { x: num(xy.x), y: num(xy.y) };
            });
          return {
            id: str(kp.id),
            stamp: num(kp.stamp),
            raw: kp.value,
            value: num(kp.value),
            in: handles(kp.in),
            out: handles(kp.out),
          };
        }),
      };
    }),
  };
}

function byName<N extends string>(
  fields: { id: string; value: AroraValueJson }[],
  names: N[],
): Record<N, AroraValueJson> {
  expect(fields).toHaveLength(names.length);
  return Object.fromEntries(names.map((n, i) => [n, fields[i].value])) as Record<N, AroraValueJson>;
}

function elements(value: AroraValueJson) {
  if (!("structs" in value)) throw new Error(`expected structures, got ${JSON.stringify(value)}`);
  return value.structs.elements;
}

function str(value: AroraValueJson): string {
  if (!("str" in value)) throw new Error(`expected a string, got ${JSON.stringify(value)}`);
  return value.str;
}

function num(value: AroraValueJson): number {
  if ("f32" in value) return value.f32;
  if ("f64" in value) return value.f64;
  if ("u32" in value) return value.u32;
  return NaN;
}
