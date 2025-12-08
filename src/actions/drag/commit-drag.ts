import type { AnimationData } from "../../store-types";
import { computeDragDiffOps, applyTrackDiffOpsToTrack } from "../../functions/drag-diff-ops";
import { cloneTransitionValue, cloneTransitions } from "../../utils/clone-transitions";
import type { SelectionCleanup, TrackDiffOp } from "../../types/util/diff";

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
  const dragState = state.derivedSnapshot?.dragContext ?? state.dragState;
  if (!dragState) {
    return;
  }

  const selection = state.selectionState;
  if (!selection.instanceId || selection.instanceId !== dragState.instanceId) {
    state.dragState = undefined;
    return;
  }

  const anchorTrackSelection = selection.keypoints.get(dragState.anchor.trackId);
  const isHandleDrag = Boolean(dragState.activeHandleId);
  if (!anchorTrackSelection?.has(dragState.anchor.keypointId) && !isHandleDrag) {
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
  const pendingTrackDiffs = (dragState.pendingDiffs ?? []).filter(
    (diff): diff is TrackDiffOp => diff.type !== "handle",
  );
  const hasPendingOps = pendingTrackDiffs.length > 0;

  if (!hasHorizontalDelta && !hasVerticalDelta && !hasPendingOps) {
    const handleDiffs = dragState.handleDiffs;
    if (handleDiffs && Object.keys(handleDiffs).length > 0) {
      Object.entries(handleDiffs).forEach(([keypointId, diff]) => {
        if (!diff.in && !diff.out) return;
        const track = Object.values(state.tracks).find((t) =>
          t.points.some((p) => p.id === keypointId),
        );
        if (!track) return;
        const point = track.points.find((p) => p.id === keypointId);
        if (!point) return;
        point.transitions = point.transitions ? { ...point.transitions } : {};
        if (diff.out) {
          point.transitions.out = cloneTransitionValue(diff.out);
        }
        if (diff.in) {
          point.transitions.in = cloneTransitionValue(diff.in);
        }
      });
    }
    state.dragState = undefined;
    return;
  }

  const selectionCleanups: SelectionCleanup[] = [];

  if (hasPendingOps) {
    const diffsByTrack = new Map<string, TrackDiffOp[]>();
    pendingTrackDiffs.forEach((diff) => {
      const list = diffsByTrack.get(diff.trackId) ?? [];
      list.push(diff);
      diffsByTrack.set(diff.trackId, list);
    });

    diffsByTrack.forEach((diffs, trackId) => {
      const track = state.tracks[trackId];
      if (!track) return;
      applyTrackDiffOpsToTrack(track, diffs);
    });

    if (dragState.pendingSelectionCleanups?.length) {
      selectionCleanups.push(...dragState.pendingSelectionCleanups);
    }
  } else {
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

      const { diffs, selectionCleanup } = computeDragDiffOps({
        trackId,
        trackPoints: track.points,
        snapshotPoints,
        dragState,
        selection,
        bounds: hasVerticalDelta ? boundsByTrack.get(trackId) : undefined,
        attributePath: attributePathByTrack.get(trackId) ?? dragState.anchor.attributePath,
      });

      if (diffs.length > 0) {
        applyTrackDiffOpsToTrack(track, diffs);
      }
      if (selectionCleanup) {
        selectionCleanups.push(selectionCleanup);
      }
    }
  }

  const handleDiffs = dragState.handleDiffs;
  if (handleDiffs && Object.keys(handleDiffs).length > 0) {
    Object.entries(handleDiffs).forEach(([keypointId, diff]) => {
      if (!diff.in && !diff.out) return;
      const track = Object.values(state.tracks).find((t) =>
        t.points.some((p) => p.id === keypointId),
      );
      if (!track) return;
      const point = track.points.find((p) => p.id === keypointId);
      if (!point) return;
      point.transitions = point.transitions ? { ...point.transitions } : {};
      if (diff.out) {
        point.transitions.out = cloneTransitionValue(diff.out);
      }
      if (diff.in) {
        point.transitions.in = cloneTransitionValue(diff.in);
      }
    });
  }

  // Apply selection cleanup for any deleted keypoints.
  selectionCleanups.forEach(({ trackId, removedIds }) => {
    const selectionSet = selection.keypoints.get(trackId);
    if (!selectionSet) {
      return;
    }
    removedIds.forEach((id) => selectionSet.delete(id));
    if (selectionSet.size === 0) {
      selection.keypoints.delete(trackId);
    }
  });

  state.dragState = undefined;
}
