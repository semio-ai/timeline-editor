import type { RawVector2 } from "@semio/utils";

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
