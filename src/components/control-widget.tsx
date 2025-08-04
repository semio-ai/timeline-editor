import { useState, memo, useCallback, ReactNode } from "react";
import {
  Button,
  StaticIcon,
  Variant,
  Size,
  Dropdown,
  NestedLabel,
  NestedColorPicker,
  CollapsibleRoot,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@semio/ui";
import { getLookup, RawValue, AnimatableValue, usePlayerStore, PlayerData } from "@semio/utils";
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
import { useAnimationStore, useColors } from "../hooks";
import { AnimationActions, AnimationData } from "../store-types";
import { computeWorldStamp } from "../functions";
import { TrackControl } from "./track-control";
import { AnimatableEditor } from "./animatable-editor";

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

  const updateControlColor = useAnimationStore(
    useShallow((state: AnimationActions) => state.updateControlColor),
  );
  const setValue = useAnimationStore(useShallow((state) => state.setValue));

  const track: Track<RawValue> | undefined = useAnimationStore(
    useShallow((state: AnimationData) => {
      if (!animation) return undefined;
      return (
        loadedTrack ??
        Object.values(state.tracks || {})
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

  const color = useColors(trackId ?? animatableId ?? "");

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
      <div className="grid grid-cols-[64px_16px_1fr_16px] pl-1 pr-2 gap-2 h-9 items-center">
        <WrappedTrackControl
          animationId={animationId}
          animatableValue={animatableValue}
          namespace={namespace}
          keypoint={keypoint}
          track={track}
          handleValueChange={handleValueChange}
        />

        {collapsibleTypes.includes(animatableValue.type) ? (
          <CollapsibleTrigger asChild>
            <Button
              size="fit"
              visuals="inverted"
              color={color}
              leftIcon={
                <IconChevronDown className={open ? "rotate-180 size-3" : "rotate-0 size-3"} />
              }
            />
          </CollapsibleTrigger>
        ) : (
          <StaticIcon size="fit" className="size-3" color={color}>
            {getIcon(animatableValue.pub?.units as string | undefined)}
          </StaticIcon>
        )}
        <div className="flex-1 flex">
          <AnimatableEditor
            animatableValue={animatableValue}
            playing={playing}
            track={track}
            namespace={namespace}
            emphasis={emphasis}
            onEmphasisChange={onEmphasisChange}
            handleValueChange={handleValueChange}
          />
        </div>
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
              disabled={!track}
              value={track?.settings?.color || "#737373"}
              onChange={(v) => {
                updateControlColor(track?.id || "", v);
              }}
            />
          </Dropdown>
        </div>
      </div>
      <CollapsibleContent>
        {(animatableValue.type === "vector3" || animatableValue.type === "euler") && (
          <>
            {["x", "y", "z"].map((prop) => (
              <div
                key={prop}
                className="grid grid-cols-[64px_16px_1fr_12px] gap-2 h-9 items-center"
              >
                <div className="w-16" />
                <StaticIcon size="fit" className="size-4" color={track?.settings?.color}>
                  {getIcon(animatableValue.pub?.units as string | undefined)}
                </StaticIcon>

                <div className="flex-1">
                  <AnimatableEditor
                    animatableValue={animatableValue}
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
                  <AnimatableEditor
                    animatableValue={animatableValue}
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
                  <AnimatableEditor
                    animatableValue={animatableValue}
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

const collapsibleTypes = ["vector3", "euler", "rgb", "hsl"];

interface WrappedTrackControlProps {
  animationId?: string;
  track?: Track<RawValue>;
  namespace: string;
  keypoint?: Keypoint<RawValue>;
  handleValueChange: (value: RawValue) => void;
  animatableValue: AnimatableValue;
}

function InnerWrappedTrackControl({
  animationId,
  track,
  namespace,
  keypoint,
  handleValueChange,
  animatableValue,
}: WrappedTrackControlProps) {
  const rawValueId = getLookup(namespace, animatableValue.id);
  const rawValue: RawValue | undefined = useAnimationStore(
    useShallow((state: AnimationData) => {
      return state.values.get(rawValueId);
    }),
  );
  const removeKeypoint = useAnimationStore(
    useShallow((state: AnimationActions) => state.removeKeypoint),
  );

  const color = useColors(track?.id ?? animatableValue.id);

  return (
    <TrackControl
      disabled={!animationId}
      animationId={animationId}
      namespaceId={namespace}
      trackIds={track ? [track.id] : []}
      filled={keypoint !== undefined}
      color={color}
      onHexClick={() => {
        if (keypoint && track) {
          removeKeypoint(track.id, keypoint.id);
        } else {
          const value = rawValue ?? animatableValue.default;
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
