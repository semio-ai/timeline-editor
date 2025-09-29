import { omit } from "lodash";
import { shallow } from "zustand/shallow";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import { SourceRow } from "../types";
import { computeConsolidatedSourceRow, computeSourceRowsFromSources } from "../functions";

export function updateViewTrackSources(
  api: AnimationApi,
  set: AnimationStoreSetter,
  _get: AnimationStoreGetter,
): () => void {
  return api.subscribe(
    (state: AnimationData) => ({
      editorViews: state.editorViews,
      activeAnimationInstance: state.activeAnimationInstance,
    }),
    ({ editorViews, activeAnimationInstance }, { editorViews: prevEditorViews }) => {
      const removedIds = Object.keys(prevEditorViews).filter((id) => !editorViews[id]);
      // For each view, we need to add an entry in the set of instancedTrackSources
      // reflecting the timeline.
      // The id will be the id of the view.
      const newInstancedTrackSources: Record<string, SourceRow> = {};

      Object.values(editorViews).forEach((view) => {
        const allSources = Object.values(view.sourcesByAnimationInstance).flat();
        const consolidated = computeConsolidatedSourceRow(
          allSources,
          activeAnimationInstance,
          view.id,
        );
        newInstancedTrackSources[view.id] = consolidated;
      });

      set((state) => {
        // Remove any entries in the instancedTrackSources from views that are no longer present.
        const clearedInstancedTrackSources = omit(state.instancedTrackSources, removedIds);

        return {
          instancedTrackSources: { ...clearedInstancedTrackSources, ...newInstancedTrackSources },
        };
      });
    },
    {
      equalityFn: (a, b) => {
        // Simple shallow comparison of editorViews and activeAnimationInstance
        return (
          shallow(a.editorViews, b.editorViews) &&
          a.activeAnimationInstance === b.activeAnimationInstance
        );
      },
    },
  );
}
