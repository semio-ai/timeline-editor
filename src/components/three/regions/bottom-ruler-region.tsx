import type { ReactNode } from "react";
import { Region, useRegion } from "../layout";
import { DATA_VISUALIZATION_REGIONS } from "../data-visualization-layout-config";
// No camera imports needed - bottom ruler doesn't zoom

export interface BottomRulerRegionProps {
  backgroundColor?: string;
  opacity?: number;
  visible?: boolean;
}

export function BottomRulerRegion({
  backgroundColor = "lime",
  opacity = 1,
  visible = true,
}: BottomRulerRegionProps): ReactNode {
  const bounds = useRegion(DATA_VISUALIZATION_REGIONS.BOTTOM_RULER);

  if (!visible || !bounds) {
    return null;
  }

  return (
    <Region regionId={DATA_VISUALIZATION_REGIONS.BOTTOM_RULER}>
      {/* No camera controller - bottom ruler doesn't zoom per gesture table */}

      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[bounds.dimensions.width, bounds.dimensions.height]} />
        <meshBasicMaterial color={backgroundColor} transparent opacity={opacity} />

        {/* Simple bottom ruler marks for testing */}
        {Array.from({ length: Math.min(12, Math.floor(bounds.dimensions.width / 40)) }, (_, i) => {
          const markCount = Math.min(12, Math.floor(bounds.dimensions.width / 40));
          const spacing = bounds.dimensions.width / (markCount + 1);
          const xPos = -bounds.dimensions.width / 2 + (i + 1) * spacing;
          return (
            <mesh key={i} position={[xPos, 0, 0.1]}>
              <boxGeometry args={[1, bounds.dimensions.height * 0.6, 0.1]} />
              <meshBasicMaterial color="darkgreen" />
            </mesh>
          );
        })}
      </mesh>
    </Region>
  );
}
