import { memo, useMemo } from "react";
import { pick } from "lodash";
import { useShallow } from "zustand/react/shallow";
import { pairwise, useDeep } from "@semio/utils";
import { useAnimationStore } from "./hooks/use-animation-store";
import { FrameMarker } from "./frame-marker";
import { AnimationData } from "./store-types";
import { computeFrames } from "./functions/compute-frames";
import { computeViolationSet } from "./functions/compute-violation-set";
import { InterpolationSegment } from "./interpolation-segment";
import { ViolationDisplay } from "./violation-display";

export interface DataDisplayProps {
  trackIds?: string[];
  disabled?: boolean;
  ignoreZoom?: boolean;
  useCustomColor?: boolean;
}

function InnerDataDisplay({ trackIds, disabled, ignoreZoom = false }: DataDisplayProps) {
  const filter = useMemo(() => trackIds || [], [trackIds]);
  const { active, passive } = useAnimationStore(
    useDeep((state: AnimationData) => {
      return computeFrames(state, state.visualizedAnimations, filter);
    }),
  );

  const violations = useAnimationStore(useShallow((state: AnimationData) => state.violations));

  const violationSet = useMemo(() => {
    const filteredViolations = filter.length === 0 ? violations : pick(violations, filter);
    return computeViolationSet(filteredViolations);
  }, [violations, filter]);

  const interps = pairwise(Object.values(active).sort((a, b) => a.stamp - b.stamp));

  return (
    <g mask="url(#boundsMask)">
      {Object.keys(passive).map((passiveKey) => (
        <FrameMarker
          key={passiveKey}
          animation={passive[passiveKey].animation}
          frame={passive[passiveKey].frame}
          instanceInfo={passive[passiveKey].instanceInfo}
          stamp={passive[passiveKey].stamp}
          ignoreZoom={ignoreZoom}
        />
      ))}
      <ViolationDisplay violationSet={violationSet} ignoreZoom={ignoreZoom} />
      {!disabled &&
        interps.map(([s1, s2]) => (
          <InterpolationSegment
            key={`${s1.id}-${s2.id}`}
            stamp1={s1.stamp}
            stamp2={s2.stamp}
            ignoreZoom={ignoreZoom}
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
          active={!disabled}
        />
      ))}
    </g>
  );
}

export const DataDisplay = memo(InnerDataDisplay);
