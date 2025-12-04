import type { RawValue } from "@semio/utils";
import isEqual from "lodash/isEqual";
import type { Keypoint, Track, DragState, SelectionState } from "../types";
import type { TrackDiffOp } from "../types/util/diff";
import { cloneTransitionValue } from "../utils/clone-transitions";
import { applyDragDeltas } from "./apply-drag-deltas";

const EPSILON = 1e-6;

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
        pairing: point.transitions.pairing,
      }
    : undefined,
});

const arraysEqual = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
};

export interface SelectionCleanup {
  trackId: string;
  removedIds: string[];
}

export interface ComputeDragDiffOpsParams {
  trackId: string;
  trackPoints: Keypoint<RawValue>[];
  snapshotPoints?: Keypoint<RawValue>[];
  dragState: DragState;
  selection: SelectionState;
  bounds?: { min: number; max: number };
  attributePath?: string[];
  preferAnchorId?: string;
}

export interface ComputeDragDiffOpsResult {
  diffs: TrackDiffOp[];
  /**
   * Fully applied projection (updates/reorders + deletes). Use for interpolators,
   * violations, and commit parity.
   */
  projectedPoints: Keypoint<RawValue>[];
  /**
   * Projection tailored for UI frames/markers: applies updates/reorders/deletes,
   * but preserves the anchor/dragging ids while filtering out coincident
   * non-dragging points to avoid frame churn during overwrite preview.
   */
  framePoints: Keypoint<RawValue>[];
  selectionCleanup?: SelectionCleanup;
}

export function computeDragDiffOps(params: ComputeDragDiffOpsParams): ComputeDragDiffOpsResult {
  const { dragState, selection, trackId } = params;
  const basePoints = params.snapshotPoints ?? params.trackPoints;

  if (!dragState || selection.instanceId !== dragState.instanceId) {
    return { diffs: [], projectedPoints: basePoints, framePoints: basePoints };
  }

  const updatedPoints = basePoints.map((point) =>
    applyDragDeltas(point, {
      dragState,
      selection,
      trackId,
      bounds: params.bounds,
      attributePath: params.attributePath,
    }),
  );

  const diffs: TrackDiffOp[] = [];

  updatedPoints.forEach((preview, index) => {
    const original = basePoints[index];
    if (!original) return;
    const changes: Extract<TrackDiffOp, { type: "updateKeypoint" }>["changes"] = {};

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
            pairing: preview.transitions.pairing,
          }
        : undefined;
    }

    if (Object.keys(changes).length > 0) {
      diffs.push({
        type: "updateKeypoint",
        trackId,
        keypointId: original.id,
        changes,
      });
    }
  });

  const keepId = params.preferAnchorId ?? dragState.anchor?.keypointId;
  const removedIds = new Set<string>();

  if (keepId) {
    const anchorPreview = updatedPoints.find((point) => point.id === keepId);
    if (anchorPreview) {
      updatedPoints.forEach((point) => {
        if (point.id === keepId) return;
        if (Math.abs(point.stamp - anchorPreview.stamp) < EPSILON) {
          removedIds.add(point.id);
        }
      });
    }
  }

  removedIds.forEach((id) =>
    diffs.push({
      type: "deleteKeypoint",
      trackId,
      keypointId: id,
    }),
  );

  const sortedIds = [...updatedPoints]
    .sort((a, b) => {
      if (!Object.is(a.stamp, b.stamp)) {
        return a.stamp - b.stamp;
      }
      return a.id.localeCompare(b.id);
    })
    .map((point) => point.id)
    .filter((id) => !removedIds.has(id));
  const baselineIds = params.trackPoints
    .filter((point) => !removedIds.has(point.id))
    .map((p) => p.id);

  if (!arraysEqual(sortedIds, baselineIds)) {
    diffs.push({ type: "reorderKeypoints", trackId, order: sortedIds });
  }

  const selectionCleanup =
    removedIds.size > 0
      ? {
          trackId,
          removedIds: [...removedIds],
        }
      : undefined;

  const projectedPoints = applyTrackDiffOpsToPoints(basePoints, diffs);
  const framePoints = applyTrackDiffOpsToPoints(basePoints, diffs).filter((point) => {
    if (!keepId) return true;
    // Keep the anchor/dragging id; drop coincident others in the same track to avoid frame churn.
    if (point.id === keepId) return true;
    const anchor = projectedPoints.find((p) => p.id === keepId);
    if (!anchor) return true;
    return Math.abs(point.stamp - anchor.stamp) >= EPSILON;
  });

  return { diffs, projectedPoints, framePoints, selectionCleanup };
}

export function applyTrackDiffOpsToPoints(
  points: Keypoint<RawValue>[],
  diffs: TrackDiffOp[],
): Keypoint<RawValue>[] {
  if (diffs.length === 0) {
    return points;
  }

  const map = new Map(points.map((point) => [point.id, cloneKeypoint(point)]));
  let order = points.map((point) => point.id);

  diffs.forEach((diff) => {
    if (diff.type === "updateKeypoint") {
      const target = map.get(diff.keypointId);
      if (!target) return;
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
              pairing: diff.changes.transitions.pairing,
            }
          : undefined;
      }
      return;
    }

    if (diff.type === "deleteKeypoint") {
      map.delete(diff.keypointId);
      order = order.filter((id) => id !== diff.keypointId);
      return;
    }

    if (diff.type === "insertKeypoint") {
      map.set(diff.keypoint.id, cloneKeypoint(diff.keypoint));
      if (!order.includes(diff.keypoint.id)) {
        order.push(diff.keypoint.id);
      }
      return;
    }

    if (diff.type === "reorderKeypoints") {
      order = diff.order.filter((id) => map.has(id));
    }
  });

  const ordered = order
    .map((id) => map.get(id))
    .filter((point): point is Keypoint<RawValue> => Boolean(point));

  const remaining = Array.from(map.entries())
    .filter(([id]) => !order.includes(id))
    .map(([, point]) => point);

  return [...ordered, ...remaining];
}

export function applyTrackDiffOpsToTrack(track: Track<RawValue>, diffs: TrackDiffOp[]): void {
  if (diffs.length === 0) {
    return;
  }

  const map = new Map(track.points.map((point) => [point.id, point]));
  let order = track.points.map((point) => point.id);

  diffs.forEach((diff) => {
    if (diff.type === "updateKeypoint") {
      const target = map.get(diff.keypointId);
      if (!target) return;
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
              pairing: diff.changes.transitions.pairing,
            }
          : undefined;
      }
      return;
    }

    if (diff.type === "deleteKeypoint") {
      map.delete(diff.keypointId);
      order = order.filter((id) => id !== diff.keypointId);
      return;
    }

    if (diff.type === "insertKeypoint") {
      map.set(diff.keypoint.id, cloneKeypoint(diff.keypoint));
      if (!order.includes(diff.keypoint.id)) {
        order.push(diff.keypoint.id);
      }
      return;
    }

    if (diff.type === "reorderKeypoints") {
      order = diff.order.filter((id) => map.has(id));
    }
  });

  const nextPoints: Keypoint<RawValue>[] = [];
  order.forEach((id) => {
    const point = map.get(id);
    if (point) {
      nextPoints.push(point);
    }
  });

  map.forEach((point, id) => {
    if (!order.includes(id)) {
      nextPoints.push(point);
    }
  });

  track.points.splice(0, track.points.length, ...nextPoints);
}
