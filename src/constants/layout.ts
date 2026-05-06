/**
 * Shared layout constants for the animation editor's left column.
 *
 * All rows in the left column (filter, track list, bottom sections) share
 * a structure ending with a fixed-width scrollbar gutter so the visible
 * scrollbar (Radix overlay; ~10px wide) doesn't sit on top of any control:
 *
 *   [intrinsic] [flex] [fixed] [slotA] [slotB] [slotC] [slotD] [gutter]
 *      auto       1fr    auto   16px    16px    16px    16px    12px
 *
 * Different row types span these columns differently:
 * - Filter row:   col 1-3 span (search) | A (mode) | B (eye) | C (speaker) | D (lock) | gutter
 * - Track leaf:   col 1 (tree) | col 2 (label) | col 3 (slider) | A (⋮) | B-D (strip) | gutter
 * - Track group:  col 1 (tree) | col 2-3 span (label) | A (⋮) | B-D (strip) | gutter
 * - Bottom rows:  col 1-A span (content) | B | C | D | gutter
 *
 * The gutter is left empty by every row (no item placed in it). It exists
 * purely to reserve space inside the row's grid for the vertical scrollbar
 * that appears on hover, so row backgrounds / hover tints can extend flush
 * to the panel edge while the scrollbar overlays the gutter rather than
 * overlapping any interactive element.
 */

/**
 * Content width of the sidebar and the animation editor's left (track list) section.
 * Shared so both stay in sync. Used by the studio layout pane specs and the
 * animation sheet grid template.
 *
 * The animation sheet grid column is SIDEBAR_WIDTH + 2 to account for the 2px
 * right padding (pr-0.5) between the track list and the canvas.
 */
export const SIDEBAR_WIDTH = 400;

/** Size of each control slot in pixels. */
export const SLOT_SIZE = 16;

/** Gap between slots in pixels. */
export const SLOT_GAP = 4;

/** Number of control slots on the right side. */
export const SLOT_COUNT = 4;

/**
 * Fixed width of the slider/value editor column for leaf track rows.
 * Approximately 2/3 of the full-width slider.
 */
export const EDITOR_COLUMN_WIDTH = 120;

/**
 * Width reserved at the row's right edge for the vertical scrollbar overlay.
 * Sized to clear Radix's `w-2.5` (10px) scrollbar with a couple of px to
 * spare. Applied as a trailing column in every left-column row grid (and
 * in the matching animation-sheet rows) so row backgrounds can extend
 * flush to the panel edge without the scrollbar overlapping any control.
 */
export const SCROLLBAR_GUTTER = 12;

/**
 * Grid template columns for the left column.
 * Used by the outer grid and matched by inner track row grids.
 */
export const LEFT_COLUMN_GRID =
  `auto 1fr ${EDITOR_COLUMN_WIDTH}px ${SLOT_SIZE}px ${SLOT_SIZE}px ${SLOT_SIZE}px ${SLOT_SIZE}px ${SCROLLBAR_GUTTER}px`;

/**
 * Total width of the 4-slot control area (including gaps and padding).
 * 4 slots × 16px + 3 gaps × 4px = 76px
 */
export const CONTROL_AREA_4_WIDTH = SLOT_COUNT * SLOT_SIZE + (SLOT_COUNT - 1) * SLOT_GAP;

/**
 * Total width of the 3-slot control area (for bottom rows).
 * 3 slots × 16px + 2 gaps × 4px = 56px
 */
export const CONTROL_AREA_3_WIDTH = 3 * SLOT_SIZE + 2 * SLOT_GAP;
