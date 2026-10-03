import { ReactNode } from "react";
import { Icon, NestedItem, NestedLabel } from "@semio/ui";

/**
 * "Zoom Actions" section for minimap context menu.
 *
 * Store state is passed as props since context menu content renders
 * in a Radix portal outside the animation context tree.
 */
export function ZoomActionsSection({ onFitToViewport }: { onFitToViewport: () => void }): ReactNode {
  return (
    <>
      <NestedLabel>Viewport</NestedLabel>
      <NestedItem
        onClick={onFitToViewport}
        left={<Icon name="fit-horizontal" />}
      >
        Fit to Viewport
      </NestedItem>
    </>
  );
}
