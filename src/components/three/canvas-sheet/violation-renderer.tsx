import { memo } from "react";
import { Theme } from "@semio/ui";
import { useColors } from "../../../hooks";
import { ViolationSet } from "../../../types";
import { useDiagonalMaterial } from "./diagonal-material";

// Renders a single violation segment as a mesh
const ViolationSegment = memo(function ViolationSegmentMesh({
  segment,
  violations,
  height = 36,
  theme = Theme.Light,
}: {
  segment: {
    id: string;
    stampRange: { start: number; end: number };
    violations: string[];
  };
  violations: Record<string, any>;
  height?: number;
  theme?: Theme.Light | Theme.Dark;
}) {
  // Get all track IDs involved in this segment
  const trackIds = Array.from(
    new Set(segment.violations.map((id) => violations[id].trackId as string)),
  );
  const color = useColors(trackIds);

  // Create diagonal material using the hook
  const diagonalMaterial = useDiagonalMaterial({
    color,
    opacity: 0.6,
    stripeWidth: 8.0,
    stripeSpacing: 16.0,
    theme,
    useHighlight: true,
  });

  // Geometry: width = end - start, centered at (start + end)/2
  const start = segment.stampRange.start;
  const end = segment.stampRange.end;
  const width = end - start;
  const x = (start + end) / 2;
  const y = 0;

  return (
    <mesh position={[x, y, 0]} material={diagonalMaterial as any}>
      <boxGeometry args={[width, height, 1]} />
    </mesh>
  );
});

export interface ViolationRendererProps {
  violationSet: ViolationSet;
  height?: number;
  theme?: Theme.Light | Theme.Dark;
}

function InnerViolationRenderer({
  violationSet,
  height = 36,
  theme = Theme.Light,
}: ViolationRendererProps) {
  return (
    <>
      {violationSet.segments.map((segment) => (
        <ViolationSegment
          key={segment.id}
          segment={segment}
          violations={violationSet.violations}
          height={height}
          theme={theme}
        />
      ))}
    </>
  );
}

export const ViolationRenderer = memo(InnerViolationRenderer);
