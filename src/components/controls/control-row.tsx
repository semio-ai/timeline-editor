import type { ReactNode } from "react";
import { clsx } from "clsx";
import { SLOT_SIZE, SLOT_GAP } from "../../constants/layout";

export interface ControlRowProps {
  /** Left-edge target indicator (3px colored bar). */
  target?: ReactNode;
  /** Combined tree guide lines + icon (variable width based on depth). */
  treeIcon?: ReactNode;
  /** Track label — TextField for name editing. Used for groups. */
  label?: ReactNode;
  /** Slider + value + unit for leaf tracks. Replaces label in the main column. */
  editor?: ReactNode;
  /** Options dropdown (⋮ button) — occupies slot A (16px). */
  options?: ReactNode;
  /** Control strip — 3 buttons (key/skip or vis/mute/lock) — occupies slots B-D. */
  controls?: ReactNode;
  /** Whether this row is a group row (uses label, no editor). */
  isGroup?: boolean;
  /** Additional CSS class for the outer container. */
  className?: string;
  /** Background color tint for selected/hover states. */
  backgroundClassName?: string;
}

/**
 * A single row in the track list or animatable control list.
 *
 * Layout:
 *   [target 3px] [treeIcon auto] [main 1fr] | [slotA 16px] [slotB 16px] [slotC 16px] [slotD 16px]
 *
 * The right 4 slots use the shared SLOT_SIZE and SLOT_GAP constants
 * for alignment with the filter row and bottom section rows.
 */
export function ControlRow({
  target,
  treeIcon,
  label,
  editor,
  options,
  controls,
  isGroup = false,
  className,
  backgroundClassName,
}: ControlRowProps) {
  return (
    <div className={clsx("relative w-full", backgroundClassName, className)}>
      <div className="flex h-9 w-full items-center">
        {/* Target indicator */}
        <div className="h-full w-0.75 shrink-0">{target}</div>

        {/* Tree guide lines + icon (variable width) */}
        {treeIcon}

        {/* Main content — label for groups, editor for leaf tracks */}
        <div className="min-w-0 flex-1">
          {isGroup
            ? (label ?? <div className="flex-1" />)
            : (editor ?? label ?? <div className="flex-1" />)}
        </div>

        {/* Right-side slots: [⋮] [btn] [btn] [btn] — 4 × SLOT_SIZE with SLOT_GAP */}
        <div
          className="shrink-0"
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(4, ${String(SLOT_SIZE)}px)`,
            gap: `${String(SLOT_GAP)}px`,
            justifyItems: "center",
            alignItems: "center",
            height: "100%",
          }}
        >
          {/* Slot A: options (⋮ dropdown) */}
          <div className="flex items-center justify-center">{options}</div>
          {/* Slots B-D: control strip (3 buttons rendered as fragment) */}
          {controls}
        </div>
      </div>
    </div>
  );
}
