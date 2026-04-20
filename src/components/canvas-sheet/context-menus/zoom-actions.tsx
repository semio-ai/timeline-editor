import { ReactNode } from "react";
import { ICON_CLASS_NAME, NestedItem, NestedLabel } from "@semio/ui";
import { IconArrowsHorizontal } from "@tabler/icons-react";

/**
 * "Zoom Actions" section for minimap context menu.
 */
export function ZoomActionsSection(): ReactNode {
  return (
    <>
      <NestedLabel>Viewport</NestedLabel>
      <NestedItem
        onClick={() => console.log("Fit to Viewport")}
        left={<IconArrowsHorizontal className={ICON_CLASS_NAME} />}
      >
        Fit to Viewport
      </NestedItem>
    </>
  );
}
