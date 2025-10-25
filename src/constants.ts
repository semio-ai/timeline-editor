import { Transition } from "motion";
import { LayerBand } from "./types";

export const TIMELINE_PADDING = 10;
export const DEFAULT_ANIMATION_ID = "default-animation";
export const DEFAULT_TRACK_HEIGHT = 36;

export const CARET_HALF_WIDTH = 6;
export const VERTICAL_POINTER_PATH = `M${(-1 * CARET_HALF_WIDTH).toString()},18L${(-1 * CARET_HALF_WIDTH).toString()},2C${(-1 * CARET_HALF_WIDTH).toString()},0.896 ${(-1 * CARET_HALF_WIDTH + 0.896).toString()},0 ${(-1 * CARET_HALF_WIDTH + 2).toString()},0L${(CARET_HALF_WIDTH - 2).toString()},0C${(CARET_HALF_WIDTH - 0.896).toString()},0 ${CARET_HALF_WIDTH.toString()},0.896 ${CARET_HALF_WIDTH.toString()},2L${CARET_HALF_WIDTH.toString()},18C${CARET_HALF_WIDTH.toString()},18.953 0,23 0,23C0,23 ${(-1 * CARET_HALF_WIDTH).toString()},18.953 ${(-1 * CARET_HALF_WIDTH).toString()},18Z`;
export const HORIZONTAL_POINTER_PATH = `M${(-1 * CARET_HALF_WIDTH + 2).toString()},18.333C${(-1 * CARET_HALF_WIDTH + 1.5).toString()},16.667 ${(-1 * CARET_HALF_WIDTH).toString()},10 ${(-1 * CARET_HALF_WIDTH).toString()},10C${(-1 * CARET_HALF_WIDTH).toString()},10 ${(-1 * CARET_HALF_WIDTH + 1.5).toString()},3.333 ${(-1 * CARET_HALF_WIDTH + 2).toString()},1.667C${(-1 * CARET_HALF_WIDTH + 2.231).toString()},0.896 ${(-1 * CARET_HALF_WIDTH + 2.448).toString()},0 ${(-1 * CARET_HALF_WIDTH + 3).toString()},0L${(CARET_HALF_WIDTH - 3).toString()},0C${(CARET_HALF_WIDTH - 2.448).toString()},0 ${(CARET_HALF_WIDTH - 2.231).toString()},0.896 ${(CARET_HALF_WIDTH - 2).toString()},1.667C${(CARET_HALF_WIDTH - 1.5).toString()},3.333 ${CARET_HALF_WIDTH.toString()},10 ${CARET_HALF_WIDTH.toString()},10C${CARET_HALF_WIDTH.toString()},10 ${(CARET_HALF_WIDTH - 1.5).toString()},16.667 ${(CARET_HALF_WIDTH - 2).toString()},18.333C${(CARET_HALF_WIDTH - 2.231).toString()},19.104 ${(CARET_HALF_WIDTH - 2.448).toString()},20 ${(CARET_HALF_WIDTH - 3).toString()},20L${(-1 * CARET_HALF_WIDTH + 3).toString()},20C${(-1 * CARET_HALF_WIDTH + 2.448).toString()},20 ${(-1 * CARET_HALF_WIDTH + 2.231).toString()},19.104 ${(-1 * CARET_HALF_WIDTH + 2).toString()},18.333Z`;
export const VERTICAL_HALF_POINTER_PATH = `M0,23L0,2C0,0.896 0.896,0 ${(CARET_HALF_WIDTH / 2).toString()},0C${(CARET_HALF_WIDTH - 0.896).toString()},0 ${CARET_HALF_WIDTH.toString()},0.896 ${CARET_HALF_WIDTH.toString()},2L${CARET_HALF_WIDTH.toString()},18C${CARET_HALF_WIDTH.toString()},18.953 0,23 0,23Z`;

export const TRANSITION_CONFIG: Transition = {
  type: "tween" as const,
  duration: 0.2,
  ease: "easeInOut",
} as const;

export const DEFAULT_COLOR = "#808080";

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

  // Track content/data is rendered between the bounds overlay and the violations.
  ForegroundDataSelected = 20,
  SelectedUnselectedBoundary = 10,
  ForegroundDataUnselected = 0,
  TrackSwitchingBoundary = -5,
  ForegroundBackgroundBoundary = -10,
  BackgroundData = -20,

  // Violations are rendered in front of ticks and background, but behind data.
  Violations = -300,
  // Ticks are rendered in front of the background, but behind violations and data.
  Ticks = -600,
  // Backgrounds are rendered at the very back.
  Background = -500,
  // Hud Backdrops are last
  Hud = -700,
}

// These will no longer be needed when we support nested properties in the animatable values.
export const COMPLEX_TYPES = new Set(["vector2", "vector3", "euler", "rgb", "hsl"]);
export const GROUP_TYPES = new Set(["vector2", "vector3", "euler", "rgb", "hsl", "group"]);

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

/**
 * Computes the base Z position for a given row index. Rows are spaced by a
 * minimal epsilon so depth testing can still differentiate them, but they
 * remain effectively flat relative to the overlays rendered in front/behind.
 */
export function computeRowBaseZ(rowIndex: number): number {
  return rowIndex * ROW_DEPTH_EPSILON;
}

/**
 * Render order priorities for meshes that belong to an individual track row.
 * Smaller numbers render first. Keep these values centralised so the relative
 * ordering stays predictable across components that participate in the same
 * row band.
 */
export enum RenderOrder {
  RowBackdrop = 100,
  TransitionFill = 200,
  DataPointBackplate = 300,
  DataPointFill = 400,
  TransitionLine = 500,
  DataPointLine = 600,
  RowOverlay = 700,
}

export const LAYER_BAND_OFFSETS: Record<LayerBand, number> = {
  [LayerBand.Background]: Z.BackgroundData,
  [LayerBand.ForegroundUnselected]: Z.ForegroundDataUnselected,
  [LayerBand.ForegroundSelected]: Z.ForegroundDataSelected,
};

export const LAYER_BAND_PRIORITY: Record<LayerBand, number> = {
  [LayerBand.Background]: 0,
  [LayerBand.ForegroundUnselected]: 1,
  [LayerBand.ForegroundSelected]: 2,
};
