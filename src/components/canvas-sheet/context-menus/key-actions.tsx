import { ReactNode } from "react";
import {
  ICON_CLASS_NAME,
  NestedItem,
  NestedLabel,
  NestedSeparator,
  KeybindingHint,
  SelectCursor,
  SelectClose,
  type CanvasContextMenuContext,
} from "@semio/ui";
import { TrashBinTrash, Copy, Clipboard } from "@solar-icons/react-perf/LineDuotone";
import { Scissors } from "@solar-icons/react-perf/Linear";
import { AnimationAction } from "../../../keybindings";
import { AnimationActionsSection } from "./animation-actions";

/**
 * Context menu for right-clicking a specific keypoint.
 * Always enables cut/copy/delete since the clicked key is the implicit target.
 */
export function KeyContextMenu({
  ctx,
  hasClipboard,
  onSelectAll,
  onSelectAllInTrack,
  onDeselectAll,
  onCut,
  onCopy,
  onPaste,
  onDelete,
}: {
  ctx: CanvasContextMenuContext;
  hasClipboard: boolean;
  onSelectAll: () => void;
  onSelectAllInTrack: () => void;
  onDeselectAll: () => void;
  onCut: () => void;
  onCopy: () => void;
  onPaste: (worldStamp: number) => void;
  onDelete: () => void;
}): ReactNode {
  return (
    <>
      <NestedLabel>Edit</NestedLabel>
      <NestedItem
        onClick={onCut}
        left={<Scissors size="18px" className={ICON_CLASS_NAME} />}
        right={<KeybindingHint action={AnimationAction.Cut} />}
      >
        Cut
      </NestedItem>
      <NestedItem
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
        onClick={onDelete}
        left={<TrashBinTrash size="18px" className={ICON_CLASS_NAME} />}
        right={<KeybindingHint action={AnimationAction.Delete} />}
      >
        Delete
      </NestedItem>
      <NestedSeparator />
      <NestedLabel>Selection</NestedLabel>
      <NestedItem
        onClick={onSelectAll}
        left={<SelectCursor size="18px" className={ICON_CLASS_NAME} />}
        right={<KeybindingHint action={AnimationAction.SelectAll} />}
      >
        Select All
      </NestedItem>
      <NestedItem
        onClick={onSelectAllInTrack}
        left={<SelectCursor size="18px" className={ICON_CLASS_NAME} />}
        right={<KeybindingHint action={AnimationAction.SelectAllInTrack} />}
      >
        Select All in Track
      </NestedItem>
      <NestedItem
        onClick={onDeselectAll}
        left={<SelectClose size="18px" className={ICON_CLASS_NAME} />}
        right={<KeybindingHint action={AnimationAction.DeselectAll} />}
      >
        Deselect All
      </NestedItem>
      <NestedSeparator />
      <AnimationActionsSection ctx={ctx} />
    </>
  );
}
