import type { RawValue } from "@semio/data";
import type { Track, InstancedFrameInfo, SourceRow, Keypoint } from "../types";
import { StandardTransitionType } from "../types";

interface ComputeFramesOptions {
  draggingKeypointIds?: Set<string>;
  /**
   * The key as the row shows it, for a preview that moves keys. It must keep
   * the key's id: frames group by it.
   */
  transformKeypoint?: (
    keypoint: Keypoint<RawValue>,
    context: { trackId: string; source: SourceRow["data"][number] },
  ) => Keypoint<RawValue>;
  /**
   * When true, frames at the same stamp are merged regardless of dragging state.
   * Useful for marker projections where drag vs non-drag points should coexist.
   */
  ignoreDraggingState?: boolean;
  /**
   * If provided, any frame containing this keypoint id will use it as the frame id
   * to keep React keys stable during drag.
   */
  anchorFrameKey?: string;
  /**
   * Explicit frame id to use for the anchor frame (stable across canonical/preview).
   * Only applied when anchorFrameKey matches and namespace/instance also match.
   */
  anchorFrameId?: string;
  anchorTrackId?: string;
  anchorNamespaceId?: string;
  anchorInstanceId?: string;
}

/**
 * Groups a row's keys into frames: one frame per stamp, holding every key at
 * that stamp across the row's visible tracks and instances.
 *
 * Unless `ignoreDraggingState` is set, keys being dragged and keys at rest
 * never share a frame, so a stamp can have one frame of each. A frame's id is
 * built from all of its points, sorted, so it does not depend on the order the
 * tracks were visited in. Its transitions are its first point's.
 *
 * Frames are looked up by stamp and points by identity, so the cost is linear
 * in the number of keys plus the final sort by stamp. Aggregate rows (a group,
 * or the global row) hold every key in the clip, so a scan per key would be
 * quadratic there.
 *
 * @param tracks - The tracks the row's entries refer to, by id.
 * @param sourceRow - The row: which track instances it shows.
 * @returns The frames, sorted by stamp; frames at one stamp keep the order they
 * were first met in.
 */
export function computeFrames(
  tracks: Record<string, Track<RawValue>>,
  sourceRow: SourceRow,
  options: ComputeFramesOptions = {},
): InstancedFrameInfo[] {
  const frames: InstancedFrameInfo[] = [];
  // Per frame, the identities of the points it holds.
  const pointKeys = new Map<InstancedFrameInfo, Set<string>>();
  // Frames by stamp: [at rest, dragging]. With `ignoreDraggingState` only the
  // first slot is used.
  const byStamp = new Map<number, [InstancedFrameInfo?, InstancedFrameInfo?]>();
  const { draggingKeypointIds, transformKeypoint, ignoreDraggingState } = options;

  sourceRow.data.forEach((sourceRowData) => {
    // Skip hidden tracks — they should not produce markers, lines, or selection points
    if (sourceRowData.visible === false) return;
    const trackId = sourceRowData.trackId;
    const emittedTrackId: string = (sourceRowData as any).trackIdBase ?? trackId;
    const trackData = tracks[trackId];
    trackData.points.forEach((point) => {
      const previewPoint = transformKeypoint?.(point, { trackId, source: sourceRowData }) ?? point;
      const slot = !ignoreDraggingState && draggingKeypointIds?.has(point.id) ? 1 : 0;
      const value = previewPoint.value;
      const stamp = previewPoint.stamp;
      const pointKey = framePointKey(
        previewPoint.id,
        emittedTrackId,
        sourceRowData.namespaceId,
        sourceRowData.instanceId,
      );

      const slots = byStamp.get(stamp);
      const existing = slots?.[slot];
      if (existing) {
        const keys = pointKeys.get(existing)!;
        if (keys.has(pointKey)) return;
        keys.add(pointKey);
        existing.points.push({
          ...sourceRowData,
          id: previewPoint.id,
          type: typeof value as "number" | "string" | "boolean",
          value,
          trackId: emittedTrackId,
        });
        return;
      }

      const frame: InstancedFrameInfo = {
        id: "",
        stamp,
        points: [
          {
            ...sourceRowData,
            id: previewPoint.id,
            value,
            type: typeof value as "number" | "string" | "boolean",
            trackId: emittedTrackId,
          },
        ],
        transitions: withDefaultTransitions(previewPoint.transitions),
      };
      frames.push(frame);
      pointKeys.set(frame, new Set([pointKey]));
      // NaN equals no stamp, itself included, so a NaN-stamped key always
      // starts a frame of its own and is never found by a later one.
      if (!Number.isNaN(stamp)) {
        if (slots) slots[slot] = frame;
        else byStamp.set(stamp, slot === 0 ? [frame] : [undefined, frame]);
      }
    });
  });

  frames.forEach((frame) => {
    frame.id = frame.points
      .map((p) => `${p.id}-${p.trackId}-${p.namespaceId ?? "ns"}-${p.instanceId ?? "inst"}`)
      .sort()
      .join("-");
  });

  const sortedFrames = frames.toSorted((a, b) => a.stamp - b.stamp);

  // Apply stable anchor frame id when provided and matching namespace/instance.
  if (options.anchorFrameKey && options.anchorFrameId) {
    sortedFrames.forEach((frame) => {
      const hasAnchor = frame.points.some(
        (p) =>
          p.id === options.anchorFrameKey &&
          (!options.anchorTrackId || p.trackId === options.anchorTrackId) &&
          (!options.anchorNamespaceId || p.namespaceId === options.anchorNamespaceId) &&
          (!options.anchorInstanceId || p.instanceId === options.anchorInstanceId),
      );
      if (hasAnchor) {
        frame.id = options.anchorFrameId!;
      }
    });
  }

  return sortedFrames;
}

function withDefaultTransitions(
  transitions?: InstancedFrameInfo["transitions"],
): InstancedFrameInfo["transitions"] {
  return {
    in: transitions?.in ?? StandardTransitionType.Cubic,
    out: transitions?.out ?? StandardTransitionType.Cubic,
    pairing: transitions?.pairing,
  };
}

/** A point's identity within a frame; an absent namespace or instance is its own value. */
function framePointKey(
  id: string,
  trackId: string,
  namespaceId: string | undefined,
  instanceId: string | undefined,
): string {
  return [id, trackId, namespaceId ?? "\u0001", instanceId ?? "\u0001"].join("\u0000");
}
