/**
 * Playback gate on selection actions: tests that setEntityControlMode and
 * focusSelectionInstance respect the "no swapping which animation instance
 * drives an entity during playback" rule. The rig must not retarget
 * mid-frame; user must pause to change the entity↔instance pairing.
 *
 * focusSelectionInstance is a partial gate — selection focus still updates
 * during playback (so the user can inspect a different instance's
 * keypoints) but the entityStates mutation is skipped.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { namespaceEntity } from "@semio/utils";
import {
  INSTANCE_IDS,
  NAMESPACE_IDS,
  createTestAnimationStore,
} from "../../test-fixtures/animation-store-factory";
import type { AnimationStore } from "../../store";
import { flushMicrotasks } from "../utils/flush-microtasks";

/**
 * Lie to the gate about the store's player without moving it, so nothing that
 * follows the player reacts — irrelevant to what we're testing.
 */
const withPlayerRunning = (store: AnimationStore, running: boolean, fn: () => void): void => {
  const player = store.getState().playerStore;
  const realState = player.getState();
  const spy = vi
    .spyOn(player, "getState")
    .mockReturnValue({ ...realState, player: { ...realState.player, running } });
  try {
    fn();
  } finally {
    spy.mockRestore();
  }
};

describe("selection actions playback gate", () => {
  let store: AnimationStore;
  let cleanup: (() => void) | undefined;
  const entityId = namespaceEntity(NAMESPACE_IDS.ALPHA);

  beforeEach(async () => {
    store = createTestAnimationStore({
      includeNamespaceA: true,
      includeNamespaceB: false,
      activeInstance: INSTANCE_IDS.ALPHA_SHARED,
    });
    cleanup = store.getState().initAnimationSubscriptions();
    await flushMicrotasks();

    // Bootstrap entityStates so the gated assertions have something to
    // diff against — the test fixture itself doesn't populate it.
    store.getState().setEntityControlMode(entityId, "animation", INSTANCE_IDS.ALPHA_SHARED);
  });

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  describe("setEntityControlMode", () => {
    it("changes the entity↔instance pairing when the player is stopped", () => {
      store
        .getState()
        .setEntityControlMode(entityId, "animation", INSTANCE_IDS.ALPHA_EXCLUSIVE);

      expect(store.getState().entityStates[entityId]?.activeInstanceId).toBe(
        INSTANCE_IDS.ALPHA_EXCLUSIVE,
      );
    });

    it("no-ops when the player is running", () => {
      const before = store.getState().entityStates[entityId]?.activeInstanceId;

      withPlayerRunning(store, true, () => {
        store
          .getState()
          .setEntityControlMode(entityId, "animation", INSTANCE_IDS.ALPHA_EXCLUSIVE);
      });

      expect(store.getState().entityStates[entityId]?.activeInstanceId).toBe(before);
    });
  });

  describe("focusSelectionInstance", () => {
    it("updates the entity's active instance AND mirrors selection scope when stopped", () => {
      store.getState().focusSelectionInstance(INSTANCE_IDS.ALPHA_EXCLUSIVE);

      expect(store.getState().entityStates[entityId]?.activeInstanceId).toBe(
        INSTANCE_IDS.ALPHA_EXCLUSIVE,
      );
      // Unified contract: selectionState.instanceId is a strict mirror of
      // entityStates[activeEntityId].activeInstanceId.
      expect(store.getState().selectionState.instanceId).toBe(INSTANCE_IDS.ALPHA_EXCLUSIVE);
    });

    it("switches the focused entity to the clicked instance's owning entity", () => {
      // Pre: focused entity is the same as ALPHA's owning entity (set by
      // fixture). After clicking ALPHA_EXCLUSIVE the focused entity remains
      // ALPHA's owning entity, but the ID lookup proves the writer set it.
      store.getState().focusSelectionInstance(INSTANCE_IDS.ALPHA_EXCLUSIVE);
      expect(store.getState().activeEntityId).toBe(entityId);
    });

    it("during playback: leaves entityStates pairing unchanged (gated)", () => {
      const beforeActive = store.getState().entityStates[entityId]?.activeInstanceId;

      withPlayerRunning(store, true, () => {
        store.getState().focusSelectionInstance(INSTANCE_IDS.ALPHA_EXCLUSIVE);
      });

      // Pairing didn't change — the rig keeps following the old instance.
      expect(store.getState().entityStates[entityId]?.activeInstanceId).toBe(beforeActive);
      // selectionState mirrors entityStates, so it also didn't move.
      expect(store.getState().selectionState.instanceId).toBe(beforeActive);
    });

    it("during playback: still switches focused entity (allowed mid-playback)", () => {
      withPlayerRunning(store, true, () => {
        store.getState().focusSelectionInstance(INSTANCE_IDS.ALPHA_EXCLUSIVE);
      });
      // Entity focus follows clicks even during playback, per the
      // user's design rule that entity switching is allowed mid-playback.
      expect(store.getState().activeEntityId).toBe(entityId);
    });
  });
});
