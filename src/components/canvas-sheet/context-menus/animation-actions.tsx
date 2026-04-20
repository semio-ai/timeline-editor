import { ReactNode } from "react";
import {
  ICON_CLASS_NAME,
  MovePlayerEndBounds,
  NestedItem,
  NestedLabel,
  type CanvasContextMenuContext,
} from "@semio/ui";
import { TrashBinTrash } from "@solar-icons/react-perf/category/ui/LineDuotone";

/**
 * Shared "Animation Actions" section for canvas context menus.
 * Provides Move Playhead, Move Left Bounds, Move Right Bounds.
 */
export function AnimationActionsSection({ ctx }: { ctx: CanvasContextMenuContext }): ReactNode {
  return (
    <>
      <NestedLabel>Animation</NestedLabel>
      <NestedItem
        onClick={() => console.log("Move Playhead to", ctx.worldPosition[0])}
        left={<TrashBinTrash size="18px" className={ICON_CLASS_NAME} />}
      >
        Move Playhead
      </NestedItem>
      <NestedItem
        onClick={() => console.log("Move Left Bounds to", ctx.worldPosition[0])}
        left={<MovePlayerEndBounds size="18px" className={`${ICON_CLASS_NAME} -scale-100`} />}
      >
        Move Left Bounds
      </NestedItem>
      <NestedItem
        onClick={() => console.log("Move Right Bounds to", ctx.worldPosition[0])}
        left={<MovePlayerEndBounds size="18px" className={ICON_CLASS_NAME} />}
      >
        Move Right Bounds
      </NestedItem>
    </>
  );
}
