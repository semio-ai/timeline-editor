import type { ReactNode } from "react";

/**
 * Shared dimensions for right-side control areas.
 *
 * All right-side control areas use consistent slot sizing (16px per slot)
 * with 4px gaps and 4px padding on each side:
 *
 * - 4-slot (84px): filter toggles, track rows (⋮ + 3 buttons)
 *   [slot][gap][slot][gap][slot][gap][slot]
 *    4+16 + 4 + 16  + 4 + 16  + 4 + 16+4 = 84px
 *
 * - 3-slot (64px): bottom section rows (3 buttons, no ⋮)
 *   [slot][gap][slot][gap][slot]
 *    4+16 + 4 + 16  + 4 + 16+4 = 64px
 *
 * The 3-slot area right-aligns with the last 3 slots of the 4-slot area
 * because both share the same right padding and slot/gap sizing.
 */

/** 4-slot control area (filter toggles, track rows). */
export const CONTROL_AREA_4_CLASS = "grid h-7 w-21 grid-cols-4 items-center gap-1 px-1";

/** 3-slot control area (bottom section rows). */
export const CONTROL_AREA_3_CLASS = "grid h-7 w-16 grid-cols-3 items-center gap-1 px-1";

export interface ControlAreaProps {
  children: ReactNode;
  /** Number of slots: 4 for track/filter rows, 3 for bottom section rows. */
  slots?: 3 | 4;
}

/**
 * A fixed-width grid container for right-side controls.
 * Ensures consistent sizing and vertical alignment across all row types.
 */
export function ControlArea({ children, slots = 4 }: ControlAreaProps) {
  return (
    <div className={slots === 3 ? CONTROL_AREA_3_CLASS : CONTROL_AREA_4_CLASS}>
      {children}
    </div>
  );
}
