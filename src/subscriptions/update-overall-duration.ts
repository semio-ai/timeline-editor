import { usePlayerStore } from "@semio/utils";
import { shallow } from "zustand/shallow";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import { computeWorldStamp } from "../functions";

export function updateOverallDuration(
  api: AnimationApi,
  _set: AnimationStoreSetter,
  _get: AnimationStoreGetter,
): () => void {
  const updateDuration = usePlayerStore.getState().updateDuration;
  return api.subscribe(
    (state: AnimationData) => ({
      animations: state.animations,
      namespaces: state.namespaces,
    }),
    ({ animations, namespaces }) => {
      const instances = Object.values(namespaces).flatMap((ns) =>
        Object.values(ns.animationInstances),
      );
      const durations = instances
        .map((instance) => {
          const duration = animations[instance.animationId]?.duration;
          if (typeof duration !== "number" || !Number.isFinite(duration)) {
            return undefined;
          }
          const timescale = instance.settings.timescale ?? 1;
          const offset = instance.settings.offset ?? 0;
          const worldDuration = duration * computeWorldStamp(1, timescale, offset);
          return Number.isFinite(worldDuration) ? worldDuration : undefined;
        })
        .filter((value): value is number => typeof value === "number");

      const maxDuration = Math.max(
        // Require that the player duration is at least 1000ms
        1000,
        ...durations,
      );

      updateDuration(maxDuration);
      api.setState({ duration: maxDuration });
    },
    { equalityFn: shallow, fireImmediately: true },
  );
}
