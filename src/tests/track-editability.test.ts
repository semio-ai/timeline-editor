import { describe, expect, it } from "vitest";
import { getNonEditableTrackIds } from "../functions/track-editability";
import type { SourceRow } from "../types";

const row = (
  id: string,
  entries: { trackId: string; locked?: boolean; readonly?: boolean }[],
): SourceRow => ({
  id,
  data: entries.map((e) => ({
    trackId: e.trackId,
    instanceId: "inst",
    namespaceId: "ns",
    animationId: "anim",
    animatableId: e.trackId,
    type: "number",
    selectable: true,
    editable: !e.locked && !e.readonly,
    layerBand: 0 as unknown as SourceRow["data"][number]["layerBand"],
    muted: false,
    visible: true,
    locked: e.locked ?? false,
    readonly: e.readonly ?? false,
  })),
});

describe("getNonEditableTrackIds", () => {
  it("returns three empty sets when no rows are non-editable", () => {
    const result = getNonEditableTrackIds({
      r1: row("r1", [{ trackId: "a" }, { trackId: "b" }]),
    });
    expect(result.lockedIds.size).toBe(0);
    expect(result.readonlyIds.size).toBe(0);
    expect(result.nonEditableIds.size).toBe(0);
  });

  it("partitions locked vs readonly into distinct sets, with the union in nonEditableIds", () => {
    const result = getNonEditableTrackIds({
      r1: row("r1", [
        { trackId: "user-locked", locked: true },
        { trackId: "doc-locked", readonly: true },
        { trackId: "writable" },
      ]),
    });
    expect(Array.from(result.lockedIds)).toEqual(["user-locked"]);
    expect(Array.from(result.readonlyIds)).toEqual(["doc-locked"]);
    expect(new Set(result.nonEditableIds)).toEqual(new Set(["user-locked", "doc-locked"]));
  });

  it("treats both flags on the same track as non-editable from both reasons", () => {
    const result = getNonEditableTrackIds({
      r1: row("r1", [{ trackId: "both", locked: true, readonly: true }]),
    });
    expect(result.lockedIds.has("both")).toBe(true);
    expect(result.readonlyIds.has("both")).toBe(true);
    expect(result.nonEditableIds.has("both")).toBe(true);
    expect(result.nonEditableIds.size).toBe(1);
  });

  it("dedupes across multiple rows referencing the same trackId", () => {
    const result = getNonEditableTrackIds({
      r1: row("r1", [{ trackId: "shared", locked: true }]),
      r2: row("r2", [{ trackId: "shared", locked: true }]),
    });
    expect(result.lockedIds.size).toBe(1);
    expect(result.nonEditableIds.size).toBe(1);
  });
});
