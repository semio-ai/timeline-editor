import { handlesWithinSnapTolerance } from "../../functions/handle-pointer-delta";
import type { AnimationData } from "../../store-types";
import type {
  AuthoredTransition,
  HandleDragStartInput,
  DragStampTransform,
  DragState,
} from "../../types";
import { StandardTransitionType, TransitionPairing } from "../../types";
import { resolveTransitionDelta } from "../../functions/get-world-control-points";

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

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const inferPairingFromTransitions = (params: {
  anchor: {
    stamp: number;
    value: number;
    transitions?: {
      in?: AuthoredTransition;
      out?: AuthoredTransition;
    };
  };
  prev?: { stamp: number; value: number };
  next?: { stamp: number; value: number };
  viewScaleX: number;
  viewScaleY: number;
  hasIn: boolean;
  hasOut: boolean;
}): TransitionPairing | undefined => {
  const { anchor, prev, next, hasIn, hasOut } = params;
  if (!hasIn || !hasOut || !prev || !next) {
    return undefined;
  }

  if (!isFiniteNumber(prev.value) || !isFiniteNumber(anchor.value) || !isFiniteNumber(next.value)) {
    return undefined;
  }

  const inTransition = anchor.transitions?.in ?? StandardTransitionType.Cubic;
  const outTransition = anchor.transitions?.out ?? StandardTransitionType.Cubic;

  const inDelta = resolveTransitionDelta(
    "in",
    prev.stamp,
    anchor.stamp,
    prev.value,
    anchor.value,
    inTransition,
  );
  const outDelta = resolveTransitionDelta(
    "out",
    anchor.stamp,
    next.stamp,
    anchor.value,
    next.value,
    outTransition,
  );

  return handlesWithinSnapTolerance(inDelta, outDelta, params.viewScaleX, params.viewScaleY)
    ? TransitionPairing.Paired
    : TransitionPairing.Free;
};

export function startHandleDrag(state: AnimationData, input: HandleDragStartInput): void {
  const selection = state.selectionState;
  if (!selection?.instanceId) {
    return;
  }

  // Permission/lock gate: refuse to start a handle drag on a non-editable
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

  const anchorPoint = track.points.find((p) => p.id === input.keypointId);
  const neighborPoint = track.points.find((p) => p.id === input.neighborKeypointId);
  if (!anchorPoint || !neighborPoint) {
    return;
  }

  const sortedPoints = [...track.points].sort((a, b) => a.stamp - b.stamp);
  const anchorIndex = sortedPoints.findIndex((p) => p.id === input.keypointId);
  const prevPoint = anchorIndex > 0 ? sortedPoints[anchorIndex - 1] : undefined;
  const nextPoint =
    anchorIndex >= 0 && anchorIndex < sortedPoints.length - 1
      ? sortedPoints[anchorIndex + 1]
      : undefined;

  const hasIn = Boolean(prevPoint);
  const hasOut = Boolean(nextPoint);
  const anchorNumericValue = isFiniteNumber(anchorPoint.value) ? anchorPoint.value : undefined;
  const inferredPairing =
    anchorPoint.transitions?.pairing ??
    (anchorNumericValue !== undefined
      ? inferPairingFromTransitions({
          anchor: {
            stamp: anchorPoint.stamp,
            value: anchorNumericValue,
            transitions: anchorPoint.transitions,
          },
          prev:
            prevPoint && isFiniteNumber(prevPoint.value)
              ? { stamp: prevPoint.stamp, value: prevPoint.value }
              : undefined,
          next:
            nextPoint && isFiniteNumber(nextPoint.value)
              ? { stamp: nextPoint.stamp, value: nextPoint.value }
              : undefined,
          viewScaleX: input.viewScaleX ?? 1,
          viewScaleY: input.viewScaleY ?? 1,
          hasIn,
          hasOut,
        })
      : undefined);
  const shouldUseInputPairing = hasIn && hasOut;
  const basePairing =
    anchorPoint.transitions?.pairing ??
    inferredPairing ??
    (shouldUseInputPairing ? input.pairing : undefined);

  const dragState: DragState = {
    axis: "both",
    instanceId: selection.instanceId,
    instanceTransform: resolveInstanceTransform(state, selection.instanceId),
    anchor: {
      keypointId: input.keypointId,
      trackId: input.trackId,
      rowId: input.rowId,
      valueScale: input.valueScale,
    },
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
      startStamp: input.startStamp,
      endStamp: input.endStamp,
      startValue: input.startValue,
      endValue: input.endValue,
      valueScale: input.valueScale,
      basePairing,
      hasIn,
      hasOut,
    },
  };

  state.dragState = dragState;
}
