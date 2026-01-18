import { RawValue } from "@semio/utils";
import type { Track } from "./track";
import type { TrackGroup } from "./track-group";

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
  /** Total duration of the animation in milliseconds. */
  duration: number;
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
  /** Total duration of the animation in milliseconds. */
  duration: number;
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
  /** Stamp-space offset applied to this instance. */
  offset: number;
  /** Stamp-space timescale multiplier applied to this instance. */
  timescale: number;
}
