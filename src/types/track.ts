/*
@type Track
@description A track is a collection of keypoint objects that are bound to a certain output, spanning all or part of the animation's duration.
@prop id: string - a unique identifier for the track.
@prop name: string - the name of the track, defined by the user.
@prop points: string[] - a collection of keypoint ids that exist in this track.
*/
export interface Track {
  id: string;
  name: string;
  points: string[];
}
