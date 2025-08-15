import { pairwise } from "@semio/utils";
import { ViolationSet, Violation } from "../types";

// Simple deterministic ID generation based on content
function createDeterministicId(content: string): string {
  // Simple hash function for deterministic IDs without bitwise operations
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash * 31 + char) % 2147483647; // Use prime multiplication and modulo
  }
  return Math.abs(hash).toString(36);
}

export function computeViolationSet(violations: Record<string, Violation[]>): ViolationSet {
  const violationSet: ViolationSet = {
    id: "", // Will be set after processing all violations
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

  // Generate deterministic violation set ID based on all violation IDs
  const allViolationIds = Object.keys(violationSet.violations).sort().join(",");
  violationSet.id = `violationset-${createDeterministicId(allViolationIds)}`;

  return violationSet;
}
