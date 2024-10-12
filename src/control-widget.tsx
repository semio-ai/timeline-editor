import { useState, memo } from "react";
import {
  SliderNumberField,
  Size,
  IconButton,
  StaticIcon,
  Variant,
  TextField,
  Dropdown,
  NestedLabel,
  NestedColorPicker,
  CollapsibleRoot,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@semio/ui";
import {
  getLookup,
  RawValue,
  RawVector3,
  RawEuler,
  AnimatableValue,
  toDegrees,
  toRadians,
} from "@semio/utils";
import { IconHash, IconDotsVertical, IconChevronDown } from "@tabler/icons-react";
import { useShallow } from "zustand/react/shallow";
import { type Keypoint } from "./types/keypoint";
import { type Track } from "./types/track";
import { TrackControl } from "./track-control";
import { useAnimationStore } from "./hooks/use-animation-store";
import { AnimationActions, AnimationData } from "./store-types";
import { Control } from "./temp-duplicate-types";

export interface ControlWidgetProps {
  animatableId: string;
  namespace: string;
  onExpandedChange?: (expanded: boolean) => void;
  emphasis?: boolean;
  onEmphasisChange?: (emphasis: boolean) => void;
}

function InnerControlWidget({
  animatableId,
  namespace,
  onExpandedChange,
  emphasis,
  onEmphasisChange,
}: ControlWidgetProps) {
  const [open, setOpen] = useState(false);
  const playing = useAnimationStore(useShallow((state: AnimationData) => state.player.running));
  const animatableValue = useAnimationStore(
    useShallow((state: AnimationData) => state.animatables[animatableId]),
  );

  const rawValueId = getLookup(namespace, animatableId);

  const updateControlColor = useAnimationStore(
    useShallow((state: AnimationActions) => state.updateControlColor),
  );

  const control = useAnimationStore(
    useShallow((state: AnimationData) =>
      Object.values(state.controls).find((c: Control) => c.readId === animatableId),
    ),
  );

  const track = useAnimationStore(
    useShallow((state: AnimationData) => {
      return (
        state.animations[state.activeAnimation]?.tracks?.get(control?.writeId || "") || undefined
      );
    }),
  );

  const keyframe = useAnimationStore(
    useShallow((state: AnimationData) => {
      return state.selectedKeyframe
        ? state.animations[state.activeAnimation].frames.get(state.selectedKeyframe)
        : undefined;
    }),
  );

  const keypoint: Keypoint<RawValue> | undefined = useAnimationStore(
    useShallow((state: AnimationData) => {
      if (!track || !control || !keyframe) {
        return undefined;
      } else {
        return Array.from(state.animations[state.activeAnimation].points.values()).find(
          (p: Keypoint<RawValue>) => {
            return p.track === track.id && p.frame === keyframe.id;
          },
        ) as Keypoint<RawValue> | undefined;
      }
    }),
  );

  return (
    <CollapsibleRoot
      className="w-full"
      open={open}
      onOpenChange={(v: boolean) => {
        setOpen(v);
        onExpandedChange?.(v);
      }}
      disabled={animatableValue.type !== "vector3" && animatableValue.type !== "euler"}
    >
      <div className="flex flex-1 flex-row items-center h-[30px] overflow-hidden">
        <WrappedTrackControl
          animatableValue={animatableValue}
          namespace={namespace}
          keypoint={keypoint}
          rawValueId={rawValueId}
          track={track}
          control={control}
        />
        <div className="flex flex-1 flex-row items-center">
          {animatableValue.type === "vector3" || animatableValue.type === "euler" ? (
            <CollapsibleTrigger asChild>
              <IconButton size="fit" color={control?.settings?.color} className="w-3 h-3 pl-2">
                <IconChevronDown size="13px" className={open ? "rotate-180" : "rotate-0"} />
              </IconButton>
            </CollapsibleTrigger>
          ) : (
            <StaticIcon size="fit" className="w-3 h-3 pl-2" color={control?.settings?.color}>
              {animatableValue.type === "number" && <IconHash size="13px" />}
            </StaticIcon>
          )}
          <div className="flex-1 p-2">
            <Editor
              animatableValue={animatableValue}
              control={control}
              rawValueId={rawValueId}
              playing={playing}
              track={track}
              namespace={namespace}
              emphasis={emphasis}
              onEmphasisChange={onEmphasisChange}
            />
          </div>
          <div className="min-w-6 flex items-center justify-around mr-1">
            <Dropdown
              variant={Variant.Info}
              trigger={
                <span>
                  <IconButton className="flex w-4 items-center justify-center">
                    <IconDotsVertical size="14px" className="text-gray-400" />
                  </IconButton>
                </span>
              }
            >
              <NestedLabel>Control Settings</NestedLabel>
              <NestedColorPicker
                variant={Variant.Info}
                disabled={!control}
                value={control?.settings?.color || "#737373"}
                onChange={(v) => {
                  updateControlColor(control?.id || "", v);
                }}
              />
            </Dropdown>
          </div>
        </div>
      </div>
      <CollapsibleContent>
        {(animatableValue.type === "vector3" || animatableValue.type === "euler") && (
          <>
            {["x", "y", "z"].map((prop) => (
              <div key={prop} className="flex p-1 items-center h-[30px]">
                <div className="w-11" />
                <StaticIcon
                  size="fit"
                  className="w-3 h-3 pl-1 pr-2"
                  color={control?.settings?.color}
                >
                  <IconHash size="13px" />
                </StaticIcon>

                <div className="flex-1">
                  <Editor
                    animatableValue={animatableValue}
                    control={control}
                    rawValueId={rawValueId}
                    playing={playing}
                    track={track}
                    prop={prop}
                    namespace={namespace}
                    emphasis={emphasis}
                    onEmphasisChange={onEmphasisChange}
                  />
                </div>
                <div className="min-w-8" />
              </div>
            ))}
          </>
        )}
      </CollapsibleContent>
    </CollapsibleRoot>
  );
}

export const ControlWidget = memo(InnerControlWidget);

const vectorIndexLookup = {
  x: 0,
  y: 1,
  z: 2,
};

interface EditorProps {
  animatableValue: AnimatableValue;
  control?: Control;
  rawValueId: string;
  namespace: string;
  prop?: string;
  playing: boolean;
  track?: Track;
  emphasis?: boolean;
  onEmphasisChange?: (v: boolean) => void;
}

function InnerEditor({
  animatableValue,
  control,
  rawValueId,
  playing,
  track,
  namespace,
  prop,
  emphasis,
  onEmphasisChange,
}: EditorProps) {
  const animatableId = animatableValue.id;

  const rawValue: RawValue | undefined = useAnimationStore(
    useShallow((state: AnimationData) => {
      return state.values.get(rawValueId);
    }),
  );

  const setValue = useAnimationStore(useShallow((state: AnimationActions) => state.setValue));

  const updateTrack = useAnimationStore(useShallow((state: AnimationActions) => state.updateTrack));

  if (animatableValue.type === "number") {
    return (
      <SliderNumberField
        size={Size.Xs}
        strict
        disabled={playing}
        value={(rawValue as number) ?? (animatableValue.default as number)}
        min={animatableValue.constraints.min}
        max={animatableValue.constraints.max}
        color={control?.settings?.color}
        onChange={(v) => {
          setValue(animatableId, namespace, v);
        }}
        label={track ? track.name : animatableValue.name}
        onLabelChange={track ? (v) => updateTrack(track.id, { name: v }) : undefined}
        emphasis={emphasis}
        onEmphasisChange={onEmphasisChange}
      />
    );
  } else if (animatableValue.type === "string") {
    return (
      <TextField
        value={(rawValue as string) || (animatableValue.default as string)}
        readOnly={playing}
        size={Size.Xs}
        onChange={(v) => {
          setValue(animatableId, namespace, v);
        }}
      />
    );
  } else if (animatableValue.type === "vector3" && !prop) {
    return (
      <TextField
        value={track ? track.name : animatableValue.name}
        readOnly={playing || !track}
        size={Size.Xs}
        onChange={track ? (v) => updateTrack(track.id, { name: v }) : undefined}
      />
    );
  } else if (animatableValue.type === "euler" && !prop) {
    return (
      <TextField
        value={track ? track.name : animatableValue.name}
        readOnly={playing || !track}
        size={Size.Xs}
        onChange={track ? (v) => updateTrack(track.id, { name: v }) : undefined}
      />
    );
  } else if (animatableValue.type === "vector3" && (prop === "x" || prop === "y" || prop === "z")) {
    const index = vectorIndexLookup[prop];
    return (
      <SliderNumberField
        size={Size.Xs}
        strict={
          animatableValue.constraints?.min?.[index] !== -Infinity &&
          animatableValue.constraints?.max?.[index] !== Infinity &&
          animatableValue.constraints?.min?.[index] !== undefined &&
          animatableValue.constraints?.max?.[index] !== undefined
        }
        disabled={playing}
        value={
          (rawValue as RawVector3 | undefined)?.[prop] || (animatableValue.default[prop] as number)
        }
        min={animatableValue.constraints?.min?.[index] ?? undefined}
        max={animatableValue.constraints?.max?.[index] ?? undefined}
        color={control?.settings?.color}
        onChange={(v) => {
          if (prop === "x") {
            setValue(animatableId, namespace, {
              x: v,
              y: (rawValue as RawVector3)?.y || 0,
              z: (rawValue as RawVector3)?.z || 0,
            });
          } else if (prop === "y") {
            setValue(animatableId, namespace, {
              x: (rawValue as RawVector3)?.x || 0,
              y: v,
              z: (rawValue as RawVector3)?.z || 0,
            });
          } else if (prop === "z") {
            setValue(animatableId, namespace, {
              x: (rawValue as RawVector3)?.x || 0,
              y: (rawValue as RawVector3)?.y || 0,
              z: v,
            });
          }
        }}
        label={prop}
        emphasis={emphasis}
        onEmphasisChange={onEmphasisChange}
      />
    );
  } else if (animatableValue.type === "euler" && (prop === "x" || prop === "y" || prop === "z")) {
    const index = vectorIndexLookup[prop];
    return (
      <SliderNumberField
        size={Size.Xs}
        units="°"
        strict={
          animatableValue.constraints?.min?.[index] !== -Infinity &&
          animatableValue.constraints?.max?.[index] !== Infinity &&
          animatableValue.constraints?.min?.[index] !== undefined &&
          animatableValue.constraints?.max?.[index] !== undefined
        }
        disabled={playing}
        value={toDegrees(
          (rawValue as RawEuler | undefined)?.[prop] || (animatableValue.default[prop] as number),
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
        color={control?.settings?.color}
        onChange={(v) => {
          const vr = toRadians(v);
          if (prop === "x") {
            setValue(animatableId, namespace, {
              x: vr,
              y: (rawValue as RawEuler)?.y || animatableValue.default.y,
              z: (rawValue as RawEuler)?.z || animatableValue.default.z,
            });
          } else if (prop === "y") {
            setValue(animatableId, namespace, {
              x: (rawValue as RawEuler)?.x || animatableValue.default.x,
              y: vr,
              z: (rawValue as RawEuler)?.z || animatableValue.default.z,
            });
          } else if (prop === "z") {
            setValue(animatableId, namespace, {
              x: (rawValue as RawEuler)?.x || animatableValue.default.x,
              y: (rawValue as RawEuler)?.y || animatableValue.default.y,
              z: vr,
            });
          }
        }}
        label={prop}
        emphasis={emphasis}
        onEmphasisChange={onEmphasisChange}
      />
    );
  } else {
    return null;
  }
}

const Editor = memo(InnerEditor);

interface WrappedTrackControlProps {
  track?: Track;
  control?: Control;
  namespace: string;
  keypoint?: Keypoint<RawValue>;
  rawValueId: string;
  animatableValue: AnimatableValue;
}

function InnerWrappedTrackControl({
  track,
  control,
  namespace,
  keypoint,
  rawValueId,
  animatableValue,
}: WrappedTrackControlProps) {
  const rawValue: RawValue | undefined = useAnimationStore(
    useShallow((state: AnimationData) => {
      return state.values.get(rawValueId);
    }),
  );

  const [removeKeypoint, setValue] = useAnimationStore((state) => [
    state.removeKeypoint,
    state.setValue,
  ]);

  return (
    <TrackControl
      trackIds={(track?.points?.length || 0) > 0 && track?.id ? [track.id] : undefined}
      filled={keypoint !== undefined}
      color={control?.settings?.color}
      onHexClick={() => {
        if (keypoint) {
          removeKeypoint(keypoint.id);
        } else {
          const value = rawValue || animatableValue.default;
          setValue(animatableValue.id, namespace, value);
        }
      }}
    />
  );
}

const WrappedTrackControl = memo(InnerWrappedTrackControl);
