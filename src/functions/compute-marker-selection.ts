import { InstancedFrameInfo, Source } from "../types";
import { compareInstancedFrames, FrameComparison } from "./compare-instanced-frames";

/**
 * Helper function to check if a marker is already selected
 */
function isMarkerSelected(
  marker: InstancedFrameInfo,
  currentSelection: InstancedFrameInfo[],
): boolean {
  return currentSelection.some((s) => {
    const comparison = compareInstancedFrames(s, marker);
    return (
      comparison === FrameComparison.Equal ||
      comparison === FrameComparison.Subset ||
      comparison === FrameComparison.Superset
    );
  });
}

/**
 * Helper function to check if two markers share the same track based on sources
 */
function markersShareTrack(
  marker1: InstancedFrameInfo,
  sources1: Source[],
  marker2: InstancedFrameInfo,
  sources2: Source[],
): boolean {
  // Check if the sources arrays represent the same tracks
  if (sources1.length !== sources2.length) return false;

  // Compare track IDs from sources
  const trackIds1 = sources1.map((s) => s.trackId).sort();
  const trackIds2 = sources2.map((s) => s.trackId).sort();

  return trackIds1.every((id, idx) => id === trackIds2[idx]);
}

/**
 * Helper function to remove a marker from selection
 */
function removeFromSelection(
  marker: InstancedFrameInfo,
  selection: InstancedFrameInfo[],
): InstancedFrameInfo[] {
  const newSelection: InstancedFrameInfo[] = [];

  selection.forEach((selected) => {
    const comparison = compareInstancedFrames(selected, marker);

    if (comparison === FrameComparison.Equal) {
      // Skip this entirely - it's being removed
    } else if (comparison === FrameComparison.Subset) {
      // The selected item is a subset of the marker being removed
      // Skip this entirely - it's being removed
    } else if (comparison === FrameComparison.Superset) {
      // The selected item contains the marker's tracks - need to remove those tracks
      const remainingPoints = selected.points.filter(
        (p) => !marker.points.some((mp) => mp.trackId === p.trackId),
      );

      if (remainingPoints.length > 0) {
        newSelection.push({
          ...selected,
          points: remainingPoints,
        });
      }
    } else {
      // Incompatible or no overlap, keep as is
      newSelection.push(selected);
    }
  });

  return newSelection;
}

/**
 * Helper function to add markers between two stamps for specific tracks
 */
function addRangeBetween(
  fromStamp: number,
  toStamp: number,
  sources: Source[],
  allMarkersInTrack: InstancedFrameInfo[],
): InstancedFrameInfo[] {
  const minStamp = Math.min(fromStamp, toStamp);
  const maxStamp = Math.max(fromStamp, toStamp);
  const trackIds = sources.map((s) => s.trackId);

  const markersInRange = allMarkersInTrack.filter((m) => {
    if (m.stamp < minStamp || m.stamp > maxStamp) {
      return false;
    }
    // Filter by tracks from sources
    return m.points.some((p) => trackIds.includes(p.trackId));
  });

  // Group by stamp to merge markers
  const markersByStamp = new Map<number, InstancedFrameInfo>();

  markersInRange.forEach((marker) => {
    const existing = markersByStamp.get(marker.stamp);
    const relevantPoints = marker.points.filter((p) => trackIds.includes(p.trackId));

    if (existing) {
      const mergedPoints = [...existing.points];
      relevantPoints.forEach((newPoint) => {
        if (!mergedPoints.some((p) => p.trackId === newPoint.trackId)) {
          mergedPoints.push(newPoint);
        }
      });
      markersByStamp.set(marker.stamp, {
        ...existing,
        points: mergedPoints,
      });
    } else if (relevantPoints.length > 0) {
      markersByStamp.set(marker.stamp, {
        ...marker,
        points: relevantPoints,
      });
    }
  });

  return Array.from(markersByStamp.values());
}

/**
 * Helper function to merge a marker into the selection
 */
function mergeIntoSelection(
  marker: InstancedFrameInfo,
  selection: InstancedFrameInfo[],
): InstancedFrameInfo[] {
  const existingIdx = selection.findIndex((s) => s.stamp === marker.stamp);

  if (existingIdx >= 0) {
    const existing = selection[existingIdx];
    const mergedPoints = [...existing.points];
    marker.points.forEach((newPoint) => {
      if (!mergedPoints.some((p) => p.trackId === newPoint.trackId)) {
        mergedPoints.push(newPoint);
      }
    });

    return [
      ...selection.slice(0, existingIdx),
      { ...existing, points: mergedPoints },
      ...selection.slice(existingIdx + 1),
    ];
  } else {
    return [...selection, marker];
  }
}

/**
 * Computes the new selection state and reference marker after a marker click with various modifier keys.
 *
 * @param clickedMarker - The marker that was clicked
 * @param clickedSources - The sources for the clicked marker's track
 * @param allMarkersInTrack - All markers in the same track (for range selection)
 * @param currentSelection - The current selection state
 * @param currentReference - The current reference marker with its sources and add mode flag
 * @param shift - Whether shift key is held (range selection)
 * @param mod - Whether mod key (Cmd/Ctrl) is held (multi-select)
 * @returns The new selection array and reference marker
 */
export function computeMarkerSelection(
  clickedMarker: InstancedFrameInfo,
  clickedSources: Source[],
  allMarkersInTrack: InstancedFrameInfo[],
  currentSelection: InstancedFrameInfo[],
  currentReference: { marker: InstancedFrameInfo; sources: Source[]; isAddMode?: boolean } | null,
  shift?: boolean,
  mod?: boolean,
): {
  selection: InstancedFrameInfo[];
  reference: { marker: InstancedFrameInfo; sources: Source[]; isAddMode?: boolean } | null;
} {
  // Case 1: No modifier keys - clear everything, start fresh with clicked marker
  if (!shift && !mod) {
    return {
      selection: [clickedMarker],
      reference: { marker: clickedMarker, sources: clickedSources, isAddMode: false },
    };
  }

  // Case 2: Ctrl/Cmd key - toggle selection and set reference in add mode
  if (mod && !shift) {
    const isSelected = isMarkerSelected(clickedMarker, currentSelection);

    if (isSelected) {
      // Toggle off
      const newSelection = removeFromSelection(clickedMarker, currentSelection);

      // Handle reference marker update/clearing
      let newReference = currentReference;
      if (currentReference) {
        const comparison = compareInstancedFrames(currentReference.marker, clickedMarker);

        if (comparison === FrameComparison.Equal) {
          // Reference exactly matches clicked - clear it
          newReference = null;
        } else if (comparison === FrameComparison.Superset) {
          // Reference contains clicked marker's points - update reference to remaining points
          const remainingPoints = currentReference.marker.points.filter(
            (p) => !clickedMarker.points.some((cp) => cp.id === p.id),
          );

          if (remainingPoints.length > 0) {
            // Update reference to only have remaining points
            const remainingSources = currentReference.sources.filter((s) =>
              remainingPoints.some((p) => p.trackId === s.trackId),
            );
            newReference = {
              marker: { ...currentReference.marker, points: remainingPoints },
              sources: remainingSources,
              isAddMode: currentReference.isAddMode,
            };
          } else {
            // No points left in reference - clear it
            newReference = null;
          }
        }
      }

      return {
        selection: newSelection,
        reference: newReference,
      };
    } else {
      // Toggle on - add to selection and set as reference in add mode
      return {
        selection: mergeIntoSelection(clickedMarker, currentSelection),
        reference: { marker: clickedMarker, sources: clickedSources, isAddMode: true },
      };
    }
  }

  // Case 3: Shift key - range selection
  if (shift && !mod) {
    // Check if we have a reference and if it's in the same track
    if (
      currentReference &&
      markersShareTrack(
        clickedMarker,
        clickedSources,
        currentReference.marker,
        currentReference.sources,
      )
    ) {
      // Same track - create range between reference and clicked marker
      const rangeMarkers = addRangeBetween(
        currentReference.marker.stamp,
        clickedMarker.stamp,
        clickedSources,
        allMarkersInTrack,
      );

      // Edge case: if allMarkersInTrack is empty, we can't build a range
      if (allMarkersInTrack.length === 0) {
        return {
          selection: currentSelection,
          reference: currentReference,
        };
      }

      // Check if reference is in add mode (set via ctrl-click)
      const isAddMode = currentReference.isAddMode ?? false;

      if (isAddMode) {
        // In add mode, behavior depends on whether there are selections in other tracks
        const referenceTrackIds = currentReference.sources.map((s) => s.trackId);

        // Check if there are selections in other tracks
        const hasOtherTrackSelections = currentSelection.some((marker) =>
          marker.points.some((p) => !referenceTrackIds.includes(p.trackId)),
        );

        if (hasOtherTrackSelections) {
          // Multi-track scenario: replace range in reference track, preserve other tracks
          const markerMap = new Map<number, InstancedFrameInfo>();

          // Keep selections from other tracks only
          currentSelection.forEach((marker) => {
            // Filter out points that belong to the reference track
            const otherTrackPoints = marker.points.filter(
              (p) => !referenceTrackIds.includes(p.trackId),
            );

            // Only keep the marker if it has points in other tracks
            if (otherTrackPoints.length > 0) {
              markerMap.set(marker.stamp, {
                ...marker,
                points: otherTrackPoints,
              });
            }
          });

          // Merge in the new range markers
          rangeMarkers.forEach((marker) => {
            const existing = markerMap.get(marker.stamp);
            if (existing) {
              // Merge points at same timestamp
              const mergedPoints = [...existing.points];
              marker.points.forEach((newPoint) => {
                if (!mergedPoints.some((p) => p.trackId === newPoint.trackId)) {
                  mergedPoints.push(newPoint);
                }
              });
              markerMap.set(marker.stamp, { ...existing, points: mergedPoints });
            } else {
              markerMap.set(marker.stamp, marker);
            }
          });

          // Convert back to sorted array
          const newSelection = Array.from(markerMap.values()).sort((a, b) => a.stamp - b.stamp);

          return {
            selection: newSelection,
            reference: currentReference, // Keep the same reference with add mode
          };
        } else {
          // Single-track scenario: ADD the new range to existing selections
          const markerMap = new Map<number, InstancedFrameInfo>();

          // Keep all existing selections
          currentSelection.forEach((marker) => {
            markerMap.set(marker.stamp, marker);
          });

          // Merge in the new range markers
          rangeMarkers.forEach((marker) => {
            const existing = markerMap.get(marker.stamp);
            if (existing) {
              // Merge points at same timestamp
              const mergedPoints = [...existing.points];
              marker.points.forEach((newPoint) => {
                if (!mergedPoints.some((p) => p.trackId === newPoint.trackId)) {
                  mergedPoints.push(newPoint);
                }
              });
              markerMap.set(marker.stamp, { ...existing, points: mergedPoints });
            } else {
              markerMap.set(marker.stamp, marker);
            }
          });

          // Convert back to sorted array
          const newSelection = Array.from(markerMap.values()).sort((a, b) => a.stamp - b.stamp);

          return {
            selection: newSelection,
            reference: currentReference, // Keep the same reference with add mode
          };
        }
      } else {
        // REPLACE mode: replace selection in the reference track while preserving other tracks
        const referenceTrackIds = currentReference.sources.map((s) => s.trackId);

        // Keep selections from other tracks
        const otherTrackSelections = currentSelection.filter(
          (marker) => !marker.points.some((p) => referenceTrackIds.includes(p.trackId)),
        );

        // Merge other track selections with the new range
        const markerMap = new Map<number, InstancedFrameInfo>();

        // Add selections from other tracks
        otherTrackSelections.forEach((marker) => {
          markerMap.set(marker.stamp, marker);
        });

        // Merge in the new range markers
        rangeMarkers.forEach((marker) => {
          const existing = markerMap.get(marker.stamp);
          if (existing) {
            // Merge points at same timestamp
            const mergedPoints = [...existing.points];
            marker.points.forEach((newPoint) => {
              if (!mergedPoints.some((p) => p.trackId === newPoint.trackId)) {
                mergedPoints.push(newPoint);
              }
            });
            markerMap.set(marker.stamp, { ...existing, points: mergedPoints });
          } else {
            markerMap.set(marker.stamp, marker);
          }
        });

        // Convert back to sorted array
        const newSelection = Array.from(markerMap.values()).sort((a, b) => a.stamp - b.stamp);

        return {
          selection: newSelection,
          reference: currentReference, // Keep the same reference
        };
      }
    } else {
      // Different track or no reference - add single marker and set as reference
      return {
        selection: mergeIntoSelection(clickedMarker, currentSelection),
        reference: { marker: clickedMarker, sources: clickedSources, isAddMode: true },
      };
    }
  }

  // Case 4: Both Shift and Mod - treat like ctrl-click
  if (shift && mod) {
    const isSelected = isMarkerSelected(clickedMarker, currentSelection);

    if (isSelected) {
      // Toggle off
      const newSelection = removeFromSelection(clickedMarker, currentSelection);

      // Handle reference marker update/clearing
      let newReference = currentReference;
      if (currentReference) {
        const comparison = compareInstancedFrames(currentReference.marker, clickedMarker);

        if (comparison === FrameComparison.Equal) {
          // Reference exactly matches clicked - clear it
          newReference = null;
        } else if (comparison === FrameComparison.Superset) {
          // Reference contains clicked marker's points - update reference to remaining points
          const remainingPoints = currentReference.marker.points.filter(
            (p) => !clickedMarker.points.some((cp) => cp.id === p.id),
          );

          if (remainingPoints.length > 0) {
            // Update reference to only have remaining points
            const remainingSources = currentReference.sources.filter((s) =>
              remainingPoints.some((p) => p.trackId === s.trackId),
            );
            newReference = {
              marker: { ...currentReference.marker, points: remainingPoints },
              sources: remainingSources,
              isAddMode: currentReference.isAddMode,
            };
          } else {
            // No points left in reference - clear it
            newReference = null;
          }
        }
      }

      return {
        selection: newSelection,
        reference: newReference,
      };
    } else {
      // Toggle on - add to selection and set as reference in add mode
      return {
        selection: mergeIntoSelection(clickedMarker, currentSelection),
        reference: { marker: clickedMarker, sources: clickedSources, isAddMode: true },
      };
    }
  }

  // Default: return current state unchanged
  return {
    selection: currentSelection,
    reference: currentReference,
  };
}
