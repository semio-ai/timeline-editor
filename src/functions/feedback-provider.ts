import type { AnimatableValue, RawValue } from "@semio/data";
import type { Track, TrackKey, Violation } from "../types";
import type { SimpleTrack } from "../types/data/simple-track";
import { computeInstanceTrackViolations } from "./compute-track-violations";
import { trackCurve, type TrackEvaluator } from "./track-curve";

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
  const curve = trackCurve(subject.track as unknown as SimpleTrack, evaluator);
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
 * keyed by the frozen track object, and kept while the rest are the same
 * objects or values. The cache is weak on the track, so a replaced track's
 * results go with it.
 */
export function createTrackFeedbackProvider(): FeedbackProvider {
  const cache = new WeakMap<Track<RawValue>, Map<string, CachedViolations>>();

  const cached = (subject: FeedbackSubject, evaluator: TrackEvaluator | undefined) => {
    let byInstance = cache.get(subject.track);
    if (!byInstance) {
      byInstance = new Map();
      cache.set(subject.track, byInstance);
    }
    const instanceKey = `${subject.namespaceId}/${subject.instanceId}`;
    const hit = byInstance.get(instanceKey);
    if (
      hit &&
      hit.trackId === subject.trackId &&
      hit.durationMs === subject.durationMs &&
      Object.is(hit.timescale, subject.timescale) &&
      hit.animatable === subject.animatable &&
      hit.evaluator === evaluator
    ) {
      return hit.violations;
    }
    const violations = computeSubjectViolations(subject, evaluator);
    byInstance.set(instanceKey, {
      trackId: subject.trackId,
      durationMs: subject.durationMs,
      timescale: subject.timescale,
      animatable: subject.animatable,
      evaluator,
      violations,
    });
    return violations;
  };

  return {
    canonical: (subjects, evaluator) => {
      const result = new Map<TrackKey, Violation[]>();
      subjects.forEach((subject) => result.set(subject.trackKey, cached(subject, evaluator)));
      return result;
    },
    preview: (subject, evaluator) => computeSubjectViolations(subject, evaluator),
  };
}
