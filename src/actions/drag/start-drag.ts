import type { RawValue, RawVector2 } from "@semio/utils";
import type { AnimationData } from "../../store-types";
import type {
  DragStampTransform,
  DragStartInput,
  DragState,
  DragMarkerHandleOffsets,
  TransitionSpec,
  TransitionVariants,
  InstancedFrameInfo,
  Keypoint,
  SelectionState,
  Track,
  ValueScale,
} from "../../types";
import { buildHandleOffsetKey } from "../../utils/handle-offset-key";

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

const cloneTransitionSpec = (spec?: TransitionSpec): TransitionSpec | undefined => {
  if (!spec) return undefined;
  const next: TransitionSpec = {};
  if (spec.ease) next.ease = spec.ease;
  if (spec.handle) {
    const { deltaStamp, deltaValue } = spec.handle;
    if (typeof deltaStamp === "number" && typeof deltaValue === "number") {
      next.handle = { deltaStamp, deltaValue };
    }
  }
  return next;
};

const cloneTransitionsWorld = (tw?: TransitionVariants): TransitionVariants | undefined => {
  if (!tw) return undefined;
  const { in: inSpec, out: outSpec } = tw;
  return {
    in: cloneTransitionSpec(inSpec),
    out: cloneTransitionSpec(outSpec),
  };
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

  const marker = rowData.virtualFrames.find((frame) => frame.id === input.markerId);
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
        transitions: point.transitions
          ? {
              in: point.transitions.in ? { ...point.transitions.in } : undefined,
              out: point.transitions.out ? { ...point.transitions.out } : undefined,
            }
          : undefined,
        transitionsWorld: cloneTransitionsWorld(point.transitionsWorld),
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
  const outTransition = keypoint.transitions?.out;
  const outHandle = keypoint.transitionsWorld?.out?.handle;
  if (nextPoint && (outTransition || outHandle)) {
    const neighborValue = extractNumericComponent(nextPoint.value, attributePath);
    if (typeof neighborValue === "number") {
      const cpWorld =
        outHandle &&
        typeof outHandle.deltaStamp === "number" &&
        typeof outHandle.deltaValue === "number"
          ? {
              x: keypoint.stamp + outHandle.deltaStamp,
              y: anchorValue + outHandle.deltaValue,
            }
          : computeWorldCP({
              startStamp: keypoint.stamp,
              endStamp: nextPoint.stamp,
              startValue: anchorValue,
              endValue: neighborValue,
              transition: outTransition ?? { x: 0.5, y: 0.5 },
            });
      const deltaX =
        outHandle && typeof outHandle.deltaStamp === "number"
          ? outHandle.deltaStamp
          : cpWorld.x - keypoint.stamp;
      const deltaY =
        outHandle && typeof outHandle.deltaValue === "number"
          ? outHandle.deltaValue
          : cpWorld.y - anchorValue;
      offsets.out = {
        neighborKeypointId: nextPoint.id,
        delta: {
          x: deltaX,
          y: deltaY,
        },
        fallback: outTransition,
      };
    }
  }

  const prevPoint = track.points[pointIndex - 1];
  const inTransition = keypoint.transitions?.in;
  const inHandle = keypoint.transitionsWorld?.in?.handle;
  if (prevPoint && (inTransition || inHandle)) {
    const neighborValue = extractNumericComponent(prevPoint.value, attributePath);
    if (typeof neighborValue === "number") {
      const cpWorld =
        inHandle &&
        typeof inHandle.deltaStamp === "number" &&
        typeof inHandle.deltaValue === "number"
          ? {
              x: keypoint.stamp + inHandle.deltaStamp,
              y: anchorValue + inHandle.deltaValue,
            }
          : computeWorldCP({
              startStamp: prevPoint.stamp,
              endStamp: keypoint.stamp,
              startValue: neighborValue,
              endValue: anchorValue,
              transition: inTransition ?? { x: 0.5, y: 0.5 },
            });
      const deltaX =
        inHandle && typeof inHandle.deltaStamp === "number"
          ? inHandle.deltaStamp
          : cpWorld.x - keypoint.stamp;
      const deltaY =
        inHandle && typeof inHandle.deltaValue === "number"
          ? inHandle.deltaValue
          : cpWorld.y - anchorValue;
      offsets.in = {
        neighborKeypointId: prevPoint.id,
        delta: {
          x: deltaX,
          y: deltaY,
        },
        fallback: inTransition,
      };
    }
  }

  if (!offsets.in && !offsets.out) {
    return undefined;
  }

  return offsets;
}

function computeWorldCP(params: {
  startStamp: number;
  endStamp: number;
  startValue: number;
  endValue: number;
  transition?: RawVector2;
}): { x: number; y: number } {
  const span = params.endStamp - params.startStamp;
  const delta = params.endValue - params.startValue;
  const transition = params.transition ?? { x: 0.5, y: 0.5 };
  return {
    x: params.startStamp + span * transition.x,
    y: params.startValue + delta * transition.y,
  };
}
