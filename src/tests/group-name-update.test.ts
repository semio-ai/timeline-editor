import { describe, expect, it } from "vitest";
import { computeDefaultSourcesFromInstance } from "../functions/compute-default-sources-from-instance";
import {
  createTestAnimationStore,
  TRACK_IDS,
  NAMESPACE_IDS,
  INSTANCE_IDS,
} from "../test-fixtures/animation-store-factory";

describe("group name updates", () => {
  it("updates only the group label, leaving child track names intact", () => {
    const store = createTestAnimationStore();
    const state = store.getState();

    const positionChildIds = Object.keys(state.tracks).filter((id) =>
      id.startsWith(`${TRACK_IDS.POSITION}.`),
    );

    // Baseline expectations: children use axis labels; group label is the parent name.
    positionChildIds.forEach((id) => {
      expect(state.tracks[id].name).toBe(id.split(".").pop());
      expect(state.tracks[id].groupName).toBe("Position");
    });

    // Update the group label via the store action.
    store.getState().updateTrackGroupName(positionChildIds, "Pos");

    const updated = store.getState();
    positionChildIds.forEach((id) => {
      expect(updated.tracks[id].name).toBe(id.split(".").pop()); // unchanged axis label
      expect(updated.tracks[id].groupName).toBe("Pos"); // updated group label
    });

    // Recompute sources to ensure the group name reflects the new label.
    const sources = computeDefaultSourcesFromInstance(
      NAMESPACE_IDS.ALPHA,
      updated.namespaces[NAMESPACE_IDS.ALPHA].animationInstances[INSTANCE_IDS.ALPHA_SHARED],
      updated.animations,
      updated.animatables,
      updated.tracks,
    );

    const groupId = `${NAMESPACE_IDS.ALPHA}/${INSTANCE_IDS.ALPHA_SHARED}/${TRACK_IDS.POSITION}`;
    const positionGroup = sources.find((s) => s.id === groupId && "children" in s);
    expect(positionGroup && "name" in positionGroup ? positionGroup.name : undefined).toBe("Pos");
  });
});
