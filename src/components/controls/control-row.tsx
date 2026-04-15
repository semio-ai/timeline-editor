import type { ReactNode } from "react";
import { clsx } from "clsx";

export interface ControlRowProps {
  /** Left-edge target indicator (3px colored bar). */
  target?: ReactNode;
  /** Combined tree guide lines + icon (variable width based on depth). */
  treeIcon?: ReactNode;
  /** Track label — TextField for name editing. Used for groups. */
  label?: ReactNode;
  /** Slider + value + unit for leaf tracks. Replaces label in the main column. */
  editor?: ReactNode;
  /**
   * Right-side control area (84px, 4-slot grid).
   * Contains the ⋮ options button + 3 control buttons (key/skip or vis/mute/lock).
   * All consumers should use ControlArea to wrap their 4 buttons for alignment.
   */
  controlArea?: ReactNode;
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
 *   [target 3px] [treeIcon auto] [main 1fr] [controlArea 84px]
 *
 * The treeIcon column has variable width: (depth+1) * SLOT_WIDTH.
 * The main (1fr) column absorbs remaining space — label truncates as needed.
 * The controlArea is a fixed 84px 4-slot grid shared across all row types.
 */
export function ControlRow({
  target,
  treeIcon,
  label,
  editor,
  controlArea,
  isGroup = false,
  className,
  backgroundClassName,
}: ControlRowProps) {
  return (
    <div className={clsx("relative w-full", backgroundClassName, className)}>
      <div className="flex h-9 w-full items-center gap-1">
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

        {/* Right-side control area (84px, 4-slot grid) */}
        <div className="shrink-0">{controlArea}</div>
      </div>
    </div>
  );
}
