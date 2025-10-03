/**
 * Selection State Manager
 * Handles all operations related to the path-based selection system
 */

import { AnimationData } from '../store-types';
import { InstancedFrameInfo } from '../types';
import {
  SelectionState,
  RowSelectionState,
  MarkerMetadata,
  ParsedMarkerPath,
  SelectionUnit,
  EntityType,
  PathEntity
} from './types';

/**
 * Main selection state manager class
 */
export class SelectionStateManager {
  /**
   * Creates an empty selection state
   */
  static createEmpty(): SelectionState {
    return {
      paths: [],
      referenceMarker: null,
      pathSet: new Set(),
      rowStates: new Map(),
      markerInfo: new Map()
    };
  }

  /**
   * Updates selection with new paths and rebuilds cached data
   */
  static updateSelection(
    state: AnimationData,
    newPaths: string[],
    referenceMarker?: string | null
  ): SelectionState {
    const selectionState: SelectionState = {
      paths: newPaths,
      referenceMarker: referenceMarker !== undefined ? referenceMarker : state.selectionState?.referenceMarker || null,
      pathSet: new Set(newPaths),
      rowStates: new Map(),
      markerInfo: new Map()
    };

    // Rebuild row states
    this.updateRowStates(state, selectionState);

    // Cache marker info for performance
    this.cacheMarkerInfo(state, selectionState);

    return selectionState;
  }

  /**
   * Set the reference marker for shift-selection
   */
  static setReference(selectionState: SelectionState, referencePath: string | null): SelectionState {
    return {
      ...selectionState,
      referenceMarker: referencePath
    };
  }

  /**
   * Updates row selection states based on current selection
   */
  private static updateRowStates(
    state: AnimationData,
    selectionState: SelectionState
  ):
