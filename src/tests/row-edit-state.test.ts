import { describe, expect, it } from "vitest";
import {
  computeRowEditPredicates,
  computeRowLayer,
  type RowEditInputs,
} from "../functions/row-edit-state";

const TED = "ted";
const LARRY = "larry";
const TED_QF = "ted-quori-farewell";
const TED_QG = "ted-quori-greet";
const LARRY_QF = "larry-quori-farewell";

const baseInputs = (): RowEditInputs => ({
  owningEntityId: TED,
  rowInstanceId: TED_QF,
  trackIds: ["neck_joint"],
  nonEditable: false,
  activeEntityId: TED,
  entityStates: {
    [TED]: { controlMode: "animation", activeInstanceId: TED_QF },
    [LARRY]: { controlMode: "animation", activeInstanceId: LARRY_QF },
  },
  selectionInstanceId: TED_QF,
  selectedKeypoints: new Map(),
});

describe("computeRowEditPredicates", () => {
  describe("isActiveDriverForOwningEntity", () => {
    it("true when row's instance == owning entity's active instance", () => {
      const p = computeRowEditPredicates(baseInputs());
      expect(p.isActiveDriverForOwningEntity).toBe(true);
    });

    it("false when row's instance differs from owning entity's active instance", () => {
      const p = computeRowEditPredicates({ ...baseInputs(), rowInstanceId: TED_QG });
      expect(p.isActiveDriverForOwningEntity).toBe(false);
    });

    it("false when entity has no active instance (direct mode / null)", () => {
      const p = computeRowEditPredicates({
        ...baseInputs(),
        entityStates: {
          [TED]: { controlMode: "direct", activeInstanceId: null },
          [LARRY]: { controlMode: "animation", activeInstanceId: LARRY_QF },
        },
      });
      expect(p.isActiveDriverForOwningEntity).toBe(false);
    });

    it("works for non-focused entities (any entity's active = true)", () => {
      const p = computeRowEditPredicates({
        ...baseInputs(),
        owningEntityId: LARRY,
        rowInstanceId: LARRY_QF,
        // Focused entity is still TED; LARRY is non-focused.
      });
      expect(p.isActiveDriverForOwningEntity).toBe(true);
    });
  });

  describe("isFocusedEntity", () => {
    it("true when row's owning entity == activeEntityId", () => {
      const p = computeRowEditPredicates(baseInputs());
      expect(p.isFocusedEntity).toBe(true);
    });

    it("false when row's owning entity differs from activeEntityId", () => {
      const p = computeRowEditPredicates({
        ...baseInputs(),
        owningEntityId: LARRY,
        rowInstanceId: LARRY_QF,
      });
      expect(p.isFocusedEntity).toBe(false);
    });
  });

  describe("isCurrentlyEdited (the actually-editable predicate)", () => {
    it("true when focused entity AND active driver AND not locked", () => {
      const p = computeRowEditPredicates(baseInputs());
      expect(p.isCurrentlyEdited).toBe(true);
    });

    it("false when not focused entity (other entity's active animation)", () => {
      const p = computeRowEditPredicates({
        ...baseInputs(),
        owningEntityId: LARRY,
        rowInstanceId: LARRY_QF,
      });
      // Larry's active driver is foreground, but Larry is non-focused;
      // it's locked, not editable.
      expect(p.isCurrentlyEdited).toBe(false);
      expect(p.isActiveDriverForOwningEntity).toBe(true);
    });

    it("false when locked / readonly", () => {
      const p = computeRowEditPredicates({ ...baseInputs(), nonEditable: true });
      expect(p.isCurrentlyEdited).toBe(false);
    });

    it("false when row is non-active instance of focused entity", () => {
      const p = computeRowEditPredicates({ ...baseInputs(), rowInstanceId: TED_QG });
      expect(p.isCurrentlyEdited).toBe(false);
    });
  });

  describe("isInSelection / hasSelectedKeys (cross-entity bleed prevention)", () => {
    it("isInSelection true when row's instance matches scope AND trackId in map", () => {
      const p = computeRowEditPredicates({
        ...baseInputs(),
        selectedKeypoints: new Map([["neck_joint", new Set<string>()]]),
      });
      expect(p.isInSelection).toBe(true);
    });

    it("isInSelection false when row's instance is OUT of scope (other entity's same trackId)", () => {
      // Critical regression: selecting in Ted's QF must not light up
      // Larry's QF row that shares the trackId.
      const p = computeRowEditPredicates({
        ...baseInputs(),
        owningEntityId: LARRY,
        rowInstanceId: LARRY_QF,
        // Selection is still on Ted's instance.
        selectedKeypoints: new Map([["neck_joint", new Set<string>()]]),
      });
      expect(p.isInSelection).toBe(false);
    });

    it("hasSelectedKeys true only when keypoints set is non-empty", () => {
      const empty = computeRowEditPredicates({
        ...baseInputs(),
        selectedKeypoints: new Map([["neck_joint", new Set<string>()]]),
      });
      expect(empty.hasSelectedKeys).toBe(false);

      const populated = computeRowEditPredicates({
        ...baseInputs(),
        selectedKeypoints: new Map([["neck_joint", new Set(["k1"])]]),
      });
      expect(populated.hasSelectedKeys).toBe(true);
    });

    it("hasSelectedKeys is also gated by scope", () => {
      const p = computeRowEditPredicates({
        ...baseInputs(),
        owningEntityId: LARRY,
        rowInstanceId: LARRY_QF,
        selectedKeypoints: new Map([["neck_joint", new Set(["k1"])]]),
      });
      expect(p.hasSelectedKeys).toBe(false);
    });
  });
});

describe("computeRowLayer", () => {
  it("'editable' when isCurrentlyEdited", () => {
    expect(computeRowLayer(computeRowEditPredicates(baseInputs()))).toBe("editable");
  });

  it("'locked' when active driver but not currently edited (other entity's active)", () => {
    const p = computeRowEditPredicates({
      ...baseInputs(),
      owningEntityId: LARRY,
      rowInstanceId: LARRY_QF,
    });
    expect(computeRowLayer(p)).toBe("locked");
  });

  it("'locked' when focused entity's active but locked", () => {
    const p = computeRowEditPredicates({ ...baseInputs(), nonEditable: true });
    expect(computeRowLayer(p)).toBe("locked");
  });

  it("'background' when not active driver of any entity", () => {
    const p = computeRowEditPredicates({ ...baseInputs(), rowInstanceId: TED_QG });
    expect(computeRowLayer(p)).toBe("background");
  });
});
