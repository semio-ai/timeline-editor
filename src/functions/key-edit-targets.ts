import type { AnimationData } from "../store-types";
import { TrackRender } from "../types";
import { computeLocalStamp } from "./compute-instance-time";

/** A track + the instance whose timing frames it, for clicked-time key edits. */
export interface KeyTarget {
  trackId: string;
  instanceId: string;
}

/**
 * Context for resolving Add/Remove Key targets from a canvas right-click:
 * - spline view edits the current selection (one row band, many tracks),
 * - non-spline view edits the right-clicked row.
 */
export interface KeyMenuContext {
  trackRender: TrackRender;
  /** The right-clicked row's targets (non-spline). Omitted for the empty tracks area. */
  rowTargets?: KeyTarget[];
}

/** Frame-level tolerance for "is there already a key at this time" (ms). */
const KEY_MATCH_EPSILON = 0.1;

/** Resolve an instance's timing settings (offset/timescale) for world↔local conversion. */
function resolveInstanceSettings(
  state: AnimationData,
  instanceId: string,
): { offset: number; timescale: number } {
  for (const namespace of Object.values(state.namespaces ?? {})) {
    const instance = namespace.animationInstances?.[instanceId];
    if (instance) {
      return {
        offset: instance.settings?.offset ?? 0,
        timescale: instance.settings?.timescale ?? 1,
      };
    }
  }
  return { offset: 0, timescale: 1 };
}

/**
 * The id of a keypoint at `worldStamp` on the given track, if one exists. The
 * world stamp is converted to the track instance's local frame before matching
 * (offset/timescaled instances would otherwise mismatch).
 */
export function findKeypointAtWorldStamp(
  state: AnimationData,
  target: KeyTarget,
  worldStamp: number,
): string | undefined {
  const track = state.tracks[target.trackId];
  if (!track) return undefined;
  const { offset, timescale } = resolveInstanceSettings(state, target.instanceId);
  const localStamp = computeLocalStamp(worldStamp, timescale, offset);
  return track.points.find((point) => Math.abs(point.stamp - localStamp) <= KEY_MATCH_EPSILON)?.id;
}

/**
 * Which tracks a clicked-time key edit targets: the current selection in spline
 * view, the right-clicked row otherwise.
 */
export function resolveKeyTargets(state: AnimationData, keyContext?: KeyMenuContext): KeyTarget[] {
  if (keyContext?.trackRender === TrackRender.Spline) {
    const instanceId = state.selectionState.instanceId;
    if (!instanceId) return [];
    return [...state.selectionState.keypoints.keys()].map((trackId) => ({ trackId, instanceId }));
  }
  return keyContext?.rowTargets ?? [];
}
