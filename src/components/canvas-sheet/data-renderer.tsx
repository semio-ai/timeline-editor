import { memo, useMemo } from "react";
import { useShallow } from "zustand/shallow";
import { Theme } from "@semio/ui";
import { MotionValue } from "motion";
import { Instances } from "@react-three/drei";
import { uniq } from "lodash";
import { useAnimationStore, useColors } from "../../hooks";
import { InstancedFrameInfo, SourceRow, TrackRender } from "../../types";
import { AnimationData } from "../../store-types";
import { Z } from "../../constants";
import { DataPoint } from "./data-point";
import { FrustumBackground } from "./frustum-background";
import { ViolationRenderer } from "./violation-renderer";
import { TransitionSegment } from "./transition-segment";

const DataPointsRenderer = memo(function DataPointsRenderer({
  sourceRow,
  frames,
  verticalBounds,
  theme = Theme.Light,
  trackRender = TrackRender.Key,
  height = 36,
}: {
  sourceRow: SourceRow;
  frames: InstancedFrameInfo[];
  verticalBounds: { min: number; max: number };
  theme?: Theme.Light | Theme.Dark;
  trackRender?: TrackRender;
  height?: number;
}) {
  // If the track render is spline, but the row is a group, ignore it
  if (trackRender === TrackRender.Spline && sourceRow.data.length > 1) {
    return null;
  }

  return (
    <Instances>
      {/* Shared geometry and material for all instances */}
      <cylinderGeometry args={[5, 5, 1, 6]} />
      <meshBasicMaterial toneMapped={false} />

      {/* Individual instances */}
      {frames.map((frame) => (
        <DataPoint
          key={frame.id}
          markerId={frame.id}
          sourceRowId={sourceRow.id}
          sourceRow={sourceRow}
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
  sourceRowId: string;
  height?: number;
  emphasis?: boolean;
  onEmphasisChange?: (emphasis: boolean) => void;
  yOffset?: number;
  zOffset?: number;
  theme?: Theme.Light | Theme.Dark;
  scrollOffset?: MotionValue<number>;
  measureFromBottom?: boolean;
  showBackground?: boolean;
  trackRender?: TrackRender;
}

// WARNING: This component passes frameData as props to child components
// After drag operations, these props can become stale while the store has updated
// This causes selection issues, particularly for the last marker in multi-selection drags
// This architectural issue will be resolved in Phase 2+ refactoring
// See: docs/dragging-architecture-proposal.md and docs/phase2-preparation.md
export const DataRenderer = memo(function DataRenderer({
  sourceRowId,
  height = 36,
  emphasis = false,
  onEmphasisChange = () => {},
  yOffset = 0,
  zOffset = 0,
  theme = Theme.Light,
  scrollOffset = new MotionValue(0),
  measureFromBottom = false,
  showBackground = true,
  trackRender = TrackRender.Key,
}: DataRendererProps) {
  const sourceRow = useAnimationStore(
    useShallow((state: AnimationData) => state.instancedTrackSources[sourceRowId]),
  );
  const computedData = useAnimationStore(
    useShallow((state: AnimationData) => state.computedRowData[sourceRowId]),
  );

  const trackIds = useMemo(
    () => (sourceRow ? uniq(sourceRow.data.map((s) => s.trackId)) : []),
    [sourceRow],
  );
  const color = useColors(trackIds);

  const keyForced: boolean = useMemo(() => {
    if (!sourceRow) return true;
    return !sourceRow.data.every((d) => d.type === "number");
  }, [sourceRow]);

  if (!sourceRow) return null;

  return (
    <group
      position={[0, yOffset, zOffset]}
      onClick={() => console.log("clicked", sourceRow, computedData)}
    >
      {/* Render the hexagons/visuals for each keyed point */}
      {/* PROBLEM: frameData is passed as props here, creating stale references in DataPoint components */}
      {/* After drag operations, individual DataPoint components retain old stamp values */}
      {/* Phase 2+ will eliminate this prop drilling by having components subscribe to store directly */}
      <DataPointsRenderer
        sourceRow={sourceRow}
        frames={computedData.virtualFrames}
        verticalBounds={computedData.verticalBounds}
        theme={theme}
        trackRender={trackRender}
        height={height - 1}
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
          sourceRow={sourceRow}
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
