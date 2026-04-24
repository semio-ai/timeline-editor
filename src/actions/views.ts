import { produce } from "immer";
import type {
  AnimationData,
  AnimationStoreSetter,
  EditorViewState,
} from "../store-types";
import { TrackRender, VerticalAxis } from "../types";
import { View } from "../types/util/view";

/**
 * Reorder a view-id list so that:
 *   1. Each id appears at most once.
 *   2. Ids that don't exist in `editorViews` are dropped.
 *   3. Any view in `editorViews` not present in the input is appended.
 *
 * Used to keep the user-visible tab order coherent across edits.
 */
export function normalizeEditorViewOrder(
  viewOrder: string[],
  editorViews: Record<string, View>,
): string[] {
  const ordered: string[] = [];
  viewOrder.forEach((id) => {
    if (!editorViews[id] || ordered.includes(id)) return;
    ordered.push(id);
  });
  Object.keys(editorViews).forEach((id) => {
    if (!ordered.includes(id)) {
      ordered.push(id);
    }
  });
  return ordered;
}

export function addView(
  set: AnimationStoreSetter,
  view: Partial<View> & { id: string },
): void {
  set((state: AnimationData) => {
    const defaultView: View = {
      id: view.id,
      name: view.name,
      trackRender: view.trackRender ?? TrackRender.Key,
      verticalAxis: view.verticalAxis ?? VerticalAxis.Normalized,
      hiddenSourceTrackIds: view.hiddenSourceTrackIds ?? [],
      trackFilter: view.trackFilter ?? "",
    };
    const nextViews = {
      ...state.editorViews,
      [view.id]: { ...defaultView, ...view },
    };
    const nextOrder = normalizeEditorViewOrder(
      state.editorViewOrder.includes(view.id)
        ? state.editorViewOrder
        : [...state.editorViewOrder, view.id],
      nextViews,
    );
    return {
      editorViews: nextViews,
      editorViewOrder: nextOrder,
      activeEditorViewId: state.activeEditorViewId ?? nextOrder[0],
    };
  });
}

export function replaceEditorViews(set: AnimationStoreSetter, next: EditorViewState): void {
  set(
    produce((state: AnimationData) => {
      const nextViews: Record<string, View> = {};
      next.views.forEach((view) => {
        if (!view.id || nextViews[view.id]) return;
        nextViews[view.id] = {
          id: view.id,
          name: view.name,
          trackRender: view.trackRender ?? TrackRender.Key,
          verticalAxis: view.verticalAxis ?? VerticalAxis.Normalized,
          hiddenSourceTrackIds: [...(view.hiddenSourceTrackIds ?? [])],
          trackFilter: view.trackFilter ?? "",
        };
      });
      if (Object.keys(nextViews).length === 0) {
        nextViews["view-1"] = {
          id: "view-1",
          name: "View 1",
          trackRender: TrackRender.Key,
          verticalAxis: VerticalAxis.Normalized,
          hiddenSourceTrackIds: [],
          trackFilter: "",
        };
      }
      const nextOrder = normalizeEditorViewOrder(next.viewOrder, nextViews);
      const nextActive =
        next.activeViewId && nextOrder.includes(next.activeViewId)
          ? next.activeViewId
          : nextOrder[0];
      state.editorViews = nextViews;
      state.editorViewOrder = nextOrder;
      state.activeEditorViewId = nextActive;
    }),
  );
}

export function setActiveEditorView(set: AnimationStoreSetter, viewId: string): void {
  set(
    produce((state: AnimationData) => {
      if (!state.editorViews[viewId]) return;
      state.activeEditorViewId = viewId;
    }),
  );
}

export function updateView(
  set: AnimationStoreSetter,
  viewId: string,
  view: Partial<View>,
): void {
  set(
    produce((state: AnimationData) => {
      if (!state.editorViews[viewId]) return;
      state.editorViews[viewId] = {
        ...state.editorViews[viewId],
        ...view,
        hiddenSourceTrackIds:
          view.hiddenSourceTrackIds ?? state.editorViews[viewId].hiddenSourceTrackIds,
      };
    }),
  );
}

export function removeView(set: AnimationStoreSetter, viewId: string): void {
  set(
    produce((state: AnimationData) => {
      if (!state.editorViews[viewId]) return;
      if (Object.keys(state.editorViews).length <= 1) return;
      const { [viewId]: _, ...rest } = state.editorViews;
      state.editorViews = rest;
      state.editorViewOrder = normalizeEditorViewOrder(
        state.editorViewOrder.filter((id) => id !== viewId),
        state.editorViews,
      );
      if (state.activeEditorViewId === viewId) {
        state.activeEditorViewId = state.editorViewOrder[0];
      }
    }),
  );
}

export function setVerticalViewport(
  set: AnimationStoreSetter,
  viewId: string,
  viewport: { top: number; bottom: number } | undefined,
): void {
  set(
    produce((state: AnimationData) => {
      const view = state.editorViews[viewId];
      if (!view) return;
      view.verticalViewport = viewport;
    }),
  );
}
