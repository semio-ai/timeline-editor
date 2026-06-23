import { describe, expect, it } from "vitest";
import { resolveSourceRef } from "../functions/source-ref";
import type { SourceRow, SourceRowData } from "../types/util/source";
import {
  createTestAnimationStore,
  TRACK_IDS,
  ANIMATABLE_IDS,
} from "../test-fixtures/animation-store-factory";

/** Build a SourceRowData with only the fields resolveSourceRef reads. */
function datum(partial: Partial<SourceRowData>): SourceRowData {
  return {
    editable: true,
    selectable: true,
    layerBand: 0,
    animationId: "",
    namespaceId: "",
    instanceId: "",
    type: "group",
    trackId: "",
    animatableId: "",
    ...partial,
  } as SourceRowData;
}

function groupRow(sourceType: SourceRow["sourceType"], data: SourceRowData[]): SourceRow {
  return { id: "row", isGroup: true, sourceType, data };
}

describe("resolveSourceRef", () => {
  it("resolves entity rows to an entity ref carrying the opaque namespaceId", () => {
    const ref = resolveSourceRef(groupRow("entity", [datum({ namespaceId: "robot-1@target" })]));
    // No entity-id derivation here — the host owns the namespace-id convention.
    expect(ref).toEqual({ kind: "entity", namespaceId: "robot-1@target" });
  });

  it("resolves instance rows to an animation ref", () => {
    const ref = resolveSourceRef(
      groupRow("instance", [
        datum({ animationId: "anim-1", instanceId: "inst-1", namespaceId: "robot-1@target" }),
      ]),
    );
    expect(ref).toEqual({
      kind: "animation",
      animationId: "anim-1",
      instanceId: "inst-1",
      namespaceId: "robot-1@target",
    });
  });

  it("resolves a composite group to an animatable ref when components share one animatable", () => {
    const ref = resolveSourceRef(
      groupRow("vector3", [
        datum({ animatableId: "pos", trackId: "t.x" }),
        datum({ animatableId: "pos", trackId: "t.y" }),
      ]),
    );
    expect(ref).toEqual({ kind: "animatable", animatableId: "pos" });
  });

  it("falls back to a local trackGroup when a composite group's components differ", () => {
    const ref = resolveSourceRef(
      groupRow("vector3", [
        datum({ animatableId: "a", trackId: "t1" }),
        datum({ animatableId: "b", trackId: "t2" }),
      ]),
    );
    expect(ref).toEqual({ kind: "trackGroup", trackIds: ["t1", "t2"] });
  });

  it("resolves structural groups to a local trackGroup", () => {
    const ref = resolveSourceRef(
      groupRow("group", [datum({ trackId: "t1" }), datum({ trackId: "t2" })]),
    );
    expect(ref).toEqual({ kind: "trackGroup", trackIds: ["t1", "t2"] });
  });

  it("resolves leaf rows to a track ref", () => {
    const ref = resolveSourceRef({
      id: "row",
      isGroup: false,
      data: [datum({ trackId: "t1" })],
    });
    expect(ref).toEqual({ kind: "track", trackId: "t1" });
  });
});

describe("editSource default (animation package ownership)", () => {
  it("renames a track via the track ref", () => {
    const store = createTestAnimationStore();
    const handled = store.getState().editSource({ kind: "track", trackId: TRACK_IDS.OPACITY }, {
      name: "Alpha",
    });
    expect(handled).toBe(true);
    expect(store.getState().tracks[TRACK_IDS.OPACITY].name).toBe("Alpha");
  });

  it("renames an animatable via the animatable ref", () => {
    const store = createTestAnimationStore();
    const handled = store
      .getState()
      .editSource({ kind: "animatable", animatableId: ANIMATABLE_IDS.OPACITY }, { name: "Alpha A" });
    expect(handled).toBe(true);
    expect(store.getState().animatables[ANIMATABLE_IDS.OPACITY].name).toBe("Alpha A");
  });

  it("syncs the cached group label on every track of the renamed animatable", () => {
    const store = createTestAnimationStore();
    // Pick an animatable that actually has tracks in the fixture.
    const tracksBefore = store.getState().tracks;
    const animatableId = Object.values(tracksBefore)[0]?.animatableId;
    expect(animatableId).toBeTruthy();
    const targetTrackIds = Object.values(tracksBefore)
      .filter((track) => track.animatableId === animatableId)
      .map((track) => track.id);
    expect(targetTrackIds.length).toBeGreaterThan(0);

    const handled = store
      .getState()
      .editSource({ kind: "animatable", animatableId }, { name: "Renamed" });
    expect(handled).toBe(true);

    // `track.groupName` is the track-list's cached label; refreshing it on every
    // track of the animatable is what stops the track-list from reverting while
    // the sidebar (which reads the live animatable name) updates.
    const state = store.getState();
    targetTrackIds.forEach((id) => expect(state.tracks[id].groupName).toBe("Renamed"));
  });

  it("updates the group label via a trackGroup ref", () => {
    const store = createTestAnimationStore();
    const childIds = Object.keys(store.getState().tracks).filter((id) =>
      id.startsWith(`${TRACK_IDS.POSITION}.`),
    );
    const handled = store.getState().editSource({ kind: "trackGroup", trackIds: childIds }, {
      name: "Pos",
    });
    expect(handled).toBe(true);
    childIds.forEach((id) => expect(store.getState().tracks[id].groupName).toBe("Pos"));
  });

  it("does not own entity or animation sources (returns false for host override)", () => {
    const store = createTestAnimationStore();
    expect(
      store.getState().editSource({ kind: "entity", namespaceId: "e@t" }, { name: "X" }),
    ).toBe(false);
    expect(
      store
        .getState()
        .editSource(
          { kind: "animation", animationId: "a", instanceId: "i", namespaceId: "e@t" },
          { name: "X" },
        ),
    ).toBe(false);
  });
});
