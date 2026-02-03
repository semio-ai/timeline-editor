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
} from "@semio/ui";
import type { AnimatableValue, RawValue } from "@semio/utils";
import { usePlayerStore } from "@semio/utils";
import { useAnimationStore, useColors, useKeyControlState } from "../hooks";
import { SourceRow, SourceRowData } from "../types";
import { getIconCode, getSemanticLabelForIconCode } from "../functions/get-icon-code";
import { COMPLEX_TYPES, DEFAULT_COLOR } from "../constants";
import { TrackControl } from "./track-control";
import { DataIcon } from "./data-icon";
import { ControlRow, ControlStrip, GroupToggle } from "./controls";
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
  emphasis?: boolean;
  onEmphasisChange?: (emphasis: boolean) => void;
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
  emphasis,
  onEmphasisChange,
  disabled = false,
}: AnimatableLeafControlProps) {
  const resolvedMode: AnimatableControlMode = mode ?? (sourceRowId ? "track" : "direct");

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

  const storedValue = useAnimationStore(
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
  const resolvedColor = disabled ? DEFAULT_COLOR : color;
  const iconCode = animatable ? getIconCode(animatable.type, animatable.pub?.units) : "none";

  const handleValueChange = useCallback(
    (value: RawValue | ((current: RawValue) => RawValue)) => {
      if (disabled) return;
      onValueChange?.(value);
    },
    [disabled, onValueChange],
  );

  const displayLabel = useMemo(() => {
    if (label) return label;
    const axis = animatable?.group?.axis;
    if (axis) return axis;
    return animatable?.name ?? "";
  }, [animatable?.group?.axis, animatable?.name, label]);

  if (!animatable) {
    return <div className="w-full h-9 rounded bg-neutral-700/30 animate-pulse" />;
  }

  if (sourceRow && resolvedMode === "track") {
    return (
      <TrackControl sourceRow={sourceRow} emphasis={emphasis} onEmphasisChange={onEmphasisChange} />
    );
  }

  return (
    <ControlRow
      left={
        <ControlStrip
          color={resolvedColor}
          disabled={disabled}
          prevEnabled={false}
          nextEnabled={false}
          prevVisible={false}
          nextVisible={false}
          centerIcon="plus"
          centerAltText="Add Track"
          onCenter={
            resolvedMode === "track-missing"
              ? (onAddTrack ?? (canAutoCreateTrack ? handleAddTrack : undefined))
              : undefined
          }
        />
      }
      mid={
        <Tooltip content={getSemanticLabelForIconCode(iconCode)} disabled={false} invert>
          <div>
            <StaticIcon size="fit" className="size-3" color={resolvedColor}>
              <DataIcon iconCode={iconCode} size="13px" />
            </StaticIcon>
          </div>
        </Tooltip>
      }
      main={
        <div className="flex-1 flex min-w-0">
          <DirectAnimatableEditor
            animatable={animatable}
            rawValue={rawValue}
            color={resolvedColor}
            disabled={disabled}
            label={displayLabel}
            emphasis={emphasis}
            onEmphasisChange={onEmphasisChange}
            onRename={onRename}
            onChange={handleValueChange}
          />
        </div>
      }
      right={
        <div className="w-3 flex items-center justify-around mr-1">
          <Dropdown
            variant={Variant.Info}
            trigger={
              <span>
                <Button
                  size={Size.Xs}
                  className="flex items-center justify-center"
                  visuals="inverted"
                  leftIcon={<IconDotsVertical className="size-3/5" />}
                />
              </span>
            }
          >
            <NestedLabel>Control Settings</NestedLabel>
            <NestedColorPicker
              variant={Variant.Info}
              value={color}
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
        </div>
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
}: AnimatableGroupControlProps) {
  const sourceRow = useAnimationStore(
    useShallow((state) => (sourceRowId ? state.instancedTrackSources[sourceRowId] : undefined)),
  );
  const { namespaces, animations, tracks, animatables, selectionInstanceId, createTrack } =
    useAnimationStore(
      useShallow((state) => ({
        namespaces: state.namespaces,
        animations: state.animations,
        tracks: state.tracks,
        animatables: state.animatables,
        selectionInstanceId: state.selectionState.instanceId,
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
    Boolean(activeAnimationId) && missingChildAnimatableIds.length > 0 && !disabled;

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

  const resolvedColor = disabled ? DEFAULT_COLOR : color;
  const canAdd = !disabled && derivedAddable && Boolean(onAddTrack || canAutoCreate);
  const centerIcon = derivedAddable ? "plus" : "key";

  return (
    <ControlRow
      left={
        hasTrackGroup && sourceRow ? (
          <KeyStrip
            source={sourceRow}
            color={resolvedColor}
            disabled={disabled || allReadonly}
            onHexClick={() => {
              if (disabled || allReadonly) return;
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
            disabled={disabled}
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
      mid={
        <GroupToggle
          expanded={expanded}
          onToggle={onToggle}
          disabled={disabled}
          color={resolvedColor}
        />
      }
      main={
        <TextField
          size={Size.Sm}
          color={resolvedColor}
          value={displayLabel}
          readOnly={disabled || !onRename}
          onChange={(val) => {
            if (!val) return;
            onRename?.(val);
          }}
        />
      }
      right={
        <div className="w-3 flex items-center justify-around mr-1">
          <Dropdown
            disabled
            variant={Variant.Info}
            trigger={
              <span>
                <Button
                  size={Size.Xs}
                  className="flex items-center justify-center"
                  visuals="inverted"
                  leftIcon={<IconDotsVertical className="size-3/5" />}
                />
              </span>
            }
          >
            <NestedLabel>Control Settings</NestedLabel>
            {/* No content currently. May add more. Dropdown disabled */}
          </Dropdown>
        </div>
      }
    />
  );
}

interface DirectAnimatableEditorProps {
  animatable: AnimatableValue;
  rawValue: RawValue | undefined;
  color: string;
  disabled: boolean;
  label?: string;
  emphasis?: boolean;
  onEmphasisChange?: (emphasis: boolean) => void;
  onRename?: (name: string) => void;
  onChange: (value: RawValue | ((current: RawValue) => RawValue)) => void;
}

function DirectAnimatableEditor({
  animatable,
  rawValue,
  color,
  disabled,
  label,
  emphasis,
  onEmphasisChange,
  onRename,
  onChange,
}: DirectAnimatableEditorProps) {
  const value = rawValue ?? animatable.default;
  const displayLabel = label ?? animatable.name ?? "";

  if (animatable.type === "number" && typeof value === "number") {
    const constraints = animatable.constraints;
    const min = typeof constraints?.min === "number" ? constraints.min : undefined;
    const max = typeof constraints?.max === "number" ? constraints.max : undefined;

    return (
      <SliderNumberField
        size={Size.Sm}
        strictText={false}
        strictSlider={
          min !== undefined && max !== undefined && min !== -Infinity && max !== Infinity
        }
        disabled={disabled}
        value={value}
        min={min}
        max={max}
        color={color}
        onChange={(v) => onChange(v)}
        label={displayLabel}
        onLabelChange={onRename}
        highlight={emphasis}
        onHighlightChange={onEmphasisChange}
        units={animatable.pub?.units}
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

  return <div className="flex-1 h-7 rounded bg-neutral-700/30 animate-pulse" />;
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
