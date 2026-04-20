import { LayerBand, StandardTransitionType } from "./types";

export const MIN_SHEET_HEIGHT = 182;

export const TIMELINE_PADDING = 10;
export const DEFAULT_ANIMATION_ID = "default-animation";
export const DEFAULT_TRANSITION_OUT: StandardTransitionType = StandardTransitionType.Cubic;
export const DEFAULT_TRANSITION_IN: StandardTransitionType = StandardTransitionType.Cubic;

export const DEFAULT_COLOR = "#808080";

export const RENDER_MORPH_SPRING = {
  type: "spring" as const,
  stiffness: 240,
  damping: 28,
};

export enum Z {
  Camera = 100,
  // Bounds cart is moved above the playhead cart and text when being dragged.
  ActiveBoundsCart = 97,
  // Playhead cart is above most elements but below bounds cart when being dragged.
  PlayheadCart = 96,
  // Ruler text is placed above the inactive bounds cart, but below the playhead cart.
  RulerText = 95,
  // Inactive bounds cart is below the playhead cart and ruler text, but above most other elements.
  InactiveBoundsCart = 94,
  // In-bounds overlay is above the minimap and out-of-bounds-overlay.
  InBoundsOverlay = 93,
  // Minimap is below the out-of-bounds overlay, but above most other elements.
  Minimap = 92,
  // Out of Bounds overlay is below the minimap, but above most other elements.
  OutOfBoundsOverlay = 91,

  TrackSwitchingBoundary = 15,
  // Track content/data is rendered between the bounds overlay and the violations.
  ForegroundDataSelected = 20,
  SelectedUnselectedBoundary = 10,
  ForegroundDataUnselected = 0,
  ForegroundBackgroundBoundary = -10,
  BackgroundData = -20,

  // Violations are rendered behind foreground data but in front of the background boundary.
  // Must be above decorative overlay meshes to receive click events via raycasting.
  Violations = -15,
  // Ticks are rendered in front of the background, but behind violations and data.
  Ticks = -600,
  // Backgrounds are rendered at the very back.
  Background = -500,
  // Hud Backdrops are last
  Hud = -700,
}

// These will no longer be needed when we support nested properties in the animatable values.
export const COMPLEX_TYPES = new Set(["vector2", "vector3", "euler", "rgb", "hsl"]);
export const GROUP_TYPES = new Set(["vector2", "vector3", "euler", "rgb", "hsl", "group", "entity", "instance"]);

export { SLOT_SIZE, SLOT_GAP, SLOT_COUNT, LEFT_COLUMN_GRID, EDITOR_COLUMN_WIDTH, CONTROL_AREA_4_WIDTH, CONTROL_AREA_3_WIDTH, SIDEBAR_WIDTH } from "./constants/layout";

export const TYPE_FIELDS: Record<string, string[]> = {
  vector2: ["x", "y"],
  vector3: ["x", "y", "z"],
  euler: ["r", "p", "y"],
  rgb: ["r", "g", "b"],
  hsl: ["h", "s", "l"],
};

/**
 * Small positive increment that keeps each track row at a unique depth value
 * while still allowing the global overlays (ticks, HUD, etc.) to use the
 * existing Z constants without requiring large gaps.
 */
export const ROW_DEPTH_EPSILON = 0.01;

export const LAYER_BAND_OFFSETS: Record<LayerBand, number> = {
  [LayerBand.Background]: Z.BackgroundData,
  [LayerBand.ForegroundLocked]: Z.BackgroundData + 1,
  [LayerBand.ForegroundUnselected]: Z.ForegroundDataUnselected,
  [LayerBand.ForegroundSelected]: Z.ForegroundDataSelected,
};

export const LAYER_BAND_PRIORITY: Record<LayerBand, number> = {
  [LayerBand.Background]: 0,
  [LayerBand.ForegroundLocked]: 1,
  [LayerBand.ForegroundUnselected]: 2,
  [LayerBand.ForegroundSelected]: 3,
};
