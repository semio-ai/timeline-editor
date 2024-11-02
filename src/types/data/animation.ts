import { RawValue } from "@semio/utils";
import type { Transition } from "./transition";
import type { Track, TrackV1 } from "./track";
import type { TrackGroup } from "./track-group";
import type { KeypointV1 } from "./keypoint";
import type { Keyframe } from "./keyframe";
import type { InstanceInfo } from "./instance-info";

/**
Animation
A collection of tracks, keyframes, and transitions that can be played back to create a visual effect.
@param id - a unique identifier for the animation
@param name - the name of the animation
@param tracks - a collection of track ids specific to this animation.
@param groups - a collection of track group ids specific to this animation.
@param transitions - a collection of transition objects.
@param duration - the total duration of the animation in milliseconds.
@param instances - a collection of instance info objects.
*/
export interface Animation {
  id: string;
  name: string;
  tracks: string[];
  groups: Map<string, TrackGroup>;
  transitions: Map<string, Transition>;
  duration: number;
  instances: Record<string, InstanceInfo>;
}

export interface StoredAnimationV2 {
  id: string;
  name: string;
  tracks: Track<RawValue>[];
  groups: Map<string, TrackGroup>;
  transitions: Map<string, Transition>;
  duration: number;
  instances: Record<string, InstanceInfo>;
}

export type StoredAnimation = StoredAnimationV2 | AnimationV1;

/**
Old version of Animation format
*/
export interface AnimationV1 {
  id: string;
  name: string;
  points: Map<string, KeypointV1<RawValue>>;
  frames: Map<string, Keyframe>;
  tracks: Map<string, TrackV1>;
  groups: Map<string, TrackGroup>;
  transitions: Map<string, Transition>;
  frameOrder: string[];
  trackOrder: string[];
  duration: number;
  instances: Record<string, InstanceInfo>;
}
