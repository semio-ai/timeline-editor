import type { AnimationData } from "../../store-types";
import type { DragStampTransform, DragUpdateInput } from "../../types";

const toInstanceStamp = (globalStamp: number, transform: DragStampTransform): number => {
  const timescale = transform.timescale === 0 ? 1 : transform.timescale;
  return (globalStamp - transform.offset) / timescale;
};

export function updateDrag(state: AnimationData, input: DragUpdateInput): void {
  const dragState = state.dragState;
  if (!dragState) {
    return;
  }

  dragState.modifiers = input.modifiers;

  if (
    (dragState.axis === "horizontal" || dragState.axis === "both") &&
    input.normalizedStamp &&
    typeof dragState.stampOrigin === "number"
  ) {
    const baseStamp = dragState.stampOrigin;
    const rawLocal = toInstanceStamp(input.normalizedStamp.current, dragState.instanceTransform);
    const rawDelta = Number.isFinite(rawLocal - baseStamp) ? rawLocal - baseStamp : 0;

    let snappedDelta: number | undefined;
    if (typeof input.normalizedStamp.snapped === "number" && !input.modifiers.alt) {
      const snappedLocal = toInstanceStamp(
        input.normalizedStamp.snapped,
        dragState.instanceTransform,
      );
      snappedDelta = Number.isFinite(snappedLocal - baseStamp)
        ? snappedLocal - baseStamp
        : rawDelta;
    }

    dragState.stampDelta = {
      raw: rawDelta,
      snapped: snappedDelta,
    };
  }

  if (typeof input.normalizedValueDelta === "number") {
    dragState.normalizedValueDelta = input.normalizedValueDelta;
  }
}
