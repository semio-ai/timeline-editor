import type { AnimationData } from "../../store-types";
import type { HandleDragUpdateInput } from "../../types";
import { TransitionPairing } from "../../types";
import {
  clampHandleAgainstOwnKeypointX,
  solveTransitionFromWorldCP,
} from "../../functions/solve-handle-transition";

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

  const nextDiffs = { ...(current.handleDiffs ?? {}) };
  const existing = nextDiffs[anchor.keypointId] ?? {};
  const updated: typeof existing = { ...existing };

  const anchorStamp = anchor.side === "out" ? anchor.startStamp : anchor.endStamp;
  const anchorValue = anchor.side === "out" ? anchor.startValue : anchor.endValue;
  const anchorPoint = { stamp: anchorStamp, value: anchorValue };

  const applyDelta = (side: "in" | "out", delta: { x: number; y: number }) => {
    const cpWorld = { x: anchorStamp + delta.x, y: anchorValue + delta.y };
    const clamped = clampHandleAgainstOwnKeypointX({
      anchor: side === "out" ? "startOut" : "endIn",
      cpWorld,
      startX: anchorStamp,
      endX: anchorStamp,
    });
    const nextY = applyPrecision(clamped.y, anchor.valueScale?.precision);
    const transition = solveTransitionFromWorldCP({
      anchor: side === "out" ? "startOut" : "endIn",
      cpWorld: { ...clamped, y: nextY },
      start: anchorPoint,
      end: anchorPoint,
    });
    if (side === "out") {
      updated.out = transition;
    } else {
      updated.in = transition;
    }
  };

  const basePairing = anchor.basePairing;
  let pairingIntent = input.handleDeltas.pairing ?? basePairing;
  const altBreak = input.modifiers.alt && !input.modifiers.shift;
  if (altBreak) {
    pairingIntent = TransitionPairing.Free;
  } else if (
    input.handleDeltas.withinSnapTolerance &&
    (pairingIntent === TransitionPairing.Free || pairingIntent === undefined)
  ) {
    pairingIntent = TransitionPairing.Paired;
  }

  const draggedSide = anchor.side;
  const pairedSide: "in" | "out" = draggedSide === "out" ? "in" : "out";
  const hasPairedSide = pairedSide === "in" ? anchor.hasIn !== false : anchor.hasOut !== false;

  const draggedDelta = input.handleDeltas[draggedSide];
  if (draggedDelta) {
    applyDelta(draggedSide, draggedDelta);
  }

  if (pairingIntent === TransitionPairing.Paired && hasPairedSide) {
    const pairedDelta = input.handleDeltas[pairedSide];
    if (pairedDelta) {
      applyDelta(pairedSide, pairedDelta);
    }
    updated.pairing = TransitionPairing.Paired;
  } else {
    if (pairedSide === "in") {
      delete updated.in;
    } else {
      delete updated.out;
    }
    if (pairingIntent === TransitionPairing.Free) {
      updated.pairing = TransitionPairing.Free;
    } else {
      delete updated.pairing;
    }
  }

  nextDiffs[anchor.keypointId] = updated;

  state.dragState = {
    ...current,
    handleDiffs: nextDiffs,
    modifiers: input.modifiers,
  };
}
