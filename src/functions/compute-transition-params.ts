import { RawColor, RawEuler, RawVector3 } from "@semio/utils";
import { type InstancedFrameInfo, Source, TrackRender } from "../types";

const ComplexTypes = ["vector3", "euler", "rgb", "hsl"];
type ComplexRawValue = RawVector3 | RawEuler | RawColor;
type ComplexField = keyof ComplexRawValue;

/**
 * A Transition description that gives all 4 coordinates indicating the qualities of the transition
 * between the two instanced-frame-info parameters.
 *
 * The description of the outputs according to TrackRender are as follows:
 * {TrackRender.Key}
 * The transition line is a flat line centered at 0.5
 * The x-coordinates are set according to the stamps of the start and end instanced-frame-info parameters.
 *
 * {TrackRender.Transition}
 * The transition line is a curved line indicating the transition between the two instanced-frame-info parameters.
 * The x-coordinates are set according to the stamps of the start and end instanced-frame-info parameters.
 * The y-coordinates are normalized to the range [0, 1], indicating the influence of the end value relative to the start value (default transition form).
 *
 * {TrackRender.Preview} & {TrackRender.Spline}
 * The transition line is a curved line indicating the change in value between the two instanced-frame-info parameters.
 * The x-coordinates are set according to the stamps of the start and end instanced-frame-info parameters.
 * The y-coordinates are normalized to the range [0, 1], indicating the values of the start and end relative to the bounds (default transition form).
 * If the area is empty, the transition is a flat line connecting the start and end values.
 */
export interface TransitionParams {
  start: { x: number; y: number };
  end: { x: number; y: number };
  cp1: { x: number; y: number };
  cp2: { x: number; y: number };
}

export function computeTransitionParams(
  sources: Source[],
  start: InstancedFrameInfo,
  end: InstancedFrameInfo,
  isEmpty: boolean,
  trackRender: TrackRender,
  bounds: { min: number; max: number } = { min: 0, max: 1 },
): TransitionParams {
  // Use cubice-ease-in-out as default transtion params
  const defaultTransitionIn = { x: 0.65, y: 0 };
  const defaultTransitionOut = { x: 0.35, y: 1 };
  // Note, the start transition out is the beginning of the transition segment.
  // The end transition in is the end of the transition segment.

  if (trackRender === TrackRender.Transition) {
    const cp1Raw = start.transitions?.out ?? defaultTransitionIn;
    const cp2Raw = end.transitions?.in ?? defaultTransitionOut;
    const cp1 = { x: (end.stamp - start.stamp) * cp1Raw.x + start.stamp, y: cp1Raw.y };
    const cp2 = { x: (end.stamp - start.stamp) * cp2Raw.x + start.stamp, y: cp2Raw.y };
    return {
      start: { x: start.stamp, y: 0 },
      end: { x: end.stamp, y: 1 },
      cp1,
      cp2,
    };
  }
  if (
    sources.length === 1 &&
    (trackRender === TrackRender.Preview || trackRender === TrackRender.Spline)
  ) {
    let startValue: number | undefined;
    let endValue: number | undefined;
    const source = sources[0];

    // Safely extract start value
    if (start.points && start.points.length > 0) {
      if (source.type === "number") {
        startValue = start.points[0].value as number;
      } else if (ComplexTypes.includes(source.type) && source.attribute) {
        startValue =
          (start.points[0].value as RawVector3 | RawEuler | RawColor | undefined)?.[
            source.attribute as ComplexField
          ] ?? undefined;
      }
    }

    // Safely extract end value
    if (end.points && end.points.length > 0) {
      if (source.type === "number") {
        endValue = end.points[0].value as number;
      } else if (ComplexTypes.includes(source.type) && source.attribute) {
        endValue =
          (end.points[0].value as RawVector3 | RawEuler | RawColor | undefined)?.[
            source.attribute as ComplexField
          ] ?? undefined;
      }
    }

    // Handle pseudo-region cases where one value might be undefined
    // Create flat lines at the defined value's position
    if (isEmpty) {
      if (startValue === undefined && endValue !== undefined) {
        startValue = endValue;
      } else if (endValue === undefined && startValue !== undefined) {
        endValue = startValue;
      }
    }
    if (startValue === undefined || endValue === undefined) {
      // We handle this case by just returning the parameters for the TrackRender.Key visual.
      return {
        start: { x: start.stamp, y: 0.5 },
        end: { x: end.stamp, y: 0.5 },
        cp1: { x: start.stamp + (end.stamp - start.stamp) * 0.33, y: 0.5 },
        cp2: { x: start.stamp + (end.stamp - start.stamp) * 0.67, y: 0.5 },
      };
    }

    // Compute the normalized values according to the given transition and bounds.
    const startYNormalized = (startValue - bounds.min) / (bounds.max - bounds.min);
    const endYNormalized = (endValue - bounds.min) / (bounds.max - bounds.min);

    const cp1Raw = start.transitions?.out ?? defaultTransitionIn;
    const cp2Raw = end.transitions?.in ?? defaultTransitionOut;

    const cp1YComputed = startYNormalized * cp1Raw.y + endYNormalized * (1 - cp1Raw.y);
    const cp2YComputed = startYNormalized * cp2Raw.y + endYNormalized * (1 - cp2Raw.y);
    const cp1 = { x: (end.stamp - start.stamp) * cp1Raw.x + start.stamp, y: cp1YComputed };
    const cp2 = { x: (end.stamp - start.stamp) * cp2Raw.x + start.stamp, y: cp2YComputed };
    return {
      start: { x: start.stamp, y: startYNormalized },
      end: { x: end.stamp, y: endYNormalized },
      cp1,
      cp2,
    };
  }
  // Default: We handle this case by just returning the parameters for the TrackRender.Key visual.
  return {
    start: { x: start.stamp, y: 0.5 },
    end: { x: end.stamp, y: 0.5 },
    cp1: { x: start.stamp + (end.stamp - start.stamp) * 0.33, y: 0.5 },
    cp2: { x: start.stamp + (end.stamp - start.stamp) * 0.67, y: 0.5 },
  };
}
