import type { GridLayoutConfig, GridRegionConfig } from "./layout";
import { LayoutType, createSize } from "./layout";

// Region IDs - these should match what components use
export const DATA_VISUALIZATION_REGIONS = {
  TOP_RULER: "top-ruler",
  TRACK_LIST: "track-list",
  TIMELINE: "timeline",
  MINIMAP: "minimap",
  BOTTOM_RULER: "bottom-ruler",
} as const;

// Region colors for visual identification
export const DATA_VISUALIZATION_REGION_COLORS = {
  [DATA_VISUALIZATION_REGIONS.TOP_RULER]: "cyan",
  [DATA_VISUALIZATION_REGIONS.TRACK_LIST]: "beige",
  [DATA_VISUALIZATION_REGIONS.TIMELINE]: "orange",
  [DATA_VISUALIZATION_REGIONS.MINIMAP]: "red",
  [DATA_VISUALIZATION_REGIONS.BOTTOM_RULER]: "lime",
} as const;

// Default heights for fixed-size regions
export const DATA_VISUALIZATION_HEIGHTS = {
  TOP_RULER: 32,
  TIMELINE: 36,
  MINIMAP: 36,
  BOTTOM_RULER: 36,
} as const;

// Calculate total fixed height
export const DATA_VISUALIZATION_FIXED_HEIGHT =
  DATA_VISUALIZATION_HEIGHTS.TOP_RULER +
  DATA_VISUALIZATION_HEIGHTS.TIMELINE +
  DATA_VISUALIZATION_HEIGHTS.MINIMAP +
  DATA_VISUALIZATION_HEIGHTS.BOTTOM_RULER;

/**
 * Creates the default data visualization layout configuration
 */
export function createDataVisualizationLayoutConfig(): GridLayoutConfig {
  const regions: GridRegionConfig[] = [
    {
      id: DATA_VISUALIZATION_REGIONS.TOP_RULER,
      gridRow: "1 / 2",
      gridColumn: "1 / 2",
    },
    {
      id: DATA_VISUALIZATION_REGIONS.TRACK_LIST,
      gridRow: "2 / 3",
      gridColumn: "1 / 2",
    },
    {
      id: DATA_VISUALIZATION_REGIONS.TIMELINE,
      gridRow: "3 / 4",
      gridColumn: "1 / 2",
    },
    {
      id: DATA_VISUALIZATION_REGIONS.MINIMAP,
      gridRow: "4 / 5",
      gridColumn: "1 / 2",
    },
    {
      id: DATA_VISUALIZATION_REGIONS.BOTTOM_RULER,
      gridRow: "5 / 6",
      gridColumn: "1 / 2",
    },
  ];

  return {
    type: LayoutType.Grid,
    rows: [
      createSize.px(DATA_VISUALIZATION_HEIGHTS.TOP_RULER),
      createSize.fr(1), // Track list takes remaining space
      createSize.px(DATA_VISUALIZATION_HEIGHTS.TIMELINE),
      createSize.px(DATA_VISUALIZATION_HEIGHTS.MINIMAP),
      createSize.px(DATA_VISUALIZATION_HEIGHTS.BOTTOM_RULER),
    ],
    columns: [
      createSize.fr(1), // Single column takes full width
    ],
    regions,
    gap: 0, // No gaps between regions
  };
}

/**
 * Creates a data visualization layout with custom heights
 */
export function createCustomDataVisualizationLayoutConfig(customHeights: {
  topRuler?: number;
  timeline?: number;
  minimap?: number;
  bottomRuler?: number;
}): GridLayoutConfig {
  const heights = {
    topRuler: customHeights.topRuler ?? DATA_VISUALIZATION_HEIGHTS.TOP_RULER,
    timeline: customHeights.timeline ?? DATA_VISUALIZATION_HEIGHTS.TIMELINE,
    minimap: customHeights.minimap ?? DATA_VISUALIZATION_HEIGHTS.MINIMAP,
    bottomRuler: customHeights.bottomRuler ?? DATA_VISUALIZATION_HEIGHTS.BOTTOM_RULER,
  };

  const regions: GridRegionConfig[] = [
    {
      id: DATA_VISUALIZATION_REGIONS.TOP_RULER,
      gridRow: "1 / 2",
      gridColumn: "1 / 2",
    },
    {
      id: DATA_VISUALIZATION_REGIONS.TRACK_LIST,
      gridRow: "2 / 3",
      gridColumn: "1 / 2",
    },
    {
      id: DATA_VISUALIZATION_REGIONS.TIMELINE,
      gridRow: "3 / 4",
      gridColumn: "1 / 2",
    },
    {
      id: DATA_VISUALIZATION_REGIONS.MINIMAP,
      gridRow: "4 / 5",
      gridColumn: "1 / 2",
    },
    {
      id: DATA_VISUALIZATION_REGIONS.BOTTOM_RULER,
      gridRow: "5 / 6",
      gridColumn: "1 / 2",
    },
  ];

  return {
    type: LayoutType.Grid,
    rows: [
      createSize.px(heights.topRuler),
      createSize.fr(1), // Track list takes remaining space
      createSize.px(heights.timeline),
      createSize.px(heights.minimap),
      createSize.px(heights.bottomRuler),
    ],
    columns: [
      createSize.fr(1), // Single column takes full width
    ],
    regions,
    gap: 0,
  };
}

/**
 * Creates a minimal data visualization layout with only essential regions
 */
export function createMinimalDataVisualizationLayoutConfig(): GridLayoutConfig {
  const regions: GridRegionConfig[] = [
    {
      id: DATA_VISUALIZATION_REGIONS.TRACK_LIST,
      gridRow: "1 / 2",
      gridColumn: "1 / 2",
    },
    {
      id: DATA_VISUALIZATION_REGIONS.TIMELINE,
      gridRow: "2 / 3",
      gridColumn: "1 / 2",
    },
  ];

  return {
    type: LayoutType.Grid,
    rows: [
      createSize.fr(1), // Track list takes most space
      createSize.px(DATA_VISUALIZATION_HEIGHTS.TIMELINE),
    ],
    columns: [createSize.fr(1)],
    regions,
    gap: 0,
  };
}

/**
 * Default data visualization layout configuration
 */
export const DEFAULT_DATA_VISUALIZATION_LAYOUT = createDataVisualizationLayoutConfig();

/**
 * Get region color by region ID
 */
export function getDataVisualizationRegionColor(regionId: string): string {
  return (
    DATA_VISUALIZATION_REGION_COLORS[regionId as keyof typeof DATA_VISUALIZATION_REGION_COLORS] ||
    "#ffffff"
  );
}

/**
 * Check if a region ID is a valid data visualization region
 */
export function isDataVisualizationRegion(
  regionId: string,
): regionId is keyof typeof DATA_VISUALIZATION_REGIONS {
  return Object.values(DATA_VISUALIZATION_REGIONS).includes(
    regionId as (typeof DATA_VISUALIZATION_REGIONS)[keyof typeof DATA_VISUALIZATION_REGIONS],
  );
}
