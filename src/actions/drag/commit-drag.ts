import type { AnimationData } from "../../store-types";
import { computeDragDiffOps, applyTrackDiffOpsToTrack } from "../../functions/drag-diff-ops";
import { cloneTransitionValue, cloneTransitions } from "../../utils/clone-transitions";
import type { SelectionCleanup, TrackDiffOp } from "../../types/util/diff";

const buildBoundsByTrack = (state: AnimationData): Map<string, { min: number; max: number }> => {
  const boundsByTrack = new Map<string, { min: number; max: number }>();
  const rows = Object.values(state.derivedSnapshot?.rows ?? {});
  rows.forEach((row) => {
    const computed = row.computed;
    if (!computed?.verticalBounds) return;
    computed.virtualFrames.forEach((frame) => {
      frame.points.forEach((point) => {
        if (!boundsByTrack.has(point.trackId)) {
          boundsByTrack.set(point.trackId, computed.verticalBounds);
        }
      });
    });
  });
  return boundsByTrack;
};

const groupDiffsByTrackId = (diffs: TrackDiffOp[]): Map<string, TrackDiffOp[]> => {
  const grouped = new Map<string, TrackDiffOp[]>();
  diffs.forEach((diff) => {
    const list = grouped.get(diff.trackId) ?? [];
    list.push(diff);
    grouped.set(diff.trackId, list);
  });
  return grouped;
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
  // Seed diffs capture non-destructive inserts (e.g. slider drags) before deltas are applied.
  const seedDiffsByTrackId = groupDiffsByTrackId(dragState.seedDiffs ?? []);
  const hasSeedDiffs = seedDiffsByTrackId.size > 0;

  if (!hasHorizontalDelta && !hasVerticalDelta && !hasPendingOps && !hasSeedDiffs) {
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
        if (diff.pairing !== undefined) {
          point.transitions.pairing = diff.pairing;
        }
      });
    }
    state.dragState = undefined;
    return;
  }

  const selectionCleanups: SelectionCleanup[] = [];

  if (hasPendingOps) {
    const diffsByTrack = new Map<string, TrackDiffOp[]>();
    seedDiffsByTrackId.forEach((diffs, trackId) => {
      diffsByTrack.set(trackId, [...diffs]);
    });
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
  } else if (hasHorizontalDelta || hasVerticalDelta) {
    const boundsByTrack = hasVerticalDelta ? buildBoundsByTrack(state) : undefined;
    const trackIds = new Set<string>(selection.keypoints.keys());
    seedDiffsByTrackId.forEach((_diffs, trackId) => trackIds.add(trackId));

    for (const trackId of trackIds) {
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
        bounds: hasVerticalDelta ? boundsByTrack?.get(trackId) : undefined,
      });
      const seedDiffs = seedDiffsByTrackId.get(trackId) ?? [];
      const combinedDiffs = seedDiffs.length > 0 ? [...seedDiffs, ...diffs] : diffs;

      if (combinedDiffs.length > 0) {
        applyTrackDiffOpsToTrack(track, combinedDiffs);
      }
      if (selectionCleanup) {
        selectionCleanups.push(selectionCleanup);
      }
    }
  } else if (hasSeedDiffs) {
    seedDiffsByTrackId.forEach((diffs, trackId) => {
      const track = state.tracks[trackId];
      if (!track) return;
      applyTrackDiffOpsToTrack(track, diffs);
    });
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
      if (diff.pairing !== undefined) {
        point.transitions.pairing = diff.pairing;
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
