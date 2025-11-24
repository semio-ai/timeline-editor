import type { RawValue } from "@semio/utils";
import isEqual from "lodash/isEqual";
import type {
  Keypoint,
  DragState,
  DragMarkerHandleOffsets,
  SelectionState,
  ValueScale,
  Track,
  TrackDiff,
  TrackDiffChanges,
} from "../types";
import { cloneTransitionValue } from "../utils/clone-transitions";
import { buildHandleOffsetKey } from "../utils/handle-offset-key";

interface ApplyDragContext {
  dragState?: DragState;
  selection: SelectionState;
  trackId: string;
  bounds?: { min: number; max: number };
  attributePath?: string[];
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

const cloneRawValue = (value: RawValue): RawValue => {
  try {
    return JSON.parse(JSON.stringify(value)) as RawValue;
  } catch {
    return value;
  }
};

const cloneKeypoint = (point: Keypoint<RawValue>): Keypoint<RawValue> => ({
  ...point,
  value: cloneRawValue(point.value),
  transitions: point.transitions
    ? {
        in: cloneTransitionValue(point.transitions.in),
        out: cloneTransitionValue(point.transitions.out),
      }
    : undefined,
});

const arraysEqual = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
};

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
  const handleKey = buildHandleOffsetKey(
    keypoint.id,
    attributePath ?? dragState.anchor.attributePath,
  );
  const handleOffsets = dragState.markerHandleOffsets?.[handleKey];
  const isSelected = Boolean(trackSelection?.has(keypoint.id));

  if (!isSelected && !handleOffsets) {
    return keypoint;
  }

  let nextStamp = keypoint.stamp;
  let nextValue = keypoint.value;

  if (
    isSelected &&
    (dragState.axis === "horizontal" || dragState.axis === "both") &&
    dragState.stampDelta
  ) {
    const stampDelta = dragState.stampDelta.snapped ?? dragState.stampDelta.raw;
    if (typeof stampDelta === "number" && Number.isFinite(stampDelta)) {
      nextStamp = clamp01(keypoint.stamp + stampDelta);
    }
  }

  if (
    isSelected &&
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
    handleOffsets,
  });

  return nextPoint;
}

function applyMarkerHandleOffsets(
  point: Keypoint<RawValue>,
  params: {
    handleOffsets?: DragMarkerHandleOffsets;
  },
): Keypoint<RawValue> {
  const { handleOffsets } = params;
  if (!handleOffsets) {
    return point;
  }

  const nextTransitions: Keypoint<RawValue>["transitions"] = {
    ...(point.transitions ?? {}),
  };
  const currentOut = point.transitions?.out;
  const currentIn = point.transitions?.in;
  let changed = false;

  if (handleOffsets.out && typeof currentOut === "object") {
    nextTransitions.out = {
      x: handleOffsets.out.delta.x,
      y: handleOffsets.out.delta.y,
    };
    changed = true;
  }

  if (handleOffsets.in && typeof currentIn === "object") {
    nextTransitions.in = {
      x: handleOffsets.in.delta.x,
      y: handleOffsets.in.delta.y,
    };
    changed = true;
  }

  if (!changed) {
    return point;
  }

  return {
    ...point,
    transitions: nextTransitions,
  };
}

interface BuildTrackDiffsParams {
  trackId: string;
  trackPoints: Keypoint<RawValue>[];
  snapshotPoints?: Keypoint<RawValue>[];
  dragState?: DragState;
  selection: SelectionState;
  bounds?: { min: number; max: number };
  attributePath?: string[];
}

const buildUpdateDiff = (
  trackId: string,
  original: Keypoint<RawValue>,
  preview: Keypoint<RawValue>,
): TrackDiff | undefined => {
  const changes: TrackDiffChanges = {};
  if (!Object.is(original.stamp, preview.stamp)) {
    changes.stamp = preview.stamp;
  }
  if (!isEqual(original.value, preview.value)) {
    changes.value = cloneRawValue(preview.value);
  }
  if (!isEqual(original.transitions, preview.transitions)) {
    changes.transitions = preview.transitions
      ? {
          in: cloneTransitionValue(preview.transitions.in),
          out: cloneTransitionValue(preview.transitions.out),
        }
      : undefined;
  }
  if (Object.keys(changes).length === 0) {
    return undefined;
  }
  return {
    type: "updateKeypoint",
    trackId,
    keypointId: original.id,
    changes,
  };
};

export function computeTrackDiffsForDrag(params: BuildTrackDiffsParams): TrackDiff[] {
  const { dragState, selection, trackId } = params;
  if (!dragState || dragState.instanceId !== selection.instanceId) {
    return [];
  }

  const sourcePoints = params.snapshotPoints ?? params.trackPoints;
  if (!sourcePoints || sourcePoints.length === 0) {
    return [];
  }

  const previewPoints = sourcePoints.map((point) =>
    applyDragDeltas(point, {
      dragState,
      selection,
      trackId,
      bounds: params.bounds,
      attributePath: params.attributePath,
    }),
  );

  const diffs: TrackDiff[] = [];
  previewPoints.forEach((preview, index) => {
    const original = sourcePoints[index];
    if (!original) return;
    const diff = buildUpdateDiff(trackId, original, preview);
    if (diff) {
      diffs.push(diff);
    }
  });

  const axis = dragState.axis;
  if (axis === "horizontal" || axis === "both") {
    const sortedPreviewIds = [...previewPoints]
      .sort((a, b) => a.stamp - b.stamp)
      .map((point) => point.id);
    const referenceOrder = params.trackPoints?.map((point) => point.id);
    if (referenceOrder && !arraysEqual(sortedPreviewIds, referenceOrder)) {
      diffs.push({ type: "reorderKeypoints", trackId, order: sortedPreviewIds });
    }
  }

  return diffs;
}

export function applyTrackDiffsToPoints(
  points: Keypoint<RawValue>[],
  diffs: TrackDiff[],
): Keypoint<RawValue>[] {
  if (diffs.length === 0) {
    return points;
  }

  const map = new Map(points.map((point) => [point.id, cloneKeypoint(point)]));

  diffs.forEach((diff) => {
    if (diff.type !== "updateKeypoint") {
      return;
    }
    const target = map.get(diff.keypointId);
    if (!target) {
      return;
    }
    if (diff.changes.stamp !== undefined) {
      target.stamp = diff.changes.stamp;
    }
    if (diff.changes.value !== undefined) {
      target.value = cloneRawValue(diff.changes.value);
    }
    if (diff.changes.transitions !== undefined) {
      target.transitions = diff.changes.transitions
        ? {
            in: cloneTransitionValue(diff.changes.transitions.in),
            out: cloneTransitionValue(diff.changes.transitions.out),
          }
        : undefined;
    }
  });

  let orderedPoints = Array.from(map.values());
  diffs.forEach((diff) => {
    if (diff.type === "reorderKeypoints") {
      const reorderMap = new Map(orderedPoints.map((point) => [point.id, point]));
      const reordered = diff.order
        .map((id: string) => reorderMap.get(id))
        .filter((point): point is Keypoint<RawValue> => Boolean(point));
      const remaining = orderedPoints.filter((point) => !diff.order.includes(point.id));
      orderedPoints = [...reordered, ...remaining];
    }
  });

  return orderedPoints;
}

export function applyTrackDiffsToTrack(track: Track<RawValue>, diffs: TrackDiff[]): void {
  if (diffs.length === 0) {
    return;
  }

  const map = new Map(track.points.map((point) => [point.id, point]));

  diffs.forEach((diff) => {
    if (diff.type !== "updateKeypoint") {
      return;
    }
    const target = map.get(diff.keypointId);
    if (!target) {
      return;
    }
    if (diff.changes.stamp !== undefined) {
      target.stamp = diff.changes.stamp;
    }
    if (diff.changes.value !== undefined) {
      target.value = cloneRawValue(diff.changes.value);
    }
    if (diff.changes.transitions !== undefined) {
      target.transitions = diff.changes.transitions
        ? {
            in: cloneTransitionValue(diff.changes.transitions.in),
            out: cloneTransitionValue(diff.changes.transitions.out),
          }
        : undefined;
    }
  });

  const reorderDiff = diffs.find(
    (diff): diff is Extract<TrackDiff, { type: "reorderKeypoints" }> =>
      diff.type === "reorderKeypoints",
  );
  if (reorderDiff) {
    const reorderMap = new Map(track.points.map((point) => [point.id, point]));
    const reordered = reorderDiff.order
      .map((id: string) => reorderMap.get(id))
      .filter((point): point is Keypoint<RawValue> => Boolean(point));
    const remaining = track.points.filter((point) => !reorderDiff.order.includes(point.id));
    track.points.splice(0, track.points.length, ...reordered);
    if (remaining.length > 0) {
      track.points.push(...remaining);
    }
  }
}
