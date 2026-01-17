import { SemanticTime } from "./semantic-time";

/** Highlighted timestamp used for UI overlays (hover, current time, bounds, etc.). */
export interface Preview {
  /** Normalized stamp (0-1) of the preview marker. */
  stamp: number;
  /** Semantic classification for the preview marker. */
  semanticTime: SemanticTime;
}
