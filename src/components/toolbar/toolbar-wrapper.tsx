import { ReactNode } from "react";

export function ToolbarWrapper({
  children,
  leftPadding = 6,
  rightPadding = 4,
}: {
  children: ReactNode;
  leftPadding?: number;
  rightPadding?: number;
}) {
  return (
    <div
      className="@container flex h-9 flex-1 flex-row items-center justify-between gap-2"
      style={{ paddingLeft: leftPadding, paddingRight: rightPadding }}
    >
      {children}
    </div>
  );
}
