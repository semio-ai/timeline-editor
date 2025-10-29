import type { RawValue } from "@semio/utils";
import type { AnimationData } from "../../store-types";
import type {
  DragStampTransform,
  DragStartInput,
  DragState,
  InstancedFrameInfo,
  SelectionState,
  ValueScale,
} from "../../types";

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

  const rowData = state.computedRowData[input.rowId];
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

  const keypoint = track.points.find((point) => point.id === anchorPoint.id);
  if (!keypoint) {
    return;
  }

  const transform = resolveInstanceTransform(state, selection.instanceId) ?? DEFAULT_TRANSFORM;

  const anchorAttributePath = anchorPoint.attribute ? [anchorPoint.attribute] : undefined;
  const anchorValueOrigin = extractNumericComponent(keypoint.value, anchorAttributePath);

  const valueScale: ValueScale | undefined = rowData.verticalBounds
    ? {
        domain: [rowData.verticalBounds.min, rowData.verticalBounds.max],
        clamp: true,
      }
    : undefined;

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

  state.dragState = dragState;
}
