import type { RawValue, RawVector2 } from "@semio/utils";
import type {
  Keypoint,
  DragState,
  DragMarkerHandleOffsets,
  SelectionState,
  ValueScale,
  WorldCP,
} from "../types";
import { DEFAULT_TRANSITION_IN, DEFAULT_TRANSITION_OUT } from "../constants";

interface ApplyDragContext {
  dragState?: DragState;
  selection: SelectionState;
  trackId: string;
  bounds?: { min: number; max: number };
  attributePath?: string[];
  trackPoints?: Keypoint<RawValue>[];
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
  { dragState, selection, trackId, bounds, attributePath, trackPoints }: ApplyDragContext,
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

  let nextPoint = keypoint;
  if (nextStamp !== keypoint.stamp || nextValue !== keypoint.value) {
    nextPoint = {
      ...keypoint,
      stamp: nextStamp,
      value: nextValue,
    };
  }

  nextPoint = applyMarkerHandleOffsets(nextPoint, {
    handleOffsets: dragState.markerHandleOffsets?.[keypoint.id],
    attributePath: attributePath ?? dragState.anchor.attributePath,
    trackPoints,
  });

  return nextPoint;
}

function applyMarkerHandleOffsets(
  point: Keypoint<RawValue>,
  params: {
    handleOffsets?: DragMarkerHandleOffsets;
    attributePath?: string[];
    trackPoints?: Keypoint<RawValue>[];
  },
): Keypoint<RawValue> {
  const { handleOffsets, attributePath, trackPoints } = params;
  if (!handleOffsets || !trackPoints) {
    return point;
  }

  const anchorValue = getNumericValue(point.value, attributePath);
  if (typeof anchorValue !== "number") {
    return point;
  }

  const nextTransitions: Keypoint<RawValue>["transitions"] = {
    ...(point.transitions ?? {}),
  };
  let changed = false;

  if (handleOffsets.out) {
    const neighbor = trackPoints.find((p) => p.id === handleOffsets.out?.neighborKeypointId);
    const neighborValue = neighbor ? getNumericValue(neighbor.value, attributePath) : undefined;
    if (neighbor && typeof neighborValue === "number") {
      const cpWorld: WorldCP = {
        x: point.stamp + handleOffsets.out.delta.x,
        y: anchorValue + handleOffsets.out.delta.y,
      };
      nextTransitions.out = solveNormalizedFromWorld({
        cpWorld,
        startStamp: point.stamp,
        endStamp: neighbor.stamp,
        startValue: anchorValue,
        endValue: neighborValue,
        fallback: handleOffsets.out.fallback ?? DEFAULT_TRANSITION_OUT,
      });
      changed = true;
    }
  }

  if (handleOffsets.in) {
    const neighbor = trackPoints.find((p) => p.id === handleOffsets.in?.neighborKeypointId);
    const neighborValue = neighbor ? getNumericValue(neighbor.value, attributePath) : undefined;
    if (neighbor && typeof neighborValue === "number") {
      const cpWorld: WorldCP = {
        x: point.stamp + handleOffsets.in.delta.x,
        y: anchorValue + handleOffsets.in.delta.y,
      };
      nextTransitions.in = solveNormalizedFromWorld({
        cpWorld,
        startStamp: neighbor.stamp,
        endStamp: point.stamp,
        startValue: neighborValue,
        endValue: anchorValue,
        fallback: handleOffsets.in.fallback ?? DEFAULT_TRANSITION_IN,
      });
      changed = true;
    }
  }

  if (!changed) {
    return point;
  }

  return {
    ...point,
    transitions: nextTransitions,
  };
}

function solveNormalizedFromWorld(params: {
  cpWorld: WorldCP;
  startStamp: number;
  endStamp: number;
  startValue: number;
  endValue: number;
  fallback: RawVector2;
}): RawVector2 {
  const span = params.endStamp - params.startStamp;
  const delta = params.endValue - params.startValue;
  const normalizedX =
    span === 0 ? params.fallback.x : (params.cpWorld.x - params.startStamp) / span;
  const normalizedY =
    delta === 0 ? params.fallback.y : (params.cpWorld.y - params.startValue) / delta;
  return { x: normalizedX, y: normalizedY };
}
