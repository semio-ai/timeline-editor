import type { RawValue } from "@semio/utils";
import type { AnimationData } from "../../store-types";
import { applyDragDeltas } from "../../functions/apply-drag-deltas";
import { buildHandleOffsetKey, parseHandleOffsetKey } from "../../utils/handle-offset-key";

const cloneRawValueDeep = (value: RawValue): RawValue => {
  try {
    return JSON.parse(JSON.stringify(value)) as RawValue;
  } catch {
    return value;
  }
};

interface MarkerContext {
  attributePath?: string[];
  bounds?: { min: number; max: number };
}

const buildMarkerContextLookup = (state: AnimationData): Map<string, MarkerContext> => {
  const lookup = new Map<string, MarkerContext>();
  const rowIds = Object.keys(state.derivedSnapshot?.rows ?? {});
  for (const rowId of rowIds) {
    const computed = state.derivedSnapshot?.rows?.[rowId]?.computed;
    if (!computed) continue;
    const bounds = computed.verticalBounds;

    for (const frame of computed.virtualFrames) {
      for (const point of frame.points) {
        const key = `${point.trackId}:${point.id}`;
        if (lookup.has(key)) continue;
        lookup.set(key, {
          attributePath: point.attribute ? [point.attribute] : undefined,
          bounds,
        });
      }
    }
  }
  return lookup;
};

/**
 * Commit the current drag operation, applying all changes.
 * This uses the ID-based architecture to avoid stale data issues.
 *
 * @param state - The animation state to modify
 */
export function commitDrag(state: AnimationData): void {
  const dragState = state.dragState;
  if (!dragState) {
    return;
  }

  const selection = state.selectionState;
  if (!selection.instanceId || selection.instanceId !== dragState.instanceId) {
    state.dragState = undefined;
    return;
  }

  const anchorTrackSelection = selection.keypoints.get(dragState.anchor.trackId);
  if (!anchorTrackSelection?.has(dragState.anchor.keypointId)) {
    state.dragState = undefined;
    return;
  }

  const rawStampDelta =
    dragState.axis === "horizontal" || dragState.axis === "both"
      ? (dragState.stampDelta?.snapped ?? dragState.stampDelta?.raw)
      : undefined;
  const stampDelta =
    typeof rawStampDelta === "number" && Number.isFinite(rawStampDelta) ? rawStampDelta : undefined;

  const rawValueDelta =
    dragState.axis === "vertical" || dragState.axis === "both"
      ? dragState.normalizedValueDelta
      : undefined;

  const normalizedValueDelta =
    typeof rawValueDelta === "number" && Number.isFinite(rawValueDelta) ? rawValueDelta : undefined;

  const hasVerticalDelta = normalizedValueDelta !== undefined;
  const hasHorizontalDelta = typeof stampDelta === "number";

  if (!hasHorizontalDelta && !hasVerticalDelta) {
    state.dragState = undefined;
    return;
  }

  const markerContexts = hasVerticalDelta ? buildMarkerContextLookup(state) : undefined;
  const handleEntries = Object.entries(dragState.markerHandleOffsets ?? {}).map(
    ([key, offsets]) => ({
      key,
      offsets,
      ...parseHandleOffsetKey(key),
    }),
  );

  for (const [trackId, keypointIds] of selection.keypoints.entries()) {
    const track = state.tracks[trackId];
    if (!track) continue;
    const originalTrackPoints = track.points.map((point) => ({
      ...point,
      value: cloneRawValueDeep(point.value),
    }));

    const workEntries = new Map<
      string,
      {
        keypointId: string;
        attributePath?: string[];
        bounds?: { min: number; max: number };
      }
    >();

    const addWorkEntry = (
      keypointId: string,
      attributePath?: string[],
      bounds?: { min: number; max: number },
    ) => {
      const workKey = buildHandleOffsetKey(keypointId, attributePath);
      if (!workEntries.has(workKey)) {
        workEntries.set(workKey, { keypointId, attributePath, bounds });
      }
    };

    keypointIds.forEach((keypointId) => {
      const contextKey = `${trackId}:${keypointId}`;
      const context = markerContexts?.get(contextKey);
      addWorkEntry(keypointId, context?.attributePath ?? dragState.anchor.attributePath, context?.bounds);
    });

    handleEntries.forEach(({ keypointId, attributePath }) => {
      if (!track.points.some((point) => point.id === keypointId)) {
        return;
      }
      addWorkEntry(keypointId, attributePath ?? dragState.anchor.attributePath);
    });

    if (workEntries.size === 0) {
      continue;
    }

    let trackMutated = false;

    for (const workEntry of workEntries.values()) {
      const { keypointId, attributePath: workAttributePath, bounds: workBounds } = workEntry;
      const pointIndex = track.points.findIndex((point) => point.id === keypointId);
      if (pointIndex === -1) {
        continue;
      }

      const point = track.points[pointIndex];
      let pointChanged = false;
      let nextPoint = point;

      const contextKey = `${trackId}:${keypointId}`;
      const context = markerContexts?.get(contextKey);
      const attributePath = workAttributePath ?? context?.attributePath ?? dragState.anchor.attributePath;
      const bounds = hasVerticalDelta ? workBounds ?? context?.bounds : undefined;

      nextPoint = applyDragDeltas(point, {
        dragState,
        selection,
        trackId,
        bounds,
        attributePath,
        trackPoints: track.points,
        originalTrackPoints,
      });

      if (nextPoint !== point) {
        track.points[pointIndex] = nextPoint;
        pointChanged = true;
      }

      if (pointChanged) {
        trackMutated = true;
      }
    }

    if (trackMutated && hasHorizontalDelta) {
      track.points.sort((a, b) => a.stamp - b.stamp);
    }
  }

  state.dragState = undefined;
}
