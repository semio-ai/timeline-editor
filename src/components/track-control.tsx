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
  useControlMenu,
  useLocalGlobalTransformLookup,
  useNames,
  useRowBackground,
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
import { TreeIconColumn } from "./controls/tree-connector";

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

  const playing = usePlayerStore(useShallow((state: PlayerData) => state.player.running));
  const playerStamp = usePlayerStore(useShallow((state: PlayerData) => state.player.stamp));

  // Row-level store reads that the control itself (vs the menu) needs for
  // rendering, selection background, and active-instance focus.
  const {
    storeControlStripMode,
    animatables,
    selectionInstanceId,
    selectedKeypoints,
    emphasisRowId,
  } = useAnimationStore(
    useShallow((state: AnimationData) => ({
      storeControlStripMode: state.preferences.controlStripMode,
      animatables: state.animatables,
      selectionInstanceId: state.selectionState.instanceId,
      selectedKeypoints: state.selectionState.keypoints,
      emphasisRowId: state.emphasisRowId,
    })),
  );
  const controlStripMode = controlStripOverride ?? storeControlStripMode;
  const emphasis = emphasisRowId === sourceRow.id;

  // Store actions used outside the menu (selection, navigation, metadata edits).
  const {
    focusSelectionInstance,
    setEmphasis,
    selectTrack,
    toggleTrackInSelection,
    rangeSelectTracks,
    updateKeypoints,
    updateSource,
    updateTrack,
    updateTrackGroupName,
  } = useAnimationStore(
    useShallow((state: AnimationActions) => ({
      focusSelectionInstance: state.focusSelectionInstance,
      setEmphasis: state.setEmphasis,
      selectTrack: state.selectTrack,
      toggleTrackInSelection: state.toggleTrackInSelection,
      rangeSelectTracks: state.rangeSelectTracks,
      updateKeypoints: state.updateKeypoints,
      updateSource: state.updateSource,
      updateTrack: state.updateTrack,
      updateTrackGroupName: state.updateTrackGroupName,
    })),
  );

  // Drives the left-edge color bar on the row when the track is part of
  // any selection (distinct from the per-key background tint).
  const isTrackInSelection = useMemo(
    () => trackIds.some((id) => selectedKeypoints.has(id)),
    [trackIds, selectedKeypoints],
  );

  const valuesRef = useValuesRef();
  const localGlobalTransformLookup = useLocalGlobalTransformLookup();

  // Compute unique instance for this row (must be exactly one)
  const uniqueInstanceId = useMemo(() => {
    const ids = uniq(
      sourceRow.data.map((d) => d.instanceId).filter((v): v is string => Boolean(v)),
    );
    return ids.length === 1 ? ids[0] : undefined;
  }, [sourceRow.data]);

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
  const resolvedName = useNames(trackIds);
  const groupName = sourceRow.name ?? resolvedName;
  const name = isGroup ? groupName : resolvedName;

  // Shared aggregate state, callbacks, and menu assembly.
  const {
    menuContent,
    menuOpen,
    setMenuOpen,
    rowVisible,
    rowMuted,
    rowLocked,
    handleToggleVisible,
    handleToggleMuted,
    handleToggleLocked,
    handleAddKeyframe,
    handleRemoveKeyframe,
    keyState,
  } = useControlMenu({
    sourceRow,
    trackIds,
    isGroup,
    allReadonly,
    color: trueColor,
  });

  const color = isActive && !rowMuted ? trueColor : DEFAULT_COLOR;

  const iconCode = isGroup ? "group" : (sourceRow.data[0].iconCode ?? "none");

  const rowBackground = useRowBackground({ sourceRow, emphasis });

  // Reference row ID for shift+click range selection
  const referenceRowId = useAnimationStore(
    (state: AnimationData) => state.selectionState.reference?.rowId ?? null,
  );

  return (
    <ContextMenu
      content={menuContent}
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
              {menuContent}
            </Dropdown>
          }
        />
      </div>
    </ContextMenu>
  );
}

export const TrackControl = memo(InnerTrackControl);
