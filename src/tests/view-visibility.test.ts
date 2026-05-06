import { describe, expect, it } from "vitest";
import { collectSourceTracks } from "../functions/source-utils";
import { buildFilteredSourceRowId } from "../functions/view-filtered-source-row";
import { createTestAnimationStore } from "../test-fixtures/animation-store-factory";
import { buildTrackKey } from "../utils/track-key";
import { flushMicrotasks } from "./utils/flush-microtasks";

describe("view-specific visibility", () => {
  it("applies hidden tracks per view without mutating global source visibility", async () => {
    const store = createTestAnimationStore();
    store.getState().addView({ id: "view-a", name: "View A" });
    store.getState().addView({ id: "view-b", name: "View B" });
    await flushMicrotasks();

    const seeded = store.getState();
    const allTracks = collectSourceTracks(seeded.globalSourceTree);
    expect(allTracks.length).toBeGreaterThan(0);
    const targetTrack = allTracks[0];
    expect(targetTrack).toBeDefined();
    if (!targetTrack) return;

    const rowId = `${targetTrack.namespaceId}/${targetTrack.instanceId}/${targetTrack.trackId}`;
    const trackKey = buildTrackKey(
      targetTrack.namespaceId,
      targetTrack.instanceId,
      targetTrack.trackId,
    );

    store.getState().updateViewTrackVisibility("view-a", {
      [targetTrack.id]: { hidden: true },
    });
    await flushMicrotasks();

    const state = store.getState();
    expect(state.sourceRowIdsByView["view-a"]?.spline).not.toContain(rowId);
    expect(state.sourceRowIdsByView["view-b"]?.spline).toContain(rowId);
    expect(state.sourceRowIds.spline).toContain(rowId);

    // Consumers resolve the effective view source by falling back from the
    // per-view filtered twin to the base row. A twin is only emitted when it
    // actually differs from the base row, so view-b (nothing hidden) has no
    // twin and resolves directly to the global row.
    const resolveViewSource = (viewId: string) =>
      state.instancedTrackSources[buildFilteredSourceRowId(viewId, "global")] ??
      state.instancedTrackSources.global;

    const viewASource = resolveViewSource("view-a");
    const viewBSource = resolveViewSource("view-b");
    const hasTrackInA = viewASource.data.some(
      (entry) => buildTrackKey(entry.namespaceId, entry.instanceId, entry.trackId) === trackKey,
    );
    const hasTrackInB = viewBSource.data.some(
      (entry) => buildTrackKey(entry.namespaceId, entry.instanceId, entry.trackId) === trackKey,
    );

    expect(hasTrackInA).toBe(false);
    expect(hasTrackInB).toBe(true);
  });

  it("hides all descendant tracks when a group id is toggled", async () => {
    const store = createTestAnimationStore();
    store.getState().addView({ id: "view-a", name: "View A" });
    await flushMicrotasks();

    const seeded = store.getState();
    const group = seeded.globalSourceTree.find((source) => "children" in source);
    expect(group).toBeDefined();
    if (!group || !("children" in group)) return;

    const descendantRowIds = collectSourceTracks([group]).map(
      (track) => `${track.namespaceId}/${track.instanceId}/${track.trackId}`,
    );
    store.getState().updateViewTrackVisibility("view-a", {
      [group.id]: { hidden: true },
    });
    await flushMicrotasks();

    const viewRows = store.getState().sourceRowIdsByView["view-a"]?.spline ?? [];
    descendantRowIds.forEach((rowId) => {
      expect(viewRows).not.toContain(rowId);
    });
  });

  it("keeps at least one view in the store", () => {
    const store = createTestAnimationStore();
    store.getState().addView({ id: "view-a", name: "View A" });
    expect(Object.keys(store.getState().editorViews)).toEqual(["view-a"]);

    store.getState().removeView("view-a");
    expect(Object.keys(store.getState().editorViews)).toEqual(["view-a"]);

    store.getState().addView({ id: "view-b", name: "View B" });
    store.getState().removeView("view-a");
    expect(Object.keys(store.getState().editorViews)).toEqual(["view-b"]);
  });
});
