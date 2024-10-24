/**
Keypoint
A single point in time on a track, with a specific value, in a specific frame.
@param id - a unique identifier for the keypoint.
@param frame - the id of the frame that this keypoint exists in.
@param track - the id of the track that this keypoint exists on.
@param value - the value of the keypoint (currently either string or number).
*/
export interface Keypoint<Datatype> {
  id: string;
  frame: string;
  track: string;
  value: Datatype;
}
