import type { ReactNode } from "react";
import { RegionBackground } from "../layout";
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
  if (!visible) {
    return null;
  }

  return (
    <RegionBackground
      regionId={DATA_VISUALIZATION_REGIONS.MINIMAP}
      color={backgroundColor}
      opacity={opacity}
    />
  );
}
