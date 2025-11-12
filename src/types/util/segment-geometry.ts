import type { RawVector2 } from "@semio/utils";
import type { TransitionParams } from "../../functions/compute-transition-params";
import type { TrackRender } from "./track-render";

export interface WorldCP {
  x: number;
  y: number;
}

export interface EndpointTransitions {
  startOut?: RawVector2;
  endIn?: RawVector2;
}

export interface ClampFlags {
  cp1Clamped?: boolean;
  cp2Clamped?: boolean;
  knotPrevented?: boolean;
}

export type SegmentRenderParams = Partial<Record<TrackRender, TransitionParams>>;

export interface SegmentGeometryState {
  transitions?: EndpointTransitions;
  controlPoints?: {
    cp1?: WorldCP;
    cp2?: WorldCP;
  };
  renderParams?: SegmentRenderParams;
}

export interface SegmentGeometry {
  raw: SegmentGeometryState;
  effective: SegmentGeometryState;
  flags?: ClampFlags;
}
