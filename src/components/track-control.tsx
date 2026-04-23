import { memo, useCallback, useMemo } from "react";
import {
  Button,
  ContextMenu,
  StaticIcon,
  Size,
  Dropdown,
  TextField,
  Tooltip,
  ICON_CLASS_NAME,
  KeybindingProvider,
  useKeybindingMap,
} from "@semio/ui";
import { uniq } from "lodash";
import { clsx } from "clsx";
import { usePlayerStore, PlayerData } from "@semio/utils";
import { IconDotsVertical } from "@tabler/icons-react";
import { useShallow } from "zustand/react/shallow";
import { type SourceRow } from "../types";
import {
  useAnimationStore,
  useColors,
  useKeyControlState,
  useLocalGlobalTransformLookup,
  useNames,
} from "../hooks";
import { useValuesRef } from "../hooks/use-values-ref";
import { DEFAULT_COLOR, GROUP_TYPES } from "../constants";
import { AnimationActions, AnimationData } from "../store-types";
import type { SimpleRawValue } from "../types/data/simple-track";
import { buildTrackKey } from "../utils/track-key";
import { getSemanticLabelForIconCode } from "../functions";
import { KeyStrip } from "./key-strip";
import { AnimatableEditor } from "./animatable-editor";
import { DataIcon } from "./data-icon";
import { ControlRow, GroupToggle, TrackPropertiesStrip } from "./controls";
import { TrackControlMenuContent } from "./canvas-sheet/context-menus";
import { TreeIconColumn } from "./controls/tree-connector";
import { useTrackMenuState } from "./track-menu-context";

export interface TrackControlProps {
  sourceRow: SourceRow;
  ancestorIsLast?: boolean[];
  /** Override the depth from sourceRow (used when rendered inside AnimatableControlList). */
  depthOverride?: number;
  /** Override the control strip mode (e.g., force "keySkip" in the animatable control list). */
  controlStripOverride?: "keySkip" | "properties";
}

function InnerTrackControl({ sourceRow, depthOverride, controlStripOverride }: TrackControlProps) {
  const trackIds = uniq(sourceRow.data.map((d) => d.trackId));
  const allReadonly = sourceRow.data.every((d) => !d.editable);
  const isGroup = sourceRow.data.length !== 1 || GROUP_TYPES.has(sourceRow.data[0].type);

  // Read visible/locked from source row data (derived from globalSourceTree).
  // For groups, data entries are copies of children — compute aggregate state.
  const allVisible = sourceRow.data.every((d) => d.visible !== false);
  const noneVisible = sourceRow.data.every((d) => d.visible === false);
  const rowVisible: boolean | "partial" = allVisible ? true : noneVisible ? false : "partial";

  const allLocked = sourceRow.data.every((d) => d.locked === true);
  const noneLocked = sourceRow.data.every((d) => d.locked !== true);
  const rowLocked: boolean | "partial" = allLocked ? true : noneLocked ? false : "partial";

  const playing = usePlayerStore(useShallow((state: PlayerData) => state.player.running));
  const playerStamp = usePlayerStore(useShallow((state: PlayerData) => state.player.stamp));

  // --- Consolidated store data ---
  const {
    storeControlStripMode,
    animatables,
    selectionInstanceId,
    selectedKeypoints,
    emphasisRowId,
    hasClipboard,
  } = useAnimationStore(
    useShallow((state: AnimationData) => ({
      storeControlStripMode: state.preferences.controlStripMode,
      animatables: state.animatables,
      selectionInstanceId: state.selectionState.instanceId,
      selectedKeypoints: state.selectionState.keypoints,
      emphasisRowId: state.emphasisRowId,
      hasClipboard: state.clipboard !== null,
    })),
  );
  const controlStripMode = controlStripOverride ?? storeControlStripMode;
  const emphasis = emphasisRowId === sourceRow.id;

  // --- Consolidated store actions ---
  const {
    updateControlColor,
    setTracksMuted,
    setTracksVisible,
    setTracksLocked,
    focusSelectionInstance,
    setEmphasis,
    selectTrack,
    toggleTrackInSelection,
    rangeSelectTracks,
    updateKeypoints,
    removeKeypoints,
    updateSource,
    updateTrack,
    updateTrackGroupName,
    insertKeypointAtWorldStamp,
    copySelection,
    cutSelection,
    pasteAtStamp,
    deleteSelection,
    selectAllInTracks,
    clearSelection,
  } = useAnimationStore(
    useShallow((state: AnimationActions) => ({
      updateControlColor: state.updateControlColor,
      setTracksMuted: state.setTracksMuted,
      setTracksVisible: state.setTracksVisible,
      setTracksLocked: state.setTracksLocked,
      focusSelectionInstance: state.focusSelectionInstance,
      setEmphasis: state.setEmphasis,
      selectTrack: state.selectTrack,
      toggleTrackInSelection: state.toggleTrackInSelection,
      rangeSelectTracks: state.rangeSelectTracks,
      updateKeypoints: state.updateKeypoints,
      removeKeypoints: state.removeKeypoints,
      updateSource: state.updateSource,
      updateTrack: state.updateTrack,
      updateTrackGroupName: state.updateTrackGroupName,
      insertKeypointAtWorldStamp: state.insertKeypointAtWorldStamp,
      copySelection: state.copySelection,
      cutSelection: state.cutSelection,
      pasteAtStamp: state.pasteAtStamp,
      deleteSelection: state.deleteSelection,
      selectAllInTracks: state.selectAllInTracks,
      clearSelection: state.clearSelection,
    })),
  );

  // --- Per-row selection state ---
  // Track is "selected" if any of its trackIds exist as keys in the keypoints Map.
  // hasSelectedKeys further distinguishes whether specific keypoints are also selected.
  const isTrackInSelection = useMemo(
    () => trackIds.some((id) => selectedKeypoints.has(id)),
    [trackIds, selectedKeypoints],
  );
  const hasSelectedKeys = useMemo(
    () => trackIds.some((id) => (selectedKeypoints.get(id)?.size ?? 0) > 0),
    [trackIds, selectedKeypoints],
  );

  const valuesRef = useValuesRef();
  const trackMuted = useMemo(() => {
    if (trackIds.length !== 1) return false;
    const [entry] = sourceRow.data;
    return entry?.muted ?? false;
  }, [sourceRow.data, trackIds.length]);
  const rowMuted: boolean | "partial" = useMemo(() => {
    if (sourceRow.data.length === 0) return false;
    const allMuted = sourceRow.data.every((entry) => entry.muted ?? false);
    const noneMuted = sourceRow.data.every((entry) => !(entry.muted ?? false));
    return allMuted ? true : noneMuted ? false : "partial";
  }, [sourceRow.data]);

  const localGlobalTransformLookup = useLocalGlobalTransformLookup();

  // Compute unique instance for this row (must be exactly one)
  const uniqueInstanceId = useMemo(() => {
    const ids = uniq(
      sourceRow.data.map((d) => d.instanceId).filter((v): v is string => Boolean(v)),
    );
    return ids.length === 1 ? ids[0] : undefined;
  }, [sourceRow.data]);

  const {
    keyState,
    currentFrame,
    missingEntries,
    targetPoints,
    prevEnabled,
    nextEnabled,
    onPrev,
    onNext,
  } = useKeyControlState(sourceRow);

  // Row is active if it has no unique instance mapping OR it matches the selected instance
  const isActive = useMemo(
    () => !uniqueInstanceId || selectionInstanceId === uniqueInstanceId,
    [uniqueInstanceId, selectionInstanceId],
  );

  const handleActivate = useCallback(() => {
    if (uniqueInstanceId) {
      focusSelectionInstance(uniqueInstanceId);
    }
  }, [focusSelectionInstance, uniqueInstanceId]);

  const updateExpanded = useCallback(
    (expanded: boolean) => {
      updateSource(sourceRow.id, expanded);
    },
    [updateSource, sourceRow.id],
  );

  const trueColor = useColors(trackIds);
  const color = isActive && !rowMuted ? trueColor : DEFAULT_COLOR;
  const resolvedName = useNames(trackIds);
  const groupName = sourceRow.name ?? resolvedName;
  const name = isGroup ? groupName : resolvedName;

  // Build track keys for "Select All in Track"
  // Raw track IDs for store actions like selectAllInTracks (store.tracks is keyed by trackId)
  const trackKeys = useMemo(() => uniq(sourceRow.data.map((d) => d.trackId)), [sourceRow.data]);

  // Toggle helpers using namespaced source IDs
  const sourceIds = useMemo(
    () => uniq(sourceRow.data.map((d) => `${d.namespaceId}/${d.instanceId}/${d.trackId}`)),
    [sourceRow.data],
  );

  const handleToggleVisible = useCallback(() => {
    if (sourceIds.length === 0) return;
    const next = rowVisible === "partial" ? true : rowVisible === true ? false : true;
    setTracksVisible(sourceIds, next);
  }, [sourceIds, rowVisible, setTracksVisible]);

  const handleToggleMuted = useCallback(() => {
    if (sourceIds.length === 0) return;
    const next = rowMuted === "partial" ? true : !rowMuted;
    setTracksMuted(sourceIds, next);
  }, [sourceIds, rowMuted, setTracksMuted]);

  const handleToggleLocked = useCallback(() => {
    if (sourceIds.length === 0) return;
    const next = rowLocked === "partial" ? true : rowLocked === true ? false : true;
    setTracksLocked(sourceIds, next);
  }, [sourceIds, rowLocked, setTracksLocked]);

  const handleAddKeyframe = useCallback(() => {
    if (playing) return;
    const targets = keyState === "partial" ? missingEntries : sourceRow.data;
    targets.forEach((datum) => {
      insertKeypointAtWorldStamp(datum.trackId, playerStamp, datum.instanceId);
    });
  }, [playing, keyState, missingEntries, sourceRow.data, insertKeypointAtWorldStamp, playerStamp]);

  const handleRemoveKeyframe = useCallback(() => {
    if (playing || !currentFrame) return;
    const points = targetPoints.length > 0 ? targetPoints : currentFrame.points;
    const removals = points.map((p) => ({ trackId: p.trackId, keypointId: p.id }));
    removeKeypoints(removals);
  }, [playing, currentFrame, targetPoints, removeKeypoints]);

  const handlePaste = useCallback(() => {
    pasteAtStamp(playerStamp);
  }, [pasteAtStamp, playerStamp]);

  // Capture keybinding map so it can be re-provided inside Radix portals
  // (which escape the React context tree).
  const keybindingMap = useKeybindingMap();

  const menuContent = useMemo(
    () => (
      <TrackControlMenuContent
        playing={playing}
        allReadonly={allReadonly}
        trackIds={trackIds}
        isGroup={isGroup}
        sourceRowId={sourceRow.id}
        color={trueColor}
        visible={rowVisible}
        muted={trackMuted}
        locked={rowLocked}
        onChangeColor={(v) => {
          if (trackIds[0]) updateControlColor(trackIds[0], v);
        }}
        onToggleVisible={handleToggleVisible}
        onToggleMuted={handleToggleMuted}
        onToggleLocked={handleToggleLocked}
        keyState={keyState}
        onAddKeyframe={handleAddKeyframe}
        onRemoveKeyframe={handleRemoveKeyframe}
        prevEnabled={prevEnabled}
        nextEnabled={nextEnabled}
        onPrev={onPrev}
        onNext={onNext}
        hasSelection={selectedKeypoints.size > 0}
        trackKeys={trackKeys}
        onSelectAllInTrack={() => selectAllInTracks(trackKeys)}
        onDeselectAll={clearSelection}
        hasClipboard={hasClipboard}
        onCut={cutSelection}
        onCopy={copySelection}
        onPaste={handlePaste}
        onDelete={deleteSelection}
      />
    ),
    [
      playing,
      allReadonly,
      trackIds,
      isGroup,
      sourceRow.id,
      trueColor,
      rowVisible,
      trackMuted,
      rowLocked,
      updateControlColor,
      handleToggleVisible,
      handleToggleMuted,
      handleToggleLocked,
      keyState,
      handleAddKeyframe,
      handleRemoveKeyframe,
      prevEnabled,
      nextEnabled,
      onPrev,
      onNext,
      selectedKeypoints,
      trackKeys,
      selectAllInTracks,
      clearSelection,
      hasClipboard,
      cutSelection,
      copySelection,
      handlePaste,
      deleteSelection,
    ],
  );

  const iconCode = isGroup ? "group" : (sourceRow.data[0].iconCode ?? "none");

  // Full-row background: keys-selected (25%) > track-selected (20%) > hover (15%) > none
  // Inactive rows use DEFAULT_COLOR; active rows use their track color.
  const rowBackground = useMemo(() => {
    const bgColor = isActive ? trueColor : DEFAULT_COLOR;
    if (hasSelectedKeys) return `${bgColor}40`;
    if (isTrackInSelection) return `${bgColor}33`;
    if (emphasis) return `${bgColor}26`;
    return `${bgColor}00`;
  }, [isActive, hasSelectedKeys, emphasis, trueColor, isTrackInSelection]);

  // Reference row ID for shift+click range selection
  const referenceRowId = useAnimationStore(
    (state: AnimationData) => state.selectionState.reference?.rowId ?? null,
  );

  // Shared across all track controls: disable menu triggers while any menu is open.
  const { menuOpen, setMenuOpen } = useTrackMenuState();

  return (
    <ContextMenu
      content={<KeybindingProvider value={keybindingMap}>{menuContent}</KeybindingProvider>}
      disabled={menuOpen}
      onOpenChange={setMenuOpen}
    >
      <div
        className="relative w-full"
        onMouseEnter={() => setEmphasis(sourceRow.id)}
        onMouseLeave={() => setEmphasis(null)}
        onPointerDown={(e) => {
          // Any interaction with an inactive row switches the active instance
          // as a side effect — without blocking the interaction itself.
          if (!isActive && uniqueInstanceId) {
            handleActivate();
          }
          // Track selection: plain click selects, Ctrl/Cmd toggles, Shift range-selects.
          // Only on active instance rows — skip if this click also activates.
          if (isActive) {
            if (e.ctrlKey || e.metaKey) {
              toggleTrackInSelection(sourceRow.id, trackIds);
            } else if (e.shiftKey && referenceRowId) {
              rangeSelectTracks(referenceRowId, sourceRow.id);
            } else {
              selectTrack(sourceRow.id, trackIds);
            }
          }
        }}
      >
        {/* Full-row track-colored background tint — always rendered for CSS transition */}
        <div
          className="pointer-events-none absolute inset-0 -right-2 transition-colors duration-150 ease-out"
          style={{ backgroundColor: rowBackground }}
        />
        <ControlRow
          className={clsx(rowMuted && isActive && "opacity-60", "pr-0.5")}
          isGroup={isGroup}
          target={
            isTrackInSelection ? (
              <div
                className="h-full w-full transition-colors duration-150 ease-out"
                style={{ backgroundColor: trueColor }}
              />
            ) : undefined
          }
          treeIcon={
            <TreeIconColumn
              depth={depthOverride ?? sourceRow.depth ?? 0}
              icon={
                isGroup ? (
                  <Tooltip content={sourceRow.expanded ? "Collapse Group" : "Expand Group"} invert>
                    <GroupToggle
                      expanded={sourceRow.expanded}
                      onToggle={updateExpanded}
                      disabled={false}
                      color={color}
                    />
                  </Tooltip>
                ) : (
                  <Tooltip content={getSemanticLabelForIconCode(iconCode)} invert>
                    <div>
                      <StaticIcon size={Size.Md} color={color}>
                        <DataIcon iconCode={iconCode} className={ICON_CLASS_NAME} />
                      </StaticIcon>
                    </div>
                  </Tooltip>
                )
              }
            />
          }
          label={
            <TextField
              size={Size.Sm}
              color={color}
              value={name}
              readOnly={playing}
              outline="hidden"
              onChange={(val) => {
                if (playing) return;
                if (!val) return;
                if (isGroup) {
                  updateSource(sourceRow.id, sourceRow.expanded, undefined);
                  updateTrackGroupName(trackIds, val);
                } else {
                  updateTrack({ id: sourceRow.data[0]?.trackId, name: val });
                }
              }}
            />
          }
          editor={
            !isGroup ? (
              <AnimatableEditor
                hideLabel
                rowId={sourceRow.id}
                data={sourceRow.data[0]}
                active={isActive}
                colorOverride={color}
                playing={playing}
                emphasis={emphasis}
                handleValueChange={(change) => {
                  const datumAnimatablePairs = sourceRow.data.map((datum) => ({
                    datum,
                    animatableId: datum.animatableId,
                  }));
                  const updates = datumAnimatablePairs
                    .map(({ datum, animatableId }) => {
                      const toLocal = localGlobalTransformLookup.toLocal[datum.instanceId];
                      const localStamp =
                        typeof toLocal === "function" ? toLocal(playerStamp) : playerStamp;
                      const valueKey = buildTrackKey(
                        datum.namespaceId,
                        datum.instanceId,
                        datum.trackId,
                      );
                      const value = valuesRef.current.get(valueKey) as SimpleRawValue | undefined;
                      const defaultValue = animatables[animatableId]?.default as
                        | SimpleRawValue
                        | undefined;
                      if (typeof change === "function") {
                        const resolvedValue = value ?? defaultValue;
                        if (resolvedValue === undefined) {
                          return null;
                        }
                        const newValue = change(resolvedValue) as SimpleRawValue;
                        if (newValue === undefined) {
                          return null;
                        }
                        return {
                          trackId: datum.trackId,
                          keypoint: {
                            value: newValue,
                            stamp: localStamp,
                          },
                        };
                      } else {
                        return {
                          trackId: datum.trackId,
                          keypoint: {
                            value: change as SimpleRawValue,
                            stamp: localStamp,
                          },
                        };
                      }
                    })
                    .filter(
                      (
                        u,
                      ): u is {
                        trackId: string;
                        keypoint: { value: SimpleRawValue; stamp: number };
                      } => {
                        if (!u) return false;
                        return u.keypoint.value !== undefined;
                      },
                    );
                  updateKeypoints(updates, true);
                }}
              />
            ) : undefined
          }
          controls={
            controlStripMode === "properties" ? (
              <TrackPropertiesStrip
                color={color}
                disabled={playing}
                isGroup={isGroup}
                visible={rowVisible}
                muted={rowMuted}
                locked={rowLocked}
                onToggleVisible={handleToggleVisible}
                onToggleMuted={handleToggleMuted}
                onToggleLocked={handleToggleLocked}
              />
            ) : (
              <KeyStrip
                disabled={allReadonly || playing}
                source={sourceRow}
                color={color}
                onHexClick={() => {
                  if (keyState === "full") {
                    handleRemoveKeyframe();
                  } else {
                    handleAddKeyframe();
                  }
                }}
              />
            )
          }
          options={
            <Dropdown
              disabled={playing || menuOpen}
              onOpenChange={setMenuOpen}
              side="right"
              trigger={
                <Button
                  size={Size.Xs}
                  className="flex items-center justify-center"
                  visuals="inverted"
                  leftIcon={<IconDotsVertical className={ICON_CLASS_NAME} />}
                />
              }
            >
              <KeybindingProvider value={keybindingMap}>{menuContent}</KeybindingProvider>
            </Dropdown>
          }
        />
      </div>
    </ContextMenu>
  );
}

export const TrackControl = memo(InnerTrackControl);
