import { RawVector2 } from "@semio/utils";
import { WorldCP } from "../types";

export type HandleAnchorSide = "startOut" | "endIn";

/**
 * Clamp a handle so it cannot cross its own anchor on the X axis.
 *
 * This is a *raw-input* guard for handle dragging only — it constrains the
 * handle the user is dragging, NOT the rendered effective tangent. The
 * monotonic/value "effective" clamp is applied separately and centrally by
 * {@link resolveSegmentControlPoints} (reached for drags via computeRowData's
 * preview), so this is not a competing or duplicate clamp.
 */
export function clampHandleAgainstOwnKeypointX(params: {
  anchor: HandleAnchorSide;
  cpWorld: WorldCP;
  startX: number;
  endX: number;
}): WorldCP {
  const { anchor, cpWorld, startX, endX } = params;
  if (anchor === "startOut") {
    return { ...cpWorld, x: Math.max(startX, cpWorld.x) };
  }
  return { ...cpWorld, x: Math.min(endX, cpWorld.x) };
}

/**
 * Derive an anchor-relative world delta (RawVector2) from a world-space control point.
 */
export function solveTransitionFromWorldCP(params: {
  anchor: HandleAnchorSide;
  cpWorld: WorldCP;
  start: { stamp: number; value: number };
  end: { stamp: number; value: number };
}): RawVector2 {
  const { anchor, cpWorld, start, end } = params;
  if (anchor === "startOut") {
    return { x: cpWorld.x - start.stamp, y: cpWorld.y - start.value };
  }
  return { x: cpWorld.x - end.stamp, y: cpWorld.y - end.value };
}
