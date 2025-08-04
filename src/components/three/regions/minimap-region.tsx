import type { ReactNode } from "react";
import { Region, useRegion } from "../layout";
import { DATA_VISUALIZATION_REGIONS } from "../data-visualization-layout-config";

export interface MinimapRegionProps {
  backgroundColor?: string;
  opacity?: number;
  visible?: boolean;
}

export function MinimapRegion({
  backgroundColor = "red",
  opacity = 1,
  visible = true,
}: MinimapRegionProps): ReactNode {
  const bounds = useRegion(DATA_VISUALIZATION_REGIONS.MINIMAP);

  if (!visible || !bounds) {
    return null;
  }

  return (
    <Region regionId={DATA_VISUALIZATION_REGIONS.MINIMAP}>
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[bounds.dimensions.width, bounds.dimensions.height]} />
        <meshBasicMaterial color={backgroundColor} transparent opacity={opacity} />

        {/* Simple minimap placeholder content for testing */}
        <mesh position={[0, 0, 0.1]}>
          <boxGeometry
            args={[bounds.dimensions.width * 0.8, bounds.dimensions.height * 0.6, 0.1]}
          />
          <meshBasicMaterial color="darkred" transparent opacity={0.3} />
        </mesh>

        {/* Minimap viewport indicator */}
        <mesh position={[0, 0, 0.2]}>
          <boxGeometry
            args={[bounds.dimensions.width * 0.2, bounds.dimensions.height * 0.3, 0.1]}
          />
          <meshBasicMaterial color="white" transparent opacity={0.8} />
        </mesh>
      </mesh>
    </Region>
  );
}
