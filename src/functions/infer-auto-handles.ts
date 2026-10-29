import type { RawVector2 } from "@semio/data";

const AUTO_MAGIC_SCALE = 2.5614;
const ASYMMETRY_CLAMP_FACTOR = 5;

interface NumericPoint {
  stamp: number;
  value: number;
}

export function inferAutoHandleDeltas(params: {
  prev?: NumericPoint;
  anchor: NumericPoint;
  next?: NumericPoint;
  magicScale?: number;
  asymmetryClampFactor?: number;
}): { in: RawVector2; out: RawVector2 } | undefined {
  const {
    prev,
    anchor,
    next,
    magicScale = AUTO_MAGIC_SCALE,
    asymmetryClampFactor = ASYMMETRY_CLAMP_FACTOR,
  } = params;
  if (!prev || !next) {
    return undefined;
  }

  const prevDelta = {
    x: anchor.stamp - prev.stamp,
    y: anchor.value - prev.value,
  };
  const nextDelta = {
    x: next.stamp - anchor.stamp,
    y: next.value - anchor.value,
  };

  const prevNorm = normalizeWithFallback(prevDelta);
  const nextNorm = normalizeWithFallback(nextDelta);

  const direction = {
    x: prevNorm.unit.x + nextNorm.unit.x,
    y: prevNorm.unit.y + nextNorm.unit.y,
  };
  const directionLength = Math.hypot(direction.x, direction.y);
  const scaleBase = directionLength * magicScale;
  if (!Number.isFinite(scaleBase) || scaleBase <= 0) {
    return undefined;
  }

  const prevLengthClamped = Math.min(prevNorm.length, asymmetryClampFactor * nextNorm.length);
  const nextLengthClamped = Math.min(nextNorm.length, asymmetryClampFactor * prevNorm.length);

  const inScale = prevLengthClamped / scaleBase;
  const outScale = nextLengthClamped / scaleBase;

  return {
    in: {
      x: -direction.x * inScale,
      y: -direction.y * inScale,
    },
    out: {
      x: direction.x * outScale,
      y: direction.y * outScale,
    },
  };
}

const FLATTEN_EPSILON = 1e-6;

function isNearlyZero(value: number): boolean {
  return Math.abs(value) < FLATTEN_EPSILON;
}

/**
 * True when the anchor sits at a local extremum relative to its neighbors —
 * i.e. it is ≥ both or ≤ both (equality counts). This is the condition under
 * which an auto-clamped tangent flattens to avoid overshoot.
 */
function isAtExtremum(prev: NumericPoint, anchor: NumericPoint, next: NumericPoint): boolean {
  const inDelta = anchor.value - prev.value; // rise into the anchor
  const outDelta = next.value - anchor.value; // rise out of the anchor
  if (isNearlyZero(inDelta) || isNearlyZero(outDelta)) return true;
  return Math.sign(inDelta) !== Math.sign(outDelta);
}

/**
 * The "Auto Clamped" tangent: the smooth {@link inferAutoHandleDeltas} direction,
 * flattened to horizontal when the anchor is a local extremum (or equal to a
 * neighbor) so the curve doesn't overshoot. The flatten zeroes the tangent's y
 * while preserving x, so the handle keeps its temporal influence and both sides
 * stay co-linear with the anchor. Because direction is fully settled here,
 * downstream magnitude clamps never need to bend it.
 *
 * This is distinct from {@link inferAutoHandleDeltas} (the un-clamped "Automatic"
 * direction, reused for explicit-handle seeding), which must NOT be flattened.
 */
export function inferAutoClampedHandleDeltas(params: {
  prev?: NumericPoint;
  anchor: NumericPoint;
  next?: NumericPoint;
  magicScale?: number;
  asymmetryClampFactor?: number;
}): { in: RawVector2; out: RawVector2 } | undefined {
  const deltas = inferAutoHandleDeltas(params);
  if (!deltas) return undefined;
  const { prev, anchor, next } = params;
  if (prev && next && isAtExtremum(prev, anchor, next)) {
    return {
      in: { x: deltas.in.x, y: 0 },
      out: { x: deltas.out.x, y: 0 },
    };
  }
  return deltas;
}

function normalizeWithFallback(delta: RawVector2): { unit: RawVector2; length: number } {
  const length = Math.hypot(delta.x, delta.y);
  if (!Number.isFinite(length) || length === 0) {
    return {
      unit: { x: 0, y: 0 },
      // Blender-style fallback guards zero-length neighbors to 1.0.
      length: 1,
    };
  }
  return {
    unit: {
      x: delta.x / length,
      y: delta.y / length,
    },
    length,
  };
}
