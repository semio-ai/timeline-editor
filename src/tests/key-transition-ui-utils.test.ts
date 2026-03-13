import { describe, expect, it } from "vitest";
import { TransitionDirective } from "../store-types";
import { StandardTransitionType, TransitionPairing } from "../types";
import {
  resolveDefaultPairingForTransitions,
  resolveNextSelectionTransitions,
  resolvePairingForContext,
  type SelectedKeyContext,
} from "../functions/key-transition-ui-utils";
import type { SimpleKeypoint } from "../types/data/simple-track";

function makePoint(id: string, stamp: number, value: number): SimpleKeypoint {
  return { id, stamp, value };
}

function makeContext(points: SimpleKeypoint[], pointIndex: number): SelectedKeyContext {
  return {
    trackId: "track-1",
    point: points[pointIndex],
    sortedTrackPoints: points,
    pointIndex,
  };
}

describe("key-transition-ui-utils", () => {
  it("resolves pairing from transition types", () => {
    expect(
      resolveDefaultPairingForTransitions(
        StandardTransitionType.Cubic,
        StandardTransitionType.Cubic,
      ),
    ).toBe(TransitionPairing.Paired);
    expect(
      resolveDefaultPairingForTransitions(
        StandardTransitionType.Cubic,
        StandardTransitionType.Linear,
      ),
    ).toBe(TransitionPairing.Free);
    expect(resolveDefaultPairingForTransitions({ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 })).toBe(
      TransitionPairing.Paired,
    );
  });

  it("prefers explicit pairing on a keypoint and otherwise uses transition matching", () => {
    const points = [makePoint("a", 0, 0), makePoint("b", 0.5, 1), makePoint("c", 1, 0)];
    const withExplicit = makeContext(
      [
        points[0],
        {
          ...points[1],
          transitions: {
            in: StandardTransitionType.Cubic,
            out: StandardTransitionType.Linear,
            pairing: TransitionPairing.Paired,
          },
        },
        points[2],
      ],
      1,
    );
    expect(resolvePairingForContext(withExplicit)).toBe(TransitionPairing.Paired);

    const inferred = makeContext(
      [
        points[0],
        {
          ...points[1],
          transitions: {
            in: StandardTransitionType.Cubic,
            out: StandardTransitionType.Linear,
          },
        },
        points[2],
      ],
      1,
    );
    expect(resolvePairingForContext(inferred)).toBe(TransitionPairing.Free);
  });

  it("skips non-existent sides and auto-updates pairing for pairable keys", () => {
    const edgePoints = [makePoint("a", 0, 0), makePoint("b", 1, 1)];
    const edgeContext = makeContext(edgePoints, 0);
    const edgeResult = resolveNextSelectionTransitions(edgeContext, {
      in: StandardTransitionType.Linear,
    });
    expect(edgeResult.in).toBeUndefined();

    const middlePoints = [makePoint("a", 0, 0), makePoint("b", 0.5, 1), makePoint("c", 1, 0)];
    const middleContext = makeContext(middlePoints, 1);
    const mixedResult = resolveNextSelectionTransitions(middleContext, {
      in: StandardTransitionType.Linear,
      out: StandardTransitionType.Cubic,
    });
    expect(mixedResult.in).toBe(StandardTransitionType.Linear);
    expect(mixedResult.out).toBe(StandardTransitionType.Cubic);
    expect(mixedResult.pairing).toBe(TransitionPairing.Free);

    const matchedResult = resolveNextSelectionTransitions(middleContext, {
      in: StandardTransitionType.Cubic,
      out: StandardTransitionType.Cubic,
    });
    expect(matchedResult.pairing).toBe(TransitionPairing.Paired);
  });

  it("converts explicit-handle directives from segment-effective transitions", () => {
    const points = [makePoint("a", 0, 0), makePoint("b", 0.5, 1), makePoint("c", 1, 0)];
    const context = makeContext(
      [
        points[0],
        {
          ...points[1],
          transitions: {
            out: TransitionDirective.InferredAutoClamped,
          },
        },
        points[2],
      ],
      1,
    );
    const result = resolveNextSelectionTransitions(context, {
      out: TransitionDirective.ExplicitHandles,
    });

    expect(typeof result.out).toBe("object");
    expect((result.out as { x: number }).x).toBeGreaterThan(0);
    expect((result.out as { x: number; y: number }).y).toBeLessThanOrEqual(0);
  });

  it("keeps existing explicit handle deltas when reselecting explicit-handles", () => {
    const points = [makePoint("a", 0, 0), makePoint("b", 0.5, 1), makePoint("c", 1, 0)];
    const context = makeContext(
      [
        points[0],
        {
          ...points[1],
          transitions: {
            in: { x: -0.2, y: 0.1 },
            out: { x: 0.25, y: -0.15 },
            pairing: TransitionPairing.Free,
          },
        },
        points[2],
      ],
      1,
    );

    const result = resolveNextSelectionTransitions(context, {
      in: TransitionDirective.ExplicitHandles,
      out: TransitionDirective.ExplicitHandles,
    });

    expect(result.in).toEqual({ x: -0.2, y: 0.1 });
    expect(result.out).toEqual({ x: 0.25, y: -0.15 });
    expect(result.pairing).toBe(TransitionPairing.Paired);
  });

  it("falls back to inferred auto-handle deltas when converting to explicit without rendered handles", () => {
    const points = [makePoint("a", 0, 0), makePoint("b", 0.4, 1), makePoint("c", 1, 0.5)];
    const context = makeContext(
      [
        points[0],
        {
          ...points[1],
          transitions: {
            in: TransitionDirective.InferredAutoClamped,
            out: TransitionDirective.InferredAutoClamped,
          },
        },
        points[2],
      ],
      1,
    );

    const result = resolveNextSelectionTransitions(context, {
      in: TransitionDirective.ExplicitHandles,
      out: TransitionDirective.ExplicitHandles,
    });

    expect(typeof result.in).toBe("object");
    expect(typeof result.out).toBe("object");
    expect(result.in).not.toBeNull();
    expect(result.out).not.toBeNull();
    expect(result.pairing).toBe(TransitionPairing.Paired);
  });

  it("switches explicit handles to standard/auto directives without preserving vector payloads", () => {
    const points = [makePoint("a", 0, 0), makePoint("b", 0.5, 1), makePoint("c", 1, 0)];
    const context = makeContext(
      [
        points[0],
        {
          ...points[1],
          transitions: {
            in: { x: -0.2, y: 0.1 },
            out: { x: 0.25, y: -0.15 },
            pairing: TransitionPairing.Paired,
          },
        },
        points[2],
      ],
      1,
    );

    const standardResult = resolveNextSelectionTransitions(context, {
      in: StandardTransitionType.Linear,
      out: StandardTransitionType.Cubic,
    });
    expect(standardResult.in).toBe(StandardTransitionType.Linear);
    expect(standardResult.out).toBe(StandardTransitionType.Cubic);
    expect(standardResult.pairing).toBe(TransitionPairing.Free);

    const autoResult = resolveNextSelectionTransitions(context, {
      in: TransitionDirective.InferredAutoClamped,
      out: TransitionDirective.InferredAutoClamped,
    });
    expect(autoResult.in).toBe(TransitionDirective.InferredAutoClamped);
    expect(autoResult.out).toBe(TransitionDirective.InferredAutoClamped);
    expect(autoResult.pairing).toBe(TransitionPairing.Paired);
  });

  it("honors explicit pairing patches over inferred pairing behavior", () => {
    const points = [makePoint("a", 0, 0), makePoint("b", 0.5, 1), makePoint("c", 1, 0)];
    const context = makeContext(points, 1);

    const result = resolveNextSelectionTransitions(context, {
      in: StandardTransitionType.Linear,
      out: StandardTransitionType.Cubic,
      pairing: TransitionPairing.Paired,
    });

    expect(result.in).toBe(StandardTransitionType.Linear);
    expect(result.out).toBe(StandardTransitionType.Cubic);
    expect(result.pairing).toBe(TransitionPairing.Paired);
  });

  it("falls back to deterministic segment-effective deltas when rendered handles are unavailable", () => {
    const points: SimpleKeypoint[] = [
      {
        id: "5e5f4065-9720-41d3-b8da-2a0cead68be1",
        stamp: 0.08333333333333333,
        value: 0.8599285654203119,
        transitions: { out: StandardTransitionType.Cubic },
      },
      {
        id: "2ae734b3-5f82-43fe-a813-5596c7079a31",
        stamp: 0.4166666666666667,
        value: 2.958335227172671,
        transitions: {
          pairing: TransitionPairing.Paired,
          in: TransitionDirective.InferredAutoClamped,
          out: TransitionDirective.InferredAutoClamped,
        },
      },
      {
        id: "430fbfe9-e91a-480c-82f0-d61948a22dda",
        stamp: 0.7583333333333333,
        value: 5.209633191836777,
        transitions: { in: StandardTransitionType.Cubic },
      },
    ];

    const context = makeContext(points, 1);
    const result = resolveNextSelectionTransitions(context, {
      in: TransitionDirective.ExplicitHandles,
      out: TransitionDirective.ExplicitHandles,
    });

    const incoming = result.in as { x: number; y: number };
    const outgoing = result.out as { x: number; y: number };

    expect(incoming.x).toBeCloseTo(-0.1273020372478716, 8);
    expect(incoming.y).toBeCloseTo(-0.819687414386983, 8);
    expect(outgoing.x).toBeCloseTo(0.13643065634710644, 8);
    expect(Number.isFinite(outgoing.y)).toBe(true);
  });
});
