import { useState, memo, useCallback, ReactNode } from "react";
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
  RawRGB,
} from "@semio/utils";
import {
  IconHash,
  IconDotsVertical,
  IconChevronDown,
  IconAngle,
  IconRuler2,
} from "@tabler/icons-react";
import { useShallow } from "zustand/react/shallow";
import {
  type Keypoint,
  type Track,
  type AnimationInstanceSettings,
  type Animation,
} from "../types";
import { useAnimationStore } from "../hooks";
import { AnimationActions, AnimationData } from "../store-types";
import { computeWorldStamp } from "../functions";
import { TrackControl } from "./track-control";

export interface ControlWidgetProps {
  animationId?: string;
  animatableId?: string;
  instanceSettings: AnimationInstanceSettings;
  trackId?: string;
  namespace: string;
  onExpandedChange?: (expanded: boolean) => void;
  emphasis?: boolean;
  onEmphasisChange?: (emphasis: boolean) => void;
}

function InnerControlWidget({
  animationId,
  animatableId,
  instanceSettings,
  trackId,
  namespace,
  onExpandedChange,
  emphasis,
  onEmphasisChange,
}: ControlWidgetProps) {
  const [open, setOpen] = useState(false);
  const playing = usePlayerStore(useShallow((state: PlayerData) => state.player.running));
  const animation: Animation | undefined = useAnimationStore(
    useShallow((state) => (animationId ? state.animations[animationId] : undefined)),
  );

  const loadedTrack: Track<RawValue> | undefined = useAnimationStore(
    useShallow((state) => state.tracks[trackId ?? ""]),
  );

  const animatableValue = useAnimationStore(
    useShallow((state: AnimationData) => {
      if (loadedTrack) {
        const animatableByTrack = state.animatables[loadedTrack.animatableId ?? ""];
        if (animatableByTrack) {
          return animatableByTrack;
        } else if (state.animatables[animatableId ?? ""]) {
          return state.animatables[animatableId ?? ""];
        } else {
          return undefined;
        }
      }
      return state.animatables[animatableId ?? ""];
    }),
  );
  const rawValueId = getLookup(namespace, animatableValue?.id ?? loadedTrack?.id ?? "");
  // console.log("InnerControlWidget", rawValueId);

  const updateControlColor = useAnimationStore(
    useShallow((state: AnimationActions) => state.updateControlColor),
  );
  const setValue = useAnimationStore(useShallow((state) => state.setValue));

  const track: Track<RawValue> | undefined = useAnimationStore(
    useShallow((state: AnimationData) => {
      if (!animation) return undefined;
      return (
        loadedTrack ??
        Object.values(state.tracks)
          .filter((t) => animation.tracks.includes(t.id))
          .find((t) => t.animatableId === animatableId)
      );
    }),
  );

  const keypoint = usePlayerStore(
    useShallow((state: PlayerData) => {
      return track?.points.find(
        (p) =>
          computeWorldStamp(p.stamp, instanceSettings.timescale, instanceSettings.offset) ===
          state.player.stamp,
      );
    }),
  );

  const createTrack = useAnimationStore(useShallow((state: AnimationActions) => state.createTrack));
  const updateKeypoint = useAnimationStore(
    useShallow((state: AnimationActions) => state.updateKeypoint),
  );

  const handleValueChange = useCallback(
    (value: RawValue) => {
      const currentStamp = usePlayerStore.getState().player.stamp;
      if (!animationId) {
        if (animatableValue) {
          setValue(animatableValue.id, namespace, value);
        }
        return;
      }
      if (track) {
        updateKeypoint(track.id, { stamp: currentStamp, value });
      } else if (animatableValue) {
        createTrack(
          {
            animatableId: animatableValue.id,
            points: [{ id: crypto.randomUUID(), stamp: currentStamp, value }],
          },
          animatableValue.id,
          animationId,
        );
      }
    },
    [track, animatableValue, updateKeypoint, createTrack, animationId, setValue, namespace],
  );

  if (!animatableValue) {
    return <div> No animatable value</div>;
  }

  return (
    <CollapsibleRoot
      className="w-full"
      open={open}
      onOpenChange={(v: boolean) => {
        setOpen(v);
        onExpandedChange?.(v);
      }}
      disabled={!animatableValue || !collapsibleTypes.includes(animatableValue.type)}
    >
      <div className="flex flex-1 flex-row items-center h-[30px] overflow-hidden">
        <WrappedTrackControl
          animationId={animationId}
          animatableValue={animatableValue}
          namespace={namespace}
          keypoint={keypoint}
          rawValueId={rawValueId}
          track={track}
          handleValueChange={handleValueChange}
        />
        <div className="flex flex-1 flex-row items-center">
          {collapsibleTypes.includes(animatableValue.type) ? (
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
              {getIcon(animatableValue.pub?.units as string | undefined)}
            </StaticIcon>
          )}
          <div className="flex-1 p-2">
            <Editor
              animatableValue={animatableValue}
              rawValueId={rawValueId}
              playing={playing}
              track={track}
              namespace={namespace}
              emphasis={emphasis}
              onEmphasisChange={onEmphasisChange}
              handleValueChange={handleValueChange}
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
                  {getIcon(animatableValue.pub?.units as string | undefined)}
                </StaticIcon>

                <div className="flex-1">
                  <Editor
                    animatableValue={animatableValue}
                    rawValueId={rawValueId}
                    playing={playing}
                    track={track}
                    prop={prop}
                    namespace={namespace}
                    emphasis={emphasis}
                    onEmphasisChange={onEmphasisChange}
                    handleValueChange={handleValueChange}
                  />
                </div>
                <div className="min-w-8" />
              </div>
            ))}
          </>
        )}
        {animatableValue.type === "rgb" && (
          <>
            {["r", "g", "b"].map((prop) => (
              <div key={prop} className="flex p-1 items-center h-[30px]">
                <div className="w-11" />
                <StaticIcon size="fit" className="w-3 h-3 pl-1 pr-2" color={track?.settings?.color}>
                  {getIcon(animatableValue.pub?.units as string | undefined)}
                </StaticIcon>

                <div className="flex-1">
                  <Editor
                    animatableValue={animatableValue}
                    rawValueId={rawValueId}
                    playing={playing}
                    track={track}
                    prop={prop}
                    namespace={namespace}
                    emphasis={emphasis}
                    onEmphasisChange={onEmphasisChange}
                    handleValueChange={handleValueChange}
                  />
                </div>
                <div className="min-w-8" />
              </div>
            ))}
          </>
        )}
        {animatableValue.type === "hsl" && (
          <>
            {["h", "s", "l"].map((prop) => (
              <div key={prop} className="flex p-1 items-center h-[30px]">
                <div className="w-11" />
                <StaticIcon size="fit" className="w-3 h-3 pl-1 pr-2" color={track?.settings?.color}>
                  {getIcon(animatableValue.pub?.units as string | undefined)}
                </StaticIcon>

                <div className="flex-1">
                  <Editor
                    animatableValue={animatableValue}
                    rawValueId={rawValueId}
                    playing={playing}
                    track={track}
                    prop={prop}
                    namespace={namespace}
                    emphasis={emphasis}
                    onEmphasisChange={onEmphasisChange}
                    handleValueChange={handleValueChange}
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
  r: 0,
  g: 1,
  b: 2,
  h: 0,
  s: 1,
  l: 2,
};

const collapsibleTypes = ["vector3", "euler", "rgb", "hsl"];

interface EditorProps {
  animatableValue: AnimatableValue;
  rawValueId: string;
  namespace: string;
  prop?: string;
  playing: boolean;
  track?: Track<RawValue>;
  emphasis?: boolean;
  onEmphasisChange?: (v: boolean) => void;
  handleValueChange: (value: RawValue) => void;
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
  handleValueChange,
}: EditorProps) {
  void namespace;

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
        size={Size.Xs}
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
        color={track?.settings?.color}
        onChange={(v) => handleValueChange(renderInverse(v))}
        label={track ? track.name : animatableValue.name}
        onLabelChange={track ? (v) => updateTrack({ id: track.id, name: v }) : undefined}
        emphasis={emphasis}
        units={animatableValue.pub?.units === "rad" ? "°" : animatableValue.pub?.units}
        onEmphasisChange={onEmphasisChange}
      />
    );
  } else if (animatableValue.type === "string") {
    return (
      <TextField
        value={(rawValue as string) || (animatableValue.default as string)}
        readOnly={playing}
        size={Size.Xs}
        onChange={(v) => handleValueChange(v)}
      />
    );
  } else if (collapsibleTypes.includes(animatableValue.type) && !prop) {
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
        visualMin={animatableValue.constraints?.min?.[index] ?? 0}
        visualMax={animatableValue.constraints?.max?.[index] ?? 1}
        color={track?.settings?.color}
        onChange={(v) => {
          if (prop === "x") {
            handleValueChange({
              x: v,
              y: (rawValue as RawVector3)?.y || 0,
              z: (rawValue as RawVector3)?.z || 0,
            });
          } else if (prop === "y") {
            handleValueChange({
              x: (rawValue as RawVector3)?.x || 0,
              y: v,
              z: (rawValue as RawVector3)?.z || 0,
            });
          } else if (prop === "z") {
            handleValueChange({
              x: (rawValue as RawVector3)?.x || 0,
              y: (rawValue as RawVector3)?.y || 0,
              z: v,
            });
          }
        }}
        units={animatableValue.pub?.units}
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
        visualMin={0}
        visualMax={360}
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
            handleValueChange({
              x: vr,
              y: (rawValue as RawEuler)?.y || animatableValue.default.y,
              z: (rawValue as RawEuler)?.z || animatableValue.default.z,
            });
          } else if (prop === "y") {
            handleValueChange({
              x: (rawValue as RawEuler)?.x || animatableValue.default.x,
              y: vr,
              z: (rawValue as RawEuler)?.z || animatableValue.default.z,
            });
          } else if (prop === "z") {
            handleValueChange({
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
  } else if (animatableValue.type === "rgb" && (prop === "r" || prop === "g" || prop === "b")) {
    const index = vectorIndexLookup[prop];
    return (
      <SliderNumberField
        size={Size.Xs}
        strictText
        strictSlider
        disabled={playing}
        value={
          (rawValue as RawRGB | undefined)?.[prop] ||
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
              g: (rawValue as RawRGB)?.g || 0,
              b: (rawValue as RawRGB)?.b || 0,
            });
          } else if (prop === "g") {
            handleValueChange({
              r: (rawValue as RawRGB)?.r || 0,
              g: v,
              b: (rawValue as RawRGB)?.b || 0,
            });
          } else if (prop === "b") {
            handleValueChange({
              r: (rawValue as RawRGB)?.r || 0,
              g: (rawValue as RawRGB)?.g || 0,
              b: v,
            });
          }
        }}
        units={animatableValue.pub?.units}
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
  animationId?: string;
  track?: Track<RawValue>;
  namespace: string;
  keypoint?: Keypoint<RawValue>;
  rawValueId: string;
  handleValueChange: (value: RawValue) => void;
  animatableValue: AnimatableValue;
}

function InnerWrappedTrackControl({
  animationId,
  track,
  namespace,
  keypoint,
  rawValueId,
  handleValueChange,
  animatableValue,
}: WrappedTrackControlProps) {
  const rawValue: RawValue | undefined = useAnimationStore(
    useShallow((state: AnimationData) => {
      return state.values.get(rawValueId);
    }),
  );
  const removeKeypoint = useAnimationStore(
    useShallow((state: AnimationActions) => state.removeKeypoint),
  );

  return (
    <TrackControl
      disabled={!animationId}
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
          handleValueChange(value);
        }
      }}
    />
  );
}

const WrappedTrackControl = memo(InnerWrappedTrackControl);

function getIcon(unitString: string | undefined): ReactNode {
  if (unitString === "rad") {
    return <IconAngle size="13px" />;
  } else if (unitString === "m") {
    return <IconRuler2 size="13px" />;
  } else {
    return <IconHash size="13px" />;
  }
}
