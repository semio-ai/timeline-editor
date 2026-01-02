import { type InstancedFrameInfo, SourceRow, TrackRender, EndpointTransitions } from "../types";
import { DEFAULT_TRANSITION_IN, DEFAULT_TRANSITION_OUT } from "../constants";
import { getWorldControlPoints, resolveTransitionDelta } from "./get-world-control-points";

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
 * The y-coordinates use the raw values pulled from each frame so consumers can render the real-space curve.
 * If the area is empty, the transition is a flat line connecting the start and end values.
 */
export interface TransitionParams {
  start: { x: number; y: number };
  end: { x: number; y: number };
  cp1: { x: number; y: number };
  cp2: { x: number; y: number };
}

export interface ComputeTransitionParamsOptions {
  transitions?: EndpointTransitions;
}

const extractFrameValue = (frame: InstancedFrameInfo): number | undefined => {
  const first = frame.points?.[0];
  if (first) {
    if (typeof first.value === "number") {
      return first.value as number;
    }
  }

  return undefined;
};

export function computeTransitionParams(
  source: SourceRow,
  start: InstancedFrameInfo,
  end: InstancedFrameInfo,
  isEmpty: boolean,
  trackRender: TrackRender,
  _bounds: { min: number; max: number } = { min: 0, max: 1 },
  options?: ComputeTransitionParamsOptions,
): TransitionParams {
  // Use cubic-ease-in-out as default transtion params

  // Note, the start transition out is the beginning of the transition segment.
  // The end transition in is the end of the transition segment.

  const transitions: EndpointTransitions = {
    startOut: options?.transitions?.startOut ?? start.transitions?.out ?? DEFAULT_TRANSITION_OUT,
    endIn: options?.transitions?.endIn ?? end.transitions?.in ?? DEFAULT_TRANSITION_IN,
  };

  if (trackRender === TrackRender.Transition || trackRender === TrackRender.Key) {
    let startValue: number | undefined = extractFrameValue(start);
    const endValue: number | undefined = extractFrameValue(end);

    // Safely extract start value
    if (start.points && start.points.length > 0 && startValue === undefined) {
      if (source.data[0].type === "number") {
        startValue = start.points[0].value as number;
      }
    }

    if (trackRender === TrackRender.Key) {
      // We handle this case by just returning the parameters for the TrackRender.Key visual.
      return {
        start: { x: start.stamp, y: 0.5 },
        end: { x: end.stamp, y: 0.5 },
        cp1: { x: start.stamp + (end.stamp - start.stamp) * 0.33, y: 0.5 },
        cp2: { x: start.stamp + (end.stamp - start.stamp) * 0.67, y: 0.5 },
      };
    }

    // Transition view (normalized y)
    if (isEmpty) {
      const startHasData = (start.points?.length ?? 0) > 0;
      const endHasData = (end.points?.length ?? 0) > 0;
      let yFlat = 0.5;
      if (!startHasData || !endHasData) {
        yFlat = 0.5;
      }
      return {
        start: { x: start.stamp, y: yFlat },
        end: { x: end.stamp, y: yFlat },
        cp1: { x: start.stamp + (end.stamp - start.stamp) * 0.33, y: yFlat },
        cp2: { x: start.stamp + (end.stamp - start.stamp) * 0.67, y: yFlat },
      };
    }

    if (startValue === undefined || endValue === undefined) {
      return {
        start: { x: start.stamp, y: 0.5 },
        end: { x: end.stamp, y: 0.5 },
        cp1: { x: start.stamp + (end.stamp - start.stamp) * 0.33, y: 0.5 },
        cp2: { x: start.stamp + (end.stamp - start.stamp) * 0.67, y: 0.5 },
      };
    }

    const delta = endValue - startValue;

    const toWorldDelta = (
      side: "out" | "in",
      handle: EndpointTransitions[keyof EndpointTransitions] | undefined,
    ): { x: number; y: number } => {
      if (handle && typeof handle === "object") {
        return { x: handle.x, y: handle.y };
      }
      return resolveTransitionDelta(side, start.stamp, end.stamp, startValue, endValue, handle);
    };

    const outDelta = toWorldDelta("out", transitions.startOut);
    const inDelta = toWorldDelta("in", transitions.endIn);

    return {
      start: { x: start.stamp, y: 0 },
      end: { x: end.stamp, y: 1 },
      cp1: {
        x: start.stamp + outDelta.x,
        y: delta === 0 ? 0 : outDelta.y / delta,
      },
      cp2: {
        x: end.stamp + inDelta.x,
        y: delta === 0 ? 1 : 1 + inDelta.y / delta,
      },
    };
  }

  if (
    source.data.length === 1 &&
    (trackRender === TrackRender.Preview || trackRender === TrackRender.Spline)
  ) {
    let startValue: number | undefined = extractFrameValue(start);
    let endValue: number | undefined = extractFrameValue(end);

    // Safely extract start value
    if (start.points && start.points.length > 0 && startValue === undefined) {
      if (source.data[0].type === "number") {
        startValue = start.points[0].value as number;
      }
    }

    // Safely extract end value
    if (end.points && end.points.length > 0) {
      if (source.data[0].type === "number") {
        endValue = end.points[0].value as number;
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
      return {
        start: { x: start.stamp, y: 0.5 },
        end: { x: end.stamp, y: 0.5 },
        cp1: { x: start.stamp + (end.stamp - start.stamp) * 0.33, y: 0.5 },
        cp2: { x: start.stamp + (end.stamp - start.stamp) * 0.67, y: 0.5 },
      };
    }

    const { start: cp1World, end: cp2World } = getWorldControlPoints(
      start.stamp,
      end.stamp,
      startValue,
      endValue,
      { out: transitions.startOut },
      { in: transitions.endIn },
    );

    return {
      start: { x: start.stamp, y: startValue },
      end: { x: end.stamp, y: endValue },
      cp1: { x: cp1World.x, y: cp1World.y as number },
      cp2: { x: cp2World.x, y: cp2World.y as number },
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
