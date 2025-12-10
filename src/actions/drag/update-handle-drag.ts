import type { AnimationData } from "../../store-types";
import type { HandleDragUpdateInput } from "../../types";
import { TransitionPairing } from "../../types";
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
  if (!current?.handleAnchor) {
    return;
  }

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

  const anchorStamp = anchor.side === "out" ? anchor.startStamp : anchor.endStamp;
  const anchorValue = anchor.side === "out" ? anchor.startValue : anchor.endValue;

  const nextY = applyPrecision(clamped.y, anchor.valueScale?.precision);

  const transition = solveTransitionFromWorldCP({
    anchor: anchor.side === "out" ? "startOut" : "endIn",
    cpWorld: { ...clamped, y: nextY },
    start: { stamp: anchor.startStamp, value: anchor.startValue },
    end: { stamp: anchor.endStamp, value: anchor.endValue },
  });

  const nextDiffs = { ...(current.handleDiffs ?? {}) };
  const existing = nextDiffs[anchor.keypointId] ?? {};

  const draggedDelta = {
    x: clamped.x - anchorStamp,
    y: nextY - anchorValue,
  };

  // Always write dragged side
  const updated: typeof existing = {
    ...existing,
    ...(anchor.side === "out" ? { out: transition } : { in: transition }),
  };

  const basePairing = anchor.basePairing;
  const effectivePairing =
    input.modifiers.alt && basePairing === TransitionPairing.Paired
      ? TransitionPairing.Free
      : basePairing;

  if (effectivePairing === TransitionPairing.Paired) {
    const pairedSide = anchor.side === "out" ? "in" : "out";
    const pairedAnchorStamp = anchor.side === "out" ? anchor.endStamp : anchor.startStamp;
    const pairedAnchorValue = anchor.side === "out" ? anchor.endValue : anchor.startValue;
    const pairedCpWorld = {
      x: pairedAnchorStamp - draggedDelta.x,
      y: pairedAnchorValue - draggedDelta.y,
    };
    const pairedClamped = clampHandleAgainstOwnKeypointX({
      anchor: pairedSide === "out" ? "startOut" : "endIn",
      cpWorld: pairedCpWorld,
      startX: anchor.startStamp,
      endX: anchor.endStamp,
    });
    const pairedTransition = solveTransitionFromWorldCP({
      anchor: pairedSide === "out" ? "startOut" : "endIn",
      cpWorld: pairedClamped,
      start: { stamp: anchor.startStamp, value: anchor.startValue },
      end: { stamp: anchor.endStamp, value: anchor.endValue },
    });
    if (pairedSide === "out") {
      updated.out = pairedTransition;
    } else {
      updated.in = pairedTransition;
    }
    updated.pairing = TransitionPairing.Paired;
  } else if (effectivePairing === TransitionPairing.Free) {
    updated.pairing = TransitionPairing.Free;
  }

  nextDiffs[anchor.keypointId] = updated;

  state.dragState = {
    ...current,
    handleDiffs: nextDiffs,
    modifiers: input.modifiers,
  };
}
