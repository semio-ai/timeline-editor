import { ReactNode } from "react";
import {
  Icon,
  NestedItem,
  NestedLabel,
  KeybindingHint,
  type CanvasContextMenuContext,
} from "@semio/ui";
import { AnimationAction } from "../../../keybindings";

/**
 * Shared "Edit Actions" section for canvas context menus.
 * Provides Cut, Copy, Paste, Delete.
 *
 * Store state and callbacks are passed as props since context menu content
 * renders in a Radix portal outside the animation context tree.
 */
export function EditActionsSection({
  ctx,
  hasSelection,
  hasClipboard,
  onCut,
  onCopy,
  onPaste,
  onDelete,
}: {
  ctx: CanvasContextMenuContext;
  hasSelection: boolean;
  hasClipboard: boolean;
  onCut: () => void;
  onCopy: () => void;
  onPaste: (worldStamp: number) => void;
  onDelete: () => void;
}): ReactNode {
  return (
    <>
      <NestedLabel>Edit</NestedLabel>
      <NestedItem
        disabled={!hasSelection}
        onClick={onCut}
        left={<Icon name="cut" />}
        right={<KeybindingHint action={AnimationAction.Cut} />}
      >
        Cut
      </NestedItem>
      <NestedItem
        disabled={!hasSelection}
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
        disabled={!hasSelection}
        onClick={onDelete}
        left={<Icon name="delete" />}
        right={<KeybindingHint action={AnimationAction.Delete} />}
      >
        Delete
      </NestedItem>
    </>
  );
}
