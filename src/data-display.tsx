import { memo } from "react";
import { pairwise, useDeep } from "@semio/utils";
import { useAnimationStore } from "./hooks/use-animation-store";
import { FrameMarker } from "./frame-marker";
import { AnimationData } from "./store-types";
import { computeFrames } from "./actions/compute-frames";
import { InterpolationSegment } from "./interpolation-segment";

export interface DataDisplayProps {
  trackIds?: string[];
  disabled?: boolean;
  ignoreZoom?: boolean;
  useCustomColor?: boolean;
}

function InnerDataDisplay({
  trackIds,
  disabled,
  ignoreZoom = false,
  useCustomColor = false,
}: DataDisplayProps) {
  const filter = trackIds || [];
  const { active, passive } = useAnimationStore(
    useDeep((state: AnimationData) => {
      return computeFrames(state, state.visualizedAnimations, filter);
    }),
  );

  const interps = pairwise(Object.values(active).sort((a) => a.stamp));
  // console.log(interps);

  return (
    <>
      {Object.keys(passive).map((passiveKey) => (
        <FrameMarker
          key={passiveKey}
          animation={passive[passiveKey].animation}
          frame={passive[passiveKey].frame}
          instanceInfo={passive[passiveKey].instanceInfo}
          stamp={passive[passiveKey].stamp}
          ignoreZoom={ignoreZoom}
          useCustomColor={false}
          // parentActive={parentActive}
        />
      ))}
      {!disabled &&
        interps.map(([s1, s2]) => (
          <InterpolationSegment
            key={s1.stamp}
            stamp1={s1.stamp}
            stamp2={s2.stamp}
            ignoreZoom={ignoreZoom}
            useCustomColor={useCustomColor}
          />
        ))}
      {Object.keys(active).map((activeKey) => (
        <FrameMarker
          key={activeKey}
          animation={active[activeKey].animation}
          frame={active[activeKey].frame}
          instanceInfo={active[activeKey].instanceInfo}
          stamp={active[activeKey].stamp}
          ignoreZoom={ignoreZoom}
          useCustomColor={useCustomColor}
          // parentActive={parentActive}
          active={!disabled}
        />
      ))}
    </>
  );
}

export const DataDisplay = memo(InnerDataDisplay);
