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
 * renders overlays. The store is global, so this guarantees one root per
 * subtree, not per page: any other root on the page renders each overlay too.
 * When a host already exists above (an app that mounts one at its root), this
 * renders its children with no added element.
 *
 * Overlay content is rendered as React children of the root host, so it sees
 * only the contexts above that host. Place this inside any provider overlay
 * content reads (names, colors, keybindings); outside them, the content falls
 * back to each context's default value.
 */
export function EnsureTooltipHost({ children }: { children: ReactNode }): ReactNode {
  const host = useTooltipHost();
  if (host) return children;
  return <TooltipHost className="w-full">{children}</TooltipHost>;
}
