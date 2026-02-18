import { describe, expect, it, vi } from "vitest";
import { LayerBand, type SourceRow } from "../types";
import {
  filterVisibleSourceRowIds,
  matchesSourceRowQuery,
  normalizeVisibleSourceRowIds,
} from "../functions/filter-visible-source-row-ids";

describe("normalizeVisibleSourceRowIds", () => {
  it("returns an empty lookup when rows are missing", () => {
    expect(normalizeVisibleSourceRowIds(undefined)).toEqual({ flat: [], spline: [] });
  });

  it("normalizes a legacy array into flat/spline lookups", () => {
    const rows = ["a", "b"];
    expect(normalizeVisibleSourceRowIds(rows)).toEqual({ flat: rows, spline: rows });
  });
});

describe("filterVisibleSourceRowIds", () => {
  const sourceRowIds = {
    flat: ["group", "track-a", "track-b"],
    spline: ["track-a", "track-b"],
  };

  it("returns the original lookup when query is empty", () => {
    const matcher = vi.fn(() => true);
    const result = filterVisibleSourceRowIds(sourceRowIds, "   ", matcher);
    expect(result).toBe(sourceRowIds);
    expect(matcher).not.toHaveBeenCalled();
  });

  it("filters flat and spline rows using one cached match pass per row id", () => {
    const matcher = vi.fn((rowId: string, query: string) => {
      expect(query).toBe("track");
      return rowId.includes("track");
    });

    const result = filterVisibleSourceRowIds(sourceRowIds, " Track ", matcher);

    expect(result).toEqual({
      flat: ["track-a", "track-b"],
      spline: ["track-a", "track-b"],
    });

    expect(matcher).toHaveBeenCalledTimes(3);
    expect(matcher).toHaveBeenCalledWith("group", "track");
    expect(matcher).toHaveBeenCalledWith("track-a", "track");
    expect(matcher).toHaveBeenCalledWith("track-b", "track");
  });
});

describe("matchesSourceRowQuery", () => {
  it("matches by row name, track id, and animatable name", () => {
    const lookups = {
      sourceRows: {
        rowA: {
          id: "rowA",
          name: "Left Wheel",
          data: [
            {
              animationId: "anim",
              namespaceId: "ns",
              instanceId: "inst",
              trackId: "left_wheel_joint",
              animatableId: "left-wheel",
              editable: true,
              selectable: true,
              layerBand: LayerBand.ForegroundUnselected,
              type: "number" as const,
            },
          ],
        } as SourceRow,
      },
      tracks: {
        left_wheel_joint: { name: "Left Wheel Joint" },
      },
      animatables: {
        "left-wheel": { name: "Wheel Motor" },
      },
    };

    expect(matchesSourceRowQuery("rowA", "left", lookups)).toBe(true);
    expect(matchesSourceRowQuery("rowA", "wheel motor", lookups)).toBe(true);
    expect(matchesSourceRowQuery("rowA", "wheel", lookups)).toBe(true);
    expect(matchesSourceRowQuery("rowA", "missing", lookups)).toBe(false);
  });
});
