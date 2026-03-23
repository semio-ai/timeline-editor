import { RawValue } from "@semio/utils";
import type { Track } from "./track";
import type { TrackGroup } from "./track-group";

/**
 * Format version for stored animations.
 *
 * - **1** (legacy): Keypoint stamps are normalized [0,1] fractions of the animation's duration.
 *   Transition x-deltas are also normalized. Duration is stored explicitly.
 * - **2** (current): Keypoint stamps are in absolute milliseconds. Transition x-deltas are in
 *   milliseconds. Duration is derived from track extent rather than stored explicitly.
 */
export type AnimationFormatVersion = 1 | 2;

/** The current format version for newly created animations. */
export const CURRENT_ANIMATION_FORMAT_VERSION: AnimationFormatVersion = 2;

/**
 * Runtime animation record stored in the editor state.
 * References tracks by id; the full track data lives in the global track map.
 */
export interface Animation {
  /** Unique animation id. */
  id: string;
  /** Human-readable animation name. */
  name: string;
  /** Track ids belonging to this animation. */
  tracks: string[];
  /** Track grouping metadata (hierarchical). */
  groups: TrackGroup[];
  /**
   * Default viewport extent in milliseconds. Controls the initial visible range
   * when opening this animation in the editor. The actual animation length is
   * derived from track content (max keypoint stamp); this value acts as a
   * minimum floor for the viewport.
   *
   * Optional — when absent, the viewport auto-fits to track content.
   */
  defaultViewportExtent?: number;
}

/**
 * Stored animation shape used for persistence and serialization.
 * Tracks are embedded rather than referenced by id.
 */
export interface StoredAnimation {
  /** Unique animation id. */
  id: string;
  /** Human-readable animation name. */
  name: string;
  /** Embedded tracks for storage and interchange. */
  tracks: Track<RawValue>[];
  /** Track grouping metadata (hierarchical). */
  groups: TrackGroup[];
  /**
   * Legacy duration field. In v1 format, this was the authoritative animation
   * duration in ms. In v2 format, it is preserved during migration as the
   * defaultViewportExtent value. New v2 animations should use
   * defaultViewportExtent instead.
   */
  duration?: number;
  /**
   * Default viewport extent in milliseconds. Controls the initial visible range
   * when opening this animation in the editor. Optional — when absent, the
   * viewport auto-fits to track content.
   */
  defaultViewportExtent?: number;
  /**
   * Format version. Absent or 1 = legacy normalized [0,1] stamps.
   * 2 = millisecond stamps.
   */
  formatVersion?: AnimationFormatVersion;
}

/** Instance of an animation within a namespace (timing overrides live here). */
export interface AnimationInstance {
  /** Unique id for this instance. */
  id: string;
  /** Id of the animation document this instance refers to. */
  animationId: string;
  /** Per-instance timing and active state. */
  settings: AnimationInstanceSettings;
}

/** Per-instance timing and enablement settings. */
export interface AnimationInstanceSettings {
  /** Whether the instance contributes to playback/rendering. */
  active: boolean;
  /**
   * Offset in milliseconds applied to the start of this instance in world time.
   * A value of 500 means the instance starts 500ms into the world timeline.
   */
  offset: number;
  /**
   * Timescale multiplier for this instance.
   * A value of 2 means the animation plays at 2x speed (completes in half the time).
   * In format v2, the conversion is: worldStamp = localStamp / timescale + offset.
   */
  timescale: number;
}
