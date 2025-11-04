import type { AnimationData } from "../../store-types";
import { applyDragDeltas } from "../../functions/apply-drag-deltas";

interface MarkerContext {
  attributePath?: string[];
  bounds?: { min: number; max: number };
}

const buildMarkerContextLookup = (state: AnimationData): Map<string, MarkerContext> => {
  const lookup = new Map<string, MarkerContext>();
  for (const computed of Object.values(state.computedRowData)) {
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
  for (const [trackId, keypointIds] of selection.keypoints.entries()) {
    if (keypointIds.size === 0) continue;

    const track = state.tracks[trackId];
    if (!track) continue;

    let trackMutated = false;

    for (const keypointId of keypointIds) {
      const pointIndex = track.points.findIndex((point) => point.id === keypointId);
      if (pointIndex === -1) {
        continue;
      }

      const point = track.points[pointIndex];
      let pointChanged = false;
      let nextPoint = point;

      if (markerContexts) {
        const contextKey = `${trackId}:${keypointId}`;
        const context = markerContexts.get(contextKey);
        nextPoint = applyDragDeltas(point, {
          dragState,
          selection,
          trackId,
          bounds: context?.bounds,
          attributePath: context?.attributePath ?? dragState.anchor.attributePath,
        });
      } else {
        nextPoint = applyDragDeltas(point, {
          dragState,
          selection,
          trackId,
          attributePath: dragState.anchor.attributePath,
        });
      }

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
