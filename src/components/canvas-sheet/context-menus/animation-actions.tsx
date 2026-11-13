import { ReactNode } from "react";
import { Icon, NestedItem, NestedLabel, type CanvasContextMenuContext } from "@semio/ui";

/** The player commands the "Animation" section of a canvas context menu issues. */
export interface PlayerMenuActions {
  /** Moves the playhead to a world stamp. */
  onMovePlayhead: (worldStamp: number) => void;
  /** Moves the player's start or end bound to a world stamp. */
  onMoveBound: (bound: "start" | "end", worldStamp: number) => void;
}

/**
 * Shared "Animation Actions" section for canvas context menus: Move Playhead,
 * Move Left Bounds and Move Right Bounds, each to the clicked time.
 *
 * It takes its commands as props and reads no context. Canvas context menu
 * content renders under the outermost `TooltipHost`, which an app may place
 * outside every animation provider, so a context hook here throws when the
 * menu opens.
 */
export function AnimationActionsSection({
  ctx,
  onMovePlayhead,
  onMoveBound,
}: { ctx: CanvasContextMenuContext } & PlayerMenuActions): ReactNode {
  const stamp = ctx.worldPosition[0];

  return (
    <>
      <NestedLabel>Animation</NestedLabel>
      <NestedItem onClick={() => onMovePlayhead(stamp)} left={<Icon name="move-playhead" />}>
        Move Playhead
      </NestedItem>
      <NestedItem
        onClick={() => onMoveBound("start", stamp)}
        left={<Icon name="move-player-start-bounds" />}
      >
        Move Left Bounds
      </NestedItem>
      <NestedItem
        onClick={() => onMoveBound("end", stamp)}
        left={<Icon name="move-player-end-bounds" />}
      >
        Move Right Bounds
      </NestedItem>
    </>
  );
}
