import type { RawValue, RawVector2 } from "@semio/utils";
import type { StoredAnimation } from "../types/data/animation";
import { CURRENT_ANIMATION_FORMAT_VERSION } from "../types/data/animation";
import type { AuthoredTransition, Keypoint } from "../types/data/keypoint";
import type { Track } from "../types/data/track";

/** The formats this client can interpret without guessing at time units. */
export enum AnimationFormatSupport {
  Legacy = "legacy",
  Current = "current",
  Unreadable = "unreadable",
}

export function classifyAnimationFormat(version: unknown): AnimationFormatSupport {
  if (version === undefined || version === 1) return AnimationFormatSupport.Legacy;
  if (version === CURRENT_ANIMATION_FORMAT_VERSION) return AnimationFormatSupport.Current;
  return AnimationFormatSupport.Unreadable;
}

export class UnreadableAnimationFormatError extends Error {
  /** `unstampedKeypoints`: the version reads as v1, but its keypoints carry no v1 stamps. */
  constructor(version: unknown, unstampedKeypoints = false) {
    super(
      unstampedKeypoints
        ? "This is not an animation this version of Studio can read: its keypoints have no times in a format it knows."
        : typeof version === "number" && version > CURRENT_ANIMATION_FORMAT_VERSION
          ? "This animation was saved by a newer version of Studio. Reload Studio to open it."
          : "This animation has an unreadable format version and cannot be opened.",
    );
    this.name = "UnreadableAnimationFormatError";
  }
}

/**
 * Whether every keypoint carries the numeric `stamp` that v1 uses. A
 * document read as v1 (stated as 1, or stating no version) has each stamp
 * rescaled by its duration, so a keypoint without one belongs to another
 * format and would get a time computed from a missing field. A v2 document is
 * never rescaled, and the structural checks of its readers refuse a
 * malformed one. A document with no `tracks` array has no keypoints to judge.
 */
function hasStampedKeypoints(animation: unknown): boolean {
  const tracks = (animation as { tracks?: unknown } | null)?.tracks;
  if (!Array.isArray(tracks)) return true;
  return tracks.every((track) => {
    const points = (track as { points?: unknown } | null)?.points;
    return (
      !Array.isArray(points) ||
      points.every((point) => typeof (point as { stamp?: unknown } | null)?.stamp === "number")
    );
  });
}

/**
 * Check a persisted animation's version before inspecting or changing its
 * content, and that a document read as v1 has the stamps v1 rescales. An
 * unknown version is refused without reading its tracks.
 */
export function assertReadableAnimationFormat(animation: unknown): void {
  const version = (animation as { formatVersion?: unknown } | null)?.formatVersion;
  const support = classifyAnimationFormat(version);
  if (support === AnimationFormatSupport.Unreadable) {
    throw new UnreadableAnimationFormatError(version);
  }
  if (support === AnimationFormatSupport.Legacy && !hasStampedKeypoints(animation)) {
    throw new UnreadableAnimationFormatError(version, true);
  }
}

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
  assertReadableAnimationFormat(stored);
  // Millisecond stamps and handle deltas are already in the required units.
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

  const migratedTransitions = { ...point.transitions };
  if (point.transitions.in !== undefined) {
    migratedTransitions.in = migrateTransition(point.transitions.in, duration);
  }
  if (point.transitions.out !== undefined) {
    migratedTransitions.out = migrateTransition(point.transitions.out, duration);
  }

  return {
    ...point,
    stamp: migratedStamp,
    transitions: migratedTransitions,
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
