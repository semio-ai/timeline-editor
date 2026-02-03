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
      <div className="w-full grid grid-cols-[64px_16px_1fr_16px] pl-1 pr-2 gap-2 h-9 items-center">
        {left ?? <div className="min-w-16 h-7" />}
        {mid ?? <div className="size-3" />}
        {main ?? <div className="flex-1 min-w-0" />}
        {right ?? DEFAULT_RIGHT}
      </div>
    </div>
  );
}
