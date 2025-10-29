import { describe, it, expect } from "vitest";
import { AnimatableValue, RawValue } from "@semio/utils";
import {
  LayerBand,
  SourceRow,
  Track,
  Violation,
  ViolationType,
  ViolationSet,
} from "../types";
import { computeRowData } from "../functions/compute-row-data";
import { createEmptySelectionState } from "../functions/selection-state-manager";

const TRACK_ID = "position";
const ANIMATABLE_ID = "position";
const ANIMATION_ID = "shared-animation";
const NAMESPACE_ALPHA = "namespace-alpha";
const NAMESPACE_BETA = "namespace-beta";
const INSTANCE_ALPHA = "alpha-shared-instance";
const INSTANCE_BETA = "beta-shared-instance";

function makeViolation(
  id: string,
  namespaceId: string,
  instanceId: string,
  range: { start: number; end: number },
): Violation {
  return {
    id,
    trackId: TRACK_ID,
    namespace: namespaceId,
    instanceId,
    stampRange: range,
    type: ViolationType.Upper,
  };
}

const tracks: Record<string, Track<RawValue>> = {
  [TRACK_ID]: {
    id: TRACK_ID,
    name: "Position",
    animatableId: ANIMATABLE_ID,
    points: [
      { id: "p0", stamp: 0, value: 0 },
      { id: "p1", stamp: 0.5, value: 5 },
      { id: "p2", stamp: 1, value: 10 },
    ],
  },
};

const animatables: Record<string, AnimatableValue> = {
  [ANIMATABLE_ID]: {
    id: ANIMATABLE_ID,
    name: "Position",
    type: "number",
    default: 0,
    constraints: { min: -50, max: 50 },
    pub: { public: true, output: "transform.position", units: "m", color: "#ffffff" },
  },
};

const violations: Record<string, Violation[]> = {
  [TRACK_ID]: [
    makeViolation("alpha-upper", NAMESPACE_ALPHA, INSTANCE_ALPHA, { start: 0.1, end: 0.4 }),
    makeViolation("alpha-lower", NAMESPACE_ALPHA, INSTANCE_ALPHA, { start: 0.3, end: 0.6 }),
    makeViolation("beta-upper", NAMESPACE_BETA, INSTANCE_BETA, { start: 0.2, end: 0.5 }),
    makeViolation("beta-lower", NAMESPACE_BETA, INSTANCE_BETA, { start: 0.45, end: 0.8 }),
  ],
};

function makeRow(namespaceId: string, instanceId: string): SourceRow {
  return {
    id: `${namespaceId}/${instanceId}/${TRACK_ID}`,
    data: [
      {
        selectable: true,
        editable: true,
        layerBand: LayerBand.ForegroundSelected,
        animationId: ANIMATION_ID,
        namespaceId,
        instanceId,
        type: "number",
        trackId: TRACK_ID,
        animatableId: ANIMATABLE_ID,
      },
    ],
  };
}

function collectSegmentViolationIds(violationSet: ViolationSet): string[] {
  return Array.from(
    new Set(violationSet.segments.flatMap((segment) => segment.violations)),
  ).sort();
}

describe("computeRowData violation scoping", () => {
  it("keeps violations scoped to the row's namespace and instance", () => {
    const alphaRow = makeRow(NAMESPACE_ALPHA, INSTANCE_ALPHA);
    const betaRow = makeRow(NAMESPACE_BETA, INSTANCE_BETA);

    const selection = createEmptySelectionState();
    const alphaData = computeRowData(alphaRow, tracks, violations, animatables, undefined, selection);
    const betaData = computeRowData(betaRow, tracks, violations, animatables, undefined, selection);

    expect(Object.keys(alphaData.violationSet.violations).sort()).toEqual([
      "alpha-lower",
      "alpha-upper",
    ]);
    expect(Object.keys(betaData.violationSet.violations).sort()).toEqual([
      "beta-lower",
      "beta-upper",
    ]);

    expect(collectSegmentViolationIds(alphaData.violationSet)).toEqual([
      "alpha-lower",
      "alpha-upper",
    ]);
    expect(collectSegmentViolationIds(betaData.violationSet)).toEqual([
      "beta-lower",
      "beta-upper",
    ]);
  });
});
