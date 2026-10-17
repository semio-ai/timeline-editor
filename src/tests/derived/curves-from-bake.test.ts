import { describe, expect, test } from "vitest";
import type { AnimatableNumber } from "@semio/utils";
import {
  buildDerivedSnapshot,
  computeInstanceTrackViolations,
  materializeSegmentSample,
  trackCurve,
  type TrackBaker,
} from "../../functions";
import { createMinimalAnimationStore, TRACK_IDS } from "../../test-fixtures";
import { createEmptySelectionState } from "../../functions/selection-state-manager";
import { TrackRender, ViolationType } from "../../types";
import type { DragState, Track } from "../../types";
import type { SimpleTrack } from "../../types/data/simple-track";
import { clipBaker } from "../module-clip/clip-baker";

const animationOf = (...tracks: SimpleTrack[]) => ({
  id: "animation",
  name: "animation",
  tracks: tracks.map((track) => track.id),
  groups: [],
});

const ramp: SimpleTrack = {
  id: "ramp",
  name: "ramp",
  animatableId: "joint",
  points: [
    { id: "r0", stamp: 0, value: 0 },
    { id: "r1", stamp: 1000, value: 10 },
  ],
};

/** The minimal store's scale row: its drawn spline points, as `[x, y]` pairs per segment. */
function splineOf(store: ReturnType<typeof createMinimalAnimationStore>) {
  const { derivedSnapshot, instancedTrackSources } = store.getState();
  const rowId = Object.keys(instancedTrackSources)[0];
  const segments = derivedSnapshot!.rows[rowId].computed.render?.segments ?? [];
  return segments
    .filter((segment) => !segment.buffer && segment.samples[TrackRender.Spline])
    .map((segment) => {
      const points = materializeSegmentSample(
        segment.samples[TrackRender.Spline]!,
        derivedSnapshot!.renderSampleCache,
      )!.points;
      return Array.from({ length: points.length / 2 }, (_, i) => [
        points[2 * i],
        points[2 * i + 1],
      ]);
    });
}

describe("trackCurve", () => {
  test("joins a bake's number samples by lines, holds the others, and keeps the played duration", () => {
    // At the rate asked, over the one second the clip lasts: 0, 10, 0, 10, …
    const alternating: TrackBaker = (_clip, _trackId, rateHz) =>
      Array.from({ length: rateHz + 1 }, (_, i) => (i % 2 === 0 ? 0 : 10));
    const curve = trackCurve(ramp, animationOf(ramp), { ramp }, alternating)!;
    // 200 samples a second: halfway between the first two samples.
    expect(curve(2.5)).toBeCloseTo(5);
    expect(curve(5)).toBe(10);
    expect(curve(-100)).toBe(0);
    expect(curve(5000)).toBe(0);
    expect(curve.durationMs).toBe(1000);

    const lamp: SimpleTrack = {
      ...ramp,
      id: "lamp",
      points: [{ id: "l0", stamp: 0, value: false }],
    };
    const stepped: TrackBaker = (_clip, _trackId, rateHz) =>
      Array.from({ length: rateHz + 1 }, (_, i) => i % 2 === 1);
    expect(trackCurve(lamp, animationOf(lamp), { lamp }, stepped)!(2.5)).toBe(false);
  });

  test("bakes a track again when its keypoints change in place", () => {
    let bakes = 0;
    const counting: TrackBaker = (clip, trackId, rateHz) => {
      bakes += 1;
      return clipBaker(clip, trackId, rateHz);
    };
    const track: SimpleTrack = { ...ramp, points: ramp.points.map((point) => ({ ...point })) };
    const animation = animationOf(track);
    expect(trackCurve(track, animation, { ramp: track }, counting)!(500)).toBeCloseTo(5, 0);
    expect(trackCurve(track, animation, { ramp: track }, counting)).toBeDefined();
    expect(bakes).toBe(1);

    // As an immer draft is edited: the same object, a new keypoint.
    track.points.splice(1, 0, { id: "mid", stamp: 500, value: 100 });
    expect(trackCurve(track, animation, { ramp: track }, counting)!(500)).toBe(100);
    expect(bakes).toBe(2);
  });
});

describe("violations of an instance", () => {
  test("are reported in the track's local time whatever the instance's timescale", () => {
    // Over its upper bound from local 500 ms on.
    const curve = Object.assign((localMs: number) => (localMs >= 500 ? 2 : 0), {
      durationMs: 1000,
    });
    const animatable: AnimatableNumber = {
      id: "joint",
      type: "number",
      default: 0,
      constraints: { min: -1, max: 1 },
    };
    for (const timescale of [1, 2, 0.5]) {
      const upper = computeInstanceTrackViolations(
        curve,
        1000,
        timescale,
        "ramp",
        "ns",
        "instance",
        animatable,
      ).filter((violation) => violation.type === ViolationType.Upper);
      expect(upper, `timescale ${timescale}`).toHaveLength(1);
      expect(upper[0].stampRange.start).toBeCloseTo(500, -1);
      expect(upper[0].stampRange.end).toBeCloseTo(1000, 5);
    }
  });
});

describe("a value row's spline", () => {
  test("draws a segment reaching outside the played clip time from its keypoints", () => {
    const store = createMinimalAnimationStore({ trackBaker: clipBaker });
    store.setState((state) => ({
      tracks: {
        ...state.tracks,
        [TRACK_IDS.SCALE]: {
          ...state.tracks[TRACK_IDS.SCALE],
          points: [
            { id: "n0", stamp: -500, value: 0 },
            { id: "n1", stamp: 500, value: 1 },
            { id: "n2", stamp: 1500, value: 0 },
          ],
        },
      },
    }));

    const [before, inside] = splineOf(store);
    // The segment from -500 ms leaves its keypoint at -500 ms, value 0.
    expect(before[0][0]).toBeCloseTo(-500);
    expect(before[0][1]).toBeCloseTo(0, 5);
    // The segment the module plays is its bake: a clipBaker reading at its middle.
    const curve = trackCurve(
      store.getState().tracks[TRACK_IDS.SCALE],
      store.getState().animations.minimal,
      store.getState().tracks,
      clipBaker,
    )!;
    const middle = inside[Math.floor(inside.length / 2)];
    expect(middle[1]).toBeCloseTo(curve(middle[0]) as number, 5);
  });

  test("draws the dragged points while a keypoint is dragged", () => {
    const store = createMinimalAnimationStore({ trackBaker: clipBaker });
    const state = store.getState();
    const rowId = Object.keys(state.instancedTrackSources)[0];
    const track = state.tracks[TRACK_IDS.SCALE] as Track<number>;
    const anchor = track.points[1];
    const selectionState = createEmptySelectionState("main");
    selectionState.keypoints.set(TRACK_IDS.SCALE, new Set([anchor.id]));
    const dragState: DragState = {
      axis: "vertical",
      instanceId: "main",
      instanceTransform: { offset: 0, timescale: 1 },
      anchor: {
        keypointId: anchor.id,
        trackId: TRACK_IDS.SCALE,
        rowId,
        valueScale: { domain: [0, 10], clamp: false },
      },
      anchorValueOrigin: anchor.value,
      normalizedValueDelta: 0.3,
      modifiers: { alt: false, shift: false, meta: false },
    };
    const build = (drag?: DragState) =>
      buildDerivedSnapshot({
        trackBaker: clipBaker,
        tracks: state.tracks,
        namespaces: state.namespaces,
        animations: state.animations,
        animatables: state.animatables,
        instancedTrackSources: state.instancedTrackSources,
        dragState: drag,
        selectionState,
      });
    const spline = (snapshot: ReturnType<typeof build>) =>
      (snapshot.rows[rowId].computed.render?.segments ?? [])
        .filter((segment) => !segment.buffer && segment.samples[TrackRender.Spline])
        .flatMap((segment) =>
          Array.from(
            materializeSegmentSample(
              segment.samples[TrackRender.Spline]!,
              snapshot.renderSampleCache,
            )!.points,
          ),
        );

    const resting = spline(build());
    const dragging = spline(build(dragState));
    expect(dragging).toHaveLength(resting.length);
    expect(dragging.some((y, i) => i % 2 === 1 && Math.abs(y - resting[i]) > 1e-3)).toBe(true);

    // The preview's own curve has values.
    const snapshot = build(dragState);
    const preview = Object.values(snapshot.tracks).find((derived) => derived.preview)?.preview;
    expect(preview?.curve?.(anchor.stamp)).toEqual(expect.any(Number));
  });
});

describe("a keypoint inserted on a curve", () => {
  const insertMiddle = (trackBaker?: TrackBaker) => {
    const store = createMinimalAnimationStore({ trackBaker });
    const track = store.getState().tracks[TRACK_IDS.SCALE];
    const [a, b] = [track.points[0], track.points[1]];
    const at = (a.stamp + b.stamp) / 2;
    const before = trackCurve(
      store.getState().tracks[TRACK_IDS.SCALE],
      store.getState().animations.minimal,
      store.getState().tracks,
      clipBaker,
    )!;
    store.getState().insertKeypointAtWorldStamp(TRACK_IDS.SCALE, at, "main");
    const inserted = store
      .getState()
      .tracks[TRACK_IDS.SCALE].points.find((point) => point.stamp === at);
    const after = trackCurve(
      store.getState().tracks[TRACK_IDS.SCALE],
      store.getState().animations.minimal,
      store.getState().tracks,
      clipBaker,
    )!;
    return { at, before, after, inserted };
  };

  test("takes the curve's value there", () => {
    const { at, before, inserted } = insertMiddle(clipBaker);
    expect(inserted?.value).toBeCloseTo(before(at) as number, 5);
  });

  test("keeps the track's shape when nothing can bake it", () => {
    const { at, before, after, inserted } = insertMiddle(undefined);
    expect(inserted?.value).toBeCloseTo(before(at) as number, 3);
    for (const t of [at - 40, at - 10, at + 10, at + 40]) {
      expect(after(t), `at ${t} ms`).toBeCloseTo(before(t) as number, 3);
    }
  });
});
