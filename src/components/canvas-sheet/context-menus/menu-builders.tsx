import { ReactNode } from "react";
import { NestedSeparator, type CanvasContextMenuContext, TimeDisplay } from "@semio/ui";
import type { AnimationData, AnimationActions } from "../../../store-types";
import { setViewport, requestVerticalFit } from "../../../viewport-state";
import { AnimationActionsSection } from "./animation-actions";
import { SelectionActionsSection } from "./selection-actions";
import { EditActionsSection } from "./edit-actions";
import { KeyContextMenu } from "./key-actions";
import { AxisSettingsSection } from "./axis-settings";
import { ZoomActionsSection } from "./zoom-actions";

type AnimationStore = AnimationData & AnimationActions;

/**
 * Reads current animation store state imperatively.
 * Used by menu builders which are called at right-click time (inside the context tree)
 * to capture state before the content is portaled outside the tree.
 */
function getAnimationState(store: any): AnimationStore {
  return store.getState();
}

/** Context menu items for the tracks area and timeline. */
export function buildTrackMenuItems(
  ctx: CanvasContextMenuContext,
  animationStore: any,
  /** Optional explicit track keys for targeted Select All (from per-row context menu). */
  trackKeys?: string[],
): ReactNode {
  const state = getAnimationState(animationStore);
  const hasSelection = state.selectionState.keypoints.size > 0;
  const hasClipboard = state.clipboard !== null;

  const handleCopy = () => getAnimationState(animationStore).copySelection();
  const handleCut = () => getAnimationState(animationStore).cutSelection();
  const handlePaste = (worldStamp: number) => getAnimationState(animationStore).pasteAtStamp(worldStamp);
  const handleDelete = () => getAnimationState(animationStore).deleteSelection();
  const handleSelectAll = () => getAnimationState(animationStore).selectAll();
  const handleSelectAllInTrack = trackKeys
    ? () => getAnimationState(animationStore).selectAllInTracks(trackKeys)
    : undefined;
  const handleDeselectAll = () => getAnimationState(animationStore).clearSelection();

  return (
    <>
      <EditActionsSection
        ctx={ctx}
        hasSelection={hasSelection}
        hasClipboard={hasClipboard}
        onCut={handleCut}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onDelete={handleDelete}
      />
      <NestedSeparator />
      <SelectionActionsSection
        hasSelection={hasSelection}
        hasTrackContext={!!trackKeys}
        onSelectAll={handleSelectAll}
        onSelectAllInTrack={handleSelectAllInTrack}
        onDeselectAll={handleDeselectAll}
      />
      <NestedSeparator />
      <AnimationActionsSection ctx={ctx} />
    </>
  );
}

/** Context menu items for the ruler. */
export function buildRulerMenuItems(
  ctx: CanvasContextMenuContext,
  timeDisplay: TimeDisplay,
  setTimeDisplay: (v: TimeDisplay) => void,
): ReactNode {
  return (
    <>
      <AnimationActionsSection ctx={ctx} />
      <NestedSeparator />
      <AxisSettingsSection timeDisplay={timeDisplay} setTimeDisplay={setTimeDisplay} />
    </>
  );
}

/** Context menu items for the minimap. */
export function buildMinimapMenuItems(
  ctx: CanvasContextMenuContext,
  animationStore: any,
): ReactNode {
  const handleFitToViewport = () => {
    const s = getAnimationState(animationStore);
    setViewport(0, Math.max(s.duration, 1000));
    requestVerticalFit();
  };

  return (
    <>
      <AnimationActionsSection ctx={ctx} />
      <NestedSeparator />
      <ZoomActionsSection onFitToViewport={handleFitToViewport} />
    </>
  );
}

/** Context menu items for right-clicking a specific keypoint. */
export function buildKeyMenuItems(
  ctx: CanvasContextMenuContext,
  animationStore: any,
  /** Track keys for the right-clicked marker. Used as the fallback scope for
   * "Select All in Track" when no selection exists. */
  trackKeys?: string[],
): ReactNode {
  const state = getAnimationState(animationStore);
  const hasClipboard = state.clipboard !== null;
  const hasSelection = state.selectionState.keypoints.size > 0;

  // Scope for "Select All in Track(s)": match the convention used by
  // Cut/Copy/Delete (selection-centric). When a multi-track selection
  // exists, widen the scope to every track represented in it; otherwise
  // fall back to the right-clicked marker's tracks. This makes the
  // operation match user intent when working with a cross-track selection
  // ("expand the current scope") instead of silently collapsing it.
  const selectionTrackKeys = [...state.selectionState.keypoints.entries()]
    .filter(([, ids]) => ids.size > 0)
    .map(([trackKey]) => trackKey);
  const effectiveTrackKeys =
    selectionTrackKeys.length > 0 ? selectionTrackKeys : trackKeys;
  const selectAllInTrackLabel =
    (effectiveTrackKeys?.length ?? 0) > 1 ? "Select All in Tracks" : "Select All in Track";

  const handleSelectAll = () => getAnimationState(animationStore).selectAll();
  const handleSelectAllInTrack = effectiveTrackKeys
    ? () => getAnimationState(animationStore).selectAllInTracks(effectiveTrackKeys)
    : () => getAnimationState(animationStore).selectAll();
  const handleDeselectAll = () => getAnimationState(animationStore).clearSelection();
  const handleCopy = () => getAnimationState(animationStore).copySelection();
  const handleCut = () => getAnimationState(animationStore).cutSelection();
  const handlePaste = (worldStamp: number) => getAnimationState(animationStore).pasteAtStamp(worldStamp);
  const handleDelete = () => getAnimationState(animationStore).deleteSelection();
  const handleFlattenHandles = () => getAnimationState(animationStore).flattenSelectedKeyHandles();

  return (
    <KeyContextMenu
      ctx={ctx}
      hasClipboard={hasClipboard}
      hasSelection={hasSelection}
      onSelectAll={handleSelectAll}
      onSelectAllInTrack={handleSelectAllInTrack}
      selectAllInTrackLabel={selectAllInTrackLabel}
      onDeselectAll={handleDeselectAll}
      onCut={handleCut}
      onCopy={handleCopy}
      onPaste={handlePaste}
      onDelete={handleDelete}
      onFlattenHandles={handleFlattenHandles}
    />
  );
}
