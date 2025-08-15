import { RawValue, RawVector2 } from "@semio/utils";

/**
A single point in time on a track, with a specific value, at a specific time stamp.
@param id - a unique identifier for the keypoint.
@param stamp - the time stamp that this keypoint occurs at.
@param value - the value of the keypoint (currently either string or number).
@param transitions - optional transitions for the keypoint, which function as the control points on a cubic bezier curve, normalized to 0-1.
*/
export interface Keypoint<DataType extends RawValue> {
  id: string;
  stamp: number;
  value: DataType;
  transitions?: {
    in?: RawVector2;
    out?: RawVector2;
  };
}
