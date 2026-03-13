import type { ReactNode } from "react";
import { clsx } from "clsx";

export interface ControlRowProps {
  left?: ReactNode;
  mid?: ReactNode;
  main?: ReactNode;
  right?: ReactNode;
  className?: string;
}

const DEFAULT_RIGHT = <div className="w-3 flex items-center justify-around mr-1" />;

export function ControlRow({ left, mid, main, right, className }: ControlRowProps) {
  return (
    <div className={clsx("relative w-full", className)}>
      {/* Mid column tracks a shared 28px icon slot so static icons and group toggles align visually. */}
      <div className="w-full grid grid-cols-[79px_28px_minmax(0,1fr)_16px] pl-1 pr-3 gap-2 h-9 items-center">
        {left ?? <div className="min-w-16 h-7" />}
        <div className="grid h-full w-7 place-items-center">
          {mid ?? <div className="size-3" />}
        </div>
        {main ?? <div className="flex-1 min-w-0" />}
        {right ?? DEFAULT_RIGHT}
      </div>
    </div>
  );
}
