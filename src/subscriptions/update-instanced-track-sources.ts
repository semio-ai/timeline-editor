import { shallow } from "zustand/shallow";
import { isEqual } from "lodash";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import { LayerBand, SourceRow } from "../types";

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
      activeAnimationId: state.selectionState.instanceId,
      selectedKeypoints: state.selectionState.keypoints,
    }),
    ({
      namespaces,
      animations,
      animatables,
      tracks,
      sourcesByAnimationInstance,
      activeAnimationId,
      selectedKeypoints,
    }) => {
      // console.log(namespaceInfo, animations, subscribes);
      // for each namespace -> for each instance -> for each track in the instance's aninimation subscribe... to namespace/track
      if (!namespaces) return;

      const selectedTrackLookup = new Set<string>();
      const registerSelectionKey = (key: string) => {
        if (!key) return;
        selectedTrackLookup.add(key);
        const tail = key.split("/").pop();
        if (tail) {
          selectedTrackLookup.add(tail);
          const base = tail.split(".")[0];
          if (base) {
            selectedTrackLookup.add(base);
          }
        }
      };

      selectedKeypoints.forEach((keypointIds, trackKey) => {
        if (keypointIds && keypointIds.size > 0) {
          registerSelectionKey(trackKey);
        }
      });

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
            const foreground = !activeAnimationId || activeAnimationId === instance.id;
            animation.tracks.forEach((trackId) => {
              const animatable = animatables[tracks[trackId].animatableId];
              if (!animatable) return;

              const trackRowId = `${namespaceId}/${instance.id}/${trackId}`;
              const trackSelected =
                foreground &&
                (selectedTrackLookup.has(trackRowId) || selectedTrackLookup.has(trackId));

              const baseBand = !foreground
                ? LayerBand.Background
                : trackSelected
                  ? LayerBand.ForegroundSelected
                  : LayerBand.ForegroundUnselected;

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
                  data: TYPE_FIELDS[trackType as string].map((field) => {
                    const fieldTrackId = `${trackRowId}.${field}`;
                    const fieldSelected =
                      foreground &&
                      (selectedTrackLookup.has(fieldTrackId) ||
                        selectedTrackLookup.has(`${trackId}.${field}`));
                    const fieldBand = fieldSelected ? LayerBand.ForegroundSelected : baseBand;

                    return {
                      selectable: foreground,
                      editable: true,
                      layerBand: fieldBand,
                      animationId: animation.id,
                      namespaceId,
                      instanceId: instance.id,
                      type: "group",
                      trackId,
                      animatableId: animatable.id,
                      attribute: field,
                    };
                  }),
                };

                TYPE_FIELDS[trackType as string].forEach((field) => {
                  const fieldId = `${namespaceId}/${instance.id}/${trackId}.${field}`;
                  const fieldTrackId = `${trackRowId}.${field}`;
                  const fieldSelected =
                    foreground &&
                    (selectedTrackLookup.has(fieldTrackId) ||
                      selectedTrackLookup.has(`${trackId}.${field}`));
                  instancedTrackSources[fieldId] = {
                    id: `${namespaceId}/${instance.id}/${trackId}.${field}`,
                    data: [
                      {
                        selectable: foreground,
                        editable: true,
                        layerBand: fieldSelected ? LayerBand.ForegroundSelected : baseBand,
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
                      selectable: foreground,
                      editable: true,
                      layerBand: baseBand,
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

        const selectionSignature = (selection: AnimationData["selectionState"]["keypoints"]) =>
          Array.from(selection.entries())
            .map(([trackKey, ids]) => ({
              trackKey,
              ids: Array.from(ids).sort(),
            }))
            .sort((left, right) => left.trackKey.localeCompare(right.trackKey));

        return (
          current.activeAnimationId === previous.activeAnimationId &&
          isEqual(
            selectionSignature(current.selectedKeypoints),
            selectionSignature(previous.selectedKeypoints),
          ) &&
          isEqual(allCurrentTracks, allPreviousTracks) &&
          isEqual(allCurrentGroups, allPreviousGroups) &&
          shallow(current.namespaces, previous.namespaces) &&
          shallow(current.sourcesByAnimationInstance, previous.sourcesByAnimationInstance)
        );
      },
      fireImmediately: true,
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
