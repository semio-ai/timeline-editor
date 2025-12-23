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

  if (input.handleDeltas) {
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
    if (
      input.handleDeltas.withinSnapTolerance &&
      !input.modifiers.alt &&
      (pairingIntent === TransitionPairing.Free || pairingIntent === undefined)
    ) {
      pairingIntent = TransitionPairing.Paired;
    }
    if (
      input.modifiers.alt &&
      pairingIntent === TransitionPairing.Paired &&
      !input.modifiers.shift
    ) {
      pairingIntent = TransitionPairing.Free;
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
    }

    if (pairingIntent !== undefined) {
      updated.pairing = pairingIntent;
    }

    nextDiffs[anchor.keypointId] = updated;

    state.dragState = {
      ...current,
      handleDiffs: nextDiffs,
      modifiers: input.modifiers,
    };
    return;
  }

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
    start: { stamp: anchorStamp, value: anchorValue },
    end: { stamp: anchorStamp, value: anchorValue },
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

  const hasPairedSide = anchor.side === "out" ? anchor.hasIn !== false : anchor.hasOut !== false;

  if (effectivePairing === TransitionPairing.Paired && hasPairedSide) {
    const pairedSide = anchor.side === "out" ? "in" : "out";
    const pairedAnchorStamp = anchorStamp;
    const pairedAnchorValue = anchorValue;
    const pairedCpWorld = {
      x: pairedAnchorStamp - draggedDelta.x,
      y: pairedAnchorValue - draggedDelta.y,
    };
    const pairedClamped = clampHandleAgainstOwnKeypointX({
      anchor: pairedSide === "out" ? "startOut" : "endIn",
      cpWorld: pairedCpWorld,
      startX: pairedAnchorStamp,
      endX: pairedAnchorStamp,
    });
    const pairedTransition = solveTransitionFromWorldCP({
      anchor: pairedSide === "out" ? "startOut" : "endIn",
      cpWorld: pairedClamped,
      start: { stamp: pairedAnchorStamp, value: pairedAnchorValue },
      end: { stamp: pairedAnchorStamp, value: pairedAnchorValue },
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
