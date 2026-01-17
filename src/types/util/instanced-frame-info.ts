import { RawValue, RawVector2 } from "@semio/utils";
import type { StandardTransitionType, TransitionPairing } from "../data/keypoint";
import { SourceRowData } from "./source";

/**
 * Instanced marker frame composed from one or more track keypoints that share a stamp.
 */
export interface InstancedFrameInfo {
  /** Stable frame id (used to key markers/segments). */
  id: string;
  /** Normalized stamp for this frame. */
  stamp: number;
  /** Points contributing to this frame, including track/instance metadata. */
  points: (SourceRowData & { id: string; value: RawValue })[];
  /**
   * Transition info for the frame. Incoming handles apply to the segment
   * before this frame; outgoing handles apply to the segment after it.
   */
  transitions?: {
    /** Incoming transition handle. */
    in?: RawVector2 | StandardTransitionType;
    /** Outgoing transition handle. */
    out?: RawVector2 | StandardTransitionType;
    /** Pairing intent for in/out handles. */
    pairing?: TransitionPairing;
  };
}
