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
  // const epsilon = input.epsilon ?? EPSILON_DEFAULT;
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
      cp1Effective = clampHandleToX(startAnchor, cp1Effective, startAnchor.x);
      if (cp1Raw && !pointsEqual(cp1Raw, cp1Effective)) {
        flags.cp1Clamped = true;
      }
    }
    if (cp2Effective) {
      cp2Effective = clampHandleToX(endAnchor, cp2Effective, endAnchor.x);
      if (cp2Raw && !pointsEqual(cp2Raw, cp2Effective)) {
        flags.cp2Clamped = true;
      }
    }
  } else {
    if (cp1Effective && cp1Effective.x < startAnchor.x) {
      cp1Effective = clampHandleToX(startAnchor, cp1Effective, startAnchor.x);
      flags.cp1Clamped = true;
    }

    if (cp2Effective && cp2Effective.x > endAnchor.x) {
      cp2Effective = clampHandleToX(endAnchor, cp2Effective, endAnchor.x);
      flags.cp2Clamped = true;
    }

    // When both handles remain on their respective sides, we allow them to cross without
    // shortening the raw distance. Any true knot/backtrack will be resolved once future
    // phases add more precise detection logic.
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

function clampHandleToX(anchor: WorldCP, cp: WorldCP, targetX: number): WorldCP {
  if (Math.abs(targetX - cp.x) < EPSILON_DEFAULT) {
    return cp;
  }
  return scaleToX(anchor, cp, targetX);
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
