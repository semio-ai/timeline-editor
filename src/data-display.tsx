import { memo } from "react";
import { useDeep } from "@semio/utils";
import { useAnimationStore } from "./hooks/use-animation-store";
import { FrameMarker } from "./frame-marker";
import { AnimationData } from "./store-types";
import { computeFrames } from "./actions/compute-frames";

export interface DataDisplayProps {
  parentActive: boolean;
}

function InnerDataDisplay({ parentActive }: DataDisplayProps) {
  const { active, passive } = useAnimationStore(
    useDeep((state: AnimationData) => {
      return computeFrames(state, state.visualizedAnimations);
    }),
  );

  return (
    <>
      {Object.keys(passive).map((activeKey) => (
        <FrameMarker
          key={activeKey}
          animation={active[activeKey].animation}
          frame={active[activeKey].frame}
          instanceInfo={active[activeKey].instanceInfo}
          stamp={active[activeKey].stamp}
          parentActive={parentActive}
        />
      ))}
      {Object.keys(active).map((activeKey) => (
        <FrameMarker
          key={activeKey}
          animation={active[activeKey].animation}
          frame={active[activeKey].frame}
          instanceInfo={active[activeKey].instanceInfo}
          stamp={active[activeKey].stamp}
          parentActive={parentActive}
          active
        />
      ))}
    </>
  );
}

export const DataDisplay = memo(InnerDataDisplay);
