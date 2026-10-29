import { type ReactNode, memo, useCallback, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { uniq } from "lodash";
import {
  StaticIcon,
  Size,
  TextField,
  ToggleSquare,
  Dropdown,
  ContextMenu,
  Button,
  Tooltip,
} from "@semio/ui";
import type { AnimatableValue, RawValue } from "@semio/data";
import {
  useActiveAnimationId,
  useAnimationStore,
  useColors,
  useControlMenu,
  useEditableLabel,
  useRowBackground,
} from "../hooks";
import { AnimationActions, AnimationData, ControlStripMode } from "../store-types";
import { SourceRow, SourceRowData } from "../types";
import { getIconCode, getSemanticLabelForIconCode } from "../functions/get-icon-code";
import { COMPLEX_TYPES, DEFAULT_COLOR } from "../constants";
import { usePlayer } from "../hooks/use-player";
import { useKeyValue } from "../hooks/use-key-value";
import { AnimatableNumberField } from "./animatable-number-field";
import { TrackControl } from "./track-control";
import { DataIcon } from "./data-icon";
import {
  ControlRow,
  ControlStrip,
  GroupToggle,
  LabelWithNotice,
  TrackPropertiesStrip,
  type TrackPropertiesStripProps,
} from "./controls";
import { TreeIconColumn } from "./controls/tree-connector";
import { KeyStrip } from "./key-strip";
import {
  AnimatableLeafMenuContent,
  AnimatableGroupMenuContent,
} from "./canvas-sheet/context-menus";
import { useTrackMenuState } from "./track-menu-context";

export type AnimatableControlMode = "track" | "track-missing" | "direct";

export interface AnimatableControlBaseProps {
  /** Host-supplied property state for direct controls and mixed groups. */
  propertyControls?: TrackPropertiesStripProps;
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
   * The key the direct editor reads its value from in the injected `DataStore`
   * (`DataStoreContext`). If omitted, the animatable default is used.
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
  /** Shown beside the label: a statement about the control, such as how a paired device differs on its input. */
  notice?: ReactNode;
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
  propertyControls,
  depth = 0,
  notice,
}: AnimatableLeafControlProps) {
  const resolvedMode: AnimatableControlMode = mode ?? (sourceRowId ? "track" : "direct");
  const stripMode = useAnimationStore((state) => state.preferences.controlStripMode);
  const running = usePlayer(useShallow((state) => state.player.running));

  const sourceRow = useAnimationStore(
    useShallow((state) => (sourceRowId ? state.instancedTrackSources[sourceRowId] : undefined)),
  );
  const updateAnimatable = useAnimationStore(useShallow((state) => state.updateAnimatable));
  const { animations, tracks, createTrack } = useAnimationStore(
    useShallow((state) => ({
      animations: state.animations,
      tracks: state.tracks,
      createTrack: state.createTrack,
    })),
  );

  const animatable = useAnimationStore(useShallow((state) => state.animatables[animatableId]));

  // The current value subscription has moved into `DirectAnimatableEditor`
  // (the leaf that actually displays the value). Subscribing here would
  // re-render this component (and therefore ControlRow + the radix
  // ContextMenu/Dropdown plumbing wrapped around it) at the player tick
  // rate during playback for every animated track.

  const activeAnimationId = useActiveAnimationId();

  const isActiveAnimationReadonly = useAnimationStore(
    useShallow((state) =>
      activeAnimationId ? Boolean(state.readonlyAnimations[activeAnimationId]) : false,
    ),
  );

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
    !hasTrackInActiveAnimation &&
    !isActiveAnimationReadonly;

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

  // Draft-while-focused so the derived label (recomputed by a subscription
  // one render after the rename write) doesn't drop keystrokes.
  const handleRename = useCallback((val: string) => onRename?.(val), [onRename]);
  const labelField = useEditableLabel(displayLabel, handleRename);

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
        propertyControls={propertyControls}
        notice={notice}
      />
    );
  }

  return (
    <ContextMenu content={leafMenuContent} disabled={menuOpen} onOpenChange={setMenuOpen}>
      <div
        className="relative w-full"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div
          className="pointer-events-none absolute inset-0 transition-colors duration-150 ease-out"
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
                      <DataIcon iconCode={iconCode} />
                    </StaticIcon>
                  </div>
                </Tooltip>
              }
            />
          }
          label={
            <LabelWithNotice notice={notice}>
              <TextField
                size={Size.Sm}
                color={resolvedColor}
                value={labelField.value}
                readOnly={editorDisabled || !onRename}
                outline="hidden"
                onChange={(val) => labelField.onChange(val)}
                onBlur={labelField.onBlur}
                onKeyDown={labelField.onKeyDown}
              />
            </LabelWithNotice>
          }
          editor={
            <DirectAnimatableEditor
              animatable={animatable}
              valueLookupKey={valueLookupKey}
              color={resolvedColor}
              disabled={editorDisabled}
              onChange={handleValueChange}
            />
          }
          controls={
            stripMode === ControlStripMode.Properties && propertyControls ? (
              <TrackPropertiesStrip color={resolvedColor} {...propertyControls} />
            ) : (
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
            )
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
                    leftIcon="menu"
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
  propertyControls,
  depth = 0,
}: AnimatableGroupControlProps) {
  const stripMode = useAnimationStore((state) => state.preferences.controlStripMode);
  const running = usePlayer(useShallow((state) => state.player.running));

  // Store reads the group control needs for rendering, not for the menu.
  const { sourceRow, emphasisRowId, animations, tracks, animatables } = useAnimationStore(
    useShallow((state: AnimationData) => ({
      sourceRow: sourceRowId ? state.instancedTrackSources[sourceRowId] : undefined,
      emphasisRowId: state.emphasisRowId,
      animations: state.animations,
      tracks: state.tracks,
      animatables: state.animatables,
    })),
  );
  const activeAnimationId = useActiveAnimationId();
  const isActiveAnimationReadonly = useAnimationStore(
    useShallow((state) =>
      activeAnimationId ? Boolean(state.readonlyAnimations[activeAnimationId]) : false,
    ),
  );
  const emphasis = sourceRowId ? emphasisRowId === sourceRowId : false;

  // Store actions for selection, track creation, and emphasis.
  const { setEmphasis, selectTrack, toggleTrackInSelection, rangeSelectTracks, createTrack } =
    useAnimationStore(
      useShallow((state: AnimationActions) => ({
        setEmphasis: state.setEmphasis,
        selectTrack: state.selectTrack,
        toggleTrackInSelection: state.toggleTrackInSelection,
        rangeSelectTracks: state.rangeSelectTracks,
        createTrack: state.createTrack,
      })),
    );

  // When no backing track group exists, synthesize an empty row so shared
  // hooks (e.g. useControlMenu, useKeyControlState) can run unconditionally —
  // hooks must be called the same way on every render.
  const fallbackSourceRow = useMemo<SourceRow>(
    () => sourceRow ?? { id: `group-fallback-${groupId}`, data: [] },
    [groupId, sourceRow],
  );

  const hasTrackGroup = Boolean(sourceRow && sourceRow.data.length > 0);
  const allReadonly = sourceRow?.data.every((datum) => !datum.editable) ?? false;

  // Per-row selection state — group checks if any child trackIds are in keypoints
  const groupTrackIds = useMemo(
    () => (sourceRow ? uniq(sourceRow.data.map((d) => d.trackId)) : []),
    [sourceRow],
  );

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

  // Draft-while-focused; see useEditableLabel — the rendered label is derived
  // and lags the rename write by a render, which otherwise drops keystrokes.
  const handleRename = useCallback(
    (val: string) => {
      if (running) return;
      onRename?.(val);
    },
    [running, onRename],
  );
  const labelField = useEditableLabel(displayLabel, handleRename);
  const derivedAddable =
    typeof addable === "boolean" ? addable : missingChildAnimatableIds.length > 0;
  const canAutoCreate =
    Boolean(activeAnimationId) &&
    missingChildAnimatableIds.length > 0 &&
    !disabled &&
    !running &&
    !isActiveAnimationReadonly;

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

  // "Group is in the selection" (any child track has an entry in the selection
  // map) — drives the left-edge indicator bar on the row. Distinct from the
  // per-key selection tier used by the row background.
  const isGroupSelected = useAnimationStore((state) =>
    groupTrackIds.some((id) => state.selectionState.keypoints.has(id)),
  );

  const referenceRowId = useAnimationStore(
    (state) => state.selectionState.reference?.rowId ?? null,
  );

  // Use the shared row-background logic so the group row tints identically to
  // track-list group rows (three-tier: keys-selected > track-in-selection >
  // emphasis, with DEFAULT_COLOR for inactive/playing).
  const groupBackground = useRowBackground({
    sourceRow: fallbackSourceRow,
    emphasis,
    forceDefaultColor: disabled || running,
  });

  // Shared aggregate state, callbacks, and menu assembly. Runs unconditionally
  // against the fallback row so the hook's internal hook order stays stable.
  // We use its outputs only when `hasTrackGroup` is true; otherwise we render
  // the AnimatableGroupMenuContent for the "Add All Tracks" affordance.
  const controlMenu = useControlMenu({
    sourceRow: fallbackSourceRow,
    propertyControls,
    trackIds: groupTrackIds,
    isGroup: true,
    allReadonly,
  });

  const groupMenuContent = useMemo(() => {
    if (hasTrackGroup) return controlMenu.menuContent;
    return (
      <AnimatableGroupMenuContent
        disabled={disabled || running}
        onAddTracks={canAdd ? (onAddTrack ?? handleAddTracks) : undefined}
      />
    );
  }, [
    hasTrackGroup,
    controlMenu.menuContent,
    disabled,
    running,
    canAdd,
    onAddTrack,
    handleAddTracks,
  ]);

  const { menuOpen, setMenuOpen } = controlMenu;

  let groupControls: ReactNode;
  if (stripMode === ControlStripMode.Properties && (propertyControls || hasTrackGroup)) {
    groupControls = (
      <TrackPropertiesStrip
        color={resolvedColor}
        isGroup
        {...(propertyControls ?? {
          visible: controlMenu.rowVisible,
          muted: controlMenu.rowMuted,
          locked: controlMenu.rowLocked,
          readonly: controlMenu.rowReadonly === true,
          onToggleVisible: controlMenu.handleToggleVisible,
          onToggleMuted: controlMenu.handleToggleMuted,
          onToggleLocked: controlMenu.handleToggleLocked,
        })}
      />
    );
  } else if (hasTrackGroup && sourceRow) {
    groupControls = (
      <KeyStrip
        source={sourceRow}
        color={resolvedColor}
        disabled={disabled || running || allReadonly}
        onHexClick={() => {
          if (controlMenu.keyState === "full") {
            controlMenu.handleRemoveKeyframe();
          } else {
            controlMenu.handleAddKeyframe();
          }
        }}
      />
    );
  } else {
    groupControls = (
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
    );
  }

  return (
    <ContextMenu content={groupMenuContent} disabled={menuOpen} onOpenChange={setMenuOpen}>
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
          className="pointer-events-none absolute inset-0 transition-colors duration-150 ease-out"
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
              value={labelField.value}
              readOnly={disabled || running || !onRename}
              outline="hidden"
              onChange={(val) => labelField.onChange(val)}
              onBlur={labelField.onBlur}
              onKeyDown={labelField.onKeyDown}
            />
          }
          controls={groupControls}
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
                    leftIcon="menu"
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
  /** The key of the value in the injected `DataStore`. The editor watches it
   * here so the per-tick value updates during playback don't re-render the
   * parent row (and its radix menu plumbing). */
  valueLookupKey?: string;
  color: string;
  disabled: boolean;
  onChange: (value: RawValue | ((current: RawValue) => RawValue)) => void;
}

const DirectAnimatableEditor = memo(function DirectAnimatableEditor({
  animatable,
  valueLookupKey,
  color,
  disabled,
  onChange,
}: DirectAnimatableEditorProps) {
  const value = useKeyValue(valueLookupKey, animatable.default);

  if (animatable.type === "number" && typeof value === "number") {
    return (
      <AnimatableNumberField
        animatable={animatable}
        value={value}
        onChange={onChange}
        color={color}
        disabled={disabled}
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
});

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
