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
import { DEFAULT_TRANSITION_IN, DEFAULT_TRANSITION_OUT } from "../constants";
import { cloneTransitionValue } from "../utils/clone-transitions";

interface ApplyDragContext {
  dragState?: DragState;
  selection: SelectionState;
  trackId: string;
  /** Data-derived bounds used for range scaling (normalizedValueDelta → value). */
  bounds?: { min: number; max: number };
  /** Explicit animatable constraint bounds used for clamping only. */
  constraintBounds?: { min: number; max: number };
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

const applyPrecision = (value: number, valueScale?: ValueScale): number => {
  if (!valueScale?.precision && valueScale?.precision !== 0) {
    return value;
  }
  const factor = 10 ** valueScale.precision;
  return Math.round(value * factor) / factor;
};

/**
 * Clamp a dragged value to explicit animatable constraint bounds only.
 * Data-derived or visual-domain bounds must NOT be used for clamping —
 * they reflect the current value range and would prevent the user from
 * dragging beyond it. The valueScale.domain fallback has been removed;
 * constraint enforcement is now handled exclusively via constraintBounds.
 */
const clampValue = (
  value: number,
  constraintBounds: { min: number; max: number } | undefined,
): number => {
  if (constraintBounds) {
    return Math.min(constraintBounds.max, Math.max(constraintBounds.min, value));
  }
  return value;
};

export function applyDragDeltas(
  keypoint: Keypoint<RawValue>,
  { dragState, selection, trackId, bounds, constraintBounds }: ApplyDragContext,
): Keypoint<RawValue> {
  if (!dragState || dragState.instanceId !== selection.instanceId) {
    return keypoint;
  }

  const trackSelection = selection.keypoints.get(trackId);
  const isAnchor =
    dragState.anchor?.trackId === trackId && dragState.anchor?.keypointId === keypoint.id;
  const handleOffsets = dragState.markerHandleOffsets?.[keypoint.id];
  const isSelected = isAnchor || Boolean(trackSelection?.has(keypoint.id));

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
    if (typeof nextValue === "number") {
      const isAnchorTrack = dragState.anchor?.trackId === trackId;
      const anchorScale = isAnchorTrack ? dragState.anchor.valueScale : undefined;
      const domainRange =
        anchorScale?.domain !== undefined
          ? anchorScale.domain[1] - anchorScale.domain[0]
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
      let candidate = nextValue + dragState.normalizedValueDelta * appliedRange;
      candidate = clampValue(candidate, constraintBounds);
      candidate = applyPrecision(candidate, anchorScale);
      nextValue = candidate;
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
    promoteMissing: isSelected,
  });

  return nextPoint;
}

function applyMarkerHandleOffsets(
  point: Keypoint<RawValue>,
  params: {
    handleOffsets?: DragMarkerHandleOffsets;
    promoteMissing?: boolean;
  },
): Keypoint<RawValue> {
  const { handleOffsets, promoteMissing } = params;
  if (!handleOffsets) {
    return point;
  }

  const nextTransitions: Keypoint<RawValue>["transitions"] = {
    ...(point.transitions ?? {}),
  };
  // Only rewrite explicit handle deltas; easing/missing transitions resolve to enums.
  let changed = false;

  if (handleOffsets.out) {
    const currentOut = point.transitions?.out;
    if (currentOut && typeof currentOut === "object") {
      nextTransitions.out = {
        x: handleOffsets.out.delta.x,
        y: handleOffsets.out.delta.y,
      };
      changed = true;
    } else if (!currentOut && promoteMissing) {
      nextTransitions.out = DEFAULT_TRANSITION_OUT;
      changed = true;
    }
  }

  if (handleOffsets.in) {
    const currentIn = point.transitions?.in;
    if (currentIn && typeof currentIn === "object") {
      nextTransitions.in = {
        x: handleOffsets.in.delta.x,
        y: handleOffsets.in.delta.y,
      };
      changed = true;
    } else if (!currentIn && promoteMissing) {
      nextTransitions.in = DEFAULT_TRANSITION_IN;
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

interface BuildTrackDiffsParams {
  trackId: string;
  trackPoints: Keypoint<RawValue>[];
  snapshotPoints?: Keypoint<RawValue>[];
  dragState?: DragState;
  selection: SelectionState;
  bounds?: { min: number; max: number };
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
