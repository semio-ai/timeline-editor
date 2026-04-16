import { memo, useCallback, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { SliderNumberField, Size, TextField, ToggleSquare } from "@semio/ui";
import { RawValue, toDegrees, toRadians, usePlayerStore, PlayerData, useValuesStore } from "@semio/utils";
import { useShallow } from "zustand/react/shallow";
import { SourceRowData } from "../types";
import { useAnimationStore, useColors } from "../hooks";
import { AnimationActions, AnimationData } from "../store-types";
import { DEFAULT_COLOR } from "../constants";
import { buildTrackKey } from "../utils/track-key";

export interface AnimatableEditorProps {
  rowId: string;
  data: SourceRowData;
  playing: boolean;
  emphasis?: boolean;
  onEmphasisChange?: (v: boolean) => void;
  handleValueChange: (value: RawValue | ((current: RawValue) => RawValue)) => void;
  active?: boolean;
  colorOverride?: string;
  /** When true, the label is rendered externally (e.g. in a separate grid column). */
  hideLabel?: boolean;
}

function InnerAnimatableEditor({
  rowId,
  data,
  playing,
  emphasis,
  onEmphasisChange,
  handleValueChange,
  active = true,
  colorOverride,
  hideLabel = false,
}: AnimatableEditorProps) {
  const trueColor = useColors(data.trackId ?? data.animatableId);
  const color = colorOverride ?? (active ? trueColor : DEFAULT_COLOR);

  const stamp = usePlayerStore(useShallow((state: PlayerData) => state.player.stamp));
  const valueKey = useMemo(
    () => buildTrackKey(data.namespaceId, data.instanceId, data.trackId),
    [data.namespaceId, data.instanceId, data.trackId],
  );
  const storedValue = useValuesStore(
    useCallback((state) => state.values.get(valueKey), [valueKey]),
  );

  // Drag pipeline integration (value-driven)
  const { startValueDrag, updateValueDrag, commitValueDrag, cancelValueDrag } = useAnimationStore(
    useShallow((state: AnimationActions & AnimationData) => ({
      startValueDrag: state.startValueDrag,
      updateValueDrag: state.updateValueDrag,
      commitValueDrag: state.commitValueDrag,
      cancelValueDrag: state.cancelValueDrag,
    })),
  );

  const dragActiveRef = useRef(false);
  const dragDidMoveRef = useRef(false);
  const [displayValue, setDisplayValue] = useState<number | null>(null);

  const { animatableValue, track } = useAnimationStore(
    useShallow((state: AnimationData) => ({
      animatableValue: state.animatables[data.animatableId],
      track: state.tracks[data.trackId],
    })),
  );

  const scalarStoredValue = useMemo(() => {
    if (typeof storedValue === "number") return storedValue;
    if (typeof storedValue === "string") return storedValue;
    if (typeof storedValue === "boolean") return storedValue;
    return undefined;
  }, [storedValue]);

  const hasAnimatable = Boolean(animatableValue && track);

  const rawValue = useMemo(() => {
    if (!animatableValue) return undefined;
    return scalarStoredValue ?? animatableValue.default;
  }, [animatableValue, scalarStoredValue]);

  const angular = data.iconCode === "rad" || animatableValue?.pub?.units === "rad";
  const renderTransformer = angular ? toDegrees : (v: number) => v;
  const renderInverse = angular ? toRadians : (v: number) => v;

  const limits = useMemo(() => {
    if (animatableValue?.type !== "number") {
      return { min: undefined, max: undefined };
    }
    return {
      min: animatableValue.constraints?.min ?? undefined,
      max: animatableValue.constraints?.max ?? undefined,
    };
  }, [animatableValue]);
  const hasFiniteBounds =
    limits.min !== undefined &&
    limits.max !== undefined &&
    limits.min !== -Infinity &&
    limits.max !== Infinity;
  const relativeDragRange = angular && !hasFiniteBounds ? 360 : undefined;
  const valueScaleOverride = useMemo(() => {
    if (!angular || hasFiniteBounds) return undefined;
    return {
      domain: [-Math.PI, Math.PI] as [number, number],
      clamp: false,
    };
  }, [angular, hasFiniteBounds]);

  const updateTrack = useAnimationStore(useShallow((state: AnimationActions) => state.updateTrack));

  const onChange = useCallback(
    (newValue: RawValue | ((change: RawValue) => RawValue)) => {
      handleValueChange(newValue);
    },
    [handleValueChange],
  );

  const label = useMemo(() => {
    if (track?.name) {
      return track.name;
    }
    return animatableValue?.name ?? "";
  }, [track?.name, animatableValue?.name]);

  if (!hasAnimatable || rawValue === undefined) {
    return <div className={clsx("h-7 animate-pulse rounded bg-neutral-700/30", !hideLabel && "flex-1")} />;
  }

  if (data.type === "number" && typeof rawValue === "number") {
    return (
      <SliderNumberField
        onDragStartNative={(e, currentValue) => {
          if (playing || !data.editable || !active) return;

          dragActiveRef.current = true;
          dragDidMoveRef.current = false;
          setDisplayValue(currentValue as number);

          startValueDrag({
            rowId,
            trackId: data.trackId,
            namespaceId: data.namespaceId,
            instanceId: data.instanceId,
            worldStamp: stamp,
            valueScale: valueScaleOverride,
          });
        }}
        onDragMoveNative={(e, currentValue) => {
          if (!dragActiveRef.current) return;
          setDisplayValue(currentValue as number);
          dragDidMoveRef.current = true;

          const currentActual = renderInverse(currentValue as number);

          updateValueDrag({
            currentValue: currentActual,
            modifiers: {
              alt: (e as MouseEvent).altKey ?? false,
              shift: (e as MouseEvent).shiftKey ?? false,
              meta: (e as MouseEvent).metaKey ?? false,
            },
          });
        }}
        onDragEndNative={(_e, _currentValue) => {
          if (!dragActiveRef.current) return;
          dragActiveRef.current = false;
          setDisplayValue(null);
          if (dragDidMoveRef.current) {
            commitValueDrag();
          } else {
            cancelValueDrag();
          }
          dragDidMoveRef.current = false;
        }}
        size={Size.Sm}
        strictText={false}
        strictSlider={hasFiniteBounds}
        disabled={playing || !data.editable || !active}
        value={displayValue !== null ? displayValue : renderTransformer(rawValue)}
        min={limits.min !== undefined ? renderTransformer(limits.min) : undefined}
        max={limits.max !== undefined ? renderTransformer(limits.max) : undefined}
        relativeDragRange={relativeDragRange}
        color={color}
        onChange={(v) => {
          if (dragActiveRef.current) return;
          onChange(renderInverse(v));
        }}
        label={hideLabel ? undefined : label}
        onLabelChange={hideLabel ? undefined : (track ? (v) => updateTrack({ id: track.id, name: v }) : undefined)}
        highlight={emphasis}
        units={angular ? "°" : animatableValue.pub?.units}
        onHighlightChange={onEmphasisChange}
        wrapperClassName={hideLabel ? undefined : "flex-1"}
        className={hideLabel ? undefined : "flex-1"}
      />
    );
  } else if (data.type === "string" && typeof rawValue === "string") {
    return (
      <TextField
        value={rawValue}
        readOnly={playing || !data.editable || !active}
        size={Size.Sm}
        onChange={(v) => onChange(v)}
      />
    );
  } else if (data.type === "boolean" && typeof rawValue === "boolean") {
    return (
      <ToggleSquare
        value={rawValue}
        disabled={playing || !data.editable || !active}
        size={Size.Sm}
        onChange={(v) => onChange(v)}
      />
    );
  }
}

export const AnimatableEditor = memo(InnerAnimatableEditor);
