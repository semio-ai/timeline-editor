import { memo, useCallback, useMemo } from "react";
import {
  Button,
  ContextMenu,
  StaticIcon,
  Size,
  Dropdown,
  TextField,
  Tooltip,
} from "@semio/ui";
import { uniq } from "lodash";
import { clsx } from "clsx";
import { usePlayerStore, PlayerData } from "@semio/utils";
import { useShallow } from "zustand/react/shallow";
import { type SourceRow } from "../types";
import {
  useAnimationStore,
  useColors,
  useControlMenu,
  useEditableLabel,
  useLocalGlobalTransformLookup,
  useNames,
  useRowBackground,
  useRowEditState,
} from "../hooks";
import { useValuesRef } from "../hooks/use-values-ref";
import { DEFAULT_COLOR, GROUP_TYPES } from "../constants";
import { AnimationActions, AnimationData, ControlStripMode } from "../store-types";
import type { SimpleRawValue } from "../types/data/simple-track";
import { buildTrackKey } from "../utils/track-key";
import { getSemanticLabelForIconCode, resolveSourceRef } from "../functions";
import { KeyStrip } from "./key-strip";
import { AnimatableEditor } from "./animatable-editor";
import { DataIcon } from "./data-icon";
import {
  ControlRow,
  GroupToggle,
  TrackPropertiesStrip,
  type TrackPropertiesStripProps,
} from "./controls";
import { TreeIconColumn } from "./controls/tree-connector";

export interface TrackControlProps {
  propertyControls?: TrackPropertiesStripProps;
  sourceRow: SourceRow;
  ancestorIsLast?: boolean[];
  /** Override the depth from sourceRow (used when rendered inside AnimatableControlList). */
  depthOverride?: number;
  /** Override the control strip mode (e.g., force KeySkip in the animatable control list). */
  controlStripOverride?: ControlStripMode;
}

function InnerTrackControl({
  sourceRow,
  depthOverride,
  controlStripOverride,
  propertyControls,
}: TrackControlProps) {
  const trackIds = uniq(sourceRow.data.map((d) => d.trackId));
  const allReadonly = sourceRow.data.every((d) => !d.editable);
  const isGroup = sourceRow.data.length !== 1 || GROUP_TYPES.has(sourceRow.data[0].type);

  const playing = usePlayerStore(useShallow((state: PlayerData) => state.player.running));

  // Row-level store reads that the control itself (vs the menu) needs for
  // rendering, selection background, and active-instance focus.
  const {
    storeControlStripMode,
    animatables,
    emphasisRowId,
  } = useAnimationStore(
    useShallow((state: AnimationData) => ({
      storeControlStripMode: state.preferences.controlStripMode,
      animatables: state.animatables,
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
    editSource,
    canEditSource,
  } = useAnimationStore(
    useShallow((state: AnimationActions) => ({
      focusSelectionInstance: state.focusSelectionInstance,
      setEmphasis: state.setEmphasis,
      selectTrack: state.selectTrack,
      toggleTrackInSelection: state.toggleTrackInSelection,
      rangeSelectTracks: state.rangeSelectTracks,
      updateKeypoints: state.updateKeypoints,
      updateSource: state.updateSource,
      editSource: state.editSource,
      canEditSource: state.canEditSource,
    })),
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

  // Single source of truth for "is this row active / selected / editable".
  // Same predicates feed the canvas layerBand (update-instanced-track-sources)
  // and the row tint (use-row-background) — keeps every visual surface in
  // lockstep. See `functions/row-edit-state.ts` for the contract.
  const predicates = useRowEditState(sourceRow);
  // Active driver for the row's owning entity → row icon shows in color
  // (covers focused entity's active AND other entities' active animations,
  // which renders in the locked layer). Rows without a unique instance
  // (mixed aggregates) are treated as active so they aren't grayed out.
  const isActive = !uniqueInstanceId || predicates.isActiveDriverForOwningEntity;
  // "Is the row's instance currently the editable one" — focused entity AND
  // active driver. Used to gate the click-to-activate handler so a click on
  // a row that ISN'T the editable one (different entity OR different
  // instance) switches focus / activates that instance.
  const isFocusedEntityActive =
    predicates.isFocusedEntity && predicates.isActiveDriverForOwningEntity;
  // Left-edge selection bar: row has at least one selected track within
  // the current selection scope. The shared helper handles the scope gate.
  const isTrackInSelection = predicates.isInSelection;

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

  // The row name derives from an upstream source (entity / animatable / track /
  // local group label). `canEditSource` reports whether anything actually
  // handles a rename for this source — so we can disable the field for kinds
  // nothing supports yet (e.g. animation-instance rename, pending the
  // asset-save migration) rather than accept a no-op edit.
  const sourceRef = useMemo(() => resolveSourceRef(sourceRow), [sourceRow]);
  const canRename = sourceRef ? canEditSource(sourceRef) : false;

  // The displayed name is derived: group rows write `track.groupName` but
  // render `sourceRow.name`, which the view-filtered source-rows subscription
  // regenerates one render after the write. A draft-while-focused field
  // (commit on blur / Enter) decouples typing from that round-trip so
  // keystrokes aren't dropped. See useEditableLabel for the full rationale.
  const handleNameCommit = useCallback(
    (val: string) => {
      if (playing || !sourceRef) return;
      // Route through the source-edit channel: editing a row's name mutates
      // whatever it derives from and lets the derived value re-propagate,
      // rather than writing a derived override. Studio overrides editSource to
      // reach entity/asset source records; the animation default handles
      // tracks/animatables/labels.
      editSource(sourceRef, { name: val });
    },
    [playing, editSource, sourceRef],
  );
  const nameField = useEditableLabel(name, handleNameCommit);

  // Shared aggregate state, callbacks, and menu assembly.
  const {
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
  } = useControlMenu({
    sourceRow,
    propertyControls,
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
          // Any interaction with a row that ISN'T currently the editable
          // one switches focus / activates that instance as a side effect.
          // Covers: clicking a non-active instance of the focused entity,
          // AND clicking any row of a non-focused entity. focusSelectionInstance
          // is idempotent when the click would land on the already-editable row.
          if (!isFocusedEntityActive && uniqueInstanceId) {
            handleActivate();
          }
          // Track selection: plain click selects, Ctrl/Cmd toggles, Shift range-selects.
          // Only fires when the row is already the focused entity's active
          // instance — otherwise the click above is purely a focus/activate
          // gesture and selection is intentionally cleared by focusSelectionInstance.
          if (isFocusedEntityActive) {
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
          className="pointer-events-none absolute inset-0 transition-colors duration-150 ease-out"
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
                        <DataIcon iconCode={iconCode} />
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
              value={nameField.value}
              // Read-only during playback, and when nothing handles a rename for
              // this row's source (e.g. animation-instance rename is unsupported
              // until the asset-save migration) — avoids an editable no-op field.
              readOnly={playing || !canRename}
              outline="hidden"
              onChange={(val) => nameField.onChange(val)}
              onBlur={nameField.onBlur}
              onKeyDown={nameField.onKeyDown}
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
                  // Read stamp at handler-fire time so this row doesn't have
                  // to re-render every 25ms playback tick just to keep the
                  // closure's stamp fresh.
                  const playerStamp = usePlayerStore.getState().player.stamp;
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
            controlStripMode === ControlStripMode.Properties ? (
              <TrackPropertiesStrip
                color={color}
                disabled={playing}
                isGroup={isGroup}
                visible={rowVisible}
                muted={rowMuted}
                locked={rowLocked}
                readonly={rowReadonly === true}
                onToggleVisible={handleToggleVisible}
                onToggleMuted={handleToggleMuted}
                onToggleLocked={handleToggleLocked}
                {...propertyControls}
              />
            ) : (
              <KeyStrip
                // `disabled` blanks the whole strip during playback;
                // `authoringDisabled` only blanks the center hex when the
                // row is non-editable (readonly or user-locked) so prev/
                // next navigation remains usable for inspection.
                disabled={playing}
                authoringDisabled={allReadonly}
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
                  leftIcon="menu"
                  data-testid="track-row-options"
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
