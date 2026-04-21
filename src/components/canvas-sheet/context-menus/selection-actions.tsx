import { ReactNode } from "react";
import { ICON_CLASS_NAME, NestedItem, NestedLabel, KeybindingHint, SelectClose, SelectCursor } from "@semio/ui";
import { AnimationAction } from "../../../keybindings";

/**
 * Shared "Selection Actions" section for canvas context menus.
 * Provides Select All and Deselect All.
 *
 * Store state is passed as props since context menu content renders
 * in a Radix portal outside the animation context tree.
 */
export function SelectionActionsSection({
  hasSelection,
  onSelectAll,
  onDeselectAll,
}: {
  hasSelection: boolean;
  onSelectAll: () => void;
  onDeselectAll: () => void;
}): ReactNode {
  return (
    <>
      <NestedLabel>Selection</NestedLabel>
      <NestedItem
        onClick={onSelectAll}
        left={<SelectCursor size="18px" className={ICON_CLASS_NAME} />}
        right={<KeybindingHint action={AnimationAction.SelectAll} />}
      >
        Select All
      </NestedItem>
      <NestedItem
        disabled={!hasSelection}
        onClick={onDeselectAll}
        left={<SelectClose size="18px" className={ICON_CLASS_NAME} />}
        right={<KeybindingHint action={AnimationAction.DeselectAll} />}
      >
        Deselect All
      </NestedItem>
    </>
  );
}
