import { memo, useMemo, useState } from "react";
import { useShallow } from "zustand/shallow";
import { RawValue, useDeepSelector } from "@semio/utils";
import { Instances } from "@react-three/drei";
import { pick, uniq } from "lodash";
import { useAnimationStore, useColors } from "../../../hooks";
import { AnimationInstanceSettings, InstancedFrameInfo, Track } from "../../../types";
import { AnimationData } from "../../../store-types";
import {
  computeFrames,
  computeInterpolationSegments,
  computeViolationSet,
} from "../../../functions";
import { computeFilledInterpGaps } from "../../../functions/compute-filled-interp-gaps";
import { DataPoint } from "./data-point";
import { TrackBackground } from "./track-background";
import { FrustumBackground } from "./frustum-background";
import { ViolationRenderer } from "./violation-renderer";

function DataPointsRenderer({
  frameData = [],
  onSetDraggingFrames,
}: {
  frameData: InstancedFrameInfo[];
  onSetDraggingFrames: (ids: string[]) => void;
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
}

export function InnerDataRenderer({
  trackIds = [],
  height = 36,
  emphasis = false,
  onEmphasisChange = () => {},
  offset = 0,
}: DataRendererProps) {
  const color = useColors(trackIds);

  const [draggingFrames, setDraggingFrames] = useState<string[]>([]);

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

  const _paddedInterps = useMemo(() => computeFilledInterpGaps(interps), [interps]);

  // console.log("Frame data", frameData);

  return (
    <group
      position={[0, offset, 0]}
      onPointerEnter={() => onEmphasisChange(true)}
      onPointerLeave={() => onEmphasisChange(false)}
    >
      {/* Render the hexagons/visuals for each keyed point */}
      <DataPointsRenderer frameData={frameData} onSetDraggingFrames={setDraggingFrames} />

      {/* Render violations */}
      <ViolationRenderer violationSet={violationSet} />

      {/* Render a background for the Active region, and the General Background */}
      {trackIds.length > 0 && (
        <>
          <FrustumBackground color={color} height={height} opacity={0.15} position={[0.5, 0, -1]} />
          <TrackBackground color={color} height={height} emphasis={emphasis} />
        </>
      )}
    </group>
  );
}

export const DataRenderer = memo(InnerDataRenderer);
