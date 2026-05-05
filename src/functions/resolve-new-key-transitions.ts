import {
  type AnimationData,
  TransitionDirective,
  type TransitionPreference,
} from "../store-types";
import { StandardTransitionType, TransitionPairing } from "../types";
import type { SimpleKeypoint, SimpleRawValue } from "../types/data/simple-track";
import { resolveTransitionDelta } from "./get-world-control-points";
import { inferAutoHandleDeltas } from "./infer-auto-handles";

export interface NewKeyTransitionPreferences {
  in: TransitionPreference;
  out: TransitionPreference;
  pairing: TransitionPairing;
}

/**
 * Reads the user's configured new-key transition defaults from the animation
 * store, falling back to cubic + paired when nothing is set. The fallback
 * matches historical behavior for stores that pre-date the preference.
 */
export function resolveNewKeyTransitionPreferences(
  state: AnimationData,
): NewKeyTransitionPreferences {
  const defaults = state.preferences?.newKeyDefaults?.transitions;
  return {
    in: defaults?.in ?? StandardTransitionType.Cubic,
    out: defaults?.out ?? StandardTransitionType.Cubic,
    pairing: defaults?.pairing ?? TransitionPairing.Paired,
  };
}

/**
 * Builds the `transitions` object to attach to a newly created keypoint,
 * honoring the user's configured defaults on BOTH sides regardless of whether
 * a neighbor exists at insertion time.
 *
 * Both sides are always populated so the preference sticks even when the new
 * key is at an endpoint — once a neighbor is later added, the user's chosen
 * default takes effect rather than silently falling back to cubic.
 *
 * For `ExplicitHandles`, the geometric resolution needs neighbors to compute
 * handle deltas; when a neighbor is missing the side falls through to a cubic
 * easing tag (functionally equivalent and correctly typed).
 */
export function resolveNewKeyTransitions(params: {
  prevPoint: SimpleKeypoint | undefined;
  nextPoint: SimpleKeypoint | undefined;
  anchor: { stamp: number; value: SimpleRawValue };
  defaults: NewKeyTransitionPreferences;
}): NonNullable<SimpleKeypoint["transitions"]> {
  const { prevPoint, nextPoint, anchor, defaults } = params;
  return {
    pairing: defaults.pairing,
    in: resolveSidePreference({
      preference: defaults.in,
      side: "in",
      prevPoint,
      nextPoint,
      anchor,
    }),
    out: resolveSidePreference({
      preference: defaults.out,
      side: "out",
      prevPoint,
      nextPoint,
      anchor,
    }),
  };
}

function resolveSidePreference(params: {
  preference: TransitionPreference;
  side: "in" | "out";
  prevPoint: SimpleKeypoint | undefined;
  nextPoint: SimpleKeypoint | undefined;
  anchor: { stamp: number; value: SimpleRawValue };
}): NonNullable<SimpleKeypoint["transitions"]>["in"] {
  const { preference, side, prevPoint, nextPoint, anchor } = params;

  if (preference === TransitionDirective.InferredAutoClamped) {
    return preference;
  }
  if (preference !== TransitionDirective.ExplicitHandles) {
    return preference;
  }

  // ExplicitHandles: compute handle deltas geometrically when neighbors allow.
  const inferred = resolveInferredExplicitHandle({ side, prevPoint, nextPoint, anchor });
  if (inferred) return inferred;

  const explicit = resolveCubicExplicitHandle({ side, prevPoint, nextPoint, anchor });
  return explicit ?? StandardTransitionType.Cubic;
}

function resolveInferredExplicitHandle(params: {
  side: "in" | "out";
  prevPoint: SimpleKeypoint | undefined;
  nextPoint: SimpleKeypoint | undefined;
  anchor: { stamp: number; value: SimpleRawValue };
}): { x: number; y: number } | undefined {
  const { side, prevPoint, nextPoint, anchor } = params;
  if (typeof anchor.value !== "number") return undefined;
  if (!prevPoint || !nextPoint) return undefined;
  if (typeof prevPoint.value !== "number" || typeof nextPoint.value !== "number") return undefined;

  const inferred = inferAutoHandleDeltas({
    prev: { stamp: prevPoint.stamp, value: prevPoint.value },
    anchor: { stamp: anchor.stamp, value: anchor.value },
    next: { stamp: nextPoint.stamp, value: nextPoint.value },
  });
  if (!inferred) return undefined;
  return side === "in" ? inferred.in : inferred.out;
}

function resolveCubicExplicitHandle(params: {
  side: "in" | "out";
  prevPoint: SimpleKeypoint | undefined;
  nextPoint: SimpleKeypoint | undefined;
  anchor: { stamp: number; value: SimpleRawValue };
}): { x: number; y: number } | undefined {
  const { side, prevPoint, nextPoint, anchor } = params;
  if (typeof anchor.value !== "number") return undefined;

  if (side === "in") {
    if (!prevPoint || typeof prevPoint.value !== "number") return undefined;
    return resolveTransitionDelta(
      "in",
      prevPoint.stamp,
      anchor.stamp,
      prevPoint.value,
      anchor.value,
      StandardTransitionType.Cubic,
    );
  }

  if (!nextPoint || typeof nextPoint.value !== "number") return undefined;
  return resolveTransitionDelta(
    "out",
    anchor.stamp,
    nextPoint.stamp,
    anchor.value,
    nextPoint.value,
    StandardTransitionType.Cubic,
  );
}

/**
 * Locate the points immediately before and after the given stamp in a sorted
 * track. Used by inserters that need neighbor context for default-handle
 * resolution.
 */
export function findInsertionNeighbors(
  sortedPoints: SimpleKeypoint[],
  stamp: number,
): { prevPoint: SimpleKeypoint | undefined; nextPoint: SimpleKeypoint | undefined } {
  let prevPoint: SimpleKeypoint | undefined;
  let nextPoint: SimpleKeypoint | undefined;
  for (const point of sortedPoints) {
    if (point.stamp <= stamp) {
      prevPoint = point;
    } else {
      nextPoint = point;
      break;
    }
  }
  return { prevPoint, nextPoint };
}
