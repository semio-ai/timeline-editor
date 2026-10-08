import { ReactNode, useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { uniq } from "lodash";
import { KeybindingProvider, useKeybindingMap } from "@semio/ui";
import { TrackControlMenuContent } from "../components/canvas-sheet/context-menus";
import { useTrackMenuState } from "../components/track-menu-context";
import { computeAggregate, nextToggleValue } from "../functions/three-way-aggregate";
import type { AggregateState } from "../functions/three-way-aggregate";
import type { AnimationActions, AnimationData } from "../store-types";
import type { SourceRow } from "../types";
import { useActiveAnimationId } from "./use-active-animation-id";
import { useAnimationStore } from "./use-animation-store";
import { useKeyControlState } from "./use-key-control-state";
import { usePlayer } from "./use-player";

export interface UseControlMenuParams {
  /** The source row this menu acts on. Caller supplies a fallback if no live row exists. */
  sourceRow: SourceRow;
  /** Raw track IDs for this row (post-uniq). */
  trackIds: string[];
  /** Whether this row is a group (affects menu phrasing and color-picker availability). */
  isGroup: boolean;
  /** Whether all entries in this row are read-only. */
  allReadonly: boolean;
  /** Current row color. Only passed through to the menu when editing color is allowed
   *  (i.e. single-track rows). Callers for group rows should omit this. */
  color?: string;
}

export interface UseControlMenuResult {
  /** Memoized menu content, already wrapped in KeybindingProvider for portal use. */
  menuContent: ReactNode;
  /** Whether any menu in the shared TrackMenuProvider is currently open. */
  menuOpen: boolean;
  /** Report this menu's open/close to the shared provider. */
  setMenuOpen: (open: boolean) => void;

  /** Three-way visible state (also used by property strips). */
  rowVisible: AggregateState;
  /** Three-way muted state. */
  rowMuted: AggregateState;
  /** Three-way user-toggle locked state. */
  rowLocked: AggregateState;
  /**
   * Three-way document-permission readonly state. Distinct from `rowLocked`
   * — visible to the UI as the same lock affordance, but disables the
   * Lock/Unlock toggle since readonly cannot be cleared from the editor.
   */
  rowReadonly: AggregateState;

  /** Toggle handlers — shared with property strips so the strip and menu
   *  act identically. */
  handleToggleVisible: () => void;
  handleToggleMuted: () => void;
  handleToggleLocked: () => void;

  /** Keyframe lifecycle callbacks — shared with the key strip. */
  handleAddKeyframe: () => void;
  handleRemoveKeyframe: () => void;

  /** Current keyframe-presence state at the playhead, for strip rendering. */
  keyState: "none" | "partial" | "full";
}

/**
 * Shared hook that assembles the control-menu content for any source-row-backed
 * surface — used by track-list rows (`TrackControl`) and the animatable-group
 * control when it has a backing track group. The hook owns:
 *
 *   - Aggregate visible/mute/lock state derived from the row's source data
 *   - Toggle callbacks that apply the three-way convention consistently
 *   - Keyframe navigation + add/remove keypoint callbacks
 *   - Clipboard (cut/copy/paste/delete) and selection (select-all-in-track,
 *     deselect-all) callbacks
 *   - Keybinding map capture for Radix portals, and mutual-exclusion
 *     coordination via `TrackMenuProvider`
 *
 * Returned `menuContent` is pre-wrapped in a `KeybindingProvider` so it can be
 * rendered directly inside a Radix `ContextMenu` content slot or `Dropdown`
 * children without additional boilerplate.
 */
export function useControlMenu({
  sourceRow,
  trackIds,
  isGroup,
  allReadonly,
  color,
}: UseControlMenuParams): UseControlMenuResult {
  // ── Player + store reads ──────────────────────────────────────────────
  // Subscribe to `running` only — it changes infrequently. The current
  // stamp is read inside the event-handler closures via `getState()` to
  // avoid re-rendering every consumer (TrackControl, etc.) at the player
  // tick rate during playback. Without this, every animated track row
  // would re-render 40Hz, cascading into all the radix menu plumbing
  // wrapped around it.
  const playing = usePlayer(useShallow((state) => state.player.running));
  const playerStore = useAnimationStore((state) => state.playerStore);

  const { selectedKeypoints, hasClipboard } = useAnimationStore(
    useShallow((state: AnimationData) => ({
      selectedKeypoints: state.selectionState.keypoints,
      hasClipboard: state.clipboard !== null,
    })),
  );

  const {
    updateControlColor,
    setTracksVisible,
    setTracksMuted,
    setTracksLocked,
    copySelection,
    cutSelection,
    pasteAtStamp,
    deleteSelection,
    selectAllInTracks,
    clearSelection,
    removeKeypoints,
    removeTrack,
    insertKeypointsAtWorldStamp,
  } = useAnimationStore(
    useShallow((state: AnimationActions) => ({
      updateControlColor: state.updateControlColor,
      setTracksVisible: state.setTracksVisible,
      setTracksMuted: state.setTracksMuted,
      setTracksLocked: state.setTracksLocked,
      copySelection: state.copySelection,
      cutSelection: state.cutSelection,
      pasteAtStamp: state.pasteAtStamp,
      deleteSelection: state.deleteSelection,
      selectAllInTracks: state.selectAllInTracks,
      clearSelection: state.clearSelection,
      removeKeypoints: state.removeKeypoints,
      removeTrack: state.removeTrack,
      insertKeypointsAtWorldStamp: state.insertKeypointsAtWorldStamp,
    })),
  );

  const activeAnimationId = useActiveAnimationId();

  // ── Aggregate row state (visible / muted / locked) ────────────────────
  const rowVisible = useMemo<AggregateState>(
    () => computeAggregate(sourceRow.data, (d) => d.visible !== false),
    [sourceRow.data],
  );
  const rowMuted = useMemo<AggregateState>(
    () => computeAggregate(sourceRow.data, (d) => d.muted ?? false),
    [sourceRow.data],
  );
  const rowLocked = useMemo<AggregateState>(
    () => computeAggregate(sourceRow.data, (d) => d.locked === true),
    [sourceRow.data],
  );
  // Document-permission readonly is distinct from user-toggle locked. It
  // produces the same visual lock affordance, but the Lock toggle must be
  // disabled when readonly so the user can't appear to clear an enforced
  // permission lock.
  const rowReadonly = useMemo<AggregateState>(
    () => computeAggregate(sourceRow.data, (d) => d.readonly === true),
    [sourceRow.data],
  );

  // Namespaced source IDs (`namespace/instance/trackId`) for bulk set-* actions.
  const sourceIds = useMemo(
    () => uniq(sourceRow.data.map((d) => `${d.namespaceId}/${d.instanceId}/${d.trackId}`)),
    [sourceRow.data],
  );

  // ── Key control state (keyframe presence + prev/next navigation) ─────
  const { keyState, currentFrame, missingEntries, targetPoints, prevEnabled, nextEnabled, onPrev, onNext } =
    useKeyControlState(sourceRow);

  // ── Toggle callbacks ─────────────────────────────────────────────────
  const handleToggleVisible = useCallback(() => {
    if (sourceIds.length === 0) return;
    setTracksVisible(sourceIds, nextToggleValue(rowVisible));
  }, [sourceIds, rowVisible, setTracksVisible]);

  const handleToggleMuted = useCallback(() => {
    if (sourceIds.length === 0) return;
    setTracksMuted(sourceIds, nextToggleValue(rowMuted));
  }, [sourceIds, rowMuted, setTracksMuted]);

  const handleToggleLocked = useCallback(() => {
    if (sourceIds.length === 0) return;
    // Document-readonly tracks cannot be unlocked via the user toggle.
    // The store action also filters readonly ids defensively, but bailing
    // here keeps the no-op from re-rendering the row unnecessarily.
    if (rowReadonly === true) return;
    setTracksLocked(sourceIds, nextToggleValue(rowLocked));
  }, [sourceIds, rowLocked, rowReadonly, setTracksLocked]);

  const handleChangeColor = useCallback(
    (v: string) => {
      if (trackIds[0]) updateControlColor(trackIds[0], v);
    },
    [trackIds, updateControlColor],
  );

  // ── Keyframe callbacks ───────────────────────────────────────────────
  const handleAddKeyframe = useCallback(() => {
    if (playing || allReadonly) return;
    const stamp = playerStore.getState().player.stamp;
    const targets = keyState === "partial" ? missingEntries : sourceRow.data;
    // Batched so adding keys across a row's tracks is one undoable edit.
    insertKeypointsAtWorldStamp(
      targets.map((datum) => ({ trackId: datum.trackId, instanceId: datum.instanceId })),
      stamp,
    );
  }, [
    playing,
    allReadonly,
    keyState,
    missingEntries,
    sourceRow.data,
    insertKeypointsAtWorldStamp,
    playerStore,
  ]);

  const handleRemoveKeyframe = useCallback(() => {
    if (playing || allReadonly || !currentFrame) return;
    const points = targetPoints.length > 0 ? targetPoints : currentFrame.points;
    removeKeypoints(points.map((p) => ({ trackId: p.trackId, keypointId: p.id })));
  }, [playing, allReadonly, currentFrame, targetPoints, removeKeypoints]);

  const handlePaste = useCallback(() => {
    pasteAtStamp(playerStore.getState().player.stamp);
  }, [pasteAtStamp, playerStore]);

  // Raw trackIds for the "Select All in Track" action — the store's `tracks`
  // record is keyed by `trackId`, not the composite `namespace/instance/trackId`.
  const trackKeysForSelect = useMemo(
    () => uniq(sourceRow.data.map((d) => d.trackId)),
    [sourceRow.data],
  );
  const handleSelectAllInTrack = useCallback(() => {
    selectAllInTracks(trackKeysForSelect);
  }, [selectAllInTracks, trackKeysForSelect]);

  // Group rows back several tracks; remove each. The store action no-ops when
  // the trackId is not a member of `activeAnimationId`, so a row whose tracks
  // belong to a different animation is safe even though we use the active id
  // here. Returned `undefined` when no animation is active so the menu can
  // disable the item rather than silently no-op.
  const handleRemoveTrack = useCallback(() => {
    if (playing || allReadonly || !activeAnimationId) return;
    trackKeysForSelect.forEach((trackId) => {
      removeTrack(trackId, activeAnimationId);
    });
  }, [playing, allReadonly, activeAnimationId, trackKeysForSelect, removeTrack]);

  // ── Shared menu-exclusion + keybinding context ───────────────────────
  // Radix portals escape the React context tree, so we capture the map and
  // re-provide it inside the rendered menu content.
  const keybindingMap = useKeybindingMap();
  const { menuOpen, setMenuOpen } = useTrackMenuState();

  // `muted` on the menu is a strict boolean while `visible`/`locked` are
  // three-way (boolean | "partial"). The menu's visible/locked display uses
  // `=== true` comparisons, so passing the aggregate works; muted uses truthy
  // comparison, so we collapse `"partial"` to `false` here to keep the
  // "Mute/Unmute" label aligned with the action (partial → action is "mute all",
  // so the label should say "Mute", not "Unmute").
  const menuContent = useMemo(
    () => (
      <KeybindingProvider value={keybindingMap}>
        <TrackControlMenuContent
          playing={playing}
          allReadonly={allReadonly}
          trackIds={trackIds}
          isGroup={isGroup}
          sourceRowId={sourceRow.id}
          color={color}
          visible={rowVisible}
          muted={rowMuted === true}
          locked={rowLocked}
          readonly={rowReadonly === true}
          onChangeColor={handleChangeColor}
          onToggleVisible={handleToggleVisible}
          onToggleMuted={handleToggleMuted}
          onToggleLocked={handleToggleLocked}
          onRemoveTrack={activeAnimationId ? handleRemoveTrack : undefined}
          keyState={keyState}
          onAddKeyframe={handleAddKeyframe}
          onRemoveKeyframe={handleRemoveKeyframe}
          prevEnabled={prevEnabled}
          nextEnabled={nextEnabled}
          onPrev={onPrev}
          onNext={onNext}
          hasSelection={selectedKeypoints.size > 0}
          trackKeys={trackKeysForSelect}
          onSelectAllInTrack={handleSelectAllInTrack}
          onDeselectAll={clearSelection}
          hasClipboard={hasClipboard}
          onCut={cutSelection}
          onCopy={copySelection}
          onPaste={handlePaste}
          onDelete={deleteSelection}
        />
      </KeybindingProvider>
    ),
    [
      keybindingMap,
      playing,
      allReadonly,
      trackIds,
      isGroup,
      sourceRow.id,
      color,
      rowVisible,
      rowMuted,
      rowLocked,
      rowReadonly,
      handleChangeColor,
      handleToggleVisible,
      handleToggleMuted,
      handleToggleLocked,
      activeAnimationId,
      handleRemoveTrack,
      keyState,
      handleAddKeyframe,
      handleRemoveKeyframe,
      prevEnabled,
      nextEnabled,
      onPrev,
      onNext,
      selectedKeypoints.size,
      trackKeysForSelect,
      handleSelectAllInTrack,
      clearSelection,
      hasClipboard,
      cutSelection,
      copySelection,
      handlePaste,
      deleteSelection,
    ],
  );

  return {
    menuContent,
    menuOpen,
    setMenuOpen,
    rowVisible,
    rowMuted,
    rowLocked,
    rowReadonly,
    handleToggleVisible,
    handleToggleMuted,
    handleToggleLocked,
    handleAddKeyframe,
    handleRemoveKeyframe,
    keyState,
  };
}
