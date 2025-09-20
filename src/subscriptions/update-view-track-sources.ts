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
    (state: AnimationData) => ({ editorViews: state.editorViews }),
    ({ editorViews }, { editorViews: prevEditorViews }) => {
      const removedIds = Object.keys(prevEditorViews).filter((id) => !editorViews[id]);
      // For each view, we need to add an entry in the set of instancedTrackSources
      // reflecting the timeline.
      // The id will be the id of the view.
      const newInstancedTrackSources: Record<string, SourceRow> = {};
      const viewUpdates: Record<string, { sourceRowIds: string[] }> = {};

      Object.values(editorViews).forEach((view) => {
        const allSources = Object.values(view.sourcesByAnimationInstance).flat();
        const consolidated = computeConsolidatedSourceRow(
          allSources,
          view.activeAnimationInstance,
          view.id,
        );
        newInstancedTrackSources[view.id] = consolidated;

        // Compute updated sourceRowIds for the view
        const sourceRowIds: string[] = [];
        Object.values(view.sourcesByAnimationInstance).forEach((sources) => {
          const sourceRows = computeSourceRowsFromSources(sources);
          sourceRows.forEach((sourceRow) => sourceRowIds.push(sourceRow.id));
        });
        viewUpdates[view.id] = { sourceRowIds };
      });

      set((state) => {
        // Remove any entries in the instancedTrackSources from views that are no longer present.
        const clearedInstancedTrackSources = omit(state.instancedTrackSources, removedIds);

        // Update views with new sourceRowIds
        const updatedViews = { ...state.editorViews };
        Object.entries(viewUpdates).forEach(([viewId, updates]) => {
          if (updatedViews[viewId]) {
            updatedViews[viewId] = { ...updatedViews[viewId], ...updates };
          }
        });

        return {
          instancedTrackSources: { ...clearedInstancedTrackSources, ...newInstancedTrackSources },
          editorViews: updatedViews,
        };
      });
    },
    {
      equalityFn: (a, b) => {
        // Compare views excluding sourceRowIds
        const aViewsWithoutIds = Object.entries(a.editorViews).reduce((acc, [id, view]) => {
          const { sourceRowIds: _sourceRowIds, ...viewWithoutIds } = view;
          return { ...acc, [id]: viewWithoutIds };
        }, {});
        const bViewsWithoutIds = Object.entries(b.editorViews).reduce((acc, [id, view]) => {
          const { sourceRowIds: _sourceRowIds, ...viewWithoutIds } = view;
          return { ...acc, [id]: viewWithoutIds };
        }, {});
        return shallow(aViewsWithoutIds, bViewsWithoutIds);
      },
    },
  );
}
