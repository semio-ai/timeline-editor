import type { HandleVisibility } from "../store-types";
import type { RenderHandle, SourceRow } from "../types";

/**
 * Inputs the visibility decision needs from selection state.
 * Kept narrow so unit tests can construct minimal fixtures.
 */
export interface HandleVisibilitySelection {
  instanceId: string | null;
  keypoints: Map<string, Set<string>>;
}

/**
 * Whether the row is eligible to render bezier handles given the
 * preference and current selection.
 *
 * - "track-selection" (default): show handles whenever any track on this row
 *   has selected keypoints in the active instance.
 * - "single-track": same, but only when exactly one track in the entire
 *   selection has keypoints — selecting two tracks suppresses handles.
 * - "key-selection": same gating as track-selection at the row level —
 *   per-handle filtering is applied separately by `filterHandlesByVisibility`.
 */
export function shouldRowShowHandles(
  sourceRow: SourceRow | undefined,
  visibility: HandleVisibility,
  selection: HandleVisibilitySelection,
): boolean {
  if (!sourceRow || !selection.instanceId) return false;
  const instanceMatchesRow = sourceRow.data.some(
    (entry) => entry.instanceId === selection.instanceId,
  );
  if (!instanceMatchesRow) return false;
  const rowTrackHasKeys = sourceRow.data.some(
    (entry) => (selection.keypoints.get(entry.trackId)?.size ?? 0) > 0,
  );
  if (!rowTrackHasKeys) return false;
  if (visibility === "single-track") {
    // Count only tracks that actually have selected keypoints — toggleTrackInSelection
    // and rangeSelectTracks store empty Sets for tracks added without key-level
    // selection, which would otherwise inflate this count and suppress handles.
    let tracksWithKeys = 0;
    selection.keypoints.forEach((keypointIds) => {
      if (keypointIds.size > 0) tracksWithKeys += 1;
    });
    return tracksWithKeys === 1;
  }
  return true;
}

/**
 * Filter the row's handle list when the preference is "key-selection".
 * In every other mode the input list is returned unchanged.
 */
export function filterHandlesByVisibility(
  handles: RenderHandle[],
  visibility: HandleVisibility,
  selectedKeypoints: Map<string, Set<string>>,
): RenderHandle[] {
  if (visibility !== "key-selection" || handles.length === 0) return handles;
  return handles.filter((handle) => {
    const trackSelection = selectedKeypoints.get(handle.trackId);
    return trackSelection?.has(handle.keypointId) ?? false;
  });
}
