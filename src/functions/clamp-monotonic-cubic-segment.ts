import { DEFAULT_TRANSITION_IN, DEFAULT_TRANSITION_OUT } from "../constants";
import type { ClampFlags, EndpointTransitions, WorldCP } from "../types";
import { resolveTransitionDelta } from "./get-world-control-points";

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

  const startOutDelta = resolveTransitionDelta(
    "out",
    input.start.stamp,
    input.end.stamp,
    input.start.value,
    input.end.value,
    startOut,
  );
  const endInDelta = resolveTransitionDelta(
    "in",
    input.start.stamp,
    input.end.stamp,
    input.start.value,
    input.end.value,
    endIn,
  );

  const cp1Raw = toWorldCP(input.start, startOutDelta);
  const cp2Raw = toWorldCP(input.end, endInDelta);

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

    const monotonicResult = enforceMonotonicX({
      startAnchor,
      endAnchor,
      span,
      cp1: cp1Effective,
      cp2: cp2Effective,
      epsilon,
    });

    if (monotonicResult?.cp1 && cp1Effective) {
      if (!pointsEqual(cp1Effective, monotonicResult.cp1)) {
        flags.cp1Clamped = true;
        flags.knotPrevented = true;
        cp1Effective = monotonicResult.cp1;
      }
    }

    if (monotonicResult?.cp2 && cp2Effective) {
      if (!pointsEqual(cp2Effective, monotonicResult.cp2)) {
        flags.cp2Clamped = true;
        flags.knotPrevented = true;
        cp2Effective = monotonicResult.cp2;
      }
    }
  }

  const transitionsEffective: EndpointTransitions = {
    startOut: cp1Effective ? toAnchorRelativeDelta(input.start, cp1Effective) : startOutDelta,
    endIn: cp2Effective ? toAnchorRelativeDelta(input.end, cp2Effective) : endInDelta,
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
  anchor: { stamp: number; value: number },
  delta: { x: number; y: number },
): WorldCP {
  return {
    x: anchor.stamp + delta.x,
    y: anchor.value + delta.y,
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

function toAnchorRelativeDelta(anchor: { stamp: number; value: number }, cp: WorldCP) {
  return { x: cp.x - anchor.stamp, y: cp.y - anchor.value };
}

function pointsEqual(a: WorldCP, b: WorldCP): boolean {
  return Math.abs(a.x - b.x) < EPSILON_DEFAULT && Math.abs(a.y - b.y) < EPSILON_DEFAULT;
}

function enforceMonotonicX(params: {
  startAnchor: WorldCP;
  endAnchor: WorldCP;
  span: number;
  epsilon: number;
  cp1?: WorldCP;
  cp2?: WorldCP;
}):
  | {
      cp1?: WorldCP;
      cp2?: WorldCP;
    }
  | undefined {
  const { startAnchor, endAnchor, cp1, cp2, span, epsilon } = params;
  if (!cp1 || !cp2 || span === 0) {
    return undefined;
  }

  const cp1Normalized = (cp1.x - startAnchor.x) / span;
  const cp2Normalized = (cp2.x - startAnchor.x) / span;

  if (isMonotonicNormalized(cp1Normalized, cp2Normalized, epsilon)) {
    return undefined;
  }

  const clampedNormalized = clampNormalizedForMonotonic(cp1Normalized, cp2Normalized, epsilon);
  if (!clampedNormalized) {
    return undefined;
  }

  const { cp1Normalized: nCp1, cp2Normalized: nCp2 } = clampedNormalized;
  const targetCp1X = startAnchor.x + nCp1 * span;
  const targetCp2X = startAnchor.x + nCp2 * span;

  return {
    cp1: clampHandleToX(startAnchor, cp1, targetCp1X),
    cp2: clampHandleToX(endAnchor, cp2, targetCp2X),
  };
}

function isMonotonicNormalized(
  cp1Normalized: number,
  cp2Normalized: number,
  epsilon: number = EPSILON_DEFAULT,
): boolean {
  const derivativeMin = cubicDerivativeMinimum(cp1Normalized, cp2Normalized);
  return derivativeMin >= -epsilon;
}

function clampNormalizedForMonotonic(
  cp1Normalized: number,
  cp2Normalized: number,
  epsilon: number,
): { cp1Normalized: number; cp2Normalized: number } | undefined {
  const anchorOut = 0;
  const anchorIn = 1;

  const allows = (t: number) => {
    const x1 = anchorOut + (cp1Normalized - anchorOut) * t;
    const x2 = anchorIn + (cp2Normalized - anchorIn) * t;
    return { x1, x2 };
  };

  let low = 0;
  let high = 1;
  let best: { cp1Normalized: number; cp2Normalized: number } | undefined;

  for (let i = 0; i < 30; i++) {
    const mid = (low + high) / 2;
    const candidate = allows(mid);
    if (isMonotonicNormalized(candidate.x1, candidate.x2, epsilon)) {
      best = { cp1Normalized: candidate.x1, cp2Normalized: candidate.x2 };
      low = mid;
    } else {
      high = mid;
    }
  }

  return best ?? { cp1Normalized: anchorOut, cp2Normalized: anchorIn };
}

function cubicDerivativeMinimum(cp1Normalized: number, cp2Normalized: number): number {
  const x1 = cp1Normalized;
  const x2 = cp2Normalized;
  const a = 1 + 3 * (x1 - x2);
  const b = 3 * (x2 - 2 * x1);
  const c = 3 * x1;

  const A = 3 * a;
  const B = 2 * b;
  const C = c;

  const derivative = (t: number) => A * t * t + B * t + C;

  let min = Math.min(derivative(0), derivative(1));
  if (Math.abs(A) > EPSILON_DEFAULT) {
    const t = -B / (2 * A);
    if (t >= 0 && t <= 1) {
      min = Math.min(min, derivative(t));
    }
  }
  return min;
}
