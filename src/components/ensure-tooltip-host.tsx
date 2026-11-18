import type { ReactNode } from "react";
import { TooltipHost, useTooltipHost } from "@semio/ui";

/**
 * Guarantees a single root `TooltipHost` above its children.
 *
 * Every *root* `TooltipHost` (one with no host above it) renders every visible
 * 3D overlay from the shared tooltip store. The sheet's canvases each mount
 * their own `TooltipHost`, so with nothing above them each canvas host is a
 * root and one right-click menu or violation popover renders once per canvas,
 * stacked. Wrapping them in one host makes theirs nested, so only that one
 * renders overlays. When a host already exists above (an app that mounts one
 * at its root), this adds nothing.
 */
export function EnsureTooltipHost({ children }: { children: ReactNode }): ReactNode {
  const host = useTooltipHost();
  if (host) return children;
  return <TooltipHost className="w-full">{children}</TooltipHost>;
}
