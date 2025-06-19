import { memo, useMemo, useRef, useState } from "react";
import { pick, uniq } from "lodash";
import { useShallow } from "zustand/react/shallow";
import { overlappingSegments, RawValue, useDeepSelector } from "@semio/utils";
import { useAnimationStore, useTrackContext, useTrackTransformSpring } from "../../hooks";
import { AnimationData } from "../../store-types";
import { computeFrames, computeViolationSet, computeInterpolationSegments } from "../../functions";
import { InstancedFrameInfo, Track } from "../../types";
import { TIMELINE_PADDING } from "../../constants";
import { InterpolationSegment } from "./interpolation-segment";
import { ViolationDisplay } from "./violation-display";
import { FrameMarker } from "./frame-marker";

export interface DataDisplayProps {
  ignoreZoom?: boolean;
  useCustomColor?: boolean;
  showFullLine?: boolean;
}

function InnerDataDisplay({ ignoreZoom = false, showFullLine = false }: DataDisplayProps) {
  const { trackIds, bounds } = useTrackContext();

  // keep track of which tracks are being dragged,
  // so that we can prevent them from being merged until keydown.
  const [draggingFrames, setDraggingFrames] = useState<string[]>([]);

  const groupRef = useRef<SVGSVGElement>(null);

  const tracks: Record<string, Track<RawValue>> = useAnimationStore(
    useDeepSelector(
      (state: AnimationData) => pick(state.tracks, trackIds) as Record<string, Track<RawValue>>,
    ),
  );

  const violations = useAnimationStore(useShallow((state: AnimationData) => state.violations));

  const violationSet = useMemo(() => {
    const filteredViolations = pick(violations, trackIds);
    return computeViolationSet(filteredViolations);
  }, [violations, trackIds]);

  const frameData: InstancedFrameInfo[] = useMemo(() => {
    return computeFrames(tracks, draggingFrames);
  }, [tracks, draggingFrames]);

  const interps = useMemo(() => {
    return computeInterpolationSegments(frameData, trackIds);
  }, [frameData, trackIds]);

  const paddedInterps = useMemo(() => fillInterpGaps(interps), [interps]);

  const transformSpring = useTrackTransformSpring(ignoreZoom, false);

  transformSpring.on("change", (t) => {
    groupRef.current?.setAttribute("transform", t);
  });

  return (
    <g mask="url(#boundsMask)">
      {/* We have to put in a dummy rectangle so that the bounds mask applies correctly */}
      <rect
        x={0}
        height={bounds.height}
        width={bounds.width + TIMELINE_PADDING * 2}
        y={0}
        fill="transparent"
        className="pointer-events-none"
      />
      <g ref={groupRef} transform={transformSpring.get()}>
        <ViolationDisplay violationSet={violationSet} ignoreZoom={ignoreZoom} />

        <g mask="url(#keyMask)">
          {paddedInterps.map(
            (
              {
                start,
                end,
                buffer,
              }: {
                start: InstancedFrameInfo;
                end: InstancedFrameInfo;
                buffer?: boolean;
              },
              idx: number,
            ) => (
              <InterpolationSegment
                key={`${start.id}-${end.id}`}
                start={start}
                end={end}
                pseudoRegion={buffer}
                isInitial={idx === 0}
                isFinal={idx === paddedInterps.length - 1}
                showFullLine={showFullLine}
              />
            ),
          )}
        </g>

        {frameData.map((frameInstance: InstancedFrameInfo) => (
          <FrameMarker
            key={frameInstance.id}
            data={frameInstance}
            ignoreZoom={ignoreZoom}
            onDragStart={() => {
              // Update the set of dragging frames based on the frame instance
              const ids = uniq(frameInstance.points.map((p) => p.id));
              console.log("Setting dragging frames to", ids);
              setDraggingFrames(ids);
            }}
            onDragEnd={() => {
              // Clear the dragging tracks when the drag ends
              console.log("Setting dragging frames to empty");
              setDraggingFrames([]);
            }}
          />
        ))}
      </g>
    </g>
  );
}

export const DataDisplay = memo(InnerDataDisplay);

function fillInterpGaps(
  interps: { start: InstancedFrameInfo; end: InstancedFrameInfo }[],
): InstancePair[] {
  // Compute gaps where no interpolations exist. Since these may be overlapping,
  // we should compute the overlapping segments first, and then fill in the gaps.
  const overlapping = overlappingSegments([
    [-Infinity, 0],
    ...(interps.map((i) => [i.start.stamp, i.end.stamp]) as [number, number][]),
    [1, Infinity],
  ]);

  if (overlapping.length > 1) {
    const fill: InstancePair[] = [];
    // If the length is greater than 1, we have gaps to fill
    let prevEnd = overlapping[0][1];

    for (let i = 1; i < overlapping.length; i++) {
      const currentStart = overlapping[i][0];
      // Redefine prevEnd to suppress warnings about unsafe access
      const end = prevEnd;
      const endPoints = interps
        .filter((interp) => interp.start.stamp === currentStart)
        .flatMap((interp) => interp.start.points);
      const startPoints = interps
        .filter((interp) => interp.end.stamp === end)
        .flatMap((interp) => interp.end.points);

      if (prevEnd !== currentStart) {
        fill.push({
          start: { stamp: prevEnd, id: `gap-${prevEnd.toString()}`, points: startPoints },
          end: { stamp: currentStart, id: `gap-${currentStart.toString()}`, points: endPoints },
          buffer: true,
        });
      }
      prevEnd = overlapping[i][1];
    }
    return [...interps, ...fill].toSorted((a, b) => a.start.stamp - b.start.stamp);
  } else return interps;
}

interface InstancePair {
  start: InstancedFrameInfo;
  end: InstancedFrameInfo;
  buffer?: boolean;
}
