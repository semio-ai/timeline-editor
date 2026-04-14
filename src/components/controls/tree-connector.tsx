import { memo } from "react";

export interface TreeConnectorProps {
  /** Nesting depth (0 = top-level, no connectors). */
  depth: number;
  /** Whether this row is the last child of its parent. */
  isLastChild: boolean;
  /** Whether this row is a group (renders expand/collapse toggle). */
  isGroup: boolean;
  /**
   * Ancestor "last child" flags, from root (index 0) to parent (index depth-1).
   * If an ancestor is the last child at its level, no vertical guide line
   * is drawn at that depth.
   */
  ancestorIsLast: boolean[];
}

/** Width in pixels per indent level. Must be >= 14 (half icon column) for guide alignment. */
export const INDENT_PX = 20;

/**
 * Renders vertical indent guide lines for tree hierarchy visualization.
 * Each guide is a thin vertical line at the indent position of an ancestor
 * that has more siblings below it. No horizontal stubs — the icon renders
 * immediately after the indent space.
 *
 * Rendered as an inline element with fixed width = depth * INDENT_PX.
 * The parent grid allocates space for this before the icon column.
 */
export const TreeConnector = memo(function TreeConnector({
  depth,
}: TreeConnectorProps) {
  if (depth === 0) return null;

  const width = depth * INDENT_PX;

  return (
    <div className="relative h-full shrink-0" style={{ width }}>
      {/* Render a vertical guide line at each depth level where a parent exists.
          Lines run the full height of the row — they connect visually across
          all sibling rows at that depth. */}
      {Array.from({ length: depth }, (_, i) => {
        // Position each guide at a consistent offset per level.
        // Each level's guide aligns to the center of that level's indent slot.
        const x = i * INDENT_PX + INDENT_PX / 2;
        return (
          <div
            key={i}
            className="absolute top-0 h-full w-px bg-neutral-500/20"
            style={{ left: x }}
          />
        );
      })}
    </div>
  );
});
