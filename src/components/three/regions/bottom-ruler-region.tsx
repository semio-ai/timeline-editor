import type { ReactNode } from "react";
import { RegionBackground } from "../layout";
import { DATA_VISUALIZATION_REGIONS } from "../data-visualization-layout-config";

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
  if (!visible) {
    return null;
  }

  return (
    <RegionBackground
      regionId={DATA_VISUALIZATION_REGIONS.BOTTOM_RULER}
      color={backgroundColor}
      opacity={opacity}
    />
  );
}
