import type { Violation } from "./violation";

export interface ViolationSet {
  id: string;
  namespace: string;
  violations: Record<string, Violation>;
  segments: {
    id: string;
    stampRange: [number, number];
    violations: string[];
  }[];
}
