import { ReactNode } from "react";
import { NestedSeparator, type CanvasContextMenuContext, TimeDisplay } from "@semio/ui";
import { usePlayerStore } from "@semio/utils";
import type { AnimationData, AnimationActions } from "../../../store-types";
import { TrackRender } from "../../../types";
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
  const handleSelectAll = () => getAnimationState(animationStore).selectAll(trackKeys);
  const handleDeselectAll = () => getAnimationState(animationStore).clearSelection();

  return (
    <>
      <AnimationActionsSection ctx={ctx} />
      <NestedSeparator />
      <SelectionActionsSection hasSelection={hasSelection} onSelectAll={handleSelectAll} onDeselectAll={handleDeselectAll} />
      <NestedSeparator />
      <EditActionsSection
        ctx={ctx}
        hasSelection={hasSelection}
        hasClipboard={hasClipboard}
        onCut={handleCut}
        onCopy={handleCopy}
        onPaste={handlePaste}
        onDelete={handleDelete}
      />
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
    usePlayerStore.getState().updatePlayerViewport(0, Math.max(s.duration, 1000));
    const viewIds = Object.keys(s.editorViews);
    const hasSpline = viewIds.some(
      (id) => s.editorViews[id]?.trackRender === TrackRender.Spline,
    );
    if (hasSpline) {
      s.requestVerticalFit();
    }
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
  /** Track keys that the right-clicked keypoint belongs to. Used for "Select All in Track". */
  trackKeys?: string[],
): ReactNode {
  const state = getAnimationState(animationStore);
  const hasClipboard = state.clipboard !== null;

  const handleSelectAll = () => getAnimationState(animationStore).selectAll(trackKeys);
  const handleDeselectAll = () => getAnimationState(animationStore).clearSelection();
  const handleCopy = () => getAnimationState(animationStore).copySelection();
  const handleCut = () => getAnimationState(animationStore).cutSelection();
  const handlePaste = (worldStamp: number) => getAnimationState(animationStore).pasteAtStamp(worldStamp);
  const handleDelete = () => getAnimationState(animationStore).deleteSelection();

  return (
    <KeyContextMenu
      ctx={ctx}
      hasClipboard={hasClipboard}
      onSelectAll={handleSelectAll}
      onDeselectAll={handleDeselectAll}
      onCut={handleCut}
      onCopy={handleCopy}
      onPaste={handlePaste}
      onDelete={handleDelete}
    />
  );
}
