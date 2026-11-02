import type { RawValue } from "@semio/data";
import type { TrackInterpolator } from "../data/interpolator";
import type { Track } from "../data/track";
import type { Violation } from "../data/violation";
import type { DragState } from "./drag-state";
import type { ComputedRowData } from "./computed-row-data";
import type { RenderSampleCache } from "./render-types";

/**
 * DerivedSnapshot lifecycle:
 * - canonical: built from stored tracks/animations; includes each track's compiled curve and its
 *   violations.
 * - preview: when dragState exists, a transient projection overlays deltas (handleDiffs/marker
 *   movement) onto canonical tracks without mutating canon, for the UI to render and a host to
 *   play while the drag lasts.
 * - commit: apply deltas to canonical data, clear dragState, rebuild derived.
 *
 * `dragContext` holds the active drag; rows/tracks may include `preview` variants when a preview
 * differs from canonical.
 */
/** Track key format: `${namespaceId}/${instanceId}/${trackId}`. */
export type TrackInstanceKey = `${string}/${string}/${string}`;
export type TrackKey = TrackInstanceKey;

/** Per-track derived data (canonical and optional preview projections). */
export interface DerivedTrackSnapshot {
  canonical: {
    /**
     * The track's value at a local time, evaluated exactly by the host
     * (`trackCurve`); `undefined` everywhere without an evaluator.
     */
    curve: TrackInterpolator;
    /** The curve's rate of change per second (for velocities). */
    derivative: TrackInterpolator;
    /** Violations computed from canonical data. */
    violations: Violation[];
  };
  preview?: {
    /**
     * The track as the commit of the drag in progress will write it: the
     * stored track with the points projected by the first row that holds it,
     * the row whose diffs the commit replays, alike for every instance that
     * plays the track. A host that plays tracks plays this one while the drag
     * lasts, so what it plays follows the drag and does not change at the
     * commit.
     */
    track?: Track<RawValue>;
    /** The curve of the preview-only projection (if drag active). */
    curve?: TrackInterpolator;
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
    /** Whether this track is muted (should not produce playback values). */
    muted?: boolean;
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
  /** Monotonic version used by selectors to detect updates. */
  version?: number;
  /** Active drag context (if any) used to build preview rows/tracks. */
  dragContext?: DragState;
  /** Per-track derived data (canonical + optional preview). */
  tracks: Record<TrackKey, DerivedTrackSnapshot>;
  /** Per-row derived data (computed frames/render). */
  rows: Record<string, DerivedRowSnapshot>;
  /** Optional shared render sample cache for track-level reuse. */
  renderSampleCache?: RenderSampleCache;
}
