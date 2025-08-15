import { memo, useMemo, useState } from "react";
import { useShallow } from "zustand/shallow";
import { RawValue, useDeepSelector } from "@semio/utils";
import { Theme } from "@semio/ui";
import { MotionValue } from "motion";
import { Instances } from "@react-three/drei";
import { pick, uniq } from "lodash";
import { useAnimationStore, useColors } from "../../../hooks";
import { AnimationInstanceSettings, InstancedFrameInfo, Track, TrackRender } from "../../../types";
import { AnimationData } from "../../../store-types";
import {
  computeFrames,
  computeTransitionSegments,
  computeVerticalBounds,
  computeViolationSet,
} from "../../../functions";
import { computeFilledInterpGaps } from "../../../functions/compute-filled-interp-gaps";
import { DataPoint } from "./data-point";
import { TrackBackground } from "./track-background";
import { FrustumBackground } from "./frustum-background";
import { ViolationRenderer } from "./violation-renderer";
import { TransitionSegment } from "./transition-segment";

function DataPointsRenderer({
  frameData = [],
  onSetDraggingFrames,
  theme = Theme.Light,
  trackRender = TrackRender.Key,
  height = 36,
}: {
  frameData: InstancedFrameInfo[];
  onSetDraggingFrames: (ids: string[]) => void;
  theme?: Theme.Light | Theme.Dark;
  trackRender?: TrackRender;
  height?: number;
}) {
  return (
    <Instances>
      {/* Shared geometry and material for all instances */}
      <cylinderGeometry args={[5, 5, 1, 6]} />
      <meshBasicMaterial toneMapped={false} />

      {/* Individual instances */}
      {frameData.map((data) => (
        <DataPoint
          key={data.id}
          data={data}
          onDragStart={() => {
            // Update the set of dragging frames based on the frame instance
            const ids = uniq(data.points.map((p) => p.id));
            onSetDraggingFrames(ids);
          }}
          onDragEnd={() => {
            // Clear the dragging tracks when the drag ends
            onSetDraggingFrames([]);
          }}
          theme={theme}
          trackRender={trackRender}
          height={height}
        />
      ))}
    </Instances>
  );
}

export interface DataRendererProps {
  animationId: string; // Unique ID for the animation
  namespaceId: string; // Namespace for the animation, used for scoping
  instanceSettings?: AnimationInstanceSettings; // Settings for the animation instance
  trackIds?: string[];
  height?: number;
  emphasis?: boolean;
  onEmphasisChange?: (emphasis: boolean) => void;
  offset?: number;
  theme?: Theme.Light | Theme.Dark;
  yOffset?: MotionValue<number>;
  trackRender?: TrackRender;
}

export function InnerDataRenderer({
  trackIds = [],
  height = 36,
  emphasis = false,
  onEmphasisChange = () => {},
  offset = 0,
  theme = Theme.Light,
  yOffset = new MotionValue(0),
  trackRender = TrackRender.Key,
}: DataRendererProps) {
  const color = useColors(trackIds);

  const [draggingFrames, setDraggingFrames] = useState<string[]>([]);

  const tracks: Record<string, Track<RawValue>> = useAnimationStore(
    useDeepSelector(
      (state: AnimationData) => pick(state.tracks, trackIds) as Record<string, Track<RawValue>>,
    ),
  );

  const trackAnimatableIds = useMemo(() => {
    return trackIds.map((id) => tracks[id].animatableId);
  }, [trackIds, tracks]);

  const allAnimatables = useAnimationStore(useShallow((state: AnimationData) => state.animatables));

  const trackAnimatables = useMemo(() => {
    return trackAnimatableIds.map((id) => allAnimatables[id]).filter(Boolean);
  }, [trackAnimatableIds, allAnimatables]);

  const violations = useAnimationStore(useShallow((state: AnimationData) => state.violations));

  const violationSet = useMemo(() => {
    const filteredViolations = pick(violations, trackIds);
    return computeViolationSet(filteredViolations);
  }, [violations, trackIds]);

  const frameData: InstancedFrameInfo[] = useMemo(() => {
    return computeFrames(tracks, draggingFrames);
  }, [tracks, draggingFrames]);

  const interps = useMemo(() => {
    return computeTransitionSegments(frameData, trackIds);
  }, [frameData, trackIds]);

  const paddedInterps = useMemo(() => computeFilledInterpGaps(interps), [interps]);
  const verticalBounds = useMemo(() => {
    return computeVerticalBounds(tracks, trackAnimatables, undefined);
  }, [tracks, trackAnimatables]);

  const trackType = useMemo(() => {
    if (trackIds.length === 1 && tracks[trackIds[0]]) {
      const animatable = allAnimatables[tracks[trackIds[0]].animatableId];
      return animatable?.type || "number";
    }
    return "multiple";
  }, [trackIds, tracks, allAnimatables]);

  return (
    <group
      position={[0, offset, 0]}
      onPointerEnter={() => {
        console.log(verticalBounds);
      }}
    >
      {/* Render the hexagons/visuals for each keyed point */}
      <DataPointsRenderer
        frameData={frameData}
        onSetDraggingFrames={setDraggingFrames}
        theme={theme}
        trackRender={trackRender}
        height={height - 2.5}
      />

      {/* Render transition segments */}
      {paddedInterps.map((segment, index) => (
        <TransitionSegment
          key={`${segment.start.id}-${segment.end.id}-${index.toString()}`}
          start={segment.start}
          end={segment.end}
          trackIds={trackIds}
          trackRender={trackRender}
          trackType={trackType}
          height={height - 1}
          verticalBounds={{ min: verticalBounds[0], max: verticalBounds[1] }}
          isBuffer={segment.buffer}
          theme={theme}
          color={color}
        />
      ))}

      {/* Render violations */}
      <ViolationRenderer
        violationSet={violationSet}
        theme={theme}
        height={height - 1}
        yOffset={yOffset}
      />

      {/* Render a background for the Active region, and the General Background */}
      {trackIds.length > 0 && (
        <>
          <FrustumBackground
            color={color}
            height={height - 1}
            opacity={0.15}
            position={[0.5, 0, -1]}
            onHoverChange={onEmphasisChange}
          />
          <TrackBackground color={color} height={height - 1} emphasis={emphasis} />
        </>
      )}
    </group>
  );
}

export const DataRenderer = memo(InnerDataRenderer);
