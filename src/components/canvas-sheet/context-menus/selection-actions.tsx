import { ReactNode } from "react";
import { ICON_CLASS_NAME, NestedItem, NestedLabel, SelectClose, SelectCursor } from "@semio/ui";

/**
 * Shared "Selection Actions" section for canvas context menus.
 * Provides Select All and Deselect All.
 */
export function SelectionActionsSection(): ReactNode {
  return (
    <>
      <NestedLabel>Selection</NestedLabel>
      <NestedItem
        onClick={() => console.log("Select All")}
        left={<SelectCursor size="18px" className={ICON_CLASS_NAME} />}
      >
        Select All
      </NestedItem>
      <NestedItem
        onClick={() => console.log("Deselect All")}
        left={<SelectClose size="18px" className={ICON_CLASS_NAME} />}
      >
        Deselect All
      </NestedItem>
    </>
  );
}
