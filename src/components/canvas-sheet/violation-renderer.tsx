import { memo, useState, useEffect } from "react";
import { useShallow } from "zustand/shallow";
import { Theme, useTooltipAnchor } from "@semio/ui";
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
  xTransform,
  sourceRowId,
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
  xTransform?: (stamp: number) => number;
  sourceRowId: string;
}) {
  const [hovered, setHovered] = useState(false);

  // Unique per source row + segment, so the same violation in different rows gets separate anchors
  const tooltipId = `violation-${sourceRowId}-${segment.id}`;

  // 3D overlay setup — click to reveal violation details.
  // Group all violations together so overlapping segments (e.g. tracks vs timeline)
  // only show the highest-priority one.
  const {
    ref: meshRef,
    anchorId: _anchorId,
    onClick: toggleViolation,
    onPointerMove,
    onPointerLeave,
  } = useTooltipAnchor({
    id: tooltipId,
    content: <ViolationPanel segment={segment} violations={violations} />,
    side: "top",
    axis: trackY ? "both" : "x",
    mode: "click",
    group: `violation-${segment.id}`,
    priority:
      layer === LayerBand.ForegroundSelected ? 2 : layer === LayerBand.ForegroundUnselected ? 1 : 0,
  });

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
    opacity: LAYER_TO_OPACITY[layer] + (hovered ? 0.2 : 0.0),
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
  const xStart = typeof xTransform === "function" ? xTransform(start) : start;
  const xEnd = typeof xTransform === "function" ? xTransform(end) : end;
  const width = Math.abs(xEnd - xStart);
  const x = (xStart + xEnd) / 2;
  const y = 0;

  return (
    <mesh
      ref={meshRef as any}
      position={[x, y, Z.Violations]}
      material={diagonalMaterial as any}
      onClick={(e) => {
        e.stopPropagation();
        toggleViolation?.(e);
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => {
        setHovered(false);
        onPointerLeave?.();
      }}
      onPointerMove={onPointerMove}
    >
      <planeGeometry args={[width, height]} />
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
  xTransform?: (stamp: number) => number;
  /** Source row ID that owns this renderer — used to generate unique overlay anchor IDs. */
  sourceRowId: string;
}

export const ViolationRenderer = memo(function ViolationRenderer({
  violationSet,
  height = 36,
  theme = Theme.Light,
  yOffset = new MotionValue(0),
  measureFromBottom = false,
  trackY = false,
  layer = LayerBand.Background,
  xTransform,
  sourceRowId,
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
          xTransform={xTransform}
          sourceRowId={sourceRowId}
        />
      ))}
    </>
  );
});

// Stripe opacity — the diagonal lines themselves
const LAYER_TO_OPACITY: Record<LayerBand, number> = {
  [LayerBand.Background]: 0.18,
  [LayerBand.ForegroundLocked]: 0.25,
  [LayerBand.ForegroundUnselected]: 0.35,
  [LayerBand.ForegroundSelected]: 0.5,
};

// Fill opacity — the tinted area between stripes (used directly, not multiplied)
const LAYER_TO_BASELINE_OPACITY: Record<LayerBand, number> = {
  [LayerBand.Background]: 0.06,
  [LayerBand.ForegroundLocked]: 0.08,
  [LayerBand.ForegroundUnselected]: 0.1,
  [LayerBand.ForegroundSelected]: 0.15,
};
