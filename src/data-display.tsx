import { memo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAnimationStore } from "./hooks/use-animation-store";
import type { ScaleLinear } from "./scale-linear";
import { computeStamps } from "./actions/compute-stamps";
import Landmark from "./landmark";

export interface DataDisplayProps {
  xScale: ScaleLinear;
  parentActive: boolean;
}

function InnerDataDisplay({ xScale, parentActive }: DataDisplayProps) {
  const stamps = useAnimationStore(
    useShallow((state) => computeStamps(state, state.visualizedAnimations)),
  );

  return (
    <>
      {stamps.map((stamp) => (
        <Landmark
          key={stamp}
          time={stamp}
          xScale={xScale}
          parentActive={parentActive}
        />
      ))}
    </>
  );
}

export const DataDisplay = memo(InnerDataDisplay);
