import { describe, expect, test } from "vitest";
import { computeTransitionParams } from "../functions/compute-transition-params";
import { TrackRender, type InstancedFrameInfo, type SourceRow } from "../types";

const baseRowData: SourceRow["data"][number] = {
  foreground: true,
  editable: true,
  selectable: true,
  animationId: "anim",
  namespaceId: "namespace",
  instanceId: "instance",
  type: "number",
  trackId: "track",
  animatableId: "animatable",
};

const sourceRow: SourceRow = {
  id: "row",
  expanded: true,
  data: [baseRowData],
};

describe("computeTransitionParams real-space conversion", () => {
  test("returns start/end/control points in real value space for preview renders", () => {
    const start: InstancedFrameInfo = {
      id: "start",
      stamp: 0,
      points: [{ ...baseRowData, id: "point:start", value: 10 }],
      transitions: {
        out: { x: 0.25, y: 0.15 },
      },
    };

    const end: InstancedFrameInfo = {
      id: "end",
      stamp: 1,
      points: [{ ...baseRowData, id: "point:end", value: 20 }],
      transitions: {
        in: { x: 0.75, y: 0.85 },
      },
    };

    const params = computeTransitionParams(
      sourceRow,
      start,
      end,
      false,
      TrackRender.Preview,
      { min: 0, max: 20 },
    );

    expect(params.start).toEqual({ x: 0, y: 10 });
    expect(params.end).toEqual({ x: 1, y: 20 });
    expect(params.cp1.x).toBeCloseTo(0.25);
    expect(params.cp1.y).toBeCloseTo(11.5);
    expect(params.cp2.x).toBeCloseTo(0.75);
    expect(params.cp2.y).toBeCloseTo(18.5);
  });

  test("defaults to start/end values when transitions are omitted", () => {
    const start: InstancedFrameInfo = {
      id: "start",
      stamp: 0.1,
      points: [{ ...baseRowData, id: "point:start", value: -5 }],
    };

    const end: InstancedFrameInfo = {
      id: "end",
      stamp: 0.9,
      points: [{ ...baseRowData, id: "point:end", value: 5 }],
    };

    const params = computeTransitionParams(
      sourceRow,
      start,
      end,
      false,
      TrackRender.Spline,
      { min: -10, max: 10 },
    );

    expect(params.start).toEqual({ x: 0.1, y: -5 });
    expect(params.end).toEqual({ x: 0.9, y: 5 });
    expect(params.cp1.x).toBeCloseTo(0.1 + (0.9 - 0.1) * 0.65);
    expect(params.cp1.y).toBeCloseTo(-5); // default out.y is 0
    expect(params.cp2.x).toBeCloseTo(0.1 + (0.9 - 0.1) * 0.35);
    expect(params.cp2.y).toBeCloseTo(5); // default in.y is 1
  });
});
