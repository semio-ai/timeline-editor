import { ReactNode } from "react";
import {
  Icon,
  NestedItem,
  NestedLabel,
  NestedSeparator,
  KeybindingHint,
  type CanvasContextMenuContext,
} from "@semio/ui";
import { AnimationAction } from "../../../keybindings";
import { AnimationActionsSection } from "./animation-actions";

/**
 * Context menu for right-clicking a specific keypoint.
 * Always enables cut/copy/delete since the clicked key is the implicit target.
 */
export function KeyContextMenu({
  ctx,
  hasClipboard,
  hasSelection,
  onSelectAll,
  onSelectAllInTrack,
  selectAllInTrackLabel = "Select All in Track",
  onDeselectAll,
  onCut,
  onCopy,
  onPaste,
  onDelete,
  onFlattenHandles,
}: {
  ctx: CanvasContextMenuContext;
  hasClipboard: boolean;
  /** Whether the user currently has a selection (drives Transitions-section
   * enablement; the right-clicked key is the implicit target for edit ops
   * regardless). */
  hasSelection: boolean;
  onSelectAll: () => void;
  onSelectAllInTrack: () => void;
  /** Label for the Select-All-in-Track entry. Pluralizes ("Tracks") when
   * the resolved scope spans multiple tracks. */
  selectAllInTrackLabel?: string;
  onDeselectAll: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: (worldStamp: number) => void;
  onDelete: () => void;
  onFlattenHandles: () => void;
}): ReactNode {
  return (
    <>
      <NestedLabel>Edit</NestedLabel>
      <NestedItem
        onClick={onCut}
        left={<Icon name="cut" />}
        right={<KeybindingHint action={AnimationAction.Cut} />}
      >
        Cut
      </NestedItem>
      <NestedItem
        onClick={onCopy}
        left={<Icon name="copy" />}
        right={<KeybindingHint action={AnimationAction.Copy} />}
      >
        Copy
      </NestedItem>
      <NestedItem
        disabled={!hasClipboard}
        onClick={() => onPaste(ctx.worldPosition[0])}
        left={<Icon name="paste" />}
        right={<KeybindingHint action={AnimationAction.Paste} />}
      >
        Paste
      </NestedItem>
      <NestedItem
        onClick={onDelete}
        left={<Icon name="delete" />}
        right={<KeybindingHint action={AnimationAction.Delete} />}
      >
        Delete
      </NestedItem>
      <NestedSeparator />
      <NestedLabel>Transitions</NestedLabel>
      <NestedItem
        disabled={!hasSelection}
        onClick={onFlattenHandles}
        left={<Icon name="align-keys" />}
      >
        Flatten Handles
      </NestedItem>
      <NestedSeparator />
      <NestedLabel>Selection</NestedLabel>
      <NestedItem
        onClick={onSelectAll}
        left={<Icon name="select-all" />}
        right={<KeybindingHint action={AnimationAction.SelectAll} />}
      >
        Select All
      </NestedItem>
      <NestedItem
        onClick={onSelectAllInTrack}
        left={<Icon name="select-all" />}
        right={<KeybindingHint action={AnimationAction.SelectAllInTrack} />}
      >
        {selectAllInTrackLabel}
      </NestedItem>
      <NestedItem
        onClick={onDeselectAll}
        left={<Icon name="deselect-all" />}
        right={<KeybindingHint action={AnimationAction.DeselectAll} />}
      >
        Deselect All
      </NestedItem>
      <NestedSeparator />
      <AnimationActionsSection ctx={ctx} />
    </>
  );
}
