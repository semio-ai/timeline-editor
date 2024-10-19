import { pairwise } from "@semio/utils";
import { ViolationSet, Violation } from "../types";

export function computeViolationSet(
  violations: Record<string, Violation[]>,
  filter: string[],
): ViolationSet {
  const violationSet: ViolationSet = {
    id: crypto.randomUUID(),
    violations: {},
    segments: [],
  };

  const allTimes: number[] = [];

  // First, enumerate the whole set of violations based on the filter
  Object.entries(violations).forEach(([trackId, trackViolations]) => {
    if (filter.length === 0 || filter.includes(trackId)) {
      trackViolations.forEach((violation) => {
        violationSet.violations[violation.id] = violation;
        if (!allTimes.includes(violation.stampRange[0])) {
          allTimes.push(violation.stampRange[0]);
        }
        if (!allTimes.includes(violation.stampRange[1])) {
          allTimes.push(violation.stampRange[1]);
        }
      });
    }
  });

  // Next, enumerate the segments and add violations within each time range
  pairwise(allTimes.toSorted((a, b) => a - b)).forEach(([start, end]) => {
    const segmentViolations = Object.entries(violationSet.violations)
      .filter(([_, v]) => v.stampRange[0] <= start && v.stampRange[1] >= end)
      .map(([k, _]) => k);
    if (segmentViolations.length > 0) {
      violationSet.segments.push({
        id: crypto.randomUUID(),
        stampRange: [start, end],
        violations: segmentViolations,
      });
    }
  });

  return violationSet;
}
