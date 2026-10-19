import { RawValue } from "@semio/utils";
import type { Track } from "./track";
import type { TrackGroup } from "./track-group";

/** Versions accepted at the persistence boundary. */
export type AnimationFormatVersion = 1 | 2 | 3;

/** Latest readable format; Studio writes format 2 until format-3 readers are deployed. */
export const CURRENT_ANIMATION_FORMAT_VERSION = 3;

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
   * when opening this animation in the editor. Playback duration is the latest
   * of the content end, this hint and one second.
   *
   * Optional — when absent, the viewport auto-fits to track content.
   */
  defaultViewportExtent?: number;
  /** True when the viewport is inferred from duration; omit that inferred field on save. */
  viewportExtentFromDuration?: boolean;
  /** Optional legacy metadata retained for lossless format-2 saves. */
  duration?: number;
}

/**
 * Embedded in-memory animation in millisecond units (including legacy input).
 * Studio saves format 2; PersistedAnimation describes the readable format-3 document.
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
   * V1 duration in milliseconds, used to scale normalized stamps. In v2 it
   * remains optional metadata and supplies the viewport fallback when
   * defaultViewportExtent is absent.
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
  formatVersion?: 1 | 2;
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
