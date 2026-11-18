import type { AnimatableValue, RawValue } from "@semio/data";
import type { Track, TrackKey, Violation } from "../types";
import type { SimpleTrack } from "../types/data/simple-track";
import { computeInstanceTrackViolations } from "./compute-track-violations";
import { trackCurve, type TrackCurve, type TrackEvaluator } from "./track-curve";

/**
 * One track as one instance plays it: everything a check reads about it.
 *
 * `track` is the store's frozen object for a committed track, so its identity
 * changes exactly when its content does. A preview track (an in-flight edit's
 * projection) is a new object on every build.
 */
export interface FeedbackSubject {
  trackKey: TrackKey;
  trackId: string;
  namespaceId: string;
  instanceId: string;
  track: Track<RawValue>;
  animatable: AnimatableValue;
  /** The animation's duration in local milliseconds. */
  durationMs: number;
  timescale: number | undefined;
  /**
   * The curve the editor compiled for `track` with the build's evaluator, when
   * it has one. A provider that evaluates the track the same way can use it
   * rather than compiling again; the editor's own checks do.
   */
  curve?: TrackCurve;
}

/**
 * What judges the motion and reports where it breaks the rig's limits.
 *
 * The derived snapshot asks a provider for every track instance's violations
 * on each build, and for a dragged track's violations under its preview. The
 * interface is shaped so that a provider can keep its own copy of the motion
 * and compute what it needs from it, rather than being handed one track at a
 * time:
 *
 * - `canonical` receives every subject on every build. A provider that holds
 *   the tracks itself (a wasm engine with the clip resident) sends on only the
 *   tracks whose identity changed. For a subject whose result is unchanged it
 *   returns the array it returned before, so consumers keyed by identity skip
 *   it.
 * - `preview` judges one track with its points overridden by an in-flight
 *   edit, on top of the committed motion, without replacing it.
 * - Which subjects a result depends on is the provider's own business. A check
 *   on one track depends on that track; a check across a chain (a joint torque)
 *   depends on every track in it, and the provider must recompute it when any
 *   of them changes.
 * - Violation ids are derived from content (see `violationId`), so a violation
 *   computed again keeps its id.
 * - `subscribe` lets a provider answer late: it returns what it has now, and
 *   calls the listener when a later answer replaces it. The store rebuilds the
 *   snapshot then, as for a write.
 *
 * A provider set as the store's `feedbackProvider` is part of the store's
 * state, and every action deep-freezes the plain objects, arrays, maps and
 * sets in that state. So a provider keeps whatever it changes (its caches, its
 * listeners) where that freeze cannot reach: in its closure, as
 * `createTrackFeedbackProvider` does, or in the fields of a class instance,
 * which the freeze leaves alone. A plain-object provider that keeps a cache
 * in one of its own properties throws on its first write after an action.
 */
export interface FeedbackProvider {
  canonical(
    subjects: readonly FeedbackSubject[],
    evaluator: TrackEvaluator | undefined,
  ): ReadonlyMap<TrackKey, Violation[]>;
  preview(subject: FeedbackSubject, evaluator: TrackEvaluator | undefined): Violation[];
  subscribe?(listener: () => void): () => void;
}

/** A subject's violations, computed from nothing cached. */
export function computeSubjectViolations(
  subject: FeedbackSubject,
  evaluator: TrackEvaluator | undefined,
): Violation[] {
  // The build compiles each track once and hands the curve on: compiling it
  // here again would, past the curve cache's size, recompile every track.
  const curve = subject.curve ?? trackCurve(subject.track as unknown as SimpleTrack, evaluator);
  // An uncompiled curve has no values to check.
  if (!curve) return [];
  return computeInstanceTrackViolations(
    curve,
    subject.durationMs,
    subject.timescale,
    subject.trackId,
    subject.namespaceId,
    subject.instanceId,
    subject.animatable,
  );
}

interface CachedViolations {
  trackId: string;
  durationMs: number;
  timescale: number | undefined;
  animatable: AnimatableValue;
  evaluator: TrackEvaluator | undefined;
  violations: Violation[];
}

/**
 * The editor's own checks (limits and velocity), each judging one track.
 *
 * A track instance's result depends on its track, the animatable's
 * constraints, the animation's duration, the instance's timescale and the
 * evaluator, and on nothing else. So it is cached against exactly those:
 * keyed by the track object and the instance, and kept while the rest are
 * the same objects or values.
 *
 * The cache holds only the subjects of the latest `canonical` call: each call
 * builds the next cache from the entries its subjects use. A replaced track,
 * a removed instance and a removed track all leave it on the next build, so
 * a long session of edits does not accumulate results nothing will ask for.
 */
export function createTrackFeedbackProvider(): FeedbackProvider {
  let cache = new Map<Track<RawValue>, Map<string, CachedViolations>>();

  const cached = (
    next: Map<Track<RawValue>, Map<string, CachedViolations>>,
    subject: FeedbackSubject,
    evaluator: TrackEvaluator | undefined,
  ) => {
    // Encoded, not joined: either id may contain any separator.
    const instanceKey = JSON.stringify([subject.namespaceId, subject.instanceId]);
    const hit = cache.get(subject.track)?.get(instanceKey);
    const entry =
      hit &&
      hit.trackId === subject.trackId &&
      hit.durationMs === subject.durationMs &&
      Object.is(hit.timescale, subject.timescale) &&
      hit.animatable === subject.animatable &&
      hit.evaluator === evaluator
        ? hit
        : {
            trackId: subject.trackId,
            durationMs: subject.durationMs,
            timescale: subject.timescale,
            animatable: subject.animatable,
            evaluator,
            violations: computeSubjectViolations(subject, evaluator),
          };
    let byInstance = next.get(subject.track);
    if (!byInstance) {
      byInstance = new Map();
      next.set(subject.track, byInstance);
    }
    byInstance.set(instanceKey, entry);
    return entry.violations;
  };

  return {
    canonical: (subjects, evaluator) => {
      const next = new Map<Track<RawValue>, Map<string, CachedViolations>>();
      const result = new Map<TrackKey, Violation[]>();
      subjects.forEach((subject) => result.set(subject.trackKey, cached(next, subject, evaluator)));
      cache = next;
      return result;
    },
    preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
  };
}
