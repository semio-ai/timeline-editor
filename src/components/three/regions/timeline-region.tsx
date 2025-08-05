import type { ReactNode } from "react";
import { Region, useRegion } from "../layout";
import { DATA_VISUALIZATION_REGIONS } from "../data-visualization-layout-config";

export interface TimelineRegionProps {
  backgroundColor?: string;
  opacity?: number;
  visible?: boolean;
}

export function TimelineRegion({
  backgroundColor = "orange",
  opacity = 1,
  visible = true,
}: TimelineRegionProps): ReactNode {
  const bounds = useRegion(DATA_VISUALIZATION_REGIONS.TIMELINE);

  if (!visible || !bounds) {
    return null;
  }

  return (
    <Region regionId={DATA_VISUALIZATION_REGIONS.TIMELINE}>
      {/* HUD Camera Controller for this HUD's camera - TEMPORARILY DISABLED TO TEST CAMERA INTERFERENCE */}
      {/* <HUDCameraController enabled={true} regionId="TIMELINE" /> */}

      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[bounds.dimensions.width, bounds.dimensions.height]} />
        <meshBasicMaterial color={backgroundColor} transparent opacity={opacity} />

        {/* Simple timeline marks for testing */}
        {Array.from({ length: Math.min(12, Math.floor(bounds.dimensions.width / 40)) }, (_, i) => {
          const markCount = Math.min(12, Math.floor(bounds.dimensions.width / 40));
          const spacing = bounds.dimensions.width / (markCount + 1);
          const xPos = -bounds.dimensions.width / 2 + (i + 1) * spacing;
          return (
            <mesh key={i} position={[xPos, 0, 0.1]}>
              <boxGeometry args={[2, bounds.dimensions.height * 0.8, 0.1]} />
              <meshBasicMaterial color="darkred" />
            </mesh>
          );
        })}
      </mesh>
    </Region>
  );
}
