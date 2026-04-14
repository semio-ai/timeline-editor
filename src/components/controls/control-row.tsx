import type { ReactNode } from "react";
import { clsx } from "clsx";

export interface ControlRowProps {
  /** Left-edge target indicator (3px colored bar). */
  target?: ReactNode;
  /** Tree connector lines + expand/collapse toggle or track icon (28px). */
  icon?: ReactNode;
  /** Track label — TextField for name editing. Used for groups. */
  label?: ReactNode;
  /** Slider + value + unit for leaf tracks. Replaces label in the main column. */
  editor?: ReactNode;
  /** Options dropdown (⋮ button). */
  options?: ReactNode;
  /** Control strip — key/skip or vis/mute/lock toggle buttons. */
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
 * All rows share the same 5-column grid for alignment:
 *   [target 3px] [icon 28px] [main 1fr] [options 20px] [controls 64px]
 *
 * The main (1fr) column contains either:
 *   - Group rows: label TextField (fills space)
 *   - Leaf rows: editor (AnimatableEditor with integrated label+slider)
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
      <div className="grid h-9 w-full grid-cols-[3px_28px_minmax(0,1fr)_20px_64px] items-center gap-1 pr-1">
        {/* Target indicator */}
        <div className="h-full w-0.75">{target}</div>

        {/* Tree + icon */}
        <div className="relative grid h-full w-7 place-items-center">
          {icon ?? <div className="size-3" />}
        </div>

        {/* Main content — label for groups, editor for leaf tracks */}
        <div className="min-w-0">
          {isGroup
            ? (label ?? <div className="flex-1" />)
            : (editor ?? label ?? <div className="flex-1" />)}
        </div>

        {/* Options (⋮ dropdown) */}
        <div className="flex items-center justify-center">{options}</div>

        {/* Control strip (key/skip or vis/mute/lock) */}
        <div className="flex items-center">{controls}</div>
      </div>
    </div>
  );
}
