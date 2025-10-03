import { AnimationData } from "../store-types";
import { SourceRowData } from "../types";
import {
  parseMarkerPath,
  createMarkerPath,
  updateSelectionState,
  getRangeSelection,
  addToSelection,
  removeFromSelection,
  createEmptySelectionState,
  filterSelectionByInstance,
} from "../functions/selection-state-manager";

/**
 * Handles clicking on a marker using the points-based selection system
 * Supports group selection, timeline selection, and instance switching
 *
 * @param state - The animation data state
 * @param clickedPoints - The actual points that were clicked (pre-filtered for selectable)
 * @param markerPath - The full marker path for reference tracking
 * @param shift - Whether shift key is pressed (range selection)
 * @param mod - Whether modifier key is pressed (multi-select)
 * @returns Updated state with new selection
 */
export function clickMarkerAction(
  state: AnimationData,
  clickedPoints: (SourceRowData & { id: string })[],
  markerPath: string,
  shift?: boolean,
  mod?: boolean,
): Partial<AnimationData> {
  // Extract instance IDs from clicked points
  const clickedInstances = new Set(
    clickedPoints.filter((p) => p.instanceId).map((p) => p.instanceId),
  );

  // Determine the target instance
  let clickedInstanceId: string | undefined;
  if (clickedInstances.size === 1) {
    clickedInstanceId = [...clickedInstances][0];
  } else if (clickedInstances.size > 1) {
    // Multiple instances in clicked points - use active or first
    clickedInstanceId = state.activeAnimationInstance || [...clickedInstances][0];
  } else {
    // No instance info (shouldn't happen with proper points)
    clickedInstanceId = state.activeAnimationInstance;
  }

  // Initialize selection state if it doesn't exist
  const currentSelectionState = state.selectionState || createEmptySelectionState();

  // Check if switching animation instances
  if (state.activeAnimationInstance && clickedInstanceId !== state.activeAnimationInstance) {
    // Different instance - clear selection and switch
    // Find all paths that contain the clicked points for the new instance
    const instancePoints = clickedPoints.filter((p) => p.instanceId === clickedInstanceId);
    const selectionPaths = findPathsContainingPoints(state, instancePoints);

    return {
      activeAnimationInstance: clickedInstanceId,
      selectionState: updateSelectionState(state, selectionPaths, markerPath),
    };
  }

  // If no active instance is set, we need to set it
  const needsInstanceUpdate = !state.activeAnimationInstance;

  // Find all paths that contain the clicked points
  const selectionUnit = findPathsContainingPoints(state, clickedPoints);

  // Handle modifier keys
  if (mod && !shift) {
    // Ctrl/Cmd click - toggle selection
    const allSelected = selectionUnit.every((path) => currentSelectionState.pathSet.has(path));

    let newPaths: string[];
    if (allSelected) {
      // Remove the entire unit from selection
      newPaths = removeFromSelection(currentSelectionState, selectionUnit);
    } else {
      // Add the entire unit to selection
      newPaths = addToSelection(currentSelectionState, selectionUnit);
    }

    return {
      selectionState: updateSelectionState(
        state,
        newPaths,
        newPaths.length > 0 ? currentSelectionState.referenceMarker : null,
      ),
    };
  }

  if (shift && currentSelectionState.referenceMarker) {
    // Shift click - range selection
    const rangePaths = getRangeSelection(state, currentSelectionState.referenceMarker, markerPath);

    let newPaths: string[];
    if (mod) {
      // Add range to existing selection
      newPaths = addToSelection(currentSelectionState, rangePaths);
    } else {
      // Replace selection with range
      newPaths = rangePaths;
    }

    return {
      selectionState: updateSelectionState(state, newPaths, currentSelectionState.referenceMarker),
    };
  }

  // Simple click - replace selection with unit
  const result: Partial<AnimationData> = {
    selectionState: updateSelectionState(state, selectionUnit, markerPath),
  };

  // Set the active instance if it wasn't set
  if (needsInstanceUpdate) {
    result.activeAnimationInstance = clickedInstanceId;
  }

  return result;
}

/**
 * Find all marker paths that contain the specified points
 * This replaces the old getSelectionUnit function with a points-based approach
 */
function findPathsContainingPoints(
  state: AnimationData,
  targetPoints: (SourceRowData & { id: string })[],
): string[] {
  const paths: string[] = [];

  // Create point signatures for efficient matching
  const targetSignatures = new Set(targetPoints.map((p) => createPointSignature(p)));

  // Search all computed row data
  for (const [rowPath, rowData] of Object.entries(state.computedRowData || {})) {
    for (const frame of rowData.virtualFrames || []) {
      if (!frame.points || frame.points.length === 0) continue;

      // Check if this frame contains ANY of our target points
      const hasTargetPoint = frame.points.some((p) =>
        targetSignatures.has(createPointSignature(p)),
      );

      if (hasTargetPoint) {
        paths.push(createMarkerPath(rowPath, frame.id));
      }
    }
  }

  return paths;
}

/**
 * Create a unique signature for a point for matching
 */
function createPointSignature(point: SourceRowData & { id?: string }): string {
  // Use the point's id field if available (from marker data), otherwise fall back to animatableId
  const pointId = "id" in point && point.id ? point.id : point.animatableId;
  return `${point.namespaceId}/${point.instanceId}/${point.trackId}/${point.attribute || ""}#${pointId}`;
}

/**
 * Clear selection helper
 */
export function clearSelectionAction(): Partial<AnimationData> {
  return {
    selectionState: createEmptySelectionState(),
  };
}

/**
 * Select all in current instance
 */
export function selectAllAction(state: AnimationData): Partial<AnimationData> {
  const activeInstance = state.activeAnimationInstance;
  if (!activeInstance) {
    return { selectionState: createEmptySelectionState() };
  }

  const allPaths: string[] = [];

  for (const [rowPath, rowData] of Object.entries(state.computedRowData)) {
    // Check if this row belongs to the active instance
    const pathParts = rowPath.split("/");
    if (pathParts.length >= 2 && pathParts[1] === activeInstance) {
      for (const frame of rowData.virtualFrames || []) {
        allPaths.push(createMarkerPath(rowPath, frame.id));
      }
    }
  }

  return {
    selectionState: updateSelectionState(state, allPaths),
  };
}

/**
 * Invert selection in current instance
 */
export function invertSelectionAction(state: AnimationData): Partial<AnimationData> {
  const activeInstance = state.activeAnimationInstance;
  if (!activeInstance) {
    return { selectionState: createEmptySelectionState() };
  }

  const currentSelectionState = state.selectionState || createEmptySelectionState();

  // Get all possible paths in instance
  const allPathsInInstance: string[] = [];
  for (const [rowPath, rowData] of Object.entries(state.computedRowData)) {
    const pathParts = rowPath.split("/");
    if (pathParts.length >= 2 && pathParts[1] === activeInstance) {
      for (const frame of rowData.virtualFrames || []) {
        allPathsInInstance.push(createMarkerPath(rowPath, frame.id));
      }
    }
  }

  // Get currently selected paths in this instance
  const currentPathsInInstance = filterSelectionByInstance(currentSelectionState, activeInstance);
  const currentSet = new Set(currentPathsInInstance);

  // Get paths from other instances that should be preserved
  const otherInstancePaths = currentSelectionState.paths.filter((path) => {
    const parsed = parseMarkerPath(path);
    return parsed.instanceId !== activeInstance;
  });

  // Invert within instance
  const invertedInInstance = allPathsInInstance.filter((p) => !currentSet.has(p));

  // Combine with other instance selections
  const newPaths = [...otherInstancePaths, ...invertedInInstance];

  return {
    selectionState: updateSelectionState(state, newPaths),
  };
}
