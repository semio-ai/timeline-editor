/**
Track
A collection of keypoint objects that are bound to a certain output, spanning all or part of the animation's duration.
@param id - a unique identifier for the track.
@param name - the name of the track, defined by the user.
@param points - a collection of keypoint ids that exist in this track.
*/
export interface Track {
  id: string;
  name: string;
  points: string[];
}
