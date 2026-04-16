import type { ReactNode } from "react";
import { clsx } from "clsx";
import { SLOT_GAP, LEFT_COLUMN_GRID } from "../../constants/layout";

export interface ControlRowProps {
  /** Left-edge target indicator (3px colored bar). */
  target?: ReactNode;
  /** Combined tree guide lines + icon (variable width based on depth). */
  treeIcon?: ReactNode;
  /** Track label — TextField for name editing. Used for groups and leaf tracks. */
  label?: ReactNode;
  /** Slider + value + unit for leaf tracks. Placed in the fixed-width column after the label. */
  editor?: ReactNode;
  /** Options dropdown (⋮ button) — occupies slot A (16px). */
  options?: ReactNode;
  /** Control strip — 3 buttons (key/skip or vis/mute/lock) — occupies slots B-D. */
  controls?: ReactNode;
  /** Whether this row is a group row (label spans both flex and fixed columns). */
  isGroup?: boolean;
  /** Additional CSS class for the outer container. */
  className?: string;
  /** Background color tint for selected/hover states. */
  backgroundClassName?: string;
}

/**
 * A single row in the track list.
 *
 * Uses the shared 7-column grid from LEFT_COLUMN_GRID:
 *   [target 3px] [treeIcon auto] [label 1fr] [editor auto] [slotA] [slotB] [slotC] [slotD]
 *
 * The target indicator is outside the grid (absolute-positioned).
 * The treeIcon maps to column 1 (auto).
 * For leaf rows: label in column 2 (1fr), editor in column 3 (auto).
 * For group rows: label spans columns 2-3.
 * Slots A-D are the rightmost 4 columns (16px each with 4px gap).
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
      <div
        className="h-9 w-full items-center"
        style={{
          display: "grid",
          gridTemplateColumns: `3px ${LEFT_COLUMN_GRID}`,
          gap: `${String(SLOT_GAP)}px`,
          alignItems: "center",
        }}
      >
        {/* Target indicator — col 0 (3px) */}
        <div className="h-full">{target}</div>

        {/* Tree guide lines + icon — col 1 (auto) */}
        {treeIcon ?? <div />}

        {/* Label — col 2 (1fr); for groups spans col 2-3 */}
        <div className={clsx("min-w-0 truncate", isGroup && "col-span-2")}>{label ?? <div />}</div>

        {/* Editor (slider/value) — col 3 (auto); hidden for groups (spanned by label) */}
        {!isGroup && <div className="min-w-0">{editor ?? <div />}</div>}

        {/* Slot A: options (⋮ dropdown) */}
        <div className="flex items-center justify-center">{options}</div>
        {/* Slots B-D: control strip (3 buttons rendered as fragment) */}
        {controls}
      </div>
    </div>
  );
}
