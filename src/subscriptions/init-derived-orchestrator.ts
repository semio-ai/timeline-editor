import { PlayerData, PlayerDirection, RawValue, usePlayerStore } from "@semio/utils";
import { shallow } from "zustand/shallow";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import { DerivedSnapshot, TrackInterpolators, TrackKey, Violation } from "../types";
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
}

interface DerivedComputation {
  snapshot: DerivedSnapshot;
  trackInterpolators: TrackInterpolators;
  canonicalViolations: Partial<Record<TrackKey, Violation[]>>;
  values: Map<string, RawValue | undefined>;
  velocities: Map<string, RawValue | undefined>;
}

function mergeValueMaps(
  base: Map<string, RawValue | undefined>,
  updates: Map<string, RawValue | undefined>,
): Map<string, RawValue | undefined> {
  const merged = new Map(base);
  updates.forEach((value, key) => {
    if (value === undefined) {
      merged.delete(key);
    } else {
      merged.set(key, value);
    }
  });
  return merged;
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
  );

  const canonicalViolations: Partial<Record<TrackKey, Violation[]>> = {};
  const trackInterpolators: TrackInterpolators = {};

  Object.entries(snapshot.tracks).forEach(([trackKey, track]) => {
    trackInterpolators[trackKey] = {
      value: track.canonical.interpolator,
      derivative: track.canonical.derivative,
    };
    canonicalViolations[trackKey as TrackKey] = track.canonical.violations;
  });

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
    trackInterpolators,
    canonicalViolations,
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

    set((state) => ({
      derivedSnapshot: result.snapshot,
      trackInterpolators: result.trackInterpolators,
      violations: result.canonicalViolations,
      values: mergeValueMaps(state.values, result.values),
      velocities: mergeValueMaps(state.velocities, result.velocities),
    }));
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
    }),
    (inputs) => {
      maybeApplyDerived(inputs);
    },
    { fireImmediately: true, equalityFn: shallow },
  );

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

      const { values, velocities } = computeValueAndVelocityMaps(
        latestSnapshot,
        usePlayerStore.getState(),
      );
      set((state) => ({
        values: mergeValueMaps(state.values, values),
        velocities: mergeValueMaps(state.velocities, velocities),
      }));
    },
    { fireImmediately: true, equalityFn: shallow },
  );

  maybeApplyDerived(initialInputs);

  return () => {
    unsubscribeStore();
    unsubscribePlayer();
  };
}
