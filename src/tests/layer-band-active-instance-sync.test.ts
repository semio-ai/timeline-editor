import { describe, expect, it } from "vitest";
import { LayerBand } from "../types";
import {
  createTestAnimationStore,
  INSTANCE_IDS,
  NAMESPACE_IDS,
  TRACK_IDS,
} from "../test-fixtures/animation-store-factory";
import { flushMicrotasks } from "./utils/flush-microtasks";

describe("layer band active-instance sync", () => {
  // The canvas's foreground/background derivation reads the per-entity
  // active animation instance from entityStates (the rig-driving
  // instance). Selection focus alone does not change layerBand —
  // clicking a non-active instance during playback updates selection but
  // not entityStates, so the canvas color stays put.
  it("rows fall to background when the entity has no active animation instance", async () => {
    const store = createTestAnimationStore();
    const rowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.SCALE}`;
    const entityId = NAMESPACE_IDS.ALPHA;

    const initiallyActiveRow = store.getState().instancedTrackSources[rowId];
    expect(initiallyActiveRow?.data[0]?.layerBand).toBe(LayerBand.ForegroundUnselected);

    // Switch the entity to direct mode (no active instance). Foreground
    // requires entityStates[entity].activeInstanceId === track.instanceId.
    store.getState().setEntityControlMode(entityId, "direct");
    await flushMicrotasks();

    const inactiveRow = store.getState().instancedTrackSources[rowId];
    expect(inactiveRow?.data[0]?.layerBand).toBe(LayerBand.Background);

    const globalRow = store.getState().instancedTrackSources.global;
    const globalEntry = globalRow?.data.find(
      (entry) =>
        entry.namespaceId === NAMESPACE_IDS.ALPHA &&
        entry.instanceId === INSTANCE_IDS.ALPHA_SHARED &&
        entry.trackId === TRACK_IDS.SCALE,
    );
    expect(globalEntry?.layerBand).toBe(LayerBand.Background);
  });

  it("renders document-readonly tracks with the same locked overlay as user-locked tracks", async () => {
    // Both readonly (document permission) and locked (user toggle) are
    // non-editable for the same observable reason — they must produce the
    // same `ForegroundLocked` band so the diagonal-line overlay applies
    // uniformly. Visual parity is part of the design contract.
    const store = createTestAnimationStore();
    const rowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.SCALE}`;

    store.getState().setSourcesReadonly([rowId], true);
    await flushMicrotasks();

    const readonlyRow = store.getState().instancedTrackSources[rowId];
    expect(readonlyRow?.data[0]?.readonly).toBe(true);
    expect(readonlyRow?.data[0]?.layerBand).toBe(LayerBand.ForegroundLocked);

    // Clearing readonly returns the row to the foreground-unselected band.
    store.getState().setSourcesReadonly([rowId], false);
    await flushMicrotasks();
    const clearedRow = store.getState().instancedTrackSources[rowId];
    expect(clearedRow?.data[0]?.layerBand).toBe(LayerBand.ForegroundUnselected);

    // User-toggle locked produces the same band — sanity check the parity.
    store.getState().setTracksLocked([rowId], true);
    await flushMicrotasks();
    const lockedRow = store.getState().instancedTrackSources[rowId];
    expect(lockedRow?.data[0]?.layerBand).toBe(LayerBand.ForegroundLocked);
  });
});
