import { memo, useCallback, useMemo } from "react";
import { SliderNumberField, Size, TextField } from "@semio/ui";
import {
  getLookup,
  RawValue,
  RawVector3,
  RawEuler,
  AnimatableValue,
  toDegrees,
  toRadians,
  RawRGB,
  RawVector2,
  AnimatableVector3,
  AnimatableNumber,
} from "@semio/utils";
import { useShallow } from "zustand/react/shallow";
import { SourceRowData, type Track } from "../types";
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
  handleValueChange: (value: RawValue) => void;
}

function InnerAnimatableEditor({
  data,
  playing,
  emphasis,
  onEmphasisChange,
  handleValueChange,
}: AnimatableEditorProps) {
  const rawValueId = getLookup(data.namespaceId, data.animatableId);
  const attribute = data.attribute;

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
    if (typeof storedValue === "object" && data.attribute) {
      return (storedValue as unknown as Record<string, number>)[data.attribute];
    } else return undefined;
  }, [storedValue, data.attribute]);

  const defaultValue = useMemo(() => {
    if (animatableValue === undefined) return 0;
    if (typeof animatableValue.default === "number") return animatableValue.default;
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

  if (data.type === "number") {
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
        disabled={playing}
        value={renderTransformer((rawValue as number) ?? (animatableValue.default as number))}
        min={limits.min !== undefined ? renderTransformer(limits.min) : undefined}
        max={limits.max !== undefined ? renderTransformer(limits.max) : undefined}
        color={color}
        onChange={(v) => handleValueChange(renderInverse(v))}
        label={track ? track.name : animatableValue.name}
        onLabelChange={track ? (v) => updateTrack({ id: track.id, name: v }) : undefined}
        highlight={emphasis}
        units={data.iconCode === "rad" ? "°" : animatableValue.pub?.units}
        onHighlightChange={onEmphasisChange}
        wrapperClassName="flex-1"
        className="flex-1"
      />
    );
  } else if (data.type === "string") {
    return (
      <TextField
        value={(rawValue as string) || (animatableValue.default as string)}
        readOnly={playing}
        size={Size.Sm}
        onChange={(v) => handleValueChange(v)}
      />
    );
  } else if (data.type === "boolean") {
    return (
      <TextField
        value={track ? track.name : animatableValue.name}
        readOnly={playing || !track}
        size={Size.Sm}
        onChange={track ? (v) => updateTrack({ id: track.id, name: v }) : undefined}
      />
    );
  } else if (
    animatableValue.type === "vector3" &&
    (attribute === "x" || attribute === "y" || attribute === "z")
  ) {
    const index = indexLookups[animatableValue.type][attribute];
    return (
      <SliderNumberField
        size={Size.Sm}
        strictText={false}
        strictSlider={
          animatableValue.constraints?.min?.[index] !== -Infinity &&
          animatableValue.constraints?.max?.[index] !== Infinity &&
          animatableValue.constraints?.min?.[index] !== undefined &&
          animatableValue.constraints?.max?.[index] !== undefined
        }
        disabled={playing}
        value={
          (rawValue as RawVector3 | undefined)?.[attribute] ??
          (animatableValue.default[attribute] as number)
        }
        min={animatableValue.constraints?.min?.[index] ?? undefined}
        max={animatableValue.constraints?.max?.[index] ?? undefined}
        visualMin={animatableValue.constraints?.min?.[index] ?? 0}
        visualMax={animatableValue.constraints?.max?.[index] ?? 1}
        color={color}
        onChange={(v) => {
          if (attribute === "x") {
            handleValueChange({
              x: v,
              y: (rawValue as RawVector3)?.y ?? animatableValue.default.y,
              z: (rawValue as RawVector3)?.z ?? animatableValue.default.z,
            });
          } else if (attribute === "y") {
            handleValueChange({
              x: (rawValue as RawVector3)?.x ?? animatableValue.default.x,
              y: v,
              z: (rawValue as RawVector3)?.z ?? animatableValue.default.z,
            });
          } else if (attribute === "z") {
            handleValueChange({
              x: (rawValue as RawVector3)?.x ?? animatableValue.default.x,
              y: (rawValue as RawVector3)?.y ?? animatableValue.default.z,
              z: v,
            });
          }
        }}
        units={animatableValue.pub?.units}
        label={attribute}
        highlight={emphasis}
        onHighlightChange={onEmphasisChange}
      />
    );
  } else if (animatableValue.type === "vector2" && (attribute === "x" || attribute === "y")) {
    const index = indexLookups[animatableValue.type][attribute];
    return (
      <SliderNumberField
        size={Size.Sm}
        strictText={false}
        strictSlider={
          animatableValue.constraints?.min?.[index] !== -Infinity &&
          animatableValue.constraints?.max?.[index] !== Infinity &&
          animatableValue.constraints?.min?.[index] !== undefined &&
          animatableValue.constraints?.max?.[index] !== undefined
        }
        disabled={playing}
        value={
          (rawValue as RawVector3 | undefined)?.[attribute] ??
          (animatableValue.default[attribute] as number)
        }
        min={animatableValue.constraints?.min?.[index] ?? undefined}
        max={animatableValue.constraints?.max?.[index] ?? undefined}
        visualMin={animatableValue.constraints?.min?.[index] ?? 0}
        visualMax={animatableValue.constraints?.max?.[index] ?? 1}
        color={color}
        onChange={(v) => {
          if (attribute === "x") {
            handleValueChange({
              x: v,
              y: (rawValue as RawVector2)?.y ?? animatableValue.default.y,
            });
          } else if (attribute === "y") {
            handleValueChange({
              x: (rawValue as RawVector2)?.x ?? animatableValue.default.x,
              y: v,
            });
          }
        }}
        units={animatableValue.pub?.units}
        label={attribute}
        highlight={emphasis}
        onHighlightChange={onEmphasisChange}
      />
    );
  } else if (
    animatableValue.type === "euler" &&
    (attribute === "r" || attribute === "p" || attribute === "y")
  ) {
    const index = indexLookups[animatableValue.type][attribute];
    return (
      <SliderNumberField
        size={Size.Sm}
        units="°"
        strictText={false}
        strictSlider={
          animatableValue.constraints?.min?.[index] !== -Infinity &&
          animatableValue.constraints?.max?.[index] !== Infinity &&
          animatableValue.constraints?.min?.[index] !== undefined &&
          animatableValue.constraints?.max?.[index] !== undefined
        }
        visualMin={0}
        visualMax={360}
        disabled={playing}
        value={toDegrees(
          (rawValue as RawEuler | undefined)?.[attribute] ??
            (animatableValue.default[attribute] as number),
        )}
        min={
          animatableValue.constraints?.min?.[index]
            ? toDegrees(animatableValue.constraints?.min?.[index])
            : undefined
        }
        max={
          animatableValue.constraints?.max?.[index]
            ? toDegrees(animatableValue.constraints?.max?.[index])
            : undefined
        }
        color={color}
        onChange={(v) => {
          const vr = toRadians(v);
          if (attribute === "r") {
            handleValueChange({
              r: vr,
              p: (rawValue as RawEuler)?.p ?? animatableValue.default.p,
              y: (rawValue as RawEuler)?.y ?? animatableValue.default.y,
            });
          } else if (attribute === "p") {
            handleValueChange({
              r: (rawValue as RawEuler)?.r ?? animatableValue.default.r,
              p: vr,
              y: (rawValue as RawEuler)?.y ?? animatableValue.default.y,
            });
          } else if (attribute === "y") {
            handleValueChange({
              r: (rawValue as RawEuler)?.r ?? animatableValue.default.r,
              p: (rawValue as RawEuler)?.p ?? animatableValue.default.p,
              y: vr,
            });
          }
        }}
        label={attribute}
        highlight={emphasis}
        onHighlightChange={onEmphasisChange}
      />
    );
  } else if (
    animatableValue.type === "rgb" &&
    (attribute === "r" || attribute === "g" || attribute === "b")
  ) {
    const index = indexLookups[animatableValue.type][attribute];
    return (
      <SliderNumberField
        size={Size.Sm}
        strictText
        strictSlider
        disabled={playing}
        value={
          (rawValue as RawRGB | undefined)?.[attribute] ??
          ((animatableValue.default as RawRGB)[attribute] as number)
        }
        min={animatableValue.constraints?.min?.[index] ?? undefined}
        max={animatableValue.constraints?.max?.[index] ?? undefined}
        visualMin={animatableValue.constraints?.min?.[index] ?? 0}
        visualMax={animatableValue.constraints?.max?.[index] ?? 1}
        color={color}
        onChange={(v) => {
          if (attribute === "r") {
            handleValueChange({
              r: v,
              g: (rawValue as RawRGB)?.g ?? (animatableValue.default as RawRGB).g,
              b: (rawValue as RawRGB)?.b ?? (animatableValue.default as RawRGB).b,
            });
          } else if (attribute === "g") {
            handleValueChange({
              r: (rawValue as RawRGB)?.r ?? (animatableValue.default as RawRGB).r,
              g: v,
              b: (rawValue as RawRGB)?.b ?? (animatableValue.default as RawRGB).b,
            });
          } else if (attribute === "b") {
            handleValueChange({
              r: (rawValue as RawRGB)?.r ?? (animatableValue.default as RawRGB).r,
              g: (rawValue as RawRGB)?.g ?? (animatableValue.default as RawRGB).g,
              b: v,
            });
          }
        }}
        units={animatableValue.pub?.units}
        label={attribute}
        highlight={emphasis}
        onHighlightChange={onEmphasisChange}
      />
    );
  } else {
    return null;
  }
}

export const AnimatableEditor = memo(InnerAnimatableEditor);
