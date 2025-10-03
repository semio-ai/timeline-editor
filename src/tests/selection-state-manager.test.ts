import { describe, it, expect } from "vitest";
import {
  parseMarkerPath,
  createMarkerPath,
  updateSelectionState,
  createEmptySelectionState,
  isMarkerSelected,
  getRowSelectionState,
  isRowFullySelected,
  isRowPartiallySelected,
  getSelectedMarkersInRow,
  filterSelectionByInstance,
  classifyEntity,
  isGroupRow,
  getSelectionUnit,
  getRangeSelection,
  addToSelection,
  removeFromSelection,
  toggleInSelection,
  clearSelection,
  selectAllInInstance,
  invertSelectionInInstance,
  isUnitFullySelected,
  isUnitPartiallySelected,
} from "../functions/selection-state-manager";
import { EntityType } from "../types/util/selection-state";
import type { AnimationData } from "../store-types";
import { TimeDisplay } from "@semio/ui";
import {
  createTestAnimationStore,
  getMarkerPaths,
  NAMESPACE_IDS,
  INSTANCE_IDS,
  TRACK_IDS,
} from "../test-fixtures";

/**
 * Create a mock AnimationData state with realistic structure
 */
function createMockAnimationState(): AnimationData {
  return {
    // Basic structure required by selection functions
    computedRowData: {
      "namespace-alpha/instance-alpha-shared/shared-track-position-x": {
        virtualFrames: [
          { id: "m0", stamp: 0, points: [] },
          { id: "m1", stamp: 250, points: [] },
          { id: "m2", stamp: 500, points: [] },
          { id: "m3", stamp: 750, points: [] },
          { id: "m4", stamp: 1000, points: [] },
        ],
      },
      "namespace-alpha/instance-alpha-shared/shared-track-position-y": {
        virtualFrames: [
          { id: "m0", stamp: 0, points: [] },
          { id: "m1", stamp: 330, points: [] },
          { id: "m2", stamp: 670, points: [] },
          { id: "m3", stamp: 1000, points: [] },
        ],
      },
      "namespace-alpha/instance-alpha-shared/shared-track-position-z": {
        virtualFrames: [
          { id: "m0", stamp: 0, points: [] },
          { id: "m1", stamp: 500, points: [] },
          { id: "m2", stamp: 1000, points: [] },
        ],
      },
      "namespace-alpha/instance-alpha-shared/position": {
        virtualFrames: [
          {
            id: "group-m0",
            stamp: 0,
            points: [
              { id: "m0", attribute: "x" },
              { id: "m0", attribute: "y" },
              { id: "m0", attribute: "z" },
            ],
          },
          {
            id: "group-m1",
            stamp: 500,
            points: [
              { id: "m2", attribute: "x" },
              { id: "m1", attribute: "z" },
            ],
          },
        ],
      },
      "namespace-alpha/instance-alpha-shared/scale": {
        virtualFrames: [
          { id: "s0", stamp: 200, points: [] },
          { id: "s1", stamp: 400, points: [] },
          { id: "s2", stamp: 600, points: [] },
          { id: "s3", stamp: 800, points: [] },
        ],
      },
    },
    instancedTrackSources: {
      "namespace-alpha/instance-alpha-shared/position": {
        id: "namespace-alpha/instance-alpha-shared/position",
        data: [
          {
            foreground: true,
            editable: true,
            selectable: true,
            animationId: "shared-animation",
            namespaceId: "namespace-alpha",
            instanceId: "instance-alpha-shared",
            type: "vector3" as const,
            trackId: "position",
            animatableId: "shared-obj",
            attribute: "x",
          },
          {
            foreground: true,
            editable: true,
            selectable: true,
            animationId: "shared-animation",
            namespaceId: "namespace-alpha",
            instanceId: "instance-alpha-shared",
            type: "vector3" as const,
            trackId: "position",
            animatableId: "shared-obj",
            attribute: "y",
          },
          {
            foreground: true,
            editable: true,
            selectable: true,
            animationId: "shared-animation",
            namespaceId: "namespace-alpha",
            instanceId: "instance-alpha-shared",
            type: "vector3" as const,
            trackId: "position",
            animatableId: "shared-obj",
            attribute: "z",
          },
        ],
        expanded: true,
      },
      "namespace-alpha/instance-alpha-shared/shared-track-position-x": {
        id: "namespace-alpha/instance-alpha-shared/shared-track-position-x",
        data: [
          {
            foreground: true,
            editable: true,
            selectable: true,
            animationId: "shared-animation",
            namespaceId: "namespace-alpha",
            instanceId: "instance-alpha-shared",
            type: "number" as const,
            trackId: "shared-track-position-x",
            animatableId: "position",
            attribute: "x",
          },
        ],
        expanded: true,
      },
      "namespace-alpha/instance-alpha-shared/shared-track-position-y": {
        id: "namespace-alpha/instance-alpha-shared/shared-track-position-y",
        data: [
          {
            foreground: true,
            editable: true,
            selectable: true,
            animationId: "shared-animation",
            namespaceId: "namespace-alpha",
            instanceId: "instance-alpha-shared",
            type: "number" as const,
            trackId: "shared-track-position-y",
            animatableId: "position",
            attribute: "y",
          },
        ],
        expanded: true,
      },
      "namespace-alpha/instance-alpha-shared/shared-track-position-z": {
        id: "namespace-alpha/instance-alpha-shared/shared-track-position-z",
        data: [
          {
            foreground: true,
            editable: true,
            selectable: true,
            animationId: "shared-animation",
            namespaceId: "namespace-alpha",
            instanceId: "instance-alpha-shared",
            type: "number" as const,
            trackId: "shared-track-position-z",
            animatableId: "position",
            attribute: "z",
          },
        ],
        expanded: true,
      },
      "namespace-alpha/instance-alpha-shared/scale": {
        id: "namespace-alpha/instance-alpha-shared/scale",
        data: [
          {
            foreground: true,
            editable: true,
            selectable: true,
            animationId: "shared-animation",
            namespaceId: "namespace-alpha",
            instanceId: "instance-alpha-shared",
            type: "number" as const,
            trackId: "scale",
            animatableId: "scale",
          },
        ],
        expanded: true,
      },
    },
    sourceRowIds: [
      "namespace-alpha/instance-alpha-shared/position",
      "namespace-alpha/instance-alpha-shared/shared-track-position-x",
      "namespace-alpha/instance-alpha-shared/shared-track-position-y",
      "namespace-alpha/instance-alpha-shared/shared-track-position-z",
      "namespace-alpha/instance-alpha-shared/scale",
    ],
    selectionState: createEmptySelectionState(),

    // Other required properties
    values: new Map(),
    velocities: new Map(),
    trackInterpolators: {},
    namespaces: {},
    animations: {},
    tracks: {},
    duration: 2000,
    framerate: 30,
    expanded: true,
    timeDisplay: TimeDisplay.Frames,
    previews: [],
    selection: [],
    referenceMarker: null,
    preferences: {
      hoverDashedLine: true,
      dataPreviews: true,
    },
    trackSubscribers: [],
    animationSubscribers: [],
    violations: {},
    animatables: {},
    dragState: null,
    editorViews: {},
    activeAnimationInstance: "instance-alpha-shared",
    sourcesByAnimationInstance: {
      "instance-alpha-shared": [
        "namespace-alpha/instance-alpha-shared/position",
        "namespace-alpha/instance-alpha-shared/shared-track-position-x",
        "namespace-alpha/instance-alpha-shared/shared-track-position-y",
        "namespace-alpha/instance-alpha-shared/shared-track-position-z",
        "namespace-alpha/instance-alpha-shared/scale",
      ],
    },
  } as unknown as AnimationData;
}

describe("Selection State Manager", () => {
  const mockState = createMockAnimationState();

  describe("parseMarkerPath", () => {
    it("should parse valid marker paths with namespace", () => {
      const result = parseMarkerPath(
        "namespace-alpha/instance-alpha-shared/shared-track-position-x#m0",
      );
      expect(result.sourceRowId).toBe(
        "namespace-alpha/instance-alpha-shared/shared-track-position-x",
      );
      expect(result.markerId).toBe("m0");
      expect(result.instanceId).toBe("instance-alpha-shared");
    });

    it("should parse paths without namespace", () => {
      const result = parseMarkerPath("instance-alpha-shared/shared-track-position-x#m0");
      expect(result.sourceRowId).toBe("instance-alpha-shared/shared-track-position-x");
      expect(result.markerId).toBe("m0");
      expect(result.instanceId).toBe("shared-track-position-x"); // Second segment when no namespace
    });

    it("should throw error for invalid paths", () => {
      expect(() => parseMarkerPath("invalid")).toThrow();
      expect(() => parseMarkerPath("")).toThrow();
      expect(() => parseMarkerPath("missing#")).toThrow();
      expect(() => parseMarkerPath("#marker")).toThrow();
    });
  });

  describe("createMarkerPath", () => {
    it("should create valid marker paths", () => {
      const path = createMarkerPath(
        "namespace-alpha/instance-alpha-shared/shared-track-position-x",
        "m2",
      );
      expect(path).toBe("namespace-alpha/instance-alpha-shared/shared-track-position-x#m2");
    });
  });

  describe("createEmptySelectionState", () => {
    it("should create an empty selection state", () => {
      const state = createEmptySelectionState();
      expect(state.paths).toEqual([]);
      expect(state.pathSet.size).toBe(0);
      expect(state.rowStates.size).toBe(0);
      expect(state.markerInfo.size).toBe(0);
      expect(state.referenceMarker).toBeNull();
    });
  });

  describe("updateSelectionState", () => {
    it("should update selection with new paths", () => {
      const paths = [
        "namespace-alpha/instance-alpha-shared/shared-track-position-x#m0",
        "namespace-alpha/instance-alpha-shared/shared-track-position-x#m1",
      ];
      const updated = updateSelectionState(mockState, paths);

      expect(updated.paths).toEqual(paths);
      expect(updated.pathSet.has(paths[0])).toBe(true);
      expect(updated.pathSet.has(paths[1])).toBe(true);
    });

    it("should update row states correctly", () => {
      const sourceRowId = "namespace-alpha/instance-alpha-shared/shared-track-position-x";
      const paths = [`${sourceRowId}#m0`, `${sourceRowId}#m1`, `${sourceRowId}#m2`];
      const updated = updateSelectionState(mockState, paths);

      const rowState = updated.rowStates.get(sourceRowId);
      expect(rowState).toBeDefined();
      expect(rowState?.selectedMarkers).toBe(3);
      expect(rowState?.totalMarkers).toBe(5); // Based on virtualFrames in mock
      expect(rowState?.state).toBe("partial");
    });

    it("should mark row as fully selected when all markers selected", () => {
      const sourceRowId = "namespace-alpha/instance-alpha-shared/scale";
      const allPaths = [
        `${sourceRowId}#s0`,
        `${sourceRowId}#s1`,
        `${sourceRowId}#s2`,
        `${sourceRowId}#s3`,
      ];
      const updated = updateSelectionState(mockState, allPaths);

      const rowState = updated.rowStates.get(sourceRowId);
      expect(rowState?.state).toBe("full");
    });

    it("should cache marker info", () => {
      const path = "namespace-alpha/instance-alpha-shared/shared-track-position-x#m0";
      const updated = updateSelectionState(mockState, [path]);

      const markerInfo = updated.markerInfo.get(path);
      expect(markerInfo).toBeDefined();
      expect(markerInfo?.stamp).toBe(0);
      expect(markerInfo?.instanceId).toBe("instance-alpha-shared");
    });

    it("should preserve reference marker if not provided", () => {
      mockState.selectionState.referenceMarker = "existing-ref";
      const updated = updateSelectionState(mockState, []);
      expect(updated.referenceMarker).toBe("existing-ref");
    });

    it("should update reference marker if provided", () => {
      const updated = updateSelectionState(mockState, [], "new-ref");
      expect(updated.referenceMarker).toBe("new-ref");
    });
  });

  describe("isMarkerSelected", () => {
    it("should correctly check if marker is selected", () => {
      const sourceRowId = "namespace-alpha/instance-alpha-shared/shared-track-position-x";
      mockState.selectionState = updateSelectionState(mockState, [`${sourceRowId}#m0`]);

      expect(isMarkerSelected(mockState.selectionState, sourceRowId, "m0")).toBe(true);
      expect(isMarkerSelected(mockState.selectionState, sourceRowId, "m1")).toBe(false);
    });
  });

  describe("Row Selection State", () => {
    it("should get row selection state", () => {
      const sourceRowId = "namespace-alpha/instance-alpha-shared/shared-track-position-x";
      const paths = [`${sourceRowId}#m0`, `${sourceRowId}#m2`];
      const state = updateSelectionState(mockState, paths);
      const rowState = getRowSelectionState(state, sourceRowId);

      expect(rowState).toBeDefined();
      expect(rowState?.selectedMarkers).toBe(2);
      expect(rowState?.state).toBe("partial");
    });

    it("should check if row is fully selected", () => {
      const sourceRowId = "namespace-alpha/instance-alpha-shared/scale";
      const allPaths = [
        `${sourceRowId}#s0`,
        `${sourceRowId}#s1`,
        `${sourceRowId}#s2`,
        `${sourceRowId}#s3`,
      ];
      const state = updateSelectionState(mockState, allPaths);

      expect(isRowFullySelected(state, sourceRowId)).toBe(true);
      expect(
        isRowFullySelected(state, "namespace-alpha/instance-alpha-shared/shared-track-position-x"),
      ).toBe(false);
    });

    it("should check if row is partially selected", () => {
      const sourceRowId = "namespace-alpha/instance-alpha-shared/shared-track-position-x";
      const state = updateSelectionState(mockState, [`${sourceRowId}#m0`]);

      expect(isRowPartiallySelected(state, sourceRowId)).toBe(true);
      expect(
        isRowPartiallySelected(
          state,
          "namespace-alpha/instance-alpha-shared/shared-track-position-y",
        ),
      ).toBe(false);
    });

    it("should get selected markers in row", () => {
      const sourceRowId = "namespace-alpha/instance-alpha-shared/shared-track-position-x";
      const paths = [
        `${sourceRowId}#m0`,
        `${sourceRowId}#m2`,
        "namespace-alpha/instance-alpha-shared/shared-track-position-y#m1",
      ];
      const state = updateSelectionState(mockState, paths);
      const selected = getSelectedMarkersInRow(state, sourceRowId);

      expect(selected).toHaveLength(2);
      expect(selected).toContain(`${sourceRowId}#m0`);
      expect(selected).toContain(`${sourceRowId}#m2`);
    });
  });

  describe("filterSelectionByInstance", () => {
    it("should filter selection by instance ID", () => {
      const paths = [
        "namespace-alpha/instance-alpha-shared/shared-track-position-x#m0",
        "namespace-alpha/instance-alpha-shared/shared-track-position-x#m1",
        "namespace-beta/instance-beta-shared/shared-track-position-x#m0",
      ];
      const state = updateSelectionState(mockState, paths);
      const filtered = filterSelectionByInstance(state, "instance-alpha-shared");

      expect(filtered).toHaveLength(2);
      expect(filtered[0]).toContain("instance-alpha-shared");
      expect(filtered[1]).toContain("instance-alpha-shared");
    });
  });

  describe("classifyEntity", () => {
    it("should classify group entities", () => {
      const result = classifyEntity(mockState, "namespace-alpha/instance-alpha-shared/position");
      expect(result.type).toBe(EntityType.Group);
      expect(result.canContainKeypoints).toBe(false);
    });

    it("should classify track entities", () => {
      const result = classifyEntity(mockState, "namespace-alpha/instance-alpha-shared/scale");
      expect(result.type).toBe(EntityType.Track);
      expect(result.canContainKeypoints).toBe(true);
    });
  });

  describe("isGroupRow", () => {
    it("should identify group rows", () => {
      const groupRow =
        mockState.instancedTrackSources["namespace-alpha/instance-alpha-shared/position"];
      const trackRow =
        mockState.instancedTrackSources["namespace-alpha/instance-alpha-shared/scale"];

      expect(isGroupRow(groupRow)).toBe(true); // Has multiple data items
      expect(isGroupRow(trackRow)).toBe(false); // Has single data item
    });
  });

  describe("getSelectionUnit", () => {
    it("should get selection unit for simple track", () => {
      const unit = getSelectionUnit(mockState, "namespace-alpha/instance-alpha-shared/scale", "s0");
      expect(unit).toEqual(["namespace-alpha/instance-alpha-shared/scale#s0"]);
    });

    it("should get selection unit for group", () => {
      const unit = getSelectionUnit(
        mockState,
        "namespace-alpha/instance-alpha-shared/position",
        "group-m0",
      );

      // Should include the group marker and all child markers
      expect(unit).toContain("namespace-alpha/instance-alpha-shared/position#group-m0");
      expect(unit.length).toBeGreaterThan(1);
    });
  });

  describe("getRangeSelection", () => {
    it("should get range selection in same row", () => {
      const sourceRowId = "namespace-alpha/instance-alpha-shared/shared-track-position-x";
      const range = getRangeSelection(mockState, `${sourceRowId}#m0`, `${sourceRowId}#m3`);

      expect(range).toContain(`${sourceRowId}#m0`);
      expect(range).toContain(`${sourceRowId}#m1`);
      expect(range).toContain(`${sourceRowId}#m2`);
      expect(range).toContain(`${sourceRowId}#m3`);
    });

    it("should return single selection for different rows", () => {
      const range = getRangeSelection(
        mockState,
        "namespace-alpha/instance-alpha-shared/shared-track-position-x#m0",
        "namespace-alpha/instance-alpha-shared/shared-track-position-y#m0",
      );
      expect(range).toEqual(["namespace-alpha/instance-alpha-shared/shared-track-position-y#m0"]);
    });

    it("should handle reverse range selection", () => {
      const sourceRowId = "namespace-alpha/instance-alpha-shared/shared-track-position-x";
      const range = getRangeSelection(mockState, `${sourceRowId}#m3`, `${sourceRowId}#m1`);

      expect(range).toContain(`${sourceRowId}#m1`);
      expect(range).toContain(`${sourceRowId}#m2`);
      expect(range).toContain(`${sourceRowId}#m3`);
    });
  });

  describe("Selection Operations", () => {
    it("should add to selection", () => {
      const initial = updateSelectionState(mockState, [
        "namespace-alpha/instance-alpha-shared/shared-track-position-x#m0",
      ]);
      const added = addToSelection(initial, [
        "namespace-alpha/instance-alpha-shared/shared-track-position-x#m1",
        "namespace-alpha/instance-alpha-shared/scale#s0",
      ]);

      expect(added).toHaveLength(3);
      expect(added).toContain("namespace-alpha/instance-alpha-shared/shared-track-position-x#m0");
      expect(added).toContain("namespace-alpha/instance-alpha-shared/shared-track-position-x#m1");
      expect(added).toContain("namespace-alpha/instance-alpha-shared/scale#s0");
    });

    it("should not duplicate when adding existing paths", () => {
      const initial = updateSelectionState(mockState, [
        "namespace-alpha/instance-alpha-shared/shared-track-position-x#m0",
      ]);
      const added = addToSelection(initial, [
        "namespace-alpha/instance-alpha-shared/shared-track-position-x#m0", // Duplicate
        "namespace-alpha/instance-alpha-shared/shared-track-position-x#m1",
      ]);

      expect(added).toHaveLength(2);
    });

    it("should remove from selection", () => {
      const initial = updateSelectionState(mockState, [
        "namespace-alpha/instance-alpha-shared/shared-track-position-x#m0",
        "namespace-alpha/instance-alpha-shared/shared-track-position-x#m1",
        "namespace-alpha/instance-alpha-shared/scale#s0",
      ]);
      const removed = removeFromSelection(initial, [
        "namespace-alpha/instance-alpha-shared/shared-track-position-x#m1",
      ]);

      expect(removed).toHaveLength(2);
      expect(removed).toContain("namespace-alpha/instance-alpha-shared/shared-track-position-x#m0");
      expect(removed).toContain("namespace-alpha/instance-alpha-shared/scale#s0");
      expect(removed).not.toContain(
        "namespace-alpha/instance-alpha-shared/shared-track-position-x#m1",
      );
    });

    it("should toggle in selection", () => {
      const initial = updateSelectionState(mockState, [
        "namespace-alpha/instance-alpha-shared/shared-track-position-x#m0",
        "namespace-alpha/instance-alpha-shared/scale#s0",
      ]);

      const toggled = toggleInSelection(initial, [
        "namespace-alpha/instance-alpha-shared/shared-track-position-x#m0", // Remove (exists)
        "namespace-alpha/instance-alpha-shared/shared-track-position-x#m1", // Add (doesn't exist)
      ]);

      expect(toggled).toHaveLength(2);
      expect(toggled).not.toContain(
        "namespace-alpha/instance-alpha-shared/shared-track-position-x#m0",
      );
      expect(toggled).toContain("namespace-alpha/instance-alpha-shared/shared-track-position-x#m1");
      expect(toggled).toContain("namespace-alpha/instance-alpha-shared/scale#s0");
    });

    it("should clear selection", () => {
      const cleared = clearSelection();
      expect(cleared).toEqual([]);
    });
  });

  describe("selectAllInInstance", () => {
    it("should select all markers in instance", () => {
      const paths = selectAllInInstance(mockState, "instance-alpha-shared");

      // Should include all markers from all rows of the instance
      expect(paths.length).toBeGreaterThan(0);
      paths.forEach((path) => {
        expect(path).toContain("instance-alpha-shared");
      });
    });

    it("should return empty array for non-existent instance", () => {
      const paths = selectAllInInstance(mockState, "non-existent");
      expect(paths).toEqual([]);
    });
  });

  describe("invertSelectionInInstance", () => {
    it("should invert selection within instance only", () => {
      const initial = updateSelectionState(mockState, [
        "namespace-alpha/instance-alpha-shared/shared-track-position-x#m0",
        "namespace-alpha/instance-alpha-shared/shared-track-position-x#m1",
      ]);

      const inverted = invertSelectionInInstance(mockState, initial, "instance-alpha-shared");

      // Should not contain originally selected markers
      expect(inverted).not.toContain(
        "namespace-alpha/instance-alpha-shared/shared-track-position-x#m0",
      );
      expect(inverted).not.toContain(
        "namespace-alpha/instance-alpha-shared/shared-track-position-x#m1",
      );

      // Should contain other markers from the instance
      expect(inverted.some((p) => p.includes("instance-alpha-shared"))).toBe(true);
    });

    it("should select all in instance when nothing selected", () => {
      const initial = createEmptySelectionState();
      const inverted = invertSelectionInInstance(mockState, initial, "instance-alpha-shared");

      // Should select all markers in the instance
      expect(inverted.length).toBeGreaterThan(0);
      inverted.forEach((path) => {
        expect(path).toContain("instance-alpha-shared");
      });
    });
  });

  describe("Unit Selection Checks", () => {
    it("should check if unit is fully selected", () => {
      const unit = ["namespace-alpha/instance-alpha-shared/scale#s0"];
      const state = updateSelectionState(mockState, unit);

      expect(isUnitFullySelected(state, unit)).toBe(true);
    });

    it("should check if unit is partially selected", () => {
      const unit = [
        "namespace-alpha/instance-alpha-shared/shared-track-position-x#m0",
        "namespace-alpha/instance-alpha-shared/shared-track-position-x#m1",
      ];
      const state = updateSelectionState(mockState, [unit[0]]); // Only select first

      expect(isUnitPartiallySelected(state, unit)).toBe(true);
      expect(isUnitFullySelected(state, unit)).toBe(false);
    });

    it("should handle empty selection for unit checks", () => {
      const state = createEmptySelectionState();
      const unit = ["namespace-alpha/instance-alpha-shared/scale#s0"];

      expect(isUnitFullySelected(state, unit)).toBe(false);
      expect(isUnitPartiallySelected(state, unit)).toBe(false);
    });
  });

  describe("Complex Track Selection", () => {
    it("should handle selection in vector3 tracks", () => {
      const paths = ["namespace-alpha/instance-alpha-shared/position#group-m0"];
      const state = updateSelectionState(mockState, paths);

      // Position group marker should be selected
      expect(state.pathSet.has(paths[0])).toBe(true);
    });

    it("should handle group selection with children", () => {
      const unit = getSelectionUnit(
        mockState,
        "namespace-alpha/instance-alpha-shared/position",
        "group-m0",
      );

      // Should include group marker and potentially child markers
      expect(unit.length).toBeGreaterThanOrEqual(1);
      expect(unit[0]).toContain("position#group-m0");
    });
  });
});
