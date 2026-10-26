/**
 * De Casteljau key insertion helper.
 *
 * Inserts a keypoint at the given time inside a track segment by splitting the cubic Bézier curve
 * defined by the segment [A, B]. The split computes the new point K and two new sub-curves
 * [A, K] and [K, B]. It then normalizes the resulting absolute control points back into the
 * track’s transition parameterization:
 *
 * - A.transitions.out and B.transitions.in remain defined around A and B respectively
 * - K.transitions.in is defined for the incoming segment [A, K]
 * - K.transitions.out is defined for the outgoing segment [K, B]
 *
 * Numeric segments use the editor's effective control points, including inferred
 * tangents and monotonic clamps. Stored handles are local ms/value deltas.
 *
 * Supported RawValue types: number, vector2, vector3, euler, rgb, hsl.
 * Step-like types (string/boolean) are handled conservatively.
 *
 * This helper mutates the provided track in-place and returns the inserted keypoint and index.
 */

import {
  instanceOfRawEuler,
  instanceOfRawHSL,
  instanceOfRawRGB,
  instanceOfRawVector2,
  instanceOfRawVector3,
  RawEuler,
  RawHSL,
  RawRGB,
  RawValue,
  RawVector2,
  RawVector3,
} from "@semio/utils";
import {
  type Keypoint,
  type Track,
  type AnimationInstance,
  StandardTransitionType,
} from "../types";
import { computeLocalStamp } from "./compute-instance-time";
import { resolveSegmentControlPoints } from "./resolve-segment-control-points";
import { resolveTransitionDelta } from "./get-world-control-points";
import { rawValueAdd, rawValueDiff } from "./raw-value-math";

type KP = Keypoint<RawValue>;

const DEFAULT_OUT: StandardTransitionType = StandardTransitionType.Cubic;
const DEFAULT_IN: StandardTransitionType = StandardTransitionType.Cubic;

/**
 * Insert a keypoint by splitting the segment that contains the given local (instance) stamp.
 * Returns undefined when the stamp is outside all segments or track has < 1 point.
 */
export function insertKeypointWithDeCasteljauLocal(
  track: Track<RawValue>,
  localStamp: number,
  evaluatedValue?: RawValue,
): { inserted: KP; index: number } | undefined {
  if (!track?.points || track.points.length === 0) {
    return undefined;
  }

  // Ensure points are sorted (non-destructive assumption in codebase, but safe here)
  track.points = track.points.slice().sort((a, b) => a.stamp - b.stamp);

  // If the stamp matches an existing point exactly, bail (no split)
  const existingIdx = track.points.findIndex((p) => Object.is(p.stamp, localStamp));
  if (existingIdx !== -1) {
    return undefined;
  }

  // Find segment [i, i+1] s.t. A.stamp < localStamp < B.stamp
  let i = -1;
  for (let j = 0; j < track.points.length - 1; j += 1) {
    const A = track.points[j];
    const B = track.points[j + 1];
    if (A.stamp < localStamp && localStamp < B.stamp) {
      i = j;
      break;
    }
  }
  if (i === -1) {
    return undefined;
  }

  const A = track.points[i];
  const B = track.points[i + 1];

  // Guard for degenerate segments
  const startTime = A.stamp;
  const endTime = B.stamp;
  const timeRange = endTime - startTime;
  if (!Number.isFinite(timeRange) || timeRange <= 0) {
    return undefined;
  }

  // Will solve for parameter u after control times are computed below

  // Build cubic control points in (time, value) space from the segment's transitions
  const aOut = A.transitions?.out ?? DEFAULT_OUT;
  const bIn = B.transitions?.in ?? DEFAULT_IN;

  let aOutDelta = resolveTransitionDelta("out", A.stamp, B.stamp, A.value, B.value, aOut);
  let bInDelta = resolveTransitionDelta("in", A.stamp, B.stamp, A.value, B.value, bIn);

  if (typeof A.value === "number" && typeof B.value === "number") {
    const numeric = (index: number) => {
      const point = track.points[index];
      return point && typeof point.value === "number"
        ? { stamp: point.stamp, value: point.value }
        : undefined;
    };
    const resolved = resolveSegmentControlPoints({
      start: { stamp: A.stamp, value: A.value },
      end: { stamp: B.stamp, value: B.value },
      transitions: { startOut: aOut, endIn: bIn },
      neighbors: { startPrev: numeric(i - 1), endNext: numeric(i + 2) },
    });
    const cp1 = resolved.cp1Effective ?? resolved.cp1Raw;
    const cp2 = resolved.cp2Effective ?? resolved.cp2Raw;
    if (!cp1 || !cp2) return undefined;
    aOutDelta = { x: cp1.x - A.stamp, y: cp1.y - A.value };
    bInDelta = { x: cp2.x - B.stamp, y: cp2.y - B.value };
  }

  // Absolute control times
  const p0t = startTime;
  const p1t = startTime + aOutDelta.x;
  const p2t = endTime + bInDelta.x;
  const p3t = endTime;
  // Relative parameter for split — solve the cubic for time
  const u = solveForParameterTime(p0t, p1t, p2t, p3t, localStamp);

  // Absolute control values
  const p0v = A.value;
  const p1v = rawValueAdd(A.value, aOutDelta.y as RawValue);
  const p2v = rawValueAdd(B.value, bInDelta.y as RawValue);
  const p3v = B.value;

  // De Casteljau for time (scalar)
  const q0t = lerp(p0t, p1t, u);
  const q1t = lerp(p1t, p2t, u);
  const q2t = lerp(p2t, p3t, u);
  const r0t = lerp(q0t, q1t, u);
  const r1t = lerp(q1t, q2t, u);
  const stExact = localStamp; // Keep K.stamp equal to the requested time

  // De Casteljau for value (per type)
  const q0v = mixValue(p0v, p1v, u);
  const q1v = mixValue(p1v, p2v, u);
  const q2v = mixValue(p2v, p3v, u);
  const r0v = mixValue(q0v, q1v, u);
  const r1v = mixValue(q1v, q2v, u);
  const sv = evaluatedValue ?? mixValue(r0v, r1v, u);

  // Normalize control times and values back into transitions for left [A, K] and right [K, B]
  // Left segment [A, K] deltas
  const aOutDeltaNext = {
    x: q0t - p0t,
    y: toDelta(p0v, q0v),
  };
  const kInDelta = {
    x: r0t - stExact,
    y: toDelta(sv, r0v),
  };

  // Right segment [K, B] deltas
  const kOutDelta = {
    x: r1t - stExact,
    y: toDelta(sv, r1v),
  };
  const bInDeltaNext = {
    x: q2t - p3t,
    y: toDelta(p3v, q2v),
  };

  // Construct K
  const K: KP = {
    id: crypto.randomUUID(),
    stamp: ensureFinite(stExact),
    value: sv,
    transitions: {
      in: kInDelta,
      out: kOutDelta,
    },
  };

  // Update the neighbouring endpoints with local deltas from the split
  const nextA: KP = {
    ...A,
    transitions: {
      ...(A.transitions ?? {}),
      out: aOutDeltaNext,
    },
  };
  const nextB: KP = {
    ...B,
    transitions: {
      ...(B.transitions ?? {}),
      in: bInDeltaNext,
    },
  };

  // Write back
  track.points[i] = nextA;
  track.points.splice(i + 1, 0, K);
  track.points[i + 2] = nextB;

  // Ensure ordering remains sorted (guard against floating error)
  track.points = track.points.slice().sort((x, y) => x.stamp - y.stamp);

  // Return inserted point and its index after sort
  const idx = track.points.findIndex((p) => p.id === K.id);
  return { inserted: track.points[idx], index: idx };
}

/**
 * World-stamp wrapper. Converts world stamp to local instance time and delegates to the local variant.
 */
export function insertKeypointWithDeCasteljau(
  track: Track<RawValue>,
  worldStamp: number,
  instance: Pick<AnimationInstance, "settings">,
  evaluatedValue?: RawValue,
): { inserted: KP; index: number } | undefined {
  const localStamp = computeLocalStamp(
    worldStamp,
    instance.settings?.timescale ?? 1,
    instance.settings?.offset ?? 0,
  );
  return insertKeypointWithDeCasteljauLocal(track, localStamp, evaluatedValue);
}

/* ============================== helpers ============================== */

/** Guard against non-finite stamp values without clamping to any range. */
function ensureFinite(v: number): number {
  return Number.isFinite(v) ? v : 0;
}

function toDelta(anchor: RawValue, target: RawValue): number {
  const delta = rawValueDiff(anchor, target, true);
  return typeof delta === "number" ? delta : 0;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Evaluate cubic Bezier for scalar values.
 */
function evaluateBezierScalar(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const mt = 1 - t;
  return p0 * mt * mt * mt + 3 * p1 * mt * mt * t + 3 * p2 * mt * t * t + p3 * t * t * t;
}

/**
 * Solve for the parameter t such that the cubic Bezier in time equals the target.
 * Solves time with 64 bisection steps in local milliseconds.
 */
function solveForParameterTime(
  p0t: number,
  p1t: number,
  p2t: number,
  p3t: number,
  targetTime: number,
): number {
  if (p3t === p0t) return 0;

  let low = 0;
  let high = 1;
  for (let i = 0; i < 64; i += 1) {
    const mid = (low + high) / 2;
    const estimate = evaluateBezierScalar(p0t, p1t, p2t, p3t, mid);
    if (estimate < targetTime) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/**
 * Type-aware value interpolation used for both control value construction and de Casteljau steps.
 */
function mixValue(a: RawValue, b: RawValue, t: number): RawValue {
  if (typeof a === "number" && typeof b === "number") {
    return a + (b - a) * t;
  }
  if (instanceOfRawVector3(a) && instanceOfRawVector3(b)) {
    const av = a as RawVector3;
    const bv = b as RawVector3;
    return {
      x: av.x + (bv.x - av.x) * t,
      y: av.y + (bv.y - av.y) * t,
      z: av.z + (bv.z - av.z) * t,
    };
  }
  if (instanceOfRawEuler(a) && instanceOfRawEuler(b)) {
    const av = a as RawEuler;
    const bv = b as RawEuler;
    return {
      r: av.r + (bv.r - av.r) * t,
      p: av.p + (bv.p - av.p) * t,
      y: av.y + (bv.y - av.y) * t,
    };
  }
  if (instanceOfRawVector2(a) && instanceOfRawVector2(b)) {
    const av = a as RawVector2;
    const bv = b as RawVector2;
    return {
      x: av.x + (bv.x - av.x) * t,
      y: av.y + (bv.y - av.y) * t,
    };
  }
  if (instanceOfRawRGB(a) && instanceOfRawRGB(b)) {
    const av = a as RawRGB;
    const bv = b as RawRGB;
    return {
      r: av.r + (bv.r - av.r) * t,
      g: av.g + (bv.g - av.g) * t,
      b: av.b + (bv.b - av.b) * t,
    };
  }
  if (instanceOfRawHSL(a) && instanceOfRawHSL(b)) {
    const av = a as RawHSL;
    const bv = b as RawHSL;
    return {
      h: av.h + (bv.h - av.h) * t,
      s: av.s + (bv.s - av.s) * t,
      l: av.l + (bv.l - av.l) * t,
    };
  }

  // Step-like fallback
  if (typeof a === "string" && typeof b === "string") {
    return t < 1 ? a : b;
  }
  if (typeof a === "boolean" && typeof b === "boolean") {
    return t < 1 ? a : b;
  }

  // Unknown type fallback: nearest endpoint
  return t <= 0 ? a : b;
}
