import { DEFAULT_TRANSITION_IN, DEFAULT_TRANSITION_OUT } from "../constants";
import type { ClampFlags, EndpointTransitions, WorldCP } from "../types";
import { StandardTransitionType, TransitionDirective } from "../types";
import { clampMonotonicCubicSegment } from "./clamp-monotonic-cubic-segment";
import { inferAutoHandleDeltas } from "./infer-auto-handles";

export interface SegmentControlPointInput {
  start: { stamp: number; value: number };
  end: { stamp: number; value: number };
  transitions?: EndpointTransitions;
  neighbors?: {
    startPrev?: { stamp: number; value: number };
    endNext?: { stamp: number; value: number };
  };
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
  const authoredTransitions: EndpointTransitions = {
    startOut: input.transitions?.startOut ?? DEFAULT_TRANSITION_OUT,
    endIn: input.transitions?.endIn ?? DEFAULT_TRANSITION_IN,
  };

  const rawTransitions: EndpointTransitions = {
    startOut: resolveAuthoredSideTransition({
      side: "out",
      authored: authoredTransitions.startOut,
      start: input.start,
      end: input.end,
      neighbors: input.neighbors,
    }),
    endIn: resolveAuthoredSideTransition({
      side: "in",
      authored: authoredTransitions.endIn,
      start: input.start,
      end: input.end,
      neighbors: input.neighbors,
    }),
  };

  const result = clampMonotonicCubicSegment({
    start: input.start,
    end: input.end,
    rawTransitions,
  });

  const autoClampedEffective = applyAutoClampedEffectiveLimits({
    authoredTransitions,
    start: input.start,
    end: input.end,
    neighbors: input.neighbors,
    cp1Effective: result.cp1Effective,
    cp2Effective: result.cp2Effective,
  });
  const cp1Effective = autoClampedEffective.cp1Effective;
  const cp2Effective = autoClampedEffective.cp2Effective;
  const flags = {
    ...result.flags,
    ...autoClampedEffective.flags,
  };
  const effectiveTransitions: EndpointTransitions = {
    startOut: cp1Effective
      ? toAnchorRelativeDelta(input.start, cp1Effective)
      : rawTransitions.startOut,
    endIn: cp2Effective ? toAnchorRelativeDelta(input.end, cp2Effective) : rawTransitions.endIn,
  };

  return {
    rawTransitions,
    effectiveTransitions,
    cp1Raw: result.cp1Raw,
    cp2Raw: result.cp2Raw,
    cp1Effective,
    cp2Effective,
    flags,
  };
}

function resolveAuthoredSideTransition(params: {
  side: "out" | "in";
  authored: EndpointTransitions["startOut"];
  start: { stamp: number; value: number };
  end: { stamp: number; value: number };
  neighbors?: SegmentControlPointInput["neighbors"];
}): EndpointTransitions["startOut"] {
  const { side, authored, start, end, neighbors } = params;
  if (!authored || typeof authored === "object") {
    return authored;
  }
  if (
    authored !== TransitionDirective.ExplicitHandles &&
    authored !== TransitionDirective.InferredAutoClamped
  ) {
    return authored;
  }

  const inferred = inferFromSegmentNeighborhood({
    side,
    start,
    end,
    neighbors,
  });
  if (!inferred) {
    return StandardTransitionType.Cubic;
  }

  if (authored === TransitionDirective.InferredAutoClamped) {
    return clampAutoRawDeltaToSegment({
      side,
      start,
      end,
      delta: inferred,
    });
  }

  return inferred;
}

function inferFromSegmentNeighborhood(params: {
  side: "out" | "in";
  start: { stamp: number; value: number };
  end: { stamp: number; value: number };
  neighbors?: SegmentControlPointInput["neighbors"];
}): { x: number; y: number } | undefined {
  const { side, start, end, neighbors } = params;
  const inferred =
    side === "out"
      ? inferAutoHandleDeltas({
          prev: neighbors?.startPrev,
          anchor: start,
          next: end,
        })
      : inferAutoHandleDeltas({
          prev: start,
          anchor: end,
          next: neighbors?.endNext,
        });
  if (!inferred) {
    return undefined;
  }
  return side === "out" ? inferred.out : inferred.in;
}

function clampAutoRawDeltaToSegment(params: {
  side: "out" | "in";
  start: { stamp: number; value: number };
  end: { stamp: number; value: number };
  delta: { x: number; y: number };
}): { x: number; y: number } {
  const { side, start, end, delta } = params;
  const anchor = side === "out" ? start : end;
  const opposite = side === "out" ? end : start;
  const minX = Math.min(start.stamp, end.stamp);
  const maxX = Math.max(start.stamp, end.stamp);
  let cp: WorldCP = {
    x: anchor.stamp + delta.x,
    y: anchor.value + delta.y,
  };

  cp = clampHandleToSegmentStampRange({
    anchor,
    cp,
    minX,
    maxX,
  });
  cp = clampHandleToSegmentValueRange({
    anchor,
    opposite,
    cp,
  });
  // Value-range clamping can adjust x, so enforce stamp bounds again.
  cp = clampHandleToSegmentStampRange({
    anchor,
    cp,
    minX,
    maxX,
  });

  return {
    x: cp.x - anchor.stamp,
    y: cp.y - anchor.value,
  };
}

function applyAutoClampedEffectiveLimits(params: {
  authoredTransitions: EndpointTransitions;
  start: { stamp: number; value: number };
  end: { stamp: number; value: number };
  neighbors?: SegmentControlPointInput["neighbors"];
  cp1Effective?: WorldCP;
  cp2Effective?: WorldCP;
}): { cp1Effective?: WorldCP; cp2Effective?: WorldCP; flags: ClampFlags } {
  const { authoredTransitions, start, end, neighbors } = params;
  let cp1Effective = params.cp1Effective ? { ...params.cp1Effective } : undefined;
  let cp2Effective = params.cp2Effective ? { ...params.cp2Effective } : undefined;
  const flags: ClampFlags = {};
  const segmentDelta = end.value - start.value;

  if (isInferredAutoClamped(authoredTransitions.startOut) && cp1Effective) {
    let clamped = clampHandleToSegmentValueRange({
      anchor: start,
      opposite: end,
      cp: cp1Effective,
    });
    if (
      shouldFlattenStartTangent({
        startPrev: neighbors?.startPrev,
        start,
        segmentDelta,
      })
    ) {
      clamped = clampHandleToTargetY({
        anchor: start,
        cp: clamped,
        targetY: start.value,
      });
    }
    clamped = clampHandleToSegmentStampRange({
      anchor: start,
      cp: clamped,
      minX: Math.min(start.stamp, end.stamp),
      maxX: Math.max(start.stamp, end.stamp),
    });
    if (!pointsEqual(clamped, cp1Effective)) {
      cp1Effective = clamped;
      flags.cp1Clamped = true;
    }
  }

  if (isInferredAutoClamped(authoredTransitions.endIn) && cp2Effective) {
    let clamped = clampHandleToSegmentValueRange({
      anchor: end,
      opposite: start,
      cp: cp2Effective,
    });
    if (
      shouldFlattenEndTangent({
        endNext: neighbors?.endNext,
        end,
        segmentDelta,
      })
    ) {
      clamped = clampHandleToTargetY({
        anchor: end,
        cp: clamped,
        targetY: end.value,
      });
    }
    clamped = clampHandleToSegmentStampRange({
      anchor: end,
      cp: clamped,
      minX: Math.min(start.stamp, end.stamp),
      maxX: Math.max(start.stamp, end.stamp),
    });
    if (!pointsEqual(clamped, cp2Effective)) {
      cp2Effective = clamped;
      flags.cp2Clamped = true;
    }
  }

  return { cp1Effective, cp2Effective, flags };
}

function isInferredAutoClamped(transition: EndpointTransitions["startOut"]): boolean {
  return transition === TransitionDirective.InferredAutoClamped;
}

function clampHandleToSegmentValueRange(params: {
  anchor: { stamp: number; value: number };
  opposite: { stamp: number; value: number };
  cp: WorldCP;
}): WorldCP {
  const { anchor, opposite, cp } = params;
  const minY = Math.min(anchor.value, opposite.value);
  const maxY = Math.max(anchor.value, opposite.value);
  if (cp.y >= minY && cp.y <= maxY) {
    return cp;
  }

  const targetY = cp.y < minY ? minY : maxY;
  return clampHandleToTargetY({
    anchor,
    cp,
    targetY,
  });
}

function clampHandleToTargetY(params: {
  anchor: { stamp: number; value: number };
  cp: WorldCP;
  targetY: number;
}): WorldCP {
  const { anchor, cp, targetY } = params;
  // If clamping to the anchor value (flat tangent), preserve x so the handle
  // keeps its temporal influence instead of collapsing to zero length.
  if (Math.abs(targetY - anchor.value) < 1e-6) {
    return { x: cp.x, y: targetY };
  }
  const dy = cp.y - anchor.value;
  if (dy === 0) {
    return { x: anchor.stamp, y: targetY };
  }

  const dx = cp.x - anchor.stamp;
  const ratio = (targetY - anchor.value) / dy;
  if (!Number.isFinite(ratio)) {
    return { x: anchor.stamp, y: targetY };
  }

  return {
    x: anchor.stamp + dx * ratio,
    y: anchor.value + dy * ratio,
  };
}

function clampHandleToSegmentStampRange(params: {
  anchor: { stamp: number; value: number };
  cp: WorldCP;
  minX: number;
  maxX: number;
}): WorldCP {
  const { anchor, cp, minX, maxX } = params;
  if (cp.x >= minX && cp.x <= maxX) {
    return cp;
  }
  const targetX = cp.x < minX ? minX : maxX;
  return clampHandleToTargetX({ anchor, cp, targetX });
}

function clampHandleToTargetX(params: {
  anchor: { stamp: number; value: number };
  cp: WorldCP;
  targetX: number;
}): WorldCP {
  const { anchor, cp, targetX } = params;
  const dx = cp.x - anchor.stamp;
  if (dx === 0) {
    return { x: targetX, y: anchor.value };
  }
  const dy = cp.y - anchor.value;
  const ratio = (targetX - anchor.stamp) / dx;
  if (!Number.isFinite(ratio)) {
    return { x: targetX, y: anchor.value };
  }
  return {
    x: anchor.stamp + dx * ratio,
    y: anchor.value + dy * ratio,
  };
}

function shouldFlattenStartTangent(params: {
  startPrev?: { stamp: number; value: number };
  start: { stamp: number; value: number };
  segmentDelta: number;
}): boolean {
  const { startPrev, start, segmentDelta } = params;
  if (!startPrev) {
    return false;
  }
  const prevDelta = start.value - startPrev.value;
  if (isNearlyZero(prevDelta) || isNearlyZero(segmentDelta)) {
    return true;
  }
  return Math.sign(prevDelta) !== Math.sign(segmentDelta);
}

function shouldFlattenEndTangent(params: {
  endNext?: { stamp: number; value: number };
  end: { stamp: number; value: number };
  segmentDelta: number;
}): boolean {
  const { endNext, end, segmentDelta } = params;
  if (!endNext) {
    return false;
  }
  const nextDelta = endNext.value - end.value;
  if (isNearlyZero(nextDelta) || isNearlyZero(segmentDelta)) {
    return true;
  }
  return Math.sign(segmentDelta) !== Math.sign(nextDelta);
}

function isNearlyZero(value: number): boolean {
  return Math.abs(value) < 1e-6;
}

function toAnchorRelativeDelta(anchor: { stamp: number; value: number }, cp: WorldCP) {
  return { x: cp.x - anchor.stamp, y: cp.y - anchor.value };
}

function pointsEqual(a: WorldCP, b: WorldCP): boolean {
  return Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6;
}
