import type { InstancedFrameInfo } from "../types";

export function coerceNumericValue(value: unknown): number | undefined {
  if (typeof value === "number") return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  return undefined;
}

export function extractFrameNumericValue(frame: InstancedFrameInfo): number | undefined {
  const first = frame.points?.[0];
  if (!first) return undefined;
  return coerceNumericValue(first.value);
}
