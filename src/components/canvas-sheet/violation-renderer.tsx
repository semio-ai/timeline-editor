import { memo, useState, useEffect } from "react";
import { useShallow } from "zustand/shallow";
import { Theme, useTooltipAnchor, useTooltipTrigger } from "@semio/ui";
import { MotionValue, useSpring } from "motion/react";
import { useAnimationStore, useColors, useDiagonalMaterial } from "../../hooks";
import { LayerBand, Violation, ViolationSet } from "../../types";
import { ViolationPanel } from "../violation-panel";
import { Z } from "../../constants";

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
  layer = LayerBand.Background,
  globalOpacityMV,
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
  layer?: LayerBand;
  globalOpacityMV?: MotionValue<number>;
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

  // Create diagonal material using the hook with theme-aware properties
  const diagonalMaterial = useDiagonalMaterial({
    color,
    opacity: LAYER_TO_OPACITY[layer] + (hovered ? 0.2 : 0),
    baselineOpacity: LAYER_TO_BASELINE_OPACITY[layer],
    stripeWidth: 8.0,
    stripeSpacing: 16.0,
    theme,
    yOffset,
    useHighlight: theme === Theme.Dark, // Keep your existing logic
    measureFromBottom,
    globalOpacityMV,
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
      <boxGeometry args={[width, height, 0]} />
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
  layer?: LayerBand;
}

export const ViolationRenderer = memo(function ViolationRenderer({
  violationSet,
  height = 36,
  theme = Theme.Light,
  yOffset = new MotionValue(0),
  measureFromBottom = false,
  trackY = false,
  layer = LayerBand.Background,
}: ViolationRendererProps) {
  const activeAnimationId = useAnimationStore(
    useShallow((state) => state.selectionState.instanceId),
  );

  const globalOpacityMV = useSpring(0, { visualDuration: 0.3, damping: 30 });

  useEffect(() => {
    const t = setTimeout(() => globalOpacityMV.set(1), 50);
    return () => clearTimeout(t);
  }, [globalOpacityMV]);

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
          layer={layer}
          globalOpacityMV={globalOpacityMV}
        />
      ))}
    </>
  );
});

const LAYER_TO_OPACITY: Record<LayerBand, number> = {
  [LayerBand.Background]: 0.25,
  [LayerBand.ForegroundUnselected]: 0.5,
  [LayerBand.ForegroundSelected]: 0.75,
};

const LAYER_TO_BASELINE_OPACITY: Record<LayerBand, number> = {
  [LayerBand.Background]: 0.15,
  [LayerBand.ForegroundUnselected]: 0.2,
  [LayerBand.ForegroundSelected]: 0.25,
};
