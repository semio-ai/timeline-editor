import { memo } from "react";
import { pairwise, useDeep } from "@semio/utils";
import { useAnimationStore } from "./hooks/use-animation-store";
import { FrameMarker } from "./frame-marker";
import { AnimationData } from "./store-types";
import { computeFrames } from "./actions/compute-frames";
import { InterpolationSegment } from "./interpolation-segment";
import { ViolationSet, ViolationType } from "./types";
import { ViolationDisplay } from "./violation-display";

export interface DataDisplayProps {
  trackIds?: string[];
  disabled?: boolean;
  ignoreZoom?: boolean;
  useCustomColor?: boolean;
}

const fakeViolationSet: ViolationSet = {
  id: crypto.randomUUID(),
  namespace: "default",
  violations: {
    violation1: {
      id: "violation1",
      type: ViolationType.Boundary,
      message: "Value exceeds valid range",
      stampRange: [1 / 5, 1 / 2],
      namespace: "default",
      trackId: "track1",
    },
    violation2: {
      id: "violation2",
      type: ViolationType.Velocity,
      message: "Value is changing faster than allowed by velocity limits",
      stampRange: [2 / 5, 3 / 5],
      namespace: "default",
      trackId: "track1",
    },
  },
  segments: [
    {
      id: "segment1",
      stampRange: [1 / 5, 2 / 5],
      violations: ["violation1"],
    },
    {
      id: "segment2",
      stampRange: [2 / 5, 1 / 2],
      violations: ["violation1", "violation2"],
    },
    {
      id: "segment3",
      stampRange: [1 / 2, 3 / 5],
      violations: ["violation2"],
    },
  ],
};

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
          useCustomColor={false}
        />
      ))}
      <ViolationDisplay
        violationSet={fakeViolationSet}
        ignoreZoom={ignoreZoom}
        useCustomColor={useCustomColor}
      />
      {!disabled &&
        interps.map(([s1, s2]) => (
          <InterpolationSegment
            key={`${s1.id}-${s2.id}`}
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
          active={!disabled}
        />
      ))}
    </g>
  );
}

export const DataDisplay = memo(InnerDataDisplay);
