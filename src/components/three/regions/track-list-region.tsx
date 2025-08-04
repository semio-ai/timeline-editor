import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useShallow } from "zustand/react/shallow";
import { MotionValue } from "motion/react";
import { Region, useRegion } from "../layout";
import { DATA_VISUALIZATION_REGIONS } from "../data-visualization-layout-config";
import { useAnimationStore, useColors } from "../../../hooks";
import { AnimationInstanceSettings } from "../../../types";

export interface TrackListRegionProps {
  visible?: boolean;
  animationId?: string;
  namespaceId?: string;
  instanceSettings?: AnimationInstanceSettings;
  scrollY: MotionValue<number>;
}

export function TrackListRegion({
  visible = true,
  animationId,
  scrollY,
}: TrackListRegionProps): ReactNode {
  const tracks = useAnimationStore(
    useShallow((state) => Array.from(state.animations[animationId || ""]?.tracks || [])),
  );

  if (!visible) {
    return null;
  }

  return (
    <>
      {/* We don't render a background for the whole region, and instead assemble it from the tracks */}
      {animationId &&
        tracks.map((trackId, index) => (
          <TrackBackground
            key={trackId}
            trackId={trackId}
            index={index}
            scrollY={scrollY}
            _animationId={animationId}
          />
        ))}
    </>
  );
}

function TrackBackground({
  trackId,
  index,
  scrollY,
  _animationId,
}: {
  trackId: string;
  index: number;
  scrollY: MotionValue<number>;
  _animationId?: string;
}): ReactNode {
  const color = useColors(trackId);
  const bounds = useRegion(DATA_VISUALIZATION_REGIONS.TRACK_LIST);
  const meshRef = useRef<any>(null);

  // Calculate positions before early return
  const trackHeight = 36; // 36px per track as specified
  const regionHeight = bounds?.dimensions.height || 0;
  const regionWidth = bounds?.dimensions.width || 0;
  const baseYPosition = regionHeight / 2 - (index + 0.5) * trackHeight;

  // Get tracks data for bounds calculation
  // Tracks are now managed centrally - wheel events handled by animation-sheet-3d.tsx

  // Wheel events are now handled centrally by animation-sheet-3d.tsx with region detection
  // This prevents scroll leakage into HUD regions while maintaining proper track scrolling

  // Apply scroll offset (must be before early return)
  useEffect(() => {
    if (!bounds) {
      return;
    }

    const unsubscribe = scrollY.on("change", (scrollValue) => {
      if (meshRef.current) {
        // Convert DOM scroll to 3D world units
        // Positive scroll moves tracks up (negative Y)
        const newY = baseYPosition + scrollValue;
        meshRef.current.position.y = newY;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [baseYPosition, scrollY, bounds, index, trackId]);

  if (!bounds) {
    return null;
  }

  return (
    <Region regionId={DATA_VISUALIZATION_REGIONS.TRACK_LIST}>
      <mesh ref={meshRef} position={[0, baseYPosition, -0.1]}>
        <planeGeometry args={[regionWidth, trackHeight]} />
        <meshBasicMaterial color={color} transparent opacity={1} />
      </mesh>
    </Region>
  );
}
