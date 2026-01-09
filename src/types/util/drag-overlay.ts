import type { RawVector2 } from "@semio/utils";
import type { TransitionPairing } from "../data/keypoint";
import type { DiffOp, SelectionCleanup } from "./diff";
import type { DragAxis, TrackSnapshot } from "./drag-state";

export interface DragOverlayState {
  instanceId: string;
  axis: DragAxis;
  anchor: {
    keypointId: string;
    trackId: string;
    rowId: string;
    namespaceId?: string;
    instanceId?: string;
  };
  trackSnapshots?: Record<string, TrackSnapshot>;
  stampDelta?: { raw: number; snapped?: number };
  normalizedValueDelta?: number;
  handleDiffs?: Record<string, { in?: RawVector2; out?: RawVector2; pairing?: TransitionPairing }>;
  pendingDiffs?: DiffOp[];
  pendingSelectionCleanups?: SelectionCleanup[];
}

export interface DragOverlay {
  state: DragOverlayState;
  draggedTrackIds: Set<string>;
}
