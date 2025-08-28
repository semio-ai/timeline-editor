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
import { Z } from "../../../constants";
import { computeFilledInterpGaps } from "../../../functions/compute-filled-interp-gaps";
import { DataPoint } from "./data-point";
import { FrustumBackground } from "./frustum-background";
import { ViolationRenderer } from "./violation-renderer";
import { TransitionSegment } from "./transition-segment";

const DataPointsRenderer = memo(function DataPointsRenderer({
  frameData = [],
  onSetDraggingFrames,
  theme = Theme.Light,
  trackRender = TrackRender.Key,
  height = 36,
  verticalBounds = { min: -18, max: 18 },
}: {
  frameData: InstancedFrameInfo[];
  onSetDraggingFrames: (ids: string[]) => void;
  theme?: Theme.Light | Theme.Dark;
  trackRender?: TrackRender;
  height?: number;
  verticalBounds?: { min: number; max: number };
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
          verticalBounds={verticalBounds}
        />
      ))}
    </Instances>
  );
});

export interface DataRendererProps {
  animationId: string; // Unique ID for the animation
  namespaceId: string; // Namespace for the animation, used for scoping
  instanceSettings?: AnimationInstanceSettings; // Settings for the animation instance
  trackIds?: string[];
  height?: number;
  emphasis?: boolean;
  onEmphasisChange?: (emphasis: boolean) => void;
  yOffset?: number;
  zOffset?: number;
  theme?: Theme.Light | Theme.Dark;
  scrollOffset?: MotionValue<number>;
  trackRender?: TrackRender;
  measureFromBottom?: boolean;
  showBackground?: boolean;
}

export const DataRenderer = memo(function DataRenderer({
  trackIds = [],
  height = 36,
  emphasis = false,
  onEmphasisChange = () => {},
  yOffset = 0,
  zOffset = 0,
  theme = Theme.Light,
  scrollOffset = new MotionValue(0),
  trackRender = TrackRender.Key,
  measureFromBottom = false,
  showBackground = true,
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
    <group position={[0, yOffset, zOffset]}>
      {/* Render the hexagons/visuals for each keyed point */}
      <DataPointsRenderer
        frameData={frameData}
        onSetDraggingFrames={setDraggingFrames}
        theme={theme}
        trackRender={trackRender}
        height={height - 1}
        verticalBounds={{ min: verticalBounds[0], max: verticalBounds[1] }}
      />

      {/* Render transition segments */}
      {paddedInterps.map((segment, index) => (
        <TransitionSegment
          key={`${segment.start.id}-${segment.end.id}-${index.toString()}`}
          start={segment.start}
          end={segment.end}
          trackIds={trackIds}
          trackRender={trackType !== "number" ? TrackRender.Key : trackRender}
          trackType={trackType}
          height={height - 1}
          verticalBounds={{ min: verticalBounds[0], max: verticalBounds[1] }}
          isEmpty={segment.buffer}
          theme={theme}
          color={color}
        />
      ))}

      {/* Render violations */}
      {trackRender !== TrackRender.Spline && (
        <ViolationRenderer
          violationSet={violationSet}
          theme={theme}
          height={height - 1}
          yOffset={scrollOffset}
          measureFromBottom={measureFromBottom}
        />
      )}

      {/* Render a background for the Active region, and the General Background */}
      {showBackground && trackIds.length > 0 && trackRender !== TrackRender.Spline && (
        <FrustumBackground
          color={color}
          height={height - 1}
          z={Z.Background}
          onHoverChange={onEmphasisChange}
          emphasis={emphasis}
          theme={theme}
        />
      )}
    </group>
  );
});
