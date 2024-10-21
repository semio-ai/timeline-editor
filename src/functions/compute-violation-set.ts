import { pairwise } from "@semio/utils";
import { ViolationSet, Violation } from "../types";

export function computeViolationSet(violations: Record<string, Violation[]>): ViolationSet {
  const violationSet: ViolationSet = {
    id: crypto.randomUUID(),
    violations: {},
    segments: [],
  };

  const allTimes: Set<number> = new Set<number>();

  // First, enumerate the whole set of violations based on the filter
  Object.values(violations).forEach((trackViolations) => {
    trackViolations.forEach((violation) => {
      violationSet.violations[violation.id] = violation;
      allTimes.add(violation.stampRange.start);
      allTimes.add(violation.stampRange.end);
    });
  });

  // Next, enumerate the segments and add violations within each time range
  pairwise(Array.from(allTimes).toSorted((a, b) => a - b)).forEach(([start, end]) => {
    const segmentViolations = Object.entries(violationSet.violations)
      .filter(([_, v]) => v.stampRange.start <= start && v.stampRange.end >= end)
      .map(([k, _]) => k);
    if (segmentViolations.length > 0) {
      violationSet.segments.push({
        id: crypto.randomUUID(),
        stampRange: { start, end },
        violations: segmentViolations,
      });
    }
  });

  return violationSet;
}
