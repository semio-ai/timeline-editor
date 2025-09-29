import { RawValue, RawVector2 } from "@semio/utils";

/**
 * A single point in time on a track, with a specific value, at a specific time stamp.
 * @property id - a unique identifier for the keypoint.
 * @property stamp - the time stamp that this keypoint occurs at.
 * @property value - the value of the keypoint (currently either string or number).
 * @property transitions - optional transitions for the keypoint, which function as the control points on a cubic bezier curve, normalized to 0-1.
 * @description As a collection of points and interpolations, this departs partially from standard practice, which configures transitions as the segment after
 * the position of the keypoint, and before the next keypoint. Instead, transitions are configured around the specified keypoint,
 * such that the 'in' transition indicates the portion of the curve before the keypoint, and the 'out' transition indicates the portion of the curve
 * after the keypoint.
 *
 * @example For a a series of three keypoints A, B, and C, each using a cubic-bezier transition cubic-bezier(0.65, 0, 0.35, 1),
 * the transition from A to B is constructed as the out from A to the in of B, and
 * the transition from B to C is constructed as the out from B to the in of C.
 * Thus, the configuration of these transitions is as follows:
 * A: `{ out: {x: 0.65} }`
 * B: `{ in: {x: 0.35}, out: {x: 0.65} }`
 * C: `{ in: {x: 0.35} }`
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
