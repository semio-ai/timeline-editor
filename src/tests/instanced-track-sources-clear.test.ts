import { describe, expect, it } from "vitest";
import { createTestAnimationStore } from "../test-fixtures/animation-store-factory";
import { flushMicrotasks } from "./utils/flush-microtasks";

describe("instancedTrackSources clears when source tree empties", () => {
  it("removes stale per-track rows after namespaces are cleared", async () => {
    const store = createTestAnimationStore();
    await flushMicrotasks();

    const initialRowKeys = Object.keys(store.getState().instancedTrackSources);
    expect(initialRowKeys.length).toBeGreaterThan(1);
    expect(initialRowKeys).toContain("global");

    store.getState().setNamespaces({});
    await flushMicrotasks();

    const finalState = store.getState();
    expect(finalState.globalSourceTree).toEqual([]);

    const finalRowKeys = Object.keys(finalState.instancedTrackSources).filter(
      (key) => !key.startsWith("filtered:"),
    );
    expect(finalRowKeys).toEqual(["global"]);
    expect(finalState.instancedTrackSources.global?.data).toEqual([]);
  });
});
