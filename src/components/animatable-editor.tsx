import { memo, useCallback, useMemo, useRef, useState } from "react";
import { SliderNumberField, Size, TextField, ToggleSquare } from "@semio/ui";
import {
  RawValue,
  toDegrees,
  toRadians,
  AnimatableNumber,
  usePlayerStore,
  PlayerData,
} from "@semio/utils";
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
}

function InnerAnimatableEditor({
  rowId,
  data,
  playing,
  emphasis,
  onEmphasisChange,
  handleValueChange,
  active = true,
}: AnimatableEditorProps) {
  const trueColor = useColors(data.trackId ?? data.animatableId);
  const color = active ? trueColor : DEFAULT_COLOR;

  const stamp = usePlayerStore(useShallow((state: PlayerData) => state.player.stamp));
  const valueKey = useMemo(
    () => buildTrackKey(data.namespaceId, data.instanceId, data.trackId),
    [data.namespaceId, data.instanceId, data.trackId],
  );
  const storedValue = useAnimationStore(
    useCallback((state: AnimationData) => state.values.get(valueKey), [valueKey]),
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

  const value = useMemo(() => {
    if (storedValue === undefined) return undefined;
    if (typeof storedValue === "number") return storedValue;
    if (typeof storedValue === "string") return storedValue;
    if (typeof storedValue === "boolean") return storedValue;
    return undefined;
  }, [storedValue]);

  const defaultValue = useMemo(() => {
    if (animatableValue === undefined) return 0;
    if (typeof animatableValue.default === "number") return animatableValue.default;
    if (typeof animatableValue.default === "string") return animatableValue.default;
    if (typeof animatableValue.default === "boolean") return animatableValue.default;
    return undefined;
  }, [animatableValue]);

  const rawValue = value !== undefined ? value : defaultValue;

  const renderTransformer = data.iconCode === "rad" ? toDegrees : (v: number) => v;
  const renderInverse = data.iconCode === "rad" ? toRadians : (v: number) => v;

  const limits = useMemo(() => {
    if (animatableValue.type === "number") {
      return {
        min: (animatableValue as AnimatableNumber).constraints?.min ?? undefined,
        max: (animatableValue as AnimatableNumber).constraints?.max ?? undefined,
      };
    } else {
      return { min: undefined, max: undefined };
    }
  }, [animatableValue]);

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
    } else {
      return animatableValue?.name ?? "";
    }
  }, [track?.name, animatableValue?.name]);

  if (rawValue === undefined) return;

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
            origin: { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY },
          });
        }}
        onDragMoveNative={(e, currentValue) => {
          if (!dragActiveRef.current) return;
          setDisplayValue(currentValue as number);
          dragDidMoveRef.current = true;

          const currentActual = renderInverse(currentValue as number);

          updateValueDrag({
            currentValue: currentActual,
            pointer: { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY },
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
        strictSlider={
          limits.min !== undefined &&
          limits.max !== undefined &&
          limits.min !== -Infinity &&
          limits.max !== Infinity
        }
        disabled={playing || !data.editable || !active}
        value={displayValue !== null ? displayValue : renderTransformer(rawValue)}
        min={limits.min !== undefined ? renderTransformer(limits.min) : undefined}
        max={limits.max !== undefined ? renderTransformer(limits.max) : undefined}
        color={color}
        onChange={(v) => {
          if (dragActiveRef.current) return;
          onChange(renderInverse(v));
        }}
        label={label}
        onLabelChange={track ? (v) => updateTrack({ id: track.id, name: v }) : undefined}
        highlight={emphasis}
        units={data.iconCode === "rad" ? "°" : animatableValue.pub?.units}
        onHighlightChange={onEmphasisChange}
        wrapperClassName="flex-1"
        className="flex-1"
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
