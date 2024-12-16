import { RawValue } from "@semio/utils";

/**
A single point in time on a track, with a specific value, at a specific time stamp.
@param id - a unique identifier for the keypoint.
@param stamp - the time stamp that this keypoint occurs at.
@param value - the value of the keypoint (currently either string or number).
*/
export interface Keypoint<DataType extends RawValue> {
  id: string;
  stamp: number;
  value: DataType;
}

/**
Old version of the keypoint data
*/
export interface KeypointV1<Datatype> {
  id: string;
  frame: string;
  track: string;
  value: Datatype;
}
