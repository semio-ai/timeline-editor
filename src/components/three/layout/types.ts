export enum LayoutDirection {
  Row = "row",
  Column = "column",
}

export enum LayoutJustify {
  Start = "start",
  End = "end",
  Center = "center",
  SpaceBetween = "space-between",
  SpaceAround = "space-around",
  SpaceEvenly = "space-evenly",
}

export enum LayoutAlign {
  Start = "start",
  End = "end",
  Center = "center",
  Stretch = "stretch",
}

export enum SizeUnit {
  Pixels = "px",
  Percent = "%",
  Fraction = "fr",
  Auto = "auto",
  MinContent = "min-content",
  MaxContent = "max-content",
}

export interface Size {
  value: number | "auto" | "min-content" | "max-content";
  unit: SizeUnit;
}

export interface Position2D {
  x: number;
  y: number;
}

export interface Dimensions2D {
  width: number;
  height: number;
}

export interface RegionBounds {
  position: Position2D;
  dimensions: Dimensions2D;
  center: Position2D;
}

export interface RegionConfig {
  id: string;
  width?: Size;
  height?: Size;
  minWidth?: Size;
  maxWidth?: Size;
  minHeight?: Size;
  maxHeight?: Size;
  flexGrow?: number;
  flexShrink?: number;
  zIndex?: number;
  visible?: boolean;
}

export interface GridRegionConfig extends RegionConfig {
  gridRow?: string;
  gridColumn?: string;
  gridArea?: string;
}

export interface FlexRegionConfig extends RegionConfig {
  order?: number;
}

export enum LayoutType {
  Grid = "grid",
  Flex = "flex",
  Absolute = "absolute",
}

export interface BaseLayoutConfig {
  type: LayoutType;
  gap?: number;
  padding?: {
    top?: number;
    right?: number;
    bottom?: number;
    left?: number;
  };
}

export interface GridLayoutConfig extends BaseLayoutConfig {
  type: LayoutType.Grid;
  rows: Size[];
  columns: Size[];
  regions: GridRegionConfig[];
}

export interface FlexLayoutConfig extends BaseLayoutConfig {
  type: LayoutType.Flex;
  direction: LayoutDirection;
  justify: LayoutJustify;
  align: LayoutAlign;
  wrap?: boolean;
  regions: FlexRegionConfig[];
}

export interface AbsoluteLayoutConfig extends BaseLayoutConfig {
  type: LayoutType.Absolute;
  regions: (RegionConfig & {
    position: Position2D;
    dimensions: Dimensions2D;
  })[];
}

export type LayoutConfig = GridLayoutConfig | FlexLayoutConfig | AbsoluteLayoutConfig;

export interface LayoutState {
  config: LayoutConfig;
  containerSize: Dimensions2D;
  regions: Map<string, RegionBounds>;
}

export interface LayoutContextValue {
  state: LayoutState;
  getRegion: (id: string) => RegionBounds | undefined;
  updateConfig: (config: LayoutConfig) => void;
  updateContainerSize: (size: Dimensions2D) => void;
}

// Helper function types
export type SizeResolver = (size: Size, containerSize: number, totalFractions?: number) => number;
export type PositionCalculator = (config: LayoutConfig, containerSize: Dimensions2D) => Map<string, RegionBounds>;

// Event types for layout changes
export interface LayoutChangeEvent {
  regionId: string;
  bounds: RegionBounds;
  previousBounds?: RegionBounds;
}

export type LayoutChangeHandler = (event: LayoutChangeEvent) => void;
