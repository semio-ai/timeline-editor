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
  /**
   * Compile a track, as clip 2.0 plays it: `clipTrackJson`'s document, or
   * for a number track `clipTrackColumns`' columns, which need no text
   * parsed. Throws when it cannot. The track is read during the call only.
   */
  compile(track: SimpleTrack): CompiledCurve;
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

/**
 * Where a compiled track is found again: a frozen track itself (the store's
 * committed tracks are frozen, as immer freezes its state deeply, so one
 * cannot change once compiled), and any other track (a draft being edited, a
 * drag's preview) by its clip document.
 */
type CacheKey = SimpleTrack | string;
const compiledByKey = new WeakMap<TrackEvaluator, Map<CacheKey, CachedCurve>>();
const CACHE_ENTRIES = 512;

/** `source` gives the track to compile when the cache holds none for `key`. */
function acquire(key: CacheKey, source: () => SimpleTrack, evaluator: TrackEvaluator): CachedCurve {
  let cache = compiledByKey.get(evaluator);
  if (!cache) {
    cache = new Map();
    compiledByKey.set(evaluator, cache);
  }
  let entry = cache.get(key);
  if (!entry) {
    const track = source();
    const compiled = evaluator.compile(track);
    const number = compiled.kind === "number";
    // A snapshot can hold a curve after the cache evicts its compiled track,
    // so the curve compiles the track again rather than call a freed one.
    let held: CachedCurve | undefined;
    const resource = () => {
      if (held!.freed) held = acquire(key, () => track, evaluator);
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
    cache.delete(key);
  }
  cache.set(key, entry);
  if (cache.size > CACHE_ENTRIES) {
    const oldest = cache.keys().next().value!;
    const evicted = cache.get(oldest)!;
    cache.delete(oldest);
    evicted.freed = true;
    evicted.compiled.free();
  }
  return entry;
}

/** A copy of what a track plays, read through a proxy as through a plain object. */
function copyOf(track: SimpleTrack): SimpleTrack {
  const transition = <T>(value: T): T =>
    typeof value === "object" && value !== null ? { ...value } : value;
  return {
    ...track,
    points: track.points.map((point) => ({
      ...point,
      transitions: point.transitions && {
        ...point.transitions,
        in: transition(point.transitions.in),
        out: transition(point.transitions.out),
      },
    })),
  };
}

/** Exact evaluation in clip-local ms, holding endpoint values; undefined when the host cannot compile. */
export function trackCurve(
  track: SimpleTrack,
  evaluator: TrackEvaluator | undefined,
): TrackCurve | undefined {
  if (!evaluator || track.points.length === 0) return undefined;
  try {
    if (Object.isFrozen(track) && Object.isFrozen(track.points)) {
      return acquire(track, () => track, evaluator).curve;
    }
    // A track that can change (an immer draft among them) is compiled from a
    // copy, which a curve held past an eviction compiles again.
    return acquire(clipTrackJson(track), () => copyOf(track), evaluator).curve;
  } catch {
    return undefined;
  }
}
