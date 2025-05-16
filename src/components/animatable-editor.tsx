import { memo } from "react";
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
} from "@semio/utils";
import { useShallow } from "zustand/react/shallow";
import { type Track } from "../types";
import { useAnimationStore } from "../hooks";
import { AnimationActions, AnimationData } from "../store-types";

const collapsibleTypes = ["vector3", "euler", "rgb", "hsl"];
const vectorIndexLookup = {
  x: 0,
  y: 1,
  z: 2,
  r: 0,
  g: 1,
  b: 2,
  h: 0,
  s: 1,
  l: 2,
};

export interface AnimatableEditorProps {
  animatableValue: AnimatableValue;
  namespace: string;
  prop?: string;
  playing: boolean;
  track?: Track<RawValue>;
  emphasis?: boolean;
  onEmphasisChange?: (v: boolean) => void;
  handleValueChange: (value: RawValue) => void;
}

function InnerAnimatableEditor({
  animatableValue,
  playing,
  track,
  namespace,
  prop,
  emphasis,
  onEmphasisChange,
  handleValueChange,
}: AnimatableEditorProps) {
  const rawValueId = getLookup(namespace, animatableValue.id);

  const rawValue: RawValue | undefined = useAnimationStore(
    useShallow((state: AnimationData) => {
      return state.values.get(rawValueId);
    }),
  );

  const updateTrack = useAnimationStore(useShallow((state: AnimationActions) => state.updateTrack));

  if (animatableValue.type === "number") {
    const renderTransformer = animatableValue.pub?.units === "rad" ? toDegrees : (v: number) => v;
    const renderInverse = animatableValue.pub?.units === "rad" ? toRadians : (v: number) => v;

    const min =
      animatableValue.constraints.min !== undefined
        ? renderTransformer(animatableValue.constraints.min)
        : undefined;
    const max =
      animatableValue.constraints.max !== undefined
        ? renderTransformer(animatableValue.constraints.max)
        : undefined;

    return (
      <SliderNumberField
        size={Size.Sm}
        strictText={false}
        strictSlider={
          animatableValue.constraints.min !== undefined &&
          animatableValue.constraints.max !== undefined &&
          animatableValue.constraints.min !== -Infinity &&
          animatableValue.constraints.max !== Infinity
        }
        disabled={playing}
        value={renderTransformer((rawValue as number) ?? (animatableValue.default as number))}
        min={min}
        max={max}
        color={track?.settings?.color ?? animatableValue?.pub?.color}
        onChange={(v) => handleValueChange(renderInverse(v))}
        label={track ? track.name : animatableValue.name}
        onLabelChange={track ? (v) => updateTrack({ id: track.id, name: v }) : undefined}
        highlight={emphasis}
        units={animatableValue.pub?.units === "rad" ? "°" : animatableValue.pub?.units}
        onHighlightChange={onEmphasisChange}
        wrapperClassName="flex-1"
        className="flex-1"
      />
    );
  } else if (animatableValue.type === "string") {
    return (
      <TextField
        value={(rawValue as string) || (animatableValue.default as string)}
        readOnly={playing}
        size={Size.Sm}
        onChange={(v) => handleValueChange(v)}
      />
    );
  } else if (collapsibleTypes.includes(animatableValue.type) && !prop) {
    return (
      <TextField
        value={track ? track.name : animatableValue.name}
        readOnly={playing || !track}
        size={Size.Sm}
        onChange={track ? (v) => updateTrack({ id: track.id, name: v }) : undefined}
      />
    );
  } else if (animatableValue.type === "vector3" && (prop === "x" || prop === "y" || prop === "z")) {
    const index = vectorIndexLookup[prop];
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
          (rawValue as RawVector3 | undefined)?.[prop] ?? (animatableValue.default[prop] as number)
        }
        min={animatableValue.constraints?.min?.[index] ?? undefined}
        max={animatableValue.constraints?.max?.[index] ?? undefined}
        visualMin={animatableValue.constraints?.min?.[index] ?? 0}
        visualMax={animatableValue.constraints?.max?.[index] ?? 1}
        color={track?.settings?.color}
        onChange={(v) => {
          if (prop === "x") {
            handleValueChange({
              x: v,
              y: (rawValue as RawVector3)?.y ?? animatableValue.default.y,
              z: (rawValue as RawVector3)?.z ?? animatableValue.default.z,
            });
          } else if (prop === "y") {
            handleValueChange({
              x: (rawValue as RawVector3)?.x ?? animatableValue.default.x,
              y: v,
              z: (rawValue as RawVector3)?.z ?? animatableValue.default.z,
            });
          } else if (prop === "z") {
            handleValueChange({
              x: (rawValue as RawVector3)?.x ?? animatableValue.default.x,
              y: (rawValue as RawVector3)?.y ?? animatableValue.default.z,
              z: v,
            });
          }
        }}
        units={animatableValue.pub?.units}
        label={prop}
        highlight={emphasis}
        onHighlightChange={onEmphasisChange}
      />
    );
  } else if (animatableValue.type === "euler" && (prop === "x" || prop === "y" || prop === "z")) {
    const index = vectorIndexLookup[prop];
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
          (rawValue as RawEuler | undefined)?.[prop] ?? (animatableValue.default[prop] as number),
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
        color={track?.settings?.color}
        onChange={(v) => {
          const vr = toRadians(v);
          if (prop === "x") {
            handleValueChange({
              x: vr,
              y: (rawValue as RawEuler)?.y ?? animatableValue.default.y,
              z: (rawValue as RawEuler)?.z ?? animatableValue.default.z,
            });
          } else if (prop === "y") {
            handleValueChange({
              x: (rawValue as RawEuler)?.x ?? animatableValue.default.x,
              y: vr,
              z: (rawValue as RawEuler)?.z ?? animatableValue.default.z,
            });
          } else if (prop === "z") {
            handleValueChange({
              x: (rawValue as RawEuler)?.x ?? animatableValue.default.x,
              y: (rawValue as RawEuler)?.y ?? animatableValue.default.y,
              z: vr,
            });
          }
        }}
        label={prop}
        highlight={emphasis}
        onHighlightChange={onEmphasisChange}
      />
    );
  } else if (animatableValue.type === "rgb" && (prop === "r" || prop === "g" || prop === "b")) {
    const index = vectorIndexLookup[prop];
    return (
      <SliderNumberField
        size={Size.Sm}
        strictText
        strictSlider
        disabled={playing}
        value={
          (rawValue as RawRGB | undefined)?.[prop] ??
          ((animatableValue.default as RawRGB)[prop] as number)
        }
        min={animatableValue.constraints?.min?.[index] ?? undefined}
        max={animatableValue.constraints?.max?.[index] ?? undefined}
        visualMin={animatableValue.constraints?.min?.[index] ?? 0}
        visualMax={animatableValue.constraints?.max?.[index] ?? 1}
        color={track?.settings?.color}
        onChange={(v) => {
          if (prop === "r") {
            handleValueChange({
              r: v,
              g: (rawValue as RawRGB)?.g ?? (animatableValue.default as RawRGB).g,
              b: (rawValue as RawRGB)?.b ?? (animatableValue.default as RawRGB).b,
            });
          } else if (prop === "g") {
            handleValueChange({
              r: (rawValue as RawRGB)?.r ?? (animatableValue.default as RawRGB).r,
              g: v,
              b: (rawValue as RawRGB)?.b ?? (animatableValue.default as RawRGB).b,
            });
          } else if (prop === "b") {
            handleValueChange({
              r: (rawValue as RawRGB)?.r ?? (animatableValue.default as RawRGB).r,
              g: (rawValue as RawRGB)?.g ?? (animatableValue.default as RawRGB).g,
              b: v,
            });
          }
        }}
        units={animatableValue.pub?.units}
        label={prop}
        highlight={emphasis}
        onHighlightChange={onEmphasisChange}
      />
    );
  } else {
    return null;
  }
}

export const AnimatableEditor = memo(InnerAnimatableEditor);
