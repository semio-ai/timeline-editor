import type { TransitionPairing } from "../data/keypoint";
import type { TrackKey } from "./derived-snapshot";
import type { LayerBand } from "./layer-band";
import type { TransitionHandleKind } from "./segment-geometry";
import type { TrackRender } from "./track-render";

/** Supported scalar value types for rendering. */
export type ValueType = "number" | "string" | "boolean";

/** Min/max bounds for a row in literal value space. */
export interface ValueBounds {
  /** Lower bound. */
  min: number;
  /** Upper bound. */
  max: number;
}

/** Identifier for cached render samples. */
export type RenderSampleId = string;

/** Cached polyline sample used to draw segments efficiently. */
export interface PolylineSample {
  /** Sample cache id. */
  id: RenderSampleId;
  /** Interleaved point data (x/y or x/y/z). */
  points: Float32Array;
  /** Stride for the point array. */
  stride: 2 | 3;
}

/** Cache of render samples for reusing segment geometry. */
export interface RenderSampleCache {
  /** Samples indexed by id. */
  samples: Record<RenderSampleId, PolylineSample>;
  /**
   * Lookup by sample key (e.g., `${rowId}:${trackId}:value`) to avoid cross-row reuse
   * when render params differ across rows or views.
   */
  trackIndex?: Record<string, Partial<Record<TrackRender, RenderSampleId>>>;
}

/** 2D affine transform applied to cached samples. */
export interface AffineTransform2D {
  /** Scale on x axis. */
  scaleX: number;
  /** Scale on y axis. */
  scaleY: number;
  /** Translation on x axis. */
  offsetX: number;
  /** Translation on y axis. */
  offsetY: number;
}

/** Range of indices into a cached sample. */
export interface SegmentSampleRange {
  /** Point indices into the cached sample (end exclusive). */
  startIndex: number;
  endIndex: number;
}

/** Segment sample definition (direct or shared from cache). */
export type SegmentSample =
  | { kind: "direct"; points: Float32Array; stride: 2 | 3 }
  | {
      kind: "shared";
      sampleId: RenderSampleId;
      range: SegmentSampleRange;
      /** Transform applied to cached points. */
      transform: AffineTransform2D;
    };

/** Renderable segment between two keypoints. */
export interface RenderSegment {
  /** Segment id. */
  id: string;
  /** Track id associated with the segment. */
  trackId: string;
  /** Start keypoint id. */
  startKeypointId: string;
  /** End keypoint id. */
  endKeypointId: string;
  /** Whether this segment is a buffer/filler segment. */
  buffer?: boolean;
  /** Samples per render mode. */
  samples: Partial<Record<TrackRender, SegmentSample>>;
}

/** Renderable marker (keyframe) for a track. */
export interface RenderMarker {
  /** Marker id. */
  id: string;
  /** Track id containing this marker. */
  trackId: string;
  /** Full track key including namespace/instance. */
  trackKey: TrackKey;
  /** Optional namespace id (carried separately for convenience). */
  namespaceId?: string;
  /** Optional instance id (carried separately for convenience). */
  instanceId?: string;
  /** Optional animation id (for nested animation lookups). */
  animationId?: string;
  /** Optional animatable id for this marker. */
  animatableId?: string;
  /** Scalar value type for rendering. */
  valueType?: ValueType;
  /** Optional icon code used by the UI. */
  iconCode?: string;
  /** Whether this marker can be edited. */
  editable?: boolean;
  /** Whether this marker can be selected. */
  selectable?: boolean;
  /** Layer band used for z-ordering. */
  layerBand?: LayerBand;
  /** Normalized stamp for the marker. */
  stamp: number;
  /** Numeric value used for rendering (boolean maps to 0/1; string values are skipped). */
  value: number;
}

/** Renderable transition handle. */
export interface RenderHandle {
  /** Handle id. */
  id: string;
  /** Keypoint id owning this handle. */
  keypointId: string;
  /** Track id containing the keypoint. */
  trackId: string;
  /** Full track key including namespace/instance. */
  trackKey: TrackKey;
  /** Handle side (incoming or outgoing). */
  side: "in" | "out";
  /** Neighbor keypoint id the handle points toward. */
  neighborKeypointId?: string;
  /** Whether the handle is explicit or easing-derived. */
  kind: TransitionHandleKind;
  /** Current pairing intent. */
  pairing?: TransitionPairing;
  /** World-space handle position. */
  world: { x: number; y: number };
  /** Effective handle position after pairing/constraints. */
  effective?: { x: number; y: number };
}

/** Render-ready row data for the canvas. */
export interface RowRenderData {
  /** Markers to render for the row. */
  markers: RenderMarker[];
  /** Optional handles to render for the row. */
  handles?: RenderHandle[];
  /** Segments to render for the row. */
  segments: RenderSegment[];
}

/** Marker reference used to build selection frames. */
export interface SelectionPointRef {
  /** Marker id for this point. */
  markerId: string;
  /** Track id for this point. */
  trackId: string;
  /** Full track key including namespace/instance. */
  trackKey: TrackKey;
  /** Optional namespace id (carried separately for convenience). */
  namespaceId?: string;
  /** Optional instance id (carried separately for convenience). */
  instanceId?: string;
  /** Whether this point is selectable. */
  selectable?: boolean;
  /** Layer band for this point. */
  layerBand?: LayerBand;
}

/** Selection frame containing all points at a stamp. */
export interface SelectionFrame {
  /** Frame id. */
  id: string;
  /** Stamp for this frame. */
  stamp: number;
  /** Points included in the selection frame. */
  points: SelectionPointRef[];
}
