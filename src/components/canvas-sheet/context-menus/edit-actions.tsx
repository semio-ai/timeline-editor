import { ReactNode } from "react";
import {
  ICON_CLASS_NAME,
  NestedItem,
  NestedLabel,
  KeybindingHint,
  type CanvasContextMenuContext,
} from "@semio/ui";
import { TrashBinTrash, Copy, Clipboard } from "@solar-icons/react-perf/LineDuotone";
import { Scissors } from "@solar-icons/react-perf/Linear";
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
        left={<Scissors size="18px" className={ICON_CLASS_NAME} />}
        right={<KeybindingHint action={AnimationAction.Cut} />}
      >
        Cut
      </NestedItem>
      <NestedItem
        disabled={!hasSelection}
        onClick={onCopy}
        left={<Copy size="18px" className={ICON_CLASS_NAME} />}
        right={<KeybindingHint action={AnimationAction.Copy} />}
      >
        Copy
      </NestedItem>
      <NestedItem
        disabled={!hasClipboard}
        onClick={() => onPaste(ctx.worldPosition[0])}
        left={<Clipboard size="18px" className={ICON_CLASS_NAME} />}
        right={<KeybindingHint action={AnimationAction.Paste} />}
      >
        Paste
      </NestedItem>
      <NestedItem
        disabled={!hasSelection}
        onClick={onDelete}
        left={<TrashBinTrash size="18px" className={ICON_CLASS_NAME} />}
        right={<KeybindingHint action={AnimationAction.Delete} />}
      >
        Delete
      </NestedItem>
    </>
  );
}
