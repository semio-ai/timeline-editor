import type { RawValue, RawVector2 } from "@semio/utils";
import type { StoredAnimation } from "../types/data/animation";
import { CURRENT_ANIMATION_FORMAT_VERSION } from "../types/data/animation";
import type { AuthoredTransition, Keypoint } from "../types/data/keypoint";
import type { Track } from "../types/data/track";

/**
 * Migrates a StoredAnimation from format v1 (normalized [0,1] stamps) to
 * format v2 (millisecond stamps).
 *
 * In v1:
 * - `stamp` values are fractions of `animation.duration` (0 = start, 1 = end)
 * - Explicit transition deltas (RawVector2) have x in normalized stamp space
 *
 * In v2:
 * - `stamp` values are absolute milliseconds
 * - Explicit transition deltas have x in milliseconds
 * - `duration` is preserved as a viewport hint but stamps are independent of it
 *
 * Migration is idempotent: v2 animations are returned unchanged.
 *
 * @param stored - The animation to migrate
 * @returns The migrated animation in v2 format
 */
export function migrateToMillisecondStamps(stored: StoredAnimation): StoredAnimation {
  // Already in current format — no migration needed
  if (stored.formatVersion === CURRENT_ANIMATION_FORMAT_VERSION) {
    return stored;
  }

  const duration = stored.duration ?? 5000;

  return {
    ...stored,
    formatVersion: CURRENT_ANIMATION_FORMAT_VERSION,
    // Preserve the legacy duration as the default viewport extent
    defaultViewportExtent: duration,
    tracks: stored.tracks.map((track) => migrateTrack(track, duration)),
  };
}

function migrateTrack<T extends RawValue>(track: Track<T>, duration: number): Track<T> {
  return {
    ...track,
    points: track.points.map((point) => migrateKeypoint(point, duration)),
  };
}

function migrateKeypoint<T extends RawValue>(point: Keypoint<T>, duration: number): Keypoint<T> {
  const migratedStamp = point.stamp * duration;

  if (!point.transitions) {
    return { ...point, stamp: migratedStamp };
  }

  return {
    ...point,
    stamp: migratedStamp,
    transitions: {
      ...point.transitions,
      in: migrateTransition(point.transitions.in, duration),
      out: migrateTransition(point.transitions.out, duration),
    },
  };
}

/**
 * Migrates a single transition value. Only explicit RawVector2 deltas need
 * scaling — their x component is in stamp space. Standard easing types
 * (strings) and TransitionDirectives are parametric and don't need migration.
 */
function migrateTransition(
  transition: AuthoredTransition | undefined,
  duration: number,
): AuthoredTransition | undefined {
  if (transition == null) return transition;

  // String transitions (StandardTransitionType, TransitionDirective) are parametric
  if (typeof transition === "string") return transition;

  // Explicit RawVector2 delta — scale x from normalized to ms
  const delta = transition as RawVector2;
  return { x: delta.x * duration, y: delta.y };
}
