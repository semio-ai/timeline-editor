import { getLookup, PlayerData, PlayerDirection, RawValue, usePlayerStore } from "@semio/utils";
import { shallow } from "zustand/shallow";
import type {
  AnimationApi,
  AnimationData,
  AnimationStoreGetter,
  AnimationStoreSetter,
} from "../store-types";
import {
  DerivedSnapshot,
  TrackInterpolators,
  TrackKey,
  ComputedRowData,
  Violation,
} from "../types";
import {
  matchingIdentityRawValue,
  rawValueMultiplyScalar,
  buildDerivedSnapshot,
} from "../functions";
import { parseTrackKey } from "../utils/track-key";
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
  derivedMode: AnimationData["derivedMode"];
}

interface DerivedComputation {
  snapshot: DerivedSnapshot;
  computedRows: Record<string, ComputedRowData>;
  trackInterpolators: TrackInterpolators;
  canonicalViolations: Partial<Record<TrackKey, Violation[]>>;
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
    const { namespaceId } = parseTrackKey(trackKey);
    const animatableId = track.metadata?.animatableId;
    if (!animatableId) {
      return;
    }

    const lookup = getLookup(namespaceId, animatableId);
    values.set(lookup, track.canonical.interpolator(stamp));

    const velocity = track.canonical.derivative(stamp);
    if (velocity !== undefined) {
      if (running) {
        velocities.set(lookup, rawValueMultiplyScalar(velocity, multiplier));
      } else {
        velocities.set(lookup, matchingIdentityRawValue(velocity));
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
): DerivedComputation | undefined {
  if (inputs.derivedMode !== "snapshot") {
    return undefined;
  }

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

  const computedRowData: Record<string, ComputedRowData> = {};
  Object.entries(snapshot.rows).forEach(([rowId, row]) => {
    computedRowData[rowId] = row.computed;
  });

  const { rows: rowsWithAxes } = projectRowVerticalAxes(
    computedRowData,
    inputs.editorViews,
    inputs.sourceRowIds,
  );

  const canonicalViolations: Partial<Record<TrackKey, Violation[]>> = {};
  const trackInterpolators: TrackInterpolators = {};

  Object.entries(snapshot.tracks).forEach(([trackKey, track]) => {
    const { namespaceId } = parseTrackKey(trackKey);
    const animatableId = track.metadata?.animatableId;
    if (!animatableId) return;

    const lookup = getLookup(namespaceId, animatableId);
    trackInterpolators[lookup] = {
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
    computedRows: rowsWithAxes,
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

  const initialInputs: DerivedInputs = {
    tracks: get().tracks,
    animatables: get().animatables,
    namespaces: get().namespaces,
    animations: get().animations,
    instancedTrackSources: get().instancedTrackSources,
    dragState: get().dragState,
    selectionState: get().selectionState,
    editorViews: get().editorViews,
    sourceRowIds: get().sourceRowIds,
    derivedMode: get().derivedMode,
  };

  const maybeApplyDerived = (inputs: DerivedInputs) => {
    const versionHint = (latestSnapshot?.version ?? get().derivedSnapshot?.version ?? 0) + 1;
    const result = computeDerivedState(inputs, versionHint, usePlayerStore.getState());
    if (!result) {
      latestSnapshot = undefined;
      return;
    }

    latestSnapshot = result.snapshot;

    logDerivedEvent("derivedOrchestrator", "snapshot", () => ({
      version: result.snapshot.version,
      trackCount: Object.keys(result.snapshot.tracks).length,
      rowCount: Object.keys(result.snapshot.rows).length,
    }));

    set(() => ({
      derivedSnapshot: result.snapshot,
      computedRowData: result.computedRows,
      trackInterpolators: result.trackInterpolators,
      violations: result.canonicalViolations,
      values: result.values,
      velocities: result.velocities,
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
      derivedMode: state.derivedMode,
    }),
    (inputs) => {
      if (inputs.derivedMode !== "snapshot") {
        latestSnapshot = undefined;
        return;
      }
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
      if (get().derivedMode !== "snapshot" || !latestSnapshot) {
        return;
      }

      const { values, velocities } = computeValueAndVelocityMaps(
        latestSnapshot,
        usePlayerStore.getState(),
      );
      set({ values, velocities });
    },
    { fireImmediately: true, equalityFn: shallow },
  );

  if (initialInputs.derivedMode === "snapshot") {
    maybeApplyDerived(initialInputs);
  }

  return () => {
    unsubscribeStore();
    unsubscribePlayer();
  };
}
