import type { TrackInterpolator } from "../data/interpolator";
import type { Violation } from "../data/violation";
import type { DragState } from "./drag-state";
import type { ComputedRowData } from "./computed-row-data";

export type TrackKey = `${string}/${string}/${string}`;

export interface DerivedTrackSnapshot {
  canonical: {
    interpolator: TrackInterpolator;
    derivative: TrackInterpolator;
    violations: Violation[];
  };
  preview?: {
    interpolator?: TrackInterpolator;
    violations?: Violation[];
  };
  metadata?: {
    animatableId: string;
    duration: number;
    timescale: number;
  };
}

export interface DerivedRowSnapshot {
  id: string;
  trackKeys: TrackKey[];
  computed: ComputedRowData;
}

export interface DerivedSnapshot {
  version?: number;
  dragContext?: DragState;
  tracks: Record<TrackKey, DerivedTrackSnapshot>;
  rows: Record<string, DerivedRowSnapshot>;
}
