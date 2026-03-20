import type { RawVector2 } from "@semio/utils";
import {
  TransitionDirective,
  type TransitionPatch,
  type TransitionPreference,
} from "../store-types";
import { StandardTransitionType, TransitionPairing, type AuthoredTransition } from "../types";
import type { SimpleKeypoint } from "../types/data/simple-track";
import { resolveTransitionDelta } from "./get-world-control-points";
import { inferAutoHandleDeltas } from "./infer-auto-handles";
import { resolveSegmentControlPoints } from "./resolve-segment-control-points";

export interface SelectedKeyContext {
  trackId: string;
  point: SimpleKeypoint;
  sortedTrackPoints: SimpleKeypoint[];
  pointIndex: number;
}

export function normalizeTransitionForUi(
  transition?: RawVector2 | TransitionPreference,
): TransitionPreference {
  if (!transition) return StandardTransitionType.Cubic;
  if (typeof transition === "object") {
    return TransitionDirective.ExplicitHandles;
  }
  return transition;
}

/** Tolerance for collinearity check (3 degrees). */
const PAIRING_COLLINEARITY_TOLERANCE_RAD = (3 * Math.PI) / 180;

/**
 * Infer pairing from the geometric collinearity of resolved handle directions.
 * Pairing is a directional constraint (handles lie on the same line through the
 * control point), independent of the transition type. Returns undefined when
 * collinearity cannot be determined (missing neighbors, zero-length handles).
 */
export function inferPairingFromHandleCollinearity(params: {
  prev: { stamp: number; value: number };
  anchor: { stamp: number; value: number };
  next: { stamp: number; value: number };
  inTransition: AuthoredTransition | string | undefined;
  outTransition: AuthoredTransition | string | undefined;
}): TransitionPairing | undefined {
  const { prev, anchor, next } = params;
  const inTransition = params.inTransition ?? StandardTransitionType.Cubic;
  const outTransition = params.outTransition ?? StandardTransitionType.Cubic;

  const inDelta = resolveTransitionDelta("in", prev.stamp, anchor.stamp, prev.value, anchor.value, inTransition);
  const outDelta = resolveTransitionDelta("out", anchor.stamp, next.stamp, anchor.value, next.value, outTransition);

  const inLen = Math.hypot(inDelta.x, inDelta.y);
  const outLen = Math.hypot(outDelta.x, outDelta.y);
  if (inLen === 0 || outLen === 0) return undefined;

  const dot = (inDelta.x * outDelta.x + inDelta.y * outDelta.y) / (inLen * outLen);
  const clampedDot = Math.max(-1, Math.min(1, dot));
  const angle = Math.acos(clampedDot);
  return Math.abs(Math.PI - angle) <= PAIRING_COLLINEARITY_TOLERANCE_RAD
    ? TransitionPairing.Paired
    : TransitionPairing.Free;
}

/**
 * Infer a default pairing for a pair of transitions based solely on their
 * normalized transition types. When both resolve to the same type, the
 * transitions are treated as Paired; otherwise they are Free.
 * This is a fallback heuristic when neighbor/geometry context is unavailable.
 */
export function resolveDefaultPairingForTransitions(
  incoming: RawVector2 | TransitionPreference | undefined,
  outgoing: RawVector2 | TransitionPreference | undefined,
): TransitionPairing {
  const inType = normalizeTransitionForUi(incoming);
  const outType = normalizeTransitionForUi(outgoing);
  return inType === outType ? TransitionPairing.Paired : TransitionPairing.Free;
}

export function resolvePairingForContext(
  context: SelectedKeyContext,
): TransitionPairing | undefined {
  const { point, sortedTrackPoints, pointIndex } = context;
  if (point.transitions?.pairing) {
    return point.transitions.pairing;
  }

  // Use collinearity-based inference when we have neighbor context,
  // matching the canvas behavior in resolvePairingByPoint.
  const prev = pointIndex > 0 ? sortedTrackPoints[pointIndex - 1] : undefined;
  const next = pointIndex < sortedTrackPoints.length - 1 ? sortedTrackPoints[pointIndex + 1] : undefined;
  if (
    prev && next &&
    typeof prev.value === "number" &&
    typeof point.value === "number" &&
    typeof next.value === "number"
  ) {
    return inferPairingFromHandleCollinearity({
      prev: { stamp: prev.stamp, value: prev.value },
      anchor: { stamp: point.stamp, value: point.value },
      next: { stamp: next.stamp, value: next.value },
      inTransition: point.transitions?.in,
      outTransition: point.transitions?.out,
    });
  }

  return undefined;
}

function contextHasPairableNeighbors(context: SelectedKeyContext): boolean {
  return context.pointIndex > 0 && context.pointIndex < context.sortedTrackPoints.length - 1;
}

function contextHasNeighbor(context: SelectedKeyContext, side: "in" | "out"): boolean {
  return side === "in"
    ? context.pointIndex > 0
    : context.pointIndex < context.sortedTrackPoints.length - 1;
}

function resolveSelectionTransitionValue(params: {
  value: TransitionPreference;
  side: "in" | "out";
  context: SelectedKeyContext;
}): RawVector2 | TransitionPreference {
  const { value, side, context } = params;
  if (value === TransitionDirective.InferredAutoClamped) {
    return value;
  }
  if (value !== TransitionDirective.ExplicitHandles) {
    return value;
  }

  const current = side === "in" ? context.point.transitions?.in : context.point.transitions?.out;
  if (current && typeof current === "object") {
    return { x: current.x, y: current.y };
  }

  const fromSegment = resolveEffectiveSegmentDeltaForContext(side, context);
  if (fromSegment) {
    return fromSegment;
  }

  const explicit = resolveExplicitDeltaForContext(side, context);
  return explicit ?? StandardTransitionType.Cubic;
}

function resolveExplicitDeltaForContext(
  side: "in" | "out",
  context: SelectedKeyContext,
): RawVector2 | undefined {
  const { point, sortedTrackPoints, pointIndex } = context;
  if (typeof point.value !== "number") return undefined;

  const prev = pointIndex > 0 ? sortedTrackPoints[pointIndex - 1] : undefined;
  const next =
    pointIndex >= 0 && pointIndex < sortedTrackPoints.length - 1
      ? sortedTrackPoints[pointIndex + 1]
      : undefined;

  if (
    prev &&
    next &&
    typeof prev.value === "number" &&
    typeof point.value === "number" &&
    typeof next.value === "number"
  ) {
    const inferred = inferAutoHandleDeltas({
      prev: { stamp: prev.stamp, value: prev.value },
      anchor: { stamp: point.stamp, value: point.value },
      next: { stamp: next.stamp, value: next.value },
    });
    if (inferred) {
      return side === "in" ? inferred.in : inferred.out;
    }
  }

  if (side === "in") {
    if (!prev || typeof prev.value !== "number") return undefined;
    return resolveTransitionDelta(
      "in",
      prev.stamp,
      point.stamp,
      prev.value,
      point.value,
      StandardTransitionType.Cubic,
    );
  }

  if (!next || typeof next.value !== "number") return undefined;
  return resolveTransitionDelta(
    "out",
    point.stamp,
    next.stamp,
    point.value,
    next.value,
    StandardTransitionType.Cubic,
  );
}

function resolveEffectiveSegmentDeltaForContext(
  side: "in" | "out",
  context: SelectedKeyContext,
): RawVector2 | undefined {
  const { sortedTrackPoints, pointIndex, point } = context;
  if (typeof point.value !== "number") {
    return undefined;
  }

  if (side === "out") {
    const end = sortedTrackPoints[pointIndex + 1];
    if (!end || typeof end.value !== "number") {
      return undefined;
    }
    const startPrev = sortedTrackPoints[pointIndex - 1];
    const endNext = sortedTrackPoints[pointIndex + 2];
    const resolved = resolveSegmentControlPoints({
      start: { stamp: point.stamp, value: point.value },
      end: { stamp: end.stamp, value: end.value },
      transitions: {
        startOut: point.transitions?.out,
        endIn: end.transitions?.in,
      },
      neighbors: {
        startPrev:
          startPrev && typeof startPrev.value === "number"
            ? { stamp: startPrev.stamp, value: startPrev.value }
            : undefined,
        endNext:
          endNext && typeof endNext.value === "number"
            ? { stamp: endNext.stamp, value: endNext.value }
            : undefined,
      },
    });
    const out = resolved.effectiveTransitions.startOut;
    return out && typeof out === "object" ? { x: out.x, y: out.y } : undefined;
  }

  const start = sortedTrackPoints[pointIndex - 1];
  if (!start || typeof start.value !== "number") {
    return undefined;
  }
  const startPrev = sortedTrackPoints[pointIndex - 2];
  const endNext = sortedTrackPoints[pointIndex + 1];
  const resolved = resolveSegmentControlPoints({
    start: { stamp: start.stamp, value: start.value },
    end: { stamp: point.stamp, value: point.value },
    transitions: {
      startOut: start.transitions?.out,
      endIn: point.transitions?.in,
    },
    neighbors: {
      startPrev:
        startPrev && typeof startPrev.value === "number"
          ? { stamp: startPrev.stamp, value: startPrev.value }
          : undefined,
      endNext:
        endNext && typeof endNext.value === "number"
          ? { stamp: endNext.stamp, value: endNext.value }
          : undefined,
    },
  });
  const incoming = resolved.effectiveTransitions.endIn;
  return incoming && typeof incoming === "object" ? { x: incoming.x, y: incoming.y } : undefined;
}

export function resolveNextSelectionTransitions(
  context: SelectedKeyContext,
  patch: TransitionPatch,
) {
  const { point, sortedTrackPoints, pointIndex } = context;
  const nextTransitions = {
    ...(point.transitions ?? {}),
  };

  if (patch.in !== undefined && contextHasNeighbor(context, "in")) {
    nextTransitions.in = resolveSelectionTransitionValue({
      value: patch.in,
      side: "in",
      context,
    });
  }
  if (patch.out !== undefined && contextHasNeighbor(context, "out")) {
    nextTransitions.out = resolveSelectionTransitionValue({
      value: patch.out,
      side: "out",
      context,
    });
  }

  if (patch.pairing !== undefined) {
    nextTransitions.pairing = patch.pairing;
    // When switching to Paired, align handles if they aren't already collinear.
    if (
      patch.pairing === TransitionPairing.Paired &&
      contextHasPairableNeighbors(context)
    ) {
      alignHandlesForPairing(nextTransitions, context);
    }
  } else if (
    (patch.in !== undefined || patch.out !== undefined) &&
    contextHasPairableNeighbors(context)
  ) {
    // After a toolbar type change, infer pairing from the collinearity of the
    // resulting handle directions. Only set Free if the change breaks collinearity;
    // don't re-pair handles that were already Free.
    const prev = sortedTrackPoints[pointIndex - 1];
    const next = sortedTrackPoints[pointIndex + 1];
    if (
      prev && next &&
      typeof prev.value === "number" &&
      typeof point.value === "number" &&
      typeof next.value === "number"
    ) {
      const currentPairing = point.transitions?.pairing;
      const inferred = inferPairingFromHandleCollinearity({
        prev: { stamp: prev.stamp, value: prev.value },
        anchor: { stamp: point.stamp, value: point.value },
        next: { stamp: next.stamp, value: next.value },
        inTransition: nextTransitions.in,
        outTransition: nextTransitions.out,
      });
      if (inferred === undefined) {
        // Collinearity indeterminate (e.g. zero-length handles) — keep existing
      } else if (inferred === TransitionPairing.Free) {
        // Change broke collinearity — set Free
        nextTransitions.pairing = TransitionPairing.Free;
      } else if (currentPairing === TransitionPairing.Free) {
        // Was explicitly Free — don't re-pair (user must toggle explicitly)
        nextTransitions.pairing = TransitionPairing.Free;
      } else {
        // Collinear and not explicitly Free — infer Paired
        nextTransitions.pairing = inferred;
      }
    }
  }

  return nextTransitions;
}

/**
 * Classify a transition as "standard" (easing enum), "explicit" ({x,y} delta),
 * or "auto" (inferred auto-clamped directive).
 */
function classifyTransition(
  transition: AuthoredTransition | undefined,
): "standard" | "explicit" | "auto" {
  if (!transition) return "standard";
  if (typeof transition === "object") return "explicit";
  if (transition === TransitionDirective.InferredAutoClamped) return "auto";
  return "standard";
}

/**
 * Resolve a transition to a world-space delta relative to the anchor, using
 * neighbor context for standard easing types and auto-clamped handles.
 */
function resolveHandleDeltaForAlignment(
  side: "in" | "out",
  transition: AuthoredTransition | undefined,
  anchor: { stamp: number; value: number },
  neighbor: { stamp: number; value: number },
  otherNeighbor?: { stamp: number; value: number },
): RawVector2 | undefined {
  if (transition && typeof transition === "object") {
    return transition;
  }

  // For auto-clamped, use the inferred handle delta
  if (transition === TransitionDirective.InferredAutoClamped && otherNeighbor) {
    const prev = side === "in" ? neighbor : otherNeighbor;
    const next = side === "in" ? otherNeighbor : neighbor;
    const inferred = inferAutoHandleDeltas({ prev, anchor, next });
    if (!inferred) return undefined;
    return side === "in" ? inferred.in : inferred.out;
  }

  // Standard easing type — resolve to world delta
  const easing = transition ?? StandardTransitionType.Cubic;
  if (side === "in") {
    return resolveTransitionDelta("in", neighbor.stamp, anchor.stamp, neighbor.value, anchor.value, easing);
  }
  return resolveTransitionDelta("out", anchor.stamp, neighbor.stamp, anchor.value, neighbor.value, easing);
}

/**
 * When pairing is set to Paired, align handles so they are collinear.
 *
 * Priority:
 * 1. Both standard types → no modification needed (already collinear)
 * 2. One explicit + one standard → align the explicit to the standard's direction
 * 3. Both explicit → average directions, preserve both lengths
 * 4. Auto-clamped → resolve first, then treat as explicit
 *
 * Modifies `nextTransitions` in place.
 */
function alignHandlesForPairing(
  nextTransitions: SimpleKeypoint["transitions"] & Record<string, unknown>,
  context: SelectedKeyContext,
): void {
  const { point, sortedTrackPoints, pointIndex } = context;
  if (typeof point.value !== "number") return;

  const prev = sortedTrackPoints[pointIndex - 1];
  const next = sortedTrackPoints[pointIndex + 1];
  if (!prev || !next || typeof prev.value !== "number" || typeof next.value !== "number") return;

  const anchor = { stamp: point.stamp, value: point.value };
  const prevPt = { stamp: prev.stamp, value: prev.value as number };
  const nextPt = { stamp: next.stamp, value: next.value as number };

  const inTransition = nextTransitions.in as AuthoredTransition | undefined;
  const outTransition = nextTransitions.out as AuthoredTransition | undefined;
  const inClass = classifyTransition(inTransition);
  const outClass = classifyTransition(outTransition);

  // Both standard → already collinear (horizontal handles), nothing to do
  if (inClass === "standard" && outClass === "standard") return;

  // Check if already collinear — if so, no modification needed
  const collinearity = inferPairingFromHandleCollinearity({
    prev: prevPt,
    anchor,
    next: nextPt,
    inTransition,
    outTransition,
  });
  if (collinearity === TransitionPairing.Paired) return;

  // Resolve both handles to world-space deltas
  const inDelta = resolveHandleDeltaForAlignment("in", inTransition, anchor, prevPt, nextPt);
  const outDelta = resolveHandleDeltaForAlignment("out", outTransition, anchor, nextPt, prevPt);
  if (!inDelta || !outDelta) return;

  const inLen = Math.hypot(inDelta.x, inDelta.y);
  const outLen = Math.hypot(outDelta.x, outDelta.y);

  if (inClass !== "standard" && outClass === "standard") {
    // Align explicit/auto in-handle to the standard out-handle's direction
    if (outLen === 0) return;
    // The out direction is the "forward" direction; in should be anti-parallel
    const dirX = -outDelta.x / outLen;
    const dirY = -outDelta.y / outLen;
    nextTransitions.in = { x: dirX * inLen, y: dirY * inLen };
  } else if (inClass === "standard" && outClass !== "standard") {
    // Align explicit/auto out-handle to the standard in-handle's direction
    if (inLen === 0) return;
    // The in direction points backward; out should be anti-parallel to it
    const dirX = -inDelta.x / inLen;
    const dirY = -inDelta.y / inLen;
    nextTransitions.out = { x: dirX * outLen, y: dirY * outLen };
  } else {
    // Both explicit/auto — average directions, preserve lengths
    // Forward direction: out as-is, negate in
    const inFwdX = -inDelta.x;
    const inFwdY = -inDelta.y;

    const inFwdLen = inLen;
    const outFwdLen = outLen;

    if (inFwdLen === 0 && outFwdLen === 0) return;

    // Normalize and average
    const inNormX = inFwdLen > 0 ? inFwdX / inFwdLen : 0;
    const inNormY = inFwdLen > 0 ? inFwdY / inFwdLen : 0;
    const outNormX = outFwdLen > 0 ? outDelta.x / outFwdLen : 0;
    const outNormY = outFwdLen > 0 ? outDelta.y / outFwdLen : 0;

    let avgX = inNormX + outNormX;
    let avgY = inNormY + outNormY;
    const avgLen = Math.hypot(avgX, avgY);

    if (avgLen === 0) {
      // Handles point in exactly opposite non-collinear directions — use out
      if (outFwdLen === 0) return;
      avgX = outDelta.x / outFwdLen;
      avgY = outDelta.y / outFwdLen;
    } else {
      avgX /= avgLen;
      avgY /= avgLen;
    }

    // Out handle: forward direction with original length
    nextTransitions.out = { x: avgX * outLen, y: avgY * outLen };
    // In handle: backward direction with original length
    nextTransitions.in = { x: -avgX * inLen, y: -avgY * inLen };
  }
}
