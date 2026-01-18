import { type InstancedFrameInfo, SourceRow, TrackRender, EndpointTransitions } from "../types";
import { resolveSegmentControlPoints } from "./resolve-segment-control-points";
import { extractFrameNumericValue } from "./segment-value-utils";

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

const buildFlatParams = (startStamp: number, endStamp: number): TransitionParams => ({
  start: { x: startStamp, y: 0.5 },
  end: { x: endStamp, y: 0.5 },
  cp1: { x: startStamp + (endStamp - startStamp) * 0.33, y: 0.5 },
  cp2: { x: startStamp + (endStamp - startStamp) * 0.67, y: 0.5 },
});

const normalizeTransitionRange = (params: TransitionParams): TransitionParams => {
  const minY = Math.min(params.start.y, params.end.y, params.cp1.y, params.cp2.y);
  const maxY = Math.max(params.start.y, params.end.y, params.cp1.y, params.cp2.y);
  const range = maxY - minY;
  if (!Number.isFinite(range) || range === 0) {
    return params;
  }
  if (minY >= 0 && maxY <= 1) {
    return params;
  }
  const normalize = (value: number) => (value - minY) / range;
  return {
    start: { x: params.start.x, y: normalize(params.start.y) },
    end: { x: params.end.x, y: normalize(params.end.y) },
    cp1: { x: params.cp1.x, y: normalize(params.cp1.y) },
    cp2: { x: params.cp2.x, y: normalize(params.cp2.y) },
  };
};

export function buildRenderParamsFromControlPoints(input: {
  startStamp: number;
  endStamp: number;
  startValue?: number;
  endValue?: number;
  cp1?: { x: number; y: number };
  cp2?: { x: number; y: number };
  isEmpty: boolean;
  allowValueCurve: boolean;
}): Partial<Record<TrackRender, TransitionParams>> {
  const { startStamp, endStamp, isEmpty, allowValueCurve } = input;
  const keyParams = buildFlatParams(startStamp, endStamp);

  const transitionParams = (() => {
    if (isEmpty) return keyParams;
    if (input.startValue === undefined || input.endValue === undefined) {
      return keyParams;
    }
    const delta = input.endValue - input.startValue;
    if (!input.cp1 || !input.cp2) {
      return keyParams;
    }
    const params = {
      start: { x: startStamp, y: 0 },
      end: { x: endStamp, y: 1 },
      cp1: {
        x: input.cp1.x,
        y: delta === 0 ? 0 : (input.cp1.y - input.startValue) / delta,
      },
      cp2: {
        x: input.cp2.x,
        y: delta === 0 ? 1 : (input.cp2.y - input.startValue) / delta,
      },
    };
    // Rescale transition-space Y when explicit handles overshoot so the curve fits the track.
    return normalizeTransitionRange(params);
  })();

  const previewParams = (() => {
    if (!allowValueCurve) return keyParams;
    let startValue = input.startValue;
    let endValue = input.endValue;
    if (isEmpty) {
      if (startValue === undefined && endValue !== undefined) {
        startValue = endValue;
      } else if (endValue === undefined && startValue !== undefined) {
        endValue = startValue;
      }
    }
    if (startValue === undefined || endValue === undefined) {
      return keyParams;
    }
    const defaultCp1 = {
      x: startStamp + (endStamp - startStamp) * 0.33,
      y: startValue + (endValue - startValue) * 0.33,
    };
    const defaultCp2 = {
      x: startStamp + (endStamp - startStamp) * 0.67,
      y: startValue + (endValue - startValue) * 0.67,
    };
    const cp1 = input.cp1 ?? defaultCp1;
    const cp2 = input.cp2 ?? defaultCp2;
    return {
      start: { x: startStamp, y: startValue },
      end: { x: endStamp, y: endValue },
      cp1: { x: cp1.x, y: cp1.y },
      cp2: { x: cp2.x, y: cp2.y },
    };
  })();

  return {
    [TrackRender.Key]: keyParams,
    [TrackRender.Transition]: transitionParams,
    [TrackRender.Preview]: previewParams,
    [TrackRender.Spline]: previewParams,
  };
}

export function computeSegmentRenderParams(
  source: SourceRow,
  start: InstancedFrameInfo,
  end: InstancedFrameInfo,
  isEmpty: boolean,
  options?: ComputeTransitionParamsOptions,
): Partial<Record<TrackRender, TransitionParams>> {
  const startValue = extractFrameNumericValue(start);
  const endValue = extractFrameNumericValue(end);
  const allowValueCurve = source.data.length === 1;
  const transitions: EndpointTransitions | undefined =
    options?.transitions || start.transitions || end.transitions
      ? {
          startOut: options?.transitions?.startOut ?? start.transitions?.out,
          endIn: options?.transitions?.endIn ?? end.transitions?.in,
        }
      : undefined;

  if (startValue === undefined || endValue === undefined) {
    return buildRenderParamsFromControlPoints({
      startStamp: start.stamp,
      endStamp: end.stamp,
      startValue,
      endValue,
      isEmpty,
      allowValueCurve,
    });
  }

  const controlPoints = resolveSegmentControlPoints({
    start: { stamp: start.stamp, value: startValue },
    end: { stamp: end.stamp, value: endValue },
    transitions,
  });

  return buildRenderParamsFromControlPoints({
    startStamp: start.stamp,
    endStamp: end.stamp,
    startValue,
    endValue,
    cp1: controlPoints.cp1Effective,
    cp2: controlPoints.cp2Effective,
    isEmpty,
    allowValueCurve,
  });
}

export function computeTransitionParams(
  source: SourceRow,
  start: InstancedFrameInfo,
  end: InstancedFrameInfo,
  isEmpty: boolean,
  trackRender: TrackRender,
  _bounds: { min: number; max: number } = { min: 0, max: 1 },
  options?: ComputeTransitionParamsOptions,
): TransitionParams {
  const params = computeSegmentRenderParams(source, start, end, isEmpty, options);
  return params[trackRender] ?? buildFlatParams(start.stamp, end.stamp);
}
