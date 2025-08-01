import type { ReactNode } from "react";
import { RegionBackground } from "../layout";
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
  if (!visible) {
    return null;
  }

  return (
    <RegionBackground
      regionId={DATA_VISUALIZATION_REGIONS.TIMELINE}
      color={backgroundColor}
      opacity={opacity}
    />
  );
}
