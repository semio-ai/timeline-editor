/**
 * Shared layout constants for the animation editor's left column.
 *
 * All rows in the left column (filter, track list, bottom sections) share
 * a 7-column grid structure:
 *
 *   [intrinsic] [flex] [fixed] [slotA] [slotB] [slotC] [slotD]
 *      auto       1fr    auto   16px    16px    16px    16px
 *
 * Different row types span these columns differently:
 * - Filter row:   col 1-3 span (search) | A (mode) | B (eye) | C (speaker) | D (lock)
 * - Track leaf:   col 1 (tree) | col 2 (label) | col 3 (slider) | A (⋮) | B-D (strip)
 * - Track group:  col 1 (tree) | col 2-3 span (label) | A (⋮) | B-D (strip)
 * - Bottom rows:  col 1-A span (content) | B | C | D
 */

/** Size of each control slot in pixels. */
export const SLOT_SIZE = 16;

/** Gap between slots in pixels. */
export const SLOT_GAP = 4;

/** Number of control slots on the right side. */
export const SLOT_COUNT = 4;

/**
 * Grid template columns for the left column.
 * Used by the outer grid and matched by inner track row grids.
 */
export const LEFT_COLUMN_GRID =
  `auto 1fr auto ${SLOT_SIZE}px ${SLOT_SIZE}px ${SLOT_SIZE}px ${SLOT_SIZE}px`;

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
