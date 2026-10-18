import type { RawVector2 } from "@semio/utils";
import type { ValueScale, WorldCP } from "../types";
import { clampHandleAgainstOwnKeypointX } from "./solve-handle-transition";
import { toViewVector } from "./handle-pairing";

const PAIRING_FLAT_TOLERANCE_RAD = (3 * Math.PI) / 180;
const computeVerticalRange = (valueScale?: ValueScale): number => {
  if (!valueScale) return 1;
  const range = valueScale.domain[1] - valueScale.domain[0];
  return Number.isFinite(range) && range !== 0 ? range : 1;
};

const applyPrecision = (value: number, precision?: number): number => {
  if (precision === undefined) return value;
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

export const withinFlatTolerance = (a: RawVector2, b: RawVector2): boolean => {
  const aLen = Math.hypot(a.x, a.y);
  const bLen = Math.hypot(b.x, b.y);
  if (aLen === 0 || bLen === 0) {
    return false;
  }
  const dot = (a.x * b.x + a.y * b.y) / (aLen * bLen);
  const clamped = Math.max(-1, Math.min(1, dot));
  const angle = Math.acos(clamped);
  return Math.abs(Math.PI - angle) <= PAIRING_FLAT_TOLERANCE_RAD;
};

/** Map timeline pointer time to clip-local handle deltas; values keep their own units. */
export function handlePointerDelta(input: {
  side: "in" | "out";
  pointerXWorld?: number;
  normalizedValueDelta?: number;
  controlPoint: WorldCP;
  anchorStamp: number;
  anchorValue: number;
  startStamp: number;
  endStamp: number;
  xInverse?: (stamp: number) => number;
  valueScale?: ValueScale;
}): RawVector2 {
  const pointerX =
    input.pointerXWorld === undefined
      ? input.controlPoint.x
      : (input.xInverse?.(input.pointerXWorld) ?? input.pointerXWorld);
  const clamped = clampHandleAgainstOwnKeypointX({
    anchor: input.side === "out" ? "startOut" : "endIn",
    cpWorld: {
      x: pointerX,
      y:
        input.controlPoint.y +
        (input.normalizedValueDelta ?? 0) * computeVerticalRange(input.valueScale),
    },
    startX: input.startStamp,
    endX: input.endStamp,
  });
  return {
    x: clamped.x - input.anchorStamp,
    y: applyPrecision(clamped.y, input.valueScale?.precision) - input.anchorValue,
  };
}

/** Pairing is a three-degree screen angle, with local time mapped through the row's scale. */
export function handlesWithinSnapTolerance(
  a: RawVector2,
  b: RawVector2,
  scaleX: number,
  scaleY: number,
): boolean {
  return withinFlatTolerance(toViewVector(a, scaleX, scaleY), toViewVector(b, scaleX, scaleY));
}
