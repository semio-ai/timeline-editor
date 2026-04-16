import { memo, useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { IconDotsVertical } from "@tabler/icons-react";
import {
  StaticIcon,
  Size,
  SliderNumberField,
  TextField,
  ToggleSquare,
  Dropdown,
  Variant,
  Button,
  NestedLabel,
  NestedColorPicker,
  Tooltip,
  ICON_CLASS_NAME,
} from "@semio/ui";
import type { AnimatableValue, RawValue } from "@semio/utils";
import { toDegrees, toRadians, usePlayerStore, useValuesStore } from "@semio/utils";
import { useAnimationStore, useColors, useKeyControlState } from "../hooks";
import { SourceRow, SourceRowData } from "../types";
import { getIconCode, getSemanticLabelForIconCode } from "../functions/get-icon-code";
import { COMPLEX_TYPES, DEFAULT_COLOR } from "../constants";
import { TrackControl } from "./track-control";
import { DataIcon } from "./data-icon";
import { ControlRow, ControlStrip, GroupToggle } from "./controls";
import { TreeIconColumn } from "./controls/tree-connector";
import { KeyStrip } from "./key-strip";

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

  const editorDisabled = disabled || running;
  let addTrackAction: (() => void) | undefined;
  if (!editorDisabled && resolvedMode === "track-missing") {
    addTrackAction = onAddTrack ?? (canAutoCreateTrack ? handleAddTrack : undefined);
  }

  return (
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
      editor={
        <div className="flex min-w-0 flex-1">
          <DirectAnimatableEditor
            animatable={animatable}
            rawValue={rawValue}
            color={resolvedColor}
            disabled={editorDisabled}
            label={displayLabel}
            onRename={onRename}
            onChange={handleValueChange}
          />
        </div>
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
          disabled={editorDisabled}
          variant={Variant.Info}
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
          <NestedLabel>Control Settings</NestedLabel>
          <NestedColorPicker
            variant={Variant.Info}
            value={color}
            disabled={editorDisabled}
            onChange={(v) => {
              if (!animatable) return;
              updateAnimatable(animatableId, {
                pub: {
                  ...(animatable.pub ?? {
                    public: true,
                    output: "none",
                  }),
                  color: v,
                },
              });
            }}
          />
        </Dropdown>
      }
    />
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
    targetAnchor,
    namespaces,
    animations,
    tracks,
    animatables,
    selectionInstanceId,
  } = useAnimationStore(
    useShallow((state) => ({
      sourceRow: sourceRowId ? state.instancedTrackSources[sourceRowId] : undefined,
      emphasisRowId: state.emphasisRowId,
      targetAnchor: state.selectionState.targetAnchor,
      namespaces: state.namespaces,
      animations: state.animations,
      tracks: state.tracks,
      animatables: state.animatables,
      selectionInstanceId: state.selectionState.instanceId,
    })),
  );
  const emphasis = sourceRowId ? emphasisRowId === sourceRowId : false;

  // --- Consolidated store actions ---
  const { setEmphasis, toggleTrackTarget, rangeTarget, createTrack } = useAnimationStore(
    useShallow((state) => ({
      setEmphasis: state.setEmphasis,
      toggleTrackTarget: state.toggleTrackTarget,
      rangeTarget: state.rangeTarget,
      createTrack: state.createTrack,
    })),
  );

  const fallbackSourceRow = useMemo<SourceRow>(
    () => sourceRow ?? { id: `group-fallback-${groupId}`, data: [] },
    [groupId, sourceRow],
  );

  const { keyState, currentFrame, missingEntries, targetPoints } =
    useKeyControlState(fallbackSourceRow);

  const { removeKeypoints, insertKeypointAtWorldStamp } = useAnimationStore(
    useShallow((state) => ({
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

  // Per-row targeting — single selector deriving group tri-state
  const rowTargeted: boolean | "partial" = useAnimationStore((state) => {
    if (!sourceRow) return false;
    const targeted = state.selectionState.targetedTracks;
    if (targeted.size === 0) return false;
    const leafIds = sourceRow.data.map((d) =>
      `${d.namespaceId}/${d.instanceId}/${d.trackId}`,
    );
    if (leafIds.length === 0) return false;
    const allTargeted = leafIds.every((id) => targeted.has(id));
    const noneTargeted = leafIds.every((id) => !targeted.has(id));
    return allTargeted ? true : noneTargeted ? false : "partial";
  });

  const groupBackground = useMemo(() => {
    if (rowTargeted) return `${resolvedColor}40`;
    if (emphasis) return `${resolvedColor}26`;
    return `${resolvedColor}00`;
  }, [rowTargeted, emphasis, resolvedColor]);

  return (
    <div
      className="relative w-full"
      onMouseEnter={() => sourceRowId && setEmphasis(sourceRowId)}
      onMouseLeave={() => setEmphasis(null)}
      onPointerDown={(e) => {
        if (!sourceRowId) return;
        if (e.ctrlKey || e.metaKey) {
          toggleTrackTarget(sourceRowId);
        } else if (e.shiftKey && targetAnchor) {
          rangeTarget(targetAnchor, sourceRowId);
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
          rowTargeted ? (
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
                if (disabled || running || allReadonly) return;
                if (keyState === "full" && currentFrame) {
                  const points = targetPoints.length > 0 ? targetPoints : currentFrame.points;
                  const removals = points.map((p) => ({
                    trackId: p.trackId,
                    keypointId: p.id,
                  }));
                  removeKeypoints(removals);
                  return;
                }

                const targets = missingEntries;
                targets.forEach((datum) => {
                  insertKeypointAtWorldStamp(datum.trackId, playerStamp, datum.instanceId);
                });
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
            disabled
            variant={Variant.Info}
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
            <NestedLabel>Control Settings</NestedLabel>
            {/* No content currently. May add more. Dropdown disabled */}
          </Dropdown>
        }
      />
    </div>
  );
}

interface DirectAnimatableEditorProps {
  animatable: AnimatableValue;
  rawValue: RawValue | undefined;
  color: string;
  disabled: boolean;
  label?: string;
  onRename?: (name: string) => void;
  onChange: (value: RawValue | ((current: RawValue) => RawValue)) => void;
}

function DirectAnimatableEditor({
  animatable,
  rawValue,
  color,
  disabled,
  label,
  onRename,
  onChange,
}: DirectAnimatableEditorProps) {
  const value = rawValue ?? animatable.default;
  const displayLabel = label ?? animatable.name ?? "";
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
        label={displayLabel}
        onLabelChange={onRename}
        units={angular ? "\u00b0" : animatable.pub?.units}
        wrapperClassName="flex-1"
        className="flex-1"
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

  return <div className="h-7 flex-1 animate-pulse rounded bg-neutral-700/30" />;
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
