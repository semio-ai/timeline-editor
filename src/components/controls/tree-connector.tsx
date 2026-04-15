import { memo, type ReactNode } from "react";

export interface TreeIconColumnProps {
  /** Nesting depth (0 = top-level). */
  depth: number;
  /** The icon content (expand/collapse toggle or track icon). */
  icon: ReactNode;
}

/**
 * Width of each nesting slot in pixels. Each depth level occupies one slot.
 * The icon always occupies the rightmost slot; guide lines occupy ancestor slots.
 */
export const SLOT_WIDTH = 24;

/**
 * Combined tree guide lines + icon column.
 *
 * Renders a single element whose width is `(depth + 1) * SLOT_WIDTH`.
 * Each depth level gets a fixed-width slot. Ancestor slots render vertical
 * guide lines; the rightmost slot renders the icon. Both are centered
 * within their respective slots, ensuring consistent alignment.
 *
 * ```
 * depth=0:  [icon]
 * depth=1:  [guide₀][icon]
 * depth=2:  [guide₀][guide₁][icon]
 * ```
 */
export const TreeIconColumn = memo(function TreeIconColumn({
  depth,
  icon,
}: TreeIconColumnProps) {
  const totalSlots = depth + 1;
  const width = totalSlots * SLOT_WIDTH;

  return (
    <div className="relative flex h-full shrink-0 items-center" style={{ width }}>
      {/* Guide lines for each ancestor depth level */}
      {Array.from({ length: depth }, (_, i) => (
        <div
          key={i}
          className="absolute top-0 h-full w-px bg-neutral-500/20"
          style={{ left: i * SLOT_WIDTH + SLOT_WIDTH / 2 }}
        />
      ))}

      {/* Icon in the rightmost slot, centered */}
      <div
        className="absolute flex items-center justify-center overflow-visible"
        style={{
          left: depth * SLOT_WIDTH,
          width: SLOT_WIDTH,
          height: "100%",
        }}
      >
        {icon}
      </div>
    </div>
  );
});
