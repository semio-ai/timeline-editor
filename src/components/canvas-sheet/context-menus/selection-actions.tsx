import { ReactNode } from "react";
import { ICON_CLASS_NAME, NestedItem, NestedLabel, KeybindingHint, SelectClose, SelectCursor } from "@semio/ui";
import { AnimationAction } from "../../../keybindings";

/**
 * Shared "Selection Actions" section for canvas context menus.
 */
export function SelectionActionsSection({
  hasSelection,
  hasTrackContext,
  onSelectAll,
  onSelectAllInTrack,
  onDeselectAll,
}: {
  hasSelection: boolean;
  /** Whether a specific track context is available for "Select All in Track". */
  hasTrackContext: boolean;
  onSelectAll: () => void;
  onSelectAllInTrack?: () => void;
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
      {hasTrackContext && onSelectAllInTrack && (
        <NestedItem
          onClick={onSelectAllInTrack}
          left={<SelectCursor size="18px" className={ICON_CLASS_NAME} />}
          right={<KeybindingHint action={AnimationAction.SelectAllInTrack} />}
        >
          Select All in Track
        </NestedItem>
      )}
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
