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
 * Transition semantics must match compute-track-interpolator:
 *   - x: control time position as fraction of [start, end] on the time axis
 *   - y: control value position as weight between start.value and end.value (per type)
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
import type { Keypoint, Track, AnimationInstance } from "../types";
import { computeLocalStamp } from "./compute-instance-time";

type KP = Keypoint<RawValue>;

const DEFAULT_OUT = { x: 0.65, y: 0 }; // ease-in-out (out)
const DEFAULT_IN = { x: 0.35, y: 1 }; // ease-in-out (in)

/**
 * Insert a keypoint by splitting the segment that contains the given local (instance) stamp.
 * Returns undefined when the stamp is outside all segments or track has < 1 point.
 */
export function insertKeypointWithDeCasteljauLocal(
  track: Track<RawValue>,
  localStamp: number,
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

  // Build cubic control points in (time, value) space following compute-track-interpolator semantics
  const aOut = A.transitions?.out ?? DEFAULT_OUT;
  const bIn = B.transitions?.in ?? DEFAULT_IN;

  // Absolute control times
  const p0t = startTime;
  const p1t = startTime + timeRange * clamp01(aOut.x);
  const p2t = startTime + timeRange * clamp01(bIn.x);
  const p3t = endTime;
  // Relative parameter for split — solve cubic for time to match compute-track-interpolator semantics
  const u = solveForParameterTime(p0t, p1t, p2t, p3t, localStamp);

  // Absolute control values (same blend semantics used by compute-track-interpolator)
  const p0v = A.value;
  const p1v = mixValue(A.value, B.value, clamp01(aOut.y));
  const p2v = mixValue(A.value, B.value, clamp01(bIn.y));
  const p3v = B.value;

  // De Casteljau for time (scalar)
  const q0t = lerp(p0t, p1t, u);
  const q1t = lerp(p1t, p2t, u);
  const q2t = lerp(p2t, p3t, u);
  const r0t = lerp(q0t, q1t, u);
  const r1t = lerp(q1t, q2t, u);
  const st = lerp(r0t, r1t, u); // Bezier-evaluated time at split
  const stExact = localStamp; // Keep K.stamp equal to the requested time

  // De Casteljau for value (per type)
  const q0v = mixValue(p0v, p1v, u);
  const q1v = mixValue(p1v, p2v, u);
  const q2v = mixValue(p2v, p3v, u);
  const r0v = mixValue(q0v, q1v, u);
  const r1v = mixValue(q1v, q2v, u);
  const sv = mixValue(r0v, r1v, u);

  // Normalize control times and values back into transitions for left [A, K] and right [K, B]
  const leftRange = Math.max(1e-12, st - p0t);
  const rightRange = Math.max(1e-12, p3t - st);

  // Left segment [A, K]
  const aOutX = clamp01((q0t - p0t) / leftRange);
  const kInX = clamp01((r0t - p0t) / leftRange);
  const aOutY = clamp01(inferWeightFromValue(p0v, sv, q0v));
  const kInY = clamp01(inferWeightFromValue(p0v, sv, r0v));

  // Right segment [K, B]
  const kOutX = clamp01((r1t - st) / rightRange);
  const bInX = clamp01((q2t - st) / rightRange);
  const kOutY = clamp01(inferWeightFromValue(sv, p3v, r1v));
  const bInY = clamp01(inferWeightFromValue(sv, p3v, q2v));

  // Construct K
  const K: KP = {
    id: crypto.randomUUID(),
    stamp: clamp01(stExact),
    value: sv,
    transitions: {
      in: { x: kInX, y: kInY },
      out: { x: kOutX, y: kOutY },
    },
  };

  // Update A.out and B.in with normalized parameters from split
  const nextA: KP = {
    ...A,
    transitions: {
      ...(A.transitions ?? {}),
      out: { x: aOutX, y: aOutY },
    },
  };
  const nextB: KP = {
    ...B,
    transitions: {
      ...(B.transitions ?? {}),
      in: { x: bInX, y: bInY },
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
): { inserted: KP; index: number } | undefined {
  const localStamp = computeLocalStamp(
    worldStamp,
    instance.settings?.timescale ?? 1,
    instance.settings?.offset ?? 0,
  );
  return insertKeypointWithDeCasteljauLocal(track, localStamp);
}

/* ============================== helpers ============================== */

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
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
 * Derivative of a cubic Bezier for scalar values.
 */
function evaluateBezierDerivativeScalar(
  p0: number,
  p1: number,
  p2: number,
  p3: number,
  t: number,
): number {
  const mt = 1 - t;
  // B'(t) = 3*(1 - t)^2*(p1 - p0) + 6*(1 - t)*t*(p2 - p1) + 3*t^2*(p3 - p2)
  return 3 * mt * mt * (p1 - p0) + 6 * mt * t * (p2 - p1) + 3 * t * t * (p3 - p2);
}

/**
 * Solve for the parameter t such that the cubic Bezier in time equals the target.
 * Uses bounded binary search followed by a Newton–Raphson refinement for higher precision.
 */
function solveForParameterTime(
  p0t: number,
  p1t: number,
  p2t: number,
  p3t: number,
  targetTime: number,
): number {
  if (p3t === p0t) return 0;

  // 1) Binary search to bracket a good initial t
  let low = 0;
  let high = 1;
  let mid = 0;
  const EPS = 1e-8;
  const MAX_BIN_ITERS = 32;
  for (let i = 0; i < MAX_BIN_ITERS; i += 1) {
    mid = (low + high) / 2;
    const estimate = evaluateBezierScalar(p0t, p1t, p2t, p3t, mid);
    const diff = estimate - targetTime;
    if (Math.abs(diff) < EPS) {
      return clamp01(mid);
    }
    if (estimate < targetTime) {
      low = mid;
    } else {
      high = mid;
    }
  }
  let t = clamp01((low + high) / 2);

  // 2) Newton–Raphson refinement
  const MAX_NR_ITERS = 8;
  for (let k = 0; k < MAX_NR_ITERS; k += 1) {
    const f = evaluateBezierScalar(p0t, p1t, p2t, p3t, t) - targetTime;
    const fp = evaluateBezierDerivativeScalar(p0t, p1t, p2t, p3t, t);
    if (!Number.isFinite(fp) || Math.abs(fp) < 1e-12) {
      break; // derivative too small; avoid instability
    }
    const tNext = clamp01(t - f / fp);
    if (Math.abs(tNext - t) < EPS) {
      t = tNext;
      break;
    }
    t = tNext;
  }

  return clamp01(t);
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

/**
 * Infer the normalized y-weight for a control value given the segment endpoints.
 * For scalar types: y = (cp - start) / (end - start)
 * For composite types: compute per-component and choose the dominant axis (largest |end-start|).
 * Falls back to 0.5 when segment has zero extent.
 */
function inferWeightFromValue(start: RawValue, end: RawValue, control: RawValue): number {
  // numeric
  if (typeof start === "number" && typeof end === "number" && typeof control === "number") {
    const denom = end - start;
    if (!Number.isFinite(denom) || Math.abs(denom) < 1e-12) return 0.5;
    return (control - start) / denom;
  }

  // vector3
  if (instanceOfRawVector3(start) && instanceOfRawVector3(end) && instanceOfRawVector3(control)) {
    const s = start as RawVector3;
    const e = end as RawVector3;
    const c = control as RawVector3;
    const dx = e.x - s.x;
    const dy = e.y - s.y;
    const dz = e.z - s.z;
    const adx = Math.abs(dx);
    const ady = Math.abs(dy);
    const adz = Math.abs(dz);
    let axis: "x" | "y" | "z";
    if (adx >= ady && adx >= adz) {
      axis = "x";
    } else if (ady >= adx && ady >= adz) {
      axis = "y";
    } else {
      axis = "z";
    }
    const denom = e[axis] - s[axis];
    if (!Number.isFinite(denom) || Math.abs(denom) < 1e-12) return 0.5;
    return (c[axis] - s[axis]) / denom;
  }

  // euler
  if (instanceOfRawEuler(start) && instanceOfRawEuler(end) && instanceOfRawEuler(control)) {
    const s = start as RawEuler;
    const e = end as RawEuler;
    const c = control as RawEuler;
    const dr = Math.abs(e.r - s.r);
    const dp = Math.abs(e.p - s.p);
    const dy = Math.abs(e.y - s.y);
    let axis: "r" | "p" | "y";
    if (dr >= dp && dr >= dy) {
      axis = "r";
    } else if (dp >= dr && dp >= dy) {
      axis = "p";
    } else {
      axis = "y";
    }
    const denom = e[axis] - s[axis];
    if (!Number.isFinite(denom) || Math.abs(denom) < 1e-12) return 0.5;
    return (c[axis] - s[axis]) / denom;
  }

  // vector2
  if (instanceOfRawVector2(start) && instanceOfRawVector2(end) && instanceOfRawVector2(control)) {
    const s = start as RawVector2;
    const e = end as RawVector2;
    const c = control as RawVector2;
    const dx = Math.abs(e.x - s.x);
    const dy = Math.abs(e.y - s.y);
    const axis = dx >= dy ? ("x" as const) : ("y" as const);
    const denom = e[axis] - s[axis];
    if (!Number.isFinite(denom) || Math.abs(denom) < 1e-12) return 0.5;
    return (c[axis] - s[axis]) / denom;
  }

  // rgb
  if (instanceOfRawRGB(start) && instanceOfRawRGB(end) && instanceOfRawRGB(control)) {
    const s = start as RawRGB;
    const e = end as RawRGB;
    const c = control as RawRGB;
    const dr = Math.abs(e.r - s.r);
    const dg = Math.abs(e.g - s.g);
    const db = Math.abs(e.b - s.b);
    let axis: "r" | "g" | "b";
    if (dr >= dg && dr >= db) {
      axis = "r";
    } else if (dg >= dr && dg >= db) {
      axis = "g";
    } else {
      axis = "b";
    }
    const denom = e[axis] - s[axis];
    if (!Number.isFinite(denom) || Math.abs(denom) < 1e-12) return 0.5;
    return (c[axis] - s[axis]) / denom;
  }

  // hsl
  if (instanceOfRawHSL(start) && instanceOfRawHSL(end) && instanceOfRawHSL(control)) {
    const s = start as RawHSL;
    const e = end as RawHSL;
    const c = control as RawHSL;
    const dh = Math.abs(e.h - s.h);
    const ds = Math.abs(e.s - s.s);
    const dl = Math.abs(e.l - s.l);
    let axis: "h" | "s" | "l";
    if (dh >= ds && dh >= dl) {
      axis = "h";
    } else if (ds >= dh && ds >= dl) {
      axis = "s";
    } else {
      axis = "l";
    }
    const denom = e[axis] - s[axis];
    if (!Number.isFinite(denom) || Math.abs(denom) < 1e-12) return 0.5;
    return (c[axis] - s[axis]) / denom;
  }

  // step-like or unknown: neutral midpoint
  return 0.5;
}
