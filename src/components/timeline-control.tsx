import type { ReactNode } from "react";
import { useCallback, useMemo, useRef, useState } from "react";
import { SelectTree, Size, TreeOption, Variant } from "@semio/ui";
import { getLookup } from "@semio/utils";
import { useShallow } from "zustand/react/shallow";
import { shallow } from "zustand/shallow";
import { uniq } from "lodash";
import {
  useAnimationStore,
  useColors,
  useLocalGlobalTransformLookup,
  useNameLookup,
  usePlayerSubscription,
  useTrackAnimatableLookup,
} from "../hooks";
import { computeTreeOptionsFromSources } from "../functions/compute-tree-options-from-sources";
import { computeVisibleSourceTracks } from "../functions/compute-visible-source-tracks";
import { InstancedFrameInfo } from "../types";
import { AnimationActions, AnimationData } from "../store-types";
import { TrackControl } from "./track-control";
import { DataIcon } from "./data-icon";

export function TimelineControl({ viewId }: { viewId: string }): ReactNode {
  const {
    source,
    computedRowData,
    interpolators,
    viewData,
    namespaces,
    animations,
    sourcesByAnimationInstance,
  } = useAnimationStore(
    useShallow((state: AnimationData) => ({
      source: state.instancedTrackSources.global,
      computedRowData: state.computedRowData?.global,
      interpolators: state.trackInterpolators,
      viewData: state.editorViews[viewId],
      namespaces: state.namespaces,
      animations: state.animations,
      sourcesByAnimationInstance: state.sourcesByAnimationInstance,
    })),
  );

  const trackAnimatableLookup = useTrackAnimatableLookup();
  const localGlobalTransformLookup = useLocalGlobalTransformLookup();

  const hasData = source && computedRowData && viewData;

  const color = useColors(hasData ? uniq(source.data.map((s) => s.trackId)) : []);

  const nameLookup = useNameLookup();

  const { updateKeypoints, removeKeypoints, updateSources } = useAnimationStore(
    useShallow((state: AnimationActions & AnimationData) => ({
      updateKeypoints: state.updateKeypoints,
      removeKeypoints: state.removeKeypoints,
      updateSources: state.updateSources,
    })),
  );

  const [instancedFrame, setInstancedFrame] = useState<InstancedFrameInfo | undefined>(undefined);
  const stampRef = useRef<number>(0);

  usePlayerSubscription(
    (state) => ({ running: state.player.running, stamp: state.player.stamp }),
    ({ running, stamp }) => {
      stampRef.current = stamp;
      if (running && hasData) {
        setInstancedFrame(undefined);
      } else if (hasData) {
        const f = computedRowData.virtualFrames.find((s) => s.stamp === stamp);
        setInstancedFrame(f);
      }
    },
    shallow,
  );

  const { treeOptions, treeValues }: { treeOptions: TreeOption[]; treeValues: string[] } =
    useMemo(() => {
      // Build a set of treeOptions and the current values based on the source data and the "hidden" field for leaf sourceTracks
      const options: TreeOption[] = [];
      const values: string[] = [];

      Object.values(namespaces).forEach((namespace) => {
        // Create a tree option group for the namespace;
        const namespaceOption: TreeOption = {
          value: namespace.id,
          label: namespace.name,
          children: [],
          icon: <DataIcon iconCode="group" className="w-3/5 h-3/5" />,
        };

        // For each animation instance, add a group to the namespace option
        Object.values(namespace.animationInstances).forEach((instance) => {
          const instanceOption: TreeOption = {
            value: `${namespace.id}/${instance.id}`,
            label: animations[instance.animationId]?.name || "Unnamed Instance",
            icon: <DataIcon iconCode="group" className="w-3/5 h-3/5" />,
            children: computeTreeOptionsFromSources(
              sourcesByAnimationInstance[instance.id],
              nameLookup,
            ),
          };

          // Then add the instance option to the namespace option;
          namespaceOption.children!.push(instanceOption);
          // Add visible tracks to the values;
          const visibleTracks = computeVisibleSourceTracks(sourcesByAnimationInstance[instance.id]);
          visibleTracks.forEach((t) => values.push(t));
        });

        options.push(namespaceOption);
      });

      return { treeOptions: options, treeValues: values };
    }, [sourcesByAnimationInstance, namespaces, nameLookup, animations]);

  const handleChangeSelection = useCallback(
    (_: string[], changes: { id: string; operation: "add" | "remove" }[]) => {
      const base: Record<string, { id: string; hidden: boolean }> = {};
      const updates: Record<string, { id: string; hidden: boolean }> = changes.reduce(
        (acc, change) => {
          if (change.operation === "add") {
            // When adding, we are un-hiding a source row.
            acc[change.id] = { id: change.id, hidden: false };
          } else if (change.operation === "remove") {
            // When removing, we are hiding a source row.
            acc[change.id] = { id: change.id, hidden: true };
          }
          return acc;
        },
        base,
      );

      updateSources(updates);
    },
    [updateSources],
  );

  if (!hasData) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-row h-9 items-center gap-1 pl-1">
      <TrackControl
        source={source}
        filled={instancedFrame !== undefined}
        color={color}
        onHexClick={() => {
          if (instancedFrame !== undefined) {
            const removals = instancedFrame.points.map((p) => ({
              trackId: p.trackId,
              keypointId: p.id,
            }));
            removeKeypoints(removals);
          } else {
            const datumAnimatablePairs = source.data.map((datum) => ({
              datum,
              animatableId: trackAnimatableLookup[datum.trackId].id,
            }));
            const updates = datumAnimatablePairs
              .map(({ datum, animatableId }) => {
                const value = interpolators[getLookup(datum.namespaceId, animatableId)]?.value?.(
                  stampRef.current,
                );
                return {
                  trackId: datum.trackId,
                  keypoint: {
                    value,
                    stamp: localGlobalTransformLookup.toLocal[datum.namespaceId](stampRef.current),
                  },
                };
              })
              .filter((u) => u.keypoint.value !== undefined);
            updateKeypoints(updates, true);
          }
        }}
      />
      <div className="w-full items-center">
        <SelectTree
          label="Select Track"
          variant={Variant.Default}
          size={Size.Sm}
          options={treeOptions}
          value={treeValues}
          onChange={handleChangeSelection}
        />
      </div>
    </div>
  );
}
