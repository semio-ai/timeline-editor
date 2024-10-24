/**
Keyframe
A collection of keypoint objects that exist at a specific point in time, as indicated by the [stamp] property.
@param id - a unique identifier for the keyframe.
@param stamp - the time at which the keyframe occurs, relative to the duration of the animation (e.g. between 0 and 1).
@param points - a collection of keypoint ids that exist at this keyframe.
*/
export interface Keyframe {
  id: string;
  stamp: number;
  points: string[];
}
