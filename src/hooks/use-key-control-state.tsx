import { useCallback, useContext, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { uniq } from "lodash";
import {
  computeLocalStamp,
  computeNextTime,
  computePreviousTime,
  computeWorldStamp,
} from "../functions";
import { type AnimationActions, type AnimationData } from "../store-types";
import { buildTrackKey } from "../utils/track-key";
import { SemanticTime, SourceRow, InstancedFrameInfo, LayerBand } from "../types";
import { AnimationContext } from "../context";
import { currentDerivedSnapshot } from "../subscriptions/init-derived-orchestrator";
import type { ComputedRowData } from "../types";
import { useAnimationStore } from "./use-animation-store";
import { usePlayer } from "./use-player";

export interface KeyControlState {
  prevEnabled: boolean;
  nextEnabled: boolean;
  prevTime?: number;
  nextTime?: number;
  dashed: boolean;
  keyState: "none" | "partial" | "full";
  currentFrame?: InstancedFrameInfo;
  targetEntries: SourceRow["data"];
  missingEntries: SourceRow["data"];
  targetPoints: InstancedFrameInfo["points"];
  onPrev: () => void;
  onNext: () => void;
  onPrevPreviewEnter: () => void;
  onPrevPreviewLeave: () => void;
  onNextPreviewEnter: () => void;
  onNextPreviewLeave: () => void;
  trackIds: string[];
  /**
   * The keys at the playhead as the store's state has them now, for an
   * event handler to act on. The fields above show the published snapshot,
   * which can trail the state (see `currentDerivedSnapshot`); a handler that
   * removes or adds keys from them could act on keys that have since moved.
   */
  keyStateNow: () => KeysNow;
}

/** The keys at the playhead now, with what an edit there needs from the state. */
export interface KeysNow extends KeysAtStamp {
  /** The row's tracks as the state has them. */
  entries: SourceRow["data"];
  /** The playhead in a track's instance's local time, by its time transform now. */
  playheadIn: (entry: InstanceRef) => number;
}

/** The keys a row holds at one local stamp, and which of its tracks lack one. */
export interface KeysAtStamp {
  keyState: "none" | "partial" | "full";
  currentFrame?: InstancedFrameInfo;
  targetPoints: InstancedFrameInfo["points"];
  missingEntries: SourceRow["data"];
}

/** Where an animation instance is: its namespace and its id within it. */
export interface InstanceRef {
  namespaceId: string;
  instanceId: string;
}

/**
 * An animation instance by its namespace and id: the instance a row's
 * entries play. Instance ids are unique only within a namespace, so the
 * namespace is part of finding one.
 */
function instanceIn(
  namespaces: AnimationData["namespaces"],
  { namespaceId, instanceId }: InstanceRef,
) {
  return namespaces[namespaceId]?.animationInstances[instanceId];
}

/** The one instance every entry of a row plays, if there is exactly one. */
function uniqueInstanceOf(data: SourceRow["data"]): InstanceRef | undefined {
  const refs = uniq(
    data
      .filter((entry) => entry.instanceId)
      // A namespace id may be empty, and still names a namespace.
      .map((entry) => JSON.stringify([entry.namespaceId ?? "", entry.instanceId])),
  );
  if (refs.length !== 1) return undefined;
  const [namespaceId, instanceId] = JSON.parse(refs[0]) as [string, string];
  return { namespaceId, instanceId };
}

/** The tracks a row's key controls act on: its foreground tracks, or all of them. */
function keyTargets(data: SourceRow["data"]): SourceRow["data"] {
  if (data.length === 0) return [];
  const foreground = data.filter(
    (datum) =>
      datum.layerBand === LayerBand.ForegroundSelected ||
      datum.layerBand === LayerBand.ForegroundUnselected ||
      datum.layerBand === LayerBand.ForegroundLocked,
  );
  return foreground.length > 0 ? foreground : data;
}

const entryKey = (entry: { namespaceId?: string; instanceId?: string; trackId: string }) =>
  buildTrackKey(entry.namespaceId ?? "", entry.instanceId ?? "", entry.trackId);

/** The keys `computed` holds at `localStamp`, among `targetEntries`. */
export function keysAtStamp(
  computed: ComputedRowData | undefined,
  localStamp: number,
  targetEntries: SourceRow["data"],
): KeysAtStamp {
  const currentFrame = computed?.virtualFrames?.find((frame) => frame.stamp === localStamp);
  const targetKeys = new Set(targetEntries.map(entryKey));
  const targetPoints =
    currentFrame && targetKeys.size > 0
      ? currentFrame.points.filter((point) => targetKeys.has(entryKey(point)))
      : [];
  const keyedKeys = new Set(targetPoints.map(entryKey));
  const missingEntries =
    !currentFrame || keyedKeys.size === 0
      ? targetEntries.slice()
      : targetEntries.filter((datum) => !keyedKeys.has(entryKey(datum)));
  const keyState =
    !currentFrame || keyedKeys.size === 0
      ? "none"
      : missingEntries.length === 0
        ? "full"
        : "partial";
  return { keyState, currentFrame, targetPoints, missingEntries };
}

export function useKeyControlState(source: SourceRow): KeyControlState {
  const computedData = useAnimationStore(
    useShallow((state: AnimationData) => state.derivedSnapshot?.rows?.[source.id]?.computed),
  );

  const bounds = usePlayer(useShallow((state) => state.player.bounds));
  const running = usePlayer(useShallow((state) => state.player.running));
  const playerStore = useAnimationStore((state) => state.playerStore);
  // Subscribing to `state.player.stamp` directly fires a React re-render
  // 40Hz during playback for every TrackControl/TimelineControl using this
  // hook — which then cascades into ControlRow + the radix menu plumbing
  // wrapped around each row. The stamp-derived outputs of this hook
  // (prev/next time, currentFrame, keyState) are gated on `!running`
  // anyway: prev/next return undefined during play, and currentFrame /
  // keyState are only meaningful when paused so the user can act on them.
  // Returning `null` from the selector while running keeps the hook (and
  // all its callers) stable per tick.
  const stamp = usePlayer(
    useShallow((state) => (state.player.running ? null : state.player.stamp)),
  );
  // Fall back to the *current* store stamp (read at render time, not
  // subscribed) rather than 0 — otherwise starting playback at e.g. stamp
  // 5000 would make `currentFrame`/`missingEntries`/`keyState` snap to the
  // state at time 0 until the user pauses. The render-time read still
  // doesn't trigger per-tick re-renders (selector still returns `null`
  // during play); it just gives a sensible last-known value.
  const stampSafe = stamp ?? playerStore.getState().player.stamp;

  const uniqueInstance = useMemo(() => uniqueInstanceOf(source.data), [source.data]);

  // The instance's time transform, from the store: the same one an event
  // handler reads when it acts (`keyStateNow`), so what the strip shows and
  // what a click does agree, with or without a transform provider above.
  const instanceSettings = useAnimationStore(
    useShallow((state: AnimationData) =>
      uniqueInstance ? instanceIn(state.namespaces, uniqueInstance)?.settings : undefined,
    ),
  );
  const toLocal = useMemo(
    () =>
      instanceSettings
        ? (world: number) =>
            computeLocalStamp(world, instanceSettings.timescale, instanceSettings.offset)
        : undefined,
    [instanceSettings],
  );
  const toWorld = useMemo(
    () =>
      instanceSettings
        ? (local: number) =>
            computeWorldStamp(local, instanceSettings.timescale, instanceSettings.offset)
        : undefined,
    [instanceSettings],
  );

  const localStamp = useMemo(
    () => (typeof toLocal === "function" ? toLocal(stampSafe) : stampSafe),
    [stampSafe, toLocal],
  );
  const localBounds = useMemo<[number, number]>(() => {
    if (typeof toLocal !== "function") return bounds;
    const start = toLocal(bounds[0]);
    const end = toLocal(bounds[1]);
    return start <= end ? [start, end] : [end, start];
  }, [bounds, toLocal]);

  const prevTime = useMemo(() => {
    if (running || computedData === undefined) return undefined;
    const localPrev = computePreviousTime(
      computedData.virtualFrames,
      localStamp,
      localBounds,
      true,
    );
    if (localPrev === undefined) return undefined;
    return typeof toWorld === "function" ? toWorld(localPrev) : localPrev;
  }, [computedData, localBounds, localStamp, running, toWorld]);

  const nextTime = useMemo(() => {
    if (running || computedData === undefined) return undefined;
    const localNext = computeNextTime(computedData.virtualFrames, localStamp, localBounds, true);
    if (localNext === undefined) return undefined;
    return typeof toWorld === "function" ? toWorld(localNext) : localNext;
  }, [computedData, localBounds, localStamp, running, toWorld]);

  const prevEnabled = prevTime !== undefined;
  const nextEnabled = nextTime !== undefined;
  const dashed = !prevEnabled || !nextEnabled;

  const targetEntries = useMemo(() => keyTargets(source.data), [source.data]);
  const { keyState, currentFrame, targetPoints, missingEntries } = useMemo(
    () => keysAtStamp(computedData, localStamp, targetEntries),
    [computedData, localStamp, targetEntries],
  );

  const store = useContext(AnimationContext);
  // Everything from the state at the call: the row, its instance's time
  // transform and its derived frames can all have changed since the render.
  const keyStateNow = useCallback((): KeysNow => {
    if (!store) {
      return {
        ...keysAtStamp(undefined, 0, targetEntries),
        entries: source.data,
        playheadIn: () => 0,
      };
    }
    const state = store.getState();
    // A row that no longer exists has nothing to act on: its rendered
    // entries may name tracks or instances that are gone.
    const row = state.instancedTrackSources[source.id] ?? { ...source, data: [] };
    const stampNow = state.playerStore.getState().player.stamp;
    const playheadIn = (entry: InstanceRef) => {
      const instance = instanceIn(state.namespaces, entry);
      return instance
        ? computeLocalStamp(stampNow, instance.settings.timescale, instance.settings.offset)
        : stampNow;
    };
    const instance = uniqueInstanceOf(row.data);
    const localNow = instance ? playheadIn(instance) : stampNow;
    const computedNow = currentDerivedSnapshot(state)?.rows?.[source.id]?.computed;
    return {
      ...keysAtStamp(computedNow, localNow, keyTargets(row.data)),
      entries: row.data,
      playheadIn,
    };
  }, [source, store, targetEntries]);

  const [backFn, forwardFn, addPreview, removePreview] = useAnimationStore(
    useShallow((state: AnimationData & AnimationActions) => [
      state.skipToPrevKeyframe,
      state.skipToNextKeyframe,
      state.addPreview,
      state.removePreview,
    ]),
  );

  const onPrev = useCallback(() => {
    if (!prevEnabled) return;
    backFn(source, true);
  }, [backFn, prevEnabled, source]);

  const onNext = useCallback(() => {
    if (!nextEnabled) return;
    forwardFn(source, true);
  }, [forwardFn, nextEnabled, source]);

  const onPrevPreviewEnter = useCallback(() => {
    addPreview({
      stamp: prevTime ?? 0,
      semanticTime: SemanticTime.Backward,
    });
  }, [addPreview, prevTime]);

  const onPrevPreviewLeave = useCallback(() => {
    removePreview((p) => p.semanticTime === SemanticTime.Backward);
  }, [removePreview]);

  const onNextPreviewEnter = useCallback(() => {
    addPreview({
      stamp: nextTime ?? 0,
      semanticTime: SemanticTime.Forward,
    });
  }, [addPreview, nextTime]);

  const onNextPreviewLeave = useCallback(() => {
    removePreview((p) => p.semanticTime === SemanticTime.Forward);
  }, [removePreview]);

  const trackIds = useMemo(() => {
    return uniq(source.data.map((data) => data.trackId));
  }, [source.data]);

  return {
    prevEnabled,
    nextEnabled,
    prevTime,
    nextTime,
    dashed,
    keyState,
    currentFrame,
    targetEntries,
    missingEntries,
    targetPoints,
    onPrev,
    onNext,
    onPrevPreviewEnter,
    onPrevPreviewLeave,
    onNextPreviewEnter,
    onNextPreviewLeave,
    trackIds,
    keyStateNow,
  };
}
