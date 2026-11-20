import { describe, expect, it } from "vitest";
import { shallow } from "zustand/shallow";
import { rowRenderSamples } from "../../functions/materialize-segment-sample";
import { createCorpusStore } from "./parity/edit-corpus";

describe("a row's render samples", () => {
  it("stay shallow-equal for a row a write leaves alone, and change for one it reaches", () => {
    const store = createCorpusStore();
    const state = store.getState();
    const leaf = Object.values(state.instancedTrackSources).find(
      (row) =>
        !row.isGroup &&
        row.data.length === 1 &&
        typeof state.tracks[row.data[0].trackId]?.points[0]?.value === "number",
    )!;
    const trackId = leaf.data[0].trackId;
    const point = state.tracks[trackId].points[0];
    const before = state.derivedSnapshot!;
    const samplesBefore = Object.fromEntries(
      Object.keys(before.rows).map((rowId) => [rowId, rowRenderSamples(before, rowId)]),
    );

    store.getState().updateKeypoint(trackId, { id: point.id, value: (point.value as number) + 1 });
    const after = store.getState().derivedSnapshot!;

    let unchanged = 0;
    Object.keys(after.rows).forEach((rowId) => {
      const samples = rowRenderSamples(after, rowId);
      if (Object.keys(samples).length === 0) return;
      const draws = store
        .getState()
        .instancedTrackSources[rowId]?.data.some((datum) => datum.trackId === trackId);
      expect(shallow(samples, samplesBefore[rowId]), rowId).toBe(!draws);
      if (!draws) unchanged += 1;
    });
    expect(unchanged).toBeGreaterThan(0);
    expect(shallow(rowRenderSamples(after, leaf.id), samplesBefore[leaf.id])).toBe(false);
  });

  it("answers again for the same snapshot with the same object", () => {
    const store = createCorpusStore();
    const snapshot = store.getState().derivedSnapshot!;
    Object.keys(snapshot.rows).forEach((rowId) =>
      expect(rowRenderSamples(snapshot, rowId), rowId).toBe(rowRenderSamples(snapshot, rowId)),
    );
  });
});
