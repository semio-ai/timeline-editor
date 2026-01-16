import type { TrackInterpolator } from "../data/interpolator";
import type { Violation } from "../data/violation";
import type { DragState } from "./drag-state";
import type { DragOverlay } from "./drag-overlay";
import type { ComputedRowData } from "./computed-row-data";
import type { RenderSampleCache } from "./render-types";

/**
 * DerivedSnapshot lifecycle:
 * - canonical: built from stored tracks/animations; includes interpolators/violations.
 * - preview: when dragState exists, a transient projection overlays deltas (handleDiffs/marker
 *   movement) onto canonical tracks to render UI without mutating canon.
 * - commit: apply deltas to canonical data, clear dragState, rebuild derived.
 *
 * `dragContext` holds the active drag; rows/tracks may include `preview` variants when a preview
 * differs from canonical.
 */
export type TrackInstanceKey = `${string}/${string}/${string}`;
export type TrackKey = TrackInstanceKey;

/** Per-track derived data (canonical and optional preview projections). */
export interface DerivedTrackSnapshot {
  canonical: {
    /** Interpolator built from canonical track data. */
    interpolator: TrackInterpolator;
    /** Derivative interpolator (for velocities). */
    derivative: TrackInterpolator;
    /** Violations computed from canonical data. */
    violations: Violation[];
  };
  preview?: {
    /** Interpolator for preview-only projection (if drag active). */
    interpolator?: TrackInterpolator;
    /** Violations for the preview projection. */
    violations?: Violation[];
  };
  metadata?: {
    /** Track id for this entry. */
    trackId?: string;
    /** Namespace id for this entry. */
    namespaceId?: string;
    /** Instance id for this entry. */
    instanceId?: string;
    /** Animatable id for this track. */
    animatableId: string;
    /** Animation duration for this track. */
    duration: number;
    /** Instance timescale for this track. */
    timescale: number;
    /** Instance offset for this track. */
    offset: number;
  };
}

export interface DerivedRowSnapshot {
  /** Row id. */
  id: string;
  /** Track keys present in this row. */
  trackKeys: TrackKey[];
  /** Computed row data (frames/render/violations). */
  computed: ComputedRowData;
}

/** Full derived snapshot for the store, optionally including a drag preview context. */
export interface DerivedSnapshot {
  version?: number;
  /** Active drag context (if any) used to build preview rows/tracks. */
  dragContext?: DragState;
  /** Derived drag overlay (optional, future use). */
  dragOverlay?: DragOverlay;
  /** Per-track derived data (canonical + optional preview). */
  tracks: Record<TrackKey, DerivedTrackSnapshot>;
  /** Per-row derived data (computed frames/render). */
  rows: Record<string, DerivedRowSnapshot>;
  /** Optional shared render sample cache for track-level reuse. */
  renderSampleCache?: RenderSampleCache;
}
