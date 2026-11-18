import { describe, expect, it, vi } from "vitest";
import { createCorpusStore } from "./parity/edit-corpus";

// This file checks the store's own sealing, so it runs without the suite-wide
// deep freeze.
vi.unmock("../../subscriptions/seal-derived-snapshot");

function numericTrack(store: ReturnType<typeof createCorpusStore>) {
  const { tracks } = store.getState();
  const id = Object.keys(tracks).find((key) => typeof tracks[key].points[0]?.value === "number")!;
  return { id, point: tracks[id].points[0] };
}

describe("sealed derived snapshot", () => {
  it("publishes each snapshot with its top level frozen", () => {
    const store = createCorpusStore();
    expect(Object.isFrozen(store.getState().derivedSnapshot)).toBe(true);
    const { id, point } = numericTrack(store);
    store.getState().updateKeypoint(id, { id: point.id, value: (point.value as number) + 1 });
    expect(Object.isFrozen(store.getState().derivedSnapshot)).toBe(true);
  });

  // Immer finishes an action by deep-freezing every unfrozen object in the
  // state. That a published snapshot's rows are still unfrozen after later
  // actions shows Immer skipped the snapshot instead of walking it.
  it("is not walked by the actions that follow it", () => {
    const store = createCorpusStore();
    const { id, point } = numericTrack(store);
    store.getState().updateKeypoint(id, { id: point.id, value: (point.value as number) + 1 });
    const published = store.getState().derivedSnapshot!;
    store.getState().selectAll();
    store.getState().updateKeypoint(id, { id: point.id, value: (point.value as number) + 2 });
    const rows = Object.values(published.rows);
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => expect(Object.isFrozen(row.computed)).toBe(false));
  });
});
