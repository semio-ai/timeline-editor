import { memo } from "react";
import { useColors } from "../../../hooks";
import { ViolationSet } from "../../../types";

// Renders a single violation segment as a mesh
const ViolationSegmentMesh = memo(function ViolationSegmentMesh({
  segment,
  violations,
  height = 36,
}: {
  segment: {
    id: string;
    stampRange: { start: number; end: number };
    violations: string[];
  };
  violations: Record<string, any>;
  height?: number;
}) {
  // Get all track IDs involved in this segment
  const trackIds = Array.from(
    new Set(segment.violations.map((id) => violations[id].trackId as string)),
  );
  const color = useColors(trackIds);

  // Geometry: width = end - start, centered at (start + end)/2
  const start = segment.stampRange.start;
  const end = segment.stampRange.end;
  const width = end - start;
  const x = (start + end) / 2;
  const y = 0;

  return (
    <mesh position={[x, y, 0]}>
      <boxGeometry args={[width, height, 1]} />
      <meshBasicMaterial attach="material" color={color} transparent opacity={0.6} />
    </mesh>
  );
});

export interface ViolationRendererProps {
  violationSet: ViolationSet;
  height?: number;
}

function InnerViolationRenderer({ violationSet, height = 36 }: ViolationRendererProps) {
  return (
    <>
      {violationSet.segments.map((segment) => (
        <ViolationSegmentMesh
          key={segment.id}
          segment={segment}
          violations={violationSet.violations}
          height={height}
        />
      ))}
    </>
  );
}

export const ViolationRenderer = memo(InnerViolationRenderer);
