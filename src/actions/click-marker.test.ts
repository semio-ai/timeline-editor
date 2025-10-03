/**
 * Integration tests for the new path-based click marker action
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  clickMarkerAction,
  clearSelectionAction,
  selectAllAction,
  invertSelectionAction,
  clickMarkerWithTimelineSupport,
} from "./click-marker";
import { AnimationData } from "../store-types";
import {
  createEmptySelectionState,
  updateSelectionState,
} from "../functions/selection-state-manager";

// Mock data helper
function createMockState(): AnimationData {
  return {
    // Basic structure
    values: new Map(),
    velocities: new Map(),
    trackInterpolators: {},
    namespaces: {},
    animations: {},
    tracks: {},
    duration: 10000,
    framerate: 30,
    expanded: true,
    timeDisplay: "frames" as any,
    previews: [],
    selection: [],
    referenceMarker: null,
    selectionState: createEmptySelectionState(),
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
    activeAnimationInstance: "instance1",

    // Mock instanced track sources
    instancedTrackSources: {
      timeline: {
        id: "timeline",
        data: [
          {
            foreground: true,
            editable: false,
            selectable: true,
            animationId: "anim1",
            namespaceId: "global",
            instanceId: "global",
            type: "group" as const,
            trackId: "timeline",
            animatableId: "timeline",
          },
        ],
        expanded: true,
      },
      "namespace1/instance1/position": {
        id: "namespace1/instance1/position",
        data: [
          {
            foreground: true,
            editable: true,
            selectable: true,
            animationId: "anim1",
            namespaceId: "namespace1",
            instanceId: "instance1",
            type: "group" as const,
            trackId: "position_x",
            animatableId: "position",
            attribute: "x",
          },
          {
            foreground: true,
            editable: true,
            selectable: true,
            animationId: "anim1",
            namespaceId: "namespace1",
            instanceId: "instance1",
            type: "group" as const,
            trackId: "position_y",
            animatableId: "position",
            attribute: "y",
          },
          {
            foreground: true,
            editable: true,
            selectable: true,
            animationId: "anim1",
            namespaceId: "namespace1",
            instanceId: "instance1",
            type: "group" as const,
            trackId: "position_z",
            animatableId: "position",
            attribute: "z",
          },
        ],
        expanded: true,
      },
      "namespace1/instance1/position/x": {
        id: "namespace1/instance1/position/x",
        data: [
          {
            foreground: true,
            editable: true,
            selectable: true,
            animationId: "anim1",
            namespaceId: "namespace1",
            instanceId: "instance1",
            type: "number" as const,
            trackId: "position_x",
            animatableId: "position",
            attribute: "x",
          },
        ],
        expanded: true,
      },
      "namespace1/instance1/position/y": {
        id: "namespace1/instance1/position/y",
        data: [
          {
            foreground: true,
            editable: true,
            selectable: true,
            animationId: "anim1",
            namespaceId: "namespace1",
            instanceId: "instance1",
            type: "number" as const,
            trackId: "position_y",
            animatableId: "position",
            attribute: "y",
          },
        ],
        expanded: true,
      },
      "namespace1/instance1/position/z": {
        id: "namespace1/instance1/position/z",
        data: [
          {
            foreground: true,
            editable: true,
            selectable: true,
            animationId: "anim1",
            namespaceId: "namespace1",
            instanceId: "instance1",
            type: "number" as const,
            trackId: "position_z",
            animatableId: "position",
            attribute: "z",
          },
        ],
        expanded: true,
      },
      "namespace1/instance1/rotation": {
        id: "namespace1/instance1/rotation",
        data: [
          {
            foreground: true,
            editable: true,
            selectable: true,
            animationId: "anim1",
            namespaceId: "namespace1",
            instanceId: "instance1",
            type: "number" as const,
            trackId: "rotation",
            animatableId: "rotation",
          },
        ],
        expanded: true,
      },
      "namespace1/instance2/scale": {
        id: "namespace1/instance2/scale",
        data: [
          {
            foreground: true,
            editable: true,
            selectable: true,
            animationId: "anim1",
            namespaceId: "namespace1",
            instanceId: "instance2",
            type: "number" as const,
            trackId: "scale",
            animatableId: "scale",
          },
        ],
        expanded: true,
      },
    },

    // Mock computed row data with actual marker data
    computedRowData: {
      timeline: {
        virtualFrames: [
          {
            id: "t1",
            stamp: 1000,
            points: [
              {
                foreground: true,
                editable: false,
                selectable: true,
                animationId: "anim1",
                namespaceId: "global",
                instanceId: "instance1",
                type: "group" as const,
                trackId: "timeline",
                animatableId: "timeline",
              },
            ],
          },
          {
            id: "t2",
            stamp: 2000,
            points: [
              {
                foreground: true,
                editable: false,
                selectable: true,
                animationId: "anim1",
                namespaceId: "global",
                instanceId: "instance1",
                type: "group" as const,
                trackId: "timeline",
                animatableId: "timeline",
              },
            ],
          },
        ],
      },
      "namespace1/instance1/position": {
        virtualFrames: [
          {
            id: "m1",
            stamp: 1000,
            points: [
              {
                foreground: true,
                editable: true,
                selectable: true,
                animationId: "anim1",
                namespaceId: "namespace1",
                instanceId: "instance1",
                type: "group" as const,
                trackId: "position",
                animatableId: "position",
              },
            ],
          },
          {
            id: "m2",
            stamp: 2000,
            points: [
              {
                foreground: true,
                editable: true,
                selectable: true,
                animationId: "anim1",
                namespaceId: "namespace1",
                instanceId: "instance1",
                type: "group" as const,
                trackId: "position",
                animatableId: "position",
              },
            ],
          },
          {
            id: "m3",
            stamp: 3000,
            points: [
              {
                foreground: true,
                editable: true,
                selectable: true,
                animationId: "anim1",
                namespaceId: "namespace1",
                instanceId: "instance1",
                type: "group" as const,
                trackId: "position",
                animatableId: "position",
              },
            ],
          },
        ],
      },
      "namespace1/instance1/position/x": {
        virtualFrames: [
          {
            id: "m1",
            stamp: 1000,
            points: [
              {
                foreground: true,
                editable: true,
                selectable: true,
                animationId: "anim1",
                namespaceId: "namespace1",
                instanceId: "instance1",
                type: "number" as const,
                trackId: "position_x",
                animatableId: "position",
                attribute: "x",
              },
            ],
          },
          {
            id: "m2",
            stamp: 2000,
            points: [
              {
                foreground: true,
                editable: true,
                selectable: true,
                animationId: "anim1",
                namespaceId: "namespace1",
                instanceId: "instance1",
                type: "number" as const,
                trackId: "position_x",
                animatableId: "position",
                attribute: "x",
              },
            ],
          },
          {
            id: "m3",
            stamp: 3000,
            points: [
              {
                foreground: true,
                editable: true,
                selectable: true,
                animationId: "anim1",
                namespaceId: "namespace1",
                instanceId: "instance1",
                type: "number" as const,
                trackId: "position_x",
                animatableId: "position",
                attribute: "x",
              },
            ],
          },
        ],
      },
      "namespace1/instance1/position/y": {
        virtualFrames: [
          {
            id: "m1",
            stamp: 1000,
            points: [
              {
                foreground: true,
                editable: true,
                selectable: true,
                animationId: "anim1",
                namespaceId: "namespace1",
                instanceId: "instance1",
                type: "number" as const,
                trackId: "position_y",
                animatableId: "position",
                attribute: "y",
              },
            ],
          },
          {
            id: "m2",
            stamp: 2000,
            points: [
              {
                foreground: true,
                editable: true,
                selectable: true,
                animationId: "anim1",
                namespaceId: "namespace1",
                instanceId: "instance1",
                type: "number" as const,
                trackId: "position_y",
                animatableId: "position",
                attribute: "y",
              },
            ],
          },
          {
            id: "m3",
            stamp: 3000,
            points: [
              {
                foreground: true,
                editable: true,
                selectable: true,
                animationId: "anim1",
                namespaceId: "namespace1",
                instanceId: "instance1",
                type: "number" as const,
                trackId: "position_y",
                animatableId: "position",
                attribute: "y",
              },
            ],
          },
        ],
      },
      "namespace1/instance1/position/z": {
        virtualFrames: [
          {
            id: "m1",
            stamp: 1000,
            points: [
              {
                foreground: true,
                editable: true,
                selectable: true,
                animationId: "anim1",
                namespaceId: "namespace1",
                instanceId: "instance1",
                type: "number" as const,
                trackId: "position_z",
                animatableId: "position",
                attribute: "z",
              },
            ],
          },
          {
            id: "m2",
            stamp: 2000,
            points: [
              {
                foreground: true,
                editable: true,
                selectable: true,
                animationId: "anim1",
                namespaceId: "namespace1",
                instanceId: "instance1",
                type: "number" as const,
                trackId: "position_z",
                animatableId: "position",
                attribute: "z",
              },
            ],
          },
          {
            id: "m3",
            stamp: 3000,
            points: [
              {
                foreground: true,
                editable: true,
                selectable: true,
                animationId: "anim1",
                namespaceId: "namespace1",
                instanceId: "instance1",
                type: "number" as const,
                trackId: "position_z",
                animatableId: "position",
                attribute: "z",
              },
            ],
          },
        ],
      },
      "namespace1/instance1/rotation": {
        virtualFrames: [
          {
            id: "r1",
            stamp: 1500,
            points: [
              {
                foreground: true,
                editable: true,
                selectable: true,
                animationId: "anim1",
                namespaceId: "namespace1",
                instanceId: "instance1",
                type: "number" as const,
                trackId: "rotation",
                animatableId: "rotation",
              },
            ],
          },
          {
            id: "r2",
            stamp: 2500,
            points: [
              {
                foreground: true,
                editable: true,
                selectable: true,
                animationId: "anim1",
                namespaceId: "namespace1",
                instanceId: "instance1",
                type: "number" as const,
                trackId: "rotation",
                animatableId: "rotation",
              },
            ],
          },
        ],
      },
      "namespace1/instance2/scale": {
        virtualFrames: [
          {
            id: "s1",
            stamp: 1000,
            points: [
              {
                foreground: true,
                editable: true,
                selectable: true,
                animationId: "anim1",
                namespaceId: "namespace1",
                instanceId: "instance2",
                type: "number" as const,
                trackId: "scale",
                animatableId: "scale",
              },
            ],
          },
          {
            id: "s2",
            stamp: 2000,
            points: [
              {
                foreground: true,
                editable: true,
                selectable: true,
                animationId: "anim1",
                namespaceId: "namespace1",
                instanceId: "instance2",
                type: "number" as const,
                trackId: "scale",
                animatableId: "scale",
              },
            ],
          },
        ],
      },
    },

    sourcesByAnimationInstance: {},
    sourceRowIds: [],
  } as unknown as AnimationData;
}

describe("Click Marker Action", () => {
  let mockState: AnimationData;

  beforeEach(() => {
    mockState = createMockState();
  });

  describe("Simple Click", () => {
    it("should select a single track marker", () => {
      const result = clickMarkerAction(mockState, "r1", "namespace1/instance1/rotation");

      expect(result.selectionState).toBeDefined();
      expect(result.selectionState?.paths).toEqual(["namespace1/instance1/rotation#r1"]);
      expect(result.selectionState?.referenceMarker).toBe("namespace1/instance1/rotation#r1");
    });

    it("should select group and all children on group click", () => {
      const result = clickMarkerAction(mockState, "m1", "namespace1/instance1/position");

      expect(result.selectionState).toBeDefined();
      expect(result.selectionState?.paths).toHaveLength(4);
      expect(result.selectionState?.paths).toContain("namespace1/instance1/position#m1");
      expect(result.selectionState?.paths).toContain("namespace1/instance1/position/x#m1");
      expect(result.selectionState?.paths).toContain("namespace1/instance1/position/y#m1");
      expect(result.selectionState?.paths).toContain("namespace1/instance1/position/z#m1");
    });

    it("should select parent and siblings on attribute click", () => {
      const result = clickMarkerAction(mockState, "m1", "namespace1/instance1/position/x");

      expect(result.selectionState).toBeDefined();
      expect(result.selectionState?.paths).toHaveLength(4);
      expect(result.selectionState?.paths).toContain("namespace1/instance1/position#m1");
      expect(result.selectionState?.paths).toContain("namespace1/instance1/position/x#m1");
      expect(result.selectionState?.paths).toContain("namespace1/instance1/position/y#m1");
      expect(result.selectionState?.paths).toContain("namespace1/instance1/position/z#m1");
    });

    it("should replace existing selection on simple click", () => {
      mockState.selectionState = updateSelectionState(mockState, [
        "namespace1/instance1/rotation#r1",
        "namespace1/instance1/rotation#r2",
      ]);

      const result = clickMarkerAction(mockState, "m1", "namespace1/instance1/position");

      expect(result.selectionState?.paths).not.toContain("namespace1/instance1/rotation#r1");
      expect(result.selectionState?.paths).toContain("namespace1/instance1/position#m1");
    });
  });

  describe("Ctrl/Cmd Click (Modifier)", () => {
    it("should add to selection when marker not selected", () => {
      mockState.selectionState = updateSelectionState(mockState, [
        "namespace1/instance1/rotation#r1",
      ]);

      const result = clickMarkerAction(
        mockState,
        "r2",
        "namespace1/instance1/rotation",
        false,
        true,
      );

      expect(result.selectionState?.paths).toHaveLength(2);
      expect(result.selectionState?.paths).toContain("namespace1/instance1/rotation#r1");
      expect(result.selectionState?.paths).toContain("namespace1/instance1/rotation#r2");
    });

    it("should remove from selection when marker already selected", () => {
      mockState.selectionState = updateSelectionState(mockState, [
        "namespace1/instance1/rotation#r1",
        "namespace1/instance1/rotation#r2",
      ]);

      const result = clickMarkerAction(
        mockState,
        "r1",
        "namespace1/instance1/rotation",
        false,
        true,
      );

      expect(result.selectionState?.paths).toHaveLength(1);
      expect(result.selectionState?.paths).not.toContain("namespace1/instance1/rotation#r1");
      expect(result.selectionState?.paths).toContain("namespace1/instance1/rotation#r2");
    });

    it("should toggle entire unit for groups", () => {
      mockState.selectionState = updateSelectionState(mockState, [
        "namespace1/instance1/rotation#r1",
      ]);

      const result = clickMarkerAction(
        mockState,
        "m1",
        "namespace1/instance1/position",
        false,
        true,
      );

      expect(result.selectionState?.paths).toHaveLength(5); // 1 existing + 4 from group
      expect(result.selectionState?.paths).toContain("namespace1/instance1/rotation#r1");
      expect(result.selectionState?.paths).toContain("namespace1/instance1/position#m1");
      expect(result.selectionState?.paths).toContain("namespace1/instance1/position/x#m1");
    });

    it("should remove entire unit when group fully selected", () => {
      mockState.selectionState = updateSelectionState(mockState, [
        "namespace1/instance1/position#m1",
        "namespace1/instance1/position/x#m1",
        "namespace1/instance1/position/y#m1",
        "namespace1/instance1/position/z#m1",
        "namespace1/instance1/rotation#r1",
      ]);

      const result = clickMarkerAction(
        mockState,
        "m1",
        "namespace1/instance1/position",
        false,
        true,
      );

      expect(result.selectionState?.paths).toHaveLength(1);
      expect(result.selectionState?.paths).toEqual(["namespace1/instance1/rotation#r1"]);
    });
  });

  describe("Shift Click (Range Selection)", () => {
    it("should select range between reference and clicked marker", () => {
      mockState.selectionState = updateSelectionState(
        mockState,
        ["namespace1/instance1/position#m1"],
        "namespace1/instance1/position#m1",
      );

      const result = clickMarkerAction(
        mockState,
        "m3",
        "namespace1/instance1/position",
        true,
        false,
      );

      expect(result.selectionState?.paths).toContain("namespace1/instance1/position#m1");
      expect(result.selectionState?.paths).toContain("namespace1/instance1/position#m2");
      expect(result.selectionState?.paths).toContain("namespace1/instance1/position#m3");
      // Plus children for each marker in the range
      expect(result.selectionState?.paths).toContain("namespace1/instance1/position/x#m1");
      expect(result.selectionState?.paths).toContain("namespace1/instance1/position/x#m2");
      expect(result.selectionState?.paths).toContain("namespace1/instance1/position/x#m3");
    });

    it("should handle shift-click without reference marker", () => {
      mockState.selectionState = createEmptySelectionState();

      const result = clickMarkerAction(
        mockState,
        "m2",
        "namespace1/instance1/position",
        true,
        false,
      );

      // Should just select the clicked marker since no reference
      expect(result.selectionState?.paths).toHaveLength(4); // Group + 3 children
      expect(result.selectionState?.paths).toContain("namespace1/instance1/position#m2");
    });

    it("should handle shift-click across different rows", () => {
      mockState.selectionState = updateSelectionState(
        mockState,
        ["namespace1/instance1/position#m1"],
        "namespace1/instance1/position#m1",
      );

      const result = clickMarkerAction(
        mockState,
        "r1",
        "namespace1/instance1/rotation",
        true,
        false,
      );

      // Should only select the clicked marker when rows differ
      expect(result.selectionState?.paths).toEqual(["namespace1/instance1/rotation#r1"]);
    });
  });

  describe("Instance Switching", () => {
    it("should switch instance and clear selection when clicking different instance", () => {
      mockState.selectionState = updateSelectionState(mockState, [
        "namespace1/instance1/position#m1",
        "namespace1/instance1/rotation#r1",
      ]);

      const result = clickMarkerAction(mockState, "s1", "namespace1/instance2/scale");

      expect(result.activeAnimationInstance).toBe("instance2");
      expect(result.selectionState?.paths).toEqual(["namespace1/instance2/scale#s1"]);
    });

    it("should preserve instance when clicking within same instance", () => {
      const result = clickMarkerAction(mockState, "r1", "namespace1/instance1/rotation");

      expect(result.activeAnimationInstance).toBeUndefined(); // No change
      expect(result.selectionState?.paths).toContain("namespace1/instance1/rotation#r1");
    });
  });

  describe("Clear Selection", () => {
    it("should clear all selections", () => {
      mockState.selectionState = updateSelectionState(mockState, [
        "namespace1/instance1/position#m1",
        "namespace1/instance1/rotation#r1",
      ]);

      const result = clearSelectionAction();

      expect(result.selectionState).toBeDefined();
      expect(result.selectionState?.paths).toEqual([]);
      expect(result.selectionState?.referenceMarker).toBeNull();
    });
  });

  describe("Select All", () => {
    it("should select all markers in active instance", () => {
      const result = selectAllAction(mockState);

      expect(result.selectionState).toBeDefined();
      const paths = result.selectionState?.paths || [];

      // Should include all markers from instance1
      expect(paths).toContain("namespace1/instance1/position#m1");
      expect(paths).toContain("namespace1/instance1/position#m2");
      expect(paths).toContain("namespace1/instance1/position#m3");
      expect(paths).toContain("namespace1/instance1/rotation#r1");
      expect(paths).toContain("namespace1/instance1/rotation#r2");

      // Should not include instance2 markers
      expect(paths).not.toContain("namespace1/instance2/scale#s1");
    });

    it("should return empty selection when no active instance", () => {
      mockState.activeAnimationInstance = undefined;

      const result = selectAllAction(mockState);

      expect(result.selectionState?.paths).toEqual([]);
    });
  });

  describe("Invert Selection", () => {
    it("should invert selection within active instance only", () => {
      mockState.selectionState = updateSelectionState(mockState, [
        "namespace1/instance1/position#m1",
        "namespace1/instance1/rotation#r1",
      ]);

      const result = invertSelectionAction(mockState);

      const paths = result.selectionState?.paths || [];

      // Should not have originally selected
      expect(paths).not.toContain("namespace1/instance1/position#m1");
      expect(paths).not.toContain("namespace1/instance1/rotation#r1");

      // Should have all other instance1 markers
      expect(paths).toContain("namespace1/instance1/position#m2");
      expect(paths).toContain("namespace1/instance1/position#m3");
      expect(paths).toContain("namespace1/instance1/rotation#r2");

      // Should not include instance2
      expect(paths).not.toContain("namespace1/instance2/scale#s1");
    });

    it("should preserve selections from other instances", () => {
      mockState.selectionState = updateSelectionState(mockState, [
        "namespace1/instance1/position#m1",
        "namespace1/instance2/scale#s1",
      ]);

      mockState.activeAnimationInstance = "instance1";

      const result = invertSelectionAction(mockState);

      const paths = result.selectionState?.paths || [];

      // Should preserve instance2 selection
      expect(paths).toContain("namespace1/instance2/scale#s1");

      // Should invert instance1 selection
      expect(paths).not.toContain("namespace1/instance1/position#m1");
      expect(paths).toContain("namespace1/instance1/position#m2");
    });
  });

  describe("Timeline Selection", () => {
    it("should select all markers at timestamp when clicking timeline", () => {
      const result = clickMarkerWithTimelineSupport(mockState, "t1", "timeline");

      const paths = result.selectionState?.paths || [];

      // Should select all markers at stamp 1000 in instance1
      expect(paths).toContain("namespace1/instance1/position#m1");
      expect(paths).toContain("namespace1/instance1/position/x#m1");
      expect(paths).toContain("namespace1/instance1/position/y#m1");
      expect(paths).toContain("namespace1/instance1/position/z#m1");

      // Should not include markers at different timestamps
      expect(paths).not.toContain("namespace1/instance1/position#m2");
      expect(paths).not.toContain("namespace1/instance1/rotation#r1"); // stamp 1500
    });

    it("should toggle timeline selection with modifier key", () => {
      // First select some markers at stamp 1000
      mockState.selectionState = updateSelectionState(mockState, [
        "namespace1/instance1/position#m1",
        "namespace1/instance1/position/x#m1",
        "namespace1/instance1/position/y#m1",
        "namespace1/instance1/position/z#m1",
      ]);

      // Click timeline at same stamp with modifier
      const result = clickMarkerWithTimelineSupport(mockState, "t1", "timeline", false, true);

      const paths = result.selectionState?.paths || [];

      // Should deselect all markers at stamp 1000
      expect(paths).toHaveLength(0);
    });

    it("should handle non-timeline rows normally", () => {
      const result = clickMarkerWithTimelineSupport(
        mockState,
        "r1",
        "namespace1/instance1/rotation",
      );

      expect(result.selectionState?.paths).toEqual(["namespace1/instance1/rotation#r1"]);
    });
  });
});
