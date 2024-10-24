import { RawValue } from "@semio/utils";
import type { Transition } from "./transition";
import type { Track } from "./track";
import type { TrackGroup } from "./track-group";
import type { Keypoint } from "./keypoint";
import type { Keyframe } from "./keyframe";
import type { InstanceInfo } from "./instance-info";

/**
Animation
A collection of tracks, keyframes, and transitions that can be played back to create a visual effect.
@param id - a unique identifier for the animation
@param name - the name of the animation
@param points - a collection of keypoint objects. These objects have a singular parent track and keyframe
@param frames - a collection of keyframe objects. Each keyframe has a [time]stamp and a collection of keypoint objects (id references)
@param tracks - a collection of track and track group objects. Each track has a collection of keypoint objects (id references).
@param transitions - a collection of transition objects. Each transition exists between a set of keypoint objects (id references), and defines a type of interpolation/transition between them.
@param frameOrder - an ordered list of keyframe ids, ordered by the time associated with each.
@param trackOrder - an ordered list of track ids, ordered as preferenced by the user.
@param duration - the total duration of the animation in milliseconds.
@param framerate - the number of frames per second.
*/
export interface Animation {
  id: string;
  name: string;
  points: Map<string, Keypoint<RawValue>>;
  frames: Map<string, Keyframe>;
  tracks: Map<string, Track>;
  groups: Map<string, TrackGroup>;
  transitions: Map<string, Transition>;
  frameOrder: string[];
  trackOrder: string[];
  duration: number;
  instances: Record<string, InstanceInfo>;
}
