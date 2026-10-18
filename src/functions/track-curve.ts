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
};

interface CachedCurve {
  compiled: CompiledCurve;
  curve: TrackCurve;
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
    // Snapshots can retain a curve beyond cache eviction. Reacquire its resource
    // on use so a retained readout never calls a freed compiled track.
    const resource = () => acquire(content, evaluator).compiled;
    const curve = Object.assign(
      (localMs: number) => resource().values(new Float64Array([localMs]))[0],
      {
        values: (timesMs: Float64Array) => resource().values(timesMs),
        velocity: (localMs: number) => resource().velocities(new Float64Array([localMs]))?.[0],
        velocities: (timesMs: Float64Array) => resource().velocities(timesMs),
      },
    );
    entry = { compiled, curve };
  }
  cache.delete(content);
  cache.set(content, entry);
  if (cache.size > CONTENT_ENTRIES) {
    const oldest = cache.keys().next().value!;
    const evicted = cache.get(oldest)!;
    cache.delete(oldest);
    evicted.compiled.free();
  }
  return entry;
}

/** Exact evaluation in clip-local ms, holding endpoint values; undefined when the host cannot compile. */
export function trackCurve(
  track: SimpleTrack,
  evaluator: TrackEvaluator | undefined,
): TrackCurve | undefined {
  if (!evaluator || track.points.length === 0) return undefined;
  try {
    return acquire(clipTrackJson(track), evaluator).curve;
  } catch {
    return undefined;
  }
}
