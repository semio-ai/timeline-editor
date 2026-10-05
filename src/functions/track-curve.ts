import type { Animation } from "../types";
import type { SimpleRawValue, SimpleTrack } from "../types/data/simple-track";
import { moduleClipDuration, toModuleClip, type ModuleClip } from "./to-module-clip";

/**
 * Samples one track of a clip as the Vizij animation module plays it: the
 * track's value `rateHz` times a second from clip time 0 to the clip's end
 * (sample `i` at `i * 1000 / rateHz` ms, the last one at the end), or
 * `undefined` when nothing can bake it now. The host supplies it (Studio
 * bakes on an emulated device's module); the module is the only evaluator of
 * a track's curve.
 */
export type TrackBaker = (
  clip: ModuleClip,
  trackId: string,
  rateHz: number,
) => SimpleRawValue[] | undefined;

/**
 * A track's value at a local time in milliseconds, read from its bake: a
 * number between two samples lies on the line between them, a string or a
 * boolean holds the sample at or before the time. Before 0 it is the first
 * sample, after the end the last.
 */
export type TrackCurve = (localMs: number) => SimpleRawValue | undefined;

/** Samples per second of a bake, so a curve is drawn and read to 5 ms. */
const RATE_HZ = 200;
/** The most samples one bake takes; a longer animation is baked at a lower rate. */
const MAX_SAMPLES = 20_000;

interface Baked {
  baker: TrackBaker;
  animation: Animation;
  durationMs: number;
  curve: TrackCurve | undefined;
}

/** The last bake of each track object, so an unchanged track is not baked again. */
const baked = new WeakMap<SimpleTrack, Baked>();

/**
 * The bakes of each baker by content (duration and keypoints), so copies of
 * one track — a drag preview's row, violations and snapshot each make one —
 * bake once. The oldest go past {@link CONTENT_ENTRIES}.
 */
const bakedByContent = new WeakMap<TrackBaker, Map<string, TrackCurve | undefined>>();
const CONTENT_ENTRIES = 512;

/**
 * The curve of `track` within `animation`, baked through `baker`: the
 * track alone, over the whole animation's duration (`tracks` holding the
 * animation's tracks, `track` among them or in their place). Baked once per
 * track object, animation and baker, so an edit re-bakes the tracks it
 * touched. `undefined` without a baker, and when the baker or the
 * conversion refuses the track (a composite value, a number beyond `f32`).
 */
export function trackCurve(
  track: SimpleTrack,
  animation: Animation,
  tracks: Record<string, SimpleTrack>,
  baker: TrackBaker | undefined,
): TrackCurve | undefined {
  if (!baker) return undefined;
  const withTrack = tracks[track.id] === track ? tracks : { ...tracks, [track.id]: track };
  const durationMs = moduleClipDuration(animation, withTrack);
  const known = baked.get(track);
  if (
    known &&
    known.baker === baker &&
    known.animation === animation &&
    known.durationMs === durationMs
  ) {
    return known.curve;
  }
  let byContent = bakedByContent.get(baker);
  if (!byContent) {
    byContent = new Map();
    bakedByContent.set(baker, byContent);
  }
  const content = `${durationMs}|${track.id}|${JSON.stringify(track.points)}`;
  const curve = byContent.has(content)
    ? byContent.get(content)
    : bake(track, animation, withTrack, durationMs, baker);
  byContent.delete(content);
  byContent.set(content, curve);
  if (byContent.size > CONTENT_ENTRIES) byContent.delete(byContent.keys().next().value!);
  baked.set(track, { baker, animation, durationMs, curve });
  return curve;
}

function bake(
  track: SimpleTrack,
  animation: Animation,
  tracks: Record<string, SimpleTrack>,
  durationMs: number,
  baker: TrackBaker,
): TrackCurve | undefined {
  if (track.points.length === 0) return undefined;
  let clip: ModuleClip;
  try {
    clip = toModuleClip(animation, tracks, [track.id]);
  } catch {
    return undefined;
  }
  const rateHz = Math.min(RATE_HZ, (MAX_SAMPLES * 1000) / Math.max(durationMs, 1));
  const samples = baker(clip, track.id, rateHz);
  if (!samples || samples.length === 0) return undefined;
  const last = samples.length - 1;
  const period = 1000 / rateHz;
  const timeOf = (i: number) => Math.min(i * period, durationMs);
  return (localMs) => {
    if (!(localMs > 0)) return samples[0];
    if (localMs >= durationMs || last === 0) return samples[last];
    const below = Math.min(Math.floor(localMs / period), last - 1);
    const left = samples[below];
    const right = samples[below + 1];
    if (typeof left !== "number" || typeof right !== "number") return left;
    const t0 = timeOf(below);
    return left + ((right - left) * (localMs - t0)) / (timeOf(below + 1) - t0);
  };
}
