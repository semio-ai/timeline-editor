import { describe, expect, it } from "vitest";
import type { RawValue } from "@semio/utils";
import { applyDragDeltas } from "../functions/apply-drag-deltas";
import type { DragState, DragMarkerHandleOffsets, Keypoint, SelectionState, Track } from "../types";
import {
  createTestAnimationStore,
  INSTANCE_IDS,
  NAMESPACE_IDS,
  TRACK_IDS,
} from "../test-fixtures/animation-store-factory";
import { buildHandleOffsetKey } from "../utils/handle-offset-key";

const buildSelection = (trackId: string, keypointId: string): SelectionState => ({
  instanceId: "instance-1",
  keypoints: new Map([[trackId, new Set([keypointId])]]),
  reference: null,
});

const buildTrack = (points: Keypoint<RawValue>[]): Track<RawValue> => ({
  id: "track-1",
  name: "Test",
  animatableId: "anim-1",
  points,
  settings: {},
});

describe("applyDragDeltas", () => {
  it("keeps neighbor handles stable when the anchor marker moves", () => {
    const leftPoint: Keypoint<RawValue> = {
      id: "left",
      stamp: 0,
      value: 0,
      transitions: { out: { x: 0.25, y: 0 } },
    };

    const rightPoint: Keypoint<RawValue> = {
      id: "right",
      stamp: 0.5,
      value: 10,
      transitions: { in: { x: 0.75, y: 1 } },
    };

    const track = buildTrack([leftPoint, rightPoint]);

    const span = rightPoint.stamp - leftPoint.stamp;
    const leftOutDelta = {
      x: leftPoint.stamp + span * (leftPoint.transitions!.out!.x ?? 0) - leftPoint.stamp,
      y: 0,
    };
    const rightInDelta = {
      x: leftPoint.stamp + span * (rightPoint.transitions!.in!.x ?? 0) - rightPoint.stamp,
      y: 0,
    };

    const dragState: DragState = {
      axis: "horizontal",
      instanceId: "instance-1",
      instanceTransform: { offset: 0, timescale: 1 },
      anchor: {
        keypointId: rightPoint.id,
        trackId: track.id,
        rowId: "row-1",
        markerId: "marker-1",
      },
      pointerOrigin: { x: 0, y: 0 },
      stampOrigin: rightPoint.stamp,
      modifiers: { alt: false, shift: false, meta: false },
      stampDelta: { raw: 0.2 },
      markerHandleOffsets: {
        [rightPoint.id]: {
          in: {
            neighborKeypointId: leftPoint.id,
            delta: rightInDelta,
            fallback: rightPoint.transitions!.in!,
          },
        },
        [leftPoint.id]: {
          out: {
            neighborKeypointId: rightPoint.id,
            delta: leftOutDelta,
            fallback: leftPoint.transitions!.out!,
          },
        },
      },
    };

    const selection = buildSelection(track.id, rightPoint.id);

    const nextStamp = Math.min(1, Math.max(0, rightPoint.stamp + (dragState.stampDelta?.raw ?? 0)));

    const updatedNeighbor = applyDragDeltas(leftPoint, {
      dragState,
      selection,
      trackId: track.id,
      trackPoints: track.points,
      originalTrackPoints: track.points,
    });

    expect(updatedNeighbor).not.toBe(leftPoint);
    const expectedLeftOutX = leftOutDelta.x / (nextStamp - leftPoint.stamp);
    expect(updatedNeighbor.transitions?.out?.x ?? 0).toBeCloseTo(expectedLeftOutX, 6);
    expect(updatedNeighbor.transitions?.out?.y ?? 0).toBe(leftPoint.transitions?.out?.y ?? 0);

    const updatedAnchor = applyDragDeltas(rightPoint, {
      dragState,
      selection,
      trackId: track.id,
      trackPoints: track.points,
      originalTrackPoints: track.points,
    });

    expect(updatedAnchor.stamp).toBeCloseTo(nextStamp, 6);
    const expectedRightInX =
      (nextStamp + rightInDelta.x - leftPoint.stamp) / (nextStamp - leftPoint.stamp);
    expect(updatedAnchor.transitions?.in?.x ?? 0).toBeCloseTo(expectedRightInX, 6);
  });

  it("preserves both adjacent handles when dragging a middle marker", () => {
    const left: Keypoint<RawValue> = {
      id: "left",
      stamp: 0.1,
      value: 2,
      transitions: { out: { x: 0.4, y: 0.2 } },
    };
    const middle: Keypoint<RawValue> = {
      id: "mid",
      stamp: 0.3,
      value: 5,
      transitions: {
        in: { x: 0.35, y: 0.8 },
        out: { x: 0.55, y: 0.25 },
      },
    };
    const right: Keypoint<RawValue> = {
      id: "right",
      stamp: 0.7,
      value: -1,
      transitions: { in: { x: 0.45, y: 0.65 } },
    };

    const track = buildTrack([left, middle, right]);

    const offsets = buildOffsetMap(track, middle.id);

    const dragState: DragState = {
      axis: "horizontal",
      instanceId: "instance-1",
      instanceTransform: { offset: 0, timescale: 1 },
      anchor: {
        keypointId: middle.id,
        trackId: track.id,
        rowId: "row-1",
        markerId: "marker-1",
      },
      pointerOrigin: { x: 0, y: 0 },
      stampOrigin: middle.stamp,
      modifiers: { alt: false, shift: false, meta: false },
      stampDelta: { raw: 0.2 },
      markerHandleOffsets: offsets,
    };

    const selection = buildSelection(track.id, middle.id);

    const before = captureHandleWorld(track.points, {
      leftId: left.id,
      middleId: middle.id,
      rightId: right.id,
    });

    const previewPoints = track.points.map((point) =>
      applyDragDeltas(point, {
        dragState,
        selection,
        trackId: track.id,
        trackPoints: track.points,
        originalTrackPoints: track.points,
      }),
    );

    const after = captureHandleWorld(previewPoints, {
      leftId: left.id,
      middleId: middle.id,
      rightId: right.id,
    });

    expect(after.leftOut).toMatchObject(before.leftOut);
    expect(after.rightIn).toMatchObject(before.rightIn);

    const anchorDelta = dragState.stampDelta?.raw ?? 0;
    expectDeltaStable(before.middleIn, after.middleIn, anchorDelta);
    expectDeltaStable(before.middleOut, after.middleOut, anchorDelta);
  });
});

describe("startDrag marker handle offsets", () => {
  it("captures handle offsets for anchor and neighbors", () => {
    const store = createTestAnimationStore({ includeNamespaceB: false });
    store.getState().initAnimationSubscriptions();

    const trackId = `${TRACK_IDS.POSITION}.x`;
    const rowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${trackId}`;
    const markerId = "px1.x";

    store.setState({
      selectionState: {
        instanceId: INSTANCE_IDS.ALPHA_SHARED,
        reference: { rowId, markerId },
        keypoints: new Map([[trackId, new Set([markerId])]]),
      },
    });

    store.getState().startDrag({
      axis: "horizontal",
      markerId,
      rowId,
      origin: { x: 0, y: 0 },
    });

    const dragState = store.getState().dragState;
    const anchorKey = buildHandleOffsetKey(markerId);
    expect(dragState?.markerHandleOffsets?.[anchorKey]?.in).toBeDefined();
    expect(dragState?.markerHandleOffsets?.[anchorKey]?.out).toBeDefined();

    const prevKey = buildHandleOffsetKey("px0.x");
    const nextKey = buildHandleOffsetKey("px2.x");
    expect(dragState?.markerHandleOffsets?.[prevKey]?.out).toBeDefined();
    expect(dragState?.markerHandleOffsets?.[nextKey]?.in).toBeDefined();
  });

  it("keeps spline handles stable through the full store pipeline", () => {
    const store = createTestAnimationStore({ includeNamespaceB: false });
    store.getState().initAnimationSubscriptions();

    const trackId = `${TRACK_IDS.POSITION}.x`;
    const rowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${trackId}`;
    const markerId = "px2.x";

    store.setState({
      selectionState: {
        instanceId: INSTANCE_IDS.ALPHA_SHARED,
        reference: { rowId, markerId },
        keypoints: new Map([[trackId, new Set([markerId])]]),
      },
    });

    store.getState().startDrag({
      axis: "horizontal",
      markerId,
      rowId,
      origin: { x: 0, y: 0 },
    });

    const dragState = store.getState().dragState!;
    const origin = dragState.stampOrigin ?? 0;
    store.getState().updateDrag({
      pointer: { x: 0, y: 0 },
      normalizedStamp: { current: origin + 0.15 },
      modifiers: dragState.modifiers,
    });

    const state = store.getState();
    const track = state.tracks[trackId];
    const rightKey = buildHandleOffsetKey("px3.x");
    const rightOffsets = state.dragState?.markerHandleOffsets?.[rightKey];
    expect(rightOffsets?.in).toBeDefined();

    const previewPoints = track.points.map((point) =>
      applyDragDeltas(point, {
        dragState: state.dragState,
        selection: state.selectionState,
        trackId: track.id,
        attributePath: undefined,
        trackPoints: track.points,
        originalTrackPoints: track.points,
      }),
    );

    const beforeHandles = captureAnchorHandles(track.points, "px2.x");
    const afterHandles = captureAnchorHandles(previewPoints, "px2.x");

    const previewAnchor = previewPoints.find((point) => point.id === "px2.x");
    const anchorDelta =
      (previewAnchor?.stamp ?? 0) - track.points.find((p) => p.id === "px2.x")!.stamp;
    expectDeltaStable(beforeHandles.in!, afterHandles.in!, anchorDelta);
    expectDeltaStable(beforeHandles.out!, afterHandles.out!, anchorDelta);

    store.getState().commitDrag();
    const committedTrack = store.getState().tracks[trackId];
    const committedHandles = captureAnchorHandles(committedTrack.points, "px2.x");
    const committedAnchor = committedTrack.points.find((point) => point.id === "px2.x");
    const commitDelta =
      (committedAnchor?.stamp ?? 0) - track.points.find((p) => p.id === "px2.x")!.stamp;
    expectDeltaStable(beforeHandles.in!, committedHandles.in!, commitDelta);
    expectDeltaStable(beforeHandles.out!, committedHandles.out!, commitDelta);
  });

  it("keeps handles attached while crossing a neighbor in a single drag", () => {
    const store = createTestAnimationStore({ includeNamespaceB: false });
    store.getState().initAnimationSubscriptions();

    const trackId = `${TRACK_IDS.POSITION}.x`;
    const rowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${trackId}`;
    const markerId = "px2.x";

    store.setState({
      selectionState: {
        instanceId: INSTANCE_IDS.ALPHA_SHARED,
        reference: { rowId, markerId },
        keypoints: new Map([[trackId, new Set([markerId])]]),
      },
    });

    const track = store.getState().tracks[trackId];
    const beforeHandles = captureAnchorHandles(track.points, "px2.x");

    store.getState().startDrag({
      axis: "horizontal",
      markerId,
      rowId,
      origin: { x: 0, y: 0 },
    });

    const dragState = store.getState().dragState!;
    const origin = dragState.stampOrigin ?? 0;
    // Push the marker past px3 (0.7) in a single drag.
    store.getState().updateDrag({
      pointer: { x: 0, y: 0 },
      normalizedStamp: { current: origin + 0.45 },
      modifiers: dragState.modifiers,
    });

    const previewState = store.getState();
    const previewTrack = previewState.tracks[trackId];
    const previewPoints = previewTrack.points.map((point) =>
      applyDragDeltas(point, {
        dragState: previewState.dragState,
        selection: previewState.selectionState,
        trackId,
        attributePath: undefined,
        trackPoints: previewTrack.points,
        originalTrackPoints: previewTrack.points,
      }),
    );

    const afterHandles = captureAnchorHandles(previewPoints, "px2.x");

    const previewAnchor = previewPoints.find((point) => point.id === "px2.x");
    const anchorDelta =
      (previewAnchor?.stamp ?? 0) - track.points.find((p) => p.id === "px2.x")!.stamp;
    expectDeltaStable(beforeHandles.in!, afterHandles.in!, anchorDelta);
    expectDeltaStable(beforeHandles.out!, afterHandles.out!, anchorDelta);
  });
});

const captureHandleWorld = (
  points: Keypoint<RawValue>[],
  params: { leftId: string; middleId: string; rightId: string; attributePath?: string[] },
) => {
  const left = points.find((point) => point.id === params.leftId);
  const middle = points.find((point) => point.id === params.middleId);
  const right = points.find((point) => point.id === params.rightId);
  if (!left || !middle || !right) {
    throw new Error("captureHandleWorld: missing keypoints");
  }
  return {
    leftOut: computeOutHandle(left, middle, params.attributePath)!,
    middleIn: computeInHandle(middle, left, params.attributePath)!,
    middleOut: computeOutHandle(middle, right, params.attributePath)!,
    rightIn: computeInHandle(right, middle, params.attributePath)!,
  };
};

const captureAnchorHandles = (
  points: Keypoint<RawValue>[],
  anchorId: string,
  attributePath?: string[],
) => {
  const sorted = [...points].sort((a, b) => a.stamp - b.stamp);
  const anchorIndex = sorted.findIndex((point) => point.id === anchorId);
  if (anchorIndex === -1) {
    throw new Error(`captureAnchorHandles: missing ${anchorId}`);
  }
  const anchor = sorted[anchorIndex];
  const left = sorted[anchorIndex - 1];
  const right = sorted[anchorIndex + 1];
  return {
    in: left ? computeInHandle(anchor, left, attributePath) : undefined,
    out: right ? computeOutHandle(anchor, right, attributePath) : undefined,
  };
};

const expectDeltaStable = (
  before: { x: number; y: number },
  after: { x: number; y: number },
  markerDelta: number,
) => {
  expect(after.y).toBeCloseTo(before.y, 6);
  expect(after.x - markerDelta).toBeCloseTo(before.x, 6);
};

const computeOutHandle = (
  point: Keypoint<RawValue>,
  neighbor?: Keypoint<RawValue>,
  attributePath?: string[],
) => {
  if (!neighbor || !point.transitions?.out) return undefined;
  const span = neighbor.stamp - point.stamp;
  const anchorValue = extractNumber(point.value, attributePath);
  const neighborValue = extractNumber(neighbor.value, attributePath);
  if (anchorValue === undefined || neighborValue === undefined) return undefined;
  const delta = neighborValue - anchorValue;
  return {
    x: point.stamp + span * point.transitions.out.x,
    y: anchorValue + delta * point.transitions.out.y,
  };
};

const computeInHandle = (
  point: Keypoint<RawValue>,
  neighbor?: Keypoint<RawValue>,
  attributePath?: string[],
) => {
  if (!neighbor || !point.transitions?.in) return undefined;
  const span = point.stamp - neighbor.stamp;
  const anchorValue = extractNumber(point.value, attributePath);
  const neighborValue = extractNumber(neighbor.value, attributePath);
  if (anchorValue === undefined || neighborValue === undefined) return undefined;
  const delta = anchorValue - neighborValue;
  return {
    x: neighbor.stamp + span * point.transitions.in.x,
    y: neighborValue + delta * point.transitions.in.y,
  };
};

const extractNumber = (value: RawValue, attributePath?: string[]): number | undefined => {
  if (!attributePath || attributePath.length === 0) {
    return typeof value === "number" ? value : undefined;
  }

  let current: unknown = value;
  for (const segment of attributePath) {
    if (typeof current !== "object" || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }

  return typeof current === "number" ? current : undefined;
};

const buildOffsetMap = (
  track: Track<RawValue>,
  anchorId: string,
): Record<string, DragMarkerHandleOffsets> => {
  const offsetMap: Record<string, DragMarkerHandleOffsets> = {};
  const index = track.points.findIndex((point) => point.id === anchorId);
  const anchor = track.points[index];

  const anchorOffsets = computeOffsetsForPoint(track, anchor);
  if (anchorOffsets) {
    offsetMap[anchor.id] = anchorOffsets;
  }

  const prev = track.points[index - 1];
  if (prev) {
    const prevOffsets = computeOffsetsForPoint(track, prev);
    if (prevOffsets?.out && prevOffsets.out.neighborKeypointId === anchor.id) {
      offsetMap[prev.id] = {
        ...(offsetMap[prev.id] ?? {}),
        out: prevOffsets.out,
      };
    }
  }

  const next = track.points[index + 1];
  if (next) {
    const nextOffsets = computeOffsetsForPoint(track, next);
    if (nextOffsets?.in && nextOffsets.in.neighborKeypointId === anchor.id) {
      offsetMap[next.id] = {
        ...(offsetMap[next.id] ?? {}),
        in: nextOffsets.in,
      };
    }
  }

  return offsetMap;
};

const computeOffsetsForPoint = (
  track: Track<RawValue>,
  keypoint: Keypoint<RawValue>,
): DragMarkerHandleOffsets | undefined => {
  const index = track.points.findIndex((point) => point.id === keypoint.id);
  if (index === -1) return undefined;

  const anchorValue = keypoint.value as number;
  const offsets: DragMarkerHandleOffsets = {};

  const next = track.points[index + 1];
  const outTransition = keypoint.transitions?.out;
  if (next && outTransition) {
    const cpWorld = computeWorldCP({
      startStamp: keypoint.stamp,
      endStamp: next.stamp,
      startValue: anchorValue,
      endValue: next.value as number,
      transition: outTransition,
    });
    offsets.out = {
      neighborKeypointId: next.id,
      delta: {
        x: cpWorld.x - keypoint.stamp,
        y: cpWorld.y - anchorValue,
      },
      fallback: outTransition,
    };
  }

  const prev = track.points[index - 1];
  const inTransition = keypoint.transitions?.in;
  if (prev && inTransition) {
    const cpWorld = computeWorldCP({
      startStamp: prev.stamp,
      endStamp: keypoint.stamp,
      startValue: prev.value as number,
      endValue: anchorValue,
      transition: inTransition,
    });
    offsets.in = {
      neighborKeypointId: prev.id,
      delta: {
        x: cpWorld.x - keypoint.stamp,
        y: cpWorld.y - anchorValue,
      },
      fallback: inTransition,
    };
  }

  return offsets.in || offsets.out ? offsets : undefined;
};

const computeWorldCP = (params: {
  startStamp: number;
  endStamp: number;
  startValue: number;
  endValue: number;
  transition: { x: number; y: number };
}): { x: number; y: number } => {
  const span = params.endStamp - params.startStamp;
  const delta = params.endValue - params.startValue;
  return {
    x: params.startStamp + span * params.transition.x,
    y: params.startValue + delta * params.transition.y,
  };
};
