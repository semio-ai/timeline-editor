import { AnimationData } from "../store-types";
import {
  parseMarkerPath,
  createMarkerPath,
  updateSelectionState,
  getSelectionUnit,
  getRangeSelection,
  addToSelection,
  removeFromSelection,
  isUnitFullySelected,
  filterSelectionByInstance,
  createEmptySelectionState,
} from "../functions/selection-state-manager";
import { getMarkerById, getMarkerInstanceId } from "../functions/marker-utils";

/**
 * Handles clicking on a marker using the new path-based selection system
 * Supports group selection, timeline selection, and instance switching
 *
 * @param state - The animation data state
 * @param markerId - The ID of the clicked marker
 * @param sourceRowId - The ID of the source row
 * @param shift - Whether shift key is pressed (range selection)
 * @param mod - Whether modifier key is pressed (multi-select)
 * @returns Updated state with new selection
 */
export function clickMarkerAction(
  state: AnimationData,
  markerId: string,
  sourceRowId: string,
  shift?: boolean,
  mod?: boolean,
): Partial<AnimationData> {
  // Look up fresh data using IDs
  const sourceRow = state.instancedTrackSources[sourceRowId];
  const computedData = state.computedRowData[sourceRowId];
  const markerInfo = computedData?.virtualFrames.find((f) => f.id === markerId);

  if (!markerInfo || !sourceRow) return {};

  // Create the clicked marker path
  const clickedPath = createMarkerPath(sourceRowId, markerId);

  // Extract instance ID from marker's points
  const clickedInstanceId = getMarkerInstanceId(markerInfo);

  // Initialize selection state if it doesn't exist
  const currentSelectionState = state.selectionState || createEmptySelectionState();

  console.log("[clickMarkerAction] Instance info", {
    clickedInstanceId,
    currentActiveInstance: state.activeAnimationInstance,
    willSwitch:
      state.activeAnimationInstance && clickedInstanceId !== state.activeAnimationInstance,
    needsInit: !state.activeAnimationInstance,
  });

  // Check if switching animation instances
  if (state.activeAnimationInstance && clickedInstanceId !== state.activeAnimationInstance) {
    // Different instance - clear selection and switch
    return {
      activeAnimationInstance: clickedInstanceId,
      selectionState: updateSelectionState(state, [clickedPath], clickedPath),
    };
  }

  // If no active instance is set, we need to set it
  const needsInstanceUpdate = !state.activeAnimationInstance;

  // Get the selection unit for this click
  const selectionUnit = getSelectionUnit(state, sourceRowId, markerId);

  // Handle modifier keys
  if (mod && !shift) {
    // Ctrl/Cmd click - toggle selection
    const unitFullySelected = isUnitFullySelected(currentSelectionState, selectionUnit);

    let newPaths: string[];
    if (unitFullySelected) {
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
    const rangePaths = getRangeSelection(state, currentSelectionState.referenceMarker, clickedPath);

    // Check if we're in add mode (previous action was ctrl-click)
    const referenceInfo = currentSelectionState.markerInfo.get(
      currentSelectionState.referenceMarker,
    );
    const isAddMode = referenceInfo?.value === true; // You might store this differently

    let newPaths: string[];
    if (isAddMode) {
      // Add range to existing selection
      newPaths = addToSelection(currentSelectionState, rangePaths);
    } else {
      // Replace selection with range
      newPaths = rangePaths;
    }

    // Filter to active instance only
    const instanceFilteredPaths = newPaths.filter((path) => {
      const parsed = parseMarkerPath(path);
      return parsed.instanceId === state.activeAnimationInstance;
    });

    return {
      selectionState: updateSelectionState(
        state,
        instanceFilteredPaths,
        currentSelectionState.referenceMarker,
      ),
    };
  }

  // Simple click - replace selection with unit
  // Filter to active instance only
  const activeInstance = state.activeAnimationInstance || clickedInstanceId;
  console.log("[clickMarkerAction] Before instance filtering", {
    selectionUnit,
    activeInstance,
    stateActiveInstance: state.activeAnimationInstance,
    clickedInstanceId,
  });
  const instanceFilteredUnit = selectionUnit.filter((path) => {
    const parsed = parseMarkerPath(path);
    const matches = parsed.instanceId === activeInstance;
    console.log("[clickMarkerAction] Filter check", {
      path,
      parsedInstanceId: parsed.instanceId,
      activeInstance,
      matches,
    });
    return matches;
  });
  console.log("[clickMarkerAction] After instance filtering", {
    instanceFilteredUnit,
    originalCount: selectionUnit.length,
    filteredCount: instanceFilteredUnit.length,
  });

  const result: Partial<AnimationData> = {
    selectionState: updateSelectionState(state, instanceFilteredUnit, clickedPath),
  };

  // Set the active instance if it wasn't set
  if (needsInstanceUpdate) {
    result.activeAnimationInstance = clickedInstanceId;
  }

  return result;
}

/**
 * Handles timeline selection where all markers at a given timestamp are selected
 * Only selects markers from the active animation instance
 */
function handleTimelineSelection(
  state: AnimationData,
  markerId: string,
  sourceRowId: string,
  mod: boolean,
): Partial<AnimationData> {
  const markerInfo = state.computedRowData[sourceRowId]?.virtualFrames.find(
    (f) => f.id === markerId,
  );
  if (!markerInfo) return {};

  const currentSelectionState = state.selectionState || createEmptySelectionState();
  const activeInstance = state.activeAnimationInstance;
  if (!activeInstance) return {};

  // Get all markers at this timestamp
  const allPathsAtStamp: string[] = [];

  for (const [rowPath, rowData] of Object.entries(state.computedRowData)) {
    // Check if this row belongs to the active instance
    const pathParts = rowPath.split("/");
    if (pathParts.length >= 2 && pathParts[1] === activeInstance) {
      // Find markers at the same stamp
      const markersAtStamp =
        rowData.virtualFrames?.filter((f) => f.stamp === markerInfo.stamp) || [];
      for (const marker of markersAtStamp) {
        allPathsAtStamp.push(createMarkerPath(rowPath, marker.id));
      }
    }
  }

  if (mod) {
    // Check if all markers at this stamp are selected
    const allSelected = allPathsAtStamp.every((path) => currentSelectionState.pathSet.has(path));

    let newPaths: string[];
    if (allSelected) {
      // Remove all markers at this stamp
      newPaths = removeFromSelection(currentSelectionState, allPathsAtStamp);
    } else {
      // Add all markers at this stamp
      newPaths = addToSelection(currentSelectionState, allPathsAtStamp);
    }

    return {
      selectionState: updateSelectionState(state, newPaths, currentSelectionState.referenceMarker),
    };
  } else {
    // Simple click - select all at this stamp
    return {
      selectionState: updateSelectionState(
        state,
        allPathsAtStamp,
        createMarkerPath(sourceRowId, markerId),
      ),
    };
  }
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

/**
 * Helper to check if this is a timeline row
 */
function isTimelineRow(sourceRowId: string, sourceRow: any): boolean {
  return sourceRowId === "timeline" || sourceRow?.id === "timeline";
}

/**
 * Main entry point that decides whether to use timeline selection or regular selection
 */
export function clickMarkerWithTimelineSupport(
  state: AnimationData,
  markerId: string,
  sourceRowId: string,
  shift?: boolean,
  mod?: boolean,
): Partial<AnimationData> {
  const sourceRow = state.instancedTrackSources[sourceRowId];

  // Check if this is the timeline
  if (isTimelineRow(sourceRowId, sourceRow)) {
    return handleTimelineSelection(state, markerId, sourceRowId, mod || false);
  }

  // Use regular click handler
  return clickMarkerAction(state, markerId, sourceRowId, shift, mod);
}
