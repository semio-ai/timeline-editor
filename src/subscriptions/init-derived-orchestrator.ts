import { shallow } from "zustand/shallow";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import { DerivedSnapshot } from "../types";
import { buildDerivedSnapshot } from "../functions";
import { logDerivedEvent } from "../utils/derived-debug";
import { projectRowVerticalAxes } from "./update-view-vertical-axes";

interface DerivedInputs {
  tracks: AnimationData["tracks"];
  animatables: AnimationData["animatables"];
  namespaces: AnimationData["namespaces"];
  animations: AnimationData["animations"];
  instancedTrackSources: AnimationData["instancedTrackSources"];
  dragState: AnimationData["dragState"];
  selectionState: AnimationData["selectionState"];
  editorViews: AnimationData["editorViews"];
  sourceRowIds: AnimationData["sourceRowIds"];
  sourceRowIdsByView: AnimationData["sourceRowIdsByView"];
  trackBaker: AnimationData["trackBaker"];
}

function computeDerivedState(inputs: DerivedInputs, versionHint: number): DerivedSnapshot {
  const snapshot = buildDerivedSnapshot({
    tracks: inputs.tracks,
    namespaces: inputs.namespaces,
    animations: inputs.animations,
    animatables: inputs.animatables,
    instancedTrackSources: inputs.instancedTrackSources,
    dragState: inputs.dragState,
    selectionState: inputs.selectionState,
    trackBaker: inputs.trackBaker,
    version: versionHint,
  });

  // inlined row map below

  const { rows: rowsWithAxes } = projectRowVerticalAxes(
    Object.fromEntries(Object.entries(snapshot.rows).map(([rowId, row]) => [rowId, row.computed])),
    inputs.editorViews,
    inputs.sourceRowIds,
    inputs.sourceRowIdsByView,
  );

  return {
    ...snapshot,
    rows: Object.fromEntries(
      Object.entries(snapshot.rows).map(([rowId, row]) => [
        rowId,
        {
          ...row,
          computed: rowsWithAxes[rowId] ?? row.computed,
        },
      ]),
    ),
  };
}

export function initDerivedOrchestrator(
  api: AnimationApi,
  set: AnimationStoreSetter,
  get: AnimationStoreGetter,
): () => void {
  let latestSnapshot: DerivedSnapshot | undefined;

  const currentState = get();

  const initialInputs: DerivedInputs = {
    tracks: currentState.tracks,
    animatables: currentState.animatables,
    namespaces: currentState.namespaces,
    animations: currentState.animations,
    instancedTrackSources: currentState.instancedTrackSources,
    dragState: currentState.dragState,
    selectionState: currentState.selectionState,
    editorViews: currentState.editorViews,
    sourceRowIds: currentState.sourceRowIds,
    sourceRowIdsByView: currentState.sourceRowIdsByView,
    trackBaker: currentState.trackBaker,
  };

  const maybeApplyDerived = (inputs: DerivedInputs) => {
    const versionHint = (latestSnapshot?.version ?? currentState.derivedSnapshot?.version ?? 0) + 1;
    const snapshot = computeDerivedState(inputs, versionHint);
    latestSnapshot = snapshot;

    logDerivedEvent("derivedOrchestrator", "snapshot", () => ({
      version: snapshot.version,
      trackCount: Object.keys(snapshot.tracks).length,
      rowCount: Object.keys(snapshot.rows).length,
    }));

    set({ derivedSnapshot: snapshot });
  };

  const unsubscribeStore = api.subscribe(
    (state: AnimationData) => ({
      tracks: state.tracks,
      animatables: state.animatables,
      namespaces: state.namespaces,
      animations: state.animations,
      instancedTrackSources: state.instancedTrackSources,
      dragState: state.dragState,
      selectionState: state.selectionState,
      editorViews: state.editorViews,
      sourceRowIds: state.sourceRowIds,
      sourceRowIdsByView: state.sourceRowIdsByView,
      trackBaker: state.trackBaker,
    }),
    (inputs) => {
      maybeApplyDerived(inputs);
    },
    { fireImmediately: true, equalityFn: shallow },
  );

  maybeApplyDerived(initialInputs);

  return unsubscribeStore;
}
