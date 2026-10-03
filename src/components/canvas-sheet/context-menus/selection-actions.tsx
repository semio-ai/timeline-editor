import { ReactNode } from "react";
import { Icon, NestedItem, NestedLabel, KeybindingHint } from "@semio/ui";
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
        left={<Icon name="select-all" />}
        right={<KeybindingHint action={AnimationAction.SelectAll} />}
      >
        Select All
      </NestedItem>
      {hasTrackContext && onSelectAllInTrack && (
        <NestedItem
          onClick={onSelectAllInTrack}
          left={<Icon name="select-all" />}
          right={<KeybindingHint action={AnimationAction.SelectAllInTrack} />}
        >
          Select All in Track
        </NestedItem>
      )}
      <NestedItem
        disabled={!hasSelection}
        onClick={onDeselectAll}
        left={<Icon name="deselect-all" />}
        right={<KeybindingHint action={AnimationAction.DeselectAll} />}
      >
        Deselect All
      </NestedItem>
    </>
  );
}
