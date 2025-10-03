/**
 * Selection system types for path-based marker selection
 */

/**
 * Complete selection state containing paths and cached data
 */
export interface SelectionState {
  // Core selection data
  paths: string[];                    // Array of "rowPath#markerId" strings
  referenceMarker: string | null;     // Path to anchor marker for shift-selection

  // Cached lookups for performance
  pathSet: Set<string>;               // For O(1) selection checks

  // Derived row-level state
  rowStates: Map<string, RowSelectionState>;  // rowPath -> selection state

  // Cached marker metadata (optional, for performance)
  markerInfo: Map<string, MarkerMetadata>;    // path -> { stamp, instanceId, etc }
}

/**
 * Row-level selection state for visual feedback
 */
export interface RowSelectionState {
  totalMarkers: number;
  selectedMarkers: number;
  state: 'none' | 'partial' | 'full';
}

/**
 * Cached metadata for a selected marker
 */
export interface MarkerMetadata {
  stamp: number;
  instanceId: string;
  value?: any;  // Optional cached value
}

/**
 * Parsed marker path components
 */
export interface ParsedMarkerPath {
  sourceRowId: string;
  markerId: string;
  instanceId?: string;  // Parsed from the path if included
}

/**
 * Entity types for hierarchical selection
 */
export enum EntityType {
  Group = 'group',      // Container (can have children)
  Track = 'track',      // Data holder (has keyframes, no children)
  Field = 'field'       // Legacy attribute (will be removed)
}

/**
 * Entity classification result
 */
export interface PathEntity {
  path: string;
  type: EntityType;
  isLeaf: boolean;
  canContainKeypoints: boolean;
  depth: number;
}

/**
 * Selection unit - what gets selected together
 */
export type SelectionUnit = string[];  // Array of paths that form an atomic selection

/**
 * Selection operation result
 */
export interface SelectionOperationResult {
  selectionState: SelectionState;
  affectedPaths?: string[];  // Paths that were added or removed
}

/**
 * Selection range specification
 */
export interface SelectionRange {
  startPath: string;
  endPath: string;
  sourceRowId: string;  // The row containing the range
}

/**
 * Helper type for marker existence check
 */
export interface MarkerExistence {
  path: string;
  exists: boolean;
  marker?: any;  // The actual marker data if it exists
}
