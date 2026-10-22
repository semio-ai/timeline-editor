import { computeLocalStamp } from "../functions/compute-instance-time";
import { type AnimationData, TransitionDirective } from "../store-types";
import type { SimpleKeypoint, SimpleRawValue, SimpleTrack } from "../types/data/simple-track";
import { trackCurve } from "../functions/track-curve";
import { insertKeypointWithDeCasteljau } from "../functions/insert-keypoint-with-decasteljau";
import {
  findInsertionNeighbors,
  resolveNewKeyTransitionPreferences,
  resolveNewKeyTransitions,
} from "../functions/resolve-new-key-transitions";

/**
 * Inserts a keypoint at a given world stamp for a specific instance.
 *
 * Notes:
 * - If default transition directives request explicit handles, insertion attempts
 *   a de Casteljau split first to preserve the containing segment.
 * - If explicit handle derivation is not possible, transitions fall back to cubic easing.
 * - Control-surface callers should pass the world (player) stamp and the instanceId they operate on.
 */
export function insertKeypointAtWorldStamp(
  state: AnimationData,
  trackId: string,
  worldStamp: number,
  instanceId: string,
): SimpleKeypoint | undefined {
  const track = state.tracks?.[trackId];
  if (!track) {
    return undefined;
  }

  const resolved = resolveInstanceAndNamespace(state, instanceId);
  const timescale = resolved?.instance?.settings?.timescale ?? 1;
  const offset = resolved?.instance?.settings?.offset ?? 0;

  const preferences = resolveNewKeyTransitionPreferences(state);
  const shouldAttemptShapePreservingSplit =
    preferences.in === TransitionDirective.ExplicitHandles ||
    preferences.out === TransitionDirective.ExplicitHandles;

  // Without an evaluator, a split preserves the containing segment.
  const curveValue = trackCurve(
    track,
    state.trackEvaluator,
  )?.(computeLocalStamp(worldStamp, timescale, offset));
  if (shouldAttemptShapePreservingSplit || (curveValue === undefined && track.points.length > 0)) {
    // Attempt shape-preserving split first; fall back if no segment contains the stamp.
    const split = insertKeypointWithDeCasteljau(
      track,
      worldStamp,
      {
        settings: { offset, timescale, active: true },
      },
      curveValue,
    );
    if (split) {
      split.inserted.transitions = {
        ...(split.inserted.transitions ?? {}),
        pairing: preferences.pairing,
      };
      return split.inserted as SimpleKeypoint;
    }
  }
  // Convert to local (instance) time for storage in the keypoint.
  const localStamp = computeLocalStamp(worldStamp, timescale, offset);
  // In v2 format, stamps are in ms — no [0,1] clamping needed.
  const clampedStamp = Number.isFinite(localStamp) ? localStamp : 0;

  // The curve's value there; without one, what the track holds there outside
  // its segments, and the animatable's default on an empty track.
  const value =
    curveValue ??
    heldValue(track, clampedStamp) ??
    (state.animatables?.[track.animatableId]?.default as SimpleRawValue | undefined);

  if (value === undefined) {
    return undefined;
  }

  const sortedPoints = track.points.slice().sort((a, b) => a.stamp - b.stamp);
  const { prevPoint, nextPoint } = findInsertionNeighbors(sortedPoints, clampedStamp);

  const newPoint: SimpleKeypoint = {
    id: crypto.randomUUID(),
    stamp: clampedStamp,
    value,
    transitions: resolveNewKeyTransitions({
      prevPoint,
      nextPoint,
      anchor: { stamp: clampedStamp, value },
      defaults: preferences,
    }),
  };

  // Insert maintaining sort order. If an equal stamp exists, we insert after earlier points with same stamp.
  const rawInsertIndex = findInsertIndex(track.points, newPoint.stamp);
  if (rawInsertIndex === -1) {
    track.points.push(newPoint);
  } else {
    track.points.splice(rawInsertIndex, 0, newPoint);
  }

  // Ensure points remain sorted by stamp after insertion.
  track.points = track.points.slice().sort((a, b) => a.stamp - b.stamp);

  return newPoint;
}

/**
 * Resolve the instance and its containing namespace for a given instanceId.
 */
function resolveInstanceAndNamespace(
  state: AnimationData,
  instanceId: string,
): { namespaceId: string; instance: { settings: { offset: number; timescale: number } } } | null {
  for (const [nsId, namespace] of Object.entries(state.namespaces ?? {})) {
    const instance = namespace.animationInstances?.[instanceId];
    if (instance) {
      const offset = instance.settings?.offset ?? 0;
      const timescale = instance.settings?.timescale ?? 1;
      return { namespaceId: nsId, instance: { settings: { offset, timescale } } };
    }
  }
  return null;
}

/**
 * What a track holds at a stamp no segment covers: its first keypoint's value
 * at or before the first stamp, its last's at or after the last, a keypoint's
 * own value at its stamp; `undefined` inside a segment and on an empty track.
 */
function heldValue(track: SimpleTrack, stamp: number): SimpleRawValue | undefined {
  const points = [...track.points].sort((a, b) => a.stamp - b.stamp);
  if (points.length === 0) return undefined;
  if (stamp <= points[0].stamp) return points[0].value;
  if (stamp >= points[points.length - 1].stamp) return points[points.length - 1].value;
  return points.find((point) => point.stamp === stamp)?.value;
}

function findInsertIndex(points: SimpleKeypoint[], stamp: number): number {
  if (!points.length) return 0;
  // Find first point with greater stamp. Insert before that.
  for (let i = 0; i < points.length; i += 1) {
    if (points[i].stamp > stamp) {
      return i;
    }
  }
  return -1; // append
}
