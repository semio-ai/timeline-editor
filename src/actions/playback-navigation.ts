import { produce } from "immer";
import {
  computeLocalStamp,
  computeNextTime,
  computePreviousTime,
  computeWorldStamp,
} from "../functions";
import { resolveAnimationDuration } from "../functions/compute-animation-extent";
import type { AnimationData, AnimationStoreGetter, AnimationStoreSetter } from "../store-types";
import type { Namespace, SourceRow } from "../types";
import { currentDerivedSnapshot } from "../subscriptions/init-derived-orchestrator";
import { rowInstanceOf } from "../functions/view-filtered-source-row";
import { instanceTime } from "../functions/compute-row-data";

/** Always returns the bounds in `[min, max]` order, regardless of input. */
function normalizeBounds(bounds: [number, number]): [number, number] {
  return bounds[0] <= bounds[1] ? bounds : [bounds[1], bounds[0]];
}

/**
 * Convert the player's current world time and bounds into the local time
 * frame of the row's instance, returning a `toWorld` mapper for converting
 * back when the action commits a new player stamp.
 */
function resolveRowTimeContext(
  namespaces: Record<string, Namespace>,
  sourceRow: SourceRow,
  worldStamp: number,
  worldBounds: [number, number],
): {
  localStamp: number;
  localBounds: [number, number];
  toWorld?: (stamp: number) => number;
} {
  // A row of several instances holds its stamps in world time already.
  const owner = rowInstanceOf(sourceRow);
  const instance = owner
    ? namespaces[owner.namespaceId]?.animationInstances[owner.instanceId]
    : undefined;
  if (!instance) {
    return { localStamp: worldStamp, localBounds: worldBounds };
  }
  const settings = instanceTime(instance);

  const toLocal = (stamp: number) => computeLocalStamp(stamp, settings.timescale, settings.offset);
  const toWorld = (stamp: number) => computeWorldStamp(stamp, settings.timescale, settings.offset);
  const localStamp = toLocal(worldStamp);
  const localBounds = normalizeBounds([toLocal(worldBounds[0]), toLocal(worldBounds[1])]);

  return { localStamp, localBounds, toWorld };
}

export function skipToNextKeyframe(
  get: AnimationStoreGetter,
  sourceRow: SourceRow,
  respectBounds?: boolean,
): void {
  const state = get();
  const playerState = state.playerStore.getState();
  const sourceRowId = sourceRow.id;
  const computedData = currentDerivedSnapshot(state)?.rows?.[sourceRowId]?.computed;
  if (!computedData) return;

  const instancedFrameData = computedData.virtualFrames;
  const { localStamp, localBounds, toWorld } = resolveRowTimeContext(
    state.namespaces,
    // The row as the store holds it now, which the stamps above were built
    // from: the caller's copy can predate an instance joining or leaving it.
    state.instancedTrackSources[sourceRowId] ?? sourceRow,
    playerState.player.stamp,
    playerState.player.bounds,
  );
  const nextLocalTime = computeNextTime(
    instancedFrameData,
    localStamp,
    localBounds,
    respectBounds ?? false,
  );
  if (nextLocalTime !== undefined) {
    const nextWorldTime = toWorld ? toWorld(nextLocalTime) : nextLocalTime;
    playerState.resetPlayer(nextWorldTime);
  }
}

export function skipToPrevKeyframe(
  get: AnimationStoreGetter,
  sourceRow: SourceRow,
  respectBounds?: boolean,
): void {
  const state = get();
  const playerState = state.playerStore.getState();
  const sourceRowId = sourceRow.id;
  const computedData = currentDerivedSnapshot(state)?.rows?.[sourceRowId]?.computed;
  if (!computedData) return;

  const instancedFrameData = computedData.virtualFrames;
  const { localStamp, localBounds, toWorld } = resolveRowTimeContext(
    state.namespaces,
    // The row as the store holds it now, which the stamps above were built
    // from: the caller's copy can predate an instance joining or leaving it.
    state.instancedTrackSources[sourceRowId] ?? sourceRow,
    playerState.player.stamp,
    playerState.player.bounds,
  );
  const previousLocalTime = computePreviousTime(
    instancedFrameData,
    localStamp,
    localBounds,
    respectBounds ?? false,
  );
  if (previousLocalTime !== undefined) {
    const previousWorldTime = toWorld ? toWorld(previousLocalTime) : previousLocalTime;
    playerState.resetPlayer(previousWorldTime);
  }
}

export function skipToStart(get: AnimationStoreGetter): void {
  const playerState = get().playerStore.getState();
  playerState.resetPlayer(playerState.player.bounds[0]);
}

export function skipToEnd(get: AnimationStoreGetter): void {
  const playerState = get().playerStore.getState();
  playerState.resetPlayer(playerState.player.bounds[1]);
}

export function updateDuration(
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
  duration: number,
): void {
  const playerState = get().playerStore.getState();
  playerState.updateDuration(duration);
  set({ duration });
}

export function updateAnimationDuration(
  set: AnimationStoreSetter,
  animationId: string,
  duration: number,
  rescale: boolean,
): void {
  set(
    produce((state: AnimationData) => {
      const animation = state.animations[animationId];
      if (!animation) return;

      if (rescale) {
        // Rescale stamps proportionally to maintain relative positions.
        const oldExtent = resolveAnimationDuration(animation, state.tracks);
        if (oldExtent > 0 && duration > 0) {
          const scale = duration / oldExtent;
          animation.tracks.forEach((trackId) => {
            state.tracks[trackId].points = state.tracks[trackId].points.map((point) => ({
              ...point,
              stamp: point.stamp * scale,
            }));
          });
        }
      }
      // Update the viewport extent hint
      animation.defaultViewportExtent = duration;
    }),
  );
}

export function updateFramerate(set: AnimationStoreSetter, framerate: number): void {
  set({ framerate });
}
