import type { RawValue } from "@semio/utils";
import type { Keypoint, DragState, SelectionState, ValueScale } from "../types";

interface ApplyDragContext {
  dragState?: DragState;
  selection: SelectionState;
  trackId: string;
  bounds?: { min: number; max: number };
  attributePath?: string[];
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const getNumericValue = (value: RawValue, path?: string[]): number | undefined => {
  if (!path || path.length === 0) {
    return typeof value === "number" ? value : undefined;
  }

  let current: unknown = value;
  for (const key of path) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return typeof current === "number" ? current : undefined;
};

const setNumericValue = (value: RawValue, nextValue: number, path?: string[]): RawValue => {
  if (!path || path.length === 0) {
    return nextValue as RawValue;
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    const index = Number(path[0]);
    if (Number.isNaN(index) || index < 0 || index >= value.length) {
      return value;
    }

    const cloned = value.slice();
    cloned[index] = setNumericValue(cloned[index] as RawValue, nextValue, path.slice(1));
    return cloned as unknown as RawValue;
  }

  const clone = { ...(value as unknown as Record<string, unknown>) };
  const [head, ...tail] = path;

  if (tail.length === 0) {
    clone[head] = nextValue;
  } else {
    const nextContainer = clone[head] ?? (Number.isNaN(Number(tail[0])) ? {} : ([] as unknown[]));
    clone[head] = setNumericValue(nextContainer as RawValue, nextValue, tail);
  }

  return clone as unknown as RawValue;
};

const applyPrecision = (value: number, valueScale?: ValueScale): number => {
  if (!valueScale?.precision && valueScale?.precision !== 0) {
    return value;
  }
  const factor = 10 ** valueScale.precision;
  return Math.round(value * factor) / factor;
};

const clampValue = (
  value: number,
  bounds: { min: number; max: number } | undefined,
  valueScale?: ValueScale,
): number => {
  if (!valueScale?.clamp) {
    return value;
  }

  if (bounds) {
    return Math.min(bounds.max, Math.max(bounds.min, value));
  }

  if (valueScale?.domain) {
    return Math.min(valueScale.domain[1], Math.max(valueScale.domain[0], value));
  }

  return value;
};

export function applyDragDeltas(
  keypoint: Keypoint<RawValue>,
  { dragState, selection, trackId, bounds, attributePath }: ApplyDragContext,
): Keypoint<RawValue> {
  if (!dragState || dragState.instanceId !== selection.instanceId) {
    return keypoint;
  }

  const trackSelection = selection.keypoints.get(trackId);
  if (!trackSelection?.has(keypoint.id)) {
    return keypoint;
  }

  let nextStamp = keypoint.stamp;
  let nextValue = keypoint.value;

  if ((dragState.axis === "horizontal" || dragState.axis === "both") && dragState.stampDelta) {
    const stampDelta = dragState.stampDelta.snapped ?? dragState.stampDelta.raw;
    if (typeof stampDelta === "number" && Number.isFinite(stampDelta)) {
      nextStamp = clamp01(keypoint.stamp + stampDelta);
    }
  }

  if (
    (dragState.axis === "vertical" || dragState.axis === "both") &&
    typeof dragState.normalizedValueDelta === "number"
  ) {
    const path = attributePath ?? dragState.anchor.attributePath;
    const current = getNumericValue(nextValue, path);
    if (typeof current === "number") {
      const domainRange =
        dragState.anchor.valueScale?.domain !== undefined
          ? dragState.anchor.valueScale.domain[1] - dragState.anchor.valueScale.domain[0]
          : undefined;
      let verticalRange: number | undefined;
      if (typeof domainRange === "number") {
        verticalRange = domainRange;
      } else if (bounds) {
        verticalRange = bounds.max - bounds.min;
      }
      const appliedRange =
        typeof verticalRange === "number" && Number.isFinite(verticalRange) && verticalRange !== 0
          ? verticalRange
          : 1;
      let candidate = current + dragState.normalizedValueDelta * appliedRange;
      candidate = clampValue(candidate, bounds, dragState.anchor.valueScale);
      candidate = applyPrecision(candidate, dragState.anchor.valueScale);
      nextValue = setNumericValue(nextValue, candidate, path);
    }
  }

  if (nextStamp === keypoint.stamp && nextValue === keypoint.value) {
    return keypoint;
  }

  return {
    ...keypoint,
    stamp: nextStamp,
    value: nextValue,
  };
}
