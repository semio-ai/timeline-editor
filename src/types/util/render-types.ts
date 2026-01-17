import type { TransitionPairing } from "../data/keypoint";
import type { TrackKey } from "./derived-snapshot";
import type { LayerBand } from "./layer-band";
import type { TransitionHandleKind } from "./segment-geometry";
import type { TrackRender } from "./track-render";

export type ValueType = "number" | "string" | "boolean";

export interface ValueBounds {
  min: number;
  max: number;
}

export type RenderSampleId = string;

export interface PolylineSample {
  id: RenderSampleId;
  points: Float32Array;
  stride: 2 | 3;
  resolution?: number;
}

export interface RenderSampleCache {
  samples: Record<RenderSampleId, PolylineSample>;
  /**
   * Lookup by sample key (e.g., `${trackId}:value` vs `${trackId}:flat`) to avoid
   * cross-row reuse when render params differ.
   */
  trackIndex?: Record<string, Partial<Record<TrackRender, RenderSampleId>>>;
}

export interface AffineTransform2D {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
}

export interface SegmentSampleRange {
  /** Point indices into the cached sample (end exclusive). */
  startIndex: number;
  endIndex: number;
}

export type SegmentSample =
  | { kind: "direct"; points: Float32Array; stride: 2 | 3 }
  | {
      kind: "shared";
      sampleId: RenderSampleId;
      range: SegmentSampleRange;
      transform: AffineTransform2D;
    };

export interface RenderSegment {
  id: string;
  trackId: string;
  startKeypointId: string;
  endKeypointId: string;
  buffer?: boolean;
  samples: Partial<Record<TrackRender, SegmentSample>>;
}

export interface RenderMarker {
  id: string;
  trackId: string;
  trackKey: TrackKey;
  namespaceId?: string;
  instanceId?: string;
  animationId?: string;
  animatableId?: string;
  valueType?: ValueType;
  iconCode?: string;
  editable?: boolean;
  selectable?: boolean;
  layerBand?: LayerBand;
  stamp: number;
  /** Numeric value used for rendering (boolean maps to 0/1; string values are skipped). */
  value: number;
  x: number;
  y: number;
}

export interface RenderHandle {
  id: string;
  keypointId: string;
  trackId: string;
  trackKey: TrackKey;
  side: "in" | "out";
  neighborKeypointId?: string;
  kind: TransitionHandleKind;
  pairing?: TransitionPairing;
  world: { x: number; y: number };
  effective?: { x: number; y: number };
}

export interface RowRenderData {
  markers: RenderMarker[];
  handles?: RenderHandle[];
  segments: RenderSegment[];
}

export interface SelectionPointRef {
  markerId: string;
  trackId: string;
  trackKey: TrackKey;
  namespaceId?: string;
  instanceId?: string;
  selectable?: boolean;
}

export interface SelectionFrame {
  id: string;
  stamp: number;
  points: SelectionPointRef[];
}
