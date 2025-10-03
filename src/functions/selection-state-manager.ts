/**
 * Selection State Manager
 * Utilities for managing path-based selection state
 */

import { AnimationData } from "../store-types";
import {
  SelectionState,
  RowSelectionState,
  MarkerMetadata,
  ParsedMarkerPath,
  PathEntity,
  EntityType,
  SelectionUnit,
} from "../types/util/selection-state";
import { SourceRow } from "../types";

// Re-export types that are used by other modules
export type { SelectionState };

/**
 * Parse a marker path into its components
 */
export function parseMarkerPath(path: string): ParsedMarkerPath {
  const [sourceRowId, markerId] = path.split("#");
  if (!sourceRowId || !markerId) {
    throw new Error(`Invalid marker path: ${path}`);
  }

  // Extract instance ID from the path if it exists
  const pathParts = sourceRowId.split("/");
  const instanceId = pathParts.length >= 2 ? pathParts[1] : undefined;

  return {
    sourceRowId,
    markerId,
    instanceId,
  };
}

/**
 * Create a marker path from components
 */
export function createMarkerPath(sourceRowId: string, markerId: string): string {
  return `${sourceRowId}#${markerId}`;
}

/**
 * Create an empty selection state
 */
export function createEmptySelectionState(): SelectionState {
  return {
    paths: [],
    referenceMarker: null,
    pathSet: new Set(),
    rowStates: new Map(),
    markerInfo: new Map(),
  };
}

/**
 * Update selection state with new paths
 */
export function updateSelectionState(
  state: AnimationData,
  newPaths: string[],
  referenceMarker?: string | null,
): SelectionState {
  const selectionState: SelectionState = {
    paths: newPaths,
    referenceMarker:
      referenceMarker !== undefined
        ? referenceMarker
        : state.selectionState?.referenceMarker || null,
    pathSet: new Set(newPaths),
    rowStates: new Map(),
    markerInfo: new Map(),
  };

  // Update row states
  updateRowStates(state, selectionState);

  // Cache marker info
  cacheMarkerInfo(state, selectionState);

  return selectionState;
}

/**
 * Update row selection states based on selected paths
 */
function updateRowStates(state: AnimationData, selectionState: SelectionState): void {
  // Group selections by row
  const rowGroups = new Map<string, string[]>();

  for (const path of selectionState.paths) {
    const { sourceRowId } = parseMarkerPath(path);
    if (!rowGroups.has(sourceRowId)) {
      rowGroups.set(sourceRowId, []);
    }
    rowGroups.get(sourceRowId)!.push(path);
  }

  // Calculate state for each row
  for (const [rowPath, rowData] of Object.entries(state.computedRowData || {})) {
    const totalMarkers = rowData.virtualFrames?.length || 0;
    const selectedPaths = rowGroups.get(rowPath) || [];
    const selectedMarkers = selectedPaths.length;

    const rowState: RowSelectionState = {
      totalMarkers,
      selectedMarkers,
      state: selectedMarkers === 0 ? "none" : selectedMarkers === totalMarkers ? "full" : "partial",
    };

    selectionState.rowStates.set(rowPath, rowState);
  }
}

/**
 * Cache marker metadata for selected markers
 */
function cacheMarkerInfo(state: AnimationData, selectionState: SelectionState): void {
  for (const path of selectionState.paths) {
    const { sourceRowId, markerId } = parseMarkerPath(path);
    const rowData = state.computedRowData?.[sourceRowId];

    if (rowData?.virtualFrames) {
      const marker = rowData.virtualFrames.find((f) => f.id === markerId);
      if (marker) {
        const metadata: MarkerMetadata = {
          stamp: marker.stamp,
          instanceId: parseMarkerPath(path).instanceId || "",
        };
        selectionState.markerInfo.set(path, metadata);
      }
    }
  }
}

/**
 * Check if a specific marker is selected
 */
export function isMarkerSelected(
  selectionState: SelectionState,
  sourceRowId: string,
  markerId: string,
): boolean {
  const path = createMarkerPath(sourceRowId, markerId);
  return selectionState.pathSet.has(path);
}

/**
 * Get row selection state
 */
export function getRowSelectionState(
  selectionState: SelectionState,
  rowPath: string,
): RowSelectionState | undefined {
  return selectionState.rowStates.get(rowPath);
}

/**
 * Check if a row is fully selected
 */
export function isRowFullySelected(selectionState: SelectionState, rowPath: string): boolean {
  return selectionState.rowStates.get(rowPath)?.state === "full";
}

/**
 * Check if a row is partially selected
 */
export function isRowPartiallySelected(selectionState: SelectionState, rowPath: string): boolean {
  return selectionState.rowStates.get(rowPath)?.state === "partial";
}

/**
 * Get all selected markers in a specific row
 */
export function getSelectedMarkersInRow(selectionState: SelectionState, rowPath: string): string[] {
  return selectionState.paths.filter((p) => {
    const { sourceRowId } = parseMarkerPath(p);
    return sourceRowId === rowPath;
  });
}

/**
 * Filter selection by animation instance
 */
export function filterSelectionByInstance(
  selectionState: SelectionState,
  instanceId: string,
): string[] {
  return selectionState.paths.filter((path) => {
    const parsed = parseMarkerPath(path);
    return parsed.instanceId === instanceId;
  });
}

/**
 * Classify entity type based on path and state
 */
export function classifyEntity(state: AnimationData, path: string): PathEntity {
  const depth = path.split("/").length;
  const sourceRow = state.instancedTrackSources?.[path];

  // Check if it's a group (has children or is a complex datatype)
  const hasChildren = Object.keys(state.instancedTrackSources || {}).some(
    (p) => p.startsWith(path + "/") && p !== path,
  );

  // Depth 4 indicates attributes (e.g., position/x)
  const isAttribute = depth === 4;

  let type: EntityType;
  let canContainKeypoints: boolean;

  if (hasChildren || (sourceRow && isGroupRow(sourceRow))) {
    type = EntityType.Group;
    canContainKeypoints = false;
  } else if (isAttribute) {
    type = EntityType.Field;
    canContainKeypoints = true;
  } else {
    type = EntityType.Track;
    canContainKeypoints = true;
  }

  return {
    path,
    type,
    isLeaf: !hasChildren,
    canContainKeypoints,
    depth,
  };
}

/**
 * Check if a source row is a group
 */
export function isGroupRow(sourceRow: SourceRow): boolean {
  // A group row has data.length > 1 (multiple tracks/properties)
  return sourceRow.data.length > 1;
}

/**
 * Get selection unit for a clicked marker
 * Finds all markers across different views that represent the same data points
 */
export function getSelectionUnit(
  state: AnimationData,
  sourceRowId: string,
  markerId: string,
): SelectionUnit {
  const unit: string[] = [];
  const clickedData = state.computedRowData?.[sourceRowId];

  if (!clickedData?.virtualFrames) {
    // No data available, just return the clicked marker
    unit.push(createMarkerPath(sourceRowId, markerId));
    return unit;
  }

  // Find the clicked marker
  const clickedMarker = clickedData.virtualFrames.find((f) => f.id === markerId);

  if (!clickedMarker) {
    // Marker not found, return empty
    return unit;
  }

  console.log("[getSelectionUnit] Clicked marker", {
    sourceRowId,
    markerId,
    pointsCount: clickedMarker.points?.length || 0,
  });

  // Build a set of all the points we need to select
  const pointsToSelect = new Set<string>();

  // Helper to create a canonical point ID
  const getPointKey = (point: any) => {
    return `${point.namespaceId}/${point.instanceId}/${point.trackId}/${point.attribute || ""}#${point.id}`;
  };

  if (clickedMarker.points && clickedMarker.points.length > 0) {
    // Add all points from the clicked marker
    for (const point of clickedMarker.points) {
      pointsToSelect.add(getPointKey(point));
    }

    console.log("[getSelectionUnit] Points to select:", Array.from(pointsToSelect));
  }

  // Now find ALL markers across ALL views that contain any of these points
  for (const [rowId, rowData] of Object.entries(state.computedRowData || {})) {
    for (const frame of rowData.virtualFrames || []) {
      if (!frame.points || frame.points.length === 0) {
        continue;
      }

      // Check if this marker's points match our selection
      let hasMatchingPoints = false;

      if (pointsToSelect.size > 0) {
        // Check if all points in this marker are in our selection set
        const markerPointKeys = frame.points.map((p) => getPointKey(p));

        // For exact match: all points must match
        if (markerPointKeys.length === pointsToSelect.size) {
          hasMatchingPoints = markerPointKeys.every((key) => pointsToSelect.has(key));
        }

        // For partial match: if this marker contains a subset of our points
        // (e.g., attribute markers that are part of a group)
        if (!hasMatchingPoints && markerPointKeys.some((key) => pointsToSelect.has(key))) {
          // Check if this is an attribute row that matches one of our points
          const sourceRow = state.instancedTrackSources?.[rowId];
          if (sourceRow?.data?.[0]?.attribute) {
            hasMatchingPoints = true;
          }
        }
      }

      // Also check if the clicked marker's points contain this frame's points
      // (for selecting parent when clicking child)
      if (!hasMatchingPoints && clickedMarker.points) {
        const clickedPointKeys = clickedMarker.points.map((p) => getPointKey(p));
        const framePointKeys = frame.points.map((p) => getPointKey(p));

        // If clicked marker has a single point that matches a point in a multi-point marker
        if (clickedPointKeys.length === 1 && framePointKeys.includes(clickedPointKeys[0])) {
          // This is likely an attribute click - select the parent group
          hasMatchingPoints = true;

          // Also add all sibling attributes
          for (const siblingPoint of frame.points) {
            pointsToSelect.add(getPointKey(siblingPoint));
          }
        }
      }

      if (hasMatchingPoints) {
        const markerPath = createMarkerPath(rowId, frame.id);
        if (!unit.includes(markerPath)) {
          console.log("[getSelectionUnit] Adding matching marker:", rowId, frame.id);
          unit.push(markerPath);
        }
      }
    }
  }

  // If we didn't find any matches, at least include the clicked marker
  if (unit.length === 0) {
    unit.push(createMarkerPath(sourceRowId, markerId));
  }

  console.log("[getSelectionUnit] Final selection unit:", unit);
  return unit;
}

/**
 * Helper to construct a path from SourceRowData
 */
function constructPathFromSourceData(data: any): string | null {
  if (!data.namespaceId || !data.instanceId || !data.trackId) {
    return null;
  }

  let path = `${data.namespaceId}/${data.instanceId}/${data.trackId}`;

  // Add attribute if present
  if (data.attribute) {
    path += `/${data.attribute}`;
  }

  return path;
}

/**
 * Get range selection between two markers
 */
export function getRangeSelection(
  state: AnimationData,
  startPath: string,
  endPath: string,
): string[] {
  const startParsed = parseMarkerPath(startPath);
  const endParsed = parseMarkerPath(endPath);

  // Range selection only works within the same row
  if (startParsed.sourceRowId !== endParsed.sourceRowId) {
    return [endPath]; // Fall back to single selection
  }

  const rowData = state.computedRowData?.[startParsed.sourceRowId];
  if (!rowData?.virtualFrames) {
    return [endPath];
  }

  // Find the stamps for range
  const startMarker = rowData.virtualFrames.find((f) => f.id === startParsed.markerId);
  const endMarker = rowData.virtualFrames.find((f) => f.id === endParsed.markerId);

  if (!startMarker || !endMarker) {
    return [endPath];
  }

  const minStamp = Math.min(startMarker.stamp, endMarker.stamp);
  const maxStamp = Math.max(startMarker.stamp, endMarker.stamp);

  const rangePaths: string[] = [];
  const sourceRow = state.instancedTrackSources?.[startParsed.sourceRowId];

  // Get markers in range
  for (const frame of rowData.virtualFrames) {
    if (frame.stamp >= minStamp && frame.stamp <= maxStamp) {
      const unit = getSelectionUnit(state, startParsed.sourceRowId, frame.id);
      rangePaths.push(...unit);
    }
  }

  // Remove duplicates
  return Array.from(new Set(rangePaths));
}

/**
 * Add paths to selection
 */
export function addToSelection(currentSelection: SelectionState, pathsToAdd: string[]): string[] {
  const combined = new Set([...currentSelection.paths, ...pathsToAdd]);
  return Array.from(combined);
}

/**
 * Remove paths from selection
 */
export function removeFromSelection(
  currentSelection: SelectionState,
  pathsToRemove: string[],
): string[] {
  const toRemoveSet = new Set(pathsToRemove);
  return currentSelection.paths.filter((p) => !toRemoveSet.has(p));
}

/**
 * Toggle paths in selection
 */
export function toggleInSelection(
  currentSelection: SelectionState,
  pathsToToggle: string[],
): string[] {
  const currentSet = new Set(currentSelection.paths);
  const result = new Set(currentSelection.paths);

  for (const path of pathsToToggle) {
    if (currentSet.has(path)) {
      result.delete(path);
    } else {
      result.add(path);
    }
  }

  return Array.from(result);
}

/**
 * Clear selection
 */
export function clearSelection(): string[] {
  return [];
}

/**
 * Select all markers in the active animation instance
 */
export function selectAllInInstance(state: AnimationData, instanceId: string): string[] {
  const allPaths: string[] = [];

  for (const [rowPath, rowData] of Object.entries(state.computedRowData || {})) {
    // Check if this row belongs to the instance
    const pathParts = rowPath.split("/");
    if (pathParts.length >= 2 && pathParts[1] === instanceId) {
      for (const frame of rowData.virtualFrames || []) {
        allPaths.push(createMarkerPath(rowPath, frame.id));
      }
    }
  }

  return allPaths;
}

/**
 * Invert selection within the active animation instance
 */
export function invertSelectionInInstance(
  state: AnimationData,
  currentSelection: SelectionState,
  instanceId: string,
): string[] {
  const allPathsInInstance = selectAllInInstance(state, instanceId);
  const currentPathsInInstance = filterSelectionByInstance(currentSelection, instanceId);
  const currentSet = new Set(currentPathsInInstance);

  // Get paths from other instances that should be preserved
  const otherInstancePaths = currentSelection.paths.filter((path) => {
    const parsed = parseMarkerPath(path);
    return parsed.instanceId !== instanceId;
  });

  // Invert within instance
  const invertedInInstance = allPathsInInstance.filter((p) => !currentSet.has(p));

  // Combine with other instance selections
  return [...otherInstancePaths, ...invertedInInstance];
}

/**
 * Check if selection unit is fully selected
 */
export function isUnitFullySelected(selectionState: SelectionState, unit: SelectionUnit): boolean {
  return unit.every((path) => selectionState.pathSet.has(path));
}

/**
 * Check if selection unit is partially selected
 */
export function isUnitPartiallySelected(
  selectionState: SelectionState,
  unit: SelectionUnit,
): boolean {
  const selectedCount = unit.filter((path) => selectionState.pathSet.has(path)).length;
  return selectedCount > 0 && selectedCount < unit.length;
}
