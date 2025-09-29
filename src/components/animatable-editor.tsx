import { memo, useCallback, useMemo } from "react";
import { SliderNumberField, Size, TextField, ToggleSquare } from "@semio/ui";
import {
  getLookup,
  RawValue,
  toDegrees,
  toRadians,
  AnimatableVector3,
  AnimatableNumber,
} from "@semio/utils";
import { useShallow } from "zustand/react/shallow";
import { SourceRowData } from "../types";
import { useAnimationStore, useColors } from "../hooks";
import { AnimationActions, AnimationData } from "../store-types";
import { GROUP_TYPES } from "../constants";

const indexLookups: Record<string, Record<string, number>> = {
  vector3: { x: 0, y: 1, z: 2 },
  vector2: { x: 0, y: 1 },
  euler: { r: 0, p: 1, y: 2 },
  rgb: { r: 0, g: 1, b: 2 },
  hsl: { h: 0, s: 1, l: 2 },
};

export interface AnimatableEditorProps {
  data: SourceRowData;
  playing: boolean;
  emphasis?: boolean;
  onEmphasisChange?: (v: boolean) => void;
  handleValueChange: (value: RawValue | ((current: RawValue) => RawValue)) => void;
}

function InnerAnimatableEditor({
  data,
  playing,
  emphasis,
  onEmphasisChange,
  handleValueChange,
}: AnimatableEditorProps) {
  const rawValueId = getLookup(data.namespaceId, data.animatableId);

  const color = useColors(data.trackId ?? data.animatableId);

  const storedValue: RawValue | undefined = useAnimationStore(
    useShallow((state: AnimationData) => {
      return state.values.get(rawValueId);
    }),
  );

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
    if (typeof storedValue === "object" && data.attribute) {
      return (storedValue as unknown as Record<string, number>)[data.attribute];
    } else return undefined;
  }, [storedValue, data.attribute]);

  const defaultValue = useMemo(() => {
    if (animatableValue === undefined) return 0;
    if (typeof animatableValue.default === "number") return animatableValue.default;
    if (typeof animatableValue.default === "string") return animatableValue.default;
    if (typeof animatableValue.default === "boolean") return animatableValue.default;
    if (typeof animatableValue.default === "object" && data.attribute) {
      return (animatableValue.default as unknown as Record<string, number>)[data.attribute] ?? 0;
    } else return 0;
  }, [animatableValue, data.attribute]);

  const rawValue = value !== undefined ? value : defaultValue;

  const renderTransformer = data.iconCode === "rad" ? toDegrees : (v: number) => v;
  const renderInverse = data.iconCode === "rad" ? toRadians : (v: number) => v;

  const limits = useMemo(() => {
    if (data.attribute && GROUP_TYPES.has(animatableValue.type)) {
      const index =
        indexLookups[animatableValue.type as "vector3" | "vector2" | "euler" | "rgb" | "hsl"][
          data.attribute
        ];
      return {
        min: (animatableValue as AnimatableVector3).constraints?.min?.[index] ?? undefined,
        max: (animatableValue as AnimatableVector3).constraints?.max?.[index] ?? undefined,
      };
    } else if (animatableValue.type === "number") {
      return {
        min: (animatableValue as AnimatableNumber).constraints?.min ?? undefined,
        max: (animatableValue as AnimatableNumber).constraints?.max ?? undefined,
      };
    } else {
      return { min: undefined, max: undefined };
    }
  }, [data.attribute, animatableValue]);

  const updateTrack = useAnimationStore(useShallow((state: AnimationActions) => state.updateTrack));

  const onChange = useCallback(
    (newValue: RawValue | ((change: RawValue) => RawValue)) => {
      if (data.attribute) {
        handleValueChange((previous: RawValue) => {
          if (typeof previous === "object") {
            return { ...previous, [data.attribute!]: newValue } as RawValue;
          } else {
            // This should not happen, so just return the previous value (no-op)
            return previous;
          }
        });
      } else {
        handleValueChange(newValue);
      }
    },
    [handleValueChange, data.attribute],
  );

  if (!rawValue) return;

  if (data.type === "number" && typeof rawValue === "number") {
    return (
      <SliderNumberField
        size={Size.Sm}
        strictText={false}
        strictSlider={
          limits.min !== undefined &&
          limits.max !== undefined &&
          limits.min !== -Infinity &&
          limits.max !== Infinity
        }
        disabled={playing || !data.editable}
        value={renderTransformer(rawValue)}
        min={limits.min !== undefined ? renderTransformer(limits.min) : undefined}
        max={limits.max !== undefined ? renderTransformer(limits.max) : undefined}
        color={color}
        onChange={(v) => onChange(renderInverse(v))}
        label={(data.attribute ?? track) ? track.name : animatableValue.name}
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
        readOnly={playing || !data.editable}
        size={Size.Sm}
        onChange={(v) => onChange(v)}
      />
    );
  } else if (data.type === "boolean" && typeof rawValue === "boolean") {
    return (
      <ToggleSquare
        value={rawValue}
        disabled={playing || !data.editable}
        size={Size.Sm}
        onChange={(v) => onChange(v)}
      />
    );
  } else {
    return null;
  }
}

export const AnimatableEditor = memo(InnerAnimatableEditor);
