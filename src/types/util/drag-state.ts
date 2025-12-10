/**
 * Drag lifecycle types.
 *
 * Canonical data lives in `tracks` and derived snapshots. During a drag:
 * - We take a snapshot of canonical points per track (`trackSnapshots`).
 * - We record deltas in `dragState` (stamp/value/handle diffs).
 * - Derived previews overlay `handleDiffs`/marker deltas onto canonical points to render a
 *   temporary view. No canonical mutation occurs until commit.
 * - On commit, the deltas are replayed against canonical tracks and a fresh derived snapshot
 *   is rebuilt; `dragState` is cleared.
 */
import type { RawValue, RawVector2 } from "@semio/utils";
import type { Keypoint, TransitionPairing } from "../data/keypoint";
import type { Track } from "../data/track";
import type { DiffOp, ProjectedTrackView, SelectionCleanup } from "./diff";
import type { WorldCP } from "./segment-geometry";

/** Axis constraint for drags. */
export type DragAxis = "horizontal" | "vertical" | "both";

/** Instance offset/timescale used to convert between world/local stamps during drag. */
export interface DragStampTransform {
  /** Instance offset applied to stamps when converting between world/local. */
  offset: number;
  /** Instance timescale applied to stamps when converting between world/local. */
  timescale: number;
}

/** Vertical/value scale used for clamping and precision during drags. */
export interface ValueScale {
  /** Inclusive domain for vertical/value movement. */
  domain: [number, number];
  /** Whether to clamp values to the domain. */
  clamp: boolean;
  /** Optional rounding precision for vertical/value edits. */
  precision?: number;
}

interface PointerPosition {
  x: number;
  y: number;
}

/** Anchor metadata identifying what is being dragged. */
export interface DragAnchorRef {
  /** Id of the keypoint being dragged/anchored. */
  keypointId: string;
  /** Track containing the keypoint. */
  trackId: string;
  /** Namespace containing the keypoint (used for stable frame ids). */
  namespaceId?: string;
  /** Instance containing the keypoint (used for stable frame ids). */
  instanceId?: string;
  /** Row containing the keypoint (for UI scoping). */
  rowId: string;
  /** Marker id used for selection/lookup (often same as keypoint). */
  markerId: string;
  /** Marker vs handle kind for the anchor. */
  kind?: "marker" | "handle-in" | "handle-out";
  /** Neighbor keypoint id used for handle context. */
  neighborKeypointId?: string;
  /** Attribute path for complex values. */
  attributePath?: string[];
  /** Optional vertical/value scale for the drag. */
  valueScale?: ValueScale;
}

/**
 * Central drag state captured at drag start and updated during pointer movement.
 * Holds snapshot references, deltas, and handle-specific context for preview;
 * canonical data remains untouched until commit applies these deltas.
 */
export interface DragState {
  /** Axis constraint for the drag. */
  axis: DragAxis;
  /** Active instance id (drag is scoped to a single instance). */
  instanceId: string;
  /** Instance transform captured at drag start. */
  instanceTransform: DragStampTransform;
  /** Anchor metadata for the drag. */
  anchor: DragAnchorRef;
  /** Stable frame id for the anchor during drag to avoid React remounts. */
  anchorFrameId?: string;
  /** Pointer position at drag start (normalized timeline x). */
  pointerOrigin: PointerPosition;
  /**
   * Canonical stamp/value at drag start; deltas are relative to these.
   * Not written back until commit.
   */
  stampOrigin?: number;
  stampDelta?: {
    /** Raw stamp delta (pre-snapping). */
    raw: number;
    /** Snapped stamp delta, if snapping applied. */
    snapped?: number;
  };
  /** Canonical value at drag start (if vertical dragging). */
  anchorValueOrigin?: number;
  /**
   * Vertical delta in normalized value space; preview uses this to project marker movement.
   */
  normalizedValueDelta?: number;
  /** Active modifier keys at last update. */
  modifiers: {
    alt: boolean;
    shift: boolean;
    meta: boolean;
  };
  /**
   * Marker handle offsets captured at drag start (world deltas). Used to keep handles attached
   * to markers during marker moves in preview.
   */
  markerHandleOffsets?: Record<string, DragMarkerHandleOffsets>;
  /**
   * Canonical track snapshots at drag start. Preview overlays deltas onto these without mutating
   * the live tracks.
   */
  trackSnapshots?: Record<string, TrackSnapshot>;
  /**
   * Pending diff ops computed during preview; replay these for commit to avoid recompute skew.
   */
  pendingDiffs?: DiffOp[];
  /** Selection cleanup emitted alongside pending diffs. */
  pendingSelectionCleanups?: SelectionCleanup[];
  /** Cached projected track views keyed by TrackKey. */
  projectedTracks?: ProjectedTrackView[];
  /** Active handle id when a handle drag is in progress. */
  activeHandleId?: string;
  /**
   * Handle deltas/pairing emitted during handle drags. Applied only in preview until commit.
   */
  handleDiffs?: Record<string, { in?: RawVector2; out?: RawVector2; pairing?: TransitionPairing }>;
  /** Context captured at handle-drag start for mirroring/math during preview. */
  handleAnchor?: {
    /** Which side is being dragged. */
    side: "in" | "out";
    /** Track/keypoint context. */
    trackId: string;
    keypointId: string;
    neighborKeypointId: string;
    /** Segment endpoints (anchor vs neighbor). */
    startStamp: number;
    endStamp: number;
    startValue: number;
    endValue: number;
    /** Control point world position at drag start. */
    controlPoint: WorldCP;
    attributePath?: string[];
    valueScale?: ValueScale;
    basePairing?: TransitionPairing;
    canonicalLengths?: { in?: number; out?: number };
    prevNeighbor?: { stamp: number; value: number } | null;
    nextNeighbor?: { stamp: number; value: number } | null;
  };
}

/** Payload for starting a marker drag. */
export interface DragStartInput {
  /** Pointer origin in timeline/value space. */
  origin: PointerPosition;
  /** Axis constraint for the drag. */
  axis: DragAxis;
  /** Marker being dragged. */
  markerId: string;
  /** Row containing the marker. */
  rowId: string;
  /**
   * Optional view-specific value scale to use for vertical drags.
   * When provided, this takes precedence over row-derived vertical bounds.
   */
  valueScale?: ValueScale;
}

/** Payload for updating a marker drag. */
export interface DragUpdateInput {
  /** Current pointer position in normalized timeline/value space. */
  pointer: PointerPosition;
  normalizedStamp?: {
    /** Current stamp (normalized) including raw movement. */
    current: number;
    /** Snapped stamp (normalized) if snapping applied. */
    snapped?: number;
  };
  /** Normalized vertical delta since drag start. */
  normalizedValueDelta?: number;
  /** Current modifier keys. */
  modifiers: DragState["modifiers"];
}

/** Payload for starting a handle drag. */
export interface HandleDragStartInput {
  /** Pointer origin in timeline/value space. */
  origin: PointerPosition;
  /** Handle side being dragged. */
  side: "in" | "out";
  /** Row context for the handle. */
  rowId: string;
  /** Track/keypoint context. */
  trackId: string;
  keypointId: string;
  neighborKeypointId: string;
  /** Attribute path for complex values. */
  attributePath?: string[];
  /** Optional value scale supplied by UI. */
  valueScale?: ValueScale;
  /** Control point world position at drag start. */
  controlPoint: WorldCP;
  /** Segment endpoints (stamps/values) around the handle. */
  startStamp: number;
  endStamp: number;
  startValue: number;
  endValue: number;
  /** Optional resolved pairing at drag start. */
  pairing?: TransitionPairing;
  /** Optional canonical view-space lengths for in/out. */
  canonicalLengths?: { in?: number; out?: number };
}

/** Payload for updating a handle drag. */
export interface HandleDragUpdateInput {
  /** Current pointer in normalized timeline/value space. */
  pointer: PointerPosition;
  /** Normalized vertical delta since drag start. */
  normalizedValueDelta?: number;
  /** Raw pointer movements in pixels (for view-space pairing). */
  movementX?: number;
  movementY?: number;
  /** Optional precomputed handle deltas from the UI (data space). */
  handleDeltas?: {
    in?: RawVector2;
    out?: RawVector2;
    pairing?: TransitionPairing;
    withinSnapTolerance?: boolean;
  };
  /** Current modifier keys. */
  modifiers: DragState["modifiers"];
}

/** Commit-time change for a keypoint field. */
export interface KeypointCommitDelta {
  id: string;
  trackId: string;
  stamp?: number;
  value?: {
    path?: string[];
    next: (current: RawValue) => RawValue;
  };
}

/** Snapshot of canonical points taken at drag start for a track. */
export interface TrackSnapshot {
  trackId: string;
  points: Keypoint<RawValue>[];
}

/** Changes applied to a keypoint when computing diffs. */
export interface TrackDiffChanges {
  stamp?: number;
  value?: RawValue;
  transitions?: Track<RawValue>["points"][number]["transitions"];
}

export type TrackDiff =
  | {
      type: "updateKeypoint";
      trackId: string;
      keypointId: string;
      changes: TrackDiffChanges;
    }
  | {
      type: "reorderKeypoints";
      trackId: string;
      order: string[];
    };

/** Marker handle offsets captured at drag start to keep handles attached to markers. */
export interface DragMarkerHandleOffsets {
  out?: DragHandleOffset;
  in?: DragHandleOffset;
}

/** Handle offset detail (world delta + neighbor info). */
export interface DragHandleOffset {
  delta: Pick<WorldCP, "x" | "y">;
  neighborKeypointId: string;
  fallback?: RawVector2;
}
