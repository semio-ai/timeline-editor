import { describe, expect, it } from "vitest";
import { createTestAnimationStore, INSTANCE_IDS } from "../test-fixtures/animation-store-factory";

/**
 * Guards the undo-atomicity of multi-track key insertion. The bug this prevents:
 * inserting per-track via separate `set()`s makes each track its own history
 * entry, so a single undo only peels one off. `insertKeypointsAtWorldStamp` must
 * do all tracks in ONE store update.
 */
describe("insertKeypointsAtWorldStamp", () => {
  function pickScalarTrackIds(store: ReturnType<typeof createTestAnimationStore>, n: number) {
    const tracks = store.getState().tracks;
    return Object.keys(tracks)
      .filter((id) => typeof tracks[id].points[0]?.value === "number")
      .slice(0, n);
  }

  it("inserts a key on every track in a single store update", () => {
    const store = createTestAnimationStore();
    const trackIds = pickScalarTrackIds(store, 2);
    expect(trackIds.length).toBe(2);

    const stamp = 99_999; // beyond the fixture's existing keys
    const before = trackIds.map((id) => store.getState().tracks[id].points.length);

    // Count how many times the `tracks` slice changes — that's the slice the
    // undo history records, so one change = one undo entry. (A plain store
    // subscription would also see derived-state cascades, so scope to tracks.)
    let trackUpdates = 0;
    const unsubscribe = store.subscribe(
      (state) => state.tracks,
      () => {
        trackUpdates += 1;
      },
    );
    store.getState().insertKeypointsAtWorldStamp(
      trackIds.map((trackId) => ({ trackId, instanceId: INSTANCE_IDS.ALPHA_SHARED })),
      stamp,
    );
    unsubscribe();

    // One tracks update → one history entry → one undo reverts the whole insertion.
    expect(trackUpdates).toBe(1);
    // And every track actually gained a key.
    trackIds.forEach((id, i) => {
      expect(store.getState().tracks[id].points.length).toBe(before[i] + 1);
    });
  });

  it("is a no-op (no tracks update) when given no inserts", () => {
    const store = createTestAnimationStore();
    let trackUpdates = 0;
    const unsubscribe = store.subscribe(
      (state) => state.tracks,
      () => {
        trackUpdates += 1;
      },
    );
    store.getState().insertKeypointsAtWorldStamp([], 1000);
    unsubscribe();
    expect(trackUpdates).toBe(0);
  });

  it("does not stack a duplicate key when one already exists at the stamp", () => {
    const store = createTestAnimationStore();
    const [trackId] = pickScalarTrackIds(store, 1);
    const insert = [{ trackId, instanceId: INSTANCE_IDS.ALPHA_SHARED }];
    const stamp = 99_999;

    store.getState().insertKeypointsAtWorldStamp(insert, stamp);
    const afterFirst = store.getState().tracks[trackId].points.length;

    // Re-inserting at the same stamp (e.g. mashing the add-key shortcut) must
    // skip the track that already has a key there — no duplicate, no update.
    let trackUpdates = 0;
    const unsubscribe = store.subscribe(
      (state) => state.tracks,
      () => {
        trackUpdates += 1;
      },
    );
    store.getState().insertKeypointsAtWorldStamp(insert, stamp);
    unsubscribe();

    expect(trackUpdates).toBe(0);
    expect(store.getState().tracks[trackId].points.length).toBe(afterFirst);
  });

  it("inserts only on tracks lacking a key when the batch is mixed", () => {
    const store = createTestAnimationStore();
    const trackIds = pickScalarTrackIds(store, 2);
    expect(trackIds.length).toBe(2);
    const stamp = 99_999;

    // Seed a key on the first track only.
    store
      .getState()
      .insertKeypointsAtWorldStamp([{ trackId: trackIds[0], instanceId: INSTANCE_IDS.ALPHA_SHARED }], stamp);
    const counts = trackIds.map((id) => store.getState().tracks[id].points.length);

    // Batch over both: the already-keyed track is skipped, the other gains one.
    store.getState().insertKeypointsAtWorldStamp(
      trackIds.map((trackId) => ({ trackId, instanceId: INSTANCE_IDS.ALPHA_SHARED })),
      stamp,
    );

    expect(store.getState().tracks[trackIds[0]].points.length).toBe(counts[0]);
    expect(store.getState().tracks[trackIds[1]].points.length).toBe(counts[1] + 1);
  });
});
