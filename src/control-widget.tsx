import { useState, useCallback } from "react";
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
  toDegrees,
  toRadians,
} from "@semio/utils";
import {
  IconHash,
  IconDotsVertical,
  IconChevronDown,
} from "@tabler/icons-react";
import { useShallow } from "zustand/react/shallow";
import { type Keypoint } from "./types/keypoint";
import { TrackControl } from "./track-control";
import { useAnimationStore } from "./hooks/use-animation-store";
import { AnimationActions, AnimationData } from "./store-types";
import { Control } from "./temp-duplicate-types";

export interface ControlWidgetProps {
  animatedId: string;
  namespace: string;
  onExpandedChange: (expanded: boolean) => void;
}

export function ControlWidget({
  animatedId,
  namespace,
  onExpandedChange,
}: ControlWidgetProps) {
  const [open, setOpen] = useState(false);
  const playing = useAnimationStore(
    useShallow((state: AnimationData) => state.player.running),
  );
  const av = useAnimationStore(
    useShallow((state: AnimationData) => state.animatables[animatedId]),
  );
  const setValue = useAnimationStore(
    useShallow((state: AnimationActions) => state.setValue),
  );
  const rawValue = useAnimationStore(
    useShallow((state: AnimationData) => {
      const lookupId = getLookup(namespace, animatedId);
      return state.values.get(lookupId);
    }),
  );

  const deleteKeypoint = useAnimationStore(
    useShallow((state: AnimationActions) => state.removeKeypoint),
  );

  const updateTrack = useAnimationStore(
    useShallow((state: AnimationActions) => state.updateTrack),
  );
  const updateControlColor = useAnimationStore(
    useShallow((state: AnimationActions) => state.updateControlColor),
  );

  const control = useAnimationStore(
    useShallow((state: AnimationData) =>
      Object.values(state.controls).find(
        (c: Control) => c.readId === animatedId,
      ),
    ),
  );

  const track = useAnimationStore(
    useShallow((state: AnimationData) => {
      return (
        state.animations[state.activeAnimation]?.tracks?.get(
          control?.writeId || "",
        ) || undefined
      );
    }),
  );

  const keyframe = useAnimationStore(
    useShallow((state: AnimationData) => {
      return state.selectedKeyframe
        ? state.animations[state.activeAnimation].frames.get(
            state.selectedKeyframe,
          )
        : undefined;
    }),
  );

  const keypoint: Keypoint<RawValue> | undefined = useAnimationStore(
    useShallow((state: AnimationData) => {
      if (!track || !control || !keyframe) {
        return undefined;
      } else {
        return [
          ...state.animations[state.activeAnimation].points.values(),
        ].find((p: Keypoint<RawValue>) => {
          return p.track === track.id && p.frame === keyframe.id;
        }) as Keypoint<RawValue> | undefined;
      }
    }),
  );

  const getEditor = useCallback(
    (rv?: RawValue, prop?: string) => {
      if (av.type === "number") {
        return (
          <SliderNumberField
            size={Size.Xs}
            strict
            disabled={playing}
            value={(rv as number) || (av.default as number)}
            min={av.constraints.min || -Math.PI * 2}
            max={av.constraints.max || Math.PI * 2}
            color={control?.settings?.color}
            onChange={(v) => {
              setValue(animatedId, namespace, v);
            }}
            label={track ? track.name : av.name}
            onLabelChange={
              track ? (v) => updateTrack(track.id, { name: v }) : undefined
            }
          />
        );
      } else if (av.type === "string") {
        return (
          <TextField
            value={(rv as string) || (av.default as string)}
            readOnly={playing}
            size={Size.Xs}
            onChange={(v) => {
              setValue(animatedId, namespace, v);
            }}
          />
        );
      } else if (av.type === "vector3" && !prop) {
        return (
          <TextField
            value={track ? track.name : av.name}
            readOnly={playing || !track}
            size={Size.Xs}
            onChange={
              track ? (v) => updateTrack(track.id, { name: v }) : undefined
            }
          />
        );
      } else if (av.type === "euler" && !prop) {
        return (
          <TextField
            value={track ? track.name : av.name}
            readOnly={playing || !track}
            size={Size.Xs}
            onChange={
              track ? (v) => updateTrack(track.id, { name: v }) : undefined
            }
          />
        );
      } else if (
        av.type === "vector3" &&
        (prop === "x" || prop === "y" || prop === "z")
      ) {
        const index = vectorIndexLookup[prop];
        return (
          <SliderNumberField
            size={Size.Xs}
            strict={
              av.constraints?.min?.[index] !== -Infinity &&
              av.constraints?.max?.[index] !== Infinity &&
              av.constraints?.min?.[index] !== undefined &&
              av.constraints?.max?.[index] !== undefined
            }
            disabled={playing}
            value={
              (rv as RawVector3 | undefined)?.[prop] ||
              (av.default[prop] as number)
            }
            min={av.constraints?.min?.[index] || -10}
            max={av.constraints?.max?.[index] || 10}
            color={control?.settings?.color}
            onChange={(v) => {
              if (prop === "x") {
                setValue(animatedId, namespace, {
                  x: v,
                  y: (rv as RawVector3)?.y || 0,
                  z: (rv as RawVector3)?.z || 0,
                });
              } else if (prop === "y") {
                setValue(animatedId, namespace, {
                  x: (rv as RawVector3)?.x || 0,
                  y: v,
                  z: (rv as RawVector3)?.z || 0,
                });
              } else if (prop === "z") {
                setValue(animatedId, namespace, {
                  x: (rv as RawVector3)?.x || 0,
                  y: (rv as RawVector3)?.y || 0,
                  z: v,
                });
              }
            }}
            label={prop}
          />
        );
      } else if (
        av.type === "euler" &&
        (prop === "x" || prop === "y" || prop === "z")
      ) {
        const index = vectorIndexLookup[prop];
        return (
          <SliderNumberField
            size={Size.Xs}
            units="°"
            strict={
              av.constraints?.min?.[index] !== -Infinity &&
              av.constraints?.max?.[index] !== Infinity &&
              av.constraints?.min?.[index] !== undefined &&
              av.constraints?.max?.[index] !== undefined
            }
            disabled={playing}
            value={toDegrees(
              (rv as RawEuler | undefined)?.[prop] ||
                (av.default[prop] as number),
            )}
            min={toDegrees(av.constraints?.min?.[index] || -Math.PI * 2)}
            max={toDegrees(av.constraints?.max?.[index] || Math.PI * 2)}
            color={control?.settings?.color}
            onChange={(v) => {
              const vr = toRadians(v);
              if (prop === "x") {
                setValue(animatedId, namespace, {
                  x: vr,
                  y: (rv as RawEuler)?.y || av.default.y,
                  z: (rv as RawEuler)?.z || av.default.z,
                });
              } else if (prop === "y") {
                setValue(animatedId, namespace, {
                  x: (rv as RawEuler)?.x || av.default.x,
                  y: vr,
                  z: (rv as RawEuler)?.z || av.default.z,
                });
              } else if (prop === "z") {
                setValue(animatedId, namespace, {
                  x: (rv as RawEuler)?.x || av.default.x,
                  y: (rv as RawEuler)?.y || av.default.y,
                  z: vr,
                });
              }
            }}
            label={prop}
          />
        );
      } else {
        return null;
      }
    },
    [
      av,
      animatedId,
      namespace,
      setValue,
      updateTrack,
      track,
      playing,
      control?.settings,
    ],
  );

  return (
    <CollapsibleRoot
      className="w-full"
      open={open}
      onOpenChange={(v: boolean) => {
        setOpen(v);
        onExpandedChange(v);
      }}
      disabled={av.type !== "vector3" && av.type !== "euler"}
    >
      <div className="flex flex-1 flex-row items-center h-[30px]">
        <TrackControl
          trackIds={
            (track?.points?.length || 0) > 0 && track?.id
              ? [track.id]
              : undefined
          }
          filled={keypoint !== undefined}
          color={control?.settings?.color}
          onHexClick={() => {
            if (keypoint) {
              deleteKeypoint(keypoint.id);
            } else {
              const value = rawValue || av.default;
              setValue(animatedId, namespace, value);
            }
          }}
        />
        <div className="flex flex-1 flex-row items-center">
          {av.type === "vector3" || av.type === "euler" ? (
            <CollapsibleTrigger asChild>
              <IconButton
                size="fit"
                color={control?.settings?.color}
                className="w-3 h-3 pl-2"
              >
                <IconChevronDown
                  size="13px"
                  className={open ? "rotate-180" : "rotate-0"}
                />
              </IconButton>
            </CollapsibleTrigger>
          ) : (
            <StaticIcon
              size="fit"
              className="w-3 h-3 pl-2"
              color={control?.settings?.color}
            >
              {av.type === "number" && <IconHash size="13px" />}
            </StaticIcon>
          )}
          <div className="flex-1 p-2">{getEditor(rawValue)}</div>
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
        {(av.type === "vector3" || av.type === "euler") && (
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

                <div className="flex-1">{getEditor(rawValue, prop)}</div>
                <div className="min-w-8" />
              </div>
            ))}
          </>
        )}
      </CollapsibleContent>
    </CollapsibleRoot>
  );
}

const vectorIndexLookup = {
  x: 0,
  y: 1,
  z: 2,
};
