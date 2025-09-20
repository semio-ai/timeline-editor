import { AnimatableValue, RawValue } from "@semio/utils";
import { pick, uniq } from "lodash";
import { ComputedRowData, DragState, SourceRow, Track, Violation } from "../types";
import { computeVirtualFrames } from "./compute-virtual-frames";
import { computeViolationSet } from "./compute-violation-set";
import { computeTransitionSegments } from "./compute-transition-segments";
import { computeFilledInterpGaps } from "./compute-filled-interp-gaps";
import { computeVerticalBounds } from "./compute-vertical-bounds";

export function computeRowData(
  sourceRow: SourceRow,
  tracks: Record<string, Track<RawValue>>,
  violations: Record<string, Violation[]>,
  animatables: Record<string, AnimatableValue>,
  dragState: DragState | null,
): ComputedRowData {
  const trackIds = uniq(sourceRow.data.map((t) => t.trackId));
  const filteredViolations = pick(violations, trackIds);
  const violationSet = computeViolationSet(filteredViolations);
  const relevantTracks = pick(tracks, trackIds);
  const virtualFrames = computeVirtualFrames(relevantTracks, dragState);
  const explicitInterpolationSegments = computeTransitionSegments(virtualFrames, trackIds);
  const interpolations = computeFilledInterpGaps(explicitInterpolationSegments);
  const verticalBounds = computeVerticalBounds(relevantTracks, animatables, [sourceRow]);

  const rowComputedData: ComputedRowData = {
    violationSet,
    virtualFrames,
    interpolations,
    verticalBounds: { min: verticalBounds[0], max: verticalBounds[1] },
  };

  return rowComputedData;
}
