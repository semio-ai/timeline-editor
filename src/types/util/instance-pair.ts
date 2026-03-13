import { InstancedFrameInfo } from "./instanced-frame-info";
import type { SegmentGeometry } from "./segment-geometry";

/** Pair of instanced frames forming a transition segment. */
export interface InstancePair {
  /** Segment start frame. */
  start: InstancedFrameInfo;
  /** Segment end frame. */
  end: InstancedFrameInfo;
  /** Whether this segment is a buffer/filler segment. */
  buffer?: boolean;
  /** Optional precomputed geometry for rendering. */
  geometry?: SegmentGeometry;
}
