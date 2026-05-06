import { ReactNode } from "react";
import { ICON_CLASS_NAME, NestedItem, NestedLabel } from "@semio/ui";
import { IconArrowsHorizontal } from "@tabler/icons-react";

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
        left={<IconArrowsHorizontal className={ICON_CLASS_NAME} />}
      >
        Fit to Viewport
      </NestedItem>
    </>
  );
}
