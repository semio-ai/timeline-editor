import { ReactNode } from "react";
import {
  ICON_CLASS_NAME,
  NestedItem,
  NestedLabel,
  type CanvasContextMenuContext,
  Keybinding,
  KeyCode,
} from "@semio/ui";
import { TrashBinTrash, Copy, Clipboard } from "@solar-icons/react-perf/LineDuotone";
import { Scissors } from "@solar-icons/react-perf/Linear";

/**
 * Shared "Edit Actions" section for canvas context menus.
 * Provides Cut, Copy, Paste, Delete.
 */
export function EditActionsSection({ ctx }: { ctx: CanvasContextMenuContext }): ReactNode {
  return (
    <>
      <NestedLabel>Edit</NestedLabel>
      <NestedItem
        disabled
        left={<Scissors size="18px" className={ICON_CLASS_NAME} />}
        right={<Keybinding keys={[KeyCode.Mod, "X"]} />}
      >
        Cut
      </NestedItem>
      <NestedItem
        disabled
        left={<Copy size="18px" className={ICON_CLASS_NAME} />}
        right={<Keybinding keys={[KeyCode.Mod, "C"]} />}
      >
        Copy
      </NestedItem>
      <NestedItem
        onClick={() => console.log("Paste at", ctx.worldPosition[0])}
        left={<Clipboard size="18px" className={ICON_CLASS_NAME} />}
        right={<Keybinding keys={[KeyCode.Mod, "V"]} />}
      >
        Paste
      </NestedItem>
      <NestedItem
        onClick={() => console.log("Delete")}
        left={<TrashBinTrash size="18px" className={ICON_CLASS_NAME} />}
        right={<Keybinding keys={[KeyCode.Delete]} />}
      >
        Delete
      </NestedItem>
    </>
  );
}
