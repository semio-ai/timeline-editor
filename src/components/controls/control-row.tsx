import type { ReactNode } from "react";
import { clsx } from "clsx";

export interface ControlRowProps {
  /** Left-edge target indicator (3px colored bar). */
  target?: ReactNode;
  /** Tree connector lines + expand/collapse toggle or track icon (28px). */
  icon?: ReactNode;
  /** Track label — TextField for name editing (1fr, truncates). */
  label?: ReactNode;
  /** Slider + value + unit for leaf tracks. Hidden for groups. */
  editor?: ReactNode;
  /** Options dropdown (⋮ button). */
  options?: ReactNode;
  /** Control strip — key/skip or vis/mute/lock toggle buttons. */
  controls?: ReactNode;
  /** Whether this row is a group row (uses wider label, no editor). */
  isGroup?: boolean;
  /** Additional CSS class for the outer container. */
  className?: string;
  /** Background color tint for selected/hover states. */
  backgroundClassName?: string;
}

/**
 * A single row in the track list or animatable control list.
 *
 * Layout (leaf tracks):
 *   [target 3px] [icon 28px] [label 1fr] [editor 120px] [options auto] [controls auto]
 *
 * Layout (group rows):
 *   [target 3px] [icon 28px] [label --------- 1fr ----------] [options auto] [controls auto]
 */
export function ControlRow({
  target,
  icon,
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
        className={clsx(
          "grid h-9 w-full items-center gap-1 pr-1",
          isGroup
            ? "grid-cols-[3px_28px_minmax(0,1fr)_auto_auto]"
            : "grid-cols-[3px_28px_minmax(0,1fr)_auto_auto_auto]",
        )}
      >
        {/* Target indicator */}
        <div className="h-full w-[3px]">
          {target}
        </div>

        {/* Tree + icon */}
        <div className="grid h-full w-7 place-items-center">
          {icon ?? <div className="size-3" />}
        </div>

        {/* Label (fills remaining space for groups, flex for tracks) */}
        {label ?? <div className="min-w-0 flex-1" />}

        {/* Editor (slider + value) — only for leaf tracks */}
        {!isGroup && (
          <div className="flex items-center">
            {editor}
          </div>
        )}

        {/* Options (⋮ dropdown) */}
        <div className="flex items-center">
          {options}
        </div>

        {/* Control strip (key/skip or vis/mute/lock) */}
        <div className="flex items-center">
          {controls}
        </div>
      </div>
    </div>
  );
}
