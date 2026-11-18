import { describe, expect, it } from "vitest";
import type { RawValue } from "@semio/data";
import {
  LayerBand,
  StandardTransitionType,
  TransitionPairing,
  type InstancedFrameInfo,
  type Keypoint,
  type SourceRow,
  type Track,
} from "../types";
import { computeFrames } from "../functions/compute-frames";

type Options = NonNullable<Parameters<typeof computeFrames>[2]>;

/**
 * The frame grouping as first written: a linear search for each key's frame,
 * and the frame id rebuilt on every merge. Kept as the reference that
 * `computeFrames` must reproduce exactly, ids, order and transitions included.
 */
function referenceComputeFrames(
  tracks: Record<string, Track<RawValue>>,
  sourceRow: SourceRow,
  options: Options = {},
): InstancedFrameInfo[] {
  const frames: InstancedFrameInfo[] = [];
  const { draggingKeypointIds, transformKeypoint } = options;
  const defaults = (t?: InstancedFrameInfo["transitions"]): InstancedFrameInfo["transitions"] => ({
    in: t?.in ?? StandardTransitionType.Cubic,
    out: t?.out ?? StandardTransitionType.Cubic,
    pairing: t?.pairing,
  });
  sourceRow.data.forEach((source) => {
    if (source.visible === false) return;
    const trackId = source.trackId;
    const emitted: string = (source as { trackIdBase?: string }).trackIdBase ?? trackId;
    tracks[trackId].points.forEach((point) => {
      const preview = transformKeypoint?.(point, { trackId, source }) ?? point;
      const dragging = draggingKeypointIds?.has(point.id) ?? false;
      const index = frames.findIndex((frame) => {
        if (frame.stamp !== preview.stamp) return false;
        if (options.ignoreDraggingState) return true;
        return frame.points.every((p) => draggingKeypointIds?.has(p.id) ?? false) === dragging;
      });
      const value = preview.value;
      if (index >= 0) {
        const frame = frames[index];
        const exists = frame.points.some(
          (p) =>
            p.id === preview.id &&
            p.trackId === emitted &&
            p.namespaceId === source.namespaceId &&
            p.instanceId === source.instanceId,
        );
        if (!exists) {
          frame.points.push({
            ...source,
            id: preview.id,
            type: typeof value as "number" | "string" | "boolean",
            value,
            trackId: emitted,
          });
        }
        frame.id = frame.points
          .map((p) => `${p.id}-${p.trackId}-${p.namespaceId ?? "ns"}-${p.instanceId ?? "inst"}`)
          .sort()
          .join("-");
        frame.transitions = frame.transitions
          ? defaults({ ...preview.transitions, ...frame.transitions })
          : defaults(preview.transitions);
      } else {
        frames.push({
          id: `${preview.id}-${emitted}-${source.namespaceId ?? "ns"}-${source.instanceId ?? "inst"}`,
          stamp: preview.stamp,
          points: [
            {
              ...source,
              id: preview.id,
              value,
              type: typeof value as "number" | "string" | "boolean",
              trackId: emitted,
            },
          ],
          transitions: defaults(preview.transitions),
        });
      }
    });
  });
  const sorted = frames.toSorted((a, b) => a.stamp - b.stamp);
  if (options.anchorFrameKey && options.anchorFrameId) {
    sorted.forEach((frame) => {
      const hasAnchor = frame.points.some(
        (p) =>
          p.id === options.anchorFrameKey &&
          (!options.anchorTrackId || p.trackId === options.anchorTrackId) &&
          (!options.anchorNamespaceId || p.namespaceId === options.anchorNamespaceId) &&
          (!options.anchorInstanceId || p.instanceId === options.anchorInstanceId),
      );
      if (hasAnchor) frame.id = options.anchorFrameId!;
    });
  }
  return sorted;
}

function random(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(next: () => number, items: readonly T[]): T {
  return items[Math.floor(next() * items.length)];
}

const STAMPS = [0, 0.1, 0.25, 0.5, 0.75, 1, NaN];
const TRANSITIONS = [
  undefined,
  { in: StandardTransitionType.Linear },
  { out: StandardTransitionType.Back, pairing: TransitionPairing.Paired },
  { in: StandardTransitionType.Cubic, out: StandardTransitionType.Linear },
];

/**
 * A row that reaches every branch: stamps shared across tracks, NaN stamps,
 * key ids shared across tracks, the same track instance listed twice (its
 * points are then already in the frame), entries with and without a namespace
 * or instance, hidden entries, `trackIdBase`, and a preview that moves keys.
 */
function scenario(seed: number) {
  const next = random(seed);
  const tracks: Record<string, Track<RawValue>> = {};
  const trackCount = 1 + Math.floor(next() * 5);
  const keyIds = ["k1", "k2", "k3", "k4", "k5", "k6"];
  for (let t = 0; t < trackCount; t += 1) {
    const points: Keypoint<RawValue>[] = [];
    const count = Math.floor(next() * 6);
    for (let p = 0; p < count; p += 1) {
      points.push({
        id: next() < 0.5 ? pick(next, keyIds) : `t${t}-p${p}`,
        stamp: pick(next, STAMPS),
        value: pick(next, [0, 1, 0.5, "on", true] as RawValue[]),
        transitions: pick(next, TRANSITIONS),
      } as Keypoint<RawValue>);
    }
    tracks[`track${t}`] = {
      id: `track${t}`,
      name: `Track ${t}`,
      animatableId: `a${t}`,
      points,
    };
  }
  const entries = Math.floor(next() * 7);
  const data: SourceRow["data"] = [];
  for (let e = 0; e < entries; e += 1) {
    const trackId = `track${Math.floor(next() * trackCount)}`;
    data.push({
      editable: true,
      selectable: true,
      layerBand: LayerBand.Background,
      trackId,
      animatableId: tracks[trackId].animatableId,
      namespaceId: pick(next, ["ns-1", "ns-2", undefined]),
      instanceId: pick(next, ["inst-1", "inst-2", undefined]),
      animationId: "anim-1",
      visible: next() < 0.15 ? false : undefined,
      ...(next() < 0.2 ? { trackIdBase: `base-${trackId}` } : {}),
    } as SourceRow["data"][number]);
  }
  const allIds = Object.values(tracks).flatMap((track) => track.points.map((p) => p.id));
  const dragging = new Set(allIds.filter(() => next() < 0.3));
  const moved = new Map(allIds.filter(() => next() < 0.2).map((id) => [id, pick(next, STAMPS)]));
  const anchorKey = allIds.length > 0 && next() < 0.5 ? pick(next, allIds) : undefined;
  const options: Options = {
    draggingKeypointIds: next() < 0.8 ? dragging : undefined,
    ignoreDraggingState: next() < 0.5,
    // A preview moves a key; it never changes which key it is.
    transformKeypoint:
      next() < 0.6
        ? (keypoint) =>
            moved.has(keypoint.id) ? { ...keypoint, stamp: moved.get(keypoint.id)! } : keypoint
        : undefined,
    anchorFrameKey: anchorKey,
    anchorFrameId: anchorKey ? "anchor-frame" : undefined,
    anchorTrackId: anchorKey && next() < 0.5 ? pick(next, Object.keys(tracks)) : undefined,
    anchorNamespaceId: anchorKey && next() < 0.5 ? "ns-1" : undefined,
    anchorInstanceId: anchorKey && next() < 0.5 ? "inst-1" : undefined,
  };
  return { tracks, sourceRow: { id: `row-${seed}`, data }, options };
}

describe("computeFrames against the reference grouping", () => {
  // Ids may contain any character, so a key built by joining them can make two
  // different points look like one.
  it("keeps points apart whose ids differ only in where a separator falls", () => {
    const source = (trackId: string) =>
      ({
        editable: true,
        selectable: true,
        layerBand: LayerBand.Background,
        trackId,
        animatableId: "a",
        namespaceId: "ns",
        instanceId: "inst",
        animationId: "anim-1",
      }) as SourceRow["data"][number];
    const tracks: Record<string, Track<RawValue>> = {
      "b\u0000c": {
        id: "b\u0000c",
        name: "one",
        animatableId: "a",
        points: [{ id: "a", stamp: 0.5, value: 1 }],
      },
      c: {
        id: "c",
        name: "two",
        animatableId: "a",
        points: [{ id: "a\u0000b", stamp: 0.5, value: 2 }],
      },
    };
    const sourceRow: SourceRow = { id: "row", data: [source("b\u0000c"), source("c")] };
    const frames = computeFrames(tracks, sourceRow, { ignoreDraggingState: true });
    expect(frames).toStrictEqual(
      referenceComputeFrames(tracks, sourceRow, { ignoreDraggingState: true }),
    );
    expect(frames[0].points).toHaveLength(2);
  });

  it("gives identical frames for 3000 generated rows", () => {
    for (let seed = 1; seed <= 3000; seed += 1) {
      const { tracks, sourceRow, options } = scenario(seed);
      const expected = referenceComputeFrames(tracks, sourceRow, options);
      const actual = computeFrames(tracks, sourceRow, options);
      expect(actual, `seed ${seed}`).toStrictEqual(expected);
      expect(JSON.stringify(actual), `seed ${seed}`).toBe(JSON.stringify(expected));
    }
  });
});
