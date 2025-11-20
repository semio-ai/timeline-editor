import { RawValue, RawVector2 } from "@semio/utils";

export interface TransitionWorldHandle {
  deltaStamp: number;
  deltaValue: number;
}

export type TransitionEaseKind =
  | "ease-in-sine"
  | "ease-out-sine"
  | "ease-in-out-sine"
  | "ease-in-cubic"
  | "ease-out-cubic"
  | "ease-in-out-cubic"
  | "ease-in-quint"
  | "ease-out-quint"
  | "ease-in-out-quint"
  | "ease-in-circ"
  | "ease-out-circ"
  | "ease-in-out-circ"
  | "ease-in-quad"
  | "ease-out-quad"
  | "ease-in-out-quad"
  | "ease-in-quart"
  | "ease-out-quart"
  | "ease-in-out-quart"
  | "ease-in-expo"
  | "ease-out-expo"
  | "ease-in-out-expo"
  | "ease-in-back"
  | "ease-out-back"
  | "ease-in-out-back"
  | "linear";

export interface TransitionSpec {
  handle?: TransitionWorldHandle;
  ease?: TransitionEaseKind;
}

/**
 * A single point in time on a track, with a specific value, at a specific time stamp.
 * @property id - a unique identifier for the keypoint.
 * @property stamp - the time stamp that this keypoint occurs at (normalized to the duration of the animation, 0 start and 1 end).
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
 * A: `{ out: {x: 0.65, y: 0} }`
 * B: `{ in: {x: 0.35, y: 1}, out: {x: 0.65, y: 0} }`
 * C: `{ in: {x: 0.35, y: 1} }`
 *
 * The resulting transitions (in parametric space) are:
 * A to B: cubic-bezier(0.65, 0, 0.35, 1)
 * B to C: cubic-bezier(0.65, 0, 0.35, 1)
 *
 * In a more sophisticated example, consider keypoints D, E, and F, with the following transitions:
 * D: `{ out: {x: 0.5, y: 0} }`
 * E: `{ in: {x: 0.2, y: 1}, out: {x: 0.8, y: 0} }`
 * F: `{ in: {x: 0.3, y: 1} }`
 *
 * The resulting transitions (in parametric space) are:
 * D to E: cubic-bezier(0.5, 0, 0.2, 1)
 * E to F: cubic-bezier(0.8, 0, 0.3, 1)
 *
 * If not specified, the transitions default to cubic-bezier(0.65, 0, 0.35, 1) (ease-in-out-cubic)
 */
export interface TransitionVariants {
  in?: TransitionSpec;
  out?: TransitionSpec;
}

export interface Keypoint<DataType extends RawValue> {
  id: string;
  stamp: number;
  value: DataType;
  transitions?: {
    in?: RawVector2;
    out?: RawVector2;
  };
  transitionsWorld?: TransitionVariants;
}
