import type { RawValue, RawVector2 } from "@semio/utils";
import type { AnimationData } from "../../store-types";
import type {
  DragStampTransform,
  DragStartInput,
  DragState,
  DragMarkerHandleOffsets,
  InstancedFrameInfo,
  Keypoint,
  SelectionState,
  Track,
  ValueScale,
} from "../../types";
import { cloneTransitions } from "../../utils/clone-transitions";
import { buildHandleOffsetKey } from "../../utils/handle-offset-key";
import { getWorldControlPoints } from "../../functions/get-world-control-points";
import { DEFAULT_TRANSITION_IN, DEFAULT_TRANSITION_OUT } from "../../constants";

const DEFAULT_TRANSFORM: DragStampTransform = {
  offset: 0,
  timescale: 1,
};

const extractNumericComponent = (value: RawValue, path?: string[]): number | undefined => {
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

const cloneRawValue = (value: RawValue): RawValue => {
  try {
    return JSON.parse(JSON.stringify(value)) as RawValue;
  } catch {
    return value;
  }
};

const resolveInstanceTransform = (state: AnimationData, instanceId: string): DragStampTransform => {
  for (const namespace of Object.values(state.namespaces)) {
    const instance = namespace.animationInstances[instanceId];
    if (instance) {
      return {
        offset: instance.settings.offset ?? 0,
        timescale: instance.settings.timescale ?? 1,
      };
    }
  }

  return DEFAULT_TRANSFORM;
};

const flattenSelection = (selection: SelectionState): Set<string> => {
  const ids = new Set<string>();
  selection.keypoints.forEach((keypoints) => {
    keypoints.forEach((id) => ids.add(id));
  });
  return ids;
};

const findAnchorPoint = (
  marker: InstancedFrameInfo,
  selection: SelectionState,
): InstancedFrameInfo["points"][number] | undefined => {
  const selectedIds = flattenSelection(selection);
  return marker.points.find((point) => selectedIds.has(point.id));
};

export function startDrag(state: AnimationData, input: DragStartInput): void {
  state.dragState = undefined;

  const selection = state.selectionState;
  if (!selection?.instanceId) {
    return;
  }

  const rowData = state.derivedSnapshot?.rows?.[input.rowId]?.computed;
  if (!rowData) {
    return;
  }

  const selectedIds = flattenSelection(selection);
  const marker = rowData.virtualFrames.find((frame) =>
    frame.points.some((point) => selectedIds.has(point.id)),
  );
  if (!marker) {
    return;
  }

  const anchorPoint = findAnchorPoint(marker, selection);
  if (!anchorPoint || !anchorPoint.editable) {
    return;
  }

  const track = state.tracks[anchorPoint.trackId];
  if (!track) {
    return;
  }

  // Align selection map with the aggregate marker contents so all inner points move together.
  // This mirrors manual multi-select behaviour for grouped/global markers.
  if (selection.instanceId) {
    const nextKeypoints = new Map(selection.keypoints);
    marker.points
      .filter((p) => p.instanceId === selection.instanceId)
      .forEach((p) => {
        const existing = nextKeypoints.get(p.trackId) ?? new Set<string>();
        if (!existing.has(p.id)) {
          const nextSet = new Set(existing);
          nextSet.add(p.id);
          nextKeypoints.set(p.trackId, nextSet);
        }
      });
    state.selectionState = {
      ...state.selectionState,
      keypoints: nextKeypoints,
    };
  }

  const pointIndex = track.points.findIndex((point) => point.id === anchorPoint.id);
  if (pointIndex === -1) {
    return;
  }
  const keypoint = track.points[pointIndex];

  const transform = resolveInstanceTransform(state, selection.instanceId) ?? DEFAULT_TRANSFORM;

  const anchorAttributePath = anchorPoint.attribute ? [anchorPoint.attribute] : undefined;
  const anchorValueOrigin = extractNumericComponent(keypoint.value, anchorAttributePath);

  const valueScale: ValueScale | undefined =
    (input as any)?.valueScale ??
    (rowData.verticalBounds
      ? {
          domain: [rowData.verticalBounds.min, rowData.verticalBounds.max],
          clamp: true,
        }
      : undefined);

  const dragState: DragState = {
    axis: input.axis,
    instanceId: selection.instanceId,
    instanceTransform: transform,
    anchor: {
      keypointId: anchorPoint.id,
      trackId: anchorPoint.trackId,
      namespaceId: anchorPoint.namespaceId,
      instanceId: anchorPoint.instanceId,
      rowId: input.rowId,
      markerId: marker.id,
      attributePath: anchorAttributePath,
      valueScale,
    },
    pointerOrigin: input.origin,
    stampOrigin: keypoint.stamp,
    anchorValueOrigin,
    modifiers: {
      alt: false,
      shift: false,
      meta: false,
    },
  };
  // Use the current marker id as the stable frame id for the anchor row during this drag.
  dragState.anchorFrameId = marker.id;

  const handleOffsetMap: Record<string, DragMarkerHandleOffsets> = {};

  const markerHandleOffsets = computeMarkerHandleOffsets({
    track,
    keypoint,
    attributePath: anchorAttributePath,
  });

  if (markerHandleOffsets) {
    const handleKey = buildHandleOffsetKey(keypoint.id, anchorAttributePath);
    handleOffsetMap[handleKey] = markerHandleOffsets;
  }

  const prevPoint = track.points[pointIndex - 1];
  if (prevPoint) {
    const prevOffsets = computeMarkerHandleOffsets({
      track,
      keypoint: prevPoint,
      attributePath: anchorAttributePath,
    });
    if (prevOffsets?.out && prevOffsets.out.neighborKeypointId === keypoint.id) {
      const prevKey = buildHandleOffsetKey(prevPoint.id, anchorAttributePath);
      handleOffsetMap[prevKey] = {
        ...(handleOffsetMap[prevKey] ?? {}),
        out: prevOffsets.out,
      };
    }
  }

  const nextPoint = track.points[pointIndex + 1];
  if (nextPoint) {
    const nextOffsets = computeMarkerHandleOffsets({
      track,
      keypoint: nextPoint,
      attributePath: anchorAttributePath,
    });
    if (nextOffsets?.in && nextOffsets.in.neighborKeypointId === keypoint.id) {
      const nextKey = buildHandleOffsetKey(nextPoint.id, anchorAttributePath);
      handleOffsetMap[nextKey] = {
        ...(handleOffsetMap[nextKey] ?? {}),
        in: nextOffsets.in,
      };
    }
  }

  if (Object.keys(handleOffsetMap).length > 0) {
    dragState.markerHandleOffsets = handleOffsetMap;
  }

  // Capture world-space handle deltas for all keypoints on the track so we can
  // preserve control point positions even when reordering changes adjacency.
  track.points.forEach((point) => {
    const offsets = computeMarkerHandleOffsets({
      track,
      keypoint: point,
      attributePath: anchorAttributePath,
    });
    if (!offsets) return;
    const key = buildHandleOffsetKey(point.id, anchorAttributePath);
    dragState.markerHandleOffsets = {
      ...(dragState.markerHandleOffsets ?? {}),
      [key]: {
        ...(dragState.markerHandleOffsets?.[key] ?? {}),
        ...offsets,
      },
    };
  });

  const snapshotTrackIds = new Set<string>();
  selection.keypoints.forEach((_ids, trackKey) => snapshotTrackIds.add(trackKey));
  const trackSnapshots: Record<string, { trackId: string; points: Keypoint<RawValue>[] }> = {};
  snapshotTrackIds.forEach((trackId) => {
    const trackToClone = state.tracks[trackId];
    if (!trackToClone) return;
    trackSnapshots[trackId] = {
      trackId,
      points: trackToClone.points.map((point) => ({
        ...point,
        value: cloneRawValue(point.value),
        transitions: cloneTransitions(point.transitions),
      })),
    };
  });
  if (Object.keys(trackSnapshots).length > 0) {
    dragState.trackSnapshots = trackSnapshots;
  }

  state.dragState = dragState;
}

interface MarkerHandleParams {
  track: Track<RawValue>;
  keypoint: Keypoint<RawValue>;
  attributePath?: string[];
}

function computeMarkerHandleOffsets({
  track,
  keypoint,
  attributePath,
}: MarkerHandleParams): DragMarkerHandleOffsets | undefined {
  const anchorValue = extractNumericComponent(keypoint.value, attributePath);
  if (typeof anchorValue !== "number") {
    return undefined;
  }

  const pointIndex = track.points.findIndex((point) => point.id === keypoint.id);
  if (pointIndex === -1) {
    return undefined;
  }

  const offsets: DragMarkerHandleOffsets = {};

  const nextPoint = track.points[pointIndex + 1];
  const outTransition = keypoint.transitions?.out ?? DEFAULT_TRANSITION_OUT;
  if (nextPoint) {
    const neighborValue = extractNumericComponent(nextPoint.value, attributePath);
    if (typeof neighborValue === "number") {
      const { start: cpWorld } = getWorldControlPoints(
        keypoint.stamp,
        nextPoint.stamp,
        anchorValue,
        neighborValue,
        { out: outTransition },
        { in: nextPoint.transitions?.in },
      );
      const deltaX = cpWorld.x - keypoint.stamp;
      const deltaY = (cpWorld.y as number) - anchorValue;
      offsets.out = {
        neighborKeypointId: nextPoint.id,
        delta: {
          x: deltaX,
          y: deltaY,
        },
        fallback:
          typeof outTransition === "object"
            ? (outTransition as RawVector2)
            : { x: deltaX, y: deltaY },
      };
    }
  }

  const prevPoint = track.points[pointIndex - 1];
  const inTransition = keypoint.transitions?.in ?? DEFAULT_TRANSITION_IN;
  if (prevPoint) {
    const neighborValue = extractNumericComponent(prevPoint.value, attributePath);
    if (typeof neighborValue === "number") {
      const { end: cpWorld } = getWorldControlPoints(
        prevPoint.stamp,
        keypoint.stamp,
        neighborValue,
        anchorValue,
        { out: prevPoint.transitions?.out },
        { in: inTransition },
      );
      const deltaX = cpWorld.x - keypoint.stamp;
      const deltaY = (cpWorld.y as number) - anchorValue;
      offsets.in = {
        neighborKeypointId: prevPoint.id,
        delta: {
          x: deltaX,
          y: deltaY,
        },
        fallback:
          typeof inTransition === "object"
            ? (inTransition as RawVector2)
            : { x: deltaX, y: deltaY },
      };
    }
  }

  if (!offsets.in && !offsets.out) {
    return undefined;
  }

  return offsets;
}
