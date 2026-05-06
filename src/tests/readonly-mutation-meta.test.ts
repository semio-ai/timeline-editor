import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  INSTANCE_IDS,
  NAMESPACE_IDS,
  TRACK_IDS,
  createTestAnimationStore,
} from "../test-fixtures/animation-store-factory";
import type { AnimationStore } from "../store";
import { flushMicrotasks } from "./utils/flush-microtasks";

/**
 * Meta-coverage that every authoring mutation respects the document-level
 * `readonly` flag. New mutation actions added to `AnimationActions` should
 * be appended to the `cases` array below — the test serves as a checklist
 * to keep the gate consistent.
 *
 * Each case captures a snapshot of the relevant state, invokes the action,
 * and asserts the snapshot is unchanged when the target is readonly.
 *
 * Mute / visible are intentionally excluded: per design, those are ephemeral
 * view state and remain freely toggleable even on readonly tracks. Save-flow
 * guards prevent persistence to documents the user cannot write.
 */

const sourceRowId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.SCALE}`;

interface MutationCase {
  name: string;
  invoke: (store: AnimationStore) => void;
  /** Snapshot to compare before/after — must not change when readonly. */
  snapshot: (store: AnimationStore) => unknown;
}

const cases: MutationCase[] = [
  {
    name: "updateKeypoint",
    invoke: (store) =>
      store.getState().updateKeypoint(TRACK_IDS.SCALE, { id: "s0", value: 99 }),
    snapshot: (store) => store.getState().tracks[TRACK_IDS.SCALE].points,
  },
  {
    name: "updateKeypoints",
    invoke: (store) =>
      store
        .getState()
        .updateKeypoints([{ trackId: TRACK_IDS.SCALE, keypoint: { id: "s0", value: 99 } }]),
    snapshot: (store) => store.getState().tracks[TRACK_IDS.SCALE].points,
  },
  {
    name: "createKeypoint",
    invoke: (store) =>
      store.getState().createKeypoint(TRACK_IDS.SCALE, { stamp: 9999, value: 0.5 }),
    snapshot: (store) => store.getState().tracks[TRACK_IDS.SCALE].points,
  },
  {
    name: "createKeypoints",
    invoke: (store) =>
      store
        .getState()
        .createKeypoints([{ trackId: TRACK_IDS.SCALE, keypoint: { stamp: 9999, value: 0.5 } }]),
    snapshot: (store) => store.getState().tracks[TRACK_IDS.SCALE].points,
  },
  {
    name: "removeKeypoint",
    invoke: (store) => store.getState().removeKeypoint(TRACK_IDS.SCALE, "s0"),
    snapshot: (store) => store.getState().tracks[TRACK_IDS.SCALE].points,
  },
  {
    name: "removeKeypoints",
    invoke: (store) =>
      store.getState().removeKeypoints([{ trackId: TRACK_IDS.SCALE, keypointId: "s0" }]),
    snapshot: (store) => store.getState().tracks[TRACK_IDS.SCALE].points,
  },
  {
    name: "insertKeypointAtWorldStamp",
    invoke: (store) =>
      store
        .getState()
        .insertKeypointAtWorldStamp(TRACK_IDS.SCALE, 1500, INSTANCE_IDS.ALPHA_SHARED),
    snapshot: (store) => store.getState().tracks[TRACK_IDS.SCALE].points,
  },
  {
    name: "updateTrack",
    invoke: (store) => store.getState().updateTrack({ id: TRACK_IDS.SCALE, name: "renamed" }),
    snapshot: (store) => store.getState().tracks[TRACK_IDS.SCALE].name,
  },
  {
    name: "updateTrackGroupName",
    invoke: (store) =>
      store.getState().updateTrackGroupName([TRACK_IDS.SCALE], "new-group-name"),
    snapshot: (store) => store.getState().tracks[TRACK_IDS.SCALE].groupName,
  },
  {
    name: "setTracksLocked",
    invoke: (store) => store.getState().setTracksLocked([sourceRowId], true),
    // Whatever the locked flag was on the readonly track, the call must
    // leave it alone (readonly takes precedence over user toggle).
    snapshot: (store) =>
      store.getState().instancedTrackSources[sourceRowId]?.data[0]?.locked ?? false,
  },
];

describe("readonly mutation gate", () => {
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
    store.getState().setSourcesReadonly([sourceRowId], true);
    await flushMicrotasks();
  });

  afterEach(() => {
    cleanup?.();
  });

  cases.forEach((c) => {
    it(`${c.name} is a no-op on a readonly track`, async () => {
      const before = JSON.stringify(c.snapshot(store));
      c.invoke(store);
      await flushMicrotasks();
      const after = JSON.stringify(c.snapshot(store));
      expect(after).toBe(before);
    });
  });
});
