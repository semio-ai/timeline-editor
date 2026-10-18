import { beforeEach, afterEach, describe, expect, it } from "vitest";
import {
  createMinimalAnimationStore,
  TRACK_IDS,
} from "../../test-fixtures/animation-store-factory";
import type { AnimationStore } from "../../store";
import { flushMicrotasks } from "../utils/flush-microtasks";
import { clickMarkerWith } from "../selection/selection-test-helpers";
import { computeInstanceTrackViolations } from "../../functions/compute-track-violations";
import { testTrackEvaluator } from "../../test-fixtures/track-evaluator";
import { curveOf } from "../curves";
import { resolveAnimationDuration } from "../../functions/compute-animation-extent";
import { Violation, ViolationType } from "../../types";

function summarizeViolations(
  violations: Violation[],
): { type: ViolationType; start: number; end: number }[] {
  return violations
    .map((violation) => ({
      type: violation.type,
      start: Number(violation.stampRange.start.toFixed(4)),
      end: Number(violation.stampRange.end.toFixed(4)),
    }))
    .sort((a, b) => {
      if (a.start !== b.start) return a.start - b.start;
      if (a.end !== b.end) return a.end - b.end;
      return a.type.localeCompare(b.type);
    });
}

describe("drag previews recompute violation overlays", () => {
  let store: AnimationStore;
  let cleanup: (() => void) | undefined;

  beforeEach(async () => {
    store = createMinimalAnimationStore({ trackEvaluator: testTrackEvaluator });

    store.setState((state) => ({
      tracks: {
        ...state.tracks,
        [TRACK_IDS.SCALE]: {
          ...state.tracks[TRACK_IDS.SCALE],
          points: [
            { id: "s-preview-0", stamp: 0, value: 0.1 },
            { id: "s-preview-1", stamp: 0.5, value: 0.1 },
            { id: "s-preview-2", stamp: 1, value: 0.5 },
          ],
        },
      },
    }));

    cleanup = store.getState().initAnimationSubscriptions();
    await flushMicrotasks();
  });

  afterEach(() => {
    store.getState().cancelDrag();
    cleanup?.();
  });

  it("updates row violation overlays based on drag deltas", async () => {
    const state = store.getState();
    const rowEntry = Object.entries(state.instancedTrackSources).find(([, row]) =>
      row.data.some((entry) => entry.trackId === TRACK_IDS.SCALE),
    );
    expect(rowEntry).toBeDefined();

    const [rowId, sourceRow] = rowEntry!;
    let row = store.getState().derivedSnapshot?.rows?.[rowId]?.computed;
    expect(row).toBeDefined();

    const markerFrame = row?.selection?.find((frame) =>
      frame.points.some((point) => point.markerId === "s-preview-2"),
    );
    expect(markerFrame).toBeDefined();
    const markerId = markerFrame!.id;

    clickMarkerWith(store, rowId, markerId);

    store.getState().startDrag({
      axis: "horizontal",
      markerId,
      rowId,
    });

    store.getState().updateDrag({
      normalizedStamp: { current: 0.55 },
      modifiers: { alt: false, shift: false, meta: false },
    });

    await flushMicrotasks();

    row = store.getState().derivedSnapshot?.rows?.[rowId]?.computed;
    const previewViolations = Object.values(row?.violationSet.violations ?? {}).filter(
      (violation) => violation.trackId === TRACK_IDS.SCALE,
    );
    expect(previewViolations.length).toBeGreaterThan(0);
    expect(previewViolations.some((violation) => violation.type === ViolationType.Velocity)).toBe(
      true,
    );

    const track = store.getState().tracks[TRACK_IDS.SCALE];
    const dragState = store.getState().dragState;
    expect(dragState?.stampDelta).toBeDefined();
    if (!dragState?.stampDelta) {
      throw new Error("Expected stamp delta during preview drag.");
    }
    expect(dragState.stampDelta.raw).toBeCloseTo(-0.45, 5);

    const selectedIds = store.getState().selectionState.keypoints.get(TRACK_IDS.SCALE) ?? new Set();
    const stampDelta = dragState.stampDelta.snapped ?? dragState.stampDelta.raw;
    const previewPoints = track.points.map((point) =>
      selectedIds.has(point.id)
        ? {
            ...point,
            stamp: Math.max(0, Math.min(1, point.stamp + stampDelta)),
          }
        : point,
    );

    const namespaceId = sourceRow.data[0]?.namespaceId ?? "default";
    const instanceId = sourceRow.data[0]?.instanceId ?? "main";
    const animationId = sourceRow.data[0]?.animationId ?? "minimal";

    const instance = store.getState().namespaces[namespaceId].animationInstances[instanceId];
    const animation = store.getState().animations[animationId];
    const animatable = store.getState().animatables[track.animatableId];

    const previewTrack = {
      ...track,
      points: [...previewPoints].sort((a, b) => a.stamp - b.stamp),
    };

    const expectedViolations = computeInstanceTrackViolations(
      curveOf(previewTrack, animation, store.getState().tracks),
      resolveAnimationDuration(animation, store.getState().tracks),
      instance.settings.timescale,
      TRACK_IDS.SCALE,
      namespaceId,
      instanceId,
      animatable,
    );

    expect(summarizeViolations(previewViolations)).toEqual(summarizeViolations(expectedViolations));
  });
});
