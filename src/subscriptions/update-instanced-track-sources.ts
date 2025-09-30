import { shallow } from "zustand/shallow";
import { isEqual } from "lodash";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import { SourceRow } from "../types";

export function updateInstancedTrackSources(
  api: AnimationApi,
  set: AnimationStoreSetter,
  _get: AnimationStoreGetter,
): () => void {
  return api.subscribe(
    (state: AnimationData) => ({
      namespaces: state.namespaces,
      animations: state.animations,
      animatables: state.animatables,
      tracks: state.tracks,
      sourcesByAnimationInstance: state.sourcesByAnimationInstance,
    }),
    ({ namespaces, animations, animatables, tracks, sourcesByAnimationInstance }) => {
      // console.log(namespaceInfo, animations, subscribes);
      // for each namespace -> for each instance -> for each track in the instance's aninimation subscribe... to namespace/track
      if (!namespaces) return;

      const instancedTrackSources: Record<string, SourceRow> = {};
      Object.entries(namespaces).forEach(([namespaceId, namespace]) => {
        Object.entries(namespace.animationInstances).forEach(([_instanceId, instance]) => {
          const animation = animations[instance.animationId];

          // if the animation has groups, warn that they are not yet supported.
          if (animation?.groups && Object.keys(animation.groups).length > 0) {
            console.warn(
              `Animation ${animation.id} has groups defined, but groups are not yet supported in instanced track sources.`,
            );
          }

          if (animation) {
            animation.tracks.forEach((trackId) => {
              const animatable = animatables[tracks[trackId].animatableId];
              if (!animatable) return;

              // get the type of the animatable;
              const trackType = animatable.type;

              // If the track type is complex, we need to add both the top-level track and the attribute entries
              if (COMPLEX_TYPES.has(trackType)) {
                const id = `${namespaceId}/${instance.id}/${trackId}`;
                // Find the corresponding source to get its expanded state
                const sources = sourcesByAnimationInstance[instance.id] || [];
                const sourceGroup = sources.find((s) => s.id === id);
                const expanded =
                  sourceGroup && "expanded" in sourceGroup ? sourceGroup.expanded : undefined;

                instancedTrackSources[id] = {
                  id: `${namespaceId}/${instance.id}/${trackId}`,
                  expanded,
                  data: TYPE_FIELDS[trackType as string].map((field) => ({
                    foreground: true,
                    selectable: true,
                    editable: true,
                    animationId: animation.id,
                    namespaceId,
                    instanceId: instance.id,
                    type: "group",
                    trackId,
                    animatableId: animatable.id,
                    attribute: field,
                  })),
                };

                TYPE_FIELDS[trackType as string].forEach((field) => {
                  const fieldId = `${namespaceId}/${instance.id}/${trackId}/${field}`;
                  instancedTrackSources[fieldId] = {
                    id: `${namespaceId}/${instance.id}/${trackId}/${field}`,
                    data: [
                      {
                        foreground: true,
                        selectable: true,
                        editable: true,
                        animationId: animation.id,
                        namespaceId,
                        instanceId: instance.id,
                        type: "number",
                        trackId,
                        animatableId: animatable.id,
                        attribute: field,
                      },
                    ],
                  };
                });
              } else {
                // Otherwise, just add the single track entry
                const id = `${namespaceId}/${instance.id}/${trackId}`;
                instancedTrackSources[id] = {
                  id: `${namespaceId}/${instance.id}/${trackId}`,
                  data: [
                    {
                      foreground: true,
                      selectable: true,
                      editable: true,
                      animationId: animation.id,
                      namespaceId,
                      instanceId: instance.id,
                      type: animatable.type as "string" | "number" | "boolean",
                      trackId,
                      animatableId: animatable.id,
                    },
                  ],
                };
              }
            });
          }
        });
      });

      set({ instancedTrackSources });
    },
    {
      equalityFn: (current, previous) => {
        // We only care about cases where the individual track ids change across all animations
        const allCurrentTracks = new Set(
          Object.values(current.animations).flatMap((a) => a.tracks),
        );
        const allPreviousTracks = new Set(
          Object.values(previous.animations).flatMap((a) => a.tracks),
        );
        const allCurrentGroups = new Set(
          Object.values(current.animations).flatMap((a) => a.groups),
        );
        const allPreviousGroups = new Set(
          Object.values(previous.animations).flatMap((a) => a.groups),
        );
        return (
          isEqual(allCurrentTracks, allPreviousTracks) &&
          isEqual(allCurrentGroups, allPreviousGroups) &&
          shallow(current.namespaces, previous.namespaces) &&
          shallow(current.sourcesByAnimationInstance, previous.sourcesByAnimationInstance)
        );
      },
    },
  );
}

const COMPLEX_TYPES = new Set(["vector2", "vector3", "euler", "rgb", "hsl"]);

const TYPE_FIELDS: Record<string, string[]> = {
  vector2: ["x", "y"],
  vector3: ["x", "y", "z"],
  euler: ["r", "p", "y"],
  rgb: ["r", "g", "b"],
  hsl: ["h", "s", "l"],
};
