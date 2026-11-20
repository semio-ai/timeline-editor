import { describe, expect, it } from "vitest";
import { buildFilteredSourceRowId } from "../../functions/view-filtered-source-row";
import { createCorpusStore } from "./parity/edit-corpus";

describe("source rows", () => {
  // A row can go away while every remaining row and the global row's data stay
  // as they were (ungrouping removes the group row and keeps its tracks). Its
  // per-view filtered twin must go with it.
  it("drops a removed row's filtered twin when the global row's data is unchanged", () => {
    const store = createCorpusStore();
    const before = store.getState();
    const leaf = Object.values(before.instancedTrackSources).find(
      (row) => !row.isGroup && row.data.length === 1,
    )!;
    const twinId = buildFilteredSourceRowId("parity-view", "removed-row");
    store.setState({
      instancedTrackSources: {
        ...before.instancedTrackSources,
        "removed-row": { ...leaf, id: "removed-row", data: [...leaf.data, ...leaf.data] },
        [twinId]: { ...leaf, id: twinId },
      },
    });

    // Rebuild the rows from the same tree, which has no "removed-row".
    store.setState({ tracksRevision: (store.getState().tracksRevision ?? 0) + 1 });

    const after = store.getState().instancedTrackSources;
    expect(after["removed-row"]).toBeUndefined();
    expect(after[twinId]).toBeUndefined();
  });
});
