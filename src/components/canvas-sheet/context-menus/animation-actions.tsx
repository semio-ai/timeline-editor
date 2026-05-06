import { ReactNode } from "react";
import {
  ICON_CLASS_NAME,
  MovePlayerEndBounds,
  MovePlayhead,
  NestedItem,
  NestedLabel,
  type CanvasContextMenuContext,
} from "@semio/ui";
import { usePlayerStore } from "@semio/utils";

/**
 * Shared "Animation Actions" section for canvas context menus.
 * Provides Move Playhead, Move Left Bounds, Move Right Bounds.
 */
export function AnimationActionsSection({ ctx }: { ctx: CanvasContextMenuContext }): ReactNode {
  const resetPlayer = usePlayerStore((s) => s.resetPlayer);
  const updatePlayerBound = usePlayerStore((s) => s.updatePlayerBound);

  const stamp = ctx.worldPosition[0];

  return (
    <>
      <NestedLabel>Animation</NestedLabel>
      <NestedItem
        onClick={() => resetPlayer(stamp)}
        left={<MovePlayhead size="18px" className={ICON_CLASS_NAME} />}
      >
        Move Playhead
      </NestedItem>
      <NestedItem
        onClick={() => updatePlayerBound("start", stamp)}
        left={<MovePlayerEndBounds size="18px" className={`${ICON_CLASS_NAME} -scale-100`} />}
      >
        Move Left Bounds
      </NestedItem>
      <NestedItem
        onClick={() => updatePlayerBound("end", stamp)}
        left={<MovePlayerEndBounds size="18px" className={ICON_CLASS_NAME} />}
      >
        Move Right Bounds
      </NestedItem>
    </>
  );
}
