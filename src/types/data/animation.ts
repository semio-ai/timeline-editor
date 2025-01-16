import { RawValue } from "@semio/utils";
import type { Transition } from "./transition";
import type { Track } from "./track";
import type { TrackGroup } from "./track-group";

/**
 * A collection of tracks, keyframes, and transitions that can be played back to create a visual effect.
 * @param id - a unique identifier for the animation
 * @param name - the name of the animation
 * @param tracks - a collection of track ids specific to this animation.
 * @param groups - a collection of track group ids specific to this animation.
 * @param transitions - a collection of transition objects.
 * @param duration - the total duration of the animation in milliseconds.
 * @param instances - a collection of instance info objects.
 */
export interface Animation {
  id: string;
  name: string;
  tracks: string[];
  groups: Map<string, TrackGroup>;
  transitions: Map<string, Transition>;
  duration: number;
  instances: Record<string, AnimationInstance>;
}

/**
 * A collection of tracks, keyframes, and transitions that can be played back to create a visual effect.
 * @param id - a unique identifier for the animation
 * @param name - the name of the animation
 * @param tracks - a collection of track ids specific to this animation.
 * @param groups - a collection of track group ids specific to this animation.
 * @param transitions - a collection of transition objects.
 * @param duration - the total duration of the animation in milliseconds.
 * @param instances - a collection of instance info objects.
 */
export interface StoredAnimation {
  id: string;
  name: string;
  tracks: Track<RawValue>[];
  groups: Map<string, TrackGroup>;
  transitions: Map<string, Transition>;
  duration: number;
  instances: Record<string, AnimationInstance>;
}

export interface AnimationDriver {
  type: "animation";
  animationInstances: Record<string, AnimationInstance>;
}

export interface AnimationInstance {
  id: string;
  animationId: string; // Matches id of an animation document
  settings: AnimationInstanceSettings;
}

export interface AnimationInstanceSettings {
  active: boolean;
  offset: number;
  timescale: number;
}
