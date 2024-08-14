import { memo } from "react";
import { useDeep } from "@semio/utils";
import { useAnimationStore } from "./hooks/use-animation-store";
import { FrameMarker } from "./frame-marker";
import { AnimationData } from "./store-types";
import { computeFrames } from "./actions/compute-frames";

export interface DataDisplayProps {
  trackIds?: string[];
  disabled?: boolean;
}

function InnerDataDisplay({ trackIds, disabled }: DataDisplayProps) {
  const filter = trackIds || [];
  const { active, passive } = useAnimationStore(
    useDeep((state: AnimationData) => {
      return computeFrames(state, state.visualizedAnimations, filter);
    }),
  );

  return (
    <>
      {Object.keys(passive).map((passiveKey) => (
        <FrameMarker
          key={passiveKey}
          animation={passive[passiveKey].animation}
          frame={passive[passiveKey].frame}
          instanceInfo={passive[passiveKey].instanceInfo}
          stamp={passive[passiveKey].stamp}
          // parentActive={parentActive}
        />
      ))}
      {Object.keys(active).map((activeKey) => (
        <FrameMarker
          key={activeKey}
          animation={active[activeKey].animation}
          frame={active[activeKey].frame}
          instanceInfo={active[activeKey].instanceInfo}
          stamp={active[activeKey].stamp}
          // parentActive={parentActive}
          active={!disabled}
        />
      ))}
    </>
  );
}

export const DataDisplay = memo(InnerDataDisplay);
