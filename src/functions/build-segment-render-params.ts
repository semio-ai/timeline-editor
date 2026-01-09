import type { InstancedFrameInfo, SourceRow, EndpointTransitions } from "../types";
import { TrackRender } from "../types";
import {
  ComputeTransitionParamsOptions,
  TransitionParams,
  computeSegmentRenderParams,
} from "./compute-transition-params";

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
  const options: ComputeTransitionParamsOptions | undefined = input.transitions
    ? { transitions: input.transitions }
    : undefined;
  return computeSegmentRenderParams(
    input.sourceRow,
    input.start,
    input.end,
    input.isEmpty,
    options,
  );
}
