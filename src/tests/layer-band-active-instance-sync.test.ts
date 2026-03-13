import { describe, expect, it } from "vitest";
import { createEmptySelectionState } from "../functions/selection-state-manager";
import { LayerBand } from "../types";
import {
  createTestAnimationStore,
  INSTANCE_IDS,
  NAMESPACE_IDS,
  TRACK_IDS,
} from "../test-fixtures/animation-store-factory";
import { flushMicrotasks } from "./utils/flush-microtasks";

describe("layer band active-instance sync", () => {
  it("keeps rows in background when no selection instance is active", async () => {
    const store = createTestAnimationStore();
    const rowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.SCALE}`;

    const initiallyActiveRow = store.getState().instancedTrackSources[rowId];
    expect(initiallyActiveRow?.data[0]?.layerBand).toBe(LayerBand.ForegroundUnselected);

    store.setState({ selectionState: createEmptySelectionState(null) });
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
});
