import type { ReactNode } from "react";
import { clsx } from "clsx";

export interface ControlRowProps {
  left?: ReactNode;
  mid?: ReactNode;
  main?: ReactNode;
  right?: ReactNode;
  className?: string;
}

const DEFAULT_RIGHT = <div className="mr-1 flex w-3 items-center justify-around" />;

export function ControlRow({ left, mid, main, right, className }: ControlRowProps) {
  return (
    <div className={clsx("relative w-full", className)}>
      {/* Mid column tracks a shared 28px icon slot so static icons and group toggles align visually. */}
      <div className="grid h-9 w-full grid-cols-[79px_28px_minmax(0,1fr)_16px] items-center gap-2 pr-3 pl-1">
        {left ?? <div className="h-7 min-w-16" />}
        <div className="grid h-full w-7 place-items-center">
          {mid ?? <div className="size-3" />}
        </div>
        {main ?? <div className="min-w-0 flex-1" />}
        {right ?? DEFAULT_RIGHT}
      </div>
    </div>
  );
}
