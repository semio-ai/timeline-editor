import { useState, memo } from "react";
import {
  SliderNumberField,
  Size,
  Button,
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
  usePlayerStore,
  PlayerData,
} from "@semio/utils";
import { IconHash, IconDotsVertical, IconChevronDown } from "@tabler/icons-react";
import { useShallow } from "zustand/react/shallow";
import { type Keypoint, type Track } from "../types";
import { useAnimationStore } from "../hooks";
import { AnimationActions, AnimationData } from "../store-types";
import { computeWorldStamp } from "../functions";
import { TrackControl } from "./track-control";

export interface ControlWidgetProps {
  animationId: string;
  animatableId: string;
  namespace: string;
  onExpandedChange?: (expanded: boolean) => void;
  emphasis?: boolean;
  onEmphasisChange?: (emphasis: boolean) => void;
}

function InnerControlWidget({
  animationId,
  animatableId,
  namespace,
  onExpandedChange,
  emphasis,
  onEmphasisChange,
}: ControlWidgetProps) {
  const [open, setOpen] = useState(false);
  const playing = usePlayerStore(useShallow((state: PlayerData) => state.player.running));
  const animatableValue = useAnimationStore(
    useShallow((state: AnimationData) => state.animatables[animatableId]),
  );

  const instanceInfo = useAnimationStore(
    useShallow((state: AnimationData) => state.animations[animationId].instances[namespace]),
  );

  const rawValueId = getLookup(namespace, animatableId);

  const updateControlColor = useAnimationStore(
    useShallow((state: AnimationActions) => state.updateControlColor),
  );

  const track: Track<RawValue> | undefined = useAnimationStore(
    useShallow((state: AnimationData) => {
      return Object.values(state.tracks).find((t) => t.animatableId === animatableId) || undefined;
    }),
  );

  const keypoint = usePlayerStore(
    useShallow((state: PlayerData) => {
      return track?.points.find(
        (p) => computeWorldStamp(p.stamp, instanceInfo) === state.player.stamp,
      );
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
          animationId={animationId}
          animatableValue={animatableValue}
          namespace={namespace}
          keypoint={keypoint}
          rawValueId={rawValueId}
          track={track}
        />
        <div className="flex flex-1 flex-row items-center">
          {animatableValue.type === "vector3" || animatableValue.type === "euler" ? (
            <CollapsibleTrigger asChild>
              <Button
                size="fit"
                invert
                color={track?.settings?.color}
                className="w-3 h-3 pl-2"
                leftIcon={
                  <IconChevronDown size="13px" className={open ? "rotate-180" : "rotate-0"} />
                }
              />
            </CollapsibleTrigger>
          ) : (
            <StaticIcon size="fit" className="w-3 h-3 pl-2" color={track?.settings?.color}>
              {animatableValue.type === "number" && <IconHash size="13px" />}
            </StaticIcon>
          )}
          <div className="flex-1 p-2">
            <Editor
              animationId={animationId}
              animatableValue={animatableValue}
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
                  <Button
                    size="fit"
                    className="flex w-4 items-center justify-center"
                    invert
                    leftIcon={<IconDotsVertical size="14px" className="text-gray-400" />}
                  />
                </span>
              }
            >
              <NestedLabel>Control Settings</NestedLabel>
              <NestedColorPicker
                variant={Variant.Info}
                disabled={!track}
                value={track?.settings?.color || "#737373"}
                onChange={(v) => {
                  updateControlColor(track?.id || "", v);
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
                <StaticIcon size="fit" className="w-3 h-3 pl-1 pr-2" color={track?.settings?.color}>
                  <IconHash size="13px" />
                </StaticIcon>

                <div className="flex-1">
                  <Editor
                    animationId={animationId}
                    animatableValue={animatableValue}
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
  animationId: string;
  animatableValue: AnimatableValue;
  rawValueId: string;
  namespace: string;
  prop?: string;
  playing: boolean;
  track?: Track<RawValue>;
  emphasis?: boolean;
  onEmphasisChange?: (v: boolean) => void;
}

function InnerEditor({
  animatableValue,
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
        strictText={false}
        strictSlider={
          animatableValue.constraints.min !== undefined &&
          animatableValue.constraints.max !== undefined &&
          animatableValue.constraints.min !== -Infinity &&
          animatableValue.constraints.max !== Infinity
        }
        disabled={playing}
        value={(rawValue as number) ?? (animatableValue.default as number)}
        min={animatableValue.constraints.min}
        max={animatableValue.constraints.max}
        color={track?.settings?.color}
        onChange={(v) => {
          setValue(animatableId, namespace, v);
        }}
        label={track ? track.name : animatableValue.name}
        onLabelChange={track ? (v) => updateTrack({ id: track.id, name: v }) : undefined}
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
        onChange={track ? (v) => updateTrack({ id: track.id, name: v }) : undefined}
      />
    );
  } else if (animatableValue.type === "euler" && !prop) {
    return (
      <TextField
        value={track ? track.name : animatableValue.name}
        readOnly={playing || !track}
        size={Size.Xs}
        onChange={track ? (v) => updateTrack({ id: track.id, name: v }) : undefined}
      />
    );
  } else if (animatableValue.type === "vector3" && (prop === "x" || prop === "y" || prop === "z")) {
    const index = vectorIndexLookup[prop];
    return (
      <SliderNumberField
        size={Size.Xs}
        strictText={false}
        strictSlider={
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
        color={track?.settings?.color}
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
        strictText={false}
        strictSlider={
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
        color={track?.settings?.color}
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
  animationId: string;
  track?: Track<RawValue>;
  namespace: string;
  keypoint?: Keypoint<RawValue>;
  rawValueId: string;
  animatableValue: AnimatableValue;
}

function InnerWrappedTrackControl({
  animationId,
  track,
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
  const setValue = useAnimationStore(useShallow((state: AnimationActions) => state.setValue));
  const removeKeypoint = useAnimationStore(
    useShallow((state: AnimationActions) => state.removeKeypoint),
  );

  return (
    <TrackControl
      animationId={animationId}
      namespaceId={namespace}
      trackIds={track ? [track.id] : []}
      filled={keypoint !== undefined}
      color={track?.settings?.color}
      onHexClick={() => {
        if (keypoint && track) {
          removeKeypoint(track.id, keypoint.id);
        } else {
          const value = rawValue || animatableValue.default;
          setValue(animatableValue.id, namespace, value);
        }
      }}
    />
  );
}

const WrappedTrackControl = memo(InnerWrappedTrackControl);
