import { computeLocalStamp } from "../functions/compute-instance-time";
import type { AnimationData } from "../store-types";
import type { SimpleKeypoint, SimpleRawValue, SimpleTrack } from "../types/data/simple-track";
import { buildTrackKey } from "../utils/track-key";
import { insertKeypointWithDeCasteljau } from "../functions/insert-keypoint-with-decasteljau";

/**
 * Inserts a keypoint at a given world stamp for a specific instance, computing a best-effort value
 * using the current interpolator and sorting the resulting points by stamp.
 *
 * Notes:
 * - This is a shape-safe insertion in terms of ordering and default transitions, but it does not yet
 *   preserve the exact pre-insertion curve shape. A de Casteljau-based split should replace the
 *   transition assignment so the curve before/after insertion remains identical.
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
  const namespaceId = resolved?.namespaceId;

  // First, attempt shape-preserving de Casteljau split; fall back if no segment contains the stamp.
  const split = insertKeypointWithDeCasteljau(track, worldStamp, {
    settings: { offset, timescale, active: true },
  });
  if (split) {
    return split.inserted as SimpleKeypoint;
  }
  // Convert to local (instance) time for storage in the keypoint.
  const localStamp = computeLocalStamp(worldStamp, timescale, offset);

  // Derive the value from the current interpolator snapshot when available.
  const value = resolveInterpolatedOrDefaultValue(
    state,
    track,
    trackId,
    namespaceId,
    instanceId,
    localStamp,
  );

  if (value === undefined) {
    return undefined;
  }

  const newPoint: SimpleKeypoint = {
    id: crypto.randomUUID(),
    stamp: clamp01(localStamp),
    value,
    // Placeholder transitions: use the interpolator defaults that match compute-track-interpolator.
    // TODO(semio-agent): Replace these with de Casteljau-based split so the curve shape is preserved:
    // - Split segment A->B at parameter u corresponding to localStamp
    // - Convert the resulting absolute control points back into normalized {x,y} transitions
    //   around A/K/B as defined in types/data/keypoint.ts semantics.
    transitions: {
      in: { x: 0.35, y: 1 },
      out: { x: 0.65, y: 0 },
    },
  };

  // Insert maintaining sort order. If an equal stamp exists, we insert after earlier points with same stamp.
  const insertIndex = findInsertIndex(track.points, newPoint.stamp);
  if (insertIndex === -1) {
    track.points.push(newPoint);
  } else {
    track.points.splice(insertIndex, 0, newPoint);
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
 * Try to obtain the value for a new keypoint using the existing derived snapshot interpolator
 * for the given trackKey (namespace/instance/track). Fall back to the track's current value
 * (animatable default) if no interpolator is available.
 */
function resolveInterpolatedOrDefaultValue(
  state: AnimationData,
  track: SimpleTrack,
  trackId: string,
  namespaceId: string | undefined,
  instanceId: string,
  localStamp: number,
): SimpleRawValue | undefined {
  // Prefer derivedSnapshot interpolator for this specific instance/track.
  if (namespaceId && state.derivedSnapshot?.tracks) {
    const trackKey = buildTrackKey(namespaceId, instanceId, trackId);
    const interp = state.derivedSnapshot.tracks[trackKey]?.canonical?.interpolator;
    if (interp) {
      const maybe = interp(localStamp) as SimpleRawValue | undefined;
      if (maybe !== undefined) return maybe;
    }
  }

  // Fallback to animatable default if present.
  const defaultValue = state.animatables?.[track.animatableId]?.default as
    | SimpleRawValue
    | undefined;
  return defaultValue;
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
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
