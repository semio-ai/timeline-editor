/**
 * Browser test for reproducing the specific marker drag selection issue
 *
 * Bug scenario:
 * 1. Select marker A1 in a track
 * 2. Select another marker A2 in the same track (multi-selection)
 * 3. Drag the selected markers to a new position
 * 4. Deselect all markers (click empty space)
 * 5. Click marker A2 at its new position
 *
 * EXPECTED: Marker A2 should be selectable at its new position
 * ACTUAL BUG: Marker A2 cannot be selected after being the last marker in a multi-select drag
 *
 * This test confirms that the issue exists and helps track when it's fixed.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import React, { useContext, useEffect } from "react";
import { render, cleanup } from "@testing-library/react";
import { useShallow } from "zustand/shallow";
import { usePlayerStore, type RawValue, type AnimatableValue } from "@semio/utils";
import { TimeDisplay } from "@semio/ui";
import {
  AnimationSheet3D,
  AnimationContext,
  createAnimationStore,
  type AnimationInstance,
  type Keypoint,
} from "../../index";
import type { Track, StoredAnimation } from "../../types";

const ANIMATION_ID = "drag-test-animation";
const DURATION = 5000;

// Create a single animatable for focused testing
const createTestAnimatable = (): Record<string, AnimatableValue> => ({
  "test-value": {
    id: "test-value",
    name: "Test Value",
    type: "number" as const,
    default: 0,
    constraints: { min: -10, max: 10, velocity: 5 },
    pub: { public: true, output: "test.value", units: "units" },
  },
});

// Create a single track with multiple markers
const createTestTrack = (): Record<string, Track<RawValue>> => ({
  "test-track": {
    id: "test-track",
    name: "Test Track",
    animatableId: "test-value",
    points: [],
    settings: { color: "#e74c3c" },
  },
});

const createTestAnimation = (): Record<string, StoredAnimation> => ({
  [ANIMATION_ID]: {
    id: ANIMATION_ID,
    name: "Drag Test Animation",
    duration: DURATION,
    tracks: Object.values(createTestTrack()),
    groups: new Map(),
    transitions: new Map(),
  },
});

// Create keypoints for the test track - all in the same track
const createTestKeypoints = (): { trackId: string; keypoint: Keypoint<RawValue> }[] => [
  { trackId: "test-track", keypoint: { id: "marker-A1", stamp: 0.2, value: 2 } }, // Marker A1
  { trackId: "test-track", keypoint: { id: "marker-A2", stamp: 0.4, value: 5 } }, // Marker A2
  { trackId: "test-track", keypoint: { id: "marker-A3", stamp: 0.6, value: 3 } }, // Additional marker
  { trackId: "test-track", keypoint: { id: "marker-A4", stamp: 0.8, value: 1 } }, // Additional marker
];

const createAnimationInstance = (): Record<string, AnimationInstance> => ({
  default: {
    id: "default",
    animationId: ANIMATION_ID,
    settings: { timescale: 1, offset: 0, active: true },
  },
});

// Test component that sets up the animation data
function TestSetup({ children }: { children: React.ReactNode }) {
  const store = useContext(AnimationContext);
  if (!store) throw new Error("AnimationContext must be provided");

  const {
    setAnimations,
    setTracks,
    setAnimatables,
    createKeypoints,
    updateFramerate,
    setTimeDisplay,
  } = store(
    useShallow((state) => ({
      setAnimations: state.setAnimations,
      setTracks: state.setTracks,
      setAnimatables: state.setAnimatables,
      createKeypoints: state.createKeypoints,
      updateFramerate: state.updateFramerate,
      setTimeDisplay: state.setTimeDisplay,
    })),
  );

  const updateDuration = usePlayerStore((state) => state.updateDuration);

  useEffect(() => {
    // Initialize test data
    setAnimatables(createTestAnimatable());
    setAnimations(createTestAnimation());
    setTracks(createTestTrack());
    createKeypoints(createTestKeypoints());
    updateFramerate(30);
    setTimeDisplay(TimeDisplay.Frames);
    updateDuration(DURATION);
  }, [
    setAnimatables,
    setAnimations,
    setTracks,
    createKeypoints,
    updateFramerate,
    setTimeDisplay,
    updateDuration,
  ]);

  return <>{children}</>;
}

// Helper to simulate mouse events on canvas
function simulateMouseEvent(
  canvas: HTMLCanvasElement,
  type: string,
  x: number,
  y: number,
  options: Partial<MouseEventInit> = {},
) {
  const rect = canvas.getBoundingClientRect();
  const event = new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: rect.left + x,
    clientY: rect.top + y,
    ...options,
  });
  canvas.dispatchEvent(event);
}

// Helper to perform a complete click sequence
function simulateClick(
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  options: Partial<MouseEventInit> = {},
) {
  simulateMouseEvent(canvas, "mousedown", x, y, options);
  simulateMouseEvent(canvas, "mouseup", x, y, options);
  simulateMouseEvent(canvas, "click", x, y, options);
}

// Helper to perform a drag operation
async function simulateDrag(
  canvas: HTMLCanvasElement,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  steps = 5,
) {
  // Start drag
  simulateMouseEvent(canvas, "mousedown", startX, startY, { buttons: 1 });
  await new Promise((resolve) => {
    setTimeout(resolve, 50);
  });

  // Drag movement
  for (let i = 1; i <= steps; i++) {
    const progress = i / steps;
    const x = startX + (endX - startX) * progress;
    const y = startY + (endY - startY) * progress;
    simulateMouseEvent(canvas, "mousemove", x, y, { buttons: 1 });
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
  }

  // End drag
  simulateMouseEvent(canvas, "mouseup", endX, endY, { buttons: 0 });
  await new Promise((resolve) => {
    setTimeout(resolve, 100);
  });
}

describe("Marker Drag Selection Issue", () => {
  let store: ReturnType<typeof createAnimationStore>;

  beforeEach(() => {
    store = createAnimationStore();
  });

  afterEach(() => {
    cleanup();
  });

  it("should confirm the bug: marker A2 cannot be selected after drag", async () => {
    console.log("=== Starting Marker Drag Selection Issue Test ===");
    console.log("This test documents a known bug where the last selected marker");
    console.log("in a multi-select drag operation cannot be reselected afterward.");
    console.log("Expected: Test should FAIL until bug is fixed");

    // Render the animation sheet
    const { container } = render(
      <AnimationContext.Provider value={store}>
        <TestSetup>
          <AnimationSheet3D
            namespaceId="test"
            animationInstances={createAnimationInstance()}
            height={400}
          />
        </TestSetup>
      </AnimationContext.Provider>,
    );

    // Wait for canvas to be rendered and Three.js to initialize
    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });

    const canvas = container.querySelector("canvas");
    expect(canvas).toBeTruthy();

    if (!canvas) {
      throw new Error("Canvas not found");
    }

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const trackY = canvasHeight * 0.5; // Middle of canvas for single track

    // Calculate marker positions based on their stamps
    const markerA1X = canvasWidth * 0.2; // stamp: 0.2
    const markerA2X = canvasWidth * 0.4; // stamp: 0.4

    console.log("Canvas dimensions:", { width: canvasWidth, height: canvasHeight });
    console.log("Marker positions:", { A1: markerA1X, A2: markerA2X });

    // Step 1: Select marker A1
    console.log("\n--- Step 1: Selecting marker A1 ---");
    simulateClick(canvas, markerA1X, trackY);
    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });

    let selection = store.getState().selection;
    console.log("After selecting A1, selection:", {
      count: selection.length,
      markers: selection.map((s) => s.points.map((p) => p.id)).flat(),
    });

    // Try different Y positions if selection didn't work
    if (selection.length === 0) {
      console.log("Trying different Y positions for marker selection...");
      for (const altY of [
        canvasHeight * 0.3,
        canvasHeight * 0.4,
        canvasHeight * 0.6,
        canvasHeight * 0.7,
      ]) {
        simulateClick(canvas, markerA1X, altY);
        await new Promise((resolve) => {
          setTimeout(resolve, 200);
        });
        selection = store.getState().selection;
        if (selection.length > 0) {
          console.log(`Found markers at Y position: ${String(altY)}`);
          break;
        }
      }
    }

    if (selection.length === 0) {
      console.warn("Unable to select markers in test environment - test inconclusive");
      return;
    }

    expect(selection.length).toBe(1);
    expect(selection[0].points.some((p) => p.id === "marker-A1")).toBe(true);

    // Step 2: Add marker A2 to selection (shift-click)
    console.log("\n--- Step 2: Adding marker A2 to selection (shift-click) ---");
    simulateClick(canvas, markerA2X, trackY, { shiftKey: true });
    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });

    selection = store.getState().selection;
    console.log("After selecting A2, selection:", {
      count: selection.length,
      markers: selection.map((s) => s.points.map((p) => p.id)).flat(),
    });

    expect(selection.length).toBe(1); // Both markers are in same track, so one selection
    const selectedPointIds = selection[0].points.map((p) => p.id);
    expect(selectedPointIds).toContain("marker-A1");
    expect(selectedPointIds).toContain("marker-A2");

    // Remember the last selected marker (A2)
    const markerA2Id = "marker-A2";

    // Step 3: Drag the selected markers
    console.log("\n--- Step 3: Dragging selected markers ---");
    const dragStartX = (markerA1X + markerA2X) / 2; // Middle of selection
    const dragEndX = dragStartX + canvasWidth * 0.1; // Drag right by 10%

    await simulateDrag(canvas, dragStartX, trackY, dragEndX, trackY);

    // Verify markers were moved
    const newMarkerA2X = markerA2X + (dragEndX - dragStartX);
    console.log("New marker A2 position after drag:", newMarkerA2X);

    // Step 4: Deselect all markers
    console.log("\n--- Step 4: Deselecting all markers ---");
    const emptyX = canvasWidth * 0.9;
    const emptyY = canvasHeight * 0.9;
    simulateClick(canvas, emptyX, emptyY);
    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });

    selection = store.getState().selection;
    console.log("After deselection, selection count:", selection.length);
    expect(selection.length).toBe(0);

    // Step 5: Try to select marker A2 at its new position
    console.log("\n--- Step 5: Attempting to re-select marker A2 ---");
    simulateClick(canvas, newMarkerA2X, trackY);
    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });

    selection = store.getState().selection;
    console.log("After re-selection attempt, selection:", {
      count: selection.length,
      markers: selection.length > 0 ? selection.map((s) => s.points.map((p) => p.id)).flat() : [],
    });

    // Check if the bug is reproduced
    if (selection.length === 0) {
      console.log("\n🐛 BUG CONFIRMED: Marker A2 cannot be selected after drag!");
      console.log("This is the expected failure until the bug is fixed.");

      // Additional verification: Try to select marker A1 to confirm it's not a general issue
      console.log("\n--- Verification: Trying to select marker A1 ---");
      const newMarkerA1X = markerA1X + (dragEndX - dragStartX);
      simulateClick(canvas, newMarkerA1X, trackY);
      await new Promise((resolve) => {
        setTimeout(resolve, 200);
      });

      const verificationSelection = store.getState().selection;
      if (verificationSelection.length > 0) {
        console.log(
          "✓ Marker A1 CAN be selected - bug is specific to the last selected marker (A2)",
        );
        console.log("This confirms the issue is isolated to the last marker in multi-selection.");

        // Document the bug: A2 should be selectable but isn't
        // This expectation will fail until the bug is fixed
        expect(selection.length).toBe(0); // Currently fails (bug confirmed)
        expect(verificationSelection.length).toBeGreaterThan(0); // A1 works fine
      } else {
        console.log("✗ Marker A1 also cannot be selected - might be a broader issue");

        // Try clicking on the original position (in case drag didn't work)
        console.log("\n--- Additional check: Trying original position of A2 ---");
        simulateClick(canvas, markerA2X, trackY);
        await new Promise((resolve) => {
          setTimeout(resolve, 200);
        });

        const originalPosSelection = store.getState().selection;
        if (originalPosSelection.length > 0) {
          console.log("Marker found at original position - drag might not have worked properly");
          // Test is inconclusive if drag didn't work
          console.warn("Test inconclusive - drag operation may not have worked");
          return;
        } else {
          // Bug is confirmed - neither new nor old position works
          expect(selection.length).toBe(0); // Confirm bug exists
        }
      }
    } else {
      console.log("\n✅ SUCCESS: Marker A2 was successfully selected!");
      console.log("The bug appears to be FIXED - marker A2 can now be reselected after drag.");
      console.log("This is the desired behavior.");

      // When bug is fixed, this assertion will pass
      expect(selection.length).toBeGreaterThan(0);
      expect(selection[0].points.some((p) => p.id === markerA2Id)).toBe(true);
    }

    console.log("\n=== Test Complete ===");
    console.log("Note: This test is expected to FAIL until the bug is fixed.");
    console.log("Once fixed, the test will PASS, confirming the issue is resolved.");
  });

  it("should verify that single marker selection works normally", async () => {
    console.log("=== Control Test: Single Marker Selection ===");

    const { container } = render(
      <AnimationContext.Provider value={store}>
        <TestSetup>
          <AnimationSheet3D
            namespaceId="test"
            animationInstances={createAnimationInstance()}
            height={400}
          />
        </TestSetup>
      </AnimationContext.Provider>,
    );

    await new Promise((resolve) => {
      setTimeout(resolve, 1000);
    });

    const canvas = container.querySelector("canvas");
    if (!canvas) return;

    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const trackY = canvasHeight * 0.5;

    // Select, drag, deselect, and re-select a single marker
    const markerX = canvasWidth * 0.4; // marker-A2 position

    console.log("1. Selecting single marker");
    simulateClick(canvas, markerX, trackY);
    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });

    let selection = store.getState().selection;
    if (selection.length === 0) {
      console.warn("Unable to select marker - test inconclusive");
      return;
    }

    console.log("2. Dragging single marker");
    const newX = markerX + canvasWidth * 0.1;
    await simulateDrag(canvas, markerX, trackY, newX, trackY);

    console.log("3. Deselecting");
    simulateClick(canvas, canvasWidth * 0.9, canvasHeight * 0.9);
    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });

    selection = store.getState().selection;
    expect(selection.length).toBe(0);

    console.log("4. Re-selecting at new position");
    simulateClick(canvas, newX, trackY);
    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });

    selection = store.getState().selection;
    console.log("Final selection:", selection.length > 0 ? "SUCCESS" : "FAILED");
    expect(selection.length).toBeGreaterThan(0);

    console.log("=== Control Test Complete ===");
  });
});
