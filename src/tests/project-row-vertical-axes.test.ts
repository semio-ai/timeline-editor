import { describe, expect, it } from "vitest";
import { projectRowVerticalAxes } from "../subscriptions/update-view-vertical-axes";
import { TrackRender, VerticalAxis, ComputedRowData } from "../types";

/** Minimal ComputedRowData stub with the given vertical bounds. */
function stubRow(min: number, max: number): ComputedRowData {
  return {
    virtualFrames: [],
    verticalBounds: { min, max },
    violationSet: { id: "", violations: {}, segments: [] },
  };
}

describe("projectRowVerticalAxes", () => {
  const viewId = "v1";

  it("produces finite axis range when row verticalBounds are non-finite", () => {
    const rowMap = { row1: stubRow(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY) };
    const editorViews = {
      [viewId]: { id: viewId, trackRender: TrackRender.Spline, verticalAxis: VerticalAxis.Normalized },
    };
    const sourceRowIds = { flat: ["row1"], spline: ["row1"] };

    const { rows } = projectRowVerticalAxes(rowMap, editorViews, sourceRowIds, {});
    const axis = rows.row1.verticalAxisByView?.[viewId];

    expect(axis).toBeDefined();
    expect(Number.isFinite(axis!.min)).toBe(true);
    expect(Number.isFinite(axis!.max)).toBe(true);
    expect(axis!.min).toBeLessThan(axis!.max);
  });

  it("produces finite axis range when row verticalBounds contain NaN", () => {
    const rowMap = { row1: stubRow(NaN, NaN) };
    const editorViews = {
      [viewId]: { id: viewId, trackRender: TrackRender.Spline, verticalAxis: VerticalAxis.Normalized },
    };
    const sourceRowIds = { flat: ["row1"], spline: ["row1"] };

    const { rows } = projectRowVerticalAxes(rowMap, editorViews, sourceRowIds, {});
    const axis = rows.row1.verticalAxisByView?.[viewId];

    expect(axis).toBeDefined();
    expect(Number.isFinite(axis!.min)).toBe(true);
    expect(Number.isFinite(axis!.max)).toBe(true);
  });

  it("expands degenerate (zero-span) bounds for spline views", () => {
    const rowMap = { row1: stubRow(50, 50) };
    const editorViews = {
      [viewId]: { id: viewId, trackRender: TrackRender.Spline, verticalAxis: VerticalAxis.Normalized },
    };
    const sourceRowIds = { flat: ["row1"], spline: ["row1"] };

    const { rows } = projectRowVerticalAxes(rowMap, editorViews, sourceRowIds, {});
    const axis = rows.row1.verticalAxisByView?.[viewId];

    expect(axis).toBeDefined();
    expect(axis!.min).toBeLessThan(50);
    expect(axis!.max).toBeGreaterThan(50);
  });

  it("expands degenerate bounds at zero to a finite range", () => {
    const rowMap = { row1: stubRow(0, 0) };
    const editorViews = {
      [viewId]: { id: viewId, trackRender: TrackRender.Spline, verticalAxis: VerticalAxis.Normalized },
    };
    const sourceRowIds = { flat: ["row1"], spline: ["row1"] };

    const { rows } = projectRowVerticalAxes(rowMap, editorViews, sourceRowIds, {});
    const axis = rows.row1.verticalAxisByView?.[viewId];

    expect(axis).toBeDefined();
    expect(axis!.min).toBeLessThan(0);
    expect(axis!.max).toBeGreaterThan(0);
  });

  it("passes through raw bounds without spline expansion for non-spline views", () => {
    const rowMap = { row1: stubRow(Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY) };
    const editorViews = {
      [viewId]: { id: viewId, trackRender: TrackRender.Key, verticalAxis: VerticalAxis.Normalized },
    };
    const sourceRowIds = { flat: ["row1"], spline: ["row1"] };

    const { rows } = projectRowVerticalAxes(rowMap, editorViews, sourceRowIds, {});
    // Non-spline views get axis projection, but without spline-specific expansion/padding
    // spline-specific expansion/padding — raw bounds pass through as-is.
    expect(rows.row1.verticalAxisByView?.[viewId]).toBeDefined();
    const axis = rows.row1.verticalAxisByView![viewId];
    expect(axis.min).toBe(Number.POSITIVE_INFINITY);
    expect(axis.max).toBe(Number.NEGATIVE_INFINITY);
  });
});
