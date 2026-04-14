import { memo } from "react";
import { clsx } from "clsx";

export interface TreeConnectorProps {
  /** Nesting depth (0 = top-level, no connectors). */
  depth: number;
  /** Whether this row is the last child of its parent. */
  isLastChild: boolean;
  /** Whether this row is a group (renders expand/collapse toggle). */
  isGroup: boolean;
  /**
   * Ancestor "last child" flags, from root (index 0) to parent (index depth-1).
   * If an ancestor is the last child at its level, no vertical continuation
   * line is drawn at that depth. Length should equal `depth`.
   */
  ancestorIsLast: boolean[];
}

/**
 * Renders tree connector lines within a 28×36px cell.
 * Uses thin 1px lines to show parent-child relationships:
 *
 * - Vertical lines (│) continue through non-last ancestors
 * - Corner (└) for last children
 * - Tee (├) for non-last children
 * - No lines at depth 0 (top-level items)
 *
 * The actual icon (expand toggle or track icon) is rendered separately
 * on top of this component by the parent ControlRow.
 */
export const TreeConnector = memo(function TreeConnector({
  depth,
  isLastChild,
  ancestorIsLast,
}: TreeConnectorProps) {
  if (depth === 0) return null;

  // The connector occupies the full 28px × 36px icon cell.
  // We draw lines at specific horizontal positions based on depth.
  // Since we don't indent, all connector lines are within this single cell,
  // stacked at increasing x offsets from the left edge.

  // Available width: 28px. We allocate 8px per depth level for connector lines,
  // with the rightmost position reserved for this row's own connector.
  const lineSpacing = 8;
  const cellCenter = 14; // Center of the 28px cell

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Vertical continuation lines for each ancestor depth */}
      {ancestorIsLast.map((ancestorLast, i) => {
        if (ancestorLast) return null; // No line if ancestor was last child
        const level = i + 1; // Depth levels start at 1
        const x = cellCenter - (depth - level) * lineSpacing;
        if (x < 0 || x > 28) return null; // Clip if too many levels
        return (
          <div
            key={`v-${i.toString()}`}
            className="absolute top-0 h-full w-px bg-neutral-500/30"
            style={{ left: x }}
          />
        );
      })}

      {/* This row's own connector: corner (└) or tee (├) */}
      <div
        className="absolute w-px bg-neutral-500/30"
        style={{
          left: cellCenter,
          top: 0,
          height: isLastChild ? "50%" : "100%",
        }}
      />
      {/* Horizontal stub connecting to the icon */}
      <div
        className="absolute h-px bg-neutral-500/30"
        style={{
          left: cellCenter,
          top: "50%",
          width: cellCenter, // Extend to right edge of the cell
        }}
      />
    </div>
  );
});
