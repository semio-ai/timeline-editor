export type {
  Size,
  Position2D,
  Dimensions2D,
  RegionBounds,
  RegionConfig,
  GridRegionConfig,
  FlexRegionConfig,
  BaseLayoutConfig,
  GridLayoutConfig,
  FlexLayoutConfig,
  AbsoluteLayoutConfig,
  LayoutConfig,
  LayoutState,
  LayoutContextValue,
  SizeResolver,
  PositionCalculator,
  LayoutChangeEvent,
  LayoutChangeHandler,
} from "./types";

export { LayoutDirection, LayoutJustify, LayoutAlign, SizeUnit, LayoutType } from "./types";

// Utility functions
export {
  resolveSize,
  calculateTotalFractions,
  applyPadding,
  cssToThreePosition,
  calculateGridLayout,
  calculateFlexLayout,
  calculateAbsoluteLayout,
  calculatePositions,
  createSize,
} from "./utils";

// Layout hooks
export type { UseLayoutOptions, UseLayoutReturn } from "./use-layout";

export { useLayout, useResponsiveLayout, useFixedLayout } from "./use-layout";

// Layout context and provider
export type { LayoutProviderProps } from "./layout-context";

export {
  LayoutProvider,
  useLayoutContext,
  useRegion,
  useAllRegions,
  useLayoutConfig,
  useContainerSize,
  useUpdateLayout,
  withLayout,
  LayoutDebug,
} from "./layout-context";

// Region components
export type {
  RegionProps,
  RegionBackgroundProps,
  RegionContentProps,
  RegionBorderProps,
  RegionOverlayProps,
  RegionDebugProps,
} from "./region";

export {
  Region,
  RegionBackground,
  RegionContent,
  RegionBorder,
  RegionOverlay,
  RegionDebug,
  useRegionDimensions,
  useRegionPosition,
  withRegion,
} from "./region";
