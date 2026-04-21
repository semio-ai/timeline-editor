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
 * Since context menu content renders in a Radix portal outside the animation
 * context tree, store state must be passed as props rather than read via hooks.
 */
export function EditActionsSection({
  ctx: _ctx,
  hasSelection,
  onDelete,
}: {
  ctx: CanvasContextMenuContext;
  hasSelection: boolean;
  onDelete: () => void;
}): ReactNode {
  return (
    <>
      <NestedLabel>Edit</NestedLabel>
      <NestedItem
        disabled
        left={<Scissors size="18px" className={ICON_CLASS_NAME} />}
        right={<KeybindingHint action={AnimationAction.Cut} />}
      >
        Cut
      </NestedItem>
      <NestedItem
        disabled
        left={<Copy size="18px" className={ICON_CLASS_NAME} />}
        right={<KeybindingHint action={AnimationAction.Copy} />}
      >
        Copy
      </NestedItem>
      <NestedItem
        disabled
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
