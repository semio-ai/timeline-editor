import { RawValue } from "@semio/utils";
import type { Transition } from "./transition";
import type { Track } from "./track";
import type { TrackGroup } from "./track-group";
import type { Keypoint } from "./keypoint";
import type { Keyframe } from "./keyframe";
import type { InstanceInfo } from "./instance-info";

/*
@type Animation
@description An animation is a collection of tracks, keyframes, and transitions that can be played back to create a visual effect.
@prop id: string - a unique identifier for the animation
@prop name: string - the name of the animation
@prop points: Map<string, Keypoint<number | string>> - a collection of keypoint objects. These objects have a singular parent track and keyframe
@prop frames: Map<string, Keyframe> - a collection of keyframe objects. Each keyframe has a [time]stamp and a collection of keypoint objects (id references)
@prop tracks: Map<string, Track | TrackGroup> - a collection of track and track group objects. Each track has a collection of keypoint objects (id references).
@prop transitions: Map<string, Transition> - a collection of transition objects. Each transition exists between a set of keypoint objects (id references), and defines a type of interpolation/transition between them.
@prop frameOrder: string[] - an ordered list of keyframe ids, ordered by the time associated with each.
@prop trackOrder: string[] - an ordered list of track ids, ordered as preferenced by the user.
@prop duration: number - the total duration of the animation in milliseconds.
@prop framerate: number - the number of frames per second.
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

export function isTrack(track: Track | TrackGroup): track is Track {
  return "points" in track;
}
