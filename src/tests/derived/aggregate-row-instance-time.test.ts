import { afterEach, describe, expect, it } from "vitest";
import type { AnimationStore } from "../../store";
import type { DragState, InstancedFrameInfo, Keypoint, SourceRow, Violation } from "../../types";
import type { FeedbackProvider } from "../../functions/feedback-provider";
import {
  createTestAnimationStore,
  INSTANCE_IDS,
  NAMESPACE_IDS,
  TRACK_IDS,
} from "../../test-fixtures/animation-store-factory";
import { testTrackEvaluator } from "../../test-fixtures/track-evaluator";
import { computeWorldStamp } from "../../functions";
import { computeRowData } from "../../functions/compute-row-data";
import { computeTransitionSegments } from "../../functions/compute-transition-segments";
import {
  buildFilteredSourceRowId,
  rowDrawing,
  rowInstanceOf,
  spansSeveralInstances,
} from "../../functions/view-filtered-source-row";
import { keysAtStamp } from "../../hooks/use-key-control-state";
import { computeDerivedState } from "../../subscriptions/init-derived-orchestrator";
import { selectDerivedInputs } from "../../subscriptions/init-derived-orchestrator";
import { flushMicrotasks } from "../utils/flush-microtasks";
import { clickMarkerWith } from "../selection/selection-test-helpers";

/**
 * A row that spans several instances (the global row, a namespace's row) has
 * no one instance to take its keys to world time through, so it holds each
 * key at its own instance's world time. The fixture's BETA_SHARED instance
 * plays the shared animation at 2x from 250 ms, so its keys' world times
 * differ from their local ones everywhere but at local 500 ms; ALPHA_SHARED
 * plays the same animation at its own time.
 */

const GLOBAL = "global";
const ENTITY_BETA = `entity:${NAMESPACE_IDS.BETA}`;
const BETA_OPACITY_ROW = `${NAMESPACE_IDS.BETA}/${INSTANCE_IDS.BETA_SHARED}/${TRACK_IDS.OPACITY}`;

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

async function betaStore(): Promise<AnimationStore> {
  const store = createTestAnimationStore({
    trackEvaluator: testTrackEvaluator,
    activeInstance: INSTANCE_IDS.BETA_SHARED,
  });
  cleanup = store.getState().initAnimationSubscriptions();
  await flushMicrotasks();
  return store;
}

function betaSettings(store: AnimationStore) {
  return store.getState().namespaces[NAMESPACE_IDS.BETA].animationInstances[
    INSTANCE_IDS.BETA_SHARED
  ].settings;
}

/** Changes BETA_SHARED's timing, keeping what is not given. */
function setBeta(store: AnimationStore, settings: { timescale?: number; offset?: number }) {
  const { namespaces } = store.getState();
  const beta = namespaces[NAMESPACE_IDS.BETA];
  const instance = beta.animationInstances[INSTANCE_IDS.BETA_SHARED];
  store.setState({
    namespaces: {
      ...namespaces,
      [NAMESPACE_IDS.BETA]: {
        ...beta,
        animationInstances: {
          ...beta.animationInstances,
          [INSTANCE_IDS.BETA_SHARED]: {
            ...instance,
            settings: { ...instance.settings, ...settings },
          },
        },
      },
    },
  });
}

const betaWorld = (store: AnimationStore, local: number) =>
  computeWorldStamp(local, betaSettings(store).timescale, betaSettings(store).offset);

/**
 * An opacity key whose world and local times differ under BETA_SHARED, and
 * away from local 0 ms, so its world time depends on the instance's speed as
 * well as its offset.
 */
function movedKey(store: AnimationStore): Keypoint<number> {
  const point = (store.getState().tracks[TRACK_IDS.OPACITY].points as Keypoint<number>[]).find(
    (candidate) =>
      candidate.stamp !== 0 && Math.abs(betaWorld(store, candidate.stamp) - candidate.stamp) > 1,
  );
  if (!point) throw new Error("expected an opacity key away from local 0 and 500 ms");
  return point;
}

function rowFrames(store: AnimationStore, rowId: string): InstancedFrameInfo[] {
  const computed = store.getState().derivedSnapshot?.rows?.[rowId]?.computed;
  if (!computed) throw new Error(`expected row ${rowId}`);
  return computed.virtualFrames;
}

/** The stamps of the frames in a row holding `instanceId`'s copy of a key. */
function stampsOf(
  frames: InstancedFrameInfo[],
  keypointId: string,
  instanceId: string,
  trackId: string = TRACK_IDS.OPACITY,
) {
  return frames
    .filter((frame) =>
      frame.points.some(
        (point) =>
          point.id === keypointId && point.instanceId === instanceId && point.trackId === trackId,
      ),
    )
    .map((frame) => frame.stamp);
}

describe("rows that span several instances", () => {
  it.each([GLOBAL, ENTITY_BETA])(
    "hold each instance's keys at that instance's world time (%s)",
    async (rowId) => {
      const store = await betaStore();
      const key = movedKey(store);
      const frames = rowFrames(store, rowId);

      expect(stampsOf(frames, key.id, INSTANCE_IDS.BETA_SHARED)).toEqual([
        betaWorld(store, key.stamp),
      ]);
      if (rowId === GLOBAL) {
        // The unscaled instance's copy of the same stored key stays put.
        expect(stampsOf(frames, key.id, INSTANCE_IDS.ALPHA_SHARED)).toEqual([key.stamp]);
      }
    },
  );

  it("leave a row of one instance in that instance's time", async () => {
    const store = await betaStore();
    const key = movedKey(store);
    expect(stampsOf(rowFrames(store, BETA_OPACITY_ROW), key.id, INSTANCE_IDS.BETA_SHARED)).toEqual([
      key.stamp,
    ]);
  });

  it("scale an explicit handle by the instance's speed", async () => {
    const store = await betaStore();
    const state = store.getState();
    const point = (state.tracks[TRACK_IDS.OPACITY].points as Keypoint<number>[]).find(
      (candidate) =>
        typeof candidate.transitions?.out === "object" && "x" in candidate.transitions.out,
    );
    if (!point) throw new Error("expected an opacity key with an explicit out handle");
    const out = point.transitions!.out as { x: number; y: number };

    // Only the two instances' opacity entries, so a frame's handles are its
    // one key's.
    const entries = [INSTANCE_IDS.ALPHA_SHARED, INSTANCE_IDS.BETA_SHARED].flatMap(
      (instanceId) =>
        Object.values(state.instancedTrackSources).find(
          (row) =>
            !row.isGroup &&
            row.data.length === 1 &&
            row.data[0].instanceId === instanceId &&
            row.data[0].trackId === TRACK_IDS.OPACITY,
        )!.data,
    );
    const computed = computeRowData(
      { ...state.instancedTrackSources[GLOBAL], id: "opacity-pair", data: entries },
      state.tracks,
      {},
      state.animatables,
      undefined,
      state.selectionState,
      { animations: state.animations, namespaces: state.namespaces },
    );
    const at = (stamp: number, instanceId: string) =>
      computed.virtualFrames.find(
        (frame) =>
          frame.stamp === stamp &&
          frame.points.some((p) => p.id === point.id && p.instanceId === instanceId),
      );

    expect(at(point.stamp, INSTANCE_IDS.ALPHA_SHARED)?.transitions?.out).toEqual(out);
    expect(at(betaWorld(store, point.stamp), INSTANCE_IDS.BETA_SHARED)?.transitions?.out).toEqual({
      x: out.x / betaSettings(store).timescale,
      y: out.y,
    });
  });

  it("place each instance's violations at its world time, under the same ids", async () => {
    const store = await betaStore();
    const state = store.getState();
    const canonical = Object.entries(state.derivedSnapshot!.tracks)
      .filter(([key]) => key.startsWith(`${NAMESPACE_IDS.BETA}/${INSTANCE_IDS.BETA_SHARED}/`))
      .flatMap(([, track]) => track.canonical.violations);
    expect(canonical.length).toBeGreaterThan(0);

    const inRow = state.derivedSnapshot!.rows[GLOBAL].computed.violationSet.violations;
    canonical.forEach((violation) => {
      expect(inRow[violation.id]?.stampRange).toEqual({
        start: betaWorld(store, violation.stampRange.start),
        end: betaWorld(store, violation.stampRange.end),
      });
    });
  });

  it("redraw when an instance's speed changes", async () => {
    const store = await betaStore();
    const { namespaces } = store.getState();
    const beta = namespaces[NAMESPACE_IDS.BETA];
    const instance = beta.animationInstances[INSTANCE_IDS.BETA_SHARED];
    store.setState({
      namespaces: {
        ...namespaces,
        [NAMESPACE_IDS.BETA]: {
          ...beta,
          animationInstances: {
            ...beta.animationInstances,
            [INSTANCE_IDS.BETA_SHARED]: {
              ...instance,
              settings: { ...instance.settings, timescale: 4 },
            },
          },
        },
      },
    });
    await flushMicrotasks();

    const key = movedKey(store);
    expect(stampsOf(rowFrames(store, GLOBAL), key.id, INSTANCE_IDS.BETA_SHARED)).toEqual([
      betaWorld(store, key.stamp),
    ]);
    const fresh = computeDerivedState(selectDerivedInputs(store.getState()), 0);
    expect(rowFrames(store, GLOBAL)).toEqual(fresh.rows[GLOBAL].computed.virtualFrames);
  });

  it("find the key at the playhead's world time for the key strip", async () => {
    const store = await betaStore();
    const key = movedKey(store);
    const row = store.getState().instancedTrackSources[GLOBAL];
    const computed = store.getState().derivedSnapshot!.rows[GLOBAL].computed;
    const betaEntries = row.data.filter(
      (entry) =>
        entry.instanceId === INSTANCE_IDS.BETA_SHARED && entry.trackId === TRACK_IDS.OPACITY,
    );

    const atWorld = keysAtStamp(computed, betaWorld(store, key.stamp), betaEntries);
    expect(atWorld.targetPoints.map((point) => point.id)).toEqual([key.id]);
  });

  it("move a dragged key by the world distance the pointer moved", async () => {
    const store = await betaStore();
    const key = movedKey(store);
    const frame = rowFrames(store, GLOBAL).find((candidate) =>
      candidate.points.some(
        (point) =>
          point.id === key.id &&
          point.instanceId === INSTANCE_IDS.BETA_SHARED &&
          point.trackId === TRACK_IDS.OPACITY,
      ),
    );
    if (!frame) throw new Error("expected a frame holding BETA's copy of the key");
    expect(frame.stamp).toBe(betaWorld(store, key.stamp));

    clickMarkerWith(store, GLOBAL, frame.id);
    store.getState().startDrag({ axis: "horizontal", markerId: frame.id, rowId: GLOBAL });
    const worldDistance = 40;
    store.getState().updateDrag({
      normalizedStamp: { current: frame.stamp + worldDistance },
      modifiers: { alt: false, shift: false, meta: false },
    });
    await flushMicrotasks();

    // The preview draws the key where the pointer is.
    expect(stampsOf(rowFrames(store, GLOBAL), key.id, INSTANCE_IDS.BETA_SHARED)).toEqual([
      frame.stamp + worldDistance,
    ]);

    store.getState().commitDrag();
    await flushMicrotasks();
    const committed = store
      .getState()
      .tracks[TRACK_IDS.OPACITY].points.find((point) => point.id === key.id)!;
    expect(committed.stamp).toBeCloseTo(
      key.stamp + worldDistance * betaSettings(store).timescale,
      6,
    );
  });

  it.each(["timeline", "tracks"] as const)(
    "box-select a key where it is drawn, in world time (%s)",
    async (origin) => {
      const store = await betaStore();
      const key = movedKey(store);
      const viewId = Object.keys(store.getState().editorViews)[0];
      const select = (around: number) => {
        store.getState().startBoxSelect({
          origin,
          startStamp: around - 1,
          // Every row's band, so only time decides what the box holds.
          startY: -1e6,
          currentStamp: around - 1,
          currentY: -1e6,
          mode: "replace",
          initialKeypoints: new Map(),
          layout: {
            viewId,
            canvasHeight: 100,
            topOffsetPx: 0,
            bottomOffsetPx: 100,
            trackHeightPx: 20,
          },
        });
        store.getState().updateBoxSelect(around + 1, 1e6);
        const ids = [...(store.getState().selectionState.keypoints.get(TRACK_IDS.OPACITY) ?? [])];
        store.getState().cancelBoxSelect();
        return ids;
      };

      expect(select(betaWorld(store, key.stamp))).toContain(key.id);
      // Where the key would sit if its local time were drawn as world time.
      expect(select(key.stamp)).not.toContain(key.id);
    },
  );

  it("draw a view's one-instance copy of them through that instance, at the same world times", async () => {
    const store = await betaStore();
    const key = movedKey(store);
    const state = store.getState();
    const global = state.instancedTrackSources[GLOBAL];
    const filteredId = buildFilteredSourceRowId("view", GLOBAL);
    const filtered = {
      ...global,
      id: filteredId,
      data: global.data.filter((entry) => entry.instanceId === INSTANCE_IDS.BETA_SHARED),
    };
    // The view draws the copy's keys through the instance and the full row's
    // segments and violations through none.
    const sources = { ...state.instancedTrackSources, [filteredId]: filtered };
    expect(rowDrawing(sources, GLOBAL, "view")).toEqual({
      keyRowId: filteredId,
      keyInstanceId: INSTANCE_IDS.BETA_SHARED,
      rowInstanceId: undefined,
    });
    expect(rowDrawing(sources, GLOBAL, "another view")).toEqual({
      keyRowId: GLOBAL,
      keyInstanceId: undefined,
      rowInstanceId: undefined,
    });

    // The copy is a row of its own, of one instance, so its keys are local
    // and drawn through the instance; they land where the global row's are.
    const copy = computeRowData(
      filtered,
      state.tracks,
      {},
      state.animatables,
      undefined,
      state.selectionState,
      { animations: state.animations, namespaces: state.namespaces },
    );
    const [local] = stampsOf(copy.virtualFrames, key.id, INSTANCE_IDS.BETA_SHARED);
    expect(local).toBe(key.stamp);
    expect(stampsOf(rowFrames(store, GLOBAL), key.id, INSTANCE_IDS.BETA_SHARED)).toEqual([
      betaWorld(store, local),
    ]);
  });

  it("count instances by namespace and id", () => {
    const entry = (namespaceId: string) =>
      ({ namespaceId, instanceId: "same-id", trackId: "t" }) as SourceRow["data"][number];
    const row = (namespaceIds: string[]): SourceRow =>
      ({ id: "row", data: namespaceIds.map(entry) }) as SourceRow;
    expect(spansSeveralInstances(row(["a", "a"]))).toBe(false);
    expect(spansSeveralInstances(row(["a", "b"]))).toBe(true);
    expect(rowInstanceOf(row(["a", "b"]))).toBeUndefined();
  });

  it("put a key exactly where the key strip looks for it", async () => {
    const store = await betaStore();
    setBeta(store, { timescale: 3, offset: 0 });
    // At speed 3 from 0 ms, local 100 ms is 33.33... ms in world time, a value that
    // dividing and multiplying by the reciprocal round differently.
    const track = store.getState().tracks[TRACK_IDS.OPACITY];
    store.setState({
      tracks: {
        ...store.getState().tracks,
        [TRACK_IDS.OPACITY]: {
          ...track,
          points: [...track.points, { id: "at-100", stamp: 100, value: 0.5 }].sort(
            (a, b) => a.stamp - b.stamp,
          ),
        },
      },
    });
    await flushMicrotasks();
    const row = store.getState().instancedTrackSources[GLOBAL];
    const computed = store.getState().derivedSnapshot!.rows[GLOBAL].computed;
    const betaOpacity = row.data.filter(
      (entry) =>
        entry.instanceId === INSTANCE_IDS.BETA_SHARED && entry.trackId === TRACK_IDS.OPACITY,
    );
    store.getState().tracks[TRACK_IDS.OPACITY].points.forEach((point) => {
      const found = keysAtStamp(computed, betaWorld(store, point.stamp), betaOpacity);
      expect(
        found.targetPoints.map((p) => p.id),
        `key ${point.id}`,
      ).toEqual([point.id]);
    });

    // A box whose edge is exactly that world time holds the key, in its own
    // row and in the global row.
    const world = betaWorld(store, 100);
    const viewId = Object.keys(store.getState().editorViews)[0];
    const boxFrom = (start: number, end: number) => {
      store.getState().startBoxSelect({
        origin: "tracks",
        startStamp: start,
        startY: -1e6,
        currentStamp: start,
        currentY: -1e6,
        mode: "replace",
        initialKeypoints: new Map(),
        layout: {
          viewId,
          canvasHeight: 100,
          topOffsetPx: 0,
          bottomOffsetPx: 100,
          trackHeightPx: 20,
        },
      });
      store.getState().updateBoxSelect(end, 1e6);
      const ids = [...(store.getState().selectionState.keypoints.get(TRACK_IDS.OPACITY) ?? [])];
      store.getState().cancelBoxSelect();
      return ids;
    };
    expect(boxFrom(world, world + 1)).toContain("at-100");
    expect(boxFrom(world - 1, world)).toContain("at-100");

    // The same, in the key's own row alone: a row of one instance, whose keys
    // are taken to world time by the hit test rather than by the build.
    const { sourceRowIds } = store.getState();
    expect(sourceRowIds.spline).toContain(BETA_OPACITY_ROW);
    store.setState({ sourceRowIds: { ...sourceRowIds, flat: [BETA_OPACITY_ROW] } });
    expect(boxFrom(world, world + 1)).toContain("at-100");
    expect(boxFrom(world - 1, world)).toContain("at-100");
  });

  it("redraw when an instance's offset alone changes", async () => {
    const store = await betaStore();
    setBeta(store, { offset: 350 });
    await flushMicrotasks();
    const key = movedKey(store);
    expect(stampsOf(rowFrames(store, GLOBAL), key.id, INSTANCE_IDS.BETA_SHARED)).toEqual([
      betaWorld(store, key.stamp),
    ]);
  });
});

describe("next and previous key on a row of several instances", () => {
  it("step through each instance's keys at their world times", async () => {
    const store = await betaStore();
    const row = store.getState().instancedTrackSources[GLOBAL];
    const expected = [
      ...new Set(
        Object.values(store.getState().instancedTrackSources)
          .filter((leaf) => !leaf.isGroup && leaf.data.length === 1)
          .flatMap((leaf) => {
            const [entry] = leaf.data;
            const settings =
              store.getState().namespaces[entry.namespaceId].animationInstances[entry.instanceId]
                .settings;
            return store
              .getState()
              .tracks[entry.trackId].points.map((point) =>
                computeWorldStamp(point.stamp, settings.timescale, settings.offset),
              );
          }),
      ),
    ].sort((a, b) => a - b);

    const player = () => store.getState().playerStore.getState();
    player().resetPlayer(-1e9);
    const visited: number[] = [];
    expected.forEach(() => {
      store.getState().skipToNextKeyframe(row);
      visited.push(player().player.stamp);
    });
    expect(visited).toEqual(expected);
  });

  it("take the row's time from the row as the store holds it", async () => {
    const store = await betaStore();
    const row = store.getState().instancedTrackSources[GLOBAL];
    // A copy of the row from before the other instances joined it.
    const stale = {
      ...row,
      data: row.data.filter((entry) => entry.instanceId === INSTANCE_IDS.BETA_SHARED),
    };
    const player = () => store.getState().playerStore.getState();
    const walk = (through: SourceRow) => {
      player().resetPlayer(-1e9);
      const visited: number[] = [];
      for (let step = 0; step < 40; step += 1) {
        store.getState().skipToNextKeyframe(through);
        visited.push(player().player.stamp);
      }
      return visited;
    };
    expect(walk(stale)).toEqual(walk(row));
  });
});

describe("a handle dragged in a row of several instances", () => {
  it("draws as the same handle does once committed", async () => {
    const store = await betaStore();
    const state = store.getState();
    const key = movedKey(store);
    const handle = { x: 200, y: 0 };
    const entries = [INSTANCE_IDS.ALPHA_SHARED, INSTANCE_IDS.BETA_SHARED].flatMap(
      (instanceId) =>
        Object.values(state.instancedTrackSources).find(
          (row) =>
            !row.isGroup &&
            row.data.length === 1 &&
            row.data[0].instanceId === instanceId &&
            row.data[0].trackId === TRACK_IDS.OPACITY,
        )!.data,
    );
    const row = { ...state.instancedTrackSources[GLOBAL], id: "opacity-pair", data: entries };
    const context = { animations: state.animations, namespaces: state.namespaces };
    const selection = { ...state.selectionState, instanceId: INSTANCE_IDS.BETA_SHARED };

    const dragging = computeRowData(
      row,
      state.tracks,
      {},
      state.animatables,
      {
        instanceId: INSTANCE_IDS.BETA_SHARED,
        handleDiffs: { [key.id]: { out: handle } },
      } as unknown as DragState,
      selection,
      context,
    );
    const track = state.tracks[TRACK_IDS.OPACITY];
    const committed = computeRowData(
      row,
      {
        ...state.tracks,
        [TRACK_IDS.OPACITY]: {
          ...track,
          points: track.points.map((point) =>
            point.id === key.id
              ? { ...point, transitions: { ...point.transitions, out: handle } }
              : point,
          ),
        },
      },
      {},
      state.animatables,
      undefined,
      selection,
      context,
    );
    expect(dragging.render?.segments.length).toBeGreaterThan(0);
    expect(dragging.render?.segments).toEqual(committed.render?.segments);
  });
});

describe("row reuse", () => {
  it("redraws a row of several instances when one's speed alone changes", async () => {
    // Answers that stay the same objects whatever the instance's speed, so
    // only the instance's time can tell the row it changed.
    const answers = new Map<string, Violation[]>();
    const steady = (key: string) => {
      let list = answers.get(key);
      if (!list) answers.set(key, (list = []));
      return list;
    };
    const provider: FeedbackProvider = {
      canonical: (subjects) => new Map(subjects.map((s) => [s.trackKey, steady(s.trackKey)])),
      preview: () => [],
    };
    const store = createTestAnimationStore({
      trackEvaluator: testTrackEvaluator,
      activeInstance: INSTANCE_IDS.BETA_SHARED,
    });
    store.setState({ feedbackProvider: provider });
    cleanup = store.getState().initAnimationSubscriptions();
    await flushMicrotasks();

    setBeta(store, { timescale: 4 });
    await flushMicrotasks();
    const key = movedKey(store);
    expect(stampsOf(rowFrames(store, GLOBAL), key.id, INSTANCE_IDS.BETA_SHARED)).toEqual([
      betaWorld(store, key.stamp),
    ]);
  });
});

describe("transition segments", () => {
  it("span each copy of a track only between its own keys", () => {
    const frame = (stamp: number, instanceId: string): InstancedFrameInfo =>
      ({
        id: `${instanceId}@${stamp}`,
        stamp,
        points: [
          {
            id: `k${stamp}`,
            trackId: "t",
            namespaceId: "ns",
            instanceId,
            type: "number",
            value: 0,
          },
        ],
      }) as unknown as InstancedFrameInfo;
    const segments = computeTransitionSegments(
      [frame(0, "a"), frame(1000, "a"), frame(5000, "b"), frame(6000, "b")],
      ["t"],
    );
    expect(segments.map(({ start, end }) => [start.stamp, end.stamp])).toEqual([
      [0, 1000],
      [5000, 6000],
    ]);
  });
});
