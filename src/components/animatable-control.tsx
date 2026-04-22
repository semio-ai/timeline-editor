import { memo, useCallback, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { uniq } from "lodash";
import { IconDotsVertical } from "@tabler/icons-react";
import {
  StaticIcon,
  Size,
  SliderNumberField,
  TextField,
  ToggleSquare,
  Dropdown,
  ContextMenu,
  Variant,
  Button,
  Tooltip,
  ICON_CLASS_NAME,
  KeybindingProvider,
  useKeybindingMap,
} from "@semio/ui";
import type { AnimatableValue, RawValue } from "@semio/utils";
import { toDegrees, toRadians, usePlayerStore, useValuesStore } from "@semio/utils";
import { useAnimationStore, useColors, useKeyControlState } from "../hooks";
import { AnimationActions, AnimationData } from "../store-types";
import { SourceRow, SourceRowData } from "../types";
import { buildTrackKey } from "../utils/track-key";
import { getIconCode, getSemanticLabelForIconCode } from "../functions/get-icon-code";
import { COMPLEX_TYPES, DEFAULT_COLOR } from "../constants";
import { TrackControl } from "./track-control";
import { DataIcon } from "./data-icon";
import { ControlRow, ControlStrip, GroupToggle, TrackPropertiesStrip } from "./controls";
import { TreeIconColumn } from "./controls/tree-connector";
import { KeyStrip } from "./key-strip";
import {
  AnimatableLeafMenuContent,
  AnimatableGroupMenuContent,
  TrackControlMenuContent,
} from "./canvas-sheet/context-menus";
import { useTrackMenuState } from "./track-menu-context";

export type AnimatableControlMode = "track" | "track-missing" | "direct";

export interface AnimatableControlBaseProps {
  disabled?: boolean;
}

export interface AnimatableLeafControlProps extends AnimatableControlBaseProps {
  kind?: "animatable";
  animatableId: string;
  /**
   * Optional row id to reuse existing track-row behavior (prev/next/key).
   * When provided and resolvable, this component delegates to TrackControl.
   */
  sourceRowId?: string;
  /**
   * Explicit mode override. Defaults to "track" when sourceRowId is provided, otherwise "direct".
   */
  mode?: AnimatableControlMode;
  /**
   * Optional lookup key used to resolve the latest value from the animation store.
   * If omitted, the animatable default is used.
   */
  valueLookupKey?: string;
  /**
   * Callback for direct/track-missing value edits.
   */
  onValueChange?: (value: RawValue | ((current: RawValue) => RawValue)) => void;
  /**
   * Callback for adding a track when in track-missing mode.
   */
  onAddTrack?: () => void;
  /**
   * Optional override for the label shown in the value editor.
   */
  label?: string;
  /**
   * Callback to rename the animatable (used for direct/track-missing modes).
   */
  onRename?: (name: string) => void;
  /** Tree nesting depth for indentation (0 = top-level). */
  depth?: number;
}

export interface AnimatableGroupControlProps extends AnimatableControlBaseProps {
  kind: "group";
  groupId: string;
  label?: string;
  childAnimatableIds?: string[];
  expanded?: boolean;
  onToggle?: (expanded: boolean) => void;
  onRename?: (name: string) => void;
  onAddTrack?: () => void;
  addable?: boolean;
  /**
   * Optional row id to enable key strip interactions when a matching group row exists.
   */
  sourceRowId?: string;
  /** Tree nesting depth for indentation (0 = top-level). */
  depth?: number;
}

export type AnimatableControlProps = AnimatableLeafControlProps | AnimatableGroupControlProps;

function AnimatableLeafControl({
  animatableId,
  sourceRowId,
  mode,
  valueLookupKey,
  onValueChange,
  onAddTrack,
  label,
  onRename,
  disabled = false,
  depth = 0,
}: AnimatableLeafControlProps) {
  const resolvedMode: AnimatableControlMode = mode ?? (sourceRowId ? "track" : "direct");
  const running = usePlayerStore(useShallow((state) => state.player.running));

  const sourceRow = useAnimationStore(
    useShallow((state) => (sourceRowId ? state.instancedTrackSources[sourceRowId] : undefined)),
  );
  const updateAnimatable = useAnimationStore(useShallow((state) => state.updateAnimatable));
  const { namespaces, animations, tracks, selectionInstanceId, createTrack } = useAnimationStore(
    useShallow((state) => ({
      namespaces: state.namespaces,
      animations: state.animations,
      tracks: state.tracks,
      selectionInstanceId: state.selectionState.instanceId,
      createTrack: state.createTrack,
    })),
  );

  const animatable = useAnimationStore(useShallow((state) => state.animatables[animatableId]));

  const storedValue = useValuesStore(
    useCallback(
      (state) => (valueLookupKey ? state.values.get(valueLookupKey) : undefined),
      [valueLookupKey],
    ),
  );

  const rawValue = useMemo(() => {
    if (!animatable) return undefined;
    return storedValue ?? animatable.default;
  }, [animatable, storedValue]);

  const activeAnimationId = useMemo(() => {
    if (!selectionInstanceId) return undefined;
    for (const namespace of Object.values(namespaces)) {
      const instance = namespace.animationInstances[selectionInstanceId];
      if (instance) return instance.animationId;
    }
    return undefined;
  }, [namespaces, selectionInstanceId]);

  const hasTrackInActiveAnimation = useMemo(() => {
    if (!activeAnimationId) return false;
    const animation = animations[activeAnimationId];
    if (!animation) return false;
    return animation.tracks.some((trackId) => tracks[trackId]?.animatableId === animatableId);
  }, [activeAnimationId, animations, tracks, animatableId]);

  const canAutoCreateTrack =
    Boolean(activeAnimationId) &&
    Boolean(animatable) &&
    !COMPLEX_TYPES.has(animatable?.type ?? "number") &&
    !hasTrackInActiveAnimation;

  const handleAddTrack = useCallback(() => {
    if (!canAutoCreateTrack || !activeAnimationId || !animatable) return;
    createTrack({}, animatableId, activeAnimationId);
  }, [activeAnimationId, animatable, animatableId, canAutoCreateTrack, createTrack]);

  const color = useColors(animatableId);
  const resolvedColor = disabled || running ? DEFAULT_COLOR : color;
  const iconCode = animatable ? getIconCode(animatable.type, animatable.pub?.units) : "none";

  const handleValueChange = useCallback(
    (value: RawValue | ((current: RawValue) => RawValue)) => {
      if (disabled || running) return;
      onValueChange?.(value);
    },
    [disabled, onValueChange, running],
  );

  const displayLabel = useMemo(() => {
    if (label) return label;
    const axis = animatable?.group?.axis;
    if (axis) return axis;
    return animatable?.name ?? "";
  }, [animatable?.group?.axis, animatable?.name, label]);

  const editorDisabled = disabled || running;
  const addTrackAction = useMemo(() => {
    if (editorDisabled || resolvedMode !== "track-missing") return undefined;
    return onAddTrack ?? (canAutoCreateTrack ? handleAddTrack : undefined);
  }, [editorDisabled, resolvedMode, onAddTrack, canAutoCreateTrack, handleAddTrack]);

  const handleChangeColor = useCallback(
    (v: string) => {
      if (!animatable) return;
      updateAnimatable(animatableId, {
        pub: {
          ...(animatable.pub ?? { public: true, output: "none" }),
          color: v,
        },
      });
    },
    [animatable, animatableId, updateAnimatable],
  );

  const leafMenuContent = useMemo(
    () => (
      <AnimatableLeafMenuContent
        color={color}
        disabled={editorDisabled}
        onChangeColor={handleChangeColor}
        onAddTrack={addTrackAction}
      />
    ),
    [color, editorDisabled, handleChangeColor, addTrackAction],
  );

  const { menuOpen, setMenuOpen } = useTrackMenuState();
  const [hovered, setHovered] = useState(false);

  if (!animatable) {
    return <div className="h-9 w-full animate-pulse rounded bg-neutral-700/30" />;
  }

  if (sourceRow && resolvedMode === "track") {
    return (
      <TrackControl
        sourceRow={sourceRow}
        depthOverride={depth}
        controlStripOverride="keySkip"
      />
    );
  }

  return (
    <ContextMenu
      content={leafMenuContent}
      disabled={menuOpen}
      onOpenChange={setMenuOpen}
    >
    <div
      className="relative w-full"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
    <div
      className="pointer-events-none absolute inset-0 -right-2 transition-colors duration-150 ease-out"
      style={{ backgroundColor: hovered ? `${resolvedColor}26` : `${resolvedColor}00` }}
    />
    <ControlRow
      className="pr-0.5"
      treeIcon={
        <TreeIconColumn
          depth={depth}
          icon={
            <Tooltip content={getSemanticLabelForIconCode(iconCode)} disabled={false} invert>
              <div>
                <StaticIcon size={Size.Md} color={resolvedColor}>
                  <DataIcon iconCode={iconCode} className={ICON_CLASS_NAME} />
                </StaticIcon>
              </div>
            </Tooltip>
          }
        />
      }
      label={
        <TextField
          size={Size.Sm}
          color={resolvedColor}
          value={displayLabel}
          readOnly={editorDisabled || !onRename}
          outline="hidden"
          onChange={(val) => {
            if (!val) return;
            onRename?.(val);
          }}
        />
      }
      editor={
        <DirectAnimatableEditor
          animatable={animatable}
          rawValue={rawValue}
          color={resolvedColor}
          disabled={editorDisabled}
          onChange={handleValueChange}
        />
      }
      controls={
        <ControlStrip
          color={resolvedColor}
          disabled={editorDisabled}
          prevEnabled={false}
          nextEnabled={false}
          prevVisible={false}
          nextVisible={false}
          centerIcon="plus"
          centerAltText="Add Track"
          onCenter={addTrackAction}
        />
      }
      options={
        <Dropdown
          disabled={editorDisabled || menuOpen}
          onOpenChange={setMenuOpen}
          side="right"
          trigger={
            <span>
              <Button
                size={Size.Xs}
                className="flex items-center justify-center"
                visuals="inverted"
                leftIcon={<IconDotsVertical className={ICON_CLASS_NAME} />}
              />
            </span>
          }
        >
          {leafMenuContent}
        </Dropdown>
      }
    />
    </div>
    </ContextMenu>
  );
}

function AnimatableGroupControl({
  groupId,
  label,
  childAnimatableIds,
  expanded = true,
  onToggle,
  onRename,
  onAddTrack,
  addable,
  sourceRowId,
  disabled = false,
  depth = 0,
}: AnimatableGroupControlProps) {
  const running = usePlayerStore(useShallow((state) => state.player.running));

  // --- Consolidated store data ---
  const {
    sourceRow,
    emphasisRowId,
    namespaces,
    animations,
    tracks,
    animatables,
    selectionInstanceId,
    selectedKeypoints,
    hasClipboard,
  } = useAnimationStore(
    useShallow((state: AnimationData) => ({
      sourceRow: sourceRowId ? state.instancedTrackSources[sourceRowId] : undefined,
      emphasisRowId: state.emphasisRowId,
      namespaces: state.namespaces,
      animations: state.animations,
      tracks: state.tracks,
      animatables: state.animatables,
      selectionInstanceId: state.selectionState.instanceId,
      selectedKeypoints: state.selectionState.keypoints,
      hasClipboard: state.clipboard !== null,
    })),
  );
  const emphasis = sourceRowId ? emphasisRowId === sourceRowId : false;

  // --- Consolidated store actions ---
  const {
    setEmphasis,
    selectTrack,
    toggleTrackInSelection,
    rangeSelectTracks,
    createTrack,
    setTracksVisible,
    setTracksMuted,
    setTracksLocked,
    copySelection,
    cutSelection,
    pasteAtStamp,
    deleteSelection,
    selectAllInTracks,
    clearSelection,
  } = useAnimationStore(
    useShallow((state: AnimationActions) => ({
      setEmphasis: state.setEmphasis,
      selectTrack: state.selectTrack,
      toggleTrackInSelection: state.toggleTrackInSelection,
      rangeSelectTracks: state.rangeSelectTracks,
      createTrack: state.createTrack,
      setTracksVisible: state.setTracksVisible,
      setTracksMuted: state.setTracksMuted,
      setTracksLocked: state.setTracksLocked,
      copySelection: state.copySelection,
      cutSelection: state.cutSelection,
      pasteAtStamp: state.pasteAtStamp,
      deleteSelection: state.deleteSelection,
      selectAllInTracks: state.selectAllInTracks,
      clearSelection: state.clearSelection,
    })),
  );

  const fallbackSourceRow = useMemo<SourceRow>(
    () => sourceRow ?? { id: `group-fallback-${groupId}`, data: [] },
    [groupId, sourceRow],
  );

  const {
    keyState, currentFrame, missingEntries, targetPoints,
    prevEnabled, nextEnabled, onPrev, onNext,
  } = useKeyControlState(fallbackSourceRow);

  const { removeKeypoints, insertKeypointAtWorldStamp } = useAnimationStore(
    useShallow((state: AnimationActions) => ({
      removeKeypoints: state.removeKeypoints,
      insertKeypointAtWorldStamp: state.insertKeypointAtWorldStamp,
    })),
  );

  const playerStamp = usePlayerStore((state) => state.player.stamp);

  const hasTrackGroup = Boolean(sourceRow && sourceRow.data.length > 0);
  const allReadonly = sourceRow?.data.every((datum) => !datum.editable) ?? false;

  const activeAnimationId = useMemo(() => {
    if (!selectionInstanceId) return undefined;
    for (const namespace of Object.values(namespaces)) {
      const instance = namespace.animationInstances[selectionInstanceId];
      if (instance) return instance.animationId;
    }
    return undefined;
  }, [namespaces, selectionInstanceId]);

  const existingAnimatableIds = useMemo(() => {
    if (!activeAnimationId) return new Set<string>();
    const animation = animations[activeAnimationId];
    if (!animation) return new Set<string>();
    return new Set(
      animation.tracks
        .map((trackId) => tracks[trackId]?.animatableId)
        .filter((id): id is string => Boolean(id)),
    );
  }, [activeAnimationId, animations, tracks]);

  const missingChildAnimatableIds = useMemo(() => {
    const childIds = childAnimatableIds ?? [];
    if (childIds.length === 0) return [];
    if (existingAnimatableIds.size === 0) return childIds.slice();
    return childIds.filter((id) => !existingAnimatableIds.has(id));
  }, [childAnimatableIds, existingAnimatableIds]);

  const displayLabel = label ?? groupId;
  const derivedAddable =
    typeof addable === "boolean" ? addable : missingChildAnimatableIds.length > 0;
  const canAutoCreate =
    Boolean(activeAnimationId) && missingChildAnimatableIds.length > 0 && !disabled && !running;

  const handleAddTracks = useCallback(() => {
    if (!canAutoCreate || !activeAnimationId) return;
    missingChildAnimatableIds.forEach((animatableId) => {
      const animatable = animatables[animatableId];
      if (!animatable || COMPLEX_TYPES.has(animatable.type)) return;
      createTrack(
        {
          groupName: displayLabel,
        },
        animatableId,
        activeAnimationId,
      );
    });
  }, [
    activeAnimationId,
    animatables,
    canAutoCreate,
    createTrack,
    displayLabel,
    missingChildAnimatableIds,
  ]);

  const color = useColors(getColorKey(groupId, hasTrackGroup, childAnimatableIds, sourceRow?.data));

  const resolvedColor = disabled || running ? DEFAULT_COLOR : color;
  const canAdd = !disabled && !running && derivedAddable && Boolean(onAddTrack || canAutoCreate);
  // Keep the empty-group affordance aligned with leaf track-missing rows.
  let centerIcon: "key" | "plus" = "plus";
  if (hasTrackGroup) {
    centerIcon = derivedAddable ? "plus" : "key";
  }

  // Per-row selection state — group checks if any child trackIds are in keypoints
  const groupTrackIds = useMemo(
    () => (sourceRow ? uniq(sourceRow.data.map((d) => d.trackId)) : []),
    [sourceRow],
  );
  const isGroupSelected = useAnimationStore((state) =>
    groupTrackIds.some((id) => state.selectionState.keypoints.has(id)),
  );

  const referenceRowId = useAnimationStore(
    (state) => state.selectionState.reference?.rowId ?? null,
  );

  const groupBackground = useMemo(() => {
    if (isGroupSelected) return `${resolvedColor}40`;
    if (emphasis) return `${resolvedColor}26`;
    return `${resolvedColor}00`;
  }, [isGroupSelected, emphasis, resolvedColor]);

  // Track property state for groups with tracks
  const rowVisible = useMemo<boolean | "partial">(() => {
    if (!sourceRow || sourceRow.data.length === 0) return true;
    const allV = sourceRow.data.every((d) => d.visible !== false);
    const noneV = sourceRow.data.every((d) => d.visible === false);
    return allV ? true : noneV ? false : "partial";
  }, [sourceRow]);
  const rowMuted = useMemo<boolean>(() => {
    if (!sourceRow || sourceRow.data.length === 0) return false;
    return sourceRow.data.every((entry) => entry.muted ?? false);
  }, [sourceRow]);
  const rowLocked = useMemo<boolean | "partial">(() => {
    if (!sourceRow || sourceRow.data.length === 0) return false;
    const allL = sourceRow.data.every((d) => d.locked === true);
    const noneL = sourceRow.data.every((d) => d.locked !== true);
    return allL ? true : noneL ? false : "partial";
  }, [sourceRow]);
  const sourceIds = useMemo(
    () => sourceRow ? uniq(sourceRow.data.map((d) => `${d.namespaceId}/${d.instanceId}/${d.trackId}`)) : [],
    [sourceRow],
  );
  const handleToggleVisible = useCallback(() => {
    if (sourceIds.length === 0) return;
    const next = rowVisible === "partial" ? true : rowVisible === true ? false : true;
    setTracksVisible(sourceIds, next);
  }, [sourceIds, rowVisible, setTracksVisible]);
  const handleToggleMuted = useCallback(() => {
    if (sourceIds.length === 0) return;
    setTracksMuted(sourceIds, !rowMuted);
  }, [sourceIds, rowMuted, setTracksMuted]);
  const handleToggleLocked = useCallback(() => {
    if (sourceIds.length === 0) return;
    const next = rowLocked === "partial" ? true : rowLocked === true ? false : true;
    setTracksLocked(sourceIds, next);
  }, [sourceIds, rowLocked, setTracksLocked]);

  const handleAddKeyframe = useCallback(() => {
    if (running || allReadonly) return;
    const targets = missingEntries;
    targets.forEach((datum) => {
      insertKeypointAtWorldStamp(datum.trackId, playerStamp, datum.instanceId);
    });
  }, [running, allReadonly, missingEntries, insertKeypointAtWorldStamp, playerStamp]);

  const handleRemoveKeyframe = useCallback(() => {
    if (running || allReadonly || !currentFrame) return;
    const points = targetPoints.length > 0 ? targetPoints : currentFrame.points;
    removeKeypoints(points.map((p) => ({ trackId: p.trackId, keypointId: p.id })));
  }, [running, allReadonly, currentFrame, targetPoints, removeKeypoints]);

  const handlePaste = useCallback(() => {
    pasteAtStamp(playerStamp);
  }, [pasteAtStamp, playerStamp]);

  const keybindingMap = useKeybindingMap();
  const { menuOpen, setMenuOpen } = useTrackMenuState();

  const groupMenuContent = useMemo(() => {
    if (hasTrackGroup && sourceRow) {
      return (
        <KeybindingProvider value={keybindingMap}>
          <TrackControlMenuContent
            playing={running}
            allReadonly={allReadonly}
            trackIds={groupTrackIds}
            isGroup
            sourceRowId={sourceRow.id}
            visible={rowVisible}
            muted={rowMuted}
            locked={rowLocked}
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
            trackKeys={groupTrackIds}
            onSelectAllInTrack={() => selectAllInTracks(groupTrackIds)}
            onDeselectAll={clearSelection}
            hasClipboard={hasClipboard}
            onCut={cutSelection}
            onCopy={copySelection}
            onPaste={handlePaste}
            onDelete={deleteSelection}
          />
        </KeybindingProvider>
      );
    }
    return (
      <AnimatableGroupMenuContent
        disabled={disabled || running}
        onAddTracks={canAdd ? (onAddTrack ?? handleAddTracks) : undefined}
      />
    );
  }, [
    hasTrackGroup, sourceRow, running, allReadonly, groupTrackIds, rowVisible, rowMuted, rowLocked,
    handleToggleVisible, handleToggleMuted, handleToggleLocked, keyState, handleAddKeyframe,
    handleRemoveKeyframe, prevEnabled, nextEnabled, onPrev, onNext, selectedKeypoints,
    selectAllInTracks, clearSelection, hasClipboard, cutSelection, copySelection, handlePaste,
    deleteSelection, keybindingMap, disabled, canAdd, onAddTrack, handleAddTracks,
  ]);

  return (
    <ContextMenu
      content={groupMenuContent}
      disabled={menuOpen}
      onOpenChange={setMenuOpen}
    >
    <div
      className="relative w-full"
      onMouseEnter={() => sourceRowId && setEmphasis(sourceRowId)}
      onMouseLeave={() => setEmphasis(null)}
      onPointerDown={(e) => {
        if (!sourceRowId || groupTrackIds.length === 0) return;
        if (e.ctrlKey || e.metaKey) {
          toggleTrackInSelection(sourceRowId, groupTrackIds);
        } else if (e.shiftKey && referenceRowId) {
          rangeSelectTracks(referenceRowId, sourceRowId);
        } else {
          selectTrack(sourceRowId, groupTrackIds);
        }
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 -right-2 transition-colors duration-150 ease-out"
        style={{ backgroundColor: groupBackground }}
      />
      <ControlRow
        isGroup
        className="pr-0.5"
        target={
          isGroupSelected ? (
            <div
              className="h-full w-full transition-colors duration-150 ease-out"
              style={{ backgroundColor: color }}
            />
          ) : undefined
        }
        treeIcon={
          <TreeIconColumn
            depth={depth}
            icon={
              <GroupToggle
                expanded={expanded}
                onToggle={onToggle}
                disabled={disabled}
                color={resolvedColor}
              />
            }
          />
        }
        label={
          <TextField
            size={Size.Sm}
            color={resolvedColor}
            value={displayLabel}
            readOnly={disabled || running || !onRename}
            outline="hidden"
            onChange={(val) => {
              if (running) return;
              if (!val) return;
              onRename?.(val);
            }}
          />
        }
        controls={
          hasTrackGroup && sourceRow ? (
            <KeyStrip
              source={sourceRow}
              color={resolvedColor}
              disabled={disabled || running || allReadonly}
              onHexClick={() => {
                if (keyState === "full") {
                  handleRemoveKeyframe();
                } else {
                  handleAddKeyframe();
                }
              }}
            />
          ) : (
            <ControlStrip
              color={resolvedColor}
              disabled={disabled || running}
              prevEnabled={false}
              nextEnabled={false}
              prevVisible={false}
              nextVisible={false}
              centerIcon={centerIcon}
              centerAltText="Add Track Group"
              onCenter={canAdd ? (onAddTrack ?? handleAddTracks) : undefined}
            />
          )
        }
        options={
          <Dropdown
            disabled={disabled || running || menuOpen}
            onOpenChange={setMenuOpen}
            side="right"
            trigger={
              <span>
                <Button
                  size={Size.Xs}
                  className="flex items-center justify-center"
                  visuals="inverted"
                  leftIcon={<IconDotsVertical className={ICON_CLASS_NAME} />}
                />
              </span>
            }
          >
            {groupMenuContent}
          </Dropdown>
        }
      />
    </div>
    </ContextMenu>
  );
}

interface DirectAnimatableEditorProps {
  animatable: AnimatableValue;
  rawValue: RawValue | undefined;
  color: string;
  disabled: boolean;
  onChange: (value: RawValue | ((current: RawValue) => RawValue)) => void;
}

function DirectAnimatableEditor({
  animatable,
  rawValue,
  color,
  disabled,
  onChange,
}: DirectAnimatableEditorProps) {
  const value = rawValue ?? animatable.default;
  const iconCode = getIconCode(animatable.type, animatable.pub?.units);
  const angular = iconCode === "rad";
  const transformForDisplay = angular ? toDegrees : (v: number) => v;
  const transformFromDisplay = angular ? toRadians : (v: number) => v;

  if (animatable.type === "number" && typeof value === "number") {
    const constraints = animatable.constraints;
    const minRaw = typeof constraints?.min === "number" ? constraints.min : undefined;
    const maxRaw = typeof constraints?.max === "number" ? constraints.max : undefined;
    const min = minRaw !== undefined ? transformForDisplay(minRaw) : undefined;
    const max = maxRaw !== undefined ? transformForDisplay(maxRaw) : undefined;
    const hasFiniteBounds =
      min !== undefined && max !== undefined && min !== -Infinity && max !== Infinity;
    const relativeDragRange = angular && !hasFiniteBounds ? 360 : undefined;

    return (
      <SliderNumberField
        size={Size.Sm}
        strictText={false}
        strictSlider={hasFiniteBounds}
        disabled={disabled}
        value={transformForDisplay(value)}
        min={min}
        max={max}
        relativeDragRange={relativeDragRange}
        color={color}
        onChange={(v) => onChange(transformFromDisplay(v))}
        units={angular ? "\u00b0" : animatable.pub?.units}
      />
    );
  }

  if (animatable.type === "string" && typeof value === "string") {
    return (
      <TextField value={value} readOnly={disabled} size={Size.Sm} onChange={(v) => onChange(v)} />
    );
  }

  if (animatable.type === "boolean" && typeof value === "boolean") {
    return (
      <ToggleSquare
        value={value}
        disabled={disabled}
        size={Size.Sm}
        onChange={(v) => onChange(v)}
      />
    );
  }

  return <div className="h-7 animate-pulse rounded bg-neutral-700/30" />;
}

export const AnimatableControl = memo((props: AnimatableControlProps) => {
  if (props.kind === "group") {
    return <AnimatableGroupControl {...props} />;
  }
  return <AnimatableLeafControl {...props} />;
});

AnimatableControl.displayName = "AnimatableControl";

function getColorKey(
  groupId: string,
  hasTrackGroup: boolean,
  animatableIds?: string[],
  sourceRowData?: SourceRowData[],
): string | string[] {
  if (hasTrackGroup && sourceRowData) {
    return sourceRowData.map((datum) => datum.trackId);
  } else if (animatableIds && animatableIds.length > 0) {
    return animatableIds;
  } else {
    return groupId;
  }
}
