import { RawValue } from "@semio/utils";
import { Keypoint } from "./keypoint";
/**
 * A collection of keypoint objects that are bound to a certain output, spanning all or part of the animation's duration.
 * @param id - a unique identifier for the track.
 * @param name - the name of the track, defined by the user.
 * @param points - a collection of keypoints that exist in this track.
 */
export interface Track<DataType extends RawValue> {
  id: string;
  name: string;
  points: Keypoint<DataType>[];
}

/**
Old version of Tracks
*/
export interface TrackV1 {
  id: string;
  name: string;
  points: string[];
}
