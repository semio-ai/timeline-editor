import type { ReactNode } from "react";
import { RegionBackground } from "../layout";
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
  if (!visible) {
    return null;
  }

  return (
    <RegionBackground
      regionId={DATA_VISUALIZATION_REGIONS.TOP_RULER}
      color={backgroundColor}
      opacity={opacity}
    />
  );
}
