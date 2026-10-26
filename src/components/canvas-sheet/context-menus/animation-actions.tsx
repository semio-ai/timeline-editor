import { ReactNode } from "react";
import {
  Icon,
  NestedItem,
  NestedLabel,
  type CanvasContextMenuContext,
} from "@semio/ui";
import { usePlayer } from "../../../hooks/use-player";

/**
 * Shared "Animation Actions" section for canvas context menus.
 * Provides Move Playhead, Move Left Bounds, Move Right Bounds.
 */
export function AnimationActionsSection({ ctx }: { ctx: CanvasContextMenuContext }): ReactNode {
  const resetPlayer = usePlayer((s) => s.resetPlayer);
  const updatePlayerBound = usePlayer((s) => s.updatePlayerBound);

  const stamp = ctx.worldPosition[0];

  return (
    <>
      <NestedLabel>Animation</NestedLabel>
      <NestedItem
        onClick={() => resetPlayer(stamp)}
        left={<Icon name="move-playhead" />}
      >
        Move Playhead
      </NestedItem>
      <NestedItem
        onClick={() => updatePlayerBound("start", stamp)}
        left={<Icon name="move-player-start-bounds" />}
      >
        Move Left Bounds
      </NestedItem>
      <NestedItem
        onClick={() => updatePlayerBound("end", stamp)}
        left={<Icon name="move-player-end-bounds" />}
      >
        Move Right Bounds
      </NestedItem>
    </>
  );
}
