import type { InstancedFrameInfo, SourceRow, EndpointTransitions } from "../types";
import { TrackRender } from "../types";
import {
  ComputeTransitionParamsOptions,
  computeTransitionParams,
} from "./compute-transition-params";
import type { TransitionParams } from "./compute-transition-params";

export interface BuildSegmentRenderParamsInput {
  sourceRow: SourceRow;
  start: InstancedFrameInfo;
  end: InstancedFrameInfo;
  isEmpty: boolean;
  verticalBounds?: { min: number; max: number };
  transitions?: EndpointTransitions;
}

export function buildSegmentRenderParams(
  input: BuildSegmentRenderParamsInput,
): Partial<Record<TrackRender, TransitionParams>> {
  const bounds = input.verticalBounds ?? { min: 0, max: 1 };
  const options: ComputeTransitionParamsOptions | undefined = input.transitions
    ? { transitions: input.transitions }
    : undefined;

  return {
    [TrackRender.Key]: computeTransitionParams(
      input.sourceRow,
      input.start,
      input.end,
      input.isEmpty,
      TrackRender.Key,
      bounds,
      options,
    ),
    [TrackRender.Transition]: computeTransitionParams(
      input.sourceRow,
      input.start,
      input.end,
      input.isEmpty,
      TrackRender.Transition,
      bounds,
      options,
    ),
    [TrackRender.Preview]: computeTransitionParams(
      input.sourceRow,
      input.start,
      input.end,
      input.isEmpty,
      TrackRender.Preview,
      bounds,
      options,
    ),
    [TrackRender.Spline]: computeTransitionParams(
      input.sourceRow,
      input.start,
      input.end,
      input.isEmpty,
      TrackRender.Spline,
      bounds,
      options,
    ),
  };
}
