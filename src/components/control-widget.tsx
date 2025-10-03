import { useState, memo, useRef, useCallback } from "react";
import {
  Button,
  StaticIcon,
  Variant,
  Size,
  Dropdown,
  NestedLabel,
  NestedColorPicker,
  TextField,
} from "@semio/ui";
import { uniq } from "lodash";
import { shallow } from "zustand/shallow";
import { clsx } from "clsx";
import { usePlayerStore, PlayerData, getLookup, RawValue } from "@semio/utils";
import { IconDotsVertical, IconChevronDown } from "@tabler/icons-react";
import { useShallow } from "zustand/react/shallow";
import { type SourceRow, InstancedFrameInfo } from "../types";
import {
  useAnimationStore,
  useColors,
  useLocalGlobalTransformLookup,
  useNames,
  usePlayerSubscription,
  useTrackAnimatableLookup,
} from "../hooks";
import { GROUP_TYPES } from "../constants";
import { AnimationActions, AnimationData } from "../store-types";
import { TrackControl } from "./track-control";
import { AnimatableEditor } from "./animatable-editor";
import { DataIcon } from "./data-icon";

export interface ControlWidgetProps {
  sourceRow: SourceRow;
  emphasis?: boolean;
  onEmphasisChange?: (emphasis: boolean) => void;
}

function InnerControlWidget({ sourceRow, emphasis, onEmphasisChange }: ControlWidgetProps) {
  // const [open, setOpen] = useState(expanded ?? false);
  const computedRowData = useAnimationStore(
    useShallow((state: AnimationData) => state.computedRowData[sourceRow.id]),
  );

  const trackIds = uniq(sourceRow.data.map((d) => d.trackId));
  const allReadonly = sourceRow.data.every((d) => !d.editable);

  const playing = usePlayerStore(useShallow((state: PlayerData) => state.player.running));

  const updateControlColor = useAnimationStore(
    useShallow((state: AnimationActions) => state.updateControlColor),
  );

  const interpolators = useAnimationStore(useShallow((state) => state.trackInterpolators));
  const animatables = useAnimationStore(useShallow((state) => state.animatables));

  const trackAnimatableLookup = useTrackAnimatableLookup();
  const localGlobalTransformLookup = useLocalGlobalTransformLookup();

  const [instancedFrame, setInstancedFrame] = useState<InstancedFrameInfo | undefined>(undefined);
  const stampRef = useRef<number>(0);

  usePlayerSubscription(
    (state) => ({ running: state.player.running, stamp: state.player.stamp }),
    ({ running, stamp }) => {
      stampRef.current = stamp;
      if (running) {
        setInstancedFrame(undefined);
      } else {
        const f = computedRowData?.virtualFrames?.find((s) => s.stamp === stamp);
        setInstancedFrame(f ?? undefined);
      }
    },
    shallow,
  );

  const { updateKeypoints, removeKeypoints, updateTrack, updateSource } = useAnimationStore(
    useShallow((state: AnimationActions & AnimationData) => ({
      updateKeypoints: state.updateKeypoints,
      removeKeypoints: state.removeKeypoints,
      updateTrack: state.updateTrack,
      updateSource: state.updateSource,
    })),
  );

  const updateExpanded = useCallback(
    (expanded: boolean) => {
      updateSource(sourceRow.id, expanded);
    },
    [updateSource, sourceRow.id],
  );

  const color = useColors(trackIds);
  const name = useNames(trackIds);

  const isGroup = sourceRow.data.length !== 1 || GROUP_TYPES.has(sourceRow.data[0].type);
  const iconCode = isGroup ? "group" : sourceRow.data[0].iconCode || "Group";

  return (
    <div className="w-full grid grid-cols-[64px_16px_1fr_16px] pl-1 pr-2 gap-2 h-9 items-center">
      <TrackControl
        disabled={allReadonly}
        source={sourceRow}
        filled={instancedFrame !== undefined}
        color={color}
        onHexClick={() => {
          if (instancedFrame !== undefined) {
            const removals = instancedFrame.points.map((p) => ({
              trackId: p.trackId,
              keypointId: p.id,
            }));
            removeKeypoints(removals);
          } else {
            const datumAnimatablePairs = sourceRow.data.map((datum) => ({
              datum,
              animatableId: trackAnimatableLookup[datum.trackId].id,
            }));
            const updates = datumAnimatablePairs
              .map(({ datum, animatableId }) => {
                const value = interpolators[getLookup(datum.namespaceId, animatableId)]?.value?.(
                  stampRef.current,
                );
                return {
                  trackId: datum.trackId,
                  keypoint: {
                    value,
                    stamp: localGlobalTransformLookup.toLocal[datum.namespaceId](stampRef.current),
                  },
                };
              })
              .filter((u) => u.keypoint.value !== undefined);
            updateKeypoints(updates, true);
          }
        }}
      />
      {isGroup ? (
        <Button
          size="fit"
          visuals="inverted"
          color={color}
          onClick={() => {
            console.log("clicked", sourceRow.expanded);
            updateExpanded(!sourceRow.expanded);
          }}
          leftIcon={
            <IconChevronDown
              className={clsx(
                "transition-transform",
                sourceRow.expanded ? "-rotate-180 size-3" : "rotate-0 size-3",
              )}
            />
          }
        />
      ) : (
        <StaticIcon size="fit" className="size-3" color={color}>
          <DataIcon iconCode={iconCode} size="13px" />
        </StaticIcon>
      )}
      {isGroup ? (
        <TextField
          size={Size.Sm}
          color={color}
          value={name}
          onChange={(val) => {
            trackIds.forEach((id) => {
              updateTrack({ id, name: val });
            });
          }}
        />
      ) : (
        <div className="flex-1 flex min-w-0">
          <AnimatableEditor
            data={sourceRow.data[0]}
            playing={playing}
            emphasis={emphasis}
            onEmphasisChange={onEmphasisChange}
            handleValueChange={(change) => {
              const datumAnimatablePairs = sourceRow.data.map((datum) => ({
                datum,
                animatableId: trackAnimatableLookup[datum.trackId].id,
              }));
              const updates = datumAnimatablePairs
                .map(({ datum, animatableId }) => {
                  const value: RawValue | undefined = interpolators[
                    getLookup(datum.namespaceId, animatableId)
                  ]?.value?.(stampRef.current);
                  const defaultValue = animatables[animatableId].default;
                  if (typeof change === "function") {
                    const newValue = change(value ?? defaultValue);
                    return {
                      trackId: datum.trackId,
                      keypoint: {
                        value: newValue,
                        stamp: localGlobalTransformLookup.toLocal[datum.namespaceId](
                          stampRef.current,
                        ),
                      },
                    };
                  } else {
                    return {
                      trackId: datum.trackId,
                      keypoint: {
                        change,
                        stamp: localGlobalTransformLookup.toLocal[datum.namespaceId](
                          stampRef.current,
                        ),
                      },
                    };
                  }
                })
                .filter((u) => u.keypoint.value !== undefined);
              updateKeypoints(updates, true);
            }}
          />
        </div>
      )}
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
            disabled={trackIds.length > 1}
            value={color}
            onChange={(v) => {
              updateControlColor(trackIds[0], v);
            }}
          />
        </Dropdown>
      </div>
    </div>
  );

  // return (
  //   <CollapsibleRoot
  //     className="w-full"
  //     open={open}
  //     onOpenChange={(v: boolean) => {
  //       setOpen(v);
  //       onExpandedChange?.(v);
  //     }}
  //     disabled={!animatableValue || !collapsibleTypes.includes(animatableValue.type)}
  //   >
  //     <div className="grid grid-cols-[64px_16px_1fr_16px] pl-1 pr-2 gap-2 h-9 items-center">
  //       <WrappedTrackControl
  //         animationId={animationId}
  //         animatableValue={animatableValue}
  //         namespace={namespace}
  //         keypoint={keypoint}
  //         track={track}
  //         handleValueChange={handleValueChange}
  //       />

  //       <div className="flex-1 flex">
  //         <AnimatableEditor
  //           animatableValue={animatableValue}
  //           playing={playing}
  //           track={track}
  //           namespace={namespace}
  //           emphasis={emphasis}
  //           onEmphasisChange={onEmphasisChange}
  //           handleValueChange={handleValueChange}
  //         />
  //       </div>
  //       <div className="w-3 flex items-center justify-around mr-1">
  //         <Dropdown
  //           variant={Variant.Info}
  //           trigger={
  //             <span>
  //               <Button
  //                 size={Size.Xs}
  //                 className="flex items-center justify-center"
  //                 visuals="inverted"
  //                 leftIcon={<IconDotsVertical className="size-3/5" />}
  //               />
  //             </span>
  //           }
  //         >
  //           <NestedLabel>Control Settings</NestedLabel>
  //           <NestedColorPicker
  //             variant={Variant.Info}
  //             disabled={!track}
  //             value={track?.settings?.color || "#737373"}
  //             onChange={(v) => {
  //               updateControlColor(track?.id || "", v);
  //             }}
  //           />
  //         </Dropdown>
  //       </div>
  //     </div>
  //     <CollapsibleContent>
  //       {animatableValue.type === "vector3" && (
  //         <>
  //           {["x", "y", "z"].map((prop) => (
  //             <div
  //               key={prop}
  //               className="grid grid-cols-[64px_16px_1fr_12px] gap-2 h-9 items-center"
  //             >
  //               <div className="w-16" />
  //               <StaticIcon size="fit" className="size-3" color={color}>
  //                 <DataIcon iconCode={animatableValue.pub?.units ?? ""} size="13px" />
  //               </StaticIcon>

  //               <div className="flex-1">
  //                 <AnimatableEditor
  //                   animatableValue={animatableValue}
  //                   playing={playing}
  //                   track={track}
  //                   prop={prop}
  //                   namespace={namespace}
  //                   emphasis={emphasis}
  //                   onEmphasisChange={onEmphasisChange}
  //                   handleValueChange={handleValueChange}
  //                 />
  //               </div>
  //               <div className="min-w-8" />
  //             </div>
  //           ))}
  //         </>
  //       )}
  //       {animatableValue.type === "vector2" && (
  //         <>
  //           {["x", "y"].map((prop) => (
  //             <div
  //               key={prop}
  //               className="grid grid-cols-[64px_16px_1fr_12px] gap-2 h-9 items-center"
  //             >
  //               <div className="w-16" />
  //               <StaticIcon size="fit" className="size-4" color={track?.settings?.color}>
  //                 <DataIcon iconCode={animatableValue.pub?.units ?? ""} size="13px" />
  //               </StaticIcon>

  //               <div className="flex-1">
  //                 <AnimatableEditor
  //                   animatableValue={animatableValue}
  //                   playing={playing}
  //                   track={track}
  //                   prop={prop}
  //                   namespace={namespace}
  //                   emphasis={emphasis}
  //                   onEmphasisChange={onEmphasisChange}
  //                   handleValueChange={handleValueChange}
  //                 />
  //               </div>
  //               <div className="min-w-8" />
  //             </div>
  //           ))}
  //         </>
  //       )}
  //       {animatableValue.type === "euler" && (
  //         <>
  //           {["r", "p", "y"].map((prop) => (
  //             <div
  //               key={prop}
  //               className="grid grid-cols-[64px_16px_1fr_12px] gap-2 h-9 items-center"
  //             >
  //               <div className="w-16" />
  //               <StaticIcon size="fit" className="size-4" color={track?.settings?.color}>
  //                 <DataIcon iconCode={animatableValue.pub?.units ?? ""} size="13px" />
  //               </StaticIcon>

  //               <div className="flex-1">
  //                 <AnimatableEditor
  //                   animatableValue={animatableValue}
  //                   playing={playing}
  //                   track={track}
  //                   prop={prop}
  //                   namespace={namespace}
  //                   emphasis={emphasis}
  //                   onEmphasisChange={onEmphasisChange}
  //                   handleValueChange={handleValueChange}
  //                 />
  //               </div>
  //               <div className="min-w-8" />
  //             </div>
  //           ))}
  //         </>
  //       )}
  //       {animatableValue.type === "rgb" && (
  //         <>
  //           {["r", "g", "b"].map((prop) => (
  //             <div key={prop} className="flex p-1 items-center h-[30px]">
  //               <div className="w-11" />
  //               <StaticIcon size="fit" className="w-3 h-3 pl-1 pr-2" color={track?.settings?.color}>
  //                 <DataIcon iconCode={animatableValue.pub?.units ?? ""} size="13px" />
  //               </StaticIcon>

  //               <div className="flex-1">
  //                 <AnimatableEditor
  //                   animatableValue={animatableValue}
  //                   playing={playing}
  //                   track={track}
  //                   prop={prop}
  //                   namespace={namespace}
  //                   emphasis={emphasis}
  //                   onEmphasisChange={onEmphasisChange}
  //                   handleValueChange={handleValueChange}
  //                 />
  //               </div>
  //               <div className="min-w-8" />
  //             </div>
  //           ))}
  //         </>
  //       )}
  //       {animatableValue.type === "hsl" && (
  //         <>
  //           {["h", "s", "l"].map((prop) => (
  //             <div key={prop} className="flex p-1 items-center h-[30px]">
  //               <div className="w-11" />
  //               <StaticIcon size="fit" className="w-3 h-3 pl-1 pr-2" color={track?.settings?.color}>
  //                 <DataIcon iconCode={animatableValue.pub?.units ?? ""} size="13px" />
  //               </StaticIcon>

  //               <div className="flex-1">
  //                 <AnimatableEditor
  //                   animatableValue={animatableValue}
  //                   playing={playing}
  //                   track={track}
  //                   prop={prop}
  //                   namespace={namespace}
  //                   emphasis={emphasis}
  //                   onEmphasisChange={onEmphasisChange}
  //                   handleValueChange={handleValueChange}
  //                 />
  //               </div>
  //               <div className="min-w-8" />
  //             </div>
  //           ))}
  //         </>
  //       )}
  //     </CollapsibleContent>
  //   </CollapsibleRoot>
  // );
}

export const ControlWidget = memo(InnerControlWidget);

// interface WrappedTrackControlProps {
//   animationId?: string;
//   track?: Track<RawValue>;
//   namespace: string;
//   keypoint?: Keypoint<RawValue>;
//   handleValueChange: (value: RawValue) => void;
//   animatableValue: AnimatableValue;
// }

// function InnerWrappedTrackControl({
//   source,
//   keypoint,
//   handleValueChange,
//   animatableValue,
// }: WrappedTrackControlProps) {
//   const rawValueId = getLookup(namespace, animatableValue.id);
//   const rawValue: RawValue | undefined = useAnimationStore(
//     useShallow((state: AnimationData) => {
//       return state.values.get(rawValueId);
//     }),
//   );
//   const removeKeypoint = useAnimationStore(
//     useShallow((state: AnimationActions) => state.removeKeypoint),
//   );

//   const color = useColors(track?.id ?? animatableValue.id);

//   return (
//     <TrackControl
//       disabled={!animationId}
//       source={track ? [track.id] : []}
//       filled={keypoint !== undefined}
//       color={color}
//       onHexClick={() => {
//         if (keypoint && track) {
//           removeKeypoint(track.id, keypoint.id);
//         } else {
//           const value = rawValue ?? animatableValue.default;
//           handleValueChange(value);
//         }
//       }}
//     />
//   );
// }

// const WrappedTrackControl = memo(InnerWrappedTrackControl);
