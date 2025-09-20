import { memo, useMemo } from "react";
import { useShallow } from "zustand/shallow";
import { RawValue, useDeepSelector } from "@semio/utils";
import { Theme } from "@semio/ui";
import { MotionValue } from "motion";
import { Instances } from "@react-three/drei";
import { pick, uniq } from "lodash";
import { useAnimationStore, useColors } from "../../hooks";
import {
  AnimationInstanceSettings,
  InstancedFrameInfo,
  Source,
  SourceRow,
  Track,
  TrackRender,
} from "../../types";
import { AnimationData } from "../../store-types";
import {
  computeTransitionSegments,
  computeVerticalBounds,
  computeViolationSet,
  computeVirtualFrames,
} from "../../functions";
import { Z } from "../../constants";
import { computeFilledInterpGaps } from "../../functions/compute-filled-interp-gaps";
import { DataPoint } from "./data-point";
import { FrustumBackground } from "./frustum-background";
import { ViolationRenderer } from "./violation-renderer";
import { TransitionSegment } from "./transition-segment";

const DataPointsRenderer = memo(function DataPointsRenderer({
  frameData = [],
  theme = Theme.Light,
  trackRender = TrackRender.Key,
  height = 36,
  verticalBounds = { min: -18, max: 18 },
  sources = [],
}: {
  frameData: InstancedFrameInfo[];
  theme?: Theme.Light | Theme.Dark;
  trackRender?: TrackRender;
  height?: number;
  verticalBounds?: { min: number; max: number };
  sources?: Source[];
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
          allData={frameData}
          theme={theme}
          trackRender={trackRender}
          height={height}
          verticalBounds={verticalBounds}
          sources={sources}
        />
      ))}
    </Instances>
  );
});

export interface DataRendererProps {
  viewId: string;
  sourceRow: SourceRow;
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

// WARNING: This component passes frameData as props to child components
// After drag operations, these props can become stale while the store has updated
// This causes selection issues, particularly for the last marker in multi-selection drags
// This architectural issue will be resolved in Phase 2+ refactoring
// See: docs/dragging-architecture-proposal.md and docs/phase2-preparation.md
export const DataRenderer = memo(function DataRenderer({
  viewId,
  sourceRow,
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
  const computedData = useAnimationStore(
    useShallow((state: AnimationData) => state.computedRowData[sourceRow.id]),
  );

  const trackIds = useMemo(() => uniq(sourceRow.data.map((s) => s.trackId)), [sourceRow]);
  const color = useColors(trackIds);

  const keyForced: boolean = useMemo(() => {
    return !sourceRow.data.every((d) => d.type === "number");
  }, [sourceRow]);

  return (
    <group position={[0, yOffset, zOffset]}>
      {/* Render the hexagons/visuals for each keyed point */}
      {/* PROBLEM: frameData is passed as props here, creating stale references in DataPoint components */}
      {/* After drag operations, individual DataPoint components retain old stamp values */}
      {/* Phase 2+ will eliminate this prop drilling by having components subscribe to store directly */}
      <DataPointsRenderer
        frameData={computedData.virtualFrames}
        theme={theme}
        trackRender={trackRender}
        height={height - 1}
        verticalBounds={computedData.verticalBounds}
        sources={sources}
      />

      {/* Render transition segments */}
      {computedData.interpolations.map((segment, index) => (
        <TransitionSegment
          key={`${segment.start.id}-${segment.end.id}-${index.toString()}`}
          start={segment.start}
          end={segment.end}
          trackRender={keyForced ? TrackRender.Key : trackRender}
          height={height - 1}
          verticalBounds={computedData.verticalBounds}
          sources={sources}
          isEmpty={segment.buffer}
          theme={theme}
          color={color}
        />
      ))}

      {/* Render violations */}
      {trackRender !== TrackRender.Spline && (
        <ViolationRenderer
          violationSet={computedData.violationSet}
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
