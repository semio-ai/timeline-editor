/*
@type Keypoint
@description A keypoint is a single point in time on a track, with a specific value, in a specific frame.
@prop id: string - a unique identifier for the keypoint.
@prop frame: string - the id of the frame that this keypoint exists in.
@prop track: string - the id of the track that this keypoint exists on.
@prop value: Datatype - the value of the keypoint (currently either string or number).
*/
export interface Keypoint<Datatype> {
  id: string;
  frame: string;
  track: string;
  value: Datatype;
}
