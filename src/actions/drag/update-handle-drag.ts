import type { AnimationData } from "../../store-types";
import type { HandleDragUpdateInput } from "../../types";
import {
  clampHandleAgainstOwnKeypointX,
  solveTransitionFromWorldCP,
} from "../../functions/solve-handle-transition";

const computeVerticalRange = (valueScale?: { domain: [number, number] }): number => {
  if (!valueScale) return 1;
  const range = valueScale.domain[1] - valueScale.domain[0];
  return Number.isFinite(range) && range !== 0 ? range : 1;
};

const applyPrecision = (value: number, precision?: number): number => {
  if (precision === undefined) return value;
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

export function updateHandleDrag(state: AnimationData, input: HandleDragUpdateInput): void {
  const current = state.dragState;
  if (!current?.handleAnchor) return;

  const anchor = current.handleAnchor;
  const range = computeVerticalRange(anchor.valueScale);
  const deltaY = (input.normalizedValueDelta ?? 0) * range;

  const nextCp = {
    x: input.pointer.x,
    y: anchor.controlPoint.y + deltaY,
  };

  const clamped = clampHandleAgainstOwnKeypointX({
    anchor: anchor.side === "out" ? "startOut" : "endIn",
    cpWorld: nextCp,
    startX: anchor.startStamp,
    endX: anchor.endStamp,
  });

  const domain = anchor.valueScale?.domain;
  let nextY = clamped.y;
  if (domain) {
    nextY = Math.min(domain[1], Math.max(domain[0], nextY));
  }
  nextY = applyPrecision(nextY, anchor.valueScale?.precision);

  const transition = solveTransitionFromWorldCP({
    anchor: anchor.side === "out" ? "startOut" : "endIn",
    cpWorld: { ...clamped, y: nextY },
    start: { stamp: anchor.startStamp, value: anchor.startValue },
    end: { stamp: anchor.endStamp, value: anchor.endValue },
  });

  const nextDiffs = { ...(current.handleDiffs ?? {}) };
  const existing = nextDiffs[anchor.keypointId] ?? {};
  nextDiffs[anchor.keypointId] =
    anchor.side === "out" ? { ...existing, out: transition } : { ...existing, in: transition };

  state.dragState = {
    ...current,
    handleDiffs: nextDiffs,
    modifiers: input.modifiers,
  };
}
