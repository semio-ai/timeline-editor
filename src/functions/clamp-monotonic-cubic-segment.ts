import { DEFAULT_TRANSITION_IN, DEFAULT_TRANSITION_OUT } from "../constants";
import type { ClampFlags, EndpointTransitions, WorldCP } from "../types";

const EPSILON_DEFAULT = 1e-6;

export interface ClampInput {
  start: { stamp: number; value: number };
  end: { stamp: number; value: number };
  rawTransitions: EndpointTransitions;
  epsilon?: number;
}

export interface ClampOutput {
  cp1Raw?: WorldCP;
  cp2Raw?: WorldCP;
  cp1Effective?: WorldCP;
  cp2Effective?: WorldCP;
  transitionsEffective: EndpointTransitions;
  flags: ClampFlags;
}

export function clampMonotonicCubicSegment(input: ClampInput): ClampOutput {
  const epsilon = input.epsilon ?? EPSILON_DEFAULT;
  const startOut = input.rawTransitions.startOut ?? DEFAULT_TRANSITION_OUT;
  const endIn = input.rawTransitions.endIn ?? DEFAULT_TRANSITION_IN;

  const span = input.end.stamp - input.start.stamp;
  const delta = input.end.value - input.start.value;

  const cp1Raw = toWorldCP(input.start, span, delta, startOut);
  const cp2Raw = toWorldCP(input.start, span, delta, endIn);

  let cp1Effective = cp1Raw ? { ...cp1Raw } : undefined;
  let cp2Effective = cp2Raw ? { ...cp2Raw } : undefined;

  const flags: ClampFlags = {};

  const startAnchor = { x: input.start.stamp, y: input.start.value };
  const endAnchor = { x: input.end.stamp, y: input.end.value };

  if (span === 0) {
    if (cp1Effective) {
      cp1Effective = { ...cp1Effective, x: startAnchor.x };
      if (cp1Raw && !pointsEqual(cp1Raw, cp1Effective)) {
        flags.cp1Clamped = true;
      }
    }
    if (cp2Effective) {
      cp2Effective = { ...cp2Effective, x: endAnchor.x };
      if (cp2Raw && !pointsEqual(cp2Raw, cp2Effective)) {
        flags.cp2Clamped = true;
      }
    }
  } else {
    const minX = Math.min(startAnchor.x, endAnchor.x);
    const maxX = Math.max(startAnchor.x, endAnchor.x);

    if (cp1Effective) {
      const { clamped, point } = clampHandleAlongAnchor(startAnchor, cp1Effective, minX, maxX);
      cp1Effective = point;
      if (clamped) {
        flags.cp1Clamped = true;
      }
    }

    if (cp2Effective) {
      const { clamped, point } = clampHandleAlongAnchor(endAnchor, cp2Effective, minX, maxX);
      cp2Effective = point;
      if (clamped) {
        flags.cp2Clamped = true;
      }
    }

    if (cp1Effective && cp2Effective && cp1Effective.x > cp2Effective.x - epsilon) {
      const midpoint = (cp1Effective.x + cp2Effective.x) / 2;
      const { clamped: cp1Adjusted, point: cp1Point } = clampHandleAlongAnchor(
        startAnchor,
        cp1Effective,
        minX,
        midpoint,
      );
      cp1Effective = cp1Point;
      const { clamped: cp2Adjusted, point: cp2Point } = clampHandleAlongAnchor(
        endAnchor,
        cp2Effective,
        midpoint,
        maxX,
      );
      cp2Effective = cp2Point;
      if (cp1Adjusted) flags.cp1Clamped = true;
      if (cp2Adjusted) flags.cp2Clamped = true;
      flags.knotPrevented = true;
    }
  }

  const transitionsEffective: EndpointTransitions = {
    startOut: cp1Effective
      ? toNormalizedTransition(input.start, span, delta, cp1Effective, startOut)
      : startOut,
    endIn: cp2Effective
      ? toNormalizedTransition(input.start, span, delta, cp2Effective, endIn)
      : endIn,
  };

  return {
    cp1Raw,
    cp2Raw,
    cp1Effective,
    cp2Effective,
    transitionsEffective,
    flags,
  };
}

function toWorldCP(
  start: { stamp: number; value: number },
  span: number,
  delta: number,
  transition: { x: number; y: number },
): WorldCP {
  return {
    x: start.stamp + span * transition.x,
    y: start.value + delta * transition.y,
  };
}

function clampHandleAlongAnchor(
  anchor: WorldCP,
  cp: WorldCP,
  minX: number,
  maxX: number,
): { point: WorldCP; clamped: boolean } {
  let lowerBound = minX;
  let upperBound = maxX;
  if (lowerBound > upperBound) {
    const center = (lowerBound + upperBound) / 2;
    lowerBound = center;
    upperBound = center;
  }

  let targetX = cp.x;
  if (targetX < lowerBound) {
    targetX = lowerBound;
  } else if (targetX > upperBound) {
    targetX = upperBound;
  }

  if (Math.abs(targetX - cp.x) < EPSILON_DEFAULT) {
    return { point: cp, clamped: false };
  }

  return {
    point: scaleToX(anchor, cp, targetX),
    clamped: true,
  };
}

function scaleToX(anchor: WorldCP, cp: WorldCP, targetX: number): WorldCP {
  const dx = cp.x - anchor.x;
  const dy = cp.y - anchor.y;
  if (dx === 0) {
    return { x: targetX, y: anchor.y };
  }
  const ratio = (targetX - anchor.x) / dx;
  if (!Number.isFinite(ratio)) {
    return { x: targetX, y: anchor.y };
  }
  return {
    x: anchor.x + dx * ratio,
    y: anchor.y + dy * ratio,
  };
}

function toNormalizedTransition(
  start: { stamp: number; value: number },
  span: number,
  delta: number,
  cp: WorldCP,
  fallback: { x: number; y: number },
) {
  const normalizedX = span === 0 ? fallback.x : (cp.x - start.stamp) / span;
  const normalizedY = delta === 0 ? fallback.y : (cp.y - start.value) / delta;
  return { x: normalizedX, y: normalizedY };
}

function pointsEqual(a: WorldCP, b: WorldCP): boolean {
  return Math.abs(a.x - b.x) < EPSILON_DEFAULT && Math.abs(a.y - b.y) < EPSILON_DEFAULT;
}
