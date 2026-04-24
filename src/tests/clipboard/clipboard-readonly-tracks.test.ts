import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  INSTANCE_IDS,
  NAMESPACE_IDS,
  TRACK_IDS,
  createTestAnimationStore,
} from "../../test-fixtures/animation-store-factory";
import type { AnimationStore } from "../../store";
import { flushMicrotasks } from "../utils/flush-microtasks";

/**
 * Document-readonly tracks must behave identically to user-locked tracks
 * for clipboard operations: paste skips them, delete skips them, cut copies
 * them but does not delete. Differs only at the UI layer (Lock toggle is
 * disabled for readonly).
 *
 * This file is a parallel of `clipboard-locked-tracks.test.ts` — the action
 * gate must apply to both reasons via `getNonEditableTrackIds`.
 */

function selectKeypoints(
  store: AnimationStore,
  entries: { trackKey: string; keypointIds: string[] }[],
  instanceId: string,
) {
  const keypoints = new Map<string, Set<string>>();
  for (const { trackKey, keypointIds } of entries) {
    keypoints.set(trackKey, new Set(keypointIds));
  }
  store.setState({
    selectionState: {
      ...store.getState().selectionState,
      keypoints,
      instanceId,
    },
  });
}

const sourceRowId = (namespaceId: string, instanceId: string, trackId: string) =>
  `${namespaceId}/${instanceId}/${trackId}`;

describe("Clipboard: readonly-track filtering", () => {
  let store: AnimationStore;
  let cleanup: (() => void) | undefined;

  beforeEach(async () => {
    store = createTestAnimationStore({
      includeNamespaceA: true,
      includeNamespaceB: true,
      activeInstance: INSTANCE_IDS.ALPHA_SHARED,
    });
    cleanup = store.getState().initAnimationSubscriptions();
    await flushMicrotasks();
  });

  afterEach(() => {
    cleanup?.();
  });

  it("paste skips readonly target tracks but applies to writable tracks in the same paste", async () => {
    selectKeypoints(
      store,
      [
        { trackKey: TRACK_IDS.SCALE, keypointIds: ["s0"] },
        { trackKey: TRACK_IDS.OPACITY, keypointIds: ["o0"] },
      ],
      INSTANCE_IDS.ALPHA_SHARED,
    );
    store.getState().copySelection();
    expect(store.getState().clipboard?.tracks).toHaveLength(2);

    store
      .getState()
      .setSourcesReadonly(
        [sourceRowId(NAMESPACE_IDS.ALPHA, INSTANCE_IDS.ALPHA_SHARED, TRACK_IDS.SCALE)],
        true,
      );
    await flushMicrotasks();

    store.setState({
      selectionState: {
        ...store.getState().selectionState,
        keypoints: new Map(),
      },
    });

    const beforeScale = store.getState().tracks[TRACK_IDS.SCALE].points.length;
    const beforeOpacity = store.getState().tracks[TRACK_IDS.OPACITY].points.length;

    store.getState().pasteAtStamp(1500);
    await flushMicrotasks();

    expect(store.getState().tracks[TRACK_IDS.SCALE].points.length).toBe(beforeScale);
    expect(store.getState().tracks[TRACK_IDS.OPACITY].points.length).toBe(beforeOpacity + 1);

    const newSelection = store.getState().selectionState.keypoints;
    expect(newSelection.has(TRACK_IDS.SCALE)).toBe(false);
    expect(newSelection.get(TRACK_IDS.OPACITY)?.size).toBe(1);
  });

  it("delete skips readonly tracks and preserves their selection", async () => {
    selectKeypoints(
      store,
      [
        { trackKey: TRACK_IDS.SCALE, keypointIds: ["s0", "s1"] },
        { trackKey: TRACK_IDS.OPACITY, keypointIds: ["o0"] },
      ],
      INSTANCE_IDS.ALPHA_SHARED,
    );

    store
      .getState()
      .setSourcesReadonly(
        [sourceRowId(NAMESPACE_IDS.ALPHA, INSTANCE_IDS.ALPHA_SHARED, TRACK_IDS.SCALE)],
        true,
      );
    await flushMicrotasks();

    const beforeScale = store.getState().tracks[TRACK_IDS.SCALE].points.length;
    const beforeOpacity = store.getState().tracks[TRACK_IDS.OPACITY].points.length;

    store.getState().deleteSelection();

    expect(store.getState().tracks[TRACK_IDS.SCALE].points.length).toBe(beforeScale);
    expect(store.getState().tracks[TRACK_IDS.OPACITY].points.length).toBe(beforeOpacity - 1);

    const selection = store.getState().selectionState.keypoints;
    expect(selection.get(TRACK_IDS.SCALE)?.size).toBe(2);
    expect(selection.has(TRACK_IDS.OPACITY)).toBe(false);
  });

  it("cut on a readonly track copies but does not remove keypoints", async () => {
    selectKeypoints(
      store,
      [{ trackKey: TRACK_IDS.SCALE, keypointIds: ["s0"] }],
      INSTANCE_IDS.ALPHA_SHARED,
    );

    store
      .getState()
      .setSourcesReadonly(
        [sourceRowId(NAMESPACE_IDS.ALPHA, INSTANCE_IDS.ALPHA_SHARED, TRACK_IDS.SCALE)],
        true,
      );
    await flushMicrotasks();

    const before = store.getState().tracks[TRACK_IDS.SCALE].points.length;
    store.getState().cutSelection();

    expect(store.getState().clipboard?.tracks).toHaveLength(1);
    expect(store.getState().tracks[TRACK_IDS.SCALE].points.length).toBe(before);
  });
});
