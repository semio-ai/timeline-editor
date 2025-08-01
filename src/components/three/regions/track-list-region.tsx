import type { ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import { MotionValue } from "motion";
import { Region, useRegion } from "../layout";
import { DATA_VISUALIZATION_REGIONS } from "../data-visualization-layout-config";
import { useAnimationStore, useColors } from "../../../hooks";
import type { AnimationInstanceSettings } from "../../../types";

export interface TrackListRegionProps {
  visible?: boolean;
  animationId?: string;
  namespaceId?: string;
  instanceSettings?: AnimationInstanceSettings;
  scrollY: MotionValue<number>;
}

export function TrackListRegion({ visible = true, animationId }: TrackListRegionProps): ReactNode {
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
          <TrackBackground key={trackId} trackId={trackId} index={index} />
        ))}
    </>
  );
}

function TrackBackground({ trackId, index }: { trackId: string; index: number }): ReactNode {
  const color = useColors(trackId);
  const bounds = useRegion(DATA_VISUALIZATION_REGIONS.TRACK_LIST);

  if (!bounds) {
    return null;
  }

  const trackHeight = 36; // 36px per track as specified
  const regionHeight = bounds.dimensions.height;
  const regionWidth = bounds.dimensions.width;

  // Position from top to bottom: start at top of region and move down
  const yPosition = regionHeight / 2 - (index + 0.5) * trackHeight;

  return (
    <Region regionId={DATA_VISUALIZATION_REGIONS.TRACK_LIST}>
      <mesh position={[0, yPosition, -0.1]}>
        <planeGeometry args={[regionWidth, trackHeight]} />
        <meshBasicMaterial color={color} transparent opacity={1} />
      </mesh>
    </Region>
  );
}
