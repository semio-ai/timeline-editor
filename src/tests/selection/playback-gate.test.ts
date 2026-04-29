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
import { usePlayerStore } from "@semio/utils";
import {
  INSTANCE_IDS,
  NAMESPACE_IDS,
  createTestAnimationStore,
} from "../../test-fixtures/animation-store-factory";
import type { AnimationStore } from "../../store";
import { flushMicrotasks } from "../utils/flush-microtasks";

/**
 * Lie to the gate without poking the real player store. Calling
 * usePlayerStore.setState would trip the player-loop subscription
 * (window.setInterval, jsdom-only) — irrelevant to what we're testing.
 */
const withPlayerRunning = (running: boolean, fn: () => void): void => {
  const realState = usePlayerStore.getState();
  const spy = vi
    .spyOn(usePlayerStore, "getState")
    .mockReturnValue({ ...realState, player: { ...realState.player, running } });
  try {
    fn();
  } finally {
    spy.mockRestore();
  }
};

const entityIdFor = (namespaceId: string): string => namespaceId.split("@")[0];

describe("selection actions playback gate", () => {
  let store: AnimationStore;
  let cleanup: (() => void) | undefined;
  const entityId = entityIdFor(NAMESPACE_IDS.ALPHA);

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

      withPlayerRunning(true, () => {
        store
          .getState()
          .setEntityControlMode(entityId, "animation", INSTANCE_IDS.ALPHA_EXCLUSIVE);
      });

      expect(store.getState().entityStates[entityId]?.activeInstanceId).toBe(before);
    });
  });

  describe("focusSelectionInstance", () => {
    it("updates selection focus AND the entity active instance when stopped", () => {
      store.getState().focusSelectionInstance(INSTANCE_IDS.ALPHA_EXCLUSIVE);

      expect(store.getState().selectionState.instanceId).toBe(INSTANCE_IDS.ALPHA_EXCLUSIVE);
      expect(store.getState().entityStates[entityId]?.activeInstanceId).toBe(
        INSTANCE_IDS.ALPHA_EXCLUSIVE,
      );
    });

    // Partial gate: selection focus must still update during playback so users
    // can inspect a non-active instance's keypoints. Only the side-effect
    // mutation of entityStates is suppressed.
    it("updates selection focus but leaves entity active instance unchanged when running", () => {
      const beforeActive = store.getState().entityStates[entityId]?.activeInstanceId;

      withPlayerRunning(true, () => {
        store.getState().focusSelectionInstance(INSTANCE_IDS.ALPHA_EXCLUSIVE);
      });

      // Selection focus DID update — the user can look at the other instance.
      expect(store.getState().selectionState.instanceId).toBe(INSTANCE_IDS.ALPHA_EXCLUSIVE);
      // entityStates DID NOT — the rig keeps following the old instance.
      expect(store.getState().entityStates[entityId]?.activeInstanceId).toBe(beforeActive);
    });
  });
});
