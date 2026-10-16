import type { ReactNode } from "react";

/** A row's label with a notice after it, when there is one. */
export function LabelWithNotice({ notice, children }: { notice?: ReactNode; children: ReactNode }) {
  if (notice === undefined || notice === null || notice === false) return <>{children}</>;
  return (
    <div className="flex min-w-0 items-center gap-1">
      <div className="min-w-0 flex-1">{children}</div>
      <div className="flex shrink-0 items-center">{notice}</div>
    </div>
  );
}
