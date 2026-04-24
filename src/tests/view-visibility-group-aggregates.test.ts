import { describe, expect, it } from "vitest";
import { buildFilteredSourceRowId } from "../functions/view-filtered-source-row";
import {
  INSTANCE_IDS,
  NAMESPACE_IDS,
  TRACK_IDS,
  createTestAnimationStore,
} from "../test-fixtures/animation-store-factory";
import { flushMicrotasks } from "./utils/flush-microtasks";

/**
 * Regression coverage for per-view filtered twins of group rows.
 *
 * When a view hides a descendant track, every ancestor group row (composite,
 * instance, entity, global) must produce a filtered twin whose aggregate
 * `.data` excludes the hidden track. Previously only the `global` row got a
 * filtered twin, so ancestor group rows still rendered phantom keypoint dots
 * for descendants hidden by the view.
 */
describe("view-filtered group aggregates", () => {
  const leafRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.POSITION_X}`;
  const compositeGroupId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.POSITION}`;
  const instanceGroupId = `instance:${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}`;
  const entityGroupId = `entity:${NAMESPACE_IDS.ALPHA}`;

  it("emits filtered twins that exclude hidden descendants at every level", async () => {
    const store = createTestAnimationStore();
    store.getState().addView({ id: "view-a", name: "View A" });
    await flushMicrotasks();

    store.getState().updateViewTrackVisibility("view-a", {
      [leafRowId]: { hidden: true },
    });
    await flushMicrotasks();

    const rows = store.getState().instancedTrackSources;

    // Base row lengths are the fixture-established baseline (3 / 5 / 10 / 20).
    expect(rows[compositeGroupId]?.data.length).toBe(3);
    expect(rows[instanceGroupId]?.data.length).toBe(5);
    expect(rows[entityGroupId]?.data.length).toBe(10);
    expect(rows.global?.data.length).toBe(20);

    // Each ancestor of the hidden leaf must produce a filtered twin with one
    // fewer entry than its base row.
    const compositeTwin = rows[buildFilteredSourceRowId("view-a", compositeGroupId)];
    const instanceTwin = rows[buildFilteredSourceRowId("view-a", instanceGroupId)];
    const entityTwin = rows[buildFilteredSourceRowId("view-a", entityGroupId)];
    const globalTwin = rows[buildFilteredSourceRowId("view-a", "global")];

    expect(compositeTwin?.data.length).toBe(2);
    expect(instanceTwin?.data.length).toBe(4);
    expect(entityTwin?.data.length).toBe(9);
    expect(globalTwin?.data.length).toBe(19);

    // Every twin's `.data` must not reference the hidden leaf.
    [compositeTwin, instanceTwin, entityTwin, globalTwin].forEach((twin) => {
      expect(
        twin?.data.some(
          (entry) =>
            entry.namespaceId === NAMESPACE_IDS.ALPHA &&
            entry.instanceId === INSTANCE_IDS.ALPHA_SHARED &&
            entry.trackId === TRACK_IDS.POSITION_X,
        ),
      ).toBe(false);
    });

    // The hidden leaf's own row must be absent from the view's visible lists,
    // while its ancestor groups remain (they still have visible descendants).
    const viewSpline = store.getState().sourceRowIdsByView["view-a"]?.spline ?? [];
    const viewFlat = store.getState().sourceRowIdsByView["view-a"]?.flat ?? [];
    expect(viewSpline).not.toContain(leafRowId);
    expect(viewFlat).toContain(compositeGroupId);
    expect(viewFlat).toContain(instanceGroupId);
    expect(viewFlat).toContain(entityGroupId);
  });

  it("emits no twin for views where filtering would be a no-op", async () => {
    const store = createTestAnimationStore();
    store.getState().addView({ id: "view-a", name: "View A" });
    store.getState().addView({ id: "view-b", name: "View B" });
    await flushMicrotasks();

    store.getState().updateViewTrackVisibility("view-a", {
      [leafRowId]: { hidden: true },
    });
    await flushMicrotasks();

    const rows = store.getState().instancedTrackSources;

    // view-b hides nothing — no twin is emitted for any row under that view.
    [compositeGroupId, instanceGroupId, entityGroupId, "global"].forEach((rowId) => {
      expect(rows[buildFilteredSourceRowId("view-b", rowId)]).toBeUndefined();
    });

    // Resolving through the fallback (twin ?? base) must yield the
    // unfiltered row for view-b and the filtered row for view-a.
    const resolveViewRow = (viewId: string, rowId: string) =>
      rows[buildFilteredSourceRowId(viewId, rowId)] ?? rows[rowId];

    expect(resolveViewRow("view-b", instanceGroupId)?.data.length).toBe(5);
    expect(resolveViewRow("view-a", instanceGroupId)?.data.length).toBe(4);
  });
});
