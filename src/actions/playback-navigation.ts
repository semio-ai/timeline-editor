import { produce } from "immer";
import {
  computeLocalStamp,
  computeNextTime,
  computePreviousTime,
  computeWorldStamp,
} from "../functions";
import { resolveAnimationDuration } from "../functions/compute-animation-extent";
import type {
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import type { Namespace, SourceRow } from "../types";

/**
 * The unique animation-instance id for a row whose entries all reference the
 * same instance. Returns `undefined` for global / mixed-instance rows so
 * callers can fall back to world-time.
 */
function resolveUniqueInstanceId(sourceRow: SourceRow): string | undefined {
  let uniqueId: string | undefined;
  for (const entry of sourceRow.data) {
    if (!entry.instanceId) {
      return undefined;
    }
    if (!uniqueId) {
      uniqueId = entry.instanceId;
    } else if (uniqueId !== entry.instanceId) {
      return undefined;
    }
  }
  return uniqueId;
}

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
  const instanceId = resolveUniqueInstanceId(sourceRow);
  if (!instanceId) {
    return { localStamp: worldStamp, localBounds: worldBounds };
  }

  let settings: { timescale: number; offset: number } | undefined;
  for (const namespace of Object.values(namespaces)) {
    const instance = namespace.animationInstances[instanceId];
    if (instance) {
      const rawTimescale = instance.settings.timescale ?? 1;
      const rawOffset = instance.settings.offset ?? 0;
      const timescale = Number.isFinite(rawTimescale) && rawTimescale !== 0 ? rawTimescale : 1;
      const offset = Number.isFinite(rawOffset) ? rawOffset : 0;
      settings = {
        timescale,
        offset,
      };
      break;
    }
  }

  if (!settings) {
    return { localStamp: worldStamp, localBounds: worldBounds };
  }

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
  const computedData = state.derivedSnapshot?.rows?.[sourceRowId]?.computed;
  if (!computedData) return;

  const instancedFrameData = computedData.virtualFrames;
  const { localStamp, localBounds, toWorld } = resolveRowTimeContext(
    state.namespaces,
    sourceRow,
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
  const computedData = state.derivedSnapshot?.rows?.[sourceRowId]?.computed;
  if (!computedData) return;

  const instancedFrameData = computedData.virtualFrames;
  const { localStamp, localBounds, toWorld } = resolveRowTimeContext(
    state.namespaces,
    sourceRow,
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
