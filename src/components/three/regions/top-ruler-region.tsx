import type { ReactNode } from "react";
import { Region, useRegion } from "../layout";
import { DATA_VISUALIZATION_REGIONS } from "../data-visualization-layout-config";

export interface TopRulerRegionProps {
  backgroundColor?: string;
  opacity?: number;
  visible?: boolean;
}

export function TopRulerRegion({
  backgroundColor = "cyan",
  opacity = 1,
  visible = true,
}: TopRulerRegionProps): ReactNode {
  const bounds = useRegion(DATA_VISUALIZATION_REGIONS.TOP_RULER);

  if (!visible || !bounds) {
    return null;
  }

  return (
    <Region regionId={DATA_VISUALIZATION_REGIONS.TOP_RULER}>
      {/* HUD Camera Controller for this HUD's camera - TEMPORARILY DISABLED TO TEST CAMERA INTERFERENCE */}
      {/* <HUDCameraController enabled={true} regionId="TOP_RULER" /> */}

      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[bounds.dimensions.width, bounds.dimensions.height]} />
        <meshBasicMaterial color={backgroundColor} transparent opacity={opacity} />

        {/* Simple ruler marks for testing */}
        {Array.from({ length: Math.min(12, Math.floor(bounds.dimensions.width / 40)) }, (_, i) => {
          const markCount = Math.min(12, Math.floor(bounds.dimensions.width / 40));
          const spacing = bounds.dimensions.width / (markCount + 1);
          const xPos = -bounds.dimensions.width / 2 + (i + 1) * spacing;
          return (
            <mesh key={i} position={[xPos, 0, 0.1]}>
              <boxGeometry args={[1, bounds.dimensions.height * 0.6, 0.1]} />
              <meshBasicMaterial color="black" />
            </mesh>
          );
        })}
      </mesh>
    </Region>
  );
}
