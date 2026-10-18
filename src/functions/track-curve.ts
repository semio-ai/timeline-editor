import type { SimpleRawValue, SimpleTrack } from "../types/data/simple-track";
import { clipTrackJson } from "./stored-animation-format";

/** A track compiled for evaluation by the host (Studio: @semio/studio-arora's CompiledTrack). */
export interface CompiledCurve {
  /** "number" | "boolean" | "string"; undefined for a track with no keypoint. */
  readonly kind: string | undefined;
  /** Values at clip-local times in milliseconds. */
  values(timesMs: Float64Array): Float64Array | (boolean | string)[];
  /** Value units per second of clip-local time; undefined for nonnumeric tracks. */
  velocities(timesMs: Float64Array): Float64Array | undefined;
  /**
   * A number track's values, then its velocities, at clip-local times in
   * milliseconds, from one evaluation: an array twice as long as `timesMs`.
   * Undefined for nonnumeric tracks.
   */
  numbers(timesMs: Float64Array): Float64Array | undefined;
  /** A number track's value at one clip-local time in milliseconds; NaN for any other track. */
  numberAt(timeMs: number): number;
  /** A number track's velocity at one clip-local time in milliseconds; NaN for any other track. */
  velocityAt(timeMs: number): number;
  /**
   * A number track drawn over each range from `startsMs[i]` to `endsMs[i]`
   * (clip-local ms): `count` points per range, times and values interleaved
   * (`[t, v, t, v, …]`), on the curve, the first at the range's start and the
   * last at its end, in increasing time. Undefined for nonnumeric tracks.
   */
  polyline(startsMs: Float64Array, endsMs: Float64Array, count: number): Float64Array | undefined;
  free(): void;
}
export interface TrackEvaluator {
  /** Compile a clip 2.0 JSON track document. Throws when it cannot. */
  compile(trackJson: string): CompiledCurve;
}
export type TrackCurve = ((localMs: number) => SimpleRawValue | undefined) & {
  values(timesMs: Float64Array): Float64Array | (boolean | string)[];
  velocity(localMs: number): number | undefined;
  velocities(timesMs: Float64Array): Float64Array | undefined;
  /** Values and velocities from one evaluation; undefined for nonnumeric tracks. */
  numbers(timesMs: Float64Array): { values: Float64Array; velocities: Float64Array } | undefined;
  polyline(startsMs: Float64Array, endsMs: Float64Array, count: number): Float64Array | undefined;
};

interface CachedCurve {
  compiled: CompiledCurve;
  curve: TrackCurve;
  /** Set when the cache frees `compiled`; a curve still held reacquires it. */
  freed: boolean;
}
const compiledByContent = new WeakMap<TrackEvaluator, Map<string, CachedCurve>>();
const CONTENT_ENTRIES = 512;

function acquire(content: string, evaluator: TrackEvaluator): CachedCurve {
  let cache = compiledByContent.get(evaluator);
  if (!cache) {
    cache = new Map();
    compiledByContent.set(evaluator, cache);
  }
  let entry = cache.get(content);
  if (!entry) {
    const compiled = evaluator.compile(content);
    const number = compiled.kind === "number";
    // A snapshot can hold a curve after the cache evicts its compiled track,
    // so the curve compiles the track again rather than call a freed one.
    let held: CachedCurve | undefined;
    const resource = () => {
      if (held!.freed) held = acquire(content, evaluator);
      return held!.compiled;
    };
    const curve: TrackCurve = Object.assign(
      (localMs: number) =>
        number ? resource().numberAt(localMs) : resource().values(new Float64Array([localMs]))[0],
      {
        values: (timesMs: Float64Array) => resource().values(timesMs),
        velocity: (localMs: number) => (number ? resource().velocityAt(localMs) : undefined),
        velocities: (timesMs: Float64Array) => resource().velocities(timesMs),
        numbers: (timesMs: Float64Array) => {
          const numbers = number ? resource().numbers(timesMs) : undefined;
          return (
            numbers && {
              values: numbers.subarray(0, timesMs.length),
              velocities: numbers.subarray(timesMs.length),
            }
          );
        },
        polyline: (startsMs: Float64Array, endsMs: Float64Array, count: number) =>
          number ? resource().polyline(startsMs, endsMs, count) : undefined,
      },
    );
    entry = { compiled, curve, freed: false };
    held = entry;
  } else {
    cache.delete(content);
  }
  cache.set(content, entry);
  if (cache.size > CONTENT_ENTRIES) {
    const oldest = cache.keys().next().value!;
    const evicted = cache.get(oldest)!;
    cache.delete(oldest);
    evicted.freed = true;
    evicted.compiled.free();
  }
  return entry;
}

/**
 * The clip JSON of each frozen track. The store's committed tracks are frozen
 * (immer freezes its state deeply), so one cannot change after its JSON is
 * written; any other track, such as a draft being edited or a drag's preview,
 * is written afresh at every call.
 */
const jsonOfFrozenTrack = new WeakMap<SimpleTrack, string>();

function trackJson(track: SimpleTrack): string {
  if (!Object.isFrozen(track) || !Object.isFrozen(track.points)) return clipTrackJson(track);
  let json = jsonOfFrozenTrack.get(track);
  if (json === undefined) {
    json = clipTrackJson(track);
    jsonOfFrozenTrack.set(track, json);
  }
  return json;
}

/** Exact evaluation in clip-local ms, holding endpoint values; undefined when the host cannot compile. */
export function trackCurve(
  track: SimpleTrack,
  evaluator: TrackEvaluator | undefined,
): TrackCurve | undefined {
  if (!evaluator || track.points.length === 0) return undefined;
  try {
    return acquire(trackJson(track), evaluator).curve;
  } catch {
    return undefined;
  }
}
