import type { AnimationData } from "../../store-types";
import type { DragStampTransform, DragUpdateInput } from "../../types";
import { computeLocalStamp } from "../../functions/compute-instance-time";

const toInstanceStamp = (globalStamp: number, transform: DragStampTransform): number => {
  const timescale = transform.timescale === 0 ? 1 : transform.timescale;
  return computeLocalStamp(globalStamp, timescale, transform.offset);
};

export function updateDrag(state: AnimationData, input: DragUpdateInput): void {
  const current = state.dragState;
  if (!current) {
    return;
  }

  const modifiers = { ...input.modifiers };

  let stampDelta = current.stampDelta;

  if (
    (current.axis === "horizontal" || current.axis === "both") &&
    input.normalizedStamp &&
    typeof current.stampOrigin === "number"
  ) {
    const baseStamp = current.stampOrigin;
    const rawLocal = toInstanceStamp(input.normalizedStamp.current, current.instanceTransform);
    const rawDelta = Number.isFinite(rawLocal - baseStamp) ? rawLocal - baseStamp : 0;

    let snappedDelta: number | undefined;
    if (typeof input.normalizedStamp.snapped === "number" && !input.modifiers.alt) {
      const snappedLocal = toInstanceStamp(
        input.normalizedStamp.snapped,
        current.instanceTransform,
      );
      snappedDelta = Number.isFinite(snappedLocal - baseStamp)
        ? snappedLocal - baseStamp
        : rawDelta;
    }

    const nextStampDelta = {
      raw: rawDelta,
      snapped: snappedDelta,
    };

    if (
      !stampDelta ||
      !Object.is(stampDelta.raw, nextStampDelta.raw) ||
      !Object.is(stampDelta.snapped, nextStampDelta.snapped)
    ) {
      stampDelta = nextStampDelta;
    }
  }

  let normalizedValueDelta = current.normalizedValueDelta;
  if (typeof input.normalizedValueDelta === "number") {
    normalizedValueDelta = input.normalizedValueDelta;
  }

  state.dragState = {
    ...current,
    modifiers,
    stampDelta,
    normalizedValueDelta,
  };
}
