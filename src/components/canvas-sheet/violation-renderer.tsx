import { memo, useState } from "react";
import { useShallow } from "zustand/shallow";
import { Theme, useTooltipAnchor, useTooltipTrigger } from "@semio/ui";
import { MotionValue } from "motion/react";
import { useAnimationStore, useColors, useDiagonalMaterial } from "../../hooks";
import { Violation, ViolationSet } from "../../types";
import { ViolationPanel } from "../violation-panel";
import { Z } from "../../constants";
import { getBackgroundElementProps, getThemeAwareOpacity } from "../../functions";

// Renders a single violation segment as a mesh
const ViolationSegment = memo(function ViolationSegment({
  segment,
  violations,
  height = 36,
  theme = Theme.Light,
  yOffset = new MotionValue(0),
  measureFromBottom = false,
  trackY = false,
  activeAnimationId,
}: {
  segment: {
    id: string;
    stampRange: { start: number; end: number };
    violations: string[];
  };
  yOffset: MotionValue<number>;
  violations: Record<string, Violation>;
  height?: number;
  theme?: Theme.Light | Theme.Dark;
  measureFromBottom?: boolean;
  trackY?: boolean;
  activeAnimationId?: string;
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
    axis: trackY ? "both" : "x",
  });

  const { show, hide } = useTooltipTrigger(anchorId, { showDelay: 200 });

  // Get all track IDs involved in this segment
  const trackIds = Array.from(
    new Set(
      segment.violations
        // We will want to filter to only show colors for violations in color if they
        // belong to the active animation in the future.
        .filter((id) => violations[id].instanceId === activeAnimationId)
        .map((id) => violations[id].trackId as string),
    ),
  );
  const color = useColors(trackIds);

  // Get theme-aware opacity that increases when hovered
  const baseOpacity = 0.3;
  const hoveredOpacity = 0.45;
  const { opacity: themeAwareOpacity } = getBackgroundElementProps(
    color,
    hovered ? hoveredOpacity : baseOpacity,
    theme,
    false, // We'll handle highlight separately
  );

  // Create diagonal material using the hook with theme-aware properties
  const diagonalMaterial = useDiagonalMaterial({
    color,
    opacity: themeAwareOpacity,
    baselineOpacity: getThemeAwareOpacity(0.1, theme),
    stripeWidth: 8.0,
    stripeSpacing: 16.0,
    theme,
    yOffset,
    useHighlight: theme === Theme.Dark, // Keep your existing logic
    measureFromBottom,
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
      position={[x, y, Z.Violations]}
      material={diagonalMaterial as any}
      onPointerOver={(e) => {
        // e.stopPropagation();
        console.log(
          "violation",
          segment.violations.map((id) => violations[id]),
        );
        setHovered(true);
        onPointerMove?.(e);
        show();
      }}
      onPointerOut={(_e) => {
        // e.stopPropagation();
        setHovered(false);
        hide();
        onPointerLeave?.();
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
  measureFromBottom?: boolean;
  trackY?: boolean;
}

export const ViolationRenderer = memo(function ViolationRenderer({
  violationSet,
  height = 36,
  theme = Theme.Light,
  yOffset = new MotionValue(0),
  measureFromBottom = false,
  trackY = false,
}: ViolationRendererProps) {
  const activeAnimationId = useAnimationStore(
    useShallow((state) => state.selectionState.instanceId),
  );
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
          measureFromBottom={measureFromBottom}
          trackY={trackY}
          activeAnimationId={activeAnimationId ?? undefined}
        />
      ))}
    </>
  );
});
