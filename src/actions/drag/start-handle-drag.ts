import type { AnimationData } from "../../store-types";
import type { HandleDragStartInput, DragStampTransform, DragState } from "../../types";

const DEFAULT_TRANSFORM: DragStampTransform = {
  offset: 0,
  timescale: 1,
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

export function startHandleDrag(state: AnimationData, input: HandleDragStartInput): void {
  const selection = state.selectionState;
  if (!selection?.instanceId) {
    return;
  }

  const track = state.tracks[input.trackId];
  if (!track) {
    return;
  }

  const anchorPoint = track.points.find((p) => p.id === input.keypointId);
  const neighborPoint = track.points.find((p) => p.id === input.neighborKeypointId);
  if (!anchorPoint || !neighborPoint) {
    return;
  }

  const dragState: DragState = {
    axis: "both",
    instanceId: selection.instanceId,
    instanceTransform: resolveInstanceTransform(state, selection.instanceId),
    anchor: {
      keypointId: input.keypointId,
      trackId: input.trackId,
      rowId: input.rowId,
      markerId: input.keypointId,
      kind: input.side === "out" ? "handle-out" : "handle-in",
      neighborKeypointId: input.neighborKeypointId,
      attributePath: input.attributePath,
      valueScale: input.valueScale,
    },
    pointerOrigin: input.origin,
    stampOrigin: input.side === "out" ? input.startStamp : input.endStamp,
    modifiers: {
      alt: false,
      shift: false,
      meta: false,
    },
    activeHandleId: `${String(input.keypointId)}:${String(input.side)}`,
    handleDiffs: {},
    handleAnchor: {
      side: input.side === "out" ? "out" : "in",
      trackId: input.trackId,
      keypointId: input.keypointId,
      neighborKeypointId: input.neighborKeypointId,
      startStamp: input.startStamp,
      endStamp: input.endStamp,
      startValue: input.startValue,
      endValue: input.endValue,
      controlPoint: input.controlPoint,
      attributePath: input.attributePath,
      valueScale: input.valueScale,
    },
  };

  state.dragState = dragState;
}
