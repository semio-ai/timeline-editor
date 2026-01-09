import { DEFAULT_TRANSITION_IN, DEFAULT_TRANSITION_OUT } from "../constants";
import type { ClampFlags, EndpointTransitions, WorldCP } from "../types";
import { clampMonotonicCubicSegment } from "./clamp-monotonic-cubic-segment";

export interface SegmentControlPointInput {
  start: { stamp: number; value: number };
  end: { stamp: number; value: number };
  transitions?: EndpointTransitions;
}

export interface SegmentControlPointResult {
  rawTransitions: EndpointTransitions;
  effectiveTransitions: EndpointTransitions;
  cp1Raw?: WorldCP;
  cp2Raw?: WorldCP;
  cp1Effective?: WorldCP;
  cp2Effective?: WorldCP;
  flags: ClampFlags;
}

export function resolveSegmentControlPoints(
  input: SegmentControlPointInput,
): SegmentControlPointResult {
  const rawTransitions: EndpointTransitions = {
    startOut: input.transitions?.startOut ?? DEFAULT_TRANSITION_OUT,
    endIn: input.transitions?.endIn ?? DEFAULT_TRANSITION_IN,
  };

  const result = clampMonotonicCubicSegment({
    start: input.start,
    end: input.end,
    rawTransitions,
  });

  return {
    rawTransitions,
    effectiveTransitions: result.transitionsEffective,
    cp1Raw: result.cp1Raw,
    cp2Raw: result.cp2Raw,
    cp1Effective: result.cp1Effective,
    cp2Effective: result.cp2Effective,
    flags: result.flags,
  };
}
