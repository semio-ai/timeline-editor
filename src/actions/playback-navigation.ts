import { produce } from "immer";
import { adjacentKeyTime } from "../functions";
import { resolveAnimationDuration } from "../functions/compute-animation-extent";
import type { AnimationData, AnimationStoreGetter, AnimationStoreSetter } from "../store-types";
import type { SourceRow } from "../types";
import { currentDerivedSnapshot } from "../subscriptions/init-derived-orchestrator";

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

  const landed = adjacentKeyTime(
    computedData,
    "next",
    playerState.player.stamp,
    playerState.player.bounds,
    respectBounds ?? false,
  );
  if (landed !== undefined) playerState.resetPlayer(landed);
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

  const landed = adjacentKeyTime(
    computedData,
    "previous",
    playerState.player.stamp,
    playerState.player.bounds,
    respectBounds ?? false,
  );
  if (landed !== undefined) playerState.resetPlayer(landed);
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
