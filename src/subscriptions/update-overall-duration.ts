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
      namespaces: state.namespaceInfo,
    }),
    ({ animations, namespaces }) => {
      const instances = Object.values(namespaces).flatMap((ns) => Object.values(ns));
      const maxDuration = Math.max(
        // Require that the player duration is at least 1000ms
        1000,
        ...instances.map(
          (instance) =>
            animations[instance.animationId]?.duration *
            computeWorldStamp(1, instance.settings.timescale ?? 1, instance.settings.offset ?? 0),
        ),
      );
      updateDuration(maxDuration);
      api.setState({ duration: maxDuration });
    },
    { equalityFn: shallow, fireImmediately: true },
  );
}
