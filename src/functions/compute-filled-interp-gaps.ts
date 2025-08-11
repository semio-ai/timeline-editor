import { overlappingSegments } from "@semio/utils";
import { InstancedFrameInfo } from "../types";

interface InstancePair {
  start: InstancedFrameInfo;
  end: InstancedFrameInfo;
  buffer?: boolean;
}

export function computeFilledInterpGaps(
  interps: { start: InstancedFrameInfo; end: InstancedFrameInfo }[],
): InstancePair[] {
  // Compute gaps where no interpolations exist. Since these may be overlapping,
  // we should compute the overlapping segments first, and then fill in the gaps.
  const overlapping = overlappingSegments([
    [-Infinity, 0],
    ...(interps.map((i) => [i.start.stamp, i.end.stamp]) as [number, number][]),
    [1, Infinity],
  ]);

  if (overlapping.length > 1) {
    const fill: InstancePair[] = [];
    // If the length is greater than 1, we have gaps to fill
    let prevEnd = overlapping[0][1];

    for (let i = 1; i < overlapping.length; i++) {
      const currentStart = overlapping[i][0];
      // Redefine prevEnd to suppress warnings about unsafe access
      const end = prevEnd;
      const endPoints = interps
        .filter((interp) => interp.start.stamp === currentStart)
        .flatMap((interp) => interp.start.points);
      const startPoints = interps
        .filter((interp) => interp.end.stamp === end)
        .flatMap((interp) => interp.end.points);

      if (prevEnd !== currentStart) {
        fill.push({
          start: { stamp: prevEnd, id: `gap-${prevEnd.toString()}`, points: startPoints },
          end: { stamp: currentStart, id: `gap-${currentStart.toString()}`, points: endPoints },
          buffer: true,
        });
      }
      prevEnd = overlapping[i][1];
    }
    return [...interps, ...fill].toSorted((a, b) => a.start.stamp - b.start.stamp);
  } else return interps;
}
