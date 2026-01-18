import { shallow } from "zustand/shallow";
import { isEqual } from "lodash";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import { LayerBand, SourceRow } from "../types";
import { groupDerivedTracks } from "../functions/group-derived-tracks";
import { getIconCode } from "../functions/get-icon-code";

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
      tracksRevision: state.tracksRevision ?? 0,
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
            const grouped = groupDerivedTracks(animation.tracks, tracks, animatables);
            const sources = sourcesByAnimationInstance[instance.id] || [];

            grouped.forEach((group) => {
              const baseId = `${namespaceId}/${instance.id}/${group.baseTrackId}`;
              const sourceGroup = sources.find((s) => s.id === baseId);
              const expanded =
                sourceGroup && "expanded" in sourceGroup ? sourceGroup.expanded : undefined;

              const groupChildren = group.children.map((child) => {
                const childId = `${namespaceId}/${instance.id}/${child.trackId}`;
                const isSelected =
                  foreground &&
                  (selectedTrackLookup.has(childId) || selectedTrackLookup.has(child.trackId));
                let layerBand = LayerBand.Background;
                if (foreground) {
                  layerBand = isSelected
                    ? LayerBand.ForegroundSelected
                    : LayerBand.ForegroundUnselected;
                }
                const childAnimatable =
                  child.derivedAnimatable ?? animatables[child.track.animatableId];
                return {
                  childId,
                  data: {
                    selectable: foreground,
                    editable: true,
                    layerBand,
                    animationId: animation.id,
                    namespaceId,
                    instanceId: instance.id,
                    // TODO(semio-agent): This assumes numeric tracks; update when string/boolean tracks are surfaced.
                    type: "number" as const,
                    trackId: child.trackId,
                    animatableId: child.track.animatableId,
                    iconCode: childAnimatable
                      ? getIconCode(childAnimatable.type, childAnimatable.pub?.units)
                      : undefined,
                  },
                };
              });

              const shouldGroup =
                group.children.length > 1 || group.children.some((child) => Boolean(child.axis));

              if (shouldGroup) {
                instancedTrackSources[baseId] = {
                  id: baseId,
                  name: group.name,
                  expanded,
                  data: groupChildren.map((child) => ({
                    ...child.data,
                    type: "group",
                  })),
                };
              }

              groupChildren.forEach(({ childId, data }) => {
                instancedTrackSources[childId] = {
                  id: childId,
                  data: [data],
                };
              });
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
          shallow(current.sourcesByAnimationInstance, previous.sourcesByAnimationInstance) &&
          current.tracksRevision === previous.tracksRevision
        );
      },
      fireImmediately: true,
    },
  );
}
