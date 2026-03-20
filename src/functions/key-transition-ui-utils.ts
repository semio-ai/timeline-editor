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
  if (!inDelta || !outDelta) return undefined;

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
 * Infer default pairing for a pair of transitions using collinearity when
 * neighbor context is available, falling back to Paired for standard types.
 */
export function resolveDefaultPairingForTransitions(
  incoming: RawVector2 | TransitionPreference | undefined,
  outgoing: RawVector2 | TransitionPreference | undefined,
): TransitionPairing {
  // Without neighbor context, fall back to type comparison as a heuristic.
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
      if (inferred === TransitionPairing.Free) {
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
