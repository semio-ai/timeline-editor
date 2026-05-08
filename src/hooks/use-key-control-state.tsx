import { useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { uniq } from "lodash";
import { usePlayerStore } from "@semio/utils";
import { computeNextTime, computePreviousTime } from "../functions";
import { type AnimationActions, type AnimationData } from "../store-types";
import { buildTrackKey } from "../utils/track-key";
import { SemanticTime, SourceRow, InstancedFrameInfo, LayerBand } from "../types";
import { useAnimationStore } from "./use-animation-store";
import { useLocalGlobalTransformLookup } from "./use-local-global-transforms";

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
}

export function useKeyControlState(source: SourceRow): KeyControlState {
  const computedData = useAnimationStore(
    useShallow((state: AnimationData) => state.derivedSnapshot?.rows?.[source.id]?.computed),
  );

  const bounds = usePlayerStore(useShallow((state) => state.player.bounds));
  const running = usePlayerStore(useShallow((state) => state.player.running));
  // Subscribing to `state.player.stamp` directly fires a React re-render
  // 40Hz during playback for every TrackControl/TimelineControl using this
  // hook — which then cascades into ControlRow + the radix menu plumbing
  // wrapped around each row. The stamp-derived outputs of this hook
  // (prev/next time, currentFrame, keyState) are gated on `!running`
  // anyway: prev/next return undefined during play, and currentFrame /
  // keyState are only meaningful when paused so the user can act on them.
  // Returning a stable value while running keeps the hook (and all its
  // callers) stable per tick.
  const stamp = usePlayerStore(
    useShallow((state) => (state.player.running ? null : state.player.stamp)),
  );
  const stampSafe = stamp ?? 0;

  const localGlobalTransformLookup = useLocalGlobalTransformLookup();
  const uniqueInstanceId = useMemo(() => {
    const ids = uniq(
      source.data
        .map((entry) => entry.instanceId)
        .filter((value): value is string => Boolean(value)),
    );
    return ids.length === 1 ? ids[0] : undefined;
  }, [source.data]);

  const toLocal =
    uniqueInstanceId && localGlobalTransformLookup.toLocal[uniqueInstanceId]
      ? localGlobalTransformLookup.toLocal[uniqueInstanceId]
      : undefined;
  const toWorld =
    uniqueInstanceId && localGlobalTransformLookup.toWorld[uniqueInstanceId]
      ? localGlobalTransformLookup.toWorld[uniqueInstanceId]
      : undefined;

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

  const currentFrame = useMemo(
    () => computedData?.virtualFrames?.find((frame) => frame.stamp === localStamp),
    [computedData, localStamp],
  );

  const targetEntries = useMemo(() => {
    if (source.data.length === 0) return [];
    const foreground = source.data.filter(
      (datum) =>
        datum.layerBand === LayerBand.ForegroundSelected ||
        datum.layerBand === LayerBand.ForegroundUnselected ||
        datum.layerBand === LayerBand.ForegroundLocked,
    );
    return foreground.length > 0 ? foreground : source.data;
  }, [source.data]);

  const targetEntryKeys = useMemo(() => {
    if (targetEntries.length === 0) return new Set<string>();
    return new Set(
      targetEntries.map((datum) =>
        buildTrackKey(datum.namespaceId ?? "", datum.instanceId ?? "", datum.trackId),
      ),
    );
  }, [targetEntries]);

  const targetPoints = useMemo(() => {
    if (!currentFrame || targetEntryKeys.size === 0) return [];
    return currentFrame.points.filter((point) => {
      const key = buildTrackKey(point.namespaceId ?? "", point.instanceId ?? "", point.trackId);
      return targetEntryKeys.has(key);
    });
  }, [currentFrame, targetEntryKeys]);

  const keyedEntryKeys = useMemo(() => {
    if (targetPoints.length === 0) return new Set<string>();
    return new Set(
      targetPoints.map((point) =>
        buildTrackKey(point.namespaceId ?? "", point.instanceId ?? "", point.trackId),
      ),
    );
  }, [targetPoints]);

  const missingEntries = useMemo(() => {
    if (targetEntries.length === 0) return [];
    if (!currentFrame || keyedEntryKeys.size === 0) return targetEntries.slice();
    return targetEntries.filter((datum) => {
      const namespaceId = datum.namespaceId ?? "";
      const instanceId = datum.instanceId ?? "";
      const key = buildTrackKey(namespaceId, instanceId, datum.trackId);
      return !keyedEntryKeys.has(key);
    });
  }, [currentFrame, keyedEntryKeys, targetEntries]);

  const keyState: KeyControlState["keyState"] = useMemo(() => {
    if (!currentFrame || keyedEntryKeys.size === 0) return "none";
    if (missingEntries.length === 0) return "full";
    return "partial";
  }, [currentFrame, keyedEntryKeys.size, missingEntries.length]);

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
  };
}
