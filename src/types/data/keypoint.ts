import { RawValue, RawVector2 } from "@semio/utils";

export interface TransitionWorldHandle {
  deltaStamp: number;
  deltaValue: number;
}

export enum StandardTransitionType {
  Sine = "sine",
  Cubic = "cubic",
  Quint = "quint",
  Circ = "circ",
  Quad = "quad",
  Quart = "quart",
  Expo = "expo",
  Back = "back",
  Linear = "linear",
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
 * If not specified, the transitions effectively default to StandardTransitionType.Cubic
 */

export interface Keypoint<DataType extends RawValue> {
  id: string;
  stamp: number;
  value: DataType;
  transitions?: {
    in?: RawVector2 | StandardTransitionType;
    out?: RawVector2 | StandardTransitionType;
  };
}

// These positions are based on common easing functions using cubic-bezier curves
// As is standard, x values are in the range 0-1, representing time progression between pairs of keypoints,
// unlike the in/out transition control points in the Keypoint interface, which [will] represent relative position in x/y space relative to the keypoint stamp/value.
// Reference: https://easings.net/
export const StandardEaseInParameters: Record<StandardTransitionType, RawVector2> = {
  [StandardTransitionType.Sine]: { x: 0.63, y: 1 },
  [StandardTransitionType.Cubic]: { x: 0.35, y: 1 },
  [StandardTransitionType.Quint]: { x: 0.17, y: 1 },
  [StandardTransitionType.Circ]: { x: 0.15, y: 1 },
  [StandardTransitionType.Quad]: { x: 0.55, y: 1 },
  [StandardTransitionType.Quart]: { x: 0.24, y: 1 },
  [StandardTransitionType.Expo]: { x: 0.13, y: 1 },
  [StandardTransitionType.Back]: { x: 0.32, y: 1.6 },
  [StandardTransitionType.Linear]: { x: 0.66, y: 0.66 },
};

// These positions are based on common easing functions using cubic-bezier curves
// As is standard, x values are in the range 0-1, representing time progression between pairs of keypoints,
// unlike the in/out transition control points in the Keypoint interface, which [will] represent relative position in x/y space relative to the keypoint stamp/value.
// Reference: https://easings.net/
export const StandardEaseOutParameters: Record<StandardTransitionType, RawVector2> = {
  [StandardTransitionType.Sine]: { x: 0.37, y: 0 },
  [StandardTransitionType.Cubic]: { x: 0.65, y: 0 },
  [StandardTransitionType.Quint]: { x: 0.83, y: 0 },
  [StandardTransitionType.Circ]: { x: 0.85, y: 0 },
  [StandardTransitionType.Quad]: { x: 0.45, y: 0 },
  [StandardTransitionType.Quart]: { x: 0.76, y: 0 },
  [StandardTransitionType.Expo]: { x: 0.87, y: 0 },
  [StandardTransitionType.Back]: { x: 0.68, y: -0.6 },
  [StandardTransitionType.Linear]: { x: 0.66, y: 0.66 },
};
