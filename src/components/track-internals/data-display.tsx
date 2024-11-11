import { memo, useMemo } from "react";
import { pick } from "lodash";
import { useShallow } from "zustand/react/shallow";
import { RawValue, useDeep } from "@semio/utils";
import { useAnimationStore, useTrackContext } from "../../hooks";
import { AnimationData } from "../../store-types";
import { computeFrames, computeViolationSet, computeInterpolationSegments } from "../../functions";
import { InstancedFrameInfo, Track } from "../../types";
import { InterpolationSegment } from "./interpolation-segment";
import { ViolationDisplay } from "./violation-display";
import { FrameMarker } from "./frame-marker";

export interface DataDisplayProps {
  ignoreZoom?: boolean;
  useCustomColor?: boolean;
}

function InnerDataDisplay({ ignoreZoom = false }: DataDisplayProps) {
  const { trackIds } = useTrackContext();

  const tracks: Record<string, Track<RawValue>> = useAnimationStore(
    useDeep(
      (state: AnimationData) => pick(state.tracks, trackIds) as Record<string, Track<RawValue>>,
    ),
  );

  const violations = useAnimationStore(useShallow((state: AnimationData) => state.violations));

  const violationSet = useMemo(() => {
    const filteredViolations = pick(violations, trackIds);
    return computeViolationSet(filteredViolations);
  }, [violations, trackIds]);

  const frameData = useMemo(() => {
    return computeFrames(tracks);
  }, [tracks]);

  const interps = useMemo(() => {
    return computeInterpolationSegments(frameData, trackIds);
  }, [frameData, trackIds]);

  const paddedInterps = padInterps(interps);

  return (
    <g mask="url(#boundsMask)">
      <ViolationDisplay violationSet={violationSet} ignoreZoom={ignoreZoom} />
      {paddedInterps.map(
        ({
          start,
          end,
          buffer,
        }: {
          start: InstancedFrameInfo;
          end: InstancedFrameInfo;
          buffer?: boolean;
        }) => (
          <InterpolationSegment
            key={`${start.id}-${end.id}`}
            start={start}
            end={end}
            pseudoRegion={buffer}
          />
        ),
      )}
      {frameData.map((frameInstance: InstancedFrameInfo) => (
        <FrameMarker key={frameInstance.id} data={frameInstance} ignoreZoom={ignoreZoom} />
      ))}
    </g>
  );
}

export const DataDisplay = memo(InnerDataDisplay);

function padInterps(
  interps: { start: InstancedFrameInfo; end: InstancedFrameInfo }[],
): InstancePair[] {
  const paddedInterps: InstancePair[] = [...interps];
  if (paddedInterps.length === 0) {
    return paddedInterps;
  }
  if (paddedInterps[0].start?.stamp !== 0) {
    paddedInterps.unshift({
      start: { stamp: 0, id: `left-padding-${paddedInterps[0].start.id}`, points: [] },
      end: paddedInterps[0].start,
      buffer: true,
    });
  }
  if (paddedInterps[paddedInterps.length - 1].end?.stamp !== 1) {
    paddedInterps.push({
      start: paddedInterps[paddedInterps.length - 1].end,
      end: {
        stamp: 1,
        id: `right-padding-${paddedInterps[paddedInterps.length - 1].end.id}`,
        points: [],
      },
      buffer: true,
    });
  }
  return paddedInterps;
}

interface InstancePair {
  start: InstancedFrameInfo;
  end: InstancedFrameInfo;
  buffer?: boolean;
}
