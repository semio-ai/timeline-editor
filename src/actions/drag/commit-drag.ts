import type { AnimationData } from "../../store-types";
import {
  applyTrackDiffsToTrack,
  computeTrackDiffsForDrag,
} from "../../functions/apply-drag-deltas";
import { cloneTransitions } from "../../utils/clone-transitions";

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
  const attributePathByTrack = new Map<string, string[] | undefined>();
  const boundsByTrack = new Map<string, { min: number; max: number } | undefined>();
  markerContexts?.forEach((context, key) => {
    const [trackId] = key.split(":");
    if (!attributePathByTrack.has(trackId) && context?.attributePath) {
      attributePathByTrack.set(trackId, context.attributePath);
    }
    if (!boundsByTrack.has(trackId) && context?.bounds) {
      boundsByTrack.set(trackId, context.bounds);
    }
  });

  for (const [trackId] of selection.keypoints.entries()) {
    const track = state.tracks[trackId];
    if (!track) continue;
    const snapshotPoints =
      dragState.trackSnapshots?.[trackId]?.points ??
      track.points.map((point) => ({
        ...point,
        value: structuredClone(point.value),
        transitions: cloneTransitions(point.transitions),
      }));

    const diffs = computeTrackDiffsForDrag({
      trackId,
      trackPoints: track.points,
      snapshotPoints,
      dragState,
      selection,
      bounds: hasVerticalDelta ? boundsByTrack.get(trackId) : undefined,
      attributePath: attributePathByTrack.get(trackId) ?? dragState.anchor.attributePath,
    });

    if (diffs.length === 0) {
      continue;
    }

    applyTrackDiffsToTrack(track, diffs);
  }

  state.dragState = undefined;
}
