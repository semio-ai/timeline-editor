import { describe, expect, it } from "vitest";
import {
  filterHandlesByVisibility,
  shouldRowShowHandles,
} from "../functions/handle-visibility";
import { TransitionHandleKind } from "../types";
import type { RenderHandle, SourceRow, TrackKey } from "../types";

const handle = (trackId: string, keypointId: string): RenderHandle => ({
  id: `${trackId}/${keypointId}/out`,
  keypointId,
  trackId,
  trackKey: `ns/inst/${trackId}` as TrackKey,
  side: "out",
  kind: TransitionHandleKind.Explicit,
  world: { x: 0, y: 0 },
});

const row = (entries: { trackId: string; instanceId: string }[]): SourceRow => ({
  id: "row",
  data: entries.map(({ trackId, instanceId }) => ({
    trackId,
    instanceId,
    namespaceId: "ns",
    animationId: "anim",
    animatableId: trackId,
    type: "number",
    selectable: true,
    editable: true,
    layerBand: 0 as unknown as SourceRow["data"][number]["layerBand"],
    muted: false,
    visible: true,
    locked: false,
  })),
});

describe("shouldRowShowHandles", () => {
  const sourceRow = row([
    { trackId: "scale", instanceId: "inst-a" },
    { trackId: "opacity", instanceId: "inst-a" },
  ]);

  it("returns false when there is no active selection instance", () => {
    expect(
      shouldRowShowHandles(sourceRow, "track-selection", {
        instanceId: null,
        keypoints: new Map([["scale", new Set(["k0"])]]),
      }),
    ).toBe(false);
  });

  it("returns false when the row has no track on the selection instance", () => {
    expect(
      shouldRowShowHandles(sourceRow, "track-selection", {
        instanceId: "other-instance",
        keypoints: new Map([["scale", new Set(["k0"])]]),
      }),
    ).toBe(false);
  });

  it("returns false when no track in the row has selected keys", () => {
    expect(
      shouldRowShowHandles(sourceRow, "track-selection", {
        instanceId: "inst-a",
        keypoints: new Map([["unrelated", new Set(["k0"])]]),
      }),
    ).toBe(false);
  });

  it("track-selection: shows handles when any track on the row has selected keys", () => {
    expect(
      shouldRowShowHandles(sourceRow, "track-selection", {
        instanceId: "inst-a",
        keypoints: new Map([["scale", new Set(["k0"])]]),
      }),
    ).toBe(true);
  });

  it("single-track: shows handles only when exactly one track has selection globally", () => {
    const oneTrack = new Map([["scale", new Set(["k0"])]]);
    const twoTracks = new Map([
      ["scale", new Set(["k0"])],
      ["opacity", new Set(["k1"])],
    ]);

    expect(
      shouldRowShowHandles(sourceRow, "single-track", {
        instanceId: "inst-a",
        keypoints: oneTrack,
      }),
    ).toBe(true);
    expect(
      shouldRowShowHandles(sourceRow, "single-track", {
        instanceId: "inst-a",
        keypoints: twoTracks,
      }),
    ).toBe(false);
  });

  it("single-track: ignores tracks added to the selection map with no keys", () => {
    // toggleTrackInSelection / rangeSelectTracks add empty Set entries for tracks
    // toggled in without key-level selection. Those entries must not count toward
    // the single-track check.
    const oneTrackPlusEmpty = new Map([
      ["scale", new Set(["k0"])],
      ["opacity", new Set<string>()],
    ]);
    expect(
      shouldRowShowHandles(sourceRow, "single-track", {
        instanceId: "inst-a",
        keypoints: oneTrackPlusEmpty,
      }),
    ).toBe(true);
  });

  it("key-selection: row gating matches track-selection (per-handle filtering happens elsewhere)", () => {
    const sel = {
      instanceId: "inst-a",
      keypoints: new Map([["scale", new Set(["k0"])]]),
    };
    expect(shouldRowShowHandles(sourceRow, "key-selection", sel)).toBe(true);
  });

  it("ignores tracks present in the selection map with no keys (empty Set)", () => {
    expect(
      shouldRowShowHandles(sourceRow, "track-selection", {
        instanceId: "inst-a",
        keypoints: new Map([["scale", new Set<string>()]]),
      }),
    ).toBe(false);
  });
});

describe("filterHandlesByVisibility", () => {
  const handles = [
    handle("scale", "k0"),
    handle("scale", "k1"),
    handle("opacity", "k0"),
  ];

  it("returns the handle list unchanged for track-selection mode", () => {
    expect(
      filterHandlesByVisibility(handles, "track-selection", new Map([["scale", new Set(["k0"])]])),
    ).toBe(handles);
  });

  it("returns the handle list unchanged for single-track mode", () => {
    expect(
      filterHandlesByVisibility(handles, "single-track", new Map([["scale", new Set(["k0"])]])),
    ).toBe(handles);
  });

  it("key-selection: keeps only handles for individually selected keys on each track", () => {
    const filtered = filterHandlesByVisibility(
      handles,
      "key-selection",
      new Map([
        ["scale", new Set(["k0"])],
        ["opacity", new Set<string>()],
      ]),
    );
    expect(filtered.map((h) => `${h.trackId}/${h.keypointId}`)).toEqual(["scale/k0"]);
  });

  it("key-selection with empty selection returns no handles", () => {
    expect(filterHandlesByVisibility(handles, "key-selection", new Map())).toEqual([]);
  });

  it("returns input unchanged when handle list is empty", () => {
    const empty: RenderHandle[] = [];
    expect(filterHandlesByVisibility(empty, "key-selection", new Map())).toBe(empty);
  });
});
