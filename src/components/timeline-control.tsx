import type { ReactNode } from "react";
import { useCallback, useMemo } from "react";
import { clsx } from "clsx";
import { SelectTree, Size, TreeOption, Variant } from "@semio/ui";
import { usePlayerStore } from "@semio/utils";
import { useShallow } from "zustand/react/shallow";
import { uniq } from "lodash";
import {
  useAnimationStore,
  useColors,
  useKeyControlState,
  useLocalGlobalTransformLookup,
  useNameLookup,
} from "../hooks";
import { computeTreeOptionsFromSources } from "../functions/compute-tree-options-from-sources";
import { computeVisibleSourceTracks } from "../functions/compute-visible-source-tracks";
import { AnimationActions, AnimationData } from "../store-types";
import type { SimpleKeypoint, SimpleRawValue } from "../types/data/simple-track";
import type { SourceRow } from "../types";
import { buildTrackKey } from "../utils/track-key";
import { useValuesRef } from "../hooks/use-values-ref";
import { KeyStrip } from "./key-strip";
import { DataIcon } from "./data-icon";

export function TimelineControl({ viewId }: { viewId: string }): ReactNode {
  const { source, namespaces, animations, sourcesByAnimationInstance, viewData } =
    useAnimationStore(
      useShallow((state: AnimationData) => ({
        source: state.instancedTrackSources.global,
        namespaces: state.namespaces,
        animations: state.animations,
        sourcesByAnimationInstance: state.sourcesByAnimationInstance,
        viewData: state.editorViews[viewId],
      })),
    );

  const localGlobalTransformLookup = useLocalGlobalTransformLookup();
  const valuesRef = useValuesRef();

  const fallbackSource = useMemo<SourceRow>(
    () => source ?? { id: "global-fallback", data: [] },
    [source],
  );

  const color = useColors(source ? uniq(source.data.map((s) => s.trackId)) : []);

  const nameLookup = useNameLookup();

  const { updateKeypoints, removeKeypoints, updateSources } = useAnimationStore(
    useShallow((state: AnimationActions & AnimationData) => ({
      updateKeypoints: state.updateKeypoints,
      removeKeypoints: state.removeKeypoints,
      updateSources: state.updateSources,
    })),
  );

  const running = usePlayerStore(useShallow((state) => state.player.running));
  const stamp = usePlayerStore(useShallow((state) => state.player.stamp));
  const { keyState, currentFrame, missingEntries, targetPoints } =
    useKeyControlState(fallbackSource);

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

  const hasTrackOptions = useMemo(
    () => Object.values(sourcesByAnimationInstance).some((sources) => sources?.length > 0),
    [sourcesByAnimationInstance],
  );
  const hasView = Boolean(viewData);
  const controlsDisabled = !source || !hasTrackOptions || !hasView || running;

  const handleChangeSelection = useCallback(
    (_: string[], changes: { id: string; operation: "add" | "remove" }[]) => {
      if (controlsDisabled) return;
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
    [controlsDisabled, updateSources],
  );

  return (
    <div className="flex flex-1 flex-row h-9 items-center gap-1 pl-1">
      <KeyStrip
        source={fallbackSource}
        color={color}
        disabled={controlsDisabled}
        onHexClick={() => {
          if (controlsDisabled) return;
          if (keyState === "full" && currentFrame) {
            const points = targetPoints.length > 0 ? targetPoints : currentFrame.points;
            const removals: { trackId: string; keypointId: string }[] = points.map((p) => ({
              trackId: p.trackId,
              keypointId: p.id,
            }));
            removeKeypoints(removals);
            return;
          }

          const targets = keyState === "partial" ? missingEntries : source.data;
          const updates: { trackId: string; keypoint: Partial<SimpleKeypoint> }[] = targets
            .map((datum) => {
              const toLocal = localGlobalTransformLookup.toLocal[datum.instanceId];
              const localStamp = typeof toLocal === "function" ? toLocal(stamp) : stamp;
              const valueKey = buildTrackKey(
                datum.namespaceId as string,
                datum.instanceId as string,
                datum.trackId as string,
              );
              const value = valuesRef.current.get(valueKey) as SimpleRawValue | undefined;
              return {
                trackId: datum.trackId,
                keypoint: {
                  value,
                  stamp: localStamp,
                },
              };
            })
            .filter((u) => u.keypoint.value !== undefined);
          if (updates.length > 0 && !running) {
            updateKeypoints(updates, true);
          }
        }}
      />
      <div
        className={clsx(
          "w-full items-center",
          controlsDisabled && "opacity-50 pointer-events-none",
        )}
        aria-disabled={controlsDisabled}
      >
        <SelectTree
          label={hasTrackOptions ? "Select Track" : "No tracks"}
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
