import { memo, useMemo } from "react";
import { pick } from "lodash";
import { useShallow } from "zustand/react/shallow";
import { useDeep } from "@semio/utils";
import { useAnimationStore, useTrackContext } from "../../hooks";
import { AnimationData } from "../../store-types";
import { computeFrames, computeViolationSet, computeInterpolationSegments } from "../../functions";
import { AnimationCache, InstancedFrameInfo } from "../../types";
import { InterpolationSegment } from "./interpolation-segment";
import { ViolationDisplay } from "./violation-display";
import { FrameMarker } from "./frame-marker";

export interface DataDisplayProps {
  ignoreZoom?: boolean;
  useCustomColor?: boolean;
}

function InnerDataDisplay({ ignoreZoom = false }: DataDisplayProps) {
  const { trackIds } = useTrackContext();

  const dataPreviews = useAnimationStore(
    useShallow((state: AnimationData) => state.preferences.dataPreviews),
  );

  const showPreviews = trackIds.length === 1 && dataPreviews;

  const caches: AnimationCache = useAnimationStore(
    useDeep((state: AnimationData) => pick(state.animationCache, trackIds) as AnimationCache),
  );

  const violations = useAnimationStore(useShallow((state: AnimationData) => state.violations));

  const violationSet = useMemo(() => {
    const filteredViolations = pick(violations, trackIds);
    return computeViolationSet(filteredViolations);
  }, [violations, trackIds]);

  const frameData = useMemo(() => {
    return computeFrames(caches);
  }, [caches]);

  const interps = useMemo(() => {
    return computeInterpolationSegments(frameData, trackIds);
  }, [frameData, trackIds]);

  return (
    <g mask="url(#boundsMask)">
      <ViolationDisplay violationSet={violationSet} ignoreZoom={ignoreZoom} />
      {interps.map(({ start, end }: { start: InstancedFrameInfo; end: InstancedFrameInfo }) => (
        <InterpolationSegment
          key={`${start.id}-${end.id}`}
          showPreviews={showPreviews}
          stamp1={start.stamp}
          stamp2={end.stamp}
          ignoreZoom={ignoreZoom}
        />
      ))}
      {frameData.map((frameInstance: InstancedFrameInfo) => (
        <FrameMarker key={frameInstance.id} data={frameInstance} ignoreZoom={ignoreZoom} />
      ))}
    </g>
  );
}

export const DataDisplay = memo(InnerDataDisplay);
