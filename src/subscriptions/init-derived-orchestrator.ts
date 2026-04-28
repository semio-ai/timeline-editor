import {
  PlayerData,
  PlayerDirection,
  RawValue,
  usePlayerStore,
  mergeValueMaps,
  useValuesStore,
} from "@semio/utils";
import { shallow } from "zustand/shallow";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import { DerivedSnapshot } from "../types";
import {
  matchingIdentityRawValue,
  rawValueMultiplyScalar,
  buildDerivedSnapshot,
  computeLocalStamp,
} from "../functions";
import { computeDerivativeInterpolator } from "../functions/compute-derivative-interpolator";
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
}

interface DerivedComputation {
  snapshot: DerivedSnapshot;
  values: Map<string, RawValue | undefined>;
  velocities: Map<string, RawValue | undefined>;
}

function computeValueAndVelocityMaps(
  snapshot: DerivedSnapshot | undefined,
  player: PlayerData,
): { values: Map<string, RawValue | undefined>; velocities: Map<string, RawValue | undefined> } {
  const values = new Map<string, RawValue | undefined>();
  const velocities = new Map<string, RawValue | undefined>();

  if (!snapshot) {
    return { values, velocities };
  }

  const { stamp, running, speed, _currentDirection } = player.player;
  const multiplier = (_currentDirection === PlayerDirection.Reverse ? -1 : 1) * speed;

  Object.entries(snapshot.tracks).forEach(([trackKey, track]) => {
    if (track.metadata?.muted) return;
    const lookup = trackKey;
    const timescale = track.metadata?.timescale ?? 1;
    const offset = track.metadata?.offset ?? 0;
    const safeTimescale = Number.isFinite(timescale) && timescale !== 0 ? timescale : 1;
    const localStamp = computeLocalStamp(stamp, safeTimescale, offset);

    const previewInterpolator = track.preview?.interpolator;
    const valueInterpolator = previewInterpolator ?? track.canonical.interpolator;
    values.set(lookup, valueInterpolator(localStamp));

    let velocity: RawValue | undefined;
    if (previewInterpolator) {
      const duration = track.metadata?.duration ?? 1000;
      const previewDerivative = computeDerivativeInterpolator(previewInterpolator, duration);
      velocity = previewDerivative(localStamp);
    } else {
      velocity = track.canonical.derivative(localStamp);
    }
    if (velocity !== undefined) {
      const scaledVelocity = rawValueMultiplyScalar(velocity, safeTimescale);
      if (running) {
        velocities.set(lookup, rawValueMultiplyScalar(scaledVelocity, multiplier));
      } else {
        velocities.set(lookup, matchingIdentityRawValue(scaledVelocity));
      }
    } else {
      velocities.set(lookup, undefined);
    }
  });

  return { values, velocities };
}

function computeDerivedState(
  inputs: DerivedInputs,
  versionHint: number,
  player: PlayerData,
): DerivedComputation {
  const snapshot = buildDerivedSnapshot({
    tracks: inputs.tracks,
    namespaces: inputs.namespaces,
    animations: inputs.animations,
    animatables: inputs.animatables,
    instancedTrackSources: inputs.instancedTrackSources,
    dragState: inputs.dragState,
    selectionState: inputs.selectionState,
    version: versionHint,
  });

  // inlined row map below

  const { rows: rowsWithAxes } = projectRowVerticalAxes(
    Object.fromEntries(Object.entries(snapshot.rows).map(([rowId, row]) => [rowId, row.computed])),
    inputs.editorViews,
    inputs.sourceRowIds,
    inputs.sourceRowIdsByView,
  );

  const adjustedSnapshot: DerivedSnapshot = {
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

  const { values, velocities } = computeValueAndVelocityMaps(adjustedSnapshot, player);

  return {
    snapshot: adjustedSnapshot,
    values,
    velocities,
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
  };

  // [diag-bridge] DEBUG: assign a sequence label to each Map ref we see, so the
  // logs can show whether the same ref is being passed around or new refs flow
  // through.
  const refLabels = new WeakMap<object, string>();
  let refCounter = 0;
  const trackRefIdLabel = (obj: object | undefined): string => {
    if (!obj) return "<undef>";
    let label = refLabels.get(obj);
    if (!label) {
      refCounter += 1;
      label = `r${refCounter}`;
      refLabels.set(obj, label);
    }
    return label;
  };

  const maybeApplyDerived = (inputs: DerivedInputs) => {
    const versionHint = (latestSnapshot?.version ?? currentState.derivedSnapshot?.version ?? 0) + 1;
    const result = computeDerivedState(inputs, versionHint, usePlayerStore.getState());

    latestSnapshot = result.snapshot;

    logDerivedEvent("derivedOrchestrator", "snapshot", () => ({
      version: result.snapshot.version,
      trackCount: Object.keys(result.snapshot.tracks).length,
      rowCount: Object.keys(result.snapshot.rows).length,
    }));

    // [diag-bridge] DEBUG: trace orchestrator outputs.
     
    console.log("[diag-bridge] orchestrator maybeApplyDerived", {
      tracksRefId: trackRefIdLabel(inputs.tracks),
      instancedRefId: trackRefIdLabel(inputs.instancedTrackSources),
      stamp: usePlayerStore.getState().player.stamp,
      snapshotTrackCount: Object.keys(result.snapshot.tracks).length,
      resultValueCount: result.values.size,
      resultVelocityCount: result.velocities.size,
      resultValuesPreview: Array.from(result.values.entries()).slice(0, 4),
    });

    // Write stable derived data to the main animation store
    set({
      derivedSnapshot: result.snapshot,
    });

    // Write transient values/velocities to the dedicated values store
    const valuesState = useValuesStore.getState();
    const beforeValuesRef = valuesState.values;
    useValuesStore.setState({
      values: mergeValueMaps(valuesState.values, result.values),
      velocities: mergeValueMaps(valuesState.velocities, result.velocities),
    });
    const afterValuesRef = useValuesStore.getState().values;
     
    console.log("[diag-bridge] orchestrator wrote useValuesStore", {
      beforeRefId: trackRefIdLabel(beforeValuesRef),
      afterRefId: trackRefIdLabel(afterValuesRef),
      valuesRefChanged: beforeValuesRef !== afterValuesRef,
      newValuesCount: afterValuesRef.size,
    });
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
    }),
    (inputs) => {
      // [diag-bridge] DEBUG: trace orchestrator store-sub firing.
       
      console.log("[diag-bridge] orchestrator STORE sub fired", {
        tracksRefId: trackRefIdLabel(inputs.tracks),
        instancedRefId: trackRefIdLabel(inputs.instancedTrackSources),
        animationsRefId: trackRefIdLabel(inputs.animations),
        namespacesRefId: trackRefIdLabel(inputs.namespaces),
      });
      maybeApplyDerived(inputs);
    },
    { fireImmediately: true, equalityFn: shallow },
  );

  // Track whether a playback value update is already queued to avoid stacking
  let playbackUpdatePending = false;

  const unsubscribePlayer = usePlayerStore.subscribe(
    (state: PlayerData) => ({
      stamp: state.player.stamp,
      running: state.player.running,
      speed: state.player.speed,
      currentDirection: state.player._currentDirection,
    }),
    () => {
      if (!latestSnapshot) {
        return;
      }

      // Defer the values store write to break the synchronous cascade:
      // updatePlayer setState → this subscriber → valuesStore setState
      // Without deferral, React 19 hits max-update-depth during playback.
      if (playbackUpdatePending) return;
      playbackUpdatePending = true;
      queueMicrotask(() => {
        playbackUpdatePending = false;
        if (!latestSnapshot) return;
        const { values, velocities } = computeValueAndVelocityMaps(
          latestSnapshot,
          usePlayerStore.getState(),
        );
        const valuesState = useValuesStore.getState();
        useValuesStore.setState({
          values: mergeValueMaps(valuesState.values, values),
          velocities: mergeValueMaps(valuesState.velocities, velocities),
        });
      });
    },
    { fireImmediately: true, equalityFn: shallow },
  );

  maybeApplyDerived(initialInputs);

  return () => {
    unsubscribeStore();
    unsubscribePlayer();
  };
}
