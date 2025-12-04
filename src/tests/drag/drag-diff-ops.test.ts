import { describe, expect, it } from "vitest";
import type { RawValue } from "@semio/utils";
import type { DragState, SelectionState, Track } from "../../types";
import { applyTrackDiffOpsToTrack, computeDragDiffOps } from "../../functions/drag-diff-ops";
import {
  applyTrackDiffsToPoints,
  computeTrackDiffsForDrag,
} from "../../functions/apply-drag-deltas";

const makeSelection = (trackId: string, keypointId: string): SelectionState => ({
  instanceId: "instance-1",
  keypoints: new Map([[trackId, new Set([keypointId])]]),
  reference: null,
});

const makeDragState = (anchorId: string, trackId: string, stampDelta: number): DragState => ({
  axis: "horizontal",
  instanceId: "instance-1",
  instanceTransform: { offset: 0, timescale: 1 },
  anchor: {
    keypointId: anchorId,
    trackId,
    rowId: "row-1",
    markerId: "marker-1",
  },
  pointerOrigin: { x: 0, y: 0 },
  stampOrigin: 0,
  stampDelta: { raw: stampDelta },
  modifiers: { alt: false, shift: false, meta: false },
});

const makeTrack = (points: { id: string; stamp: number; value: RawValue }[]): Track<RawValue> => ({
  id: "track-1",
  name: "Track",
  animatableId: "anim-1",
  points: points.map((p) => ({ ...p })),
});

describe("computeDragDiffOps", () => {
  it("emits update + reorder diffs for a simple horizontal move", () => {
    const track = makeTrack([
      { id: "a", stamp: 0.1, value: 0 },
      { id: "b", stamp: 0.4, value: 1 },
    ]);

    const selection = makeSelection(track.id, "b");
    const dragState = makeDragState("b", track.id, -0.35); // moves b to 0.05

    const result = computeDragDiffOps({
      trackId: track.id,
      trackPoints: track.points,
      dragState,
      selection,
    });

    const update = result.diffs.find(
      (diff): diff is Extract<typeof diff, { type: "updateKeypoint" }> =>
        diff.type === "updateKeypoint" && diff.keypointId === "b",
    );
    expect(update?.changes.stamp).toBeCloseTo(0.05);

    const reorder = result.diffs.find((diff) => diff.type === "reorderKeypoints");
    expect(reorder).toEqual({
      type: "reorderKeypoints",
      trackId: track.id,
      order: ["b", "a"],
    });

    expect(result.selectionCleanup).toBeUndefined();
    expect(result.projectedPoints.map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("emits delete + cleanup when the dragged point lands on another stamp", () => {
    const track = makeTrack([
      { id: "a", stamp: 0.3, value: 0 },
      { id: "b", stamp: 0.5, value: 1 },
      { id: "c", stamp: 0.8, value: 2 },
    ]);

    const selection = makeSelection(track.id, "b");
    const dragState = makeDragState("b", track.id, -0.2); // moves b to 0.3 (collision with a)

    const result = computeDragDiffOps({
      trackId: track.id,
      trackPoints: track.points,
      dragState,
      selection,
    });

    expect(
      result.diffs.some((diff) => diff.type === "deleteKeypoint" && diff.keypointId === "a"),
    ).toBe(true);
    expect(result.selectionCleanup).toEqual({
      trackId: track.id,
      removedIds: ["a"],
    });
    expect(result.projectedPoints.map((p) => p.id)).toEqual(["b", "c"]);

    const committed = makeTrack(track.points);
    applyTrackDiffOpsToTrack(committed, result.diffs);
    expect(committed.points.map((p) => p.id)).toEqual(["b", "c"]);
    expect(committed.points[0].stamp).toBeCloseTo(0.3);
  });

  it("documents the legacy gap: current computeTrackDiffsForDrag does not delete on collision", () => {
    const track = makeTrack([
      { id: "a", stamp: 0.3, value: 0 },
      { id: "b", stamp: 0.5, value: 1 },
      { id: "c", stamp: 0.8, value: 2 },
    ]);

    const selection = makeSelection(track.id, "b");
    const dragState = makeDragState("b", track.id, -0.2);

    const legacyDiffs = computeTrackDiffsForDrag({
      trackId: track.id,
      trackPoints: track.points,
      dragState,
      selection,
    });

    const hasDelete = legacyDiffs.some((diff) => (diff as any).type === "deleteKeypoint");
    expect(hasDelete).toBe(false);

    const legacyPreview = applyTrackDiffsToPoints(track.points, legacyDiffs);
    const coincidentCount = legacyPreview.filter((p) => Math.abs(p.stamp - 0.3) < 1e-6).length;
    expect(coincidentCount).toBe(2); // b overwrote stamp but did not evict a
  });
});
