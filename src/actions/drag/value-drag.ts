import isEqual from "lodash/isEqual";
import type { AnimationData } from "../../store-types";
import type {
  DragMarkerHandleOffsets,
  DragStampTransform,
  DragState,
  SelectionState,
  ValueDragStartInput,
  ValueDragUpdateInput,
  ValueScale,
} from "../../types";
import type { TrackDiffOp } from "../../types/util/diff";
import type { SimpleKeypoint, SimpleRawValue, SimpleTrack } from "../../types/data/simple-track";
import { computeLocalStamp } from "../../functions/compute-instance-time";
import { insertKeypointAtWorldStamp } from "../insert-keypoint-at-stamp";
import { cloneTransitionValue } from "../../utils/clone-transitions";
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

const extractNumericValue = (value: SimpleRawValue): number | undefined =>
  typeof value === "number" ? value : undefined;

const cloneRawValue = (value: SimpleRawValue): SimpleRawValue => {
  try {
    return JSON.parse(JSON.stringify(value)) as SimpleRawValue;
  } catch {
    return value;
  }
};

const cloneTransitionInfo = (
  transitions?: SimpleKeypoint["transitions"],
): SimpleKeypoint["transitions"] => {
  if (!transitions) {
    return undefined;
  }
  return {
    in: cloneTransitionValue(transitions.in),
    out: cloneTransitionValue(transitions.out),
    pairing: transitions.pairing,
  };
};

const cloneKeypoint = (point: SimpleKeypoint): SimpleKeypoint => ({
  ...point,
  value: cloneRawValue(point.value),
  transitions: cloneTransitionInfo(point.transitions),
});

const arraysEqual = (left: string[], right: string[]): boolean => {
  if (left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
};

interface SeedInsertionResult {
  inserted: SimpleKeypoint;
  diffs: TrackDiffOp[];
  track: SimpleTrack;
}

const buildSeedInsertDiffs = (
  state: AnimationData,
  track: SimpleTrack,
  input: ValueDragStartInput,
): SeedInsertionResult | undefined => {
  const seededTrack: SimpleTrack = {
    ...track,
    points: track.points.map(cloneKeypoint),
  };
  const seedState: AnimationData = {
    ...state,
    tracks: {
      ...state.tracks,
      [track.id]: seededTrack,
    },
  };

  // Build a non-destructive insertion so preview/commit can share diff ops.
  const inserted = insertKeypointAtWorldStamp(
    seedState,
    input.trackId,
    input.worldStamp,
    input.instanceId,
  );
  if (!inserted) {
    return undefined;
  }

  const diffs: TrackDiffOp[] = [];
  const baseById = new Map(track.points.map((point) => [point.id, point]));
  seededTrack.points.forEach((point) => {
    const original = baseById.get(point.id);
    if (!original) {
      diffs.push({
        type: "insertKeypoint",
        trackId: track.id,
        keypoint: {
          id: point.id,
          stamp: point.stamp,
          value: cloneRawValue(point.value),
          transitions: point.transitions
            ? {
                in: cloneTransitionValue(point.transitions.in),
                out: cloneTransitionValue(point.transitions.out),
                pairing: point.transitions.pairing,
              }
            : undefined,
        },
      });
      return;
    }

    const changes: Extract<TrackDiffOp, { type: "updateKeypoint" }>["changes"] = {};
    if (!Object.is(original.stamp, point.stamp)) {
      changes.stamp = point.stamp;
    }
    if (!isEqual(original.value, point.value)) {
      changes.value = cloneRawValue(point.value);
    }
    if (!isEqual(original.transitions, point.transitions)) {
      changes.transitions = point.transitions
        ? {
            in: cloneTransitionValue(point.transitions.in),
            out: cloneTransitionValue(point.transitions.out),
            pairing: point.transitions.pairing,
          }
        : undefined;
    }

    if (Object.keys(changes).length > 0) {
      diffs.push({
        type: "updateKeypoint",
        trackId: track.id,
        keypointId: original.id,
        changes,
      });
    }
  });

  const nextOrder = seededTrack.points.map((point) => point.id);
  if (
    !arraysEqual(
      nextOrder,
      track.points.map((point) => point.id),
    )
  ) {
    diffs.push({
      type: "reorderKeypoints",
      trackId: track.id,
      order: nextOrder,
    });
  }

  return {
    inserted,
    diffs,
    track: seededTrack,
  };
};

const buildAnchorFrameId = (
  keypointId: string,
  trackId: string,
  namespaceId: string,
  instanceId: string,
): string => `${keypointId}-${trackId}-${namespaceId}-${instanceId}`;

const findKeypointAtStamp = (track: SimpleTrack, localStamp: number): SimpleKeypoint | undefined =>
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
  track: SimpleTrack;
  keypoint: SimpleKeypoint;
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

  // Permission/lock gate: refuse to start a value drag on a non-editable
  // track. Drag updates/commits inherit the gate by virtue of `dragState`
  // being undefined when the start was rejected.
  const isNonEditable = Object.values(state.instancedTrackSources).some((row) =>
    row.data.some((d) => d.trackId === input.trackId && (d.locked || d.readonly)),
  );
  if (isNonEditable) {
    return;
  }

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
  let seedDiffs: TrackDiffOp[] | undefined;
  let activeTrack = track;
  if (!keypoint) {
    // Seed an insert diff so preview/commit can apply a consistent pipeline.
    const seedInsertion = buildSeedInsertDiffs(state, track, input);
    if (!seedInsertion) {
      return;
    }
    keypoint = seedInsertion.inserted;
    insertedKeypoint = { trackId: input.trackId, keypointId: seedInsertion.inserted.id };
    seedDiffs = seedInsertion.diffs;
    activeTrack = seedInsertion.track;
  }

  const anchorValueOrigin = extractNumericValue(keypoint.value);
  if (anchorValueOrigin === undefined) {
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
    seedDiffs,
  };

  const handleOffsetMap: Record<string, DragMarkerHandleOffsets> = {};

  const pointIndex = activeTrack.points.findIndex((point) => point.id === keypoint.id);
  const prevPoint = pointIndex > 0 ? activeTrack.points[pointIndex - 1] : undefined;
  const nextPoint =
    pointIndex >= 0 && pointIndex < activeTrack.points.length - 1
      ? activeTrack.points[pointIndex + 1]
      : undefined;

  const markerHandleOffsets = computeMarkerHandleOffsets({ track: activeTrack, keypoint });
  if (markerHandleOffsets) {
    handleOffsetMap[keypoint.id] = markerHandleOffsets;
  }

  if (prevPoint) {
    const prevOffsets = computeMarkerHandleOffsets({ track: activeTrack, keypoint: prevPoint });
    if (prevOffsets?.out?.neighborKeypointId === keypoint.id) {
      handleOffsetMap[prevPoint.id] = {
        ...(handleOffsetMap[prevPoint.id] ?? {}),
        out: prevOffsets.out,
      };
    }
  }

  if (nextPoint) {
    const nextOffsets = computeMarkerHandleOffsets({ track: activeTrack, keypoint: nextPoint });
    if (nextOffsets?.in?.neighborKeypointId === keypoint.id) {
      handleOffsetMap[nextPoint.id] = {
        ...(handleOffsetMap[nextPoint.id] ?? {}),
        in: nextOffsets.in,
      };
    }
  }

  if (Object.keys(handleOffsetMap).length > 0) {
    dragState.markerHandleOffsets = handleOffsetMap;
  }

  activeTrack.points.forEach((point) => {
    const offsets = computeMarkerHandleOffsets({ track: activeTrack, keypoint: point });
    if (!offsets) return;
    dragState.markerHandleOffsets = {
      ...(dragState.markerHandleOffsets ?? {}),
      [point.id]: {
        ...(dragState.markerHandleOffsets?.[point.id] ?? {}),
        ...offsets,
      },
    };
  });

  const trackSnapshots: Record<string, { points: SimpleKeypoint[] }> = {};
  trackSnapshots[input.trackId] = {
    points: activeTrack.points.map(cloneKeypoint),
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
    if (state.selectionState) {
      state.selectionState = clearSelection(state.selectionState);
    }
  }

  cancelDrag(state);
}
