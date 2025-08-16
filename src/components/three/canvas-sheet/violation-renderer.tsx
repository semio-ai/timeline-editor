import { memo, useState } from "react";
import { Theme, useTooltipAnchor, useTooltipTrigger } from "@semio/ui";
import { MotionValue } from "motion/react";
import { useColors, useDiagonalMaterial } from "../../../hooks";
import { ViolationSet } from "../../../types";
import { ViolationPanel } from "../violation-panel";

// Renders a single violation segment as a mesh
const ViolationSegment = memo(function ViolationSegmentMesh({
  segment,
  violations,
  height = 36,
  theme = Theme.Light,
  yOffset = new MotionValue(0),
}: {
  segment: {
    id: string;
    stampRange: { start: number; end: number };
    violations: string[];
  };
  yOffset: MotionValue<number>;
  violations: Record<string, any>;
  height?: number;
  theme?: Theme.Light | Theme.Dark;
}) {
  const [hovered, setHovered] = useState(false);

  // Generate tooltip ID
  const tooltipId = `violation-segment-${segment.id}`;

  // 3D Tooltip setup
  const {
    ref: meshRef,
    anchorId,
    onPointerMove,
    onPointerLeave,
  } = useTooltipAnchor({
    id: tooltipId,
    content: <ViolationPanel segment={segment} violations={violations} />,
    side: "top",
    axis: "x",
  });

  const { show, hide } = useTooltipTrigger(anchorId);

  // Get all track IDs involved in this segment
  const trackIds = Array.from(
    new Set(segment.violations.map((id) => violations[id].trackId as string)),
  );
  const color = useColors(trackIds);

  // Increase opacity if hovered
  const opacity = hovered ? 0.65 : 0.4;

  // Create diagonal material using the hook
  const diagonalMaterial = useDiagonalMaterial({
    color,
    opacity,
    baselineOpacity: 0.2,
    stripeWidth: 8.0,
    stripeSpacing: 16.0,
    theme,
    yOffset,
  });

  // Geometry: width = end - start, centered at (start + end)/2
  const start = segment.stampRange.start;
  const end = segment.stampRange.end;
  const width = end - start;
  const x = (start + end) / 2;
  const y = 0;

  return (
    <mesh
      ref={meshRef as any}
      position={[x, y, 0]}
      material={diagonalMaterial as any}
      onPointerOver={(e) => {
        setHovered(true);
        show();
        onPointerMove?.(e);
        e.stopPropagation();
      }}
      onPointerOut={(e) => {
        setHovered(false);
        hide();
        onPointerLeave?.();
        e.stopPropagation();
      }}
      onPointerMove={onPointerMove}
    >
      <boxGeometry args={[width, height, 1]} />
    </mesh>
  );
});

export interface ViolationRendererProps {
  violationSet: ViolationSet;
  height?: number;
  theme?: Theme.Light | Theme.Dark;
  yOffset?: MotionValue<number>;
}

function InnerViolationRenderer({
  violationSet,
  height = 36,
  theme = Theme.Light,
  yOffset = new MotionValue(0),
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
          yOffset={yOffset}
        />
      ))}
    </>
  );
}

export const ViolationRenderer = memo(InnerViolationRenderer);
