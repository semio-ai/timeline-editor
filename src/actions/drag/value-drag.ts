import type { RawValue } from "@semio/utils";
import type { AnimationData } from "../../store-types";
import type {
  DragMarkerHandleOffsets,
  DragStampTransform,
  DragState,
  Keypoint,
  SelectionState,
  Track,
  ValueDragStartInput,
  ValueDragUpdateInput,
  ValueScale,
} from "../../types";
import { computeLocalStamp } from "../../functions/compute-instance-time";
import { insertKeypointAtWorldStamp } from "../insert-keypoint-at-stamp";
import { removeKeypoint } from "../remove-keypoint";
import { cloneTransitions } from "../../utils/clone-transitions";
import { DEFAULT_TRANSITION_IN, DEFAULT_TRANSITION_OUT } from "../../constants";
import { getWorldControlPoints } from "../../functions/get-world-control-points";
import { clearSelection } from "../../functions/selection-state-manager";
import { updateDrag } from "./update-drag";
import { commitDrag } from "./commit-drag";
import { cancelDrag } from "./cancel-drag";

const DEFAULT_TRANSFORM: DragStampTransform = {
  offset: 0,
  timescale: 1,
};

const EPSILON = 1e-6;

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

const extractNumericValue = (value: RawValue): number | undefined =>
  typeof value === "number" ? value : undefined;

const cloneRawValue = (value: RawValue): RawValue => {
  try {
    return JSON.parse(JSON.stringify(value)) as RawValue;
  } catch {
    return value;
  }
};

const buildAnchorFrameId = (
  keypointId: string,
  trackId: string,
  namespaceId: string,
  instanceId: string,
): string => `${keypointId}-${trackId}-${namespaceId}-${instanceId}`;

const findKeypointAtStamp = (
  track: Track<RawValue>,
  localStamp: number,
): Keypoint<RawValue> | undefined =>
  track.points.find((point) => Math.abs(point.stamp - localStamp) <= EPSILON);

const resolveValueScale = (
  inputScale: ValueScale | undefined,
  state: AnimationData,
  rowId: string,
): ValueScale | undefined => {
  if (inputScale) return inputScale;
  const row = state.derivedSnapshot?.rows?.[rowId]?.computed;
  if (!row?.verticalBounds) return undefined;
  // Value-driven drags use literal row bounds; visual padding/offset from spline views is ignored.
  return {
    domain: [row.verticalBounds.min, row.verticalBounds.max],
    clamp: true,
  };
};

const computeMarkerHandleOffsets = ({
  track,
  keypoint,
}: {
  track: Track<RawValue>;
  keypoint: Keypoint<RawValue>;
}): DragMarkerHandleOffsets | undefined => {
  const anchorValue = extractNumericValue(keypoint.value);
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
    const neighborValue = extractNumericValue(nextPoint.value);
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
      };
    }
  }

  const prevPoint = track.points[pointIndex - 1];
  const inTransition = keypoint.transitions?.in ?? DEFAULT_TRANSITION_IN;
  if (prevPoint) {
    const neighborValue = extractNumericValue(prevPoint.value);
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
      };
    }
  }

  if (!offsets.in && !offsets.out) {
    return undefined;
  }

  return offsets;
};

const seedSelection = (
  instanceId: string,
  trackId: string,
  keypointId: string,
  rowId: string,
  markerId: string,
): SelectionState => {
  const keypoints = new Map<string, Set<string>>();
  keypoints.set(trackId, new Set([keypointId]));
  return {
    instanceId,
    keypoints,
    reference: { rowId, markerId },
  };
};

export function startValueDrag(state: AnimationData, input: ValueDragStartInput): void {
  state.dragState = undefined;

  const track = state.tracks[input.trackId];
  if (!track) {
    return;
  }
  const instanceId = input.instanceId;

  const instanceTransform = resolveInstanceTransform(state, instanceId);
  const localStamp = computeLocalStamp(
    input.worldStamp,
    instanceTransform.timescale,
    instanceTransform.offset,
  );

  let keypoint = findKeypointAtStamp(track, localStamp);
  let insertedKeypoint: DragState["insertedKeypoint"];
  if (!keypoint) {
    const inserted = insertKeypointAtWorldStamp(state, input.trackId, input.worldStamp, instanceId);
    if (!inserted) {
      return;
    }
    keypoint = inserted;
    insertedKeypoint = { trackId: input.trackId, keypointId: inserted.id };
  }

  const anchorValueOrigin = extractNumericValue(keypoint.value);
  if (anchorValueOrigin === undefined) {
    if (insertedKeypoint) {
      removeKeypoint(state, insertedKeypoint.trackId, insertedKeypoint.keypointId);
    }
    return;
  }

  const anchorFrameId = buildAnchorFrameId(
    keypoint.id,
    input.trackId,
    input.namespaceId,
    input.instanceId,
  );
  state.selectionState = seedSelection(
    instanceId,
    input.trackId,
    keypoint.id,
    input.rowId,
    anchorFrameId,
  );

  const valueScale = resolveValueScale(input.valueScale, state, input.rowId);

  const dragState: DragState = {
    axis: "vertical",
    instanceId,
    instanceTransform,
    anchor: {
      keypointId: keypoint.id,
      trackId: input.trackId,
      rowId: input.rowId,
      valueScale,
    },
    anchorFrameId,
    stampOrigin: keypoint.stamp,
    anchorValueOrigin,
    modifiers: {
      alt: false,
      shift: false,
      meta: false,
    },
    insertedKeypoint,
  };

  const handleOffsetMap: Record<string, DragMarkerHandleOffsets> = {};

  const pointIndex = track.points.findIndex((point) => point.id === keypoint.id);
  const prevPoint = pointIndex > 0 ? track.points[pointIndex - 1] : undefined;
  const nextPoint =
    pointIndex >= 0 && pointIndex < track.points.length - 1
      ? track.points[pointIndex + 1]
      : undefined;

  const markerHandleOffsets = computeMarkerHandleOffsets({ track, keypoint });
  if (markerHandleOffsets) {
    handleOffsetMap[keypoint.id] = markerHandleOffsets;
  }

  if (prevPoint) {
    const prevOffsets = computeMarkerHandleOffsets({ track, keypoint: prevPoint });
    if (prevOffsets?.out && prevOffsets.out.neighborKeypointId === keypoint.id) {
      handleOffsetMap[prevPoint.id] = {
        ...(handleOffsetMap[prevPoint.id] ?? {}),
        out: prevOffsets.out,
      };
    }
  }

  if (nextPoint) {
    const nextOffsets = computeMarkerHandleOffsets({ track, keypoint: nextPoint });
    if (nextOffsets?.in && nextOffsets.in.neighborKeypointId === keypoint.id) {
      handleOffsetMap[nextPoint.id] = {
        ...(handleOffsetMap[nextPoint.id] ?? {}),
        in: nextOffsets.in,
      };
    }
  }

  if (Object.keys(handleOffsetMap).length > 0) {
    dragState.markerHandleOffsets = handleOffsetMap;
  }

  track.points.forEach((point) => {
    const offsets = computeMarkerHandleOffsets({ track, keypoint: point });
    if (!offsets) return;
    dragState.markerHandleOffsets = {
      ...(dragState.markerHandleOffsets ?? {}),
      [point.id]: {
        ...(dragState.markerHandleOffsets?.[point.id] ?? {}),
        ...offsets,
      },
    };
  });

  const trackSnapshots: Record<string, { points: Keypoint<RawValue>[] }> = {};
  trackSnapshots[input.trackId] = {
    points: track.points.map((point) => ({
      ...point,
      value: cloneRawValue(point.value),
      transitions: cloneTransitions(point.transitions),
    })),
  };
  dragState.trackSnapshots = trackSnapshots;

  state.dragState = dragState;
}

const resolveValueRange = (dragState: DragState, state: AnimationData): number => {
  const domain = dragState.anchor.valueScale?.domain;
  if (domain) {
    const range = domain[1] - domain[0];
    if (Number.isFinite(range) && range !== 0) return range;
  }

  const rowId = dragState.anchor.rowId;
  const bounds = state.derivedSnapshot?.rows?.[rowId]?.computed?.verticalBounds;
  if (bounds) {
    const range = bounds.max - bounds.min;
    if (Number.isFinite(range) && range !== 0) return range;
  }

  return 1;
};

export function updateValueDrag(state: AnimationData, input: ValueDragUpdateInput): void {
  const current = state.dragState;
  if (!current) {
    return;
  }

  const anchorValueOrigin = current.anchorValueOrigin;
  if (typeof anchorValueOrigin !== "number") {
    return;
  }

  const range = resolveValueRange(current, state);
  const normalizedValueDelta = (input.currentValue - anchorValueOrigin) / range;

  updateDrag(state, {
    normalizedValueDelta,
    modifiers: input.modifiers,
  });
}

export function commitValueDrag(state: AnimationData): void {
  commitDrag(state);
}

export function cancelValueDrag(state: AnimationData): void {
  const current = state.dragState;
  if (!current) {
    return;
  }

  if (current.insertedKeypoint) {
    const { trackId, keypointId } = current.insertedKeypoint;
    removeKeypoint(state, trackId, keypointId);
    if (state.selectionState) {
      state.selectionState = clearSelection(state.selectionState);
    }
  }

  cancelDrag(state);
}
