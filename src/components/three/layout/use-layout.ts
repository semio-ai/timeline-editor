import { useMemo, useCallback, useState, useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import type {
  LayoutConfig,
  LayoutState,
  RegionBounds,
  Dimensions2D,
  LayoutChangeEvent,
  LayoutChangeHandler,
} from "./types";
import { calculatePositions } from "./utils";

export interface UseLayoutOptions {
  config: LayoutConfig;
  onLayoutChange?: LayoutChangeHandler;
  containerSize?: Dimensions2D;
}

export interface UseLayoutReturn {
  state: LayoutState;
  getRegion: (id: string) => RegionBounds | undefined;
  updateConfig: (config: LayoutConfig) => void;
  updateContainerSize: (size: Dimensions2D) => void;
  containerSize: Dimensions2D;
}

export function useLayout({
  config,
  onLayoutChange,
  containerSize: customContainerSize,
}: UseLayoutOptions): UseLayoutReturn {
  const { size: threeSize } = useThree();

  // Use custom container size if provided, otherwise use three.js canvas size
  const containerSize = useMemo(() => {
    return (
      customContainerSize || {
        width: threeSize.width,
        height: threeSize.height,
      }
    );
  }, [customContainerSize, threeSize.width, threeSize.height]);

  const [currentConfig, setCurrentConfig] = useState<LayoutConfig>(config);
  const [previousRegions, setPreviousRegions] = useState<Map<string, RegionBounds>>(new Map());

  // Calculate region positions when config or container size changes
  const regions = useMemo(() => {
    return calculatePositions(currentConfig, containerSize);
  }, [currentConfig, containerSize]);

  // Create layout state
  const state = useMemo<LayoutState>(
    () => ({
      config: currentConfig,
      containerSize,
      regions,
    }),
    [currentConfig, containerSize, regions],
  );

  // Trigger layout change events when regions change
  useEffect(() => {
    if (!onLayoutChange) return;

    const currentRegionIds = new Set(regions.keys());
    const previousRegionIds = new Set(previousRegions.keys());

    // Check for new, updated, or removed regions
    const allRegionIds = new Set([...currentRegionIds, ...previousRegionIds]);

    allRegionIds.forEach((regionId) => {
      const currentBounds = regions.get(regionId);
      const previousBounds = previousRegions.get(regionId);

      // Skip if bounds haven't changed
      if (currentBounds && previousBounds && boundsEqual(currentBounds, previousBounds)) {
        return;
      }

      // Trigger change event for new or updated regions
      if (currentBounds) {
        const event: LayoutChangeEvent = {
          regionId,
          bounds: currentBounds,
          previousBounds,
        };
        onLayoutChange(event);
      }
    });

    setPreviousRegions(new Map(regions));
  }, [regions, previousRegions, onLayoutChange]);

  // Update config from external changes
  useEffect(() => {
    setCurrentConfig(config);
  }, [config]);

  const getRegion = useCallback(
    (id: string): RegionBounds | undefined => {
      return regions.get(id);
    },
    [regions],
  );

  const updateConfig = useCallback((newConfig: LayoutConfig) => {
    setCurrentConfig(newConfig);
  }, []);

  const updateContainerSize = useCallback((_size: Dimensions2D) => {
    // This is mainly for cases where we're not using the three.js size
    // In most cases, the container size will be managed automatically
    console.warn(
      "updateContainerSize called, but container size is managed automatically from useThree()",
    );
  }, []);

  return {
    state,
    getRegion,
    updateConfig,
    updateContainerSize,
    containerSize,
  };
}

/**
 * Helper function to compare region bounds for equality
 */
function boundsEqual(a: RegionBounds, b: RegionBounds): boolean {
  return (
    a.position.x === b.position.x &&
    a.position.y === b.position.y &&
    a.dimensions.width === b.dimensions.width &&
    a.dimensions.height === b.dimensions.height &&
    a.center.x === b.center.x &&
    a.center.y === b.center.y
  );
}

/**
 * Hook variant that automatically updates when the three.js canvas size changes
 */
export function useResponsiveLayout(
  config: LayoutConfig,
  onLayoutChange?: LayoutChangeHandler,
): UseLayoutReturn {
  return useLayout({ config, onLayoutChange });
}

/**
 * Hook variant for fixed-size layouts that don't respond to canvas changes
 */
export function useFixedLayout(
  config: LayoutConfig,
  containerSize: Dimensions2D,
  onLayoutChange?: LayoutChangeHandler,
): UseLayoutReturn {
  return useLayout({ config, containerSize, onLayoutChange });
}
